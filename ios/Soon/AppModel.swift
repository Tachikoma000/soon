import ActivityKit
import Observation
import SwiftUI
import UIKit
import UserNotifications
import WidgetKit

/// What the Ask sheet starts with.
struct AskDraft: Identifiable, Equatable {
    enum Kind: String { case visitThem = "visit-them", visitMe = "visit-me", trip }
    var id = UUID()
    var kind: Kind = .visitThem
    var start: String
    var end: String
}

extension Notification.Name {
    /// Something changed elsewhere (a notification arrived); fetch again.
    static let soonRefresh = Notification.Name("soonRefresh")
}

@MainActor
@Observable
final class AppModel {
    enum Phase { case launching, signedOut, ready }
    enum Tab: Hashable { case home, calendar, plans }

    var phase: Phase = .launching
    var me: Me?
    var home: Home?
    var plans: PlansList?
    var tab: Tab = .home
    var homePath: [WeekendRoute] = []
    var ask: AskDraft?
    var showSettings = false
    var toast: String?
    /// Set after saying yes, for the little "It's a plan" moment.
    var justAccepted: Plan?

    private let api = SoonAPI.shared

    var them: Person? { me?.them }
    var themName: String { me?.them.name ?? "them" }

    // MARK: Start and refresh

    func start() async {
        let args = ProcessInfo.processInfo.arguments
        if args.contains("-signin") { SharedStore.clear() }
        if let i = args.firstIndex(of: "-demo") {
            let who = args.count > i + 1 && !args[i + 1].hasPrefix("-") ? args[i + 1] : "tachi"
            SharedStore.token = "demo:\(who)"
        }
        guard SharedStore.token != nil else {
            phase = .signedOut
            return
        }
        await refresh()
        if me == nil && phase == .launching { phase = .signedOut }
        await openLaunchScreen(args)
    }

    /// For screenshots: -screen weekend | calendar | plans | ask | settings
    private func openLaunchScreen(_ args: [String]) async {
        guard let i = args.firstIndex(of: "-screen"), args.count > i + 1 else { return }
        switch args[i + 1] {
        case "weekend":
            if let rows = home?.weekends, rows.count > 2 { homePath = [WeekendRoute(fri: rows[2].fri)] }
        case "calendar": tab = .calendar
        case "plans":
            tab = .plans
            await loadPlans()
        case "ask":
            let fri = home?.nextFree?.fri ?? Days.weekendFriday(Days.today())
            ask = AskDraft(kind: .visitThem, start: fri, end: Days.add(fri, 2))
        case "settings": showSettings = true
        default: break
        }
    }

    func refresh() async {
        do {
            async let m = api.get("me", as: Me.self)
            async let h = api.get("home", as: Home.self)
            let (mm, hh) = try await (m, h)
            me = mm
            home = hh
            if !SharedStore.isDemo { SharedStore.token = mm.token }
            SharedStore.timezone = mm.timezone
            phase = .ready
            try? await UNUserNotificationCenter.current().setBadgeCount(hh.badge)
            Task {
                await api.refreshWidgetData()
                WidgetCenter.shared.reloadAllTimelines()
            }
        } catch let e as APIError where e.status == 401 {
            signOut()
        } catch {
            if phase == .ready { show(error) }
        }
    }

    func loadPlans() async {
        do { plans = try await api.get("plans", as: PlansList.self) } catch { show(error) }
    }

    func show(_ error: Error) {
        show((error as? LocalizedError)?.errorDescription ?? "Something went wrong. Try again.")
    }

    func show(_ text: String) {
        withAnimation(.snappy) { toast = text }
        Task {
            try? await Task.sleep(for: .seconds(3))
            withAnimation(.snappy) { if toast == text { toast = nil } }
        }
    }

    /// Run a change, then fetch everything again.
    @discardableResult
    private func change(_ work: () async throws -> Void) async -> Bool {
        do {
            try await work()
            await refresh()
            if plans != nil { await loadPlans() }
            return true
        } catch {
            show(error)
            await refresh()
            return false
        }
    }

    // MARK: Sign in

    func signedIn(token: String) async {
        SharedStore.token = token
        await refresh()
        PushCenter.shared.startWatching()
    }

    func signOut() {
        SharedStore.clear()
        me = nil
        home = nil
        plans = nil
        phase = .signedOut
        WidgetCenter.shared.reloadAllTimelines()
    }

    // MARK: Plans

    func accept(_ plan: Plan, eventTitle: String? = nil) async {
        var body: [String: Any] = [:]
        if let t = eventTitle, !t.isEmpty { body["eventTitle"] = t }
        let ok = await change { _ = try await api.call("POST", "plans/\(plan.id)/accept", body, as: Empty.self) }
        if ok {
            UINotificationFeedbackGenerator().notificationOccurred(.success)
            withAnimation(.spring(duration: 0.6)) { justAccepted = plan }
        }
    }

    func decline(_ plan: Plan) async {
        await change { _ = try await api.call("POST", "plans/\(plan.id)/decline", nil, as: Empty.self) }
    }

    func cancel(_ plan: Plan) async {
        await change { _ = try await api.call("POST", "plans/\(plan.id)/cancel", nil, as: Empty.self) }
    }

    struct Proposal {
        var kind: AskDraft.Kind
        var start: String
        var end: String
        var arrive: String?
        var title: String?
        var note: String?
        var eventTitle: String?
        var isPrivate: Bool
        var drive: Bool?
    }

    func propose(_ p: Proposal) async -> Bool {
        var body: [String: Any] = ["kind": p.kind.rawValue, "start": p.start, "end": p.end, "private": p.isPrivate]
        if let v = p.arrive { body["arrive"] = v }
        if let v = p.title, !v.isEmpty { body["title"] = v }
        if let v = p.note, !v.isEmpty { body["note"] = v }
        if let v = p.eventTitle, !v.isEmpty { body["eventTitle"] = v }
        if let v = p.drive { body["drive"] = v }
        let ok = await change { _ = try await api.call("POST", "plans", body, as: Empty.self) }
        if ok {
            UINotificationFeedbackGenerator().notificationOccurred(.success)
            show("Sent to \(themName)")
            await loadPlans()
        }
        return ok
    }

    func signal(day: String, value: String?) async {
        await change { _ = try await api.call("POST", "signal", ["day": day, "value": value.map { $0 as Any } ?? NSNull()], as: Empty.self) }
    }

    // MARK: On the way

    struct RoadReply: Decodable {
        struct R: Decodable { let leftAt: Double; let eta: Double }
        let road: R?
    }

    /// Leaving now: tell the server (which starts it on their phone), and start it here too.
    func leave(_ plan: Plan) async {
        guard let me else { return }
        var reply: RoadReply?
        let ok = await change { reply = try await api.call("POST", "road", ["planId": plan.id, "startedHere": true], as: RoadReply.self) }
        guard ok else { return }
        let now = Date().timeIntervalSince1970
        let left = (reply?.road?.leftAt).map { $0 / 1000 } ?? now
        let eta = (reply?.road?.eta).map { $0 / 1000 } ?? now + Double(me.driveMinutes * 60)
        startActivity(left: left, eta: eta)
    }

    func startActivity(left: Double, eta: Double) {
        guard let me, ActivityAuthorizationInfo().areActivitiesEnabled else { return }
        for a in Activity<RoadAttributes>.activities { Task { await a.end(nil, dismissalPolicy: .immediate) } }
        let attrs = RoadAttributes(travelerId: me.me.id, traveler: me.me.name, host: me.them.name, city: me.them.home)
        let state = RoadAttributes.ContentState(leftAt: left, eta: eta, arrived: false)
        do {
            let activity = try Activity.request(
                attributes: attrs,
                content: .init(state: state, staleDate: Date(timeIntervalSince1970: eta + 45 * 60), relevanceScore: 100),
                pushType: .token
            )
            PushCenter.shared.follow(activity)
        } catch {
            // Live Activities turned off; the website and notifications still work.
        }
    }

    func runningLate(_ minutes: Int) async {
        await change { _ = try await api.call("POST", "road/late", ["minutes": minutes], as: Empty.self) }
    }

    func arrived() async {
        let ok = await change { _ = try await api.call("DELETE", "road", nil, as: Empty.self) }
        guard ok else { return }
        for a in Activity<RoadAttributes>.activities {
            var s = a.content.state
            s.arrived = true
            await a.end(.init(state: s, staleDate: nil), dismissalPolicy: .after(Date().addingTimeInterval(15 * 60)))
        }
    }

    // MARK: Settings

    func saveSettings(eventTitle: String?, eventPrivate: Bool, includeDrive: Bool, calendars: [String]?) async {
        var body: [String: Any] = ["eventTitle": eventTitle.map { $0 as Any } ?? NSNull(), "eventPrivate": eventPrivate, "includeDrive": includeDrive]
        if let calendars { body["calendars"] = calendars }
        await change { _ = try await api.call("PATCH", "settings", body, as: Empty.self) }
    }

    /// Turning sharing on may need one more Google permission: returns where to go for it.
    func setShare(_ on: Bool) async -> URL? {
        do {
            let r = try await api.call("POST", "share", ["on": on], as: ShareResult.self)
            await refresh()
            if r.status == "consent", let s = r.url { return URL(string: s) }
        } catch {
            show(error)
        }
        return nil
    }

    func makeInvite() async -> String? {
        do { return try await api.call("POST", "invite", nil, as: InviteResult.self).url } catch {
            show(error)
            return nil
        }
    }

    func finishHello() async {
        _ = try? await api.call("POST", "onboarded", nil, as: Empty.self)
        await refresh()
    }
}

import ActivityKit
import UIKit
import UserNotifications
import WidgetKit

/// Notifications, the answer buttons on them, and the push tokens Live Activities need.
@MainActor
final class PushCenter: NSObject, UNUserNotificationCenterDelegate {
    static let shared = PushCenter()
    private var watching = false
    private var followed = Set<String>()

    func setUp() {
        let center = UNUserNotificationCenter.current()
        center.delegate = self
        let yes = UNNotificationAction(identifier: "YES", title: "Yes", options: [])
        let no = UNNotificationAction(identifier: "NO", title: "Not then", options: [])
        center.setNotificationCategories([
            UNNotificationCategory(identifier: "PROPOSAL", actions: [yes, no], intentIdentifiers: [], options: []),
        ])
    }

    var isAllowed: Bool {
        get async { await UNUserNotificationCenter.current().notificationSettings().authorizationStatus == .authorized }
    }

    /// Ask once; afterwards the answer lives in the Settings app.
    @discardableResult
    func ask() async -> Bool {
        let granted = (try? await UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .badge, .sound])) ?? false
        if granted { UIApplication.shared.registerForRemoteNotifications() }
        return granted
    }

    /// Signed in: register this phone and keep Live Activity tokens up to date.
    func startWatching() {
        guard SharedStore.token != nil, !SharedStore.isDemo else { return }
        Task {
            if await isAllowed { UIApplication.shared.registerForRemoteNotifications() }
        }
        guard !watching else { return }
        watching = true
        Task {
            for await token in Activity<RoadAttributes>.pushToStartTokenUpdates {
                await SoonAPI.shared.registerDevice(token, kind: "start")
            }
        }
        Task {
            for await activity in Activity<RoadAttributes>.activityUpdates {
                follow(activity)
            }
        }
        for activity in Activity<RoadAttributes>.activities { follow(activity) }
    }

    /// Send each running Live Activity's update token to the server.
    func follow(_ activity: Activity<RoadAttributes>) {
        guard !followed.contains(activity.id) else { return }
        followed.insert(activity.id)
        Task {
            for await token in activity.pushTokenUpdates {
                await SoonAPI.shared.registerDevice(token, kind: "activity", ref: activity.id)
            }
        }
    }

    // MARK: UNUserNotificationCenterDelegate

    nonisolated func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent notification: UNNotification) async -> UNNotificationPresentationOptions {
        await MainActor.run { NotificationCenter.default.post(name: .soonRefresh, object: nil) }
        return [.banner, .sound, .list]
    }

    nonisolated func userNotificationCenter(_ center: UNUserNotificationCenter, didReceive response: UNNotificationResponse) async {
        let info = response.notification.request.content.userInfo
        if let planId = info["planId"] as? String {
            switch response.actionIdentifier {
            case "YES": _ = try? await SoonAPI.shared.call("POST", "plans/\(planId)/accept", nil, as: Empty.self)
            case "NO": _ = try? await SoonAPI.shared.call("POST", "plans/\(planId)/decline", nil, as: Empty.self)
            default: break
            }
        }
        await SoonAPI.shared.refreshWidgetData()
        await MainActor.run {
            WidgetCenter.shared.reloadAllTimelines()
            NotificationCenter.default.post(name: .soonRefresh, object: nil)
        }
    }
}

@MainActor
final class AppDelegate: NSObject, UIApplicationDelegate {
    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil) -> Bool {
        PushCenter.shared.setUp()
        PushCenter.shared.startWatching()
        return true
    }

    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        Task { await SoonAPI.shared.registerDevice(deviceToken, kind: "alert") }
    }

    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {}

    /// A quiet nudge from the server: something changed, so redraw the widgets.
    func application(_ application: UIApplication, didReceiveRemoteNotification userInfo: [AnyHashable: Any]) async -> UIBackgroundFetchResult {
        await SoonAPI.shared.refreshWidgetData()
        WidgetCenter.shared.reloadAllTimelines()
        NotificationCenter.default.post(name: .soonRefresh, object: nil)
        return .newData
    }
}

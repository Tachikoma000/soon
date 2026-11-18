import SwiftUI
import WidgetKit

/// Every widget face and the Live Activity, drawn at real sizes, so they can be checked
/// in the simulator without adding them by hand. Opened with the -gallery launch argument.
struct Gallery: View {
    private var page: String {
        let args = ProcessInfo.processInfo.arguments
        guard let i = args.firstIndex(of: "-gallery"), args.count > i + 1 else { return "home" }
        return args[i + 1]
    }

    private var data: WidgetData? {
        let args = ProcessInfo.processInfo.arguments
        let i = args.firstIndex(of: "-demo")
        let who = i.flatMap { args.count > $0 + 1 && !args[$0 + 1].hasPrefix("-") ? args[$0 + 1] : nil } ?? "tachi"
        return Demo.file("widget", person: who).flatMap { try? JSONDecoder().decode(WidgetData.self, from: $0) }
    }

    /// The same data with a drive under way: left 40 minutes ago.
    private var driving: WidgetData? {
        guard let d = data, let p = d.upcoming.first else { return data }
        let left = Date().addingTimeInterval(-40 * 60).timeIntervalSince1970 * 1000
        let road = Road(planId: p.id, mine: p.traveler == "me", leftAt: left, eta: left + 105 * 60_000, plan: p)
        return WidgetData(me: d.me, them: d.them, today: d.today, generatedAt: d.generatedAt, upcoming: d.upcoming, badge: d.badge, road: road, nextFree: d.nextFree)
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 18) {
                switch page {
                case "lock": lock
                case "road": road
                default: home
                }
            }
            .padding(.vertical, 24)
            .frame(maxWidth: .infinity)
        }
        .background(
            LinearGradient(colors: [Color(hex: 0xC9D4BE), Color(hex: 0xE9CDB8)], startPoint: .top, endPoint: .bottom)
                .ignoresSafeArea()
        )
    }

    private func content(_ mode: WidgetMode, _ d: WidgetData? = nil) -> WidgetContent {
        WidgetContent(data: d ?? data, mode: mode, date: Date())
    }

    private func tile<V: View>(_ w: CGFloat, _ h: CGFloat, fill: Color = .paper, @ViewBuilder _ v: () -> V) -> some View {
        v()
            .padding(16)
            .frame(width: w, height: h, alignment: .topLeading)
            .background(RoundedRectangle(cornerRadius: 24, style: .continuous).fill(fill))
            .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))
            .shadow(color: .black.opacity(0.12), radius: 10, y: 4)
    }

    // MARK: Home Screen

    private var home: some View {
        VStack(spacing: 18) {
            HStack(spacing: 22) {
                tile(170, 170) { SmallWidgetView(content: content(.together)) }
                tile(170, 170) { SmallWidgetView(content: content(.trip)) }
            }
            tile(364, 170) { MediumWidgetView(content: content(.together)) }
            tile(364, 382) { LargeWidgetView(content: content(.together)) }
        }
    }

    // MARK: Lock Screen

    private var lock: some View {
        VStack(spacing: 14) {
            InlineWidgetView(content: content(.together))
                .font(.system(size: 16, weight: .medium))
                .foregroundStyle(.white)
            Text("9:41")
                .font(.system(size: 96, weight: .semibold, design: .rounded))
                .foregroundStyle(.white.opacity(0.92))
            HStack(spacing: 12) {
                CircularWidgetView(content: content(.together)).frame(width: 72, height: 72)
                CircularWidgetView(content: content(.trip)).frame(width: 72, height: 72)
                RectangularWidgetView(content: content(.together)).frame(width: 170, height: 72)
            }
            .foregroundStyle(.white)
            .environment(\.colorScheme, .dark)
            Spacer(minLength: 40)
            roadBanner(driving: false)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 20)
        .background(
            LinearGradient(colors: [Color(hex: 0x3B4A35), Color(hex: 0x7A4A33)], startPoint: .top, endPoint: .bottom)
                .clipShape(RoundedRectangle(cornerRadius: 40, style: .continuous))
                .padding(.horizontal, 8)
        )
    }

    // MARK: On the way

    private var road: some View {
        VStack(spacing: 22) {
            island
            roadBanner(driving: false)
            roadBanner(driving: true)
            HStack(spacing: 22) {
                tile(170, 170, fill: .fernSoft) { SmallWidgetView(content: content(.together, driving)) }
                tile(170, 170) { SmallWidgetView(content: content(.trip, driving)) }
            }
        }
    }

    private var roadState: RoadAttributes.ContentState {
        let r = driving?.road
        return RoadAttributes.ContentState(leftAt: (r?.leftAt ?? 0) / 1000, eta: (r?.eta ?? 0) / 1000, arrived: false)
    }

    private var attrs: RoadAttributes {
        let traveler = data?.upcoming.first?.traveler == "me" ? data?.me : data?.them
        let host = data?.upcoming.first?.traveler == "me" ? data?.them : data?.me
        return RoadAttributes(travelerId: traveler?.id ?? "", traveler: traveler?.name ?? "", host: host?.name ?? "", city: host?.home ?? "")
    }

    private func roadBanner(driving: Bool) -> some View {
        RoadLockView(words: RoadWords(attrs: attrs, state: roadState, stale: false, driving: driving))
            .frame(width: 370)
            .background(RoundedRectangle(cornerRadius: 26, style: .continuous).fill(Color.fernSoft))
    }

    private var island: some View {
        let words = RoadWords(attrs: attrs, state: roadState, stale: false, driving: false)
        return VStack(spacing: 12) {
            HStack {
                SunMark(size: 18)
                Spacer()
                Text(Days.clock(roadState.etaDate, meridiem: false)).font(.system(size: 13, weight: .semibold)).foregroundStyle(Color.sun)
            }
            .padding(.horizontal, 14)
            .frame(width: 250, height: 37)
            .background(Capsule().fill(.black))
            VStack(spacing: 10) {
                HStack {
                    SunMark(size: 28)
                    Spacer()
                    Text(words.title).font(Typeface.serif(19)).foregroundStyle(.white)
                    Spacer()
                    Text(Days.clock(roadState.etaDate)).font(Typeface.sans(16, .medium)).foregroundStyle(Color.sun)
                }
                RoadIslandBottom(words: words)
            }
            .padding(18)
            .frame(width: 370)
            .background(RoundedRectangle(cornerRadius: 42, style: .continuous).fill(.black))
        }
    }
}

import ActivityKit
import SwiftUI
import WidgetKit

@main
struct SoonWidgets: WidgetBundle {
    var body: some Widget {
        TogetherWidget()
        TripWidget()
        RoadLiveActivity()
    }
}

// MARK: - Timeline

struct SoonEntry: TimelineEntry {
    let date: Date
    let content: WidgetContent
}

struct SoonProvider: TimelineProvider {
    let mode: WidgetMode

    func placeholder(in context: Context) -> SoonEntry {
        SoonEntry(date: Date(), content: WidgetContent(data: SharedStore.widget ?? Sample.widget, mode: mode, date: Date()))
    }

    func getSnapshot(in context: Context, completion: @escaping (SoonEntry) -> Void) {
        completion(placeholder(in: context))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<SoonEntry>) -> Void) {
        let mode = self.mode
        Task {
            // Fresh from the server when signed in; otherwise whatever the app last saved.
            let data: WidgetData? = SharedStore.isDemo || SharedStore.token == nil ? SharedStore.widget : await SoonAPI.shared.refreshWidgetData()
            let now = Date()
            var dates = [now]
            // The countdown ticks over at midnight.
            let cal = Days.calendar
            var day = cal.startOfDay(for: now)
            for _ in 0..<4 {
                day = cal.date(byAdding: .day, value: 1, to: day) ?? day.addingTimeInterval(86400)
                dates.append(day.addingTimeInterval(5))
            }
            // A drive drops off the widget a couple of hours after it should have ended.
            if let road = data?.road { dates.append(road.etaDate.addingTimeInterval(2 * 3600 + 60)) }
            let entries = dates.filter { $0 >= now }.sorted().map {
                SoonEntry(date: $0, content: WidgetContent(data: data, mode: mode, date: $0))
            }
            completion(Timeline(entries: entries, policy: .after(now.addingTimeInterval(3 * 3600))))
        }
    }
}

/// When something changes on the server, Apple can nudge the widgets directly.
struct SoonPushHandler: WidgetPushHandler {
    func pushTokenDidChange(_ pushInfo: WidgetPushInfo, widgets: [WidgetInfo]) {
        let token = pushInfo.token
        Task { await SoonAPI.shared.registerDevice(token, kind: "widget") }
    }
}

struct SoonWidgetView: View {
    @Environment(\.widgetFamily) private var family
    let entry: SoonEntry

    var body: some View {
        face
            .containerBackground(background, for: .widget)
            .widgetURL(URL(string: "soon://home"))
    }

    @ViewBuilder private var face: some View {
        switch family {
        case .systemMedium: MediumWidgetView(content: entry.content)
        case .systemLarge: LargeWidgetView(content: entry.content)
        case .accessoryCircular: CircularWidgetView(content: entry.content)
        case .accessoryRectangular: RectangularWidgetView(content: entry.content)
        case .accessoryInline: InlineWidgetView(content: entry.content)
        default: SmallWidgetView(content: entry.content)
        }
    }

    private var background: Color {
        switch family {
        case .accessoryCircular, .accessoryRectangular, .accessoryInline: return .clear
        default: return entry.content.road != nil ? .fernSoft : .paper
        }
    }
}

struct TogetherWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "together", provider: SoonProvider(mode: .together)) { entry in
            SoonWidgetView(entry: entry)
        }
        .configurationDisplayName("Soon")
        .description("Days until we’re together.")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge, .accessoryCircular, .accessoryRectangular, .accessoryInline])
        .pushHandler(SoonPushHandler.self)
    }
}

struct TripWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "trip", provider: SoonProvider(mode: .trip)) { entry in
            SoonWidgetView(entry: entry)
        }
        .configurationDisplayName("Our next trip")
        .description("Days until we go.")
        .supportedFamilies([.systemSmall, .systemMedium, .accessoryCircular, .accessoryRectangular])
        .pushHandler(SoonPushHandler.self)
    }
}

// MARK: - On the way

struct RoadLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: RoadAttributes.self) { context in
            RoadLockView(words: RoadWords(attrs: context.attributes, state: context.state, stale: context.isStale))
                .activityBackgroundTint(Color.fernSoft)
                .activitySystemActionForegroundColor(Color.fernInk)
        } dynamicIsland: { context in
            let words = RoadWords(attrs: context.attributes, state: context.state, stale: context.isStale)
            return DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    SunMark(size: 28).padding(.leading, 6)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    if !context.state.arrived {
                        Text(Days.clock(context.state.etaDate))
                            .font(Typeface.sans(16, .medium))
                            .foregroundStyle(Color.sun)
                            .padding(.trailing, 6)
                    }
                }
                DynamicIslandExpandedRegion(.center) {
                    Text(words.title).font(Typeface.serif(19)).foregroundStyle(.white).lineLimit(1)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    if !context.state.arrived { RoadIslandBottom(words: words).padding(.horizontal, 6) }
                }
            } compactLeading: {
                SunMark(size: 18)
            } compactTrailing: {
                if context.state.arrived {
                    Image(systemName: "heart.fill").foregroundStyle(Color.sun)
                } else {
                    Text(Days.clock(context.state.etaDate, meridiem: false))
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(Color.sun)
                }
            } minimal: {
                SunMark(size: 16)
            }
            .keylineTint(Color.sun)
        }
    }
}

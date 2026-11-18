import SwiftUI
import WidgetKit

/// Which countdown a widget follows.
enum WidgetMode: String, Sendable {
    /// The next time you're together, visit or trip.
    case together
    /// The next trip only.
    case trip
}

/// Everything a widget face needs at one moment.
struct WidgetContent {
    let data: WidgetData?
    let mode: WidgetMode
    let date: Date

    var today: String { Days.today(date) }
    var them: String { data?.them.name ?? "them" }

    var plan: Plan? {
        let list = (data?.upcoming ?? []).filter { $0.endDay >= today }
        return mode == .trip ? list.first(where: { $0.isTrip }) : list.first
    }

    var countdown: Countdown? { plan.map { Countdown($0, today: today) } }

    /// A drive in progress, until a couple of hours after it should have ended.
    var road: Road? {
        guard mode == .together, let r = data?.road else { return nil }
        return date < r.etaDate.addingTimeInterval(2 * 3600) ? r : nil
    }

    var nextFree: WidgetData.Free? { data?.nextFree }

    /// Later plans for the large widget.
    var later: [Plan] {
        let list = (data?.upcoming ?? []).filter { $0.endDay >= today && $0.id != plan?.id }
        return Array(list.prefix(3))
    }
}

// MARK: - Home Screen

struct SmallWidgetView: View {
    let content: WidgetContent

    var body: some View {
        if let road = content.road {
            RoadSmall(road: road, them: content.them)
        } else if let c = content.countdown {
            VStack(alignment: .leading, spacing: 0) {
                HStack(alignment: .top) {
                    Spacer(minLength: 0)
                    Sunflower(bloom: c.bloom, stem: false).frame(width: 38, height: 38)
                }
                Spacer(minLength: 0)
                CountNumber(c: c, size: c.isNumber ? 56 : 34)
                Text(c.line)
                    .font(Typeface.serif(16))
                    .foregroundStyle(Color.ink)
                    .lineLimit(2)
                    .minimumScaleFactor(0.8)
                    .padding(.top, 4)
            }
        } else if let free = content.nextFree {
            NextFreeSmall(free: free)
        } else {
            NothingYet()
        }
    }
}

struct MediumWidgetView: View {
    let content: WidgetContent

    var body: some View {
        if let road = content.road {
            RoadMedium(road: road, them: content.them)
        } else if let c = content.countdown {
            HStack(alignment: .bottom, spacing: 8) {
                VStack(alignment: .leading, spacing: 0) {
                    CountNumber(c: c, size: c.isNumber ? 64 : 40)
                    Spacer(minLength: 6)
                    Text(c.line)
                        .font(Typeface.serif(19))
                        .foregroundStyle(Color.ink)
                        .lineLimit(1)
                        .minimumScaleFactor(0.8)
                    Text("\(c.plan.place) · \(c.plan.range)")
                        .font(Typeface.sans(12.5))
                        .foregroundStyle(Color.ink2)
                        .lineLimit(1)
                        .padding(.top, 3)
                }
                Spacer(minLength: 0)
                Sunflower(bloom: c.bloom)
                    .frame(height: 128)
                    .padding(.bottom, -14)
            }
        } else if let free = content.nextFree {
            HStack {
                NextFreeSmall(free: free)
                Spacer()
                Sunflower(bloom: 1).frame(height: 120).padding(.bottom, -14)
            }
        } else {
            NothingYet()
        }
    }
}

struct LargeWidgetView: View {
    let content: WidgetContent

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            if let road = content.road {
                RoadMedium(road: road, them: content.them).frame(height: 132)
            } else if let c = content.countdown {
                HStack(alignment: .bottom) {
                    VStack(alignment: .leading, spacing: 8) {
                        CountNumber(c: c, size: c.isNumber ? 84 : 48)
                        Text(c.line).font(Typeface.serif(22)).foregroundStyle(Color.ink).lineLimit(1).minimumScaleFactor(0.8)
                        Text("\(c.plan.place) · \(c.plan.dayRange)").font(Typeface.sans(12.5)).foregroundStyle(Color.ink2).lineLimit(1)
                    }
                    Spacer(minLength: 0)
                    Sunflower(bloom: c.bloom, sway: false).frame(height: 150).padding(.bottom, -8)
                }
            } else {
                NothingYet()
            }
            Spacer(minLength: 10)
            VStack(spacing: 0) {
                ForEach(content.later) { p in
                    Rule()
                    HStack {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(p.name).font(Typeface.serif(17)).foregroundStyle(Color.ink).lineLimit(1)
                            Text(p.range).font(Typeface.sans(12)).foregroundStyle(Color.ink2)
                        }
                        Spacer()
                        let n = Days.between(content.today, p.startDay)
                        Text(n > 0 ? "\(n)" : "Now").font(Typeface.serif(22)).foregroundStyle(Color.ink)
                    }
                    .padding(.vertical, 8)
                }
                if let free = content.nextFree {
                    Rule()
                    HStack(spacing: 7) {
                        SunMark(size: 14)
                        Text("Free \(free.range)").font(Typeface.sans(13, .medium)).foregroundStyle(Color.ink2)
                        Spacer()
                    }
                    .padding(.top, 9)
                }
            }
        }
    }
}

/// "10 days", in Newsreader.
struct CountNumber: View {
    let c: Countdown
    var size: CGFloat

    var body: some View {
        HStack(alignment: .lastTextBaseline, spacing: size * 0.08) {
            Text(c.big)
                .font(Typeface.display(size))
                .tracking(c.isNumber ? -0.045 * size : -0.03 * size)
                .foregroundStyle(Color.ink)
                .minimumScaleFactor(0.6)
                .lineLimit(1)
            if c.isNumber {
                Text(c.unit).font(Typeface.serif(max(14, size * 0.3))).foregroundStyle(Color.ink)
            }
        }
    }
}

private struct NextFreeSmall: View {
    let free: WidgetData.Free

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            SunMark(size: 22)
            Spacer(minLength: 0)
            Text(free.range).font(Typeface.display(30)).tracking(-0.6).foregroundStyle(Color.ink).lineLimit(1).minimumScaleFactor(0.7)
            Text("You’re both free").font(Typeface.sans(13)).foregroundStyle(Color.ink2)
        }
    }
}

private struct NothingYet: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Sunflower(bloom: 0, stem: false).frame(width: 34, height: 34)
            Spacer(minLength: 0)
            Text("Nothing planned yet").font(Typeface.serif(17)).foregroundStyle(Color.ink)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

// MARK: - On the way, in a widget

private func roadTitle(_ road: Road, _ them: String) -> String { road.mine ? "On your way" : "\(them)’s on the way" }

private struct RoadSmall: View {
    let road: Road
    let them: String

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Image(systemName: "car.side").font(.system(size: 18, weight: .medium)).foregroundStyle(Color.fern)
            Spacer(minLength: 0)
            Text(roadTitle(road, them)).font(Typeface.serif(19)).foregroundStyle(Color.fernInk).lineLimit(2)
            Text("There around \(Days.clock(road.etaDate))").font(Typeface.sans(12.5)).foregroundStyle(Color.fernInk.opacity(0.8))
            RoadLine(left: road.leftDate, eta: road.etaDate)
        }
    }
}

private struct RoadMedium: View {
    let road: Road
    let them: String

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 8) {
                Image(systemName: "car.side").foregroundStyle(Color.fern)
                Text(roadTitle(road, them)).font(Typeface.serif(22)).foregroundStyle(Color.fernInk)
            }
            Text("There around \(Days.clock(road.etaDate))").font(Typeface.sans(14)).foregroundStyle(Color.fernInk.opacity(0.85))
            Spacer(minLength: 0)
            RoadLine(left: road.leftDate, eta: road.etaDate)
        }
    }
}

/// The dashed road with a dot that moves on its own.
struct RoadLine: View {
    let left: Date
    let eta: Date
    var tint: Color = .fern

    var body: some View {
        ProgressView(timerInterval: left...max(eta, left.addingTimeInterval(60)), countsDown: false) {
            EmptyView()
        } currentValueLabel: {
            EmptyView()
        }
        .progressViewStyle(.linear)
        .tint(tint)
    }
}

// MARK: - Lock Screen

struct CircularWidgetView: View {
    let content: WidgetContent

    var body: some View {
        if let road = content.road {
            ZStack {
                AccessoryWidgetBackground()
                VStack(spacing: 0) {
                    Image(systemName: "car.side").font(.system(size: 13, weight: .semibold))
                    Text(road.etaDate, format: .dateTime.hour().minute())
                        .font(.system(size: 12, weight: .semibold))
                        .minimumScaleFactor(0.7)
                }
            }
        } else if let c = content.countdown {
            Gauge(value: c.bloom) {
                EmptyView()
            } currentValueLabel: {
                if c.isNumber {
                    Text(c.big).font(Typeface.display(c.days > 99 ? 18 : 24))
                } else {
                    Image(systemName: "sun.max.fill")
                }
            }
            .gaugeStyle(.accessoryCircularCapacity)
            .widgetAccentable()
        } else {
            ZStack {
                AccessoryWidgetBackground()
                Image(systemName: "sun.max")
            }
        }
    }
}

struct RectangularWidgetView: View {
    let content: WidgetContent

    var body: some View {
        if let road = content.road {
            VStack(alignment: .leading, spacing: 1) {
                Text(roadTitle(road, content.them)).font(.system(size: 15, weight: .semibold)).widgetAccentable()
                Text("There around \(Days.clock(road.etaDate))").font(.system(size: 13))
                RoadLine(left: road.leftDate, eta: road.etaDate, tint: .primary)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        } else if let c = content.countdown {
            VStack(alignment: .leading, spacing: 0) {
                HStack(alignment: .lastTextBaseline, spacing: 4) {
                    Text(c.big).font(Typeface.display(c.isNumber ? 30 : 22)).widgetAccentable()
                    if c.isNumber { Text(c.unit).font(Typeface.serif(15)) }
                }
                Text(c.line).font(.system(size: 14, weight: .medium)).lineLimit(1)
                Text(c.plan.range).font(.system(size: 12)).foregroundStyle(.secondary).lineLimit(1)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        } else if let free = content.nextFree {
            VStack(alignment: .leading, spacing: 1) {
                Text("Both free").font(.system(size: 13)).foregroundStyle(.secondary)
                Text(free.range).font(Typeface.display(22)).widgetAccentable()
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        } else {
            Text("Nothing planned yet").font(.system(size: 14))
        }
    }
}

struct InlineWidgetView: View {
    let content: WidgetContent

    var body: some View {
        if let road = content.road {
            Label("\(road.mine ? "There" : content.them) around \(Days.clock(road.etaDate))", systemImage: "car.side")
        } else if let c = content.countdown {
            if c.isNumber {
                Label("\(c.big) \(c.unit) \(c.line)", systemImage: "sun.max")
            } else {
                Label(c.days == 0 ? "Today" : "Together", systemImage: "sun.max.fill")
            }
        } else {
            Label("Soon", systemImage: "sun.max")
        }
    }
}

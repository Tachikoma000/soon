import SwiftUI

struct CalendarScreen: View {
    @Environment(AppModel.self) private var model
    @State private var ym = String(Days.today().prefix(7))
    @State private var months: [String: Month] = [:]
    @State private var start: String?
    @State private var end: String?

    private var thisMonth: String { String(Days.today().prefix(7)) }
    private var maxMonth: String { Days.shiftMonth(thisMonth, 12) }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 22) {
                header
                if let m = months[ym] {
                    grid(m)
                    selection(m)
                } else {
                    ProgressView().frame(maxWidth: .infinity, minHeight: 360)
                }
            }
            .padding(.horizontal, 22)
            .padding(.top, 8)
            .padding(.bottom, 32)
        }
        .paper()
        .toolbar(.hidden, for: .navigationBar)
        .task(id: ym) { await load(ym) }
        .refreshable {
            months[ym] = nil
            await load(ym)
        }
    }

    private func load(_ month: String) async {
        if months[month] == nil, let m = try? await SoonAPI.shared.get("month/\(month)", as: Month.self) {
            months[month] = m
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                let t = Days.month(ym)
                (Text(t.name) + Text(t.year == String(thisMonth.prefix(4)) ? "" : " \(t.year)").foregroundStyle(Color.ink3))
                    .font(Typeface.serif(36))
                    .em(-0.02, 36)
                    .foregroundStyle(Color.ink)
                Spacer()
                Button { ym = Days.shiftMonth(ym, -1) } label: { Image(systemName: "chevron.left").frame(width: 44, height: 44) }
                    .disabled(ym <= thisMonth)
                    .accessibilityLabel("Previous month")
                Button { ym = Days.shiftMonth(ym, 1) } label: { Image(systemName: "chevron.right").frame(width: 44, height: 44) }
                    .disabled(ym >= maxMonth)
                    .accessibilityLabel("Next month")
                    .padding(.trailing, -10)
            }
            .font(.system(size: 18, weight: .medium))
            .foregroundStyle(Color.ink)
            HStack(spacing: 14) {
                HStack(spacing: 6) { Mark(who: .me, state: "b", large: true); Text("You") }
                HStack(spacing: 6) { Mark(who: .them, state: "b", large: true); Text(model.themName) }
            }
            .font(Typeface.sans(13))
            .foregroundStyle(Color.ink2)
            .accessibilityElement(children: .combine)
            .accessibilityLabel("Dots mark busy days")
        }
    }

    private func grid(_ m: Month) -> some View {
        let columns = Array(repeating: GridItem(.flexible(), spacing: 0), count: 7)
        let last = end ?? start
        return VStack(spacing: 6) {
            HStack(spacing: 0) {
                ForEach(0..<7, id: \.self) { i in
                    Text(String(Days.shortDays[i].prefix(1)))
                        .font(Typeface.sans(12, .medium))
                        .foregroundStyle(i == 0 || i >= 5 ? Color.ink : Color.ink3)
                        .frame(maxWidth: .infinity)
                }
            }
            LazyVGrid(columns: columns, spacing: 2) {
                ForEach(0..<m.lead, id: \.self) { _ in Color.clear.frame(height: 54) }
                ForEach(m.cells) { c in
                    let w = Days.dow(c.day)
                    let inRange = start != nil && c.day >= start! && c.day <= last!
                    DayCell(
                        cell: c,
                        weekend: w == 0 || w >= 5,
                        past: c.day < m.todayStr,
                        today: c.day == m.todayStr,
                        inRange: inRange,
                        roundLeft: inRange && (c.day == start || w == 0),
                        roundRight: inRange && (c.day == last || w == 6),
                        isEnd: c.day == start || c.day == last,
                        themName: model.themName
                    ) { pick(c.day) }
                }
            }
        }
        .gesture(DragGesture(minimumDistance: 30).onEnded { g in
            if g.translation.width < -50, ym < maxMonth { ym = Days.shiftMonth(ym, 1) }
            if g.translation.width > 50, ym > thisMonth { ym = Days.shiftMonth(ym, -1) }
        })
    }

    private func pick(_ day: String) {
        withAnimation(.snappy(duration: 0.2)) {
            if start == nil || end != nil {
                start = day
                end = nil
            } else if let s = start, day < s {
                start = day
            } else {
                end = day
            }
        }
    }

    @ViewBuilder private func selection(_ m: Month) -> some View {
        VStack(alignment: .leading, spacing: 18) {
            Rule()
            if let s = start, let e = end {
                HStack {
                    Text(s == e ? Days.short(s) : Days.range(s, e)).font(Typeface.serif(30)).foregroundStyle(Color.ink)
                    Spacer()
                    Button {
                        withAnimation(.snappy) { start = nil; end = nil }
                    } label: {
                        Image(systemName: "xmark").font(.system(size: 16, weight: .medium)).foregroundStyle(Color.ink2).frame(width: 44, height: 44)
                    }
                    .accessibilityLabel("Clear")
                    .padding(.trailing, -10)
                }
                let found = conflicts(s, e)
                if found.isEmpty {
                    HStack(spacing: 8) {
                        SunMark(size: 18)
                        Text("You’re both free.").font(Typeface.sans(16)).foregroundStyle(Color.ink2)
                    }
                } else {
                    VStack(alignment: .leading, spacing: 8) {
                        ForEach(found, id: \.text) { k in
                            HStack(spacing: 10) {
                                Mark(who: k.who, state: k.state, large: true)
                                Text(k.text).font(Typeface.sans(15)).foregroundStyle(Color.ink2)
                            }
                        }
                    }
                }
                Button("Ask \(model.themName)") {
                    model.ask = AskDraft(kind: Days.between(s, e) > 3 ? .trip : .visitThem, start: s, end: e)
                }
                .buttonStyle(.clay)
            } else if let s = start {
                Text("\(Days.short(s)) to…").font(Typeface.sans(16)).foregroundStyle(Color.ink)
            } else {
                Text("Tap two days to plan something.").font(Typeface.sans(15.5)).foregroundStyle(Color.ink2)
            }
        }
        .frame(minHeight: 120, alignment: .top)
    }

    private struct Conflict {
        let who: Mark.Who
        let state: DayState
        let from: String
        var to: String
        var text = ""
    }

    /// Runs of busy or maybe days inside the picked range, said in words.
    private func conflicts(_ s: String, _ e: String) -> [Conflict] {
        var byDay: [String: MonthCell] = [:]
        for m in months.values { for c in m.cells { byDay[c.day] = c } }
        var runs: [Conflict] = []
        for who in [Mark.Who.me, .them] {
            var current: Int?
            var d = s
            while d <= e {
                let cell = byDay[d]
                let st = who == .me ? cell?.me : cell?.them
                if let st, st == "b" || st == "m" || (st == "p" && who == .me) {
                    if let i = current, runs[i].state == st, Days.add(runs[i].to, 1) == d {
                        runs[i].to = d
                    } else {
                        runs.append(Conflict(who: who, state: st, from: d, to: d))
                        current = runs.count - 1
                    }
                } else {
                    current = nil
                }
                d = Days.add(d, 1)
            }
        }
        let them = model.themName
        return runs.sorted { $0.from < $1.from }.map { r in
            var r = r
            let when = r.from == r.to ? Days.short(r.from) : Days.range(r.from, r.to)
            if r.state == "p" { r.text = "Already together \(when)" }
            else if r.who == .me { r.text = r.state == "b" ? "You’re busy \(when)" : "You said maybe \(when)" }
            else { r.text = r.state == "b" ? "\(them)’s busy \(when)" : "\(them) said maybe \(when)" }
            return r
        }
    }
}

private struct DayCell: View {
    let cell: MonthCell
    let weekend: Bool
    let past: Bool
    let today: Bool
    let inRange: Bool
    let roundLeft: Bool
    let roundRight: Bool
    let isEnd: Bool
    let themName: String
    let tap: () -> Void

    private static let words = ["f": "free", "m": "maybe", "b": "busy", "p": "together"]

    var body: some View {
        Button(action: tap) {
            VStack(spacing: 4) {
                Text("\(Days.parts(cell.day).d)")
                    .font(Typeface.sans(15, isEnd || cell.planned ? .semibold : weekend ? .medium : .regular))
                    .monospacedDigit()
                    .foregroundStyle(isEnd ? Color.raised : weekend || cell.planned ? Color.ink : Color.ink2)
                    .frame(width: 31, height: 31)
                    .background(Circle().fill(numberFill))
                    .overlay(Circle().strokeBorder(today && !isEnd ? Color.ink3 : .clear, lineWidth: 1.5))
                HStack(spacing: 3) {
                    if !cell.planned {
                        Mark(who: .me, state: cell.me)
                        Mark(who: .them, state: cell.them)
                    }
                }
                .frame(height: 6)
            }
            .frame(maxWidth: .infinity, minHeight: 54)
            .background(
                UnevenRoundedRectangle(
                    topLeadingRadius: roundLeft ? 14 : 0,
                    bottomLeadingRadius: roundLeft ? 14 : 0,
                    bottomTrailingRadius: roundRight ? 14 : 0,
                    topTrailingRadius: roundRight ? 14 : 0
                )
                .fill(inRange ? Color.band : .clear)
            )
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .disabled(past)
        .opacity(past ? 0.4 : 1)
        .accessibilityLabel("\(Days.longDays[Days.dow(cell.day)]), \(Days.monthDay(cell.day)). You: \(Self.words[cell.me] ?? ""). \(themName): \(Self.words[cell.them] ?? "").")
    }

    private var numberFill: Color {
        if isEnd { return .terra }
        if cell.planned { return .sun }
        if weekend && cell.me == "f" && cell.them == "f" && !past { return .sunSoft }
        return .clear
    }
}

import SwiftUI

struct WeekendScreen: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    let fri: String
    @State private var w: WeekendDetail?
    @State private var failed = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 26) {
                if let w {
                    VStack(alignment: .leading, spacing: 12) {
                        Text(w.range).font(Typeface.display(46)).em(-0.025, 46).foregroundStyle(Color.ink)
                        if let s = status(w) {
                            HStack(spacing: 8) {
                                if s.sun { SunMark(size: 18) }
                                Text(s.text).font(Typeface.sans(16)).foregroundStyle(Color.ink2)
                            }
                        }
                    }
                    VStack(spacing: 0) {
                        ForEach(w.days) { d in
                            DayBlock(day: d, themName: model.themName) { value in
                                await model.signal(day: d.day, value: value)
                                await load()
                            }
                        }
                    }
                } else if failed {
                    Text("Couldn’t load this weekend.").font(Typeface.sans(16)).foregroundStyle(Color.ink2).padding(.top, 40)
                } else {
                    ProgressView().frame(maxWidth: .infinity).padding(.top, 80)
                }
            }
            .padding(.horizontal, 22)
            .padding(.bottom, 32)
        }
        .paper()
        .safeAreaInset(edge: .bottom) { footer }
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(Color.paper, for: .navigationBar)
        .task { await load() }
        .refreshable { await load() }
    }

    private func load() async {
        do {
            w = try await SoonAPI.shared.get("weekend/\(fri)", as: WeekendDetail.self)
        } catch {
            failed = w == nil
        }
    }

    private func status(_ w: WeekendDetail) -> (text: String, sun: Bool)? {
        let them = model.themName
        if let p = w.planned {
            if p.isTrip { return (p.name, true) }
            return (p.host == model.me?.me.id ? "\(them)’s here" : "You’re in \(model.them?.home ?? p.name)", true)
        }
        if let p = w.pending { return (p.fromMe ? "Waiting on \(them)" : "\(them) asked about this one", false) }
        if w.allFree { return ("You’re both free", true) }
        if w.weekendFree { return ("Free Saturday and Sunday", true) }
        return nil
    }

    @ViewBuilder private var footer: some View {
        if let w, w.planned == nil, !(w.pending?.fromMe ?? false) {
            Group {
                if w.pending != nil {
                    Button("Answer \(model.themName)") {
                        model.tab = .home
                        dismiss()
                    }
                    .buttonStyle(.quiet)
                } else {
                    Button("Ask \(model.themName)") {
                        model.ask = AskDraft(kind: .visitThem, start: w.fri, end: w.sun)
                    }
                    .buttonStyle(.clay)
                }
            }
            .padding(.horizontal, 22)
            .padding(.top, 12)
            .padding(.bottom, 8)
            .background(Color.paper.opacity(0.94).ignoresSafeArea())
        }
    }
}

private struct DayBlock: View {
    let day: WeekendDetail.Day
    let themName: String
    let setSignal: (String?) async -> Void

    @State private var signal: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            Rule()
            HStack(alignment: .center, spacing: 12) {
                VStack(alignment: .leading, spacing: 3) {
                    Text(Days.longDays[day.dow]).font(Typeface.serif(22)).foregroundStyle(Color.ink)
                    Text(day.summary).font(Typeface.sans(14)).foregroundStyle(Color.ink2).fixedSize(horizontal: false, vertical: true)
                }
                Spacer(minLength: 0)
                if day.me.state != "p" {
                    Seg(options: [(Optional("free"), "Free"), (Optional("maybe"), "Maybe"), (Optional("no"), "Can’t")], selection: binding, small: true)
                        .accessibilityLabel("You on \(Days.longDays[day.dow])")
                }
            }
            .padding(.top, 4)

            Grid(alignment: .leading, horizontalSpacing: 10, verticalSpacing: 6) {
                GridRow {
                    Text("You").font(Typeface.sans(14)).foregroundStyle(Color.ink2).frame(width: 50, alignment: .leading)
                    LaneBar(blocks: day.me.lane, fill: day.me.state == "p" ? .sunSoft : .terraSoft)
                }
                GridRow {
                    Text(themName).font(Typeface.sans(14)).foregroundStyle(Color.ink2).lineLimit(1).frame(width: 50, alignment: .leading)
                    LaneBar(blocks: day.them.lane, fill: day.them.state == "p" ? .sunSoft : .fernSoft)
                }
                GridRow {
                    Color.clear.frame(width: 50, height: 1)
                    Axis()
                }
            }

            if let events = day.them.events, !events.isEmpty {
                VStack(alignment: .leading, spacing: 8) {
                    ForEach(Array(events.enumerated()), id: \.offset) { _, e in
                        HStack(spacing: 10) {
                            Mark(who: .them, state: "b", large: true)
                            Text(e.from == nil ? "All day" : Days.timeRange(e.from ?? 0, e.to ?? 0))
                                .font(Typeface.sans(14))
                                .monospacedDigit()
                                .foregroundStyle(Color.ink3)
                                .fixedSize()
                            Text(e.title).font(Typeface.sans(14)).foregroundStyle(Color.ink).lineLimit(1)
                        }
                    }
                }
                .padding(.leading, 60)
                .accessibilityLabel("\(themName)’s \(Days.longDays[day.dow])")
            }
        }
        .padding(.bottom, 20)
        .onAppear { signal = day.me.signal }
        .onChange(of: day.me.signal) { _, v in signal = v }
    }

    /// Tapping the chosen answer again clears it.
    private var binding: Binding<String?> {
        Binding(
            get: { signal },
            set: { v in
                let next = v == signal ? nil : v
                signal = next
                Task { await setSignal(next) }
            }
        )
    }
}

private struct LaneBar: View {
    let blocks: [LaneBlock]
    let fill: Color

    var body: some View {
        GeometryReader { geo in
            ZStack(alignment: .leading) {
                RoundedRectangle(cornerRadius: 7).fill(fill)
                ForEach(Array(blocks.enumerated()), id: \.offset) { _, b in
                    RoundedRectangle(cornerRadius: 5)
                        .fill(Color.busy)
                        .frame(width: max(4, geo.size.width * b.width / 100))
                        .offset(x: geo.size.width * b.left / 100)
                }
            }
        }
        .frame(height: 22)
        .clipShape(RoundedRectangle(cornerRadius: 7))
        .accessibilityHidden(true)
    }
}

private struct Axis: View {
    private let marks: [(String, Double)] = [("8a", 0), ("12p", 26.67), ("4p", 53.33), ("8p", 80), ("11p", 100)]

    var body: some View {
        GeometryReader { geo in
            ForEach(marks, id: \.0) { m in
                let label = m.0
                let at = m.1
                Text(label)
                    .font(Typeface.sans(11))
                    .foregroundStyle(Color.ink3)
                    .fixedSize()
                    .position(x: xFor(at, label, geo.size.width), y: 7)
            }
        }
        .frame(height: 14)
        .accessibilityHidden(true)
    }

    private func xFor(_ at: Double, _ label: String, _ width: CGFloat) -> CGFloat {
        let half = CGFloat(label.count) * 3.2
        if at == 0 { return half }
        if at == 100 { return width - half }
        return width * at / 100
    }
}

import SwiftUI

struct WeekendRoute: Hashable { let fri: String }

struct HomeScreen: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 34) {
                header
                if let home = model.home {
                    notices(home)
                    if let p = model.justAccepted { JustAccepted(plan: p) }
                    if let road = home.road { RoadCard(road: road) }
                    if let p = home.incoming.first { IncomingCard(plan: p, note: home.incomingNote) }
                    hero(home)
                    if let trip = home.nextTrip, let n = home.nextTripDays { TripRow(plan: trip, days: n) }
                    weekends(home)
                } else {
                    ProgressView().frame(maxWidth: .infinity).padding(.top, 80)
                }
            }
            .padding(.horizontal, 22)
            .padding(.top, 8)
            .padding(.bottom, 32)
        }
        .paper()
        .refreshable { await model.refresh() }
        .toolbar(.hidden, for: .navigationBar)
        .navigationDestination(for: WeekendRoute.self) { WeekendScreen(fri: $0.fri) }
    }

    private var header: some View {
        HStack(spacing: 8) {
            SunMark(size: 20)
            Text("soon").font(Typeface.italic(25)).em(-0.01, 25).foregroundStyle(Color.ink)
            Spacer()
            Button { model.showSettings = true } label: {
                Image(systemName: "slider.horizontal.3")
                    .font(.system(size: 18, weight: .regular))
                    .foregroundStyle(Color.ink)
                    .frame(width: 44, height: 44)
            }
            .accessibilityLabel("Settings")
            .padding(.trailing, -10)
        }
        .padding(.bottom, -6)
    }

    @ViewBuilder private func notices(_ home: Home) -> some View {
        if !home.meConnected {
            Notice(text: "Your calendar got disconnected.", action: "Reconnect") { model.showSettings = true }
        } else if !home.themConnected {
            Notice(text: "\(model.themName) hasn’t joined yet.", action: "Send the invite") { model.showSettings = true }
        }
    }

    @ViewBuilder private func hero(_ home: Home) -> some View {
        if let p = home.hero {
            let c = Countdown(p, today: home.today)
            VStack(alignment: .leading, spacing: 10) {
                HStack(alignment: .bottom, spacing: 12) {
                    if c.isNumber {
                        HStack(alignment: .lastTextBaseline, spacing: 8) {
                            Text(c.big).font(Typeface.display(104)).em(-0.045, 104)
                            Text(c.unit).font(Typeface.serif(30))
                        }
                    } else {
                        Text(c.big).font(Typeface.display(72)).em(-0.035, 72)
                    }
                    Spacer(minLength: 0)
                    Sunflower(bloom: c.bloom, sway: true).frame(width: 96).padding(.bottom, -6)
                }
                .foregroundStyle(Color.ink)
                Text(c.line).font(Typeface.serif(27)).em(-0.015, 27).foregroundStyle(Color.ink).padding(.top, 6)
                Text("\(p.place) · \(p.dayRange)").font(Typeface.sans(14)).foregroundStyle(Color.ink2)
                if home.canLeave {
                    WorkButton(style: .fern) { await model.leave(p) } label: {
                        Label("Leaving now", systemImage: "car.side")
                    }
                    .padding(.top, 14)
                }
            }
            .accessibilityElement(children: .combine)
        } else if let free = home.nextFree {
            VStack(alignment: .leading, spacing: 10) {
                HStack(alignment: .bottom) {
                    Text(free.range).font(Typeface.display(52)).em(-0.025, 52).foregroundStyle(Color.ink)
                    Spacer()
                    Sunflower(bloom: 1, stem: false).frame(width: 64)
                }
                Text("You’re both free.").font(Typeface.sans(17)).foregroundStyle(Color.ink2)
                Button("Ask \(model.themName)") {
                    model.ask = AskDraft(kind: .visitThem, start: free.fri, end: Days.add(free.fri, 2))
                }
                .buttonStyle(SoonButtonStyle(kind: .clay, height: 50))
                .frame(width: 160)
                .padding(.top, 8)
            }
        } else {
            VStack(alignment: .leading, spacing: 10) {
                Text("No free weekends for a while.").font(Typeface.serif(34)).foregroundStyle(Color.ink)
                Button("Look further out") { model.tab = .calendar }
                    .font(Typeface.sans(16, .medium))
                    .foregroundStyle(Color.terra)
            }
        }
    }

    @ViewBuilder private func weekends(_ home: Home) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("Weekends").font(Typeface.serif(22)).em(-0.01, 22).foregroundStyle(Color.ink).padding(.bottom, 12)
            Rule()
            ForEach(home.weekends) { row in
                NavigationLink(value: WeekendRoute(fri: row.fri)) {
                    HStack(spacing: 12) {
                        VStack(alignment: .leading, spacing: 4) {
                            HStack(spacing: 7) {
                                Text(row.range).font(Typeface.serif(21)).em(-0.01, 21).foregroundStyle(Color.ink)
                                if row.open || row.planned { SunMark(size: 16) }
                            }
                            Text(row.note).font(Typeface.sans(14)).foregroundStyle(Color.ink2).multilineTextAlignment(.leading)
                        }
                        Spacer(minLength: 0)
                        Image(systemName: "chevron.right").font(.system(size: 14, weight: .medium)).foregroundStyle(Color.ink3)
                    }
                    .padding(.vertical, 14)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                Rule()
            }
        }
    }
}

private struct Notice: View {
    let text: String
    let action: String
    let tap: () -> Void

    var body: some View {
        Button(action: tap) {
            (Text(text + " ") + Text(action).underline())
                .font(Typeface.sans(15))
                .foregroundStyle(Color.ink)
                .multilineTextAlignment(.leading)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal, 16)
                .padding(.vertical, 14)
                .background(RoundedRectangle(cornerRadius: 14).fill(Color.chip))
        }
        .buttonStyle(.plain)
    }
}

private struct JustAccepted: View {
    @Environment(AppModel.self) private var model
    let plan: Plan

    var body: some View {
        VStack(spacing: 10) {
            Sunflower(bloom: 1, sway: true).frame(width: 92)
            Text("It’s a plan.").font(Typeface.serif(40)).foregroundStyle(Color.ink).padding(.top, 6)
            Text("See you \(Days.friendly(plan.startDay)).").font(Typeface.sans(17)).foregroundStyle(Color.ink2)
        }
        .frame(maxWidth: .infinity)
        .transition(.scale(scale: 0.9).combined(with: .opacity))
        .task {
            try? await Task.sleep(for: .seconds(6))
            withAnimation(.easeInOut(duration: 0.4)) { model.justAccepted = nil }
        }
    }
}

struct RoadCard: View {
    @Environment(AppModel.self) private var model
    let road: Road

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 10) {
                Image(systemName: "car.side")
                Text(road.mine ? "On your way" : "\(model.themName)’s on the way").font(Typeface.serif(22))
            }
            Text("There around \(Days.clock(road.etaDate)).").font(Typeface.sans(15.5))
            RoadLine(left: road.leftDate, eta: road.etaDate)
            if road.mine {
                HStack(spacing: 10) {
                    WorkButton(style: .fern) { await model.arrived() } label: { Text("I’m here") }
                    Menu {
                        ForEach([15, 30, 45], id: \.self) { m in
                            Button("\(m) minutes") { Task { await model.runningLate(m) } }
                        }
                    } label: {
                        Text("Running late")
                            .font(Typeface.sans(16, .semibold))
                            .foregroundStyle(Color.fernInk)
                            .frame(maxWidth: .infinity, minHeight: 54)
                            .background(Capsule().strokeBorder(Color.fern.opacity(0.45), lineWidth: 1))
                    }
                }
                .padding(.top, 4)
            }
        }
        .foregroundStyle(Color.fernInk)
        .padding(.horizontal, 20)
        .padding(.vertical, 18)
        .background(RoundedRectangle(cornerRadius: 20).fill(Color.fernSoft))
    }
}

struct IncomingCard: View {
    @Environment(AppModel.self) private var model
    let plan: Plan
    let note: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text(plan.headline ?? plan.name).font(Typeface.serif(30)).em(-0.02, 30).foregroundStyle(Color.ink)
            Text(plan.dayRange).font(Typeface.sans(16.5)).foregroundStyle(Color.ink).padding(.top, -6)
            if let n = plan.note {
                Text("“\(n)”")
                    .font(Typeface.hand(28))
                    .foregroundStyle(Color.terra)
                    .rotationEffect(.degrees(-1.2), anchor: .leading)
            }
            if let note { Text(note).font(Typeface.sans(14)).foregroundStyle(Color.ink2) }
            VStack(spacing: 10) {
                WorkButton { await model.accept(plan) } label: { Text(plan.acceptLabel) }
                WorkButton(style: .quiet) { await model.decline(plan) } label: { Text(plan.isTrip ? "Not then" : "Not that weekend") }
            }
        }
        .padding(.top, 22)
        .padding(.horizontal, 20)
        .padding(.bottom, 20)
        .background(
            RoundedRectangle(cornerRadius: 22)
                .fill(Color(hex: 0xFFF8E6))
                .shadow(color: Color.ink.opacity(0.08), radius: 14, y: 8)
        )
    }
}

private struct TripRow: View {
    @Environment(AppModel.self) private var model
    let plan: Plan
    let days: Int

    var body: some View {
        Button { model.tab = .plans } label: {
            VStack(spacing: 0) {
                Rule()
                HStack {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(plan.title ?? "Our trip").font(Typeface.serif(21)).foregroundStyle(Color.ink)
                        Text(plan.dayRange).font(Typeface.sans(14)).foregroundStyle(Color.ink2)
                    }
                    Spacer()
                    VStack(alignment: .trailing, spacing: 3) {
                        Text(days > 0 ? "\(days)" : "Now").font(Typeface.serif(32)).em(-0.02, 32).foregroundStyle(Color.ink)
                        if days > 0 { Text(days == 1 ? "day" : "days").font(Typeface.sans(12.5)).foregroundStyle(Color.ink3) }
                    }
                }
                .padding(.vertical, 13)
                Rule()
            }
        }
        .buttonStyle(.plain)
    }
}

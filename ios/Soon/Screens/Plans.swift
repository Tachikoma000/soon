import SwiftUI

struct PlansScreen: View {
    @Environment(AppModel.self) private var model
    @State private var cancelling: Plan?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 34) {
                HStack {
                    ScreenTitle(text: "Plans")
                    Spacer()
                    Button {
                        let fri = Days.weekendFriday(Days.add(Days.today(), 1))
                        model.ask = AskDraft(kind: .visitThem, start: fri, end: Days.add(fri, 2))
                    } label: {
                        Image(systemName: "plus")
                            .font(.system(size: 18, weight: .semibold))
                            .foregroundStyle(Color.raised)
                            .frame(width: 40, height: 40)
                            .background(Circle().fill(Color.terra))
                    }
                    .accessibilityLabel("New plan")
                }
                if let d = model.plans { content(d) } else { ProgressView().frame(maxWidth: .infinity).padding(.top, 60) }
            }
            .padding(.horizontal, 22)
            .padding(.top, 8)
            .padding(.bottom, 32)
        }
        .paper()
        .toolbar(.hidden, for: .navigationBar)
        .task { await model.loadPlans() }
        .refreshable { await model.loadPlans() }
        .confirmationDialog(dialogTitle, isPresented: Binding(get: { cancelling != nil }, set: { if !$0 { cancelling = nil } }), titleVisibility: .visible) {
            if let p = cancelling {
                Button(p.isProposed ? "Take it back" : "Cancel it", role: .destructive) {
                    Task { await model.cancel(p) }
                }
                Button("Keep it", role: .cancel) {}
            }
        }
    }

    private var dialogTitle: String {
        guard let p = cancelling else { return "" }
        return p.isProposed ? "Take back \(p.range)?" : "Cancel \(p.range)? It comes off both your calendars."
    }

    private func when(_ p: Plan, today: String) -> String {
        if p.isProposed { return "waiting on \(model.themName)" }
        let n = Days.between(today, p.startDay)
        return n > 1 ? "in \(n) days" : n == 1 ? "tomorrow" : n == 0 ? "today" : "now"
    }

    @ViewBuilder private func content(_ d: PlansList) -> some View {
        let ahead = (d.waiting + d.upcoming).sorted { $0.startDay < $1.startDay }
        if d.incoming.isEmpty && ahead.isEmpty && d.past.isEmpty {
            VStack(spacing: 18) {
                Sunflower(bloom: 0).frame(width: 64)
                Text("Nothing planned yet.").font(Typeface.serif(26)).foregroundStyle(Color.ink)
                Button("Find a weekend") { model.tab = .calendar }
                    .font(Typeface.sans(16, .medium))
                    .foregroundStyle(Color.terra)
            }
            .frame(maxWidth: .infinity)
            .padding(.top, 48)
        }

        ForEach(d.incoming) { p in
            VStack(alignment: .leading, spacing: 16) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(p.name).font(Typeface.serif(21)).foregroundStyle(Color.ink)
                    Text(p.dayRange).font(Typeface.sans(14)).foregroundStyle(Color.ink2)
                }
                if let n = p.note { Text("“\(n)”").font(Typeface.hand(24)).foregroundStyle(Color.terra) }
                HStack(spacing: 10) {
                    WorkButton { await model.accept(p) } label: { Text("Yes") }
                    WorkButton(style: .quiet) { await model.decline(p) } label: { Text("Not then") }
                }
            }
            .padding(.top, 22)
            .padding(.horizontal, 20)
            .padding(.bottom, 20)
            .background(RoundedRectangle(cornerRadius: 22).fill(Color(hex: 0xFFF8E6)).shadow(color: Color.ink.opacity(0.08), radius: 14, y: 8))
        }

        if !ahead.isEmpty {
            VStack(spacing: 0) {
                ForEach(ahead) { p in
                    Rule()
                    Button { cancelling = p } label: {
                        HStack {
                            VStack(alignment: .leading, spacing: 4) {
                                Text(p.name).font(Typeface.serif(21)).foregroundStyle(Color.ink)
                                Text("\(p.dayRange) · \(when(p, today: d.today))").font(Typeface.sans(14)).foregroundStyle(Color.ink2)
                                if let n = p.note { Text("“\(n)”").font(Typeface.sans(14)).foregroundStyle(Color.ink3).lineLimit(1) }
                            }
                            Spacer()
                            Image(systemName: "ellipsis").foregroundStyle(Color.ink3)
                        }
                        .padding(.vertical, 13)
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    .accessibilityHint(p.isProposed ? "Take it back" : "Cancel")
                }
                Rule()
            }
        }

        if !d.past.isEmpty {
            VStack(alignment: .leading, spacing: 0) {
                Text("Before").font(Typeface.serif(22)).foregroundStyle(Color.ink3).padding(.bottom, 10)
                ForEach(d.past) { p in
                    Rule()
                    VStack(alignment: .leading, spacing: 4) {
                        Text(p.name).font(Typeface.italic(19)).foregroundStyle(Color.ink2)
                        Text(p.range).font(Typeface.sans(14)).foregroundStyle(Color.ink2)
                    }
                    .frame(maxWidth: .infinity, minHeight: 58, alignment: .leading)
                }
                Rule()
            }
        }
    }
}

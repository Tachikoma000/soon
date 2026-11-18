import SwiftUI

/// "Ask Annie": propose a visit or a trip.
struct AskScreen: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss

    let draft: AskDraft
    @State private var kind: AskDraft.Kind
    @State private var start: Date
    @State private var end: Date
    @State private var arrive: Date
    @State private var tripName = ""
    @State private var note = ""
    @State private var title: String?
    @State private var isPrivate = true
    @State private var drive = true
    @State private var showCalendarOptions = false
    @FocusState private var focused: Bool

    init(draft: AskDraft) {
        self.draft = draft
        _kind = State(initialValue: draft.kind)
        _start = State(initialValue: Days.date(draft.start))
        _end = State(initialValue: Days.date(draft.end))
        var c = Days.calendar.dateComponents([.year, .month, .day], from: Days.date(draft.start))
        c.hour = 17
        c.minute = 30
        _arrive = State(initialValue: Days.calendar.date(from: c) ?? Date())
    }

    private var them: String { model.themName }
    private var smartTitle: String {
        switch kind {
        case .trip: return tripName.trimmingCharacters(in: .whitespaces).isEmpty ? "Trip" : tripName
        case .visitThem: return model.them?.home ?? "Visit"
        case .visitMe: return "\(them) visiting"
        }
    }
    private var shownTitle: String { title ?? model.me?.settings.eventTitle ?? smartTitle }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                HStack {
                    Text("Ask \(them)").font(Typeface.serif(32)).em(-0.02, 32).foregroundStyle(Color.ink)
                    Spacer()
                    Button { dismiss() } label: {
                        Image(systemName: "xmark").font(.system(size: 17, weight: .medium)).foregroundStyle(Color.ink2).frame(width: 44, height: 44)
                    }
                    .accessibilityLabel("Close")
                    .padding(.trailing, -10)
                }

                Seg(options: [(AskDraft.Kind.visitThem, "I visit"), (.visitMe, "\(them) visits"), (.trip, "A trip")], selection: $kind)

                if kind == .trip {
                    TextField("Where to?", text: $tripName)
                        .font(Typeface.serif(22))
                        .padding(.horizontal, 14)
                        .padding(.vertical, 12)
                        .background(RoundedRectangle(cornerRadius: 14).fill(Color.raised))
                        .overlay(RoundedRectangle(cornerRadius: 14).strokeBorder(Color.line2))
                        .focused($focused)
                        .submitLabel(.done)
                }

                VStack(spacing: 0) {
                    Rule()
                    row("From") {
                        DatePicker("From", selection: $start, in: Days.date(Days.today())..., displayedComponents: .date).labelsHidden()
                    }
                    if kind != .trip {
                        Rule()
                        row(kind == .visitThem ? "Getting there around" : "\(them) gets in around") {
                            DatePicker("Arriving", selection: $arrive, displayedComponents: .hourAndMinute).labelsHidden()
                        }
                    }
                    Rule()
                    row("To") {
                        DatePicker("To", selection: $end, in: start..., displayedComponents: .date).labelsHidden()
                    }
                    Rule()
                }
                .environment(\.timeZone, Days.timeZone)
                .onChange(of: start) { _, s in if end < s { end = s } }

                TextField("Add a note for \(them)", text: $note, axis: .vertical)
                    .lineLimit(2...4)
                    .font(Typeface.sans(16))
                    .padding(14)
                    .background(RoundedRectangle(cornerRadius: 14).fill(Color.raised))
                    .overlay(RoundedRectangle(cornerRadius: 14).strokeBorder(Color.line2))
                    .focused($focused)

                DisclosureGroup(isExpanded: $showCalendarOptions) {
                    VStack(spacing: 0) {
                        TextField("Title on my calendar", text: Binding(get: { shownTitle }, set: { title = $0 }))
                            .font(Typeface.sans(16))
                            .padding(12)
                            .background(RoundedRectangle(cornerRadius: 12).fill(Color.raised))
                            .overlay(RoundedRectangle(cornerRadius: 12).strokeBorder(Color.line2))
                            .padding(.vertical, 8)
                            .focused($focused)
                        Toggle("Hide the details from others", isOn: $isPrivate).frame(minHeight: 52)
                        if kind == .visitThem {
                            Rule()
                            Toggle("Block the drive too", isOn: $drive).frame(minHeight: 52)
                        }
                    }
                    .font(Typeface.sans(15.5))
                    .tint(.terra)
                } label: {
                    (Text("On my calendar as ").foregroundStyle(Color.ink2) + Text(shownTitle.isEmpty ? "…" : shownTitle).foregroundStyle(Color.ink) + Text(isPrivate ? ", private" : "").foregroundStyle(Color.ink2))
                        .font(Typeface.sans(15))
                        .lineLimit(1)
                }
                .tint(Color.ink3)
            }
            .padding(.horizontal, 22)
            .padding(.top, 18)
            .padding(.bottom, 24)
        }
        .scrollDismissesKeyboard(.interactively)
        .paper()
        .safeAreaInset(edge: .bottom) {
            WorkButton { await send() } label: { Text("Send to \(them)") }
                .padding(.horizontal, 22)
                .padding(.top, 10)
                .padding(.bottom, 8)
                .background(Color.paper.ignoresSafeArea())
        }
        .presentationDragIndicator(.visible)
        .onAppear {
            isPrivate = model.me?.settings.eventPrivate ?? true
            drive = model.me?.settings.includeDrive ?? true
        }
    }

    private func row<C: View>(_ label: String, @ViewBuilder _ control: () -> C) -> some View {
        HStack {
            Text(label).font(Typeface.sans(15.5)).foregroundStyle(Color.ink)
            Spacer()
            control()
        }
        .frame(minHeight: 56)
    }

    private func send() async {
        focused = false
        let a = Days.calendar.dateComponents([.hour, .minute], from: arrive)
        let ok = await model.propose(AppModel.Proposal(
            kind: kind,
            start: Days.string(start),
            end: Days.string(end),
            arrive: kind == .trip ? nil : String(format: "%02d:%02d", a.hour ?? 17, a.minute ?? 30),
            title: kind == .trip ? tripName : nil,
            note: note,
            eventTitle: shownTitle,
            isPrivate: isPrivate,
            drive: kind == .visitThem ? drive : nil
        ))
        if ok {
            dismiss()
            model.tab = .plans
        }
    }
}

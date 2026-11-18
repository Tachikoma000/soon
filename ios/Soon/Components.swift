import SwiftUI

// Small pieces every screen shares, matching the website's look.

struct SoonButtonStyle: ButtonStyle {
    enum Kind { case clay, fern, quiet }
    var kind: Kind = .clay
    var height: CGFloat = 54

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(Typeface.sans(16, .semibold))
            .foregroundStyle(kind == .quiet ? Color.ink : Color.raised)
            .frame(maxWidth: .infinity, minHeight: height)
            .background {
                switch kind {
                case .clay: Capsule().fill(configuration.isPressed ? Color.terraInk : Color.terra)
                case .fern: Capsule().fill(configuration.isPressed ? Color.fernInk : Color.fern)
                case .quiet: Capsule().strokeBorder(Color.line2, lineWidth: 1).background(Capsule().fill(configuration.isPressed ? Color.chip : .clear))
                }
            }
            .scaleEffect(configuration.isPressed ? 0.985 : 1)
            .contentShape(Capsule())
    }
}

extension ButtonStyle where Self == SoonButtonStyle {
    static var clay: SoonButtonStyle { SoonButtonStyle(kind: .clay) }
    static var fern: SoonButtonStyle { SoonButtonStyle(kind: .fern) }
    static var quiet: SoonButtonStyle { SoonButtonStyle(kind: .quiet) }
}

/// A button that runs async work and shows it's busy.
struct WorkButton<Label: View>: View {
    var style: SoonButtonStyle = .clay
    let action: () async -> Void
    @ViewBuilder let label: () -> Label
    @State private var running = false

    var body: some View {
        Button {
            guard !running else { return }
            running = true
            Task {
                await action()
                running = false
            }
        } label: {
            ZStack {
                label().opacity(running ? 0 : 1)
                if running { ProgressView().tint(style.kind == .quiet ? Color.ink : Color.raised) }
            }
        }
        .buttonStyle(style)
        .disabled(running)
    }
}

/// The pill switcher: Free · Maybe · Can't, or I visit · Annie visits · A trip.
struct Seg<T: Hashable>: View {
    let options: [(T, String)]
    @Binding var selection: T
    var small = false

    var body: some View {
        HStack(spacing: 0) {
            ForEach(options, id: \.0) { option in
                let value = option.0
                let label = option.1
                let on = value == selection
                Button {
                    withAnimation(.snappy(duration: 0.18)) { selection = value }
                } label: {
                    Text(label)
                        .font(Typeface.sans(small ? 13.5 : 14, .medium))
                        .foregroundStyle(on ? Color.ink : Color.ink2)
                        .lineLimit(1)
                        .minimumScaleFactor(0.85)
                        .padding(.horizontal, small ? 10 : 12)
                        .frame(maxWidth: small ? nil : .infinity, minHeight: small ? 38 : 42)
                        .background {
                            if on {
                                Capsule().fill(Color.raised).shadow(color: Color.ink.opacity(0.14), radius: 1, y: 1)
                            }
                        }
                        .contentShape(Capsule())
                }
                .buttonStyle(.plain)
                .accessibilityAddTraits(on ? .isSelected : [])
            }
        }
        .padding(2)
        .background(Capsule().fill(Color.chip))
        .sensoryFeedback(.selection, trigger: selection)
    }
}

/// A dot for someone's day: filled when busy, a dashed ring for maybe, sun when together, nothing when free.
struct Mark: View {
    enum Who { case me, them }
    let who: Who
    let state: DayState
    var large = false

    var body: some View {
        let size: CGFloat = large ? 9 : 6
        let tint: Color = who == .me ? .terra : .fern
        Group {
            switch state {
            case "b": Circle().fill(tint)
            case "m": Circle().strokeBorder(tint, style: StrokeStyle(lineWidth: 1.3, dash: [2, 1.5]))
            case "p": Circle().fill(Color.sun)
            default: Color.clear
            }
        }
        .frame(width: size, height: size)
    }
}

/// "‹ Soon"-style quiet heading used on pushed screens.
struct ScreenTitle: View {
    let text: String
    var size: CGFloat = 36

    var body: some View {
        Text(text).font(Typeface.serif(size, relativeTo: .largeTitle)).em(-0.02, size).foregroundStyle(Color.ink)
    }
}

/// A short message that floats up from the bottom.
struct Toast: View {
    let text: String

    var body: some View {
        Text(text)
            .font(Typeface.sans(14.5, .medium))
            .foregroundStyle(Color.raised)
            .padding(.horizontal, 18)
            .padding(.vertical, 12)
            .background(Capsule().fill(Color.ink.opacity(0.92)))
            .padding(.bottom, 12)
            .transition(.move(edge: .bottom).combined(with: .opacity))
    }
}

extension View {
    /// Paper behind everything, edge to edge.
    func paper() -> some View {
        background(Color.paper.ignoresSafeArea())
    }
}

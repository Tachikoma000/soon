import SwiftUI

// The same paper, clay and fern as the website.

extension Color {
    init(hex: UInt32, opacity: Double = 1) {
        self.init(
            .sRGB,
            red: Double((hex >> 16) & 0xFF) / 255,
            green: Double((hex >> 8) & 0xFF) / 255,
            blue: Double(hex & 0xFF) / 255,
            opacity: opacity
        )
    }

    static let paper = Color(hex: 0xF7F2EA)
    static let raised = Color(hex: 0xFFFDF9)
    static let ink = Color(hex: 0x2A2420)
    static let ink2 = Color(hex: 0x5E544B)
    static let ink3 = Color(hex: 0x74685D)
    static let line = Color(hex: 0xE4D9CB)
    static let line2 = Color(hex: 0xD9CCBC)
    static let chip = Color(hex: 0xEDE4D8)

    static let terra = Color(hex: 0xB4532F)
    static let terraInk = Color(hex: 0x8F3F22)
    static let terraSoft = Color(hex: 0xF0D9CB)
    static let band = Color(hex: 0xF3E0D3)
    static let fern = Color(hex: 0x4F6B45)
    static let fernInk = Color(hex: 0x34492D)
    static let fernSoft = Color(hex: 0xDCE5D3)
    static let sun = Color(hex: 0xE2A93B)
    static let sunSoft = Color(hex: 0xF6E2AE)
    static let busy = Color(hex: 0xCDBFB0)
}

/// Newsreader for words that matter, Instrument Sans for everything else, Caveat for notes.
enum Typeface {
    /// Big numbers and headlines (Newsreader at its display size).
    static func display(_ size: CGFloat) -> Font { .custom("SoonDisplay-Regular", size: size) }
    static func serif(_ size: CGFloat, relativeTo style: Font.TextStyle = .title2) -> Font {
        .custom("SoonSerif-Regular", size: size, relativeTo: style)
    }
    static func italic(_ size: CGFloat) -> Font { .custom("SoonSerif-Italic", size: size, relativeTo: .title2) }
    static func sans(_ size: CGFloat, _ weight: Font.Weight = .regular, relativeTo style: Font.TextStyle = .body) -> Font {
        let name: String
        switch weight {
        case .medium: name = "SoonSans-Medium"
        case .semibold, .bold, .heavy, .black: name = "SoonSans-SemiBold"
        default: name = "SoonSans-Regular"
        }
        return .custom(name, size: size, relativeTo: style)
    }
    static func hand(_ size: CGFloat) -> Font { .custom("SoonHand-Medium", size: size, relativeTo: .title3) }
}

extension View {
    /// Letter-spacing in ems, like the CSS.
    func em(_ value: CGFloat, _ size: CGFloat) -> some View { tracking(value * size) }
}

/// A hairline rule.
struct Rule: View {
    var color: Color = .line
    var body: some View { Rectangle().fill(color).frame(height: 1) }
}

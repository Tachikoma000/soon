import SwiftUI

/// The hand-drawn sunflower: a tight green bud at bloom 0, full flower at bloom 1.
/// Drawn on the same 120 × 170 grid as the website's SVG.
struct Sunflower: View {
    var bloom: Double
    var stem: Bool = true
    var sway: Bool = false

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var swung = false

    var body: some View {
        Canvas { ctx, size in
            SunflowerDrawing(bloom: bloom, stem: stem).draw(in: &ctx, size: size)
        }
        .aspectRatio(stem ? 120.0 / 170.0 : 1, contentMode: .fit)
        .rotationEffect(.degrees(sway && !reduceMotion ? (swung ? 1.5 : -1.5) : 0), anchor: UnitPoint(x: 0.5, y: stem ? 166.0 / 170.0 : 1))
        .onAppear {
            guard sway, !reduceMotion else { return }
            withAnimation(.easeInOut(duration: 3).repeatForever(autoreverses: true)) { swung = true }
        }
        .accessibilityHidden(true)
    }
}

struct SunflowerDrawing {
    var bloom: Double
    var stem: Bool

    private static let front: [Double] = [0, 31, 59, 90, 121, 150, 180, 210, 239, 270, 301, 330]
    private static let back: [Double] = [15, 45, 74, 104, 135, 164, 195, 225, 254, 285, 314, 344]
    private static let bracts: [Double] = [8, 38, 66, 97, 128, 157, 188, 217, 247, 278, 307, 337]
    private static let seeds: [(Double, Double)] = [(56, 50), (61, 48.5), (65.5, 51.5), (53.5, 55), (58.5, 54.5), (63.5, 55.5), (56.5, 59.5), (61.5, 60)]
    private static let cx = 60.0
    private static let cy = 54.0

    private static func clamp01(_ x: Double) -> Double { max(0, min(1, x)) }
    private static func ease(_ t: Double) -> Double { t * t * (3 - 2 * t) }

    private static func mix(_ a: UInt32, _ b: UInt32, _ t: Double) -> Color {
        func ch(_ h: UInt32, _ s: UInt32) -> Double { Double((h >> s) & 0xFF) }
        let r = ch(a, 16) + (ch(b, 16) - ch(a, 16)) * t
        let g = ch(a, 8) + (ch(b, 8) - ch(a, 8)) * t
        let bl = ch(a, 0) + (ch(b, 0) - ch(a, 0)) * t
        return Color(.sRGB, red: r / 255, green: g / 255, blue: bl / 255, opacity: 1)
    }

    private static func petal(_ length: Double, _ width: Double, _ base: Double = 10) -> Path {
        let tip = cy - length
        let b = cy - base
        let d = b - tip
        var p = Path()
        p.move(to: CGPoint(x: cx, y: tip))
        p.addCurve(to: CGPoint(x: cx, y: b), control1: CGPoint(x: cx + width, y: tip + 0.3 * d), control2: CGPoint(x: cx + width * 1.1, y: tip + 0.68 * d))
        p.addCurve(to: CGPoint(x: cx, y: tip), control1: CGPoint(x: cx - width * 1.1, y: tip + 0.68 * d), control2: CGPoint(x: cx - width, y: tip + 0.3 * d))
        p.closeSubpath()
        return p
    }

    private static func around(_ degrees: Double) -> CGAffineTransform {
        CGAffineTransform(translationX: cx, y: cy).rotated(by: degrees * .pi / 180).translatedBy(x: -cx, y: -cy)
    }

    private static func ring(_ path: Path, _ angles: [Double]) -> Path {
        var all = Path()
        for a in angles { all.addPath(path.applying(around(a))) }
        return all
    }

    private static func circle(_ x: Double, _ y: Double, _ r: Double) -> Path {
        Path(ellipseIn: CGRect(x: x - r, y: y - r, width: r * 2, height: r * 2))
    }

    func draw(in ctx: inout GraphicsContext, size: CGSize) {
        typealias S = SunflowerDrawing
        let t = S.clamp01(bloom)
        let open = S.ease(S.clamp01((t - 0.12) / 0.88))
        let head = 0.62 + 0.38 * S.ease(t)
        let disk = S.mix(0x7E9A6A, 0x6E4524, S.ease(S.clamp01((t - 0.2) / 0.6)))
        let diskR = 9.5 + 5 * S.ease(t)

        // Map the SVG viewBox onto the canvas.
        let (vx, vy, vw) = stem ? (0.0, 0.0, 120.0) : (12.0, 6.0, 96.0)
        let k = size.width / vw
        ctx.concatenate(CGAffineTransform(scaleX: k, y: k).translatedBy(x: -vx, y: -vy))

        let round = StrokeStyle(lineWidth: 1, lineCap: .round, lineJoin: .round)
        func stroke(_ p: Path, _ c: Color, _ w: Double) {
            var s = round
            s.lineWidth = w
            ctx.stroke(p, with: .color(c), style: s)
        }

        if stem {
            let fern = Color.fern
            var stalk = Path()
            stalk.move(to: CGPoint(x: 60, y: S.cy + diskR * head))
            stalk.addCurve(to: CGPoint(x: 59, y: 166), control1: CGPoint(x: 57, y: 112), control2: CGPoint(x: 63, y: 134))
            stroke(stalk, fern, 2.4)

            var leafR = Path()
            leafR.move(to: CGPoint(x: 60.5, y: 128))
            leafR.addCurve(to: CGPoint(x: 97, y: 117), control1: CGPoint(x: 70, y: 114), control2: CGPoint(x: 88, y: 112))
            leafR.addCurve(to: CGPoint(x: 60.5, y: 128), control1: CGPoint(x: 89, y: 129), control2: CGPoint(x: 74, y: 134))
            leafR.closeSubpath()
            ctx.fill(leafR, with: .color(.fernSoft))
            stroke(leafR, fern, 1.5)
            var veinR = Path()
            veinR.move(to: CGPoint(x: 61, y: 128))
            veinR.addCurve(to: CGPoint(x: 95, y: 117.5), control1: CGPoint(x: 72, y: 123), control2: CGPoint(x: 84, y: 119))
            stroke(veinR, fern, 1)

            var leafL = Path()
            leafL.move(to: CGPoint(x: 59.5, y: 146))
            leafL.addCurve(to: CGPoint(x: 25, y: 139), control1: CGPoint(x: 50, y: 135), control2: CGPoint(x: 33, y: 134))
            leafL.addCurve(to: CGPoint(x: 59.5, y: 146), control1: CGPoint(x: 33, y: 150), control2: CGPoint(x: 47, y: 153))
            leafL.closeSubpath()
            ctx.fill(leafL, with: .color(.fernSoft))
            stroke(leafL, fern, 1.5)
            var veinL = Path()
            veinL.move(to: CGPoint(x: 59, y: 146))
            veinL.addCurve(to: CGPoint(x: 27, y: 139), control1: CGPoint(x: 49, y: 142), control2: CGPoint(x: 37, y: 139))
            stroke(veinL, fern, 1)
        }

        // The head, scaled around its centre as it grows.
        ctx.concatenate(CGAffineTransform(translationX: S.cx, y: S.cy).scaledBy(x: head, y: head).translatedBy(x: -S.cx, y: -S.cy))

        for a in S.bracts {
            let p = S.petal(15.5, 4.4, 6).applying(S.around(a))
            ctx.fill(p, with: .color(Color(hex: 0x8FA77B)))
            stroke(p, .fern, 1)
        }
        if open > 0.02 {
            var layer = ctx
            layer.opacity = min(1, open * 1.6)
            let back = S.petal(11 + 34 * open, 3 + 5.5 * open)
            for a in S.back {
                let p = back.applying(S.around(a))
                layer.fill(p, with: .color(Color(hex: 0xF2CC6B)))
                var s = round
                s.lineWidth = 1
                layer.stroke(p, with: .color(Color(hex: 0x9A6A2E)), style: s)
            }
            let front = S.petal(11 + 29 * open, 2.5 + 5.5 * open)
            for a in S.front {
                let p = front.applying(S.around(a))
                ctx.fill(p, with: .color(.sun))
                stroke(p, Color(hex: 0x8A5A2B), 1.1)
            }
        }
        let diskPath = S.circle(S.cx, S.cy, diskR)
        ctx.fill(diskPath, with: .color(disk))
        stroke(diskPath, S.mix(0x4F6B45, 0x3F2512, t), 1.3)
        if t > 0.45 {
            var seeds = ctx
            seeds.opacity = S.clamp01((t - 0.45) / 0.4)
            seeds.stroke(S.circle(S.cx, S.cy, diskR * 0.62), with: .color(Color(hex: 0x9A6A36)), style: StrokeStyle(lineWidth: 1, dash: [1.6, 2.6]))
            for (x, y) in S.seeds { seeds.fill(S.circle(x, y, 1.2), with: .color(Color(hex: 0xB98548))) }
        }
    }
}

/// The little eight-petal mark that sits next to words.
struct SunMark: View {
    var size: CGFloat = 16

    var body: some View {
        Canvas { ctx, sz in
            let k = sz.width / 24
            ctx.concatenate(CGAffineTransform(scaleX: k, y: k))
            var petal = Path()
            petal.move(to: CGPoint(x: 12, y: 1.8))
            petal.addCurve(to: CGPoint(x: 12, y: 8.8), control1: CGPoint(x: 13.7, y: 3.8), control2: CGPoint(x: 13.8, y: 6.4))
            petal.addCurve(to: CGPoint(x: 12, y: 1.8), control1: CGPoint(x: 10.2, y: 6.4), control2: CGPoint(x: 10.3, y: 3.8))
            petal.closeSubpath()
            for a in [0.0, 44, 91, 134, 180, 226, 269, 316] {
                let p = petal.applying(CGAffineTransform(translationX: 12, y: 12).rotated(by: a * .pi / 180).translatedBy(x: -12, y: -12))
                ctx.fill(p, with: .color(.sun))
                ctx.stroke(p, with: .color(Color(hex: 0x8A5A2B)), style: StrokeStyle(lineWidth: 1, lineJoin: .round))
            }
            ctx.fill(Path(ellipseIn: CGRect(x: 8.2, y: 8.2, width: 7.6, height: 7.6)), with: .color(Color(hex: 0x6E4524)))
        }
        .frame(width: size, height: size)
        .accessibilityHidden(true)
    }
}

/// 0 = tight bud, 1 = full bloom. Opens over the last four weeks.
func bloomFor(days: Int) -> Double {
    if days <= 0 { return 1 }
    return max(0, min(1, 1 - Double(days) / 28))
}

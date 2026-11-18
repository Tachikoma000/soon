import ActivityKit
import AppIntents
import SwiftUI
import WidgetKit

/// Wording for the Live Activity, from whoever's phone it's on.
struct RoadWords {
    let attrs: RoadAttributes
    let state: RoadAttributes.ContentState
    let stale: Bool
    /// Whose phone: the one driving, or the one waiting.
    let driving: Bool

    init(attrs: RoadAttributes, state: RoadAttributes.ContentState, stale: Bool, driving: Bool? = nil) {
        self.attrs = attrs
        self.state = state
        self.stale = stale
        self.driving = driving ?? (SharedStore.widget?.me.id == attrs.travelerId)
    }

    var title: String {
        if state.arrived { return driving ? "Made it" : "\(attrs.traveler)’s here" }
        if stale { return driving ? "Nearly there?" : "Should be there by now" }
        return driving ? "On the way to \(attrs.host)" : "\(attrs.traveler)’s on the way"
    }

    var subtitle: String? {
        state.arrived ? nil : "There around \(Days.clock(state.etaDate))"
    }
}

/// The Lock Screen banner.
struct RoadLockView: View {
    let words: RoadWords

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .center, spacing: 12) {
                SunMark(size: 26)
                VStack(alignment: .leading, spacing: 2) {
                    Text(words.title).font(Typeface.serif(21)).foregroundStyle(Color.fernInk)
                    if let sub = words.subtitle {
                        Text(sub).font(Typeface.sans(14)).foregroundStyle(Color.fernInk.opacity(0.8))
                    }
                }
                Spacer(minLength: 0)
                if !words.state.arrived {
                    Text(timerInterval: Date()...max(Date(), words.state.etaDate), countsDown: true)
                        .font(Typeface.sans(15, .medium))
                        .monospacedDigit()
                        .multilineTextAlignment(.trailing)
                        .foregroundStyle(Color.fernInk)
                        .frame(maxWidth: 76, alignment: .trailing)
                }
            }
            if !words.state.arrived {
                RoadLine(left: words.state.leftDate, eta: words.state.etaDate)
                if words.driving {
                    Button(intent: ArrivedIntent()) {
                        Text("I’m here").font(Typeface.sans(15, .semibold)).frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(.fern)
                }
            }
        }
        .padding(18)
    }
}

/// The Dynamic Island, expanded.
struct RoadIslandBottom: View {
    let words: RoadWords

    var body: some View {
        VStack(spacing: 10) {
            RoadLine(left: words.state.leftDate, eta: words.state.etaDate, tint: .sun)
            if words.driving && !words.state.arrived {
                Button(intent: ArrivedIntent()) {
                    Text("I’m here").font(Typeface.sans(14, .semibold)).frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                .tint(.fern)
            }
        }
    }
}

import ActivityKit
import AppIntents
import Foundation

/// The "on the way" Live Activity. The server starts it on the other phone by push,
/// so the names here must match what it sends ("RoadAttributes", leftAt/eta in Unix seconds).
struct RoadAttributes: ActivityAttributes {
    struct ContentState: Codable, Hashable {
        var leftAt: Double
        var eta: Double
        var arrived: Bool

        var leftDate: Date { Date(timeIntervalSince1970: leftAt) }
        var etaDate: Date { Date(timeIntervalSince1970: eta) }
    }

    var travelerId: String
    var traveler: String
    var host: String
    var city: String
}

/// "I'm here", from the Lock Screen or Dynamic Island.
struct ArrivedIntent: LiveActivityIntent {
    static let title: LocalizedStringResource = "I’m here"

    init() {}

    func perform() async throws -> some IntentResult {
        _ = try? await SoonAPI.shared.call("DELETE", "road", nil, as: Empty.self)
        for activity in Activity<RoadAttributes>.activities {
            var state = activity.content.state
            state.arrived = true
            await activity.end(.init(state: state, staleDate: nil), dismissalPolicy: .after(Date().addingTimeInterval(15 * 60)))
        }
        return .result()
    }
}

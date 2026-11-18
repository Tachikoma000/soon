import Foundation

// What the website's /api/v1 sends. The wording (ranges, "until Annie") is decided there.

struct Person: Codable, Hashable, Sendable {
    let id: String
    let name: String
    let home: String
}

struct Plan: Codable, Hashable, Identifiable, Sendable {
    let id: String
    let kind: String          // "visit" | "trip"
    let status: String        // "proposed" | "accepted" | "declined" | "cancelled"
    let startDay: String
    let endDay: String
    let arriveTime: String?
    let title: String?
    let note: String?
    let host: String?
    let fromMe: Bool
    let createdAt: Double
    /// "Austin" · "Big Bend"
    let name: String
    /// "In Austin" · "At home" · "Big Bend"
    let place: String
    /// "until Annie"
    let countdown: String
    /// "you'll see Annie" · "Big Bend starts"
    let startsToday: String
    /// "Nov 20 – 22"
    let range: String
    /// "Fri, Nov 20 – Sun, Nov 22"
    let dayRange: String
    /// Only on a proposal from them: "Annie wants you to come visit."
    let headline: String?
    let acceptLabel: String
    /// "me", "them", or nil for trips.
    let traveler: String?
    let myEventTitle: String?
    let myDefaultEventTitle: String

    enum CodingKeys: String, CodingKey {
        case id, kind, status, startDay, endDay, arriveTime, title, note, host, fromMe, createdAt, name
        case place = "where"
        case countdown, startsToday, range, dayRange, headline, acceptLabel, traveler, myEventTitle, myDefaultEventTitle
    }

    var isTrip: Bool { kind == "trip" }
    var isProposed: Bool { status == "proposed" }
}

/// f free · m maybe · b busy · p together
typealias DayState = String

struct WeekendRow: Codable, Hashable, Identifiable, Sendable {
    struct Day: Codable, Hashable, Sendable {
        let letter: String
        let me: DayState
        let them: DayState
    }
    let fri: String
    let range: String
    let note: String
    let open: Bool
    let planned: Bool
    let pending: Bool
    let days: [Day]
    var id: String { fri }
}

struct Road: Codable, Hashable, Sendable {
    let planId: String
    let mine: Bool
    /// Milliseconds since 1970.
    let leftAt: Double
    let eta: Double
    let plan: Plan

    var leftDate: Date { Date(timeIntervalSince1970: leftAt / 1000) }
    var etaDate: Date { Date(timeIntervalSince1970: eta / 1000) }
}

struct Home: Codable, Sendable {
    let today: String
    let hero: Plan?
    let heroDays: Int?
    let nextTrip: Plan?
    let nextTripDays: Int?
    let incoming: [Plan]
    let incomingNote: String?
    let waiting: [Plan]
    let weekends: [WeekendRow]
    let nextFree: WeekendRow?
    let road: Road?
    let canLeave: Bool
    let meConnected: Bool
    let themConnected: Bool
    let badge: Int
}

struct Settings: Codable, Hashable, Sendable {
    var eventTitle: String?
    var eventPrivate: Bool
    var includeDrive: Bool
    var calendars: [String]
    var shareDetails: Bool
    var connected: Bool
    var onboarded: Bool
}

struct Me: Codable, Sendable {
    let me: Person
    let them: Person
    let timezone: String
    let driveMinutes: Int
    let site: String
    let demo: Bool
    var settings: Settings
    let theyJoined: Bool
    let theyShare: Bool
    let token: String
    /// The one who made Soon (the words on first open differ).
    let maker: Bool?
}

struct LaneBlock: Codable, Hashable, Sendable {
    let left: Double
    let width: Double
    let label: String
}

struct DayEvent: Codable, Hashable, Sendable {
    let title: String
    /// Minutes after midnight; nil for all day.
    let from: Int?
    let to: Int?
}

struct WeekendDetail: Codable, Sendable {
    struct Side: Codable, Hashable, Sendable {
        let state: DayState
        let signal: String?
        let lane: [LaneBlock]
        let events: [DayEvent]?
    }
    struct Day: Codable, Hashable, Identifiable, Sendable {
        let day: String
        let dow: Int
        let summary: String
        let me: Side
        let them: Side
        var id: String { day }
    }
    let fri: String
    let sun: String
    let range: String
    let days: [Day]
    let planned: Plan?
    let pending: Plan?
    let allFree: Bool
    let weekendFree: Bool
}

struct MonthCell: Codable, Hashable, Identifiable, Sendable {
    let day: String
    let me: DayState
    let them: DayState
    let meAllDay: Bool
    let themAllDay: Bool
    let planned: Bool
    var id: String { day }
}

struct Month: Codable, Sendable {
    let first: String
    let last: String
    let lead: Int
    let cells: [MonthCell]
    let todayStr: String
}

struct PlansList: Codable, Sendable {
    let today: String
    let incoming: [Plan]
    let waiting: [Plan]
    let upcoming: [Plan]
    let past: [Plan]
}

struct CalendarInfo: Codable, Hashable, Identifiable, Sendable {
    let id: String
    let name: String
    let primary: Bool
    let owned: Bool
}

struct CalendarList: Codable, Sendable { let calendars: [CalendarInfo] }

/// The small payload widgets live on.
struct WidgetData: Codable, Sendable {
    struct Free: Codable, Hashable, Sendable {
        let fri: String
        let range: String
    }
    let me: Person
    let them: Person
    let today: String
    let generatedAt: Double
    let upcoming: [Plan]
    let badge: Int
    let road: Road?
    let nextFree: Free?
}

struct ShareResult: Codable, Sendable {
    let status: String
    let url: String?
}

struct InviteResult: Codable, Sendable { let url: String? }
struct PlanResult: Codable, Sendable { let plan: Plan }
struct OK: Codable, Sendable { let ok: Bool? }

import Foundation

/// A believable example, for the widget gallery before you've signed in.
enum Sample {
    static func plan(id: String, kind: String, start: String, end: String, title: String?, name: String, place: String, countdown: String, startsToday: String) -> Plan {
        Plan(
            id: id, kind: kind, status: "accepted", startDay: start, endDay: end, arriveTime: kind == "visit" ? "17:30" : nil,
            title: title, note: nil, host: kind == "visit" ? "them" : nil, fromMe: true, createdAt: 0,
            name: name, place: place, countdown: countdown, startsToday: startsToday,
            range: Days.range(start, end), dayRange: "\(Days.short(start)) – \(Days.short(end))",
            headline: nil, acceptLabel: "Yes", traveler: kind == "visit" ? "me" : nil, myEventTitle: nil, myDefaultEventTitle: name
        )
    }

    static var widget: WidgetData {
        let today = Days.today()
        let fri = Days.weekendFriday(Days.add(today, 7))
        let trip = Days.add(fri, 43)
        return WidgetData(
            me: Person(id: "me", name: "You", home: "Home"),
            them: Person(id: "them", name: "Them", home: "Their city"),
            today: today,
            generatedAt: Date().timeIntervalSince1970 * 1000,
            upcoming: [
                plan(id: "a", kind: "visit", start: fri, end: Days.add(fri, 2), title: nil, name: "Their city", place: "In their city", countdown: "until we’re together", startsToday: "together today"),
                plan(id: "b", kind: "trip", start: trip, end: Days.add(trip, 4), title: "Our trip", name: "Our trip", place: "Our trip", countdown: "until our trip", startsToday: "Our trip starts"),
            ],
            badge: 0,
            road: nil,
            nextFree: WidgetData.Free(fri: Days.add(fri, 14), range: Days.range(Days.add(fri, 14), Days.add(fri, 16)))
        )
    }
}

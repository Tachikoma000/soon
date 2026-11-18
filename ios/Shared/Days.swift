import Foundation

/// Calendar days as "YYYY-MM-DD" strings, in your shared time zone, like the website.
enum Days {
    static var timeZone: TimeZone {
        if let id = SharedStore.timezone, let tz = TimeZone(identifier: id) { return tz }
        return TimeZone(identifier: "America/Chicago") ?? .current
    }

    static var calendar: Calendar {
        var c = Calendar(identifier: .gregorian)
        c.timeZone = timeZone
        c.locale = Locale(identifier: "en_US")
        return c
    }

    static func string(_ date: Date) -> String {
        let c = calendar.dateComponents([.year, .month, .day], from: date)
        return String(format: "%04d-%02d-%02d", c.year ?? 0, c.month ?? 0, c.day ?? 0)
    }

    static func today(_ now: Date = Date()) -> String { string(now) }

    /// Noon on that day, so time-zone shifts never move it.
    static func date(_ day: String) -> Date {
        let parts = day.split(separator: "-").compactMap { Int($0) }
        guard parts.count == 3 else { return Date() }
        return calendar.date(from: DateComponents(year: parts[0], month: parts[1], day: parts[2], hour: 12)) ?? Date()
    }

    static func between(_ a: String, _ b: String) -> Int {
        let d = calendar.dateComponents([.day], from: date(a), to: date(b)).day ?? 0
        return d
    }

    static func add(_ day: String, _ n: Int) -> String {
        string(calendar.date(byAdding: .day, value: n, to: date(day)) ?? date(day))
    }

    /// 0 Sunday … 6 Saturday
    static func dow(_ day: String) -> Int { calendar.component(.weekday, from: date(day)) - 1 }

    static let longDays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
    static let shortDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
    static let months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]
    static let shortMonths = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

    static func parts(_ day: String) -> (y: Int, m: Int, d: Int) {
        let p = day.split(separator: "-").compactMap { Int($0) }
        return p.count == 3 ? (p[0], p[1], p[2]) : (0, 1, 1)
    }

    /// "Nov 20"
    static func monthDay(_ day: String) -> String {
        let p = parts(day)
        return "\(shortMonths[p.m - 1]) \(p.d)"
    }

    /// "Fri, Nov 20"
    static func short(_ day: String) -> String { "\(shortDays[dow(day)]), \(monthDay(day))" }

    /// "Nov 20 – 22" · "Nov 27 – Dec 1"
    static func range(_ a: String, _ b: String) -> String {
        if a == b { return monthDay(a) }
        let pa = parts(a), pb = parts(b)
        if pa.m == pb.m && pa.y == pb.y { return "\(monthDay(a)) – \(pb.d)" }
        return "\(monthDay(a)) – \(monthDay(b))"
    }

    /// "Friday the 20th"
    static func friendly(_ day: String) -> String {
        let n = parts(day).d
        let suffix: String
        switch n % 100 {
        case 11, 12, 13: suffix = "th"
        default:
            switch n % 10 {
            case 1: suffix = "st"
            case 2: suffix = "nd"
            case 3: suffix = "rd"
            default: suffix = "th"
            }
        }
        return "\(longDays[dow(day)]) the \(n)\(suffix)"
    }

    /// The Friday of the weekend this day belongs to.
    static func weekendFriday(_ day: String) -> String {
        let w = dow(day)
        let back = w == 6 ? 1 : w == 0 ? 2 : 0
        let fwd = w <= 4 && w >= 1 ? 5 - w : 0
        return add(day, fwd - back)
    }

    /// "5:30 pm", or "5:30" without the am/pm.
    static func time(_ minutes: Int, meridiem: Bool = true) -> String {
        let m = ((minutes % 1440) + 1440) % 1440
        let h = m / 60
        let mm = m % 60
        let h12 = h % 12 == 0 ? 12 : h % 12
        let base = mm == 0 ? "\(h12)" : String(format: "%d:%02d", h12, mm)
        return meridiem ? "\(base) \(h < 12 ? "am" : "pm")" : base
    }

    /// "10 – 11 am" · "9 am – 5:30 pm"
    static func timeRange(_ a: Int, _ b: Int) -> String {
        (a < 720) == (b < 720) ? "\(time(a, meridiem: false)) – \(time(b))" : "\(time(a)) – \(time(b))"
    }

    /// "7:15 pm" in your shared time zone (or "7:15" without the am/pm).
    static func clock(_ date: Date, meridiem: Bool = true) -> String {
        let c = calendar.dateComponents([.hour, .minute], from: date)
        return time((c.hour ?? 0) * 60 + (c.minute ?? 0), meridiem: meridiem)
    }

    static func month(_ ym: String) -> (name: String, year: String) {
        let p = ym.split(separator: "-")
        let m = Int(p.count > 1 ? p[1] : "1") ?? 1
        return (months[m - 1], String(p.first ?? ""))
    }

    static func shiftMonth(_ ym: String, _ n: Int) -> String {
        let p = ym.split(separator: "-").compactMap { Int($0) }
        guard p.count == 2 else { return ym }
        let total = p[0] * 12 + (p[1] - 1) + n
        return String(format: "%04d-%02d", total / 12, total % 12 + 1)
    }
}

/// How many days until a plan, and what to say about it.
struct Countdown {
    let plan: Plan
    let days: Int

    init(_ plan: Plan, today: String = Days.today()) {
        self.plan = plan
        self.days = Days.between(today, plan.startDay)
    }

    /// "10" · "Today" · "Together"
    var big: String { days > 0 ? "\(days)" : days == 0 ? "Today" : "Together" }
    var isNumber: Bool { days > 0 }
    var unit: String { days == 1 ? "day" : "days" }

    /// "until Annie" · "you'll see Annie" · "until Sunday"
    var line: String {
        if days > 0 { return plan.countdown }
        if days == 0 { return plan.startsToday }
        return "until \(Days.longDays[Days.dow(plan.endDay)])"
    }

    var bloom: Double { bloomFor(days: days) }
}

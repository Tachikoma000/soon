import Foundation

struct APIError: LocalizedError {
    let status: Int
    let code: String

    var errorDescription: String? {
        switch (status, code) {
        case (401, _): return "You’ve been signed out."
        case (_, "dates"): return "Those dates don’t work. Pick days from today on."
        case (409, _): return "That already changed. Pull to refresh."
        case (0, _): return "Couldn’t reach Soon. Check your connection."
        default: return "Something went wrong. Try again."
        }
    }
}

/// Decodes any response we don't need the contents of.
struct Empty: Decodable {}

/// Talks to the website's /api/v1. In demo mode it answers from sample files instead.
final class SoonAPI: @unchecked Sendable {
    static let shared = SoonAPI()

    var base: URL {
        let s = Bundle.main.object(forInfoDictionaryKey: "SoonServer") as? String
        return URL(string: (s?.isEmpty == false ? s! : "https://soon-together.vercel.app"))!
    }

    private let session: URLSession = {
        let c = URLSessionConfiguration.default
        c.timeoutIntervalForRequest = 20
        c.requestCachePolicy = .reloadIgnoringLocalCacheData
        return URLSession(configuration: c)
    }()

    private let decoder = JSONDecoder()

    func get<T: Decodable>(_ path: String, as type: T.Type = T.self) async throws -> T {
        try await call("GET", path, nil)
    }

    func call<T: Decodable>(_ method: String, _ path: String, _ body: [String: Any]? = nil, as type: T.Type = T.self) async throws -> T {
        let token = SharedStore.token
        if let token, token.hasPrefix("demo:") {
            return try Demo.answer(method, path, person: String(token.dropFirst(5)), as: T.self)
        }
        var req = URLRequest(url: base.appendingPathComponent("api/v1/" + path))
        req.httpMethod = method
        req.setValue("application/json", forHTTPHeaderField: "accept")
        if let token { req.setValue("Bearer \(token)", forHTTPHeaderField: "authorization") }
        if let body {
            req.setValue("application/json", forHTTPHeaderField: "content-type")
            req.httpBody = try JSONSerialization.data(withJSONObject: body)
        }
        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await session.data(for: req)
        } catch {
            throw APIError(status: 0, code: "offline")
        }
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        guard (200..<300).contains(status) else {
            let code = (try? JSONSerialization.jsonObject(with: data) as? [String: Any])?["error"] as? String ?? "server"
            throw APIError(status: status, code: code)
        }
        return try decoder.decode(T.self, from: data)
    }

    /// Tell the server about a push token for this phone.
    func registerDevice(_ token: Data, kind: String, ref: String? = nil) async {
        guard SharedStore.token != nil, !SharedStore.isDemo else { return }
        #if DEBUG
        let env = "sandbox"
        #else
        let env = "production"
        #endif
        var body: [String: Any] = ["token": token.hex, "kind": kind, "env": env]
        if let ref { body["ref"] = ref }
        _ = try? await call("POST", "devices", body, as: Empty.self)
    }

    /// The widgets' data, saved for them to read.
    @discardableResult
    func refreshWidgetData() async -> WidgetData? {
        guard let data = try? await get("widget", as: WidgetData.self) else { return SharedStore.widget }
        SharedStore.widget = data
        return data
    }
}

/// Sample answers for demo mode and the simulator, from files captured off the demo server.
enum Demo {
    static func file(_ name: String, person: String) -> Data? {
        let bundle = Bundle.main
        let url = bundle.url(forResource: name, withExtension: "json", subdirectory: "Demo/\(person)")
        return url.flatMap { try? Data(contentsOf: $0) }
    }

    static func answer<T: Decodable>(_ method: String, _ path: String, person: String, as type: T.Type) throws -> T {
        let decoder = JSONDecoder()
        if method != "GET" {
            return try decoder.decode(T.self, from: Data(#"{"ok":true}"#.utf8))
        }
        let name = path.replacingOccurrences(of: "/", with: "-")
        guard let data = file(name, person: person) ?? file(name.components(separatedBy: "?").first ?? name, person: person) else {
            throw APIError(status: 404, code: "demo")
        }
        return try decoder.decode(T.self, from: data)
    }
}

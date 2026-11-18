import Foundation
import Security

/// What the app and its widgets share: the sign-in token (Keychain) and the last widget snapshot.
enum SharedStore {
    static let group = "group.network.playgrounds.soon"
    static let defaults: UserDefaults = UserDefaults(suiteName: group) ?? .standard

    private static let tokenKey = "token"

    static var token: String? {
        get { Keychain.read(tokenKey) ?? defaults.string(forKey: "fallback-token") }
        set {
            if let v = newValue {
                if !Keychain.write(tokenKey, v) { defaults.set(v, forKey: "fallback-token") }
            } else {
                Keychain.delete(tokenKey)
                defaults.removeObject(forKey: "fallback-token")
            }
        }
    }

    static var isDemo: Bool { token?.hasPrefix("demo:") == true }

    static var timezone: String? {
        get { defaults.string(forKey: "timezone") }
        set { defaults.set(newValue, forKey: "timezone") }
    }

    static var widget: WidgetData? {
        get {
            guard let data = defaults.data(forKey: "widget") else { return nil }
            return try? JSONDecoder().decode(WidgetData.self, from: data)
        }
        set {
            if let v = newValue, let data = try? JSONEncoder().encode(v) { defaults.set(data, forKey: "widget") }
            else { defaults.removeObject(forKey: "widget") }
        }
    }

    static func clear() {
        token = nil
        widget = nil
    }
}

/// A small Keychain wrapper. Items live in the app group so the widgets can read them.
enum Keychain {
    private static func base(_ key: String) -> [String: Any] {
        [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: "network.playgrounds.soon",
            kSecAttrAccount as String: key,
            kSecAttrAccessGroup as String: SharedStore.group,
        ]
    }

    static func read(_ key: String) -> String? {
        var q = base(key)
        q[kSecReturnData as String] = true
        q[kSecMatchLimit as String] = kSecMatchLimitOne
        var out: AnyObject?
        guard SecItemCopyMatching(q as CFDictionary, &out) == errSecSuccess, let data = out as? Data else { return nil }
        return String(data: data, encoding: .utf8)
    }

    @discardableResult
    static func write(_ key: String, _ value: String) -> Bool {
        let data = Data(value.utf8)
        let q = base(key)
        let update: [String: Any] = [
            kSecValueData as String: data,
            kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlock,
        ]
        let status = SecItemUpdate(q as CFDictionary, update as CFDictionary)
        if status == errSecSuccess { return true }
        var add = q
        add.merge(update) { $1 }
        return SecItemAdd(add as CFDictionary, nil) == errSecSuccess
    }

    static func delete(_ key: String) {
        SecItemDelete(base(key) as CFDictionary)
    }
}

extension Data {
    var hex: String { map { String(format: "%02x", $0) }.joined() }
}

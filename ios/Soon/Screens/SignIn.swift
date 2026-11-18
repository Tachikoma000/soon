import AuthenticationServices
import SwiftUI

struct SignIn: View {
    @Environment(AppModel.self) private var model
    @Environment(\.webAuthenticationSession) private var webAuth
    @State private var error: String?
    @State private var working = false

    private static let errors: [String: String] = [
        "stranger": "That Google account isn’t on Soon. Try the one you use with Soon.",
        "used": "This invite has already been used.",
        "scopes": "Soon needs the calendar boxes ticked. Try once more.",
        "token": "Google didn’t let Soon stay signed in. Try once more.",
        "setup": "Soon isn’t set up for signing in yet.",
    ]

    var body: some View {
        VStack(spacing: 0) {
            Spacer(minLength: 40)
            Sunflower(bloom: 1, sway: true).frame(width: 120)
            Text("soon").font(Typeface.italic(44)).em(-0.02, 44).foregroundStyle(Color.ink).padding(.top, 22)
            Spacer()
            VStack(spacing: 14) {
                if let error {
                    Text(error).font(Typeface.sans(14)).foregroundStyle(Color.ink2).multilineTextAlignment(.center)
                }
                WorkButton { await signIn() } label: { Text("Continue with Google") }
                (Text("It only sees ") + Text("when").font(Typeface.italic(13.5)) + Text(" you’re busy, never what."))
                    .font(Typeface.sans(13))
                    .foregroundStyle(Color.ink3)
            }
        }
        .padding(.horizontal, 22)
        .padding(.bottom, 24)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .paper()
    }

    private func signIn() async {
        error = nil
        var url = SoonAPI.shared.base.appendingPathComponent("api/auth/google")
        url.append(queryItems: [URLQueryItem(name: "app", value: "1")])
        do {
            let back = try await webAuth.authenticate(using: url, callback: .customScheme("soon"), preferredBrowserSession: nil, additionalHeaderFields: [:])
            let q = URLComponents(url: back, resolvingAgainstBaseURL: false)?.queryItems ?? []
            if let token = q.first(where: { $0.name == "token" })?.value {
                await model.signedIn(token: token)
            } else {
                let code = q.first(where: { $0.name == "error" })?.value ?? ""
                error = code == "cancelled" ? nil : Self.errors[code] ?? "That didn’t work. Try once more."
            }
        } catch let e as ASWebAuthenticationSessionError where e.code == .canceledLogin {
            // Closed the sheet; nothing to say.
        } catch {
            self.error = "That didn’t work. Try once more."
        }
    }
}

/// The first open after signing in: notifications, and where the countdown can live.
struct Hello: View {
    @Environment(AppModel.self) private var model
    @State private var allowed = false

    private var maker: Bool { model.me?.maker ?? false }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 32) {
                VStack(alignment: .leading, spacing: 18) {
                    Sunflower(bloom: 0.55).frame(width: 60)
                    Text(maker ? "Hi \(model.me?.me.name ?? "")." : "You’re in, \(model.me?.me.name ?? "").")
                        .font(Typeface.serif(34)).em(-0.02, 34).foregroundStyle(Color.ink)
                }
                VStack(alignment: .leading, spacing: 12) {
                    Text(maker ? "So you hear from \(model.themName)" : "So you know when I’m on my way")
                        .font(Typeface.serif(22)).foregroundStyle(Color.ink)
                    if allowed {
                        Text("Done.").font(Typeface.sans(16)).foregroundStyle(Color.ink2)
                    } else {
                        WorkButton(style: .quiet) { allowed = await PushCenter.shared.ask() } label: { Text("Turn on notifications") }
                    }
                }
                VStack(alignment: .leading, spacing: 8) {
                    Text("Keep the countdown close").font(Typeface.serif(22)).foregroundStyle(Color.ink)
                    Text("Touch and hold your Lock Screen or Home Screen, tap Edit, and add Soon.")
                        .font(Typeface.sans(16))
                        .foregroundStyle(Color.ink2)
                        .lineSpacing(3)
                }
            }
            .padding(.horizontal, 22)
            .padding(.top, 56)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .safeAreaInset(edge: .bottom) {
            WorkButton(style: allowed ? .clay : .quiet) { await model.finishHello() } label: { Text(allowed ? "Done" : "Later") }
                .padding(.horizontal, 22)
                .padding(.bottom, 8)
        }
        .paper()
        .task { allowed = await PushCenter.shared.isAllowed }
    }
}

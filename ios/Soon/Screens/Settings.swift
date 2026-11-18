import AuthenticationServices
import SwiftUI
import UIKit
import UserNotifications

struct SettingsScreen: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    @Environment(\.webAuthenticationSession) private var webAuth
    @Environment(\.openURL) private var openURL

    @State private var eventTitle = ""
    @State private var isPrivate = true
    @State private var drive = true
    @State private var calendars: [CalendarInfo]?
    @State private var counted = Set<String>()
    @State private var calendarsTouched = false
    @State private var saved = false
    @State private var share = false
    @State private var shareNote: String?
    @State private var invite: String?
    @State private var notifications: UNAuthorizationStatus?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 36) {
                section("On my calendar") {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Plans show up as").font(Typeface.sans(14, .medium)).foregroundStyle(Color.ink2)
                        TextField("Where, or “\(model.themName) visiting”", text: $eventTitle)
                            .font(Typeface.sans(16))
                            .padding(12)
                            .background(RoundedRectangle(cornerRadius: 12).fill(Color.raised))
                            .overlay(RoundedRectangle(cornerRadius: 12).strokeBorder(Color.line2))
                    }
                    VStack(spacing: 0) {
                        Rule()
                        switchRow("Hide the details from others", $isPrivate)
                        Rule()
                        switchRow("Block the drive too", $drive)
                        Rule()
                    }
                }

                if !(model.me?.demo ?? false) {
                    section("Calendars that count") {
                        if let calendars {
                            VStack(spacing: 0) {
                                Rule()
                                ForEach(calendars) { c in
                                    let id = c.primary ? "primary" : c.id
                                    switchRow(c.primary ? "Main calendar" : c.name, Binding(
                                        get: { counted.contains(id) || (c.primary && counted.contains(c.id)) },
                                        set: { on in
                                            calendarsTouched = true
                                            if on { counted.insert(id) } else { counted.remove(id); counted.remove(c.id) }
                                        }
                                    ))
                                    Rule()
                                }
                            }
                        } else {
                            ProgressView()
                        }
                    }
                }

                HStack(spacing: 16) {
                    WorkButton { await save() } label: { Text("Save") }
                    if saved { Text("Saved").font(Typeface.sans(14)).foregroundStyle(Color.ink2) }
                }

                section(model.themName) {
                    VStack(alignment: .leading, spacing: 10) {
                        VStack(spacing: 0) {
                            Rule()
                            switchRow("Let \(model.themName) see what’s on my calendar", Binding(get: { share }, set: { on in
                                share = on
                                Task { await setShare(on) }
                            }))
                            Rule()
                        }
                        Text(shareNote ?? "Private events stay hidden.").font(Typeface.sans(14)).foregroundStyle(Color.ink3)
                    }
                    if !(model.me?.theyJoined ?? true) && !(model.me?.demo ?? false) {
                        VStack(alignment: .leading, spacing: 10) {
                            if let invite, let url = URL(string: invite) {
                                ShareLink(item: url, message: Text("For us")) {
                                    Text("Send \(model.themName) the invite").frame(maxWidth: .infinity)
                                }
                                .buttonStyle(.clay)
                                Text("Works once.").font(Typeface.sans(14)).foregroundStyle(Color.ink3)
                            } else {
                                WorkButton(style: .quiet) { invite = await model.makeInvite() } label: { Text("Make an invite link") }
                            }
                        }
                        .padding(.top, 10)
                    }
                }

                section("Notifications") {
                    switch notifications {
                    case .authorized?, .provisional?, .ephemeral?:
                        Text("On. You’ll hear when \(model.themName) asks, answers, or is on the way.").font(Typeface.sans(15)).foregroundStyle(Color.ink2)
                    case .denied?:
                        Button("Turn them on in Settings") {
                            if let url = URL(string: UIApplication.openNotificationSettingsURLString) { openURL(url) }
                        }
                        .buttonStyle(.quiet)
                    default:
                        WorkButton(style: .quiet) {
                            await PushCenter.shared.ask()
                            await readNotifications()
                        } label: { Text("Turn on notifications") }
                    }
                }

                VStack(alignment: .leading, spacing: 10) {
                    Rule()
                    if model.me?.demo ?? false {
                        Text("Look around as").font(Typeface.sans(14)).foregroundStyle(Color.ink2).padding(.top, 10)
                        HStack(spacing: 10) {
                            ForEach(["tachi", "annie"], id: \.self) { who in
                                Button(who.capitalized) {
                                    SharedStore.token = "demo:\(who)"
                                    dismiss()
                                    Task { await model.refresh() }
                                }
                                .buttonStyle(SoonButtonStyle(kind: model.me?.me.id == who ? .clay : .quiet))
                            }
                        }
                    } else {
                        Button("Sign out") {
                            dismiss()
                            model.signOut()
                        }
                        .font(Typeface.sans(16, .medium))
                        .foregroundStyle(Color.terra)
                        .padding(.top, 10)
                    }
                }
            }
            .padding(.horizontal, 22)
            .padding(.top, 8)
            .padding(.bottom, 32)
        }
        .paper()
        .navigationTitle("Settings")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .confirmationAction) {
                Button("Done") { dismiss() }
            }
        }
        .task { await load() }
    }

    private func section<C: View>(_ title: String, @ViewBuilder _ content: () -> C) -> some View {
        VStack(alignment: .leading, spacing: 14) {
            Text(title).font(Typeface.serif(22)).foregroundStyle(Color.ink)
            content()
        }
    }

    private func switchRow(_ label: String, _ on: Binding<Bool>) -> some View {
        Toggle(isOn: on) {
            Text(label).font(Typeface.sans(15.5)).foregroundStyle(Color.ink)
        }
        .tint(.terra)
        .frame(minHeight: 56)
    }

    private func load() async {
        if let s = model.me?.settings {
            eventTitle = s.eventTitle ?? ""
            isPrivate = s.eventPrivate
            drive = s.includeDrive
            share = s.shareDetails
            counted = Set(s.calendars)
        }
        await readNotifications()
        if !(model.me?.demo ?? true) {
            calendars = (try? await SoonAPI.shared.get("calendars", as: CalendarList.self))?.calendars ?? []
        }
    }

    private func readNotifications() async {
        notifications = await UNUserNotificationCenter.current().notificationSettings().authorizationStatus
    }

    private func save() async {
        await model.saveSettings(
            eventTitle: eventTitle.trimmingCharacters(in: .whitespaces).isEmpty ? nil : eventTitle,
            eventPrivate: isPrivate,
            includeDrive: drive,
            calendars: calendarsTouched ? Array(counted) : nil
        )
        withAnimation { saved = true }
    }

    /// Sharing needs one more Google permission the first time; that happens in a Safari sheet.
    private func setShare(_ on: Bool) async {
        shareNote = nil
        guard let url = await model.setShare(on) else { return }
        do {
            let back = try await webAuth.authenticate(using: url, callback: .customScheme("soon"), preferredBrowserSession: nil, additionalHeaderFields: [:])
            let q = URLComponents(url: back, resolvingAgainstBaseURL: false)?.queryItems ?? []
            if let e = q.first(where: { $0.name == "error" })?.value {
                share = false
                shareNote = [
                    "declined": "Google didn’t share the event names. Try again and tick the box.",
                    "account": "That was a different Google account. Try again with yours.",
                    "cancelled": "Left as it was.",
                ][e] ?? "Try once more."
            }
            await model.refresh()
            share = model.me?.settings.shareDetails ?? false
        } catch {
            share = false
            shareNote = "Left as it was."
        }
    }
}

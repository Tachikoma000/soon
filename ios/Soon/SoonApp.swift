import SwiftUI

@main
struct SoonApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) private var delegate
    @State private var model = AppModel()

    var body: some Scene {
        WindowGroup {
            Root()
                .environment(model)
                .preferredColorScheme(.light)
                .tint(.terra)
                .task { await model.start() }
                .onReceive(NotificationCenter.default.publisher(for: .soonRefresh)) { _ in
                    Task { await model.refresh() }
                }
                .onReceive(NotificationCenter.default.publisher(for: UIApplication.willEnterForegroundNotification)) { _ in
                    Task { await model.refresh() }
                }
                .onOpenURL { url in
                    // soon://home from a widget, or a plan link from a notification.
                    if url.host == "home" { model.tab = .home }
                    if url.host == "plans" { model.tab = .plans }
                }
        }
    }
}

struct Root: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        ZStack(alignment: .bottom) {
            Group {
                if ProcessInfo.processInfo.arguments.contains("-gallery") {
                    Gallery()
                } else {
                    switch model.phase {
                    case .launching: Launching()
                    case .signedOut: SignIn()
                    case .ready:
                        if model.me?.settings.onboarded == false { Hello() } else { Tabs() }
                    }
                }
            }
            .transition(.opacity)
            if let t = model.toast { Toast(text: t) }
        }
        .animation(.easeInOut(duration: 0.25), value: model.phase)
    }
}

private struct Launching: View {
    var body: some View {
        Sunflower(bloom: 1, stem: false)
            .frame(width: 72)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .paper()
    }
}

struct Tabs: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        @Bindable var model = model
        TabView(selection: $model.tab) {
            Tab("Soon", systemImage: "sun.max", value: AppModel.Tab.home) {
                NavigationStack(path: $model.homePath) { HomeScreen() }
            }
            Tab("Calendar", systemImage: "calendar", value: AppModel.Tab.calendar) {
                NavigationStack { CalendarScreen() }
            }
            Tab("Plans", systemImage: "point.topleft.down.to.point.bottomright.curvepath", value: AppModel.Tab.plans) {
                NavigationStack { PlansScreen() }
            }
            .badge(model.home?.incoming.count ?? 0)
        }
        .sheet(item: $model.ask) { draft in
            AskScreen(draft: draft)
        }
        .sheet(isPresented: $model.showSettings) {
            NavigationStack { SettingsScreen() }
        }
    }
}

import SwiftUI

@main
struct FractalWatchApp: App {
    @StateObject private var link = PhoneLink()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(link)
        }
    }
}

/*
 * FOUR PAGES, SWIPED UP AND DOWN: Scenes, Pedals, Presets, Tuner.
 *
 * It opens on Scenes, the one reached for most mid-song. The tuner is last and
 * does nothing until it is tapped: a unit set to mute while it tunes would
 * otherwise go quiet because a page was swiped past. Leaving the tuner page
 * turns it back off.
 *
 * Launched with -page N (CI's screenshots) it opens on that page instead.
 */
struct RootView: View {
    @EnvironmentObject private var link: PhoneLink
    @Environment(\.scenePhase) private var phase
    @State private var page = Launch.number("page")

    var body: some View {
        Group {
            /* The pages stay up through a moment out of reach (see PhoneLink.away),
               with the taps held back and a word at the top saying why. */
            if let state = link.state, state.linked, !state.tooNew, !link.away {
                TabView(selection: $page) {
                    ScenesPage(state: state).tag(0)
                    PedalsPage(state: state).tag(1)
                    PresetsPage(state: state).tag(2)
                    TunerPage(state: state).tag(3)
                }
                .tabViewStyle(.verticalPage)
                .disabled(!link.reachable)
                .opacity(link.reachable ? 1 : 0.55)
                .overlay(alignment: .top) {
                    if !link.reachable {
                        Text("Reconnecting…")
                            .font(.caption2)
                            .padding(.horizontal, 8)
                            .padding(.vertical, 2)
                            .background(.thinMaterial, in: Capsule())
                    }
                }
            } else {
                WaitingPage(tooNew: link.state?.tooNew == true, phoneOnly: link.reachable && link.state?.linked == false)
            }
        }
        .onChange(of: phase) { _, now in
            if now == .active { link.woke() }
        }
    }
}

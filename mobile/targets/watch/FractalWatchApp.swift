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
 * does nothing until it is tapped: on a Fractal the tuner mutes the output,
 * and a watch that muted the band because a page was swiped past would be a
 * watch nobody wears twice. Leaving the tuner page turns it back off.
 *
 * Launched with -page N (CI's screenshots) it opens on that page instead.
 */
struct RootView: View {
    @EnvironmentObject private var link: PhoneLink
    @State private var page = UserDefaults.standard.integer(forKey: "page")

    var body: some View {
        if let state = link.state, link.reachable, state.linked, !state.tooNew {
            TabView(selection: $page) {
                ScenesPage(state: state).tag(0)
                PedalsPage(state: state).tag(1)
                PresetsPage(state: state).tag(2)
                TunerPage(state: state).tag(3)
            }
            .tabViewStyle(.verticalPage)
        } else {
            WaitingPage(tooNew: link.state?.tooNew == true, phoneOnly: link.reachable && link.state?.linked == false)
        }
    }
}

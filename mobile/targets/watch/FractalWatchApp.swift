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
 * FOUR PAGES, SWIPED LEFT AND RIGHT: Scenes, Pedals, Presets, Tuner.
 *
 * "We wanna be able to swipe left or right through the screens." They were
 * stacked up and down, which nobody found: the up-and-down swipe also scrolls
 * the pedal list, so it read as one long page. Sideways paging, with the dots
 * along the bottom, is the watch's own sign that there are more pages.
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
    @State private var page = UserDefaults.standard.integer(forKey: "page")

    var body: some View {
        if let state = link.state, link.reachable, state.linked, !state.tooNew {
            TabView(selection: $page) {
                ScenesPage(state: state).tag(0)
                PedalsPage(state: state).tag(1)
                PresetsPage(state: state).tag(2)
                TunerPage(state: state).tag(3)
            }
            .tabViewStyle(.page)
        } else {
            WaitingPage(tooNew: link.state?.tooNew == true, phoneOnly: link.reachable && link.state?.linked == false)
        }
    }
}

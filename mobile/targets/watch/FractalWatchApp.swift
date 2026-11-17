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
 * UP TO FIVE PAGES, SWIPED UP AND DOWN: Scenes, Pedals, Presets, Tempo,
 * Tuner.
 *
 * THE ONES SHOWN, IN THE ORDER CHOSEN ON THE IPHONE (Settings → Apple Watch
 * → Watch pages), which the phone sends in the picture (Model.swift,
 * WatchState.shown), and all five in the usual order above when it sends
 * nothing. A hidden page is not drawn, so it cannot be swiped to. It opens
 * on the first of those shown: Scenes in the usual order, the one reached
 * for most mid-song.
 *
 * The tuner does nothing until it is tapped, wherever its page sits: a unit
 * set to mute while it tunes would otherwise go quiet because a page was
 * swiped past. Leaving the tuner page turns it back off, unless the iPhone
 * has said the tuner stays on (Pages.swift TunerPage, Model.swift
 * watchTunerStopsOnLeaving); and hiding that page in the iPhone's list
 * turns it off whatever the iPhone has said (watchTunerStopsOnHiding).
 *
 * `page` is the page the wearer has swiped to, by name, and nil until they
 * have swiped: until then the first shown page is the one on show, so pages
 * that arrive a moment after the app opens are the ones it opens on, and a
 * new order sent while it is open never moves the page under the thumb. A
 * page hidden while the watch is on it sets it back to nil: the first shown
 * page again.
 *
 * Launched with -page N (CI's screenshots) it opens on that page instead,
 * by the number CI has always called it (Model.swift WatchPage.numbers: 3
 * is the tuner, wherever the tuner is drawn), so CI's pictures are of the
 * same pages they always were. (CI sends no order and hides nothing.)
 */
struct RootView: View {
    @EnvironmentObject private var link: PhoneLink
    @Environment(\.scenePhase) private var phase
    @State private var page: WatchPage? = Launch.value("page") == nil ? nil : WatchPage.numbered(Launch.number("page"))
    /* The metronome's tap: see Metronome.swift. */
    @State private var wrist = WristMetronome()
    /* Whether the edge of the screen is lit this instant: on every beat the wrist taps, then let go (EdgeBeat, below). Launched with -beatDemo YES it stays lit, for CI's picture of it. */
    @State private var beatLit = Launch.flag("beatDemo")

    var body: some View {
        Group {
            /* The pages stay up through a moment out of reach (see PhoneLink.away),
               with the taps held back and a word at the top saying why. */
            if let state = link.state, state.linked, !state.tooNew, !link.away {
                TabView(selection: onShow(state.shown)) {
                    ForEach(state.shown, id: \.self) { which in
                        drawn(which, state).tag(which)
                    }
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
        /* Over every page, and taking no touch: the beat is seen whichever page the wrist is on. */
        .overlay { EdgeBeat(lit: beatLit) }
        .onChange(of: phase) { _, now in
            if now == .active { link.woke() }
            /* The check-in runs only while the app is on screen (PhoneLink.onScreen): started by the wrist coming up, ended by its going down. */
            link.onScreen(now == .active)
            if now != .active { wrist.stop() } else { wrist.follow(link.state?.metronome) }
        }
        .onChange(of: link.state?.metronome) { _, now in
            if phase == .active { wrist.follow(now) }
        }
        /* The pages shown changed under the watch: a tuner whose page has just been hidden is turned off, and if the page the watch was on is gone it is on the first shown page. */
        .onChange(of: link.state?.shown) { was, now in
            guard let now else { return }
            if watchTunerStopsOnHiding(was: was ?? WatchPage.usual, now: now, tunerOn: link.state?.tuner.on == true) { link.send(.tuner(on: false)) }
            if let swiped = page, !now.contains(swiped) { page = nil }
        }
        /* And at launch, when the phase may already be active and so never "changes" to it. */
        .onAppear { link.onScreen(phase == .active) }
        /* The metronome hands every beat it taps to the light on the edge of the screen (EdgeBeat, below). */
        .onAppear { wrist.onBeat = { lightTheEdge() } }
    }

    /* Lit at once on the beat, and let go a moment later: on and fading in one breath would be drawn as never lit at all. */
    private func lightTheEdge() {
        beatLit = true
        /* CI's picture of it is of it lit. */
        if Launch.flag("beatDemo") { return }
        Task { @MainActor in
            try? await Task.sleep(nanoseconds: UInt64(EdgeBeatLook.heldMs) * 1_000_000)
            withAnimation(.easeOut(duration: EdgeBeatLook.fade)) { beatLit = false }
        }
    }

    /* The page on show: the one swiped to while it is still shown, or the first shown page (Model.swift watchPageOnShow). */
    private func onShow(_ shown: [WatchPage]) -> Binding<WatchPage> {
        Binding(get: { watchPageOnShow(page, shown) }, set: { page = $0 })
    }

    @ViewBuilder
    private func drawn(_ which: WatchPage, _ state: WatchState) -> some View {
        switch which {
        case .scenes: ScenesPage(state: state)
        case .pedals: PedalsPage(state: state)
        case .presets: PresetsPage(state: state)
        case .tempo: TempoPage(state: state)
        case .tuner: TunerPage(state: state)
        }
    }
}

/*
 * THE BEAT, ON THE EDGE OF THE WATCH.
 *
 * "Same thing if we can have the watch outside edge flash with the same as
 * the tempo" (Justin, 12 November 2026): the iPhone lights a frame round
 * its whole screen on every beat (components/MetronomeBeat), and this is
 * the watch's. A green line round the edge of the screen, lit on every beat
 * the wrist's metronome taps and gone before the next. It is drawn over
 * every page and takes no touch, so it never comes between a thumb and a
 * button, and VoiceOver is told nothing of it.
 *
 * The corners follow the screen's own as nearly as its width tells
 * (Model.swift watchEdgeRadius), and the line is soft at its edges, so a
 * corner a point or two off is not seen.
 */
enum EdgeBeatLook {
    /** How thick the line is. */
    static let line: CGFloat = 6
    /** How long it is held fully lit, in milliseconds, and how long it takes to fade, in seconds. */
    static let heldMs = 40
    static let fade = 0.16
}

struct EdgeBeat: View {
    let lit: Bool

    var body: some View {
        GeometryReader { box in
            RoundedRectangle(cornerRadius: CGFloat(watchEdgeRadius(width: Double(box.size.width))), style: .continuous)
                .strokeBorder(Color.green, lineWidth: EdgeBeatLook.line)
                .blur(radius: 1.5)
                .opacity(lit ? 1 : 0)
        }
        .ignoresSafeArea()
        .allowsHitTesting(false)
        .accessibilityHidden(true)
    }
}

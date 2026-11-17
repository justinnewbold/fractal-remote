import Foundation
import WatchConnectivity

/*
 * THE WATCH'S END OF THE LINK TO THE PHONE.
 *
 * Apple keeps a watch app off the kind of always-open connection the relay
 * is, so the watch never talks to the computer: it talks to the phone, over
 * Apple's own watch-to-phone link, and the phone does the rest. Two ways a
 * picture arrives — a message while both apps are awake, and the "application
 * context", the last picture the phone left, which is there to draw from the
 * moment the watch app opens.
 *
 * `demo` (launched with -demo YES) answers every request here instead, for the
 * screenshots CI takes and for trying the pages with no phone in reach.
 */
/*
 * The launch arguments CI's screenshots pass (-demo YES, -page 2), read from
 * the process rather than through UserDefaults. UserDefaults is one of Apple's
 * "required reason" APIs: using it means declaring why in a privacy manifest,
 * and a missing declaration is grounds for an upload to be refused. Reading
 * the arguments directly is the same answer with nothing to declare.
 */
enum Launch {
    static func value(_ name: String) -> String? {
        let args = ProcessInfo.processInfo.arguments
        guard let at = args.firstIndex(of: "-\(name)"), at + 1 < args.count else { return nil }
        return args[at + 1]
    }
    static func flag(_ name: String) -> Bool { value(name) == "YES" }
    static func number(_ name: String) -> Int { Int(value(name) ?? "") ?? 0 }
}

@MainActor
final class PhoneLink: NSObject, ObservableObject {
    @Published private(set) var state: WatchState?
    /** Whether the phone can be asked anything right now. */
    @Published private(set) var reachable = false
    /*
     * Whether the phone has been out of reach long enough to say so.
     *
     * "It basically keeps losing connection just for about a second saying
     * please open the app on your phone." Raising the wrist wakes the watch
     * app with the link not yet up, and Apple's reachability flickers off and
     * on for a moment while it comes back. Each flicker used to swap the
     * whole screen for "Open Fractal Remote on your iPhone". Now the last
     * picture stays up, marked as reconnecting, and only a phone that has
     * been gone for `grace` seconds gets the message.
     */
    @Published private(set) var away = false
    private let grace: Double = 8
    private var awayTimer: Task<Void, Never>?
    let demo: Bool

    /*
     * THE CHECK-IN (Model.swift watchHereDue). While the watch app is on its
     * screen, a timer asks every `watchHereTick` seconds whether one is due
     * and sends "here" when it is: twenty seconds since anything was last
     * sent, with the pages up. `lastSent` is the last time a request really
     * went (a tap counts, so somebody tapping away sends none). The timer
     * exists only while the app is on screen: onScreen(false), from the
     * root view when the wrist goes down, ends it at once.
     */
    private var lastSent: Date?
    private var screenOn = false
    private var hereTimer: Timer?

    /** Whether the pages are up rather than the waiting page: the root view's own test. */
    private var pagesUp: Bool {
        guard let state else { return false }
        return state.linked && !state.tooNew && !away
    }

    private let session: WCSession? = WCSession.isSupported() ? WCSession.default : nil

    init(demo: Bool = Launch.flag("demo")) {
        self.demo = demo
        super.init()
        if demo {
            var sample = WatchState.sample
            if Launch.flag("tunerDemo") { sample = sample.answering(.tuner(on: true)) }
            if Launch.flag("boostDemo") { sample = sample.boostDemo }
            if Launch.flag("am4Demo") { sample = sample.am4Demo }
            if Launch.flag("quickDemo") { sample = sample.quickDemo }
            state = sample
            reachable = true
            return
        }
        session?.delegate = self
        session?.activate()
        /* Before anything has been heard, the picture the phone last left. */
        take(session?.receivedApplicationContext["state"] as? String)
        reach(false)
    }

    func send(_ command: WatchCommand) {
        if demo {
            state = state?.answering(command)
            return
        }
        guard let session, session.activationState == .activated, session.isReachable else { return }
        /* Anything sent holds the iPhone awake for its 25 seconds, so the next check-in is counted from here. */
        lastSent = Date()
        /*
         * The message wakes the iPhone app in the background if it is asleep
         * (the phone locked in a pocket), and the phone answers when it has it.
         * Waking can miss the first time; one more try a second later.
         */
        let body: [String: Any] = ["json": command.json]
        /* A tap is sent once or not at all (WatchCommand.once): a second try would be a second, late beat. A check-in too: the next is two seconds off. */
        let once = command.once
        session.sendMessage(body, replyHandler: { _ in }, errorHandler: { _ in
            guard !once else { return }
            DispatchQueue.main.asyncAfter(deadline: .now() + 1) {
                guard session.isReachable else { return }
                session.sendMessage(body, replyHandler: { _ in }, errorHandler: nil)
            }
        })
    }

    fileprivate func take(_ json: String?) {
        guard let json, let fresh = WatchState.decode(json) else { return }
        state = fresh
    }

    fileprivate func reach(_ now: Bool) {
        let was = reachable
        reachable = now
        awayTimer?.cancel()
        if now {
            away = false
            /* Just come into reach: ask for the picture rather than wait for a change. */
            if !was { send(.hello) }
        } else {
            let wait = UInt64(grace * 1_000_000_000)
            awayTimer = Task { @MainActor [weak self] in
                try? await Task.sleep(nanoseconds: wait)
                guard !Task.isCancelled, let self, !self.reachable else { return }
                self.away = true
            }
        }
    }

    /*
     * The watch app came on its screen (true) or left it (false: the wrist
     * down, another app, the clock face). On: a check-in now if one is due,
     * which it is after any pause, and the timer that asks from then on.
     * Off: the timer gone, and nothing more sent until the wrist is raised.
     */
    func onScreen(_ on: Bool) {
        screenOn = on
        hereTimer?.invalidate()
        hereTimer = nil
        guard on, !demo else { return }
        checkIn()
        hereTimer = Timer.scheduledTimer(withTimeInterval: watchHereTick, repeats: true) { [weak self] _ in
            Task { @MainActor [weak self] in self?.checkIn() }
        }
    }

    private func checkIn() {
        guard watchHereDue(onScreen: screenOn, pagesUp: pagesUp, demo: demo, lastSent: lastSent, now: Date()) else { return }
        send(.here)
    }

    /* Asked again whenever the app comes back to the front: the wrist raised. */
    func woke() {
        guard !demo, let session else { return }
        reach(session.activationState == .activated && session.isReachable)
    }
}

extension PhoneLink: WCSessionDelegate {
    nonisolated func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?) {
        let kept = session.receivedApplicationContext["state"] as? String
        let now = session.isReachable
        Task { @MainActor in
            self.take(kept)
            self.reach(now)
        }
    }

    nonisolated func sessionReachabilityDidChange(_ session: WCSession) {
        let now = session.isReachable
        Task { @MainActor in self.reach(now) }
    }

    nonisolated func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
        let json = message["state"] as? String
        Task { @MainActor in self.take(json) }
    }

    nonisolated func session(_ session: WCSession, didReceiveApplicationContext applicationContext: [String: Any]) {
        let json = applicationContext["state"] as? String
        Task { @MainActor in self.take(json) }
    }
}

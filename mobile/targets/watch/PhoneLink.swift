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

    private let session: WCSession? = WCSession.isSupported() ? WCSession.default : nil

    init(demo: Bool = Launch.flag("demo")) {
        self.demo = demo
        super.init()
        if demo {
            var sample = WatchState.sample
            if Launch.flag("tunerDemo") { sample = sample.answering(.tuner(on: true)) }
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
        session.sendMessage(["json": command.json], replyHandler: nil, errorHandler: nil)
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

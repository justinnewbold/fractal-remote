import Foundation
import WatchKit

/*
 * THE METRONOME, ON THE WRIST.
 *
 * "Same with the watch, metronome that can beep on the watch." The phone says
 * whether the watch should keep time and at what tempo (WatchState.metronome,
 * from shared/metronome.mjs's setting), and this taps on every beat: the
 * system's click, which is a tap you feel and a tick you hear.
 *
 * Counted from when it started rather than from the last beat, the same rule
 * as the phone's (nextBeat in shared/metronome.mjs), so a late timer once does
 * not push every beat after it. It only runs while the watch app is on the
 * screen: watchOS gives an app no clock to run on once its screen sleeps, and
 * a metronome that played on regardless would need a workout session to do it.
 */
@MainActor
final class WristMetronome {
    private var timer: Timer?
    private var bpm: Double = 0
    private var started = Date()

    /** Follow the phone's word: on at this tempo, or off. Restarts only when the tempo moves. */
    func follow(_ metronome: WatchMetronome?) {
        let want = (metronome?.on == true) ? (metronome?.bpm ?? 0) : 0
        guard want >= 20, want <= 400 else { stop(); return }
        if timer != nil, abs(want - bpm) < 0.01 { return }
        stop()
        bpm = want
        started = Date()
        beat()
    }

    func stop() {
        timer?.invalidate()
        timer = nil
        bpm = 0
    }

    private func beat() {
        WKInterfaceDevice.current().play(.click)
        let step = 60.0 / bpm
        let elapsed = Date().timeIntervalSince(started)
        let next = (floor(elapsed / step) + 1) * step - elapsed
        timer = Timer.scheduledTimer(withTimeInterval: max(0.01, next), repeats: false) { [weak self] _ in
            Task { @MainActor [weak self] in
                guard let self, self.bpm > 0 else { return }
                self.beat()
            }
        }
    }
}

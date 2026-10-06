import ExpoModulesCore
import UIKit
import WatchConnectivity

/*
 * THE IPHONE'S END OF THE APPLE WATCH LINK.
 *
 * Two calls and one event, all the app needs (src/lib/watchBridge.js):
 *
 *   sendState(json, urgent) — the stage screen's picture, to the watch. Sent
 *     as a message when the watch app is open, and kept as the "application
 *     context" — the copy the watch finds the moment it opens — unless it only
 *     moved the tuner (urgent false), which is not worth keeping.
 *   isPaired()              — a watch paired, with the watch app on it.
 *   onCommand { json }      — a request from the watch, in watch-link's words.
 *
 * The phone does nothing with a request here: it goes to the JavaScript, which
 * checks it against the last picture sent (watchCommand) before anything
 * reaches the unit.
 *
 * WAKE ON TAP. "Do the wake on tap." A tap on the watch wakes this app in the
 * background even with the phone locked in a pocket: Apple delivers the
 * watch's message and gives the app a few seconds to answer it. Those
 * seconds are stretched to WAKE_SECONDS with a background task, long
 * enough for the JavaScript to rejoin the computer, send the change and
 * send the watch its new picture, and then given back. A request that
 * arrives before the JavaScript is listening (the app was launched by the
 * tap itself) is held and handed over when it starts listening, rather than
 * dropped. `wakes` tells the JavaScript this build does all that, so its help
 * text can say the phone may be locked.
 */
public class FractalWatchModule: Module {
  private var link: WatchSessionLink?
  private var listening = false
  private var held: [(json: String, at: Date)] = []
  private var awake: UIBackgroundTaskIdentifier = .invalid
  private var sleepAt: DispatchWorkItem?
  private static let WAKE_SECONDS: Double = 25
  private static let HOLD_SECONDS: Double = 15

  public func definition() -> ModuleDefinition {
    Name("FractalWatch")

    Events("onCommand")

    OnCreate {
      self.link = WatchSessionLink { [weak self] json in
        DispatchQueue.main.async { self?.arrived(json) }
      }
    }

    OnStartObserving {
      DispatchQueue.main.async {
        self.listening = true
        let fresh = self.held.filter { Date().timeIntervalSince($0.at) < Self.HOLD_SECONDS }
        self.held = []
        for item in fresh { self.sendEvent("onCommand", ["json": item.json]) }
      }
    }

    OnStopObserving {
      DispatchQueue.main.async { self.listening = false }
    }

    Function("sendState") { (json: String, urgent: Bool) in
      self.link?.send(json, urgent: urgent)
    }

    Function("isPaired") { () -> Bool in
      self.link?.paired ?? false
    }

    /* This build wakes on a watch tap (see WAKE ON TAP above). */
    Function("wakes") { () -> Bool in
      true
    }
  }

  /* On the main queue: a request from the watch. Keep the app up long enough
     to carry it out, then pass it on, or hold it for a moment. */
  private func arrived(_ json: String) {
    stayAwake()
    if listening {
      sendEvent("onCommand", ["json": json])
    } else {
      held.append((json, Date()))
      if held.count > 8 { held.removeFirst(held.count - 8) }
    }
  }

  private func stayAwake() {
    if awake == .invalid {
      awake = UIApplication.shared.beginBackgroundTask(withName: "watch tap") { [weak self] in self?.sleep() }
    }
    sleepAt?.cancel()
    let later = DispatchWorkItem { [weak self] in self?.sleep() }
    sleepAt = later
    DispatchQueue.main.asyncAfter(deadline: .now() + Self.WAKE_SECONDS, execute: later)
  }

  private func sleep() {
    sleepAt?.cancel()
    sleepAt = nil
    if awake != .invalid {
      UIApplication.shared.endBackgroundTask(awake)
      awake = .invalid
    }
  }
}

final class WatchSessionLink: NSObject, WCSessionDelegate {
  private let onCommand: (String) -> Void
  private let session: WCSession? = WCSession.isSupported() ? WCSession.default : nil

  init(onCommand: @escaping (String) -> Void) {
    self.onCommand = onCommand
    super.init()
    session?.delegate = self
    session?.activate()
  }

  var paired: Bool {
    guard let session, session.activationState == .activated else { return false }
    return session.isPaired && session.isWatchAppInstalled
  }

  func send(_ json: String, urgent: Bool) {
    guard let session, session.activationState == .activated, session.isPaired, session.isWatchAppInstalled else { return }
    if session.isReachable {
      session.sendMessage(["state": json], replyHandler: nil, errorHandler: nil)
    }
    if urgent {
      try? session.updateApplicationContext(["state": json])
    }
  }

  func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?) {}

  func sessionDidBecomeInactive(_ session: WCSession) {}

  /* Switching to another watch deactivates the session; it is started again for the new one. */
  func sessionDidDeactivate(_ session: WCSession) {
    session.activate()
  }

  func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
    if let json = message["json"] as? String { onCommand(json) }
  }

  func session(_ session: WCSession, didReceiveMessage message: [String: Any], replyHandler: @escaping ([String: Any]) -> Void) {
    if let json = message["json"] as? String { onCommand(json) }
    replyHandler([:])
  }
}

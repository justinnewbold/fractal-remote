import ExpoModulesCore
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
 */
public class FractalWatchModule: Module {
  private var link: WatchSessionLink?

  public func definition() -> ModuleDefinition {
    Name("FractalWatch")

    Events("onCommand")

    OnCreate {
      self.link = WatchSessionLink { [weak self] json in
        self?.sendEvent("onCommand", ["json": json])
      }
    }

    Function("sendState") { (json: String, urgent: Bool) in
      self.link?.send(json, urgent: urgent)
    }

    Function("isPaired") { () -> Bool in
      self.link?.paired ?? false
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

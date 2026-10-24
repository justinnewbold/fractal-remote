import ExpoModulesCore
import Foundation

/*
 * SIRI'S HAND-OFF, THE IPHONE'S END.
 *
 * The phrases themselves ("Scene 3 in Fractal Remote") are App Intents in the
 * iPhone app's own target, mobile/targets/watch/_shared/SiriShortcuts.swift,
 * because Apple reads App Intents only from the app. Each one does nothing but
 * call FractalSiriPipe.shared.ask(...) below and hand Siri the words that come
 * back. This module is the other half: it gives the command to the JavaScript
 * (mobile/src/lib/siriPipe.js) and takes the JavaScript's words for Siri. The
 * Swift decides nothing about the rig. Whether Play is on screen, the 1.5-second
 * tap rule, Tuner off's exemption, the range and duplicate checks, the demo and
 * every word Siri says are the JavaScript's, so an update can fix them.
 *
 * A module of its own, not more of FractalWatch: an `OnStartObserving` with no
 * event name runs when the first listener of ANY of a module's events is added
 * (ExpoModulesCore, EventObservingDefinition.swift), so a Siri listener on the
 * watch's module would mark the watch as listening while Play, which listens
 * for the watch, is not even mounted, and a wrist tap sent then would be lost
 * instead of held. And a separate name gives the JavaScript a plain check on
 * the binary: requireOptionalNativeModule('FractalSiri') is null on every
 * build made before this one.
 *
 * THE CONTRACT. siriPipe.js and test/siri-native.mjs hold the same words.
 *
 *   Module   "FractalSiri" (iOS only; null everywhere else).
 *
 *   Event    "onCommand", one per Siri command, with:
 *     id        String. This command's own id, to quote back in reply().
 *     at        Number. When the app received the command, in milliseconds
 *               since 1970 (the clock Date.now() reads): the moment Siri
 *               handed it to the app, after any question Siri asked first
 *               ("What tempo?"). The 1.5-second tap rule counts from here,
 *               never from when the event reached the JavaScript.
 *     command   String, one of:
 *                 scene     value: Int 1-8, the scene as spoken (1-based)
 *                 next      no value
 *                 previous  no value
 *                 tunerOn   no value
 *                 tunerOff  no value
 *                 tempo     value: Int 24-250, beats per minute (the Swift has
 *                           already asked again for anything outside that)
 *                 preset    value: Int 0 or more, the number Play prints in
 *                           front of a preset (12 for "012", or "012 D01" on
 *                           an AM4); not checked against the unit here
 *                 pedalOn   value: String, the kind of pedal:
 *                 pedalOff    delay drive reverb chorus flanger phaser
 *                             tremolo pitch wah compressor filter rotary
 *                             gate boost
 *     value     As above; absent when the command has none.
 *     answered  Bool. True when Siri has already been answered, with the
 *               Swift's own NOT_SENT, before the command reached the
 *               JavaScript (it waited for a listener past REPLY_SECONDS). A
 *               reply to it is ignored; act on it only where acting late is
 *               safe, which is Tuner off.
 *
 *   Queue    An event goes out only while the JavaScript has at least one
 *            "onCommand" listener. Until then each command is held, at most
 *            HOLD_MOST of them, the newest kept, and handed over in order
 *            when the first listener is added, if it is younger than
 *            HOLD_SECONDS by `at`. An older one is dropped without a word.
 *
 *   reply(id, words)
 *            The JavaScript's words for Siri, plain text, said or shown by
 *            Siri as they are: trimmed, cut at 300 characters, and ignored
 *            when empty. The first of reply() and the timeout wins; anything
 *            after that is ignored. Words naming the device in hand come from
 *            deviceNoun(), never "this phone".
 *
 *   Timeout  REPLY_SECONDS from `at`. With no reply by then Siri is told
 *            NOT_SENT by the Swift itself: a cold launch, the sign-in or the
 *            startup card can keep the JavaScript from listening that long. A
 *            command already handed over is not taken back when this fires,
 *            so the JavaScript replies before it acts late, or when it gives
 *            up.
 *
 * Siri always gets a dialog back. Whether it speaks one for a command that
 * brings the app to the front is Apple's choice, and is to be heard on the
 * TestFlight copy; the Play screen shows the result either way.
 */
public final class FractalSiriPipe: @unchecked Sendable {
  public static let shared = FractalSiriPipe()

  /* What Siri is told when the JavaScript has not answered in time. */
  public static let NOT_SENT = "Not sent."
  /* How long Siri waits for the JavaScript's words, counted from `at`. */
  static let REPLY_SECONDS: Double = 5
  /* How long, by `at`, a command waits for the JavaScript to start listening. */
  static let HOLD_SECONDS: Double = 15
  static let HOLD_MOST = 8

  private struct Held {
    let id: String
    let at: Date
    let body: [String: Any?]
  }

  /* All of it on the main queue. */
  private var owner: ObjectIdentifier?
  private var deliver: (([String: Any?]) -> Void)?
  private var listening = false
  private var held: [Held] = []
  private var waiting: [String: CheckedContinuation<String, Never>] = [:]

  private init() {}

  /*
   * One Siri command, from an App Intent's perform(): hands it on, or holds
   * it, and returns the words Siri is to say. Never throws, and returns within
   * REPLY_SECONDS.
   */
  public func ask(_ command: String, number: Int? = nil, word: String? = nil) async -> String {
    let id = UUID().uuidString
    let now = Date()
    return await withCheckedContinuation { (answer: CheckedContinuation<String, Never>) in
      DispatchQueue.main.async {
        var body: [String: Any?] = [
          "id": id,
          "at": (now.timeIntervalSince1970 * 1000).rounded(),
          "command": command
        ]
        if let number { body["value"] = number }
        if let word { body["value"] = word }
        self.waiting[id] = answer
        let wait = max(0, FractalSiriPipe.REPLY_SECONDS - Date().timeIntervalSince(now))
        DispatchQueue.main.asyncAfter(deadline: .now() + wait) { self.finish(id, nil) }
        let item = Held(id: id, at: now, body: body)
        if self.listening, self.deliver != nil {
          self.send(item)
        } else {
          self.held.append(item)
          if self.held.count > FractalSiriPipe.HOLD_MOST {
            self.held.removeFirst(self.held.count - FractalSiriPipe.HOLD_MOST)
          }
        }
      }
    }
  }

  /* The module that sends the events, as Expo makes it (again after a reload). */
  func attach(_ module: ObjectIdentifier, deliver: @escaping ([String: Any?]) -> Void) {
    DispatchQueue.main.async {
      self.owner = module
      self.deliver = deliver
      self.listening = false
    }
  }

  func detach(_ module: ObjectIdentifier) {
    DispatchQueue.main.async {
      guard self.owner == module else { return }
      self.owner = nil
      self.deliver = nil
      self.listening = false
    }
  }

  func listen(_ module: ObjectIdentifier, _ on: Bool) {
    DispatchQueue.main.async {
      guard self.owner == module else { return }
      self.listening = on
      if on { self.flush() }
    }
  }

  func reply(_ id: String, _ words: String) {
    let said = String(words.trimmingCharacters(in: .whitespacesAndNewlines).prefix(300))
    DispatchQueue.main.async {
      guard !said.isEmpty else { return }
      self.finish(id, said)
    }
  }

  /* On the main queue. */
  private func flush() {
    let fresh = held.filter { Date().timeIntervalSince($0.at) < FractalSiriPipe.HOLD_SECONDS }
    held = []
    for item in fresh { send(item) }
  }

  private func send(_ item: Held) {
    guard let deliver else { return }
    var body = item.body
    body["answered"] = waiting[item.id] == nil
    deliver(body)
  }

  private func finish(_ id: String, _ words: String?) {
    guard let answer = waiting.removeValue(forKey: id) else { return }
    answer.resume(returning: words ?? FractalSiriPipe.NOT_SENT)
  }
}

public class FractalSiriModule: Module {
  public func definition() -> ModuleDefinition {
    Name("FractalSiri")

    Events("onCommand")

    OnCreate {
      FractalSiriPipe.shared.attach(ObjectIdentifier(self)) { [weak self] body in
        self?.sendEvent("onCommand", body)
      }
    }

    OnDestroy {
      FractalSiriPipe.shared.detach(ObjectIdentifier(self))
    }

    OnStartObserving("onCommand") {
      FractalSiriPipe.shared.listen(ObjectIdentifier(self), true)
    }

    OnStopObserving("onCommand") {
      FractalSiriPipe.shared.listen(ObjectIdentifier(self), false)
    }

    Function("reply") { (id: String, words: String) in
      FractalSiriPipe.shared.reply(id, words)
    }
  }
}

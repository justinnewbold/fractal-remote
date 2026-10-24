import ExpoModulesCore
import UIKit

/*
 * THE FOLD SENSOR: WHAT AN IPHONE DUO TELLS THE APP ABOUT ITS HINGE AND FOLD.
 *
 * It reports, and nothing more. Nothing in the app draws from it yet: Play
 * measures itself and takes the fold to be the middle of its window. The
 * JavaScript end (mobile/src/lib/foldSensor.js) writes a line in the debug
 * log when the shape changes, so the logs from a real Duo show what it
 * reports before anything leans on it. Whatever leans on it later comes by
 * update, so the reading's shape is frozen now, in test/fold-native.mjs: this
 * Swift cannot change until the next build.
 *
 * APPLE'S NAMES, as Apple's own pages give them (developer.apple.com,
 * documentation/uikit, fetched 23 October 2026). All of them are iOS 27.1,
 * and only in an app built with the iOS 27.1 SDK:
 *
 *   UIHingeInteraction        "An interaction for observing the hinge state
 *                             associated with the view's hierarchy." A
 *                             @MainActor class and a UIInteraction, added to
 *                             a view with addInteraction(_:).
 *   init(updateHandler:)      (UIHingeInteraction, UIHingeInteraction.Update)
 *                             -> Void, "Called with the initial hinge state
 *                             and on each subsequent update", and when the
 *                             interaction moves between hierarchies.
 *   UIHingeInteraction.Update.hinge
 *                             UIHinge?, nil "when the interaction leaves a
 *                             hierarchy that provides hinge updates".
 *   UIHinge.angle             CGFloat, "The current angle of the hinge, in
 *                             radians." Its rate and granularity are
 *                             "system policy".
 *   UIHinge.status            UIHinge.Status: closed, partiallyOpen,
 *                             fullyOpen ("open as far as the device
 *                             allows"), unknown.
 *   UIView.reservedRegions(kind:options:)
 *                             [UIView.ReservedRegion], "with frames in the
 *                             view's coordinate space". "UIKit tracks the
 *                             regions you read in updateConstraints() and
 *                             runs it again when the regions change."
 *   UIView.ReservedRegion     frame (a CGRect, its margins already in it),
 *                             isActive, kind, margins.
 *   UIView.ReservedRegion.Kind
 *                             division, "A region that splits your view into
 *                             separate parts" (the fold), and occlusion, "A
 *                             region that covers part of your view" (the
 *                             cameras, the Dynamic Island).
 *   UIView.ReservedRegion.QueryOptions.includeInactive
 *                             inactive regions too, so the fold has a place
 *                             even with the phone flat.
 *   UITraitCollection.verticalBarEdge
 *                             a UIVerticalBarEdge, "The edge where the system
 *                             places the vertical bar": leading, trailing or
 *                             unspecified.
 *
 * And from long before: requiresConstraintBasedLayout, updateConstraints()
 * (which iOS 18 and later also track the traits read in: "Automatic trait
 * tracking"), setNeedsUpdateConstraints(), layoutSubviews(),
 * UIWindow.windowLevel (.normal) and UIScene.didActivateNotification.
 *
 * NOT ON APPLE'S PAGES: the version number in the canImport guard below,
 * 9127.0.85. It is the number Expo's own expo-hinge 58.0.0 uses for "iOS
 * 27.1 SDK", and no page of Apple's says which UIKit version that SDK
 * carries. So it is held from both sides. Too high, and the sensor is
 * compiled out of a 27.1 build without a word: compiledIn says false, and
 * duo.yml (Xcode 27.1) fails on false. Too low, and Xcode 26.6 is asked to
 * compile UIHingeInteraction, which it does not have, and watch.yml's iphone
 * job fails to build. Every use of the iOS 27.1 names is inside that guard
 * AND inside #available(iOS 27.1, *) or @available(iOS 27.1, *), so neither
 * one alone decides.
 *
 * THE CONTRACT. foldSensor.js and test/fold-native.mjs hold the same words.
 *
 *   Module     "FractalFold" (iPhone only; null on Android, in the browser
 *              and on every build made before this one).
 *   Constants  compiledIn  Bool. The iOS 27.1 code is in this build.
 *              available   Bool. compiledIn, and this is iOS 27.1 or later.
 *   now()      The latest reading, below. Empty when not available, and
 *              before the app has a window.
 *   Event      "onFold", the same reading, each time any of it changes, and
 *              only while the JavaScript listens; and once as it starts to
 *              listen, when there is a window, so the JavaScript may hear a
 *              reading it already has. Never sent when not available.
 *
 *   A reading:
 *     hinge            { status, angle } or null. status is UIHinge.Status
 *                      by name: closed, partiallyOpen, fullyOpen, unknown.
 *                      angle in whole degrees, 0 shut and 180 flat. Null on
 *                      a device with no hinge.
 *     fold             { x, y, width, height, active } or null. The division
 *                      region in the window's points, inactive ones
 *                      included, and the active one when there are two.
 *                      Taller than wide, the fold runs down the window
 *                      (opened like a book); wider than tall, across it
 *                      (like a laptop).
 *     occlusions       [{ x, y, width, height, active }], inactive included.
 *     window           { x, y, width, height } or null. The key window's own
 *                      bounds, measured here, because React Native's window
 *                      size under the scene life cycle has not been seen
 *                      right on a Duo.
 *     verticalBarEdge  leading, trailing or unspecified (UIVerticalBarEdge
 *                      by name), unknown for a case Apple adds later, or
 *                      null.
 *
 * WHEN IT IS READ. A see-through probe view, pinned to the key window by
 * Auto Layout constraints and asking for constraint-based layout, reads both
 * kinds of region in updateConstraints(), where UIKit tracks them, and again
 * on every hinge update and every change of its size, and once more half a
 * second after the hinge goes still: early testers found the fold region
 * stale just after unfolding, with the hinge itself right. The probe takes
 * no touches and VoiceOver does not see it. It goes into the key window when
 * the module starts, and again whenever a scene activates, a window becomes
 * key or the app comes back, because the window may not exist yet when the
 * module is made, and a scene that reconnects replaces it. Only the app's own
 * window, at the normal level: an alert's window, made key while it shows,
 * never takes the probe. A new probe starts from the hinge the last one read.
 *
 * DUO.YML'S CHECK. Launched with -FractalFoldCheck, and only then, the
 * module writes lines beginning "FractalFold check:" to the app's standard
 * error and to the system log: compiledIn and available as it starts, then
 * each reading. duo.yml launches it so, with simctl's --stderr, and fails
 * when compiledIn is not true. Nothing is written on anybody's phone.
 *
 * Nothing else: no permission, no Info.plist key, no entitlement. The hinge,
 * the fold and the window are layout, and need none.
 */

/* A rectangle in the window's points, to a tenth: enough to place a line, and no event for a rounding wobble. */
struct FoldBox: Equatable {
  let x: Double
  let y: Double
  let width: Double
  let height: Double

  init(_ rect: CGRect) {
    x = FoldBox.points(rect.origin.x)
    y = FoldBox.points(rect.origin.y)
    width = FoldBox.points(rect.size.width)
    height = FoldBox.points(rect.size.height)
  }

  static func points(_ value: CGFloat) -> Double {
    return (Double(value) * 10).rounded() / 10
  }

  var body: [String: Any] {
    return ["x": x, "y": y, "width": width, "height": height]
  }
}

/* A reserved region: where it is, and whether it is in force now. */
struct FoldRegion: Equatable {
  let box: FoldBox
  let active: Bool

  var body: [String: Any] {
    var out = box.body
    out["active"] = active
    return out
  }
}

struct FoldHinge: Equatable {
  let status: String
  let angle: Double

  var body: [String: Any] {
    return ["status": status, "angle": angle]
  }
}

/* One reading, as the JavaScript gets it. Plain values, no UIKit types, so it compiles on every SDK. */
struct FoldReading: Equatable {
  var hinge: FoldHinge?
  var fold: FoldRegion?
  var occlusions: [FoldRegion]
  var window: FoldBox?
  var verticalBarEdge: String?

  static let empty = FoldReading(hinge: nil, fold: nil, occlusions: [], window: nil, verticalBarEdge: nil)

  var body: [String: Any] {
    return [
      "hinge": FoldReading.orNull(hinge?.body),
      "fold": FoldReading.orNull(fold?.body),
      "occlusions": occlusions.map { $0.body },
      "window": FoldReading.orNull(window?.body),
      "verticalBarEdge": FoldReading.orNull(verticalBarEdge)
    ]
  }

  /* JavaScript's null, for a value there is none of. */
  private static func orNull(_ value: Any?) -> Any {
    return value ?? NSNull()
  }
}

/*
 * The reading kept for now(), which JavaScript calls on its own thread, and
 * the probe that makes it, which lives on the main queue. Not tied to the
 * main actor itself: like FractalSiriPipe, it is reached from both.
 */
final class FoldSensor: @unchecked Sendable {
  /* Whether the iOS 27.1 code is in this build. duo.yml fails on false. */
  static let compiledIn: Bool = {
    #if canImport(UIKit, _version: 9127.0.85) // iOS 27.1 SDK
    return true
    #else
    return false
    #endif
  }()

  /* And whether it can run here. */
  static var available: Bool {
    #if canImport(UIKit, _version: 9127.0.85) // iOS 27.1 SDK
    if #available(iOS 27.1, *) {
      return true
    }
    #endif
    return false
  }

  /* duo.yml's launch argument, and the start of every line it reads. */
  static let CHECK_ARGUMENT = "-FractalFoldCheck"
  static let CHECK_PREFIX = "FractalFold check:"

  var onChange: (([String: Any]) -> Void)?

  private let lock = NSLock()
  private var latest = FoldReading.empty
  private var listening = false
  private let checking = ProcessInfo.processInfo.arguments.contains(FoldSensor.CHECK_ARGUMENT)
  /* On the main queue. A UIView, because FoldProbe exists only on iOS 27.1. */
  private var probe: UIView?
  private var tokens: [NSObjectProtocol] = []

  deinit {
    for token in tokens {
      NotificationCenter.default.removeObserver(token)
    }
  }

  func now() -> [String: Any] {
    lock.lock()
    defer { lock.unlock() }
    return latest.body
  }

  func listen(_ on: Bool) {
    lock.lock()
    listening = on
    lock.unlock()
  }

  /*
   * The latest reading sent once more, as the JavaScript starts to listen.
   * Its listener is in place before the module hears of it (startObserving
   * runs later, on Expo's queue for async calls), so a reading taken between
   * the JavaScript's now() and listen(true) was kept and never sent. On the
   * main queue, where every reading is taken, so it lands in order with them.
   * A repeat is nothing: the JavaScript writes a shape once.
   */
  @MainActor
  func resend() {
    lock.lock()
    let reading = latest
    let tell = listening && reading.window != nil ? onChange : nil
    lock.unlock()
    tell?(reading.body)
  }

  /* The hinge last read, for a new probe to start from. */
  private func lastHinge() -> FoldHinge? {
    lock.lock()
    defer { lock.unlock() }
    return latest.hinge
  }

  /* The first of duo.yml's lines, as the module starts. */
  func selfCheck() {
    let os = ProcessInfo.processInfo.operatingSystemVersion
    report("compiledIn=\(FoldSensor.compiledIn) available=\(FoldSensor.available) ios=\(os.majorVersion).\(os.minorVersion).\(os.patchVersion)")
  }

  /*
   * Into the app's own key window, unless the probe is in it already. Only a
   * window at the normal level: every React Native alert is a window of its
   * own, raised over the app's and made key while it shows, and the probe
   * stays where it is rather than following it there and back.
   */
  @MainActor
  func attach() {
    #if canImport(UIKit, _version: 9127.0.85) // iOS 27.1 SDK
    guard #available(iOS 27.1, *) else {
      return
    }
    watchWindows()
    guard let window = SceneGeometry.keyWindow(), window.windowLevel == .normal else {
      return
    }
    if let current = self.probe, current.window === window {
      return
    }
    detach()
    let fresh = FoldProbe(frame: window.bounds)
    fresh.seed(lastHinge())
    fresh.onReading = { [weak self] reading in
      self?.take(reading)
    }
    window.addSubview(fresh)
    NSLayoutConstraint.activate([
      fresh.leadingAnchor.constraint(equalTo: window.leadingAnchor),
      fresh.trailingAnchor.constraint(equalTo: window.trailingAnchor),
      fresh.topAnchor.constraint(equalTo: window.topAnchor),
      fresh.bottomAnchor.constraint(equalTo: window.bottomAnchor)
    ])
    self.probe = fresh
    fresh.setNeedsUpdateConstraints()
    #endif
  }

  /* The last reading stays: a probe moving to a new window is not a fold. */
  @MainActor
  func detach() {
    #if canImport(UIKit, _version: 9127.0.85) // iOS 27.1 SDK
    if #available(iOS 27.1, *), let shown = self.probe as? FoldProbe {
      shown.onReading = nil
    }
    #endif
    self.probe?.removeFromSuperview()
    self.probe = nil
  }

  /* Once: a scene that activates, or a window made key, may be a window the probe is not in yet. */
  @MainActor
  private func watchWindows() {
    guard tokens.isEmpty else { return }
    for name in [UIScene.didActivateNotification, UIWindow.didBecomeKeyNotification] {
      let token = NotificationCenter.default.addObserver(forName: name, object: nil, queue: .main) { [weak self] _ in
        guard let self else { return }
        Task { @MainActor in self.attach() }
      }
      tokens.append(token)
    }
  }

  /* From the probe, on the main queue: kept, and sent on when it changed. */
  private func take(_ reading: FoldReading) {
    lock.lock()
    let changed = reading != latest
    latest = reading
    let tell = changed && listening ? onChange : nil
    lock.unlock()
    guard changed else { return }
    if checking {
      report("reading \(FoldSensor.json(reading.body))")
    }
    tell?(reading.body)
  }

  private func report(_ line: String) {
    guard checking else { return }
    let text = "\(FoldSensor.CHECK_PREFIX) \(line)"
    try? FileHandle.standardError.write(contentsOf: Data((text + "\n").utf8))
    NSLog("%@", text)
  }

  private static func json(_ body: [String: Any]) -> String {
    guard let data = try? JSONSerialization.data(withJSONObject: body, options: [.sortedKeys]) else {
      return "{}"
    }
    return String(data: data, encoding: .utf8) ?? "{}"
  }
}

#if canImport(UIKit, _version: 9127.0.85) // iOS 27.1 SDK
/*
 * The probe: see-through, no touches, nothing for VoiceOver, the key
 * window's own size by constraints. It reads the reserved regions where
 * UIKit tracks them and wherever else the fold may have moved.
 */
@available(iOS 27.1, *)
final class FoldProbe: UIView {
  /* How long the hinge stays still before the regions are read once more. */
  static let SETTLE_NANOSECONDS: UInt64 = 500_000_000

  var onReading: ((FoldReading) -> Void)?
  private var hinge: FoldHinge?
  private var hingeInteraction: UIHingeInteraction?
  private var seenBounds = CGRect.null
  private var settle: Task<Void, Never>?

  /* Constraint-based, so that UIKit calls updateConstraints() on it, where the regions it reads are tracked. */
  override class var requiresConstraintBasedLayout: Bool {
    return true
  }

  override init(frame: CGRect) {
    super.init(frame: frame)
    translatesAutoresizingMaskIntoConstraints = false
    isUserInteractionEnabled = false
    isOpaque = false
    backgroundColor = .clear
    isAccessibilityElement = false
    accessibilityElementsHidden = true
    let interaction = UIHingeInteraction { [weak self] _, update in
      self?.hingeMoved(update.hinge)
    }
    addInteraction(interaction)
    hingeInteraction = interaction
  }

  required init?(coder: NSCoder) {
    fatalError("init(coder:) has not been implemented")
  }

  /*
   * Before it goes into a window: the hinge the last probe read, kept until
   * this one's own handler says, so a probe moving to a new window never
   * reads "no hinge" on a Duo. Apple does not say that the handler runs
   * before didMoveToWindow().
   */
  func seed(_ last: FoldHinge?) {
    if hinge == nil {
      hinge = last
    }
  }

  override func didMoveToWindow() {
    super.didMoveToWindow()
    setNeedsUpdateConstraints()
    readNow()
  }

  /* Where UIKit tracks the regions read, and runs this again when they change. It changes no constraint. */
  override func updateConstraints() {
    readNow()
    super.updateConstraints()
  }

  /* Every change of size: the probe is the window's size, so this is the window's. */
  override func layoutSubviews() {
    super.layoutSubviews()
    guard bounds != seenBounds else { return }
    seenBounds = bounds
    setNeedsUpdateConstraints()
    readNow()
  }

  /* Every hinge update: the hinge, and the regions read again with it. */
  private func hingeMoved(_ update: UIHinge?) {
    hinge = update.map { FoldProbe.hingeOf($0) }
    setNeedsUpdateConstraints()
    readNow()
    settleLater()
  }

  /* Once more when the hinge has been still a moment: the fold region was seen stale just after unfolding. */
  private func settleLater() {
    settle?.cancel()
    settle = Task { @MainActor [weak self] in
      try? await Task.sleep(nanoseconds: FoldProbe.SETTLE_NANOSECONDS)
      guard !Task.isCancelled, let self else { return }
      self.setNeedsUpdateConstraints()
      self.readNow()
    }
  }

  private func readNow() {
    guard let send = onReading, let shownIn = window else { return }
    send(read(shownIn))
  }

  private func read(_ window: UIWindow) -> FoldReading {
    let divisions = reservedRegions(kind: .division, options: .includeInactive)
    let occlusions = reservedRegions(kind: .occlusion, options: .includeInactive)
    let fold = divisions.first(where: { $0.isActive }) ?? divisions.first
    return FoldReading(
      hinge: hinge,
      fold: fold.map { FoldRegion(box: FoldBox($0.frame), active: $0.isActive) },
      occlusions: occlusions.map { FoldRegion(box: FoldBox($0.frame), active: $0.isActive) },
      window: FoldBox(window.bounds),
      verticalBarEdge: FoldProbe.edgeOf(traitCollection.verticalBarEdge)
    )
  }

  /* UIHinge.angle is in radians; the JavaScript gets whole degrees. */
  static func hingeOf(_ hinge: UIHinge) -> FoldHinge {
    let status: String
    switch hinge.status {
    case .closed: status = "closed"
    case .partiallyOpen: status = "partiallyOpen"
    case .fullyOpen: status = "fullyOpen"
    case .unknown: status = "unknown"
    @unknown default: status = "unknown"
    }
    return FoldHinge(status: status, angle: (Double(hinge.angle) * 180 / .pi).rounded())
  }

  static func edgeOf(_ edge: UIVerticalBarEdge) -> String {
    switch edge {
    case .leading: return "leading"
    case .trailing: return "trailing"
    case .unspecified: return "unspecified"
    @unknown default: return "unknown"
    }
  }
}
#endif

public class FractalFoldModule: Module {
  private let sensor = FoldSensor()

  public func definition() -> ModuleDefinition {
    Name("FractalFold")

    /* The iOS 27.1 code is in this build. False on a build made without the iOS 27.1 SDK. */
    Constant("compiledIn") {
      FoldSensor.compiledIn
    }

    /* And this is iOS 27.1 or later, so it runs. */
    Constant("available") {
      FoldSensor.available
    }

    Events("onFold")

    OnCreate {
      self.sensor.onChange = { [weak self] body in
        self?.sendEvent("onFold", body.mapValues { Optional($0) })
      }
      self.sensor.selfCheck()
      self.attachSoon()
    }

    /* The key window may not exist yet when the module is made, and a scene that reconnects replaces it. */
    OnAppBecomesActive {
      self.attachSoon()
    }

    OnDestroy {
      let sensor = self.sensor
      Task { @MainActor in sensor.detach() }
    }

    /* Listening first, then on the main queue the latest reading once more, for one taken before it. */
    OnStartObserving("onFold") {
      self.sensor.listen(true)
      let sensor = self.sensor
      Task { @MainActor in
        sensor.attach()
        sensor.resend()
      }
    }

    OnStopObserving("onFold") {
      self.sensor.listen(false)
    }

    Function("now") { () -> [String: Any] in
      self.sensor.now()
    }
  }

  /* Onto the main queue, where the probe lives. */
  private func attachSoon() {
    let sensor = self.sensor
    Task { @MainActor in sensor.attach() }
  }
}

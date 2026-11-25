import CoreBluetooth
import CoreMIDI
import ExpoModulesCore
import UIKit
#if !targetEnvironment(simulator)
import CoreAudioKit
#endif

/*
 * THE PHONE'S END OF A BLUETOOTH MIDI ADAPTER.
 *
 * With an adapter (a CME WIDI, a Yamaha MD-BT01) on the unit's MIDI In and
 * Out, the phone can reach an FM3, FM9 or Axe-Fx III with no computer at all.
 * This file only carries bytes. Every frame, checksum and answer is worked out
 * in the JavaScript (src/lib/fractal-sysex.mjs and bleWire.js), so one tested
 * copy of the protocol serves both phones.
 *
 * What the JavaScript gets, under the same names on Android:
 *
 *   supported()          — false in the simulator, which has no Bluetooth.
 *   requestPermissions() — always true here: iOS asks by itself, the first
 *                          time Apple's Bluetooth screen opens.
 *   authorization()      — iPhone only: whether iOS lets Fractal Remote use
 *                          Bluetooth, in Apple's own words: 'notDetermined'
 *                          (not asked yet), 'restricted', 'denied' or
 *                          'allowedAlways'. So the page can say "not allowed"
 *                          instead of opening Apple's screen with nothing in
 *                          it. Build 25 does not have it, which is why the
 *                          JavaScript asks only if it is there.
 *   pair()               — Apple's own Bluetooth MIDI screen, the one
 *                          GarageBand uses. An app cannot find or pair an
 *                          adapter any other way on iOS; once it is connected
 *                          there, it turns up in CoreMIDI like any other port.
 *   pairsOnIOS27()       — iPhone only: true, this build opens Apple's
 *                          screen on iOS 27 without crashing (see pair). A
 *                          build without it crashes there, so the JavaScript
 *                          keeps the screen shut on iOS 27 when the answer is
 *                          missing.
 *   scan(seconds)        — nothing to scan for (Apple's screen does that); it
 *                          only says whether any port is listed.
 *   devices()            — every two-way MIDI port: an id made of its two
 *                          unique ids, "<destination>:<source>", its name,
 *                          whether it is offline, and (iPhone only) the name
 *                          of the driver that owns it, so the page can show
 *                          which one Apple's Bluetooth MIDI driver is.
 *   connect(id), disconnect()
 *   send(bytes)          — one whole SysEx frame, or short messages.
 *   onBytes { bytes }    — what came in, as plain MIDI 1.0 bytes.
 *   onDevices { devices }— the list again, whenever CoreMIDI's setup changes.
 *   onState { state, id, name, reason? }
 *                        — 'connected' after connect; 'disconnected' when the
 *                          adapter goes offline or away.
 *
 * NOTHING HAPPENS UNTIL IT IS ASKED FOR. A phone that never opens the
 * Bluetooth page gets no MIDI client and no ports. The client is made the
 * first time pair, devices, scan, connect or send needs it (ensure), never
 * when the module loads.
 *
 * NO REASSEMBLY HERE. A long SysEx reply can arrive in several pieces. They
 * are passed on as they come, and the JavaScript joiner (createJoiner) puts
 * the frames back together. That is the same code on both phones, and it can
 * be tested in Node; a second copy in Swift could not.
 */
public class FractalBleMidiModule: Module {
  /* Touched from the JavaScript thread, the module's queue and the main
     queue, so these are only read or written while holding `lock`. */
  private let lock = NSLock()
  private var client = MIDIClientRef()
  private var inPort = MIDIPortRef()
  private var outPort = MIDIPortRef()
  private var dest = MIDIEndpointRef()
  private var source = MIDIEndpointRef()
  private var linkId: String?
  private var linkName: String?

  /* Main queue only. */
  private var refreshLater: DispatchWorkItem?
  private var pairPromise: Promise?
  private var pairSheetGone: SheetGone?
  private var lastLogged = ""
  /* The adapter kept connected without Apple's screen (Rejoiner, below). */
  private var rejoiner: Rejoiner?

  /* CoreMIDI reports one change several times over; wait this long for it to finish. */
  private static let SETTLE_SECONDS: Double = 0.3

  /* How many 32-bit words each kind of Universal MIDI Packet takes, indexed by its top four bits. */
  private static let UMP_WORDS = [1, 1, 1, 2, 2, 4, 1, 1, 2, 2, 2, 3, 3, 4, 4, 4]

  public func definition() -> ModuleDefinition {
    Name("FractalBleMidi")

    Events("onBytes", "onDevices", "onState", "onRejoin")

    OnDestroy {
      self.teardown()
    }

    Function("supported") { () -> Bool in
      #if targetEnvironment(simulator)
      return false
      #else
      return true
      #endif
    }

    AsyncFunction("requestPermissions") { () -> Bool in
      true
    }

    /* CBManager's class property (iOS 13.1 and later; this module needs
       16.4): read without making a Bluetooth manager, so reading it never
       brings up iOS's question. Anything Apple adds later counts as not
       asked yet, which leaves the JavaScript doing what it always did. */
    Function("authorization") { () -> String in
      switch CBManager.authorization {
      case .allowedAlways:
        return "allowedAlways"
      case .denied:
        return "denied"
      case .restricted:
        return "restricted"
      case .notDetermined:
        return "notDetermined"
      @unknown default:
        return "notDetermined"
      }
    }

    /* Asked before pair on iOS 27: builds before this one have no such
       function, and their pair() crashes there. */
    Function("pairsOnIOS27") { () -> Bool in
      true
    }

    /* Whether Apple's screen is shown under a bar of the app's own, with a
       Done button nothing of Apple's can take off it (PairingHost). Builds
       before this one have no such function: on iOS 27 their Done is gone. */
    Function("pairHasDone") { () -> Bool in
      true
    }

    /* UIKit, so the main queue. */
    AsyncFunction("pair") { (promise: Promise) in
      self.pair(promise)
    }.runOnQueue(.main)

    /* Apple's screen does the looking on iOS; this only says whether
       anything is listed, so the page reads the same on both phones. */
    AsyncFunction("scan") { (seconds: Int) -> Bool in
      !self.listDevices().isEmpty
    }

    /* Nothing to stop: nothing here ever scans. */
    Function("stopScan") {}

    Function("devices") { () -> [[String: Any]] in
      self.listDevices()
    }

    AsyncFunction("connect") { (id: String) -> Bool in
      self.connect(id)
    }

    Function("disconnect") {
      self.disconnect()
    }

    Function("send") { (bytes: [Int]) -> Bool in
      self.send(bytes)
    }

    /* Whether this build connects a known adapter by itself (Rejoiner).
       Builds before this one have no such function, and the JavaScript
       asks only if it is there. */
    Function("rejoins") { () -> Bool in
      #if targetEnvironment(simulator)
      return false
      #else
      return true
      #endif
    }

    /* Keep the adapter of this name connected to the iPhone, from now until
       stopRejoin: found and connected with no screen, and connected again
       whenever it comes back. Asked only once Bluetooth is on in the app
       for an adapter the player chose, since it is what makes iOS ask for
       Bluetooth where it has not yet. */
    AsyncFunction("rejoin") { (name: String) -> Bool in
      self.rejoin(name)
    }.runOnQueue(.main)

    AsyncFunction("stopRejoin") { () -> Bool in
      self.rejoiner?.stop()
      self.rejoiner = nil
      return true
    }.runOnQueue(.main)

    /* Whether this build can make its view of MIDI afresh (renew, below). */
    Function("renews") { () -> Bool in
      true
    }

    /* THE APP'S VIEW OF MIDI, MADE AFRESH, WITHOUT CLOSING THE APP. A copy
       of the app that had been open (mostly in the background) since the day
       before listed no adapter through six trips to Apple's screen, and
       listed it at once, already connected, when it was closed and opened
       again (Justin's iPhone, 19 and 22 November 2026). So what had gone
       stale was this process's own hold on CoreMIDI. The first step is a
       new client and ports; `hard` also asks CoreMIDI to restart its
       drivers and look again (MIDIRestart). Which of the two brings a port
       back is NOT KNOWN: the answer says what each did, for the log.
       Asked only when Apple's screen has closed with nothing listed. */
    AsyncFunction("renew") { (hard: Bool) -> String in
      self.renew(hard)
    }.runOnQueue(.main)
  }

  // MARK: - The client, made on first use

  /* The MIDI client and its two ports, made the first time something needs
     them and kept from then on. Apple advises against ever disposing of an
     app's last client (MIDIServices.h, MIDIClientDispose), so it is not. */
  @discardableResult
  private func ensure() -> Bool {
    lock.lock()
    defer { lock.unlock() }
    if client == 0 {
      var made = MIDIClientRef()
      let status = MIDIClientCreateWithBlock("Fractal Remote" as CFString, &made) { [weak self] _ in
        self?.setupChanged()
      }
      guard Self.ok(status) else { return false }
      client = made
    }
    if inPort == 0 {
      var made = MIDIPortRef()
      /* MIDI 1.0 protocol: CoreMIDI then hands us MIDI 1.0 messages wrapped in
         Universal MIDI Packets, which received() unwraps. */
      let status = MIDIInputPortCreateWithProtocol(client, "Fractal Remote in" as CFString, ._1_0, &made) { [weak self] list, _ in
        self?.received(list)
      }
      guard Self.ok(status) else { return false }
      inPort = made
    }
    if outPort == 0 {
      var made = MIDIPortRef()
      guard Self.ok(MIDIOutputPortCreate(client, "Fractal Remote out" as CFString, &made)) else { return false }
      outPort = made
    }
    return true
  }

  /* Main queue. One adapter at a time: asked for another, the last one is
     let go of. Asked for the one already kept, nothing changes. */
  private func rejoin(_ name: String) -> Bool {
    let wanted = Rejoiner.plain(name)
    if wanted.isEmpty { return false }
    if let now = rejoiner, now.wanted == wanted {
      now.look()
      return true
    }
    rejoiner?.stop()
    let next = Rejoiner(
      wanted: wanted,
      said: { [weak self] what in
        NSLog("FractalBleMidi rejoin: %@", what)
        self?.sendEvent("onRejoin", ["said": what])
      },
      changed: { [weak self] in
        /* CoreMIDI says so itself when the port turns up; this is for the
           case where it was there already and only came back online. */
        self?.refreshSoon()
      }
    )
    rejoiner = next
    next.start()
    return true
  }

  /* The app is reloading or closing: let go of the adapter and the ports.
     The client is kept, as above. */
  private func teardown() {
    DispatchQueue.main.async { [rejoiner] in
      rejoiner?.stop()
    }
    rejoiner = nil
    disconnect()
    lock.lock()
    let ports = [inPort, outPort]
    inPort = 0
    outPort = 0
    lock.unlock()
    for port in ports where port != 0 {
      MIDIPortDispose(port)
    }
  }

  /* Main queue. The old client is let go of and never disposed of (Apple
     advises against disposing of an app's last client); its block holds
     this module weakly and only asks for the list again. */
  private func renew(_ hard: Bool) -> String {
    disconnect()
    lock.lock()
    let ports = [inPort, outPort]
    inPort = 0
    outPort = 0
    client = 0
    lock.unlock()
    for port in ports where port != 0 {
      MIDIPortDispose(port)
    }
    var said = "a new client"
    if hard {
      said += ", MIDIRestart \(MIDIRestart())"
    }
    let made = ensure()
    refreshSoon()
    return "\(said), \(made ? "made" : "NOT made"), \(MIDIGetNumberOfDestinations()) ports"
  }

  // MARK: - Pairing

  /* On the main queue. Apple's screen lists the Bluetooth MIDI adapters in
     range and connects the one tapped. It has no Done button of its own, and
     it takes the buttons of its own bar back whenever it likes: a Done put on
     the right is pushed out by its "searching" spinner (AudioKit puts its
     Done back after every layout for that reason), and on iOS 27 a Done put
     on the left is gone by the time the screen is up, with Apple's Edit the
     only button there ("All it says now is edit, which is confusing to
     people", Justin, 14 November 2026, iOS 27.2.1). So Apple's screen is
     shown INSIDE a screen of the app's own (PairingHost), whose bar is not
     Apple's own navigation item, which is the one its code rewrites: Done on
     the right, always. Swiping the sheet down is a way out too. However the
     sheet goes, the promise settles, once. */
  private func pair(_ promise: Promise) {
    #if targetEnvironment(simulator)
    promise.reject("E_SIMULATOR", "Bluetooth MIDI needs a real iPhone or iPad: the simulator has no Bluetooth.")
    #else
    if pairPromise != nil {
      promise.reject("E_BUSY", "Apple's Bluetooth screen is already open.")
      return
    }
    guard let top = appContext?.utilities?.currentViewController() else {
      promise.reject("E_NO_SCREEN", "There is no screen to show Apple's Bluetooth page over.")
      return
    }
    /* Made now so the adapter's arrival is heard while the screen is up. */
    ensure()
    let central = CABTMIDICentralViewController()
    /*
     * iOS 27 BROKE APPLE'S OWN SCREEN, IN EVERY APP. Its loadView sizes the
     * list from the status bar's height, which iOS 27 no longer answers
     * ("-[UIApplication statusBarHeightForOrientation:] API has been
     * deprecated and is a no-op on 27.0 and later"), and makes a table NaN
     * points tall: CALayerInvalidGeometry, "CALayer bounds contains NaN",
     * and the app gone the moment Connect is tapped (TestFlight 1.88.0 (28),
     * iOS 27.0.1, 24 October 2026). However it is presented: a sheet, full
     * screen, SwiftUI or UIKit. Apple's own workaround, tested by Apple with
     * a Bluetooth LE MIDI adapter and shipped by others since
     * (developer.apple.com/forums/thread/850584, FB25301268): hand it a table
     * first, so loadView never runs, then run viewDidLoad once by hand,
     * which is what starts the search. A table alone opened the screen and
     * never found anything. The host takes it after that, with its view
     * already there, so the host never makes loadView run either.
     */
    if #available(iOS 27, *) {
      central.tableView = UITableView(frame: .zero, style: .grouped)
      central.viewDidLoad()
    }
    let host = PairingHost(central)
    let sheet = UINavigationController(rootViewController: host)
    sheet.modalPresentationStyle = .formSheet
    host.close = { [weak self, weak sheet] in
      sheet?.dismiss(animated: true) {
        self?.pairingDone()
      }
    }
    /* And however else the sheet goes (PairingHost.gone): pairingDone shrugs off a second call. */
    host.gone = { [weak self] in
      self?.pairingDone()
    }
    /* The sheet only holds its delegate weakly, so it is kept here until
       pairingDone lets it go. */
    let gone = SheetGone { [weak self] in
      self?.pairingDone()
    }
    sheet.presentationController?.delegate = gone
    pairSheetGone = gone
    pairPromise = promise
    top.present(sheet, animated: true)
    #endif
  }

  /* Main queue: Apple's screen has gone, by Done or by a swipe. A second tap
     on Done finds nothing left to settle. The list goes out again, because
     what the screen just connected is usually the reason it was opened. */
  private func pairingDone() {
    pairSheetGone = nil
    guard let promise = pairPromise else { return }
    pairPromise = nil
    refreshSoon()
    promise.resolve()
  }

  // MARK: - The list of ports

  /* Every destination that has a source on the same entity: something the
     phone can both talk to and hear from. A Bluetooth adapter is one entity
     with one of each. A port with no way back cannot answer, and a virtual
     port (another app's) has no entity, so neither is listed. */
  private func listDevices() -> [[String: Any]] {
    guard ensure() else { return [] }
    var list: [[String: Any]] = []
    for i in 0..<MIDIGetNumberOfDestinations() {
      let d = MIDIGetDestination(i)
      guard let s = Self.partner(of: d) else { continue }
      list.append([
        "id": "\(Self.uid(d)):\(Self.uid(s))",
        "name": Self.name(d),
        "offline": Self.offline(d),
        "driver": Self.text(d, kMIDIPropertyDriverOwner),
      ])
    }
    return list
  }

  /* Any thread, from CoreMIDI: a port appeared, went away, went offline or was
     renamed. One change arrives as several of these, so the work waits for
     the burst to finish and then runs once, on the main queue. */
  private func setupChanged() {
    DispatchQueue.main.async { [weak self] in
      self?.refreshSoon()
    }
  }

  /* Main queue only. */
  private func refreshSoon() {
    refreshLater?.cancel()
    let later = DispatchWorkItem { [weak self] in
      self?.refresh()
    }
    refreshLater = later
    DispatchQueue.main.asyncAfter(deadline: .now() + Self.SETTLE_SECONDS, execute: later)
  }

  /* Main queue only. */
  private func refresh() {
    refreshLater = nil
    logPorts()
    sendEvent("onDevices", ["devices": listDevices()])
    checkLink()
  }

  /* The name of Apple's Bluetooth MIDI driver is not written down anywhere
     reliable, so nothing here matches on it. Instead each two-way port carries
     its driver in devices(), where the page can show it, and every port,
     one-way and virtual ones included, goes to the device log with its driver
     whenever the list changes, so a capture from a real adapter can settle it.

     NSLog, not Expo's log.info: that one ends up in os.Logger at the info
     level with the text marked private, so a TestFlight or App Store build
     would log "<private>", and only while Console was showing info messages.
     NSLog writes at the default level, kept on the phone, in plain text. */
  private func logPorts() {
    var lines: [String] = []
    for i in 0..<MIDIGetNumberOfDestinations() {
      let d = MIDIGetDestination(i)
      let back = Self.partner(of: d).map { String(Self.uid($0)) } ?? "none"
      lines.append("\(Self.name(d)) [uid \(Self.uid(d)), source \(back), driver '\(Self.text(d, kMIDIPropertyDriverOwner))', offline \(Self.offline(d))]")
    }
    let all = lines.joined(separator: "; ")
    if all == lastLogged { return }
    lastLogged = all
    NSLog("FractalBleMidi ports: %@", all)
  }

  // MARK: - Connecting

  /* The adapter is found again by its two unique ids, which CoreMIDI keeps
     for an object for as long as it knows it. An offline port is refused: the
     link would read as connected with nothing on the other end. */
  private func connect(_ id: String) -> Bool {
    guard ensure(),
          let ids = Self.parse(id),
          let d = Self.find(ids.dest, .destination),
          let s = Self.find(ids.source, .source),
          !Self.offline(d) else { return false }
    lock.lock()
    let port = inPort
    let previous = source
    dest = 0
    source = 0
    linkId = nil
    linkName = nil
    lock.unlock()
    if previous != 0 {
      MIDIPortDisconnectSource(port, previous)
    }
    guard Self.ok(MIDIPortConnectSource(port, s, nil)) else { return false }
    let name = Self.name(d)
    lock.lock()
    dest = d
    source = s
    linkId = id
    linkName = name
    lock.unlock()
    sendEvent("onState", ["state": "connected", "id": id, "name": name])
    return true
  }

  /* The JavaScript asked for this, so no 'disconnected' is sent: that event
     means the adapter went, and the JavaScript would start reconnecting. */
  private func disconnect() {
    lock.lock()
    let port = inPort
    let s = source
    dest = 0
    source = 0
    linkId = nil
    linkName = nil
    lock.unlock()
    if s != 0 {
      MIDIPortDisconnectSource(port, s)
    }
  }

  /* Main queue, after a setup change: is our adapter still there and online?
     Looked up again by its ids, because a port that has gone away leaves a
     reference that no longer answers. */
  private func checkLink() {
    lock.lock()
    let id = linkId
    let name = linkName ?? ""
    lock.unlock()
    guard let id, let ids = Self.parse(id) else { return }
    let reason: String
    if let d = Self.find(ids.dest, .destination), Self.find(ids.source, .source) != nil {
      if !Self.offline(d) { return }
      reason = "offline"
    } else {
      reason = "removed"
    }
    lock.lock()
    let still = linkId == id
    lock.unlock()
    guard still else { return }
    disconnect()
    sendEvent("onState", ["state": "disconnected", "id": id, "name": name, "reason": reason])
  }

  // MARK: - Sending

  private func send(_ bytes: [Int]) -> Bool {
    lock.lock()
    let port = outPort
    let d = dest
    lock.unlock()
    guard port != 0, d != 0, !bytes.isEmpty, bytes.allSatisfy({ (0...0xFF).contains($0) }) else { return false }
    return bytes[0] == 0xF0 ? sendSysex(bytes, to: d) : sendShort(bytes, port: port, to: d)
  }

  /* MIDISendSysex works in the background and moves the request's `data`
     along as it sends, so the request and the bytes both have to outlive this
     call. They are made by hand here and freed by the completion. The bytes'
     start is kept in completionRefCon, because by the time the completion runs
     `data` points at their end.

     The JavaScript wire sends one frame and waits for its answer, so two of
     these are never in flight together. */
  private func sendSysex(_ bytes: [Int], to destination: MIDIEndpointRef) -> Bool {
    guard bytes.count >= 2, bytes.last == 0xF7 else { return false }
    let data = UnsafeMutablePointer<UInt8>.allocate(capacity: bytes.count)
    for (i, b) in bytes.enumerated() {
      (data + i).initialize(to: UInt8(b))
    }
    let request = UnsafeMutablePointer<MIDISysexSendRequest>.allocate(capacity: 1)
    request.initialize(to: MIDISysexSendRequest(
      destination: destination,
      data: UnsafePointer(data),
      bytesToSend: UInt32(bytes.count),
      complete: false,
      reserved: (0, 0, 0),
      completionProc: { finished in
        finished.pointee.completionRefCon?.assumingMemoryBound(to: UInt8.self).deallocate()
        finished.deinitialize(count: 1)
        finished.deallocate()
      },
      completionRefCon: UnsafeMutableRawPointer(data)
    ))
    /* If CoreMIDI refuses the request outright, the completion should never
       run; but that is not written down, so the few bytes are left rather than
       risk freeing them twice. */
    return Self.ok(MIDISendSysex(request))
  }

  /* Anything that is not SysEx: one or more channel messages (Program Change,
     bank select) or system messages. Each goes as one Universal MIDI Packet
     word in group 0: type 2 for a channel message, type 1 for a system one. */
  private func sendShort(_ bytes: [Int], port: MIDIPortRef, to destination: MIDIEndpointRef) -> Bool {
    var words: [UInt32] = []
    var i = 0
    while i < bytes.count {
      let status = bytes[i]
      let size = Self.shortSize(status)
      guard size > 0, i + size <= bytes.count else { return false }
      let d1 = size > 1 ? bytes[i + 1] : 0
      let d2 = size > 2 ? bytes[i + 2] : 0
      guard d1 < 0x80, d2 < 0x80 else { return false }
      let type: UInt32 = status < 0xF0 ? 0x2 : 0x1
      words.append(type << 28 | UInt32(status) << 16 | UInt32(d1) << 8 | UInt32(d2))
      i += size
    }
    for word in words {
      var list = MIDIEventList()
      list.`protocol` = ._1_0
      list.numPackets = 1
      list.packet.timeStamp = 0
      list.packet.wordCount = 1
      list.packet.words.0 = word
      guard Self.ok(MIDISendEventList(port, destination, &list)) else { return false }
    }
    return true
  }

  /* How many bytes a message starting with this status byte has, the status
     included. 0 for a byte that cannot start one: a data byte, SysEx, or a
     status MIDI leaves undefined. */
  private static func shortSize(_ status: Int) -> Int {
    switch status {
    case 0x80...0xBF, 0xE0...0xEF, 0xF2: return 3
    case 0xC0...0xDF, 0xF1, 0xF3: return 2
    case 0xF6, 0xF8, 0xFA...0xFC, 0xFE, 0xFF: return 1
    default: return 0
    }
  }

  // MARK: - Receiving

  /* On CoreMIDI's own receive thread. The list is only valid during this
     call, so it is turned into plain bytes here, and the bytes are what go to
     the main queue and on to the JavaScript. */
  private func received(_ list: UnsafePointer<MIDIEventList>) {
    let bytes = Self.midi1Bytes(list)
    if bytes.isEmpty { return }
    DispatchQueue.main.async { [weak self] in
      self?.sendEvent("onBytes", ["bytes": bytes])
    }
  }

  /* The packets in a list are different lengths, so they cannot be read as
     an array. This walks them the way MIDIEventPacketNext does: each one
     starts right after the last word of the one before. */
  static func midi1Bytes(_ list: UnsafePointer<MIDIEventList>) -> [Int] {
    guard let first = MemoryLayout<MIDIEventList>.offset(of: \MIDIEventList.packet),
          let countAt = MemoryLayout<MIDIEventPacket>.offset(of: \MIDIEventPacket.wordCount),
          let wordsAt = MemoryLayout<MIDIEventPacket>.offset(of: \MIDIEventPacket.words) else { return [] }
    let wordSize = MemoryLayout<UInt32>.size
    var out: [Int] = []
    var packet = UnsafeRawPointer(list) + first
    for _ in 0..<Int(list.pointee.numPackets) {
      let count = Int(packet.load(fromByteOffset: countAt, as: UInt32.self))
      var words: [UInt32] = []
      words.reserveCapacity(count)
      for k in 0..<count {
        words.append(packet.load(fromByteOffset: wordsAt + k * wordSize, as: UInt32.self))
      }
      appendMidi1(words, to: &out)
      packet += wordsAt + count * wordSize
    }
    return out
  }

  /* Unwraps MIDI 1.0 from Universal MIDI Packets, with no framing:
       type 3 (SysEx, up to six bytes a packet), by its status nibble —
         0 a whole frame: F0 + data + F7   1 the start: F0 + data
         2 the middle: data                 3 the end: data + F7
       type 2 (a channel message): status, first data byte, and the second
         unless it is Program Change (Cn) or Channel Pressure (Dn).
     Everything else is dropped: clock and active sensing (type 1), which
     nothing in the app reads and which would be dozens of events a second,
     and the MIDI 2.0 types a MIDI 1.0 port never carries. */
  static func appendMidi1(_ words: [UInt32], to out: inout [Int]) {
    var i = 0
    while i < words.count {
      let w0 = words[i]
      let size = UMP_WORDS[Int(w0 >> 28)]
      if i + size > words.count { break }
      switch w0 >> 28 {
      case 0x2:
        let status = Int((w0 >> 16) & 0xFF)
        out.append(status)
        out.append(Int((w0 >> 8) & 0x7F))
        let kind = status & 0xF0
        if kind != 0xC0 && kind != 0xD0 {
          out.append(Int(w0 & 0x7F))
        }
      case 0x3:
        let w1 = words[i + 1]
        let count = min(Int((w0 >> 16) & 0xF), 6)
        let data = [w0 >> 8, w0, w1 >> 24, w1 >> 16, w1 >> 8, w1].prefix(count).map { Int($0 & 0xFF) }
        switch (w0 >> 20) & 0xF {
        case 0:
          out.append(0xF0)
          out.append(contentsOf: data)
          out.append(0xF7)
        case 1:
          out.append(0xF0)
          out.append(contentsOf: data)
        case 2:
          out.append(contentsOf: data)
        case 3:
          out.append(contentsOf: data)
          out.append(0xF7)
        default:
          break
        }
      default:
        break
      }
      i += size
    }
  }

  // MARK: - CoreMIDI helpers

  private static func ok(_ status: OSStatus) -> Bool {
    status == 0
  }

  /* The source on the same entity as this destination, if there is one. */
  private static func partner(of destination: MIDIEndpointRef) -> MIDIEndpointRef? {
    var entity = MIDIEntityRef()
    guard ok(MIDIEndpointGetEntity(destination, &entity)), entity != 0,
          MIDIEntityGetNumberOfSources(entity) > 0 else { return nil }
    let s = MIDIEntityGetSource(entity, 0)
    return s == 0 ? nil : s
  }

  private static func find(_ id: MIDIUniqueID, _ kind: MIDIObjectType) -> MIDIEndpointRef? {
    var object = MIDIObjectRef()
    var type = MIDIObjectType.other
    guard ok(MIDIObjectFindByUniqueID(id, &object, &type)), object != 0, type == kind else { return nil }
    return object
  }

  /* "<destination uid>:<source uid>", as listDevices() writes it. */
  private static func parse(_ id: String) -> (dest: MIDIUniqueID, source: MIDIUniqueID)? {
    let parts = id.split(separator: ":")
    guard parts.count == 2, let d = MIDIUniqueID(parts[0]), let s = MIDIUniqueID(parts[1]) else { return nil }
    return (d, s)
  }

  private static func uid(_ object: MIDIObjectRef) -> MIDIUniqueID {
    var value: MIDIUniqueID = 0
    MIDIObjectGetIntegerProperty(object, kMIDIPropertyUniqueID, &value)
    return value
  }

  /* Set by the driver on the device and inherited by its endpoints (MIDIServices.h). */
  private static func offline(_ object: MIDIObjectRef) -> Bool {
    var value: Int32 = 0
    MIDIObjectGetIntegerProperty(object, kMIDIPropertyOffline, &value)
    return value != 0
  }

  private static func text(_ object: MIDIObjectRef, _ property: CFString) -> String {
    var value: Unmanaged<CFString>?
    guard ok(MIDIObjectGetStringProperty(object, property, &value)), let found = value?.takeRetainedValue() else { return "" }
    return found as String
  }

  private static func name(_ object: MIDIObjectRef) -> String {
    let display = text(object, kMIDIPropertyDisplayName)
    return display.isEmpty ? text(object, kMIDIPropertyName) : display
  }
}

#if !targetEnvironment(simulator)
/* Apple's Bluetooth screen, inside a screen whose bar is the app's own.
   Apple's screen writes on its own bar (its Edit button, a spinner while it
   looks) and wipes what anybody else put there; shown as a child, its bar is
   never drawn, and this one's is. Done is on the right, where a sheet's Done
   goes, and Edit on the left does what Apple's Edit does (the list's own
   editing, which is how an adapter is forgotten there). While the list is
   being edited there is one button, Done on the left, which ends the
   editing: never two Dones that do different things.

   DONE IS A BUTTON WITH THE WORD ON IT, NOT THE SYSTEM'S DONE ITEM. Since
   iOS 26 the system's Done item is drawn as a tick, and what was asked for
   is "a button that says done": a tick beside words that say "then Done"
   would be the same trouble again, after a build was spent on it. A titled
   action is drawn as its word on every iOS (Apple's own Edit, in his
   picture, is one). The title is on the action, never on the item beside
   it: with a primary action the item takes its title from the action. Edit
   stays the system's own, which is still a word. */
final class PairingHost: UIViewController {
  private let central: CABTMIDICentralViewController
  /* Done: the module dismisses the sheet and settles the promise. */
  var close: () -> Void = {}
  /* The sheet has gone, by whatever closed it: the module settles the promise if nothing has yet. */
  var gone: () -> Void = {}

  init(_ central: CABTMIDICentralViewController) {
    self.central = central
    super.init(nibName: nil, bundle: nil)
  }

  @available(*, unavailable)
  required init?(coder: NSCoder) {
    fatalError("PairingHost is made in code")
  }

  override func viewDidLoad() {
    super.viewDidLoad()
    view.backgroundColor = .systemGroupedBackground
    addChild(central)
    central.view.frame = view.bounds
    central.view.autoresizingMask = [.flexibleWidth, .flexibleHeight]
    view.addSubview(central.view)
    central.didMove(toParent: self)
    /* The bar follows the list as it scrolls, as it did when the list was the screen. */
    setContentScrollView(central.tableView)
    /* Apple's own title, in the phone's language, where it has set one by now. */
    let said = central.navigationItem.title ?? central.title ?? ""
    navigationItem.title = said.isEmpty ? "Bluetooth MIDI Devices" : said
    bar()
  }

  /* Gone, and not by Done or a swipe (the app under it closing it, say): the
     promise would never settle, and every Connect after it would be told
     Apple's screen is already open. Done and a swipe come through here too,
     and pairingDone takes the first of them. Not when a swipe is let go of
     half way: the sheet is still up then, and this is not called. */
  override func viewDidDisappear(_ animated: Bool) {
    super.viewDidDisappear(animated)
    if isBeingDismissed || navigationController?.isBeingDismissed == true {
      gone()
    }
  }

  private func bar() {
    if central.isEditing {
      navigationItem.leftBarButtonItem = UIBarButtonItem(primaryAction: UIAction(title: "Done") { [weak self] _ in
        guard let self = self else { return }
        /* Apple's screen may have ended the editing by itself: then this is the only button, and it is the way out. */
        if self.central.isEditing {
          self.edit(false)
        } else {
          self.close()
        }
      })
      navigationItem.rightBarButtonItem = nil
    } else {
      navigationItem.leftBarButtonItem = UIBarButtonItem(systemItem: .edit, primaryAction: UIAction { [weak self] _ in
        self?.edit(true)
      })
      navigationItem.rightBarButtonItem = UIBarButtonItem(primaryAction: UIAction(title: "Done") { [weak self] _ in
        self?.close()
      })
    }
  }

  private func edit(_ on: Bool) {
    central.setEditing(on, animated: true)
    bar()
  }
}
#endif

/* Tells the module when Apple's Bluetooth sheet has been swiped away, which
   UIKit reports only to the sheet's presentation delegate. A tap on Done
   dismisses it in code, which UIKit does not report here, so the two never
   both fire; pairingDone would shrug off a second call anyway. */
final class SheetGone: NSObject, UIAdaptivePresentationControllerDelegate {
  private let gone: () -> Void

  init(_ gone: @escaping () -> Void) {
    self.gone = gone
  }

  func presentationControllerDidDismiss(_ presentationController: UIPresentationController) {
    gone()
  }
}

// MARK: - A known adapter, connected with no screen

/*
 * THE ADAPTER, CONNECTED BY THE APP ITSELF AND KEPT CONNECTED.
 *
 * "We need to do better than just telling people to restart their phone and
 * look for connectors and things like that. They should connect
 * automatically every time." (Justin, 22 November 2026, after a customer's
 * MD-BT01 dropped off an iPhone while the app was in the background and
 * three trips to Apple's Bluetooth screen did not bring it back.)
 *
 * Until now the only way an adapter reached this iPhone was Apple's own
 * screen (pair): tap the adapter, wait for Connected, close the screen, and
 * again every time iOS let the link go, which it does a few minutes after
 * nobody is using it. This connects the adapter with CoreBluetooth instead.
 * A Bluetooth MIDI adapter is an ordinary Bluetooth LE device that offers
 * the MIDI service; once an app has connected one, iOS's own Bluetooth MIDI
 * driver gives it its CoreMIDI port, the same port Apple's screen makes, and
 * everything else in this file carries on as before.
 *
 * WHAT IT DOES. Asked for an adapter by name, it looks three ways at once:
 * the one it connected last time under that name (kept by its identifier),
 * any the iPhone already has connected, and a scan for the MIDI service.
 * The first whose name matches is connected. A connect asked of iOS has no
 * time limit: it waits, for as long as the app is in front, until the
 * adapter is in range and switched on, and then connects. When the link
 * drops, the same is asked again at once. So an adapter that was switched
 * off and on, went out of range and came back, or was dropped by iOS while
 * the phone was in a pocket is connected again with nothing tapped.
 *
 * WHAT IT DOES NOT DO. It never disconnects an adapter that is connected
 * (stop only gives up a connect still waiting): the link is the system's,
 * and another app may be using it. It connects nothing while the app is in
 * the background (that needs a background mode this app does not ask for);
 * the waiting connect is taken up the moment the app is in front again.
 * And it reads and writes nothing itself: MIDI still goes through CoreMIDI.
 *
 * THE NAME. CoreMIDI calls the port "MD-BT01 Bluetooth"; the device calls
 * itself "MD-BT01". Both are put in small letters with a closing
 * " bluetooth" taken off (plain) before they are compared.
 *
 * NOT SEEN ON A PHONE when this was written: that an adapter connected this
 * way gets its CoreMIDI port by itself is how every account of it reads,
 * and has not been watched on a device here. Apple's screen is still there
 * (pair), and is what the page falls back to.
 *
 * Main queue only, all of it.
 */
final class Rejoiner: NSObject, CBCentralManagerDelegate {
  /* The Bluetooth LE MIDI service, from the MIDI Association's specification. */
  static let MIDI_SERVICE = CBUUID(string: "03B80E5A-EDE8-4B33-A751-6CE34EC4C700")
  /* UserDefaults: the identifier of the adapter last connected under each name. */
  private static let KEPT = "fractal.blemidi.rejoin"

  let wanted: String
  private let said: (String) -> Void
  private let changed: () -> Void
  private var central: CBCentralManager?
  private var held: CBPeripheral?
  private var stopped = false

  static func plain(_ name: String?) -> String {
    var n = (name ?? "").trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    if n.hasSuffix(" bluetooth") { n = String(n.dropLast(" bluetooth".count)) }
    return n.trimmingCharacters(in: .whitespacesAndNewlines)
  }

  init(wanted: String, said: @escaping (String) -> Void, changed: @escaping () -> Void) {
    self.wanted = wanted
    self.said = said
    self.changed = changed
    super.init()
  }

  func start() {
    stopped = false
    /* Making the manager is what brings up iOS's question the first time. */
    central = CBCentralManager(delegate: self, queue: .main)
  }

  func stop() {
    stopped = true
    central?.stopScan()
    /* Only a connect still waiting is given up: a connected adapter is left connected. */
    if let p = held, p.state == .connecting {
      central?.cancelPeripheralConnection(p)
    }
    held = nil
    central?.delegate = nil
    central = nil
  }

  /* Asked again for the adapter already wanted: look again, in case it is in range now. */
  func look() {
    guard !stopped, let central = central, central.state == .poweredOn else { return }
    if let p = held, p.state == .connected { return }
    if let text = (UserDefaults.standard.dictionary(forKey: Self.KEPT) as? [String: String])?[wanted],
       let id = UUID(uuidString: text),
       let p = central.retrievePeripherals(withIdentifiers: [id]).first {
      join(p, why: "the one connected before")
    }
    for p in central.retrieveConnectedPeripherals(withServices: [Self.MIDI_SERVICE]) where Self.plain(p.name) == wanted {
      join(p, why: "already connected to this device")
    }
    if !central.isScanning {
      central.scanForPeripherals(withServices: [Self.MIDI_SERVICE], options: nil)
    }
  }

  private func join(_ p: CBPeripheral, why: String) {
    guard !stopped, let central = central else { return }
    if let now = held, now.identifier != p.identifier, now.state == .connecting {
      central.cancelPeripheralConnection(now)
    }
    held = p
    var kept = (UserDefaults.standard.dictionary(forKey: Self.KEPT) as? [String: String]) ?? [:]
    kept[wanted] = p.identifier.uuidString
    UserDefaults.standard.set(kept, forKey: Self.KEPT)
    if p.state == .connected {
      said("\(wanted) is connected (\(why))")
      changed()
      return
    }
    if p.state != .connecting {
      said("asking iOS to connect \(wanted) (\(why)); it waits until the adapter is in range")
      central.connect(p, options: nil)
    }
  }

  func centralManagerDidUpdateState(_ central: CBCentralManager) {
    switch central.state {
    case .poweredOn:
      look()
    case .poweredOff:
      said("Bluetooth is off on this device")
    case .unauthorized:
      said("Bluetooth is not allowed for this app")
    default:
      break
    }
  }

  func centralManager(_ central: CBCentralManager, didDiscover peripheral: CBPeripheral, advertisementData: [String: Any], rssi RSSI: NSNumber) {
    let advertised = advertisementData[CBAdvertisementDataLocalNameKey] as? String
    guard Self.plain(peripheral.name) == wanted || Self.plain(advertised) == wanted else { return }
    central.stopScan()
    join(peripheral, why: "found nearby")
  }

  func centralManager(_ central: CBCentralManager, didConnect peripheral: CBPeripheral) {
    guard peripheral.identifier == held?.identifier else { return }
    central.stopScan()
    said("\(wanted) connected with no screen")
    changed()
  }

  func centralManager(_ central: CBCentralManager, didFailToConnect peripheral: CBPeripheral, error: Error?) {
    guard !stopped, peripheral.identifier == held?.identifier else { return }
    said("\(wanted) would not connect: \(error?.localizedDescription ?? "no reason given"); trying again")
    DispatchQueue.main.asyncAfter(deadline: .now() + 2) { [weak self] in
      guard let self = self, !self.stopped, self.held?.identifier == peripheral.identifier else { return }
      self.central?.connect(peripheral, options: nil)
    }
  }

  func centralManager(_ central: CBCentralManager, didDisconnectPeripheral peripheral: CBPeripheral, error: Error?) {
    guard !stopped, peripheral.identifier == held?.identifier else { return }
    said("\(wanted) dropped: \(error?.localizedDescription ?? "no reason given"); asked to connect again when it is back")
    changed()
    central.connect(peripheral, options: nil)
  }
}

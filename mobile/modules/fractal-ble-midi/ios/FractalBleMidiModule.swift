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
 *   pair()               — Apple's own Bluetooth MIDI screen, the one
 *                          GarageBand uses. An app cannot find or pair an
 *                          adapter any other way on iOS; once it is connected
 *                          there, it turns up in CoreMIDI like any other port.
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

  /* CoreMIDI reports one change several times over; wait this long for it to finish. */
  private static let SETTLE_SECONDS: Double = 0.3

  /* How many 32-bit words each kind of Universal MIDI Packet takes, indexed by its top four bits. */
  private static let UMP_WORDS = [1, 1, 1, 2, 2, 4, 1, 1, 2, 2, 2, 3, 3, 4, 4, 4]

  public func definition() -> ModuleDefinition {
    Name("FractalBleMidi")

    Events("onBytes", "onDevices", "onState")

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

  /* The app is reloading or closing: let go of the adapter and the ports.
     The client is kept, as above. */
  private func teardown() {
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

  // MARK: - Pairing

  /* On the main queue. Apple's screen lists the Bluetooth MIDI adapters in
     range and connects the one tapped. It has no Done button of its own, so it
     is put in a navigation bar that has one. Done goes on the LEFT: Apple's
     screen puts its own "searching" spinner on the right once it starts
     looking, and a Done there would be pushed out by it (AudioKit puts its
     Done back after every layout for that reason). Swiping the sheet down is
     a way out too. Either way the promise settles, once. */
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
    let sheet = UINavigationController(rootViewController: central)
    sheet.modalPresentationStyle = .formSheet
    let done = UIAction { [weak self, weak sheet] _ in
      sheet?.dismiss(animated: true) {
        self?.pairingDone()
      }
    }
    central.navigationItem.leftBarButtonItem = UIBarButtonItem(systemItem: .done, primaryAction: done)
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

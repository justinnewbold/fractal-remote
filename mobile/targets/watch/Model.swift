import Foundation

/*
 * WHAT THE PHONE SENDS, AND WHAT THE WATCH MAY ASK.
 *
 * The Swift reading of shared/watch-link.mjs, field for field. The phone sends
 * the whole picture each time (watchState there), so a watch that missed a
 * message is right again on the next; the watch asks for one of eleven things
 * (watchCommand there), and the phone drops anything else.
 *
 * No SwiftUI and no WatchConnectivity in this file, on purpose: it is the part
 * that is tested on its own (mobile/watch-ci), against the JSON the phone's
 * own code produces (test/run.mjs writes and checks the same fixture).
 */

struct WatchPreset: Codable, Equatable {
    var number: Int
    var label: String
    var name: String
}

struct WatchPedal: Codable, Equatable, Identifiable {
    var id: Int
    var short: String
    var name: String
    var on: Bool
    var fill: String
    var ink: String
    /*
     * The channel it is on ("B"), and the ones a hold may switch it to (A to
     * D). Optional, like the metronome: a phone that has not had the update
     * that sends them sends neither, and that is "none to choose", so a hold
     * does nothing. Optional rather than given a default, because a field
     * with a default is still required when the picture is read, and one
     * missing would lose the whole picture.
     */
    var channel: String? = nil
    var channels: [String]? = nil
    /*
     * What Play's tile says for it, drawn under its name: on an AM4's amp,
     * "Boost on", "Boost off" or "Amp off" (shared/am4-boost.mjs boostWord),
     * and "" for every other pedal and for a boost the unit has not said.
     * The phone's own word, never worked out here. Optional, like the
     * channels: a phone that has not had the update that sends it sends
     * none, and the pedal is drawn as it always was.
     */
    var word: String? = nil

    /** Whether a hold offers a choice: two channels or more, as on the phone. */
    var canPickChannel: Bool { (channels?.count ?? 0) > 1 }

    /** The word to draw under the name, or nil for none: "" is none, as the channel's is. */
    var wordLine: String? {
        guard let word, !word.isEmpty else { return nil }
        return word
    }
}

struct WatchTuner: Codable, Equatable {
    var on: Bool
    var note: String
    var octave: Int
    var cents: Int
    var inTune: Bool
}

/** The metronome's word to the watch: tap on every beat at this tempo, or not. */
struct WatchMetronome: Codable, Equatable {
    var on: Bool
    var bpm: Double
}

/*
 * THE TEMPO PAGE'S PICTURE (tempoForWatch in shared/watch-link.mjs): the
 * tempo as a big number, whether Tap is offered, and the switch for the
 * metronome's tap on the wrist. All of it is the phone's word; the watch
 * never guesses.
 *
 *   bpm      the unit's tempo as the iPhone's Tap button shows it; none
 *            where none is known (a dash, and Tap still taps).
 *   tap      whether the iPhone's own Tap sends anything for this unit on
 *            this connection. Where it does not, the button is switched
 *            off and `why` is said under it.
 *   why      the iPhone's sentence for that, word for word.
 *   wrist    the metronome's "Tap on the watch" switch.
 *   running  whether the metronome is on at all: the wrist taps only while
 *            it is.
 *
 * Every field but `tap` optional, for the reason the channels are: one
 * missing must not lose the whole picture.
 */
struct WatchTempo: Codable, Equatable {
    var bpm: Double? = nil
    var tap: Bool
    var why: String? = nil
    var wrist: Bool? = nil
    var running: Bool? = nil
}

/** The tempo as the page writes it: the whole number the iPhone's Tap button shows, or a dash for none. */
func tempoNumber(_ bpm: Double?) -> String {
    guard let bpm, bpm.isFinite, bpm > 0 else { return "—" }
    return String(Int(bpm.rounded()))
}

/*
 * THE WATCH'S PAGES: WHICH ARE DRAWN, AND IN WHAT ORDER. Justin, 11
 * November 2026: "On the watch, can we add a way for a user to select which
 * order their pages show up in on the Watch app?" and, asked about hiding
 * one, "Yes, add hiding pages." Both are chosen on the iPhone (Settings →
 * Apple Watch → Watch pages) and sent in the picture: `pages`, every
 * page's name in the order chosen, and `hidden`, the names of those not to
 * draw. The watch draws the ones shown in that order and opens on the first.
 *
 * FIVE PAGES: Tempo came the same day ("OK, well let's add that as well
 * then"), fourth in the usual order, with the tuner still last. The names
 * are WATCH_PAGES in shared/watch-link.mjs, and `usual` is its order: what
 * the watch draws when the phone says none (a phone from before this, and
 * the demo). An order kept from before Tempo names four pages, and the rule
 * below puts whatever is missing after them, so Tempo simply appears.
 */
enum WatchPage: String, CaseIterable, Equatable {
    case scenes, pedals, presets, tempo, tuner

    /** The usual order: Scenes, Pedals, Presets, Tempo, Tuner. */
    static let usual: [WatchPage] = [.scenes, .pedals, .presets, .tempo, .tuner]

    /*
     * THE PAGES BY THE NUMBERS CI HAS ALWAYS CALLED THEM (-page N, for its
     * screenshots): 0 Scenes, 1 Pedals, 2 Presets, 3 Tuner, and Tempo, which
     * came later, 4. By name, never by place: -page 3 is the tuner wherever
     * the tuner is drawn, in the usual order or any other, so CI's pictures
     * are of the pages they always were.
     */
    static let numbers: [WatchPage] = [.scenes, .pedals, .presets, .tuner, .tempo]

    /** The page CI's `-page N` asks for. Nil for a number that is no page. */
    static func numbered(_ n: Int) -> WatchPage? {
        numbers.indices.contains(n) ? numbers[n] : nil
    }
}

/*
 * THREE RULES, each its namesake in shared/watch-link.mjs word for word, and
 * held to the same answers (pages.json, written by that file's rules and
 * read by this one's tests).
 *
 * watchPageOrder: a full order of the four pages out of anything the phone
 * sent: the names it knows, each once, in the order given, then whatever is
 * missing in the usual order. Always every page.
 */
func watchPageOrder(_ names: [String]?) -> [WatchPage] {
    var out: [WatchPage] = []
    for name in names ?? [] {
        if let page = WatchPage(rawValue: name), !out.contains(page) { out.append(page) }
    }
    for page in WatchPage.usual where !out.contains(page) { out.append(page) }
    return out
}

/*
 * watchPagesHidden: the hidden pages out of anything: the names it knows,
 * each once, told in the usual order. EVERY PAGE IS NONE: a watch always
 * has a page. So is no list, an empty one, or one of names nobody knows.
 */
func watchPagesHidden(_ names: [String]?) -> [WatchPage] {
    let said = names ?? []
    let out = WatchPage.usual.filter { said.contains($0.rawValue) }
    return out.count < WatchPage.usual.count ? out : []
}

/** watchPagesShown: what the watch draws, the order with the hidden pages left out. Never empty; the first is the page it opens on. */
func watchPagesShown(_ pages: [String]?, _ hidden: [String]?) -> [WatchPage] {
    let off = watchPagesHidden(hidden)
    return watchPageOrder(pages).filter { !off.contains($0) }
}

/*
 * THE PAGE ON SHOW: the one the wearer swiped to (or CI's -page N asked
 * for) while it is still drawn, and the first drawn page otherwise: before
 * any swipe, and when the page they were on has just been hidden.
 */
func watchPageOnShow(_ swiped: WatchPage?, _ shown: [WatchPage]) -> WatchPage {
    if let swiped, shown.contains(swiped) { return swiped }
    return shown.first ?? .scenes
}

/*
 * THE TUNER, AND LEAVING ITS PAGE. Two rules, each its namesake in
 * shared/watch-link.mjs word for word and held to the same answers by
 * pages.json.
 *
 * watchTunerStopsOnLeaving: leaving the tuner's page turns the tuner off (a
 * unit set to mute while it tunes must not be left muted by a swipe),
 * unless the iPhone has said it stays: "Can we make a setting ... where a
 * user can decide whether or not the tuner stays on when they exit ... some
 * people wanna play while their tuner stays up on their screen" (Justin, 11
 * November 2026). The switch is on the iPhone (Settings → Apple Watch) and
 * comes in the picture as `tunerStays`; absent is off, which is what the
 * watch has always done.
 */
func watchTunerStopsOnLeaving(tunerOn: Bool, stays: Bool?) -> Bool {
    tunerOn && stays != true
}

/*
 * watchTunerStopsOnHiding: the tuner's page hidden in the iPhone's list
 * while the tuner is on turns it off WHATEVER THE SWITCH SAYS: there would
 * be no page left on the watch to stop it from.
 */
func watchTunerStopsOnHiding(was: [WatchPage], now: [WatchPage], tunerOn: Bool) -> Bool {
    tunerOn && was.contains(.tuner) && !now.contains(.tuner)
}

/*
 * QUICK EDIT (shared/watch-link.mjs, QUICK EDIT ON THE WRIST). Justin, 12
 * November 2026: "On the watch, we have pushed to hold on the channels to
 * switch amps. Can we set up quick edits on that as well? And change the
 * name to hold to quick edit?" Of three pictures he chose the second: "For
 * the watch, mock up B." A pedal held opens its channels in one row and,
 * under them, a list of the block's knobs, a name and a value to a row; a
 * tap picks one and the Digital Crown turns it (Pages.swift, QuickSheet).
 *
 * The knobs are the iPhone's: the ones its own Edit page draws first for
 * that block, read and written by the iPhone as Edit reads and writes
 * them. The watch never decides what is a knob, and never a value the
 * iPhone has not been asked for.
 *
 * ONE KNOB, as the picture carries it:
 *
 *   key      which knob, in the iPhone's own word, sent back with a turn.
 *   at       where it sits in its range, 0 to 1.
 *   name     what the row calls it.
 *   text     its value as the iPhone's Edit page writes it ("6.20", "-3.00
 *            dB").
 *   min, max, log, unit
 *            its range, whether its scale is logarithmic (a frequency),
 *            and its unit: enough for the watch to write the number as
 *            the Crown turns, without waiting for the iPhone to answer.
 *
 * Only the key and the place are needed to read one; every other field is
 * optional, for the reason the channels are: one missing must not lose the
 * whole picture. With no range the row says the iPhone's own words, and the
 * number moves when the iPhone answers.
 */
struct WatchKnob: Codable, Equatable {
    var key: String
    var at: Double
    var name: String? = nil
    var text: String? = nil
    var min: Double? = nil
    var max: Double? = nil
    var log: Bool? = nil
    var unit: String? = nil

    /*
     * What its row says for its value: the iPhone's own words while the
     * Crown has not moved it (`turned` nil), and, while the Crown is ahead
     * of the iPhone, the number worked out here by the iPhone's own rule
     * (watchKnobValue, watchKnobText). With no range to work it out from,
     * the iPhone's words stay until it answers.
     */
    func shown(turned: Double?) -> String {
        guard let turned, let value = watchKnobValue(at: turned, low: min, high: max, curved: log) else { return text ?? "" }
        return watchKnobText(value, unit: unit)
    }

    /** Where it sits, 0 to 1: where the Crown has put it, or where the iPhone says it is. */
    func place(turned: Double?) -> Double {
        watchKnobAt(turned ?? at)
    }
}

/** The open sheet's knobs: the pedal they are for, and up to eight of them. None is a block with no knobs to show, or one the iPhone could not read: its sheet is its channels. */
struct WatchQuick: Codable, Equatable {
    var id: Int
    var knobs: [WatchKnob]? = nil
}

/*
 * FIVE RULES, each its namesake in shared/watch-link.mjs word for word, and
 * held to the same answers by pages.json.
 *
 * watchKnobAt: a place in a knob's range, 0 to 1, to three places: what the
 * watch sends and the iPhone takes.
 */
func watchKnobAt(_ x: Double) -> Double {
    guard x.isFinite else { return 0 }
    return (min(1, max(0, x)) * 1000 + 0.5).rounded(.down) / 1000
}

/*
 * watchKnobValue: the value a place in a knob's range comes to, by the
 * scale the iPhone's Edit page uses (a straight line, or a logarithmic one
 * for a frequency), to three places. Nil for a knob with no range.
 */
func watchKnobValue(at: Double, low: Double?, high: Double?, curved: Bool?) -> Double? {
    guard at.isFinite, let low, let high, low.isFinite, high.isFinite, high > low else { return nil }
    let t = min(1, max(0, at))
    let v: Double = (curved == true && low > 0) ? exp(log(low) + t * (log(high) - log(low))) : low + t * (high - low)
    return (v * 1000 + 0.5).rounded(.down) / 1000
}

/*
 * watchKnobText: a value as the iPhone's Edit page writes it under a knob:
 * two places, or a whole number from a thousand up, then the unit after a
 * space. A dash for no number. (A value that ends in exactly half a
 * hundredth may round the other way here than on the iPhone, for the
 * moment the Crown is ahead; the iPhone's own words replace it.)
 */
func watchKnobText(_ value: Double?, unit: String?) -> String {
    var number = "—"
    if let value, value.isFinite, abs(value) < 1e15 {
        number = abs(value) >= 1000 ? String(Int((value + 0.5).rounded(.down))) : String(format: "%.2f", value)
    }
    if let unit, !unit.isEmpty { return "\(number) \(unit)" }
    return number
}

/** How often a turn of the Crown may cross to the iPhone: about ten a second (WATCH_KNOB_MS). */
let watchKnobSeconds: Double = 0.1
/** How long after the last turn the watch shows its own number before the iPhone's (WATCH_KNOB_SETTLE_MS). */
let watchKnobSettle: Double = 1.5
/** How long a sheet waits for its knobs before it asks again, and how many times it asks (WATCH_KNOBS_ASK_MS, WATCH_KNOBS_ASKS): the first ask may be the one that woke the iPhone. */
let watchKnobsAskSeconds: Double = 2.5
let watchKnobsAsks = 4

/** watchKnobWait: how long before a turn may go, in seconds: nothing when the last went a tenth of a second ago or more, or none has gone. */
func watchKnobWait(lastSent: Date?, now: Date) -> Double {
    guard let lastSent else { return 0 }
    return max(0, min(watchKnobSeconds, watchKnobSeconds - now.timeIntervalSince(lastSent)))
}

/*
 * THE WORDS UNDER THE PEDALS: what a hold does (watchHoldLine in
 * shared/watch-link.mjs). "Hold a pedal for quick edit." only where the
 * iPhone's picture offers quick edit; the words it always had otherwise.
 */
enum PedalWords {
    static let channels = "Hold a pedal for its channels."
    static let quick = "Hold a pedal for quick edit."
}

func pedalHoldLine(quickEdit: Bool?) -> String {
    quickEdit == true ? PedalWords.quick : PedalWords.channels
}

/** The open sheet's knobs for this pedal as the iPhone last said them: nil while it has not (still reading, or another pedal's). */
func watchQuickFor(_ quick: WatchQuick?, pedal id: Int) -> WatchQuick? {
    guard let quick, quick.id == id else { return nil }
    return quick
}

/** The knob the Crown turns: the one tapped while it is still listed, and the first otherwise. Nil with none. */
func watchKnobPicked(_ knobs: [WatchKnob], _ key: String?) -> WatchKnob? {
    if let key, let chosen = knobs.first(where: { $0.key == key }) { return chosen }
    return knobs.first
}

struct WatchState: Codable, Equatable {
    /** WATCH_LINK_VERSION in shared/watch-link.mjs. */
    static let linkVersion = 1

    var v: Int
    var at: Double
    var linked: Bool
    var preset: WatchPreset
    var canPrevious: Bool
    var canNext: Bool
    var scene: Int
    var scenes: [String]
    var pedals: [WatchPedal]
    var tuner: WatchTuner
    /** Optional: a phone older than the metronome sends none, and that is "off". */
    var metronome: WatchMetronome? = nil
    /** The Tempo page's picture. Optional: only a phone that has heard this watch say it has that page (`knows`, below) sends one, and none is a dash with Tap switched off. */
    var tempo: WatchTempo? = nil
    /** The iPhone's "stays on when you swipe away" switch for the tuner (watchTunerStopsOnLeaving, above). Optional: none is off, the tuner turned off when its page is left, as it always was. */
    var tunerStays: Bool? = nil
    /*
     * The pages in the order chosen on the iPhone, by name, and those of
     * them not to draw. Optional, like the metronome: a phone that has not
     * had the update that sends them sends neither, and so does one that
     * has not yet heard this watch say it takes them (`knows`, below), and
     * neither is all four in the usual order.
     */
    var pages: [String]? = nil
    var hidden: [String]? = nil
    /*
     * Quick edit (WatchKnob, above): whether a pedal held offers it, and
     * the open sheet's knobs once the iPhone has read them. Optional, like
     * the pages: only a phone that has heard this watch say it knows
     * `quick` sends either, none is "a hold opens the channels alone", and
     * a missing one never loses the picture.
     */
    var quickEdit: Bool? = nil
    var quick: WatchQuick? = nil

    /** The four pages in the order chosen: `pages` repaired, or the usual order. */
    var order: [WatchPage] { watchPageOrder(pages) }

    /** The pages to draw, in order: `order` with the hidden ones left out. Never empty. */
    var shown: [WatchPage] { watchPagesShown(pages, hidden) }

    static func decode(_ json: String) -> WatchState? {
        guard let data = json.data(using: .utf8) else { return nil }
        return try? JSONDecoder().decode(WatchState.self, from: data)
    }

    /** A phone newer than this watch: the watch says so rather than misreading it. */
    var tooNew: Bool { v > WatchState.linkVersion }

    /** What the preset page says on its top line: the slot, "012". */
    var slotLine: String { preset.number >= 0 && !preset.label.isEmpty ? preset.label : "—" }

    /** And its big line: the name, or a word for none. */
    var nameLine: String {
        let name = preset.name.trimmingCharacters(in: .whitespaces)
        if preset.number < 0 { return "No preset" }
        return name.isEmpty ? "Untitled" : name
    }

    /** The four channels each demo pedal has, as on an FM3. */
    private static let abcd = ["A", "B", "C", "D"]

    /** The picture the screenshots and the demo draw. */
    static let sample = WatchState(
        v: 1,
        at: 0,
        linked: true,
        preset: WatchPreset(number: 12, label: "012", name: "Crunch Rhythm"),
        canPrevious: true,
        canNext: true,
        scene: 1,
        scenes: ["Clean", "Crunch", "Lead", "Solo", "Ambient", "Scene 6", "Scene 7", "Scene 8"],
        pedals: [
            WatchPedal(id: 46, short: "CMP", name: "Compressor 1", on: true, fill: "#3f7fbf", ink: "#ffffff", channel: "A", channels: abcd),
            WatchPedal(id: 50, short: "DRV", name: "Drive 1", on: true, fill: "#c0392b", ink: "#ffffff", channel: "B", channels: abcd),
            WatchPedal(id: 58, short: "AMP", name: "Amp 1", on: true, fill: "#b8860b", ink: "#ffffff", channel: "A", channels: abcd),
            WatchPedal(id: 62, short: "CAB", name: "Cab 1", on: true, fill: "#5a8a5f", ink: "#ffffff", channel: "A", channels: abcd),
            WatchPedal(id: 70, short: "DLY", name: "Delay 1", on: false, fill: "#2e86ab", ink: "#ffffff", channel: "C", channels: abcd),
            WatchPedal(id: 66, short: "REV", name: "Reverb 1", on: true, fill: "#8e44ad", ink: "#ffffff", channel: "A", channels: abcd)
        ],
        tuner: WatchTuner(on: false, note: "", octave: -1, cents: 0, inTune: false),
        tempo: WatchTempo(bpm: 120, tap: true, why: "", wrist: false, running: false)
    )
}

/*
 * THE CHECK-IN (watchHereDue in shared/watch-link.mjs, word for word, and
 * held to the same answers by pages.json). A request from the watch wakes
 * the iPhone app with the phone locked, and the phone holds itself awake
 * for 25 seconds after it and then sleeps, so the watch's picture went
 * stale until the next tap. "Yes, add that to the build" (Justin, 11
 * November 2026): while the watch app is ON ITS SCREEN with its pages up, it
 * says "here" whenever `watchHereSeconds` have gone by since it last sent
 * the phone anything. The phone renews its 25 seconds on any message, so
 * the iPhone stays awake only while the watch's screen is on.
 *
 * Never from the waiting page, never in the demo, and it stops the moment
 * the app leaves the screen (PhoneLink.onScreen): no workout, no extended
 * session, nothing that keeps the watch app running with the wrist down.
 * The rule takes the clock, so the tests hand it one.
 */
let watchHereSeconds: Double = 20
/** How often PhoneLink asks whether a check-in is due: one goes at most this long after it is. */
let watchHereTick: Double = 2

func watchHereDue(onScreen: Bool, pagesUp: Bool, demo: Bool, lastSent: Date?, now: Date) -> Bool {
    guard onScreen, pagesUp, !demo else { return false }
    guard let lastSent else { return true }
    return now.timeIntervalSince(lastSent) >= watchHereSeconds
}

/** The eleven things the watch may ask. watchCommand in shared/watch-link.mjs. */
enum WatchCommand: Equatable {
    /*
     * WHAT THIS WATCH KNOWS, said in its hello (WATCH_KNOWS in
     * shared/watch-link.mjs). "pages": it draws the pages the picture says
     * are shown, in the order the picture says. "tempo": it has the Tempo
     * page, reads the picture's `tempo`, and may ask for a tap and for the
     * wrist's switch. "stay": it reads `tunerStays`, and with it true does
     * not turn the tuner off when its page is left. "here": it checks in
     * while it is on screen (watchHereDue, above). "quick": a pedal held
     * opens quick edit; it reads `quickEdit` and `quick`, and may ask for a
     * block's knobs and turn one. The phone shows the
     * Watch pages setting and the tuner's switch, and sends an order, a
     * hidden page, a tempo or `tunerStays` at all, only to a watch that has
     * said so: a watch from before this build draws its four pages in the usual
     * order whatever it is sent, and a setting that does nothing is worse
     * than none.
     */
    static let knows = ["pages", "tempo", "stay", "here", "quick"]

    case hello
    /** The check-in: the watch app is on screen. Nothing for the phone to do but stay awake. */
    case here
    /** One tap of the iPhone's own Tap button: the Tempo page's button. */
    case tap
    /** The metronome's tap on the wrist, on or off: the Tempo page's switch. */
    case wrist(on: Bool)
    case scene(Int)
    case pedal(id: Int, on: Bool)
    case preset(step: Int)
    case tuner(on: Bool)
    /** That block onto that channel, by the letter the phone sent ("B"). */
    case channel(id: Int, channel: String)
    /** Quick edit: a held pedal's sheet opened, so its knobs are wanted; nil when it closes. */
    case knobs(id: Int?)
    /** Quick edit: that knob of that pedal to that place in its range, 0 to 1. */
    case knob(id: Int, key: String, at: Double)

    /*
     * SENT ONCE OR NOT AT ALL. A request that did not go is tried once more
     * a second later (PhoneLink.send), which is right for a scene and wrong
     * for a tap: a tap is a beat, and one that lands a second late is a
     * beat that was never played. And a check-in has no need of it: the
     * next one is two seconds off. Nor quick edit's two: a turn that went
     * a second late would land over a newer one, and a sheet that has not
     * been answered asks again by itself (Pages.swift, QuickSheet).
     */
    var once: Bool {
        switch self {
        case .tap, .here, .knobs, .knob: return true
        default: return false
        }
    }

    /** Written by hand, so the order of the keys never changes under the tests. */
    var json: String {
        switch self {
        case .hello: return #"{"do":"hello","knows":["pages","tempo","stay","here","quick"]}"#
        case .here: return #"{"do":"here"}"#
        case .tap: return #"{"do":"tap"}"#
        case .wrist(let on): return #"{"do":"wrist","on":\#(on)}"#
        case .scene(let index): return #"{"do":"scene","index":\#(index)}"#
        case .pedal(let id, let on): return #"{"do":"pedal","id":\#(id),"on":\#(on)}"#
        case .preset(let step): return #"{"do":"preset","step":\#(step < 0 ? -1 : 1)}"#
        case .tuner(let on): return #"{"do":"tuner","on":\#(on)}"#
        case .channel(let id, let channel): return #"{"do":"channel","id":\#(id),"channel":\#(jsonText(channel))}"#
        case .knobs(let id):
            let which = id.map { String($0) } ?? "null"
            return #"{"do":"knobs","id":\#(which)}"#
        case .knob(let id, let key, let at): return #"{"do":"knob","id":\#(id),"key":\#(jsonText(key)),"at":\#(watchKnobAt(at))}"#
        }
    }
}

/*
 * A string as JSON, in its quotes, escaped. The channel is the phone's own
 * word sent back, a single letter today; written through the encoder rather
 * than pasted between quotes, so whatever the phone ever sends, what goes
 * back is still one piece of JSON the phone can read, and refuse.
 */
func jsonText(_ s: String) -> String {
    guard let data = try? JSONEncoder().encode(s), let out = String(data: data, encoding: .utf8) else { return "\"\"" }
    return out
}

/*
 * HOW TALL A TILE IS WHEN THERE ARE FEW. Justin, 25 October 2026, with a
 * photo of an AM4 on his watch: "On the VP4 and the AM4, can we make the
 * watch buttons bigger somehow to maximize the watch space? It's already
 * pretty small and we're only using about half the space.. on the FM3 and
 * other devices, it seems like it's good." An AM4's four scenes, two across
 * at the eight scenes' height, filled the top half of the page.
 *
 * So when there are four or fewer (`fewTiles`), the rows share the page
 * between them, stretched by the page itself to whatever is left under the
 * heading (Pages.swift). More than that (an FM3's eight scenes, six pedals)
 * and a tile is the height it always had, as he asked, on a page that
 * scrolls.
 *
 * `fillHeight` is what one tile comes to when they share it: the room, less
 * the gaps between rows, divided by the rows, and never less than the height
 * a tile always had (`least`). The page uses it for the size of the type,
 * which has to be chosen before the tile is drawn; the tile's own height is
 * the page's to give.
 */
func fillHeight(count: Int, columns: Int, room: Double, least: Double, spacing: Double = 4) -> Double {
    guard fewTiles(count), columns > 0, room > 0 else { return least }
    let rows = (count + columns - 1) / columns
    let each = ((room - spacing * Double(rows - 1)) / Double(rows)).rounded(.down)
    return max(least, each)
}

/** Whether a page's tiles are few enough to share it: one to four, an AM4's or a VP4's. */
func fewTiles(_ count: Int) -> Bool { count > 0 && count <= 4 }

/** The tiles' places, row by row, `columns` to a row; a short last row is filled out with nil, so its tiles keep their width. */
func tileRows(_ count: Int, columns: Int) -> [[Int?]] {
    guard count > 0, columns > 0 else { return [] }
    return stride(from: 0, to: count, by: columns).map { start in
        (start..<(start + columns)).map { $0 < count ? $0 : nil }
    }
}

/** Scenes two across, as they always were; one alone across the whole page rather than half of it beside an empty half. */
func sceneColumns(_ count: Int) -> Int { count <= 1 ? 1 : 2 }

/** Pedals two across when there are four or fewer (an AM4's, a VP4's), like the scenes, and one alone across the whole page; three across otherwise, as they always were. */
func pedalColumns(_ count: Int) -> Int { count <= 1 ? 1 : count <= 4 ? 2 : 3 }

/*
 * HOW ROUND THE CORNERS OF THE SCREEN ARE, near enough, from how wide it
 * is: about a fifth of the width on every Apple Watch this runs on. The
 * metronome's light on the edge of the screen follows them (EdgeBeat in
 * FractalWatchApp.swift); its line is soft, so a point or two either way is
 * not seen. Never less than a line's own roundness, and nothing for a
 * width that is not one.
 */
func watchEdgeRadius(width: Double) -> Double {
    guard width.isFinite, width > 0 else { return 0 }
    return max(12, (width * 0.2).rounded())
}

/*
 * THE BIGGEST SIZE AT WHICH A NAME'S LONGEST WORD FITS ITS TILE'S WIDTH, so
 * that a grown name never breaks a word in two ("Overdriv" over "e", or "Big
 * Distorti" over "on"): a name's words wrap between them, never inside one.
 * `perChar` is a letter's width as a share of the size, a little over what
 * the watch's own semibold face averages, so the estimate errs small; the
 * page's minimumScaleFactor takes up whatever is left.
 */
func wordFitSize(_ name: String, width: Double, perChar: Double = 0.62) -> Double {
    let longest = name.split(separator: " ").map(\.count).max() ?? 0
    guard longest > 0, width > 0, perChar > 0 else { return .infinity }
    return (width / (Double(longest) * perChar)).rounded(.down)
}

/** A shared page's scene name: grown with its tile, no bigger than lets its longest word fit, and never under 11, below which the page's own shrinking takes over. */
func sceneNameSize(_ name: String, tall: Double, wide: Double) -> Double {
    max(11, min(grownSize(tall, share: 0.28, least: 14, most: 24), wordFitSize(name, width: wide)))
}

/** A size that grows with its tile, from `least` (the size it always had) to `most`. */
func grownSize(_ tall: Double, share: Double, least: Double, most: Double) -> Double {
    max(least, min(most, (tall * share).rounded(.down)))
}

/** Under "Open Fractal Remote on your iPhone" on the waiting page: the watch's taps and check-ins wake an iPhone app that is asleep, and cannot put one that was swiped closed back on its Play screen. */
enum WaitingWords {
    static let closed = "If it was swiped closed, open it again."
}

/*
 * THE TUNER PAGE'S WORDS (Pages.swift TunerPage, option B, picked 11
 * November 2026). The screen says what the tuner IS, the buttons say what a
 * tap will DO, and no button is ever "Tuner on" or "Tuner off" again: those
 * read as the state. `offSpoken` is what VoiceOver says for "Off".
 */
enum TunerWords {
    static let off = "Off"
    static let offSpoken = "Tuner is off"
    static let start = "Start tuning"
    static let stop = "Stop tuning"
}

/** Where the tuner's needle sits, -1 (50 cents flat) to 1 (50 sharp). */
func needleOffset(cents: Int) -> Double {
    Double(max(-50, min(50, cents))) / 50
}

/** "#c0392b" as three 0–1 numbers, or nil for anything that is not one. */
func rgb(hex: String) -> (r: Double, g: Double, b: Double)? {
    var s = hex
    if s.hasPrefix("#") { s.removeFirst() }
    guard s.count == 6, let n = UInt32(s, radix: 16) else { return nil }
    return (Double((n >> 16) & 0xff) / 255, Double((n >> 8) & 0xff) / 255, Double(n & 0xff) / 255)
}

/*
 * THE DEMO, for the screenshots CI takes and for trying the pages with no
 * phone in reach: each request is answered here, the way the phone would.
 */
extension WatchState {
    /*
     * CI's picture of an AM4's four scenes and four pedals (screens.sh:
     * -am4Demo YES), the shape that filled half the page. Two names of two
     * words, which take two lines, and one long word, which stays whole on
     * one; and the amp saying its boost, as an AM4's phone sends it, so the
     * word is seen in a tile of the new size. For looking at a pull request
     * only.
     */
    var am4Demo: WatchState {
        var next = self
        next.scenes = ["Clean", "Overdrive", "Lead Bright", "Lead Cranked"]
        next.scene = 2
        next.pedals = [
            WatchPedal(id: 46, short: "CMP", name: "Compressor", on: false, fill: "#b8a03a", ink: "#000000", channel: "A", channels: ["A", "B", "C", "D"]),
            WatchPedal(id: 50, short: "DRV", name: "Drive", on: true, fill: "#e8402a", ink: "#000000", channel: "A", channels: ["A", "B", "C", "D"]),
            WatchPedal(id: 58, short: "AMP", name: "Amp", on: false, fill: "#8a8f99", ink: "#ffffff", channel: "C", channels: ["A", "B", "C", "D"], word: "Boost off"),
            WatchPedal(id: 70, short: "DLY", name: "Delay", on: true, fill: "#2f6ff0", ink: "#ffffff", channel: "A", channels: ["A", "B", "C", "D"])
        ]
        return next
    }

    /*
     * CI's picture of an AM4's amp saying its boost (screens.sh: -boostDemo
     * YES): the sample with its AMP pedal dark and "Boost off" under its
     * name, as the phone sends it for an AM4. For looking at a pull request
     * only. The demo's answers below never change a word: the word is the
     * phone's.
     */
    var boostDemo: WatchState {
        var next = self
        next.pedals = pedals.map { p in
            var q = p
            if q.id == 58 {
                q.on = false
                q.word = "Boost off"
            }
            return q
        }
        return next
    }

    /*
     * CI's picture of quick edit (screens.sh: -quickDemo YES): the sample
     * with quick edit offered, as an iPhone that offers it would say. The
     * sample itself offers none, so every other picture is of the pages as
     * they are without it.
     */
    var quickDemo: WatchState {
        var next = self
        next.quickEdit = true
        return next
    }

    /** The demo's knobs for a held pedal: four of a drive's, one of them a frequency, as an iPhone would list them. */
    static func demoQuick(id: Int) -> WatchQuick {
        WatchQuick(id: id, knobs: [
            WatchKnob(key: "1", at: 0.62, name: "Drive", text: "6.20", min: 0, max: 10, log: false, unit: ""),
            WatchKnob(key: "2", at: 0.5, name: "Tone", text: "5.00", min: 0, max: 10, log: false, unit: ""),
            WatchKnob(key: "3", at: 1, name: "Mix", text: "100.00 %", min: 0, max: 100, log: false, unit: "%"),
            WatchKnob(key: "4", at: 0.5, name: "Low Cut", text: "632.46 Hz", min: 20, max: 20000, log: true, unit: "Hz")
        ])
    }

    func answering(_ command: WatchCommand) -> WatchState {
        var next = self
        switch command {
        case .hello, .here:
            break
        case .tap:
            /* The demo has no unit to count a tap, so the number stays. */
            break
        case .wrist(let on):
            next.tempo?.wrist = on
        case .scene(let index):
            if index >= 0 && index < scenes.count { next.scene = index }
        case .pedal(let id, let on):
            /* Changed in place, so a pedal switched on or off keeps its channels. */
            next.pedals = pedals.map { p in
                var q = p
                if q.id == id { q.on = on }
                return q
            }
        case .channel(let id, let channel):
            /* Only a channel that pedal offers, as the phone takes only those. */
            next.pedals = pedals.map { p in
                var q = p
                if q.id == id, q.channels?.contains(channel) == true { q.channel = channel }
                return q
            }
        case .preset(let step):
            next.preset.number = max(0, preset.number + (step < 0 ? -1 : 1))
            next.preset.label = String(format: "%03d", next.preset.number)
        case .tuner(let on):
            next.tuner = on
                ? WatchTuner(on: true, note: "E", octave: 2, cents: -6, inTune: false)
                : WatchTuner(on: false, note: "", octave: -1, cents: 0, inTune: false)
        case .knobs(let id):
            /* Only where quick edit is offered, and only a pedal a hold opens, as the phone answers only those; closing lets them go. */
            if let id, quickEdit == true, pedals.contains(where: { $0.id == id && $0.canPickChannel }) {
                next.quick = WatchState.demoQuick(id: id)
            } else {
                next.quick = nil
            }
        case .knob(let id, let key, let at):
            /* Only a knob the open sheet lists for that pedal: put there, and its words written by the watch's own rule. */
            if var open = next.quick, open.id == id {
                open.knobs = (open.knobs ?? []).map { k in
                    var q = k
                    if q.key == key {
                        q.at = watchKnobAt(at)
                        q.text = q.shown(turned: q.at)
                    }
                    return q
                }
                next.quick = open
            }
        }
        return next
    }
}

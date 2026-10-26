import Foundation

/*
 * WHAT THE PHONE SENDS, AND WHAT THE WATCH MAY ASK.
 *
 * The Swift reading of shared/watch-link.mjs, field for field. The phone sends
 * the whole picture each time (watchState there), so a watch that missed a
 * message is right again on the next; the watch asks for one of six things
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
        tuner: WatchTuner(on: false, note: "", octave: -1, cents: 0, inTune: false)
    )
}

/** The six things the watch may ask. watchCommand in shared/watch-link.mjs. */
enum WatchCommand: Equatable {
    case hello
    case scene(Int)
    case pedal(id: Int, on: Bool)
    case preset(step: Int)
    case tuner(on: Bool)
    /** That block onto that channel, by the letter the phone sent ("B"). */
    case channel(id: Int, channel: String)

    /** Written by hand, so the order of the keys never changes under the tests. */
    var json: String {
        switch self {
        case .hello: return #"{"do":"hello"}"#
        case .scene(let index): return #"{"do":"scene","index":\#(index)}"#
        case .pedal(let id, let on): return #"{"do":"pedal","id":\#(id),"on":\#(on)}"#
        case .preset(let step): return #"{"do":"preset","step":\#(step < 0 ? -1 : 1)}"#
        case .tuner(let on): return #"{"do":"tuner","on":\#(on)}"#
        case .channel(let id, let channel): return #"{"do":"channel","id":\#(id),"channel":\#(jsonText(channel))}"#
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

    func answering(_ command: WatchCommand) -> WatchState {
        var next = self
        switch command {
        case .hello:
            break
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
        }
        return next
    }
}

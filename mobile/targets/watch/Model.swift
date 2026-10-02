import Foundation

/*
 * WHAT THE PHONE SENDS, AND WHAT THE WATCH MAY ASK.
 *
 * The Swift reading of shared/watch-link.mjs, field for field. The phone sends
 * the whole picture each time (watchState there), so a watch that missed a
 * message is right again on the next; the watch asks for one of five things
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
}

struct WatchTuner: Codable, Equatable {
    var on: Bool
    var note: String
    var octave: Int
    var cents: Int
    var inTune: Bool
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
            WatchPedal(id: 46, short: "CMP", name: "Compressor 1", on: true, fill: "#3f7fbf", ink: "#ffffff"),
            WatchPedal(id: 50, short: "DRV", name: "Drive 1", on: true, fill: "#c0392b", ink: "#ffffff"),
            WatchPedal(id: 58, short: "AMP", name: "Amp 1", on: true, fill: "#b8860b", ink: "#ffffff"),
            WatchPedal(id: 62, short: "CAB", name: "Cab 1", on: true, fill: "#5a8a5f", ink: "#ffffff"),
            WatchPedal(id: 70, short: "DLY", name: "Delay 1", on: false, fill: "#2e86ab", ink: "#ffffff"),
            WatchPedal(id: 66, short: "REV", name: "Reverb 1", on: true, fill: "#8e44ad", ink: "#ffffff")
        ],
        tuner: WatchTuner(on: false, note: "", octave: -1, cents: 0, inTune: false)
    )
}

/** The five things the watch may ask. watchCommand in shared/watch-link.mjs. */
enum WatchCommand: Equatable {
    case hello
    case scene(Int)
    case pedal(id: Int, on: Bool)
    case preset(step: Int)
    case tuner(on: Bool)

    /** Written by hand, so the order of the keys never changes under the tests. */
    var json: String {
        switch self {
        case .hello: return #"{"do":"hello"}"#
        case .scene(let index): return #"{"do":"scene","index":\#(index)}"#
        case .pedal(let id, let on): return #"{"do":"pedal","id":\#(id),"on":\#(on)}"#
        case .preset(let step): return #"{"do":"preset","step":\#(step < 0 ? -1 : 1)}"#
        case .tuner(let on): return #"{"do":"tuner","on":\#(on)}"#
        }
    }
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
    func answering(_ command: WatchCommand) -> WatchState {
        var next = self
        switch command {
        case .hello:
            break
        case .scene(let index):
            if index >= 0 && index < scenes.count { next.scene = index }
        case .pedal(let id, let on):
            next.pedals = pedals.map { p in p.id == id ? WatchPedal(id: p.id, short: p.short, name: p.name, on: on, fill: p.fill, ink: p.ink) : p }
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

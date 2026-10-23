import XCTest
@testable import WatchModel

/*
 * The watch reads what the phone sends. state.json is written by the phone's
 * own code (shared/watch-link.mjs, watchState) and test/run.mjs checks it still
 * is, so a field renamed on one side fails here or there, never on a wrist.
 */
final class WatchModelTests: XCTestCase {
    private func fixture() throws -> String {
        let url = try XCTUnwrap(Bundle.module.url(forResource: "state", withExtension: "json"))
        return try String(contentsOf: url, encoding: .utf8)
    }

    func testReadsThePhonesPicture() throws {
        let state = try XCTUnwrap(WatchState.decode(try fixture()))
        XCTAssertEqual(state.v, WatchState.linkVersion)
        XCTAssertFalse(state.tooNew)
        XCTAssertTrue(state.linked)
        XCTAssertEqual(state.slotLine, "012")
        XCTAssertEqual(state.nameLine, "Crunch Rhythm")
        XCTAssertEqual(state.scene, 1)
        XCTAssertEqual(state.scenes.count, 8)
        XCTAssertEqual(state.scenes[3], "Scene 4")
        XCTAssertTrue(state.canPrevious)
        XCTAssertFalse(state.canNext)
        XCTAssertEqual(state.pedals.map(\.short), ["DRV", "DLY"])
        XCTAssertEqual(state.pedals[1].fill, "#7d8591", "a colour the phone could not read is sent as grey")
        XCTAssertTrue(state.tuner.on)
        XCTAssertEqual(state.tuner.note, "E")
        XCTAssertEqual(state.tuner.cents, -2)
        XCTAssertTrue(state.tuner.inTune)
        XCTAssertEqual(state.metronome, WatchMetronome(on: true, bpm: 120))
        /* A pedal held: Drive's four channels, and Delay's one, which is nothing to choose. */
        XCTAssertEqual(state.pedals[0].channel, "B")
        XCTAssertEqual(state.pedals[0].channels, ["A", "B", "C", "D"])
        XCTAssertTrue(state.pedals[0].canPickChannel)
        XCTAssertEqual(state.pedals[1].channel, "A")
        XCTAssertEqual(state.pedals[1].channels, [])
        XCTAssertFalse(state.pedals[1].canPickChannel, "one channel was offered as a choice")
    }

    func testAPhoneWithNoMetronomeIsReadAsOff() throws {
        var picture = try XCTUnwrap(JSONSerialization.jsonObject(with: Data(try fixture().utf8)) as? [String: Any])
        picture.removeValue(forKey: "metronome")
        let raw = try XCTUnwrap(String(data: try JSONSerialization.data(withJSONObject: picture), encoding: .utf8))
        let state = try XCTUnwrap(WatchState.decode(raw))
        XCTAssertNil(state.metronome)
    }

    /* The fixture's picture as a dictionary, changed by `edit`, back as the JSON a phone would send. */
    private func picture(_ edit: (inout [String: Any]) -> Void) throws -> String {
        var object = try XCTUnwrap(JSONSerialization.jsonObject(with: Data(try fixture().utf8)) as? [String: Any])
        edit(&object)
        return try XCTUnwrap(String(data: try JSONSerialization.data(withJSONObject: object), encoding: .utf8))
    }

    /*
     * A phone that has not had the update that sends channels: the pedals are
     * still drawn, and a hold offers nothing. Fields that are not Optional
     * would lose this whole picture, and the watch would draw nothing at all.
     */
    func testAPhoneWithNoChannelsIsReadAsNoneToChoose() throws {
        let raw = try picture { p in
            p["pedals"] = (p["pedals"] as? [[String: Any]] ?? []).map { (pedal: [String: Any]) -> [String: Any] in
                var bare = pedal
                bare.removeValue(forKey: "channel")
                bare.removeValue(forKey: "channels")
                return bare
            }
        }
        let state = try XCTUnwrap(WatchState.decode(raw), "a picture with no channels was not drawn at all")
        XCTAssertEqual(state.pedals.count, 2)
        XCTAssertNil(state.pedals[0].channel)
        XCTAssertNil(state.pedals[0].channels)
        XCTAssertFalse(state.pedals[0].canPickChannel)
    }

    /* What lets the phone send more, by an update, than a watch already on a wrist knows to read. */
    func testAFieldTheWatchDoesNotKnowIsLeftAlone() throws {
        let raw = try picture { p in
            p["somethingNewer"] = ["x": 1]
            var pedals = p["pedals"] as? [[String: Any]] ?? []
            pedals[0]["somethingNewer"] = "x"
            p["pedals"] = pedals
        }
        XCTAssertNotNil(WatchState.decode(raw))
    }

    func testAPictureItCannotReadIsNotDrawn() {
        XCTAssertNil(WatchState.decode("not json"))
        XCTAssertNil(WatchState.decode(#"{"v":1}"#))
    }

    func testANewerPhoneIsSaidRatherThanMisread() throws {
        var state = try XCTUnwrap(WatchState.decode(try fixture()))
        state.v = WatchState.linkVersion + 1
        XCTAssertTrue(state.tooNew)
    }

    func testTheRequestsAreThePhonesWords() {
        XCTAssertEqual(WatchCommand.hello.json, #"{"do":"hello"}"#)
        XCTAssertEqual(WatchCommand.scene(2).json, #"{"do":"scene","index":2}"#)
        XCTAssertEqual(WatchCommand.pedal(id: 50, on: false).json, #"{"do":"pedal","id":50,"on":false}"#)
        XCTAssertEqual(WatchCommand.preset(step: -1).json, #"{"do":"preset","step":-1}"#)
        XCTAssertEqual(WatchCommand.preset(step: 5).json, #"{"do":"preset","step":1}"#)
        XCTAssertEqual(WatchCommand.tuner(on: true).json, #"{"do":"tuner","on":true}"#)
        XCTAssertEqual(WatchCommand.channel(id: 50, channel: "B").json, #"{"do":"channel","id":50,"channel":"B"}"#)
        XCTAssertEqual(WatchCommand.channel(id: 50, channel: #"a"b"#).json, #"{"do":"channel","id":50,"channel":"a\"b"}"#, "a channel is sent as JSON, not pasted in")
    }

    func testTheNeedleAndTheColours() {
        XCTAssertEqual(needleOffset(cents: 0), 0)
        XCTAssertEqual(needleOffset(cents: 25), 0.5)
        XCTAssertEqual(needleOffset(cents: -80), -1)
        XCTAssertNil(rgb(hex: "nope"))
        let red = rgb(hex: "#ff0000")
        XCTAssertEqual(red?.r, 1)
        XCTAssertEqual(red?.g, 0)
    }

    func testTheDemoAnswersAsThePhoneWould() {
        let s = WatchState.sample
        XCTAssertEqual(s.answering(.scene(3)).scene, 3)
        XCTAssertEqual(s.answering(.scene(99)).scene, s.scene)
        XCTAssertEqual(s.answering(.pedal(id: 70, on: true)).pedals.first { $0.id == 70 }?.on, true)
        XCTAssertEqual(s.answering(.preset(step: 1)).preset.label, "013")
        XCTAssertTrue(s.answering(.tuner(on: true)).tuner.on)
        /* A pedal held in the demo: a channel it has, and not one it has not. */
        let drive = { (state: WatchState) in state.pedals.first { $0.id == 50 } }
        XCTAssertEqual(drive(s)?.channel, "B")
        XCTAssertTrue(drive(s)?.canPickChannel == true)
        XCTAssertEqual(drive(s.answering(.channel(id: 50, channel: "C")))?.channel, "C")
        XCTAssertEqual(drive(s.answering(.channel(id: 50, channel: "Z")))?.channel, "B", "a channel the pedal does not have")
        XCTAssertEqual(s.answering(.channel(id: 99, channel: "C")), s, "a pedal that is not there")
        XCTAssertEqual(drive(s.answering(.pedal(id: 50, on: false)))?.channels, drive(s)?.channels, "switching a pedal lost its channels")
        XCTAssertEqual(drive(s.answering(.pedal(id: 50, on: false)))?.channel, "B")
    }
}

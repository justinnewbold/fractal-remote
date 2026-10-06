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
    }

    func testAPhoneWithNoMetronomeIsReadAsOff() throws {
        var picture = try XCTUnwrap(JSONSerialization.jsonObject(with: Data(try fixture().utf8)) as? [String: Any])
        picture.removeValue(forKey: "metronome")
        let raw = try XCTUnwrap(String(data: try JSONSerialization.data(withJSONObject: picture), encoding: .utf8))
        let state = try XCTUnwrap(WatchState.decode(raw))
        XCTAssertNil(state.metronome)
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
    }
}

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
        XCTAssertEqual(state.pedals.map(\.short), ["DRV", "DLY", "AMP"])
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
        /* An AM4's amp says its boost in Play's words; every other pedal says nothing. */
        XCTAssertEqual(state.pedals.map(\.word), ["", "", "Boost off"])
        XCTAssertEqual(state.pedals.map(\.wordLine), [nil, nil, "Boost off"], "an empty word was drawn")
        XCTAssertFalse(state.pedals[2].on, "Boost off was lit")
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
        XCTAssertEqual(state.pedals.count, 3)
        XCTAssertNil(state.pedals[0].channel)
        XCTAssertNil(state.pedals[0].channels)
        XCTAssertFalse(state.pedals[0].canPickChannel)
    }

    /*
     * A phone that has not had the update that sends an AM4 amp's word: every
     * pedal is still drawn, with no word under any, as before this build.
     */
    func testAPhoneWithNoWordIsDrawnAsBefore() throws {
        let raw = try picture { p in
            p["pedals"] = (p["pedals"] as? [[String: Any]] ?? []).map { (pedal: [String: Any]) -> [String: Any] in
                var bare = pedal
                bare.removeValue(forKey: "word")
                return bare
            }
        }
        let state = try XCTUnwrap(WatchState.decode(raw), "a picture with no words was not drawn at all")
        XCTAssertEqual(state.pedals.count, 3)
        XCTAssertNil(state.pedals[2].word)
        XCTAssertNil(state.pedals[2].wordLine)
        XCTAssertEqual(state.pedals[0].channel, "B", "a picture with no words lost its channels")
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
        /* The demo is an FM3, with no words; CI's boost picture gives its amp the one an AM4's phone sends. */
        XCTAssertTrue(s.pedals.allSatisfy { $0.wordLine == nil })
        let boosted = s.boostDemo
        XCTAssertEqual(boosted.pedals.first { $0.id == 58 }?.wordLine, "Boost off")
        XCTAssertEqual(boosted.pedals.first { $0.id == 58 }?.on, false)
        XCTAssertEqual(boosted.pedals.filter { $0.wordLine != nil }.count, 1, "a pedal other than the amp was given a word")
    }

    /* "We're only using about half the space": an AM4's four share the page, an FM3's eight stay as they were. */
    func testFewTilesShareThePage() {
        /* Four scenes, two rows of two, in a page with 180 points under the heading: (180 - 4) / 2. */
        XCTAssertEqual(fillHeight(count: 4, columns: 2, room: 180, least: 36), 88)
        XCTAssertEqual(fillHeight(count: 3, columns: 2, room: 180, least: 36), 88, "three still take two rows")
        /* Eight scenes, six pedals: the height they always had, however much room is left. */
        XCTAssertEqual(fillHeight(count: 8, columns: 2, room: 180, least: 36), 36)
        XCTAssertEqual(fillHeight(count: 6, columns: 3, room: 180, least: 40), 40)
        /* One or two: one row, the whole room. */
        XCTAssertEqual(fillHeight(count: 2, columns: 2, room: 180, least: 36), 180)
        /* A page too small to share, and nothing to draw: the old height. */
        XCTAssertEqual(fillHeight(count: 4, columns: 2, room: 60, least: 36), 36)
        XCTAssertEqual(fillHeight(count: 0, columns: 2, room: 180, least: 36), 36)
        XCTAssertEqual(fillHeight(count: 4, columns: 2, room: -5, least: 36), 36)
        /* Which pages share: one to four tiles; none and five or more scroll as they always did. */
        XCTAssertTrue(fewTiles(4))
        XCTAssertTrue(fewTiles(1))
        XCTAssertFalse(fewTiles(0))
        XCTAssertFalse(fewTiles(5))
        XCTAssertFalse(fewTiles(8))
        /* The rows: a short last row keeps its tiles' width with an empty place. */
        XCTAssertEqual(tileRows(4, columns: 2), [[0, 1], [2, 3]])
        XCTAssertEqual(tileRows(3, columns: 2), [[0, 1], [2, nil]])
        XCTAssertEqual(tileRows(1, columns: 2), [[0, nil]])
        XCTAssertEqual(tileRows(0, columns: 2), [])
        /* Pedals: two across for an AM4's or a VP4's four, three across from five. */
        XCTAssertEqual(pedalColumns(4), 2)
        XCTAssertEqual(pedalColumns(2), 2)
        XCTAssertEqual(pedalColumns(1), 1, "one pedal alone takes half the page beside an empty half")
        XCTAssertEqual(sceneColumns(8), 2)
        XCTAssertEqual(sceneColumns(4), 2)
        XCTAssertEqual(sceneColumns(1), 1)
        XCTAssertEqual(pedalColumns(5), 3)
        XCTAssertEqual(pedalColumns(6), 3)
        /* Type grows with the tile, from the size it always had. */
        XCTAssertEqual(grownSize(36, share: 0.28, least: 14, most: 24), 14, "an FM3's scene name is the size it was")
        XCTAssertEqual(grownSize(40, share: 0.3, least: 13, most: 24), 13, "and so is its pedal")
        XCTAssertEqual(grownSize(60, share: 0.3, least: 13, most: 24), 18)
        XCTAssertEqual(grownSize(200, share: 0.3, least: 13, most: 24), 24)
        /* A name's longest word fits its tile: never broken on two lines. */
        XCTAssertEqual(wordFitSize("Overdrive", width: 85), 15, "85 / (9 letters x 0.62)")
        XCTAssertEqual(wordFitSize("Big Distortion", width: 85), 13, "the longest word, not the whole name")
        XCTAssertEqual(wordFitSize("", width: 85), .infinity)
        XCTAssertEqual(sceneNameSize("Lead", tall: 85, wide: 85), 23, "a short name grows with its tile")
        XCTAssertEqual(sceneNameSize("Overdrive", tall: 85, wide: 85), 15, "a long word is held to the tile's width")
        XCTAssertEqual(sceneNameSize("Supercalifragilistic", tall: 85, wide: 85), 11, "and never under 11, where the page's shrinking takes over")
        /* CI's AM4 picture is the shape that filled half the page. */
        let am4 = WatchState.sample.am4Demo
        XCTAssertEqual(am4.scenes.count, 4)
        XCTAssertEqual(am4.pedals.count, 4)
        XCTAssertTrue(am4.pedals.allSatisfy { $0.canPickChannel })
        XCTAssertEqual(am4.answering(.scene(3)).scene, 3)
        XCTAssertEqual(am4.answering(.scene(4)).scene, am4.scene, "an AM4 has no fifth scene")
    }
}

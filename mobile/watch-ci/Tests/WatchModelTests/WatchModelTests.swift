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
        XCTAssertEqual(WatchCommand.hello.json, #"{"do":"hello","knows":["pages","tempo","stay","here","quick"]}"#)
        XCTAssertEqual(WatchCommand.here.json, #"{"do":"here"}"#)
        XCTAssertEqual(WatchCommand.tap.json, #"{"do":"tap"}"#)
        XCTAssertEqual(WatchCommand.wrist(on: true).json, #"{"do":"wrist","on":true}"#)
        XCTAssertEqual(WatchCommand.wrist(on: false).json, #"{"do":"wrist","on":false}"#)
        XCTAssertEqual(WatchCommand.scene(2).json, #"{"do":"scene","index":2}"#)
        XCTAssertEqual(WatchCommand.pedal(id: 50, on: false).json, #"{"do":"pedal","id":50,"on":false}"#)
        XCTAssertEqual(WatchCommand.preset(step: -1).json, #"{"do":"preset","step":-1}"#)
        XCTAssertEqual(WatchCommand.preset(step: 5).json, #"{"do":"preset","step":1}"#)
        XCTAssertEqual(WatchCommand.tuner(on: true).json, #"{"do":"tuner","on":true}"#)
        XCTAssertEqual(WatchCommand.channel(id: 50, channel: "B").json, #"{"do":"channel","id":50,"channel":"B"}"#)
        XCTAssertEqual(WatchCommand.channel(id: 50, channel: #"a"b"#).json, #"{"do":"channel","id":50,"channel":"a\"b"}"#, "a channel is sent as JSON, not pasted in")
        /* Quick edit's two: a held pedal's knobs wanted, or let go; and one knob to a place, to three figures. */
        XCTAssertEqual(WatchCommand.knobs(id: 50).json, #"{"do":"knobs","id":50}"#)
        XCTAssertEqual(WatchCommand.knobs(id: nil).json, #"{"do":"knobs","id":null}"#)
        XCTAssertEqual(WatchCommand.knob(id: 50, key: "12", at: 0.62).json, #"{"do":"knob","id":50,"key":"12","at":0.62}"#)
        XCTAssertEqual(WatchCommand.knob(id: 50, key: "12", at: 0.12345).json, #"{"do":"knob","id":50,"key":"12","at":0.123}"#)
        XCTAssertEqual(WatchCommand.knob(id: 50, key: #"a"b"#, at: 7).json, #"{"do":"knob","id":50,"key":"a\"b","at":1.0}"#, "a place past the end of the range was sent, or a key pasted in")
    }

    // MARK: - The watch's pages: which are shown, and in what order

    /*
     * pages.json is written by the phone's own rules (shared/watch-link.mjs,
     * through pagesFixture in test/watch-pages.mjs, which also checks the file
     * still is what they give). So the answers below are the phone's, and a
     * rule changed on one side fails here or there, never on a wrist.
     */
    private struct PagesFixture: Decodable {
        struct Case: Decodable {
            var pages: [String]?
            var hidden: [String]?
            var order: [String]
            var off: [String]
            var shown: [String]
        }
        /* The tuner and leaving its page: what the phone's two rules answer. */
        struct Leaving: Decodable {
            var on: Bool
            var stays: Bool?
            var stops: Bool
        }
        struct Hiding: Decodable {
            var was: [String]
            var now: [String]
            var on: Bool
            var stops: Bool
        }
        struct Tuner: Decodable {
            var leaving: [Leaving]
            var hiding: [Hiding]
        }
        /* The check-in: when one is due, by the phone's own rule. Times in milliseconds. */
        struct Due: Decodable {
            var onScreen: Bool
            var pages: Bool
            var demo: Bool
            var lastSent: Double?
            var now: Double
            var due: Bool
        }
        struct Here: Decodable {
            var everyMs: Double
            var tickMs: Double
            var cases: [Due]
        }
        /* Quick edit: the phone's own answers for where a knob sits, what its value is and how it is written, and how long a turn waits. Times in milliseconds. */
        struct KnobCase: Decodable {
            var at: Double
            var min: Double?
            var max: Double?
            var log: Bool?
            var unit: String?
            var place: Double
            var value: Double?
            var text: String
        }
        struct WaitCase: Decodable {
            var lastSent: Double?
            var now: Double
            var wait: Double
        }
        struct HoldWords: Decodable {
            var channels: String
            var quick: String
        }
        struct Quick: Decodable {
            var everyMs: Double
            var settleMs: Double
            var askMs: Double
            var asks: Int
            var hold: HoldWords
            var knobs: [KnobCase]
            var waits: [WaitCase]
        }
        var cases: [Case]
        var tuner: Tuner
        var here: Here
        var quick: Quick
    }

    private func pagesData() throws -> Data {
        let url = try XCTUnwrap(Bundle.module.url(forResource: "pages", withExtension: "json"))
        return try Data(contentsOf: url)
    }

    private func pagesPicture() throws -> String {
        let object = try XCTUnwrap(JSONSerialization.jsonObject(with: try pagesData()) as? [String: Any])
        let state = try XCTUnwrap(object["state"] as? [String: Any])
        return try XCTUnwrap(String(data: try JSONSerialization.data(withJSONObject: state), encoding: .utf8))
    }

    func testThePagesAreDrawnInTheOrderThePhoneSends() throws {
        let state = try XCTUnwrap(WatchState.decode(try pagesPicture()), "a picture with pages in it was not read at all")
        XCTAssertEqual(state.pages, ["tuner", "scenes", "presets", "tempo", "pedals"])
        XCTAssertEqual(state.hidden, ["presets"])
        XCTAssertEqual(state.order, [.tuner, .scenes, .presets, .tempo, .pedals])
        XCTAssertEqual(state.shown, [.tuner, .scenes, .tempo, .pedals], "a hidden page is drawn, or the order is not the one sent")
        XCTAssertEqual(watchPageOnShow(nil, state.shown), .tuner, "it does not open on the first page of the order chosen")
        /* The rest of the picture is read as it always was. */
        XCTAssertTrue(state.linked)
        XCTAssertEqual(state.nameLine, "Crunch Rhythm")
        XCTAssertEqual(state.scenes.count, 8)

        /* A phone that sends neither (every phone, to a watch that has not said it knows): every page, the usual order, Scenes first. */
        let plain = try XCTUnwrap(WatchState.decode(try fixture()))
        XCTAssertNil(plain.pages)
        XCTAssertNil(plain.hidden)
        XCTAssertEqual(plain.order, WatchPage.usual)
        XCTAssertEqual(plain.shown, [.scenes, .pedals, .presets, .tempo, .tuner])
        XCTAssertEqual(watchPageOnShow(nil, plain.shown), .scenes)
        /* And so does the demo, which CI's pictures are taken of. */
        XCTAssertEqual(WatchState.sample.shown, WatchPage.usual)
    }

    func testAListThatIsNotQuiteRightIsStillPagesToDraw() throws {
        let cases = try JSONDecoder().decode(PagesFixture.self, from: try pagesData()).cases
        XCTAssertGreaterThanOrEqual(cases.count, 12, "the fixture lost its cases")
        for c in cases {
            let said = "pages \(c.pages ?? ["none"]) hidden \(c.hidden ?? ["none"])"
            XCTAssertEqual(watchPageOrder(c.pages).map(\.rawValue), c.order, "the order of \(said)")
            XCTAssertEqual(watchPagesHidden(c.hidden).map(\.rawValue), c.off, "the hidden pages of \(said)")
            XCTAssertEqual(watchPagesShown(c.pages, c.hidden).map(\.rawValue), c.shown, "the pages drawn for \(said)")
            XCTAssertEqual(Set(watchPageOrder(c.pages)), Set(WatchPage.allCases), "\(said) lost a page from the order, or drew one twice")
            XCTAssertEqual(watchPageOrder(c.pages).count, 5)
            XCTAssertFalse(watchPagesShown(c.pages, c.hidden).isEmpty, "\(said) left the watch with no page")
        }
        /* The ones that matter most, said here as well as in the fixture. */
        XCTAssertEqual(watchPagesShown(nil, ["scenes", "pedals", "presets", "tempo", "tuner"]), WatchPage.usual, "hiding every page is hiding none: a watch always has a page")
        XCTAssertEqual(watchPagesShown(["tuner"], ["scenes", "scenes", "looper"]), [.tuner, .pedals, .presets, .tempo])
        /* AN ORDER KEPT FROM BEFORE TEMPO WAS A PAGE names four: Tempo is what is missing, so it comes in after them, shown. */
        XCTAssertEqual(watchPageOrder(["tuner", "scenes", "presets", "pedals"]), [.tuner, .scenes, .presets, .pedals, .tempo])
        XCTAssertEqual(watchPagesShown(["tuner", "scenes", "presets", "pedals"], ["presets"]), [.tuner, .scenes, .pedals, .tempo])
        /* And the four old names hidden, by a list from before it, leave the new page rather than none. */
        XCTAssertEqual(watchPagesShown(nil, ["scenes", "pedals", "presets", "tuner"]), [.tempo])
        XCTAssertEqual(watchPagesHidden(["tuner", "scenes"]), [.scenes, .tuner], "the hidden pages are told in the usual order")
        XCTAssertEqual(watchPagesHidden(["Tuner", " tuner", ""]), [], "a name that is not exactly a page's was taken for one")

        /* And through a picture: names the watch does not know are dropped, never the picture. */
        let raw = try picture { p in
            p["pages"] = ["tuner", "looper", "tuner"]
            p["hidden"] = ["scenes", "nope", "scenes"]
        }
        let state = try XCTUnwrap(WatchState.decode(raw), "a picture with a page the watch does not know was not drawn at all")
        XCTAssertEqual(state.shown, [.tuner, .pedals, .presets, .tempo])
        let all = try picture { p in p["hidden"] = ["scenes", "pedals", "presets", "tempo", "tuner"] }
        XCTAssertEqual(try XCTUnwrap(WatchState.decode(all)).shown, WatchPage.usual)
    }

    func testAPageHiddenUnderTheWatchGoesToTheFirstShown() {
        /* Still shown: the page swiped to stays, wherever a new order puts it. */
        XCTAssertEqual(watchPageOnShow(.presets, [.tuner, .presets, .scenes]), .presets)
        XCTAssertEqual(watchPageOnShow(.scenes, [.tuner, .scenes]), .scenes)
        /* Hidden while on it, and before any swipe: the first shown page. */
        XCTAssertEqual(watchPageOnShow(.presets, [.tuner, .scenes]), .tuner)
        XCTAssertEqual(watchPageOnShow(nil, [.pedals, .scenes]), .pedals)
        XCTAssertEqual(watchPageOnShow(nil, []), .scenes, "no list at all still has a page to name")
        /* CI's -page N is the page it has always been, by name, whatever order is chosen: 3 is still the tuner, and Tempo, which came later, is 4. */
        XCTAssertEqual(WatchPage.numbered(0), .scenes)
        XCTAssertEqual(WatchPage.numbered(1), .pedals)
        XCTAssertEqual(WatchPage.numbered(2), .presets)
        XCTAssertEqual(WatchPage.numbered(3), .tuner)
        XCTAssertEqual(WatchPage.numbered(4), .tempo)
        XCTAssertNil(WatchPage.numbered(5))
        XCTAssertNil(WatchPage.numbered(-1))
        XCTAssertEqual(Set(WatchPage.numbers), Set(WatchPage.allCases), "a page has no number for CI to ask for it by")
        XCTAssertEqual(WatchPage.usual.last, .tuner, "the tuner is no longer last in the usual order")
        XCTAssertEqual(watchPageOnShow(WatchPage.numbered(3), [.tuner, .scenes, .presets, .pedals]), .tuner, "-page 3 is not the tuner in another order")
    }

    func testHidingTheTunersPageTurnsTheTunerOffWhateverTheSwitchSays() throws {
        let hiding = try JSONDecoder().decode(PagesFixture.self, from: try pagesData()).tuner.hiding
        XCTAssertGreaterThanOrEqual(hiding.count, 6, "the fixture lost its cases")
        let pages = { (names: [String]) in names.compactMap { WatchPage(rawValue: $0) } }
        for c in hiding {
            XCTAssertEqual(watchTunerStopsOnHiding(was: pages(c.was), now: pages(c.now), tunerOn: c.on), c.stops, "the tuner \(c.on ? "on" : "off"), its pages from \(c.was) to \(c.now)")
        }
        /* The tuner's page was shown, is not now, and the tuner is on: off, there being no page left to stop it from. */
        XCTAssertTrue(watchTunerStopsOnHiding(was: WatchPage.usual, now: [.scenes, .pedals, .presets, .tempo], tunerOn: true))
        /* Nothing to turn off; or its page is still there (a new order, another page hidden); or it was hidden already. */
        XCTAssertFalse(watchTunerStopsOnHiding(was: WatchPage.usual, now: [.scenes], tunerOn: false))
        XCTAssertFalse(watchTunerStopsOnHiding(was: WatchPage.usual, now: [.tuner, .scenes], tunerOn: true))
        XCTAssertFalse(watchTunerStopsOnHiding(was: [.scenes], now: [.scenes, .pedals], tunerOn: true))
    }

    /* "Some people wanna play while their tuner stays up on their screen": the iPhone's switch, off unless it says on. */
    func testLeavingTheTunersPageTurnsItOffUnlessTheIPhoneSaysItStays() throws {
        let leaving = try JSONDecoder().decode(PagesFixture.self, from: try pagesData()).tuner.leaving
        XCTAssertEqual(leaving.count, 6, "the fixture lost its cases")
        for c in leaving {
            XCTAssertEqual(watchTunerStopsOnLeaving(tunerOn: c.on, stays: c.stays), c.stops, "the tuner \(c.on ? "on" : "off"), stays \(String(describing: c.stays))")
        }
        /* Said here as well: on and not told to stay, off; told to stay, left alone; nothing to turn off, nothing sent. */
        XCTAssertTrue(watchTunerStopsOnLeaving(tunerOn: true, stays: nil), "a phone that says nothing left the tuner on behind a swipe")
        XCTAssertTrue(watchTunerStopsOnLeaving(tunerOn: true, stays: false))
        XCTAssertFalse(watchTunerStopsOnLeaving(tunerOn: true, stays: true))
        XCTAssertFalse(watchTunerStopsOnLeaving(tunerOn: false, stays: nil))

        /* In the picture: pages.json's says it stays; one that says nothing (every phone, to a watch that has not said it knows) is off. */
        XCTAssertEqual(try XCTUnwrap(WatchState.decode(try pagesPicture())).tunerStays, true)
        XCTAssertNil(try XCTUnwrap(WatchState.decode(try fixture())).tunerStays)
        XCTAssertNil(WatchState.sample.tunerStays, "the demo, which CI pictures, leaves the tuner on behind a swipe")
        let odd = try picture { p in p["tunerStays"] = false }
        XCTAssertEqual(try XCTUnwrap(WatchState.decode(odd)).tunerStays, false)
    }

    func testTheWatchSaysWhatItKnows() throws {
        XCTAssertEqual(WatchCommand.knows, ["pages", "tempo", "stay", "here", "quick"])
        let hello = try XCTUnwrap(JSONSerialization.jsonObject(with: Data(WatchCommand.hello.json.utf8)) as? [String: Any])
        XCTAssertEqual(hello["do"] as? String, "hello")
        XCTAssertEqual(hello["knows"] as? [String], WatchCommand.knows, "the hello does not say what the watch knows, so the phone never offers its pages")
        /* No other request says it. */
        XCTAssertFalse(WatchCommand.tuner(on: true).json.contains("knows"))
        XCTAssertFalse(WatchCommand.scene(0).json.contains("knows"))
    }

    // MARK: - The Tempo page

    func testTheTempoPageSaysWhatThePhoneSays() throws {
        /* pages.json's picture carries one: 121.4, Tap offered, the wrist's switch on, the metronome not running. */
        let state = try XCTUnwrap(WatchState.decode(try pagesPicture()))
        XCTAssertEqual(state.tempo, WatchTempo(bpm: 121.4, tap: true, why: "", wrist: true, running: false))
        XCTAssertEqual(tempoNumber(state.tempo?.bpm), "121", "the number is not the whole one the iPhone's Tap button shows")
        /* No tempo known: a dash, never a nought. */
        XCTAssertEqual(tempoNumber(nil), "—")
        XCTAssertEqual(tempoNumber(0), "—")
        XCTAssertEqual(tempoNumber(-4), "—")
        XCTAssertEqual(tempoNumber(.nan), "—")
        XCTAssertEqual(tempoNumber(.infinity), "—")
        XCTAssertEqual(tempoNumber(89.6), "90")

        /* A phone that sends none (any phone, to a watch that has not said it has the page): no tempo, and nothing lost. */
        let plain = try XCTUnwrap(WatchState.decode(try fixture()))
        XCTAssertNil(plain.tempo)
        XCTAssertEqual(tempoNumber(plain.tempo?.bpm), "—")

        /* Where the iPhone's Tap sends nothing: the phone says so, with its sentence, and no tempo is a null. */
        let none = try picture { p in
            p["tempo"] = ["bpm": NSNull(), "tap": false, "why": "The app can’t set this unit’s tempo yet. Tap tempo on the unit itself for now.", "wrist": false, "running": true] as [String: Any]
        }
        let refused = try XCTUnwrap(WatchState.decode(none), "a picture with no tempo number was not drawn at all")
        XCTAssertEqual(refused.tempo?.tap, false)
        XCTAssertNil(refused.tempo?.bpm)
        XCTAssertEqual(refused.tempo?.why, "The app can’t set this unit’s tempo yet. Tap tempo on the unit itself for now.")
        XCTAssertEqual(refused.tempo?.running, true)
        /* A field the watch has not heard of yet, and ones a later phone leaves out: still read. */
        let bare = try picture { p in p["tempo"] = ["tap": true, "somethingNewer": 1] as [String: Any] }
        let read = try XCTUnwrap(WatchState.decode(bare), "a tempo with fields missing lost the whole picture")
        XCTAssertEqual(read.tempo, WatchTempo(tap: true))
    }

    func testATapIsSentOnceAndTheSwitchIsOnlyTheWrists() {
        /* A tap is a beat: never tried a second time, a second late. Everything else may be. */
        XCTAssertTrue(WatchCommand.tap.once)
        XCTAssertTrue(WatchCommand.here.once, "a check-in that did not go is tried again, when the next is two seconds off")
        for other in [WatchCommand.hello, .scene(1), .pedal(id: 50, on: true), .preset(step: 1), .tuner(on: false), .channel(id: 50, channel: "B"), .wrist(on: true)] {
            XCTAssertFalse(other.once, "\(other.json) is sent once only")
        }
        /* Quick edit's two as well: a turn tried again a second later would land over a newer one, and an unanswered sheet asks again by itself. */
        XCTAssertTrue(WatchCommand.knob(id: 50, key: "1", at: 0.5).once, "a turn that did not go is tried again a second later, over a newer one")
        XCTAssertTrue(WatchCommand.knobs(id: 50).once)
        XCTAssertTrue(WatchCommand.knobs(id: nil).once)
        /* The demo: the switch moves the wrist's setting and nothing else; a tap moves nothing, there being no unit to count it. */
        let s = WatchState.sample
        XCTAssertEqual(s.tempo, WatchTempo(bpm: 120, tap: true, why: "", wrist: false, running: false))
        var on = s
        on.tempo?.wrist = true
        XCTAssertEqual(s.answering(.wrist(on: true)), on)
        XCTAssertEqual(s.answering(.wrist(on: true)).answering(.wrist(on: false)), s)
        XCTAssertEqual(s.answering(.tap), s)
        XCTAssertEqual(s.answering(.wrist(on: true)).metronome, s.metronome, "the wrist's switch started the metronome")
    }

    /* "Where it says tuner on I feel like that means it on": the screen says the state, the buttons say what a tap does. */
    func testTheTunerPagesWordsSayWhatATapDoes() {
        XCTAssertEqual(TunerWords.off, "Off")
        XCTAssertEqual(TunerWords.offSpoken, "Tuner is off")
        XCTAssertEqual(TunerWords.start, "Start tuning")
        XCTAssertEqual(TunerWords.stop, "Stop tuning")
        /* A button's words are never a state, and nothing on the off screen says "on". */
        for words in [TunerWords.start, TunerWords.stop] {
            XCTAssertFalse(words.hasPrefix("Tuner"), "“\(words)” reads as what the tuner is, not what a tap does")
        }
        for words in [TunerWords.off, TunerWords.offSpoken, TunerWords.start] {
            XCTAssertFalse(words.lowercased().split(separator: " ").contains("on"), "“\(words)” says on while the tuner is off")
        }
    }

    // MARK: - The check-in

    /* While the watch app is on its screen it says "here" every twenty seconds, so the iPhone stays awake while it is looked at. */
    func testACheckInIsDueOnlyOnScreenWithThePagesUp() throws {
        let here = try JSONDecoder().decode(PagesFixture.self, from: try pagesData()).here
        XCTAssertEqual(here.everyMs, watchHereSeconds * 1000, "the watch and the phone count the check-in differently")
        XCTAssertEqual(here.tickMs, watchHereTick * 1000)
        XCTAssertGreaterThanOrEqual(here.cases.count, 12, "the fixture lost its cases")
        let at = { (ms: Double) in Date(timeIntervalSince1970: ms / 1000) }
        for c in here.cases {
            XCTAssertEqual(
                watchHereDue(onScreen: c.onScreen, pagesUp: c.pages, demo: c.demo, lastSent: c.lastSent.map(at), now: at(c.now)),
                c.due,
                "on screen \(c.onScreen), pages \(c.pages), demo \(c.demo), last sent \(String(describing: c.lastSent)), now \(c.now)"
            )
        }
        /* Said here as well, with the clock handed in. */
        let start = Date(timeIntervalSince1970: 1_000_000)
        let due = { (onScreen: Bool, pagesUp: Bool, demo: Bool, after: Double?) in
            watchHereDue(onScreen: onScreen, pagesUp: pagesUp, demo: demo, lastSent: after == nil ? nil : start, now: start.addingTimeInterval(after ?? 0))
        }
        XCTAssertFalse(due(true, true, false, 19.9), "a check-in went before its twenty seconds")
        XCTAssertTrue(due(true, true, false, 20))
        XCTAssertTrue(due(true, true, false, 600), "a wrist raised after ten minutes sends none")
        XCTAssertTrue(due(true, true, false, nil), "nothing sent yet, and none is due")
        /* THE WRIST DOWN: never, however long it has been. So the iPhone sleeps 25 seconds after the watch's screen goes off. */
        XCTAssertFalse(due(false, true, false, 600), "the watch checks in with its screen off, and the iPhone never sleeps")
        /* The waiting page, and the demo: never. */
        XCTAssertFalse(due(true, false, false, 600))
        XCTAssertFalse(due(true, true, true, 600))
        /* The demo answers one with nothing. */
        XCTAssertEqual(WatchState.sample.answering(.here), WatchState.sample)
        /* And the waiting page's line for an app that was swiped closed. */
        XCTAssertEqual(WaitingWords.closed, "If it was swiped closed, open it again.")
    }

    // MARK: - Quick edit

    /* "Can we set up quick edits on that as well? And change the name to hold to quick edit?" The line under the pedals says so only where the iPhone offers it. */
    func testTheLineUnderThePedalsSaysQuickEditOnlyWhereTheIPhoneOffersIt() throws {
        let words = try JSONDecoder().decode(PagesFixture.self, from: try pagesData()).quick.hold
        XCTAssertEqual(PedalWords.channels, words.channels, "the watch and the phone say the hold differently")
        XCTAssertEqual(PedalWords.quick, words.quick)
        XCTAssertEqual(PedalWords.channels, "Hold a pedal for its channels.")
        XCTAssertEqual(PedalWords.quick, "Hold a pedal for quick edit.")
        XCTAssertEqual(pedalHoldLine(quickEdit: true), "Hold a pedal for quick edit.")
        /* Not offered, or not said at all (every phone, to a watch that has not said it knows): the words it always had. */
        XCTAssertEqual(pedalHoldLine(quickEdit: false), "Hold a pedal for its channels.")
        XCTAssertEqual(pedalHoldLine(quickEdit: nil), "Hold a pedal for its channels.")
        XCTAssertEqual(pedalHoldLine(quickEdit: WatchState.sample.quickEdit), "Hold a pedal for its channels.", "the demo, which CI pictures, says quick edit without being asked to")
        XCTAssertEqual(pedalHoldLine(quickEdit: WatchState.sample.quickDemo.quickEdit), "Hold a pedal for quick edit.")
    }

    func testTheQuickEditSheetReadsThePhonesKnobs() throws {
        /* pages.json's picture offers quick edit, with Drive 1's sheet open on two knobs. */
        let state = try XCTUnwrap(WatchState.decode(try pagesPicture()), "a picture with quick edit in it was not read at all")
        XCTAssertEqual(state.quickEdit, true)
        let open = try XCTUnwrap(state.quick)
        XCTAssertEqual(open.id, 50)
        XCTAssertEqual(open.knobs?.map(\.key), ["11", "12"])
        XCTAssertEqual(open.knobs?.map(\.name), ["Drive", "Low Cut"])
        XCTAssertEqual(open.knobs?.map(\.text), ["6.20", "632.46 Hz"])
        XCTAssertEqual(open.knobs?.first, WatchKnob(key: "11", at: 0.62, name: "Drive", text: "6.20", min: 0, max: 10, log: false, unit: ""))
        XCTAssertEqual(open.knobs?.last?.log, true)
        /* Only for the pedal it is for: another pedal's sheet is still reading. */
        XCTAssertEqual(watchQuickFor(state.quick, pedal: 50), open)
        XCTAssertNil(watchQuickFor(state.quick, pedal: 70))
        XCTAssertNil(watchQuickFor(nil, pedal: 50))

        /* A phone that says nothing of it (every phone, to a watch that has not said it knows): no quick edit, and nothing lost. */
        let plain = try XCTUnwrap(WatchState.decode(try fixture()))
        XCTAssertNil(plain.quickEdit)
        XCTAssertNil(plain.quick)
        XCTAssertNil(WatchState.sample.quickEdit)

        /* Fields a later phone leaves out, and ones the watch has not heard of: still read, never the whole picture lost. */
        let bare = try picture { p in
            p["quickEdit"] = true
            p["quick"] = ["id": 50, "somethingNewer": 1, "knobs": [["key": "3", "at": 0.25, "somethingNewer": "x"] as [String: Any]]] as [String: Any]
        }
        let read = try XCTUnwrap(WatchState.decode(bare), "a knob with fields missing lost the whole picture")
        XCTAssertEqual(read.quick?.knobs, [WatchKnob(key: "3", at: 0.25)])
        XCTAssertEqual(read.quick?.knobs?.first?.shown(turned: nil), "", "a knob with no words was given some")
        XCTAssertEqual(read.quick?.knobs?.first?.shown(turned: 0.5), "", "a knob with no range was given a number the watch made up")
        let none = try picture { p in
            p["quickEdit"] = true
            p["quick"] = ["id": 50] as [String: Any]
        }
        XCTAssertNil(try XCTUnwrap(WatchState.decode(none)).quick?.knobs)
        let empty = try picture { p in
            p["quickEdit"] = false
            p["quick"] = ["id": 50, "knobs": [] as [Any]] as [String: Any]
        }
        XCTAssertEqual(try XCTUnwrap(WatchState.decode(empty)).quick?.knobs, [])
    }

    /* The number beside a knob while the Crown is ahead of the iPhone is worked out by the iPhone's own rule. */
    func testAKnobsNumberIsWrittenAsThePhoneWritesIt() throws {
        let quick = try JSONDecoder().decode(PagesFixture.self, from: try pagesData()).quick
        XCTAssertGreaterThanOrEqual(quick.knobs.count, 14, "the fixture lost its cases")
        for c in quick.knobs {
            let said = "at \(c.at) in \(String(describing: c.min)) to \(String(describing: c.max)), log \(String(describing: c.log)), unit \(String(describing: c.unit))"
            XCTAssertEqual(watchKnobAt(c.at), c.place, accuracy: 0.0000001, "the place of \(said)")
            let value = watchKnobValue(at: c.at, low: c.min, high: c.max, curved: c.log)
            if let want = c.value {
                XCTAssertEqual(try XCTUnwrap(value, "no value for \(said)"), want, accuracy: 0.0000001, "the value of \(said)")
            } else {
                XCTAssertNil(value, "a value for \(said), which has no range")
            }
            XCTAssertEqual(watchKnobText(value, unit: c.unit), c.text, "the words for \(said)")
            /* And through a knob's own row: turned there it says the same; with no range, the iPhone's words stay. */
            let knob = WatchKnob(key: "k", at: 0, name: "Knob", text: "as the iPhone said", min: c.min, max: c.max, log: c.log, unit: c.unit)
            XCTAssertEqual(knob.shown(turned: c.at), c.value == nil ? "as the iPhone said" : c.text, "the row for \(said)")
            XCTAssertEqual(knob.shown(turned: nil), "as the iPhone said")
            XCTAssertEqual(knob.place(turned: c.at), c.place, accuracy: 0.0000001)
        }
        /* Said here as well. */
        XCTAssertEqual(watchKnobText(6.2, unit: ""), "6.20")
        XCTAssertEqual(watchKnobText(-3, unit: "dB"), "-3.00 dB")
        XCTAssertEqual(watchKnobText(100, unit: "%"), "100.00 %")
        XCTAssertEqual(watchKnobText(20000, unit: "Hz"), "20000 Hz")
        XCTAssertEqual(watchKnobText(nil, unit: nil), "—")
        XCTAssertEqual(watchKnobText(.nan, unit: "dB"), "— dB")
        XCTAssertEqual(watchKnobAt(-4), 0)
        XCTAssertEqual(watchKnobAt(4), 1)
        XCTAssertEqual(watchKnobAt(.nan), 0)
        XCTAssertNil(watchKnobValue(at: 0.5, low: 3, high: 3, curved: false), "a knob with no room in its range was given a value")
        XCTAssertNil(watchKnobValue(at: 0.5, low: nil, high: 10, curved: nil))
        XCTAssertEqual(watchKnobValue(at: 0.5, low: 0, high: 10, curved: true), 5, "a logarithmic scale from nought is a straight line, as on the iPhone")
    }

    func testTheCrownTurnsThePickedKnobAndATurnGoesAtMostTenTimesASecond() throws {
        let quick = try JSONDecoder().decode(PagesFixture.self, from: try pagesData()).quick
        XCTAssertEqual(quick.everyMs, watchKnobSeconds * 1000, "the watch and the phone pace a turn differently")
        XCTAssertEqual(quick.settleMs, watchKnobSettle * 1000)
        XCTAssertEqual(quick.askMs, watchKnobsAskSeconds * 1000)
        XCTAssertEqual(quick.asks, watchKnobsAsks)
        XCTAssertGreaterThanOrEqual(quick.waits.count, 6, "the fixture lost its cases")
        let at = { (ms: Double) in Date(timeIntervalSince1970: ms / 1000) }
        for c in quick.waits {
            XCTAssertEqual(watchKnobWait(lastSent: c.lastSent.map(at), now: at(c.now)) * 1000, c.wait, accuracy: 0.5, "last sent \(String(describing: c.lastSent)), now \(c.now)")
        }
        /* Said here as well: none sent yet goes now; one just sent waits its tenth of a second and no longer. */
        let start = Date(timeIntervalSince1970: 1_000_000)
        XCTAssertEqual(watchKnobWait(lastSent: nil, now: start), 0)
        XCTAssertEqual(watchKnobWait(lastSent: start, now: start), 0.1, accuracy: 0.0001)
        XCTAssertEqual(watchKnobWait(lastSent: start, now: start.addingTimeInterval(0.2)), 0)
        XCTAssertEqual(watchKnobWait(lastSent: start.addingTimeInterval(5), now: start), 0.1, accuracy: 0.0001, "a clock put back holds a turn for longer than a tenth of a second")

        /* THE PICKED KNOB: the first when the sheet opens, the one tapped while it is still listed, and the first again when it is not. */
        let knobs = WatchState.demoQuick(id: 50).knobs ?? []
        XCTAssertEqual(knobs.map(\.name), ["Drive", "Tone", "Mix", "Low Cut"])
        XCTAssertEqual(watchKnobPicked(knobs, nil)?.key, "1", "the first knob is not picked when the sheet opens")
        XCTAssertEqual(watchKnobPicked(knobs, "3")?.name, "Mix")
        XCTAssertEqual(watchKnobPicked(knobs, "99")?.key, "1")
        XCTAssertNil(watchKnobPicked([], "1"))
        /* The demo's own words are what the rule writes, so CI's picture is of numbers a real iPhone would send. */
        for knob in knobs {
            XCTAssertEqual(knob.shown(turned: knob.at), knob.text, "the demo's \(knob.name ?? "") says a number the rule would not write")
        }
    }

    func testTheDemoAnswersQuickEditAsThePhoneWould() {
        /* Not offered: asking for a pedal's knobs gets none, as a phone that does not offer it refuses. */
        let s = WatchState.sample
        XCTAssertNil(s.answering(.knobs(id: 50)).quick)
        /* Offered (CI's -quickDemo): a held pedal's knobs, only for a pedal a hold opens, let go when the sheet closes. */
        let q = s.quickDemo
        XCTAssertEqual(q.quickEdit, true)
        XCTAssertNil(q.quick, "the knobs are there before any pedal is held")
        let open = q.answering(.knobs(id: 50))
        XCTAssertEqual(open.quick?.id, 50)
        XCTAssertEqual(open.quick?.knobs?.count, 4)
        XCTAssertNil(q.answering(.knobs(id: 99)).quick, "a pedal that is not there")
        XCTAssertNil(open.answering(.knobs(id: nil)).quick)
        /* A turn: that knob only, to that place, with its number written by the rule. */
        let turned = open.answering(.knob(id: 50, key: "1", at: 0.8))
        XCTAssertEqual(turned.quick?.knobs?.first?.at, 0.8)
        XCTAssertEqual(turned.quick?.knobs?.first?.text, "8.00")
        XCTAssertEqual(turned.quick?.knobs?.dropFirst().map(\.text), ["5.00", "100.00 %", "632.46 Hz"], "a turn moved another knob")
        XCTAssertEqual(open.answering(.knob(id: 50, key: "4", at: 1)).quick?.knobs?.last?.text, "20000 Hz")
        XCTAssertEqual(open.answering(.knob(id: 50, key: "99", at: 0.1)), open, "a knob the sheet does not list")
        XCTAssertEqual(open.answering(.knob(id: 70, key: "1", at: 0.1)), open, "a knob of a pedal whose sheet is not open")
        XCTAssertEqual(q.answering(.knob(id: 50, key: "1", at: 0.1)), q, "a turn with no sheet open")
        /* And nothing else moved: the pedals, their channels and the rest of the picture. */
        XCTAssertEqual(turned.pedals, s.pedals)
        XCTAssertEqual(turned.scene, s.scene)
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

    /* "Have the watch outside edge flash with the same as the tempo": the light follows the screen's corners, near enough, on every size of watch. */
    func testTheBeatsLightFollowsTheScreensCorners() {
        XCTAssertEqual(watchEdgeRadius(width: 162), 32, "a 40 mm watch")
        XCTAssertEqual(watchEdgeRadius(width: 198), 40, "a 45 mm watch")
        XCTAssertEqual(watchEdgeRadius(width: 205), 41, "an Ultra")
        XCTAssertEqual(watchEdgeRadius(width: 20), 12, "never sharper than the line is thick")
        XCTAssertEqual(watchEdgeRadius(width: 0), 0)
        XCTAssertEqual(watchEdgeRadius(width: .nan), 0)
        XCTAssertTrue(watchEdgeRadius(width: 208) >= watchEdgeRadius(width: 184), "a wider screen is no sharper")
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

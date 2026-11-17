import SwiftUI
import WatchKit

private func tap() {
    WKInterfaceDevice.current().play(.click)
}

extension Color {
    init(hex: String, fallback: Color) {
        if let c = rgb(hex: hex) { self = Color(red: c.r, green: c.g, blue: c.b) } else { self = fallback }
    }
}

/** The app's own green: lit, in tune. */
private let signal = Color(red: 0.36, green: 0.85, blue: 0.47)
/** Quick edit's amber (#F5A623): the outline of the knob the Crown turns, and its value, as the mockup. */
private let amber = Color(red: 0.961, green: 0.651, blue: 0.137)

/*
 * A PAGE OF FEW TILES TAKES HALF THE WATCH'S BOTTOM MARGIN. The first try left
 * an eighth of the screen empty under an AM4's scenes: the margin watchOS
 * keeps clear at the bottom, for the screen's rounded corners. Half of it is
 * still clear of them with the tiles' own rounded corners, and the tiles
 * stretch into it; not where the pedals' line is the lowest thing on the
 * page (PedalsPage, fewPedals).
 */
private let bottomShare: CGFloat = 0.5
/** A page's heading ("SCENES", "PEDALS") and the gap under it, near enough, for the size of the type. */
private let headingRoom: Double = 20
/** The line under the pedals and the gap over it, near enough, for the size of the type. */
private let footRoom: Double = 22

// MARK: - Scenes

/*
 * Eight buttons, two to a row, the one that is on lit. A tap lights the new
 * one at once and the phone's answer confirms it; if the phone says otherwise
 * within two seconds, its answer wins.
 *
 * Four or fewer (an AM4's, a VP4's) share the whole page, and their names
 * grow with them, on two lines where one is too long (Model.swift,
 * fillHeight). Eight are the size they always were.
 */
struct ScenesPage: View {
    let state: WatchState
    @EnvironmentObject private var link: PhoneLink
    @State private var pending: Int?

    private var lit: Int { pending ?? state.scene }

    /*
     * The page is a Group, not a GeometryReader, so that with five or more it
     * is the very ScrollView it always was, which is what the page turn and
     * the Digital Crown work through. Only a page of few is measured.
     */
    var body: some View {
        Group {
            if fewTiles(state.scenes.count) {
                GeometryReader { geo in
                    fewScenes(geo)
                }
            } else {
                ScrollView {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("SCENES").font(.caption2).foregroundStyle(.secondary)
                        LazyVGrid(columns: [GridItem(.flexible(), spacing: 4), GridItem(.flexible(), spacing: 4)], spacing: 4) {
                            ForEach(Array(state.scenes.enumerated()), id: \.offset) { index, _ in
                                sceneButton(index, tall: 36, fill: false)
                            }
                        }
                        if state.scenes.isEmpty {
                            Text("This preset has no scenes.").font(.footnote).foregroundStyle(.secondary)
                        }
                    }
                }
            }
        }
        .onChange(of: state.scene) { _, _ in pending = nil }
    }

    /** Four or fewer: the rows stretch to the page, and the type is sized for what they come to. */
    private func fewScenes(_ geo: GeometryProxy) -> some View {
        let columns = sceneColumns(state.scenes.count)
        let extra = geo.safeAreaInsets.bottom * bottomShare
        let tall = fillHeight(count: state.scenes.count, columns: columns, room: Double(geo.size.height + extra) - headingRoom, least: 36)
        /* A tile's width, less the gaps between tiles and the name's own padding: what its longest word has to fit. */
        let wide = (Double(geo.size.width) - 4 * Double(columns - 1)) / Double(columns) - 8
        return VStack(alignment: .leading, spacing: 4) {
            Text("SCENES").font(.caption2).foregroundStyle(.secondary)
            VStack(spacing: 4) {
                ForEach(Array(tileRows(state.scenes.count, columns: columns).enumerated()), id: \.offset) { _, row in
                    HStack(spacing: 4) {
                        ForEach(Array(row.enumerated()), id: \.offset) { _, index in
                            if let index {
                                sceneButton(index, tall: tall, fill: true, wide: wide)
                            } else {
                                Color.clear.frame(maxWidth: .infinity, maxHeight: .infinity)
                            }
                        }
                    }
                }
            }
        }
        .padding(.bottom, -extra)
    }

    /*
     * One scene's button: 36 points and one line, as it always was, or
     * (`fill`) as tall as its row. A name of two words or more may take two
     * lines there; one word stays on one line, since a second line would
     * only break it in the middle ("Overdriv", "e"). And its type is never
     * bigger than lets its longest word fit the tile's width (`wide`,
     * Model.swift wordFitSize), so no word is broken on two lines either.
     */
    private func sceneButton(_ index: Int, tall: Double, fill: Bool, wide: Double = 0) -> some View {
        Button {
            tap()
            pending = index
            link.send(.scene(index))
            DispatchQueue.main.asyncAfter(deadline: .now() + 2) { if pending == index { pending = nil } }
        } label: {
            Text(state.scenes[index])
                .font(.system(size: fill ? sceneNameSize(state.scenes[index], tall: tall, wide: wide) : 14, weight: .semibold))
                .lineLimit(fill && state.scenes[index].contains(" ") ? 2 : 1)
                .multilineTextAlignment(.center)
                .minimumScaleFactor(0.7)
                .padding(.horizontal, fill ? 4 : 0)
                .frame(maxWidth: .infinity, minHeight: 36, maxHeight: fill ? CGFloat.infinity : nil)
                .foregroundStyle(index == lit ? Color.black : Color.white)
                .background(index == lit ? signal : Color.white.opacity(0.14), in: RoundedRectangle(cornerRadius: 8))
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(index == lit ? .isSelected : [])
    }
}

// MARK: - Pedals

/*
 * The stage screen's pedals: lit in the block's own colour when on, an outline
 * in it when off. A tap switches it, as on the phone.
 *
 * HOLD ONE FOR ITS CHANNELS. Justin, 13 October 2026: "Can I add the tap to
 * hold on the effects switches on the watch where you can switch through the
 * channels?" As on the phone's Play screen: a hold (the phone's 450 ms) opens
 * the pedal's channels, the one it is on lit, and a tap on one switches it
 * and closes them. The letter it is on sits in the tile's corner, as on the
 * phone. Only where the phone offers them (canPickChannel): none while its
 * chain is still an outline, and none from a phone that has not had the
 * update that sends them, where a hold does nothing, as it always did.
 *
 * The line under the pedals that says so is here rather than in the phone's
 * watch tips: the phone's words reach every phone by an update, and a watch
 * from before this build cannot do it. This line is only ever on a watch
 * that can.
 *
 * AND WHERE THE IPHONE OFFERS QUICK EDIT, THE HOLD IS QUICK EDIT. Justin, 12
 * November 2026: "On the watch, we have pushed to hold on the channels to
 * switch amps. Can we set up quick edits on that as well? And change the
 * name to hold to quick edit?" and, of three pictures, "For the watch, mock
 * up B." Where the picture says `quickEdit`, the line reads "Hold a pedal
 * for quick edit." and the hold opens QuickSheet, below: the channels in
 * one row, then the block's knobs. Where it does not (a phone that has not
 * had the update, a unit or connection the iPhone's own Edit page is closed
 * on, a VP4, an account it is not open to), the line and the sheet are the
 * ones they always were: the same hold, the same pedals (canPickChannel).
 *
 * AN AM4'S AMP SAYS ITS BOOST under its name, in Play's own words: Boost on,
 * Boost off, or Amp off when the amp itself is off in that scene, and nothing
 * until the unit has said (the word is the phone's, WatchPedal.word). Its
 * tile is lit for Boost on and dark otherwise, as it already was; the word
 * says which dark it is. Every other pedal has no word and is drawn as
 * before. A tap still lights or darkens it at once, and its word waits for
 * the phone's answer rather than saying the old boost under the new light.
 * So does a channel picked from the hold: an AM4's boost is the channel's
 * own, and the phone's Play tile has no word for the new channel until its
 * boost is read, so the wrist does not keep the old channel's word beside the
 * new letter. Picked again, the channel it is on keeps its word, as on Play.
 *
 * FOUR OR FEWER ARE TWO ACROSS AND SHARE THE PAGE, as the scenes do, their
 * letters growing with them (Model.swift, fillHeight and pedalColumns): an
 * AM4's four filled half a row of three. Five or more are three across at
 * the size they always were.
 */
struct PedalsPage: View {
    let state: WatchState
    @EnvironmentObject private var link: PhoneLink
    @State private var pending: [Int: Bool] = [:]
    @State private var pendingChannel: [Int: String] = [:]
    /*
     * Whose channels are open, by id: looked up in each new picture, so never
     * an old copy. The sheet is opened BY this (sheet(item:)), not by a
     * separate yes-or-no beside it: with the two apart, the sheet was drawn
     * from the picture before the hold had said whose it was, and CI's
     * picture of it came out as a blurred page with nothing on it. Handed in
     * with the sheet, the pedal is there when the sheet is.
     */
    @State private var picking: Picked?
    /** A hold has just opened them; the tap that letting go can make is not a switch. */
    @State private var held = false

    /** One pedal's tile, as the phone last said it or as the wrist has just switched it. */
    private func tile(_ pedal: WatchPedal, tall: Double, fill: Bool) -> some View {
        PedalTile(
            pedal: pedal,
            on: pending[pedal.id] ?? pedal.on,
            channel: pendingChannel[pedal.id] ?? pedal.channel,
            word: wordNow(pedal),
            tall: tall,
            fill: fill,
            press: { press(pedal) },
            hold: { hold(pedal) },
            open: { show(pedal.id) }
        )
    }

    /** This picture's copy of a pedal whose channels can be picked. */
    private func offered(_ id: Int) -> WatchPedal? {
        state.pedals.first { $0.id == id && $0.canPickChannel }
    }

    /** Whether the line under the pedals is shown, which takes its room from theirs. */
    private var footed: Bool {
        state.pedals.isEmpty || state.pedals.contains(where: { $0.canPickChannel })
    }

    var body: some View {
        /* A Group, as the scenes are, so that five or more are the ScrollView they always were. */
        Group {
            if fewTiles(state.pedals.count) {
                GeometryReader { geo in
                    fewPedals(geo)
                }
            } else {
                ScrollView {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("PEDALS").font(.caption2).foregroundStyle(.secondary)
                        LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 4), count: 3), spacing: 4) {
                            ForEach(state.pedals) { pedal in
                                tile(pedal, tall: 40, fill: false)
                            }
                        }
                        if state.pedals.isEmpty {
                            Text("No pedals to show yet.").font(.footnote).foregroundStyle(.secondary)
                        } else if footed {
                            Text(pedalHoldLine(quickEdit: state.quickEdit)).font(.footnote).foregroundStyle(.secondary)
                        }
                    }
                }
            }
        }
        /* Looked up afresh from each picture: it closes itself when the pedal
           or its channels go, and lights what the phone says it is on. */
        .sheet(item: $picking, onDismiss: { held = false }) { picked in
            if let pedal = offered(picked.id) {
                if state.quickEdit == true {
                    /* Quick edit, where the iPhone offers it: the same channels, in one row, over the block's knobs. */
                    QuickSheet(pedal: pedal, lit: pendingChannel[pedal.id] ?? pedal.channel, quick: watchQuickFor(state.quick, pedal: pedal.id)) { name in
                        choose(name, for: pedal)
                    }
                    .environmentObject(link)
                } else {
                    ChannelsSheet(pedal: pedal, lit: pendingChannel[pedal.id] ?? pedal.channel) { name in
                        choose(name, for: pedal)
                    }
                    .environmentObject(link)
                }
            }
        }
        .onChange(of: state.pedals) { _, _ in
            pending = [:]
            pendingChannel = [:]
            /* The pedal held, or its channels, gone from the new picture. */
            if let picking, offered(picking.id) == nil { self.picking = nil }
        }
        /* Another preset: its block of the same number is not the one that was held. */
        .onChange(of: state.preset.number) { _, _ in picking = nil }
        /* CI's picture of a pedal held (screens.sh: -page 1 -pick 50), in the demo only. */
        .onAppear {
            guard link.demo, let id = Int(Launch.value("pick") ?? "") else { return }
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.8) { show(id) }
        }
    }

    /*
     * Four or fewer, as the scenes: the rows stretch to the page, the line
     * under them keeps its own height, and the type is sized for what the
     * rows come to. With that line under them the page keeps all of the
     * bottom margin: the line is the lowest thing on it, and text has no
     * rounded corner to keep it clear of the screen's.
     */
    private func fewPedals(_ geo: GeometryProxy) -> some View {
        let columns = pedalColumns(state.pedals.count)
        let extra = footed ? 0 : geo.safeAreaInsets.bottom * bottomShare
        let tall = fillHeight(
            count: state.pedals.count,
            columns: columns,
            room: Double(geo.size.height + extra) - headingRoom - (footed ? footRoom : 0),
            least: 40
        )
        return VStack(alignment: .leading, spacing: 4) {
            Text("PEDALS").font(.caption2).foregroundStyle(.secondary)
            VStack(spacing: 4) {
                ForEach(Array(tileRows(state.pedals.count, columns: columns).enumerated()), id: \.offset) { _, row in
                    HStack(spacing: 4) {
                        ForEach(Array(row.enumerated()), id: \.offset) { _, index in
                            if let index {
                                tile(state.pedals[index], tall: tall, fill: true)
                            } else {
                                Color.clear.frame(maxWidth: .infinity, maxHeight: .infinity)
                            }
                        }
                    }
                }
            }
            if footed {
                Text(pedalHoldLine(quickEdit: state.quickEdit)).font(.footnote).foregroundStyle(.secondary)
            }
        }
        .padding(.bottom, -extra)
    }

    /**
     * Its word, or none while the wrist is ahead of the phone: a tap on its
     * way, or another channel picked, whose boost the old word is not.
     */
    private func wordNow(_ pedal: WatchPedal) -> String? {
        guard pending[pedal.id] == nil else { return nil }
        if let picked = pendingChannel[pedal.id], picked != pedal.channel { return nil }
        return pedal.wordLine
    }

    /** A tap: on or off at once on the wrist, and the phone's answer confirms it. */
    private func press(_ pedal: WatchPedal) {
        /* Letting go of a hold can count as a tap as well; that one is not a switch. */
        if held {
            held = false
            return
        }
        let on = pending[pedal.id] ?? pedal.on
        tap()
        pending[pedal.id] = !on
        link.send(.pedal(id: pedal.id, on: !on))
        DispatchQueue.main.asyncAfter(deadline: .now() + 2) { pending[pedal.id] = nil }
    }

    /** A hold: its channels, with the same small buzz the phone gives its own hold. */
    private func hold(_ pedal: WatchPedal) {
        guard pedal.canPickChannel else { return }
        held = true
        tap()
        show(pedal.id)
    }

    /** Open a pedal's channels, if this picture still offers them. */
    private func show(_ id: Int) {
        guard offered(id) != nil else {
            /* Gone in the moment between the hold and now: nothing opens, so
               nothing will close it, and the hold must not eat the next tap. */
            held = false
            return
        }
        picking = Picked(id: id)
    }

    /** A channel picked: lit at once, sent, and closed, as the phone's own sheet does. */
    private func choose(_ name: String, for pedal: WatchPedal) {
        let id = pedal.id
        tap()
        pendingChannel[id] = name
        link.send(.channel(id: id, channel: name))
        DispatchQueue.main.asyncAfter(deadline: .now() + 2) {
            if pendingChannel[id] == name { pendingChannel[id] = nil }
        }
        picking = nil
    }
}

/** Which pedal's channels are open: what sheet(item:) needs, an id of its own. */
private struct Picked: Identifiable {
    let id: Int
}

/*
 * One pedal. The hold rides beside the button rather than replacing it, so a
 * tap is still the system's own button (VoiceOver, the pressed look, the page
 * held off while the phone is out of reach), and a swipe up or down still
 * turns the page: a hold that moves gives way. A pedal with nothing to choose
 * has no hold on it at all.
 */
private struct PedalTile: View {
    let pedal: WatchPedal
    let on: Bool
    /** What the phone said it is on, or the one just picked. */
    let channel: String?
    /** An AM4 amp's boost in Play's words, under the name; nil for none, and while a tap or another channel picked waits for the phone. */
    let word: String?
    /** The height its type is sized for: 40, as it always was, or what four or fewer come to when they share the page. */
    let tall: Double
    /** As tall as its row, when four or fewer share the page; 40 points otherwise. */
    let fill: Bool
    let press: () -> Void
    let hold: () -> Void
    let open: () -> Void

    /** The phone says "" for a channel the unit has not told it: no letter, rather than an empty one. */
    private var letter: String? {
        guard let channel, !channel.isEmpty else { return nil }
        return channel
    }

    /** What VoiceOver says: "Drive 1, on, channel B", and for an AM4's amp its word: "Amp 1, Boost off, channel A". */
    private var said: String {
        let base = "\(pedal.name), \(word ?? (on ? "on" : "off"))"
        guard let letter else { return base }
        return "\(base), channel \(letter)"
    }

    var body: some View {
        let hue = Color(hex: pedal.fill, fallback: .gray)
        let ink = on ? Color(hex: pedal.ink, fallback: .white) : hue
        Button(action: press) {
            VStack(spacing: 1) {
                Text(pedal.short)
                    .font(.system(size: grownSize(tall, share: 0.3, least: 13, most: 24), weight: .bold, design: .monospaced))
                    .lineLimit(1)
                    .minimumScaleFactor(0.6)
                if let word {
                    Text(word)
                        .font(.system(size: grownSize(tall, share: 0.17, least: 10, most: 15), weight: .semibold))
                        .lineLimit(1)
                        .minimumScaleFactor(0.7)
                        .padding(.horizontal, 3)
                }
            }
            .frame(maxWidth: .infinity, minHeight: 40, maxHeight: fill ? CGFloat.infinity : nil)
            /* The whole tile takes the tap and the hold, off as well as on: a plain button answers only where
               something is drawn, and an off pedal draws only its letters and its outline, which on a tile
               that fills a quarter of the page left most of it dead. */
            .contentShape(RoundedRectangle(cornerRadius: 8))
            .foregroundStyle(ink)
            .background(on ? hue : Color.clear, in: RoundedRectangle(cornerRadius: 8))
            .overlay(RoundedRectangle(cornerRadius: 8).stroke(hue, lineWidth: on ? 0 : 2))
            .overlay(alignment: .topTrailing) {
                if let letter {
                    Text(letter)
                        .font(.system(size: grownSize(tall, share: 0.14, least: 9, most: 13), weight: .bold))
                        .foregroundStyle(ink)
                        .padding(.top, 3)
                        .padding(.trailing, 5)
                }
            }
        }
        .buttonStyle(.plain)
        .simultaneousGesture(
            LongPressGesture(minimumDuration: 0.45).onEnded { _ in hold() },
            including: pedal.canPickChannel ? .all : .subviews
        )
        .accessibilityLabel(said)
        .accessibilityActions {
            if pedal.canPickChannel {
                Button("Channels", action: open)
            }
        }
    }
}

/*
 * A pedal's channels, opened by holding it: the one it is on lit, as the
 * scenes are, and a tap on another switches it and closes. Each channel keeps
 * its own settings, as on the phone. A sheet is its own window, so the link
 * is handed in again, and its buttons wait while the phone is out of reach,
 * as the pages under it do.
 */
private struct ChannelsSheet: View {
    let pedal: WatchPedal
    let lit: String?
    let pick: (String) -> Void
    @EnvironmentObject private var link: PhoneLink

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 4) {
                Text("CHANNEL").font(.caption2).foregroundStyle(.secondary)
                Text(pedal.name)
                    .font(.system(size: 15, weight: .semibold))
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
                LazyVGrid(columns: [GridItem(.flexible(), spacing: 4), GridItem(.flexible(), spacing: 4)], spacing: 4) {
                    ForEach(pedal.channels ?? [], id: \.self) { name in
                        Button {
                            pick(name)
                        } label: {
                            Text(name)
                                .font(.system(size: 20, weight: .bold, design: .rounded))
                                .frame(maxWidth: .infinity, minHeight: 44)
                                .foregroundStyle(name == lit ? Color.black : Color.white)
                                .background(name == lit ? signal : Color.white.opacity(0.14), in: RoundedRectangle(cornerRadius: 8))
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel("Channel \(name)")
                        .accessibilityAddTraits(name == lit ? .isSelected : [])
                    }
                }
            }
        }
        .disabled(!link.reachable)
        .opacity(link.reachable ? 1 : 0.55)
    }
}

/*
 * QUICK EDIT: a pedal held, where the iPhone offers it. Mockup B, which
 * Justin picked ("For the watch, mock up B", 12 November 2026): the block's
 * name, its channels in ONE row of four (the one it is on lit green, as
 * ever), then a list of its knobs, a name and a value to a row. A tap picks
 * a row (an amber outline, its value amber) and the Digital Crown turns the
 * picked knob; the first is picked when the sheet opens. The list is moved
 * with a finger, since the Crown is the knob's.
 *
 * THE KNOBS ARE THE IPHONE'S (Model.swift, WatchKnob). The sheet asks for
 * them when it opens (`knobs`) and says when it closes; until they come it
 * says it is reading, and a block with none, or one the iPhone could not
 * read, is its channels alone. The first ask may be the one that woke the
 * iPhone and was dropped, so a sheet not yet answered asks again every two
 * and a half seconds, four times in all, and once more whenever the watch
 * app comes back on screen.
 *
 * A TURN IS SHOWN AT ONCE AND SENT AT MOST TEN TIMES A SECOND, the last one
 * always (watchKnobWait). While the Crown is ahead of the iPhone the row's
 * number is worked out here by the iPhone's own rule; a second and a half
 * after the last turn the iPhone's numbers are the ones shown again, so
 * what the unit really holds is the last word. A turn is never sent twice
 * (WatchCommand.once).
 *
 * WHAT IS A TURN: the Crown's number rounding to another place than the
 * picked knob is shown at. The sheet itself puts the Crown where the picked
 * knob is whenever that moves for any other reason (another row tapped, the
 * iPhone's answer, the knobs arriving), and that is never a turn, because
 * then the two agree.
 *
 * A channel picked closes the sheet, as it always did: each channel has
 * its own settings, and the knobs read were the old channel's.
 */
private struct QuickSheet: View {
    let pedal: WatchPedal
    let lit: String?
    /** This pedal's knobs as the iPhone last said them; nil while it has not. */
    let quick: WatchQuick?
    let pick: (String) -> Void
    @EnvironmentObject private var link: PhoneLink
    @Environment(\.scenePhase) private var phase
    /** The knob tapped, by its key; none tapped yet is the first. */
    @State private var chosen: String?
    /** Where the Crown has put a knob, ahead of the iPhone: by key, 0 to 1. */
    @State private var turned: [String: Double] = [:]
    /** The last place sent to the iPhone for each knob, so the last turn is never left unsent. */
    @State private var went: [String: Double] = [:]
    /** The Crown's own number, 0 to 1. */
    @State private var crown: Double = 0
    /** When a turn last went, and the knob whose newest turn is waiting its tenth of a second. */
    @State private var lastSent: Date?
    @State private var owed: String?
    /** Counts the turns, so only the last one's settling hands the numbers back to the iPhone. */
    @State private var turns = 0
    /** Counts the asks for the knobs, how many are left, and whether the sheet is still waiting for them. */
    @State private var ask = 0
    @State private var asksLeft = watchKnobsAsks
    @State private var waiting = true
    @FocusState private var crownOn: Bool

    private var knobs: [WatchKnob] { quick?.knobs ?? [] }
    private var picked: WatchKnob? { watchKnobPicked(knobs, chosen) }

    /** Where a knob is shown: where the Crown has put it, or where the iPhone says it is. */
    private func place(_ knob: WatchKnob) -> Double {
        knob.place(turned: turned[knob.key])
    }

    var body: some View {
        /* Where the picked knob is shown: when it moves for any reason but the Crown, the Crown is put there (setCrown). */
        let target: Double? = picked.map { place($0) }
        ScrollView {
            VStack(alignment: .leading, spacing: 4) {
                Text(pedal.name)
                    .font(.system(size: 15, weight: .semibold))
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
                HStack(spacing: 4) {
                    ForEach(pedal.channels ?? [], id: \.self) { name in
                        Button {
                            pick(name)
                        } label: {
                            Text(name)
                                .font(.system(size: 17, weight: .bold, design: .rounded))
                                .frame(maxWidth: .infinity, minHeight: 36)
                                .foregroundStyle(name == lit ? Color.black : Color.white)
                                .background(name == lit ? signal : Color.white.opacity(0.14), in: RoundedRectangle(cornerRadius: 8))
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel("Channel \(name)")
                        .accessibilityAddTraits(name == lit ? .isSelected : [])
                    }
                }
                if !knobs.isEmpty {
                    VStack(spacing: 4) {
                        ForEach(knobs, id: \.key) { knob in
                            KnobRow(
                                knob: knob,
                                value: knob.shown(turned: turned[knob.key]),
                                on: knob.key == picked?.key,
                                tap: { choose(knob) },
                                step: { by in move(knob, to: place(knob) + by) }
                            )
                        }
                    }
                    /* The Crown is the picked knob's while this has the focus, which the sheet gives it when the knobs come and at every tap on a row. */
                    .focusable(true)
                    .focused($crownOn)
                    .digitalCrownRotation($crown, from: 0, through: 1, sensitivity: .low, isContinuous: false, isHapticFeedbackEnabled: true)
                    .focusEffectDisabled()
                } else if waiting, quick == nil {
                    Text("Reading \(pedal.name)…").font(.footnote).foregroundStyle(.secondary)
                }
            }
        }
        .disabled(!link.reachable)
        .opacity(link.reachable ? 1 : 0.55)
        .onAppear {
            setCrown()
            crownOn = true
            askForKnobs()
        }
        .onChange(of: ask) { _, _ in askForKnobs() }
        .onChange(of: target) { _, _ in setCrown() }
        .onChange(of: crown) { _, now in
            if let knob = picked { move(knob, to: now) }
        }
        .onChange(of: knobs.isEmpty) { _, none in
            if !none { crownOn = true }
        }
        /* The wrist raised again with the sheet still open: the iPhone may have let the knobs go meanwhile, so it is asked afresh. */
        .onChange(of: phase) { _, now in
            guard now == .active else { return }
            asksLeft = watchKnobsAsks
            waiting = true
            ask += 1
        }
        .onDisappear {
            sendUnsent()
            link.send(.knobs(id: nil))
        }
    }

    /** Ask the iPhone for this pedal's knobs, unless it has said them or has been asked enough; and again in a while, in case this one woke it and was dropped. */
    private func askForKnobs() {
        guard quick == nil else { return }
        guard asksLeft > 0 else {
            waiting = false
            return
        }
        asksLeft -= 1
        link.send(.knobs(id: pedal.id))
        Task { @MainActor in
            try? await Task.sleep(nanoseconds: UInt64(watchKnobsAskSeconds * 1_000_000_000))
            ask += 1
        }
    }

    /*
     * The Crown's number put where the picked knob is shown: never a turn,
     * since the two then agree. Left alone while it is within a rounding of
     * there already (a place is kept to three figures, so the Crown's own
     * number is up to half a thousandth off it mid-turn), or every move of
     * the Crown would be answered by a nudge back.
     */
    private func setCrown() {
        guard let knob = picked else { return }
        let at = place(knob)
        if abs(crown - at) > 0.0006 { crown = at }
    }

    /** A row tapped: the Crown is its knob's from here. Whatever the last knob was owed goes first. */
    private func choose(_ knob: WatchKnob) {
        tap()
        sendUnsent()
        chosen = knob.key
        crownOn = true
    }

    /*
     * A knob to a place, 0 to 1, by the Crown or by VoiceOver's up and
     * down: shown at once, sent now if a tenth of a second has gone by
     * since the last one and otherwise when it has, and the iPhone's
     * numbers put back a second and a half after the last move. Nothing
     * for a place it is already shown at.
     */
    private func move(_ knob: WatchKnob, to now: Double) {
        let at = watchKnobAt(now)
        guard at != place(knob) else { return }
        let key = knob.key
        turned[key] = at
        turns += 1
        let mine = turns
        let wait = watchKnobWait(lastSent: lastSent, now: Date())
        if wait <= 0 {
            send(key)
        } else if owed == nil {
            owed = key
            Task { @MainActor in
                try? await Task.sleep(nanoseconds: UInt64(wait * 1_000_000_000))
                sendOwed()
            }
        }
        Task { @MainActor in
            try? await Task.sleep(nanoseconds: UInt64(watchKnobSettle * 1_000_000_000))
            guard turns == mine else { return }
            sendUnsent()
            turned = [:]
            went = [:]
        }
    }

    /** The turn that waited its tenth of a second. */
    private func sendOwed() {
        guard let key = owed else { return }
        owed = nil
        send(key)
    }

    /** Every knob whose last place has not gone to the iPhone yet: before another knob is picked, before the numbers are handed back, and before the sheet closes. */
    private func sendUnsent() {
        owed = nil
        for (key, at) in turned where went[key] != at {
            send(key)
        }
    }

    /** One knob's newest place to the iPhone. */
    private func send(_ key: String) {
        guard let at = turned[key] else { return }
        lastSent = Date()
        went[key] = at
        link.send(.knob(id: pedal.id, key: key, at: at))
    }
}

/*
 * One knob's row: its name on the left, its value on the right; picked, an
 * amber outline and an amber value. The whole row takes the tap. VoiceOver
 * reads the name and the value, and its up and down move the knob a
 * hundredth of its range, since the Crown is VoiceOver's while it is on.
 */
private struct KnobRow: View {
    let knob: WatchKnob
    /** Its value as the row writes it: the iPhone's words, or the Crown's own number while it is ahead of the iPhone. */
    let value: String
    let on: Bool
    let tap: () -> Void
    let step: (Double) -> Void

    var body: some View {
        Button(action: tap) {
            HStack(spacing: 6) {
                Text(knob.name ?? "")
                    .font(.system(size: 15))
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
                Spacer(minLength: 4)
                Text(value)
                    .font(.system(size: 14, weight: .semibold, design: .monospaced))
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
                    .foregroundStyle(on ? amber : Color.white.opacity(0.8))
            }
            .padding(.horizontal, 8)
            .frame(maxWidth: .infinity, minHeight: 36)
            .contentShape(RoundedRectangle(cornerRadius: 8))
            .background(on ? amber.opacity(0.2) : Color.white.opacity(0.1), in: RoundedRectangle(cornerRadius: 8))
            .overlay(RoundedRectangle(cornerRadius: 8).stroke(amber, lineWidth: on ? 1.5 : 0))
        }
        .buttonStyle(.plain)
        .accessibilityLabel(knob.name ?? "")
        .accessibilityValue(value)
        .accessibilityAddTraits(on ? .isSelected : [])
        .accessibilityAdjustableAction { direction in
            switch direction {
            case .increment: step(0.01)
            case .decrement: step(-0.01)
            @unknown default: break
            }
        }
    }
}

// MARK: - Presets

/*
 * The preset on the unit, and Previous and Next — the phone's own, so they
 * walk the setlist or the stars when one is chosen there, and stop at the ends.
 */
struct PresetsPage: View {
    let state: WatchState
    @EnvironmentObject private var link: PhoneLink

    var body: some View {
        VStack(spacing: 6) {
            Text("PRESET \(state.slotLine)").font(.caption2).foregroundStyle(.secondary)
            Text(state.nameLine)
                .font(.system(size: 20, weight: .bold))
                .multilineTextAlignment(.center)
                .lineLimit(2)
                .minimumScaleFactor(0.6)
                .frame(maxWidth: .infinity, minHeight: 52)
            if state.scene >= 0 && state.scene < state.scenes.count {
                Text(state.scenes[state.scene]).font(.footnote).foregroundStyle(signal).lineLimit(1)
            }
            HStack(spacing: 6) {
                Button {
                    tap()
                    link.send(.preset(step: -1))
                } label: {
                    Label("Prev", systemImage: "chevron.left").labelStyle(.iconOnly).frame(maxWidth: .infinity, minHeight: 44)
                }
                .disabled(!state.canPrevious)
                .accessibilityLabel("Previous preset")
                Button {
                    tap()
                    link.send(.preset(step: 1))
                } label: {
                    Label("Next", systemImage: "chevron.right").labelStyle(.iconOnly).frame(maxWidth: .infinity, minHeight: 44)
                }
                .disabled(!state.canNext)
                .accessibilityLabel("Next preset")
            }
        }
    }
}

// MARK: - Tempo

/*
 * The tempo as a big number, one Tap button, and the metronome's tap on the
 * wrist. "OK, well let's add that as well then" (Justin, 11 November 2026).
 *
 * TAP IS THE IPHONE'S OWN TAP BUTTON: each press asks the phone for one tap
 * of it (WatchCommand.tap) and the phone counts them as it counts its own,
 * so the number that comes back is the one its Tap button shows. With no
 * tempo known the number is a dash and the button still taps. Where the
 * iPhone's Tap sends nothing for this unit or this connection the phone
 * says so in the picture (`tap` false, with its own sentence in `why`): the
 * button is switched off and the sentence is under it. The watch never
 * decides that for itself.
 *
 * THE SWITCH is the metronome's "Tap on the watch" from the iPhone's
 * Settings, and only that: it does not start the metronome, which is the
 * iPhone's to start. So with the switch on and the metronome off nothing
 * taps, and the page says which.
 *
 * In a ScrollView because the phone's sentence can be four lines on a small
 * watch; with nothing to say it fits and does not move.
 */
struct TempoPage: View {
    let state: WatchState
    @EnvironmentObject private var link: PhoneLink

    var body: some View {
        let tempo = state.tempo
        let canTap = tempo?.tap == true
        let why = tempo?.why ?? ""
        let number = tempoNumber(tempo?.bpm)
        let spoken: String = number == "—" ? "No tempo yet" : "\(number) beats per minute"
        ScrollView {
            VStack(spacing: 6) {
                HStack(alignment: .firstTextBaseline, spacing: 4) {
                    Text(number)
                        .font(.system(size: 44, weight: .bold, design: .rounded))
                        .lineLimit(1)
                        .minimumScaleFactor(0.6)
                    Text("BPM").font(.caption2).foregroundStyle(.secondary)
                }
                .frame(maxWidth: .infinity, minHeight: 48)
                .accessibilityElement(children: .ignore)
                .accessibilityLabel(spoken)
                Button {
                    tap()
                    link.send(.tap)
                } label: {
                    Label("Tap", systemImage: "metronome").frame(maxWidth: .infinity, minHeight: 56)
                }
                .disabled(!canTap)
                .accessibilityLabel("Tap tempo")
                if !canTap, !why.isEmpty {
                    Text(why)
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                        .multilineTextAlignment(.center)
                        .fixedSize(horizontal: false, vertical: true)
                }
                Toggle("Wrist metronome", isOn: Binding(get: { tempo?.wrist == true }, set: { link.send(.wrist(on: $0)) }))
                    .disabled(tempo == nil)
                    /* In from the sides: its words began on the very edge of the screen, under the metronome's light. */
                    .padding(.horizontal, 10)
                if tempo?.wrist == true, tempo?.running != true {
                    Text("The metronome is off on your iPhone.")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                        .multilineTextAlignment(.center)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
        }
    }
}

// MARK: - Tuner

/*
 * Off until tapped, and off again when the page is left, unless the iPhone
 * has said it stays on (its "Stays on when you swipe away" switch, the
 * picture's `tunerStays`; Model.swift watchTunerStopsOnLeaving): then
 * leaving does nothing, and the page shows it on, with Stop tuning, when it
 * is come back to. Whether the unit
 * mutes while it tunes is the unit's own setting (Setup, Tuner, Mute), never
 * the app's: "We don't want the unit to mute while the tuner is on, unless
 * they set that in settings somewhere." Tapped rather than on arrival so a
 * unit that IS set to mute is never muted by a swipe past. The note in big
 * letters, a needle for how far off, green within three cents, as on the
 * phone.
 *
 * THE SCREEN SAYS WHAT THE TUNER IS; THE BUTTONS SAY WHAT A TAP WILL DO.
 * The off screen used to be one button that said "Tuner on" while the tuner
 * was off, and Justin read it as the state: "where it says tuner on I feel
 * like that means it on." Of three mockups he picked the second, "Go with
 * option B for the watch I like that one" (11 November 2026; the picture is
 * docs/watch/tuner-start-stop.png):
 *
 *   off  TUNER, small, then "Off", big and grey, then one large green
 *        button with the tuning fork: "Start tuning". No "Tap to tune.",
 *        and nothing on the screen says "on".
 *   on   the note, the needle and the cents as they were, then "Stop
 *        tuning", red, where "Tuner off" was.
 *
 * Never "Tuner on" or "Tuner off" as a button's words again (the words are
 * TunerWords in Model.swift, which the tests hold). Nothing it does changed
 * with the words: the same two requests, and nothing until tapped. VoiceOver reads the buttons by their words and "Off" as
 * "Tuner is off"; the small TUNER over it is not read twice.
 */

/** Start tuning's words on the green: near black (#06210E), as the mockup. */
private let startInk = Color(red: 0.024, green: 0.129, blue: 0.055)
/** Stop tuning: red words (#FF6961) on a red-tinted fill (255, 69, 58 at 28%), as a button that ends something reads on the watch. */
private let stopInk = Color(red: 1, green: 0.412, blue: 0.38)
private let stopFill = Color(red: 1, green: 0.271, blue: 0.227).opacity(0.28)

struct TunerPage: View {
    let state: WatchState
    @EnvironmentObject private var link: PhoneLink

    var body: some View {
        let tuner = state.tuner
        VStack(spacing: 6) {
            if tuner.on {
                Text(tuner.note.isEmpty ? "—" : tuner.note)
                    .font(.system(size: 54, weight: .bold, design: .rounded))
                    .foregroundStyle(tuner.inTune ? signal : .white)
                    .frame(height: 60)
                Needle(cents: tuner.cents, live: !tuner.note.isEmpty, inTune: tuner.inTune)
                    .frame(height: 14)
                Text(tuner.note.isEmpty ? "Play a string" : "\(tuner.cents > 0 ? "+" : "")\(tuner.cents) cents")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                Button {
                    tap()
                    link.send(.tuner(on: false))
                } label: {
                    Text(TunerWords.stop)
                        .font(.body.weight(.bold))
                        .foregroundStyle(stopInk)
                        .frame(maxWidth: .infinity, minHeight: 40)
                        .background(stopFill, in: Capsule())
                }
                .buttonStyle(.plain)
            } else {
                Text("TUNER").font(.caption2).foregroundStyle(.secondary).accessibilityHidden(true)
                Text(TunerWords.off)
                    .font(.system(size: 26, weight: .heavy))
                    .foregroundStyle(.secondary)
                    .accessibilityLabel(TunerWords.offSpoken)
                Button {
                    tap()
                    link.send(.tuner(on: true))
                } label: {
                    Label(TunerWords.start, systemImage: "tuningfork")
                        .font(.body.weight(.bold))
                        .foregroundStyle(startInk)
                        .frame(maxWidth: .infinity, minHeight: 52)
                        .background(signal, in: Capsule())
                }
                .buttonStyle(.plain)
            }
        }
        .onDisappear {
            if watchTunerStopsOnLeaving(tunerOn: state.tuner.on, stays: state.tunerStays) { link.send(.tuner(on: false)) }
        }
    }
}

private struct Needle: View {
    let cents: Int
    let live: Bool
    let inTune: Bool

    var body: some View {
        GeometryReader { geo in
            let w = geo.size.width
            ZStack(alignment: .leading) {
                Capsule().fill(Color.white.opacity(0.15)).frame(height: 4).frame(maxHeight: .infinity)
                Rectangle().fill(Color.white.opacity(0.5)).frame(width: 2).position(x: w / 2, y: geo.size.height / 2)
                if live {
                    Capsule()
                        .fill(inTune ? signal : Color.orange)
                        .frame(width: 6)
                        .position(x: w / 2 + CGFloat(needleOffset(cents: cents)) * (w / 2 - 3), y: geo.size.height / 2)
                }
            }
        }
        .accessibilityHidden(true)
    }
}

// MARK: - Waiting

struct WaitingPage: View {
    let tooNew: Bool
    let phoneOnly: Bool

    var body: some View {
        VStack(spacing: 8) {
            Image(systemName: tooNew ? "arrow.down.circle" : "iphone")
                .font(.system(size: 30))
                .foregroundStyle(.secondary)
            Text(
                tooNew
                    ? "Update Fractal Remote on this watch."
                    : phoneOnly
                        ? "Your iPhone isn’t connected to the unit yet."
                        : "Open Fractal Remote on your iPhone, on the gig screen."
            )
            .font(.footnote)
            .multilineTextAlignment(.center)
            /* The watch wakes an iPhone app that is asleep, not one that is not on Play at all: said where the wearer is told to open it. */
            if !tooNew, !phoneOnly {
                Text(WaitingWords.closed)
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
            }
        }
        .padding(.horizontal, 4)
    }
}

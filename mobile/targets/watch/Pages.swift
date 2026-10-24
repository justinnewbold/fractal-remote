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

// MARK: - Scenes

/*
 * Eight buttons, two to a row, the one that is on lit. A tap lights the new
 * one at once and the phone's answer confirms it; if the phone says otherwise
 * within two seconds, its answer wins.
 */
struct ScenesPage: View {
    let state: WatchState
    @EnvironmentObject private var link: PhoneLink
    @State private var pending: Int?

    private var lit: Int { pending ?? state.scene }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 4) {
                Text("SCENES").font(.caption2).foregroundStyle(.secondary)
                LazyVGrid(columns: [GridItem(.flexible(), spacing: 4), GridItem(.flexible(), spacing: 4)], spacing: 4) {
                    ForEach(Array(state.scenes.enumerated()), id: \.offset) { index, name in
                        Button {
                            tap()
                            pending = index
                            link.send(.scene(index))
                            DispatchQueue.main.asyncAfter(deadline: .now() + 2) { if pending == index { pending = nil } }
                        } label: {
                            Text(name)
                                .font(.system(size: 14, weight: .semibold))
                                .lineLimit(1)
                                .minimumScaleFactor(0.7)
                                .frame(maxWidth: .infinity, minHeight: 36)
                                .foregroundStyle(index == lit ? Color.black : Color.white)
                                .background(index == lit ? signal : Color.white.opacity(0.14), in: RoundedRectangle(cornerRadius: 8))
                        }
                        .buttonStyle(.plain)
                        .accessibilityAddTraits(index == lit ? .isSelected : [])
                    }
                }
                if state.scenes.isEmpty {
                    Text("This preset has no scenes.").font(.footnote).foregroundStyle(.secondary)
                }
            }
        }
        .onChange(of: state.scene) { _, _ in pending = nil }
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

    /** This picture's copy of a pedal whose channels can be picked. */
    private func offered(_ id: Int) -> WatchPedal? {
        state.pedals.first { $0.id == id && $0.canPickChannel }
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 4) {
                Text("PEDALS").font(.caption2).foregroundStyle(.secondary)
                LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 4), count: 3), spacing: 4) {
                    ForEach(state.pedals) { pedal in
                        PedalTile(
                            pedal: pedal,
                            on: pending[pedal.id] ?? pedal.on,
                            channel: pendingChannel[pedal.id] ?? pedal.channel,
                            word: wordNow(pedal),
                            press: { press(pedal) },
                            hold: { hold(pedal) },
                            open: { show(pedal.id) }
                        )
                    }
                }
                if state.pedals.isEmpty {
                    Text("No pedals to show yet.").font(.footnote).foregroundStyle(.secondary)
                } else if state.pedals.contains(where: { $0.canPickChannel }) {
                    Text("Hold a pedal for its channels.").font(.footnote).foregroundStyle(.secondary)
                }
            }
        }
        /* Looked up afresh from each picture: it closes itself when the pedal
           or its channels go, and lights what the phone says it is on. */
        .sheet(item: $picking, onDismiss: { held = false }) { picked in
            if let pedal = offered(picked.id) {
                ChannelsSheet(pedal: pedal, lit: pendingChannel[pedal.id] ?? pedal.channel) { name in
                    choose(name, for: pedal)
                }
                .environmentObject(link)
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
                    .font(.system(size: 13, weight: .bold, design: .monospaced))
                    .lineLimit(1)
                    .minimumScaleFactor(0.6)
                if let word {
                    Text(word)
                        .font(.system(size: 10, weight: .semibold))
                        .lineLimit(1)
                        .minimumScaleFactor(0.7)
                        .padding(.horizontal, 3)
                }
            }
            .frame(maxWidth: .infinity, minHeight: 40)
            .foregroundStyle(ink)
            .background(on ? hue : Color.clear, in: RoundedRectangle(cornerRadius: 8))
            .overlay(RoundedRectangle(cornerRadius: 8).stroke(hue, lineWidth: on ? 0 : 2))
            .overlay(alignment: .topTrailing) {
                if let letter {
                    Text(letter)
                        .font(.system(size: 9, weight: .bold))
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

// MARK: - Tuner

/*
 * Off until tapped, and off again when the page is left. Whether the unit
 * mutes while it tunes is the unit's own setting (Setup, Tuner, Mute), never
 * the app's: "We don't want the unit to mute while the tuner is on, unless
 * they set that in settings somewhere." Tapped rather than on arrival so a
 * unit that IS set to mute is never muted by a swipe past. The note in big
 * letters, a needle for how far off, green within three cents, as on the
 * phone.
 */
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
                Button("Tuner off") {
                    tap()
                    link.send(.tuner(on: false))
                }
            } else {
                Text("TUNER").font(.caption2).foregroundStyle(.secondary)
                Button {
                    tap()
                    link.send(.tuner(on: true))
                } label: {
                    Label("Tuner on", systemImage: "tuningfork").frame(maxWidth: .infinity, minHeight: 56)
                }
                Text("Tap to tune.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
            }
        }
        .onDisappear {
            if state.tuner.on { link.send(.tuner(on: false)) }
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
        }
        .padding(.horizontal, 4)
    }
}

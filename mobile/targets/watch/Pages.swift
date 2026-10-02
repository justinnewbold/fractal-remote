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
 */
struct PedalsPage: View {
    let state: WatchState
    @EnvironmentObject private var link: PhoneLink
    @State private var pending: [Int: Bool] = [:]

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 4) {
                Text("PEDALS").font(.caption2).foregroundStyle(.secondary)
                LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 4), count: 3), spacing: 4) {
                    ForEach(state.pedals) { pedal in
                        let on = pending[pedal.id] ?? pedal.on
                        let hue = Color(hex: pedal.fill, fallback: .gray)
                        Button {
                            tap()
                            pending[pedal.id] = !on
                            link.send(.pedal(id: pedal.id, on: !on))
                            DispatchQueue.main.asyncAfter(deadline: .now() + 2) { pending[pedal.id] = nil }
                        } label: {
                            Text(pedal.short)
                                .font(.system(size: 13, weight: .bold, design: .monospaced))
                                .lineLimit(1)
                                .minimumScaleFactor(0.6)
                                .frame(maxWidth: .infinity, minHeight: 40)
                                .foregroundStyle(on ? Color(hex: pedal.ink, fallback: .white) : hue)
                                .background(on ? hue : Color.clear, in: RoundedRectangle(cornerRadius: 8))
                                .overlay(RoundedRectangle(cornerRadius: 8).stroke(hue, lineWidth: on ? 0 : 2))
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel("\(pedal.name), \(on ? "on" : "off")")
                    }
                }
                if state.pedals.isEmpty {
                    Text("No pedals to show yet.").font(.footnote).foregroundStyle(.secondary)
                }
            }
        }
        .onChange(of: state.pedals) { _, _ in pending = [:] }
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

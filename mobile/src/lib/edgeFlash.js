/*
 * THE METRONOME'S FLASH ROUND THE EDGE OF THE SCREEN, AS A CHOICE.
 *
 * "Can we set it where it can run the metronome on the device and the phone
 * at the same time or either one? And then on the phone have an option for
 * the screen to flash somewhere like the outside edge of the screen."
 * (Justin, 12 November 2026.)
 *
 * The first half was there already: Settings → Metronome → Where it clicks
 * is Unit, this device, or Both (shared/metronome.mjs). And the edge of the
 * screen has always flashed with the device's own click (components/
 * MetronomeBeat). What was missing is the CHOICE:
 *
 *   - the flash can be switched off, and the click and the tap carry on;
 *   - and it can be had WITHOUT the device's click: with the click on the
 *     unit alone, the screen's edge lights on every beat and the device
 *     makes no sound and no tap. A light to watch from a stand, while the
 *     unit's click is the one in the speakers.
 *
 * WHO IS OFFERED THE CHOICE is his account until features
 * METRONOME_FLASH_CHOICE_FOR_EVERYONE (`edgeChoiceOn`), as every new thing
 * is. For every other account nothing changes: the edge flashes with the
 * device's own click, as it always has, and never without it.
 *
 * ONE THING IT CANNOT DO BY ITSELF: the unit does not answer when its
 * beats fall, only how fast they are. So the light keeps the unit's tempo,
 * not its beat: the two can be a part of a beat apart, and the words say
 * so (`EDGE_WORDS.apart`). Only where the unit SENDS its beat and it is
 * heard (lib/beatLock: his account, a gen-3 unit with Send Realtime Sysex
 * on) is the light moved onto it, and the words say that instead, only
 * while it is so (`EDGE_WORDS.inStep`, `apartOrInStep`).
 *
 * They used to end "Press Tap to start them together", and that was never
 * true: Tap works the tempo out on the device and sends the unit a NUMBER
 * (lib/tempo), so the unit's beat stays where it was. "The metronome is
 * not matching up properly into the sound coming out of speakers. There's
 * a delay." (Justin, 16 November 2026, the light against the unit's click.)
 * Until the unit's beat reaches the app, the words promise nothing.
 *
 * AND NO SOUND AT ALL, AS A CHOICE (16 November 2026). "Add a feature where
 * you can either have sound on, sound off, or you can have it flash on the
 * phone with sound or flash on the phone without sound on the phone only
 * with sound playing on the phone, or on the device only playing with
 * sound." Every one of those was there but one, across two pages of
 * Settings: the flash with no click ANYWHERE. With the metronome on,
 * something always made a sound (shared clicks(): under Unit the device
 * covers wherever the unit cannot click).
 *
 * So the sound is one row of four, in the volume pop-up beside the
 * metronome's own switch and on Settings → Metronome: Off, this device,
 * Unit, Both. Three of them are the shared rule's places as they are. Off
 * is kept HERE, on the device (`QUIET_KEY`), and is two things together:
 * the place is set to the device, so the shared rule switches the unit's
 * own click off through the road it has always used, and the device's
 * click is held silent (`deviceSounds`). The light is all that is left,
 * through the silent beat above, so picking Off switches the light on.
 * Nothing of it is in shared/metronome.mjs, which is inside the computer
 * app: no new place, no computer release, and the Apple Watch is told what
 * it always was.
 *
 * Picking a place is picking a sound: it lets go of Off, whoever picks it
 * and from whichever page (lib/metronome setMetronome), so Off is only ever
 * kept with the place on the device, and the unit is never left clicking
 * under a lit Off. The place Off leaves behind is the device everywhere,
 * so Off DOES replace a saved Unit, also where the unit's click cannot be
 * switched. Off is read only for an account the choice is offered to, so a
 * device handed to another account clicks as it always has.
 *
 * The rules, kept apart so they can be tested. Nothing here imports
 * anything.
 */

/** Whether an account is offered the choice at all: his, or everyone once the switch is on. */
export const edgeChoiceOn = ({ admin = false, everyone = false } = {}) => admin === true || everyone === true

/** Where the choice is kept, on the device. */
export const EDGE_KEY = 'fractal.metronome.edge'

/** The choice out of what is on disk: on unless it was switched off (it has always flashed). */
export const edgeKept = (raw) => raw !== 'off'

/** And what goes on disk for it. */
export const edgeToKeep = (on) => (on === true ? 'on' : 'off')

/**
 * What the device does on a beat.
 *
 *   offered       whether this account has the choice (edgeChoiceOn)
 *   edge          the choice itself: flash the edge, or not
 *   metronomeOn   the metronome's own switch
 *   deviceClicks  whether the device's own click is running (shared
 *                 clicks().phone: picked, or covering for a unit that
 *                 cannot click or has not yet said it is)
 *
 * Answers `flash`, whether the edge lights on the beat, and `silent`,
 * whether that light is all the device does: no sound and no tap, because
 * the unit's click is the one being played to.
 */
export function edgeBeat({ offered = false, edge = true, metronomeOn = false, deviceClicks = false } = {}) {
  /* Not offered: exactly what it has always been. */
  if (offered !== true) return { flash: deviceClicks === true, silent: false }
  if (edge !== true) return { flash: false, silent: false }
  const on = metronomeOn === true
  return { flash: on, silent: on && deviceClicks !== true }
}

/** The words Settings shows. `noun` is the device in hand (shared/device-word deviceNoun), read when shown. */
export const EDGE_WORDS = Object.freeze({
  section: 'Screen flash',
  on: 'Flash the edge of the screen: on',
  off: 'Flash the edge of the screen: off',
  note: (noun) => `The edge of the screen lights on every beat, wherever the click is. With the click on the unit alone, this ${noun} lights and stays silent.`,
  apart: 'The light keeps the unit’s tempo, not its exact beat',
  /* Said in its place only while the unit's own beat is being heard and this device's beat is on it (apartOrInStep). */
  inStep: 'In step with the unit’s beat'
})

/** Where "no sound" is kept, on the device. */
export const QUIET_KEY = 'fractal.metronome.sound'

/** The choice out of what is on disk: a sound unless it was switched off (there has always been one). */
export const quietKept = (raw) => raw === 'off'

/** And what goes on disk for it. */
export const quietToKeep = (quiet) => (quiet === true ? 'off' : 'on')

/** The key of the sound row's first choice. Never a place: the shared rule's places are 'unit', 'phone' and 'both'. */
export const SOUND_OFF = 'none'

/**
 * Whether the device's own click sounds.
 *
 *   clicks   what the shared rule says of the device (clicks().phone)
 *   offered  whether this account has the choice (edgeChoiceOn)
 *   quiet    the choice itself: no sound
 */
export const deviceSounds = ({ clicks = false, offered = false, quiet = false } = {}) => clicks === true && !(offered === true && quiet === true)

/**
 * The sound row, in the order it is drawn: Off, then each place the shared
 * rule offers here (placesFor: only the device where the unit's click cannot
 * be switched). `places` is that list as it is, labels read when shown.
 */
export const soundChoices = (places = []) => [{ key: SOUND_OFF, label: SOUND_WORDS.off }, ...places.map((p) => ({ key: p.key, label: p.label }))]

/** Which of them is lit: Off while it is quiet, or else the place the shared rule lights (`lit(key)`, placeLit). */
export function soundLit({ quiet = false, places = [], lit = () => false } = {}) {
  if (quiet === true) return SOUND_OFF
  return places.find((p) => lit(p.key))?.key ?? null
}

/**
 * What a pick changes.
 *
 *   Off      quiet, the place set to the device (which is what tells the
 *            unit to stop clicking, and what is kept from then on: a saved
 *            Unit is replaced), and the light on, or nothing is left
 *   a place  no longer quiet, and the place where the unit's click can be
 *            switched; where it cannot, the place kept is left as it is,
 *            as Settings has always left it
 */
export function soundPicked(key, { can = false } = {}) {
  if (key === SOUND_OFF) return { quiet: true, where: 'phone', edge: true }
  return can === true ? { quiet: false, where: key } : { quiet: false }
}

/** The words of the sound row. `noun` is the device in hand, read when shown. */
export const SOUND_WORDS = Object.freeze({
  section: 'Sound',
  off: 'Off',
  /* On Settings → Metronome, where each choice is a full-width button with a line under it. */
  noSound: 'No sound',
  /* What a screen reader says for each choice: "Sound: Off", "Sound: Unit". */
  said: (label) => `Sound: ${label}`,
  flashOnly: 'No sound. The edge of the screen lights on every beat',
  nothing: 'No sound and no flash, so nothing keeps time. Pick a sound, or switch the flash on',
  /* The same two where the unit's own click is out of the app's hands: it is the device that is silent. */
  flashOnlyHere: (noun) => `No sound from this ${noun}. The edge of the screen lights on every beat`,
  nothingHere: (noun) => `No sound from this ${noun} and no flash, so it keeps no time. Pick a sound, or switch the flash on`,
  unitOwn: 'The app can’t switch the unit’s own click from here: if the unit is clicking, switch its Metronome off on the unit',
  deviceNoFlash: (noun) => `Clicks out loud on this ${noun}, with no flash`,
  noTempo: (noun) => `No tempo from the unit yet, so the ${noun} has nothing to flash to`
})

/**
 * The line under the sound row and the flash: what the metronome does now,
 * for an account offered the choice. No full stop: whoever shows it ends
 * the sentence, as it ends the shared rule's notes.
 *
 *   quiet  no sound
 *   edge   the flash, on or off
 *   where  the place that is lit ('unit', 'phone', 'both')
 *   note   that place's own note from the shared rule, said as it is
 *          wherever the flash does not change what is true
 *   unit   whether the unit's own click can be switched from here
 *   demo   the demo, whose unit makes no sound at all
 *   inStep whether the device's beat is on the unit's right now
 */
export function soundLine({ quiet = false, edge = true, where = 'unit', note = '', unit = false, demo = false, noun = 'phone', inStep = false } = {}) {
  if (quiet === true) {
    /*
     * Where the unit's own click is out of the app's hands (over Bluetooth,
     * on an AM4, on a unit with no switch) Off silences the device and
     * nothing else: a unit that was clicking by its own switch still is.
     * So it is the device that is called silent, and what to do about the
     * unit is said. Never in the demo, whose unit makes no sound.
     */
    const own = unit !== true && demo !== true
    if (!own) return edge === true ? SOUND_WORDS.flashOnly : SOUND_WORDS.nothing
    return `${edge === true ? SOUND_WORDS.flashOnlyHere(noun) : SOUND_WORDS.nothingHere(noun)}. ${SOUND_WORDS.unitOwn}`
  }
  /* The shared note says "with a flash", which is not so with the flash switched off. */
  if (where === 'phone' && edge !== true) return SOUND_WORDS.deviceNoFlash(noun)
  /* Wherever the unit clicks with the edge lit, alone or with the device: its click and the light are two clocks. */
  if (where !== 'phone' && edge === true && unit === true) return `${note}. ${apartOrInStep(inStep)}`
  return note
}

/**
 * What is said of the unit's click against the light: that the two can be
 * apart, or, only while the unit's own beat is being heard and the device's
 * beat has been put on it (lib/beatLock, lib/metronome useInStep), that
 * they are in step.
 */
export const apartOrInStep = (inStep) => (inStep === true ? EDGE_WORDS.inStep : EDGE_WORDS.apart)

/**
 * The line under a place on Settings → Metronome: the shared rule's note,
 * except under the device with the flash switched off, for an account
 * offered the flash as a choice. The shared note says "with a flash".
 */
export const placeNote = (place, { offered = false, edge = true, noun = 'phone' } = {}) =>
  place?.key === 'phone' && offered === true && edge !== true ? SOUND_WORDS.deviceNoFlash(noun) : place?.note || ''

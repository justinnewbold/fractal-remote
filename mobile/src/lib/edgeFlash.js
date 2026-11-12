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
 * ONE THING IT CANNOT DO: the unit does not tell the app when its beats
 * fall, only how fast they are. So the light keeps the unit's tempo, not
 * its beat: the two can be a part of a beat apart. A press of Tap starts
 * both again together. The words say so (`EDGE_WORDS.apart`).
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
  apart: 'The light keeps the unit’s tempo, not its exact beat. Press Tap to start them together.'
})

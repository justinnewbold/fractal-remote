/*
 * A CAPTURE IS NOT SENT THROUGH A COMPUTER APP TOO OLD TO HAVE IT KEPT.
 *
 * His log of 16 November 2026: the phone (1.91.6) drove his Axe-Fx III
 * through "raspberry pi 5", whose computer app was 1.90.63, and two TONE3000
 * captures were Previewed. Both went, every message was taken, and the unit
 * kept neither ("FNDR BFSR VB Edge WRM2 CAB FREE", name byte 0x02, and "MRSH
 * JC800 Hi Lead2 BAL2 CAB", 0x17). A computer app that old writes the name
 * XORed into the name's 32nd byte whatever the phone packed (ForgeFX
 * namNameChecked before 64c44a7), and the unit drops most of those. The card
 * said only that the unit did not keep it and that the log had the rest;
 * nothing on the screen said the Pi's computer app was too old.
 *
 * THE VERSION. ForgeFX 64c44a7 (14 November 2026) sends the name byte as
 * the phone packed it and answers which byte went (`nameByte`). It was
 * pinned in desktop/forgefx.lock.json by the 1.90.70 change, and computer
 * release v1.90.70 is on GitHub (14 November 2026, 22:14 UTC, its arm64
 * AppImage among its files). This phone packs 0x60 since 1.90.88, so through
 * a computer app of 1.90.70 or later 0x60 is what goes: the one byte his unit
 * has kept every time. (ForgeFX acdd38d, in 1.90.88, only changes what the
 * computer does with a record that came with a nought there, which a copy of
 * the phone older than 1.90.60 packs, not this one.)
 *
 * SO, BEFORE A SEND THROUGH A COMPUTER whose app has said its version and
 * that version is older, nothing is sent and the card says why, naming the
 * computer and both versions (`computerTooOld`, `tooOldWords`). Never over
 * Bluetooth, the unit's USB cable into the phone, or the demo: those send
 * from the phone itself (lib/device capturesThroughComputer). A computer that
 * has not said its version is not refused on a guess; its answer then has no
 * `nameByte` (lib/captureSend `old`), and a capture it sent that was not kept
 * is said the same way (`unkeptWords`).
 *
 * PURE: the page hands in what it knows. No phone and no screen in here.
 */
import { isOlder } from './versions.js'
import { deviceNoun } from './device-word.js'

/** The first computer app that sends a capture's name byte as the phone packed it, and says which byte went: computer release v1.90.70 (ForgeFX 64c44a7). */
export const CAPTURES_KEPT_FROM = '1.90.70'

/**
 * Whether a capture sent now would go through a computer app too old to
 * have it kept: `{ name, version }` of that computer, or null. `through` is
 * whether a capture goes through the computer at all (lib/device
 * capturesThroughComputer); `version` and `name` are the link's (lib/link
 * hostVersion, macName). A version that is not said, or not three plain
 * numbers, is null: nothing is refused on a guess.
 */
export function computerTooOld({ through = false, version = null, name = null } = {}) {
  if (through !== true) return null
  if (isOlder(version, CAPTURES_KEPT_FROM) !== true) return null
  return { name: typeof name === 'string' ? name.trim() : '', version: String(version).trim() }
}

/* The computer as the sentence names it: by its own name where it has said one. */
const onIt = (name) => `The computer app${name ? ` on ${name}` : ''}`

/* What to do, the same words wherever the reason is given. */
const remedy = (noun) => `Update the computer app to ${CAPTURES_KEPT_FROM} or later, then send it again. Or connect over Bluetooth, which sends it from this ${noun}.`

/**
 * Why a capture is not sent through that computer, and what to do: short
 * enough for the hold pop-up's sheet. Read when it is shown: it names the
 * device in hand.
 */
export const tooOldWords = ({ name = '', version = '' } = {}, noun = deviceNoun()) =>
  `${onIt(name)} is version ${version}. The Axe-Fx III drops most captures sent through one that old. ${remedy(noun)}`

/**
 * Whether a capture the unit did not keep went through a computer app too
 * old to have it kept: the computer did not say which byte went (`old`,
 * lib/captureSend), and its version is not known to be new enough. Its
 * `{ name, version }`, with `version` null where it did not say; else null.
 */
export function oldAfterSend({ old = false, version = null, name = null } = {}) {
  if (old !== true) return null
  if (isOlder(version, CAPTURES_KEPT_FROM) === false) return null
  const known = isOlder(version, CAPTURES_KEPT_FROM) === true
  return { name: typeof name === 'string' ? name.trim() : '', version: known ? String(version).trim() : null }
}

/**
 * The card's words for a capture the unit took and did not keep: `tries`
 * how many ways it went, `slotSaid` the slot as a player reads it ("041"),
 * `computer` what `oldAfterSend` answered. Through a computer app too old,
 * the reason and the remedy in place of "the app's log has what the unit
 * answered"; every other case as it always was.
 */
export function unkeptWords({ tries = 1, slotSaid = '', computer = null } = {}, noun = deviceNoun()) {
  const took = tries > 1 ? `The Axe-Fx III took the capture ${tries} different ways and still shows slot ${slotSaid} as empty, so it did not keep it.` : `The Axe-Fx III took the capture and then still shows slot ${slotSaid} as empty, so it did not keep it.`
  if (computer) {
    const which = computer.version ? `is version ${computer.version}` : `is older than ${CAPTURES_KEPT_FROM}`
    return `${took} ${onIt(computer.name)} ${which}, and the unit drops most captures sent through one that old. ${remedy(noun)}`
  }
  return tries > 1 ? `${took} The app’s log has what the unit answered each time.` : `${took} Send it once more; if it says this again, the app’s log has what the unit answered.`
}

/**
 * Whether the tone's view says it once up top: a tone is open with captures
 * to send, the computer is too old, and no capture's own card already says
 * it (`send.old`, a tap that sent nothing for this reason). Never twice on a
 * view.
 */
export const tooOldUpTop = ({ computer = null, captures = false, send = null } = {}) => !!computer && captures === true && !(send && send.old === true)

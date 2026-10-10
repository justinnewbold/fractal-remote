/* Generated from shared/metronome.mjs by scripts/sync-relay-rules.mjs.
 * Do not edit. Change the source and run `npm run sync:rules`; the test suite
 * fails on any difference between the two. */

/**
 * THE METRONOME: where it clicks, and how to tell the unit to click.
 *
 * "Can we add a metronome that plays out loud that can be toggled on and off
 * in settings? Does the unit itself have a metronome? If so, can we set it up
 * to play on the unit or the phone or both?"
 *
 * The unit has one. FM3 (firmware 12 and later), FM9, Axe-Fx III (31 and
 * later) carry a Metronome switch on the Controllers → Tempo page (a Global
 * setting, effect id 1), and it clicks through the unit's own outputs at the
 * unit's own tempo — the one the Tap button and the tempo box already set. That is the click to play to: it
 * is in the same speakers as the guitar and the unit keeps the time itself.
 *
 * The phone's click is the other half: a short click it plays out loud, with
 * a flash and a tap you feel. And the watch can tap on the wrist with it.
 *
 * Both apps read this file — the phone through the copy `npm run sync:rules`
 * writes — so the two can never disagree about which number turns an FM3's
 * metronome on.
 */

/** Where the click goes. 'unit' is the default: it is the one with steady time. */
export const PLACES = [
  { key: 'unit', label: 'Unit', note: 'Clicks through the unit’s own outputs' },
  { key: 'phone', label: 'Phone', note: 'Clicks out loud on this phone, with a flash' },
  { key: 'both', label: 'Both', note: 'The unit clicks and the phone keeps time with it' }
]

export const DEFAULT_METRONOME = { on: false, where: 'unit', watch: false }

/** A stored setting, made safe: anything unreadable is the default. */
export function metronomeSetting(saved) {
  const where = PLACES.some((p) => p.key === saved?.where) ? saved.where : DEFAULT_METRONOME.where
  /* The Apple Watch's tap is its own switch: it keeps time on the wrist
     wherever the click itself is coming from. */
  return { on: saved?.on === true, where, watch: saved?.watch === true }
}

/**
 * Which ends click, for a setting — on a unit whose click the app can switch
 * (`can`, from unitClick) or not, and whose own switch has been HEARD to be
 * on since the app last switched it (`heard`) or not.
 *
 * "The unit metronome click is not working… It only works on the phone, not
 * the unit." On an AM4, and on any unit over Bluetooth, the app cannot switch
 * the unit's click — and Unit picked there used to mean NOTHING clicked
 * anywhere, the phone included, under a line saying the phone kept time. So
 * where the unit cannot click, Unit falls back to the phone, and the choice
 * is kept for when it can.
 *
 * And where it can, the unit has to say so first. "It doesn't turn it on the
 * unit on the FM3" either: the FM3 answers the write "ok" whenever it does not
 * object, which is not the same as clicking. So under Unit the phone keeps
 * time as well until the unit's own switch reads back as on, and stops the
 * moment it does. A click from the phone beats no click at all.
 */
export const clicks = (setting, can = true, heard = true) => {
  const s = metronomeSetting(setting)
  return {
    unit: s.on && can && (s.where === 'unit' || s.where === 'both'),
    phone: s.on && (s.where === 'phone' || s.where === 'both' || (s.where === 'unit' && (!can || !heard))),
    watch: s.on && s.watch
  }
}

/**
 * Whether a place's row is lit. Where the unit cannot click only Phone is
 * offered (placesFor), and the phone is then what clicks whatever was saved —
 * so Phone is lit, and tapping it is not a new choice: a saved Unit stays, for
 * when the unit can click again.
 */
export const placeLit = (setting, key, can = true) => (can ? metronomeSetting(setting).where === key : key === 'phone')

/** A unit's switch read back (normalised 0..1, or an ordinal), as heard on or not. */
export const switchHeardOn = (value) => Number.isFinite(value) && value >= 0.5

/*
 * How soon a unit's switch is read again: quickly while it has not been heard
 * on, then every half minute either way.
 */
export const ASK_AGAIN_MS = [1000, 3000, 10000]
export const KEEP_ASKING_MS = 30000

/**
 * Follow a unit's metronome switch: read it now, and again while it matters.
 *
 * One answer used to decide it for the whole evening. A read lost in a busy
 * moment left the phone clicking over a unit that was clicking too, and a
 * switch turned on, or off, at the unit by hand was never noticed. So the
 * switch is read again — soon while it is not heard on (ASK_AGAIN_MS), then
 * every KEEP_ASKING_MS — for as long as `wanted()` says the setting still asks
 * that unit to click.
 *
 * `read()` resolves the switch's value or null. `answer(on, value)` is handed
 * every answer. `wait`/`stop` are the timer, passed in so a test can turn the
 * clock. Returns the function that stops following.
 */
export function followSwitch({ read, wanted, answer, wait, stop }) {
  let timer = null
  let tries = 0
  let alive = true
  const ask = async () => {
    timer = null
    if (!alive || !wanted()) return
    let value = null
    try {
      value = await read()
    } catch {
      // No answer is an answer: not heard.
    }
    if (!alive || !wanted()) return
    const on = switchHeardOn(value)
    answer(on, value)
    timer = wait(ask, on ? KEEP_ASKING_MS : (ASK_AGAIN_MS[tries++] ?? KEEP_ASKING_MS))
  }
  ask()
  return () => {
    alive = false
    if (timer) stop(timer)
    timer = null
  }
}

/*
 * The unit's Metronome switch, per unit.
 *
 * On the gen-3 units it is a parameter of the GLOBAL virtual block, effect id
 * 1, and its number is the unit's own — the FM3's is not the Axe-Fx III's, and
 * the codec's notes say plainly that sending one unit's number to another
 * "would mis-address" (forgefx-midi gen3/*\/params.ts, GLOBAL_METRONOME).
 *
 * The AM4 is left out on purpose. AM4-Edit's Controllers → Tempo page shows
 * a Metronome switch beside its level (GLOBAL_METRONOME, 0x0001/0x00A0 in its
 * own tables), and that is the address the app used to write as
 * global.metronome — every time an AM4 came online with the click set to
 * Unit. His AM4 froze on SAVING each time until it was restarted. Nothing is
 * written to an AM4's global settings until a read has followed that switch
 * on the AM4's own screen and one write has been tried by hand with the unit
 * in view.
 */
const GEN3 = { fm3: 14878, fm9: 14907, axefxiii: 14655 }

/** How to switch this unit's metronome, by its slug (lib/device-slug), or null. */
export function unitMetronome(slug) {
  const key = String(slug || '').toLowerCase()
  if (GEN3[key]) return { kind: 'block', eid: 1, paramId: GEN3[key] }
  return null
}

/**
 * Whether the app can switch this unit's click from here: `{ can: true }`, or
 * `{ can: false, why }` in plain words for the Metronome page. Over Bluetooth
 * (beta) the phone sends a unit only the handful of messages it is sure of,
 * and a setting is not one of them — nor can it switch OFF a click the unit
 * was already making when Bluetooth was turned on, so the page says so.
 */
export function unitClick(slug, { bluetooth = false, demo = false } = {}) {
  /* The demo's unit makes no sound: Unit there clicked nowhere, under a line saying the unit did. */
  if (demo) return { can: false, why: 'The demo’s unit makes no sound, so the phone keeps time.' }
  if (bluetooth) {
    return {
      can: false,
      why: 'Over Bluetooth the app can’t switch the unit’s click, so the phone keeps time. If the unit was already clicking, switch its Metronome off on the unit.'
    }
  }
  if (String(slug || '').toLowerCase() === 'am4') return { can: false, why: 'The app can’t switch the AM4’s own click yet, so the phone keeps time.' }
  if (!unitMetronome(slug)) return { can: false, why: 'This unit has no metronome the app can switch, so only the phone keeps time.' }
  return { can: true }
}

/** The places to offer: only the phone where the unit's click cannot be switched. */
export const placesFor = (can) => (can ? PLACES : PLACES.filter((p) => p.key === 'phone'))

/** The request that turns it on or off: a path and a body for remoteRequest or ForgeFX. */
export function unitMetronomeRequest(slug, on) {
  const how = unitMetronome(slug)
  if (!how) return null
  const value = on ? 1 : 0
  if (how.kind === 'block') return { method: 'PUT', path: `/preset/blocks/${how.eid}/params/${how.paramId}`, body: { value, continuous: false } }
  return { method: 'PUT', path: '/device/param', body: { key: how.key, value } }
}

/** One beat in milliseconds, or null for a tempo nobody would play to. Same range as the Tap light. */
export function beatMs(bpm) {
  return Number.isFinite(bpm) && bpm >= 20 && bpm <= 400 ? 60000 / bpm : null
}

/**
 * When the next beat is due, from when the click started.
 *
 * Counted from the start rather than from the last beat, so a timer that
 * fires late once does not push every beat after it late too: a JavaScript
 * timer is never exact, and a metronome that drifts is worse than none.
 *
 * AND A TIMER THAT FIRES A MOMENT EARLY IS STILL THAT BEAT. Date.now() is
 * whole milliseconds and a beat seldom is (130 BPM is 461.538 ms), and an
 * Android timer can fire a millisecond or three before it was asked to. Read
 * as "the beat is not here yet", that booked the same beat again a few
 * milliseconds later: a double click and a double flash, on several beats in
 * a hundred at 97, 143 or 177 BPM. Anything within EARLY_MS of a beat is that
 * beat, and the next one is the one after it.
 */
const EARLY_MS = 10
export function nextBeat(startedAt, now, beat) {
  if (!beat) return null
  const n = Math.floor((now - startedAt + EARLY_MS) / beat) + 1
  return startedAt + n * beat
}

/*
 * HOW LONG AFTER THE PHONE IS TOLD TO CLICK THE CLICK IS HEARD, and so how
 * long the flash and the tap wait for it.
 *
 * "The visual edge screen flash is not actually matching up with the sound
 * that the phone makes." The flash is on the glass a frame after it is asked
 * for; the sound has a longer road. On an iPhone, a player that is already
 * rewound and an audio session that is kept awake (lib/metronome.js) still
 * take a few tens of milliseconds to start. On Android the player starts a new
 * audio track on every click and the phone's own output is slower, and the
 * click has 25 ms of silence in front of it (assets/click-pad.wav: Android
 * fades every new track in over its first 20 ms, which used to swallow the
 * click). These are the starting points; Settings → Metronome → Flash timing
 * moves them, which a Bluetooth speaker or headphones will need — the phone
 * cannot tell from here how far away the speaker is.
 */
export const FLASH_LEAD = { ios: 40, android: 100 }
/* What Flash timing may add or take away, and by how much a press. */
export const FLASH_NUDGE = { min: -100, max: 400, step: 20 }
/*
 * As early as Flash timing goes on this phone: the flash on the click itself.
 * Earlier than that would be a press that moves nothing under a line saying
 * it did — on an iPhone, three of them.
 */
export const nudgeFloor = (os) => Math.max(FLASH_NUDGE.min, -(FLASH_LEAD[os] ?? 0))
export const flashNudge = (ms, os) => {
  const n = Math.round(Number(ms) / FLASH_NUDGE.step) * FLASH_NUDGE.step
  const floor = os === undefined ? FLASH_NUDGE.min : nudgeFloor(os)
  return Number.isFinite(n) ? Math.max(floor, Math.min(FLASH_NUDGE.max, n)) : 0
}
/** How long after the click is started the flash and the tap come, on this platform. */
export const flashLead = (os, nudge = 0) => Math.max(0, (FLASH_LEAD[os] ?? 0) + flashNudge(nudge, os))

/** Flash timing in his words: where the flash sits against the standard for this phone. */
export function flashTimingNote(nudge, os) {
  const n = flashNudge(nudge, os)
  if (n === 0) return 'Standard'
  return `${Math.abs(n)} ms ${n > 0 ? 'later' : 'earlier'} than standard`
}

/**
 * What the setting says under it, in his words. `here` is how the unit is
 * reached ({ bluetooth, demo }) and whether its own switch has been heard on
 * ({ heard }).
 */
export function metronomeNote(setting, slug, bpm, here = {}) {
  const s = metronomeSetting(setting)
  if (!s.on) return 'Off'
  const at = beatMs(bpm) ? `${Math.round(bpm)} BPM` : 'the unit’s tempo'
  const place = PLACES.find((p) => p.key === s.where)?.label || 'Unit'
  if ((s.where === 'unit' || s.where === 'both') && !unitMetronome(slug)) return `On, ${at}. This unit has no metronome the app can switch, so only the phone keeps time.`
  if ((s.where === 'unit' || s.where === 'both') && !unitClick(slug, here).can) return `On, ${at}, on the phone`
  if (s.where === 'unit' && here.heard === false) return `On, ${at}, on the phone until the unit says its click is on`
  return `On, ${at}, on the ${place.toLowerCase() === 'both' ? 'unit and the phone' : place.toLowerCase()}`
}

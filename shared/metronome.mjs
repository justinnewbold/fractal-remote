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
 * (`can`, from unitClick) or not.
 *
 * "The unit metronome click is not working… It only works on the phone, not
 * the unit." On an AM4, and on any unit over Bluetooth, the app cannot switch
 * the unit's click — and Unit picked there used to mean NOTHING clicked
 * anywhere, the phone included, under a line saying the phone kept time. So
 * where the unit cannot click, Unit falls back to the phone, and the choice
 * is kept for when it can (his FM3 through the computer).
 */
export const clicks = (setting, can = true) => {
  const s = metronomeSetting(setting)
  return {
    unit: s.on && can && (s.where === 'unit' || s.where === 'both'),
    phone: s.on && (s.where === 'phone' || s.where === 'both' || (!can && s.where === 'unit')),
    watch: s.on && s.watch
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
 * and a setting is not one of them.
 */
export function unitClick(slug, { bluetooth = false } = {}) {
  if (bluetooth) return { can: false, why: 'Over Bluetooth the app can’t switch the unit’s click, so the phone keeps time.' }
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
 */
export function nextBeat(startedAt, now, beat) {
  if (!beat) return null
  const n = Math.floor((now - startedAt) / beat) + 1
  return startedAt + n * beat
}

/** What the setting says under it, in his words. `here` is how the unit is reached ({ bluetooth }). */
export function metronomeNote(setting, slug, bpm, here = {}) {
  const s = metronomeSetting(setting)
  if (!s.on) return 'Off'
  const at = beatMs(bpm) ? `${Math.round(bpm)} BPM` : 'the unit’s tempo'
  const place = PLACES.find((p) => p.key === s.where)?.label || 'Unit'
  if ((s.where === 'unit' || s.where === 'both') && !unitMetronome(slug)) return `On, ${at}. This unit has no metronome the app can switch, so only the phone keeps time.`
  if ((s.where === 'unit' || s.where === 'both') && !unitClick(slug, here).can) return `On, ${at}, on the phone`
  return `On, ${at}, on the ${place.toLowerCase() === 'both' ? 'unit and the phone' : place.toLowerCase()}`
}

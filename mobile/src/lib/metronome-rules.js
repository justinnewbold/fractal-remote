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
 * later) and AM4 all carry a Metronome switch in Setup → Global, and it
 * clicks through the unit's own outputs at the unit's own tempo — the one the
 * Tap button and the tempo box already set. That is the click to play to: it
 * is in the same speakers as the guitar and the unit keeps the time itself.
 *
 * The phone's click is the other half: until the next store build it is a
 * flash and a tap you feel, and after it a sound (docs/pending/metronome.patch).
 *
 * Both apps read this file — the phone through the copy `npm run sync:rules`
 * writes — so the two can never disagree about which number turns an FM3's
 * metronome on.
 */

/** Where the click goes. 'unit' is the default: it is the one with steady time. */
export const PLACES = [
  { key: 'unit', label: 'Unit', note: 'Clicks through the unit’s own outputs' },
  { key: 'phone', label: 'Phone', note: 'Flashes and taps on this phone' },
  { key: 'both', label: 'Both', note: 'The unit clicks and the phone keeps time with it' }
]

export const DEFAULT_METRONOME = { on: false, where: 'unit' }

/** A stored setting, made safe: anything unreadable is the default. */
export function metronomeSetting(saved) {
  const where = PLACES.some((p) => p.key === saved?.where) ? saved.where : DEFAULT_METRONOME.where
  return { on: saved?.on === true, where }
}

/** Which ends click, for a setting. */
export const clicks = (setting) => {
  const s = metronomeSetting(setting)
  return {
    unit: s.on && (s.where === 'unit' || s.where === 'both'),
    phone: s.on && (s.where === 'phone' || s.where === 'both')
  }
}

/*
 * The unit's Metronome switch, per unit.
 *
 * On the gen-3 units it is a parameter of the GLOBAL virtual block, effect id
 * 1, and its number is the unit's own — the FM3's is not the Axe-Fx III's, and
 * the codec's notes say plainly that sending one unit's number to another
 * "would mis-address" (forgefx-midi gen3/*\/params.ts, GLOBAL_METRONOME). The
 * AM4 names it instead: global.metronome, written through /device/param.
 */
const GEN3 = { fm3: 14878, fm9: 14907, axefxiii: 14655 }

/** How to switch this unit's metronome, by its slug (lib/device-slug), or null. */
export function unitMetronome(slug) {
  const key = String(slug || '').toLowerCase()
  if (GEN3[key]) return { kind: 'block', eid: 1, paramId: GEN3[key] }
  if (key === 'am4') return { kind: 'key', key: 'global.metronome' }
  return null
}

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

/** What the setting says under it, in his words. */
export function metronomeNote(setting, slug, bpm) {
  const s = metronomeSetting(setting)
  if (!s.on) return 'Off'
  const at = beatMs(bpm) ? `${Math.round(bpm)} BPM` : 'the unit’s tempo'
  const place = PLACES.find((p) => p.key === s.where)?.label || 'Unit'
  if ((s.where === 'unit' || s.where === 'both') && !unitMetronome(slug)) return `On, ${at}. This unit has no metronome the app can switch, so only the phone keeps time.`
  return `On, ${at}, on the ${place.toLowerCase() === 'both' ? 'unit and the phone' : place.toLowerCase()}`
}

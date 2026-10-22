/* Generated from shared/am4-boost.mjs by scripts/sync-relay-rules.mjs.
 * Do not edit. Change the source and run `npm run sync:rules`; the test suite
 * fails on any difference between the two. */

/**
 * ON AN AM4, THE AMP'S PEDAL IS ITS BOOST.
 *
 * "On the AM4 the amp on off button should do an amp boost instead of turning
 * the amp completely off. It should say Boost on, Boost off when they tap it."
 * (Justin, 22 October 2026.)
 *
 * It is what the AM4 itself does with its own footswitch: its global settings
 * have "Tap Current Ch. in Amp Mode: Nothing / Boost" and "Tap Amp in FX Mode:
 * Nothing / Bypass / Boost". So on an AM4 the amp's pedal on Play (the phone's,
 * the watch's and the browser's stage) switches the amp's Out Boost and never
 * turns the amp off. The amp's real on and off stays where a block is edited:
 * Edit, the amp, Engaged / Bypassed. Every other block, and every other unit's
 * amp, is a pedal that switches on and off as it always was.
 *
 * WHAT THE SWITCH IS. The codec's `amp.out_boost` (forgefx-midi
 * src/am4/params.ts): the amp block, 0x3a, parameter 0x96 = 150, an enum, 0 OFF
 * and 1 ON, wire-verified from AM4-Edit's own toggle (its session-29 capture).
 * Not the Out Boost Level (parameter 8, 0 to 4 dB, which this never touches),
 * not an input boost, not a mid or gain boost, and not the "Bypass" entry the
 * computer puts at the head of the list (id 0xffff).
 *
 * THE ROAD, through a computer: the two routes every computer app out there
 * already serves for an AM4, so nothing on the computer has to change.
 *
 *   - read:  GET /preset/blocks/58/params. Its `enums` carry the switch, for
 *            the channel the amp is on. The computer answers it out of the
 *            copy of the preset it made for the chain read just before, so
 *            asked straight after one it costs the unit nothing.
 *   - write: PUT /preset/blocks/58/params/150 { value: 0 or 1, continuous:
 *            false }, which the computer turns into one frame, byte for byte
 *            the codec's own buildSetParam('amp.out_boost', value). Always the
 *            value wanted, never a toggle: an absolute value is safe to send
 *            again, a toggle sent twice is no change at all.
 *
 * Justin's other app (Axiom) writes the same switch with `continuous: true`,
 * the normalised path. This writes the captured one instead, the action
 * AM4-Edit itself sends for it, and the path every discrete selector in this
 * app already takes. It also finds the switch by its number, where Axiom
 * matches names and falls back to the boost level; and an unread boost is
 * unknown here, where Axiom draws it off.
 *
 * IT IS PER CHANNEL. The AM4's block read holds four copies of every setting,
 * one per channel A to D, and the switch sits inside each copy; so a scene or
 * a channel that moves the amp to another channel can move the boost with it,
 * and a preset change always may. What was read is kept with the preset and
 * the channel it was read for, and shown only while both are still the ones on
 * screen: otherwise it is unknown until it is read again, which each end does
 * after every chain read.
 *
 * OVER BLUETOOTH (Justin's only) the phone has no way to read it yet: the
 * AM4's answer to that read has never been seen, and the AM4 has frozen on
 * messages it did not expect. So the write goes (the same frame, on the
 * phone's allowlist) and nothing reads: unknown until tapped, and the first
 * tap sends Boost on, as a VP4's unread pedal is turned off by its first tap.
 *
 * Zero imports: plain ESM for Node, Vite and Metro alike.
 */

/** The AM4's amp block (0x3a) and its Out Boost switch (0x96). */
export const AMP_BOOST = Object.freeze({ eid: 0x3a, paramId: 0x96 })

/* The words. US spelling, plain, and short enough for a tile's corner where there is room. */
export const BOOST_ON = 'Boost on'
export const BOOST_OFF = 'Boost off'
/* The amp itself is off in this scene (from Edit, or the scene): its boost could not be heard. */
export const AMP_OFF = 'Amp off'

/* What a tap that sent nothing says, and why. */
export const AMP_OFF_SAYS = 'The amp is off in this scene, so its boost can’t be heard. Turn the amp on in Edit.'
export const BOOST_UNREAD = 'The amp’s boost couldn’t be read from the unit, so nothing was sent. Try it again in a moment.'
export const OTHER_AMP_SAYS = 'The app can switch the boost of the AM4’s first amp only.'

/** The four things a boost pedal can show. */
export const BOOST = Object.freeze({ on: 'on', off: 'off', ampOff: 'amp-off', unknown: 'unknown' })

/** Whether the unit is an AM4, by the slug both ends file it under (shared/device-slug). */
export const isAm4 = (slug) => String(slug || '').toLowerCase() === 'am4'

/**
 * What an AM4's amp pedal is: 'boost' for the amp at its own block code, the
 * one whose Out Boost the codec has verified; 'other' for an amp at any other
 * code (a second amp, whose addressing nobody has seen), which switches
 * nothing from Play and never falls back to a bypass; null for every other
 * block, and for every block of every other unit.
 */
export function ampPedal(slug, block) {
  if (!isAm4(slug) || block?.slug !== 'amp') return null
  return block.effectId === AMP_BOOST.eid ? 'boost' : 'other'
}

/**
 * The switch, out of the answer to GET /preset/blocks/58/params: true for ON,
 * false for OFF, and null for anything else (no answer, another block, no
 * entry, or a value that is not exactly 0 or 1).
 *
 * By its number AND its name, and only where its options are OFF and ON when
 * it lists them: never by position, since the list opens with a made-up
 * Bypass entry and the amp's cab rides in it under other numbers.
 */
export function boostOf(params) {
  if (!params || typeof params !== 'object') return null
  if (params.slug && params.slug !== 'amp') return null
  const list = Array.isArray(params.enums) ? params.enums : []
  const entry = list.find((e) => e && e.id === AMP_BOOST.paramId && /^out boost$/i.test(String(e.name || '').trim()))
  if (!entry) return null
  if (Array.isArray(entry.options) && entry.options.length) {
    const label = (v) => String(entry.options.find((o) => o && o.value === v)?.label ?? '').trim().toUpperCase()
    if (label(0) !== 'OFF' || label(1) !== 'ON') return null
  }
  return entry.value === 1 ? true : entry.value === 0 ? false : null
}

/** Where the switch is read from. */
export const boostReadPath = () => `/preset/blocks/${AMP_BOOST.eid}/params`

/**
 * The write for Boost on (true) or off (false): the computer's discrete path,
 * the value as a whole number, nothing else. `eid` and `paramId` ride along
 * for an end that answers it itself (the browser's demo).
 */
export function boostRequest(on) {
  if (typeof on !== 'boolean') throw new Error('a boost is written on or off, never toggled')
  return {
    method: 'PUT',
    path: `/preset/blocks/${AMP_BOOST.eid}/params/${AMP_BOOST.paramId}`,
    body: { value: on ? 1 : 0, continuous: false },
    eid: AMP_BOOST.eid,
    paramId: AMP_BOOST.paramId
  }
}

/**
 * What one end knows of the switch, kept: which preset and which channel it
 * was read (or written) for, and `on` true, false or null (read, and not
 * readable).
 */
export const keptBoost = (number, channel, on) => ({ number: number ?? null, channel: channel ?? null, on: on === true || on === false ? on : null })

/** Whether `boost` was kept for this preset and this amp's channel. */
export const boostFor = (boost, number, block) =>
  !!boost && boost.number === (number ?? null) && boost.channel === (block?.channel ?? null)

/**
 * What a boost pedal shows: Amp off when the unit says the amp itself is off
 * (its boost would not be heard, and Play cannot turn it on again); otherwise
 * on or off as last read or sent for this preset and this channel; otherwise
 * unknown.
 */
export function boostState(boost, number, block) {
  if (block?.bypassed === true) return BOOST.ampOff
  if (!boostFor(boost, number, block)) return BOOST.unknown
  return boost.on === true ? BOOST.on : boost.on === false ? BOOST.off : BOOST.unknown
}

/** The word in the tile's corner: Boost on, Boost off, Amp off, or none while unknown. */
export const boostWord = (state) => (state === BOOST.on ? BOOST_ON : state === BOOST.off ? BOOST_OFF : state === BOOST.ampOff ? AMP_OFF : null)

/**
 * The stage's pedals for a picture that knows only on and off, the Apple
 * Watch's: an AM4's boost pedal is lit for Boost on and dark otherwise, so the
 * wrist shows what Play shows. Everything else is passed through untouched.
 */
export function boostPedals(chain, { slug, boost, number } = {}) {
  if (!isAm4(slug) || !Array.isArray(chain)) return chain
  return chain.map((b) => (ampPedal(slug, b) === 'boost' ? { ...b, bypassed: boostState(boost, number, b) !== BOOST.on } : b))
}

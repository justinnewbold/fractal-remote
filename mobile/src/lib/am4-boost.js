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
 *            asked straight after one it costs the unit nothing. Never asked
 *            after a channel change: the computer throws its copy away when
 *            it writes a channel, so that read would be a dump of the whole
 *            preset just as the unit switches (ForgeFX's FORGEFX-25 heard
 *            dumps after a channel swap glitch an AM4's sound). The boost is
 *            unknown for the new channel until the next chain read or a tap.
 *            Never asked while a preset is still loading, before its own
 *            chain read (BOOST_LOADING), for the same reason. And never
 *            believed out of a chain read asked before a boost tap: that copy
 *            was begun before the tap, and the computer keeps it after the
 *            tap's write, so it says the boost the unit had before.
 *   - write: PUT /preset/blocks/58/params/150 { value: 0 or 1, continuous:
 *            false }, which the computer turns into one frame, byte for byte
 *            the codec's own buildSetParam('amp.out_boost', value). Always the
 *            value wanted, never a toggle: an absolute value is safe to send
 *            again, a toggle sent twice is no change at all. A computer app
 *            from 1.87.49 sends it as it sends a bypass, at once. An older
 *            one sends the same frame at once too, but then holds its one
 *            MIDI queue up to 0.6 s for an answer the AM4 never gives over
 *            USB, so a scene or a preset tapped in that time goes out up to
 *            0.6 s late. The boost works on every computer, so the computer
 *            is not asked to update for it (COMPUTER_NEEDED, versions.mjs).
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
 * and a preset change always may. What was read is kept with the load of the
 * preset it was read for (`at`, which each end makes from the unit, the
 * computer it came through, the preset and the time that preset was loaded)
 * and the channel, and shown only while both are still the ones on screen:
 * otherwise it is unknown until it is read again, which each end does after
 * every chain read. A preset loaded again is a new load: the unit has its
 * stored boost back, whatever was sent before.
 *
 * OVER BLUETOOTH (Justin's only) the phone has no way to read it yet: the
 * AM4's answer to that read has never been seen, and the AM4 has frozen on
 * messages it did not expect. So the write goes (the same frame, on the
 * phone's allowlist) and nothing reads: unknown until tapped, and the first
 * tap sends Boost on, as a VP4's unread pedal is turned off by its first tap.
 * A preset loaded again makes it unknown again (see `at` above).
 *
 * THE WATCH asks for a state, not a change: its pedal says Boost on or Boost
 * off, which is sent as it is, so a message the watch sends twice (it does,
 * when the phone's answer is late) is the same boost twice, never on and then
 * off again. Play's own tile is the one that toggles.
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

/* What a screen reader hears for a boost pedal with no word on it. */
export const BOOST_NOT_READ = 'Boost not read yet'
export const BOOST_CANT = 'Boost can’t be switched yet'

/* What a tap that sent nothing says, and why. */
export const AMP_OFF_SAYS = 'The amp is off in this scene, so its boost can’t be heard. Turn the amp on in Edit.'
export const BOOST_UNREAD = 'The amp’s boost couldn’t be read from the unit, so nothing was sent. Try it again in a moment.'
/* An amp at another code than the AM4's own (a second amp, whose addressing nobody has seen). The same words at every end, Bluetooth's guard included. */
export const OTHER_AMP_SAYS = 'The app can’t switch this amp’s boost yet.'
/* Another computer, or another unit, is being found, and has not said what it is yet: a boost sent now could reach a unit that is not an AM4. */
export const BOOST_WAIT = 'The unit is still being found, so the boost wasn’t sent. Try it again in a moment.'
/* The computer says no unit is there now. */
export const BOOST_NO_UNIT = 'The unit isn’t answering, so the boost wasn’t sent.'
/*
 * A preset picked a moment ago, whose own chain read (which reads the boost
 * with it) waits for the unit to finish loading it: a boost not read yet is
 * not read before then, since that read would be a whole preset dump sent to
 * a unit still loading. Said until that read is over, landed or not: once it
 * is, a tap reads the boost first, as at any other time.
 */
export const BOOST_LOADING = 'The preset is still loading, so the boost wasn’t sent. Try it again in a moment.'

/*
 * The one-time note over the browser's Play: the hold, and what a tap does.
 * On an AM4 the amp is the one block the note names whose tap is not an on
 * and off any more, so there it says so, and where the amp's own on and off
 * went. Here so the phone can use the same words if it ever has the note.
 */
export const PLAY_HINT_HOLD = 'Hold a block — the amp, the drive, any of them — to bring up its channels and pick the one this scene plays.'
export const PLAY_HINT_TAP = 'A tap just switches it on and off.'
export const PLAY_HINT_TAP_AM4 = 'A tap just switches it on and off, except the AM4’s amp: its tap switches the amp’s boost, and the amp itself goes on and off in Edit.'
export const playHintTap = (slug) => (isAm4(slug) ? PLAY_HINT_TAP_AM4 : PLAY_HINT_TAP)

/** The five things a boost pedal can show: 'other' is an AM4 amp whose boost the app cannot switch. */
export const BOOST = Object.freeze({ on: 'on', off: 'off', ampOff: 'amp-off', unknown: 'unknown', other: 'other' })

/** Whether the unit is an AM4, by the slug both ends file it under (shared/device-slug). */
export function isAm4(slug) {
  return String(slug || '').toLowerCase() === 'am4'
}

/* The slug a detect gives when the computer names no unit (shared/device-slug DEFAULT_SLUG), or none yet. */
const noUnit = (slug) => !slug || slug === 'device'

/**
 * WHICH UNIT A PEDAL ON SCREEN IS JUDGED BY: the live one, or, while the
 * computer says no unit is there (a cable out for a moment, AM4-Edit holding
 * the port), the last real one read, `last`, whose chain is the one still up.
 * Otherwise an AM4 amp's pedal turned back into an on and off for those
 * seconds, and its tap a bypass that reached the AM4 the moment it answered.
 */
export const pedalUnit = (live, last) => (noUnit(live) && !noUnit(last) ? last : live)

/** Whether the live unit is missing while the chain on screen is a real unit's: a pedal tap then sends nothing. */
export const unitMissing = (live, last) => noUnit(live) && !noUnit(last)

/**
 * What an AM4's amp pedal is: 'boost' for the amp at its own block code, the
 * one whose Out Boost the codec has verified; 'other' for an amp at any other
 * code (a second amp, whose addressing nobody has seen), which switches
 * nothing from Play and never falls back to a bypass; null for every other
 * block, and for every block of every other unit. `slug` is pedalUnit's.
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
 * Which load of which preset, on which unit through which computer, a boost
 * is kept for: each end makes it from what it already counts (its unit era,
 * moved by another computer or another unit, and its preset run, moved by
 * every preset load), with the preset's number. Opaque everywhere else.
 */
export const boostAt = (unitEra, presetRun, number) => `${unitEra}:${presetRun}:${number ?? ''}`

/**
 * What one end knows of the switch, kept: which load (`at`) and which channel
 * it was read (or written) for, and `on` true or false (null for anything
 * else, which no end keeps: an answer with no switch that can be shown is
 * not an answer, and the next tap reads again).
 */
export const keptBoost = (at, channel, on) => ({ at: at ?? null, channel: channel ?? null, on: on === true || on === false ? on : null })

/** Whether `boost` was kept for this load and this amp's channel. */
export const boostFor = (boost, at, block) => !!boost && boost.at !== null && boost.at === (at ?? null) && boost.channel === (block?.channel ?? null)

/**
 * What a boost pedal shows: Amp off when the unit says the amp itself is off
 * (its boost would not be heard, and Play cannot turn it on again); otherwise
 * on or off as last read or sent for this load and this channel; otherwise
 * unknown.
 */
export function boostState(boost, at, block) {
  if (block?.bypassed === true) return BOOST.ampOff
  if (!boostFor(boost, at, block)) return BOOST.unknown
  return boost.on === true ? BOOST.on : boost.on === false ? BOOST.off : BOOST.unknown
}

/** What a pedal on Play shows for an AM4's amp: its boost state, 'other' for an amp whose boost cannot be switched, and null for any other pedal. */
export function pedalBoost(slug, block, boost, at) {
  const pedal = ampPedal(slug, block)
  return pedal === 'boost' ? boostState(boost, at, block) : pedal === 'other' ? BOOST.other : null
}

/** The word on the tile: Boost on, Boost off, Amp off, or none while unknown, or for an amp whose boost cannot be switched. */
export const boostWord = (state) => (state === BOOST.on ? BOOST_ON : state === BOOST.off ? BOOST_OFF : state === BOOST.ampOff ? AMP_OFF : null)

/** What a screen reader says for it: the word, or why there is none. */
export const boostLabel = (state) => boostWord(state) || (state === BOOST.other ? BOOST_CANT : BOOST_NOT_READ)

/** The words the browser's tile says when a mouse rests on it. */
export function boostTitle(state, holds) {
  if (state === BOOST.ampOff) return AMP_OFF_SAYS
  if (state === BOOST.other) return OTHER_AMP_SAYS
  return `Tap to switch the amp’s boost on or off.${holds ? ' Hold, or right-click, to switch channels.' : ''}`
}

/**
 * The stage's pedals for a picture that knows only on and off, the Apple
 * Watch's: an AM4's boost pedal is lit for Boost on and dark otherwise (`shown`
 * is what Play shows for it, rig.boostNow), so the wrist shows what Play
 * shows; an amp whose boost cannot be switched is dark. Everything else is
 * passed through untouched.
 */
export function boostPedals(chain, { slug, shown } = {}) {
  if (!isAm4(slug) || !Array.isArray(chain)) return chain
  return chain.map((b) => {
    const pedal = ampPedal(slug, b)
    if (pedal === 'boost') return { ...b, bypassed: shown !== BOOST.on }
    if (pedal === 'other') return { ...b, bypassed: true }
    return b
  })
}

/*
 * EACH GEN 3 UNIT'S OWN BLOCKS, BY EFFECT ID, FOR BLUETOOTH (BETA).
 *
 * Over Bluetooth the phone names the unit's status dump itself (bleWire
 * gen3Blocks, through lib/chain-outline), and an id the list does not know is
 * left off Play. The list was the FM3's (data/blocks.json, read off an FM3,
 * byte for byte the computer app's FM3 list), so on an FM9 or an Axe-Fx III
 * the second amp, the second cab, the third and fourth drives and the rest
 * never showed, and could not be switched.
 *
 * WHERE THE EXTRA ONES COME FROM, and nothing new is sent for them: the ids
 * are the unit's own, in its dump. They are named by Fractal's published
 * effect-ID enum, in which instance N of a block is its first id plus N − 1
 * (ID_DISTORT1..4, the Amp, 58 to 61), and counted by Fractal's Blocks Guide
 * ("Product BLOCKS Comparison", June 2023): two amps and two cabs on both, a
 * third drive on the FM9 and a fourth on the III, and so on. The computer
 * app's own lists for the two units (ForgeFX, at the pin) agree, id for id
 * and name for name: a family with more than one is "Amp 1", "Amp 2", and
 * Play's pedalName drops a lone " 1", so the screen reads Amp and Amp 2.
 *
 * THE AXE-FX III'S OWN TWO, which the FM3 has none of (OWN, below): its IR
 * Player, 195 to 198 in Fractal's enum, and the NAM block that firmware 33
 * brought, up to two to a preset. The enum the codec carries is from before
 * NAM (forgefx-midi marks it firstId null, 'pending-capture'), so its ids are
 * the unit's own: a customer's Axe-Fx III on firmware 33.01, asked to put
 * both NAM blocks in one preset, one on and one off, listed 206 and 207 in
 * every NAM preset, always one on and one off, and neither in a preset with
 * no NAM. Each has a family Play already paints ('nam', 'irplayer' in
 * lib/blockPalettes), and is switched by the same published bypass as every
 * other block. Neither has knobs in the app yet: the Axe-Fx III's knob
 * catalog (lib/axefx3-knobs.js) carries no NAM or IR Player, so Edit gives
 * them their on and off and says so (bleWire marks them `knobs: false`).
 * Through the computer nothing changes: it passes them on with no slug, and
 * they stay a New block (shared/new-block.mjs).
 *
 * Since 13 November 2026 the NAM block has a hand-written list of its knobs
 * (lib/axefx3-own-knobs.js, off Justin's own III and Axe-Edit III's NAM
 * page), for the accounts lib/features NAM_KNOBS_FOR_EVERYONE opens it to:
 * his alone, so far. For them the wire does not mark a NAM, and Edit opens
 * its knobs with one line under them (NAM_ON_THE_UNIT, below). For every
 * other account, and for the IR Player on every account, the paragraph
 * above is still the whole of it.
 *
 * AND THE REST THE FM3 HAS NONE OF, since 13 November 2026 (OWN, below): the
 * Crossover (two), the Vocoder and Tone Match on an FM9 and an Axe-Fx III,
 * and on the III alone its Dynamic Distortion (two). Until then the page
 * said they were not shown on Play (shared/bluetooth-gear missingBlocksLine).
 * Each has a family Play already paints ('crossover', 'vocoder',
 * 'tonematch', 'dynadist' in lib/blockPalettes), is switched by the same
 * published bypass as every other block, and has no knobs in the app: no
 * knob catalog names one, so the wire marks each `knobs: false` and Edit
 * gives it its on and off and NO_KNOBS_YET, exactly as the IR Player.
 * Through the computer nothing changes for these either: its lists for the
 * two units name none of them, and they stay a New block there.
 *
 * Where their ids come from. On the Axe-Fx III they were READ OFF A UNIT:
 * Justin's own (Mark II, firmware 33.01), on 13 November 2026, with the
 * block reader, each block known by what it answered and by Axe-Edit III's
 * page for it (docs/ax3-readings.md). 134 is the Vocoder, 142 Crossover 1
 * and 170 Tone Match, which is also what Fractal's published enum says
 * (ID_VOCODER1, ID_CROSSOVER1, ID_TONEMATCH1), so the read confirms the
 * enum on these; and 202 is Dynamic Distortion 1, which like NAM is in no
 * published enum: the unit's own id. Each answered with a bypass among its
 * settings (18, 14, 8 and 11). The second of a pair was not read: 143 is
 * Crossover 2 and 203 Dynamic Distortion 2 because the enum gives every
 * family consecutive ids and Axe-Edit III on that firmware offers two of
 * each ("X-Over 1-2", "DynDst 1-2").
 *
 * THE FM9'S THREE WERE NOT READ OFF A UNIT. They stand on the published
 * enum and Fractal's Blocks Guide, the same grounds as the FM9's second amp
 * and the rest of MORE: one Vocoder, two Crossovers, one Tone Match, and no
 * Dynamic Distortion, which an FM9 does not have.
 *
 * Not drawn, on any unit: the ids that are not blocks a player switches
 * (NOT_BLOCKS, below), the RTA among them, which has nothing to switch.
 *
 * The FM3 keeps blocks.json exactly as it is, and so do the relay path, Edit
 * and the demo, which read it through lib/blockCatalog.
 */
import blocks from '../data/blocks.json' with { type: 'json' }

/* How many of each family the unit has beyond the FM3's list, by its first id: Fractal's Blocks Guide. */
const MORE = {
  fm9: {
    37: 4, // Input 1–4 (39, 40)
    42: 3, // Output 1–3 (44)
    50: 4, // Graphic EQ (52, 53)
    54: 4, // Parametric EQ (56, 57)
    58: 2, // Amp (59)
    62: 2, // Cab (63)
    66: 2, // Reverb (67)
    102: 4, // Volume/Pan (104, 105)
    118: 3, // Drive (120)
    138: 2, // Megatap Delay (139)
    146: 4, // Gate/Expander (148, 149)
    154: 2, // Multiband Comp (155)
    158: 2 // Ten-Tap Delay (159)
  },
  axefx3: {
    37: 5, // Input 1–5 (39–41)
    42: 4, // Output 1–4 (44, 45)
    46: 4, // Compressor (48, 49)
    50: 4,
    54: 4,
    58: 2,
    62: 2,
    66: 2,
    70: 4, // Delay (72, 73)
    102: 4,
    110: 2, // Pitch (111)
    118: 4, // Drive (120, 121)
    130: 2, // Synth (131)
    138: 2,
    146: 4,
    154: 2,
    158: 2,
    178: 2 // Plex Delay (179)
  }
}

/*
 * THE BLOCKS THE FM3 HAS NONE OF, by their first id: the family, the name
 * and how many. Named as every family of more than one is, "NAM 1" and
 * "NAM 2", and Play's pedalName drops a lone " 1", so a preset with one NAM
 * reads NAM, and one Crossover reads Crossover. No knobs and no models in
 * the app for any of them (0 and 0; the NAM block's hand-written knobs are
 * lib/axefx3-own-knobs.js, for the accounts they are open to).
 */
const OWN = {
  /* By Fractal's enum and Blocks Guide, not read off a unit. */
  fm9: [
    { page: 134, slug: 'vocoder', name: 'Vocoder', count: 1 }, // ID_VOCODER1
    { page: 142, slug: 'crossover', name: 'Crossover', count: 2 }, // ID_CROSSOVER1, 2 (142, 143)
    { page: 170, slug: 'tonematch', name: 'Tone Match', count: 1 } // ID_TONEMATCH1
  ],
  axefx3: [
    { page: 134, slug: 'vocoder', name: 'Vocoder', count: 1 }, // read off his III, and Fractal's enum
    { page: 142, slug: 'crossover', name: 'Crossover', count: 2 }, // 142 read off his III, and Fractal's enum; 143 the next id, not read
    { page: 170, slug: 'tonematch', name: 'Tone Match', count: 1 }, // read off his III, and Fractal's enum
    { page: 195, slug: 'irplayer', name: 'IR Player', count: 4 }, // IR Player 1–4, Fractal's enum (195–198)
    { page: 202, slug: 'dynadist', name: 'Dynamic Distortion', count: 2 }, // 202 read off his III, the unit's own id; 203 the next, not read
    { page: 206, slug: 'nam', name: 'NAM', count: 2 } // NAM 1 and 2, the unit's own ids (firmware 33)
  ]
}

/*
 * KNOWN, AND NEVER DRAWN OR SWITCHED. The ids in Fractal's enum that are not
 * blocks a player turns on and off: the Controllers (2), Scene MIDI (190),
 * the Foot Controller (199) and Preset FC (200), which forgefx-midi marks
 * `addressable: false` ("set_bypass / set_channel refuse with a clean error
 * for these"). The same ids on every gen-3 unit. The Axe-Fx III lists 200 in
 * every preset's status answer, so the log said it on every preset change;
 * now it is known, left off Play as before, and a bypass or channel for one
 * is refused with nothing sent (bleWire).
 *
 * And 201, the preset's Performance page, which is not in Fractal's
 * published enum: read off Justin's own Axe-Fx III on 13 November 2026 with
 * the block reader (docs/ax3-readings.md). Ten controls, each a label, the
 * block it points at and the setting it turns. In every preset's status
 * answer on a III, and nothing a player switches.
 *
 * And 174, the RTA (the Realtime Analyzer, ID_RTA1 in Fractal's enum): a
 * block with a place on the grid and NO ON AND OFF. Read off Justin's own
 * Axe-Fx III the same day: five settings (which input it listens to, how
 * many bands, the decay, the window, and a list nobody has a name for), and
 * not one of them a bypass, a Level or a Bypass Mode, where every block a
 * player switches answered with all three; Axe-Edit III's page for it has
 * no Bypass button either. So there is nothing for Play to switch, and a
 * tile that could not be turned off would only look broken. It is here so
 * the log stops calling it a block with no name, and so a bypass or a
 * channel for it is refused with nothing sent.
 */
export const NOT_BLOCKS = Object.freeze([2, 174, 190, 199, 200, 201])

/*
 * WHAT EDIT SAYS ON ONE OF THEM, under its on and off, where the knobs would
 * be (bleWire marks the block `knobs: false`): no knob page, no read asked
 * for, and no refusal put up red.
 */
export const NO_KNOBS_YET = 'This block’s knobs aren’t in the app yet.'

/*
 * WHAT EDIT SAYS ON A NAM BLOCK WHOSE KNOBS ARE OPEN, once, under its knobs
 * and its Level, where a block's model would be: what the app leaves to the
 * unit. The capture is a list of whatever is loaded on that unit, which the
 * app cannot name, so there is no picker for it (lib/axefx3-own-knobs.js).
 * Only what is true now: no promise of when.
 */
export const NAM_ON_THE_UNIT = 'The capture is chosen on the unit itself.'

/* A block's name for its instance: "Amp 2", from the FM3's "Amp", or "Drive 3" from "Drive 1". */
const named = (base, instance, many) => {
  const plain = String(base).replace(/\s+\d+$/, '')
  return many ? `${plain} ${instance}` : plain
}

function build(unit) {
  const more = MORE[unit]
  if (!more) return blocks
  const out = []
  for (const b of blocks) {
    const first = b.page - (b.instance - 1)
    const count = more[first]
    /* A family that grows on this unit: every instance named with its number, as the computer app names them. */
    out.push(count ? { ...b, name: named(b.name, b.instance, true) } : b)
  }
  for (const [firstId, count] of Object.entries(more)) {
    const first = blocks.find((b) => b.page === Number(firstId))
    if (!first) continue
    for (let instance = 2; instance <= count; instance++) {
      const page = first.page + instance - 1
      if (out.some((b) => b.page === page)) continue
      out.push({ ...first, instance, page, name: named(first.name, instance, true) })
    }
  }
  /* And the ones the FM3 has none of (OWN), each instance the next id. */
  for (const fam of OWN[unit] || []) {
    for (let instance = 1; instance <= fam.count; instance++) {
      const page = fam.page + instance - 1
      if (out.some((b) => b.page === page)) continue
      out.push({ slug: fam.slug, family: fam.slug, instance, name: named(fam.name, instance, fam.count > 1), page, paramCount: 0, typeCount: 0 })
    }
  }
  return out.sort((a, b) => a.page - b.page)
}

const BY_UNIT = { fm3: blocks, fm9: build('fm9'), axefx3: build('axefx3') }

/** The block list a Bluetooth wire names a unit's dump by: its own on an FM9 or Axe-Fx III (with the blocks the FM3 has none of: OWN), the FM3's for the rest. */
export const catalogFor = (unit) => BY_UNIT[unit] || blocks

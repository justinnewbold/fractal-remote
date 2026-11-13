/*
 * THE BLOCKS THE COMPUTER HAS NO NAME FOR, NAMED BY THE PHONE.
 *
 * "NAM shows up on Bluetooth but not when connected through my raspberry
 * pie" and "I would rather use the pi if that's possible." (Justin, 13
 * November 2026, his own Axe-Fx III on firmware 33.01.)
 *
 * Over Bluetooth the phone names the unit's blocks itself (lib/gen3Catalog),
 * so an Axe-Fx III's NAM, IR Player, Crossover, Vocoder, Tone Match and
 * Dynamic Distortion are on Play. Through the computer the engine names
 * them (ForgeFX, at the pin), and its list for the III and the FM9 has none
 * of these: it passes each on with its place in the grid, whether it is on,
 * its channel and its effect id, and NO SLUG, so the phone kept it as a New
 * block (lib/new-block) and Play left it out.
 *
 * Nothing more is needed from the computer to draw and switch one. The
 * engine's own routes take the id as it is: POST /preset/blocks/<id>/bypass
 * builds Fractal's published bypass for whatever id it is handed, the frame
 * the phone sends over Bluetooth for the same block, and the channel route
 * the same. So the phone names the block here, from the same list it uses
 * over Bluetooth, and Play draws it and switches it through the computer.
 *
 * AND IT IS STILL A NEW BLOCK TO EVERYTHING THAT MOVES OR EDITS THE CHAIN.
 * It keeps `unknown: true`, so every rule that protects a block the app
 * cannot place holds as it did (lib/new-block isNewBlock: lib/split-chain,
 * lib/grid-plan, Edit's own list, the scenes): its cell is taken, it is
 * never moved, replaced or dealt in a drag, and Edit does not open it. The
 * engine has no name for it, so a placement write that named it would be a
 * write nobody has seen it take. What is new is its marks: `onPlay`, which
 * lib/device stageBlocks lets through, and either `knobs: false`, the mark
 * the Bluetooth wire gives a block with no knob catalog, so a hold on Play
 * opens its channels and asks for no knobs, or `turns: true` where the
 * computer can answer its knobs (turnsThroughComputer, below), which
 * lib/device editBlocks lets into Edit's own list.
 *
 * Only on an FM9 or an Axe-Fx III, by the name the computer gives the unit
 * (lib/device-slug), and only the six families lib/gen3Catalog OWN adds:
 * every other block with no slug stays the New block it was. Imports the
 * list and nothing else.
 */
import { catalogFor } from './gen3Catalog.js'

/** The families the phone names for itself: lib/gen3Catalog OWN. */
export const OWN_FAMILIES = Object.freeze(['irplayer', 'nam', 'vocoder', 'crossover', 'tonematch', 'dynadist'])

/* The unit's key in lib/gen3Catalog, from the slug the rig files it under (lib/device-slug: "Axe-Fx III" is axefxiii). */
const UNIT_OF = Object.freeze({ axefxiii: 'axefx3', fm9: 'fm9' })
export const ownUnit = (deviceSlug) => UNIT_OF[String(deviceSlug || '').toLowerCase()] || null

/**
 * WHETHER A BLOCK NAMED HERE HAS KNOBS THE COMPUTER CAN ANSWER (13 November
 * 2026: "right now I have no knobs showing when I'm connected over raspberry
 * pie"). The computer app's device server opens an Axe-Fx III's own blocks
 * since the release that carries ForgeFX 0488f11 (desktop/forgefx.lock.json):
 * the same hand-written list the phone uses over Bluetooth
 * (lib/axefx3-own-knobs.js), served for a block's read by its effect id. So
 * on a III such a block is marked `turns: true` in place of `knobs: false`:
 * Edit and the hold pop-up open it and ask the computer for its knobs, as
 * they do any block. It is STILL `unknown` to everything that moves or
 * edits the chain. Never an FM9, which the computer has no such list for.
 * An older computer app answers no knobs, and Edit says to update it
 * (OWN_KNOBS_NEED_COMPUTER).
 */
export const turnsThroughComputer = (unit, slug, knobs) => unit === 'axefx3' && OWN_FAMILIES.includes(slug) && (knobs === true || (knobs === 'nam' && slug === 'nam'))

/** What Edit says where such a block's read came back with no knobs: the computer app is older than its list. */
export const OWN_KNOBS_NEED_COMPUTER = 'Update the computer app to turn this block’s knobs.'

/**
 * The chain as it came from the computer, with each block the phone can name
 * named. `open` is whether this account is offered it (lib/ownBlocksHere).
 * `knobs` is how much of an Axe-Fx III's own blocks' knobs the account gets
 * (lib/bluetooth ownKnobsLevel: true for all of them, 'nam' for the NAM block
 * alone, false for none). The same list back, untouched, when there is
 * nothing to name.
 */
export function nameOwnBlocks(blocks, deviceSlug, open, knobs = false) {
  if (open !== true || !Array.isArray(blocks)) return blocks
  const unit = ownUnit(deviceSlug)
  if (!unit) return blocks
  const list = catalogFor(unit)
  let named = false
  const out = blocks.map((b) => {
    /* Only a block the computer sent with no slug (marked by lib/new-block markNewBlocks), and only by its own effect id. */
    if (!b || b.unknown !== true || b.slug || !Number.isInteger(b.effectId)) return b
    const own = list.find((c) => c.page === b.effectId && OWN_FAMILIES.includes(c.slug))
    if (!own) return b
    named = true
    const called = { ...b, slug: own.slug, family: own.family, name: own.name, onPlay: true }
    /* Its knobs are the computer's to answer (`turns`, above), or it has none here (`knobs: false`). */
    return turnsThroughComputer(unit, own.slug, knobs) ? { ...called, turns: true } : { ...called, knobs: false }
  })
  return named ? out : blocks
}

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

/*
 * AND IN THE CHAIN EDITOR, through the computer. "Looks like NAM blocks and
 * some others are missing from the chain editor when adding new blocks not
 * currently in the chain" (Justin, 15 November 2026).
 *
 * The editor's list of blocks to add is the computer's own (GET /blocks),
 * and the computer's engine builds it from a table that stops before these
 * blocks: it has no NAM, IR Player, Vocoder, Crossover, Tone Match or
 * Dynamic Distortion in it. The engine's route that PUTS a block in a cell
 * takes any effect id, though, so nothing has to change on the computer:
 * the phone adds its own names to the list (`ownInPalette`) and the editor
 * places one by its id, as it places any block.
 *
 * NOT PROVEN ON A UNIT. Nobody has seen an editor place one of these with
 * that message; the editor re-reads the chain after every add and says
 * when the unit did not take it. So it is for the accounts the names
 * themselves are for (lib/ownBlocksHere: his alone, until he has placed
 * one), and the second of each kind (NAM 2, IR Player 2 to 4, and so on) is
 * the id after the first, never read off a unit.
 *
 * And once one is in the chain, the editor treats it as a block of its own
 * (`ownInChainEditor`): moved, removed, added after. It was held as a "New
 * block" with nothing to press, which would have left a NAM just added
 * with no way to take it out again. Only in the editor: Edit, the report
 * and everything else still see the block as they did.
 */

/*
 * AN AM4'S NAM PLAYER BLOCK THROUGH THE COMPUTER (firmware 3.00). The
 * computer app that knows the block (ForgeFX src/am4Nam.ts) sends it with
 * no slug, as it sends an Axe-Fx III's own blocks, so an app older than the
 * block holds it as a New block; this names it, by its two codes, for an
 * account it is open to. `knobs` true where the computer answers its knobs
 * and this account has them (`turns`); else its on and off alone.
 *
 * `fixed: true`: THE CHAIN EDITOR NEVER MOVES OR REMOVES IT (ownInChainEditor
 * leaves it held). Nobody has seen an AM4 slot GIVEN this block from here
 * (lib/am4-chain says the same of Bluetooth).
 */
export const AM4_NAM_CODES = Object.freeze([0xd1, 0xd2])
export const AM4_PITCH_CODE = 0x82
const isAm4 = (deviceSlug) => String(deviceSlug || '').toLowerCase() === 'am4'
export function nameAm4Nam(blocks, deviceSlug, open, knobs = false, add = false) {
  if (open !== true || !Array.isArray(blocks) || !isAm4(deviceSlug)) return blocks
  /* Where this account may add the new blocks, the Pitch block is named with it (nameAm4Pitch, below). */
  if (add === true) blocks = nameAm4Pitch(blocks, deviceSlug, open)
  let named = false
  const out = blocks.map((b) => {
    if (!b || b.unknown !== true || b.slug || !AM4_NAM_CODES.includes(b.effectId)) return b
    named = true
    const called = { ...b, slug: 'nam', family: 'NAM', name: b.effectId === AM4_NAM_CODES[0] ? 'NAM' : 'NAM 2', onPlay: true, ...(add === true ? {} : { fixed: true }) }
    return knobs === true ? { ...called, turns: true } : { ...called, knobs: false }
  })
  return named ? out : blocks
}

/**
 * An AM4's list of blocks to add, with the NAM Player in it (19 November
 * 2026: "the AM4 for NAM and pitch blocks are not showing up"). The
 * computer's list is the codec's seventeen; its route that puts a block in
 * a slot takes any code (ForgeFX am4.ts placeCell) and reads the slot back,
 * so nothing changes on the computer. Only where `open` is true (the block
 * named for this account AND lib/features AM4_NAM_ADD_FOR_EVERYONE or his
 * account), and then nameAm4Nam's `add` lets the editor move and remove it.
 * Not the Pitch block: its code has not been read off a unit.
 */
export function am4NamInPalette(list, deviceSlug, open) {
  if (open !== true || !Array.isArray(list) || !list.length || !isAm4(deviceSlug)) return list
  const more = am4PitchInPalette(list, deviceSlug, open)
  if (more.some((b) => b?.page === AM4_NAM_CODES[0])) return more
  return [...more.filter((b) => b?.page !== AM4_PITCH_CODE), { page: AM4_NAM_CODES[0], name: 'NAM', slug: 'nam', family: 'NAM' }, ...more.filter((b) => b?.page === AM4_PITCH_CODE)]
}

/**
 * And the AM4's Pitch block (firmware 3.00), through the computer: in the
 * list of blocks to add, and named where the computer sends it with no
 * slug. By its likely code (lib/fractal-sysex AM4_NEW_BLOCKS says what that
 * rests on). On Play with its on and off and channels, no knobs; `movable`
 * so the chain editor can move and remove it. Whether the computer's on and
 * off reaches a block it has no name for has not been seen.
 */
export function am4PitchInPalette(list, deviceSlug, open) {
  if (open !== true || !Array.isArray(list) || !list.length || !isAm4(deviceSlug)) return list
  if (list.some((b) => b?.page === AM4_PITCH_CODE)) return list
  return [...list, { page: AM4_PITCH_CODE, name: 'Pitch', slug: 'pitch', family: 'pitch' }]
}
export function nameAm4Pitch(blocks, deviceSlug, open) {
  if (open !== true || !Array.isArray(blocks) || !isAm4(deviceSlug)) return blocks
  let named = false
  const out = blocks.map((b) => {
    if (!b || b.unknown !== true || b.slug || b.effectId !== AM4_PITCH_CODE) return b
    named = true
    return { ...b, slug: 'pitch', family: 'pitch', name: 'Pitch', onPlay: true, knobs: false, movable: true }
  })
  return named ? out : blocks
}

/** The computer's list of blocks to add, with this unit's own blocks added where the list lacks them. The same list back when there is nothing to add or the account is not offered them. */
export function ownInPalette(list, deviceSlug, open) {
  if (open !== true || !Array.isArray(list) || !list.length) return list
  const unit = ownUnit(deviceSlug)
  if (!unit) return list
  const have = new Set(list.map((b) => b?.page))
  const more = catalogFor(unit)
    .filter((c) => OWN_FAMILIES.includes(c.slug) && !have.has(c.page))
    .map((c) => ({ page: c.page, name: c.name, slug: c.slug, family: c.family }))
  return more.length ? [...list, ...more] : list
}

/**
 * The name the phone has for one cell of a grid read, for the log only
 * (Quick build's "row 3 as read", shared/starter-chains rowAsRead): a III's
 * or an FM9's own block by its effect id, the name Play and the chain editor
 * give it ("NAM 1", where the computer's grid read says "eid_206"). Null for
 * anything else, and on a unit with no such list.
 */
export function ownCellName(cell, deviceSlug) {
  const unit = ownUnit(deviceSlug)
  if (!unit || !cell || !Number.isInteger(cell.effectId)) return null
  const own = catalogFor(unit).find((c) => c.page === cell.effectId && OWN_FAMILIES.includes(c.slug))
  return own ? own.name : null
}

/** The chain for the chain editor: a block named here is one of the editor's own, no longer held as a New block. The same list back when there is none. */
export function ownInChainEditor(blocks, open) {
  if (open !== true || !Array.isArray(blocks)) return blocks
  let any = false
  const out = blocks.map((b) => {
    if (!b || b.unknown !== true || b.onPlay !== true || b.fixed === true || !(OWN_FAMILIES.includes(b.slug) || b.movable === true) || !Number.isInteger(b.effectId)) return b
    any = true
    return { ...b, unknown: false }
  })
  return any ? out : blocks
}

/*
 * EVERY GRID MESSAGE THERE IS, as one list of digests: what
 * scripts/grid-frames.mjs runs the pinned codec through and writes down
 * (test/gen3-grid-codec.json), and what test/gen3-grid.mjs runs the phone's
 * own builders through and holds to it. One walk, two sets of builders, so
 * "the phone sends what the computer sends" is checked over every cell,
 * every block id worth trying and every cable whose bytes are the codec's
 * (`cableFromCodec`), not over a handful.
 *
 * `make` is the builders, each given wire numbers (rows and columns from
 * one): select(model,row,col), put(model,row,col,id), cable(model,srcRow,
 * srcCol,destRow,join), read(model), dump(model), slot(slot,code).
 */
import { createHash } from 'node:crypto'

export const GRID_UNITS = Object.freeze({ fm3: { model: 0x11, rows: 4, cols: 12 }, fm9: { model: 0x12, rows: 6, cols: 14 }, axefx3: { model: 0x10, rows: 6, cols: 14 } })
/** Block ids put in every cell: empty, an amp, a cab, the last id seven bits hold and the first they do not, a NAM, the first and last shunt, the largest there is. */
export const idsFor = (unit) => [0, 58, 62, 127, 128, 206, 1024, 1024 + unit.rows * unit.cols - 1, 16383]
/** The AM4's codes: empty, and its seventeen blocks. */
export const AM4_CODES = Object.freeze([0, 0x3a, 0x2e, 0x32, 0x36, 0x42, 0x46, 0x4e, 0x52, 0x56, 0x5a, 0x5e, 0x66, 0x6a, 0x72, 0x76, 0x7a, 0x92])

/** Whether a cable is one the walk covers: every one a unit has, but out of a six-row grid's top row from an even column, which the codec refuses. */
export const cableWalked = (unit, srcRow, srcCol) => !(unit.rows === 6 && srcRow === 1 && srcCol % 2 === 0)

/**
 * Whether a cable's bytes are still THE CODEC'S: every FM3 cable, and on a
 * six-row grid those into row 3 or 4, or out of an odd column into row 1, 5
 * or 6, where the codec's fitted law is the plain packing of the two cells.
 * Everywhere else on six rows the law names another cell, the computer app
 * builds the packing itself (ForgeFX gridCable.ts) and so does the phone
 * (gen3-grid.js says how that was found), so those cables are left out of
 * the digest held to the codec and are held to the packing by
 * test/gen3-grid.mjs instead. Written out here, not imported from the phone:
 * a rule checked against itself is no check.
 */
export const cableFromCodec = (unit, srcCol, destRow) => unit.rows !== 6 || destRow === 3 || destRow === 4 || (srcCol % 2 === 1 && (destRow === 1 || destRow === 5 || destRow === 6))

const hexOf = (bytes) => bytes.map((b) => b.toString(16).padStart(2, '0')).join('')

export function gridDigests(make) {
  const out = {}
  for (const [name, unit] of Object.entries(GRID_UNITS)) {
    const select = createHash('sha256')
    const put = createHash('sha256')
    const cable = createHash('sha256')
    let cables = 0
    for (let col = 1; col <= unit.cols; col++) {
      for (let row = 1; row <= unit.rows; row++) {
        select.update(hexOf(make.select(unit.model, row, col)))
        for (const id of idsFor(unit)) put.update(hexOf(make.put(unit.model, row, col, id)))
      }
    }
    for (let srcCol = 1; srcCol < unit.cols; srcCol++) {
      for (let srcRow = 1; srcRow <= unit.rows; srcRow++) {
        if (!cableWalked(unit, srcRow, srcCol)) continue
        for (let destRow = 1; destRow <= unit.rows; destRow++) {
          if (!cableFromCodec(unit, srcCol, destRow)) continue
          for (const join of [true, false]) {
            cable.update(hexOf(make.cable(unit.model, srcRow, srcCol, destRow, join)))
            cables++
          }
        }
      }
    }
    out[name] = { select: select.digest('hex'), put: put.digest('hex'), cable: cable.digest('hex'), cables, read: hexOf(make.read(unit.model)), dump: hexOf(make.dump(unit.model)) }
  }
  const slot = createHash('sha256')
  for (let s = 1; s <= 4; s++) for (const code of AM4_CODES) slot.update(hexOf(make.slot(s, code)))
  out.am4 = { slot: slot.digest('hex') }
  return out
}

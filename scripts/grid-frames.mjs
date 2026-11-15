#!/usr/bin/env node
/**
 * The chain's messages, as the codec the computer app carries builds them.
 *
 * Over Bluetooth the phone builds its own (mobile/src/lib/gen3-grid.js for
 * an FM3, FM9 or Axe-Fx III; mobile/src/lib/am4-chain.js for an AM4): a
 * cell selected, a block put in one, a cable, the two grid reads, a block
 * put in an AM4's slot. They have to be the computer's, byte for byte,
 * because the computer's are the ones units have been taking. This walks
 * every cell, a spread of block ids and every cable there is through the
 * codec's own builders, and writes the digests to test/gen3-grid-codec.json;
 * test/gen3-grid.mjs walks the phone's builders the same way and holds them
 * to that file.
 *
 * FROM THE CODEC THE COMPUTER APP CARRIES, and no other: this refuses a
 * forgefx-midi that is not on the commit desktop/forgefx.lock.json pins,
 * and writes the commit into the file, where the test holds it to the lock.
 * A new pin means running this on it.
 *
 *   node scripts/grid-frames.mjs <forgefx-midi checkout, built>
 *
 * It also checks the one thing the phone refuses on the codec's word: that
 * the codec still refuses a cable out of a six-row grid's top row from an
 * even column. If a later codec builds it, this stops and says so, and the
 * phone's rule (gen3-grid cableKnown) is what to look at.
 *
 * AND WHERE THE CODEC IS NOT FOLLOWED. On a six-row grid the codec's cable
 * bytes are a fitted law that names the wrong cell for some cables (into row
 * 2; out of an even column into row 1, 5 or 6): mobile/src/lib/gen3-grid.js
 * has how that was found. Those cables are not in the digest (the sweep's
 * `cableFromCodec`), and this checks the split both ways on the codec in
 * hand: where the digest covers a cable the codec's bytes ARE the plain
 * packing of its two cells, and where it does not they are NOT. If a later
 * codec builds the packing everywhere, this stops and says so: then the
 * phone and the computer app (ForgeFX gridCable.ts) can go back to the
 * codec's own bytes for every cable.
 */
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { GRID_UNITS, cableFromCodec, cableWalked, gridDigests } from '../test/gen3-grid-sweep.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const target = join(root, 'test', 'gen3-grid-codec.json')
const from = process.argv[2]
if (!from) throw new Error('usage: node scripts/grid-frames.mjs <forgefx-midi checkout, built>')
const checkout = resolve(from)
const pinned = JSON.parse(readFileSync(join(root, 'desktop', 'forgefx.lock.json'), 'utf8'))['forgefx-midi'].commit
const head = execFileSync('git', ['-C', checkout, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
if (head !== pinned) throw new Error(`that forgefx-midi is at ${head}, and the computer app carries ${pinned}`)

const gen3 = await import(pathToFileURL(join(checkout, 'dist', 'gen3', 'axe-fx-iii', 'index.js')).href)
const am4 = await import(pathToFileURL(join(checkout, 'dist', 'am4', 'index.js')).href)
const rowsOf = (model) => Object.values(GRID_UNITS).find((u) => u.model === model).rows

for (const unit of Object.values(GRID_UNITS)) {
  for (let srcCol = 1; srcCol < unit.cols; srcCol++) {
    for (let srcRow = 1; srcRow <= unit.rows; srcRow++) {
      if (cableWalked(unit, srcRow, srcCol)) continue
      let built = null
      try {
        built = gen3.buildSetGridRouting({ srcRow, srcCol, destRow: 1, rows: unit.rows, op: gen3.ROUTING_OP_CONNECT }, unit.model)
      } catch {
        built = null
      }
      if (built) throw new Error(`the codec now builds a cable out of the top row from column ${srcCol} on a six-row grid: the phone still refuses it (gen3-grid cableKnown)`)
    }
  }
}

/* The plain packing of a cable's two cells, written out here too: what the codec's bytes are measured against. */
const packed = (rows, srcRow, srcCol, destRow) => {
  const fromCell = (srcCol - 1) * rows + (srcRow - 1)
  const toCell = srcCol * rows + (destRow - 1)
  return [fromCell >> 1, ((fromCell & 1) << 6) | (toCell >> 2), (toCell & 3) << 5].join(',')
}
let lawIsPacking = 0
let lawIsNot = 0
for (const unit of Object.values(GRID_UNITS)) {
  for (let srcCol = 1; srcCol < unit.cols; srcCol++) {
    for (let srcRow = 1; srcRow <= unit.rows; srcRow++) {
      if (!cableWalked(unit, srcRow, srcCol)) continue
      for (let destRow = 1; destRow <= unit.rows; destRow++) {
        const built = gen3.buildSetGridRouting({ srcRow, srcCol, destRow, rows: unit.rows, op: gen3.ROUTING_OP_CONNECT }, unit.model)
        const same = built.slice(21, 24).join(',') === packed(unit.rows, srcRow, srcCol, destRow)
        const where = `row ${srcRow}, column ${srcCol} into row ${destRow} on a ${unit.rows}-row grid`
        if (cableFromCodec(unit, srcCol, destRow)) {
          if (!same) throw new Error(`the codec's cable bytes for ${where} are not the two cells' numbers, and the digest holds the phone to them: the sweep's cableFromCodec is wrong for this codec`)
          lawIsPacking++
        } else {
          if (same) throw new Error(`the codec now builds the two cells' numbers for ${where}: its six-row law has changed, so see whether gen3-grid.js and ForgeFX's gridCable.ts can go back to the codec's bytes`)
          lawIsNot++
        }
      }
    }
  }
}
console.log(`the codec's cable bytes are the two cells' numbers for ${lawIsPacking} cables (every FM3 cable, and 270 on each six-row unit), and are not for ${lawIsNot} (162 on each six-row unit)`)

const sums = gridDigests({
  select: (model, row, col) => gen3.buildClearBlock({ row, col, rows: rowsOf(model) }, model),
  put: (model, row, col, blockId) => gen3.buildSetGridCell({ row, col, blockId, rows: rowsOf(model) }, model),
  cable: (model, srcRow, srcCol, destRow, join) => gen3.buildSetGridRouting({ srcRow, srcCol, destRow, rows: rowsOf(model), op: join ? gen3.ROUTING_OP_CONNECT : gen3.ROUTING_OP_DISCONNECT }, model),
  read: (model) => gen3.buildRequestGridLayout(model),
  dump: (model) => gen3.buildRequestPresetDump(0x3fff, model),
  slot: (slot, code) => am4.buildSetBlockType(slot, code)
})
writeFileSync(target, `${JSON.stringify({ from: head, sums }, null, 2)}\n`)
console.log(`wrote ${target} from forgefx-midi ${head}`)

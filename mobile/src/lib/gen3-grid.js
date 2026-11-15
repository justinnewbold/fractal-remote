/*
 * A GEN-3 UNIT'S GRID, OVER BLUETOOTH OR ITS OWN USB CABLE: where every block
 * and cable sits, a block put in a cell, a cell cleared, a cable joined.
 *
 * "The four screens are good. I need everything with the chain builder to
 * work over Bluetooth also" (Justin, 15 November 2026). Until then the chain
 * could only be changed through the computer: the phone had no message that
 * places a block, and its Bluetooth read of the chain (the status read)
 * carries no positions. This file is those messages and nothing that talks
 * to a unit: bleWire sends them, one at a time, through its one way out.
 *
 * WHAT IS SENT IS THE COMPUTER'S OWN, BYTE FOR BYTE. Each frame here is the
 * one the computer app sends for the same thing: forgefx-midi's at the
 * commit desktop/forgefx.lock.json pins (buildClearBlock, buildSetGridCell,
 * buildSetGridRouting, buildRequestGridLayout, buildRequestPresetDump),
 * EXCEPT WHERE A SIX-ROW CABLE GOES (below), which the computer app now
 * builds itself (ForgeFX server/src/gridCable.ts) and this file builds the
 * same way. test/gen3-grid.mjs holds every one of them, over every cell and
 * every cable there is. Over a Bluetooth adapter nobody had sent one before
 * this file.
 *
 *   select a cell   01 30 00 | 00 00 00 00 | cell, five septets | 00 00 00 00
 *   put a block     01 32 00 | block id, 14 bits | 00 00 | cell, 14 bits | 00 × 7
 *   a cable         01 35 00 | 00 00 00 00 | 01 join, 02 part | 00 × 6 | 02 00 | three bytes of where
 *   read the grid   01 2E 00 | 00 × 13
 *   the whole preset as it is being edited   03 7F 7F 00
 *
 * A cell is numbered down the columns: (column − 1) × rows + (row − 1), rows
 * and columns counted from one on the wire as Fractal's editors show them.
 * The computer sends "select" before "put" (an FM3 puts the block in the
 * wrong cell without it), so the phone does too. A block id of 0 empties the
 * cell.
 *
 * WHERE A CABLE GOES IS THE TWO CELLS' OWN NUMBERS, eight bits each, packed
 * seven to a byte: the cell it leaves, and the cell it feeds one column on.
 *
 *   from = (srcCol − 1) × rows + (srcRow − 1)     to = srcCol × rows + (destRow − 1)
 *   b21 = from >> 1     b22 = ((from & 1) << 6) | (to >> 2)     b23 = (to & 3) << 5
 *
 * On an FM3 that is the codec's own rule, borne out by FM3-Edit's messages.
 * FOR SIX ROWS THE CODEC HAS A FITTED "LAW" INSTEAD, AND IT NAMES THE WRONG
 * CELL FOR SOME CABLES. It is this packing wherever a cable goes into row 3
 * or 4, and out of an odd column into row 1, 5 or 6 (270 of the 432 cables
 * it builds on a unit). For the other 162, read as the packing, its bytes
 * name:
 *
 *   into row 2, from any column              row 6 of the source's OWN column
 *   out of an even column into row 1         row 3 of the source's OWN column
 *   out of an even column into row 5 or 6    row 1 or 2 of the next column
 *
 * Its notes hold no recorded message for any of those, and two of its row-2
 * examples are the FM3's bytes for the same cells.
 *
 * WHAT A UNIT DID WITH THE LAW'S BYTES (15 November 2026, Justin's Axe-Fx
 * III through the computer app on his Raspberry Pi): Quick build put an
 * Input, two blocks and an Output on row 2 of an empty preset and sent
 * three cables along it. Every message was taken, all four blocks were
 * there on the read back, and the row was not joined at its first cable
 * (whether the other two took, that read back did not say).
 *
 * So a six-row cable is the packing here and in the computer app (from the
 * release that carries ForgeFX's gridCable.ts): the same bytes as before
 * wherever the law was the packing, the cells that were asked for
 * everywhere else. NOT SEEN ON A UNIT YET in the cables that changed, and an
 * OLDER COMPUTER APP STILL SENDS THE LAW'S, which is why Quick build puts a
 * chain on a six-row unit's THIRD row (shared/starter-chains `homeRow`):
 * a cable along row 3 is the same bytes either way, so that row does not
 * depend on which computer app is sending. (Whether a unit joins it is the
 * next thing his log will say: no cable of these has been seen to take.)
 *
 * ONE CABLE IS STILL REFUSED: out of a six-row grid's TOP row from an even
 * column (`cableKnown`). The codec refuses it as "not decoded", the computer
 * app still goes by that, and so does this file. It is very likely just the
 * packing too: out of an even column the law is wrong into four of the six
 * rows, so recordings of those cables could not have been made to fit it.
 * It opens when a row-2 build has been seen to join.
 *
 * TWO WAYS TO READ THE GRID, AND WHY BOTH.
 *
 * The preset dump (fn 0x03 of 7F 7F, "the edit buffer") is the read the
 * computer app uses and the only one proven on all three units: the grid is
 * a table at 0x104 of the unpacked body, two 16-bit words a cell, the block
 * id and a word with one bit for each row of the column before that feeds
 * it. But it is the WHOLE preset: 24,680 bytes from an FM3 or FM9, 49,336
 * from an Axe-Fx III, which down a Bluetooth adapter on the MIDI jacks
 * (3,125 bytes a second) is eight seconds and sixteen.
 *
 * The live read (fn 0x01, 2E 00) is one answer of about 755 bytes, a
 * quarter of a second. The codec decodes it two ways, an FM3's "byte-exact
 * from two FM3 device responses" and an FM9's from FM9 captures, with an
 * Axe-Fx III's assumed to be the FM9's and never captured. Read side by
 * side, the two are ONE layout: both start at bit 2,568 of the answer
 * (after F0, seven bits a byte, most significant first), one 32-bit record a
 * cell, down the columns: twelve bits of block id (or a shunt's number),
 * four unused, eight of kind (0x40 is a shunt), eight of cables. The FM9
 * decode reads seven of the twelve id bits, so it cannot name a block
 * numbered over 127 (a Mixer, a NAM), and where the six rows' cable bits sit
 * is not something anybody has checked.
 *
 * SO THE LIVE READ IS NOT BELIEVED YET, ANYWHERE. As the app makes the wire
 * (bleWire `liveGrid`, which nothing hands it), every grid the app acts on
 * is the dump's. The live read is taken beside it and laid against it in
 * the log (`gridProof`), so a unit's own log settles the layout, and is
 * not asked again once it has (or after two silences).
 *
 * `gridProof` and `gridFromLive` are the rule it WOULD be believed by, kept
 * and tested for the day it is switched on: where the dump has borne it out
 * on that connection, on where the blocks are and which they are AND on
 * which bit is which row's cable, with a shunt's number settled the same
 * way and one disagreement ending it. BEFORE THAT DAY the rule needs more
 * than it has, as an independent read found (15 November 2026): a chain
 * along ONE row fits exactly one "which bit is the top row" whatever the
 * unit's real order, so the cable rule wants cables out of two rows; ONE
 * shunt agrees with itself, so a shunt's number wants two shunts in
 * different columns; block ids over 127 want a proof that had one in it (an
 * FM9's decode reads seven bits of twelve); the codec's FM9 reading puts
 * the cable byte three bits lower than its FM3 one, which this search
 * cannot reach; and once proven, nothing here checks it again, so the
 * preset should still be read after a write. A wrong shunt id from a live
 * read would be SENT, by an Undo putting a bare wire back.
 *
 * Nothing here is Fractal's code or anybody else's: the container (three
 * bytes to a 16-bit word, a CRC, a Huffman-coded body) is unpacked by the
 * AM4's own reader in lib/fractal-sysex.mjs, written from the published
 * format (see NOTICES.md).
 */
import { FN, MODELS, checksumOk, crcCcitt, encode14, frame, isFractal, septets32, unpackBody } from './fractal-sysex.mjs'

/** The three units with a grid, by model byte. */
const GRID_MODELS = Object.freeze([MODELS.fm3, MODELS.fm9, MODELS.axefx3])

/** How many rows and columns a unit's grid has, or null for a unit with none. */
export function gridSize(model) {
  if (model === MODELS.fm3) return { rows: 4, cols: 12 }
  if (model === MODELS.fm9 || model === MODELS.axefx3) return { rows: 6, cols: 14 }
  return null
}

export const GRID_SUB = Object.freeze({ READ: 0x2e, SELECT: 0x30, PUT: 0x32, CLEAR_TOO: 0x33, CABLE: 0x35 })
export const CABLE_JOIN = 0x01
export const CABLE_PART = 0x02
/** The largest block id a cell is sent: fourteen bits. */
export const BLOCK_ID_MAX = 0x3fff
/** The first block id that is a shunt (the high septet 0x08), and the dump's own test for one. */
export const SHUNT_FROM = 1024

const whole = (n) => Number.isInteger(n)

/** Whether (row, col), counted from one, is a cell of this unit's grid. */
export function cellOnGrid(model, row, col) {
  const size = gridSize(model)
  return !!size && whole(row) && whole(col) && row >= 1 && row <= size.rows && col >= 1 && col <= size.cols
}

/** A cell's number on the wire, or null when it is not on this unit's grid. */
export function cellNumber(model, row, col) {
  if (!cellOnGrid(model, row, col)) return null
  return (col - 1) * gridSize(model).rows + (row - 1)
}

/** "Select this cell": what the computer sends before a block is put in it. Null for a cell that is not there. */
export function buildGridSelect(model, row, col) {
  const cell = cellNumber(model, row, col)
  if (cell === null) return null
  return frame(model, FN.PARAM, [GRID_SUB.SELECT, 0x00, 0, 0, 0, 0, ...septets32(cell), 0, 0, 0, 0])
}

/** "Put this block in this cell"; a block id of 0 empties it. Null for a cell or an id that cannot be. */
export function buildGridPut(model, row, col, blockId) {
  const cell = cellNumber(model, row, col)
  if (cell === null || !whole(blockId) || blockId < 0 || blockId > BLOCK_ID_MAX) return null
  return frame(model, FN.PARAM, [GRID_SUB.PUT, 0x00, ...encode14(blockId), 0, 0, ...encode14(cell), 0, 0, 0, 0, 0, 0, 0])
}

/**
 * Whether a cable out of (srcRow, srcCol) into destRow of the next column is
 * one this unit has and the app builds. On a six-row grid, out of the top
 * row from an even column is the one the codec and the computer app refuse,
 * so this refuses it too (see the head of this file).
 */
export function cableKnown(model, srcRow, srcCol, destRow) {
  const size = gridSize(model)
  if (!size || !whole(srcRow) || !whole(srcCol) || !whole(destRow)) return false
  if (srcRow < 1 || srcRow > size.rows || destRow < 1 || destRow > size.rows) return false
  /* A cable goes into the NEXT column, so the last column has none to start. */
  if (srcCol < 1 || srcCol > size.cols - 1) return false
  if (size.rows === 6 && srcRow === 1 && srcCol % 2 === 0) return false
  return true
}

/** Where a cable goes, as its three bytes: the cell it leaves and the cell it feeds (see the head of this file). Wire numbers, from one. */
export function cableWhere(rows, srcRow, srcCol, destRow) {
  const from = (srcCol - 1) * rows + (srcRow - 1)
  const to = srcCol * rows + (destRow - 1)
  return [from >> 1, ((from & 1) << 6) | (to >> 2), (to & 3) << 5]
}

/** The two cell numbers three such bytes name: what a test, or the log, reads back out of a frame. */
export const cableCells = (b21, b22, b23) => ({ from: (b21 << 1) | (b22 >> 6), to: ((b22 & 0x3f) << 2) | (b23 >> 5) })

/**
 * Whether the pinned codec's six-row law builds the SAME three bytes for this
 * cable: into row 3 or 4, or out of an odd column into row 1, 5 or 6. An
 * older computer app sends the law's bytes, so through one of those these
 * are the only six-row cables whose bytes name the two cells that were asked
 * for. Always true on four rows. Nothing in the app asks this yet: it is the
 * rule written down where the tests can hold it, for the day a screen has to
 * say "update the computer app" over a row an older one cannot join.
 */
export function cableAsTheLaw(rows, srcCol, destRow) {
  if (rows !== 6) return true
  return destRow === 3 || destRow === 4 || (srcCol % 2 === 1 && (destRow === 1 || destRow === 5 || destRow === 6))
}

/** A cable joined (`join` true) or parted. Null for one that cannot be built (`cableKnown`). */
export function buildGridCable(model, srcRow, srcCol, destRow, join = true) {
  if (!cableKnown(model, srcRow, srcCol, destRow)) return null
  const { rows } = gridSize(model)
  return frame(model, FN.PARAM, [GRID_SUB.CABLE, 0x00, 0, 0, 0, 0, join ? CABLE_JOIN : CABLE_PART, 0, 0, 0, 0, 0, 0, 0x02, 0x00, ...cableWhere(rows, srcRow, srcCol, destRow)])
}

/** "Where is everything on the grid?": the live read. */
export const buildGridRead = (model) => (gridSize(model) ? frame(model, FN.PARAM, [GRID_SUB.READ, 0x00, ...new Array(13).fill(0)]) : null)

/** "Send the preset as it is being edited": the edit buffer, whole. */
export const DUMP = Object.freeze({ ASK: 0x03, HEAD: 0x77, CHUNK: 0x78, FOOT: 0x79, HEAD_BYTES: 13, CHUNK_BYTES: 3082, FOOT_BYTES: 11, CHUNK_RAW: 2048, MOST_CHUNKS: 32 })
export const buildGridDump = (model) => (gridSize(model) ? frame(model, DUMP.ASK, [0x7f, 0x7f, 0x00]) : null)

/**
 * WHETHER A FRAME IS ONE OF THE GRID'S, by its shape: function 0x01 with one
 * of the grid's five sub-functions, on one of the three units. bleWire's way
 * out refuses every frame of this shape that is not, byte for byte, one the
 * wire is sending for the grid at that moment. Nothing the phone sent before
 * this file had the shape, so nothing that went before is held by it.
 */
export function gridShaped(bytes, model) {
  return Array.isArray(bytes) && bytes.length >= 9 && bytes[0] === 0xf0 && bytes[4] === model && GRID_MODELS.includes(model) && bytes[5] === FN.PARAM && bytes[7] === 0x00 && Object.values(GRID_SUB).includes(bytes[6])
}

/**
 * THE FRAMES IN HAND: the ones of the one grid job being done, for exactly
 * as long as it is being done. `during(frames, run)` holds them while `run`
 * is at work and lets go of them when it ends, however it ends; `now()` is
 * what the way out asks at each send. Kept here, apart from the wire, so
 * that "let go of when it ends" can be run by a test: a job that stopped
 * part-way must not leave its frames allowed out for whatever comes next.
 */
export function gridHand() {
  let frames = null
  return {
    now: () => frames,
    during: async (held, run) => {
      frames = held
      try {
        return await run()
      } finally {
        frames = null
      }
    }
  }
}

/** Whether `bytes` is one of the frames in hand (`now`: the frames of the one grid job being done), byte for byte. */
export function gridAllowed(bytes, now) {
  if (!Array.isArray(bytes) || !Array.isArray(now)) return false
  return now.some((f) => Array.isArray(f) && f.length === bytes.length && f.every((b, i) => b === bytes[i]))
}

/* ------------------------------------------------------------------ */
/* The live read                                                       */
/* ------------------------------------------------------------------ */

/** Where the first cell's record starts, in bits after F0, seven to a byte: the same on all three units. */
export const LIVE_FIRST_BIT = 2568
const KIND_BLOCK = 0x00
const KIND_SHUNT = 0x40

/** How long an answer to the live read must be to hold this unit's whole grid, F0 and F7 included. */
export function liveBytesNeeded(model) {
  const size = gridSize(model)
  if (!size) return null
  /* F0, the bytes that hold every cell's bits, the checksum and F7. */
  return 1 + Math.ceil((LIVE_FIRST_BIT + size.rows * size.cols * 32) / 7) + 2
}

/**
 * The live read's answer, as it came: every cell that holds something, in
 * the unit's own terms, or null for a frame that is not that answer or that
 * holds anything this file does not know the meaning of. `mask` is the
 * record's cable byte untouched; which bit is which row is `gridProof`'s to
 * say. Rows and columns from zero, as every read in the app has them.
 */
export function parseGridLive(f, model) {
  const size = gridSize(model)
  if (!size || !isFractal(f) || f[4] !== model || f[5] !== FN.PARAM || f[6] !== GRID_SUB.READ || !checksumOk(f)) return null
  if (f.length < liveBytesNeeded(model)) return null
  /* Bit `at` of the stream that starts after F0. */
  const bit = (at) => (f[1 + Math.floor(at / 7)] >> (6 - (at % 7))) & 1
  const bits = (at, n) => {
    let v = 0
    for (let i = 0; i < n; i++) v = (v << 1) | bit(at + i)
    return v
  }
  const cells = []
  for (let col = 0; col < size.cols; col++) {
    for (let row = 0; row < size.rows; row++) {
      const at = LIVE_FIRST_BIT + (col * size.rows + row) * 32
      const id = bits(at, 12)
      const spare = bits(at + 12, 4)
      const kind = bits(at + 16, 8)
      const mask = bits(at + 24, 8)
      if (id === 0 && kind === KIND_BLOCK && mask === 0 && spare === 0) continue
      /* A kind nobody has seen, bits where none belong, or cables into nothing: not an answer this file can read. */
      if (spare !== 0 || (kind !== KIND_BLOCK && kind !== KIND_SHUNT) || (id === 0 && kind === KIND_BLOCK)) return null
      cells.push(kind === KIND_SHUNT ? { row, col, shunt: id, mask } : { row, col, effectId: id, mask })
    }
  }
  /* The same block twice is not a grid. */
  const ids = cells.filter((c) => c.effectId !== undefined).map((c) => c.effectId)
  if (new Set(ids).size !== ids.length) return null
  return { rows: size.rows, cols: size.cols, cells }
}

/* ------------------------------------------------------------------ */
/* The dump                                                            */
/* ------------------------------------------------------------------ */

/** Which part of a dump this frame is, for this unit: 'head', 'chunk', 'foot', or null for none of it. */
export function gridDumpPart(f, model) {
  if (!isFractal(f) || f[4] !== model || !checksumOk(f)) return null
  if (f[5] === DUMP.HEAD && f.length === DUMP.HEAD_BYTES) return 'head'
  if (f[5] === DUMP.CHUNK && f.length === DUMP.CHUNK_BYTES) return 'chunk'
  if (f[5] === DUMP.FOOT && f.length === DUMP.FOOT_BYTES) return 'foot'
  return null
}

/**
 * The grid out of the frames a unit answered buildGridDump with: every cell
 * that holds something, `{ row, col, effectId, isShunt, fromRows }`, rows and
 * columns from zero, a shunt by the block id the unit files it under, and
 * `fromRows` the rows of the column before that feed it. Null when the
 * frames are not all there or do not add up: a chunk lost or damaged fails
 * its own length or checksum, and one that slips past fails the CRC over the
 * whole, so a grid is never read out of a shifted preset.
 */
export function parseGridDump(frames, model) {
  const size = gridSize(model)
  if (!size || !Array.isArray(frames)) return null
  const parts = frames.map((f) => gridDumpPart(f, model))
  const chunks = frames.slice(1, -1)
  /* The head, then nothing but chunks, then the foot: a frame of anything else among them, a second head, or no chunk at all is not a preset. */
  if (frames.length < 3 || frames.length - 2 > DUMP.MOST_CHUNKS || parts[0] !== 'head' || parts[parts.length - 1] !== 'foot' || !parts.slice(1, -1).every((p) => p === 'chunk')) return null
  const raw = []
  for (const c of chunks) {
    /* After the six-byte envelope and the two-byte tag, up to the checksum. */
    for (let i = 8; i + 2 < c.length - 2; i += 3) {
      const w = (c[i] | (c[i + 1] << 7) | (c[i + 2] << 14)) & 0xffff
      raw.push(w & 0xff, w >> 8)
    }
  }
  if (raw.length !== chunks.length * DUMP.CHUNK_RAW) return null
  const u16 = (o) => raw[o] | (raw[o + 1] << 8)
  const zeroed = raw.slice()
  zeroed[4] = 0
  zeroed[5] = 0
  if (crcCcitt(zeroed) !== u16(4)) return null
  const bodySize = u16(0x48)
  const packedSize = u16(0x4a)
  const want = 0x104 + size.rows * size.cols * 4
  if (bodySize < want || packedSize === 0 || 0x4c + packedSize > raw.length) return null
  let body
  try {
    body = unpackBody(raw.slice(0x4c, 0x4c + packedSize), want)
  } catch {
    return null
  }
  const cells = []
  for (let col = 0; col < size.cols; col++) {
    for (let row = 0; row < size.rows; row++) {
      const at = 0x104 + (col * size.rows + row) * 4
      const effectId = body[at] | (body[at + 1] << 8)
      const flag = body[at + 2] | (body[at + 3] << 8)
      if (effectId === 0) continue
      const fromRows = []
      for (let r = 0; r < size.rows; r++) if (flag & (1 << r)) fromRows.push(r)
      cells.push({ row, col, effectId, isShunt: effectId > 1000, fromRows })
    }
  }
  return { rows: size.rows, cols: size.cols, cells }
}

/* ------------------------------------------------------------------ */
/* What the dump has borne out of the live read                        */
/* ------------------------------------------------------------------ */

/** Nothing borne out yet: what a connection starts with. */
export const noProof = () => ({ cells: null, shuntBase: null, rowBit: null })

const at = (cells, row, col) => cells.find((c) => c.row === row && c.col === col) || null

/**
 * One live answer set beside the dump taken straight after it, and what
 * that proves. Answers the proof to keep from now on:
 *
 *   cells      true once a live answer with at least two blocks in it had
 *              every block where the dump has it and nothing the dump does
 *              not; false, for good, the first time one did not
 *   shuntBase  what to add to a live shunt's number for the block id the
 *              unit files it under, once every shunt in an answer agreed on
 *              one number; null until an answer has a shunt, false if they
 *              did not agree
 *   rowBit     which bit of the cable byte is the top row's (the next row's
 *              is the bit above it), once every cell's cables in an answer
 *              came out as the dump's under one such rule; null until an
 *              answer has a cable, false if no rule fits. THE LIVE READ IS
 *              NOT USED UNTIL THIS IS A NUMBER (gridFromLive).
 *
 * `said` is a line for the log.
 */
export function gridProof(before, live, dump) {
  const proof = { ...noProof(), ...(before || {}) }
  if (proof.cells === false) return { proof, said: 'the live grid read is not used on this connection: it disagreed with the preset once' }
  if (!live || !dump) return { proof, said: live ? 'the preset could not be read to check the live grid read against' : 'the live grid read was not one this app can read' }
  const lost = dump.cells.find((d) => {
    const l = at(live.cells, d.row, d.col)
    return !l || (d.isShunt ? l.shunt === undefined : l.effectId !== d.effectId)
  })
  const extra = live.cells.find((l) => !at(dump.cells, l.row, l.col))
  if (lost || extra) {
    const where = lost || extra
    return { proof: { ...proof, cells: false }, said: `the live grid read DISAGREES with the preset at row ${where.row + 1}, column ${where.col + 1}: it is not used again on this connection` }
  }
  const blocks = dump.cells.filter((d) => !d.isShunt).length
  const next = { ...proof }
  const told = []
  if (blocks >= 2) {
    if (next.cells !== true) told.push(`${blocks} blocks, each where the preset has it`)
    next.cells = true
  }
  const shunts = dump.cells.filter((d) => d.isShunt)
  if (shunts.length && next.shuntBase === null) {
    const bases = new Set(shunts.map((d) => d.effectId - at(live.cells, d.row, d.col).shunt))
    if (bases.size === 1) {
      next.shuntBase = [...bases][0]
      told.push(`a shunt’s number plus ${next.shuntBase} is its block id`)
    } else {
      next.shuntBase = false
      told.push('its shunts’ numbers follow no one rule, so an answer with a shunt in it is read from the preset')
    }
  }
  const cabled = dump.cells.some((d) => d.fromRows.length) || live.cells.some((l) => l.mask)
  if (cabled && next.rowBit === null) {
    const fits = []
    for (let first = 0; first + dump.rows <= 8; first++) {
      const same = dump.cells.every((d) => sameRows(rowsOfMask(at(live.cells, d.row, d.col).mask, first, dump.rows), d.fromRows))
      if (same) fits.push(first)
    }
    if (fits.length === 1) {
      next.rowBit = fits[0]
      told.push(`cable bit ${next.rowBit} is the top row`)
    } else {
      next.rowBit = false
      told.push('ITS CABLES DO NOT COME OUT AS THE PRESET’S, so the grid is read from the preset on this connection')
    }
  }
  return { proof: next, said: told.length ? `the live grid read agrees with the preset: ${told.join('; ')}` : 'the live grid read agrees with the preset, which had too little in it to prove more' }
}

const sameRows = (a, b) => Array.isArray(a) && a.length === b.length && a.every((r, i) => r === b[i])

/** The rows a cable byte names when bit `first` is the top row's, or null when it has a bit set outside them. */
function rowsOfMask(mask, first, rows) {
  const out = []
  for (let b = 0; b < 8; b++) {
    if (!(mask & (1 << b))) continue
    if (b < first || b >= first + rows) return null
    out.push(b - first)
  }
  return out
}

/**
 * A live answer as the grid the app works with (the dump's own shape), or
 * null when it holds anything the proof in hand does not cover: then the
 * dump is what is read.
 */
export function gridFromLive(live, proof) {
  /*
   * WHERE THE CABLES ARE HAS TO HAVE BEEN BORNE OUT TOO, even for an answer
   * that shows none: until a preset with a cable in it has been read both
   * ways, a cable byte of nought may be a grid with no cables or a byte this
   * file is looking for in the wrong place, and "no cables" would be handed
   * on as a fact (an Undo parts exactly the cables the plan joined, so a
   * cable wrongly thought new would be taken out of a preset that had it).
   */
  if (!live || !proof || proof.cells !== true || !Number.isInteger(proof.rowBit)) return null
  const cells = []
  for (const c of live.cells) {
    let fromRows = []
    if (c.mask) {
      fromRows = rowsOfMask(c.mask, proof.rowBit, live.rows)
      if (!fromRows) return null
    }
    if (c.shunt !== undefined) {
      if (!Number.isInteger(proof.shuntBase)) return null
      cells.push({ row: c.row, col: c.col, effectId: c.shunt + proof.shuntBase, isShunt: true, fromRows })
    } else cells.push({ row: c.row, col: c.col, effectId: c.effectId, isShunt: false, fromRows })
  }
  return { rows: live.rows, cols: live.cols, cells }
}

/* Generated from shared/split-chain.mjs by scripts/sync-relay-rules.mjs.
 * Do not edit. Change the source and run `npm run sync:rules`; the test suite
 * fails on any difference between the two. */

/**
 * Split chains: more than one row, joined by cables.
 *
 * "Right now, we can only edit blocks in a single row, even though the Forge
 * effects I believe has capabilities just like the FM3 edit software does where
 * you can do split chains." It does. The unit reports, for every occupied cell,
 * which rows of the column before it feed it (`fromRows` on GET /preset/grid,
 * decoded from the preset's own routing flags), and POST /preset/grid/cable
 * joins a cell to a row of the next column or cuts that join. What was missing
 * was a picture of it and a way to change it that works under a thumb.
 *
 * This file is the arithmetic, for both apps: what the grid looks like as rows
 * and joins, where its parallel paths are, and the list of writes that adds one
 * or takes one away. It writes nothing itself. Every plan is a list of steps —
 * place a block, clear a cell, connect or cut a cable — that each app runs in
 * order with its own wire, then reads the chain back. Pure, so the part that
 * decides what goes to the unit runs in a test with no unit and no screen.
 *
 * COORDINATES are the display ones /preset/blocks and /preset/grid report:
 * rows and columns from zero. The wire's own numbering is added by
 * grid-plan's toWireCable, once, in each app's setCable.
 *
 * A CABLE joins a cell to a row in the NEXT column: cable(row, col → toRow)
 * means cell (toRow, col + 1) is fed from row `row`. An empty cell that a
 * cable reaches is carried through as a shunt — which is how wireRow has
 * always run a wire down a row, and how a hand-built preset looks.
 */

/** A cell is a block, a shunt (a bare wire through the cell), or nothing. */
export const CELL = { block: 'block', shunt: 'shunt' }

/**
 * The grid as a map of cells, from what the unit reports.
 *
 * `cells` is GET /preset/grid's list (blocks AND shunts); `blocks` is the
 * chain read, which carries each block's slug and name. A block the grid read
 * missed is still placed from the chain read, so nothing in the preset is
 * dropped from the picture.
 */
export function gridMap(cells, blocks, shape = {}) {
  const at = new Map()
  const bySlot = new Map((blocks || []).filter((b) => Number.isInteger(b?.effectId)).map((b) => [b.effectId, b]))
  const put = (row, col, cell) => {
    if (!Number.isInteger(row) || !Number.isInteger(col) || row < 0 || col < 0) return
    at.set(`${row}:${col}`, { row, col, ...cell })
  }
  for (const c of cells || []) {
    const shunt = !!c?.isShunt || (Number(c?.effectId) > 1000 && !bySlot.has(c?.effectId))
    const block = shunt ? null : bySlot.get(c?.effectId)
    put(c?.row, c?.col, {
      kind: shunt ? CELL.shunt : CELL.block,
      effectId: c?.effectId ?? null,
      slug: block?.slug ?? null,
      name: block?.name || c?.name || '',
      block: block || null,
      fromRows: Array.isArray(c?.fromRows) ? c.fromRows.filter(Number.isInteger) : null
    })
  }
  for (const b of blocks || []) {
    if (!Number.isInteger(b?.row) || !Number.isInteger(b?.col) || at.has(`${b.row}:${b.col}`)) continue
    put(b.row, b.col, {
      kind: CELL.block,
      effectId: b.effectId ?? null,
      slug: b.slug ?? null,
      name: b.name || '',
      block: b,
      fromRows: Array.isArray(b.fromRows) ? b.fromRows.filter(Number.isInteger) : null
    })
  }
  const list = [...at.values()]
  const rows = Math.max(shape.rows ?? 4, ...list.map((c) => c.row + 1), 1)
  const cols = Math.max(shape.cols ?? 12, ...list.map((c) => c.col + 1), 1)
  return { rows, cols, cells: list, at: (row, col) => at.get(`${row}:${col}`) || null }
}

/**
 * Every join, as an edge from a cell to the cell it feeds.
 *
 * A cell with no `fromRows` reported (an older computer, a driver that does
 * not decode routing) is assumed fed from its own row — the plain chain — and
 * the map says so with `known: false`, so a picture drawn from a guess can
 * say it is one.
 */
export function joins(map) {
  const out = []
  let known = true
  for (const c of map.cells) {
    if (c.col === 0) continue
    let from = c.fromRows
    if (!from) {
      known = false
      from = [c.row]
    }
    for (const r of from) {
      if (map.at(r, c.col - 1)) out.push({ fromRow: r, toRow: c.row, col: c.col })
    }
  }
  return { edges: out, known }
}

/** The row the guitar comes in on: the Input block's, else the busiest. */
export function mainRow(map) {
  const input = map.cells.find((c) => c.slug === 'input')
  if (input) return input.row
  const counts = new Map()
  for (const c of map.cells) if (c.kind === CELL.block) counts.set(c.row, (counts.get(c.row) || 0) + 1)
  let best = 0
  let most = -1
  for (const [row, n] of counts) if (n > most) [best, most] = [row, n]
  return best
}

/** The rows with anything on them, main row first, then in order. */
export function usedRows(map) {
  const main = mainRow(map)
  const rows = [...new Set(map.cells.map((c) => c.row))].sort((a, b) => a - b)
  if (!rows.includes(main)) rows.unshift(main)
  return [main, ...rows.filter((r) => r !== main)]
}

/** The cells of one row, in column order. */
export const rowCells = (map, row) => map.cells.filter((c) => c.row === row).sort((a, b) => a.col - b.col)

/**
 * The parallel paths: every row other than the main one that holds anything,
 * with where it leaves the chain and where it comes back.
 *
 * `start` and `end` are the first and last occupied columns of the row;
 * `from` the rows of the column before `start` that feed it, `to` the rows of
 * the column after `end` it feeds. A path that is fed by nothing or feeds
 * nothing is still listed — `open: true` — because it is on the unit and the
 * picture must not lose it, but it is not a working branch.
 */
export function branches(map) {
  const main = mainRow(map)
  const { edges } = joins(map)
  const out = []
  for (const row of usedRows(map)) {
    if (row === main) continue
    const cells = rowCells(map, row)
    if (!cells.length) continue
    const start = cells[0].col
    const end = cells[cells.length - 1].col
    const from = edges.filter((e) => e.toRow === row && e.col === start && e.fromRow !== row).map((e) => e.fromRow)
    const to = edges.filter((e) => e.fromRow === row && e.col === end + 1 && e.toRow !== row).map((e) => e.toRow)
    out.push({
      row,
      start,
      end,
      from,
      to,
      blocks: cells.filter((c) => c.kind === CELL.block),
      open: !from.length || !to.length
    })
  }
  return out
}

/** Which parallel path a cell is on, or null for the main row. */
export function branchAt(map, row) {
  return branches(map).find((b) => b.row === row) || null
}

/** A free row for a path across columns first..last, or null when every row is taken there. */
export function freeRowFor(map, first, last) {
  const main = mainRow(map)
  for (let row = 0; row < map.rows; row++) {
    if (row === main) continue
    let free = true
    for (let col = first; col <= last && free; col++) if (map.at(row, col)) free = false
    if (free) return row
  }
  return null
}

/* ---------------------------------------------------------------- */
/* Plans                                                             */
/* ---------------------------------------------------------------- */

const cable = (srcRow, srcCol, destRow, connect = true) => ({ kind: 'cable', srcRow, srcCol, destRow, connect })
const place = (row, col, blockId, name) => ({ kind: 'place', row, col, blockId, name })
const clear = (row, col, name) => ({ kind: 'clear', row, col, name })

/**
 * A parallel path beside the main row, around the cells from `first` to `last`.
 *
 * The signal leaves the main row after column first-1, runs along a free row
 * through columns first..last, and joins the main row again at column last+1.
 * `put` is what goes on the new path, by column ({ col, blockId, name }); with
 * nothing to put, the path is a bare wire — a dry signal alongside whatever is
 * on the main row there.
 *
 * Blocks are placed BEFORE the cables, so a cable reaches a block rather than
 * an empty cell it would carry through as a shunt.
 */
export function planParallel(map, { first, last, put = [] }) {
  const main = mainRow(map)
  if (!Number.isInteger(first) || !Number.isInteger(last) || first > last) return { ok: false, why: 'Pick where the path starts and ends.' }
  if (first < 1) return { ok: false, why: 'A path cannot start before the first column — nothing comes before it to split from.' }
  if (last + 1 >= map.cols) return { ok: false, why: 'A path has to join back before the end of the grid.' }
  if (!map.at(main, first - 1)) return { ok: false, why: `Nothing on the main row in column ${first} to split from.` }
  if (!map.at(main, last + 1)) return { ok: false, why: `Nothing on the main row in column ${last + 2} to join back into.` }
  const row = freeRowFor(map, first, last)
  if (row === null) return { ok: false, why: 'Every other row is already in use across those columns.' }
  const steps = []
  for (const p of put) {
    if (!Number.isInteger(p?.col) || p.col < first || p.col > last || !Number.isInteger(p?.blockId)) continue
    steps.push(place(row, p.col, p.blockId, p.name))
  }
  steps.push(cable(main, first - 1, row))
  for (let col = first; col < last; col++) steps.push(cable(row, col, row))
  steps.push(cable(row, last, main))
  return { ok: true, row, steps }
}

/**
 * Take a parallel path away: its joins cut, then every cell on it cleared.
 *
 * Cut first, so the main row is never left feeding a half-removed path. What
 * is lost — the blocks on the path, settings and all — is listed for the
 * question the app asks before it does this.
 */
export function planRemoveBranch(map, row) {
  const path = branchAt(map, row)
  if (!path) return { ok: false, why: 'That is the main row — remove its blocks one at a time instead.' }
  const steps = []
  for (const from of path.from) steps.push(cable(from, path.start - 1, row, false))
  for (const to of path.to) steps.push(cable(row, path.end, to, false))
  for (const c of rowCells(map, row)) {
    if (c.col < path.end) steps.push(cable(row, c.col, row, false))
  }
  for (const c of rowCells(map, row)) steps.push(clear(row, c.col, c.name))
  return { ok: true, steps, losing: path.blocks.map((b) => b.name || b.slug || 'a block') }
}

/* ---------------------------------------------------------------- */
/* One-tap layouts                                                   */
/* ---------------------------------------------------------------- */

/**
 * The next free instance of a block family from the unit's own list: Delay 2
 * beside Delay 1. Null when the unit has no second one (an FM3 has one Amp
 * and one Reverb) or the preset already uses every one it has.
 */
export function spareInstance(catalog, map, family) {
  const used = new Set(map.cells.map((c) => c.effectId))
  return (
    (catalog || [])
      .filter((b) => (b.family || b.slug) === family && Number.isInteger(b.page))
      .sort((a, b) => (a.instance || 0) - (b.instance || 0))
      .find((b) => !used.has(b.page)) || null
  )
}

/** Blocks a parallel path makes no sense around: the ends of the chain, and the looper. */
const NOT_AROUND = ['input', 'output', 'looper']

/**
 * What can be laid out around one block on the main row — the choices the
 * app offers when it is tapped. Each is a plan, ready to run, or the reason
 * it cannot be.
 */
export function layoutsAround(map, cell, catalog) {
  const main = mainRow(map)
  if (!cell || cell.row !== main || cell.kind !== CELL.block || NOT_AROUND.includes(cell.slug)) return []
  const out = []
  const family = cell.block?.slug || cell.slug
  /* A dry signal alongside it: the effect on one path, the plain guitar on the other. */
  out.push({
    key: 'dry',
    label: `Dry signal beside ${cell.name}`,
    sub: 'Your plain tone runs alongside it, and the two mix back together',
    plan: planParallel(map, { first: cell.col, last: cell.col })
  })
  /* A second one of the same block, side by side: two delays, two drives. */
  const spare = spareInstance(catalog, map, family)
  out.push({
    key: 'second',
    label: spare ? `${spare.name} beside ${cell.name}` : `A second ${family} beside it`,
    sub: spare ? 'Both run at once, each with its own settings' : `This unit has no spare ${family} block`,
    plan: spare
      ? planParallel(map, { first: cell.col, last: cell.col, put: [{ col: cell.col, blockId: spare.page, name: spare.name }] })
      : { ok: false, why: `This unit has no spare ${family} block to put beside it.` }
  })
  /*
   * Delay and reverb side by side: the classic. Only offered on a delay with
   * the reverb straight after it, because that is the one arrangement that
   * can be made by MOVING the reverb rather than adding one — an FM3 has a
   * single Reverb block. The reverb leaves the main row (its cell carries the
   * wire on), goes onto the new path in the delay's column, and the two mix
   * back together where the reverb used to be.
   */
  const next = map.at(main, cell.col + 1)
  if (family === 'delay' && next?.kind === CELL.block && next.slug === 'reverb') {
    out.push({
      key: 'delay-reverb',
      label: `${cell.name} and ${next.name} side by side`,
      sub: 'The delay and the reverb each hear the guitar, instead of the reverb hearing the delay',
      plan: planSideBySide(map, cell, next)
    })
  }
  return out
}

/**
 * Move `moving` (straight after `stays` on the main row) onto a new path in
 * `stays`'s column, so the two run side by side and mix where `moving` was.
 */
export function planSideBySide(map, stays, moving) {
  const main = mainRow(map)
  if (moving.col !== stays.col + 1) return { ok: false, why: 'Only the block straight after this one can be moved beside it.' }
  if (stays.col < 1) return { ok: false, why: 'Nothing comes before it to split from.' }
  if (!map.at(main, stays.col - 1)) return { ok: false, why: `Nothing on the main row in column ${stays.col} to split from.` }
  if (moving.col + 1 >= map.cols) return { ok: false, why: 'Nothing after it to mix back into.' }
  const row = freeRowFor(map, stays.col, stays.col)
  if (row === null) return { ok: false, why: 'Every other row is already in use there.' }
  return {
    ok: true,
    row,
    steps: [
      clear(main, moving.col, moving.name),
      place(row, stays.col, moving.effectId, moving.name),
      /* The emptied cell carries the main row on, so the delay still reaches the rest. */
      cable(main, stays.col, main),
      cable(main, moving.col, main),
      cable(main, stays.col - 1, row),
      cable(row, stays.col, main)
    ]
  }
}

/** The words for one step, for the log and for a step that fails. */
export function stepWords(step) {
  const at = (r, c) => `row ${r + 1}, column ${c + 1}`
  if (step.kind === 'place') return `put ${step.name || 'a block'} at ${at(step.row, step.col)}`
  if (step.kind === 'clear') return `take ${step.name || 'the block'} out of ${at(step.row, step.col)}`
  return `${step.connect ? 'join' : 'cut'} ${at(step.srcRow, step.srcCol)} → row ${step.destRow + 1}`
}

/**
 * Run a plan against a unit: `wire` is { setCable, placeBlock, clearCell }.
 *
 * In order, stopping at the first write the unit or the link throws on — a
 * half-built path is worth stopping at rather than piling more onto, and the
 * app re-reads the chain either way. A plain ok:false is not a stop: some
 * units answer it to writes that landed (grid-plan's doubtfulWrite), and the
 * re-read is what tells.
 */
export async function runPlan(steps, wire) {
  let done = 0
  let doubtful = 0
  for (const step of steps || []) {
    try {
      const res =
        step.kind === 'cable'
          ? await wire.setCable(step.srcRow, step.srcCol, step.destRow, step.connect)
          : step.kind === 'place'
            ? await wire.placeBlock(step.row, step.col, step.blockId)
            : await wire.clearCell(step.row, step.col)
      if (res?.ok === false) doubtful += 1
      done += 1
    } catch (err) {
      return { ok: false, done, doubtful, failed: step, error: err?.message || String(err) }
    }
  }
  return { ok: true, done, doubtful }
}

/* ---------------------------------------------------------------- */
/* The looper, at the end of the chain                               */
/* ---------------------------------------------------------------- */

/**
 * Where a looper goes, and the writes that put it there.
 *
 * "Let's make it easier to add just a looper block, cause I wanna add that to
 * a lot of my presets." On the main row, after the last effect and right
 * before the Output: the loop records everything in front of it — amp, cab,
 * delay and reverb tails — so what plays back sounds like what was played,
 * and the Output's level knob still turns the loop down with everything else.
 *
 * The first free cell (empty, or a bare wire) between the last effect and the
 * Output. None free but the column after the Output is: the Output steps one
 * along and the looper takes its place. Then a cable from each cell into the
 * next, from the effect before the looper to the Output, so the looper is on
 * the signal path and not standing beside it — which is what placing it into
 * an empty row did: "I was trying to add a looper into the blockchain, and I
 * got this."
 *
 * A looper already on the main row is left where it is. One anywhere else —
 * a spare row, joined to nothing — is taken out first and put in the right
 * place, settings and all lost with it, which the app says before it asks.
 */
export function planLooper(map, catalog) {
  const main = mainRow(map)
  const row = rowCells(map, main)
  const blocks = row.filter((c) => c.kind === CELL.block)
  const already = map.cells.find((c) => c.kind === CELL.block && c.slug === 'looper')
  if (already && already.row === main) {
    return { ok: false, here: true, why: `This preset already has its looper, at column ${already.col + 1} of the chain.` }
  }
  const pick = already
    ? { page: already.effectId, name: already.name || 'Looper' }
    : (() => {
        const spare = spareInstance(catalog, map, 'looper')
        return spare ? { page: spare.page, name: spare.name || 'Looper' } : null
      })()
  if (!pick || !Number.isInteger(pick.page)) return { ok: false, why: 'This unit did not list a looper block.' }
  if (!blocks.length) return { ok: false, why: 'There is no chain on this preset to put a looper at the end of.' }

  const out = [...blocks].reverse().find((c) => c.slug === 'output') || null
  const outCol = out ? out.col : map.cols
  const lastFx = [...blocks].reverse().find((c) => c.col < outCol && c.slug !== 'output' && c.slug !== 'looper')
  const from = lastFx ? lastFx.col + 1 : 1
  const free = (col) => {
    const c = map.at(main, col)
    return !c || c.kind === CELL.shunt
  }
  const steps = []
  if (already) steps.push(clear(already.row, already.col, already.name))
  let col = null
  for (let c = Math.max(1, from); c < outCol; c++) {
    if (free(c)) {
      col = c
      break
    }
  }
  let outAt = outCol
  if (col === null) {
    if (!out || out.col + 1 >= map.cols || !free(out.col + 1)) {
      return { ok: false, why: 'There is no free space at the end of the chain. Take a block out, or move one, and try again.' }
    }
    /* The Output steps one along; the looper takes the cell it left. */
    steps.push(clear(main, out.col, out.name))
    steps.push(place(main, out.col + 1, out.effectId, out.name))
    col = out.col
    outAt = out.col + 1
  }
  steps.push(place(main, col, pick.page, pick.name))
  /* A wire from the block before it to the Output, every cell along. */
  const start = lastFx ? lastFx.col : col - 1
  const end = out ? outAt : col + 1
  for (let c = Math.max(0, start); c < end && c + 1 < map.cols; c++) steps.push(cable(main, c, main))
  return { ok: true, row: main, col, name: pick.name, moved: !!already, losing: already ? [already.name || 'Looper'] : [], steps }
}

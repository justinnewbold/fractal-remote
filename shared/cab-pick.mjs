/**
 * Choosing a cab on a unit that has two ways of playing one.
 *
 * An FM3 cab block is either playing an impulse response out of a bank
 * (LEGACY) or one of its forty-five DynaCab cabinets (DYNA-CAB), and which it
 * is lives on a selector of its own. The model list the app offers for a cab
 * is the DynaCab list — but the model change it used to send went to the
 * block's "type", and a cab block has no type. The host resolved the word to
 * the nearest thing with TYPE in its name, which is the Preamp Type, so a
 * tester picked "1x12 G12T-100", heard nothing change, and the picker then
 * read the Preamp Type back and named the cab he had picked. Both ends of
 * that were wrong and agreed with each other.
 *
 * So for a cab the host's own cab state is the answer: it says which mode the
 * block is in, which DynaCab each slot holds and which IR each slot plays, and
 * which parameter holds each of those. Picking a cab writes the mode (only if
 * it has to) and then slot 1's DynaCab, both as plain numbers on the discrete
 * path, and never as a model change.
 *
 * Shared, with no imports, because the browser and the phone have to do the
 * same writes in the same order. A cab picked on the phone and a cab picked at
 * the computer that land in different places would be two bugs, not one.
 */

/** What the mode selector holds when the block is playing a DynaCab. */
export const DYNACAB = 1

/* What the host answers with when its own table does not name them. They are
   the same on an FM3, an FM9 and an Axe-Fx III. */
const MODE_PARAM = 31
const DYNA_PARAM = 85

/** Said on screen when a cab write is refused. */
export const CAB_REFUSED = "The unit didn't take that cab."

/** Said on screen when an undo cannot be sent because the panel lost track of the cab. */
export const CAB_UNDO_LOST = "Couldn't put the cab back. Pick it from the list instead."

/** Said on screen when a model change is refused, for every other block. */
export const MODEL_REFUSED = "The unit didn't take that model."

/**
 * Whether the host's cab state can drive the picker at all.
 *
 * Anything else — an error, a unit that has no cab state to give, a demo unit
 * without one — leaves the picker doing exactly what it did before.
 */
export const cabReady = (cab) =>
  !!cab && typeof cab === 'object' && !cab.error && Array.isArray(cab.slots) && cab.slots.length > 0

const first = (cab) => cab.slots[0] || {}
const modeOf = (cab) => (typeof cab.mode === 'object' ? cab.mode?.value : cab.mode)
const dynaOf = (slot) => (typeof slot.dyna === 'object' ? slot.dyna?.value : slot.dyna)

/**
 * Whether the params read, taken just before, agrees with the cab state.
 *
 * A cab-state read that timed out on the host does not come back as an
 * error: it comes back with every number at zero, which is exactly what a
 * block on Legacy playing IR 0 looks like — and a factory-fresh cab block
 * reads the same, so the zeros alone prove nothing. The params read carries
 * the mode and slot 1's DynaCab too (among its `enums`), and when IT fails it
 * carries no enums at all. So where it has them and they differ, the cab state
 * is the read that failed. Where it has neither — a demo, or a read with
 * nothing in it — the cab state stands.
 */
export function cabAgrees(cab, params) {
  if (!cabReady(cab)) return false
  const enums = Array.isArray(params?.enums) ? params.enums : []
  const at = (id) => enums.find((e) => e?.id === id)?.value
  const mode = at(cab.modeParam ?? MODE_PARAM)
  const dyna = at(first(cab).dynaParam ?? DYNA_PARAM)
  return (mode === undefined || mode === modeOf(cab)) && (dyna === undefined || dyna === dynaOf(first(cab)))
}

/**
 * Read the cab state, and read it once more if the params read disagrees.
 *
 * `read()` is the client's cab-state read, `params` the params read just
 * taken. Null when there is no cab state to be had — the panel as it always
 * was. A state that still disagrees after the second read is kept rather than
 * dropped, because dropping it would send the next pick through the model
 * change to the Preamp Type; it is marked `unsure`, and an unsure state names
 * nothing on screen and offers no undo, since the undo would be written from
 * numbers that were never read.
 */
export async function readCab(read, params) {
  const c = await read().catch(() => null)
  if (!cabReady(c)) return null
  if (cabAgrees(c, params)) return c
  const again = await read().catch(() => null)
  if (cabReady(again) && cabAgrees(again, params)) return again
  return { ...c, unsure: true }
}

/**
 * The cab state as the writes that were taken left it.
 *
 * For when it cannot be read back after a pick. Losing it instead would put
 * the panel back on the model change — the Preamp Type — for the next pick,
 * and bring the IR numbers back onto the deck; keeping the state from before
 * the pick would make the undo think nothing had moved. `sent` is the
 * [paramId, ordinal] list from pickCab or restoreCab; pass only the writes
 * that were accepted.
 */
export function cabAfter(cab, sent = []) {
  if (!cabReady(cab)) return null
  const modeParam = cab.modeParam ?? MODE_PARAM
  const dynaParam = first(cab).dynaParam ?? DYNA_PARAM
  const next = { ...cab, slots: cab.slots.map((s) => ({ ...s })) }
  for (const [id, v] of sent) {
    if (id === modeParam) next.mode = { value: v, label: v === DYNACAB ? 'DYNA-CAB' : 'LEGACY' }
    else if (id === dynaParam) next.slots[0].dyna = { value: v, label: '' }
  }
  return next
}

/** The writes a pick or an undo got through: all of them, or all but the refused last one. */
export const taken = (res) => (res?.ok ? res.sent : (res?.sent || []).slice(0, -1))

/** True when the block is playing a DynaCab rather than an IR. */
export const onDynaCab = (cab) => cabReady(cab) && modeOf(cab) === DYNACAB

/** Which IR slot 1 plays, as a person would say it. */
const irOf = (slot) => slot.irName || `IR ${slot.irIndex ?? '—'}`

/**
 * What the picker should say the block is on.
 *
 * On DynaCab it names slot 1's cabinet and marks it in the list. On an IR it
 * names the IR and marks nothing, because nothing in the list is what is
 * playing — and says what picking one will do, since it changes more than the
 * cab: the block stops playing the IR at all.
 */
export function cabShowing(cab, models = []) {
  if (!cabReady(cab)) return null
  if (cab.unsure) return { value: null, name: null, legacy: false, hint: null }
  const slot = first(cab)
  if (onDynaCab(cab)) {
    const value = dynaOf(slot)
    const name = models.find((m) => m.value === value)?.name || slot.dyna?.label || `DynaCab ${value}`
    return { value, name, legacy: false, hint: null }
  }
  return {
    value: null,
    name: irOf(slot),
    legacy: true,
    hint: 'Playing an IR. Picking a cab from this list switches this block to DynaCab.'
  }
}

/**
 * The controls that are not knobs, by the numbers the host gave them.
 *
 * An IR number is one of a thousand and twenty-four recordings, and a bank is
 * one of five lists of them. Neither is "a bit more" of anything, and served
 * as knobs they were turned like knobs — a sweep across a slot's IR number
 * sends a normalised position to a parameter that wants a whole number. So
 * they come off the deck. Found by the ids the cab state reports rather than
 * by their labels, which are "Type 1" and "Bank" and could be anything.
 */
export function cabHidden(cab) {
  const ids = new Set()
  if (!cabReady(cab)) return ids
  for (const slot of cab.slots) {
    if (Number.isInteger(slot?.irParam)) ids.add(slot.irParam)
    if (Number.isInteger(slot?.bankParam)) ids.add(slot.bankParam)
  }
  return ids
}

/** Where the block was, for the undo: the mode and slot 1's DynaCab, and what to call it. */
export function cabWas(cab, models = []) {
  if (!cabReady(cab) || cab.unsure) return null
  return { mode: modeOf(cab), dyna: dynaOf(first(cab)), name: cabShowing(cab, models)?.name || '' }
}

const refused = (res) => res?.ok === false

/**
 * Put the chosen DynaCab on slot 1, switching the block to DynaCab first if it
 * is playing an IR.
 *
 * `write(paramId, ordinal)` is the client's discrete write. The mode goes
 * first because a DynaCab written while the block plays an IR is stored and
 * not heard; and if the mode is refused, the cab is not sent at all, so a
 * refusal leaves the block where it was rather than half-changed.
 */
export async function pickCab(cab, value, write) {
  const modeParam = cab.modeParam ?? MODE_PARAM
  const dynaParam = first(cab).dynaParam ?? DYNA_PARAM
  const sent = []
  // An unsure state's mode is not known, so it is written rather than trusted.
  if (cab.unsure || modeOf(cab) !== DYNACAB) {
    sent.push([modeParam, DYNACAB])
    if (refused(await write(modeParam, DYNACAB))) return { ok: false, sent }
  }
  sent.push([dynaParam, Number(value)])
  if (refused(await write(dynaParam, Number(value)))) return { ok: false, sent }
  return { ok: true, sent }
}

/**
 * Take a pick back: slot 1's DynaCab as it was, and then the mode as it was.
 *
 * The cab goes back first, while the block is still on DynaCab, so that
 * undoing a switch out of an IR ends with the block playing that IR again —
 * the mode last, because it is the write that decides what is heard.
 *
 * Both are written whether or not the cab state says they are already there,
 * because the cab state may be a read that failed or one that could not be
 * taken at all — and an undo that skips a write on the word of a bad read is
 * an undo that says it worked and did nothing. Writing a value that is
 * already there changes nothing.
 */
export async function restoreCab(cab, was, write) {
  const modeParam = cab.modeParam ?? MODE_PARAM
  const dynaParam = first(cab).dynaParam ?? DYNA_PARAM
  const sent = []
  if (Number.isInteger(was?.dyna)) {
    sent.push([dynaParam, was.dyna])
    if (refused(await write(dynaParam, was.dyna))) return { ok: false, sent }
  }
  if (Number.isInteger(was?.mode)) {
    sent.push([modeParam, was.mode])
    if (refused(await write(modeParam, was.mode))) return { ok: false, sent }
  }
  return { ok: true, sent }
}

/** Whether a fresh cab state shows the pick: DynaCab mode, and that cab on slot 1. */
export const cabShows = (cab, value) => onDynaCab(cab) && !cab.unsure && dynaOf(first(cab)) === Number(value)

/** Whether a fresh cab state is back where the undo meant to put it. */
export const cabBackTo = (cab, was) =>
  cabReady(cab) && !cab.unsure && modeOf(cab) === was?.mode && (was?.mode !== DYNACAB || dynaOf(first(cab)) === was?.dyna)

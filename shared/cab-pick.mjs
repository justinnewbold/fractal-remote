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
 * And a cab block can be put back on an IR by name: "Pick a cab IR by name"
 * was a request neither app could answer, because the IR number and the bank
 * were taken off the knobs (see cabHidden) and nothing took their place. The
 * IR picker below writes the bank, then the IR, then the mode — see pickIr.
 *
 * Shared, with no imports, because the browser and the phone have to do the
 * same writes in the same order. A cab picked on the phone and a cab picked at
 * the computer that land in different places would be two bugs, not one.
 */

/** What the mode selector holds when the block is playing a DynaCab. */
export const DYNACAB = 1

/** And when it is playing an IR out of a bank. */
export const LEGACY = 0

/* What the host answers with when its own table does not name them. They are
   the same on an FM3, an FM9 and an Axe-Fx III. */
const MODE_PARAM = 31
const DYNA_PARAM = 85
const BANK_PARAM = 0
const IR_PARAM = 4

/* How many IRs a bank the host has no names for holds, when the params read
   does not say. An FM3's IR number runs 0 to 1023. */
const USER_IRS = 1024

/** Said on screen when a cab write is refused. */
export const CAB_REFUSED = "The unit didn't take that cab."

/**
 * Said on screen when the unit took every write but the cab reads back as
 * something else. "Done" about a cab that never moved is the bug 1.86.18 was
 * about; a write that is not refused is not the same as one that is kept.
 */
export const cabElsewhere = (cab, models = []) => {
  const name = cabShowing(cab, models)?.name
  return name ? `The unit shows ${name} instead.` : CAB_REFUSED
}

/**
 * What the panel should hold after a write threw part way through a pick.
 *
 * No answer is not a no: the writes before it landed, and that one may have.
 * So a good fresh read is the answer; failing that, the state from before is
 * kept but marked unsure, which makes the next pick write the bank, the IR and
 * the mode rather than skip one on the word of numbers the unit has moved off.
 */
export const cabLost = (before, now) => (cabReady(now) && !now.unsure ? now : cabReady(before) ? { ...before, unsure: true } : null)

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
const bankOf = (slot) => (slot.bank && typeof slot.bank === 'object' ? slot.bank.value : slot.bank)

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
  const bankParam = first(cab).bankParam ?? BANK_PARAM
  const irParam = first(cab).irParam ?? IR_PARAM
  const next = { ...cab, slots: cab.slots.map((s) => ({ ...s })) }
  for (const [id, v] of sent) {
    if (id === modeParam) next.mode = { value: v, label: v === DYNACAB ? 'DYNA-CAB' : 'LEGACY' }
    else if (id === dynaParam) next.slots[0].dyna = { value: v, label: '' }
    // An IR pick's: the bank by the unit's own word for it, and the IR by
    // number only — its name is the IR list's to give (see irNow).
    else if (id === bankParam) next.slots[0].bank = { value: v, label: bankLabel(cab.bankOptions?.[v]) ?? String(v) }
    else if (id === irParam) next.slots[0] = { ...next.slots[0], irIndex: v, irName: '' }
  }
  return next
}

/** The writes a pick or an undo got through: all of them, or all but the refused last one. */
export const taken = (res) => (res?.ok ? res.sent : (res?.sent || []).slice(0, -1))

/** True when the block is playing a DynaCab rather than an IR. */
export const onDynaCab = (cab) => cabReady(cab) && modeOf(cab) === DYNACAB

/**
 * An IR as a person would say it: its name, or its number when it has none.
 *
 * The host names an IR it has no name for "#12" (his own User IRs, which it
 * cannot read the names of yet), and a Scratchpad slot with nothing in it
 * "<EMPTY>". Neither is a name. They are counted from one here, as a person
 * counts, where the unit's own number for them starts at nought.
 */
export function irLabel(name, index) {
  const n = Number.isInteger(index) ? index + 1 : '—'
  const said = typeof name === 'string' ? name.trim() : ''
  if (/^<empty>$/i.test(said)) return `IR ${n} (empty)`
  if (!said || /^#\d+$/.test(said)) return `IR ${n}`
  return said
}

/**
 * Which IR a slot plays, as a person would say it.
 *
 * Only a firmware bank's name is the host's to give. For his own banks —
 * USER, and an FM3's SCRATCHPAD — the host names the slot out of a list that
 * came with the codec, which is another unit's IR library (see irBanks), so
 * those are said by number.
 */
export const slotIr = (slot) => {
  const l = bankLabel(slot?.bank)
  return irLabel(l == null || firmwareBank(l) ? slot?.irName : '', slot?.irIndex)
}

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
    name: slotIr(slot),
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

/**
 * Where the block was, for the undo: the mode and slot 1's DynaCab, and what
 * to call it.
 *
 * Told which pick is about to happen, because the two undo different things.
 * A DynaCab pick moves the mode and the DynaCab; an IR pick moves the bank,
 * the IR and the mode, and its undo has to hold all three — or taking back an
 * IR picked out of another bank puts the old number back in the new bank.
 */
export function cabWas(cab, models = [], pick) {
  if (!cabReady(cab) || cab.unsure) return null
  const was = { mode: modeOf(cab), dyna: dynaOf(first(cab)), name: cabShowing(cab, models)?.name || '' }
  if (!isIrPick(pick)) return was
  const bank = bankOf(first(cab))
  const ir = first(cab).irIndex
  if (!Number.isInteger(bank) || !Number.isInteger(ir)) return null
  return { ...was, kind: 'ir', bank, ir }
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
  if (isIrPick(value)) return pickIr(cab, value, write)
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
  /* An IR pick taken back: the bank and the IR as they were. Back to an IR,
     the mode goes last, as in pickIr — it decides what is heard. Back to a
     DynaCab, it goes first, so the bank and the IR change silently under the
     DynaCab rather than playing two unrelated IRs on the way. */
  if (was?.kind === 'ir') {
    const mode = [modeParam, was.mode]
    const lr = [
      [first(cab).bankParam ?? BANK_PARAM, was.bank],
      [first(cab).irParam ?? IR_PARAM, was.ir]
    ]
    for (const [id, v] of was.mode === DYNACAB ? [mode, ...lr] : [...lr, mode]) {
      if (!Number.isInteger(v)) continue
      sent.push([id, v])
      if (refused(await write(id, v))) return { ok: false, sent }
    }
    return { ok: true, sent }
  }
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

/**
 * Whether a fresh cab state shows the pick: DynaCab mode and that cab on slot
 * 1 — or, for an IR, the IR mode with that bank and that IR on slot 1.
 */
export const cabShows = (cab, value) =>
  isIrPick(value)
    ? cabReady(cab) &&
      !cab.unsure &&
      modeOf(cab) === legacyOf(cab) &&
      bankOf(first(cab)) === value.bank &&
      first(cab).irIndex === value.ir
    : onDynaCab(cab) && !cab.unsure && dynaOf(first(cab)) === Number(value)

/** Whether a fresh cab state is back where the undo meant to put it. */
export const cabBackTo = (cab, was) =>
  was?.kind === 'ir'
    ? cabReady(cab) &&
      !cab.unsure &&
      modeOf(cab) === was.mode &&
      bankOf(first(cab)) === was.bank &&
      first(cab).irIndex === was.ir
    : cabReady(cab) && !cab.unsure && modeOf(cab) === was?.mode && (was?.mode !== DYNACAB || dynaOf(first(cab)) === was?.dyna)

/* ------------------------------------------------------------------ */
/* Picking an IR by name                                               */
/* ------------------------------------------------------------------ */

/** Said under the IR control when the block is playing a DynaCab. */
export const IR_HINT = 'Playing a DynaCab. Picking an IR switches this block to that IR.'

/** Said over his own IRs, which the unit does not name to the app. */
export const USER_IRS_NOTE = "Your own IRs show as numbers. The app can't read their names yet."

/** An IR pick: which bank (the unit's own number for it) and which IR in it, from nought. */
export const isIrPick = (v) => !!v && typeof v === 'object' && Number.isInteger(v.bank) && Number.isInteger(v.ir)

/* What the mode selector holds for an IR, by the host's own list where it gives one. */
const legacyOf = (cab) => {
  const o = (Array.isArray(cab?.modeOptions) ? cab.modeOptions : []).find((m) => /legacy/i.test(m?.label ?? ''))
  return Number.isInteger(o?.value) ? o.value : LEGACY
}

/*
 * The banks that come with the firmware, whose names are the same on every
 * unit: the codec's own CAB_BANK_IDS (forgefx-midi src/cache/assign.ts). Every
 * other bank is his own, and the codec says the names it ships for those are
 * "the donor unit's own IR library — deliberately excluded". An FM3's list
 * still carries a SCRATCHPAD of someone else's IRs, so it is never shown.
 */
const firmwareBank = (label) => /^(factory|legacy)\b/i.test(String(label ?? '').trim())

const bankLabel = (o) => (o && typeof o === 'object' ? (o.label ?? null) : o == null ? null : String(o))

/* "FACTORY 1" is how the unit writes it; "Factory 1" is how a person reads it. */
const bankName = (label) => String(label ?? '').toLowerCase().replace(/(^|\s)([a-z])/g, (_, a, b) => a + b.toUpperCase())

/**
 * The banks to choose an IR from, in the unit's own order, each with its IRs.
 *
 * The order is the cab state's `bankOptions`, NOT the order of GET /cab/irs.
 * The two differ: on an FM3 the banks are FACTORY 1, FACTORY 2, USER, LEGACY
 * and SCRATCHPAD, and /cab/irs has no USER at all — so counting down its keys
 * made Legacy bank 2, which is USER, and every bank from there on one off.
 * Names are joined by the bank's word instead.
 *
 * Names are taken for the firmware banks only (Factory and Legacy). His own
 * banks — USER, which the host cannot read the names of yet, and an FM3's
 * SCRATCHPAD, whose list is another unit's IRs — are offered by number: as
 * many as the list has slots, or for USER as many as the IR control holds
 * (the params read says, 0 to 1023 on an FM3). Any other bank with nothing in
 * it is left out, because there is nothing in it to pick.
 */
export function irBanks(cab, irs, params) {
  if (!cabReady(cab) || !Array.isArray(cab.bankOptions)) return []
  const lists = new Map()
  if (irs && typeof irs === 'object' && !irs.error) {
    for (const [k, v] of Object.entries(irs)) if (Array.isArray(v)) lists.set(k.trim().toUpperCase(), v)
  }
  const knob = (params?.named || []).find((p) => p?.id === (first(cab).irParam ?? IR_PARAM))
  const held = Number.isInteger(knob?.max) && knob.max > 0 && knob.max < 4096 ? knob.max + 1 : USER_IRS
  return cab.bankOptions
    .map((o, i) => {
      const label = bankLabel(o) ?? String(i)
      const value = o && typeof o === 'object' && Number.isInteger(o.value) ? o.value : i
      const listed = lists.get(label.trim().toUpperCase()) || []
      const names = firmwareBank(label) ? listed : []
      const user = !firmwareBank(label) && (/user/i.test(label) || listed.length > 0)
      return { value, label, name: bankName(label), names, user, count: names.length || (user ? listed.length || held : 0) }
    })
    .filter((b) => b.count > 0)
}

const nameIn = (bank, i) => irLabel(bank.names[i], i)

/**
 * What the IR control says: which bank and IR slot 1 holds, and whether the
 * block is playing it or a DynaCab. Null when the cab state is not to be
 * believed — the IR picker names nothing and offers nothing then.
 */
export function irNow(cab, banks = []) {
  if (!cabReady(cab) || cab.unsure) return null
  const slot = first(cab)
  const bank = bankOf(slot)
  const ir = slot.irIndex
  const b = banks.find((x) => x.value === bank)
  return {
    bank,
    ir,
    name: b && Number.isInteger(ir) && ir < b.count ? nameIn(b, ir) : slotIr(slot),
    bankName: b?.name || bankName(bankLabel(slot.bank) ?? ''),
    playing: modeOf(cab) !== DYNACAB
  }
}

/**
 * The rows the IR list shows: the chosen bank when nothing is typed, and every
 * bank when something is, word by word on the name, the number and the bank —
 * the chosen bank's matches first. His own IRs are only numbers, the factory
 * names are full of numbers (4x12, SM57, 121), and in the unit's bank order
 * two thousand of those came ahead of him: "12" on the User bank never
 * reached his IR 12. In a bank with no names the exact number is its first
 * match, so putting the bank first is enough.
 *
 * Capped, and the rest counted, rather than drawn: four banks hold some three
 * thousand IRs, and a count under the list is honest about what is missing.
 */
export function findIrs(banks = [], hunt = '', bank = null, limit = 40) {
  const words = String(hunt).trim().toLowerCase().split(/\s+/).filter(Boolean)
  const chosen = banks.filter((b) => b.value === bank)
  const pool = words.length ? [...chosen, ...banks.filter((b) => b.value !== bank)] : chosen
  const rows = []
  let total = 0
  for (const b of pool) {
    for (let i = 0; i < b.count; i++) {
      const name = nameIn(b, i)
      if (words.length) {
        const said = `${name} ${i + 1} ${b.name}`.toLowerCase()
        if (!words.every((w) => said.includes(w))) continue
      }
      total++
      if (rows.length < limit) rows.push({ key: `${b.value}:${i}`, bank: b.value, ir: i, name, bankName: b.name })
    }
  }
  return { rows, more: total - rows.length }
}

/**
 * Put an IR on slot 1: the bank, then the IR number, then the mode last.
 *
 * All three are whole numbers on the discrete path, like a DynaCab pick. The
 * bank goes before the number because the number means a different IR in
 * every bank. The mode goes last because it is the write that decides what is
 * heard: a block on DynaCab keeps playing its DynaCab while the bank and the
 * IR change underneath it, and then switches once, to the IR that was picked.
 *
 * A bank already on the block is not written again, nor is a mode already on
 * the IR — unless the cab state is unsure, when nothing it says is trusted.
 * If the IR number is refused after the bank moved, the bank is put back, so a
 * refusal leaves the block where it was rather than on the same number in
 * another bank.
 */
export async function pickIr(cab, pick, write) {
  const slot = first(cab)
  const bankParam = slot.bankParam ?? BANK_PARAM
  const irParam = slot.irParam ?? IR_PARAM
  const modeParam = cab.modeParam ?? MODE_PARAM
  const legacy = legacyOf(cab)
  const was = bankOf(slot)
  const sent = []
  let moved = false
  if (cab.unsure || was !== pick.bank) {
    sent.push([bankParam, pick.bank])
    if (refused(await write(bankParam, pick.bank))) return { ok: false, sent }
    moved = true
  }
  if (refused(await write(irParam, pick.ir))) {
    if (moved && !cab.unsure && Number.isInteger(was) && !refused(await write(bankParam, was))) sent.push([bankParam, was])
    // The refused write last, as `taken` expects.
    sent.push([irParam, pick.ir])
    return { ok: false, sent }
  }
  sent.push([irParam, pick.ir])
  if (cab.unsure || modeOf(cab) !== legacy) {
    sent.push([modeParam, legacy])
    if (refused(await write(modeParam, legacy))) return { ok: false, sent }
  }
  return { ok: true, sent }
}

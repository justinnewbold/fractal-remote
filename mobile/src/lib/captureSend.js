/*
 * ONE CAPTURE INTO ONE SLOT, AND THE WAYS IT IS TRIED.
 *
 * What the TONE3000 page does between "an empty slot was found" and "the
 * NAM block is pointed at it", kept out of the page so that it can be run
 * whole in a test against a unit that answers as his did. The page's own
 * part is the words on the screen; this is what is sent, in what order, and
 * what is made of the unit's answers.
 *
 * THE NAME'S 32ND BYTE IS 0x60, AND NOTHING ELSE IS SENT THERE (settled 16
 * November 2026, lib/nam-install NAM_NAME_BYTE_AXE has the whole of it).
 * From 1.90.70 to 1.90.87 a capture the unit took and did not keep was sent
 * again with the name XORed there as well, because two captures sent that
 * way had been kept and three dropped. Then "FNDR BFSR VB Edge WRM2 CAB
 * FREE" was dropped every time it went with its name XORed (0x02) and KEPT
 * the first time it went with 0x60, and "EVH 5150III 100S stealth green"
 * was kept with 0x60 too. So the XOR ways are gone, and the ways left are:
 *
 *   1. 0x60 in the name's 32nd place, as Axe-Edit sent, with the file's hash
 *   2. 0x60, and no hash (noughts, as Fractal's own captures have)
 *
 * A way that would send the same record as one already sent is left out (a
 * file with no hash has one way). The log says what each way sent and what
 * the unit did with it, with the file's own notes once. THE FILLING OUT OF
 * A SHORT NAME WITH SPACES IS GONE: a short name (Jcm800) was kept as it
 * was, and two filled out were dropped.
 *
 * THROUGH A COMPUTER APP OLDER THAN THE ONE THAT SENDS THE BYTE AS PACKED,
 * the computer writes the name XORed over whatever byte came (ForgeFX
 * namNameChecked, before 64c44a7), and the unit drops most of those. Its
 * answer does not say which byte went (`nameByte`), which is how it is
 * known: the log says the name XORed went and to update the computer app,
 * and a file with no hash, whose two ways would be the same XORed record,
 * is sent once.
 *
 * AND WHAT AN INDEPENDENT READ OF THE FIRST VERSION FOUND: a unit that
 * files a send LATE (the slot reads <EMPTY> at both looks, then holds it)
 * has the next try refused "already holds"; refused because the slot holds
 * THIS capture, that is the try before it kept (`heldAlready`), and nothing
 * more is sent. A file with no hash has no next try in the same send, so
 * the card remembers the slot (lib/capturePlaced `notKept`) and sends it
 * there again on the next tap, where the same refusal says it was kept. And
 * a try that stops part-way says which way was going (`err.way`), so sent
 * again it goes that way.
 *
 * A TAP, WHOLE (`captureToSlot`, from a second independent read of the
 * remembering): which slot, the send, and what is remembered after it, here
 * where a test runs it, and not in the page. The slot remembered is
 * dropped when it is found holding another capture (and an empty one looked
 * for in the same tap: the player never picked that slot), and when a send
 * stopped part-way into it. A send that wrote nothing into it (the slot
 * never answered, the start was refused or went unanswered, the line went
 * before the first message), or did not say what it did, keeps it: the unit
 * may file the capture there yet, and the next tap finds it.
 *
 * PURE: the sender is handed in, with the log and the one line the screen
 * needs. Nothing here knows a wire from a computer.
 */
import { NAM_EMPTY, namRecord, namSlotSaid } from './nam-install.js'
import { forgetNotKept, notKept, notKeptIn, place } from './capturePlaced.js'

/** The ways a capture is sent, in the order they are tried: 0x60 in the name's 32nd place each time (namRecord packs nothing else), with the file's hash and then without. `said` is for the log. */
export const CAPTURE_WAYS = Object.freeze([
  Object.freeze({ hash: true, said: 'the name byte Axe-Edit sent, with the file’s hash' }),
  Object.freeze({ hash: false, said: 'the name byte Axe-Edit sent, no hash' })
])

/** The ways in order with `first` moved to the front: the way a unit last kept one, or the way that was going when a send stopped. Anything else is the plain order. */
export function captureOrder(first = null) {
  const all = CAPTURE_WAYS.map((_, i) => i)
  return Number.isInteger(first) && first >= 0 && first < all.length ? [first, ...all.filter((i) => i !== first)] : all
}

/* A name as the unit says it, without the spaces an older computer app may leave on one, whichever copy read the slot. */
const heard = (got) => (typeof got?.name === 'string' ? { ...got, name: got.name.replace(/ +$/, '') } : got)

const hex = (b) => `0x${(b & 0xff).toString(16).padStart(2, '0')}`

/** The file's own notes in one line, for the log. */
export function factsSaid(rec) {
  const f = rec.facts || {}
  const text = (x) => (x ? `“${x}”` : 'none')
  const num = (x) => (typeof x === 'number' ? String(Math.round(x * 1000) / 1000) : 'none')
  return `the file says: name “${rec.name}” (${rec.name.length} characters, XORs to ${hex(rec.xor)}), by ${text(f.by)}, make ${text(f.make)}, model ${text(f.model)}, gear ${text(f.gearType)}, tone ${text(f.toneType)}; loudness ${num(f.loudness)}, gain ${num(f.gain)}, levels in ${num(f.levelIn)} out ${num(f.levelOut)}; ${f.hash ? 'it has a hash' : 'it has no hash'}`
}

/**
 * Whether a refusal says the slot already holds THIS capture. Over the
 * device's own wire the failure carries the name (`holds`); through the
 * computer only its words and its number come back, and the words name it
 * (ForgeFX `capture slot 005 already holds "…"; nothing was sent`).
 */
export function heldAlready(err, name) {
  if (err?.status !== 409 || typeof name !== 'string' || !name) return false
  if (typeof err.holds === 'string') return err.holds.replace(/ +$/, '') === name
  const words = typeof err.message === 'string' ? err.message : ''
  return words.includes(`holds “${name}”`) || words.includes(`holds "${name}"`)
}

/** Whether a refusal says the slot holds something, and it is NOT this capture: another went in since. A refusal that names nothing (the capture tools busy) is not one. */
export function heldElse(err, name) {
  if (err?.status !== 409) return false
  const words = typeof err?.message === 'string' ? err.message : ''
  return (typeof err.holds === 'string' || /already holds/i.test(words)) && !heldAlready(err, name)
}

/**
 * Whether a failed send leaves nothing worth remembering of its slot: it
 * stopped part-way (`partial` over the device's own wire; through the
 * computer only its words come back, which say so), or the slot was found
 * holding something. Anything else wrote nothing, or did not say, and the
 * slot is kept.
 */
export function slotSpent(err) {
  if (err?.partial === true) return true
  const words = typeof err?.message === 'string' ? err.message : ''
  if (/part of a capture/i.test(words)) return true
  return err?.status === 409 && (typeof err.holds === 'string' || /already holds/i.test(words))
}

/**
 * One tap's send of one capture: the slot, the send, and what the app
 * remembers after it (lib/capturePlaced). The slot is `again` (where a send
 * stopped part-way, sent over), else where this capture was last taken and
 * not kept (`sentBefore` told: a refusal for THIS capture there is that send,
 * filed late), else an empty one (`find`). Found holding another capture,
 * the remembered slot is forgotten and an empty one is looked for, in the
 * same tap.
 *
 * Where the unit keeps it, it is placed; where it took it and did not keep
 * it, the slot is remembered; a failure forgets the slot only where
 * `slotSpent` says so. ALL OF IT BEFORE ANYTHING ASKS WHETHER THE PAGE IS
 * STILL UP: a send goes on after the page it started on is left.
 *
 * @param {object} c
 * @param {string|number} c.id      TONE3000's id for the capture
 * @param {string} c.name           what it is filed under (namRecord's `name`)
 * @param {number|null} [c.again]   the slot a send that stopped part-way left
 * @param {() => Promise<number|null>} c.find  an empty slot, or null where there is none or the page has gone (the page says which)
 * @param {(slot: number, sentBefore: boolean) => Promise<object>} c.send  sendCapture into that slot
 * @param {(line: string) => void} [c.log]
 * @returns `{ slot, went }`: `went` is sendCapture's answer, or null where no slot was found
 */
export async function captureToSlot({ id, name, again = null, find, send, log = () => {} }) {
  const over = Number.isInteger(again)
  const before = over ? null : notKeptIn(id)
  let slot = over ? again : before
  try {
    if (before !== null) log(`sent to slot ${namSlotSaid(before)} again, where it was taken and not kept last time`)
    if (slot === null) {
      slot = await find()
      if (!Number.isInteger(slot)) return { slot: null, went: null }
    }
    let went
    try {
      went = await send(slot, before !== null)
    } catch (err) {
      if (before === null || !heldElse(err, name)) throw err
      /* Not its slot any more: something else went in since. Nothing was sent, and the player never picked that slot, so an empty one is looked for now. */
      forgetNotKept(id)
      log(`slot ${namSlotSaid(before)} holds another capture now (${err?.message || 'refused'}); looking for an empty slot`)
      slot = await find()
      if (!Number.isInteger(slot)) return { slot: null, went: null }
      went = await send(slot, false)
    }
    if (went?.ok && went.got?.name === NAM_EMPTY) notKept(id, slot)
    else {
      forgetNotKept(id)
      if (went?.ok) place(id, slot, !!went.got?.name)
    }
    return { slot, went }
  } catch (err) {
    if (slotSpent(err)) forgetNotKept(id)
    throw err
  }
}

/**
 * Send one capture's file into `slot`.
 *
 * @param {object} c
 * @param {string} c.text      the .nam file's text
 * @param {object} c.named     what the app knows the capture by (namRecord's `said`)
 * @param {number} c.slot      the slot it goes into
 * @param {boolean} [c.replace] over what is there (only the page's own half-sent slot, and only over the device's own wire)
 * @param {boolean} [c.sentBefore] `slot` is where an earlier send of this capture was taken and not kept (lib/capturePlaced notKept): a first try refused because the slot holds THIS capture is that send, filed late, and nothing is sent
 * @param {number[]} [c.order] the ways to try, by their place in CAPTURE_WAYS (`captureOrder`); all of them in order when left out
 * @param {(slot: number, words: number[], how: { replace: boolean, way: number, second: boolean }) => Promise<object>} c.install
 * @param {(line: string) => void} [c.log]
 * @param {(n: number) => void} [c.onNext] try number `n` (2 or more) is about to go
 *
 * @returns `{ ok: false, why }` for a file that is no capture, else
 *   `{ ok: true, name, got, tries, way, late }`: `name` as the app calls it,
 *   `got` the sender's last answer (its `name` what the slot reads as now,
 *   or "<EMPTY>" for one not kept), `tries` how many were sent, `way` the
 *   place in CAPTURE_WAYS of the last one sent (the one kept, where one
 *   was), `late` when a try turned out to have been kept after the slot had
 *   read empty. A send that fails throws the sender's own failure, with
 *   `way` added: which way was going.
 */
export async function sendCapture({ text, named, slot, replace = false, sentBefore = false, order = null, install, log = () => {}, onNext = () => {} }) {
  const plain = namRecord(text, named)
  if (!plain.ok) return { ok: false, why: plain.why }
  const said = (got) => `“${got?.name ?? 'nothing it would say'}”`
  const ways = (Array.isArray(order) && order.length ? order : captureOrder()).filter((i, at, all) => Number.isInteger(i) && CAPTURE_WAYS[i] && all.indexOf(i) === at)
  log(factsSaid(plain))

  /*
   * What has GONE, as "byte:hash", so no record is sent twice. The byte is
   * the one the sender says went. A sender that does not say is an older
   * computer app (`old`), which writes the name XORed over whatever byte
   * is packed: from its first answer on, every way's byte IS the XOR, so
   * for a file with no hash the second way is the first over again, and
   * is found already gone.
   */
  const gone = new Set()
  let old = false
  let got = null
  let way = null
  let tries = 0
  let late = false
  for (const i of ways) {
    const w = CAPTURE_WAYS[i]
    const r = namRecord(text, { ...named, hash: w.hash })
    if (!r.ok) continue
    if (gone.has(`${old ? r.xor : r.byte}:${r.hashed}`)) continue
    if (tries > 0) onNext(tries + 1)
    /*
     * Over what is there only on the FIRST try. After a try that read
     * <EMPTY> the slot is empty, and a later one sent "over what is there"
     * would write over a capture the unit had filed late, with the refusal
     * that says so ("already holds", below) never given.
     */
    const over = replace && tries === 0
    let next
    try {
      next = heard(await install(slot, r.words, { replace: over, way: i, second: tries > 0 }))
    } catch (err) {
      /* The slot holds it: the try before was kept, and filed after both looks at the slot. Nothing more was sent. */
      if (tries === 0 && sentBefore === true && heldAlready(err, plain.name)) {
        late = true
        got = { slot, name: plain.name, replaced: null, seconds: 0 }
        log(`KEPT after all: the slot holds it, from the send before this one, which the unit filed after the slot had twice read ${NAM_EMPTY}. Nothing was sent`)
        break
      }
      if (tries > 0 && heldAlready(err, plain.name)) {
        late = true
        got = { ...got, name: plain.name }
        log(`KEPT, way ${way + 1} (${CAPTURE_WAYS[way].said}): the unit filed it after the slot had twice read ${NAM_EMPTY}, and the next try found it there. Nothing more was sent`)
        break
      }
      if (err && typeof err === 'object') err.way = i
      throw err
    }
    tries++
    way = i
    got = next
    /* The byte that went: the sender says (the device's own wire, and a computer app that sends the byte as packed). One that does not say is an older computer app, which put the name XORed in. */
    const told = Number.isInteger(next?.nameByte)
    const went = told ? next.nameByte : r.xor
    if (!told) old = true
    gone.add(`${went}:${r.hashed}`)
    const closing = Number.isFinite(next?.closing) ? `, the closing message answered in ${Math.round(next.closing)} ms` : ''
    const swapped = told ? '' : ` (${hex(r.byte)} was packed, and the computer app did not say which byte went: AN OLDER COMPUTER APP, WHICH PUTS THE NAME XORED IN, and the unit drops most of those. Update the computer app, so that 0x60 goes)`
    const kept = next?.name !== NAM_EMPTY
    log(`try ${tries}, way ${i + 1} (${w.said}): name byte ${hex(went)}${swapped}, ${r.hashed ? 'with' : 'without'} a hash; went in ${Number(next?.seconds ?? 0).toFixed(1)} s${closing}; the unit reads the slot as ${said(next)}${kept && next?.name ? `: KEPT${over ? '' : ` THIS WAY${tries > 1 ? `, after ${tries - 1} it did not keep` : ''}`}` : ''}`)
    if (kept) break
  }
  /* No way could be packed (it cannot happen for a file `plain` took, and is not left to be found out by a crash). */
  if (!got) return { ok: false, why: 'This capture could not be packed to send.' }
  if (got?.name === NAM_EMPTY) log(`NOT KEPT${tries > 1 ? `, any of the ${tries} ways tried` : ''}: the slot still reads ${NAM_EMPTY} after every message was taken`)
  return { ok: true, name: plain.name, got, tries, way, late }
}

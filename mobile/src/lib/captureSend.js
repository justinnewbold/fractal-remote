/*
 * ONE CAPTURE INTO ONE SLOT, AND THE WAYS IT IS TRIED.
 *
 * What the TONE3000 page does between "an empty slot was found" and "the
 * NAM block is pointed at it", kept out of the page so that it can be run
 * whole in a test against a unit that answers as his did. The page's own
 * part is the words on the screen; this is what is sent, in what order, and
 * what is made of the unit's answers.
 *
 * WHY THERE ARE WAYS (14 November 2026). His unit KEPT two captures sent
 * from the app and DROPPED three, every one of the 130 messages answered
 * "taken" each time. The 32nd byte of the name, which the app had been
 * filling with the name XORed (the one byte Axe-Edit was seen to send,
 * 0x60, is that for its name), was 0x7C and 0x78 in the two kept and 0x02,
 * 0x1D, 0x3D and 0x1D in the ones dropped: every byte kept has 0x60's two
 * bits set, and none dropped has. So the likelier reading is that the byte
 * is no check of the name and Axe-Edit sends 0x60 every time. It is not
 * proven, and the other reading (the XOR is right, and the three were
 * dropped for something in the file) fits what was seen too. So a capture
 * the unit takes and does not keep is sent again another way, into the same
 * slot, until one is kept or the ways run out:
 *
 *   1. 0x60 in the name's 32nd place, as Axe-Edit sent, with the file's hash
 *   2. the name XORed there (the way two were kept), with the file's hash
 *   3. 0x60, and no hash (noughts, as Fractal's own captures have)
 *   4. the name XORed, and no hash
 *
 * A way that would send the same record as one already sent is left out (a
 * file with no hash has two ways, a name that XORs to 0x60 one byte). The
 * log says what each way sent and what the unit did with it, with the
 * file's own notes once: one session's log is meant to settle which rule
 * the unit keeps to. THE FILLING OUT OF A SHORT NAME WITH SPACES IS GONE: a
 * short name (Jcm800) was kept as it was, and two filled out were dropped.
 *
 * THROUGH A COMPUTER APP OLDER THAN THE ONE THAT SENDS THE BYTE AS PACKED,
 * the computer writes the name XORed over whatever byte came (ForgeFX
 * namNameChecked, before 64c44a7). Its answer does not say which byte went
 * (`nameByte`), which is how it is known: the 0x60 ways are then the XOR
 * ways over again and are left out, and the log says to update the computer
 * app.
 *
 * AND WHAT AN INDEPENDENT READ OF THE FIRST VERSION FOUND, which still
 * holds: a unit that files a send LATE (the slot reads <EMPTY> at both
 * looks, then holds it) has the next try refused "already holds"; refused
 * because the slot holds THIS capture, that is the try before it kept
 * (`heldAlready`), and nothing more is sent. And a try that stops part-way
 * says which way was going (`err.way`), so sent again it goes that way.
 *
 * PURE: the sender is handed in, with the log and the one line the screen
 * needs. Nothing here knows a wire from a computer.
 */
import { NAM_EMPTY, namRecord } from './nam-install.js'

/** The ways a capture is sent, in the order they are tried. `said` is for the log. */
export const CAPTURE_WAYS = Object.freeze([
  Object.freeze({ check: 'axe', hash: true, said: 'the name byte Axe-Edit sent, with the file’s hash' }),
  Object.freeze({ check: 'xor', hash: true, said: 'the name XORed as its byte, with the file’s hash' }),
  Object.freeze({ check: 'axe', hash: false, said: 'the name byte Axe-Edit sent, no hash' }),
  Object.freeze({ check: 'xor', hash: false, said: 'the name XORed as its byte, no hash' })
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

/**
 * Send one capture's file into `slot`.
 *
 * @param {object} c
 * @param {string} c.text      the .nam file's text
 * @param {object} c.named     what the app knows the capture by (namRecord's `said`)
 * @param {number} c.slot      the slot it goes into
 * @param {boolean} [c.replace] over what is there (only the page's own half-sent slot, and only over the device's own wire)
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
export async function sendCapture({ text, named, slot, replace = false, order = null, install, log = () => {}, onNext = () => {} }) {
  const plain = namRecord(text, named)
  if (!plain.ok) return { ok: false, why: plain.why }
  const said = (got) => `“${got?.name ?? 'nothing it would say'}”`
  const ways = (Array.isArray(order) && order.length ? order : captureOrder()).filter((i, at, all) => Number.isInteger(i) && CAPTURE_WAYS[i] && all.indexOf(i) === at)
  log(factsSaid(plain))

  /*
   * What has GONE, as "byte:hash", so no record is sent twice. The byte is
   * the one the sender says went. A sender that does not say is an older
   * computer app (`old`), which writes the name XORed over whatever byte
   * is packed: from its first answer on, every way's byte IS the XOR, so a
   * 0x60 way is the XOR way over again and is found already gone,
   * whichever of the two was tried first.
   */
  const gone = new Set()
  let old = false
  let got = null
  let way = null
  let tries = 0
  let late = false
  for (const i of ways) {
    const w = CAPTURE_WAYS[i]
    const r = namRecord(text, { ...named, check: w.check, hash: w.hash })
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
    const swapped = told ? '' : ` (${hex(r.byte)} was packed, and the computer app did not say which byte went: AN OLDER COMPUTER APP, WHICH PUTS THE NAME XORED IN. Update the computer app, and the other byte can be tried)`
    const kept = next?.name !== NAM_EMPTY
    log(`try ${tries}, way ${i + 1} (${w.said}): name byte ${hex(went)}${swapped}, ${r.hashed ? 'with' : 'without'} a hash; went in ${Number(next?.seconds ?? 0).toFixed(1)} s${closing}; the unit reads the slot as ${said(next)}${kept && next?.name ? `: KEPT${over ? '' : ` THIS WAY${tries > 1 ? `, after ${tries - 1} it did not keep` : ''}`}` : ''}`)
    if (kept) break
  }
  /* No way could be packed (it cannot happen for a file `plain` took, and is not left to be found out by a crash). */
  if (!got) return { ok: false, why: 'This capture could not be packed to send.' }
  if (got?.name === NAM_EMPTY) log(`NOT KEPT${tries > 1 ? `, any of the ${tries} ways tried` : ''}: the slot still reads ${NAM_EMPTY} after every message was taken`)
  return { ok: true, name: plain.name, got, tries, way, late }
}

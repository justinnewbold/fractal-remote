/*
 * ONE CAPTURE INTO ONE SLOT, AND THE SECOND TRY FOR A SHORT NAME.
 *
 * What the TONE3000 card does between "an empty slot was found" and "NAM 1
 * is pointed at it", taken out of the card so that it can be run whole in a
 * test against a unit that answers as his did. The card's own part is the
 * words on the screen; this is what is sent, in what order, and what is made
 * of the unit's answers.
 *
 * THE SECOND TRY (1.90.61). The name's check byte is proven only for a name
 * that fills all 31 places (lib/nam-install `namCheck`); for a shorter name
 * its place is the same on trust. So a short-named capture goes as it is
 * first, which is what Axe-Edit must send (the unit lists short names with
 * nothing after them), and when the unit takes that and does not keep it,
 * once more into the same slot with the name filled out to 31 places with
 * spaces (`namRecord`'s `fill`): the one shape seen kept. The log says which
 * of the two a unit kept, which settles the rule.
 *
 * AND WHAT AN INDEPENDENT READ OF THAT FOUND (14 November 2026, the day it
 * went out):
 *
 *   - A UNIT THAT FILES THE FIRST SEND LATE. The sender looks at the slot
 *     twice (a third of a second after "it is over", and a second after
 *     that) before it says not kept. Should a unit take longer than that to
 *     file a capture, the second try's own first look finds the slot holding
 *     it and is refused ("already holds"): the card said the capture was not
 *     sent, drew no Play button, and the next tap put a second copy in the
 *     next slot. A second try refused because the slot holds THIS capture is
 *     the first send kept (`heldAlready`), and is said so.
 *   - A SECOND TRY THAT STOPS PART-WAY was sent again from the start, short
 *     name first: half a minute over Bluetooth on a shape just shown not
 *     kept. What was being sent when it stopped goes with the failure
 *     (`err.filled`), so the card's "Send it again to slot N" sends that.
 *   - "FILLED OUT" IN THE WIRE'S LOG was read off the name's last place, so a
 *     long name cut at a space said it too. The sender is told (`filled`).
 *
 * PURE: the sender is handed in, with the log and the one line the screen
 * needs. Nothing here knows a wire from a computer.
 */
import { NAM_EMPTY, NAM_NAME_PLACES, namRecord } from './nam-install.js'

/* A name as the unit says it, without the spaces a filled-out one ends in, whichever copy of the computer app read the slot. */
const heard = (got) => (typeof got?.name === 'string' ? { ...got, name: got.name.replace(/ +$/, '') } : got)

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
 * @param {boolean} [c.replace] over what is there (only the card's own half-sent slot, and only over the device's own wire)
 * @param {boolean} [c.fill]   send the name filled out from the start (a second try that stopped part-way, sent again)
 * @param {(slot: number, words: number[], how: { replace: boolean, filled: boolean, second: boolean }) => Promise<object>} c.install
 * @param {(line: string) => void} [c.log]
 * @param {() => void} [c.onSecond] the second try is about to go
 *
 * @returns `{ ok: false, why }` for a file that is no capture, else
 *   `{ ok: true, name, got, twice, late }`: `name` as the app calls it, `got`
 *   the sender's last answer (its `name` what the slot reads as now, or
 *   "<EMPTY>" for one not kept), `twice` when the second try was sent, `late`
 *   when the first send turned out to have been kept after all. A send that
 *   fails throws the sender's own failure, with `filled` added: whether the
 *   record that was going had its name filled out.
 */
export async function sendCapture({ text, named, slot, replace = false, fill = false, install, log = () => {}, onSecond = () => {} }) {
  const rec = namRecord(text, fill ? { ...named, fill: true } : named)
  if (!rec.ok) return { ok: false, why: rec.why }
  const said = (got) => `“${got?.name ?? 'nothing it would say'}”`
  const goes = async (r, second) => {
    const filled = r.filled === true
    try {
      return heard(await install(slot, r.words, { replace, filled, second }))
    } catch (err) {
      if (err && typeof err === 'object') err.filled = filled
      throw err
    }
  }

  let got = await goes(rec, false)
  log(`the capture${rec.filled ? ', its name filled out,' : ''} went in ${Number(got?.seconds ?? 0).toFixed(1)} s; the unit reads the slot as ${said(got)}`)
  let twice = false
  let late = false
  if (got?.name === NAM_EMPTY && !rec.filled && rec.name.length < NAM_NAME_PLACES) {
    const full = namRecord(text, { ...named, fill: true })
    if (full.ok && full.filled) {
      twice = true
      log(`NOT KEPT with its name as it is (${rec.name.length} characters): sending it once more with the name filled out to ${NAM_NAME_PLACES} places`)
      onSecond()
      try {
        const next = await goes(full, true)
        /* Over what was there (the card's own half-sent slot) the second send writes whatever the first left, so it cannot say which of the two a unit keeps. */
        const settles = next?.name && next.name !== NAM_EMPTY ? (replace ? ': kept on the second send' : ': KEPT WITH THE NAME FILLED OUT, not as it was') : ''
        log(`the capture, its name filled out, went in ${Number(next?.seconds ?? 0).toFixed(1)} s; the unit reads the slot as ${said(next)}${settles}`)
        got = next
      } catch (err) {
        if (!heldAlready(err, rec.name)) throw err
        /* The slot holds it: the first send was kept, and filed after both looks at the slot. Nothing more was sent. */
        twice = false
        late = true
        got = { ...got, name: rec.name }
        log(`KEPT AS IT WAS: the unit filed the first send after the slot had twice read ${NAM_EMPTY}, and the second try found it there. Nothing more was sent`)
      }
    }
  }
  if (got?.name === NAM_EMPTY) log(`NOT KEPT${twice ? ', either way' : ''}: the slot still reads ${NAM_EMPTY} after every message was taken`)
  return { ok: true, name: rec.name, got, twice, late }
}

/**
 * THE BLOCK READER: a gen-3 unit asked to describe one block's settings.
 *
 * "Yes build the NAM reader now." (Justin, 12 November 2026, the day his
 * Axe-Fx III came, "AX3" in his words.) Firmware 33's NAM block is on Play
 * over Bluetooth by a customer's log and has no knobs in Edit, because no
 * catalog the app carries names what is inside it. The unit will say, if it
 * is asked the way its own editor asks (function 0x01 with a view), and
 * mobile/src/lib/gen3-describe.js is that question for ONE block, a port of
 * the computer codec's walk (forgefx-midi src/cache/liveWalk.ts at the
 * commit desktop/forgefx.lock.json pins).
 *
 * What is held here:
 *
 *   - THE BYTES ARE THE CODEC'S. The questions and the reading of the
 *     answers, against frames made by forgefx-midi itself at the pinned
 *     commit (and, when this was written, against 400 more made at random).
 *   - IT ONLY ASKS. One way out (describeAllowed): a definition, a value, a
 *     label, at a block and a setting from 0 to 127, and nothing else in
 *     the frame. Never a knob, never a typed write.
 *   - IT ASKS LESS THAN THE COMPUTER'S WALK. A label only of a setting that
 *     is plainly a list (the walk also tries ones that might be; a label
 *     asked of a setting with no list is what froze an FM3), at most
 *     LABELS_MOST of them, a pause before every question, a block left at
 *     its first four empty places, and a stop at the second question in a
 *     row with no answer.
 *
 * The wire's half (the route, whose account it answers, the one read of
 * Edit's shape it may send) is in test/bluetooth.mjs, beside the NAM
 * block's own tests.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')
const code = (src) => src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ')
const lib = () => import('../mobile/src/lib/gen3-describe.js')
const sysex = () => import('../mobile/src/lib/fractal-sysex.mjs')

const fromHex = (h) => h.split(' ').map((x) => parseInt(x, 16))
const AX3 = 0x10

/* forgefx-midi at the pinned commit: buildDefQuery(0x10, 206, 0), buildEnumQuery(0x10, 207, 5, 130), buildDefQuery(0x11, 37, 127). */
const Q_DEF_206 = 'F0 00 01 74 10 01 1C 00 4E 01 00 00 00 00 00 00 00 00 00 00 00 47 F7'
const Q_LABEL_207 = 'F0 00 01 74 10 01 1F 00 4F 01 05 00 02 01 00 00 00 00 00 00 00 43 F7'
const Q_DEF_FM3 = 'F0 00 01 74 11 01 1C 00 25 00 7F 00 00 00 00 00 00 00 00 00 00 53 F7'
/* Answers framed as its own test frames them, and what its decodeReply makes of each. */
const R_DEF = 'F0 00 01 74 10 01 1C 00 01 01 04 00 3A 00 00 00 00 00 00 24 00 69 01 00 00 00 40 00 00 00 00 00 00 00 00 00 00 10 10 20 00 04 00 7E 00 00 28 08 06 78 4A 06 3A 00 00 00 00 00 00 00 00 00 00 48 F7'
const R_VALUE = 'F0 00 01 74 10 01 00 00 01 01 04 00 00 00 00 00 00 00 00 07 00 16 4C 65 63 01 01 48 42 41 F7'
const R_LABEL = 'F0 00 01 74 10 01 1F 00 01 01 07 00 3A 00 00 00 00 00 00 0E 00 26 56 24 04 1A 05 20 54 2A 54 48 52 01 40 62 00 44 F7'

/** A pretend block for describeBlock's `ask`: what is at each setting, and a record of every question. */
async function pretend(settings, { silentFrom, refuseAt } = {}) {
  const d = await lib()
  const sx = await sysex()
  const asked = []
  const pauses = []
  const septets = (raw) => {
    const wire = []
    let acc = 0
    let bits = 0
    for (const byte of raw) {
      acc = (acc << 8) | byte
      bits += 8
      while (bits >= 7) {
        bits -= 7
        wire.push((acc >> bits) & 0x7f)
        acc &= (1 << bits) - 1
      }
    }
    if (bits > 0) wire.push((acc << (7 - bits)) & 0x7f)
    return wire
  }
  const answer = (q, raw) => {
    const inner = new Array(15).fill(0)
    inner[0] = q[6]
    inner[2] = 1
    inner[3] = q[9]
    inner[4] = q[10]
    inner[5] = q[11]
    inner[6] = raw.length ? 0x3a : 0x40
    inner[13] = raw.length & 0xff
    inner[14] = raw.length >> 8
    return sx.frame(q[4], 0x01, [...inner, ...septets(raw)])
  }
  const ask = async (q) => {
    assert.ok(d.describeAllowed(q, q[4]), `the walk put out something that is not one of its questions: ${sx.toHex(q)}`)
    const view = q[6]
    const param = q[10] | (q[11] << 7)
    const which = q[12] | (q[13] << 7)
    asked.push({ view, param, which })
    if (refuseAt !== undefined && asked.length === refuseAt) return { refused: 'no such block' }
    if (silentFrom !== undefined && asked.length >= silentFrom) return null
    const s = settings[param]
    if (view === d.VIEW.definition) {
      const buf = new DataView(new ArrayBuffer(36))
      if (s) {
        buf.setUint32(0, 900 + param, true)
        buf.setUint32(4, s.tc ?? 16, true)
        ;[s.min, s.max, s.scale ?? 0, s.def ?? s.min, s.step ?? 0].forEach((x, i) => buf.setFloat32(8 + 4 * i, x, true))
      }
      return answer(q, [...new Uint8Array(buf.buffer)])
    }
    if (s && view === d.VIEW.value && s.valueBytes) return answer(q, s.valueBytes)
    if (s && view === d.VIEW.label && s.labelBytes) return answer(q, s.labelBytes[which - Math.round(s.min)] ?? [])
    const text = !s ? undefined : view === d.VIEW.value ? s.value : (s.labels || [])[which - Math.round(s.min)]
    return answer(q, text === undefined ? [] : [...text].map((c) => c.charCodeAt(0)))
  }
  const pause = async (ms) => {
    pauses.push(ms)
  }
  return { d, sx, ask, pause, asked, pauses }
}

export function run(test) {
  test('the block reader’s questions are the codec’s, byte for byte, and its answers are read as the codec reads them', async () => {
    const d = await lib()
    const { toHex } = await sysex()
    assert.equal(toHex(d.describeQuery(AX3, d.VIEW.definition, 206, 0)), Q_DEF_206, 'a definition question is not forgefx-midi’s buildDefQuery')
    assert.equal(toHex(d.describeQuery(AX3, d.VIEW.label, 207, 5, 130)), Q_LABEL_207, 'a label question is not forgefx-midi’s buildEnumQuery: the block past 127 or the label past 127 is packed another way')
    assert.equal(toHex(d.describeQuery(0x11, d.VIEW.definition, 37, 127)), Q_DEF_FM3)
    const def = d.decodeDescribe(fromHex(R_DEF))
    assert.deepEqual({ ...def, step: Math.round(def.step * 1e6) / 1e6 }, { view: 'definition', wireId: 1234, tc: 16, min: 0, max: 10, scale: 1, def: 5, step: 0.001 })
    assert.deepEqual(d.decodeDescribe(fromHex(R_VALUE)), { view: 'value', text: '-3.0 dB' })
    assert.deepEqual(d.decodeDescribe(fromHex(R_LABEL)), { view: 'label', text: 'MY CAPTURE 01' })
    /* An answer with nothing in it, and the unit's two "not there" marks, are nothing. */
    const empty = fromHex(R_VALUE)
    empty[12] = 0x03
    assert.equal(d.decodeDescribe(empty), null)
    assert.equal(d.decodeDescribe(fromHex(Q_DEF_206)), null, 'a question was read as an answer')
    /* Which answer is whose: the view, the block’s high half, both halves of the setting. Not the block’s low half, which the unit does not send back. */
    const echo = d.describeEcho(fromHex(Q_LABEL_207))
    assert.equal(echo(fromHex(R_LABEL)), false, 'an answer about another setting was taken for this one')
    const mine = fromHex(R_LABEL)
    mine[10] = 0x05
    assert.equal(echo(mine), true)
    assert.equal(d.describeEcho(fromHex(Q_DEF_206))(fromHex(R_LABEL)), false, 'a label was taken for a definition')
  })

  test('the block reader only asks: one way out, the three questions at a block and a setting from 0 to 127, and never a write', async () => {
    const d = await lib()
    const sx = await sysex()
    const ok = (f, model = AX3) => d.describeAllowed(f, model)
    for (const q of [d.describeQuery(AX3, d.VIEW.definition, 206, 0), d.describeQuery(AX3, d.VIEW.value, 207, 127), d.describeQuery(AX3, d.VIEW.label, 201, 9, 300)]) {
      assert.ok(ok(q), `one of its own questions is refused: ${sx.toHex(q)}`)
      assert.equal(ok(q, 0x11), null, 'a question for one unit goes to another')
      /* Any one byte of it changed, the checksum put right: still one of the three questions, or it does not go. */
      for (let i = 6; i <= 20; i++) {
        for (let v = 0; v < 0x80; v++) {
          if (v === q[i]) continue
          const f = [...q]
          f[i] = v
          f[21] = sx.checksum(f, 21)
          const said = ok(f)
          if (!said) continue
          const view = f[6]
          const param = f[10] | (f[11] << 7)
          const which = f[12] | (f[13] << 7)
          const block = f[8] | (f[9] << 7)
          assert.ok([0x1c, 0x1f, 0x00].includes(view) && f[7] === 0 && block >= 1 && param <= 127 && (which === 0 || view === 0x1f) && f.slice(14, 21).every((x) => x === 0), `let out: ${sx.toHex(f)}`)
        }
      }
      const spoiled = [...q]
      spoiled[21] ^= 1
      assert.equal(ok(spoiled), null, 'a frame whose checksum does not hold goes')
      assert.equal(ok(q.slice(0, -1)), null)
    }
    /* Edit's two writes, at the same block: never the reader's. */
    const { buildKnob, buildTyped, buildReadAll } = await import('../mobile/src/lib/gen3-edit.js')
    assert.equal(ok(buildKnob(AX3, 206, 1, 0.5)), null, 'a knob write passes as one of the reader’s questions')
    assert.equal(ok(buildTyped(AX3, 206, 1, 3)), null, 'a typed write passes as one of the reader’s questions')
    assert.equal(ok(buildReadAll(AX3, 206)), null)
    /* And it cannot be made to build anything else. */
    assert.throws(() => d.describeQuery(AX3, 0x52, 206, 0), /not one of the reader/)
    assert.throws(() => d.describeQuery(AX3, 0x09, 206, 0), /not one of the reader/)
    assert.throws(() => d.describeQuery(AX3, d.VIEW.definition, 206, 128), /past what the reader asks/)
    assert.throws(() => d.describeQuery(AX3, d.VIEW.definition, 0, 0), /not one a unit is asked about/)
    assert.throws(() => d.describeQuery(AX3, d.VIEW.value, 206, 0, 1), /not one the reader asks for/)
    /* The file itself: no write is spelled in it, and it reaches the unit only through what it is handed. */
    const src = code(read('mobile/src/lib/gen3-describe.js'))
    assert.doesNotMatch(src, /0x52|0x09|buildKnob|buildTyped|buildEditFrame|buildSet/, 'lib/gen3-describe.js spells a write')
    assert.deepEqual([...src.matchAll(/^import [^\n]* from '([^']+)'/gm)].map((m) => m[1]), ['./fractal-sysex.mjs'], 'lib/gen3-describe.js imports more than the frame helpers')
  })

  test('the block reader walks one block as the codec walks it, and asks less: labels only of a plain list, a pause before every question', async () => {
    const settings = []
    settings[0] = { min: 0, max: 10, scale: 1, step: 0.001, value: '6.20' }
    settings[1] = { min: -80, max: 20, scale: 1, step: 0.1, value: '-3.0 dB' }
    /* A list, plainly: step 0, scale 0, whole ends. Its labels are at its own values, 2 to 4. */
    settings[2] = { min: 2, max: 4, value: 'STANDARD', labels: ['LEAN', 'STANDARD', 'FULL'] }
    /* Whole-number ends and a scale: a knob in whole steps. The computer’s walk tries a label here; the reader never does. */
    settings[5] = { min: 0, max: 100, scale: 1, step: 1, value: '50' }
    /* Whole-number ends, no scale, a step: might be a list. The walk tries it; the reader does not. */
    settings[6] = { min: 0, max: 3, scale: 0, step: 1, value: '2' }
    const t = await pretend(settings)
    const steps = []
    const out = await t.d.describeBlock({ ask: t.ask, pause: t.pause, model: AX3, block: 206, onStep: (s) => steps.push(s.settings) })
    assert.equal(out.stopped, null)
    assert.deepEqual(out.settings.map((s) => s.id), [0, 1, 2, 5, 6], 'a setting after a gap was missed, or an empty place was taken for one')
    assert.deepEqual(out.settings.map((s) => s.value), ['6.20', '-3.0 dB', 'STANDARD', '50', '2'])
    assert.deepEqual(out.settings.map((s) => s.list), [false, false, true, false, false])
    assert.deepEqual(out.settings[2].labels, ['LEAN', 'STANDARD', 'FULL'])
    assert.deepEqual(out.settings[1], { id: 1, wireId: 901, tc: 16, min: -80, max: 20, def: -80, step: Math.fround(0.1), scale: 1, list: false, value: '-3.0 dB', labels: [], more: false })
    /* Every setting from 0 to 127 was asked for its definition, once, in order, and none past it. */
    assert.deepEqual(t.asked.filter((a) => a.view === t.d.VIEW.definition).map((a) => a.param), Array.from({ length: 128 }, (_, i) => i))
    /* Labels: only of setting 2, at its own values, and no further than its last. */
    assert.deepEqual(t.asked.filter((a) => a.view === t.d.VIEW.label), [2, 3, 4].map((which) => ({ view: t.d.VIEW.label, param: 2, which })), 'a label was asked of a setting that is not plainly a list, or past the end of one')
    assert.equal(out.asked, t.asked.length)
    assert.equal(out.asked, 128 + 5 + 3)
    /* A pause before every question, never none. */
    assert.equal(t.pauses.length, t.asked.length)
    assert.ok(t.pauses.every((ms) => ms === t.d.PACE_MS) && t.d.PACE_MS >= 3, 'a question went with no pause before it: flooding is what froze the FM3')
    assert.deepEqual(steps, [1, 2, 3, 4, 5])

    /* A long list is read to LABELS_MOST and said to go on. */
    const long = []
    long[0] = { min: 0, max: 999, value: 'CAPTURE 000', labels: Array.from({ length: 1000 }, (_, i) => `CAPTURE ${String(i).padStart(3, '0')}`) }
    const l = await pretend(long)
    const big = await l.d.describeBlock({ ask: l.ask, pause: l.pause, model: AX3, block: 206 })
    assert.equal(big.settings[0].labels.length, l.d.LABELS_MOST)
    assert.equal(big.settings[0].more, true)
    assert.equal(l.asked.filter((a) => a.view === l.d.VIEW.label).length, l.d.LABELS_MOST)

    /*
     * A value the unit answers with something that is not plain text is
     * kept as it came, never a bare "?": his Axe-Fx III answered every
     * value that has a unit with something the reader could not read, and
     * a "?" said nothing about how. (Those turned out to be text, a NUL and
     * old bytes after it, which is read now: the next test. This one is a
     * number's own four bytes, which is still not text.)
     * One it does not answer at all says so.
     */
    const odd = []
    odd[0] = { min: -80, max: 20, scale: 0, step: 0.05, valueBytes: [0x9a, 0x99, 0x19, 0x3e, 0x00, 0x64, 0x42] }
    odd[1] = { min: 0, max: 10, scale: 1, step: 0.01, value: '5.00' }
    const o = await pretend(odd)
    let nth = 0
    const strange = await o.d.describeBlock({ ask: async (f) => (++nth === 4 ? null : o.ask(f)), pause: o.pause, model: AX3, block: 206 })
    assert.equal(strange.settings[0].value, null)
    assert.equal(strange.settings[0].raw, 'tag 3A, 7 bytes: 9A 99 19 3E 00 64 42')
    assert.deepEqual([strange.settings[1].value, strange.settings[1].silent], [null, true])
    const oddText = o.d.describeText({ ...strange, name: 'NAM 1' })
    assert.match(oddText, /now \? \(tag 3A, 7 bytes: 9A 99 19 3E 00 64 42\)$/m)
    assert.match(oddText, /now \? \(no answer\)$/m)

    /* What it is as text: a line a setting, the list’s names, and the whole read’s numbers. */
    const text = t.d.describeText({ ...out, name: 'NAM 1', bulk: { count: 8, values: [1, 2, 3, 4, 5, 6, 7, 8] } })
    assert.match(text, /^NAM 1 \(effect 206\): 5 settings, 136 questions$/m)
    assert.match(text, /^ {4}1 {2}tc 16 {2}-80\.\.20 def -80 step 0\.1 scale 1 {2}now "-3\.0 dB"$/m)
    assert.match(text, /^ {4}2 .* now "STANDARD" \[LEAN \| STANDARD \| FULL\]$/m)
    assert.match(text, /^ {2}whole read: count 8, 8 values\n {2}1 2 3 4 5 6 7 8$/m)
    assert.match(t.d.describeText({ ...big, name: 'NAM 1', bulk: { note: 'no answer' } }), /\| …\]\n {2}whole read: no answer$/)
  })

  test('the block reader reads a value’s text up to its first NUL, as his Axe-Fx III sends it: a C string in a buffer with old bytes after it', async () => {
    /*
     * WHAT HIS AX3 ANSWERED (13 November 2026, NAM 1, app 1.90.45), the
     * bytes of five value answers once the seven-bit bytes are put back
     * together. Each is a 32-byte buffer: the text, a NUL, and whatever an
     * earlier answer left behind it. The first four are on record only as
     * far as they are written here; the rest of each buffer is stood in
     * with noughts. The capture's name is all 32.
     */
    const H = (h) => h.split(' ').map((x) => parseInt(x, 16))
    const buffer = (h) => {
      const b = H(h)
      while (b.length < 32) b.push(0)
      return b
    }
    const HIS = [
      ['Level', buffer('30 2E 30 20 64 42 00 25 00 42 6C 6F 00'), '0.0 dB'],
      ['Input Gain', buffer('30 2E 30 30 20 64 42 00 00 48 7A 00'), '0.00 dB'],
      ['Bright Cap', buffer('34 37 30 2E 30 20 70 46 00 00 6D 6D 00'), '470.0 pF'],
      /* The "+R" after the NUL is left over from "SUM L+R", which it said before he changed it. */
      ['Input Mode', buffer('4C 45 46 54 00 2B 52 00'), 'LEFT'],
      ['Type', H('4D 56 32 35 20 43 68 31 20 43 72 75 6E 63 68 00 42 41 4C 32 00 47 61 69 6E 20 36 2C 20 41 4B 00'), 'MV25 Ch1 Crunch']
    ]
    const settings = HIS.map(([, bytes]) => ({ min: 0, max: 1, scale: 1, step: 0.01, valueBytes: bytes }))
    const t = await pretend(settings)
    for (const [i, [name, bytes, text]] of HIS.entries()) {
      assert.equal(bytes.length, 32, name)
      const back = await t.ask(t.d.describeQuery(AX3, t.d.VIEW.value, 206, i))
      assert.deepEqual(t.d.decodeDescribe(back), { view: 'value', text }, `${name} is not read as the unit wrote it`)
      /*
       * A DELIBERATE DIFFERENCE FROM THE PINNED CODEC, whose decodeReply
       * drops the noughts off the end and then wants every byte left to be
       * printable: by that rule each of these has a NUL in the middle of
       * what is left (or, for the capture's name, old text after one), and
       * is nothing. That is why every one read "?".
       */
      let end = bytes.length
      while (end > 0 && bytes[end - 1] === 0) end -= 1
      assert.ok(bytes.slice(0, end).includes(0), `${name}: the codec’s own rule would have read this one`)
    }
    /* And through the walk: the five values as text, none of them kept as bytes. */
    const out = await t.d.describeBlock({ ask: t.ask, pause: t.pause, model: AX3, block: 206 })
    assert.deepEqual(out.settings.map((s) => [s.value, s.raw]), HIS.map(([, , text]) => [text, undefined]))
    assert.match(t.d.describeText({ ...out, name: 'NAM 1' }), /now "470\.0 pF"$/m)

    /* A label is a C string too: its text, a NUL, the last one's tail. */
    const list = []
    list[0] = { min: 0, max: 2, value: 'POST', labelBytes: [H('50 52 45 00 54 00 00 00'), H('50 4F 53 54 00 00 00 00'), H('4F 46 46 00 54 00 00 00')] }
    const l = await pretend(list)
    const walked = await l.d.describeBlock({ ask: l.ask, pause: l.pause, model: AX3, block: 206 })
    assert.deepEqual(walked.settings[0].labels, ['PRE', 'POST', 'OFF'])

    /*
     * EVERYTHING ELSE IS AS IT WAS. Text with no NUL, or with only noughts
     * after it, reads as the codec reads it (the first test holds the
     * codec's own frames). A NUL first, nothing at all, or a byte that is
     * not a letter before any NUL, is still not text; and a definition is
     * not looked at this way at all.
     */
    const one = async (bytes, view = t.d.VIEW.value) => {
      const p = await pretend([view === t.d.VIEW.value ? { min: 0, max: 1, scale: 1, step: 0.01, valueBytes: bytes } : { min: 0, max: 0, labelBytes: [bytes] }])
      return p.d.decodeDescribe(await p.ask(p.d.describeQuery(AX3, view, 206, 0)))
    }
    assert.deepEqual(await one(H('35 2E 30 30')), { view: 'value', text: '5.00' })
    assert.deepEqual(await one(H('35 2E 30 30 00 00 00 00')), { view: 'value', text: '5.00' })
    assert.deepEqual(await one(H('35 2E 30 30 00 FF 01 00')), { view: 'value', text: '5.00' }, 'old bytes after the NUL that are not letters spoiled the text')
    assert.equal(await one(H('00 35 2E 30 30 00')), null, 'a buffer that starts with a NUL was read as text')
    assert.equal(await one(H('00 00 00 00')), null)
    assert.equal(await one(H('35 01 30 00')), null, 'a byte that is not a letter, before the NUL, was read as text')
    assert.equal(await one(H('35 2E FF')), null)
    assert.deepEqual(await one(H('4C 45 46 54 00 2B 52 00'), t.d.VIEW.label), { view: 'label', text: 'LEFT' })
    const def = t.d.decodeDescribe(fromHex(R_DEF))
    assert.deepEqual([def.view, def.wireId, def.tc, def.min, def.max], ['definition', 1234, 16, 0, 10])
    assert.match(code(read('mobile/src/lib/gen3-describe.js')), /const nul = raw\.indexOf\(0\)\s+const end = nul < 0 \? raw\.length : nul\s+if \(!end\) return null/)
  })

  test('the block reader stops rather than asks on: nothing at a block’s first places, two questions unanswered, or a refusal, and keeps what it read', async () => {
    /* Not a block at all: its first four places are empty, and it is left. */
    const none = await pretend([])
    const empty = await none.d.describeBlock({ ask: none.ask, pause: none.pause, model: AX3, block: 201 })
    assert.equal(empty.stopped, 'nothing at its first settings')
    assert.equal(empty.asked, none.d.PROBE_DEPTH)
    assert.deepEqual(empty.settings, [])

    /* What something that is not a block answers with: numbers too small to be numbers, a type code past any. Never a setting, never asked for a label. */
    const d = none.d
    assert.equal(d.junkDef({ tc: 16, min: 3e-41, max: 1, def: 0, step: 0, scale: 0 }), true)
    assert.equal(d.junkDef({ tc: 70000, min: 0, max: 1, def: 0, step: 0, scale: 0 }), true)
    assert.equal(d.junkDef({ tc: 16, min: 0, max: 10, def: 5, step: 0.001, scale: 1 }), false)
    assert.equal(d.emptyDef({ wireId: 0, tc: 0, min: 0, max: 0, def: 0, step: 0 }), true)
    assert.equal(d.plainList({ min: 0, max: 3, step: 0, scale: 0 }), true)
    for (const not of [{ min: 0, max: 3, step: 1, scale: 0 }, { min: 0, max: 3, step: 0, scale: 1 }, { min: 0.5, max: 3, step: 0, scale: 0 }, { min: -1, max: 3, step: 0, scale: 0 }, { min: 3e-41, max: 3, step: 0, scale: 0 }]) {
      assert.equal(d.plainList(not), false, `taken for a list, and would be asked for labels: ${JSON.stringify(not)}`)
    }

    const settings = Array.from({ length: 20 }, (_, i) => ({ min: 0, max: 10, scale: 1, step: 0.01, value: `${i}.00` }))
    /* The unit goes quiet at the seventh question: the eighth is asked, and no ninth. */
    const quiet = await pretend(settings, { silentFrom: 7 })
    const q = await quiet.d.describeBlock({ ask: quiet.ask, pause: quiet.pause, model: AX3, block: 206 })
    assert.equal(q.stopped, 'the unit stopped answering')
    assert.equal(quiet.asked.length, 6 + quiet.d.SILENT_MOST, 'it went on asking a unit that had stopped answering')
    assert.deepEqual(q.settings.map((s) => s.value), ['0.00', '1.00', '2.00'], 'what was read before it stopped was thrown away')

    /* One unanswered is not two: the walk goes on, and the count starts again. */
    let n = 0
    const once = await pretend(settings)
    const flaky = await once.d.describeBlock({ ask: async (f) => (++n === 4 ? null : once.ask(f)), pause: once.pause, model: AX3, block: 206 })
    assert.equal(flaky.stopped, null)
    assert.equal(flaky.settings.length, 20)

    /* A refusal ends it at once. */
    const no = await pretend(settings, { refuseAt: 3 })
    const r = await no.d.describeBlock({ ask: no.ask, pause: no.pause, model: AX3, block: 206 })
    assert.equal(r.stopped, 'the unit refused a question (no such block)')
    assert.equal(no.asked.length, 3)
    assert.equal(r.settings.length, 1)
  })

  test('the block reader is on a page only his account has, and asks the wire as the reader and nothing else', () => {
    const settings = code(read('mobile/src/screens/Settings.js'))
    /* Drawn once, on the Testing page, which opens from the Developer rows his account alone is shown. */
    assert.equal((settings.match(/<BlockReader\b/g) || []).length, 1)
    const testing = settings.slice(settings.indexOf("head('Testing', 'back')"), settings.indexOf("page === 'footswitches'"))
    assert.match(testing, /<BlockReader \/>/, 'the block reader is not on the Developer’s Testing page')
    const group = settings.slice(settings.indexOf('{isAdmin(account?.id) ? ('), settings.indexOf('<Group title="Play screen"'))
    assert.match(group, /setPage\('testing'\)/, 'the Testing page is opened from somewhere other than his account’s Developer rows')
    assert.equal((settings.match(/setPage\('testing'\)/g) || []).length, 1)
    /* The wire answers it for his account alone: the same word that gives his account every unit. */
    assert.match(code(read('mobile/src/lib/bluetooth.js')), /reader: \(\) => allUnits === true/)
    /* And only a request that says it is the reader’s. */
    const device = code(read('mobile/src/lib/device.js'))
    assert.match(device, /const READING = Object\.freeze\(\{ reading: true \}\)/)
    assert.equal((device.match(/\bREADING\b/g) || []).length, 2, 'something other than the reader asks as the reader')
    assert.match(device, /const ble = demoDevice\(\) \|\| onVp4 \? null : bluetoothWire\(\)/, 'the reader is offered in the demo or to a VP4')
    const page = code(read('mobile/src/components/BlockReader.js'))
    assert.match(page, /READER_UNITS = Object\.freeze\(\['fm3', 'fm9', 'axefx3'\]\)/)
    assert.doesNotMatch(page, /setParam|setType|setBypass|setChannel|\bput\(|\bpost\(/, 'the reader’s page can change something on the unit')
  })
}

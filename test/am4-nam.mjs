/**
 * AN AM4'S NAM CAPTURES (mobile/src/lib/am4-nam.js), held to what AM4-Edit
 * sent his AM4 on 18 November 2026 (docs/am4-nam.md).
 *
 * The frames below are the recording's own, copied out by hand: the ones
 * that carry no capture (the questions, the two "under way" writes, the
 * opening of an upload, an empty slot's answer). The recording itself, and
 * the capture in it, are not in the repository.
 */
import assert from 'node:assert/strict'

const H = (s) => s.trim().split(/\s+/).map((x) => parseInt(x, 16))
const lib = () => import('../mobile/src/lib/am4-nam.js')
const sysex = () => import('../mobile/src/lib/fractal-sysex.mjs')
const iii = () => import('../mobile/src/lib/nam-install.js')

const BUSY_ON = H('F0 00 01 74 15 01 01 00 5C 00 01 00 00 00 04 00 00 00 10 03 78 22 F7')
const BUSY_OFF = H('F0 00 01 74 15 01 01 00 5C 00 01 00 00 00 04 00 00 00 00 00 00 49 F7')
const BUSY_ANSWER = H(`F0 00 01 74 15 01 01 00 5C 00 01 00 00 00 28 00 00 00 10 03 78 ${'00 '.repeat(40)}0E F7`)
const ASKS = {
  0: H('F0 00 01 74 15 01 00 00 00 00 45 00 00 00 04 00 00 00 00 00 00 50 F7'),
  1: H('F0 00 01 74 15 01 00 00 00 00 45 00 00 00 04 00 00 40 00 00 00 10 F7'),
  2: H('F0 00 01 74 15 01 00 00 00 00 45 00 00 00 04 00 01 00 00 00 00 51 F7'),
  128: H('F0 00 01 74 15 01 00 00 00 00 45 00 00 00 04 00 40 00 00 00 00 10 F7')
}
const EMPTY_ANSWER = H(`F0 00 01 74 15 01 00 00 00 00 45 00 00 00 10 02 1E 11 29 55 02 51 32 3E ${'00 '.repeat(303)}6A F7`)
const BEGIN = H('F0 00 01 74 15 54 00 01 00 00 00 01 44 F7')
const PICK = H('F0 00 01 74 15 01 52 01 0A 00 01 00 00 00 04 00 00 00 10 03 78 26 F7')
const PICK_READ = H('F0 00 01 74 15 01 51 01 0A 00 0D 00 00 00 00 00 46 F7')

/* An answer as the AM4 makes one: the head, then bytes packed eight into seven, high bit first. */
const packMsb = (raw) => {
  const out = []
  let acc = 0
  let bits = 0
  for (const x of raw) {
    acc = (acc << 8) | x
    bits += 8
    while (bits >= 7) {
      out.push((acc >>> (bits - 7)) & 0x7f)
      bits -= 7
    }
    acc &= (1 << bits) - 1
  }
  if (bits) out.push((acc << (7 - bits)) & 0x7f)
  return out
}

export function run(test) {
  test('the AM4’s capture messages are AM4-Edit’s own, byte for byte', async () => {
    const a = await lib()
    assert.deepEqual(a.am4NamBusyFrame(true), BUSY_ON)
    assert.deepEqual(a.am4NamBusyFrame(false), BUSY_OFF)
    assert.equal(a.am4NamBusyAnswer(BUSY_ANSWER), true)
    assert.equal(a.am4NamBusyAnswer(BUSY_ON), false, 'the write’s own bytes coming back were taken for the answer')
    for (const [slot, frame] of Object.entries(ASKS)) assert.deepEqual(a.am4NamSlotQuery(Number(slot)), frame, `slot ${slot}`)
    assert.equal(a.am4NamSlotQuery(129), null)
    assert.equal(a.am4NamSlotQuery(-1), null)
    assert.deepEqual(a.am4NamPickFrame(0xd2, 1), PICK)
    assert.deepEqual(a.am4NamPickRead(0xd1), PICK_READ)
    assert.equal(a.am4NamPickFrame(0x3a, 1), null, 'an amp was pointed at a capture')
    assert.equal(a.am4NamPickFrame(0xd1, 129), null)
    assert.deepEqual(a.AM4_NAM_BLOCKS, [0xd1, 0xd2])
    /* The upload is the Axe-Fx III's at the AM4's model byte: its opening message, for slot 1, is the one AM4-Edit sent. */
    const { namUploadFrames, NAM_RECORD_WORDS } = await iii()
    const frames = namUploadFrames(0x15, 1, new Array(NAM_RECORD_WORDS).fill(0))
    assert.equal(frames.length, 130)
    assert.deepEqual(frames[0], BEGIN)
    assert.equal(frames[1].length, 650)
  })

  test('a slot’s head and a block’s capture are read out of the AM4’s answers, and nothing else is taken for one', async () => {
    const a = await lib()
    const sx = await sysex()
    const empty = a.readAm4NamSlot(EMPTY_ANSWER)
    assert.equal(empty.name, '<EMPTY>')
    assert.equal(empty.empty, true)
    assert.equal(a.readAm4NamSlot(ASKS[2]), null, 'the question’s own bytes were read as an answer')
    assert.equal(a.readAm4NamSlot([...EMPTY_ANSWER.slice(0, -2), 0x00, 0xf7]), null, 'a damaged answer was read')
    /* A head with a capture in it, made the way the AM4 packs one. */
    const raw = new Array(272).fill(0)
    ;[...'Test Capture'].forEach((c, i) => (raw[i] = c.charCodeAt(0)))
    ;[...'somebody'].forEach((c, i) => (raw[32 + i] = c.charCodeAt(0)))
    const body = [0x01, 0, 0, 0, 0, AM4_LIST, 0, 0, 0, 0x10, 0x02, ...packMsb(raw)]
    const full = sx.frame(0x15, 0x01, body.slice(1))
    const head = a.readAm4NamSlot(full)
    assert.equal(head.name, 'Test Capture')
    assert.equal(head.by, 'somebody')
    assert.equal(head.empty, false)
    /* A block's capture: the slot as a number, four bytes more, then the name. */
    const said = [3, 0, 0x80, 0x3f, 0, 0, 0, 0x3c, ...[...'Test Capture'].map((c) => c.charCodeAt(0))]
    while (said.length < 40) said.push(0)
    for (const action of [0x01, 0x0d]) {
      const f = sx.frame(0x15, 0x01, [0x52, 0x01, 0x0a, 0x00, action, 0x00, 0x00, 0x00, 0x28, 0x00, ...packMsb(said)])
      assert.equal(f.length, 64)
      assert.deepEqual(a.readAm4NamPick(f, 0xd2), { slot: 3, name: 'Test Capture' })
      assert.equal(a.readAm4NamPick(f, 0xd1), null, 'NAM 2’s answer was taken for NAM 1’s')
    }
    assert.equal(a.readAm4NamPick(PICK, 0xd2), null, 'the write’s own bytes coming back were taken for the answer')
  })

  test('the way out: a frame of a capture job’s shape goes only as the one job in hand', async () => {
    const a = await lib()
    const sx = await sysex()
    const { namUploadFrames, NAM_RECORD_WORDS } = await iii()
    const frames = namUploadFrames(0x15, 1, new Array(NAM_RECORD_WORDS).fill(0))
    const shapes = [BUSY_ON, BUSY_OFF, ASKS[0], ASKS[128], PICK, PICK_READ, frames[0], frames[1], frames[129]]
    for (const f of shapes) {
      assert.equal(a.am4NamShaped(f), true)
      assert.equal(a.am4NamAllowed(f, null), false, 'a capture frame went with no job in hand')
    }
    /* Nothing the AM4 was sent before has one of these shapes. */
    for (const f of [sx.buildAm4Structure(), sx.buildAm4Bypass(0x3a, true), sx.buildAm4BypassRead(0xd1), sx.buildAm4Channel(0x76, 1), sx.buildAm4Tempo(120)]) assert.equal(a.am4NamShaped(f), false)
    /* The list: any slot's question, and nothing else. */
    assert.equal(a.am4NamAllowed(ASKS[2], { list: true }), true)
    assert.equal(a.am4NamAllowed(PICK, { list: true }), false)
    assert.equal(a.am4NamAllowed(frames[0], { list: true }), false)
    const past = sx.frame(0x15, 0x01, [0, 0, 0, 0, 0x45, 0, 0, 0, 4, 0, 0x40, 0x40, 0, 0, 0])
    assert.equal(a.am4NamShaped(past), true)
    assert.equal(a.am4NamAllowed(past, { list: true }), false, 'slot 129 was asked')
    /* An upload: only its own frames. */
    const going = { list: true, frames: [BUSY_ON, BUSY_OFF, ...frames] }
    for (const f of [BUSY_ON, BUSY_OFF, frames[0], frames[64], frames[129]]) assert.equal(a.am4NamAllowed(f, going), true)
    const other = namUploadFrames(0x15, 2, new Array(NAM_RECORD_WORDS).fill(0))
    assert.equal(a.am4NamAllowed(other[0], going), false, 'another slot’s upload went')
    assert.equal(a.am4NamAllowed(PICK, going), false)
    /* A pick: that block and slot, or the read of that block. */
    assert.equal(a.am4NamAllowed(PICK, { pick: { block: 0xd2, slot: 1 } }), true)
    assert.equal(a.am4NamAllowed(PICK, { pick: { block: 0xd2, slot: 2 } }), false)
    assert.equal(a.am4NamAllowed(PICK, { pick: { block: 0xd1, slot: 1 } }), false)
    assert.equal(a.am4NamAllowed(PICK_READ, { pick: { block: 0xd1, slot: 0 } }), true)
    assert.equal(a.am4NamAllowed(BUSY_ON, { pick: { block: 0xd2, slot: 1 } }), false)
  })
}

const AM4_LIST = 0x45

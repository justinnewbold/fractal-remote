/**
 * PUTTING A NAM CAPTURE ON AN AXE-FX III: the messages, held to Axe-Edit
 * III's own (mobile/src/lib/nam-install.js, docs/nam-install.md).
 *
 * The frames here are from Justin's recording of Axe-Edit III loading one
 * capture (13 November 2026, his Axe-Fx III on firmware 33.01). The
 * recording itself is not in the repository: it holds a creator's capture
 * and the names of Fractal's own. What is here is the protocol's own
 * messages, which carry none of a capture's numbers, and the first two
 * words of the record, which are the start of its name. The whole upload
 * was rebuilt from the recording by this code, byte for byte, before it
 * was merged (130 messages).
 *
 * Nothing here sends anything, and nothing in the app does yet.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')
const lib = () => import('../mobile/src/lib/nam-install.js')
const sx = () => import('../mobile/src/lib/fractal-sysex.mjs')
const hex = (s) => (s.replace(/[^0-9a-f]/gi, '').match(/../g) || []).map((x) => parseInt(x, 16))
const III = 0x10

/* As Axe-Edit III sent them, and as the unit answered. */
const SEEN = {
  begin29: 'f0 00 01 74 10 54 00 1d 00 00 00 01 5d f7',
  end: 'f0 00 01 74 10 56 03 33 1d 2a 03 47 f7',
  took: ['f0 00 01 74 10 64 54 00 25 f7', 'f0 00 01 74 10 64 55 00 24 f7', 'f0 00 01 74 10 64 56 00 27 f7'],
  /* The first message of words opens: "128 words", then "Oran" and "ge A". */
  firstWords: 'f0 00 01 74 10 55 00 01 4f 64 05 73 06 67 4a 01 09 04',
  ask29: 'f0 00 01 74 10 01 08 01 00 00 00 00 1d 00 00 00 00 00 00 00 00 00 f7',
  ask256: 'f0 00 01 74 10 01 08 01 00 00 00 00 00 02 00 00 00 00 00 00 00 1f f7',
  empty: `f000017410010801000000004f01000000000010021e1129550251323e${'00'.repeat(303)}6df7`,
  pick: 'f0 00 01 74 10 01 09 00 4e 01 00 00 00 00 20 0f 04 00 00 00 00 79 f7',
  picked: 'f0000174100109004e0100000000206f0300002000275c4c16731d4a20205b2e0351010c6c305d04042a44582023582d1671006c2c10102930006ef7',
  busy: 'f0 00 01 74 10 01 09 00 01 00 72 00 00 00 00 7c 03 00 00 00 00 11 f7',
  idle: 'f0 00 01 74 10 01 09 00 01 00 72 00 00 00 00 00 00 00 00 00 00 6e f7'
}

/** An A2 capture's text with made-up numbers: 1,871 and 12,146, each its own place in the file. */
function a2({ metadata = {}, lite = 1871, full = 12146 } = {}) {
  const w = (n, from) => Array.from({ length: n }, (_, i) => Math.fround((from + i) / 100000))
  return JSON.stringify({
    version: '0.7.0',
    architecture: 'SlimmableContainer',
    config: { submodels: [{ max_value: 0.5, model: { weights: w(lite, 1) } }, { max_value: 1, model: { weights: w(full, 50001) } }] },
    weights: [],
    sample_rate: 48000,
    metadata
  })
}

export function run(test) {
  test('the upload’s three messages are Axe-Edit’s: the slot and size, 128 words at a time, and every word XORed', async () => {
    const { namUploadFrames, namXor, NAM_RECORD_WORDS, NAM_CHUNKS, NAM_CHUNK_WORDS, NAM_FN } = await lib()
    const { sameBytes, checksumOk, fromSeptets32 } = await sx()
    assert.deepEqual([NAM_RECORD_WORDS, NAM_CHUNKS, NAM_CHUNK_WORDS], [16384, 128, 128])
    const words = new Array(NAM_RECORD_WORDS).fill(0)
    words[0] = 0x6e61724f // "Oran"
    words[1] = 0x41206567 // "ge A"
    words[16383] = 0xffffffff
    words[300] = 0x80000001
    const frames = namUploadFrames(III, 29, words)
    assert.equal(frames.length, 130)
    assert.ok(frames.every((f) => checksumOk(f)), 'a message of the upload has a wrong checksum')
    assert.ok(sameBytes(frames[0], hex(SEEN.begin29)), 'the opening message is not Axe-Edit’s')
    assert.deepEqual(frames[1].slice(0, 18), hex(SEEN.firstWords), 'the words are not packed as Axe-Edit packs them')
    /* Every message of words is the same size, and says its own count. */
    for (const f of frames.slice(1, 129)) assert.deepEqual([f.length, f[5], f[6], f[7]], [650, NAM_FN.words, 0x00, 0x01])
    /* Each word comes back out of its five bytes, the top bit and the low bit of a word among them. */
    assert.equal(fromSeptets32(frames[1 + 127], 8 + 127 * 5), 0xffffffff)
    assert.equal(fromSeptets32(frames[1 + 2], 8 + (300 - 256) * 5), 0x80000001)
    /* The closing message carries the XOR, as five bytes: the recording's own closing value comes out as its bytes. */
    assert.equal(namXor(words), (0x6e61724f ^ 0x41206567 ^ 0xffffffff ^ 0x80000001) >>> 0)
    const one = new Array(NAM_RECORD_WORDS).fill(0)
    one[5] = 0x35475983
    assert.ok(sameBytes(namUploadFrames(III, 0, one)[129], hex(SEEN.end)), 'the closing message is not Axe-Edit’s')

    /* A record of the wrong size, and a slot no upload has been seen to name, build nothing. */
    assert.throws(() => namUploadFrames(III, 29, words.slice(1)), /16,384/)
    for (const slot of [128, 256, 257, -1, 1.5, null]) assert.throws(() => namUploadFrames(III, slot, words), /not one an upload has been seen to name/, String(slot))
    assert.doesNotThrow(() => namUploadFrames(III, 127, words))
  })

  test('the unit’s answers to an upload are read, and nothing else is taken for one', async () => {
    const { namAnswer, NAM_FN } = await lib()
    assert.deepEqual(SEEN.took.map((t) => namAnswer(hex(t), III)), [
      { fn: NAM_FN.begin, code: 0, ok: true },
      { fn: NAM_FN.words, code: 0, ok: true },
      { fn: NAM_FN.end, code: 0, ok: true }
    ])
    const { frame } = await sx()
    assert.deepEqual(namAnswer(frame(III, 0x64, [0x55, 0x03]), III), { fn: 0x55, code: 3, ok: false })
    /* Another unit's, a damaged one, and one that is not an answer at all. */
    assert.equal(namAnswer(hex(SEEN.took[0]), 0x11), null)
    const damaged = hex(SEEN.took[0])
    damaged[7] = 1
    assert.equal(namAnswer(damaged, III), null)
    assert.equal(namAnswer(hex(SEEN.busy), III), null)
    assert.equal(namAnswer(null, III), null)
  })

  test('"a transfer is under way", the list’s question and pointing a block at a slot are Axe-Edit’s messages', async () => {
    const { namBusyFrame, namSlotQuery, namPickFrame, readNamPick, NAM_SLOTS } = await lib()
    const { sameBytes } = await sx()
    assert.ok(sameBytes(namBusyFrame(III, true), hex(SEEN.busy)))
    assert.ok(sameBytes(namBusyFrame(III, false), hex(SEEN.idle)))
    assert.ok(sameBytes(namSlotQuery(III, 29), hex(SEEN.ask29)))
    assert.ok(sameBytes(namSlotQuery(III, 256), hex(SEEN.ask256)))
    assert.equal(NAM_SLOTS, 257)
    for (const slot of [257, -1, 2.5]) {
      assert.throws(() => namSlotQuery(III, slot), /not 0 to 256/)
      assert.throws(() => namPickFrame(III, 206, slot), /not 0 to 256/)
    }
    assert.ok(sameBytes(namPickFrame(III, 206, 29), hex(SEEN.pick)))
    /* The unit says the slot back as a share of 256, with the capture's name. */
    assert.deepEqual(readNamPick(hex(SEEN.picked), III, 206), { slot: 29, name: 'Orange Amp: Flat EQ, Gain 6, AK' })
    assert.equal(readNamPick(hex(SEEN.picked), III, 207), null)
    assert.equal(readNamPick(hex(SEEN.pick).slice(0, 12), III, 206), null)
  })

  test('a slot’s head is read out of the unit’s answer: an empty one says <EMPTY>, a filled one its seven lines and four numbers', async () => {
    const { readNamSlot, namHead, namRecord, firstEmptySlot, NAM_EMPTY, NAM_HEAD_BYTES } = await lib()
    const { packMsb, frame, encode14, septets32 } = await sx()
    const empty = readNamSlot(hex(SEEN.empty), III)
    assert.equal(hex(SEEN.empty).length, 334)
    assert.deepEqual([empty.name, empty.empty, empty.by, empty.loudness], [NAM_EMPTY, true, '', 0])
    /* A filled one, made the way the unit answers: a record's first 272 bytes, eight bits packed into seven. */
    const rec = namRecord(a2({ metadata: { name: 'Plexi Crunch', modeled_by: 'somebody', gear_make: 'Brit', gear_model: 'Plexi 100', gear_type: 'amp', tone_type: 'crunch', loudness: -17.5, gain: 0.5, input_level_dbu: 15 } }))
    assert.equal(rec.ok, true)
    const bytes = []
    for (let i = 0; i < NAM_HEAD_BYTES / 4; i++) bytes.push(rec.words[i] & 0xff, (rec.words[i] >>> 8) & 0xff, (rec.words[i] >>> 16) & 0xff, rec.words[i] >>> 24)
    const answer = frame(III, 0x01, [...encode14(0x88), 0, 0, 0, 0, ...septets32(207), 0, 0, ...encode14(NAM_HEAD_BYTES), ...packMsb(bytes)])
    assert.equal(answer.length, 334, 'the made answer is not the size the unit’s is')
    const head = readNamSlot(answer, III)
    assert.deepEqual(
      [head.name, head.by, head.make, head.model, head.gearType, head.toneType, head.empty, head.loudness, head.gain, head.inputLevel],
      ['Plexi Crunch', 'somebody', 'Brit', 'Plexi 100', 'amp', 'crunch', false, -17.5, 0.5, 15]
    )
    assert.ok(Number.isNaN(head.outputLevel), 'a level the file does not give is not "not a number"')
    assert.deepEqual(namHead(bytes), head)
    /* Not an answer to this question, or another unit's. */
    assert.equal(readNamSlot(hex(SEEN.picked), III), null)
    assert.equal(readNamSlot(hex(SEEN.empty), 0x11), null)
    /* The first empty slot an upload can name. */
    assert.equal(firstEmptySlot([head, head, empty, empty]), 2)
    assert.equal(firstEmptySlot([head, head]), null)
    assert.equal(firstEmptySlot(Array.from({ length: 257 }, (_, i) => (i === 200 ? empty : head))), null, 'a slot past the proven ones was offered')
  })

  test('a .nam file becomes the record a unit keeps: seven lines of text, four numbers, 14,017 floats in the file’s order, ten "not a number"s', async () => {
    const { namRecord, NAM_RECORD_WORDS, NAM_HEAD_WORDS, NAM_WEIGHTS, NAM_A2_NETWORKS, NAM_TAIL_NANS } = await lib()
    const { bitsFloat, floatBits } = await sx()
    assert.deepEqual([NAM_HEAD_WORDS, NAM_WEIGHTS, [...NAM_A2_NETWORKS], NAM_TAIL_NANS], [68, 14017, [1871, 12146], 10])
    const rec = namRecord(a2({ metadata: { loudness: -11.75, gain: 0.25 } }), { name: 'Orange Amp: Flat EQ, Gain 6, AK47 and more', by: 'tone3000', make: 'Orange OTR 120 2X12', model: 'Orange OTR 120 2X12', gearType: 'amp_cab', toneType: 'crunch' })
    assert.equal(rec.ok, true)
    assert.equal(rec.words.length, NAM_RECORD_WORDS)
    assert.ok(rec.words.every((w) => Number.isInteger(w) && w >= 0 && w <= 0xffffffff))
    /* The name: 31 characters and the unit's own ending, as the unit kept the one Axe-Edit sent. */
    assert.equal(rec.name, 'Orange Amp: Flat EQ, Gain 6, AK')
    assert.equal(rec.words[0], 0x6e61724f)
    assert.equal(rec.words[1], 0x41206567)
    assert.equal(rec.words[7] >>> 24, 0, 'the name’s 32nd byte is not the ending')
    assert.equal(rec.words[8], 0x656e6f74, '"tone", where who made it starts')
    /* The spare line and the thirty-two bytes: noughts, as Fractal's own captures have them. */
    for (let i = 48; i < 64; i++) assert.equal(rec.words[i], 0, `word ${i}`)
    /* Loudness, gain, and the two levels the file does not give. */
    assert.deepEqual([bitsFloat(rec.words[64]), bitsFloat(rec.words[65])], [-11.75, 0.25])
    assert.deepEqual([rec.words[66], rec.words[67]], [0x7fc00000, 0x7fc00000])
    /* The numbers, in the file's order: the lite network, then the full one, each a single-precision float. */
    assert.equal(rec.words[68], floatBits(1 / 100000))
    assert.equal(rec.words[68 + 1870], floatBits(1871 / 100000))
    assert.equal(rec.words[68 + 1871], floatBits(50001 / 100000))
    assert.equal(rec.words[14084], floatBits((50001 + 12145) / 100000))
    /* Then ten "not a number"s, and noughts to the end. */
    for (let i = 14085; i < 14095; i++) assert.equal(rec.words[i], 0x7fc00000, `word ${i}`)
    for (let i = 14095; i < NAM_RECORD_WORDS; i++) assert.equal(rec.words[i], 0)

    /* What the file says of itself is used where the app says nothing; what is not plain ASCII is left out. */
    const own = namRecord(a2({ metadata: { name: '  Café  “Plexi”\n100 ', modeled_by: 'me' } }))
    assert.equal(own.name, 'Cafe Plexi 100')

    /* Refused in plain words, never guessed at. */
    assert.match(namRecord(a2({ lite: 1870 }), { name: 'x' }).why, /isn’t the A2 kind/)
    assert.match(namRecord(a2({ full: 12147 }), { name: 'x' }).why, /isn’t the A2 kind/)
    assert.match(namRecord(JSON.stringify({ architecture: 'WaveNet', config: {}, weights: [1, 2, 3] }), { name: 'x' }).why, /isn’t the A2 kind/)
    assert.match(namRecord(a2()).why, /no name/)
    assert.match(namRecord('not a file', { name: 'x' }).why, /isn’t a NAM capture/)
  })

  test('nothing sends a record yet: the packing waits to be set beside the file that was loaded, and no screen or wire reaches this file', async () => {
    const { NAM_PACKING_PROVEN, NAM_SLOT_PROVEN_MOST } = await lib()
    assert.equal(NAM_PACKING_PROVEN, false, 'when the .nam has been set beside the recording, say so in docs/nam-install.md and build the sender with its own way out')
    assert.equal(NAM_SLOT_PROVEN_MOST, 127)
    const src = read('mobile/src/lib/nam-install.js')
    assert.deepEqual(src.match(/^import .*$/gm), [
      "import { FN, bitsFloat, checksumOk, encode14, floatBits, floatSeptets, frame, fromSeptets32, isFractal, septets32, unpackMsb, buildEditFrame } from './fractal-sysex.mjs'",
      "import { namNetworks } from './nam-file.js'"
    ])
    /* Nothing imports it but this test: no wire, no screen. The pull request that builds the sender changes this list. */
    for (const f of ['mobile/src/lib/bleWire.js', 'mobile/src/lib/device.js', 'mobile/src/components/Tone3000Test.js', 'mobile/src/screens/Settings.js', 'mobile/App.js']) {
      assert.ok(!/nam-install/.test(read(f)), `${f} reaches the capture messages before the packing is proven`)
    }
    /* And the notes say what the recording taught, without the recording. */
    const doc = read('docs/nam-install.md')
    for (const said of [/0x54/, /0x55/, /0x56/, /16,384/, /14,017/, /257/, /<EMPTY>/, /not in the repository/, /NAM_PACKING_PROVEN/]) assert.match(doc, said)
  })
}

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
 * And the packing is proven: the .nam that was loaded ("Orange Amp: Flat EQ,
 * Gain 6, AKG 414 + sm57", sent by Justin the same day) packs to the record
 * Axe-Edit sent, word for word but for the one byte the unit overwrites.
 * The file is not in the repository either (TONE3000's terms).
 *
 * Nothing here sends anything. The sender is the wire's (bleWire
 * namInstall), held by test/bluetooth.mjs against a pretend unit.
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
    const { namRecord, namCheck, NAM_RECORD_WORDS, NAM_HEAD_WORDS, NAM_WEIGHTS, NAM_A2_NETWORKS, NAM_TAIL_NANS } = await lib()
    const { bitsFloat, floatBits } = await sx()
    assert.deepEqual([NAM_HEAD_WORDS, NAM_WEIGHTS, [...NAM_A2_NETWORKS], NAM_TAIL_NANS], [68, 14017, [1871, 12146], 10])
    const rec = namRecord(a2({ metadata: { loudness: -11.75, gain: 0.25 } }), { name: 'Orange Amp: Flat EQ, Gain 6, AK47 and more', by: 'tone3000', make: 'Orange OTR 120 2X12', model: 'Orange OTR 120 2X12', gearType: 'amp_cab', toneType: 'crunch' })
    assert.equal(rec.ok, true)
    assert.equal(rec.words.length, NAM_RECORD_WORDS)
    assert.ok(rec.words.every((w) => Number.isInteger(w) && w >= 0 && w <= 0xffffffff))
    /* The name: 31 characters and its check byte, the 31 XORed together. For this name that is 0x60, which is the byte Axe-Edit sent after the same 31 characters. */
    assert.equal(rec.name, 'Orange Amp: Flat EQ, Gain 6, AK')
    assert.equal(rec.words[0], 0x6e61724f)
    assert.equal(rec.words[1], 0x41206567)
    assert.equal(rec.words[7] >>> 24, 0x60, 'the name’s 32nd byte is not the check byte Axe-Edit sent')
    assert.equal(namCheck([...'Orange Amp: Flat EQ, Gain 6, AK'].map((c) => c.charCodeAt(0))), 0x60)
    /* A shorter name: the rest of the field is noughts, so the check byte is the name's own characters XORed, still in the 32nd place. */
    const short = namRecord(a2({ metadata: { name: 'Plexi' } }))
    assert.equal(short.name, 'Plexi')
    assert.equal(short.words[7], (0x50 ^ 0x6c ^ 0x65 ^ 0x78 ^ 0x69) << 24)
    for (const r of [rec, short]) {
      let x = 0
      for (let i = 0; i < 8; i++) x ^= (r.words[i] & 0xff) ^ ((r.words[i] >>> 8) & 0xff) ^ ((r.words[i] >>> 16) & 0xff) ^ (r.words[i] >>> 24)
      assert.equal(x, 0, 'a name’s 32 bytes do not XOR to nought')
    }
    /* No other line of text carries one. */
    assert.equal(rec.words[15] >>> 24, 0)
    assert.equal(rec.words[8], 0x656e6f74, '"tone", where who made it starts')
    /* The spare line, and the thirty-two bytes where the file has no hash of its own: noughts, as Fractal's own captures have them. */
    for (let i = 48; i < 64; i++) assert.equal(rec.words[i], 0, `word ${i}`)
    /* A file that says its hash ("nam-content-v1:" and 64 hex digits) has it there as 32 bytes, as Axe-Edit sent the one it loaded. */
    const hash = '209cca8ae21199eb3dd7ed2eee89c99546e068a01e6265a5fe08db7251d47947'
    const hashed = namRecord(a2({ metadata: { name: 'Hashed', weights_hash: `nam-content-v1:${hash}` } }))
    assert.deepEqual([hashed.words[56].toString(16), hashed.words[63].toString(16)], ['8aca9c20', '4779d451'])
    for (const not of ['nam-content-v2:' + hash, hash, 'nam-content-v1:' + hash.slice(2), 7]) {
      const none = namRecord(a2({ metadata: { name: 'Not hashed', weights_hash: not } }))
      for (let i = 56; i < 64; i++) assert.equal(none.words[i], 0, `${not} word ${i}`)
    }
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

    /* What the file says of itself names it, as it named the one Axe-Edit loaded, whatever the app would call it; what is not plain ASCII is left out. */
    const own = namRecord(a2({ metadata: { name: '  Café  “Plexi”\n100 ', modeled_by: 'me' } }), { name: 'The app’s name for it', by: 'someone else' })
    assert.equal(own.name, 'Cafe Plexi 100')
    assert.equal(own.words[8], 0x0000656d, '"me", who made it by the file’s own word')

    /*
     * A name is chosen by what survives. A field keeps plain ASCII only, so
     * a name in another script kept none of its letters and the capture
     * could never be sent: now the app's name for it is used, and after
     * that its number at TONE3000. And never the unit's own word for an
     * empty slot, which would read as not kept and be written over.
     */
    const other = namRecord(a2({ metadata: { name: '日本語のアンプ' } }), { name: 'Plexi from TONE3000', fallback: 'Capture 42' })
    assert.deepEqual([other.ok, other.name], [true, 'Plexi from TONE3000'])
    const both = namRecord(a2({ metadata: { name: '日本語' } }), { name: 'アンプ', fallback: 'Capture 42' })
    assert.deepEqual([both.ok, both.name], [true, 'Capture 42'])
    assert.match(namRecord(a2({ metadata: { name: '日本語' } }), { name: 'アンプ' }).why, /no name/)
    const empty = namRecord(a2({ metadata: { name: '<EMPTY>' } }), { name: ' <Empty> ', fallback: 'Capture 7' })
    assert.deepEqual([empty.ok, empty.name], [true, 'Capture 7'])
    /* The other lines of text fall back the same way. */
    assert.equal(namRecord(a2({ metadata: { name: 'Plexi', modeled_by: 'アンプ' } }), { by: 'somebody' }).words[8], 0x656d6f73, '"some", who made it by the app’s word when the file’s keeps no letter')

    /* Refused in plain words, never guessed at. */
    assert.match(namRecord(a2({ lite: 1870 }), { name: 'x' }).why, /isn’t the A2 kind/)
    assert.match(namRecord(a2({ full: 12147 }), { name: 'x' }).why, /isn’t the A2 kind/)
    assert.match(namRecord(JSON.stringify({ architecture: 'WaveNet', config: {}, weights: [1, 2, 3] }), { name: 'x' }).why, /isn’t the A2 kind/)
    assert.match(namRecord(a2()).why, /no name/)
    assert.match(namRecord('not a file', { name: 'x' }).why, /isn’t a NAM capture/)
  })

  test('the packing is proven, and the capture messages reach a unit through the wire alone, each held at its one way out', async () => {
    const { NAM_PACKING_PROVEN, NAM_SLOT_PROVEN_MOST, namShaped, namAllowed, namSlotQuery, namPickFrame, namBusyFrame, namUploadFrames, namSlotSaid, NAM_RECORD_WORDS } = await lib()
    assert.equal(NAM_PACKING_PROVEN, true)
    assert.equal(NAM_SLOT_PROVEN_MOST, 127)
    assert.deepEqual([namSlotSaid(0), namSlotSaid(29), namSlotSaid(256)], ['001', '030', '257'])
    const src = read('mobile/src/lib/nam-install.js')
    assert.deepEqual(src.match(/^import .*$/gm), [
      "import { FN, bitsFloat, checksumOk, encode14, floatBits, floatSeptets, frame, fromSeptets32, isFractal, sameBytes, septets32, unpackMsb, buildEditFrame } from './fractal-sysex.mjs'",
      "import { namNetworks } from './nam-file.js'"
    ])
    /* Every frame the recording holds of these shapes is one, and nothing the app sent before is. */
    for (const seen of [SEEN.begin29, SEEN.end, SEEN.ask29, SEEN.ask256, SEEN.pick, SEEN.busy, SEEN.idle]) assert.equal(namShaped(hex(seen), III), true, seen)
    const { buildGetScene, buildSetBypass, buildEditFrame, floatSeptets, frame } = await sx()
    const before = [buildGetScene(III), buildSetBypass(III, 206, true), frame(III, 0x13, []), frame(III, 0x1f, [0x4e, 0x01]), buildEditFrame(III, 0x09, 2, 0x20, floatSeptets(120)), buildEditFrame(III, 0x09, 206, 5, floatSeptets(3)), buildEditFrame(III, 0x52, 206, 5, floatSeptets(3)), buildEditFrame(III, 0x26, 0, 0, [0, 3, 0, 0, 0])]
    for (const f of before) assert.equal(namShaped(f, III), false, 'a message the app already sends is taken for a capture message')
    /* Another unit's frames are not this one's. */
    assert.equal(namShaped(hex(SEEN.begin29), 0x11), false)
    /* With nothing going, nothing of the shape goes; and each thing going passes only itself. */
    const words = new Array(NAM_RECORD_WORDS).fill(0)
    const upload = namUploadFrames(III, 29, words)
    assert.equal(namAllowed(hex(SEEN.ask29), III, null), false)
    assert.equal(namAllowed(hex(SEEN.ask29), III, { list: true }), true)
    assert.equal(namAllowed(upload[0], III, { list: true }), false)
    assert.equal(namAllowed(upload[0], III, { frames: upload }), true)
    assert.equal(namAllowed(namUploadFrames(III, 30, words)[0], III, { frames: upload }), false)
    assert.equal(namAllowed(namBusyFrame(III, true), III, { frames: upload }), false, '"a transfer is under way" went without being one of the frames in hand')
    assert.equal(namAllowed(hex(SEEN.pick), III, { pick: { block: 206, slot: 29 } }), true)
    assert.equal(namAllowed(hex(SEEN.pick), III, { pick: { block: 206, slot: 30 } }), false)
    assert.equal(namAllowed(namPickFrame(III, 207, 29), III, { pick: { block: 206, slot: 29 } }), false)
    assert.equal(namAllowed(namSlotQuery(III, 3), III, { pick: { block: 206, slot: 29 } }), false)

    /* Who reaches this file: the wire, which sends; the card, which packs and names a slot; and nothing else. */
    assert.match(read('mobile/src/lib/bleWire.js'), /from '\.\/nam-install\.js'/)
    assert.match(read('mobile/src/components/Tone3000Test.js'), /import \{ NAM_BLOCKS, NAM_EMPTY, namRecord, namSlotSaid \} from '\.\.\/lib\/nam-install'/)
    for (const f of ['mobile/src/lib/device.js', 'mobile/src/screens/Settings.js', 'mobile/App.js', 'mobile/src/lib/bluetooth.js']) assert.ok(!/nam-install['.]/.test(read(f).replace(/\/\*[\s\S]*?\*\//g, '')), `${f} builds capture messages of its own`)
    /* The card sends through the three calls and no other way, and only the wire's own switch opens them: his account's. */
    const card = read('mobile/src/components/Tone3000Test.js')
    assert.match(card, /import \{ namEmptySlotHere, namInstallHere, namPickHere \} from '\.\.\/lib\/device'/)
    assert.ok(!/bluetoothWire|\.request\(|bleWire/.test(card), 'the card talks to the wire itself')
    assert.match(read('mobile/src/lib/bluetooth.js').replace(/\s+/g, ' '), /captures: \(\) => allUnits === true,/)
    /* And the notes say what the recording taught, without the recording. */
    const doc = read('docs/nam-install.md')
    for (const said of [/0x54/, /0x55/, /0x56/, /16,384/, /14,017/, /257/, /<EMPTY>/, /not in the repository/, /NAM_PACKING_PROVEN/, /weights_hash/, /word for word/, /namCheck/, /took the\s+capture and did not keep it/, /likely and not proven/]) assert.match(doc, said)
  })

  /*
   * THROUGH THE COMPUTER OR THE RASPBERRY PI (14 November 2026): the device
   * packs the record and hands it to the computer app in one message, and
   * the computer app sends Axe-Edit's messages (ForgeFX namCaptures.ts, held
   * to the same recorded frames by its own test). What is held here is what
   * travels, and what a device may ask a computer for.
   */
  test('a record travels to the computer as base64 of its words, and a device may ask a computer for exactly the three capture requests', async () => {
    const { namRecordTravels, base64Of, NAM_TRAVEL_WORDS_LEAST } = await import('../mobile/src/lib/nam-travel.js')
    const { NAM_RECORD_WORDS, NAM_HEAD_WORDS } = await lib()
    assert.equal(NAM_TRAVEL_WORDS_LEAST, NAM_HEAD_WORDS, 'the fewest words that travel is not a record’s head')

    /* base64, against Node's own, at every length that pads differently. */
    for (const n of [0, 1, 2, 3, 4, 5, 271, 272, 1000]) {
      const bytes = Uint8Array.from({ length: n }, (_, i) => (i * 37 + 11) & 0xff)
      assert.equal(base64Of(bytes), Buffer.from(bytes).toString('base64'), `${n} bytes`)
    }

    /* A record: up to its last word that is not nought, four bytes a word, low byte first. */
    const words = new Uint32Array(NAM_RECORD_WORDS)
    for (let i = 0; i < 14085; i++) words[i] = (0x3f000000 + i * 7919) >>> 0
    for (let i = 14085; i < 14095; i++) words[i] = 0x7fc00000
    const b64 = namRecordTravels(words)
    assert.match(b64, /^[A-Za-z0-9+/]+={0,2}$/)
    assert.ok(b64.length < 80000, 'a capture is bigger on its way to the computer than one message was counted to carry')
    const raw = Buffer.from(b64, 'base64')
    assert.equal(raw.length, 14095 * 4)
    for (let i = 0; i < 14095; i++) assert.equal(raw.readUInt32LE(i * 4), words[i])
    /* A plain array travels the same, and a negative number as its 32 bits. */
    assert.equal(namRecordTravels(Array.from(words)), b64)
    const neg = new Array(NAM_HEAD_WORDS).fill(0)
    neg[0] = -1
    assert.equal(Buffer.from(namRecordTravels(neg), 'base64').readUInt32LE(0), 0xffffffff)
    /* Never shorter than the head, however many noughts it ends in; and what is not a record is nothing. */
    const bare = new Uint32Array(NAM_RECORD_WORDS)
    bare[0] = 0x41
    assert.equal(Buffer.from(namRecordTravels(bare), 'base64').length, NAM_HEAD_WORDS * 4)
    for (const not of [null, undefined, [], new Uint32Array(67), 'words', {}]) assert.equal(namRecordTravels(not), null)
    assert.deepEqual([...read('mobile/src/lib/nam-travel.js').matchAll(/^import .* from '([^']+)'/gm)], [], 'the travelling record imports something')

    /* What a device may ask a computer for: the host's own rule, mirrored (ForgeFX remote.ts remoteAllowed). */
    const rules = await import('../shared/relay-rules.mjs')
    assert.equal(rules.hostAllows('GET', '/nam/empty'), true)
    assert.equal(rules.hostAllows('POST', '/nam/slots/30'), true)
    assert.equal(rules.hostAllows('POST', '/nam/blocks/206/slot'), true)
    for (const [method, path] of [['PUT', '/nam/slots/30'], ['DELETE', '/nam/slots/30'], ['POST', '/nam/slots'], ['POST', '/nam/slots/30/replace'], ['POST', '/nam/slots/x'], ['POST', '/nam/blocks/206'], ['POST', '/nam/blocks/206/slot/1'], ['POST', '/nam/empty'], ['POST', '/nam']]) {
      assert.equal(rules.hostAllows(method, path), false, `a device may ask ${method} ${path}`)
    }
    assert.equal(rules.hostAllows('POST', '/preset/store'), false, 'the rule got looser than a preset write')
    /* A capture is never sent twice, and each of the three is given the long wait. */
    assert.equal(rules.repeatable('/nam/slots/30'), false)
    for (const path of ['/nam/empty', '/nam/slots/30', '/nam/blocks/206/slot']) assert.equal(rules.timeoutFor('POST', path), 45000, path)

    /* Who asks: the card, through lib/device's three calls, and nobody else in the app. */
    const device = read('mobile/src/lib/device.js')
    assert.match(device, /import \{ namRecordTravels \} from '\.\/nam-travel'/)
    /* Over the device's own wire, or else through the computer. And a unit the wire takes no captures on is answered in the computer's own words, never the bare "unsupported". */
    assert.match(device.replace(/\s+/g, ' '), /if \(ble\) \{ return ble\.request\(path, \{ \.\.\.CAPTURING, \.\.\.onWire \}\)\.catch\(\(err\) => \{ if \(err\?\.unsupported === true\) throw Object\.assign\(new Error\(CAPTURES_ONLY_A_III\), \{ status: 501 \}\) throw err \}\) \} return remoteRequest\(path, typeof throughComputer === 'function' \? throughComputer\(\) : undefined\)\.catch\(captureSaid\)/)
    assert.match(device, /body: JSON\.stringify\(\{ record \}\)/, 'the computer is sent more than the record, or not the record')
    const { readdirSync } = await import('node:fs')
    const walk = (dir) => readdirSync(new URL(`../${dir}`, import.meta.url), { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(`${dir}/${e.name}`) : /\.jsx?$/.test(e.name) ? [`${dir}/${e.name}`] : []))
    const askers = [...walk('mobile/src'), 'mobile/App.js', ...walk('src')].filter((f) => /namEmptySlotHere|namInstallHere|namPickHere|\/nam\/(empty|slots|blocks)/.test(read(f).replace(/\/\*[\s\S]*?\*\//g, '')))
    assert.deepEqual(askers.sort(), ['mobile/src/components/Tone3000Test.js', 'mobile/src/lib/device.js'], 'something else asks for a capture to be sent')
    /* Nothing a customer needs: the red update line stays where it was. */
    const lock = JSON.parse(read('desktop/forgefx.lock.json'))
    assert.match(lock.forgefx.tag, /\+namcaptures$/)
    const doc = read('docs/nam-install.md')
    for (const said of [/Through the computer/, /\/nam\/empty/, /\/nam\/slots\/<n>/, /\/nam\/blocks\/<id>\/slot/, /no\s+replace/, /base64/, /namCaptures\.ts/]) assert.match(doc, said)
  })
}

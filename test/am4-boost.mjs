/**
 * ON AN AM4, THE AMP'S PEDAL IS ITS BOOST (1.87.49).
 *
 * "On the AM4 the amp on off button should do an amp boost instead of turning
 * the amp completely off. It should say Boost on, Boost off when they tap it."
 * (Justin, 22 October 2026.)
 *
 * The rule (shared/am4-boost.mjs), the browser's stage and its store, the
 * demo at both ends, and the places that must still switch the amp itself.
 * The phone's store is run on its bench in test/mobile.mjs, and Bluetooth's
 * frame and route in test/bluetooth.mjs.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const ds = await import('../src/lib/deviceState.js')

const read = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8')
const flat = (rel) => read(rel).replace(/\s+/g, ' ')

/* What a real AM4's computer answers for its amp (ForgeFX am4.ts blockParams), with every entry the switch must never be taken for. */
const ampParams = (boost, extra = {}) => ({
  block: 'amp',
  slug: 'amp',
  page: -1,
  named: [
    { id: 8, name: 'Out Boost Level', value: 4, min: 0, max: 4 },
    { id: 10, name: 'Gain', value: 6, min: 0, max: 10 }
  ],
  enums: [
    { id: 0xffff, name: 'Bypass', value: 1, options: [{ value: 0, label: 'Engaged' }, { value: 1, label: 'Bypassed' }] },
    { id: 42, name: 'Input Boost', value: 1, options: [{ value: 0, label: 'OFF' }, { value: 1, label: 'ON' }] },
    { id: 0x3a0096, name: 'Out Boost', value: 1, options: [{ value: 0, label: 'OFF' }, { value: 1, label: 'ON' }] },
    { id: 0x3e0096, name: 'Mid/Gain Boost', value: 1, options: [{ value: 0, label: 'OFF' }, { value: 1, label: 'ON' }] },
    ...(boost === undefined ? [] : [{ id: 150, name: 'Out Boost', value: boost, options: [{ value: 0, label: 'OFF' }, { value: 1, label: 'ON' }] }])
  ],
  type: { value: 3, name: 'Brit 800' },
  ...extra
})

export function run(test) {
  test('the boost is the amp’s Out Boost, 150, found by its number and name, and only exactly 0 or 1', async () => {
    const b = await import('../shared/am4-boost.mjs')
    assert.deepEqual({ ...b.AMP_BOOST }, { eid: 58, paramId: 150 }, 'not the codec’s amp.out_boost (0x3a / 0x96)')
    assert.equal(b.boostOf(ampParams(1)), true)
    assert.equal(b.boostOf(ampParams(0)), false)
    /* Never the made-up Bypass, an input boost, the level, the cab's numbers or a mid boost, whatever they say. */
    assert.equal(b.boostOf(ampParams(undefined)), null, 'something else was taken for the boost')
    for (const odd of [2, 65534, 0.5, '1', 'ON', null, undefined, -1]) assert.equal(b.boostOf(ampParams(odd)), null, `${JSON.stringify(odd)} was believed`)
    /* Only where its options say OFF and ON, when it lists any; and only off the amp. */
    const swapped = ampParams(1)
    swapped.enums.at(-1).options = [{ value: 0, label: 'ON' }, { value: 1, label: 'OFF' }]
    assert.equal(b.boostOf(swapped), null)
    const bare = ampParams(1)
    delete bare.enums.at(-1).options
    assert.equal(b.boostOf(bare), true)
    assert.equal(b.boostOf(ampParams(1, { slug: 'drive' })), null, 'another block’s answer was read for the amp’s boost')
    for (const nothing of [null, undefined, {}, { enums: 'no' }, []]) assert.equal(b.boostOf(nothing), null)
    /* The write: the computer's discrete path, the value whole, nothing else; never a toggle. */
    assert.deepEqual(b.boostRequest(true), { method: 'PUT', path: '/preset/blocks/58/params/150', body: { value: 1, continuous: false }, eid: 58, paramId: 150 })
    assert.deepEqual(b.boostRequest(false).body, { value: 0, continuous: false })
    assert.throws(() => b.boostRequest(), /never toggled/)
    assert.throws(() => b.boostRequest(1), /never toggled/)
    assert.equal(b.boostReadPath(), '/preset/blocks/58/params')
    /* Both routes are ones every computer app lets a phone use. */
    const { hostAllows } = await import('../shared/relay-rules.mjs')
    assert.ok(hostAllows('GET', b.boostReadPath()))
    assert.ok(hostAllows('PUT', b.boostRequest(true).path))
  })

  test('only an AM4’s amp, at its own code, is a boost pedal; every other block and unit is an on and off', async () => {
    const b = await import('../shared/am4-boost.mjs')
    const amp = { slug: 'amp', effectId: 58, channel: 'A', bypassed: false }
    assert.equal(b.ampPedal('am4', amp), 'boost')
    assert.equal(b.ampPedal('AM4', amp), 'boost')
    /* A second amp, whose addressing nobody has seen: never a boost, never a bypass from Play. */
    assert.equal(b.ampPedal('am4', { ...amp, effectId: 59 }), 'other')
    for (const slug of ['fm3', 'fm9', 'axefxiii', 'vp4', 'device', '', null, undefined]) assert.equal(b.ampPedal(slug, amp), null, `${slug}’s amp is a boost`)
    for (const block of [{ slug: 'drive', effectId: 118 }, { slug: 'reverb', effectId: 66 }, { slug: 'cab', effectId: 62 }, null]) assert.equal(b.ampPedal('am4', block), null)
  })

  test('the pedal says Boost on, Boost off, Amp off, or nothing, only for the preset and channel it was read for', async () => {
    const b = await import('../shared/am4-boost.mjs')
    const amp = { slug: 'amp', effectId: 58, channel: 'B', bypassed: false }
    const kept = b.keptBoost(12, 'B', true)
    assert.equal(b.boostState(kept, 12, amp), 'on')
    assert.equal(b.boostState(b.keptBoost(12, 'B', false), 12, amp), 'off')
    assert.equal(b.boostState(kept, 13, amp), 'unknown', 'one preset’s boost was shown on another')
    assert.equal(b.boostState(kept, 12, { ...amp, channel: 'C' }), 'unknown', 'one channel’s boost was shown on another')
    assert.equal(b.boostState(b.keptBoost(12, 'B', null), 12, amp), 'unknown')
    assert.equal(b.boostState(null, 12, amp), 'unknown')
    assert.equal(b.boostState(kept, 12, { ...amp, bypassed: true }), 'amp-off', 'a boost was offered on an amp that is off')
    assert.equal(b.boostWord('on'), 'Boost on')
    assert.equal(b.boostWord('off'), 'Boost off')
    assert.equal(b.boostWord('amp-off'), 'Amp off')
    assert.equal(b.boostWord('unknown'), null)
    /* Plain words, US spelling, never "this phone". */
    for (const w of [b.BOOST_ON, b.BOOST_OFF, b.AMP_OFF, b.AMP_OFF_SAYS, b.BOOST_UNREAD, b.OTHER_AMP_SAYS]) {
      assert.ok(!/this phone|colour|grey|favourite/i.test(w), w)
    }
  })

  test('the watch’s AM4 amp pedal is lit for Boost on, as on Play, and nothing else on the wrist changes', async () => {
    const b = await import('../shared/am4-boost.mjs')
    const chain = [
      { slug: 'drive', effectId: 118, channel: 'A', bypassed: false },
      { slug: 'amp', effectId: 58, channel: 'A', bypassed: false }
    ]
    const on = b.boostPedals(chain, { slug: 'am4', boost: b.keptBoost(4, 'A', true), number: 4 })
    assert.deepEqual(on.map((p) => p.bypassed), [false, false])
    const off = b.boostPedals(chain, { slug: 'am4', boost: b.keptBoost(4, 'A', false), number: 4 })
    assert.deepEqual(off.map((p) => p.bypassed), [false, true], 'the wrist shows the amp lit over Boost off')
    assert.deepEqual(b.boostPedals(chain, { slug: 'am4', boost: null, number: 4 }).map((p) => p.bypassed), [false, true], 'an unread boost is lit on the wrist')
    assert.equal(b.boostPedals(chain, { slug: 'fm3', boost: b.keptBoost(4, 'A', false), number: 4 }), chain, 'another unit’s pedals were touched')
    /* The phone's end: the picture is mapped before it is sent, and a wrist tap is still rig.writeBypass, which sends the boost there. */
    const bridge = flat('mobile/src/lib/watchBridge.js')
    assert.match(bridge, /import \{ boostPedals \} from '\.\/am4-boost'/)
    assert.match(bridge, /picture = \{ \.\.\.picture, chain: boostPedals\(picture\?\.chain, \{ slug: rig\.deviceSlug, boost: rig\.boost, number: rig\.preset\?\.number \}\) \}/)
    assert.match(bridge, /if \(cmd\.do === 'pedal'\) return writeBypass\(cmd\.id, !cmd\.on, receivedAt\)/)
    const rig = flat('mobile/src/lib/rig.js')
    assert.match(rig, /export function writeBypass\(id, bypassed, at = Date\.now\(\)\) \{ const pedal = ampPedal\(state\.deviceSlug, blockNow\(id\)\) if \(pedal === 'boost'\) return tapBoost\(id, at\)/, 'a pedal tap on an AM4 amp can bypass it')
  })

  test('the amp’s own on and off stays where the block is edited, at both ends, and Copy a scene copies the amp itself', () => {
    /* The phone: Edit's block page and Copy a scene call the real bypass. */
    assert.match(flat('mobile/src/screens/Edit.js'), /onPress=\{\(\) => writeBlockBypass\(eid, engaged\)\}/)
    assert.match(flat('mobile/src/components/SceneCopy.js'), /setBypass: orStop\(writeBlockBypass\)/)
    assert.ok(!/\bwriteBypass\b/.test(read('mobile/src/screens/Edit.js')), 'Edit’s on and off goes through the pedal’s tap, which is a boost on an AM4 amp')
    /* The browser: the block panel and the chain strip still write the bypass; only the stage tile taps the boost. */
    const consoleSrc = flat('src/components/Console.jsx')
    assert.ok(!/tapBoost/.test(consoleSrc), 'the browser’s editor switches a boost')
    assert.match(consoleSrc, /className=\{`bypass-btn /, 'the browser’s block panel lost its Engaged / Bypassed')
    const gig = flat('src/components/Gig.jsx')
    assert.match(gig, /const boosts = ampPedal\(deviceKey, block\) !== null setToggling\(eid\) try \{ if \(boosts\) await tapBoost\(eid\) else await writeBypass\(eid, wanted\)/)
    assert.match(gig, /boost=\{ampPedal\(deviceKey, block\) === 'boost' \? boostState\(boostKept, preset\?\.number, block\) : null\}/)
  })

  test('the stage tile says Boost on or Boost off, lit only for on, at both ends, and says it to a screen reader too', () => {
    const stage = flat('mobile/src/screens/Stage.js')
    assert.match(stage, /const boost = ampPedal\(device, block\) === 'boost' \? boostState\(boostKept, preset\?\.number, block\) : null/)
    /* Its tap is the pedal's tap (rig.writeBypass), which on an AM4 amp is the boost; never the block's own switch. */
    assert.match(stage, /writeBypass\(idOf\(block\), !block\.bypassed\)/)
    assert.ok(!/writeBlockBypass/.test(stage), 'Play switches an AM4 amp itself')
    assert.match(stage, /const engaged = boost \? boost === BOOST\.on : !unknown && !block\.bypassed/, 'the phone’s boost pedal is lit for anything but Boost on')
    assert.match(stage, /const state = boost \? boostWord\(boost\) \|\| '\\u00a0' : unknown \? '\\u00a0' : engaged \? 'On' : 'Off'/)
    /* The phone's tile reads its corner words out (components/Tile accessibilityLabel). */
    assert.match(flat('mobile/src/components/Tile.js'), /accessibilityLabel=\{\[label, topLeft, topRight, sub, caption\]\.filter\(Boolean\)\.join\(', '\)\}/)
    const gig = flat('src/components/Gig.jsx')
    assert.match(gig, /aria-pressed=\{door \|\| unknown \? undefined : !dark\}/)
    assert.match(gig, /\[block\.name \|\| block\.slug, boost \? boostWord\(boost\) : unknown \? null : block\.bypassed \? 'Off' : 'On', block\.channel\]\.filter\(Boolean\)\.join\(', '\)/)
  })

  /* --------------------------------------------------------------- the browser's store -- */

  /* An AM4 through a computer, whose params read carries the amp's boost for the channel it is on. */
  function am4(over = {}) {
    const calls = []
    const unit = {
      slug: 'am4',
      boosts: { A: 0, B: 1, C: 0, D: 0 },
      chain: [
        { slug: 'drive', name: 'Drive 1', effectId: 118, bypassed: true, channel: 'A' },
        { slug: 'amp', name: 'Amp 1', effectId: 58, bypassed: false, channel: 'A' }
      ],
      reads: 0,
      paramsFail: false,
      ...over
    }
    const ch = () => unit.chain.find((b) => b.effectId === 58)?.channel || 'A'
    const driver = {
      calls,
      unitSlug: () => unit.slug,
      presetBlocks: async () => unit.chain.map((b) => ({ ...b })),
      blockParams: async (eid) => {
        unit.reads += 1
        calls.push(['blockParams', eid])
        if (unit.paramsFail) throw Object.assign(new Error('the unit did not answer'), { status: 503 })
        return ampParams(unit.boosts[ch()])
      },
      setAmpBoost: async (ask, opts) => {
        calls.push(['setAmpBoost', ask.path, ask.body, opts])
        if (unit.refuse) throw Object.assign(new Error('The unit refused it.'), { status: 409 })
        unit.boosts[ch()] = ask.body.value
        return { ok: false }
      },
      setBypass: async (eid, bypassed, opts) => {
        calls.push(['setBypass', eid, bypassed, opts])
        return { ok: true }
      },
      getScene: async () => ({ index: 0, names: [] })
    }
    ds.reset()
    ds.attachDriver(driver)
    ds.set({ preset: { number: 12, name: 'SONG' } })
    return { unit, driver, calls }
  }
  const settled = () => new Promise((go) => setImmediate(go))

  test('browser: on an AM4 the amp’s stage tile sends its Out Boost, the opposite of what the unit said, and never a bypass', async () => {
    const { unit, calls } = am4()
    await ds.refreshBlocks()
    await settled()
    assert.deepEqual(ds.getSnapshot().boost, { number: 12, channel: 'A', on: false }, 'the boost was not read after the chain')
    assert.equal(ds.boostNow(), 'off')
    const before = Date.now()
    await ds.tapBoost(58)
    const sent = calls.filter((c) => c[0] === 'setAmpBoost')
    assert.equal(sent.length, 1)
    assert.equal(sent[0][1], '/preset/blocks/58/params/150')
    assert.deepEqual(sent[0][2], { value: 1, continuous: false })
    assert.ok(sent[0][3].deadline >= before + 1500, 'the boost is not a tap with a deadline')
    assert.ok(!calls.some((c) => c[0] === 'setBypass'), 'the amp was turned off')
    assert.equal(unit.boosts.A, 1)
    assert.equal(ds.boostNow(), 'on', 'the AM4’s ok:false was taken for a no')
    await ds.tapBoost(58)
    assert.deepEqual(calls.filter((c) => c[0] === 'setAmpBoost').at(-1)[2], { value: 0, continuous: false })
    assert.equal(ds.boostNow(), 'off')
    /* Read once after the chain, and never after a tap. */
    assert.equal(unit.reads, 1, 'a tap read the amp back')
  })

  test('browser: the boost is per channel and per preset, unknown until read, and an unreadable one sends nothing', async () => {
    const { unit, calls } = am4()
    await ds.refreshBlocks()
    await settled()
    /* The scene moved the amp to B: unknown until the chain read after it, which reads B's. */
    unit.chain.find((b) => b.effectId === 58).channel = 'B'
    ds.set({ blocks: ds.getSnapshot().blocks.map((b) => (b.effectId === 58 ? { ...b, channel: 'B' } : b)) })
    assert.equal(ds.boostNow(), 'unknown', 'channel A’s boost was shown on channel B')
    await ds.refreshBlocks()
    await settled()
    assert.equal(ds.boostNow(), 'on')
    /* Another preset: unknown until its own read. */
    ds.set({ preset: { number: 13, name: 'NEXT' } })
    assert.equal(ds.boostNow(), 'unknown', 'the last preset’s boost was shown on this one')
    /* Its chain read, and the boost read after it fails: not known, and a tap reads first, then sends nothing, in words. */
    unit.paramsFail = true
    await ds.refreshBlocks()
    await settled()
    assert.equal(ds.getSnapshot().boost?.number, 12, 'a failed read was kept as an answer')
    assert.equal(ds.boostNow(), 'unknown')
    await assert.rejects(ds.tapBoost(58), (e) => e.nothingSent === true && e.message === 'The amp’s boost couldn’t be read from the unit, so nothing was sent. Try it again in a moment.')
    assert.ok(!calls.some((c) => c[0] === 'setAmpBoost' || c[0] === 'setBypass'), 'an unread boost was sent, or fell back to a bypass')
    /* Read, and said nothing that can be shown: kept, and a tap does not ask again. */
    unit.paramsFail = false
    unit.boosts.B = 65534
    await ds.refreshBoost()
    const reads = unit.reads
    await assert.rejects(ds.tapBoost(58), (e) => e.nothingSent === true)
    assert.equal(unit.reads, reads, 'a tap on an unreadable boost read the amp again')
    /* And once it can be read, the tap reads first and goes. */
    unit.boosts.B = 0
    ds.set({ boost: null })
    await ds.tapBoost(58)
    assert.deepEqual(calls.filter((c) => c[0] === 'setAmpBoost').at(-1)[2], { value: 1, continuous: false })
  })

  test('browser: an AM4 amp off in this scene sends nothing and says so; other pedals and units are unchanged', async () => {
    const { calls } = am4({
      chain: [
        { slug: 'drive', name: 'Drive 1', effectId: 118, bypassed: true, channel: 'A' },
        { slug: 'amp', name: 'Amp 1', effectId: 58, bypassed: true, channel: 'A' }
      ]
    })
    await ds.refreshBlocks()
    await settled()
    assert.equal(ds.boostNow(), 'amp-off')
    await assert.rejects(ds.tapBoost(58), (e) => e.nothingSent === true && /Turn the amp on in Edit/.test(e.message))
    assert.ok(!calls.some((c) => c[0] === 'setAmpBoost' || c[0] === 'setBypass'))
    /* The editor's own switch still turns it on. */
    await ds.writeBypass(58, false)
    assert.deepEqual(calls.at(-1).slice(0, 3), ['setBypass', 58, false])
    /* A tap on a non-amp pedal is never routed to the boost. */
    await assert.rejects(ds.tapBoost(118), (e) => e.nothingSent === true)
    /* An FM3: nothing reads a boost, and its amp is an on and off. */
    const fm3 = am4({ slug: 'fm3' })
    await ds.refreshBlocks()
    await settled()
    assert.equal(fm3.unit.reads, 0, 'an FM3’s amp was read for a boost')
    assert.equal(ds.boostNow(), null)
    await assert.rejects(ds.tapBoost(58), (e) => e.nothingSent === true)
    assert.ok(!fm3.calls.some((c) => c[0] === 'setAmpBoost'), 'an FM3 was sent the AM4’s boost')
  })

  test('browser: a boost tap is refused while the link is down and put back when the unit says no', async () => {
    const { unit } = am4()
    await ds.refreshBlocks()
    await settled()
    const gate = await import('../src/lib/tapGate.js')
    gate.setLinkDown(true)
    try {
      await assert.rejects(ds.tapBoost(58), (e) => e.notSent === true)
      assert.equal(ds.boostNow(), 'off', 'a boost that never left is shown')
    } finally {
      gate.setLinkDown(false)
    }
    unit.refuse = true
    await assert.rejects(ds.tapBoost(58), /refused/)
    assert.equal(ds.boostNow(), 'off', 'a refused boost stayed on screen')
    /* A clean start for another unit forgets it. */
    ds.startClean()
    assert.equal(ds.getSnapshot().boost, null)
  })

  /* ------------------------------------------------------------------- the demo -- */

  test('the demo’s AM4 amp has an Out Boost, per channel, at both ends; the FM3 demo amp has none', async () => {
    const { createMockDevice } = await import('../src/lib/mockDevice.js')
    const b = await import('../shared/am4-boost.mjs')
    const unit = createMockDevice('am4')
    const amp = unit.presetBlocks().find((x) => x.slug === 'amp')
    assert.equal(amp.effectId, 58)
    assert.equal(b.boostOf(unit.blockParams(58)), false)
    unit.setEnum(58, 150, 1)
    assert.equal(b.boostOf(unit.blockParams(58)), true)
    /* Not the bypass: the amp is still on. */
    assert.equal(unit.presetBlocks().find((x) => x.effectId === 58).bypassed, false)
    /* Its own channel's: switched to D and set off there, the channel it was on keeps it on. */
    const was = amp.channel
    unit.setChannel(58, 'D')
    unit.setEnum(58, 150, 0)
    assert.equal(b.boostOf(unit.blockParams(58)), false)
    unit.setChannel(58, was)
    assert.equal(b.boostOf(unit.blockParams(58)), true, 'the demo’s boost is not per channel')
    /* Other blocks and other units' amps report none. */
    assert.deepEqual(unit.blockParams(118).enums, [])
    assert.equal(b.boostOf(createMockDevice('fm3').blockParams(58)), null)
    assert.deepEqual(createMockDevice('fm3').blockParams(58).enums, [])

    /* The phone's demo answers the same two routes at the same door (demoWire), from its copy of the same unit. */
    const { demoRequest } = await import('../mobile/src/lib/demoWire.js')
    const phone = (await import('../mobile/src/lib/mockDevice.js')).createMockDevice('am4')
    assert.equal(b.boostOf(await demoRequest(phone, b.boostReadPath())), false)
    const ask = b.boostRequest(true)
    await demoRequest(phone, ask.path, { method: ask.method, body: JSON.stringify(ask.body) })
    assert.equal(b.boostOf(await demoRequest(phone, b.boostReadPath())), true, 'the phone’s demo did not take the boost')
    assert.equal((await demoRequest(phone, '/preset/blocks')).find((x) => x.effectId === 58).bypassed, false)
  })
}

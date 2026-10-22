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
    /*
     * The unit the pedals are judged by while the computer says no unit is
     * there: the last real one, whose chain is still up. A detect of "no
     * device" turned the amp's pedal back into an on and off for those
     * seconds, and its tap a bypass that reached the AM4 once it answered.
     */
    assert.equal(b.pedalUnit('device', 'am4'), 'am4')
    assert.equal(b.pedalUnit('', 'am4'), 'am4')
    assert.equal(b.pedalUnit(undefined, 'am4'), 'am4')
    assert.equal(b.pedalUnit('fm3', 'am4'), 'fm3', 'another real unit is judged by the last one')
    assert.equal(b.pedalUnit('device', null), 'device')
    assert.equal(b.pedalUnit('device', 'device'), 'device')
    assert.equal(b.ampPedal(b.pedalUnit('device', 'am4'), amp), 'boost')
    assert.equal(b.unitMissing('device', 'am4'), true)
    assert.equal(b.unitMissing('am4', 'am4'), false)
    assert.equal(b.unitMissing('device', null), false)
    /* And one pedal state for both ends' tiles: the boost, 'other', or nothing for any other pedal. */
    const at = b.boostAt(1, 2, 12)
    assert.equal(b.pedalBoost('am4', amp, b.keptBoost(at, 'A', true), at), 'on')
    assert.equal(b.pedalBoost('am4', { ...amp, effectId: 59 }, null, at), 'other')
    assert.equal(b.pedalBoost('fm3', amp, b.keptBoost(at, 'A', true), at), null)
    assert.equal(b.pedalBoost('am4', { slug: 'drive', effectId: 118 }, null, at), null)
  })

  test('the pedal says Boost on, Boost off, Amp off, or nothing, only for the load of the preset and the channel it was read for', async () => {
    const b = await import('../shared/am4-boost.mjs')
    const amp = { slug: 'amp', effectId: 58, channel: 'B', bypassed: false }
    const at = b.boostAt(3, 7, 12)
    const kept = b.keptBoost(at, 'B', true)
    assert.deepEqual(kept, { at: '3:7:12', channel: 'B', on: true })
    assert.equal(b.boostState(kept, at, amp), 'on')
    assert.equal(b.boostState(b.keptBoost(at, 'B', false), at, amp), 'off')
    assert.equal(b.boostState(kept, b.boostAt(3, 7, 13), amp), 'unknown', 'one preset’s boost was shown on another')
    assert.equal(b.boostState(kept, at, { ...amp, channel: 'C' }), 'unknown', 'one channel’s boost was shown on another')
    /*
     * The same preset loaded again is another load: the unit has its stored
     * boost back, whatever was sent before. Over Bluetooth, where nothing
     * reads, the phone showed what it last sent over a unit that had reloaded.
     */
    assert.equal(b.boostState(kept, b.boostAt(3, 8, 12), amp), 'unknown', 'a preset loaded again kept the boost from before')
    /* Another computer, or another unit (the unit era): never the one left's. */
    assert.equal(b.boostState(kept, b.boostAt(4, 7, 12), amp), 'unknown', 'another unit’s boost was shown')
    assert.equal(b.boostState(b.keptBoost(at, 'B', null), at, amp), 'unknown')
    assert.equal(b.boostState(b.keptBoost(null, 'B', true), null, amp), 'unknown', 'a boost kept for nowhere was shown')
    assert.equal(b.boostState(null, at, amp), 'unknown')
    assert.equal(b.boostState(kept, at, { ...amp, bypassed: true }), 'amp-off', 'a boost was offered on an amp that is off')
    assert.equal(b.boostWord('on'), 'Boost on')
    assert.equal(b.boostWord('off'), 'Boost off')
    assert.equal(b.boostWord('amp-off'), 'Amp off')
    assert.equal(b.boostWord('unknown'), null)
    assert.equal(b.boostWord('other'), null, 'an amp whose boost cannot be switched says On or Off')
    /* What a screen reader hears: the word, or why there is none, never an empty item. */
    assert.equal(b.boostLabel('on'), 'Boost on')
    assert.equal(b.boostLabel('unknown'), 'Boost not read yet')
    assert.equal(b.boostLabel('other'), 'Boost can’t be switched yet')
    /* Plain words, US spelling, never "this phone". */
    for (const w of [b.BOOST_ON, b.BOOST_OFF, b.AMP_OFF, b.AMP_OFF_SAYS, b.BOOST_UNREAD, b.OTHER_AMP_SAYS, b.BOOST_WAIT, b.BOOST_NO_UNIT, b.BOOST_NOT_READ, b.BOOST_CANT, b.PLAY_HINT_TAP_AM4]) {
      assert.ok(!/this phone|colour|grey|favourite|first amp/i.test(w), w)
    }
    /* One sentence for an amp at another code, at every end: Play's and Bluetooth's guard. */
    assert.equal(b.OTHER_AMP_SAYS, 'The app can’t switch this amp’s boost yet.')
    assert.ok(read('mobile/src/lib/bleWire.js').includes(`badInput('${b.OTHER_AMP_SAYS}')`), 'Bluetooth says another amp’s refusal in other words')
  })

  test('the watch’s AM4 amp pedal is lit for Boost on, as on Play, and nothing else on the wrist changes', async () => {
    const b = await import('../shared/am4-boost.mjs')
    const chain = [
      { slug: 'drive', effectId: 118, channel: 'A', bypassed: false },
      { slug: 'amp', effectId: 58, channel: 'A', bypassed: false }
    ]
    const on = b.boostPedals(chain, { slug: 'am4', shown: 'on' })
    assert.deepEqual(on.map((p) => p.bypassed), [false, false])
    const off = b.boostPedals(chain, { slug: 'am4', shown: 'off' })
    assert.deepEqual(off.map((p) => p.bypassed), [false, true], 'the wrist shows the amp lit over Boost off')
    assert.deepEqual(b.boostPedals(chain, { slug: 'am4', shown: 'unknown' }).map((p) => p.bypassed), [false, true], 'an unread boost is lit on the wrist')
    assert.deepEqual(b.boostPedals(chain, { slug: 'am4', shown: 'amp-off' }).map((p) => p.bypassed), [false, true])
    assert.equal(b.boostPedals(chain, { slug: 'fm3', shown: 'off' }), chain, 'another unit’s pedals were touched')
    /* An amp whose boost cannot be switched is dark on the wrist, as it is on Play. */
    assert.deepEqual(b.boostPedals([{ slug: 'amp', effectId: 59, bypassed: false }], { slug: 'am4', shown: 'on' }).map((p) => p.bypassed), [true])
    /* The phone's end: the picture is mapped from what Play shows before it is sent, and a wrist tap is still rig.writeBypass, which sends the boost the wrist asked for there. */
    const bridge = flat('mobile/src/lib/watchBridge.js')
    assert.match(bridge, /import \{ boostPedals \} from '\.\/am4-boost' import \{ boostNow, pedalSlug \} from '\.\/rig'/)
    assert.match(bridge, /picture = \{ \.\.\.picture, chain: boostPedals\(picture\?\.chain, \{ slug: pedalSlug\(\), shown: boostNow\(\) \}\) \}/)
    assert.match(bridge, /if \(cmd\.do === 'pedal'\) return writeBypass\(cmd\.id, !cmd\.on, receivedAt\)/)
    const rig = flat('mobile/src/lib/rig.js')
    assert.match(rig, /export function writeBypass\(id, bypassed, at = Date\.now\(\)\) \{ if \(ampPedal\(pedalSlug\(\), blockNow\(id\)\)\) return tapBoost\(id, at, bypassed === true \|\| bypassed === false \? !bypassed : undefined\)/, 'a pedal tap on an AM4 amp can bypass it, or a wrist tap is a toggle')
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
    assert.match(gig, /const boosts = boostOf\(block\) !== null if \(!boosts\) setToggling\(eid\) try \{ if \(boosts\) await tapBoost\(eid\) else await writeBypass\(eid, wanted\)/)
    assert.match(gig, /boost=\{boostOf\(block\)\}/)
    assert.match(gig, /const boostOf = \(block\) => pedalBoost\(pedalUnit\(deviceKey, lastUnit\), block, boostKept, boostKey\(\)\)/)
    /*
     * A boost tap is not held disabled while its write is answered: it is up
     * at once and puts itself back, and an older computer took over half a
     * second to answer one, which lost a quick second tap.
     */
    assert.match(gig, /\} finally \{ if \(!boosts\) setToggling\(null\) \}/, 'the browser’s boost tile stays disabled for the whole answer')
  })

  test('the stage tile says Boost on or Boost off, lit only for on, at both ends, and says it to a screen reader too', () => {
    const stage = flat('mobile/src/screens/Stage.js')
    assert.match(stage, /const boost = pedalBoost\(pedalUnit\(device, lastUnit\), block, boostKept, boostKey\(\)\)/)
    /* Its tap is the boost's own toggle (rig.tapBoost); every other pedal's is the pedal's tap; never the block's own switch. */
    assert.match(stage, /if \(boost\) tapBoost\(idOf\(block\)\) else writeBypass\(idOf\(block\), !block\.bypassed\)/)
    assert.ok(!/writeBlockBypass/.test(stage), 'Play switches an AM4 amp itself')
    assert.match(stage, /const engaged = boost \? boost === BOOST\.on : !unknown && !block\.bypassed/, 'the phone’s boost pedal is lit for anything but Boost on')
    assert.match(stage, /const state = boost \? boostWord\(boost\) \|\| '\\u00a0' : unknown \? '\\u00a0' : engaged \? 'On' : 'Off'/)
    /* Always seen, said to a screen reader in words, and dashed while unread (components/Tile). */
    assert.match(stage, /mustSay=\{!!boost\} saysLeft=\{boost \? boostLabel\(boost\) : undefined\} unread=\{!!boost && unread\}/)
    /* The phone's tile reads its corner words out, never an empty item ("AMP,  , C"). */
    const tile = flat('mobile/src/components/Tile.js')
    assert.match(tile, /accessibilityLabel=\{\[label, saysLeft \?\? topLeft, topRight, sub, caption\]\.filter\(\(part\) => !!String\(part \?\? ''\)\.trim\(\)\)\.join\(', '\)\}/)
    assert.equal(String('\u00a0').trim(), '', 'a no-break space is not taken for blank')
    assert.match(tile, /borderStyle: unread \? 'dashed' : 'solid'/)
    const gig = flat('src/components/Gig.jsx')
    assert.match(gig, /aria-pressed=\{door \|\| unknown \? undefined : !dark\}/)
    assert.match(gig, /\[block\.name \|\| block\.slug, boost \? boostLabel\(boost\) : unknown \? null : block\.bypassed \? 'Off' : 'On', block\.channel\]\.filter\(Boolean\)\.join\(', '\)/)
    /* An unread boost, or one that cannot be switched, wears the browser's dashed ring, as an unread VP4 pedal does. */
    assert.match(gig, /data-unknown=\{unknown && \(vp4Here\(\) \|\| boost\) \? 'yes' : undefined\}/)
    assert.match(gig, /const unknown = boost \? boost === BOOST\.unknown \|\| boost === BOOST\.other :/)
  })

  /*
   * "It should say Boost on, Boost off when they tap it." On most phones the
   * corner had no room for the word beside the picture, so it was hidden and
   * the tile was a dark AMP that looked bypassed. Now, wherever its corner is
   * crowded, the picture is cleared from under it and the word stays in its
   * corner, the channel beside it where the row holds both; only a word too
   * wide for its row goes across the tile. One rule at both ends
   * (shared/tile-corners.mjs mustSayFit), held to numbers below.
   */
  test('an AM4 amp’s Boost on, Boost off and Amp off are always seen: in the corner, or in the picture’s place, at both ends', async () => {
    const tile = flat('mobile/src/components/Tile.js')
    assert.match(tile, /import \{ cornerFit, mustSayFit \} from '\.\.\/lib\/tile-corners'/)
    assert.match(tile, /const say = mustSay && cornered && !!String\(topLeft \|\| ''\)\.trim\(\) && current \? mustSayFit\(/, 'the phone’s word is not placed by the shared rule when its corner is crowded')
    /* The moved word is the corner word, in its own face, so it is the corner word's width that decides. */
    assert.match(tile, /\{ moved: laid\.left, movedTop: picture \? laid\.top : 0 \}/)
    assert.match(tile, /const leftShown = say \? say\.at !== 'across' : shows\.left const rightShown = say \? say\.right : shows\.right/)
    /* Over the picture's own box, across the tile's whole inside, only for a word too wide for its row; and the picture kept in its place, unseen, whenever the word has moved. */
    assert.match(tile, /position: 'absolute', left: 0, right: 0, top: picture \? Math\.max\(0, \(laid\.top \?\? BORDER\) - BORDER\) : 3, height: picture \|\| undefined/)
    assert.match(tile, /opacity: middle \? 1 : 0 \}\}/)
    assert.match(tile, /tintColor: quiet \? foreground : pictureTint, opacity: cleared \? 0 : 1/)
    const gig = flat('src/components/Gig.jsx')
    assert.match(gig, /import \{ cornerFit, mustSayFit \} from '\.\.\/\.\.\/shared\/tile-corners\.mjs'/)
    assert.match(gig, /const say = mustSayFit\(corners, \{ moved: whole\(word\), movedTop: top \+ Math\.max\(0, \(height - tall\) \/ 2\), lift \}\)/, 'the browser’s word is not placed by the shared rule')
    assert.match(gig, /className="gig-block-state gig-block-said"/)
    assert.match(gig, /data-said=\{shows\.middle \? 'yes' : undefined\}/)
    assert.match(gig, /data-at=\{shows\.middle \? shows\.at : undefined\} style=\{shows\.at === 'across' \? \{ top: `\$\{shows\.top\}px`, height: `\$\{shows\.height\}px` \} : undefined\}/)
    const css = read('src/styles.css')
    assert.match(css, /button\.gig-block \.gig-block-state\.gig-block-said \{[^}]*font-family: var\(--body\);[^}]*visibility: hidden;\s*\}/)
    assert.ok(!/button\.gig-block \.gig-block-state\.gig-block-said \{[^}]*left: 2px/.test(css), 'the moved word is drawn across the tile even where its corner has room')
    assert.match(css, /button\.gig-block \.gig-block-state\.gig-block-said\[data-at='across'\] \{\s*left: 2px;\s*right: 2px;\s*justify-content: center;\s*align-items: center;\s*\}/)
    assert.match(css, /button\.gig-block \.gig-block-state\.gig-block-said\[data-shown='yes'\] \{\s*visibility: visible;/)
    assert.match(css, /\.gig-block-icon\[data-said='yes'\] \{\s*visibility: hidden;/)
    /* Taken on the unlit tile's row, lit or not: the lift is the unlit edge's 2px less this tile's own, and the 2px is the stylesheet's. */
    assert.match(gig, /const lift = Math\.max\(0, UNLIT_EDGE - \(parseFloat\(getComputedStyle\(box\)\.borderTopWidth\) \|\| 0\)\)/)
    assert.match(gig, /const UNLIT_EDGE = 2\b/)
    assert.match(css, /button\.gig-block\.off \{\s*border: 2px solid/, 'the browser’s unlit edge is not the 2px the boost word is measured with')
    assert.match(css, /button\.gig-block \{[^}]*border: 1px solid var\(--rule\);/, 'the browser’s lit edge is not the 1px the lift makes up')
    /*
     * And there is room for it across every tile Play draws at 320 and 375,
     * every size: the phone's grid at each step (tileWidth), less the two
     * borders, against the widest of the three words at 11pt: "Boost
     * off", 48 points in Arial's measure (a phone's own font is near it) and
     * 56 in DejaVu Sans, a wide one, so 58 with room to spare. Fit's
     * narrowest tile is 56, the floor it never goes under.
     */
    const { SIZES } = await import('../src/lib/gigSize.js')
    const { tileWidth } = await import('../mobile/src/lib/tileGrid.js')
    const WIDEST_WORD = 58
    for (const screen of [320, 375]) {
      for (const size of SIZES) {
        const w = tileWidth(screen - 16 * 2, size.fx, 8, 3)
        assert.ok(w - 4 >= WIDEST_WORD, `${screen} wide at ${size.name}: a tile ${w} wide has no room across for the boost’s word`)
      }
    }
    assert.ok(56 - 4 >= 49, 'Fit’s narrowest tile has no room for the word in a phone’s own font')
  })

  /*
   * THE RULE, HELD TO NUMBERS. The phone's are an AMP tile on Play, measured
   * in the phone's own layout (react-native-web, the iOS face): 65.5 wide at
   * 320, 79 at 375 and 75.5 at 360 Small, its corner words 7 in, the row
   * ending at 15, the picture 14 square starting at 4, Boost off 48 wide and
   * the channel 8. In 1.87.49's first build the word went to the middle of
   * the tile at all three widths and the channel went with it; 1.87.48 showed
   * On and C at each. The browser's: 390 Medium, row bottom 19.8 and the
   * picture's top 18.9 on the unlit tile, a pixel higher and further in on
   * the lit one, whose edge is 1px to the unlit's 2px.
   */
  test('a word that must be seen keeps its corner, with the channel beside it where the row holds both, and lit or not is placed alike', async () => {
    const { mustSayFit } = await import('../shared/tile-corners.mjs')
    const phone = (width, more = {}) => ({ width, picture: 14, pictureTop: 4, bandBottom: 15, inset: 7, left: 48, right: 8, ...more })
    const at = (corners, moved = corners.left, extra = {}) => mustSayFit(corners, { moved, movedTop: corners.picture ? corners.pictureTop : 0, ...extra })
    /* The picture is cleared and the word stays in its corner; the channel beside it at 360 and 375. */
    assert.deepEqual(at(phone(79)), { left: false, right: true, at: 'corner' }, '375: the channel was crowded out by a word moved to the middle')
    assert.deepEqual(at(phone(75.5)), { left: false, right: true, at: 'corner' }, '360: the channel was crowded out')
    /* At 320 the two do not fit one row: the word stays, the channel goes, as cornerFit chooses for every tile. */
    assert.deepEqual(at(phone(65.5)), { left: false, right: false, at: 'corner' })
    /* Amp off is shorter, and has its channel at 320. */
    assert.deepEqual(at(phone(65.5, { left: 40 })), { left: false, right: true, at: 'corner' })
    /* Beside the picture where it fits there, as any corner word (a tall tile, its picture under the row). */
    assert.deepEqual(at(phone(83, { pictureTop: 20 })), { left: true, right: true, at: null })
    /* Pictures off: nothing to clear, the word in its corner and the channel left out where both do not fit. */
    assert.deepEqual(at(phone(65.5, { picture: 0 })), { left: true, right: false, at: null })
    /* A word too wide for its row (a large system text size): across the tile, the channel only where it clears it. */
    assert.deepEqual(at(phone(65.5, { left: 56 })), { left: false, right: false, at: 'across' })
    assert.deepEqual(at(phone(100, { left: 56 })), { left: false, right: true, at: 'corner' })
    /*
     * The browser's tile, the same placement lit and unlit: measured as
     * drawn, the lit tile's row ended under the picture's top and the unlit
     * one's above it, and every tap moved the word, the picture and the
     * channel. Boost on in the corner's face is 58, Boost off 65; moved, in
     * the body face, 42 and 46. The channel's pill is 18 with its padding.
     */
    const unlit = { width: 114, picture: 28, pictureTop: 18.9, bandBottom: 19.8, inset: 10, left: 65, right: 18, between: 8 }
    const lit = { ...unlit, bandBottom: 18.8, inset: 9, left: 58 }
    const onUnlit = mustSayFit(unlit, { moved: 46, movedTop: 20.9 })
    const onLit = mustSayFit(lit, { moved: 42, movedTop: 20.9, lift: 1 })
    assert.deepEqual(onUnlit, { left: false, right: true, at: 'corner' })
    assert.deepEqual(onLit, onUnlit, 'a tap changed where the boost’s word, the picture and the channel are')
    assert.notDeepEqual(mustSayFit(lit, { moved: 42, movedTop: 20.9 }), onUnlit, 'the bench no longer shows the lit tile’s own row placing the word apart')
    /* Across the tile, the channel is measured against where the word is drawn, not the picture's top: a word wholly under the row leaves the channel alone. */
    const narrow = { width: 60, picture: 28, pictureTop: 18.9, bandBottom: 19.8, inset: 10, left: 65, right: 10, between: 8 }
    assert.deepEqual(mustSayFit(narrow, { moved: 46, movedTop: 20.9 }), { left: false, right: true, at: 'across' })
    assert.deepEqual(mustSayFit(narrow, { moved: 46, movedTop: 18.9 }), { left: false, right: false, at: 'across' })
    /* The phone's copy is the shared one (npm run sync:rules). */
    const copy = await import('../mobile/src/lib/tile-corners.js')
    assert.deepEqual(copy.mustSayFit(phone(79), { moved: 48, movedTop: 4 }), at(phone(79)))
  })

  /*
   * A corner word the rule does not draw keeps its width out of the row. On
   * the phone it stayed in the row, unseen, and on a 320 phone with pictures
   * off "Boost off" was cut to "Boost…" beside a hidden channel letter's 8pt.
   * The browser's [data-crowded] word already gave its room away.
   */
  test('a corner word that is not drawn gives its room to the one that is, on the phone as in the browser', () => {
    const tile = flat('mobile/src/components/Tile.js')
    assert.match(tile, /const leftWord = \{ color: cornerInk, fontSize: font\.micro, fontWeight: '600', opacity: leftShown \? 1 : 0, \.\.\.\(leftShown \? null : \{ position: 'absolute', left: 0 \}\) \}/, 'a hidden word on the left keeps its room in the row')
    assert.match(tile, /const rightWord = \{ color: cornerInk, fontSize: font\.micro, fontWeight: '700', marginLeft: 'auto', opacity: rightShown \? 1 : 0, \.\.\.\(rightShown \? null : \{ position: 'absolute', right: 0 \}\) \}/, 'a hidden channel keeps its room in the row, or the channel leaves its corner')
    assert.match(read('src/styles.css'), /\.gig-block-state \[data-crowded\] \{\s*visibility: hidden;\s*min-width: 0;/)
  })

  /*
   * What the notes say about this change, where a reader acts on them. The
   * notes for the App Store's next review said the watch's pedal shows the
   * words, which it does not; the lock said an older computer sends "the
   * same frame, only later", leaving out the scene that waits behind it.
   */
  test('the notes say what the watch shows and what an older computer does after a boost', () => {
    const store = read('docs/app-store.md')
    const para = store.slice(store.indexOf("**For the next version's notes: the AM4's amp pedal is its boost**"), store.indexOf('### Notes for App Review, 1.87.11'))
    assert.ok(para.length > 200, 'the next version’s boost paragraph is gone')
    assert.match(para.replace(/\s+/g, ' '), /The watch shows no words: its AMP pedal is lit for Boost on and dark otherwise/)
    assert.ok(!/the watch and the browser, switches the amp's Out Boost and says Boost on/.test(para.replace(/\s+/g, ' ')), 'the review notes promise words on the watch')
    const lock = JSON.parse(read('desktop/forgefx.lock.json'))
    const why = lock._why.find((w) => /e2bfe70/.test(w))
    assert.ok(why, 'the lock says nothing of the boost tap commit')
    assert.match(why, /a scene or a preset tapped within 0\.6 s of a boost still goes out up to 0\.6 s late/)
    assert.ok(!/nothing on the phone waits for this/.test(why))
    assert.match(read('shared/versions.mjs').replace(/\s*\n\s*\*\s*/g, ' ').replace(/ +/g, ' '), /1\.87\.49 an AM4 amp's boost tap \(its pedal on Play\) goes out like a bypass \(ForgeFX \+am4boosttap\)\. Older, the boost still switches, but the computer holds its MIDI queue up to 0\.6 s after it, so a scene or a preset tapped in that time goes out that much late\. Degrades\./)
    assert.ok(!/same frame, only later/.test(read('shared/am4-boost.mjs')))
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
        /* `lag`: a read slow to come back, answered with the value it is handed (what the computer's copy held when it was asked). */
        if (unit.lag) {
          const lag = unit.lag
          unit.lag = null
          return ampParams(await lag)
        }
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
    assert.deepEqual({ ...ds.getSnapshot().boost, at: undefined }, { at: undefined, channel: 'A', on: false }, 'the boost was not read after the chain')
    assert.equal(ds.getSnapshot().boost.at, ds.boostKey(), 'the boost was kept for another load of the preset')
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
    assert.ok(ds.getSnapshot().boost?.at !== ds.boostKey(), 'a failed read was kept as an answer')
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

  /*
   * Two computers on one account, an FM3 on one and an AM4 on the other (his
   * own rig). Under Which unit, or at the launch's roll call, the AM4's chain
   * stays up until the new unit says what it is, and a write made in that
   * gap is held and handed to the new computer: an amp tap there went to the
   * FM3 as PUT /preset/blocks/58/params/150, Amp 1's setting 150 on a unit
   * nobody has read it on. Now the kept boost goes with the computer, and a
   * tap sends nothing until the new unit has said what it is.
   */
  test('browser: another computer driven, a boost tap sends nothing, reads nothing, and says why, until the new unit is read', async () => {
    const { calls } = am4()
    await ds.refreshBlocks()
    await settled()
    assert.equal(ds.boostNow(), 'off')
    ds.computerChanged()
    assert.equal(ds.getSnapshot().boost, null, 'the AM4’s boost stayed up over the next computer')
    assert.equal(ds.boostNow(), 'unknown')
    const before = calls.length
    await assert.rejects(ds.tapBoost(58), (e) => e.nothingSent === true && e.message === 'The unit is still being found, so the boost wasn’t sent. Try it again in a moment.')
    assert.deepEqual(calls.slice(before), [], 'a boost tap reached the next computer before it said what unit it has')
    /* And once it has (App's read: unitRead), the tap goes again. */
    ds.unitRead('am4', { demo: false })
    await ds.refreshBlocks()
    await settled()
    await ds.tapBoost(58)
    assert.deepEqual(calls.filter((c) => c[0] === 'setAmpBoost').at(-1)[2], { value: 1, continuous: false })
  })

  /*
   * A detect that finds no unit (a cable out for a moment, AM4-Edit holding
   * the port) made the live slug 'device', and the amp's pedal an ordinary
   * on and off whose tap was a bypass. The pedals are judged by the last
   * real unit while none is there, and a boost tap then sends nothing.
   */
  test('browser: while the computer says no unit is there, the AM4 amp’s pedal is still its boost and a tap sends nothing', async () => {
    const { unit, calls } = am4()
    ds.unitRead('am4', { demo: false })
    await ds.refreshBlocks()
    await settled()
    unit.slug = 'device'
    ds.unitRead('device', { demo: false })
    assert.equal(ds.getSnapshot().lastUnit, 'am4')
    assert.equal(ds.pedalOf(ds.getSnapshot().blocks.find((b) => b.effectId === 58)), 'boost', 'the amp’s pedal turned back into an on and off')
    const before = calls.length
    await assert.rejects(ds.tapBoost(58), (e) => e.nothingSent === true && e.message === 'The unit isn’t answering, so the boost wasn’t sent.')
    assert.deepEqual(calls.slice(before), [], 'a tap with no unit there sent something')
    const gig = flat('src/components/Gig.jsx')
    assert.match(gig, /pedalBoost\(pedalUnit\(deviceKey, lastUnit\), block, boostKept, boostKey\(\)\)/, 'the stage judges the amp by the live slug alone')
  })

  /*
   * A read on its way when the pedal is tapped answers with what the unit had
   * before the tap (the computer answers it out of its copy until the write
   * lands), and it was put over the tap: the tile said Boost off over a unit
   * that was boosted, and the next tap sent Boost on again.
   */
  test('browser: a boost read asked before a tap and answered after it is not put over the tap', async () => {
    const { unit, calls } = am4()
    await ds.refreshBlocks()
    await settled()
    assert.equal(ds.boostNow(), 'off')
    /* A scene's chain read asks the boost; it is slow to come back. */
    let answer
    const real = unit.boosts.A
    unit.lag = new Promise((go) => (answer = go))
    const reading = ds.refreshBoost()
    await ds.tapBoost(58)
    assert.equal(unit.boosts.A, 1)
    assert.equal(ds.boostNow(), 'on')
    answer(real)
    await reading
    await settled()
    assert.equal(ds.boostNow(), 'on', 'the read from before the tap put Boost off back over a boosted unit')
    /* And a tap waiting on a read in flight asks for no second read beside its write. */
    ds.set({ boost: null })
    let answer2
    unit.lag = new Promise((go) => (answer2 = go))
    const reads = unit.reads
    const reading2 = ds.refreshBoost()
    const tapping = ds.tapBoost(58)
    answer2(1)
    await reading2
    await tapping
    await settled()
    assert.equal(unit.reads, reads + 1, 'the tap that waited for a read asked for another beside its write')
    assert.equal(ds.boostNow(), 'off', 'the tap did not send the other way from what the read said')
  })

  test('browser: a tap whose read first lands on another preset or channel sends nothing there', async () => {
    const { unit, calls } = am4()
    await ds.refreshBlocks()
    await settled()
    ds.set({ boost: null })
    let answer
    unit.lag = new Promise((go) => (answer = go))
    const tapping = ds.tapBoost(58)
    /* Next, while the read is out. */
    ds.set({ preset: { number: 13, name: 'NEXT' } })
    answer(0)
    await assert.rejects(tapping, (e) => e.notThisChain === true)
    assert.ok(!calls.some((c) => c[0] === 'setAmpBoost'), 'a tap made on one preset was sent to the next')
  })

  /*
   * The demo answers as a computer that keeps a copy, so every chain read is
   * held to be judged, and the boost read after it was skipped and never
   * asked again: the demo's AM4 amp had no word on it until it was tapped.
   * A held read is judged in markJudged, which now reads the boost; a scene
   * that moves the amp to a channel whose boost is not known reads it too.
   */
  test('browser: a judged chain read and a scene that moves the amp’s channel read the boost, with no tap', async () => {
    const { unit, driver } = am4()
    driver.hostKeepsCopy = () => true
    driver.presetCopy = async () => ({ name: 'SONG', scenes: ['VERSE', 'CHORUS', '', ''] })
    driver.sceneState = async () => unit.chain.map((b) => ({ effectId: b.effectId, bypassed: b.bypassed, channel: b.channel }))
    await ds.retryChain()
    await settled()
    assert.equal(ds.boostNow(), 'off', 'a judged read never read the boost')
    assert.equal(unit.reads, 1)
    /* A scene that moves the amp to B, laid from the status read (the demo's road). */
    unit.chain.find((b) => b.effectId === 58).channel = 'B'
    await ds.refreshSceneState()
    await settled()
    assert.equal(ds.boostNow(), 'on', 'a scene that moved the amp to B left its boost unknown')
    assert.equal(unit.reads, 2)
    /* One that moves nothing reads nothing. */
    await ds.refreshSceneState()
    await settled()
    assert.equal(unit.reads, 2, 'a status read that moved nothing read the boost again')
  })

  test('browser: the hold tip says what the amp’s tap does on an AM4, in the shared words', async () => {
    const b = await import('../shared/am4-boost.mjs')
    assert.equal(b.playHintTap('am4'), b.PLAY_HINT_TAP_AM4)
    assert.equal(b.playHintTap('fm3'), 'A tap just switches it on and off.')
    assert.match(b.PLAY_HINT_TAP_AM4, /boost/)
    assert.match(b.PLAY_HINT_TAP_AM4, /in Edit/)
    const app = flat('src/App.jsx')
    assert.match(app, /<p className="play-hint"> \{\/\*[^]*?\*\/\} <span> \{PLAY_HINT_HOLD\} \{playHintTap\(currentDeviceSlug\(\)\)\} <\/span>/, 'the hold tip promises an AM4 player that a tap on the amp turns it off')
    /* And App's own first read of the chain reads the boost after it, or Play opened on an unread amp. */
    assert.match(app, /chainWasRead\(p\?\.number\) \/\*[^]*?\*\/ refreshBoost\(\)\.catch\(\(\) => \{\}\)/)
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

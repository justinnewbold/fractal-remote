/**
 * TWO THINGS FROM JUSTIN'S LOG OF 22 NOVEMBER 2026.
 *
 * ONE. Connect on the Bluetooth page, with no adapter kept for the unit,
 * waited about ten seconds with nothing on the page to say it was looking,
 * and he pressed it twice. The page says it is looking from the tap
 * (lib/bluetooth findAdapters `finding`, lib/searchWords), and a second tap
 * meanwhile starts nothing. The lib's half is run in test/bluetooth.mjs
 * ("Connect is looking from the tap…").
 *
 * TWO. After Turn off Bluetooth, with two computers on the account, the log
 * said "the computer is MacBook Pro …" and "the computer has a unit — AM4"
 * four seconds before "driving raspberry pi 3", whose AM4 it was. The read
 * of the computer's name is never held for the roll call (lib/relay
 * neverHeld), so the quicker computer answered it while the unit was read
 * off the one picked. A name is used only where it is the driven computer's
 * (lib/hostName, lib/link readMacName).
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { linkOnABench, stackOnABench } from './link-now.mjs'

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')
const flat = (s) => s.replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ').replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\s+/g, ' ')

export function run(test) {
  test('connect search: the line beside the turning circle says how long on Android, and never names the device', async () => {
    const w = await import('../mobile/src/lib/searchWords.js')
    assert.equal(w.searchingLine('android'), 'Looking for your adapter… this can take about ten seconds.')
    /* An iPhone or iPad has Apple's screen in front, and no ten-second search to promise. */
    assert.equal(w.searchingLine('ios'), 'Looking for your adapter…')
    for (const os of ['android', 'ios']) assert.doesNotMatch(w.searchingLine(os), /phone|iPad|tablet/i)
    assert.ok(!/^import /m.test(read('mobile/src/lib/searchWords.js')), 'the words import something')
  })

  test('connect search: the page draws the circle and the line from the tap to the end of the look, and nothing that starts a search is pressed meanwhile', () => {
    const page = flat(read('mobile/src/screens/Bluetooth.js'))
    assert.ok(page.includes("import { ActivityIndicator, Linking, Platform, Text, View } from 'react-native'"), 'React Native’s own turning circle, no package')
    /* From the tap (`finding`) through the ten-second look (`looking`), one word for both. */
    assert.ok(page.includes('const b = useBluetooth() const searching = b.finding || b.looking'))
    assert.ok(page.includes('{searching ? ( <View accessibilityRole="progressbar" accessibilityLabel={searchingLine(Platform.OS)}'))
    assert.ok(page.includes('<ActivityIndicator size="small" color={color.ble} /> <Text style={{ flex: 1, color: color.silk, fontSize: font.body, lineHeight: 22 }}>{searchingLine(Platform.OS)}</Text>'))
    /* Connect itself: Looking…, and not to be pressed. */
    assert.ok(page.includes("<Press label={searching ? 'Looking…' : offerMain ? OFFER_LOOK : 'Connect'}"))
    assert.ok(page.includes('disabled={!canStart || searching} onPress={start} />'))
    /* A tap that beats the redraw: the page's own guards, before anything is forgotten or asked. */
    assert.ok(page.includes('const start = () => { if (!canStart || searching) return'))
    assert.ok(page.includes('const finding = useRef(false) const find = async ({ cableFirst = true } = {}) => { if (searching || finding.current) return finding.current = true'))
    assert.ok(page.includes('try { pick = await findAdapters({ cableFirst }) } finally { finding.current = false }'))
    /* And every other button that starts one waits for it, as each did for the look alone. */
    const main = page.slice(page.indexOf('export default function BluetoothPage('), page.indexOf('function ResetCard('))
    assert.ok(!/disabled=\{b\.looking\}|\|\| b\.looking\}/.test(main), 'something on the page still goes by the look alone')
    assert.equal(main.split('disabled={searching}').length - 1, 5)
  })

  test('connect search: one search at a time in the lib, said from before its first question to after its last', () => {
    const lib = flat(read('mobile/src/lib/bluetooth.js'))
    assert.ok(
      lib.includes(
        "let findingNow = false export async function findAdapters(options = {}) { if (!ble()) return if (findingNow) { logDebug('ble', 'Connect asked again while it is already looking for the adapter: nothing more started') return } findingNow = true noteBluetooth({ finding: true }) try { return await findAdaptersOnce(options) } finally { findingNow = false noteBluetooth({ finding: false }) } }"
      )
    )
    assert.ok(lib.includes('looking: false, finding: false,'), 'the page’s first drawing has no `finding`')
  })

  test('whose name: only the driven computer’s is used; while the count has still to say which, an account that may have two waits', async () => {
    const { nameIsOf } = await import('../mobile/src/lib/hostName.js')
    const two = ['MacBook Pro SG 566', 'raspberry pi 3']
    /* One computer, every case of it: named at once, as it always was. */
    assert.equal(nameIsOf({ name: 'Studio', hosts: [], chosen: null, pending: true, mayBeTwo: false }), 'use')
    assert.equal(nameIsOf({ name: 'Studio', hosts: ['Studio'], chosen: null, pending: false, mayBeTwo: true }), 'use')
    assert.equal(nameIsOf({ name: 'Studio', hosts: [], chosen: null, pending: false, mayBeTwo: true }), 'use', 'a count that heard nobody holds the name back for good')
    /* An account whose record says it may have two, before the count: whoever was quicker is not named. */
    assert.equal(nameIsOf({ name: two[0], hosts: [], chosen: null, pending: true, mayBeTwo: true }), 'wait')
    assert.equal(nameIsOf({ name: two[0], hosts: ['Studio'], chosen: null, pending: true, mayBeTwo: true }), 'wait')
    /* Two heard: the one driven by its own name, and no other. */
    assert.equal(nameIsOf({ name: two[1], hosts: two, chosen: two[1], pending: true, mayBeTwo: true }), 'use')
    assert.equal(nameIsOf({ name: two[1], hosts: two, chosen: two[1], pending: false, mayBeTwo: false }), 'use')
    assert.equal(nameIsOf({ name: two[0], hosts: two, chosen: null, pending: true, mayBeTwo: false }), 'wait')
    assert.equal(nameIsOf({ name: two[0], hosts: two, chosen: two[1], pending: true, mayBeTwo: true }), 'wait')
    assert.equal(nameIsOf({ name: two[0], hosts: two, chosen: two[1], pending: false, mayBeTwo: true }), 'other')
    assert.equal(nameIsOf(), 'use')
    assert.ok(!/^import /m.test(read('mobile/src/lib/hostName.js')), 'the rule imports something')
  })

  test('whose name: his rig after Turn off Bluetooth: the MacBook is never named over the Pi’s AM4, in the log or on screen, and the Pi is once it is driven', async () => {
    /* The MacBook's FM3 answers first, every time; the Pi 3's AM4 is the one picked under Which unit. */
    const s = await stackOnABench({ pick: JSON.stringify({ accounts: { u1: { name: 'raspberry pi 3', many: true } } }) })
    const dump = (p) => /^\/preset\/(blocks|grid)$/.test(p.path)
    s.bench.computers = [
      { name: 'MacBook Pro SG 566', unit: 'FM3', version: '2.1.4', lag: (p) => (dump(p) ? 750 : 150) },
      { name: 'raspberry pi 3', unit: 'AM4', version: '2.3.7', lag: (p) => (dump(p) ? 2500 : 320) }
    ]
    const seen = []
    s.link.startLink()
    for (let t = 0; t < 15000; t += 50) {
      await s.clock.advance(50)
      const name = s.link.linkState().macName
      const unit = s.rig.getState().deviceName
      if (name && !seen.some((x) => x.name === name && x.unit === unit)) seen.push({ at: t, name, unit })
    }
    const log = s.lines()
    const said = log.join('\n')
    assert.ok(!seen.some((x) => x.name === 'MacBook Pro SG 566'), `the MacBook was on screen as the computer: ${JSON.stringify(seen)}\n${said}`)
    assert.ok(!log.some((l) => /the computer is MacBook Pro/.test(l)), said)
    /* What the log does say: the unit off the one picked, and that computer's own name once it is the one driven. */
    assert.ok(log.some((l) => /the computer has a unit — AM4/.test(l)), said)
    assert.ok(log.some((l) => /the computer is raspberry pi 3, v2\.3\.7/.test(l)), said)
    assert.equal(s.link.linkState().macName, 'raspberry pi 3')
    assert.equal(s.link.linkState().hostVersion, '2.3.7', 'the version beside the name is another computer’s')
    assert.equal(s.link.linkState().chosenHost, 'raspberry pi 3')
    assert.equal(s.rig.getState().deviceName, 'AM4')
    await s.link.stopLink()
  })

  test('whose name: a name that waited is asked for again when the count is over, one computer or two, and another computer’s is never put up', async () => {
    /* One computer answering tonight, on an account whose record says it may have two: named as soon as the count has heard one. */
    {
      const t = await linkOnABench()
      Object.assign(t.bench, { many: true, countPending: true, named: 'Studio' })
      t.bench.census = async () => {
        await new Promise((r) => t.clock.setTimeout(r, 3000))
        Object.assign(t.bench, { hosts: ['Studio'], chosen: null, countPending: false })
      }
      t.link.startLink()
      await t.clock.advance(1500)
      assert.equal(t.link.linkState().link, 'connected')
      assert.equal(t.link.linkState().macName, null, 'a name was put up before the count had said which computer is driven')
      assert.ok(t.bench.logged.includes('link a computer said its name before the count has said which one is driven: not used yet'), t.bench.logged.join(' | '))
      await t.clock.advance(3000)
      assert.equal(t.link.linkState().macName, 'Studio', 'the name that waited was never asked for again')
      assert.equal(t.link.linkState().hostVersion, '1.87.4')
      await t.link.stopLink()
    }
    /* Two, and the answer is the other computer's (a computer app too old to honour a name answers everything): the driven one's name stands, with no version of another's. */
    {
      const t = await linkOnABench()
      Object.assign(t.bench, { many: true, countPending: true, named: 'MacBook Pro' })
      t.bench.census = async () => {
        await new Promise((r) => t.clock.setTimeout(r, 3000))
        Object.assign(t.bench, { hosts: ['MacBook Pro', 'raspberry pi 3'], chosen: 'raspberry pi 3', askedOf: 'raspberry pi 3', countPending: false })
      }
      t.link.startLink()
      await t.clock.advance(6000)
      const st = t.link.linkState()
      assert.equal(st.macName, 'raspberry pi 3', 'another computer’s name is on screen as the one driven')
      assert.equal(st.hostVersion, null, 'another computer’s version is beside the driven one’s name')
      assert.ok(t.bench.logged.includes('link another computer than the one driven (raspberry pi 3) answered with its name: not used'), t.bench.logged.join(' | '))
      assert.ok(!t.bench.logged.some((l) => /the computer is MacBook Pro/.test(l)), t.bench.logged.join(' | '))
      /* And once it answers for itself, it is named in full. */
      t.bench.named = 'raspberry pi 3'
      await t.clock.advance(2 * 60 * 1000 + 10000)
      assert.equal(t.link.linkState().hostVersion, '1.87.4')
      assert.ok(t.bench.logged.includes('link the computer is raspberry pi 3, v1.87.4'), t.bench.logged.join(' | '))
      await t.link.stopLink()
    }
  })

  test('whose name: the link asks the rule with what the relay knows, and the relay says whether the count is still to come', () => {
    const link = flat(read('mobile/src/lib/link.js'))
    assert.ok(link.includes("const whose = nameIsOf({ name: String(name), hosts: remoteHosts(), chosen: remoteChosenHost(), pending: remoteCountPending(), mayBeTwo: remoteMayBeTwo() })"))
    assert.ok(link.includes("if (whose === 'wait') { nameWaits = remoteCountPending()"))
    assert.ok(link.includes('if (nameWaits && !named) readMacName() if (remoteHosts().length > 1 && remoteChosenHost() !== before) await refreshAll()'))
    assert.ok(link.includes("else if (running && state.link === 'connected' && nameWaits && !remoteCountPending()) await readMacName()"))
    const relay = flat(read('mobile/src/lib/relay.js'))
    assert.ok(relay.includes('export const remoteCountPending = () => !countTried || recountOwed || Boolean(counting && countingLink === session)'))
    /* The name's read is still never held: nothing here makes a one-computer account wait. */
    assert.ok(relay.includes("const neverHeld = (path) => path === '/healthz' || path === '/store/config/host.name'"))
  })
}

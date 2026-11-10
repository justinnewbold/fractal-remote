/**
 * CONNECT YOUR UNIT (mobile/src/lib/setupWays.js, components/SetupWays.js,
 * Settings → My rig): one row, first in My rig, opening the four ways,
 * Bluetooth first, each with its own steps; and the Raspberry Pi's steps in
 * the app, where before they were on the website only.
 *
 * The words file imports nothing, so it is run as it is.
 */
import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')
const flat = (s) => s.replace(/\s+/g, ' ')
const code = (src) => src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ')

async function words() {
  const src = read('mobile/src/lib/setupWays.js')
  assert.doesNotMatch(src, /^import /m, 'lib/setupWays imports something; this check runs it on its own')
  const dir = mkdtempSync(join(tmpdir(), 'setup-ways-'))
  try {
    writeFileSync(join(dir, 'package.json'), '{ "type": "module" }')
    writeFileSync(join(dir, 'setupWays.js'), src)
    return await import(pathToFileURL(join(dir, 'setupWays.js')).href)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

export function run(test) {
  test('Connect your unit: four ways, Bluetooth first, the device named, never this phone', async () => {
    const w = await words()
    const ways = w.connectWays('iPad')
    assert.deepEqual(ways.map((x) => x.key), ['adapter', 'cable', 'computer', 'pi'], 'the ways are not Bluetooth first, then the cable, the computer and the Pi')
    assert.match(ways[1].sub, /this iPad/)
    for (const noun of ['phone', 'iPad', 'tablet']) {
      const all = JSON.stringify([w.connectWays(noun), w.piSteps(noun), w.piTrouble(noun), w.piLead(noun)])
      assert.doesNotMatch(all, noun === 'phone' ? /this iPad|this tablet/ : /this phone/, `the words name the wrong device on a ${noun}`)
    }
    assert.equal(w.CONNECT_ROW, 'Connect your unit')
  })

  test('the row says how it is connected now, and names only the ways this copy draws', async () => {
    const { connectRowStatus: s } = await words()
    assert.equal(s({ bluetooth: true, cable: true }), 'USB cable')
    assert.equal(s({ bluetooth: true }), 'Bluetooth')
    assert.equal(s({ link: 'connected', macName: 'Studio Mac' }), 'Computer · Studio Mac')
    assert.equal(s({ link: 'connected' }), 'Computer')
    assert.match(s({ offered: true }), /^Bluetooth/, 'not connected, the row does not name Bluetooth first')
    assert.doesNotMatch(s({ offered: false }), /Bluetooth|USB/, 'a copy that does not offer Bluetooth names it on the row')
  })

  test('the Raspberry Pi page: four short steps, the guide one tap away, no Amazon link of its own, and the trademark line', async () => {
    const w = await words()
    const steps = w.piSteps('phone')
    assert.equal(steps.length, 4)
    for (const step of steps) assert.ok(step.body.split(/\s+/).length <= 30, `a Pi step is long: ${step.title}`)
    assert.equal(w.piTrouble('phone').length, 3)
    assert.equal(w.PI_GUIDE_URL, 'https://fractal.newbold.cloud/raspberry-pi')
    assert.equal(w.PI_BUY_URL, 'https://fractal.newbold.cloud/raspberry-pi#buy')
    assert.ok(existsSync(new URL('../public/raspberry-pi.html', import.meta.url)), 'the guide the page links to is gone')
    assert.match(read('public/raspberry-pi.html'), /id="buy"/, 'What to buy on the guide has lost its anchor')
    /* What to buy is the guide's, with the Associates sentence at its foot: the app links there, never to Amazon itself. */
    assert.doesNotMatch(read('mobile/src/lib/setupWays.js') + read('mobile/src/components/SetupWays.js'), /amazon\./i)
    assert.match(w.PI_TRADEMARK, /Raspberry Pi is a trademark of Raspberry Pi Ltd\./)
  })

  test('Settings → My rig opens on Connect your unit, over the Bluetooth row and Phone & computer, which stay', () => {
    const s = flat(code(read('mobile/src/screens/Settings.js')))
    const rig = s.slice(s.indexOf('<Group title="My rig" hint={pairStatus}>'), s.indexOf('<Group title="Help"'))
    const first = rig.indexOf('title={CONNECT_ROW}')
    assert.ok(first > 0, 'My rig has no Connect your unit row')
    assert.ok(first < rig.indexOf('<SetupRow title="Bluetooth"'), 'Connect your unit is not over the Bluetooth row')
    assert.ok(first < rig.indexOf('<SetupRow title={PAIR_TITLE}'), 'Connect your unit is not over Phone & computer')
    assert.match(rig, /onPress=\{\(\) => setPage\('setup'\)\}/)
    /* Its page: the adapter and the cable only where Bluetooth is offered; the computer to Connect a computer's steps; the Pi to its own page. */
    assert.match(s, /adapter: bluetoothOffered \? \(\) => setPage\('bluetooth'\) : null,/)
    assert.match(s, /cable: bluetoothOffered \? \(\) => setPage\('bluetooth'\) : null,/)
    assert.match(s, /computer: onOpenConnect \|\| \(\(\) => setPage\('link'\)\),/)
    assert.match(s, /pi: \(\) => setPage\('pi'\)/)
    assert.match(s, /\{page === 'pi' \? \( <> \{head\(PI_TITLE, 'back'\)\} <PiSetup \/>/)
    assert.match(s, /pi: 'setup', 'pi-trouble': 'trouble' \}/, 'the Pi page’s back does not go to Connect your unit')
    const ways = read('mobile/src/components/SetupWays.js')
    assert.match(ways, /filter\(\(w\) => typeof open\[w\.key\] === 'function'\)/, 'a way with nothing to open is drawn')
  })

  test('the new drawings are plain, square icons like the rest, and no maker’s logo is asked for', () => {
    for (const f of ['usb', 'board']) {
      const png = readFileSync(new URL(`../mobile/assets/icons/${f}.png`, import.meta.url))
      assert.equal(png.toString('ascii', 1, 4), 'PNG')
      assert.equal(png.readUInt32BE(16), 96)
      assert.equal(png.readUInt32BE(20), 96)
    }
    const ways = read('mobile/src/components/SetupWays.js')
    assert.match(ways, /const ICONS = \{ adapter: bluetoothIcon, cable: usbIcon, computer: laptopIcon, pi: boardIcon \}/)
    assert.doesNotMatch(ways, /icons\/(apple|windows|linux|raspberry|android)/i)
  })

  test('Troubleshooting asks how you are connected: the same four ways, in the same order, each to its own fixes, the one in use said', async () => {
    const w = await words()
    assert.deepEqual(w.troubleWays().map((x) => x.key), w.connectWays('phone').map((x) => x.key), 'Troubleshooting’s ways are not Connect your unit’s, in its order')
    assert.deepEqual(w.troubleWays().map((x) => x.title), w.connectWays('phone').map((x) => x.title))
    assert.equal(w.wayInUse({ bluetooth: true, cable: true }), 'cable')
    assert.equal(w.wayInUse({ bluetooth: true }), 'adapter')
    assert.equal(w.wayInUse({ link: 'connected' }), 'computer')
    assert.equal(w.wayInUse({ link: 'no-answer' }), null)
    assert.equal(w.PI_TROUBLE_URL, 'https://fractal.newbold.cloud/raspberry-pi#trouble')
    assert.match(read('public/raspberry-pi.html'), /id="trouble"/, 'If something goes wrong on the guide has lost its anchor')
    const s = flat(code(read('mobile/src/screens/Settings.js')))
    const trouble = s.slice(s.indexOf("{page === 'trouble' ? ("), s.indexOf("{page === 'link' ? ("))
    assert.match(trouble, /\{troubleWays\(\) \.filter\(\(w\) => troubleOpens\[w\.key\]\) \.map\(\(w\) => \( <SetupRow key=\{w\.key\} title=\{w\.title\} status=\{w\.key === inUse \? `\$\{IN_USE\} · \$\{w\.sub\}` : w\.sub\} onPress=\{troubleOpens\[w\.key\]\} \/>/)
    assert.ok(trouble.indexOf('TROUBLE_ASK') < trouble.indexOf('STILL_STUCK') && trouble.indexOf('STILL_STUCK') < trouble.indexOf('onPress={onOpenLog}'), 'the four ways are not first, then Still stuck? with the log')
    /* The adapter and the cable behind the Bluetooth gate, each telling the page which; the computer's are Fixes; the Pi its own page. */
    assert.match(s, /adapter: bluetoothOffered \? \(\) => \(setTroubleWay\('adapter'\), setPage\('bt-trouble'\)\) : null,/)
    assert.match(s, /cable: bluetoothOffered \? \(\) => \(setTroubleWay\('cable'\), setPage\('bt-trouble'\)\) : null,/)
    assert.match(s, /computer: onOpenFixes \|\| null, pi: \(\) => setPage\('pi-trouble'\)/)
    assert.match(s, /const inUse = demo \? null : wayInUse\(\{ bluetooth, cable, link \}\)/)
    /* Back from the Bluetooth page's troubleshooting goes where it was opened from, and the way is let go of off that page. */
    assert.match(s, /const upFrom = \(p\) => \(p === 'bt-trouble' && troubleWay \? 'trouble' : PARENT\[p\] \|\| null\)/)
    assert.match(s, /if \(page !== 'bt-trouble'\) setTroubleWay\(null\)/)
    assert.match(s, /\{page === 'pi-trouble' \? \( <> \{head\(PI_TROUBLE_PAGE, 'back'\)\} <PiTrouble onComputerFixes=\{onOpenFixes \|\| null\} \/>/)
    /* The cable's steps when asked about the cable, the adapter's when asked about the adapter, the kept way's otherwise; Forget stays the kept one's. */
    const page = flat(code(read('mobile/src/screens/Bluetooth.js')))
    assert.match(page, /export function BluetoothTrouble\(\{ onReport = null, way = null \}\)/)
    assert.match(page, /const cableWay = way === 'cable' \|\| \(way !== 'adapter' && cable\) const steps = cableWay \?/)
  })

  test('the shared fixes are short: no step past forty words, and the browser draws the same ones', async () => {
    const { FIXES } = await import('../shared/troubleshooting.mjs')
    for (const fix of FIXES) {
      assert.ok(fix.when.split(/\s+/).length <= 14, `“${fix.title}” has a long line under it`)
      for (const step of fix.steps) {
        /* The two shared lines (quit the editor, Windows' driver) are the setup steps' too, and held there. */
        if (/^Quit FM3-Edit|^Windows only:/.test(step)) continue
        assert.ok(step.split(/\s+/).length <= 40, `a step of “${fix.title}” is long: ${step}`)
      }
    }
  })
}

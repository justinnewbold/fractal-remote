/**
 * SWITCH UNIT IN ONE TAP, WHILE BLUETOOTH IS ON (mobile/src/lib/unitSwitch.js,
 * lib/bluetooth switchUnitNow, and the row on screens/Bluetooth.js).
 *
 * "Users need to be able to switch almost immediately from Bluetooth device
 * to a new Bluetooth device" (Justin, 19 November 2026, reports bf90bfd6 and
 * d9a2f5fe).
 *
 * What these hold: Bluetooth stops before the unit changes, every time; it
 * comes back on by itself only through the tapped unit's OWN adapter, and
 * only where that is another adapter, a Bluetooth one, and connected now;
 * and the row is drawn on the page that is up while Bluetooth is on.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')
const code = (s) => s.replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ').replace(/\/\*[\s\S]*?\*\//g, ' ')
const flat = (s) => code(s).replace(/\s+/g, ' ')

export function run(test) {
  /*
   * AN ADAPTER CONNECTED THAT THE APP CANNOT SEE. His third report of 19
   * November 2026: the FM3's WIDI Uhost connected to the iPhone, six trips
   * through Apple's screen with the app listing only the WIDI Master,
   * offline, and the app closed and opened again listed the Uhost at once,
   * already connected. After a second miss in a row on an iPhone the page
   * says that step; once is the ordinary "No adapter was connected".
   */
  test('an iPhone whose Apple’s screen closes twice with nothing the app can see is told to close the app and open it again', async () => {
    const w = await import('../mobile/src/lib/offerWords.js')
    assert.equal(w.SEEN_NOT_HERE_AFTER, 2)
    assert.match(w.SEEN_NOT_HERE, /close the app completely \(swipe it away\) and open it again/)
    assert.match(w.SEEN_NOT_HERE, /sometimes/, 'the page says it always happens, which nobody knows')
    assert.doesNotMatch(w.SEEN_NOT_HERE, /this phone|iPhone/)
    const page = flat(read('mobile/src/screens/Bluetooth.js'))
    assert.match(page, /const none = ios && !pick && !adapterDevices\(\)\.some\(\(d\) => !d\.offline\) if \(none\) setMissed\(true\) setMisses\(\(n\) => \(none \? n \+ 1 : 0\)\)/, 'a miss is not counted, or a find that worked does not start the count again')
    assert.ok(page.includes('{!b.on && missed && !b.adapter && !b.trouble && !b.said && ios && misses >= SEEN_NOT_HERE_AFTER ? <Note tone="warn">{SEEN_NOT_HERE}</Note> : null}'), 'the second miss says nothing more than the first')
  })

  test('unit switch: straight back on only through the tapped unit’s own adapter, another one, connected now', async () => {
    const { switchPlan, SWITCH_UNIT, SWITCH_UNIT_HINT } = await import('../mobile/src/lib/unitSwitch.js')
    const master = { id: 'm1', name: 'WIDI Master Bluetooth' }
    const uhost = { id: 'u1', name: 'WIDI Uhost Bluetooth' }
    const both = [{ id: 'm1', offline: false }, { id: 'u1', offline: false }]

    /* His own rig as it should go: the AX3 on the Master, the FM3's Uhost connected too. */
    assert.equal(switchPlan({ using: master, kept: uhost, devices: both }), 'on')
    /* And as it was on 19 November: the Uhost not connected to the iPhone at all, or listed and offline. */
    assert.equal(switchPlan({ using: master, kept: uhost, devices: [{ id: 'm1', offline: false }] }), 'off')
    assert.equal(switchPlan({ using: master, kept: uhost, devices: [{ id: 'm1', offline: false }, { id: 'u1', offline: true }] }), 'off')
    /* No adapter kept for the unit tapped: Connect finds one. */
    assert.equal(switchPlan({ using: master, kept: null, devices: both }), 'off')
    /* THE SAME ADAPTER IS NEVER GONE STRAIGHT BACK TO: the new unit's messages would go to whatever the last one was on (an AM4 froze on that once). */
    assert.equal(switchPlan({ using: master, kept: { id: 'm1' }, devices: both }), 'off')
    /* Nor a unit on a USB cable, which Connect has its own rules for. */
    assert.equal(switchPlan({ using: master, kept: uhost, devices: both, cable: true }), 'off')
    /* With nothing in use (the adapter had gone), the tapped unit's own, connected, is still used. */
    assert.equal(switchPlan({ using: null, kept: uhost, devices: both }), 'on')
    for (const bad of [undefined, {}, { kept: {} }, { kept: uhost, devices: null }, { kept: uhost, devices: [null, 5] }]) assert.equal(switchPlan(bad), 'off')

    assert.equal(SWITCH_UNIT, 'Switch unit')
    assert.doesNotMatch(SWITCH_UNIT_HINT, /this phone|instantly|always/i)
    assert.match(SWITCH_UNIT_HINT, /Bluetooth stops first/)
  })

  test('unit switch: Bluetooth is stopped before the unit changes, and the row is on the page that is up while it is on', async () => {
    const lib = flat(read('mobile/src/lib/bluetooth.js'))
    const at = lib.indexOf('export function switchUnitNow(key) {')
    assert.ok(at > 0, 'switchUnitNow is gone')
    const fn = lib.slice(at, lib.indexOf('export function adapterKeptFor', at))
    /* Refused for a unit not offered or already picked, before anything is touched. */
    assert.match(fn, /^export function switchUnitNow\(key\) \{ if \(!UNIT_KEYS\.includes\(key\) \|\| !offered\(key\) \|\| key === saved\.unit\) return null/)
    /* Off, then the unit, then the plan, in that order; on only by the plan. */
    const off = fn.indexOf('setBluetooth(false)')
    const unit = fn.indexOf('setBluetoothUnit(key)')
    const plan = fn.indexOf('switchPlan({ using, kept, devices: adapterDevices(), cable: !!kept && isCable(kept) })')
    const on = fn.indexOf('setBluetooth(true)')
    assert.ok(off > 0 && off < unit && unit < plan && plan < on, 'Bluetooth is not stopped before the unit changes, or comes on before the plan')
    assert.match(fn, /const using = saved\.adapter setBluetooth\(false\)/, 'the adapter in use is not read before it is let go of')
    assert.match(fn, /if \(plan !== 'on'\) return 'off' return setBluetooth\(true\) \? 'on' : 'off'/)
    assert.equal(fn.split('setBluetooth(true)').length - 1, 1)
    /* Never carried: the last unit's adapter stays the last unit's. */
    assert.ok(!fn.includes('carry'), 'the adapter in use is carried to the unit tapped')

    const page = flat(read('mobile/src/screens/Bluetooth.js'))
    assert.match(page, /const switchTo = \(key\) => \{ if \(!canStart \|\| key === b\.unit\) return if \(switchUnitNow\(key\) === 'on'\) arm\(\) \}/)
    const row = '<SwitchUnits units={units} picked={b.unit} onPick={switchTo} />'
    assert.match(page, /function SwitchUnits\(\{ units, picked, onPick \}\) \{ return <Tabs name=\{SWITCH_UNIT\} items=\{Array\.from\(units, \(u\) => \(\{ key: u\.key, label: u\.name \}\)\)\} picked=\{picked\} onPick=\{onPick\} \/> \}/)
    assert.equal(page.split(row).length - 1, 1, 'the switch row is not drawn once')
    /* In the half drawn while it is on: after the line that names the unit, before Stop. */
    const named = page.indexOf('Tap Stop to change it.')
    const stop = page.indexOf('<Press label={stop.label} sub={stop.sub} height={52} onPress={() => setBluetooth(false)} />')
    assert.ok(named > 0 && page.indexOf(row) > named && page.indexOf(row) < stop, 'the switch row is not with the unit’s line, over Stop')
    assert.ok(page.includes('<Hint>{SWITCH_UNIT_HINT}</Hint>'))
    /* And step 1's own chips are still shut while it is on: this row is the only way to another unit there. */
    assert.equal((page.match(/<UnitChips units=\{units\} picked=\{b\.unit\} disabled=\{b\.on\} \/>/g) || []).length, 3)
  })
}

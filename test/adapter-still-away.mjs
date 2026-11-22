/**
 * THE WAITING SCREEN, AFTER A LOOK THAT DID NOT BRING THE ADAPTER BACK
 * (mobile/src/lib/offerWords.js stillAwaySteps, components/AdapterStillAway,
 * and the count in App.js). Report 934e02be, 22 November 2026.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')
const flat = (s) => s.replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ').replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\s+/g, ' ')

export function run(test) {
  test('adapter still away: the steps restart the adapter by what powers it, and closing the app comes first, always', async () => {
    const w = await import('../mobile/src/lib/offerWords.js')
    const first = w.stillAwaySteps({ adapter: 'MD-BT01 Bluetooth', unit: 'fm9', misses: 1 })
    assert.deepEqual(first.map((s) => s.key), ['close', 'restart', 'forget', 'taken'])
    assert.match(first[1].text, /Pull the MD-BT01’s two plugs out of the FM9, wait 10 seconds/)
    assert.match(first[1].text, /Check the unit is switched on\./)
    const second = w.stillAwaySteps({ adapter: 'MD-BT01 Bluetooth', unit: 'fm9', misses: 2 })
    assert.deepEqual(second.map((s) => s.key), ['close', 'restart', 'forget', 'taken'])
    /* A Uhost is restarted by its USB power, never its plugs; an adapter the app has no kind for by the general words. */
    assert.match(w.stillAwaySteps({ adapter: 'WIDI Uhost Bluetooth', unit: 'fm3' })[1].text, /Unplug the WIDI Uhost’s USB power/)
    assert.match(w.stillAwaySteps({ adapter: 'Some Box', unit: 'am4' })[1].text, /Switch the adapter off for 10 seconds/)
    assert.match(w.stillAwayHead('MD-BT01 Bluetooth', 'iPad'), /^MD-BT01 Bluetooth still isn’t connected to this iPad\./)
    for (const s of [...first, ...second]) assert.doesNotMatch(s.text, /this phone|never|not tried/i)
  })

  test('adapter still away: counted only when Apple’s screen was opened and the adapter is still away, and drawn only while it is gone', () => {
    const app = flat(read('mobile/App.js'))
    assert.ok(app.includes("const findAgain = async () => { const opened = opensApplesScreen() await lookForAdapterAgain(onRetry) if (!opened) return if (adapterAway()) { setLookMisses((n) => n + 1)"))
    assert.ok(app.includes('} else setLookMisses(0) }'))
    assert.ok(app.includes("{gone && link.link !== 'connected' && lookMisses > 0 ? <AdapterStillAway adapter={link.macName} unit={keptUnit} misses={lookMisses} /> : null}"))
    assert.equal(app.split('onPress={findAgain}').length - 1, 2, 'both Look for the adapter again buttons count')
    const card = flat(read('mobile/src/components/AdapterStillAway.js'))
    assert.ok(card.includes("if (Platform.OS !== 'ios' || !(misses >= 1)) return null"), 'an iPhone or iPad only')
    assert.ok(card.includes("{s.key === 'close' ?"), 'how to close the app is said under that step')
  })
}

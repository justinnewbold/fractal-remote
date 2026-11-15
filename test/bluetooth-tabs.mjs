/**
 * BLUETOOTH SETUP AND TROUBLESHOOTING, BY UNIT AND BY ADAPTER (the tabs on
 * How to connect my Bluetooth device and on Troubleshooting Bluetooth,
 * mobile/src/screens/Bluetooth.js, with the words in
 * shared/bluetooth-gear.mjs).
 *
 * "For Bluetooth set up guides and trouble shooting let's add Bluetooth
 * device specific as well as the fractal units specific trouble shooting
 * with tabs so we don't have to sort through so much information not
 * relevant to the unit and device they are using. In addition to what we
 * already confirmed works, I have now confirmed that from a user that The
 * Yamaha B101 works also in addition to the WIDIJack that works but gets
 * hot. So On the FM3 Instead of saying NEVER use a different Bluetooth
 * device, just have a warning that devices on the FM3 may overheat and to
 * use at their own risk." (Justin, 15 November 2026.)
 *
 * What these hold: which adapters each unit has a tab for; which tab opens;
 * that the fixes under a tab are that adapter's and that unit's, and name
 * no other adapter; that a tab only changes what is read; and that the
 * FM3's warning is drawn, red, over every one of its tabs.
 *
 * The FM3's rule itself (nothing refused by name, the words of the warning)
 * is held in test/bluetooth.mjs, with the tests that held the old one.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')
const code = (s) => s.replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ').replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ')
const flat = (s) => s.replace(/\s+/g, ' ')
const gearFile = () => import('../shared/bluetooth-gear.mjs')

const UNITS = ['am4', 'vp4', 'fm3', 'fm9', 'axefx3']
const NAMES = { am4: 'AM4', vp4: 'VP4', fm3: 'FM3', fm9: 'FM9', axefx3: 'Axe-Fx III' }
/* What each adapter's own lines may call an adapter, and so what no other tab's lines may. */
const SAYS = { master: /WIDI Master/, jack: /WIDI Jack|\bthe Jack\b/, uhost: /Uhost|C2MIDI|U2MIDI/, mdbt01: /MD-BT01|Yamaha/ }

export function run(test) {
  test('Bluetooth tabs: each unit has a tab for each adapter the app has steps for, in its order, and Troubleshooting one more for any other', async () => {
    const g = await gearFile()
    const keys = (unit, opts) => g.adapterTabsFor(unit, opts).map((t) => t.key)
    assert.deepEqual(keys('am4'), ['master', 'jack', 'uhost'])
    assert.deepEqual(keys('vp4'), ['master', 'jack', 'uhost'])
    /* The FM3: the one that stays cool first, then the customer's two (15 November 2026). No WIDI Master: on his it got very hot and did not work, so there are no steps to give. */
    assert.deepEqual(keys('fm3'), ['uhost', 'mdbt01', 'jack'])
    assert.deepEqual(keys('fm9'), ['master', 'jack', 'uhost', 'mdbt01'])
    assert.deepEqual(keys('axefx3'), ['master', 'jack', 'uhost', 'mdbt01'])
    /* Yamaha's MD-BT01 has 5-pin plugs: never a tab on the two units with 3.5 mm jacks. */
    for (const unit of ['am4', 'vp4']) assert.ok(!keys(unit, { other: true }).includes('mdbt01'), `${unit} is offered an adapter that does not fit its jacks`)
    /* The tabs are the ways, one for one, and wear the adapter's short name. */
    for (const unit of UNITS) {
      assert.deepEqual(keys(unit), g.waysFor(unit).map((w) => w.key), unit)
      for (const tab of g.adapterTabsFor(unit, { other: true })) assert.equal(tab.label, g.ADAPTER_TABS[tab.key], `${unit} ${tab.key}`)
      /* Troubleshooting's one more, last: somebody's adapter may be none of these. */
      assert.deepEqual(keys(unit, { other: true }), [...keys(unit), 'other'], unit)
      /* Short enough to be buttons: no tab is a sentence. */
      for (const tab of g.adapterTabsFor(unit, { other: true })) assert.ok(tab.label.length <= 16, `${tab.label} is too long for a tab`)
    }
    /* No unit picked, or one the app does not know: no adapter tabs on How to connect. */
    assert.deepEqual(g.adapterTabsFor(null), [])
    assert.deepEqual(g.adapterTabsFor('nope'), [])
  })

  test('Bluetooth tabs: the tab that opens is the one tapped, else the kept adapter’s own by its name, else the first', async () => {
    const g = await gearFile()
    const fm9 = g.adapterTabsFor('fm9')
    const fm3 = g.adapterTabsFor('fm3')
    const fm3Trouble = g.adapterTabsFor('fm3', { other: true })
    /* Nothing kept, nothing tapped: the unit's first. */
    assert.equal(g.adapterTabFor(fm9), 'master')
    assert.equal(g.adapterTabFor(fm3), 'uhost')
    assert.equal(g.adapterTabFor(fm9, {}), 'master')
    /* The adapter kept from last time, by the name the phone gave it: its owner lands on their own adapter. */
    assert.equal(g.adapterTabFor(fm9, { name: 'WIDI Jack Bluetooth' }), 'jack')
    assert.equal(g.adapterTabFor(fm9, { name: 'MD-BT01' }), 'mdbt01')
    assert.equal(g.adapterTabFor(fm3, { name: 'WIDI Jack' }), 'jack')
    assert.equal(g.adapterTabFor(fm3, { name: 'WIDI Uhost Bluetooth' }), 'uhost')
    /* A tap wins over what is kept. */
    assert.equal(g.adapterTabFor(fm9, { asked: 'uhost', name: 'WIDI Jack' }), 'uhost')
    /* A tab tapped on another unit, that this unit has not got: the kept adapter's, else the first. Never a tab that is not drawn. */
    assert.equal(g.adapterTabFor(fm3, { asked: 'master' }), 'uhost')
    assert.equal(g.adapterTabFor(fm3, { asked: 'master', name: 'WIDI Jack' }), 'jack')
    /*
     * A kept adapter the unit has no tab for: a WIDI Master kept for an FM3,
     * or an adapter of a make the app has no steps for. Troubleshooting
     * opens on Another adapter; How to connect, which has no such tab, on
     * the first.
     */
    assert.equal(g.adapterTabFor(fm3Trouble, { name: 'WIDI Master' }), 'other')
    assert.equal(g.adapterTabFor(fm3Trouble, { name: 'Bluetooth MIDI' }), 'other')
    assert.equal(g.adapterTabFor(fm3, { name: 'WIDI Master' }), 'uhost')
    assert.equal(g.adapterTabFor(fm3, { name: 'Bluetooth MIDI' }), 'uhost')
    /* An adapter with no name is not "another adapter": nothing is known of it. */
    for (const name of ['', null, undefined]) assert.equal(g.adapterTabFor(fm3Trouble, { name }), 'uhost')
    /* No tabs: no tab. */
    assert.equal(g.adapterTabFor([]), null)
    assert.equal(g.adapterTabFor([], { asked: 'uhost', name: 'WIDI Uhost' }), null)
    /* Whatever it is asked, the answer is one of the tabs drawn. */
    for (const unit of UNITS) {
      for (const other of [false, true]) {
        const tabs = g.adapterTabsFor(unit, { other })
        for (const asked of [null, 'master', 'jack', 'uhost', 'mdbt01', 'other', 'nope']) {
          for (const name of [null, 'WIDI Master', 'WIDI Jack', 'WIDI Uhost', 'MD-BT01', 'BLE MIDI']) {
            assert.ok(tabs.some((t) => t.key === g.adapterTabFor(tabs, { asked, name })), `${unit}: ${asked} / ${name} opens a tab that is not drawn`)
          }
        }
      }
    }
  })

  test('Bluetooth tabs: the fixes under a tab are that adapter’s on that unit, and name no other adapter', async () => {
    const g = await gearFile()
    for (const unit of UNITS) {
      for (const { key } of g.adapterTabsFor(unit, { other: true })) {
        const own = g.troubleFor(unit, key, 'iPad')
        assert.deepEqual(Object.keys(own), ['lit', 'plugs', 'typeA', 'before'], `${unit} ${key}`)
        const lines = Object.values(own).filter(Boolean)
        for (const line of lines) assert.equal(typeof line, 'string', `${unit} ${key}: the page is handed something it cannot draw`)
        const said = lines.join(' ')
        /* What is lit, and where the plugs go, for every adapter on every unit. */
        assert.ok(own.lit && own.plugs, `${unit} ${key}: no line for its light or its plugs`)
        /* NOT RELEVANT TO THE DEVICE THEY ARE USING: no other adapter is named under this one's tab. */
        for (const [other, names] of Object.entries(SAYS)) {
          if (other !== key) assert.equal(said.match(names)?.[0] ?? null, null, `${unit}, under ${key}: another adapter is named`)
        }
        /* And its own is, except under the tab for any other. */
        if (key !== 'other') assert.match(said, SAYS[key], `${unit} ${key}: its lines never say which adapter they are about`)
        /* NOT RELEVANT TO THE UNIT: no other unit is named. */
        for (const u of UNITS) {
          if (u !== unit) assert.ok(!said.includes(NAMES[u]), `${unit}, under ${key}: says something of the ${NAMES[u]}`)
        }
        /* The words' own rules: nothing says what was tried, the device in hand is named as it is, and it is the app's spelling. */
        assert.doesNotMatch(said, /tried|tested|\bworks\b/i, `${unit} ${key}`)
        assert.doesNotMatch(said, /this phone|your phone/i, `${unit} ${key}: an iPad’s owner is told of a phone`)
        assert.doesNotMatch(said, /colour|whilst|grey\b/i)
        /* Type A is the 3.5 mm jacks' question: asked on an AM4 and a VP4, never on a unit with 5-pin jacks. */
        assert.equal(!!own.typeA, unit === 'am4' || unit === 'vp4', `${unit} ${key}: Type A`)
        /* An Axe-Fx III has a THRU jack beside its OUT, and the plug in it hears only itself: every adapter's plug line says so. */
        if (unit === 'axefx3') assert.match(own.plugs, /THRU/, `${key}: the Axe-Fx III’s THRU jack is not said`)
        else assert.ok(!/(?:not|never) THRU/.test(own.plugs), `${unit} ${key}: warned off a THRU jack it has not got apart`)
        /* A VP4 sends nothing back over Bluetooth: its owner cannot see it "not answer". */
        if (unit === 'vp4') assert.ok(!/answer/.test(said), `${key}: a VP4’s owner is told it doesn’t answer`)
      }
      /* The firmware line: the adapters with an app to update them with, and no other. */
      assert.equal(g.troubleFor(unit, 'uhost').before, g.FIRST_TIME)
      assert.equal(g.troubleFor(unit, 'master').before, g.FIRST_TIME_ADAPTER)
      assert.equal(g.troubleFor(unit, 'jack').before, g.FIRST_TIME_ADAPTER)
      assert.equal(g.troubleFor(unit, 'mdbt01').before, null, 'Yamaha’s adapter has no app to update it with')
      assert.equal(g.troubleFor(unit, 'other').before, null)
      /* A kind the app does not know reads as any other adapter, never as nothing. */
      assert.deepEqual(g.troubleFor(unit, 'nope'), g.troubleFor(unit, 'other'))
      assert.deepEqual(g.troubleFor(unit, null), g.troubleFor(unit, 'other'))
    }
    /* The FM3's cable is the U2MIDI Pro, every other unit's the C2MIDI Pro: the one in its steps. */
    assert.match(g.troubleFor('fm3', 'uhost').plugs, /^With the U2MIDI Pro,/)
    for (const unit of ['am4', 'vp4', 'fm9', 'axefx3']) assert.match(g.troubleFor(unit, 'uhost').plugs, /^With the C2MIDI Pro,/, unit)
    /* A VP4 on the Uhost has one plug in, as its steps say (the app only sends to it). */
    assert.equal(g.troubleFor('vp4', 'uhost').plugs, 'With the C2MIDI Pro, only the black plug goes in: into the adapter in the VP4’s MIDI IN. The white plug stays out.')
    assert.match(g.troubleFor('vp4', 'other').plugs, /^The adapter has to reach the VP4’s MIDI IN: the app only sends to a VP4/)
    assert.ok(!g.troubleFor('vp4', 'other').plugs.includes('both ways'), 'a VP4’s owner is told the adapter has to carry MIDI both ways')
    /* The device in hand, wherever it is named. */
    /*
     * A WIDI MASTER AND AN MD-BT01 TAKE THEIR POWER FROM THE PLUG IN MIDI
     * OUT, so "if the unit doesn't answer, swap the two plugs" after a right
     * fit takes it away. The WIDI Master's line says which plug goes where
     * and stops; the MD-BT01's is told by its lamp. On How to connect as in
     * Troubleshooting, so the two pages do not disagree.
     */
    for (const unit of UNITS) {
      assert.ok(!/swap/.test(g.troubleFor(unit, 'master').plugs), `${unit}: a WIDI Master’s owner is told where each plug goes, then to swap them`)
      assert.match(g.troubleFor(unit, 'master').plugs, /^A WIDI Master needs both of its plugs in: the larger one, with the light, in MIDI OUT/)
      assert.match(g.troubleFor(unit, 'mdbt01').plugs, /If the lamp stays off with the [A-Za-z0-9 -]+ on, swap the two plugs\.$/, unit)
    }
    for (const unit of ['fm3', 'fm9', 'axefx3']) {
      const md = g.waysFor(unit).find((w) => w.key === 'mdbt01')
      assert.ok(!/answer/.test(md.steps.join(' ')), `${unit}: the MD-BT01’s steps swap its plugs on the unit not answering`)
      assert.match(md.steps[1], /its lamp flashes\. If the lamp stays off, swap the two plugs\./, unit)
    }
    /* A VP4 is only ever sent to: How to connect says what its owner can see, in the words Troubleshooting uses, for every adapter. */
    for (const way of g.waysFor('vp4', 'iPad')) {
      const said = [way.title, way.sub, way.before, ...way.steps].filter(Boolean).join(' ')
      assert.ok(!/doesn’t answer|isn’t answering/.test(said), `VP4, ${way.title}: its owner is told to wait for an answer that never comes`)
    }
    for (const key of ['master', 'jack']) {
      assert.match(g.waysFor('vp4').find((w) => w.key === key).steps.join(' '), /If presets don’t change on the VP4, swap the two plugs\./, key)
      assert.match(g.waysFor('am4').find((w) => w.key === key).steps.join(' '), /If the unit doesn’t answer, swap the two plugs\./, key)
    }
    assert.match(g.troubleFor('fm9', 'mdbt01', 'tablet').lit, /stays lit once this tablet has connected to it/)
    assert.match(g.troubleFor('fm9', 'mdbt01').lit, /stays lit once this phone has connected to it/)
    /* Yamaha's own words for it (its manual): the lamp flashes with the instrument on, MIDI OUT is its only power, the plugs go by their arrows. */
    assert.equal(g.troubleFor('fm9', 'mdbt01').lit, 'Check the MD-BT01’s lamp. It flashes once the FM9 is on, and stays lit once this phone has connected to it. It takes its power from the FM9’s MIDI OUT and has no other way to be powered.')
    assert.equal(g.troubleFor('fm9', 'mdbt01').plugs, 'Its two plugs go in the FM9’s MIDI IN and MIDI OUT/THRU, matching the arrows on them. If the lamp stays off with the FM9 on, swap the two plugs.')
    /* No unit picked yet: what is true of any adapter, and "the unit". */
    assert.deepEqual(g.troubleFor(null, 'other'), {
      lit: 'Check the adapter is lit, and has the power it needs.',
      plugs: `${g.BOTH_WAYS} If the unit doesn’t answer, swap the two plugs.`,
      typeA: null,
      before: null
    })
    /* An FM3's fixes carry no "never": its warning is the red note over them. */
    for (const { key } of g.adapterTabsFor('fm3', { other: true })) {
      assert.doesNotMatch(Object.values(g.troubleFor('fm3', key)).filter(Boolean).join(' '), /\bnever\b/i, `fm3 ${key}`)
    }
  })

  test('Bluetooth tabs: How to connect draws one adapter under the tabs, Troubleshooting that adapter’s fixes, and a tab changes nothing but what is read', async () => {
    const src = read('mobile/src/screens/Bluetooth.js')
    const page = flat(src)
    const bare = flat(code(src))
    const trouble = bare.slice(bare.indexOf('export function BluetoothTrouble('), bare.indexOf('export function BluetoothLimits('))
    const ways = bare.slice(bare.indexOf('export function BluetoothWays('), bare.indexOf('function Way('))
    assert.ok(trouble.length > 500 && ways.length > 500)

    /* TROUBLESHOOTING: the unit's own tabs, then the adapter's, then the list. */
    assert.match(trouble, /const tabs = cableWay \|\| !b\.unit \? \[\] : adapterTabsFor\(b\.unit, \{ other: true \}\) const \[tab, setTab\] = useAdapterTab\(tabs, b\.adapter\) const own = troubleFor\(b\.unit, tab \|\| 'other', deviceNoun\(\)\)/)
    /* The list: the adapter's light first, its plugs and Type A in their old places, its firmware among the settings, then what is true of every adapter. */
    assert.match(
      trouble,
      /: \[ own\.lit, `Check Bluetooth is on, and allowed for Fractal Remote in the \$\{deviceNoun\(\)\}’s Settings\.`, own\.plugs, own\.typeA, settings, midi, own\.before, ONE_AT_A_TIME, CLOSE_AND_REOPEN, ios \?/
    )
    assert.match(trouble, /ANOTHER_UNIT, fm3 \]\.filter\(Boolean\)/)
    /* Nothing of another adapter is in the list any more: the lines that named every adapter at once are gone from the page. */
    assert.ok(!/TROUBLE_LIT|swapLine|BOTH_WAYS|FIRST_TIME|PLUGS_SWAP/.test(trouble), 'Troubleshooting lists a line that is not the picked adapter’s')
    for (const name of ['WIDI Master', 'WIDI Jack', 'Uhost', 'C2MIDI', 'U2MIDI', 'MD-BT01']) assert.ok(!trouble.includes(name), `Troubleshooting names the ${name} whatever tab is picked`)
    /* The unit: the same chips as the Bluetooth page, which are the real pick, and so shut while Bluetooth is on. */
    assert.match(trouble, /\{cableWay \? null : \( <View style=\{\{ gap: space\.sm \}\}> <Heading>Your unit<\/Heading> <UnitChips units=\{units\} picked=\{b\.unit\} disabled=\{b\.on\} \/> \{b\.on \? <Hint>To change the unit, tap Stop on the Bluetooth page first\.<\/Hint> : null\} \{!b\.unit \? <Hint>Pick your unit to see what applies to it\.<\/Hint> : null\} <\/View> \)\}/)
    assert.match(trouble, /\{tabs\.length \? \( <View style=\{\{ gap: space\.sm \}\}> <Heading>Your adapter<\/Heading> <Tabs name="Your adapter" items=\{tabs\} picked=\{tab\} onPick=\{setTab\} \/> <\/View> \) : null\}/)
    /* The order on the screen: unit, adapter, the FM3's warning, the fixes. */
    const at = (what) => {
      const i = trouble.indexOf(what)
      assert.ok(i > 0, `Troubleshooting does not draw ${what}`)
      return i
    }
    assert.ok(at('<Heading>Your unit</Heading>') < at('<Heading>Your adapter</Heading>'))
    assert.ok(at('<Heading>Your adapter</Heading>') < at('{!cableWay && warningFor(b.unit) ? <Note tone="fault">{warningFor(b.unit)}</Note> : null}'))
    assert.ok(at('{!cableWay && warningFor(b.unit) ? <Note tone="fault">{warningFor(b.unit)}</Note> : null}') < at('{steps.map('))
    /* A unit on a USB cable keeps the cable's own list, with no unit or adapter tabs over it and no adapter's heat warning. */
    assert.match(trouble, /const steps = cableWay \? \[\.\.\.cableSteps\(deviceNoun\(\), \{ jacks \}\)/)

    /* HOW TO CONNECT: the same two rows, and one adapter under them. */
    assert.match(ways, /<Heading>Your unit<\/Heading> <UnitChips units=\{units\} picked=\{b\.unit\} disabled=\{b\.on\} \/>/)
    assert.match(ways, /const tabs = adapterTabsFor\(b\.unit\) const \[tab, setTab\] = useAdapterTab\(tabs, b\.adapter\) const way = ways\.find\(\(w\) => w\.key === tab\) \|\| null/)
    assert.match(ways, /<Tabs name="Your adapter" items=\{tabs\} picked=\{tab\} onPick=\{setTab\} \/> <\/View> \) : null\} \{way \? <Way way=\{way\} \/> : null\}/)
    /* No "Another adapter" there: it has nothing to buy and no steps to give. */
    assert.ok(!/other: true/.test(ways))

    /* A TAB IS LOOKING ONLY. The hook keeps what was tapped and asks the pure rule; it reaches for nothing that connects, forgets or switches. */
    const hook = bare.slice(bare.indexOf('function useAdapterTab('), bare.indexOf('export function BluetoothWays('))
    const whole = 'function useAdapterTab(tabs, adapter) { const [asked, setAsked] = useState(null) return [adapterTabFor(tabs, { asked, name: adapter && !isCable(adapter) ? adapterName(adapter) : null }), setAsked] }'
    assert.equal(hook.slice(0, whole.length + 1).trim(), whole, 'the adapter tab does something other than keep what was tapped')
    /* And the only thing the adapter row's tap is given is that setter, on both pages. */
    assert.equal((bare.match(/<Tabs name="Your adapter" items=\{tabs\} picked=\{tab\} onPick=\{setTab\} \/>/g) || []).length, 2)
    assert.equal((bare.match(/<Tabs /g) || []).length, 3, 'a row of tabs somewhere that these tests do not know')
    /* The unit row is the one row that changes something: the unit, through the app's own rule for it. */
    assert.match(bare, /function UnitChips\(\{ units, picked, disabled \}\) \{ return <Tabs name="Your unit" items=\{units\.map\(\(u\) => \(\{ key: u\.key, label: u\.name \}\)\)\} picked=\{picked\} disabled=\{disabled\} onPick=\{\(key\) => setBluetoothUnit\(key\)\} \/> \}/)
    assert.ok(page.includes('<Tabs name="Your unit"'))

    /* THE ROW ITSELF (components/Tabs): the app's own buttons with words on them, wrapping, each a tab to a screen reader. */
    const tabs = flat(code(read('mobile/src/components/Tabs.js')))
    assert.match(tabs, /export default function Tabs\(\{ items, picked, onPick, disabled = false, name = '' \}\)/)
    assert.match(tabs, /<View accessibilityRole="tablist" accessibilityLabel=\{name \|\| undefined\} style=\{\{ flexDirection: 'row', flexWrap: 'wrap', gap: space\.sm \}\}>/)
    assert.match(tabs, /<Press key=\{it\.key\} label=\{it\.label\} tone="signal" on=\{it\.key === picked\} disabled=\{disabled\} height=\{44\} style=\{\{ paddingHorizontal: space\.md \}\} accessibilityLabel=\{`\$\{it\.label\}, tab`\} onPress=\{\(\) => onPick\(it\.key\)\} \/>/)
    /*
     * WHICH ONE IS PICKED is said once, by Press: its `on` is the selected
     * state a screen reader reads out. The label said ", selected" as well,
     * and the picked tab was heard as "FM3, tab, selected, selected".
     */
    assert.ok(!/selected/.test(tabs), 'the tab’s label says selected as well as its state')
    assert.match(flat(code(read('mobile/src/components/Press.js'))), /accessibilityState=\{\{ selected: on, disabled, busy \}\}/)
    /* Words, never a picture alone; a Press, so it is in the tap log; and never scrolled off the edge of the screen. */
    assert.ok(!/icon=|Pressable|ScrollView|horizontal/.test(tabs))
  })

  test('Bluetooth tabs: a silent unit is told of black and white plugs only on the adapter that has them, on Play’s line and on Phone & computer’s card', async () => {
    const g = await gearFile()
    /*
     * "The black plug is in its MIDI IN and the white in MIDI OUT" is the
     * Uhost's cable (the C2MIDI Pro, the U2MIDI Pro). It was said to every
     * adapter but a WIDI Master. With Yamaha's MD-BT01 a way on the page,
     * somebody who bought it there would be told of a plug it has not got
     * at the moment nothing answers; a WIDI Jack's owner already was.
     */
    const NAME = 'Axe-Fx III'
    for (const uhost of ['WIDI Uhost', 'WIDI Uhost Bluetooth', 'widi uhost']) assert.equal(g.quietCardLine(NAME, uhost), null, `${uhost}: link-chain’s own line is the Uhost’s`)
    for (const master of ['WIDI Master', 'WIDI Master Bluetooth']) assert.equal(g.quietCardLine(NAME, master), null, `${master}: link-chain has the WIDI Master’s own line`)
    for (const other of ['MD-BT01', 'WIDI Jack Bluetooth', 'WIDI Core', 'Bluetooth MIDI', '', null, undefined]) {
      const line = g.quietCardLine(NAME, other)
      assert.equal(line, 'Axe-Fx III isn’t answering through the adapter. Check it is on, and that both of the adapter’s MIDI plugs are in: one in MIDI IN and one in MIDI OUT.', String(other))
      assert.ok(!/white|black|tried|WIDI|Uhost/i.test(line), String(other))
    }
    assert.match(g.quietCardLine(null, 'MD-BT01'), /^Your unit isn’t answering through the adapter\./)
    /* The card it replaces is link-chain's, which the computer app draws from too and so is left as it is: these are still its two lines. */
    const { linkChain } = await import('../shared/link-chain.mjs')
    const unitCard = (adapter) => linkChain({ here: 'phone', via: 'bluetooth', unit: { name: NAME, state: 'missing' }, adapter: { name: adapter, link: 'connected' }, phone: {} }).find((c) => c.key === 'unit')
    assert.match(unitCard('WIDI Uhost').body, /the black plug is in its MIDI IN and the white in MIDI OUT\.$/)
    assert.match(unitCard('MD-BT01').body, /the black plug is in its MIDI IN and the white in MIDI OUT\.$/, 'link-chain changed: the phone’s own line for an adapter with no white plug may no longer be needed')
    assert.match(unitCard('WIDI Master').body, /both of the WIDI Master’s plugs are in/)
    /* The phone puts its own line on that card, and only then: over Bluetooth, no cable, the adapter connected, the unit missing. */
    const settings = flat(code(read('mobile/src/screens/Settings.js')))
    assert.match(settings, /const quietLine = throughAdapter && !cable && link === 'connected' && unitState === 'missing' \? quietCardLine\(deviceName, macName\) : null/)
    assert.match(settings, /: quietLine \? cards\.map\(\(c\) => \(c\.key === 'unit' \? \{ \.\.\.c, body: quietLine \} : c\)\) : cards/)
    /* The same cards come back otherwise: only the unit's words change, never its tone, its wire or another card. */
    const cards = linkChain({ here: 'phone', via: 'bluetooth', unit: { name: NAME, state: 'missing' }, adapter: { name: 'MD-BT01', link: 'connected' }, phone: {} })
    const line = g.quietCardLine(NAME, 'MD-BT01')
    const mapped = cards.map((c) => (c.key === 'unit' ? { ...c, body: line } : c))
    assert.deepEqual(mapped.map((c) => c.key), cards.map((c) => c.key))
    assert.equal(mapped.find((c) => c.key === 'unit').tone, 'bad')
    assert.deepEqual(mapped.filter((c) => c.key !== 'unit'), cards.filter((c) => c.key !== 'unit'))
    /* Play's line under the pill: the white plug to a Uhost on an Axe-Fx III, and to nobody else. */
    assert.match(g.notAnsweringLine('axefx3', 'WIDI Uhost'), /the white one goes in MIDI OUT, not THRU\.$/)
    for (const other of ['MD-BT01', 'WIDI Jack', 'Bluetooth MIDI', null]) {
      assert.equal(g.notAnsweringLine('axefx3', other), 'Adapter connected, but the Axe-Fx III isn’t answering. Check both MIDI plugs: one in MIDI IN and one in MIDI OUT, not THRU.', String(other))
    }
  })

  test('Bluetooth tabs: an FM3’s adapters are the one that stays cool, then the two a customer runs, each said plainly, under the red warning', async () => {
    const g = await gearFile()
    const fm3 = g.waysFor('fm3', 'iPad')
    assert.deepEqual(fm3.map((w) => w.title), ['WIDI Uhost and a cable', 'Yamaha MD-BT01', 'WIDI Jack with 5-pin cables'])
    /* The first is the one the warning says stays cool, and says so under its name; neither of the others claims it. */
    assert.equal(fm3[0].sub, 'Stays cool on an FM3')
    assert.ok(!fm3[0].caution)
    assert.match(g.FM3_WARNING, /The WIDI Uhost with a CME U2MIDI Pro runs on USB power only, and stays cool\./)
    assert.deepEqual(fm3[0].parts, ['uhost', 'u2midi', 'usbA'])
    for (const way of fm3.slice(1)) {
      assert.ok(!way.sub, `${way.title} is given a line under its name`)
      assert.ok(way.caution.endsWith(g.FM3_FEEL), `${way.title}: nothing says to feel it`)
    }
    assert.equal(g.FM3_FEEL, 'It takes its power from the FM3’s MIDI OUT. Feel it in the first few minutes, and unplug it if it gets hot.')
    /* The WIDI Jack: what the customer said of it, as what it does, never as something tried. */
    assert.equal(g.FM3_JACK_HOT, `A WIDI Jack gets hot on an FM3. ${g.FM3_FEEL}`)
    assert.equal(fm3[2].caution, g.FM3_JACK_HOT)
    assert.equal(fm3[1].caution, g.FM3_FEEL)
    /* Nothing an FM3's owner reads promises it stays cool, or works, on the two fed from MIDI OUT. */
    for (const way of fm3.slice(1)) {
      const said = [way.title, way.sub, way.caution, way.before, ...way.steps].filter(Boolean).join(' ')
      assert.doesNotMatch(said, /stays cool|\bworks\b|\bsafe\b|tried|tested/i, way.title)
    }
    /* Their steps are the 5-pin ones, into the FM3's two jacks, with its one setting. */
    for (const way of fm3.slice(1)) {
      assert.match(way.steps[0], /the FM3’s MIDI IN and its MIDI OUT\/THRU jack/, way.title)
      assert.equal(way.steps.at(-1), 'On the FM3, open Setup → MIDI/Remote and set MIDI Thru to Off.', way.title)
    }
    /* The warning itself is one sentence, the unit's and no other's. */
    assert.equal(g.warningFor('fm3'), g.FM3_WARNING)
    for (const unit of ['am4', 'vp4', 'fm9', 'axefx3', null, undefined, 'nope']) assert.equal(g.warningFor(unit), null, `${unit} is given a heat warning`)
    /* The record of what has run is ours (Developer → App health → Tried): the customer's two are in it, for the FM3 alone. */
    assert.deepEqual(g.waysFor('fm3').filter((w) => w.tried).map((w) => w.key), ['uhost', 'mdbt01', 'jack'])
    assert.match(g.TRIED_NOTES.fm3, /A customer’s Yamaha MD-BT01 works on one, and a WIDI Jack works but gets hot \(Justin, 15 November 2026/)
    for (const unit of ['fm9', 'axefx3']) assert.ok(!g.waysFor(unit).some((w) => w.tried && w.key === 'mdbt01'), `${unit}: the MD-BT01 is recorded as run on a unit nobody said it ran on`)
    /* The website's two pages: the same warning, in the short words, and no "never" for an FM3 on either. */
    const site = flat(read('public/bluetooth.html'))
    assert.ok(site.includes(g.FM3_SHORT), '/bluetooth does not carry the FM3’s warning')
    const guide = flat(read('public/bluetooth-guide.html').replace(/<!--[\s\S]*?-->/g, ' '))
    assert.match(guide, /On an FM3, a Bluetooth adapter may overheat: use one at your own risk\./)
    for (const [name, text] of [['/bluetooth', site.replace(/<!--.*?-->/g, ' ')], ['the guide', guide]]) {
      for (const sentence of text.split(/(?<=[.!?])\s+/).filter((s) => /FM3/.test(s))) {
        assert.doesNotMatch(sentence.replace(/never THRU/g, ''), /\bnever\b/i, `${name} still says never of an FM3: ${sentence.slice(0, 160)}`)
      }
    }
  })
}

/**
 * THE HOLD POP-UP CARRIES THE BLOCK'S KNOBS, OVER ITS CHANNELS
 * (mobile/src/lib/holdPop.js, components/PopKnobs.js, screens/Stage.js's
 * ChannelSheet, screens/Edit.js's BlockPanel `bare`, App.js).
 *
 * "Also when not in landscape mode on all devices and screens instead of
 * just having channels pop up to change have the knobs only pop up above
 * the channels so some one can quick change a setting." (Justin, 10
 * November 2026.)
 *
 * Only where editing works (Edit's own door), never on a VP4, his account
 * until features HOLD_POPUP_KNOBS_FOR_EVERYONE opens it; everywhere else
 * the pop-up is the channels alone, the sheet it always was. The rule is
 * run as it is (it imports nothing), with Edit's door beside it; the rest
 * is read for how it is wired.
 */
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')
/* Comments out, so a check reads the code and not its explanation. */
const code = (src) => src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ')
const flat = (src) => code(src).replace(/\s+/g, ' ')

/** lib/holdPop and lib/editDoor, each run from a copy: neither imports anything. */
async function rules() {
  const dir = mkdtempSync(join(tmpdir(), 'hold-pop-'))
  try {
    writeFileSync(join(dir, 'package.json'), '{ "type": "module" }')
    for (const f of ['holdPop', 'editDoor']) {
      const src = read(`mobile/src/lib/${f}.js`)
      assert.doesNotMatch(src, /^import /m, `lib/${f} imports something; this check runs it on its own`)
      writeFileSync(join(dir, `${f}.js`), src)
    }
    const h = await import(pathToFileURL(join(dir, 'holdPop.js')).href)
    const d = await import(pathToFileURL(join(dir, 'editDoor.js')).href)
    return { ...h, ...d }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

export function run(test) {
  test('hold pop-up: the knobs show only for an account it is open to, where Edit’s door opens, and never on a VP4', async () => {
    const r = await rules()
    const yes = { allowed: true, editOpens: true, vp4: false }
    assert.equal(r.popKnobsOn(yes), true, 'his account, Edit open, not a VP4: the pop-up has the knobs')
    /* Each thing on its own takes them away, and the pop-up is the channels alone. */
    assert.equal(r.popKnobsOn({ ...yes, allowed: false }), false, 'an account it is closed to got the knobs')
    assert.equal(r.popKnobsOn({ ...yes, editOpens: false }), false, 'the knobs showed where Edit’s door is shut')
    assert.equal(r.popKnobsOn({ ...yes, vp4: true }), false, 'a VP4 got knobs: it has none anywhere')
    /* An answer not yet in is a no: nothing truthy stands in for true. */
    for (const not of [undefined, null, 1, 'yes', {}]) {
      assert.equal(r.popKnobsOn({ ...yes, allowed: not }), false, `allowed ${String(not)} counted as yes`)
      assert.equal(r.popKnobsOn({ ...yes, editOpens: not }), false, `editOpens ${String(not)} counted as yes`)
    }
    assert.equal(r.popKnobsOn(), false)
    assert.equal(r.popKnobsOn({}), false)

    /* Behind Edit's own door, case by case (lib/editDoor `opens`), for an account the pop-up is open to. */
    const door = (ask) => r.popKnobsOn({ allowed: true, vp4: ask.vp4 === true, editOpens: r.editDoor({ bench: true, ...ask }).opens })
    assert.equal(door({ link: 'connected' }), true, 'through the computer')
    assert.equal(door({ demo: true }), true, 'in the demo')
    assert.equal(door({ link: 'connected', overBluetooth: true, editOpen: true, built: true }), true, 'over Bluetooth or a cable where Edit is open there')
    assert.equal(door({ link: 'connected', overBluetooth: true, editOpen: false, built: true }), false, 'a customer over Bluetooth, Edit built and not open to them: the knobs showed')
    assert.equal(door({ link: 'connected', overBluetooth: true, editOpen: false, built: false }), false, 'over Bluetooth on a unit with no Edit: the knobs showed')
    assert.equal(door({ link: 'off' }), false, 'with nothing connected: the knobs showed')
    assert.equal(door({ link: 'connected', vp4: true }), false, 'a VP4 through the computer got knobs')
    assert.equal(door({ demo: true, vp4: true }), false, 'the demo’s VP4 got knobs')
    assert.equal(r.popKnobsOn({ allowed: true, vp4: false, editOpens: r.editDoor({ bench: false, link: 'connected' }).opens }), false, 'the knobs showed with the bench switched off')

    /* One block at a time: not one the wire has no knobs for, and nothing held is nothing shown. */
    assert.equal(r.popKnobsFor(true, { name: 'Drive 1' }), true)
    assert.equal(r.popKnobsFor(true, { name: 'Drive 1', knobs: true }), true)
    assert.equal(r.popKnobsFor(true, { name: 'NAM 1', knobs: false }), false, 'a block with no knobs on the wire got a knobs area')
    assert.equal(r.popKnobsFor(true, null), false)
    assert.equal(r.popKnobsFor(false, { name: 'Drive 1' }), false, 'the knobs showed with the rule saying no')
    assert.equal(r.popKnobsFor(1, { name: 'Drive 1' }), false)

    /* His "the knobs only": what the pop-up leaves out of Edit's block view, and a thumb's channel under them. */
    assert.deepEqual(r.POP_LEAVES_OUT, ['name', 'colour', 'channels', 'copy', 'engaged', 'level', 'model', 'ir'])
    assert.ok(r.POP_CHANNEL_TALL >= 44, 'a channel under the knobs is smaller than a thumb')
  })

  test('hold pop-up: App asks the rule with Edit’s own door, his account until the switch, and Play is told only that', () => {
    const features = read('mobile/src/lib/features.js')
    assert.match(features, /^export const HOLD_POPUP_KNOBS_FOR_EVERYONE = true$/m, 'the pop-up’s knobs are closed to customers again')
    const app = code(read('mobile/App.js'))
    assert.match(app, /import \{ popKnobsOn \} from '\.\/src\/lib\/holdPop'/)
    assert.match(app, /import \{ HOLD_POPUP_KNOBS_FOR_EVERYONE \} from '\.\/src\/lib\/features'/)
    /* His account (the kept sign-in, as the two sides) or the switch; Edit's door for this unit and connection; never a VP4, the demo's included. */
    assert.match(app, /const popKnobs = popKnobsOn\(\{ allowed: sidesAdmin \|\| HOLD_POPUP_KNOBS_FOR_EVERYONE, editOpens, vp4: noKnobs \}\)/)
    assert.match(app, /const sidesAdmin = useBluetoothAdmin\(\)/)
    assert.match(app, /const editOpens = editHere\.opens/)
    assert.match(app, /const noKnobs = vp4Here\(\) \|\| \(demo && demoUnitNow === 'vp4'\)/)
    assert.match(app, /onCloseKnobs=\{closeBlock\}\s+popKnobs=\{popKnobs\}/, 'Play is not told whether its pop-up has the knobs')
    /* And to one more place since 12 November 2026: the Apple Watch's quick edit asks the same answer (lib/watchQuick; test/watch-quick.mjs), so the wrist never offers knobs where this pop-up has none. */
    assert.match(app, /const watchQuick = watchQuickOn\(\{ allowed: sidesAdmin \|\| WATCH_QUICK_EDIT_FOR_EVERYONE, popKnobs \}\)/)
    assert.equal((app.match(/\bpopKnobs\b/g) || []).length, 4, 'the answer goes somewhere other than Play and the watch’s rule')
  })

  test('hold pop-up: with the knobs it is the knobs over the channels, the channels its foot; without, the sheet it always was', () => {
    const stage = read('mobile/src/screens/Stage.js')
    const bare = code(stage)
    /* Nobody gets knobs in the pop-up unless App says so. */
    assert.match(bare, /onCloseKnobs = null,\s+popKnobs = false,\n/)
    assert.match(bare, /<ChannelSheet\s+block=\{chainNow\.elsewhere \|\| chainNow\.outline \? null : blocks\.find\(\(b\) => sameBlock\(b, picking\)\) \|\| null\}\s+channels=\{channels\}\s+onClose=\{\(\) => setPicking\(null\)\}\s+onPick=\{\(ch\) => \{\s+writeChannel\(picking, ch\)\s+setPicking\(null\)\s+\}\}\s+knobs=\{popKnobs\}\s+\/>/, 'a channel picked no longer writes it and closes the pop-up, or the knobs are not handed to it')
    /* The hold that opens it is the one it always was: the panel where that opens, else the pop-up. */
    assert.match(bare, /\? \(\) => \(knobsHere \? holdForKnobs\(idOf\(block\)\) : setPicking\(picking === idOf\(block\) \? null : idOf\(block\)\)\)/)
    /* And it still closes on another preset, and while the chain is another preset's: a sheet left open would be over the new song's block. */
    assert.match(bare, /useEffect\(\(\) => \{\s+if \(chainNow\.elsewhere\) setPicking\(null\)\s+\}, \[chainNow\.elsewhere\]\)/)
    assert.match(bare, /useEffect\(\(\) => setPicking\(null\), \[chainNow\.number\]\)/)

    const sheet = bare.slice(bare.indexOf('function ChannelSheet('), bare.indexOf('export const DOWN_DIM'))
    assert.match(sheet, /^function ChannelSheet\(\{ block, channels, onClose, onPick, knobs = false \}\) \{/)
    assert.match(sheet, /const withKnobs = popKnobsFor\(knobs, block\)/)
    assert.match(bare, /import \{ HOLD_FOR_QUICK_EDIT, POP_CHANNEL_TALL, popKnobsFor \} from '\.\.\/lib\/holdPop'/)
    assert.match(bare, /import PopKnobs from '\.\.\/components\/PopKnobs'/)

    /* WITHOUT THE KNOBS: today's sheet, to the letter. The one return after the knobs' own. */
    const today = `  return (
    <Sheet open={!!block && channels?.length > 1} onClose={onClose} title={name} note="Channel">
      <View style={{ flexDirection: 'row', gap: space.sm }} accessibilityRole="radiogroup">
        {(channels || []).map((ch) => (
          <Press
            key={ch}
            grow
            label={ch}
            height={TAP + 28}
            tone="live"
            on={block?.channel === ch}
            accessibilityLabel={\`Channel \${ch}\`}
            onPress={() => onPick(ch)}
          />
        ))}
      </View>
      <Text style={{ color: color.silkDim, fontSize: font.small, lineHeight: 20 }}>
        {block?.channel ? \`\${name} is on channel \${block.channel}. \` : ''}
        Each channel keeps its own model and settings; the scene remembers which one this block
        plays.
      </Text>
    </Sheet>
  )
}
`
    assert.ok(stage.includes(today), 'the pop-up without knobs is not the sheet it always was')
    assert.ok(stage.indexOf(today) > stage.indexOf('if (withKnobs) {'), 'the old sheet is not what is left when the knobs are not shown')

    /* WITH THEM: the knobs scroll in the sheet, the channels are its foot (always on screen), and it holds still under a held knob. */
    const withKnobs = sheet.slice(sheet.indexOf('if (withKnobs) {'), sheet.lastIndexOf('return ('))
    assert.match(withKnobs, /<Sheet\s+open=\{!!block && channels\?\.length > 1\}\s+onClose=\{onClose\}\s+title=\{name\}\s+note="Knobs and channel"\s+tall\s+still=\{held\}\s+foot=\{/)
    const foot = withKnobs.slice(withKnobs.indexOf('foot={'), withKnobs.indexOf('<PopKnobs'))
    assert.match(foot, /accessibilityRole="radiogroup"/)
    assert.match(foot, /<Press\s+key=\{ch\}\s+grow\s+label=\{ch\}\s+height=\{POP_CHANNEL_TALL\}\s+tone="live"\s+on=\{block\?\.channel === ch\}\s+accessibilityLabel=\{`Channel \$\{ch\}`\}\s+onPress=\{\(\) => onPick\(ch\)\}\s+\/>/, 'the channels under the knobs are not the same buttons, doing the same thing')
    assert.ok(!/<PopKnobs/.test(foot), 'the knobs are in the foot, so they would never scroll')
    assert.match(withKnobs, /<PopKnobs block=\{block\} onScrollLock=\{setHeld\} \/>/)
    assert.match(sheet, /const \[held, setHeld\] = useState\(false\)\s+useEffect\(\(\) => \{\s+if \(!withKnobs\) setHeld\(false\)\s+\}, \[withKnobs\]\)/, 'a sheet left held when its knobs went would never scroll again')

    /* The sheet itself: `still` stops its scroll and nothing else, and a sheet without it scrolls as it did. */
    const shared = flat(read('mobile/src/components/Sheet.js'))
    assert.match(shared, /export default function Sheet\(\{ open, onClose, title, note, head, foot, tall = false, wide = null, still = false, children \}\)/)
    assert.match(shared, /<ScrollView contentContainerStyle=\{\{ padding: space\.lg, paddingTop: head \? space\.sm : space\.lg, gap: space\.md \}\} keyboardShouldPersistTaps="handled" scrollEnabled=\{!still\} > \{children\} <\/ScrollView>/)
    assert.equal((code(read('mobile/src/components/Sheet.js')).match(/\bstill\b/g) || []).length, 2, '`still` does something more than hold the scroll')
  })

  test('hold pop-up: the knobs are Edit’s own block view drawn bare, so nothing new reads or writes the unit', () => {
    const pop = read('mobile/src/components/PopKnobs.js')
    const bare = code(pop)
    assert.match(bare, /import \{ BLE_NOTE, BlockPanel \} from '\.\.\/screens\/Edit'/)
    assert.match(bare, /<BlockPanel\s+key=\{`\$\{eid\}:\$\{block\.channel \|\| ''\}:\$\{scene\}:\$\{bufferRev\}`\}\s+panel\s+bare\s+block=\{block\}\s+channels=\{null\}/, 'the pop-up’s knobs are not Edit’s block view, keyed as Edit keys it, as the panel, bare and with no channels of its own')
    /* It asks the unit for nothing itself: the only things it takes from lib/device are names, never a sender. */
    assert.match(bare, /import \{ idOf \} from '\.\.\/lib\/device'/)
    assert.equal((bare.match(/from '\.\.\/lib\/device'/g) || []).length, 1)
    assert.doesNotMatch(bare, /remoteRequest|blockParams|writeParam|writeChannel|setType|\bput\(|\bpost\(|fetch\(/, 'the pop-up reads or writes the unit with code of its own')
    /* As Edit: another preset's chain, or one up from memory, is not opened; it says it is reading. */
    assert.match(bare, /const chainNow = useChain\(\{ editing: true \}\)/)
    assert.match(bare, /\{chainNow\.elsewhere \? \(\s+<Note>Reading what’s in this preset…<\/Note>\s+\) : \(\s+<BlockPanel/)
    /* A read that fails says so in Edit's own words (its error, as given), and the channels are not this component's to lose. */
    assert.match(bare, /onError=\{setError\}/)
    assert.match(bare, /\{error \? \(\s+<Note tone="fault" onDismiss=\{\(\) => setError\(null\)\}>\s+\{error\}\s+<\/Note>\s+\) : null\}/)
    assert.doesNotMatch(bare, /channels\.map|radiogroup/, 'the pop-up’s knobs draw channels of their own')
    /* Over Bluetooth or a cable, Edit's own one-time note: a change plays, and is saved on the unit. */
    assert.match(bare, /\{onCable \? CABLE_EDIT_NOTE : BLE_NOTE\}/)
    /* A knob held: the sheet is told, and let go if the knobs go with one still held. */
    assert.match(bare, /const lock = useCallback\(\(on\) => lockOut\.current\?\.\(on\), \[\]\)\s+useEffect\(\(\) => \(\) => lockOut\.current\?\.\(false\), \[\]\)/)
    assert.match(bare, /onScrollLock=\{lock\}/)
    /* No words of its own about what is or is not ready. */
    assert.doesNotMatch(pop.replace(/\/\*[\s\S]*?\*\//g, ' '), /\bbeta\b|\btried\b|\bofficial\b|this phone|coming/i)

    /* Every read and write Edit's block view makes says it is Edit's (lib/device EDITING), so over Bluetooth it waits behind Play. */
    const device = code(read('mobile/src/lib/device.js'))
    assert.match(device, /export const blockParams = async \(eid\) => fixRead\(await remoteRequest\(`\/preset\/blocks\/\$\{eid\}\/params`, EDITING\)\)/)
    assert.match(device, /put\(`\/preset\/blocks\/\$\{eid\}\/params\/\$\{paramId\}`, \{ value: norm, continuous \}, EDITING\)/)

    /*
     * BARE, in Edit's block view. The pop-up draws it as the panel (no name's row or Color, no Copy channel, no
     * on/off button: test/two-sides.mjs holds those three) and hands it no channels, so Edit's own channel row
     * is not drawn. `bare` takes out the rest: no model list and no cab state are asked for, so there is no
     * model and no IR picker to draw, and the Level is left to Edit.
     */
    const edit = code(read('mobile/src/screens/Edit.js'))
    const panel = edit.slice(edit.indexOf('export function BlockPanel('), edit.indexOf('function BlockColour('))
    assert.match(panel, /onUndoSaid,\s+bare = false,\s+overBle = false,\s+panel = false,[^]*?onModelInfo = null,\s+onHoldKnob = null\n\}\) \{/)
    assert.match(panel, /\{channels\?\.length > 1 && !tidy \? \(\s+<View style=\{\{ flexDirection: 'row', gap: space\.sm \}\}>\s+\{channels\.map\(/, 'Edit’s channel row is drawn with no channels handed to it')
    assert.match(panel, /bare \? \[\] : blockTypes\(block\.slug\)\.catch\(\(\) => \[\]\)/, 'the pop-up asks for the model list')
    assert.match(panel, /setModels\(t \|\| \[\]\)/)
    assert.match(panel, /\{models\.length && !modelUp \? \(\s+<View style=\{\{ gap: space\.sm \}\}>\s+<Press\s+caption="Model"/, 'the model is drawn with no models to choose from')
    assert.match(panel, /const c = bare \? null : block\.slug === 'cab' \? await readCab\(\(\) => cabState\(eid\), p\) : null/, 'the pop-up asks for the cab state')
    assert.match(panel, /const irList = cab && block\.slug === 'cab' && irs \? irBanks\(cab, irs, \{ named: params \}\) : \[\]/)
    assert.match(panel, /\{irHere && irList\.length \? \(/)
    assert.match(panel, /\{level && !bare \? \(/, 'the pop-up draws the Level')
    /* And `bare` is read in those three places only (and the effect that reads the block, which asks again if it changes). */
    /* And once more where the tidier Edit's one row is ruled out for a bare view, which draws no name and no on and off. */
    assert.match(panel, /const tidy = tidyOn && !panel && !bare && !knobless\n/)
    /* And where a NAM block's one line about what is left to the unit is ruled out for a bare view, which is the knobs only (lib/gen3Catalog NAM_ON_THE_UNIT; test/bluetooth.mjs holds the line itself). */
    assert.match(panel, /const namOnUnit = block\.slug === 'nam' && !knobless && !bare\n/)
    /* And the block's list settings (lib/editSettings) are not in the pop-up, which is knobs over channels and nothing else. */
    assert.match(panel, /const settings = settingsOn && !bare && !knobless \? blockSettings\(enums, block\.slug\) : \[\]\n/)
    assert.equal(panel.match(/\bbare\b/g).length, 8, '`bare` changes something else in Edit’s block view')
    /* The knobs themselves, and the pages, are not behind `bare` at all: the same lines Edit draws. */
    assert.match(panel, /\{pages\.length > 1 \? \(\s+<SideScroll/)
    assert.match(panel, /<Knob\s+param=\{p\}\s+label=\{p\.label \|\| p\.name\}\s+value=\{valueOf\(p\)\}/)
    /* Only the pop-up draws it bare: Edit and Derek's panel are what they were. */
    const users = ['mobile/App.js', 'mobile/src/screens/Edit.js', 'mobile/src/screens/Stage.js', 'mobile/src/components/BlockSide.js'].filter((f) => /<BlockPanel[^>]*\sbare[\s/>]/.test(code(read(f))))
    assert.deepEqual(users, [], 'something other than the pop-up draws Edit’s block view bare')
  })
}

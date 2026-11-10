/**
 * STAGE VIEW, AND A SONG'S NOTES (mobile/src/lib/stageView.js and
 * lib/songNotes.js, components/StageView.js and components/SongNotes.js,
 * screens/Stage.js, App.js).
 *
 * "Stage view: the preset name, scene and next song big enough to read from
 * a mic stand, with the tuner as a strip." and "Song notes beside Play:
 * lyrics, chords or cues for the current setlist song in the other half."
 * (Two of the ideas Justin said yes to on 10 November 2026.)
 *
 * His account only, each behind its own switch in lib/features, and both
 * switches are pinned shut here. The two rule files import nothing, so they
 * are run as they are, the notes against a Map standing in for the device's
 * storage; the rest is read for how it is wired: that Stage view presses
 * Play's own buttons and asks the unit nothing new, and that the notes stay
 * on the device.
 */
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const ROOT = new URL('../', import.meta.url)
const read = (p) => readFileSync(new URL(p, ROOT), 'utf8')
/* Comments out, so a check reads the code and not its explanation. */
const code = (src) => src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ')
const flat = (src) => code(src).replace(/\s+/g, ' ')

/** lib/stageView, lib/songNotes and lib/twoSides, each run from a copy: none imports anything. */
async function rules() {
  const dir = mkdtempSync(join(tmpdir(), 'stage-view-'))
  try {
    writeFileSync(join(dir, 'package.json'), '{ "type": "module" }')
    const out = {}
    for (const f of ['stageView', 'songNotes', 'twoSides']) {
      const src = read(`mobile/src/lib/${f}.js`)
      assert.doesNotMatch(src, /^import /m, `lib/${f} imports something; this check runs it on its own`)
      writeFileSync(join(dir, `${f}.js`), src)
      out[f] = await import(pathToFileURL(join(dir, `${f}.js`)).href)
    }
    return out
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

/** The device's storage, as lib/store offers it: getItem and setItem over strings. */
function shelf(start = {}) {
  const kept = new Map(Object.entries(start))
  return {
    getItem: (k) => (kept.has(k) ? kept.get(k) : null),
    setItem: (k, v) => void kept.set(k, String(v)),
    kept
  }
}

/** Every .js file under a folder of the phone app. */
function filesUnder(dir) {
  const out = []
  for (const name of readdirSync(new URL(dir, ROOT))) {
    const p = `${dir}/${name}`
    if (statSync(new URL(p, ROOT)).isDirectory()) out.push(...filesUnder(p))
    else if (name.endsWith('.js')) out.push(p)
  }
  return out
}

export function run(test) {
  test('Stage view and song notes are his account’s only: both switches are shut, and only a plain true opens either', async () => {
    const { stageView: s, songNotes: n } = await rules()
    const features = code(read('mobile/src/lib/features.js'))
    assert.match(features, /export const STAGE_VIEW_FOR_EVERYONE = false\n/, 'Stage view is open to everyone')
    assert.match(features, /export const SONG_NOTES_FOR_EVERYONE = false\n/, 'song notes are open to everyone')
    for (const on of [s.stageViewOn, n.songNotesOn]) {
      assert.equal(on({ admin: true, everyone: false }), true, 'his account does not have it')
      assert.equal(on({ admin: false, everyone: true }), true, 'the switch does not open it')
      assert.equal(on({ admin: false, everyone: false }), false, 'a customer has it with the switch shut')
      assert.equal(on(), false)
      for (const not of [undefined, null, 1, 'yes', {}]) assert.equal(on({ admin: not, everyone: not }), false, `${String(not)} counted as yes`)
    }
    /* App asks those two rules with his account and the two switches, and nothing else opens either. */
    const app = code(read('mobile/App.js'))
    assert.match(app, /const stageViewAllowed = stageViewOn\(\{ admin: sidesAdmin, everyone: STAGE_VIEW_FOR_EVERYONE \}\)\n/)
    assert.match(app, /const notesAllowed = songNotesOn\(\{ admin: sidesAdmin, everyone: SONG_NOTES_FOR_EVERYONE \}\)\n/)
    assert.match(app, /const stageViewUp = stageViewAllowed && screen === STAGE_VIEW\n/)
  })

  test('Stage view’s type is as big as its room takes, on at most two lines, and never bigger than fits', async () => {
    const { stageView: s } = await rules()
    /* Lines are broken at spaces; a word wider than the line fits nowhere. */
    assert.equal(s.linesFor('Clean', 40, 400), 1)
    assert.equal(s.linesFor('Brit 800 Crunch Lead', 40, 300), 2)
    assert.equal(s.linesFor('Supercalifragilistic', 40, 100), Infinity)
    assert.equal(s.linesFor('', 40, 400), 0)
    /* Whatever it answers fits: within the lines asked, and within the height. */
    for (const text of ['Clean', 'Brit 800 Crunch Lead', 'A Very Long Preset Name That Goes On', '059 Plexi 100W High 2']) {
      for (const [width, height] of [[300, 120], [358, 260], [700, 300], [1100, 420]]) {
        const size = s.bigType({ text, width, height, lines: 2, min: 24, max: 160 })
        assert.ok(size >= 24 && size <= 160, `${text} at ${width}: ${size}`)
        if (size > 24) {
          const lines = s.linesFor(text, size, width)
          assert.ok(lines <= 2, `${text} at ${width}×${height} is ${lines} lines at ${size}`)
          assert.ok(lines * size * s.LINE <= height, `${text} at ${width}×${height} is taller than its room at ${size}`)
        }
      }
    }
    /* More room is never smaller type, a shorter name is never smaller than a longer one, and a short name on a tablet is far past Play's own 40. */
    assert.ok(s.bigType({ text: 'Brit 800 Crunch', width: 800, height: 300 }) >= s.bigType({ text: 'Brit 800 Crunch', width: 358, height: 300 }))
    assert.ok(s.bigType({ text: 'Clean', width: 358, height: 200 }) >= s.bigType({ text: 'Clean Chorus Delay', width: 358, height: 200 }))
    assert.ok(s.bigType({ text: 'Clean', width: 760, height: 320, max: 160 }) >= 120, 'a short name on a tablet is not big')
    /* Nothing to draw, or no room measured yet: the least, never a guess. */
    assert.equal(s.bigType({ text: '', width: 400, height: 200, min: 24 }), 24)
    assert.equal(s.bigType({ text: 'Clean', width: 0, height: 0, min: 24 }), 24)
    assert.equal(s.bigType({ text: 'Supercalifragilisticexpialidocious', width: 120, height: 200, min: 24 }), 24, 'a word too long for the line is left to the screen to shrink and end in an ellipsis')
    assert.equal(s.bigType({ text: 'Clean', width: 4000, height: 4000, max: 96 }), 96, 'the most is not kept')
    /* And the screen is told to shrink and to end a line that still runs over: no name is cut bare. */
    const view = flat(read('mobile/src/components/StageView.js'))
    assert.match(view, /numberOfLines=\{2\} adjustsFontSizeToFit minimumFontScale=\{0\.5\} ellipsizeMode="tail"/, 'the preset’s name can be cut with no ellipsis')
    assert.match(view, /const nameSize = bigType\(\{ text: presetName, width: wide, height: share\.name, lines: 2, min: 24, max: 160 \}\)/)
  })

  test('Stage view lays itself out from its room: Previous and Next down the edges when wide, scenes in one row where each is a thumb across', async () => {
    const { stageView: s } = await rules()
    /* The scenes: one row wherever each button is at least a thumb, and otherwise the fewest rows that give that. */
    assert.deepEqual(s.stageScenes({ count: 8, width: 1148 }), { cols: 8, rows: 1, wide: 136 })
    assert.deepEqual(s.stageScenes({ count: 8, width: 358 }), { cols: 4, rows: 2, wide: 83 })
    assert.deepEqual(s.stageScenes({ count: 4, width: 358 }), { cols: 4, rows: 1, wide: 83 })
    assert.deepEqual(s.stageScenes({ count: 0, width: 358 }), { cols: 0, rows: 0, wide: 0 })
    for (const width of [320, 358, 600, 768, 1024, 1366]) {
      for (const count of [2, 4, 8]) {
        const row = s.stageScenes({ count, width })
        assert.ok(row.cols * row.rows >= count, `${count} scenes at ${width} do not all have a place`)
        assert.ok(row.cols * row.wide + (row.cols - 1) * 8 <= width, `${count} scenes at ${width} are wider than the row`)
        assert.ok(row.wide >= s.STAGE_SCENE_LEAST || row.cols === 1, `a scene at ${width} is ${row.wide} across`)
      }
    }
    /* A phone upright: two wide buttons under the words. A tablet: the two edges, and no row for them. */
    const phone = s.stagePlan({ width: 390, height: 700, scenes: 8 })
    assert.equal(phone.edges, false)
    assert.ok(phone.steps >= 64, 'Previous and Next on a phone are under a thumb')
    assert.equal(phone.scenes.rows, 2)
    const tablet = s.stagePlan({ width: 1180, height: 760, scenes: 8 })
    assert.equal(tablet.edges, true)
    assert.equal(tablet.steps, 0)
    assert.ok(tablet.edge >= 112 && tablet.edge <= 220, `an edge of ${tablet.edge}`)
    assert.equal(tablet.scenes.rows, 1)
    assert.equal(s.stagePlan({ width: s.STAGE_EDGES_AT - 1, height: 700 }).edges, false)
    assert.equal(s.stagePlan({ width: s.STAGE_EDGES_AT, height: 700 }).edges, true)
    /* Every part is big, and the words still have room, on each shape; the tuner's strip takes exactly its own height from them. */
    for (const [width, height] of [[390, 700], [844, 342], [820, 1100], [1180, 760], [1366, 960]]) {
      for (const scenes of [0, 4, 8]) {
        const plan = s.stagePlan({ width, height, scenes })
        assert.ok(plan.words.width >= 200, `${width}×${height}: the words have ${plan.words.width} across`)
        if (height >= 600) assert.ok(plan.words.height >= 200, `${width}×${height} with ${scenes} scenes: the words have ${plan.words.height}`)
        if (scenes) assert.ok(plan.sceneTall >= 64, `${width}×${height}: a scene is ${plan.sceneTall} tall`)
        const tuning = s.stagePlan({ width, height, scenes, tuner: true })
        assert.equal(plan.words.height - tuning.words.height, plan.words.height ? Math.min(plan.words.height, s.STAGE_TUNER + s.STAGE_GAP) : 0)
      }
    }
    /* The words' room: the name gets most of it, and a part with nothing to say gives its share to the name. */
    const all = s.stageShares({ height: 400 })
    assert.ok(all.name > all.scene && all.scene > all.next && all.next > all.slot, 'the name is not the biggest thing on the view')
    assert.ok(Math.abs(all.name + all.scene + all.next + all.slot + 3 * s.STAGE_GAP - 400) < 0.001, 'the shares do not add up to the room')
    const alone = s.stageShares({ height: 400, scene: false, next: false, slot: false })
    assert.deepEqual(alone, { slot: 0, next: 0, scene: 0, name: 400 })
    assert.equal(s.stageShares({ height: 0 }).name, 0)
  })

  test('Stage view says what comes next in Play’s own words: the next song on a setlist, the next preset otherwise, and nothing where Next goes nowhere', async () => {
    const { stageView: s } = await rules()
    assert.deepEqual(s.stageNext({ setlist: true, canStep: true, ahead: { shown: 'Black Dog' } }), { label: 'Next song', name: 'Black Dog' })
    assert.deepEqual(s.stageNext({ setlist: false, canStep: true, ahead: { shown: 'Clean' } }), { label: 'Next', name: 'Clean' })
    assert.deepEqual(s.stageNext({ setlist: true, canStep: true, ahead: { shown: 'Starts over' } }), { label: 'Next song', name: 'Starts over' })
    assert.equal(s.stageNext({ setlist: true, canStep: false, ahead: { shown: 'Black Dog' } }), null, 'a Next with nowhere to go names a song')
    assert.equal(s.stageNext({ setlist: true, canStep: true, ahead: null }), null)
    assert.equal(s.stageNext({ setlist: true, canStep: true, ahead: { shown: '  ' } }), null)
    assert.equal(s.stageNext(), null)
    assert.equal(s.stageTempo(120), '120 BPM')
    assert.equal(s.stageTempo(92.6), '93 BPM')
    for (const none of [0, -1, null, undefined, 'fast', NaN]) assert.equal(s.stageTempo(none), '')
    assert.equal(s.STAGE_VIEW, 'stageview')
    assert.equal(s.STAGE_VIEW_NAME, 'Stage view')
    assert.equal(s.STAGE_VIEW_DONE, 'Done')
    /* The name under Next is the one Play's own Next shows, so the two can never name different slots. */
    const stage = flat(read('mobile/src/screens/Stage.js'))
    assert.match(stage, /<StageView [^>]*? behind=\{behind\} ahead=\{ahead\} /)
    assert.match(flat(read('mobile/src/components/StageView.js')), /const next = stageNext\(\{ setlist, canStep: canNext, ahead \}\)/)
  })

  test('Stage view is Play’s own screen: every press is Play’s, nothing new is asked of the unit, and the tuner is a strip that goes off with the view', () => {
    const stage = flat(read('mobile/src/screens/Stage.js'))
    /* Drawn by Play over itself, only while App says so, with Play's own step, scene and tuner calls and Play's own landings. */
    const at = stage.indexOf('{stageView ? ( <StageView ')
    assert.ok(at > 0, 'Play does not draw Stage view, or draws it when it is not asked for')
    const tag = stage.slice(at, stage.indexOf('/>', at))
    for (const prop of [
      'presetName={presetSays}',
      'onScene={writeScene}',
      'onStep={step}',
      'canPrevious={lastAt !== null}',
      'canNext={nextAt !== null}',
      'tunerOn={tunerOn}',
      'tuning={tuning}',
      'onTuner={() => writeTuner(!tunerOn)}',
      'down={down}',
      'dim={DOWN_DIM}',
      'onDone={onCloseStageView}'
    ]) {
      assert.ok(tag.includes(prop), `Stage view is not handed ${prop}`)
    }
    /* The Tuner button only where this unit has a tuner: the rule Play's own button is drawn by. */
    assert.ok(tag.includes('tunerOffered={caps?.tuner !== false}'))
    assert.match(stage, /const tuner = caps\?\.tuner !== false \? \(/, 'Play’s own Tuner button moved to another rule; Stage view’s follows it')
    /* Off unless App says so, and Play's props for it default shut. */
    assert.match(stage, /stageView = false, onCloseStageView, songNotes = false,/)
    /* The big tuner is never over Stage view, which has the strip; and the view gone with the tuner on turns the tuner off. */
    assert.match(stage, /<Tuner on=\{tunerOn && !tunerBeside && !stageView\} reading=\{tuning\} onClose=\{\(\) => writeTuner\(false\)\} down=\{down\} \/>/)
    assert.match(stage, /const stageViewWas = useRef\(stageView\) useEffect\(\(\) => \{ const was = stageViewWas\.current stageViewWas\.current = stageView if \(was && !stageView && tunerOn\) writeTuner\(false\) \}, \[stageView\]\)/)

    /* The view itself reads nothing from the rig and sends nothing: it has no way to. */
    const view = code(read('mobile/src/components/StageView.js'))
    const from = [...view.matchAll(/from '([^']+)'/g)].map((m) => m[1]).sort()
    assert.deepEqual(from, [
      '../lib/feedback',
      '../lib/relay-rules',
      '../lib/sceneColors',
      '../lib/songNotes',
      '../lib/stageView',
      '../lib/theme',
      './Press',
      './SongNotes',
      './Tile',
      './Tuner',
      'react',
      'react-native',
      'react-native-safe-area-context'
    ])
    assert.doesNotMatch(view, /useRig|writeScene|writeTuner|loadPreset|fetch\(/, 'Stage view reaches for the rig itself')
    const v = flat(read('mobile/src/components/StageView.js'))
    /* Done, the tempo or Play's own NOT CONNECTED, and the buttons dimmed as Play dims them. */
    assert.match(v, /<Press label=\{STAGE_VIEW_DONE\} height=\{STAGE_TOP\} onPress=\{onDone\} /)
    assert.match(v, /\{down \? \( <Text [^>]*>\s*\{NOT_CONNECTED\}\s*<\/Text> \) : tempo \? \(/)
    assert.match(v, /const faded = down \? \{ opacity: dim \} : null/)
    assert.match(v, /\{tunerOffered \? <Press label=\{tunerOn \? 'Stop tuner' : 'Tuner'\} /)
    assert.match(v, /\{tunerOn \? <TunerStrip reading=\{tuning\} down=\{down\} tall=\{STAGE_TUNER\} \/> : null\}/)
    assert.match(v, /onPress=\{\(\) => \{ thud\(\) onStep\?\.\(by\) \}\}/)
    assert.match(v, /onPress=\{\(\) => onScene\?\.\(i\)\}/)
    /* Under Play's own notices, so a press that could not be sent is still said over the view. */
    assert.match(v, /position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, zIndex: 1, backgroundColor: color\.chassis/)
    /* Drawn the same in both looks: none of the glass's own colours or corners. */
    assert.doesNotMatch(view, /color\.glass|radius\.card|<Glass/)
    /* The tuner's strip is the tuner's own reading, drawn in the tuner's own file. */
    assert.match(code(read('mobile/src/components/Tuner.js')), /export function TunerStrip\(\{ reading, down = false, tall = 72 \}\)/)
  })

  test('Stage view is a screen of its own with a way in from the top bar and from Settings, and back, the swipe and Done all leave it', () => {
    const app = code(read('mobile/App.js'))
    const f = flat(read('mobile/App.js'))
    /* Its own word for App's screen, never a side: the sides' tools are the list, and it is not on it. */
    assert.doesNotMatch(read('mobile/src/lib/twoSides.js'), /stageview/)
    assert.match(app, /stageView=\{stageViewUp\}\s*onCloseStageView=\{\(\) => setScreen\('stage'\)\}\s*songNotes=\{notesAllowed\}/)
    /* Android's back and the swipe back go by BACK_TO. */
    assert.match(f, /const BACK_TO = \{ presets: 'stage', setlists: 'stage', edit: 'stage', notes: 'stage', stageview: 'stage', /)
    /* On a big screen with Play alone: beside Two sides in the top bar, for an account that has it. */
    assert.match(f, /\{stageViewAllowed \? <Press label=\{STAGE_VIEW_NAME\} height=\{36\} labelSize=\{font\.small\} onPress=\{\(\) => setScreen\(STAGE_VIEW\)\} accessibilityLabel="Open Stage view" /)
    /* On every screen: a row in Settings, drawn only when App hands it a way in. */
    assert.match(f, /onStageView=\{stageViewAllowed \? \(\) => setScreen\(STAGE_VIEW\) : null\}/)
    const settings = flat(read('mobile/src/screens/Settings.js'))
    assert.match(settings, /onStageView = null \}\) \{/)
    assert.match(settings, /\{onStageView \? <SetupRow title=\{STAGE_VIEW_NAME\} status=\{STAGE_VIEW_SUB\} onPress=\{onStageView\} \/> : null\}/)
    assert.equal(settings.split('onStageView').length - 1, 3, 'Stage view has a way in from Settings that does not wait for App')
    /* An account without it left on the screen (signed out, say) is on Play; so is Notes anywhere but in a side. */
    assert.match(f, /wasBeside\.current = playBeside if \(\(screen === 'notes' && !\(twoSidesUp && notesAllowed\)\) \|\| \(screen === STAGE_VIEW && !stageViewAllowed\)\) \{ setScreen\('stage'\) \}/)
    /* Siri and the watch take it for Play, which it is; and no update note is put over it mid-song. */
    assert.match(app, /screen: stageViewUp \? 'stage' : screen, shareCard/)
    assert.match(app, /\{playOnScreen \|\| stageViewUp \? null : <UpdateReady /)
    /* Every other way in is one of those two: nothing else sets the screen to it. */
    assert.equal(app.split('setScreen(STAGE_VIEW)').length - 1, 2)
  })

  test('a song’s notes are kept by unit, setlist and slot, cleaned, and cleared by writing nothing', async () => {
    const { songNotes: n } = await rules()
    const s = shelf()
    assert.equal(n.notesIn(s, 'fm3', 'list-a', 12), '')
    assert.equal(n.putNotes(s, 'fm3', 'list-a', 12, 'Verse: Am  G\r\nChorus: F  C  \n\n'), 'Verse: Am  G\nChorus: F  C')
    assert.equal(n.notesIn(s, 'fm3', 'list-a', 12), 'Verse: Am  G\nChorus: F  C')
    /* The same slot in another setlist, and the same setlist's id on another unit (or the demo's drawer), are other songs. */
    assert.equal(n.notesIn(s, 'fm3', 'list-b', 12), '')
    assert.equal(n.notesIn(s, 'am4', 'list-a', 12), '')
    assert.equal(n.notesIn(s, 'demo:fm3', 'list-a', 12), '')
    n.putNotes(s, 'fm3', 'list-b', 12, 'Capo 2')
    n.putNotes(s, 'am4', 'list-a', 0, 'Slot 0 is a song too')
    assert.equal(n.notesIn(s, 'fm3', 'list-a', 12), 'Verse: Am  G\nChorus: F  C')
    assert.equal(n.notesIn(s, 'am4', 'list-a', 0), 'Slot 0 is a song too')
    assert.equal(n.notesCount(s), 3)
    /* One key, under the app's own prefix, and nothing else written. */
    assert.deepEqual([...s.kept.keys()], [n.NOTES_KEY])
    assert.equal(n.NOTES_KEY, 'fractal.songNotes')
    /* Nothing but space clears, and an emptied setlist and unit leave the drawer. */
    assert.equal(n.putNotes(s, 'fm3', 'list-b', 12, '   \n '), '')
    assert.equal(n.putNotes(s, 'am4', 'list-a', 0, ''), '')
    assert.deepEqual(JSON.parse(s.kept.get(n.NOTES_KEY)), { fm3: { 'list-a': { 12: 'Verse: Am  G\nChorus: F  C' } } })
    assert.equal(n.notesCount(s), 1)
    /* No more than the limit is kept, and the limit is the one the box says. */
    assert.equal(n.NOTES_MAX, 4000)
    assert.equal(n.putNotes(s, 'fm3', 'list-a', 3, 'x'.repeat(5000)).length, 4000)
    assert.match(n.notesHint('tablet'), /^Lyrics, chords or cues\. Up to 4,000 characters, kept on this tablet only\.$/)
    assert.doesNotMatch(n.notesHint(), /phone/, 'the box names a phone on a device that may not be one')
    /* Not a song: nothing read, nothing written. */
    const before = s.kept.get(n.NOTES_KEY)
    for (const [drawer, list, slot] of [['', 'list-a', 1], ['fm3', '', 1], ['fm3', 'list-a', -1], ['fm3', 'list-a', 1.5], ['fm3', 'list-a', null], [null, 'list-a', 1]]) {
      assert.equal(n.putNotes(s, drawer, list, slot, 'words'), '')
      assert.equal(n.notesIn(s, drawer, list, slot), '')
    }
    assert.equal(s.kept.get(n.NOTES_KEY), before)
    /* What is stored is never trusted: junk reads as no notes, and the next write starts clean. */
    for (const junk of ['not json', '[1,2]', '"words"', 'null', '{"fm3":"words"}', '{"fm3":{"list-a":[1,2]}}', '{"fm3":{"list-a":{"12":7}}}']) {
      const j = shelf({ [n.NOTES_KEY]: junk })
      assert.equal(n.notesIn(j, 'fm3', 'list-a', 12), '', junk)
      assert.equal(n.notesCount(j), 0, junk)
      assert.equal(n.putNotes(j, 'fm3', 'list-a', 12, 'Capo 2'), 'Capo 2')
      assert.equal(n.notesIn(j, 'fm3', 'list-a', 12), 'Capo 2', junk)
    }
    /* A storage that is not there, or that throws, costs nothing but the keeping. */
    assert.equal(n.notesIn(null, 'fm3', 'list-a', 12), '')
    assert.equal(n.putNotes(null, 'fm3', 'list-a', 12, 'Capo 2'), 'Capo 2')
    const broken = { getItem: () => { throw new Error('no') }, setItem: () => { throw new Error('no') } }
    assert.equal(n.notesIn(broken, 'fm3', 'list-a', 12), '')
    assert.equal(n.putNotes(broken, 'fm3', 'list-a', 12, 'Capo 2'), 'Capo 2')
    /* The first line, for a row with one line to show them in. */
    assert.equal(n.notesPeek('\n\n  Verse:   Am  G \nChorus'), 'Verse: Am G')
    assert.equal(n.notesPeek('x'.repeat(100)).length, 60)
    assert.ok(n.notesPeek('x'.repeat(100)).endsWith('…'))
    assert.equal(n.notesPeek(''), '')
    assert.equal(n.notesPeek(null), '')
  })

  test('Notes follows the setlist’s song, is offered only with a setlist on, and is read at one of three sizes kept on the device', async () => {
    const { songNotes: n, twoSides: t } = await rules()
    const lists = [{ id: 'list-a', name: 'Friday', presets: [12, 3, 40] }, { id: 'list-b', name: 'Empty', presets: [] }]
    /* Only a setlist has songs: not the stars, not the slots, not a setlist that has gone. */
    assert.equal(n.setlistOn('list-a', lists).name, 'Friday')
    for (const source of ['starred', 'all', 'list-gone', '', null, undefined, 7]) assert.equal(n.setlistOn(source, lists), null, String(source))
    assert.equal(n.setlistOn('list-a', null), null)
    assert.equal(n.notesOffered({ allowed: true, source: 'list-a', lists }), true)
    assert.equal(n.notesOffered({ allowed: false, source: 'list-a', lists }), false, 'an account without song notes is offered them')
    assert.equal(n.notesOffered({ allowed: true, source: 'starred', lists }), false, 'Notes is offered with no setlist on')
    assert.equal(n.notesOffered({ allowed: 'yes', source: 'list-a', lists }), false)
    assert.equal(n.notesOffered(), false)
    /* The song is the preset the unit is on, and where it is in the set; Next moves `current`, and the page follows. */
    assert.deepEqual(n.songNow({ source: 'list-a', lists, current: 12 }), { list: lists[0], slot: 12, at: 1, count: 3 })
    assert.deepEqual(n.songNow({ source: 'list-a', lists, current: 40 }), { list: lists[0], slot: 40, at: 3, count: 3 })
    assert.deepEqual(n.songNow({ source: 'list-a', lists, current: 99 }), { list: lists[0], slot: null, at: 0, count: 3 }, 'a preset that is not in the setlist has a song')
    assert.deepEqual(n.songNow({ source: 'list-a', lists, current: null }), { list: lists[0], slot: null, at: 0, count: 3 })
    assert.equal(n.songNow({ source: 'starred', lists, current: 12 }), null)
    assert.equal(n.songNow(), null)
    /* Three sizes, starting in the middle, stepped one at a time and held at the ends, kept under their own key. */
    assert.deepEqual(n.NOTE_SIZES, [18, 24, 32])
    assert.equal(n.NOTE_SIZE_NAMES.length, n.NOTE_SIZES.length)
    const s = shelf()
    assert.equal(n.sizeIn(s), 1)
    assert.equal(n.stepSize(s, 1, 1), 2)
    assert.equal(n.sizeIn(s), 2)
    assert.equal(n.stepSize(s, 2, 1), 2, 'bigger than the biggest')
    assert.equal(n.stepSize(s, 2, -1), 1)
    assert.equal(n.stepSize(s, 1, -1), 0)
    assert.equal(n.stepSize(s, 0, -1), 0, 'smaller than the smallest')
    assert.deepEqual([...s.kept.keys()], [n.NOTES_SIZE_KEY])
    for (const junk of ['9', '-1', 'big', '1.5', '']) assert.equal(n.sizeIn(shelf({ [n.NOTES_SIZE_KEY]: junk })), junk === '' ? 0 : 1, junk)
    assert.equal(n.sizeIn(null), 1)

    /* Beside Play: on the list after Setlists, by name, only when it is offered; and every rule for a side takes it as a tool. */
    assert.deepEqual(t.TOOLS, ['edit', 'setlists', 'notes', 'presets', 'tuner'])
    assert.equal(t.TOOL_NAMES.notes, 'Notes')
    assert.equal(n.NOTES_NAME, t.TOOL_NAMES.notes)
    assert.deepEqual(t.sideTools({ notesOffered: true }), ['setlists', 'notes'])
    assert.deepEqual(t.sideTools({ editOpens: true, presetsOffered: true, tunerOffered: true, notesOffered: true }), ['edit', 'setlists', 'notes', 'presets', 'tuner'])
    assert.deepEqual(t.sideTools({ editOpens: true, presetsOffered: true, tunerOffered: true }), ['edit', 'setlists', 'presets', 'tuner'], 'Notes is on the list without being offered')
    assert.deepEqual(t.sideTools({ notesOffered: 'yes' }), ['setlists'], 'only a plain true offers it')
    assert.equal(t.isTool('notes'), true)
    assert.deepEqual(t.whenNarrow({ tool: 'notes', sideFull: false }), { screen: 'stage', keep: 'notes' })
    assert.equal(t.tunerGivesBack('notes'), 'notes', 'the tuner borrowing the side from Notes does not give it back')
    assert.equal(t.tunerGoes({ allowed: true, wide: true, screen: 'stageview' }), null, 'the tuner turned on in Stage view opens a side and leaves the view')
  })

  test('App offers Notes beside Play only for an account with song notes and a setlist on, and the Setlists screen writes them only for that account', () => {
    const app = code(read('mobile/App.js'))
    const f = flat(read('mobile/App.js'))
    assert.match(f, /notesOffered: notesOffered\(\{ allowed: notesAllowed, source: sourceFor\(rigSlug\), lists: listsFor\(rigSlug\) \}\) \}\)/)
    /* App is told when what is stored changes, so the list follows a setlist turned on or off. */
    assert.match(app, /\n\s*useStored\(\)\n\s*const stageViewAllowed/)
    assert.match(f, /\) : sideTool === 'notes' \? \( <NotesSide onBack=\{closeSide\} \/> \) : sideTool === 'tuner' \? \(/)
    assert.match(app, /<Setlists onBack=\{\(\) => setScreen\('stage'\)\} notes=\{notesAllowed\} \/>/)
    assert.match(app, /<Setlists onBack=\{closeSide\} notes=\{notesAllowed\} \/>/)
    /* Setlists hands the answer to each song's setup, which draws the Notes button and the box only with it. */
    const setlists = flat(read('mobile/src/screens/Setlists.js'))
    assert.match(setlists, /export default function Setlists\(\{ onBack, notes = false \}\)/)
    assert.match(setlists, /<SongSetup device=\{device\} list=\{chosen\} nameOf=\{nameOfSlot\} addressing=\{addressing\} notes=\{notes\} \/>/)
    const setup = flat(read('mobile/src/components/SongSetup.js'))
    assert.match(setup, /export default function SongSetup\(\{ device, list, nameOf, addressing, notes = false \}\)/)
    assert.match(setup, /\{notes \? \( <Press label=\{notesFor\(device, list\.id, n\) \? NOTES_NAME : NOTES_ADD\} /)
    assert.match(setup, /\{notes \? <NotesBox open=\{noting !== null\} device=\{device\} listId=\{list\.id\} slot=\{noting\} /)
    assert.equal(setup.split('<NotesBox').length - 1, 1)
    /* Stage view's Notes button: an account with song notes, and a setlist on. */
    assert.match(flat(read('mobile/src/screens/Stage.js')), /notes=\{songNotes && setlistOn\(source, lists\) !== null\}/)
    const view = flat(read('mobile/src/components/StageView.js'))
    assert.match(view, /\{notes \? <Press label=\{NOTES_NAME\} height=\{STAGE_TOP\} tone="signal" on=\{notesUp\} /)
    assert.match(view, /const showNotes = notes && notesUp/)
    assert.match(view, /\{showNotes \? \( <View [^>]*> <NotesPage \/> <\/View> \) : null\}/)

    /* The page: the song the unit is on, read from what is stored at every draw; the empty words with Add notes; a size control; one box to type in. */
    const notes = flat(read('mobile/src/components/SongNotes.js'))
    assert.match(notes, /const song = songNow\(\{ source: sourceFor\(device\), lists: listsFor\(device\), current: preset\?\.number \}\)/)
    assert.match(notes, /export function NotesPage\(\{ style \}\) \{ useStored\(\) useNamesHeard\(\)/)
    assert.match(notes, /\{NOTES_EMPTY\}/)
    assert.match(notes, /<Press label=\{text \? NOTES_EDIT : NOTES_ADD\} /)
    assert.match(notes, /onPress=\{\(\) => stepNoteSize\(step, -1\)\}/)
    assert.match(notes, /onPress=\{\(\) => stepNoteSize\(step, 1\)\}/)
    assert.match(notes, /fontSize: NOTE_SIZES\[step\]/)
    assert.match(notes, /<ScrollView style=\{\{ flex: 1 \}\}/)
    /* The box: many lines, the limit held by the field and said under it in this device's own word, and nothing kept until Save. */
    assert.match(notes, /<TextInput ref=\{field\} autoFocus multiline value=\{text\} onChangeText=\{setText\} maxLength=\{NOTES_MAX\} /)
    assert.match(notes, /\$\{notesHint\(deviceNoun\(\)\)\} \$\{text\.length\.toLocaleString\('en-US'\)\} of \$\{NOTES_MAX\.toLocaleString\('en-US'\)\}\./)
    assert.match(notes, /const save = \(\) => \{ tick\(\) keepNotes\(device, listId, slot, text\) onClose\(\) \}/)
    assert.equal(notes.split('keepNotes(').length - 1, 1, 'notes are written somewhere other than Save')
    assert.match(notes, /supportedOrientations=\{ANY_WAY_UP\}/)
  })

  test('a song’s notes stay on the device: nothing but their own screens reads them, and no log, report or sync has a way to', () => {
    /* The rule file takes its storage as an argument and imports nothing; the binding hands it the device's own, in the setlist's drawer. */
    const here = code(read('mobile/src/lib/notesHere.js'))
    assert.deepEqual([...here.matchAll(/from '([^']+)'/g)].map((m) => m[1]).sort(), ['./demo', './device-slug', './songNotes', './store'])
    assert.match(here, /const drawer = \(device\) => stageKey\(device, isDemo\(\)\)/)
    /* Every file of the phone app that can reach the notes at all. A log, a report, the account sync or the link to the computer on this list is the notes leaving the device. */
    const reach = /from '[^']*\/(songNotes|notesHere|SongNotes)'|fractal\.songNotes/
    const reaching = [...filesUnder('mobile/src'), 'mobile/App.js'].filter((f) => reach.test(read(f))).sort()
    assert.deepEqual(reaching, [
      'mobile/App.js',
      'mobile/src/components/SongNotes.js',
      'mobile/src/components/SongSetup.js',
      'mobile/src/components/StageView.js',
      'mobile/src/lib/notesHere.js',
      'mobile/src/lib/songNotes.js',
      'mobile/src/screens/Stage.js'
    ])
    /* And of those, App, Play and Stage view take only the rules and the screens, never the words themselves. */
    assert.match(code(read('mobile/App.js')), /import \{ notesOffered, songNotesOn \} from '\.\/src\/lib\/songNotes'\nimport \{ NotesSide \} from '\.\/src\/components\/SongNotes'\n/)
    assert.match(code(read('mobile/src/screens/Stage.js')), /import \{ setlistOn \} from '\.\.\/lib\/songNotes'\n/)
    assert.match(code(read('mobile/src/components/StageView.js')), /import \{ NOTES_NAME \} from '\.\.\/lib\/songNotes'\n/)
    for (const f of ['mobile/App.js', 'mobile/src/screens/Stage.js', 'mobile/src/components/StageView.js']) {
      assert.doesNotMatch(read(f), /notesFor\(|notesIn\(|keepNotes\(|putNotes\(/, `${f} reads or writes a song’s notes itself`)
    }
    /* The setlists the account carries are cleaned to a scene and a tempo: a song there has no notes to send. */
    assert.doesNotMatch(code(read('mobile/src/lib/cloudSetlists.js')), /notes/i)
    const clean = code(read('mobile/src/lib/setlists.js'))
    const song = clean.slice(clean.indexOf('const cleanSong = '), clean.indexOf('export function cleanSongs'))
    assert.ok(song.length > 100, 'the rule that cleans a setlist’s song has moved; this check reads it')
    assert.doesNotMatch(song, /notes/, 'a setlist’s song carries notes now: they would travel with the account, and the notes’ own drawer is no longer the one place they are')
  })

  test('the new screens name the device in hand, and say nothing they should not', () => {
    for (const f of ['mobile/src/lib/stageView.js', 'mobile/src/lib/songNotes.js', 'mobile/src/components/StageView.js', 'mobile/src/components/SongNotes.js']) {
      const src = code(read(f))
      assert.doesNotMatch(src, /this phone|your phone/i, `${f} says phone on a device that may not be one`)
      assert.doesNotMatch(src, /\bbeta\b|\bofficial\b|\btried\b|\bcertified\b/i, f)
    }
  })
}

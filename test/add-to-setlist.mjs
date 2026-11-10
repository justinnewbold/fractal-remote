/**
 * A PRESET INTO A SETLIST FROM ALL PRESETS: hold a preset, pick the setlist
 * (mobile/src/lib/addToSetlist.js, lib/useAddToSetlist.js,
 * screens/Presets.js).
 *
 * "Drag a preset from All presets into a setlist" was one of the ideas
 * Justin said yes to on 10 November 2026 ("yes to all your other non build
 * suggestions as well"). Built as a hold on every device; the drag itself
 * is not built (the rule file says why). His account until features
 * ADD_TO_SETLIST_FOR_EVERYONE opens it; closed to an account, a hold on a
 * preset is its colour tag, exactly as it was.
 *
 * The rule file imports nothing and is run as it is; the add itself is the
 * setlists module's own (src/lib/setlists.js, which the phone's copy is
 * generated from), run here on a storage of its own. The rest is read for
 * how it is wired.
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

/** lib/addToSetlist, run from a copy: it imports nothing. */
async function rules() {
  const dir = mkdtempSync(join(tmpdir(), 'add-to-setlist-'))
  try {
    writeFileSync(join(dir, 'package.json'), '{ "type": "module" }')
    const src = read('mobile/src/lib/addToSetlist.js')
    assert.doesNotMatch(src, /^import /m, 'lib/addToSetlist imports something; this check runs it on its own')
    writeFileSync(join(dir, 'addToSetlist.js'), src)
    return await import(pathToFileURL(join(dir, 'addToSetlist.js')).href)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

/* A storage of its own, as the phone hands the shared module one. */
const storage = () => {
  const kept = new Map()
  return { getItem: (k) => (kept.has(k) ? kept.get(k) : null), setItem: (k, v) => kept.set(k, String(v)), removeItem: (k) => kept.delete(k) }
}

export function run(test) {
  test('add to setlist: the sheet lists every setlist, the one in use first, then Starred, and says which already have the preset', async () => {
    const r = await rules()
    const lists = [
      { id: 'sa', name: 'Friday gig', presets: [3, 12, 40] },
      { id: 'sb', name: 'Rehearsal', presets: [] },
      { id: 'sc', name: '  Covers  ', presets: [12] }
    ]
    const rows = r.addChoices({ lists, source: 'sc', favourites: [7], slot: 12 })
    assert.deepEqual(
      rows.map((x) => [x.kind, x.id, x.name, x.sub, x.has, x.inUse]),
      [
        ['list', 'sc', 'Covers', 'Already in this setlist', true, true],
        ['list', 'sa', 'Friday gig', 'Already in this setlist', true, false],
        ['list', 'sb', 'Rehearsal', 'Empty', false, false],
        ['starred', 'starred', '★ Starred', '1 preset', false, false]
      ]
    )
    /* A preset none of them has: each says how long it is, the one Previous and Next follow says so. */
    assert.deepEqual(
      r.addChoices({ lists, source: 'sa', favourites: [7, 9], slot: 99 }).map((x) => [x.id, x.sub, x.has]),
      [
        ['sa', '3 songs · On now', false],
        ['sb', 'Empty', false],
        ['sc', '1 song', false],
        ['starred', '2 presets', false]
      ]
    )
    /* Starred already, and Starred being what Previous and Next follow. */
    const starred = r.addChoices({ lists: [], source: 'starred', favourites: [5], slot: 5 })
    assert.deepEqual(starred, [{ kind: 'starred', id: 'starred', name: '★ Starred', sub: 'Already starred', has: true, inUse: true }])
    /* No setlists yet: Starred alone (the sheet has New setlist under it). */
    assert.deepEqual(r.addChoices({ slot: 1 }).map((x) => [x.id, x.sub]), [['starred', 'Nothing starred yet']])
    /* Never a row for something that is not a setlist, and never "already" for a slot that is not one. */
    const odd = r.addChoices({ lists: [null, 'x', { name: 'No id' }, { id: '', presets: [1] }, { id: 'ok', presets: 'nope' }], favourites: null, slot: null })
    assert.deepEqual(odd.map((x) => [x.id, x.name, x.sub, x.has]), [
      ['ok', 'Setlist', 'Empty', false],
      ['starred', '★ Starred', 'Nothing starred yet', false]
    ])
    assert.equal(r.songsSay(0), 'Empty')
    assert.equal(r.songsSay(1), '1 song')
    assert.equal(r.songsSay(24), '24 songs')
    assert.equal(r.addedSays('Friday gig'), 'Added to Friday gig')
    assert.equal(r.addedSays('  Covers '), 'Added to Covers')
    assert.equal(r.addedSays(''), 'Added to the setlist')
    /* The words: never the device in hand, never what has or has not been tried. */
    for (const w of Object.values(r.ADD_WORDS)) {
      assert.equal(typeof w, 'string')
      assert.doesNotMatch(w, /this phone|beta|tried|official/i)
    }
    assert.equal(r.ADD_WORDS.section, 'Add to setlist')
    assert.ok(r.ADDED_MS >= 3000 && r.ADDED_MS <= 6000, 'long enough to read, short enough not to sit over Done')
    assert.ok(r.COLOUR_AFTER_MS >= 300, 'one sheet is away before the next comes up')
  })

  test('add to setlist: the add is the setlists’ own: on the end, once, the songs already set up untouched, and said only of a save that reads back', async () => {
    const r = await rules()
    const s = await import('../src/lib/setlists.js')
    const box = storage()
    const unit = 'fm3'
    const list = s.createList(unit, 'Friday gig', box)
    s.updateList(unit, list.id, { presets: [3, 12], songs: { 12: { scene: 2, bpm: 120 } } }, box)
    const before = s.listsFor(unit, box).find((l) => l.id === list.id)
    /* What screens/Presets does: the list as it stands, the preset on its end, the list saved. */
    const add = (id, n) => {
      const now = s.listsFor(unit, box).find((l) => l.id === id)
      return s.updateList(unit, id, { presets: s.addTo(now.presets, n) }, box)
    }
    let after = add(list.id, 40)
    assert.equal(r.landedIn(after, list.id, 40), true)
    assert.deepEqual(after.find((l) => l.id === list.id).presets, [3, 12, 40], 'on the end, in order')
    assert.deepEqual(after.find((l) => l.id === list.id).songs, before.songs, 'a song’s own scene and tempo are not touched')
    /* The sheet now says so, and the row is not tapped. */
    assert.equal(r.addChoices({ lists: after, slot: 40 })[0].has, true)
    /* Added again all the same (two devices, a slow tap): still once. */
    after = add(list.id, 40)
    assert.deepEqual(after.find((l) => l.id === list.id).presets, [3, 12, 40])
    /* Slot 0 is a preset like any other. */
    after = add(list.id, 0)
    assert.deepEqual(after.find((l) => l.id === list.id).presets, [3, 12, 40, 0])
    assert.equal(r.landedIn(after, list.id, 0), true)
    /* A new setlist with the preset in it, and Previous and Next still following what they followed. */
    s.setSource(unit, list.id, box)
    const fresh = s.createList(unit, undefined, box)
    after = add(fresh.id, 7)
    assert.deepEqual(after.find((l) => l.id === fresh.id).presets, [7])
    assert.equal(s.sourceFor(unit, box), list.id, 'adding to another setlist changed what Previous and Next follow')
    /* Another unit's setlists are another drawer. */
    assert.deepEqual(s.listsFor('am4', box), [])
    /* Never "Added" of a save that did not land. */
    assert.equal(r.landedIn(after, 'gone', 7), false)
    assert.equal(r.landedIn(after, fresh.id, 8), false)
    assert.equal(r.landedIn(null, fresh.id, 7), false)
    assert.equal(r.landedIn(after, fresh.id, -1), false)
    assert.equal(r.landedIn(after, fresh.id, '7'), false)
  })

  test('add to setlist: his account only, and closed to an account a hold on a preset is its colour tag and nothing else', async () => {
    const r = await rules()
    assert.equal(r.addToSetlistOn({ admin: true, everyone: false }), true)
    assert.equal(r.addToSetlistOn({ admin: false, everyone: false }), false)
    assert.equal(r.addToSetlistOn({ admin: false, everyone: true }), true)
    assert.equal(r.addToSetlistOn(), false)
    assert.equal(r.addToSetlistOn({ admin: 'yes' }), false, 'only a plain yes')
    const features = code(read('mobile/src/lib/features.js'))
    assert.match(features, /export const ADD_TO_SETLIST_FOR_EVERYONE = true\n/, 'Add to setlist is closed to customers again')
    const hook = flat(read('mobile/src/lib/useAddToSetlist.js'))
    assert.match(hook, /export const useAddToSetlist = \(\) => addToSetlistOn\(\{ admin: useBluetoothAdmin\(\), everyone: ADD_TO_SETLIST_FOR_EVERYONE \}\)/)

    const presets = flat(read('mobile/src/screens/Presets.js'))
    assert.match(presets, /const addOpen = useAddToSetlist\(\) && Boolean\(device\) /, 'nothing to file a setlist under before a unit has answered')
    /* Closed: the hold, its hint and the line under the list are the colour tag's, as they were. */
    assert.match(presets, /onLongPress=\{addOpen \? \(\) => hold\(\{ n, words, target \}\) : target \? \(\) => setPainting\(target\) : undefined\} accessibilityHint=\{addOpen \? ADD_WORDS\.hint : target \? TAG_HOLD\.hint : undefined\}/)
    assert.match(presets, /shown\.length && \(addOpen \|\| presetTarget\(shown\[0\]\)\) \? \( <Text [^>]*> \{addOpen \? ADD_WORDS\.hold : TAG_HOLD\.phone\} <\/Text> \) : null/)
    /* And neither the sheet nor the line that says it worked is in the tree. */
    assert.match(presets, /\{addOpen \? \( <Sheet open=\{adding && held !== null\} onClose=\{\(\) => setAdding\(false\)\} title=\{held\?\.words \|\| ''\}>/)
    assert.match(presets, /\{addOpen \? \( <Toast open=\{addedNews\}> \{addedNews \? \( <Note tone=\{added\.tone\} onDismiss=\{\(\) => setAdded\(null\)\}> \{added\.said\} <\/Note> \) : null\} <\/Toast> \) : null\}/)
    assert.match(presets, /const choices = addOpen && held \? addChoices\(\{ lists: listsFor\(device\), source: sourceFor\(device\), favourites, slot: held\.n \}\) : \[\]/)
    /* The tap still loads and the star still stars: the row's other two jobs are untouched. */
    assert.match(presets, /onPress=\{\(\) => \{ loadPreset\(n\) if \(!stay\) onBack\?\.\(\) \}\}/)
    assert.match(presets, /onPress=\{\(\) => toggleFavourite\(device, n\)\}/)
  })

  test('add to setlist: the sheet adds by the Setlists page’s own calls, says what happened, and keeps the colour one tap away', () => {
    const src = read('mobile/src/screens/Presets.js')
    const presets = flat(src)
    /* The same bound functions the Setlists page uses (lib/lists: the unit's own drawer, or the demo's), never the storage itself. */
    assert.match(presets, /import \{ addTo, createList, listsFor, sourceFor, updateList \} from '\.\.\/lib\/lists'/)
    assert.match(flat(read('mobile/src/screens/Setlists.js')), /const setPresets = \(presets\) => \{ if \(!chosen\) return updateList\(device, chosen\.id, \{ presets \}\) \}/, 'the Setlists page saves a list’s presets another way now; Add to setlist follows it')
    assert.match(presets, /const list = listsFor\(device\)\.find\(\(l\) => l\.id === choice\.id\) const after = list \? updateList\(device, list\.id, \{ presets: addTo\(list\.presets, held\.n\) \}\) : null done\(Boolean\(list\) && landedIn\(after, list\.id, held\.n\), list\?\.name\)/)
    assert.match(presets, /const list = createList\(device\) const after = list \? updateList\(device, list\.id, \{ presets: addTo\(list\.presets, held\.n\) \}\) : null/)
    assert.doesNotMatch(presets, /setSource\(/, 'adding a preset changes what Previous and Next follow')
    /* A setlist that has it already is not tapped, in the rule and on the sheet. */
    assert.match(presets, /const addHere = \(choice\) => \{ if \(!held \|\| choice\.has\) return /)
    assert.match(presets, /<Press key=\{c\.id\} label=\{c\.name\} sub=\{c\.sub\} disabled=\{c\.has\} onPress=\{\(\) => addHere\(c\)\} /)
    /* Starred by the star's own call, and only ever on. */
    assert.match(presets, /if \(choice\.kind === 'starred'\) \{ const stars = toggleFavourite\(device, held\.n\) done\(Array\.isArray\(stars\) && stars\.includes\(held\.n\), 'Starred'\) return \}/)
    /* "Added to …" for a few seconds, and until its ✕ with a screen reader on (components/Toast). */
    assert.match(presets, /setAdded\(\{ said: ok \? addedSays\(name\) : ADD_WORDS\.failed, tone: ok \? 'hint' : 'fault', at: Date\.now\(\) \}\)/)
    assert.match(presets, /const addedLeft = added \? Math\.max\(0, added\.at \+ ADDED_MS - Date\.now\(\)\) : 0 const addedNews = useStillNews\(added \? added\.said : null, added\?\.at, addedLeft\)/)
    /* The colour the hold used to open: the sheet's last row, opened once this sheet is away, and only where there is a tag to file. */
    assert.match(presets, /<Press label=\{ADD_WORDS\.fresh\} sub=\{ADD_WORDS\.freshSub\} onPress=\{addToNew\} \/> \{held\?\.target \? <Press label=\{ADD_WORDS\.colour\} onPress=\{toColour\} \/> : null\}/)
    assert.match(presets, /const toColour = \(\) => \{ const target = held\?\.target setAdding\(false\) if \(!target\) return clearTimeout\(colourTimer\.current\) colourTimer\.current = setTimeout\(\(\) => setPainting\(target\), COLOUR_AFTER_MS\) \}/)
    assert.match(presets, /useEffect\(\(\) => \(\) => clearTimeout\(colourTimer\.current\), \[\]\)/)
    assert.match(presets, /<ColourSheet target=\{painting\} onClose=\{\(\) => setPainting\(null\)\} \/>/)
    /* A hold never loads the preset (Press), so adding one mid-song never changes what the unit is playing. */
    assert.doesNotMatch(presets.slice(presets.indexOf('const hold = (row)'), presets.indexOf('const addedLeft')), /loadPreset/)
    /* The drag is not built: nothing here takes a finger away from the list. */
    assert.doesNotMatch(src, /PanResponder|onResponderMove|onMoveShouldSet/)
    /* The row is as tall as it was: the list jumps by a fixed height. */
    assert.match(src, /const ROW = TAP\nconst GAP = 8\nconst STRIDE = ROW \+ GAP\n/)
  })
}

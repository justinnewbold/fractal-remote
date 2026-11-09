/**
 * The walkthrough and the Unlock page on a tablet: grown to fill it, and a
 * phone exactly as it was.
 *
 * "I'm on iPad these screens are not using the space very efficiently. Very
 * small. Let's use all available space we can to take advantage of iPad
 * screen." (Justin, 9 November 2026, on an iPad Pro held upright.) The
 * walkthrough sat phone-sized in the top half of the screen, and the Unlock
 * sheet was a 480-point strip down the middle.
 *
 * lib/tabletScale decides it from the window alone: a short side of 600
 * points or more is a tablet's (Android's own line, plugins/withTabletTurns),
 * so an Android tablet is one, an iPad in a narrow strip beside another app
 * is not, and an iPad on its side keeps its size. These cases run the rule
 * itself, and read the two screens for the way it reaches them.
 */
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')
/* Comments out, so a check reads the code and not its explanation. */
const code = (src) => src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ')
const flat = (src) => code(src).replace(/\s+/g, ' ')

/** lib/tabletScale, run: a copy as .mjs, since the phone's .js is not a module to node. It imports nothing. */
async function rule() {
  const src = read('mobile/src/lib/tabletScale.js')
  assert.ok(!/^import /m.test(src), 'lib/tabletScale imports something, and this check runs it alone')
  const dir = mkdtempSync(join(tmpdir(), 'tablet-scale-'))
  try {
    const file = join(dir, 'tabletScale.mjs')
    writeFileSync(file, src)
    return await import(pathToFileURL(file).href)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

/* The theme's sizes, as theme.js has them, read off the file the phone draws with. */
function themeSizes() {
  const theme = read('mobile/src/lib/theme.js')
  const block = (name) =>
    Object.fromEntries([...theme.match(new RegExp(`export const ${name} = \\{([^}]*)\\}`))[1].matchAll(/(\w+): (\d+)/g)].map((m) => [m[1], Number(m[2])]))
  return { font: block('font'), space: block('space'), TAP: Number(theme.match(/export const TAP = (\d+)/)[1]) }
}

/* Phones, every way up, and the windows an iPad gives when it is not a tablet's: a strip beside another app, Slide Over, and the frame before anything is measured. */
const PHONES = [
  [320, 568],
  [375, 667],
  [390, 844],
  [393, 852],
  [430, 932],
  [360, 800],
  [411.4285714, 914.2857143],
  [844, 390],
  [932, 430],
  [507, 1366],
  [320, 1024],
  [375, 1366],
  [599, 1000],
  [0, 0]
]

/* Tablets: a 12.9-inch iPad Pro upright and on its side, an iPad, an iPad mini, an Android tablet, one exactly on the line, an iPad Pro half of a split screen on its side, and one bigger than any iPad. */
const TABLETS = [
  [1024, 1366, 1.4],
  [1366, 1024, 1.4],
  [820, 1180, 1.3],
  [744, 1133, 1.27],
  [800, 1280, 1.29],
  [600, 960, 1.2],
  [678, 1024, 1.24],
  [1200, 1920, 1.4]
]

function phoneFiles() {
  const out = [fileURLToPath(new URL('../mobile/App.js', import.meta.url))]
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const at = join(dir, name)
      if (statSync(at).isDirectory()) walk(at)
      else if (/\.js$/.test(name)) out.push(at)
    }
  }
  walk(fileURLToPath(new URL('../mobile/src/', import.meta.url)))
  return out
}

export function run(test) {
  test('tablet room: a phone, any way up, and an iPad in a narrow strip, are drawn exactly as they were', async () => {
    const r = await rule()
    const base = themeSizes()
    for (const [w, h] of PHONES) {
      const where = `${w}×${h}`
      assert.equal(r.isTabletWindow(w, h), false, `${where} is taken for a tablet`)
      assert.equal(r.growBy(w, h), 1, `${where} is grown`)
      const room = r.roomFor(w, h, base)
      assert.equal(room.tablet, false)
      assert.equal(room.k, 1)
      /* The very objects the theme has, so every size on the two screens is the number it always was. */
      assert.equal(room.font, base.font, `${where}: the walkthrough's words are not the theme's own`)
      assert.equal(room.space, base.space, `${where}: the walkthrough's spacing is not the theme's own`)
      assert.equal(room.TAP, base.TAP, `${where}: a button is not the stage's 56`)
      for (const n of [0, 1, 2, 10, 14, 26, 30, 34, 56, 58, 92, 105, 132, 411.43]) assert.equal(room.grow(n), n, `${where}: ${n} is drawn at another size`)
      /* No column, no spring, no wider sheet, no margin for the contour lines. */
      assert.equal(room.page, null, `${where}: the page is laid out as a column`)
      assert.equal(room.sheet, null, `${where}: the Unlock sheet is widened`)
      assert.equal(room.inset, 0)
      /* The button and the note get the props they were given, the same object. */
      const props = { label: 'Restore a purchase', disabled: false }
      assert.equal(r.grownPress(props, room, { bodySize: base.font.body }), props, `${where}: a button is handed other props`)
      assert.equal(r.grownNote(props, room), props, `${where}: a note is handed other props`)
    }
    assert.deepEqual(themeSizes(), base, 'the rule changed the theme’s own sizes')
  })

  test('tablet room: a tablet, either way up, draws the two screens bigger by one factor, in a centred column, with a wider Unlock sheet', async () => {
    const r = await rule()
    const base = themeSizes()
    assert.equal(r.TABLET_SIDE, 600, 'a tablet is not Android’s 600 points of short side')
    assert.ok(r.GROW_LEAST >= 1.2 && r.GROW_MOST <= 1.5 && r.GROW_LEAST < r.GROW_MOST, 'the growth is out of the 1.2 to 1.5 asked for')
    assert.ok(r.COLUMN_MOST >= 760 && r.COLUMN_MOST <= 900, 'the column is narrower or wider than a comfortable read')
    for (const [w, h, k] of TABLETS) {
      const where = `${w}×${h}`
      assert.equal(r.isTabletWindow(w, h), true, `${where} is not taken for a tablet`)
      assert.equal(r.growBy(w, h), k, `${where} is grown by ${r.growBy(w, h)}, not ${k}`)
      /* Either way up, the same: an iPad turned keeps its size. */
      assert.equal(r.growBy(h, w), k, `${where} turned is grown by another factor`)
      const room = r.roomFor(w, h, base)
      assert.equal(room.tablet, true)
      for (const [name, sizes] of [['font', base.font], ['space', base.space]]) {
        for (const [key, n] of Object.entries(sizes)) assert.equal(room[name][key], Math.round(n * k), `${where}: ${name}.${key}`)
      }
      assert.equal(room.TAP, Math.round(base.TAP * k))
      assert.equal(room.grow(92), Math.round(92 * k))
      assert.deepEqual(room.page, { flexGrow: 1, width: '100%', maxWidth: r.COLUMN_MOST, alignSelf: 'center' }, `${where}: the page is not a centred column`)
      assert.ok(!('justifyContent' in room.page), `${where}: the column centres a page that can outgrow the screen (test/mobile.mjs)`)
      /* Wider than the 480 strip it was, and never past the window. */
      assert.ok(room.sheet >= 480 && room.sheet <= Math.min(w, r.SHEET_MOST), `${where}: the Unlock sheet is ${room.sheet} wide`)
      assert.equal(room.inset, Math.max(0, Math.round((w - r.COLUMN_MOST) / 2)))
      /* The button: its words grown, the room's own height when it gave none, and a height it gave kept. */
      const pressed = r.grownPress({ label: 'Unlock' }, room, { bodySize: base.font.body })
      assert.deepEqual(pressed, { label: 'Unlock', height: room.TAP, labelSize: Math.round(base.font.body * k) })
      assert.equal(r.grownPress({ label: 'Computer', height: 44 }, room, { bodySize: base.font.body }).height, 44, `${where}: a row of small choices is grown past its own height`)
      assert.equal(r.grownNote({ children: 'x' }, room).size, room.font.small)
      assert.equal(r.grownNote({ children: 'x', size: 30 }, room).size, 30)
    }
    /* The 12.9-inch iPad Pro the screenshots came from: upright, the sheet 80% of 1024; on its side, SHEET_MOST. */
    assert.equal(r.roomFor(1024, 1366, base).sheet, 819)
    assert.equal(r.roomFor(1366, 1024, base).sheet, r.SHEET_MOST)
    /* One answer for one window, so every piece of a screen gets the same room. */
    assert.equal(r.roomFor(1024, 1366, base), r.roomFor(1024, 1366, base))
  })

  test('tablet room: the walkthrough and the Unlock page take every size from the room, and only they do', () => {
    const onb = read('mobile/src/screens/Onboarding.js')
    const pay = read('mobile/src/screens/Paywall.js')
    for (const [file, src] of [['Onboarding.js', onb], ['Paywall.js', pay]]) {
      /* The theme's sizes are not imported at all, so none can be drawn at its phone size by mistake on a tablet. */
      const theme = src.match(/^import \{([^}]*)\} from '\.\.\/lib\/theme'$/m)
      assert.ok(theme, `${file} no longer takes its colours from the theme; this check reads that line`)
      for (const name of ['font', 'space', 'TAP']) assert.ok(!theme[1].split(',').map((s) => s.trim()).includes(name), `${file} draws with the theme’s ${name}, not the room’s`)
      assert.match(src, /^import \{ useRoom \} from '\.\.\/lib\/useRoom'$/m)
      assert.match(src, /^import \{ RoomNote as Note, RoomPress as Press \} from '\.\.\/components\/Roomy'$/m, `${file} draws the phone-sized button and note`)
    }
    /* The springs that stand a short page in the middle of a tablet: only there, one above and one below. */
    const onbFlat = flat(onb)
    assert.equal(onbFlat.split('{room.tablet ? <View style={{ flexGrow: 1 }} /> : null}').length - 1, 2, 'the walkthrough is not stood in the middle of a tablet, or is on a phone')
    assert.match(onbFlat, /contentContainerStyle=\{\{ padding: space\.lg, gap: space\.lg, paddingBottom: space\.xxl, \.\.\.room\.page \}\}/)
    const payFlat = flat(pay)
    assert.match(payFlat, /const spring = room\.tablet && !asked \? <View style=\{\{ flexGrow: 1 \}\} \/> : null/, 'the Unlock page is stood in the middle of the screen in its sheet, or on a phone')
    assert.equal(payFlat.split('{spring}').length - 1, 2)
    assert.match(payFlat, /contentContainerStyle: \{ padding: space\.lg, gap: space\.lg, \.\.\.room\.page \}/)
    assert.match(payFlat, /<Sheet open tall wide=\{room\.sheet\}/)
    /* The room is the window's, never the kind of device. */
    const hook = code(read('mobile/src/lib/useRoom.js'))
    assert.match(hook, /const \{ width, height \} = useWindowDimensions\(\)/)
    assert.doesNotMatch(hook + code(read('mobile/src/lib/tabletScale.js')), /Platform|isPad|orientation/, 'the room asks what the device is rather than how big the window is')
  })

  test('tablet room: only the Unlock sheet comes up wider, and a sheet without `wide` is exactly the sheet it was', () => {
    const sheet = flat(read('mobile/src/components/Sheet.js'))
    assert.match(sheet, /export default function Sheet\(\{ open, onClose, title, note, head, foot, tall = false, wide = null, children \}\)/)
    assert.match(sheet, /\}, wide \? \{ width: '100%', maxWidth: wide, alignSelf: 'center' \} : null\]\}/, 'a sheet without `wide` is drawn with something more')
    const users = []
    for (const file of phoneFiles()) {
      const src = readFileSync(file, 'utf8')
      for (const _ of src.matchAll(/<Sheet\b[^>]*\bwide=/g)) users.push(file.split('/mobile/')[1])
    }
    assert.deepEqual(users, ['src/screens/Paywall.js'], 'another sheet comes up wider on a tablet')
    /* The cards of Here's the app grow on the walkthrough alone: everywhere else they are drawn at 1. */
    const walk = flat(read('mobile/src/components/Walk.js'))
    assert.match(walk, /const grow = \(n\) => \(k === 1 \? n : Math\.round\(n \* k\)\)/)
    const growers = []
    for (const file of phoneFiles()) {
      for (const m of readFileSync(file, 'utf8').matchAll(/<TipCard\b[^>]*\bk=\{([^}]*)\}/g)) growers.push([file.split('/mobile/')[1], m[1]])
    }
    assert.deepEqual(growers, [['src/screens/Onboarding.js', 'room.k']], 'a card outside the walkthrough is grown')
  })
}

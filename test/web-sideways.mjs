/**
 * PLAY IN A PHONE'S BROWSER, THE PHONE HELD ON ITS SIDE: two halves of
 * square tiles (src/lib/sidewaysPlay.js, src/components/Gig.jsx,
 * src/components/SideHead.jsx, src/components/TopBar.jsx, src/App.jsx and
 * the last section of src/styles.css).
 *
 * "This is the landscape view on iPhone ... let's split the screen in half
 * kind of like the iPhone duo even though things will be smaller." and
 * "Can you make the icons more square looking instead of stretched?"
 * (Justin, 10 November 2026.) The screenshot was the website in his
 * iPhone's browser, so this is the browser's own: HIS ACCOUNT ONLY until
 * PHONE_SIDEWAYS_ON_THE_WEB_FOR_EVERYONE says everyone, and with it closed
 * the page is exactly what it was.
 *
 * The browser never imports from mobile/, so it has its own copy of the
 * squares' rule. The phone app's (mobile/src/lib/sidewaysPlay.js, which
 * imports nothing) is run here from a copy, beside the browser's, over one
 * sweep, and the two are held to the same squares.
 */
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')
/* Comments out, so a check reads the code and not its explanation. */
const code = (src) => src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, ' ')
const flat = (src) => code(src).replace(/\s+/g, ' ')

/** The phone app's own planner, run from a copy: it imports nothing. */
async function phonePlan() {
  const dir = mkdtempSync(join(tmpdir(), 'web-sideways-'))
  try {
    writeFileSync(join(dir, 'package.json'), '{ "type": "module" }')
    const src = read('mobile/src/lib/sidewaysPlay.js')
    assert.doesNotMatch(src, /^import /m, 'the phone’s lib/sidewaysPlay imports something; this check runs it on its own')
    writeFileSync(join(dir, 'sidewaysPlay.js'), src)
    return await import(pathToFileURL(join(dir, 'sidewaysPlay.js')).href)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'
const ANDROID_PHONE = 'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36'
const ANDROID_TABLET = 'Mozilla/5.0 (Linux; Android 15; SM-X910) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'
const IPAD_OLD = 'Mozilla/5.0 (iPad; CPU OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1'
const MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15'
const WINDOWS = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'

/* A phone on its side in its browser: [what, width, height]. Safari's bars come and go, so each iPhone is here tall and short. */
const ON_ITS_SIDE = [
  ['an iPhone 17 Pro Max, Safari’s bar away', 956, 440],
  ['an iPhone 17 Pro Max, Safari’s bar showing', 956, 390],
  ['an iPhone 17', 852, 393],
  ['an iPhone 17, Safari’s bar showing', 852, 343],
  ['an iPhone 17 Pro', 874, 402],
  ['an iPhone 16 Plus', 932, 430],
  ['an iPhone 13', 844, 390],
  ['a Pixel 9 in Chrome', 915, 412],
  ['the smallest that splits', 740, 360],
  ['exactly on the line', 720, 250]
]
/* And every window that is not one. */
const NOT_ON_ITS_SIDE = [
  ['an iPhone SE on its side: each half would be too narrow', 667, 375],
  ['an iPhone 13 mini on its side', 712, 330],
  ['an iPhone 17 Pro Max upright', 440, 956],
  ['an iPhone 17 upright', 393, 852],
  ['a small phone upright', 320, 568],
  ['an iPad mini on its side', 1133, 744],
  ['an iPad mini upright', 744, 1133],
  ['an 11-inch iPad on its side', 1194, 834],
  ['a 13-inch iPad Pro on its side', 1366, 1024],
  ['an Android tablet on its side', 1280, 800],
  ['a Galaxy Fold opened', 841, 673],
  ['the iPhone Duo opened', 951, 669],
  ['a laptop', 1440, 900],
  ['a laptop’s small window', 1280, 800],
  ['a window 500 tall, the line itself', 956, 500],
  ['a strip too low to draw two rows in', 956, 240],
  ['a square window', 480, 480]
]

export function run(test) {
  test('a phone’s browser on its side: the switch is off, and only his account is let in', async () => {
    const r = await import('../src/lib/sidewaysPlay.js')
    const { ADMINS } = await import('../shared/admin.mjs')
    assert.equal(r.PHONE_SIDEWAYS_ON_THE_WEB_FOR_EVERYONE, false, 'the browser’s sideways Play is open to everyone; it opens when Justin says so, with its What’s new line')
    assert.match(code(read('src/lib/sidewaysPlay.js')), /export const PHONE_SIDEWAYS_ON_THE_WEB_FOR_EVERYONE = false\n/, 'the switch is not one plain line any more')
    assert.equal(r.sidewaysOpenTo(ADMINS[0]), true, 'his own account is not let in')
    for (const id of [null, undefined, '', 'not-an-account', '00000000-0000-0000-0000-000000000000']) {
      assert.equal(r.sidewaysOpenTo(id), false, `closed to everyone, and ${JSON.stringify(id)} is let in`)
      assert.equal(r.sidewaysOpenTo(id, true), true, 'the switch, once on, opens it to everyone')
    }
    /* All three have to say yes: the window, the phone, the account. */
    const yes = { lowWide: true, phone: true, accountId: ADMINS[0] }
    assert.equal(r.webSidewaysOn(yes), true)
    assert.equal(r.webSidewaysOn({ ...yes, lowWide: false }), false, 'his phone upright is split')
    assert.equal(r.webSidewaysOn({ ...yes, phone: false }), false, 'his laptop’s low window is split')
    assert.equal(r.webSidewaysOn({ ...yes, accountId: null }), false, 'signed out, or the demo with nobody signed in, is split')
    assert.equal(r.webSidewaysOn({ ...yes, accountId: 'somebody-else' }), false, 'another account is split')
    assert.equal(r.webSidewaysOn({ ...yes, accountId: 'somebody-else', everyone: true }), true)
    assert.equal(r.webSidewaysOn({ lowWide: true, phone: false, accountId: 'somebody-else', everyone: true }), false, 'the switch opens a laptop’s window')
  })

  test('a phone’s browser on its side: which windows, which browsers, and never the computer app’s own window', async () => {
    const r = await import('../src/lib/sidewaysPlay.js')
    assert.deepEqual([r.SIDEWAYS_WIDE, r.SIDEWAYS_UNDER, r.SIDEWAYS_LOW], [720, 500, 250], 'the numbers moved; the phone app’s are 720 across, under 500, at least 250 (lib/twoSides)')
    for (const [what, width, height] of ON_ITS_SIDE) assert.equal(r.sidewaysWindow({ width, height }), true, `${what} (${width} by ${height}) is not split`)
    for (const [what, width, height] of NOT_ON_ITS_SIDE) assert.equal(r.sidewaysWindow({ width, height }), false, `${what} (${width} by ${height}) is split`)
    assert.equal(r.sidewaysWindow(), false)
    assert.equal(r.sidewaysWindow({ width: 'x', height: null }), false)

    /* The browser is asked the same thing, in its own words, from the same three numbers. */
    assert.equal(r.SIDEWAYS_ASKS, '(orientation: landscape) and (min-width: 720px) and (min-height: 250px) and (max-height: 499.98px)')
    const asks = (w, h) => w > h && w >= r.SIDEWAYS_WIDE && h >= r.SIDEWAYS_LOW && h <= r.SIDEWAYS_UNDER - 0.02
    for (let w = 300; w <= 1500; w += 7) {
      for (let h = 200; h <= 1100; h += 5) assert.equal(r.sidewaysWindow({ width: w, height: h }), asks(w, h), `the rule and the question it asks the browser disagree at ${w} by ${h}`)
    }

    /* A phone by the browser's own word for itself. */
    const phone = (userAgent, maxTouchPoints, width, height, desktopApp = false) => r.phoneBrowser({ nav: { userAgent, maxTouchPoints }, screen: { width, height }, desktopApp })
    assert.equal(phone(IPHONE, 5, 440, 956), true, 'an iPhone is not a phone')
    assert.equal(phone(ANDROID_PHONE, 5, 412, 915), true, 'an Android phone is not a phone')
    assert.equal(phone(IPAD_OLD, 5, 810, 1080), false, 'an iPad is a phone')
    assert.equal(phone(MAC, 5, 1024, 1366), false, 'an iPad asking for the desktop site is a phone')
    assert.equal(phone(ANDROID_TABLET, 5, 800, 1280), false, 'an Android tablet is a phone')
    assert.equal(phone(MAC, 0, 1440, 900), false, 'a Mac’s browser is a phone')
    assert.equal(phone(WINDOWS, 0, 1920, 1080), false, 'a Windows browser is a phone')
    assert.equal(phone(WINDOWS, 10, 1920, 1080), false, 'a touch laptop is a phone')
    assert.equal(phone(IPHONE, 5, 440, 956, true), false, 'the computer app’s own window is a phone')
    assert.equal(r.phoneBrowser({ nav: {}, screen: {} }), false)
  })

  test('a phone’s browser on its side: the squares are the phone app’s own, over one sweep', async () => {
    const web = await import('../src/lib/sidewaysPlay.js')
    const app = await phonePlan()
    for (const k of ['SQUARE_SMALLEST', 'SQUARE_BIGGEST', 'SCROLL_SQUARE', 'HEAD_UP_BUYS', 'HEAD_UP_KEEPS']) assert.equal(web[k], app[k], `${k} is ${web[k]} in the browser and ${app[k]} in the phone app`)
    let asked = 0
    for (let width = 480; width <= 1000; width += 37) {
      for (let room = 1; room <= 420; room += 11) {
        for (let scenes = 0; scenes <= 8; scenes++) {
          for (const pedals of [0, 1, 2, 3, 4, 5, 7, 8, 12, 13]) {
            for (const headWas of [false, true]) {
              for (const canHeadUp of [false, true]) {
                const ask = { width, room, scenes, pedals, headWas, canHeadUp }
                const w = web.webSidewaysPlan(ask)
                const a = app.sidewaysPlan({ ...ask, gap: web.SIDE_GAP, head: web.SIDE_HEAD, beside: web.SIDE_BESIDE, headRow: web.SIDE_HEAD_ROW, split: true })
                asked++
                if (!w || !a) {
                  assert.equal(w, a, `one of the two has no plan for ${JSON.stringify(ask)}`)
                  continue
                }
                assert.deepEqual(
                  w,
                  { beside: a.beside, sceneCols: a.sceneCols, chainCols: a.chainCols, scene: a.scene.wide, pedal: a.pedal.wide, scrolls: a.scrolls, headUp: a.headUp },
                  `the browser and the phone app draw different squares for ${JSON.stringify(ask)}`
                )
                assert.equal(a.scene.wide, a.scene.high)
                assert.equal(a.pedal.wide, a.pedal.high)
              }
            }
          }
        }
      }
    }
    assert.ok(asked > 100000, `only ${asked} plans compared`)
    /* The fit and the scroll, on their own. */
    for (let n = 0; n <= 13; n++) {
      for (let width = 100; width <= 500; width += 23) {
        assert.deepEqual(web.scrollSquares(n, width), app.scrollSquares(n, width, web.SIDE_GAP))
        for (let height = 20; height <= 400; height += 19) assert.deepEqual(web.fitSquares(n, width, height), app.fitSquares(n, width, height, web.SIDE_GAP))
      }
    }
  })

  test('a phone’s browser on its side: the pictures he approved (an FM3 four by two in each half, an AM4 two by two with its preset row up)', async () => {
    const r = await import('../src/lib/sidewaysPlay.js')
    /*
     * An iPhone 17 Pro Max in Safari, 956 by 440: 62 down each side leaves a
     * row of 832. Under a 48px bar and its 8px gap, and over a bottom row of
     * 82 (the gap, the buttons and their padding, the home bar's 21), the
     * headings start with 302 under them when the preset's row is up and 250
     * when it is in the page.
     */
    const fm3 = r.webSidewaysPlan({ width: 832, room: 250, scenes: 8, pedals: 8 })
    assert.deepEqual(fm3, { beside: true, sceneCols: 4, chainCols: 4, scene: 95, pedal: 95, scrolls: false, headUp: false }, 'an FM3’s eight and eight are not four across by two at 95, the preset’s row over them')
    const am4 = r.webSidewaysPlan({ width: 832, room: 250, scenes: 4, pedals: 4 })
    assert.deepEqual(am4, { beside: true, sceneCols: 2, chainCols: 2, scene: 136, pedal: 136, scrolls: false, headUp: true }, 'an AM4’s four and four are not two by two with the preset’s row up in the bar')
    /* With its row in the page those pads would be 110: the bar buys 23%. By the size, never the unit: no name is asked. */
    const am4Down = r.webSidewaysPlan({ width: 832, room: 250, scenes: 4, pedals: 4, canHeadUp: false })
    assert.equal(am4Down.scene, 110)
    assert.ok(am4.scene >= r.HEAD_UP_BUYS * am4Down.scene)
    assert.doesNotMatch(code(read('src/lib/sidewaysPlay.js')), /am4|fm3|fm9|axe|vp4/i, 'the rule asks which unit it is')
    /* Once up it stays while it still buys a little, so a pixel of measuring either way does not send it up and down. */
    const edge = { width: 832, scenes: 4, pedals: 4 }
    let flips = 0
    for (let room = 150; room <= 330; room++) {
      const cold = r.webSidewaysPlan({ ...edge, room }).headUp
      const warm = r.webSidewaysPlan({ ...edge, room, headWas: true }).headUp
      if (cold && !warm) flips++
    }
    assert.equal(flips, 0, 'a row that would go up from the page comes down again once it is up')

    /* An iPhone 17 (852 by 393, 59 down each side) and the smallest window that splits (740 by 360, no notch): still four by two, still no scroll. */
    const iphone17 = r.webSidewaysPlan({ width: 734, room: 203, scenes: 8, pedals: 8 })
    assert.deepEqual([iphone17.sceneCols, iphone17.chainCols, iphone17.scrolls], [4, 4, false])
    assert.ok(iphone17.scene >= 80, `an FM3’s squares on an iPhone 17 are ${iphone17.scene}`)
    const small = r.webSidewaysPlan({ width: 708, room: 186, scenes: 8, pedals: 8 })
    assert.deepEqual([small.sceneCols, small.chainCols, small.scrolls], [4, 4, false])
    assert.ok(small.scene >= r.SQUARE_SMALLEST)

    /* No square under 64: past that the page scrolls down, and never sideways (each grid still fits its half). */
    for (const [scenes, pedals] of [[8, 13], [8, 12], [4, 12], [8, 8]]) {
      for (const room of [1, 60, 120, 150]) {
        const plan = r.webSidewaysPlan({ width: 660, room, scenes, pedals, canHeadUp: false })
        assert.ok(plan.scene >= r.SQUARE_SMALLEST && plan.pedal >= r.SQUARE_SMALLEST, `a square of ${Math.min(plan.scene, plan.pedal)} for ${scenes} and ${pedals} in ${room}`)
        const half = (660 - r.SIDE_BESIDE) / 2
        assert.ok(plan.sceneCols * plan.scene + (plan.sceneCols - 1) * r.SIDE_GAP <= half, 'the scenes are wider than their half')
        assert.ok(plan.chainCols * plan.pedal + (plan.chainCols - 1) * r.SIDE_GAP <= half, 'the pedals are wider than their half')
      }
    }
    assert.equal(r.webSidewaysPlan({ width: 660, room: 60, scenes: 8, pedals: 13 }).scrolls, true)
    /* Only scenes (a chain not read yet), or only pedals: the one grid has the whole row. */
    const scenesOnly = r.webSidewaysPlan({ width: 832, room: 250, scenes: 8, pedals: 0 })
    assert.deepEqual([scenesOnly.beside, scenesOnly.sceneCols, scenesOnly.chainCols, scenesOnly.pedal], [false, 4, 0, 0])
    /* Nothing to draw, or nothing measured: no plan, and Play waits. */
    assert.equal(r.webSidewaysPlan({ width: 832, room: 250, scenes: 0, pedals: 0 }), null)
    assert.equal(r.webSidewaysPlan({ width: 0, room: 250, scenes: 8, pedals: 8 }), null)
    assert.equal(r.webSidewaysPlan(), null)
  })

  test('a phone’s browser on its side: the rule is the browser’s own file, and the phone app’s is not touched or imported', () => {
    const rule = read('src/lib/sidewaysPlay.js')
    const imports = [...rule.matchAll(/^import [^\n]* from '([^']+)'/gm)].map((m) => m[1])
    assert.deepEqual(imports, ['../../shared/device-word.mjs', '../../shared/admin.mjs'], 'the rule imports something else; it is meant to run with no page')
    /* Nothing new reaches into the phone app's code (its pictures are shared, as they always were), and nothing in the browser borrows its planner or its window rule. */
    for (const file of ['src/lib/sidewaysPlay.js', 'src/components/SideHead.jsx']) {
      assert.doesNotMatch(code(read(file)), /from '[^']*mobile\/src\//, `${file} imports the phone app’s code`)
    }
    for (const file of ['src/lib/sidewaysPlay.js', 'src/components/SideHead.jsx', 'src/components/Gig.jsx', 'src/components/TopBar.jsx', 'src/App.jsx']) {
      assert.doesNotMatch(code(read(file)), /from '[^']*mobile\/src\/lib\/(sidewaysPlay|twoSides|squarePlay|features)/, `${file} imports the phone app’s rule`)
    }
    assert.doesNotMatch(read('mobile/src/lib/sidewaysPlay.js'), /src\/lib\/sidewaysPlay|shared\//, 'the phone app’s planner imports now; it ran on its own')
  })

  test('a phone’s browser on its side: App asks the window, the browser and the account, and Play is told', () => {
    const app = flat(read('src/App.jsx'))
    assert.match(app, /import \{ SIDEWAYS_ASKS, phoneBrowser, webSidewaysOn \} from '\.\/lib\/sidewaysPlay'/)
    assert.match(app, /const lowWide = useAsks\(SIDEWAYS_ASKS\)/, 'the window is not asked the way `narrow` is')
    /* The account is the one the Developer rows read; the phone is the browser's own word, less the computer app's window. */
    assert.match(app, /const sidewaysPlay = webSidewaysOn\(\{ lowWide, phone: phoneBrowser\(\{ desktopApp: inDesktopApp\(\) \}\), accountId: link\.account\?\.id \}\)/)
    assert.match(app, /\{isAdmin\(link\.account\?\.id\) \? \(/, 'the Developer rows read the account another way now; this should read it the same way')
    /* Only with Play on show does the page change round it. */
    assert.match(app, /const sideUp = sidewaysPlay && status === 'live' && view === 'play' /)
    assert.match(app, /<div className="shell" data-sideways=\{sideUp \? 'yes' : undefined\}>/)
    assert.match(app, /sideways=\{sideUp\} headSlot=\{setHeadSlot\}/, 'the top bar is not told, or has no place for the preset’s row')
    assert.match(app, /phoneScreen=\{phoneScreen\} sideways=\{sidewaysPlay\} ownOpen=\{ownBlocksOpenTo\(link\.account\?\.id\)\} headSlot=\{headSlot\}/, 'Play is not told')
    /* The tab row gives way only where Play has its own Edit button. */
    assert.match(app, /const tabsWorthShowing = status === 'live' && views\.length > 1 && !\(sideUp && chainShows\)/)
    assert.equal((app.match(/\bsidewaysPlay\b(?!')/g) || []).length, 3, 'the answer is used somewhere new; say here what for')
    assert.equal((app.match(/\bsideUp\b/g) || []).length, 4, 'sideUp is used somewhere new; say here what for')
  })

  test('a phone’s browser on its side: Play draws two halves, one row of five, and the preset’s row here or in the bar; closed, it draws what it always drew', () => {
    const gig = flat(read('src/components/Gig.jsx'))
    assert.match(gig, /sideways = false, ownOpen = false, headSlot = null,/, 'Play is on its side unless told otherwise')
    /* Everything hangs on one attribute, which the styles read. */
    assert.match(gig, /data-sideways=\{sideways \? 'yes' : undefined\}/)
    assert.match(gig, /data-head-up=\{headUp \? 'yes' : undefined\}/)
    assert.match(gig, /data-one=\{sideways && sidePlan && !sidePlan\.beside \? 'yes' : undefined\}/)
    assert.match(gig, /data-compact=\{compact \|\| sideways \? 'yes' : undefined\}/)
    /* The squares come from the rule, measured, and reach the styles as sizes. */
    assert.match(gig, /const next = webSidewaysPlan\(\{ width: el\.clientWidth, room: Math\.max\(1, room\), scenes: hasScenes \? sceneCount : 0, pedals: fitCount, canHeadUp: !!headSlot, headWas: upNow \}\)/)
    assert.match(gig, /const viewport = window\.visualViewport\?\.height \|\| window\.innerHeight/)
    for (const v of ['--side-scene', '--side-pedal', '--side-scene-cols', '--side-chain-cols', '--side-above', '--side-below', '--side-bar']) assert.ok(gig.includes(`'${v}':`), `Play does not set ${v}`)
    /* The preset's tile and the Setlists button between Previous and Next are drawn only upright... */
    assert.match(gig, /\{sideways \? null : \( <div className="gig-preset">/)
    assert.match(gig, /\{sideways \? null : \( <button type="button" className=\{`gig-nav-source \$\{order \? 'on' : ''\}`\}/)
    /* ...and on its side they are one row, in the page or up in the bar's place for it. */
    assert.match(gig, /\{sideways && !headUp \? sideHead : null\} \{sideways && headUp \? createPortal\(sideHead, headSlot\) : null\}/)
    assert.match(gig, /const headUp = sideways && !!sidePlan\?\.headUp && !!headSlot/)
    /* The row opens what the upright buttons open, and says what they say. */
    const head = gig.slice(gig.indexOf('const sideHead = sideways ? ('), gig.indexOf('return (', gig.indexOf('const sideHead = sideways ? (')))
    assert.match(head, /onPickPreset=\{onPickPreset\}/)
    assert.match(head, /onSetlists=\{\(\) => setSetlistOpen\(true\)\}/)
    assert.match(head, /setlistSaid=\{sourceAria\}/)
    assert.match(head, /name=\{nameShown\}/)
    /* The scenes read across in their own order (a layout that reads down is for another number of columns). */
    assert.match(gig, /sceneOrderFor\(sideways && sceneLayout !== 'mine' \? 'across' : sceneLayout, sceneCount, sceneOrder\)/)
    /* Nothing Play does is switched off on its side: the same handlers, no `sideways` near them. */
    for (const call of ['onClick={() => pickScene(i)}', 'onToggle={() => toggle(block)}', 'onHold={() => setChanEid(block.effectId)}', 'onClick={toggleTuner}', 'onClick={() => step(-1)}', 'onClick={() => step(1)}', '<TapTempo onError={onError} onChanged={onChanged} onDropped={sayNotSent} />']) {
      assert.ok(gig.includes(call), `Play lost ${call}`)
    }

    const side = flat(read('src/components/SideHead.jsx'))
    assert.match(side, /import \{ ALL_PRESETS \} from '\.\.\/\.\.\/shared\/play-words\.mjs'/, 'the preset’s row has words of its own')
    assert.match(side, /<button type="button" className="side-chip side-preset" onClick=\{onPickPreset\} disabled=\{!onPickPreset\} aria-label=\{said\}>/)
    assert.match(side, /<button type="button" className=\{`side-chip side-setlists \$\{setlistOn \? 'on' : ''\}`\} onClick=\{onSetlists\} aria-label=\{setlistSaid\}>/)
    assert.doesNotMatch(side, /this phone|beta|official|tried/i)

    const bar = flat(read('src/components/TopBar.jsx'))
    assert.match(bar, /sideways = false, headSlot = null,/)
    assert.match(bar, /\{sideways \? <span className="topbar-sidehead" ref=\{headSlot\} \/> : null\}/, 'the bar has a place for the preset’s row where it is not on its side')
    assert.match(bar, /data-sideways=\{sideways \? 'yes' : undefined\}/)
  })

  test('a phone’s browser on its side: every style is behind the one attribute, and draws the rule’s own numbers', async () => {
    const r = await import('../src/lib/sidewaysPlay.js')
    const css = read('src/styles.css')
    const at = css.indexOf('PLAY IN A PHONE\'S BROWSER, THE PHONE HELD ON ITS SIDE')
    assert.ok(at > 0, 'the section moved')
    /* It is the last thing in the file, so it wins where it ties, and nothing after it undoes it. */
    const part = code(css.slice(css.lastIndexOf('/*', at)))
    const rules = [...part.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({ selectors: m[1].trim().split(/\s*,\s*/), body: m[2] }))
    assert.ok(rules.length > 30, `only ${rules.length} rules read`)
    assert.doesNotMatch(part, /@media|@container|@supports/, 'a rule in the section is inside a block this check does not read')
    /* Closed to an account, none of these names is on the page: not one rule can apply. */
    for (const { selectors } of rules) {
      for (const s of selectors) {
        assert.ok(/\[data-sideways\]/.test(s) || /^(button)?\.side-(head|chip|preset|setlists)\b/.test(s) || /^\.topbar-sidehead/.test(s), `“${s}” applies to a page that is not on its side`)
      }
    }
    /* Everything said about one selector, wherever in the section it is said. */
    const rule = (selector) => rules.filter((x) => x.selectors.includes(selector)).map((x) => x.body).join('\n') || assert.fail(`no rule for ${selector}`)
    /* A length as the rule writes it: pixels, or a step of the app's spacing scale (--s-2 is 8px, --s-5 is 24px). */
    const step = (n) => Number((css.match(new RegExp(`^  --s-${n}: (\\d+)px;`, 'm')) || [])[1])
    const px = (body, prop) => {
      const said = (body.match(new RegExp(`(?:^|[;\\s])${prop}:\\s*([^;]+);`)) || [])[1] || ''
      const scale = said.match(/^var\(--s-(\d)\)$/)
      return scale ? step(scale[1]) : Number((said.match(/^(-?[\d.]+)px$/) || [])[1])
    }
    /* Between the halves, in Play and in the preset's row over them. */
    assert.equal(px(rule('.gig[data-sideways]'), 'column-gap'), r.SIDE_BESIDE)
    assert.equal(px(rule('.side-head'), 'column-gap'), r.SIDE_BESIDE)
    /* Between tiles. */
    assert.equal(px(rule('.gig[data-sideways] > .gig-scenes'), 'gap'), r.SIDE_GAP)
    /* A heading and the gap under it. */
    const heading = rule(".gig[data-sideways] > .gig-head[data-for='scenes']")
    assert.match(heading, /margin: var\(--side-above, 0px\) 0 6px/)
    assert.equal(px(heading, 'height') + 6, r.SIDE_HEAD)
    /* The preset's row and the gap under it; and the bar is one height whether the row is in it or not. */
    assert.match(rule('.side-head'), /margin: 0 0 8px/)
    assert.equal(px(rule('.side-head'), 'height') + 8, r.SIDE_HEAD_ROW)
    assert.equal(px(rule('.topbar[data-sideways] .topbar-row'), 'height'), 48)
    assert.ok(px(rule('.side-head[data-up]'), 'height') <= 48)
    /* The gap over the bottom row is what Play takes off when it measures. */
    assert.match(rule('.gig[data-sideways] > .gig-foot'), /margin-top: calc\(8px \+ var\(--side-below, 0px\)\)/)
    assert.match(flat(read('src/components/Gig.jsx')), /const footTall = foot \? foot\.offsetHeight \+ SIDE_GAP : 0/)
    /* Squares: each grid's columns and its tiles' height are one size. */
    assert.match(rule('.gig[data-sideways] > .gig-scenes'), /grid-template-columns: repeat\(var\(--side-scene-cols, 4\), var\(--side-scene, 80px\)\)/)
    assert.match(rule('.gig[data-sideways][data-compact] > .gig-scenes button.gig-scene'), /height: var\(--side-scene, 80px\)/)
    assert.match(rule('.gig[data-sideways] > .gig-blocks'), /grid-template-columns: repeat\(var\(--side-chain-cols, 4\), var\(--side-pedal, 80px\)\)/)
    assert.match(rule('.gig[data-sideways][data-compact] > .gig-blocks .gig-block-cell button.gig-block'), /height: var\(--side-pedal, 80px\)/)
    /* Each grid centred in its half, scenes left and chain right. */
    assert.match(rule('.gig[data-sideways] > .gig-scenes'), /justify-content: center/)
    assert.match(rule('.gig[data-sideways] > .gig-scenes'), /grid-column: 1;/)
    assert.match(rule('.gig[data-sideways] > .gig-blocks'), /grid-column: 2;/)
    /* One row of five: Previous, the three, Next. */
    const foot = rule('.gig[data-sideways] > .gig-foot')
    assert.match(foot, /display: flex/)
    assert.match(rule('.gig[data-sideways] .gig-nav'), /display: contents/)
    assert.match(rule('.gig[data-sideways][data-compact] .gig-nav > button.gig-nav-step'), /order: 0/)
    assert.match(rule('.gig[data-sideways] .gig-bar'), /order: 1/)
    assert.match(rule('.gig[data-sideways][data-compact] .gig-nav > button.gig-nav-step:last-of-type'), /order: 2/)
    /* No tile under the notch or the home bar: the page's own side padding already keeps clear of the notch, and here the bar and the bottom row do. */
    assert.match(css, /padding-left: max\(16px, env\(safe-area-inset-left\)\);\s*padding-right: max\(16px, env\(safe-area-inset-right\)\);/, 'the page no longer keeps its sides clear of the notch')
    assert.match(foot, /padding: var\(--s-2\) 0 max\(var\(--s-2\), env\(safe-area-inset-bottom, 0px\)\)/)
    assert.match(rule('.topbar[data-sideways]'), /padding-left: max\(16px, env\(safe-area-inset-left, 0px\)\)/)
    assert.match(rule('.topbar[data-sideways]'), /padding-right: max\(16px, env\(safe-area-inset-right, 0px\)\)/)
    assert.match(rule('.shell[data-sideways]'), /padding-bottom: 0/)
    /* A pedal too narrow for its whole name says its three letters. */
    assert.match(flat(read('src/components/Gig.jsx')), /data-side-abbr=\{sideways && sidePlan && sidePlan\.pedal < SIDE_NAME_ROOM \? 'yes' : undefined\}/)
    assert.match(rule('.gig[data-sideways][data-side-abbr] .gig-block-abbr'), /display: inline/)
  })
}

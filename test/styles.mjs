/**
 * The dimensional system, held shut.
 *
 * The stylesheet reached 4,800 lines carrying nineteen font sizes, twenty-eight
 * padding lengths, five radii and no rule about any of them — nine of the font
 * sizes sat in the 9.5–13.5px band in half-pixel steps, which is a distinction
 * nothing renders differently and nobody chose deliberately twice.
 *
 * The scales exist now. What this stops is the next well-meant `13.5px` from
 * starting the drift again, which is exactly how the first nineteen arrived:
 * one reasonable-looking literal at a time.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const css = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8')

/** Declarations, minus comments — a commented-out example is not a rule. */
const code = css.replace(/\/\*[\s\S]*?\*\//g, ' ')

const declarations = (prop) => [
  ...code.matchAll(new RegExp(`(?:^|[;{\\s])${prop}: ([^;{}]+);`, 'g'))
].map((m) => m[1].trim())

/**
 * One whole block from `at`, braces matched.
 *
 * A media query holds rules that hold rules, so "up to the next `}`" reads a
 * fraction of one and quietly passes or fails on whichever rules happened to
 * land first.
 */
function balanced(text, at) {
  const open = text.indexOf('{', at)
  if (open < 0) return ''
  let depth = 0
  for (let i = open; i < text.length; i++) {
    if (text[i] === '{') depth++
    else if (text[i] === '}' && --depth === 0) return text.slice(at, i + 1)
  }
  return text.slice(at)
}

export function run(test) {
  test('every font size comes off the scale', () => {
    /*
     * Two exceptions, both deliberate and both named: the preset name on the
     * stage screen is a sign rather than text, and 16px on an input is a
     * platform floor — iOS zooms the page when a focused field is smaller, and
     * that zoom then has to be undone by hand.
     */
    const sign = new Set(['40px', '64px'])
    const bare = declarations('font-size').filter((v) => /^[0-9.]+px$/.test(v) && !sign.has(v))
    assert.deepEqual(bare, [], `font sizes off the scale: ${[...new Set(bare)].join(', ')}`)

    // And the scale itself is six steps, not six plus whatever crept in.
    const steps = [...code.matchAll(/--f-(\d): ([0-9]+)px/g)].map((m) => m[2])
    assert.equal(steps.length, 6, `the type scale has ${steps.length} steps`)
    assert.deepEqual(steps, ['11', '12', '13', '15', '20', '28'])
  })

  test('every padding and gap comes off the spacing scale', () => {
    // 0 is not a step, and 1px is a hairline rather than a space.
    const fine = new Set(['0', '1px'])
    const off = []
    for (const prop of [
      'padding',
      'padding-top',
      'padding-bottom',
      'padding-left',
      'padding-right',
      'gap',
      'row-gap',
      'column-gap'
    ]) {
      for (const value of declarations(prop)) {
        for (const part of value.split(/\s+/)) {
          if (/^[0-9.]+px$/.test(part) && !fine.has(part)) off.push(`${prop}: ${part}`)
        }
      }
    }
    /*
     * One survivor, kept on purpose: the grid's left inset is measured from
     * the row labels beside it, not from the page. Rounding it to a step moves
     * the cells out from under the coordinates that name them.
     */
    const allowed = off.filter((x) => x === 'padding-left: 74px')
    assert.ok(allowed.length <= 1, 'more than one deliberate exception')
    const rest = off.filter((x) => x !== 'padding-left: 74px')
    assert.deepEqual(rest, [], `spacing off the scale: ${[...new Set(rest)].join(', ')}`)
  })

  test('radius says what a thing is, in three tiers', () => {
    /*
     * The rule that resolved "instrument or app": anything standing for the
     * hardware keeps the chassis radius; the app's own furniture — sheets,
     * scrims, pills — is rounder, so the two never read as the same surface.
     * A circle and a square corner are shapes, not steps.
     */
    const shapes = new Set([
      '0',
      '50%',
      /* The screen's own glass, for the metronome's frame round the whole
         page: the phone's curve, not one of the app's. */
      'clamp(0px, calc(env(safe-area-inset-bottom, 0px) * 1000), 62px)'
    ])
    const bare = declarations('border-radius').filter(
      (v) => !shapes.has(v) && !v.includes('var(')
    )
    assert.deepEqual(bare, [], `radii off the three tiers: ${[...new Set(bare)].join(', ')}`)
  })

  test('elevation is three steps; a glow is not elevation', () => {
    const shadows = declarations('box-shadow')
    for (const v of shadows) {
      if (v === 'none' || v.includes('var(--e-')) continue
      // What is left must be a ring, a halo or an inset — light, not lift.
      assert.ok(
        /inset|^0 0 /.test(v),
        `box-shadow "${v}" reads as elevation but is not one of the three steps`
      )
    }
  })

  test('the token that was superseded is gone, not just unused', () => {
    // --gutter was declared, documented as superseded by --s-2, and used once
    // in 118 gap declarations. A token nobody uses is a token someone will.
    assert.ok(!code.includes('--gutter'), '--gutter is still declared')
  })

  test('nothing on a touch screen is under the 44px floor', () => {
    /*
     * A sweep of the app on a phone found the whole chrome row at 40px, the
     * on/off pill at 40, selects at 34, the theme toggle at 34 and the sign-in
     * fields at 21 — each set deliberately, each a little short, none of them
     * wrong enough to notice sitting at a desk.
     *
     * The trap is specificity. The touch floor is a blanket `button` rule at
     * (0,0,1); any component that names itself — `button.fx-power` at (0,1,1) —
     * outranks it and keeps whatever height it gave itself. So a small base
     * height is fine only if the same selector is raised again for touch. That
     * pairing is what this checks, and 40px survived one correction without it.
     */
    const coarseBodies = []
    for (const m of code.matchAll(/@media \(pointer: coarse\)\s*\{/g)) {
      let i = m.index + m[0].length
      let depth = 1
      const from = i
      while (i < code.length && depth) {
        if (code[i] === '{') depth++
        else if (code[i] === '}') depth--
        i++
      }
      coarseBodies.push(code.slice(from, i - 1))
    }
    const coarse = coarseBodies.join('\n')
    const rules = (text) => {
      const out = new Map()
      for (const m of text.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
        const h = m[2].match(/min-height: (\d+)px/)
        if (h) out.set(m[1].trim().replace(/\s+/g, ' '), Number(h[1]))
      }
      return out
    }

    // Inside a touch block, short is simply wrong.
    const inside = [...rules(coarse)].filter(([, h]) => h < 44)
    assert.deepEqual(inside.map(([s2, h]) => `${s2} → ${h}px`), [], 'short min-heights inside a touch block')

    // Outside one, short is only allowed if touch raises the same selector.
    const raised = rules(coarse)
    const unraised = []
    for (const [selector, h] of rules(code.split('@media (pointer: coarse)')[0])) {
      if (h >= 44) continue
      if (!/\b(button|input|select)\b|\.chip/.test(selector)) continue
      if ((raised.get(selector) ?? 0) < 44) unraised.push(`${selector} → ${h}px, never raised for touch`)
    }
    assert.deepEqual(unraised, [], `under the floor with no touch override:\n  ${unraised.join('\n  ')}`)
  })

  test('every field a phone user must type into clears the iOS zoom floor', () => {
    // Under 16px iOS zooms the page on focus. email and password were left out
    // of this list for a long time — the two fields the phone flow cannot avoid.
    // Specifically the rule that sets the floor — these types also appear in
    // the min-height rule nearby, and checking for them anywhere in the touch
    // block passes happily while the zoom bug is back.
    // Five rules apply the floor to different corners of the app, so the test
    // is whether a type is covered by ANY of them — not by whichever one comes
    // first in the file.
    const selectors = [...code.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
      .filter((m) => /font-size: var\(--f-input\)/.test(m[2]))
      .map((m) => m[1])
      .join(' ')
    assert.ok(selectors, 'no rule applies the 16px input floor at all')
    for (const type of ['email', 'password', 'text']) {
      assert.match(
        selectors,
        new RegExp(`input\\[type='${type}'\\]`),
        `input[type='${type}'] never gets the 16px floor — iOS will zoom the page on focus`
      )
    }
  })

  test('no field sets its own font-size and escapes the zoom floor', () => {
    /*
     * "As soon as I click the chat box, it zooms in on it and then you can't
     * see the send button anymore."
     *
     * The floor above is written on bare element selectors, and a media query
     * adds no specificity — so `textarea.refine-input { font-size: var(--f-3) }`
     * at (0,1,1) beat it and the composer stayed at 13px. The test above passed
     * throughout, because `textarea` IS in the floor rule; it was the override
     * that won.
     *
     * So this is the general form: any field named with a class of its own that
     * sets a font-size must also be named in a rule applying the floor. It
     * catches the next one, which is the point — this is the third time a
     * class-qualified field has quietly outranked a blanket rule in this file.
     */
    /*
     * Position matters as much as presence, and getting that wrong is how the
     * first attempt at this fix shipped green and still zoomed: the floor was
     * added to the touch block near the top of the file, and
     * `textarea.refine-input` sets its size several hundred lines below at the
     * same specificity, so source order handed it back. A guard that only asked
     * "is the class named somewhere" passed throughout. So each field is
     * checked against where its floor sits, not merely whether one exists.
     */
    const rules = [...code.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    const floorAt = new Map()
    for (const m of rules) {
      if (!/font-size: var\(--f-input\)/.test(m[2])) continue
      for (const s of m[1].matchAll(/\.([\w-]+)/g)) {
        floorAt.set(s[1], Math.max(floorAt.get(s[1]) ?? -1, m.index))
      }
    }

    /*
     * Every rule that gives a class-named field a size that is NOT the floor.
     *
     * Deliberately not "rules outside the touch block": an earlier version of
     * this guard tried to express that as "before the first @media (pointer:
     * coarse)", and the composer's own rule lives several hundred lines AFTER
     * that block — so the one field the whole test exists for was skipped, and
     * the broken fix passed. Whether a rule sits inside a media query does not
     * matter here. What matters is that something sets a non-floor size and the
     * floor does not come after it.
     */
    const owned = new Map()
    for (const m of rules) {
      if (!/font-size:/.test(m[2])) continue
      if (/font-size: var\(--f-input\)/.test(m[2])) continue
      if (!/\b(?:input|textarea)\.[\w-]+/.test(m[1])) continue
      for (const s of m[1].matchAll(/\b(?:input|textarea)\.([\w-]+)/g)) {
        owned.set(s[1], Math.max(owned.get(s[1]) ?? -1, m.index))
      }
    }
    assert.ok(owned.size, 'no class-named field sets its own font-size — has the scan stopped matching?')

    for (const [cls, own] of owned) {
      const floor = floorAt.get(cls)
      assert.ok(
        floor !== undefined,
        `.${cls} sets its own font-size and is never named in the 16px floor — ` +
          'a bare element selector cannot reach it, so iOS zooms the page on focus'
      )
      assert.ok(
        floor > own,
        `.${cls} gets the 16px floor at character ${floor} but sets its own size at ${own} — ` +
          'same specificity, later wins, so the floor never applies and iOS zooms the page on focus'
      )
    }
  })

  test('nothing floats over the bottom of the page, so nothing is reserved for it', () => {
    /*
     * `.ask-anywhere` was fixed over the bottom-right corner on Play and
     * Edit, and the shell kept 80px clear at the bottom so the last row of
     * controls could be scrolled out from under it. Both are gone: the button
     * sat on the eighth scene, Edit's search results and the Modifiers picker,
     * and the tab row already carries ✦ Ask on every window wide enough to
     * have one. What is left at the bottom is the home-indicator inset with a
     * 16px floor — and it is set in the `@supports (padding: max())` block,
     * which is the one that applies on every real browser.
     */
    assert.ok(!code.includes('.ask-anywhere'), 'the floating Ask is back, and with it the corner it covers')
    const rule = code.match(/@supports \(padding: max\(0px\)\) \{\s*\.shell \{([^}]*)\}/)
    assert.ok(rule, 'the @supports block that sets the real shell padding is gone')
    assert.match(rule[1], /padding-bottom: max\(16px, env\(safe-area-inset-bottom\)\)/, `the shell still reserves room under a button it no longer has: ${rule[1].trim()}`)
    assert.ok(!/padding-bottom: calc\(80px/.test(code), 'an 80px reservation is still written somewhere')
  })
  test('nothing sits above the bar, so the bar can be pinned', () => {
    /*
     * "Can you pin the header to the top of the screen — right now when you
     * scroll a little bit it comes down slightly and moves with the scroll."
     *
     * The bar has always been sticky at 0. What moved it was the page
     * reserving a strip ABOVE it: the update notice rendered up there, and on
     * a notched phone that strip also had to clear the clock — the fix for a
     * screenshot of "A newer version of this app is out" struck through by
     * 7:10 and a battery icon. So the bar sat some seventy pixels down at rest
     * and rose to the top the moment anything scrolled.
     *
     * Both halves are held here, because dropping either brings a bug back:
     * the notices render UNDER the bar now, and the page reserves nothing
     * above it. The notch is covered by the bar's own inset, which it has
     * always carried and which is why the bar itself never had that bug.
     */
    const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8')
    /* The shell's class was a template literal while a chat screen could add
       to it. That went with the AI; what this test is about — the bar being
       inside the shell with nothing above it — did not, so it finds the shell
       either way. */
    const shell = app.search(/className=(\{`shell |"shell")/)
    const bar = app.indexOf('<TopBar', shell)
    assert.ok(shell !== -1 && bar > shell, 'the bar is not in the shell any more')
    for (const above of ['<UpdateNotice', '<UpdateReadyNotice']) {
      const at = app.indexOf(above, shell)
      assert.ok(at > bar, `${above} renders above the bar again, which is what made the bar travel`)
    }

    /* Every rule that sets it, not the last one written: the phone-width block
       sets this too, and a guard reading one rule passes while the other puts
       the strip back on the device it was felt on. */
    const tops = []
    for (const m of code.matchAll(/\.shell \{([^}]*)\}/g)) {
      const top = m[1].match(/padding-top:[^;]*/)
      if (top) tops.push(top[0].trim())
    }
    assert.ok(tops.length, 'nothing sets the top of the page at all')
    for (const top of tops) {
      assert.match(top, /padding-top: 0/, `"${top}" reserves a strip above the bar, so the bar travels as you scroll`)
    }
    // A shorthand after them would put it back.
    assert.ok(
      !/\.shell \{[^}]*padding: /.test(code.slice(code.indexOf('@supports (padding: max(0px))'))),
      'a padding shorthand after the inset rules puts the top back where it was'
    )

    // And the bar still covers the notch itself, which is what makes all of
    // the above safe on a phone added to a home screen.
    const barRule = code.slice(code.indexOf('.topbar {'), code.indexOf('}', code.indexOf('.topbar {')))
    assert.match(barRule, /position: sticky/, 'the bar is not pinned at all')
    assert.match(barRule, /top: 0/, 'the bar pins somewhere other than the top')
    assert.match(barRule, /padding-top: env\(safe-area-inset-top, 0px\)/, 'the bar no longer covers the notch')
  })

  test('the conversation never scrolls sideways', () => {
    /*
     * "Chat is moving horizontally when touching it, not staying in the
     * screen." The log sets overflow-y and nothing else, and CSS answers that
     * by making overflow-x `auto` too — so the one line too wide for a phone,
     * the working line's clock held to a single row, turned the whole
     * conversation into something a thumb could drag left. Two rules hold it:
     * the log clips sideways, and only the time figure stays on one line.
     */
    const log = code.slice(code.indexOf('.assistant-log {'), code.indexOf('}', code.indexOf('.assistant-log {')))
    assert.match(log, /overflow-x: hidden/, 'the conversation can be dragged sideways again')

    const clock = code.slice(code.indexOf('.thinking-clock {'), code.indexOf('}', code.indexOf('.thinking-clock {')))
    assert.ok(!/white-space: nowrap/.test(clock), 'the clock and its sentence are held to one line, which runs off a phone')
    const time = code.slice(code.indexOf('.thinking-time {'), code.indexOf('}', code.indexOf('.thinking-time {')))
    assert.match(time, /white-space: nowrap/, 'the time figure can break across two lines')
  })

  test('inside a sheet the preset list is not a second scroller', () => {
    /*
     * A 300px window over a 23,000px list, inside a sheet body that scrolls
     * itself: two nested scrollers fighting for the same thumb, seven rows
     * visible at a time. The sheet is the one scroll surface; the top-bar
     * menu, which is not a sheet, keeps its cap.
     */
    const at = code.indexOf('.sheet-body .preset-scroll {')
    assert.notEqual(at, -1, 'the preset list inside a sheet has its own scroll window again')
    const rule = code.slice(at, code.indexOf('}', at))
    assert.match(rule, /max-height: none/)
    assert.match(code, /\.preset-menu \{[^}]*max-height: min\(72vh, 560px\)[^}]*overflow-y: auto/, 'the top-bar menu lost its cap')
    assert.match(code, /\.preset-menu \.preset-scroll \{\s*max-height: none/, 'the menu has a second scroller inside it again')
  })

  test('a sheet keeps its contents off the screen edge, and a scene tile is a tile', () => {
    /*
     * The sheet body had no inline padding, so every sheet's first column
     * started at x=1 — inside the iOS edge-swipe zone — and the scene tiles,
     * with no width rule, shrank to the width of a dash: 38px targets on a
     * touch screen.
     */
    const body = code.slice(code.indexOf('.sheet-body {'), code.indexOf('}', code.indexOf('.sheet-body {')))
    const pad = body.match(/padding: ([^;]+);/)?.[1] || ''
    assert.match(pad, /var\(--s-[3-9]\) var\(--s-4\)/, `the sheet body is flush to the edge: "${pad}"`)
    const tile = code.slice(code.indexOf('button.scene {'), code.indexOf('}', code.indexOf('button.scene {')))
    assert.match(tile, /width: 100%/, 'a scene tile shrinks to its content again')
    assert.match(tile, /min-height: 44px/, 'a scene tile is under the touch floor')
    // The tour card compensated for the missing padding on its own; with the body padded it would double up.
    const tour = code.slice(code.indexOf('.tour-card p {'), code.indexOf('}', code.indexOf('.tour-card p {')))
    assert.ok(!/padding: 0 var\(--s-4\)/.test(tour), 'the tour card still pads itself on top of the sheet body')
  })

  test('a row and its delete button share one line', () => {
    /*
     * The delete button shipped with no styling at all. `button.recent-row` is
     * a flex item at full width and a list item is not a flex container, so the
     * × wrapped underneath every row: 89px tall instead of 44, an orphaned ×
     * at the left edge, and the restore target no longer where it looked.
     *
     * Two rules make it a row, and both have to hold: the item has to lay out
     * as flex, and the button beside the × must not claim the whole width.
     */
    const item = code.slice(code.indexOf('.recent-list li {'), code.indexOf('}', code.indexOf('.recent-list li {')))
    assert.match(item, /display: flex/, 'the row and its delete button stack instead of sitting side by side')

    const row = code.slice(code.indexOf('button.recent-row {'), code.indexOf('}', code.indexOf('button.recent-row {')))
    assert.ok(
      !/width: 100%/.test(row),
      'the row claims the whole line again, which pushes the delete button onto its own'
    )
    assert.match(row, /flex: 1 1 auto/, 'the row no longer takes the room the delete button leaves')

    const del = code.slice(code.indexOf('button.recent-del {'), code.indexOf('}', code.indexOf('button.recent-del {')))
    assert.ok(del, 'the delete button has no styling at all')
    assert.match(del, /min-height: 44px/, 'the delete button is under the touch floor')
  })

  test('a phone says which unit it is driving', () => {
    /*
     * "Please show what device the unit is currently connected to in the top
     * left. AM4, FM3, Axe-Fx."
     *
     * It was there on a desktop and hidden on a phone, along with the word
     * "connected", to buy room for the preset name. The word went; the unit's
     * name is not a repeat of anything, and with two computers and two units
     * on one account it is the one fact that says WHICH RIG this screen is
     * driving — on the device where you cannot look over and check.
     *
     * Since 3 November 2026 it is in the pill, as on the phone, beside the
     * pill's own state word, and the old word beside the lamp is gone at every
     * width rather than hidden on a phone.
     */
    // Every narrow block, not the first one that matches: there are three, and
    // the topbar rules are not in the first.
    let narrow = ''
    for (const m of code.matchAll(/@media \(max-width: 620px\)/g)) narrow += balanced(code, m.index)
    assert.ok(narrow.includes('.topbar-'), 'the narrow bar rules are gone')

    const hidden = [...narrow.matchAll(/([^{}]+)\{[^{}]*display: none[^{}]*\}/g)]
      .map((m) => m[1].replace(/\s+/g, ' ').trim())
      .join(' | ')
    assert.ok(
      !/\.topbar-unit/.test(hidden),
      'the unit name is hidden on a phone again, which is the one fact saying which rig this is'
    )
    assert.ok(!/\.topbar-how/.test(code), 'the connection word is back beside the pill, saying what the pill already says')

    /*
     * And a long one is capped only where the preset is actually sharing the
     * row — which is the whole of the bug the cap caused.
     *
     * "In the top left corner where it shows the device name all of them look
     * good except AXE FX III cuts off." Ten characters against a nine-character
     * cap. The cap is a real rule: a long name must not spend the eight
     * characters the preset name is promised beside it. What was wrong is the
     * question it asked — it read the CONNECTION, so it went on defending room
     * on every screen with no preset in the bar at all, and on a phone that is
     * every screen there is.
     */
    /* The name's own rule: the one that opens a rule of its own, not the face it shares with the word, and not the phone block's cap. */
    const name = code.match(/\}\s*(?:\/\*[\s\S]*?\*\/\s*)?\.topbar-unit-name \{([^}]*)\}/)?.[1] || ''
    assert.ok(name, 'the unit’s name in the pill has no styling at all')
    assert.ok(!/max-width/.test(name), 'the unit name is capped on every phone screen again, including the ones carrying no preset')
    assert.match(name, /text-overflow: ellipsis/, 'a name too long for the bar spills out of it rather than ending in an ellipsis')
    assert.match(name, /min-width: 0/, 'a long name pushes the speaker and the gear off a narrow phone instead of giving way')
    /* In the unit's own spelling: "Axe-Fx III", never the capitals that were cut to "AXE-F…". */
    assert.ok(!/text-transform/.test(name), 'the unit’s name is in capitals again')
    assert.match(
      narrow,
      /\.topbar\[data-preset='yes'\] \.topbar-unit-name \{[^}]*max-width/,
      'a long unit name can eat the preset name when the two share the row'
    )
    /*
     * And no phone rule caps it or capitalises it some other way: the rule
     * above is the base one, so a cap written into a phone block, on the
     * name, the line or the face, is what this has to catch. Every rule
     * there that reaches the pill with a cap is the preset's, and none puts
     * it in capitals.
     */
    const bare = narrow.replace(/\/\*[\s\S]*?\*\//g, '')
    const reach = [...bare.matchAll(/([^{}]*\.topbar-unit[^{}]*)\{([^}]*)\}/g)]
    assert.ok(reach.length >= 1, 'no phone rule reaches the pill, so this checks nothing')
    for (const [, sel, body] of reach) {
      const s = sel.trim()
      if (/max-width:\s*(?!100%)/.test(body)) assert.match(s, /^\.topbar\[data-preset='yes'\] /, `"${s}" caps the unit’s name on a phone screen with no preset in the bar`)
      assert.ok(!/text-transform/.test(body), `"${s}" puts the unit’s name in capitals on a phone`)
    }
    /* Nor at any width. */
    for (const [, sel, body] of code.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]*\.topbar-unit[^{}]*)\{([^}]*)\}/g)) {
      assert.ok(!/text-transform/.test(body), `"${sel.trim()}" puts the unit’s name in capitals`)
    }
  })

  test('the line under a Setup row is green, and readable in both themes', () => {
    /*
     * "On the set-up screen, let's change the text underneath the button
     * labels to green."
     *
     * Faint grey read as small print, and these lines are the opposite: each
     * is the live answer to the question its row is named after — which unit
     * the demo is, which theme is on, how far along the chain gets — and the
     * list is built so that most of it needs no tap.
     *
     * `--ok` rather than a green of its own: it is already what this app uses
     * for a thing said in words it is sure of, and the amp's real name under
     * its code name has been using it for exactly that.
     */
    const at = code.indexOf('.setup-row-status {')
    assert.ok(at !== -1, 'the line under a Setup row has no styling at all')
    const rule = code.slice(at, code.indexOf('}', at))
    assert.match(rule, /color: var\(--ok\)/, 'the Setup rows say their live facts in grey again')

    /*
     * And it has to READ. A colour asked for is still a colour somebody uses
     * on a phone in daylight, so both themes are measured on the ground these
     * rows actually sit on.
     */
    const lum = (hex) => {
      const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
      return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
    }
    const ratio = (a, b) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05)
    for (const [name, open] of [['dark', ':root {'], ['light', "[data-theme='light'] {"]]) {
      const block = code.slice(code.indexOf(open), code.indexOf('}', code.indexOf(open)))
      const token = (t) => block.match(new RegExp(`--${t}: (#[0-9a-f]{6})`))?.[1]
      const r = ratio(token('ok'), token('panel'))
      assert.ok(r >= 4.5, `--ok on --panel is ${r.toFixed(2)}:1 in the ${name} theme — that is every line in Setup`)
    }
  })

  test('the Macs to choose between both fit on the screen', () => {
    /*
     * A Mac is called whatever its owner called it, so the buttons here read
     * "Drive Justin's MacBook Pro" and "Drive Studio Mac" — two long labels that
     * do not share a line on a phone. Without the wrap the second one leaves the
     * screen, and the second one is the one not currently selected: precisely
     * what somebody opened this notice to press.
     *
     * Written after a delete button shipped with no styling at all and broke a
     * whole list. A class named in JSX and absent from here is not a small
     * mistake in this app.
     */
    const at = code.indexOf('.host-pick {')
    assert.ok(at !== -1, 'the row of Macs to choose between has no styling at all')
    const rule = code.slice(at, code.indexOf('}', at))
    assert.match(rule, /display: flex/, 'the buttons do not lay out as a row')
    assert.match(rule, /flex-wrap: wrap/, 'a long Mac name pushes the other choice off the screen')
  })

  test('the floating Ask never floats over a phone’s controls', () => {
    /*
     * This used to check a swap: a floating button on wide screens, a fourth
     * `button.ask-tab` on phones. That tab is gone — it opened the same
     * conversation the Ask screen already is — so what is left to hold is the
     * half that was always about the hardware in someone's hands.
     *
     * Fixed to the bottom-right corner, the floating button sat on scene tile
     * 6, the pad's Change and Edit's Modifiers, because that corner is where
     * the last control in every grid lands. On a phone the tab row is the way
     * to the conversation and this must stay hidden.
     */
    assert.ok(
      !/button\.ask-tab \{/.test(code),
      'the removed Ask tab still has styling, which will dress up whatever gets that class next'
    )
    assert.ok(!code.includes('.ask-anywhere'), 'the floating Ask is back over a phone’s controls')
  })

  test('the eight scenes stay one row while a rail is out', () => {
    /*
     * "Open Scenes or Setup while on PLAY (desktop): scene 8 can drop a row."
     * The column loses the rail's 380px, and at 1280 wide that left room for
     * seven 110px tiles. Each tile may shrink to an eighth of the row instead,
     * so all eight fit whatever the rail leaves — and only while it is out:
     * the phone keeps its two-column grid.
     */
    const desk = code.slice(code.indexOf("html[data-rail='on'] #root {"))
    const rule = desk.match(/html\[data-rail='on'\] \.gig-scenes \{([^}]*)\}/)
    assert.ok(rule, 'the rail no longer makes room for eight scenes')
    assert.match(rule[1], /minmax\(min\(var\(--gig-col, 110px\), calc\(\(100% - 7 \* var\(--s-2\)\) \/ 8\)\), 1fr\)/, `the tile floor does not yield to an eighth of the row: ${rule[1].trim()}`)
    const media = [...code.slice(0, code.indexOf("html[data-rail='on'] .gig-scenes {")).matchAll(/@media \(min-width: (\d+)px\)/g)].pop()
    assert.equal(media && Number(media[1]), 1000, 'the eight-on-a-row rule is not inside the rail breakpoint')
  })

  test('a docked sheet is clipped to its rail and arrives without overshoot', () => {
    /*
     * The tour is a sheet; on a desktop it docks as a rail that animates in
     * from translateX(100%) inside an unclipped fixed layer, with a spring
     * that overshoots — so its first frames painted past the right edge of
     * the screen, and so did its exit.
     */
    const at = code.indexOf('.sheet-layer.rail {')
    assert.notEqual(at, -1)
    const rail = code.slice(at, code.indexOf('}', at))
    assert.match(rail, /overflow: clip/, 'the rail layer does not clip the sheet sliding into it')
    const sheet = code.slice(code.indexOf('.sheet-layer.rail .sheet {'), code.indexOf('}', code.indexOf('.sheet-layer.rail .sheet {')))
    assert.match(sheet, /transition-timing-function: var\(--ease\)/, 'the rail still springs past its docked position')
  })

  test('the tab you pressed is underlined, on paper the small type is readable, and the rest', () => {
    // :active at (0,3,1) outranked .current at (0,2,1): the grey press underline stuck on iOS.
    const current = code.indexOf('button.view-tab.current:not(:disabled) {')
    const active = code.indexOf('button.view-tab:active:not(:disabled) {')
    assert.ok(current !== -1 && active !== -1 && current > active, 'the current tab’s underline loses to the press state')
    const tab = code.slice(code.indexOf('button.view-tab {'), code.indexOf('}', code.indexOf('button.view-tab {')))
    assert.match(tab, /min-height: 44px/, 'the tab bar is under the touch floor')
    const toggle = code.slice(code.indexOf('.theme-toggle button {'), code.indexOf('}', code.indexOf('.theme-toggle button {')))
    assert.ok(!/min-height: 0/.test(toggle), 'the theme toggle opts out of the touch floor')
    // Tour dots and hand edits have their styles.
    assert.match(code, /button\.tour-dot \{/, 'the tour dots are not styled as buttons')
    assert.match(code, /\.turn-hand \.turn-text \{/, 'hand edits lost their quiet style')
    const hand = code.slice(code.lastIndexOf('.turn-hand .turn-text {'), code.indexOf('}', code.lastIndexOf('.turn-hand .turn-text {')))
    assert.match(hand, /border-left: 2px solid var\(--silk-faint\)/, 'a hand edit has no mark of its own now that it has no word')
    assert.match(code, /\.chain-strip\[data-overflow='yes'\],\s*\.grid-scroll\[data-overflow='yes'\] \{[^}]*mask-image/, 'the chain strip has no edge fade when it scrolls')
  })

  test('the faint type reads, in both themes', () => {
    /*
     * The cream theme's --silk-faint was #8b9099 on #f2efe9: 2.8:1, under
     * even the large-text floor, on every "FM3", "500", "remote", "Off" and
     * inactive tab. WCAG AA for text is 4.5:1; at 4.9:1 it was still "a
     * little light" on a phone in daylight, so the cream theme's floor is
     * higher. The dark theme's --silk-faint had the same 2.9:1 fault.
     */
    const lum = (hex) => {
      const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
      return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
    }
    const ratio = (a, b) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05)
    const themes = [
      ['dark', ':root {', 4.5],
      ['light', "[data-theme='light'] {", 6.5]
    ]
    for (const [name, open, floor] of themes) {
      const block = code.slice(code.indexOf(open), code.indexOf('}', code.indexOf(open)))
      const token = (t) => block.match(new RegExp(`--${t}: (#[0-9a-f]{6})`))?.[1]
      for (const ground of ['chassis', 'panel']) {
        for (const ink of ['silk', 'silk-dim', 'silk-faint']) {
          const r = ratio(token(ink), token(ground))
          assert.ok(r >= floor, `--${ink} on --${ground} is ${r.toFixed(2)}:1 in the ${name} theme (floor ${floor})`)
        }
      }
    }
  })

  test('a channel button is 44px both ways, not just across', () => {
    /*
     * It had min-width: 44px and no min-height, so it met the guideline in the
     * one direction a chip is naturally wide in and missed it in the direction
     * that actually needed the floor. Picking a channel is a primary control —
     * it is what a scene IS on this hardware.
     */
    const rule = code.slice(code.indexOf('.channel-buttons .chip {'), code.indexOf('}', code.indexOf('.channel-buttons .chip {')))
    assert.match(rule, /min-width: 44px/)
    assert.match(rule, /min-height: 44px/, 'a channel button is back to meeting the touch floor sideways only')
  })

  test('the amber reads too — on it and against it', () => {
    /*
     * The other half of the same fault, and the one on the control people press
     * hardest and in a hurry. `--on-signal` on `--signal` in the cream theme
     * measured 3.78:1 — that is the Save button's own text — and `--signal` as
     * ink on the cream ground came to 3.43:1, which is every amber word, rule
     * and border on that theme.
     *
     * Both directions, because amber is used both ways: as a ground with ink on
     * it, and as ink on the page. Fixing one alone leaves the other under the
     * floor and looking deliberate.
     */
    const lum = (hex) => {
      const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
      return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
    }
    const ratio = (a, b) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05)
    for (const [name, open] of [['dark', ':root {'], ['light', "[data-theme='light'] {"]]) {
      const block = code.slice(code.indexOf(open), code.indexOf('}', code.indexOf(open)))
      const token = (t) => block.match(new RegExp(`--${t}: (#[0-9a-f]{6})`))?.[1]
      const signal = token('signal')
      assert.ok(signal, `the ${name} theme has no --signal`)
      const ink = ratio(token('on-signal'), signal)
      assert.ok(ink >= 4.5, `--on-signal on --signal is ${ink.toFixed(2)}:1 in the ${name} theme — that is the Save button`)
      for (const ground of ['chassis', 'panel']) {
        const r = ratio(signal, token(ground))
        assert.ok(r >= 4.5, `--signal as ink on --${ground} is ${r.toFixed(2)}:1 in the ${name} theme`)
      }
    }
  })

  test('the desktop walkthrough is sized for the screen it is on, not for a dialog', () => {
    /*
     * "We need to increase the size of the desktop tutorial. It's pretty small
     * for a big screen. It should fill up the screen so that it's nice and
     * big."
     *
     * It was an 820px block with laptop type in the middle of whatever monitor
     * somebody had, which on a 27-inch display reads as a dialog nobody
     * closed. This is the one screen in the app that is NOT a window full of
     * controls — it is one sentence at a time with nothing behind it — so it
     * carries its own sizes rather than the app's, and they follow the
     * viewport.
     *
     * The app's scale stays where it is. What this holds is that the tour's
     * sizes are all tied to the window: a flat px here is the thing that put
     * the old block in the middle of a big screen in the first place.
     */
    const rule = (sel) => code.slice(code.indexOf(sel + ' {'), code.indexOf('}', code.indexOf(sel + ' {')))

    const onb = rule('.onb')
    for (const name of ['--onb-step', '--onb-head', '--onb-sub', '--onb-body', '--onb-label', '--onb-title', '--onb-gap', '--onb-pad']) {
      assert.match(onb, new RegExp(`${name}: clamp\\(`), `${name} is not a clamp, so it does not grow with the window`)
    }

    /* The width is what decides page or dialog. */
    assert.match(rule('.onb-sheet'), /max-width: min\(\d+px, \d+vw\)/, 'the walkthrough is a fixed-width block again')
    assert.match(rule('.onb-sheet'), /gap: var\(--onb-gap\)/, 'the walkthrough spaces itself at laptop sizes')

    /* And the parts read off the local scale rather than the app's. */
    for (const [sel, token] of [
      ['.onb-head', '--onb-head'],
      ['.onb-sub', '--onb-sub'],
      ['.onb-note', '--onb-body'],
      ['.onb-box-title', '--onb-title'],
      ['.onb-n', '--onb-label'],
      ['.onb-waiting', '--onb-sub'],
      ['.onb-acts button', '--onb-body']
    ]) {
      assert.match(rule(sel), new RegExp(`font-size: var\\(${token}\\)`), `${sel} is still sized for a laptop`)
    }

    /*
     * Equal-height cards, which only showed once they got big: the row centres
     * its children so the dash between two boxes stays on the line, and that
     * left a short box floating against a tall one.
     */
    assert.match(rule('.onb-box'), /align-self: stretch/, 'the three boxes are different heights again')

    /* A headline may run the full width; a sentence may not. */
    assert.match(rule('.onb-sub'), /max-width: \d+ch/, 'a line of prose can now run the whole width of a monitor')
  })

  test('the preset sits in the middle of the bar, and the chip’s word is not the smallest type in it', () => {
    const rule = (sel) => code.slice(code.indexOf(sel + ' {'), code.indexOf('}', code.indexOf(sel + ' {')))
    assert.match(rule('button.topbar-preset'), /align-items: center/, 'the preset button packs its line to the top of a 44px box again')
    assert.match(rule('.topbar-preset-line'), /align-items: baseline/, 'the slot and the name no longer share a baseline')
    assert.match(rule('button.phone-chip.compact'), /font-size: var\(--f-1\)/, 'the chip is off the scale')
  })

  test('on a phone the bar drops the unsaved word so the preset keeps its name', () => {
    const at = code.indexOf('@media (max-width: 620px) {\n  .save-cluster {')
    assert.notEqual(at, -1)
    const block = code.slice(at, at + 1200)
    assert.ok(!/topbar-dirty/.test(code), 'the separate UNSAVED word is back')
    assert.match(code, /\.save-cluster\[data-dirty='no'\] button\.save-now \{[^}]*background: none/, 'the Save button is amber with nothing to save')
    assert.match(block, /\.topbar-name \{\s*min-width: 8ch/, 'the preset name can shrink to one letter again')
  })

  test('on Play a scene is the size of a block, the words in both are readable, and the bar name is not a headline', () => {
    const rule = (sel) => code.slice(code.indexOf(sel + ' {'), code.indexOf('}', code.indexOf(sel + ' {')))
    const height = (text) => text.match(/min-height: (\d+)px/)?.[1]
    assert.equal(height(rule('button.gig-scene')), height(rule('button.gig-block')), 'scene tiles and effect blocks differ in height')
    /*
     * On a phone the two are still one rule, and both take their size from the
     * control rather than from a number written here.
     *
     * This used to pin the literal `min-height: 66px`, which pinned the bug:
     * that block hard-coded a 108px column floor and a 66px tile, so the − / +
     * buttons were overruled on the one screen they exist for and "Smallest"
     * was three blocks to a row whatever a player chose. What the test is
     * actually protecting is that a scene and a block never drift apart in
     * size — so it checks that, and that the figure comes from --gig-tile.
     */
    /* The 620px block that carries the two grids — there is more than one
       620px block in this file, and balanced() is here for exactly this. */
    const at = code.lastIndexOf(
      '@media (max-width: 620px) {',
      code.indexOf('.gig-scenes {\n    grid-template-columns')
    )
    const phone = balanced(code, at)
    assert.match(
      phone,
      /button\.gig-block,\s*\n\s*button\.gig-scene \{\s*min-height: var\(--gig-tile/,
      'on a phone the scenes and the blocks are sized apart again, or sized past the control'
    )
    /*
     * And the COLUMN COUNT comes from the control too.
     *
     * A pixel floor says "at least this wide" and lets the viewport pick how
     * many fit, which is why the default kept coming out three scenes across
     * when the layout he chose is two. minmax(0, 1fr) rather than 1fr because
     * a grid item's default min-width is its min-content — the trap that had
     * the effects stuck three to a row no matter what the floor said.
     */
    for (const [grid, v] of [['.gig-scenes', '--gig-scene-cols'], ['.gig-blocks', '--gig-fx-cols']]) {
      const rule = phone.slice(phone.indexOf(grid + ' {'), phone.indexOf('}', phone.indexOf(grid + ' {')))
      assert.match(
        rule,
        new RegExp(`grid-template-columns: repeat\\(var\\(${v}`),
        `${grid} on a phone no longer takes its column count from the size control`
      )
      assert.match(rule, /minmax\(0, 1fr\)/, `${grid} lets its content push a column wider than its share`)
    }
    assert.match(rule('.gig-block-name'), /font-size: var\(--f-4\)/, 'the block name is small again')
    /* As big as its tile has room for since 25 October 2026 (lib/sceneNameFit), never under --f-4. */
    assert.match(rule('button.gig-scene.named .gig-scene-name'), /font-size: var\(--name-size, var\(--f-4\)\)/, 'the scene name is small again')
    assert.match(rule('.gig-block-state'), /font-size: var\(--f-2\)/)
    assert.match(rule('.topbar-name'), /font-size: var\(--f-3\)/, 'the preset name in the bar is a headline again')
  })

  test('what is inside an effect tile fits inside the effect tile, at both sizes', () => {
    /*
     * "The effects names are all garbled."
     *
     * They came back from a phone with the top third of every name cut off in
     * a straight line — CMP, WAH, PHA, a row of half-letters over a readable
     * Off. The tile put 12px of padding above and below two lines whose height
     * was left to the font (`normal`, which is a different number in every
     * face), and on the phone that came to more than the tile is tall. A
     * browser is allowed to answer that by clipping a button rather than
     * growing it, and iOS does — the scene tiles above, on 8px, were fine.
     *
     * So the arithmetic is the test, with every number read out of the
     * stylesheet rather than restated here: two lines, their gap and their
     * padding have to come in under the tile at the size the tile is drawn.
     */
    const px = (t) => Number(code.match(new RegExp(`--${t}: ([0-9.]+)px`))[1])
    const rule = (sel) => code.slice(code.indexOf(sel + ' {'), code.indexOf('}', code.indexOf(sel + ' {')))
    const step = (r, prop) => {
      const raw = r.match(new RegExp(`${prop}: ([^;]+);`))?.[1]
      assert.ok(raw, `${prop} is gone from the effect tile`)
      return px(raw.trim().split(/\s+/)[0].match(/--(s-\d|f-\d)/)[1])
    }

    const tile = rule('button.gig-block')
    const name = rule('.gig-block-name')
    const state = rule('.gig-block-state')

    /* Stated, both of them. `normal` is the thing that differed between the
       machine this passes on and the phone it failed on. */
    const height = (r, which) => {
      const lh = Number(r.match(/line-height: ([0-9.]+);/)?.[1])
      assert.ok(lh, `the ${which} line in an effect tile is back on the font's own line-height`)
      return step(r, 'font-size') * lh
    }

    /*
     * The picture and the name, stacked — the AM4's layout. On/Off and the
     * channel sit in the top corners, out of the flow, so they take no
     * height; if they ever come back into it, the arithmetic has to count
     * them again, and this says so.
     */
    assert.match(state, /position: absolute/, 'On/Off and the channel are back in a line of their own under the name')
    const em = (r) => Number(r.match(/height: ([0-9.]+)em/)?.[1])
    const picture = (r) => em(r) * step(name, 'font-size') + Number(rule('.gig-block-icon').match(/margin: 0 auto (\d+)px/)[1])
    const lines = picture(rule('.gig-block-icon')) + height(name, 'name')
    /* 2px, because an effect that is off is ringed rather than filled and the
       ring is the wider of the two borders. */
    const border = 2 * 2

    const floor = Number(tile.match(/min-height: var\(--gig-tile, (\d+)px\)/)[1])
    const full = lines + 2 * step(tile, 'padding') + border
    assert.ok(full <= floor, `an effect tile holds ${full}px of content in ${floor}px`)

    const small = rule('.gig[data-compact] button.gig-block')
    // Fit hands the height to the screen; the stated size is the fallback.
    const stated = Number(small.match(/height: (?:var\(--gig-fit-tile, )?(\d+)px/)[1])
    const squeezed = picture(rule('.gig[data-compact] .gig-block-icon')) + height(name, 'name')
    const tight = squeezed + 2 * step(small, 'padding') + border
    assert.ok(tight <= stated, `at the smallest size an effect tile holds ${tight}px of content in ${stated}px`)
  })

  test('on Play the preset name sits in the middle of its tile', () => {
    /*
     * "Center preset name in button box." Baseline-aligned children of a
     * button pack to the cross start, so the number and the name sat against
     * the top edge of a tile a scene's height makes 62px, with a band of empty
     * tile under them. Same bug and same fix as the bar above it: the button
     * centres one line, and the line inside holds the shared baseline.
     */
    const rule = (sel) => code.slice(code.indexOf(sel + ' {'), code.indexOf('}', code.indexOf(sel + ' {')))
    assert.match(rule('button.gig-name'), /align-items: center/, 'the preset tile packs its line to the top again')
    /* The name and "Tap for all presets" under it, centred as a pair, the phone's label and sub. */
    assert.match(rule('.gig-name-row'), /flex-direction: column/, 'the name and the line under it are side by side')
    assert.match(rule('.gig-name-row'), /align-items: center/, 'the name and the line under it are not centred as a pair')
  })

  test('a scene and an effect are different objects, not two tiles with a stripe', () => {
    /*
     * "The scenes and effects look too similar."
     *
     * They were: two grids of same-sized tiles, same white face, same 3px
     * colour down the left edge, one directly above the other. Nothing said
     * where one grid ended and the next began — the colours told you WHICH
     * tile and nothing told you which KIND.
     *
     * So the effects are RINGED and the scenes are TABBED. A ring and a tab
     * are different objects at a glance, in a way two tabs of different
     * colours are not, and the tab is heavier than the ring so the two are not
     * simply a pair of thin lines.
     *
     * Neither is a fill: on this screen a filled tile means engaged, or the
     * scene you are standing in, and that meaning is not for sale.
     */
    const rule = (sel) => code.slice(code.indexOf(sel + ' {'), code.indexOf('}', code.indexOf(sel + ' {')))

    const scene = rule('button.gig-scene')
    const effect = rule('button.gig-block.off')

    /*
     * A tab was not enough either — "they still look too similar" — and could
     * not be: a tab and a ring are both a thin line of colour on a white card,
     * and at arm's length in the dark that is one thing, not two.
     *
     * So the scenes stop being white. A row of pale colour above a row of white
     * cards is a difference nobody has to inspect. The tile is WASHED with its
     * own hue; the one you are standing in takes the hue at full strength.
     */
    const wash = /background: color-mix\([^;]*--scene-fill[^;]*\);/.exec(scene)
    assert.ok(wash, 'a scene is a white card again, which is what the effects below it are')
    assert.match(
      rule('button.gig-scene.current'),
      /background: var\(--scene-fill/,
      'the scene you are standing in is no longer the full colour against the pale ones'
    )

    // And the effects keep the ring, on white — never a wash, or the two grids
    // are two washes and we are back where we started.
    assert.match(
      effect,
      /\n\s*border: \d+px solid var\(--block-fill/,
      'an effect is back to a stripe rather than a ring — same shape as a scene'
    )
    assert.ok(
      !/border-left: \d+px solid var\(--block-fill/.test(effect),
      'an effect carries a left stripe again, which was the scenes\' treatment'
    )
    assert.ok(
      !/background: color-mix/.test(effect),
      'an effect is washed like a scene, so both grids read the same again'
    )
  })

  test('the preset sheet does not slide sideways, and keeps its refresh button', () => {
    /*
     * "On this preset screen set it to not move horizontal at all and fix the
     * refresh button that's out of boundaries."
     *
     * One cause, two symptoms. The panel heading was a flex row that could not
     * wrap: PRESETS, five 44px range buttons and the refresh button want about
     * 370px, and a phone's sheet has less. So the row grew instead — carrying
     * the refresh button out past the sheet's rounded corner, and making the
     * whole panel wider than the screen, which is why the filter box, the view
     * buttons and every preset row were cut off at the right and the sheet
     * could be dragged sideways.
     */
    const head = code.slice(code.indexOf('.panel-head {'), code.indexOf('}', code.indexOf('.panel-head {')))
    assert.match(head, /flex-wrap: wrap/, 'the panel heading cannot wrap, so a phone pushes its last button out')

    /* And on a phone the ranges take the whole second line. Wrapping alone put
       the refresh button — last in the row — alone on the left of the second
       line, further from the title than it started. */
    const at = code.indexOf('.panel-head .preset-jumps {')
    assert.notEqual(at, -1, 'the phone rule that gives the ranges their own line is gone')
    const jumps = code.slice(at, code.indexOf('}', at))
    assert.match(jumps, /flex-basis: 100%/, 'the ranges no longer take their own line, so the refresh button wraps below them')

    /* Sideways is stated as well as fixed: a sheet is a fixed-width surface,
       and anything inside it that does not fit is a bug rather than something
       to scroll to. */
    const bodyAt = code.indexOf('.sheet-body {')
    const body = code.slice(bodyAt, code.indexOf('}', bodyAt))
    assert.match(body, /overflow-x: hidden/, 'the sheet can be dragged sideways again')

    /* The buttons that grew into that line are still real targets. */
    const jumpAt = code.indexOf('button.preset-jump {')
    const jump = code.slice(jumpAt, code.indexOf('}', jumpAt))
    assert.match(jump, /min-height: 44px/, 'a range button dropped under the touch floor')
  })

  test('at Smallest a tile is a fixed box, so a long scene name cannot push the blocks off the screen', () => {
    /*
     * "This says it's the smallest. It's still too big. All buttons need to be
     * able to fit on screen at the smallest."
     *
     * Two things were letting the screen grow past what the control asked for.
     *
     * `min-height` is a floor, not a height, so a scene called WET CRUNCH FUNK
     * wrapped to three lines and stood three times as tall as one called LEAD.
     * The height of the Play screen therefore depended on how a player had
     * named their scenes — which is why Smallest fitted the demo, whose scenes
     * are RHYTHM / LEAD / CLEAN, and did not fit his rig.
     *
     * And a grid item's default `min-width: auto` is its min-content width, so
     * a track declared `minmax(92px, 1fr)` still came out 130px because the
     * longest block name said so. The column floor was overruled by the text
     * inside it.
     *
     * Both are properties of the CSS, not of a screenshot, so both are pinned
     * here. Measured alongside: 8 scenes and 14 blocks at 440x790 with no
     * scroll.
     */
    const rule = (sel) => code.slice(code.indexOf(sel + ' {'), code.indexOf('}', code.indexOf(sel + ' {')))

    for (const sel of ['.gig[data-compact] button.gig-scene', '.gig[data-compact] button.gig-block']) {
      const r = rule(sel)
      // A stated height, or Fit's variable falling back to one — never a floor.
      assert.match(r, /\n\s*height: (?:var\(--gig-fit-tile, )?\d+px/, `${sel} is a floor again rather than a height`)
      assert.match(r, /min-height: 0/, `${sel} keeps a floor that can beat its own height`)
      assert.match(r, /overflow: hidden/, `${sel} lets its contents out of the box again`)
    }

    // The names are clamped, so neither can spend a line it has not got.
    assert.match(
      rule('.gig[data-compact] .gig-scene-name'),
      /-webkit-line-clamp: 2/,
      'a scene name wraps as far as it likes again'
    )
    assert.match(
      rule('.gig[data-compact] .gig-block-name'),
      /text-overflow: ellipsis[\s\S]*white-space: nowrap/,
      'a block name wraps again, so a row of blocks is as tall as its longest name'
    )

    // And the tiles can be as narrow as they were asked to be.
    const narrow = code.slice(code.indexOf('.gig[data-compact] .gig-block-cell,'))
    assert.match(narrow.slice(0, 200), /min-width: 0/, 'the tiles can push their own columns wider again')

    // No screen has a floating Ask button any more, so no screen keeps its
    // footprint — that was 80px at the bottom of the screen with the least
    // room. The one shell rule that applies says so for every width.
    assert.match(
      code,
      /\.shell \{\s*padding-left: max\(16px, env\(safe-area-inset-left\)\);\s*padding-right: [^;]+;\s*padding-bottom: max\(16px, env\(safe-area-inset-bottom\)\)/,
      'the page keeps 80px clear under a button it does not have'
    )
  })

  test('the search row the arrows are on is visible', () => {
    const rule = code.slice(code.indexOf('.param-search-hit.active {'), code.indexOf('}', code.indexOf('.param-search-hit.active {')))
    assert.match(rule, /border-color: var\(--signal\)/, 'the active search row looks like every other row')
  })

  test('the small type is 11px, state words are opaque, pills are targets with a mouse, and the bar says what it means', () => {
    const rule = (sel) => code.slice(code.indexOf(sel + ' {'), code.indexOf('}', code.indexOf(sel + ' {')))
    assert.match(code, /--f-1: 11px/, 'the smallest step of the scale is under 11px again')
    assert.ok(!/--f-\d: 10px/.test(code), 'a 10px step is back on the scale')
    assert.ok(!/opacity/.test(rule('.fx-chan')), 'the channel letter is see-through')
    for (const sel of ['button.gig-block.on .gig-block-state', 'button.gig-block.off']) {
      const every = [...code.matchAll(new RegExp(sel.replace(/[.()]/g, '\\$&') + ' \\{[^}]*\\}', 'g'))].map((m) => m[0])
      assert.ok(every.length >= 1)
      for (const r of every) assert.ok(!/opacity/.test(r), `${sel} dims with transparency, which takes the state word with it`)
    }
    assert.match(rule('button.fx-power'), /min-height: 44px/, 'the power pill is under 44px with a mouse')
    assert.match(rule('.strip-btn'), /min-height: 44px/, 'the strip buttons are under 44px with a mouse')
    assert.match(rule('.channel-buttons .chip'), /min-width: 44px/, 'the channel chips are narrow targets')
    /*
     * "demo" in the mono face at 10px with no tracking read as "deno". The
     * pill's word is the phone's since 3 November 2026: the mono face again,
     * but bold and at 13px, two steps up from the size that read wrong, in
     * mixed case as the phone draws it ("Demo FM3").
     */
    const word = code.slice(code.indexOf('.topbar-unit-state,\n.topbar-unit-name {'), code.indexOf('}', code.indexOf('.topbar-unit-state,\n.topbar-unit-name {')))
    assert.ok(word, 'the pill’s word and the unit have no face of their own')
    assert.match(word, /font-family: var\(--mono\)/, 'the pill’s word is not in the phone’s face')
    assert.match(word, /font-size: var\(--f-3\)/, '"Demo" is back at the size where it read as "deno"')
    assert.match(word, /font-weight: 700/, 'the pill’s word is not bold, as the phone’s is')
    assert.match(code, /\.topbar-slot::before \{\s*content: 'slot '/, 'the slot number has no noun')
  })

  test('the edge fade is at every width and on the grid, scene names wrap, the menu is one scroller', () => {
    // Unindented, so at base scope: every rule inside a media block is indented two spaces.
    const base = code.indexOf("\n.chain-strip[data-overflow='yes'],\n.grid-scroll[data-overflow='yes'] {")
    assert.notEqual(base, -1, 'the overflow fade is not shared by the strip and the grid at base scope (or sits inside the phone block)')
    const name = code.slice(code.indexOf('.scene-name {'), code.indexOf('}', code.indexOf('.scene-name {')))
    assert.match(name, /white-space: normal/, 'a scene name is cut to "Rhyt…" again')
    assert.ok(!/text-overflow: ellipsis/.test(name))
    assert.match(code, /\.scene-row \{[^}]*minmax\(120px, 1fr\)/, 'the scene cell is too narrow for a name and a pencil')
    assert.ok(!/\.scenes \{\s*margin-top: 34px/.test(code), 'the dead air under the Scenes sheet head is back')
  })

  test('the model picker clips with an ellipsis, not mid-word', () => {
    // The control is a button now, not a select: an <option> is one run of text
    // and could not carry a name in one size beside an amp in another. The
    // truncation rule follows the element that shows the chosen name.
    const rule = code.slice(code.indexOf('.type-open-name {'), code.indexOf('}', code.indexOf('.type-open-name {')))
    assert.match(rule, /text-overflow: ellipsis/)
    assert.ok(!/;;/.test(rule), 'a stray double semicolon is back')
    assert.ok(!code.includes('.type-select'), 'the styling for the select the app no longer renders is still here')
  })

  /*
   * The conversation gets the screen it is on.
   *
   * "Right now it feels clunky." Half of that was the tone taking pages. The
   * other half was this: the transcript was a 340px window (260 on a phone) with
   * the page scrolling behind it, on the screen whose own comment says Create
   * "gives it the whole screen". Measured before the change: 19px of 900.
   */
  test('the transcript fills the Create screen rather than a letterbox', () => {
    const chat = css.slice(css.indexOf('.shell.shell-chat'))

    // A height, not a minimum: a column that grows has no reason to scroll, and
    // the transcript pushed the composer off the bottom instead.
    assert.match(chat.slice(0, 900), /height: 100dvh/, 'the chat column has no fixed height')
    assert.ok(!/min-height: 100vh|height: 100vh\b/.test(chat.slice(0, 900)),
      'vh rather than dvh — on iOS that is the tall viewport, so the column outgrows the screen')

    // The chain has to reach: the conversation is inside .screens > .screen,
    // both plain blocks, and a flex column only hands height to flex items.
    assert.match(css, /\.shell-chat \.screens,\s*\n\s*\.shell-chat \.screens > \.screen \{/,
      'the flex chain stops before the conversation, so it stays at content height')
    assert.match(css, /\.chat-screen \.assistant-log \{[^}]*max-height: none/,
      'the log keeps its letterbox cap on the screen that is meant to be its home')
  })

  /*
   * And the same on a phone, where the conversation is a sheet.
   *
   * "We should be using all the screen space." The Ask sheet was as tall as
   * its contents and no taller than 88% of the window, with the transcript
   * capped at 260px inside it: two thirds of a phone, most of that blurred
   * page, and the chat in a letterbox at the bottom.
   */
  test('the Ask sheet fills the screen and the transcript fills the sheet', () => {
    const tall = code.slice(code.indexOf('.sheet.sheet-tall {'), code.indexOf('}', code.indexOf('.sheet.sheet-tall {')))
    assert.match(tall, /height: calc\(100% - env\(safe-area-inset-top/, 'the tall sheet is as short as its contents again')
    assert.match(tall, /max-height: none/, 'the tall sheet still stops at 88% of the window')
    assert.match(css, /\.sheet-tall \.sheet-body > \.assistant \.assistant-log \{[^}]*max-height: none/,
      'the transcript keeps its letterbox cap inside the tall sheet')
    assert.match(css, /\.sheet-tall \.sheet-body > \.assistant \{[^}]*flex: 1 1 auto/,
      'the conversation does not take what is left of the sheet')
  })

  /*
   * And the box you type into gets the width of the row it is in.
   *
   * `.refine-row` was referenced in two components and styled in none, so the
   * row was a plain block and the field kept a browser default: 230 pixels, on
   * a 1280-pixel window and on a 390-pixel phone alike. Measured after: 1046 of
   * 1113 on the desktop.
   */
  test('the box you type in is as wide as the row and as tall as what is in it', () => {
    const row = code.slice(code.indexOf('.refine-row {'), code.indexOf('}', code.indexOf('.refine-row {')))
    assert.match(row, /display: flex/, 'the composer row is a plain block again, so the box keeps its default width')
    /* At the bottom, so the button stays put as the box grows upward. */
    assert.match(row, /align-items: flex-end/, 'the button drifts down the screen as the box grows')

    const field = code.slice(
      code.indexOf('.refine-row .refine-input {'),
      code.indexOf('}', code.indexOf('.refine-row .refine-input {'))
    )
    /* A field carries an intrinsic width; without this a flex item will not go
       below it, which is how one 230px box survived every screen. */
    assert.match(field, /min-width: 0/, 'the box cannot shrink below its intrinsic width')
    assert.match(field, /flex: 1 1 auto/, 'the box does not take the space in the row')

    const area = code.slice(
      code.indexOf('textarea.refine-input {'),
      code.indexOf('}', code.indexOf('textarea.refine-input {'))
    )
    /* The height is computed from the content, so a ceiling is what stops a
       pasted page from eating the conversation above it. */
    assert.match(area, /max-height:/, 'a long request grows the box without limit')
    assert.match(area, /overflow-y: auto/, 'past the ceiling the box clips rather than scrolls')
    assert.match(area, /resize: none/, 'a drag handle fights the height being computed')
    /* It changed element, and the blanket textarea rule is written for the big
       description box — a different face, size, ground and pad. */
    assert.match(area, /font-family: var\(--mono\)/, 'the box quietly changed typeface')

    /*
     * And it is still a target under a thumb. The 44px floor names elements
     * individually because that is the only thing that beats the rules setting
     * their heights — and an element selector does not follow a class across
     * element types, so `input.refine-input` stopped covering this box the
     * moment it became a textarea.
     */
    assert.match(code, /textarea\.refine-input,/, 'the box you type in is under 44px on a phone again')
  })

  /*
   * The preset name gets the room; the chips beside it stop taking it.
   *
   * "Make the save and connect button a little bit smaller, it's overlapping
   * slightly into the preset name." On a 390px screen the name wanted 108px and
   * had 98, so it read "Puppet…" — and the chip on that phone says "connected",
   * which is three characters longer than the short case anyone measuring
   * casually would land on.
   *
   * What came off is horizontal padding and the tracking on a word that does
   * not need it. What did not come off is height: these are the controls
   * somebody presses standing up, mid-song.
   */
  test('the bar spends its width on the name, and its chips are still targets', () => {
    /* The phone block that carries all of it — found by the promise made in it
       rather than by counting media queries. */
    /* Anchored on the promise itself — `.topbar-name` appears twice, and the
       base rule is not the one that matters here. */
    const at = code.indexOf('min-width: 8ch')
    assert.ok(at > 0, 'the promise of eight characters of preset name is gone')
    const block = balanced(code, code.lastIndexOf('@media (max-width: 620px)', at))
    assert.ok(block.includes('min-width: 8ch'), 'the phone rules for the bar are not one block')

    for (const [what, rule] of [
      ['the link chip', /button\.phone-chip\.compact \{[^}]*padding: var\(--s-1\) var\(--s-1\)/],
      ['the preset button', /button\.topbar-preset \{[^}]*padding: var\(--s-1\)/],
      ['the slot and the name', /\.topbar-preset-line \{[^}]*gap: var\(--s-1\)/]
    ]) {
      assert.match(block, rule, `${what} takes back the width it gave the preset name`)
    }

    /* The tracking on a nine-letter word cost five pixels of the name. */
    assert.match(block, /letter-spacing: normal/, 'the chip is tracked again, at the name’s expense')

    /*
     * The gaps and Save are the phone's at every width since 3 November 2026
     * (mobile/src/components/TopBar.js): 12px between things, and Save the
     * small amber pill. The width a phone is short of comes out of the
     * version, which gives way first, then the unit's name; no phone block
     * squeezes the row or Save any more.
     */
    let narrow = ''
    for (const m of code.matchAll(/@media \(max-width: 620px\)/g)) narrow += balanced(code, m.index)
    assert.ok(!/\.topbar-row \{/.test(narrow), 'the bar’s gaps shrink on a phone again, which the phone’s do not')
    /* The one narrower row is the computer's own window with its switch for phones in it, which a phone's bar never has. */
    const squeezed = [...narrow.matchAll(/([^{}]*\.topbar-row[^{}]*)\{[^}]*gap:/g)].map((m) => m[1].trim())
    assert.deepEqual(squeezed, ['.topbar-row:has(.phone-link)'], 'a phone’s bar has narrower gaps than the phone’s, or the computer’s narrowed window lost its room')
    const topBar = readFileSync(new URL('../src/components/TopBar.jsx', import.meta.url), 'utf8')
    assert.match(topBar, /const showSwitch = link\?\.role === 'mac' && !demo\b/, 'the switch for phones can be in a phone’s bar, which the narrower gap would then squeeze')
    assert.match(topBar, /\{showSwitch \? <LinkChip/, 'the switch for phones is drawn by another rule than showSwitch')
    const row = code.slice(code.indexOf('.topbar-row {'), code.indexOf('}', code.indexOf('.topbar-row {')))
    assert.match(row, /gap: var\(--s-3\)/, 'the bar’s gaps are not the phone’s 12px')
    const version = code.slice(code.indexOf('.topbar-version {'), code.indexOf('}', code.indexOf('.topbar-version {')))
    /* A basis of nothing, the phone's flex: 1, so it has only the room the rest leaves and gives before the unit's name does. */
    assert.match(version, /flex: 1 1 0;/, 'the version does not take the slack, so it is not the first thing to give')
    assert.match(version, /text-overflow: ellipsis/, 'the version spills out of the bar rather than giving way')
    const save = code.slice(code.indexOf('.topbar .save-cluster button.save-now {'), code.indexOf('}', code.indexOf('.topbar .save-cluster button.save-now {')))
    assert.match(save, /padding: 0 var\(--s-3\)/, 'Save is not the phone’s pill: its sides are the old box’s')
    assert.match(save, /font-size: var\(--f-1\)/, 'Save is not the phone’s small type')
    assert.match(save, /font-weight: 700/)
    assert.match(code, /\.topbar \.save-cluster button\.save-now::before \{[^}]*background: var\(--signal\)/, 'Save has no amber pill drawn in its box')
    /* Saving… keeps the green word and the moving dot, with no pill behind them. */
    assert.match(code, /\.topbar \.save-cluster\[data-working='yes'\] button\.save-now,\s*\n\.topbar \.save-cluster\[data-working='yes'\] button\.save-now:disabled \{[^}]*color: var\(--ok\)/, 'Saving… is not green in the bar')
    assert.match(code, /\.topbar \.save-cluster\[data-working='yes'\] button\.save-now::before \{[^}]*background: none/, 'Saving… sits on the amber pill, as a button to press again')

    /*
     * And none of it came out of the height. Every height here is set outside
     * the phone block, so a padding change cannot quietly shrink a target —
     * this fails if somebody ever answers "a little bit smaller" with the one
     * dimension that must not move.
     */
    assert.ok(!/min-height|height:/.test(block), 'something in the bar got shorter rather than narrower')
    assert.match(code, /\.save-cluster button\.save-now \{[^}]*min-height: 46px/,
      'the Save button lost its floor')
    assert.ok(!/min-height|height:/.test(save), 'the bar’s Save sets its own height, under the 46px floor')
    /* And the row is as tall as Save's box, so Save appearing never moves the bar, and Play under it, down. */
    const rowFloor = Number(row.match(/min-height: (\d+)px/)?.[1])
    const saveFloor = Number(code.match(/\.save-cluster button\.save-now \{[^}]*min-height: (\d+)px/)?.[1])
    /* Every box is measured padding and all (box-sizing: border-box), so the room inside is the floor less the row's two steps. */
    assert.match(code, /\n\* \{\s*box-sizing: border-box;\s*\}/, 'boxes are measured without their padding now: work the bar’s room out again')
    assert.match(row, /padding: var\(--s-1\) 0/, 'the bar’s row padding changed: work its room out again')
    const inside = rowFloor - 2 * 4
    assert.ok(inside >= 44, 'the bar’s row is under the touch floor')
    assert.ok(inside >= saveFloor, `the bar’s row has ${inside}px inside, under Save’s ${saveFloor}px, so the bar grows when Save appears`)
    /*
     * And a docked panel starts where the bar ends: the row and the bar's
     * 1px rule. It was 45px, a 44px row's, and on a window 1000px or wider
     * Settings, Demo Unit and the block panels started 10px up inside the
     * bar, over its rule.
     */
    assert.match(code, /\.topbar \{[^}]*border-bottom: 1px solid/, 'the bar’s rule changed: work out where a docked panel starts again')
    assert.equal(Number(code.match(/--bar-h: (\d+)px/)?.[1]), rowFloor + 1, 'a docked panel starts somewhere other than under the bar')

    /*
     * When the version steps aside for Save on a phone, nothing takes its
     * place: an empty spacer was one more thing in the row, and the 12px gap
     * beside it was what "Axe-Fx III" was short of beside Unlock and Save on
     * a 390-wide phone. The pill holds the right on its own.
     */
    assert.match(topBar, /\{narrow && saveUp \? null : \(\s*<span className="topbar-version mono"/, 'the version is swapped for something that takes a gap of the row')
    assert.ok(!/topbar-gap/.test(topBar + code), 'the empty spacer is back in the row, spending a gap of the unit’s name')
    assert.match(code, /button\.topbar-unit \{[^}]*margin-left: auto/, 'with the version stepped aside, the pill and all after it slide to the left of the bar')

    /*
     * Beside the preset on a wide Edit, the unit's name stays whole and the
     * preset name gives, as before the pill: from 621px to about 800px the
     * two shrank together and "Axe-Fx III" was cut to "A…" while the version
     * kept its width.
     */
    assert.match(code, /@media \(min-width: 621px\) \{\s*\.topbar\[data-preset='yes'\] button\.topbar-unit \{\s*flex-shrink: 0;/, 'beside a preset on a wide Edit the unit’s name is cut while the version keeps its room')
    assert.match(code, /button\.topbar-preset \{[^}]*flex: 1 1 auto;[^}]*min-width: 0/, 'the preset no longer gives way, so a whole pill would push the bar off the window')

    /*
     * And the bar reaches the shell's edges, no further: the shell's sides
     * are 16px at every width (the @supports block), and the bar's 24px
     * reached 8px past the screen from 621px to about 1196px, so the page
     * could be dragged sideways on an iPad.
     */
    assert.match(code, /--s-4: 16px/)
    assert.match(code, /@supports \(padding: max\(0px\)\) \{\s*\.shell \{\s*padding-left: max\(16px, env\(safe-area-inset-left\)\);\s*padding-right: max\(16px, env\(safe-area-inset-right\)\);/, 'the shell’s sides changed: the bar’s reach has to follow them')
    const bars = [...code.matchAll(/(?:^|\})\s*(?:\/\*[\s\S]*?\*\/\s*)*\.topbar \{([^}]*)\}/g)].map((m) => m[1])
    assert.ok(bars.length >= 1, 'the bar has no rule of its own')
    for (const rule of bars) {
      const margin = rule.match(/margin:[^;]*/)?.[0]
      if (margin) assert.equal(margin, 'margin: 0 calc(var(--s-4) * -1)', 'the bar reaches past the shell’s sides, so the page scrolls sideways')
    }
    assert.match(bars.join('\n'), /margin: 0 calc\(var\(--s-4\) \* -1\);\s*padding: 0 var\(--s-4\);/, 'the bar’s content no longer lines up with the page under it')
  })

  /*
   * The bar's amber buttons under a mouse and a keyboard. The phone has
   * neither, so these are the browser's own: a mouse over Unlock or Save
   * rings it and leaves its fill and ink alone (the wash and the amber word
   * read at under 4.5:1 in the light theme and looked switched off, and is
   * kept for the press); and the keyboard's ring is on the amber pill, not
   * round the 46px box it is drawn in.
   */
  test('the bar’s amber buttons keep their colours under a mouse, and the keyboard ring is on the pill', () => {
    const hovers = [...code.matchAll(/@media \(hover: hover\) \{([\s\S]*?)\n\}/g)].map((m) => m[1]).join('\n')
    const unlock = hovers.match(/\.topbar-pill:hover \.topbar-pill-face \{([^}]*)\}/)?.[1]
    assert.ok(unlock, 'Unlock has no hover of its own')
    assert.ok(!/background|color:/.test(unlock), 'a mouse over Unlock changes its fill or its ink')
    assert.match(unlock, /box-shadow: 0 0 0 /, 'a mouse over Unlock shows nothing')
    const save = hovers.match(/\.topbar \.save-cluster button\.save-now:hover:not\(:disabled\) \{([^}]*)\}/)?.[1]
    assert.ok(save, 'the bar’s Save has no hover of its own')
    assert.match(save, /filter: none/, 'a mouse over the bar’s Save brightens the near-white word on the light theme’s amber')
    assert.ok(!/color:/.test(save), 'a mouse over the bar’s Save changes its ink')
    const saveFace = hovers.match(/\.topbar \.save-cluster button\.save-now:hover:not\(:disabled\)::before \{([^}]*)\}/)?.[1]
    assert.ok(saveFace && !/background/.test(saveFace) && /box-shadow: 0 0 0 /.test(saveFace), 'a mouse over the bar’s Save changes its fill, or shows nothing')
    /* The wash is the press. */
    assert.match(code, /\.topbar-pill:active \.topbar-pill-face \{[^}]*background: var\(--signal-wash\)/, 'a press on Unlock shows nothing')
    assert.match(code, /\.topbar \.save-cluster button\.save-now:active:not\(:disabled\)::before \{[^}]*background: var\(--signal-wash\)/, 'a press on the bar’s Save shows nothing')
    /* The keyboard's ring, the app's own, on the pill. */
    assert.match(code, /button:focus-visible \{\s*outline: 2px solid var\(--live\);\s*outline-offset: 2px;/)
    assert.match(code, /\.topbar \.save-cluster button\.save-now:focus-visible \{\s*outline: none;\s*\}/, 'the keyboard’s ring is round the bar Save’s 46px box, an oval well clear of the pill')
    assert.match(code, /\.topbar \.save-cluster button\.save-now:focus-visible::before \{\s*outline: 2px solid var\(--live\);\s*outline-offset: 2px;/, 'the bar’s Save has no ring under the keyboard at all')
  })

  /*
   * The pill is two lines tall whatever it says, so the bar is one height,
   * and a lone line sits in the middle of it: on the sign-in screen, the
   * first a new visitor sees, "No computer" sat at the top over an empty
   * line. The line under is in the phone's regular weight.
   */
  test('the pill is two lines tall whatever it says, and one line sits in the middle', () => {
    const face = code.slice(code.indexOf('.topbar-unit-face {'), code.indexOf('}', code.indexOf('.topbar-unit-face {')))
    assert.match(face, /justify-content: center/, 'a lone line sits at the top of the pill')
    assert.match(face, /min-height: calc\(var\(--f-3\) \* 1\.3 \+ var\(--f-1\) \* 1\.3 \+ var\(--s-1\) \* 2 \+ 2px\)/, 'the pill is not two lines tall whatever it says')
    /* That height is the two lines, the face's padding and its rule: worked from them. */
    const lines = code.slice(code.indexOf('.topbar-unit-state,\n.topbar-unit-name {'), code.indexOf('}', code.indexOf('.topbar-unit-state,\n.topbar-unit-name {')))
    const where = code.slice(code.indexOf('.topbar-unit-where {'), code.indexOf('}', code.indexOf('.topbar-unit-where {')))
    assert.match(lines, /font-size: var\(--f-3\);[\s\S]*line-height: 1\.3;/)
    assert.match(where, /font-size: var\(--f-1\);[\s\S]*line-height: 1\.3;/)
    assert.match(face, /padding: var\(--s-1\) var\(--s-2\);\s*border: 1px solid/, 'the pill’s padding or rule changed: work its height out again')
    assert.match(where, /font-weight: 400/, 'the computer’s line takes the buttons’ 500, heavier than the phone’s')
    const bar = readFileSync(new URL('../src/components/TopBar.jsx', import.meta.url), 'utf8')
    assert.match(bar, /\{pill\.where \? <span className="topbar-unit-where">\{pill\.where\}<\/span> : null\}/, 'an empty line is drawn under a pill with nothing to say about the computer')
  })

  /*
   * A four-slot chain runs across; a twelve-column grid never can.
   *
   * "Show them horizontally like it does on the device itself." The AM4 is four
   * switches in a row and signal runs along them. The reason this was a stacked
   * list to begin with is the other unit: the old horizontal grid was 940px
   * wide on a 390px phone, which is the bug that rebuild fixed.
   */
  test('the chain runs across only on the unit whose chain fits across', () => {
    const across = code.slice(code.indexOf('.chain-lane[data-linear] {'))
    assert.ok(across.length > 100, 'the linear chain no longer has a layout of its own')
    assert.match(across.slice(0, 200), /flex-direction: row/, 'the four slots are stacked again')

    /*
     * The plain lane stays a column. A bare `.chain-lane` going horizontal puts
     * twelve columns on a phone, which is the 940px grid back.
     */
    const plain = code.slice(code.indexOf('.chain-lane {'), code.indexOf('}', code.indexOf('.chain-lane {')))
    assert.match(plain, /flex-direction: column/, 'a grid unit lays its twelve columns across a phone again')

    /*
     * And the slot you tap gets the whole row back for its controls — a quarter
     * of a phone is 85px, and a model picker does not fit in it.
     */
    assert.match(code, /\.chain-lane\[data-linear\] \.chain-slot\.open \{[^}]*flex-basis: 100%/,
      'the open slot keeps its quarter of the row, so its controls are unreachable')
  })

  /*
   * An arrow at the end of the box, and a box you would type a sentence into.
   *
   * "Instead of a send button below the chat box, put a send arrow on the right
   * side of it. Also, let's make the chat box text entry a little more rounded
   * instead of square."
   */
  test('no width has a way into a conversation that no longer exists', () => {
    /*
     * This used to insist on the opposite — a ✦ Ask tab wide, an Ask button
     * in the stage bar narrow — and outlived the AI it was for. "Big issue is
     * the ASK. We removed that a long time ago and there shouldn't be any
     * user facing ASK buttons." There are none, and no style waiting for one.
     */
    assert.ok(!/gig-ask/.test(code), 'the stage bar’s Ask button has a style again')
    assert.ok(!/ask-anywhere/.test(code), 'the floating Ask button has a style again')
  })

  test('the composer ends in a round arrow and the box is not a rectangle', () => {
    const btn = code.slice(code.indexOf('button.send-btn {'), code.indexOf('}', code.indexOf('button.send-btn {')))
    assert.ok(btn.length > 40, 'the send arrow has no style of its own')
    assert.match(btn, /border-radius: 50%/, 'the arrow is square again')
    /* Round is not an excuse to be small: this is pressed with a thumb. */
    assert.match(btn, /width: 44px/, 'the arrow is under a thumb-sized target')
    assert.match(btn, /height: 44px/, 'the arrow is under a thumb-sized target')
    /* It must not stretch as the box grows — flex-end keeps it at the bottom,
       and a fixed basis keeps it a circle. */
    assert.match(btn, /flex: 0 0 auto/, 'the arrow stretches with the box')

    const box = code.slice(code.indexOf('textarea.refine-input {'), code.indexOf('}', code.indexOf('textarea.refine-input {')))
    const radius = box.match(/border-radius: var\(--r-(\d)\)/)
    assert.ok(radius, 'the box takes whatever radius it inherits')
    assert.ok(Number(radius[1]) >= 3, `the box is back to a ${radius[0]} corner, which is the panel edge`)
  })

  test('help lines and scene names wrap instead of stopping mid-sentence', () => {
    /*
     * "Help text cut off mid-sentence" and "Scene names cut short." What
     * clipped was the one-line note beside each section title — "Let a pedal
     * or the volume knob move a…" in the 380px side panel, right under the
     * chain editor — the line under a sheet's title, the live line under a
     * Setup row, and the scene on Edit's chip at fourteen letters. Half a
     * sentence that explains a control explains nothing, and a clipped scene
     * name could be either of two scenes that start the same way.
     */
    const rule = (sel) => {
      const at = code.indexOf(`${sel} {`)
      assert.ok(at !== -1, `${sel} has no style at all`)
      return code.slice(at, code.indexOf('}', at))
    }
    for (const sel of ['.section-note', '.sheet-note', '.setup-row-status']) {
      const r = rule(sel)
      assert.ok(!/white-space: nowrap/.test(r), `${sel} is held to one line again`)
      assert.ok(!/text-overflow: ellipsis/.test(r), `${sel} is cut off with an ellipsis again`)
    }
    /* The scene chip: two lines, and wider than the fourteen letters it had. */
    const name = rule('.scene-now-name')
    assert.ok(!/white-space: nowrap/.test(name), 'the scene on Edit is held to one line again')
    assert.match(name, /-webkit-line-clamp: 2/, 'the scene on Edit does not get its second line')
    const wide = Number(name.match(/max-width: (\d+)ch/)?.[1] || 0)
    assert.ok(wide > 14, `the scene on Edit is ${wide || 'no'}ch wide — the width that cut the names short`)

    /* And Edit's Tap opens its box downward, off a row near the top of the page. */
    const box = rule('.gig-tap-cell.tap-row .gig-tempo')
    assert.match(box, /top: calc\(100% \+ var\(--s-2\)\)/, 'Edit’s tempo box opens upward over the chain')
    assert.match(box, /bottom: auto/, 'Edit’s tempo box is pinned to both edges at once')
  })

  /*
   * SETTINGS → COLOURS, at a phone's width and on both pages.
   *
   * The page is the phone's, and it has to fit where the phone's does: a
   * 320px screen with the sheet's own inset leaves 288px, and five tiles to a
   * look card, two effects across, four scenes across and four swatches across
   * all have to come out of that without the page going sideways. Every grid
   * here shrinks its columns (minmax(0, …) or min(100%, …)) rather than
   * holding a width — the min-content trap that once had the effects stuck
   * three to a row is the same one that pushes a page off a phone.
   */
  test('the Colours page and its colour sheet fit a 320px phone, and the sheet sits over Settings', () => {
    const rule = (sel) => {
      const at = code.indexOf(`${sel} {`)
      assert.notEqual(at, -1, `styles.css has no ${sel} rule`)
      return code.slice(at, code.indexOf('}', at))
    }
    assert.match(rule('.colours-looks'), /grid-template-columns: repeat\(auto-fill, minmax\(min\(100%, 300px\), 1fr\)\)/, 'a look card can be wider than the phone')
    assert.match(rule('.gig.colours-look-tiles'), /grid-template-columns: repeat\(5, minmax\(0, 1fr\)\)/, 'a look card’s five tiles hold their widths')
    assert.match(rule('.gig.colours-effects'), /grid-template-columns: repeat\(auto-fill, minmax\(min\(100%, 140px\), 1fr\)\)/, 'the effects are not two across on a phone')
    assert.match(rule('.gig.colours-scenes'), /grid-template-columns: repeat\(4, minmax\(0, 1fr\)\)/, 'the scenes are not four across, or hold their widths')
    /* Six swatches across at most, never under 48px: four on a 320px phone. */
    assert.match(rule('.colour-swatches'), /minmax\(max\(48px, calc\(\(100% - 5 \* var\(--s-2\)\) \/ 6\)\), 1fr\)/)
    const sixAt = (inner) => Math.floor((inner + 8) / (Math.max(48, (inner - 5 * 8) / 6) + 8))
    assert.equal(sixAt(320 - 2 * 16 - 2 * 16), 4, 'a 320px phone does not get four swatches across')
    assert.equal(sixAt(480 - 2 * 16), 6, 'a wide panel does not get six across')
    /* The panel is never wider than the screen it is on. */
    assert.match(rule('.colour-panel'), /width: min\(480px, 100%\)/)
    assert.match(rule('.colour-panel-body'), /overflow-y: auto/, 'a tall sheet runs off a short screen')
    /* No fixed width anywhere on the page wider than a 320px phone leaves. */
    const section = code.slice(code.indexOf('.colours {'), code.indexOf('.colour-layer {'))
    for (const m of section.matchAll(/(?:^|[;{\s])(?:min-)?width: (\d+)px/g)) {
      assert.ok(Number(m[1]) <= 288, `something on the Colours page is ${m[1]}px wide, more than a 320px phone has`)
    }
    /* And names are broken between words, not left to push the page. */
    assert.match(rule('.colours-scenes button.gig-scene.named .gig-scene-name'), /overflow-wrap: break-word/)

    /* Over Settings and under a toast: one thing open, the colour sheet on top. */
    assert.match(rule('.colour-layer'), /z-index: var\(--z-over-sheet\)/)
    const z = (name) => Number(code.match(new RegExp(`--z-${name}: (\\d+);`))?.[1])
    assert.ok(z('sheet') < z('over-sheet') && z('over-sheet') < z('toast'), 'the colour sheet is not between Settings and a toast')
    /* On paper a pale swatch has an edge, or white is a hole in the panel. */
    assert.match(code, /\[data-theme='light'\] button\.colour-swatch \{\s*border-color: var\(--swatch-edge\);/)
    assert.match(code, /button\.colour-swatch\.chosen,\s*\[data-theme='light'\] button\.colour-swatch\.chosen \{\s*border-color: var\(--signal\);/, 'the swatch picked is not ringed in amber on both pages')
  })

  test('Grey when off is lib/colourPage’s grey on both pages, and stays off the scenes', async () => {
    const { OFF_GREY } = await import('../src/lib/colourPage.js')
    const { contrast } = await import('../src/lib/ink.js')
    const vars = (opener) => {
      const at = code.indexOf(opener)
      assert.notEqual(at, -1, `styles.css has no ${opener.trim()} rule`)
      const body = code.slice(at, code.indexOf('}', at))
      const v = (name) => body.match(new RegExp(`--off-${name}: (#[0-9a-f]{6});`))?.[1]
      return { fill: v('fill'), edge: v('edge'), ink: v('ink') }
    }
    const dark = vars("button.gig-block.off[data-off='grey'],\nbutton.fx-tile.bypassed[data-off='grey'] {")
    const light = vars("[data-theme='light'] button.gig-block.off[data-off='grey'],\n[data-theme='light'] button.fx-tile.bypassed[data-off='grey'] {")
    assert.deepEqual(dark, { ...OFF_GREY.dark }, 'the dark page’s grey is not the one the phone draws')
    assert.deepEqual(light, { ...OFF_GREY.light }, 'the Light page’s grey is not the one the phone draws')
    /* The letters at 4.5:1, the edge 3:1 off the page, on both pages. */
    for (const [page, grey, grounds] of [['dark', dark, ['#0d0f12', '#15181d']], ['light', light, ['#f2efe9', '#faf8f4', '#ffffff']]]) {
      assert.ok(contrast(grey.ink, grey.fill) >= 4.5, `the ${page} page’s grey tile cannot carry its letters`)
      for (const g of grounds) assert.ok(contrast(grey.edge, g) >= 3, `the ${page} page’s grey edge is lost on ${g}`)
    }
    /* Drawn: the tile, its edge, its letters and its picture, on Play's pedals and the strip's bypassed blocks. */
    assert.match(code, /:root button\.gig-block\.off\[data-off='grey'\] \{\s*background: var\(--off-fill\);\s*border: 2px solid var\(--off-edge\);/)
    assert.match(code, /:root button\.gig-block\.off\[data-off='grey'\] \.gig-block-icon \{\s*background-color: var\(--off-ink\);/)
    assert.match(code, /:root button\.fx-tile\.bypassed\[data-off='grey'\]:not\(\.io-tile\) \{\s*background: var\(--off-fill\);\s*color: var\(--off-ink\);/)
    /* Never a scene: a scene that is not the live one is not switched off. */
    assert.ok(!/gig-scene[^{]*\[data-off/.test(code), 'a scene tile can go grey')
  })

  test('Settings’ sections and page heads are thumb-high, and light or dark is three full-width buttons wherever Settings is a sheet from the bottom', () => {
    /* One rule's body, outside any media block, by its exact selector. */
    const body = (sel) => {
      const at = code.indexOf(`\n${sel} {`)
      assert.notEqual(at, -1, `${sel} has no rule`)
      return code.slice(at, code.indexOf('}', at))
    }
    assert.match(body('button.setup-section-head'), /min-height: 60px/, 'a section heading is under the phone’s row height')
    assert.match(body('.setup-section-hint'), /color: var\(--ok\);[\s\S]*white-space: nowrap/, 'a section’s line is not the rows’ green, on one line')
    assert.match(body(".setup-section[data-open='yes'] .setup-section-chevron"), /transform: rotate\(90deg\)/, 'an open section’s chevron does not turn down')
    assert.match(code, /\nbutton\.setup-head-back,\nbutton\.setup-head-done \{[^}]*min-height: 44px/, 'the way back and Done are under the touch floor')
    assert.match(body('.setup-rows:empty'), /display: none/, 'an empty list draws a bordered line')
    /* The account card and the headings under it are one list of doors, as on the phone: one fill, one size of chevron. */
    assert.equal(body('button.setup-account-card').match(/background: ([^;]+);/)?.[1], body('button.setup-section-head').match(/background: ([^;]+);/)?.[1], 'the account card and the section headings are filled differently')
    assert.equal(body('button.setup-account-card .setup-row-chevron').match(/font-size: ([^;]+);/)?.[1], body('.setup-section-chevron').match(/font-size: ([^;]+);/)?.[1], 'the account card’s chevron is another size from the headings’')
    /* The Feedback page's message box is a box: an edge in a colour that exists, on the field colour, not the sheet's. */
    const box = body('.feedback-text,\n.feedback-contact')
    assert.match(box, /border: 1px solid var\(--rule\);/, 'the message box’s edge is in a colour nobody defines, so it is not drawn')
    assert.match(box, /background: var\(--chassis\);/, 'the message box is the sheet’s own colour')
    /* input[type='text'] outranks a class: the email box needs an element and a class to keep the body face. */
    assert.match(body('input.feedback-contact'), /font-family: var\(--body\);/, 'the email box is in the preset filter’s typewriter face')
    assert.ok(code.indexOf('\ninput.feedback-contact {') > code.indexOf("\ninput[type='text'] {"), 'the email box’s face comes before the rule it has to beat')
    /* And under a thumb the message box keeps the 16px that stops an iPhone zooming on the first tap. */
    assert.match(code, /@media \(pointer: coarse\) \{\s*textarea\.feedback-text \{\s*font-size: var\(--f-input\);/, 'the message box is under 16px on a phone, so the page zooms when it is tapped')
    /* Wherever Settings is a sheet from the bottom (a phone, an iPad held upright), the phone's three buttons; the wide window, where it is the side panel (Sheet's DESK), keeps the small control. */
    assert.match(readFileSync(new URL('../src/components/Sheet.jsx', import.meta.url), 'utf8'), /const DESK = '\(min-width: 1000px\)'/, 'the side panel starts at another width; move the three buttons’ query with it')
    const narrow = [...code.matchAll(/@media not all and \(min-width: 1000px\) \{/g)].map((m) => {
      let i = m.index + m[0].length
      let depth = 1
      const from = i
      while (i < code.length && depth) {
        if (code[i] === '{') depth++
        else if (code[i] === '}') depth--
        i++
      }
      return code.slice(from, i - 1)
    }).find((b) => b.includes('.setup-inline-theme .theme-toggle button'))
    assert.ok(narrow, 'light or dark is the small control on a phone or an upright iPad')
    assert.match(narrow, /\.setup-inline-theme \.theme-toggle \{[^}]*display: flex;[^}]*width: 100%/, 'the three buttons do not run the full width')
    assert.match(narrow, /\.setup-inline-theme \.theme-toggle button \{[^}]*flex: 1 1 0;[^}]*min-height: 44px;[^}]*text-transform: none/, 'the three buttons are not equal, thumb-high, in their own words')
    assert.match(narrow, /\.setup-inline-theme \.theme-toggle button\.current \{[^}]*background: var\(--signal\)/, 'the chosen one is not amber')
  })

  /* ------------------------------------------------------------------ */
  /* Play, made like the phone app's (3 November 2026, pass 3)            */
  /* ------------------------------------------------------------------ */

  test('a scene’s name is spelled as the unit spells it, with the phone’s bar under it, and its measure follows', () => {
    const rule = (sel) => code.slice(code.indexOf(sel + ' {'), code.indexOf('}', code.indexOf(sel + ' {')))
    const named = rule('button.gig-scene.named .gig-scene-name')
    assert.match(named, /font-size: var\(--name-size, var\(--f-4\)\);\s*text-transform: none;/, 'a named scene is in capitals again: "CLEAN DOUBLE" where the unit has "Clean Double"')
    /* No later rule puts the capitals back on a named scene. */
    const after = code.slice(code.indexOf('button.gig-scene.named .gig-scene-name {'))
    for (const m of after.matchAll(/([^{}]*\.gig-scene-name[^{}]*)\{([^}]*)\}/g)) {
      if (/\bnamed\b/.test(m[1]) || !/scene-arrange/.test(m[1])) assert.ok(!/text-transform: uppercase/.test(m[2]), `a later rule puts a scene’s name in capitals: ${m[1].trim()}`)
    }
    /* The bar: the scene's own colour, 3px, half the tile wide; the lettering's colour at 80% on the live one. */
    const bar = rule('.gig-scene-bar')
    assert.match(bar, /background: var\(--scene-fill/, 'the bar is not the scene’s own colour')
    assert.match(bar, /height: 3px/)
    assert.match(bar, /width: 52%/)
    assert.match(code, /button\.gig-scene\.current \.gig-scene-bar \{\s*background: color-mix\(in srgb, var\(--scene-ink, var\(--on-signal\)\) 80%, transparent\);/, 'the live scene’s bar is lost on its own fill')
    /* At the compact size the number pays for the bar, so a long name keeps its two lines in a 56px tile. */
    assert.match(code, /\.gig\[data-compact\] button\.gig-scene\.named \.gig-scene-num \{\s*line-height: 1;/, 'the bar takes a long name’s second line at Smallest')
    /* The measure is the drawing: the letter spacing it measures with is the spacing drawn. */
    const fit = readFileSync(new URL('../src/lib/sceneNameFit.js', import.meta.url), 'utf8')
    const track = Number(fit.match(/const TRACK = ([0-9.]+)/)?.[1])
    const drawn = Number(code.match(/\n\.gig-scene-name \{[^}]*letter-spacing: ([0-9.]+)em/)?.[1])
    assert.ok(track > 0 && track === drawn, `the name is measured at ${track}em of spacing and drawn at ${drawn}em`)
    assert.match(fit, /upper: face\.textTransform === 'uppercase'/, 'the name is measured in capitals whatever the case drawn')
  })

  test('the headings over the scenes and the chain are the phone’s, and Refresh names keeps a thumb’s target in a heading’s height', () => {
    const rule = (sel) => code.slice(code.indexOf(sel + ' {'), code.indexOf('}', code.indexOf(sel + ' {')))
    const word = rule('.gig-head-word')
    assert.match(word, /font-size: var\(--f-1\)/)
    assert.match(word, /text-transform: uppercase/)
    assert.match(word, /color: var\(--silk-faint\)/, 'the heading is not the phone’s faint small capitals')
    assert.match(word, /min-width: 0/, 'the heading pushes the words beside it off the row instead of giving way')
    assert.match(rule('.gig-head-text'), /text-overflow: ellipsis/, 'a heading too long for the row wraps and moves everything under it')
    const action = rule('button.gig-head-action')
    assert.match(action, /min-height: 44px/, 'Refresh names is under the touch floor')
    assert.match(action, /margin: calc\(-1 \* var\(--s-3\)\) calc\(-1 \* var\(--s-2\)\)/, 'Refresh names makes the heading’s row a button tall')
    assert.match(code, /button\.gig-head-action\[data-said='failed'\] \{\s*color: var\(--fault\);/, 'a failed read is not said in the fault colour')
    assert.match(rule('.gig-head-hint'), /white-space: nowrap/, 'Hold to switch channels wraps under the heading')
    assert.match(rule('.gig-head-icon'), /width: 13px/, 'the chain’s picture is not the phone’s 13pt')
  })

  test('on a phone the pedals are the scenes’ height less 12, and still hold their picture and name', () => {
    const rule = (sel) => code.slice(code.indexOf(sel + ' {'), code.indexOf('}', code.indexOf(sel + ' {')))
    const px = (t) => Number(code.match(new RegExp(`--${t}: ([0-9.]+)px`))[1])
    /* From the same variables the scenes take, less the phone's 12 (--s-3), with the phone's floors: 56 at the steps, 44 at Smallest and Fit. */
    const phone = rule('.gig[data-phone] button.gig-block')
    assert.match(phone, /min-height: max\(56px, calc\(var\(--gig-tile, 66px\) - var\(--s-3\)\)\)/, 'a phone’s pedals are sized apart from its scenes')
    assert.equal(px('s-3'), 12, 'the pedals are not the phone app’s 12 shorter')
    assert.match(phone, /padding-top: var\(--s-1\)/)
    assert.match(phone, /padding-bottom: var\(--s-1\)/)
    const compact = rule('.gig[data-phone][data-compact] button.gig-block')
    assert.match(compact, /height: max\(44px, calc\(var\(--gig-fit-tile, 56px\) - var\(--s-3\)\)\)/, 'a phone’s compact pedals are sized apart from its scenes')
    assert.match(compact, /min-height: 0/, 'the phone’s 56px floor can beat the compact pedal’s stated height')
    /* Nothing keyed to a phone sizes a scene: a scene and a block still come from the size control together. */
    for (const m of code.matchAll(/([^{}]*\.gig\[data-phone\][^{}]*)\{([^}]*)\}/g)) {
      assert.ok(!/gig-scene/.test(m[1]), `a phone rule sizes the scenes: ${m[1].trim()}`)
    }
    /* What is inside fits, at both floors: the picture, its gap, the name, the padding and the ring. */
    const nameSize = (r) => px(r.match(/font-size: var\(--(f-\d)\)/)[1])
    const lh = Number(rule('.gig-block-name').match(/line-height: ([0-9.]+);/)[1])
    const gapUnder = Number(rule('.gig-block-icon').match(/margin: 0 auto (\d+)px/)[1])
    const ring = 2 * 2
    const content = (picEm, size, pad) => picEm * size + gapUnder + size * lh + 2 * pad + ring
    const fullPic = Number(rule('.gig-block-icon').match(/height: ([0-9.]+)em/)[1])
    const smallPic = Number(rule('.gig[data-compact] .gig-block-icon').match(/height: ([0-9.]+)em/)[1])
    const atSmall = content(fullPic, nameSize(rule('.gig-block-name')), px('s-1'))
    assert.ok(atSmall <= 56, `a phone’s pedal at Small holds ${atSmall}px of content in 56px`)
    const tight = rule('.gig[data-phone][data-compact][data-fx-tight] .gig-block-name')
    const atFloor = content(smallPic, nameSize(tight), px('s-1'))
    assert.ok(atFloor <= 44, `a phone’s pedal at its 44px floor holds ${atFloor}px of content`)
    /* And Gig's threshold for the smaller name is where the usual name stops fitting. */
    const gig = readFileSync(new URL('../src/components/Gig.jsx', import.meta.url), 'utf8')
    const room = Number(gig.match(/^const PEDAL_NAME_ROOM = (\d+)$/m)?.[1])
    const usual = content(smallPic, nameSize(rule('.gig-block-name')), px('s-1'))
    assert.ok(usual > 44 && usual <= room, `the name goes a size down on pedals that hold it (${usual}px in ${room}px)`)
  })

  test('the bottom buttons are the phone’s order, pictures and words, the website’s height, and the phone’s height is one line away', () => {
    const rule = (sel) => code.slice(code.indexOf(sel + ' {'), code.indexOf('}', code.indexOf(sel + ' {')))
    const btn = rule('button.gig-bar-btn')
    assert.match(btn, /min-height: 44px/, 'the bar buttons are not the website’s short ones')
    assert.ok(!/text-transform: uppercase/.test(btn), 'the bar’s words are capitals again, not the phone’s')
    assert.match(btn, /color: var\(--silk\)/, 'the bar’s words are dim, not the phone’s plain ink')
    assert.match(btn, /font-size: var\(--f-4\)/, 'the bar’s words are not the phone’s body size')
    assert.match(rule('.gig-bar-icon'), /width: 20px/, 'the pictures are not the phone’s 20pt')
    /* "Stop tuner" wraps rather than being cut: with the lit colour the words say the tuner is on. */
    const word = rule('.gig-bar-word')
    assert.ok(!/text-overflow: ellipsis/.test(word), '"Stop tuner" is cut to "Stop tun…" on a phone')
    assert.match(word, /white-space: normal/)
    assert.match(word, /line-height: 1\.1/, 'two lines of "Stop tuner" do not fit the 44px button')
    /* The phone app's taller look, written and waiting behind Gig's BAR_LOOK: 56 high, 48 at Smallest, the tempo under Tap. */
    assert.match(code, /\.gig-bar\[data-look='tall'\] button\.gig-bar-btn \{\s*min-height: 56px;/, 'the phone app’s height is not one line away')
    assert.match(code, /\.gig\[data-compact\] \.gig-bar\[data-look='tall'\] button\.gig-bar-btn \{\s*min-height: 48px;/)
    assert.match(code, /\.gig-bar\[data-look='tall'\] \.gig-tap-bpm \{\s*flex-basis: 100%;/, 'the tall look does not put the tempo under Tap')
    /* Every other height for a bar button is under the tall look: the short one is the one place. */
    for (const m of code.matchAll(/([^{}]*\bgig-bar-btn\b[^{}]*)\{([^}]*)\}/g)) {
      if (!/min-height/.test(m[2])) continue
      const sel = m[1].trim()
      assert.ok(/^button\.gig-bar-btn$/.test(sel) || /data-look='tall'/.test(sel), `another rule sets the bar’s height: ${sel}`)
    }
    /* The base Tap is still one line, which the tall look overrides. */
    assert.ok(code.indexOf("button.gig-tap {") < code.indexOf(".gig-bar[data-look='tall'] button.gig-tap {"), 'the tall Tap is written before the rule it overrides')
  })

  test('a chosen setlist lights the Setlists button solid amber, as on the phone', () => {
    const rule = (sel) => code.slice(code.indexOf(sel + ' {'), code.indexOf('}', code.indexOf(sel + ' {')))
    const on = rule('.gig-nav button.gig-nav-source.on')
    assert.match(on, /background: var\(--signal\)/, 'a chosen setlist is only an amber edge')
    assert.match(on, /border-color: var\(--signal\)/)
    assert.match(on, /color: var\(--on-signal\)/)
    assert.match(code, /\.gig-nav button\.gig-nav-source\.on \.gig-nav-source-kind,\s*\.gig-nav button\.gig-nav-source\.on \.gig-nav-source-pos \{\s*color: var\(--on-signal\);/, 'the words on a lit Setlists button are lost on the amber')
  })

  test('the preset button has the phone’s line over it and under its name, and the demo’s card and the hold tip are the phone’s cards', () => {
    const rule = (sel) => code.slice(code.indexOf(sel + ' {'), code.indexOf('}', code.indexOf(sel + ' {')))
    assert.match(rule('.gig-preset-line'), /letter-spacing: 0\.14em/)
    assert.match(rule('.gig-preset-line'), /text-overflow: ellipsis/, 'a long PRESET line wraps and moves the screen')
    assert.match(rule('.gig-name-chevron'), /width: 20px/, 'the arrow is not the phone’s 20pt')
    const card = rule('.demo-card')
    assert.match(card, /border: 1px solid var\(--signal\)/)
    assert.match(card, /background: var\(--signal-wash\)/, 'the demo’s card is not the phone’s amber wash')
    const unlock = rule('button.demo-card-unlock')
    assert.match(unlock, /background: var\(--signal\)/)
    assert.match(unlock, /color: var\(--on-signal\)/)
    assert.match(rule('button.demo-card-close'), /min-width: 44px/, 'the × is not a thumb’s target')
    const coach = rule('.coach')
    assert.match(coach, /border: 1px solid var\(--rule\)/)
    assert.match(coach, /background: var\(--panel\)/, 'the hold tip is not the phone’s card')
    assert.match(rule('.coach-count'), /color: var\(--signal\)/)
    assert.match(rule('.coach-buttons button'), /min-height: 44px/)
    /* In the page's flow, over nothing: neither takes a touch meant for a tile. */
    for (const sel of ['.demo-card', '.coach']) assert.ok(!/position: (fixed|absolute)/.test(rule(sel)), `${sel} covers the screen`)
    /*
     * Shorter than the phone's column, for the pedals under it: the swatch
     * beside QUICK TIP on a phone, and wider than a phone the buttons to the
     * right of the words. On paper the swatch's amber is darkened to pass
     * 4.5:1 on its own wash (it came to 4.26).
     */
    assert.match(coach, /display: grid/)
    assert.match(rule('.coach-hold'), /grid-column: 2;\s*grid-row: 1;/, 'the swatch takes a row of its own on a phone')
    assert.match(code, /\[data-theme='light'\] \.coach-hold \{\s*color: color-mix\(in srgb, var\(--signal\) 85%, black\);/, 'the swatch is under 4.5:1 on paper')
    assert.match(code, /@media \(min-width: 621px\) \{\s*\.coach \{[^}]*\}[\s\S]*?\.coach > \.coach-buttons \{\s*grid-column: 2;\s*grid-row: 1 \/ span 5;/, 'the buttons take a row of their own on a wide screen')
    /* Under 360 wide the demo's Unlock goes under its words, which no longer wrap to five lines beside it. */
    assert.match(code, /@media \(max-width: 359px\) \{\s*\.demo-card \{\s*display: grid;[\s\S]*?button\.demo-card-unlock \{\s*grid-column: 1 \/ -1;\s*grid-row: 2;/, 'the demo card squeezes its words beside the pill on a narrow phone')
  })
}

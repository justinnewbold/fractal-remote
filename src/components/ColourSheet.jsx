import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import { inkOn, paperEdge } from '../lib/ink'
import { offMode } from '../lib/looks'
import { blockIcon } from '../lib/blockIcons'
import { shortName } from '../lib/shortName'
import { useLooks } from '../lib/useLooks'
import { tick } from '../lib/feedback'
import {
  FREE_PICK_WORDS,
  SCOPE_WORDS,
  backWords,
  colourNow,
  freePick,
  freePickSaid,
  nextToWarning,
  offAmber,
  paint,
  pickIsPicked,
  shadeOf,
  shadeWords,
  shades,
  sheetNote,
  sheetSwatches,
  sheetTitle,
  spokenSwatch,
  yoursFor
} from '../lib/colourPage'

const FOCUSABLE =
  'a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])'

/**
 * A PANEL IN THE MIDDLE OF THE SCREEN, over Settings.
 *
 * The phone's colour sheet comes up from the bottom, where a thumb is. Here it
 * is opened from inside a sheet that is already up — Settings — and a second
 * sheet sliding up over the first is two of the same thing stacked, with two
 * handles, two ways back and two scrims, and the back gesture closing the
 * wrong one. So it is a panel of its own, centred over everything: one thing
 * open, one way out.
 *
 * Its own keys, because it is over a sheet that has keys too. Escape is
 * Cancel here and goes no further — Settings would otherwise hear it as well
 * and go back a page with the panel still open over nothing — and Tab goes
 * round the panel rather than out into the page under it. Bound natively on
 * the panel for the same reason Sheet binds its own on the document: the
 * order the two hear a key in has to be known, not hoped for.
 *
 * Put away, the focus goes back to whatever opened it: the tile somebody
 * clicked is where they were.
 */
export function ColourPanel({ open, title, note, onClose, foot, children }) {
  const box = useRef(null)
  const cameFrom = useRef(null)
  /* The caller writes `onClose={() => …}`, a new function every render; the
     keys are bound once per opening and ask for the latest. See Sheet. */
  const latest = useRef(onClose)
  latest.current = onClose
  const close = useCallback(() => latest.current?.(), [])

  useEffect(() => {
    if (!open) return undefined
    cameFrom.current = document.activeElement
    const panel = box.current
    const key = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        close()
        return
      }
      if (e.key !== 'Tab') return
      e.stopPropagation()
      const all = [...(panel?.querySelectorAll(FOCUSABLE) || [])]
      if (!all.length) return
      const first = all[0]
      const last = all[all.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    panel?.addEventListener('keydown', key)
    /* The chosen swatch, or the safe answer of a question, says it wants the
       focus first; otherwise the first thing there is to press. */
    const id = requestAnimationFrame(() => {
      const first = panel?.querySelector('[data-first]') || panel?.querySelector(FOCUSABLE)
      ;(first || panel)?.focus?.({ preventScroll: true })
    })
    return () => {
      cancelAnimationFrame(id)
      panel?.removeEventListener('keydown', key)
      cameFrom.current?.focus?.({ preventScroll: true })
    }
  }, [open, close])

  if (!open) return null

  return createPortal(
    <div className="colour-layer">
      {/* The dim behind, and a click on it is Cancel. Not a control of its
          own: Escape and Cancel are the ways out for a keyboard. */}
      <div className="colour-scrim" aria-hidden="true" onClick={close} />
      <section className="colour-panel" ref={box} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1}>
        <header className="colour-panel-head">
          <span className="colour-panel-title">{title}</span>
          {note ? <span className="colour-panel-note">{note}</span> : null}
        </header>
        <div className="colour-panel-body">{children}</div>
        {foot ? <div className="colour-panel-foot">{foot}</div> : null}
      </section>
    </div>,
    document.body
  )
}

/**
 * THE COLOUR SHEET: one effect, one scene, or one preset's tag, and the
 * colours it can be — one panel wherever it is opened from (the Colours page,
 * a preset held or right-clicked in the list, the Scenes sheet, a block on
 * Edit), so a colour is chosen the same way everywhere.
 *
 * "A section where a user can edit the colors of the blocks/presets and
 * effects." The phone's sheet, word for word and swatch for swatch — the tile
 * at the top so you can see what you are painting, the swatches under it,
 * Lighter and Darker, and Cancel and Use it at the foot, which stays put
 * however far the grid scrolls. What it offers is lib/colourPage's, shared
 * with the phone, so the two ends cannot hand a player different colours for
 * the same tile.
 *
 * THE KEYBOARD, because this end has one. The arrows move between the
 * swatches and pick as they go, the way a row of radio buttons does; Enter
 * uses the one picked; Escape is Cancel.
 *
 * AND ANY COLOUR AT ALL, which the phone cannot offer without a build: the
 * browser's own colour picker and a box for a colour code. Whatever comes out
 * of them goes through the same rule the grid was built by (colourPage
 * freePick): the hue kept, the lightness moved just far enough for the
 * letters to read, and a line that says so when it had to move. Nothing
 * picked here can make a tile you cannot read.
 *
 * The letters are never picked here: the tile works them out from the colour
 * (lib/ink inkOn).
 *
 * A LINE, NEVER A BLOCK, when the pick is hard to tell from what usually sits
 * next to it — Use it still works. A player may want his amp the same red as
 * his drive; the sheet says what it sees and leaves the choice with him.
 */
export default function ColourSheet({ target, chain = [], icons = true, onClose }) {
  /* A look worn behind it, or a unit answering, changes the first swatch. */
  useLooks()
  /* A scene painted while a preset is loaded: for every preset, or just this one. */
  const [only, setOnly] = useState(() => !!target?.only)
  const [base, setBase] = useState(() => (target ? colourNow(target, { only: !!target.only }) : null))
  const [step, setStep] = useState(0)
  /* "Any colour…": closed, or open with what is typed in its box. */
  const [any, setAny] = useState(null)
  /* The last free pick, made safe — or null while the grid is what was used. */
  const [free, setFree] = useState(null)
  const grid = useRef(null)

  /* Each opening starts from the colour the tile has now. Closing forgets the
     last one, so the next opening never shows it for a frame. */
  useEffect(() => {
    setOnly(!!target?.only)
    setBase(target ? colourNow(target, { only: !!target.only }) : null)
    setStep(0)
    setAny(null)
    setFree(null)
  }, [target])

  const open = !!target && !!base
  /* A scene's rules — no amber — and a preset's tag keeps them too (colourPage offAmber). */
  const scene = offAmber(target)
  const swatches = target ? sheetSwatches(target) : []
  const yours = target ? yoursFor(target, { only }) : null
  const pick = open ? shadeOf(base, step, { scene }) : null
  const steps = open ? shades(base, { scene }) : { darker: [], lighter: [] }
  const warning = open ? nextToWarning(target, pick, { chain, only }) : null
  /* A scene's free pick too near the amber is shown, said, and not used —
     though a step lighter or darker from it may be (shades keeps a scene's
     steps off the amber). */
  const refused = !!(free && free.amber && pick === free.fill)
  /* Drawn as Play will draw it: a colour of his own at full strength in every look (lib/colourPage pickIsPicked). */
  const picked = open ? pickIsPicked(target, pick, { only }) : false

  /* What the pick is called, for the line under the tiles. */
  const named = swatches.find((s) => s.fill === base)
  const baseName = named
    ? named.said
    : free && free.fill === base
      ? 'the colour you picked'
      : yours && base === yours
        ? 'your own colour'
        : 'the colour it has now'
  const backLabel = target ? backWords(target, { only }) : ''

  const use = (fill) => {
    if (free && free.amber && fill === free.fill) return
    paint(target, fill, { only })
    onClose?.()
  }

  /* Every preset, or just this one: the tiles show what each would be. */
  const scope = (to) => {
    setOnly(to)
    setBase(colourNow(target, { only: to }))
    setStep(0)
    setFree(null)
  }

  const choose = (fill) => {
    setBase(fill)
    setStep(0)
    setFree(null)
  }

  /* A colour from the picker or the box: made safe, then worn by the tiles at the top. */
  const takeFree = (text) => {
    const got = freePick(text, { scene, offered: swatches.map((s) => s.fill) })
    if (!got) return false
    setFree(got)
    setBase(got.fill)
    setStep(0)
    return true
  }

  /*
   * The arrows, as a row of radio buttons has them: across one at a time, up
   * and down a whole row, each move picking the one it lands on. How many are
   * in a row is read off the page, because the grid wraps to whatever fits.
   */
  const onGridKey = (e, i) => {
    const items = [...(grid.current?.querySelectorAll('[role="radio"]') || [])]
    if (!items.length) return
    if (e.key === 'Enter') {
      e.preventDefault()
      const s = swatches[i]
      use(s.fill === base ? pick : s.fill)
      return
    }
    const top = items[0].offsetTop
    const across = Math.max(1, items.filter((el) => el.offsetTop === top).length)
    const to = {
      ArrowRight: i + 1,
      ArrowLeft: i - 1,
      ArrowDown: i + across,
      ArrowUp: i - across,
      Home: 0,
      End: items.length - 1
    }[e.key]
    if (to === undefined) return
    e.preventDefault()
    const next = Math.max(0, Math.min(items.length - 1, to))
    choose(swatches[next].fill)
    items[next].focus()
  }

  /* Tab lands on the chosen swatch, or the first: one stop for the whole grid. */
  const at = Math.max(0, swatches.findIndex((s) => s.fill === base))

  return (
    <ColourPanel
      open={open}
      onClose={onClose}
      title={target ? sheetTitle(target) : ''}
      /*
       * WHERE IT APPLIES. A family's colour is the family's, on every unit and
       * in every preset: a drive that is red in one song and green in the next
       * is exactly what these colours exist to stop. A scene's is for every
       * preset, or for the one that is loaded (the choice under the tiles); a
       * preset's tag is that preset's on this unit, like its star. The words
       * are lib/colourPage's, so both ends say the same.
       */
      note={target ? sheetNote(target, { only }) : null}
      foot={
        open ? (
          <>
            {yours ? (
              <button type="button" className="colour-back" onClick={() => use(null)}>
                {backLabel}
              </button>
            ) : null}
            <div className="colour-foot-row">
              <button type="button" onClick={onClose}>
                Cancel
              </button>
              <button type="button" className="primary" disabled={refused} onClick={() => use(pick)}>
                Use it
              </button>
            </div>
          </>
        ) : null
      }
    >
      {open ? (
        <>
          {/*
            THE TILE, LIT AND UNLIT, at the size Play draws it, side by side:
            the colour is chosen for both. Drawn by Play's own classes, so what
            is here is what the stage will show — the switched-off one in grey
            if that is what the page above says. Pictures, not controls: the
            panel's title already says what they are.
          */}
          <div className="gig colour-preview" aria-hidden="true">
            {/* A preset's tag, drawn as its row in the preset list draws it: the bar and the name. */}
            {target.kind === 'preset' ? (
              <span className="colour-tag-preview" style={{ '--tag': pick }}>
                {target.name}
              </span>
            ) : (
              [true, false].map((lit) =>
                target.kind === 'scene' ? (
                  <button
                    key={String(lit)}
                    type="button"
                    tabIndex={-1}
                    className={`gig-scene named${lit ? ' current' : ''}`}
                    style={{ '--scene-fill': pick, '--scene-ink': inkOn(pick) }}
                    data-picked={picked ? 'yes' : undefined}
                  >
                    <span className="gig-scene-num mono">{target.index + 1}</span>
                    {/* The scene's own name where it has one, as Play draws it. */}
                    <span className="gig-scene-name">{target.label || target.name}</span>
                  </button>
                ) : (
                  <button
                    key={String(lit)}
                    type="button"
                    tabIndex={-1}
                    className={`gig-block ${lit ? 'on' : 'off'}`}
                    data-off={!lit && offModeGrey() ? 'grey' : undefined}
                    style={{ '--block-fill': pick, '--block-ink': inkOn(pick) }}
                  >
                    <span className="gig-block-name">
                      {icons && blockIcon(target.slug) ? (
                        <span
                          className="gig-block-icon"
                          style={{ WebkitMaskImage: `url(${blockIcon(target.slug)})`, maskImage: `url(${blockIcon(target.slug)})` }}
                        />
                      ) : null}
                      <span>{shortName(target.slug)}</span>
                    </span>
                    <span className="gig-block-state">
                      <span className="gig-block-word">{lit ? 'On' : 'Off'}</span>
                    </span>
                  </button>
                )
              )
            )}
          </div>
          {/* Why a free pick is not quite what was picked, or why a scene
              cannot have it, is said under the Any colour box rather than
              here: that is where the eye is when it matters. */}
          <p className="colour-said">{shadeWords(capital(baseName), step)}</p>

          {/*
            THE NEIGHBOUR LINE, right under the name of the pick, where the eye
            is when a swatch has just been clicked — it sat under the grid, and
            in a phone-sized window that is below the bottom of the panel.
            Its room is kept when there is nothing to say (two lines, which
            the colour-blind one takes in a narrow window), so the buttons
            under it never jump as a swatch is tried. The phone's, in the same
            place.
          */}
          <p className="colour-warning" aria-live="polite">
            {warning || ''}
          </p>

          {/*
            LIGHTER AND DARKER, three steps each way at most, and only as far
            as the letters still read and an unlit tile still shows on the
            black stage. Where a way has nothing left, its button rests: red
            has no Darker at all. Up here beside the pick they change, not
            under two dozen swatches.
          */}
          <div className="colour-steps">
            <button type="button" aria-label="A step darker" disabled={step <= -steps.darker.length} onClick={() => setStep(step - 1)}>
              Darker
            </button>
            <button type="button" aria-label="A step lighter" disabled={step >= steps.lighter.length} onClick={() => setStep(step + 1)}>
              Lighter
            </button>
          </div>

          {/*
            EVERY PRESET, OR JUST THIS ONE, for a scene painted while a preset
            is loaded: Fractal's own PERFORM layout makes Clean, Crunch and
            Lead green, yellow and red in the one preset that wants them. Above
            the grid, because it changes what the grid is painting — the tiles
            over it change to the colour the scene has in the presets chosen.
            Two buttons, the phone's two, the one in force pressed.
          */}
          {target.kind === 'scene' && target.preset ? (
            <div className="colour-scope" role="group" aria-label="Which presets">
              <button type="button" aria-pressed={!only} className={only ? '' : 'on'} onClick={() => scope(false)}>
                {SCOPE_WORDS.every}
              </button>
              <button type="button" aria-pressed={only} className={only ? 'on' : ''} onClick={() => scope(true)}>
                <span>{SCOPE_WORDS.only}</span> <span className="colour-scope-which">{target.preset.words}</span>
              </button>
            </div>
          ) : null}

          <div
            className="colour-swatches"
            ref={grid}
            role="radiogroup"
            aria-label={sheetTitle(target)}
          >
            {swatches.map((s, i) => {
              const chosen = s.fill === base
              const ink = inkOn(s.fill)
              return (
                <button
                  key={`${i}${s.fill}`}
                  type="button"
                  role="radio"
                  aria-checked={chosen}
                  aria-label={spokenSwatch(target, s, { yours: s.fill === yours && !s.own })}
                  title={s.said || s.name}
                  tabIndex={i === at ? 0 : -1}
                  data-first={i === at ? 'yes' : undefined}
                  className={`colour-swatch${chosen ? ' chosen' : ''}`}
                  /* On paper a pale swatch needs an edge or white is a hole in
                     the panel: the paper edge of lib/ink, as the phone draws it.
                     No apostrophes in here: test/both-ends.mjs reads this tag by hand. */
                  style={{ '--swatch': s.fill, '--swatch-ink': ink, '--swatch-edge': paperEdge(s.fill) }}
                  onClick={() => {
                    tick()
                    choose(s.fill)
                  }}
                  onKeyDown={(e) => onGridKey(e, i)}
                >
                  {chosen ? <span aria-hidden="true">✓</span> : null}
                  {s.own ? <span className="colour-swatch-own">{s.name}</span> : null}
                </button>
              )
            })}
          </div>

          {/*
            ANY COLOUR, behind a button so the grid stays the way in: the grid
            is two dozen colours that already work, and a picker is a few
            million that mostly do not until they are moved.
          */}
          {any === null ? (
            <button type="button" className="chip colour-any-open" onClick={() => setAny(free ? free.raw : base)}>
              Any colour…
            </button>
          ) : (
            <div className="colour-any">
              <label className="colour-any-field">
                <span className="hint">Pick any colour</span>
                <input
                  type="color"
                  value={colourOr(free?.raw || base)}
                  onChange={(e) => {
                    setAny(e.target.value)
                    takeFree(e.target.value)
                  }}
                />
              </label>
              <label className="colour-any-field">
                <span className="hint">Or type its colour code</span>
                <input
                  type="text"
                  inputMode="text"
                  autoComplete="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  maxLength={7}
                  placeholder="#cc0000"
                  value={any}
                  onChange={(e) => {
                    setAny(e.target.value)
                    takeFree(e.target.value)
                  }}
                  onKeyDown={(e) => {
                    if (e.key !== 'Enter') return
                    e.preventDefault()
                    /* Enter is Use it, once there is a colour in the box to use. */
                    if (freePick(any)) use(pick)
                  }}
                />
              </label>
              {/*
                Half a code is not a colour yet: said beside the box, not as a
                fault. And once it is a colour, why it was moved or refused,
                said here, beside the box too. It used to be under the tiles,
                and on a phone-sized window those have scrolled away by the
                time the box is in use: Use it gone grey with no reason in
                sight reads as broken.
              */}
              <p className="colour-any-said" aria-live="polite">
                {String(any || '').trim() && !freePick(any) ? FREE_PICK_WORDS.notYet : movedSaid(free, base)}
              </p>
            </div>
          )}
        </>
      ) : null}
    </ColourPanel>
  )
}

/* Whether a switched-off tile is drawn grey, for the unlit one at the top. */
const offModeGrey = () => offMode() === 'grey'

const capital = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s)

/* The picker only takes six figures; anything else shows it black. */
const colourOr = (c) => (/^#[0-9a-f]{6}$/i.test(String(c || '')) ? String(c).toLowerCase() : '#000000')

/** The line for a free pick being worn: refused for a scene, moved and why, or nothing (colourPage freePickSaid). */
function movedSaid(free, base) {
  if (!free || free.fill !== base) return ''
  return freePickSaid(free)
}

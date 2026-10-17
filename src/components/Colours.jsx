import { useEffect, useState } from 'react'

import { FRACTAL_REMOTE_LOOK, LOOKS } from '../lib/blockPalettes'
import { LIGHT_INK, inkOn } from '../lib/ink'
import { clearYours, lookId, offMode, ownColourCount, resetAll, setLook, setOffMode, yourFamily, yourScene } from '../lib/looks'
import { blockColor } from '../lib/blockColors'
import { sceneColor } from '../lib/sceneColors'
import {
  FAMILY_NAMES,
  UNDO_MS,
  chooseScenes,
  familyTarget,
  lookCard,
  presetFamilies,
  sceneTarget,
  scenesAllRed,
  unitFamilies,
  wearLook
} from '../lib/colourPage'
import { useLooks } from '../lib/useLooks'
import { blockIcon } from '../lib/blockIcons'
import { shortName } from '../lib/shortName'
import { tick } from '../lib/feedback'
import { deviceKind, onThis } from '../../shared/device-word.mjs'
import ColourSheet, { ColourPanel } from './ColourSheet'

/**
 * SETTINGS → COLOURS: the looks, the effects, the scenes, and the way back.
 *
 * "Additionally i want to make a section where a user can edit the colors of
 * the blocks/presets and effects. Let's figure out the best way to implement
 * that as well. Maybe even make some preset themes?"
 *
 * The phone's page, at this end: the same sections in the same order, the
 * same words, and the same choices, because what the page offers is decided
 * once in lib/colourPage and both ends draw from it. Top to bottom, in the
 * order somebody arrives with: a whole look in one click (and Undo for a
 * moment after, because one click repaints the whole app), then one effect at
 * a time, then the scenes, then how a switched-off effect is drawn, and last
 * the button that puts everything back.
 *
 * NOTHING HERE IS ON PLAY. Play's tiles are footswitches — a tap switches and
 * a hold picks a channel — and a colour control among them would be a
 * footswitch that does not switch. So the colours are chosen here, and Play
 * only wears them.
 *
 * Every tile on this page is drawn with Play's own classes (gig-block,
 * gig-scene), so a card or a choice shows exactly what the stage will draw.
 * Where a tile is only a picture of one, it is a button nobody can press or
 * reach — hidden from a screen reader, out of the tab order, and under the
 * card's own control — because a picture of Play has to be built out of
 * Play's parts or it stops being one the first time the stylesheet changes.
 *
 * Kept in this browser, as everything here is (lib/looks, localStorage): the
 * phone app keeps its own.
 */
export default function Colours({ blocks = [], sceneNames = [], preset, icons = true }) {
  /* Repaint on any change to the colours, from here or from the unit answering. */
  useLooks()
  const wearing = lookId()
  const chain = presetFamilies(blocks)
  const [painting, setPainting] = useState(null)
  const [more, setMore] = useState(false)
  /* 'all' for Put every colour back, 'yours' for Clear them: both cost something, so both ask. */
  const [asking, setAsking] = useState(null)
  /* "Now: Sunlight · Undo", and what Undo puts back. Belongs to this page: leaving it takes the offer with it. */
  const [undo, setUndo] = useState(null)
  const own = ownColourCount()

  const wear = (id) => {
    const done = wearLook(id)
    if (done && done.was !== done.now) setUndo({ ...done, at: Date.now() })
  }

  const rest = unitFamilies().filter((f) => !chain.includes(f))
  const effectTile = (f) => {
    const hue = blockColor(f)
    const icon = icons ? blockIcon(f) : null
    return (
      <div className="gig-block-cell" key={f}>
        <button
          type="button"
          className="gig-block on"
          style={{ '--block-fill': hue.fill, '--block-ink': hue.ink }}
          onClick={() => setPainting(familyTarget(f))}
        >
          <span className="gig-block-name">
            {icon ? (
              <span className="gig-block-icon" aria-hidden="true" style={{ WebkitMaskImage: `url(${icon})`, maskImage: `url(${icon})` }} />
            ) : null}
            <span>{FAMILY_NAMES[f] || f}</span>
          </span>
          {/* "A small dot in a corner marks a colour you chose." Words rather
              than a dot, so it says what it means and a screen reader says it
              too — the phone's words. */}
          {yourFamily(f) ? <span className="colours-yours">Your colour</span> : null}
        </button>
      </div>
    )
  }

  /* Where your colours live, said by what this end is (shared/device-word.mjs). */
  const kept =
    deviceKind() === 'computer'
      ? 'Your colours are kept on this computer. A phone or tablet keeps its own.'
      : `Your colours are kept ${onThis()}. The computer’s screen keeps its own.`

  return (
    <div className="colours">
      {/* ------------------------------------------------------------ looks */}
      <section className="colours-section" aria-labelledby="colours-looks">
        <h3 className="silk-label setup-open-title" id="colours-looks">
          Looks
        </h3>
        <p className="hint">One tap puts a whole look on every tile. Your own colours stay on top of it.</p>
        <div className="colours-looks" role="radiogroup" aria-labelledby="colours-looks">
          {LOOKS.map((look) => (
            <LookCard key={look.id} look={look} on={look.id === wearing} onWear={() => wear(look.id)} />
          ))}
        </div>
        {own ? (
          <div className="colours-own">
            <span>{own === 1 ? '1 of your own colours on top' : `${own} of your own colours on top`}</span>
            <button type="button" className="chip" onClick={() => setAsking('yours')}>
              Clear them
            </button>
          </div>
        ) : null}
      </section>

      {/* ---------------------------------------------------------- effects */}
      <section className="colours-section" aria-labelledby="colours-effects">
        <h3 className="silk-label setup-open-title" id="colours-effects">
          Effects
        </h3>
        <p className="hint">Tap one to give it a colour of your own. It is used in every preset.</p>
        {chain.length ? (
          <>
            <p className="colours-sub">In this preset</p>
            <div className="gig colours-effects">{chain.map(effectTile)}</div>
            {rest.length ? (
              <button type="button" className="chip colours-more" aria-expanded={more} onClick={() => setMore(!more)}>
                {more ? 'Fewer effects' : 'More effects'}
              </button>
            ) : null}
          </>
        ) : null}
        {/* With no preset read there is nothing to put first, so the unit's whole list is shown. */}
        {rest.length && (more || !chain.length) ? <div className="gig colours-effects">{rest.map(effectTile)}</div> : null}
      </section>

      {/* ----------------------------------------------------------- scenes */}
      <section className="colours-section" aria-labelledby="colours-scenes">
        <h3 className="silk-label setup-open-title" id="colours-scenes">
          Scenes
        </h3>
        {/*
          ALL RED IS THE UNIT. Every Scene switch on an FM3, FM9 or Axe-Fx III
          lights red, and an AM4 lights all four bars red in Scene mode: the
          number and the name say which. A colour each is the app's own idea,
          and some players find a scene faster by it. One write either way
          (colourPage chooseScenes).
        */}
        <div className="colours-choices" role="radiogroup" aria-labelledby="colours-scenes">
          <label className="rename-choice">
            <input type="radio" name="colours-scenes" checked={scenesAllRed()} onChange={() => chooseScenes(false)} />
            <span>All red, like the unit</span>
          </label>
          <label className="rename-choice">
            <input type="radio" name="colours-scenes" checked={!scenesAllRed()} onChange={() => chooseScenes(true)} />
            <span>A colour for each scene</span>
          </label>
        </div>
        {/* Lit, all eight, so each one's colour can be seen: on Play only the live one is. */}
        <div className="gig colours-scenes">
          {Array.from({ length: 8 }, (_, i) => {
            const hue = sceneColor(i)
            return (
              <button
                key={i}
                type="button"
                className="gig-scene current named"
                style={{ '--scene-fill': hue.fill, '--scene-ink': hue.ink }}
                aria-label={`Scene ${i + 1}${sceneNames?.[i] ? ` — ${sceneNames[i]}` : ''}${yourScene(i) ? ', your colour' : ''}`}
                onClick={() => setPainting(sceneTarget(i, { preset }))}
              >
                <span className="gig-scene-num mono">{yourScene(i) ? `${i + 1} · yours` : String(i + 1)}</span>
                <span className="gig-scene-name">{sceneNames?.[i] || `Scene ${i + 1}`}</span>
              </button>
            )
          })}
        </div>
        <p className="hint">Tap a scene to give it a colour, in every preset or just the one that is loaded.</p>
      </section>

      {/* ---------------------------------------------------- switched off */}
      <section className="colours-section" aria-labelledby="colours-off">
        <h3 className="silk-label setup-open-title" id="colours-off">
          Switched-off effects
        </h3>
        <div className="colours-choices" role="radiogroup" aria-labelledby="colours-off">
          <OffChoice
            mode="colour"
            label="Keep their colour"
            sub="A pale tile with an edge in the effect’s own colour, so you still know which it is."
          />
          <OffChoice mode="grey" label="Grey when off" sub="A dark tile with a grey edge, the way the unit draws an effect that is off." />
        </div>
      </section>

      {/* -------------------------------------------------------- put back */}
      <section className="colours-section">
        <button type="button" className="colours-putback" onClick={() => setAsking('all')}>
          <span>Put every colour back</span>
          <span className="hint">Match my unit, the unit’s colours, and switched-off effects in their own colour</span>
        </button>
        <p className="hint">{kept}</p>
      </section>

      {undo ? <LookUndo offer={undo} onUndo={() => setLook(undo.was)} onGone={() => setUndo(null)} /> : null}

      <ColourSheet target={painting} chain={chain} icons={icons} onClose={() => setPainting(null)} />

      {/*
        THE CONFIRM, with its two big buttons at the foot. Putting colours back
        cannot be undone, so it is never one click from the page — and Keep
        mine is where the focus lands, so a stray Enter keeps them.
      */}
      <ColourPanel
        open={!!asking}
        onClose={() => setAsking(null)}
        title={asking === 'yours' ? 'Clear your own colours?' : 'Put every colour back?'}
        foot={
          <div className="colour-foot-row">
            <button type="button" data-first="yes" onClick={() => setAsking(null)}>
              Keep mine
            </button>
            <button
              type="button"
              className="primary"
              onClick={() => {
                if (asking === 'yours') clearYours()
                else resetAll()
                setAsking(null)
              }}
            >
              Put back
            </button>
          </div>
        }
      >
        <p className="colours-ask">
          {asking === 'yours'
            ? 'Every effect and scene you gave a colour of your own goes back to the colours of the look you are wearing. The look stays.'
            : 'Back to Match my unit: every effect in your unit’s own colours, every scene red, and switched-off effects in their own colour. Every colour you chose goes.'}
        </p>
      </ColourPanel>
    </div>
  )
}

/**
 * One look: its name, why somebody would wear it, and five of its tiles —
 * Drive, Amp, Delay, Reverb and scene 1 — drawn with Play's own classes in
 * the look's colours on this unit, yours left off, because the card is there
 * to show the look.
 *
 * The whole card is the choice: a radio button whose label is stretched over
 * the card (styles.css .colours-look-pick), so a click anywhere on it lands
 * on the radio, and the arrow keys move between the six the way they move
 * between any radio buttons. The tiles sit beside the label rather than in
 * it — a button inside a label is not allowed — and take no clicks.
 *
 * Fractal Remote keeps the white letters it always had (lib/blockColors).
 */
function LookCard({ look, on, onWear }) {
  const tiles = lookCard(look.id)
  const ink = (fill) => (look.id === FRACTAL_REMOTE_LOOK ? LIGHT_INK : inkOn(fill))
  return (
    <div className="colours-look" data-on={on ? 'yes' : undefined} data-look-card={look.id}>
      <label className="colours-look-pick">
        <input
          type="radio"
          name="colours-look"
          className="colours-radio"
          checked={on}
          onChange={() => {
            tick()
            onWear()
          }}
        />
        <span className="colours-look-head">
          <span className="colours-look-name">{look.name}</span>
          {on ? <span className="colours-look-on">✓ Wearing</span> : null}
        </span>
        <span className="colours-look-why">{look.why}</span>
      </label>
      <span className="gig colours-look-tiles" aria-hidden="true">
        {tiles.map((t) =>
          t.slug ? (
            <button key={t.slug} type="button" tabIndex={-1} className="gig-block on" style={{ '--block-fill': t.fill, '--block-ink': ink(t.fill) }}>
              <span className="gig-block-name">{shortName(t.slug)}</span>
            </button>
          ) : (
            <button key="scene" type="button" tabIndex={-1} className="gig-scene current" style={{ '--scene-fill': t.fill, '--scene-ink': ink(t.fill) }}>
              <span className="gig-scene-num mono">1</span>
            </button>
          )
        )}
      </span>
    </div>
  )
}

/**
 * One of the two ways a switched-off effect is drawn, with an unlit drive in
 * that way beside the words — Play's own tile, so it is the real thing.
 */
function OffChoice({ mode, label, sub }) {
  const on = offMode() === mode
  const hue = blockColor('drive')
  return (
    <div className="colours-off" data-on={on ? 'yes' : undefined}>
      <span className="gig colours-off-tile" aria-hidden="true">
        <button
          type="button"
          tabIndex={-1}
          className="gig-block off"
          data-off={mode === 'grey' ? 'grey' : undefined}
          style={{ '--block-fill': hue.fill, '--block-ink': hue.ink }}
        >
          <span className="gig-block-name">{shortName('drive')}</span>
          <span className="gig-block-state">
            <span className="gig-block-word">Off</span>
          </span>
        </button>
      </span>
      <label className="rename-choice colours-off-pick">
        <input
          type="radio"
          name="colours-off"
          checked={on}
          onChange={() => {
            tick()
            setOffMode(mode)
          }}
        />
        <span>
          {label}
          <span className="hint">{sub}</span>
        </span>
      </label>
    </div>
  )
}

/**
 * "Now: Sunlight · Undo", for UNDO_MS after a look goes on, and Undo puts the
 * last one back on. One click repaints every tile in the app, so a click that
 * landed on the wrong card is one more click from being as it was.
 *
 * At the foot of the page and held there as it scrolls (styles.css
 * .colours-undo), below everything else, so its arriving moves nothing that
 * was under the pointer. And it waits while the pointer or the keyboard is
 * on it: an offer that goes while somebody is reaching for it has not been
 * made. The phone keeps it up for a screen reader the same way.
 */
function LookUndo({ offer, onUndo, onGone }) {
  const [held, setHeld] = useState(false)
  const [from, setFrom] = useState(offer.at)
  /* A new look worn while the last offer was up starts the clock again. */
  useEffect(() => setFrom(offer.at), [offer])
  useEffect(() => {
    if (held) return undefined
    const id = setTimeout(onGone, Math.max(0, from + UNDO_MS - Date.now()))
    return () => clearTimeout(id)
  }, [held, from, onGone])
  const now = LOOKS.find((l) => l.id === offer.now)?.name
  if (!now) return null
  /* Let go of, it gives the whole time again rather than vanishing under the pointer as it leaves. */
  const release = () => {
    setHeld(false)
    setFrom(Date.now())
  }
  return (
    <div
      className="colours-undo"
      role="status"
      onPointerEnter={() => setHeld(true)}
      onPointerLeave={release}
      onFocus={() => setHeld(true)}
      onBlur={release}
    >
      <span>{`Now: ${now}`}</span>
      <button
        type="button"
        onClick={() => {
          onUndo()
          onGone()
        }}
      >
        Undo
      </button>
    </div>
  )
}

import { useEffect, useState } from 'react'
import { Pressable, Text, View } from 'react-native'

import { color, font, isDark, radius, space, TAP } from '../lib/theme'
import { inkOn, paperEdge } from '../lib/ink'
import {
  SCOPE_WORDS,
  backWords,
  colourNow,
  nextToWarning,
  offAmber,
  paint,
  pickIsPicked,
  shadeOf,
  shadeWords,
  shades,
  sheetNote,
  sheetSwatches,
  spokenSwatch,
  yoursFor
} from '../lib/colourPage'
import { shortName } from '../lib/shortName'
import { blockIcon } from '../lib/blockIcons'
import { loadIcons } from '../lib/gigSize'
import { sync } from '../lib/store'
import { tick } from '../lib/feedback'
import Press from './Press'
import Sheet from './Sheet'
import Tile from './Tile'
import { TagPreview } from './PresetTag'

/**
 * THE COLOUR SHEET: one effect, one scene, or one preset's tag, and the
 * colours it can be.
 *
 * "A section where a user can edit the colors of the blocks/presets and
 * effects." A bottom sheet, because it is where a thumb is — the tile at the
 * top so you can see what you are painting, the swatches under it, and
 * Cancel and Use it in the sheet's foot, which stays at the bottom however
 * far the grid scrolls.
 *
 * One sheet wherever it is opened from — the Colours page, a preset's row,
 * the scene names and the block on Edit — so a colour is chosen the same way
 * everywhere, by the same rules (lib/colourPage).
 *
 * WHY A GRID AND NOT A COLOUR WHEEL. A wheel would need a package with
 * native code, which moves the fingerprint and costs a build for the sake of
 * a page somebody opens twice. And a wheel offers every colour, most of which
 * make a tile you cannot read on a dark stage. These are the ones that can be
 * read (lib/colourPage sheetSwatches: the look's own colour, Fractal's
 * eleven footswitch ring colours, twelve of the units' own), and Lighter and
 * Darker go three steps each way from any of them without leaving the
 * colours whose letters read.
 *
 * The letters are never picked here: the tile works them out from the colour
 * (lib/ink inkOn), so nothing chosen on this sheet can make one unreadable.
 *
 * A LINE, NEVER A BLOCK, when the pick is hard to tell from what usually sits
 * next to it — Use it still works. A player may want his amp the same red as
 * his drive; the sheet says what it sees and leaves the choice with him.
 */
export default function ColourSheet({ target, chain = [], onClose }) {
  const [base, setBase] = useState(null)
  const [step, setStep] = useState(0)
  const [grid, setGrid] = useState(0)
  /* A scene painted while a preset is loaded: for every preset, or just this one. */
  const [only, setOnly] = useState(false)
  /* Each opening starts from the colour the tile has now, in the presets the
     opener asked for. Closing forgets the last one, so the next opening never
     shows it for a frame. */
  useEffect(() => {
    setOnly(!!target?.only)
    setBase(target ? colourNow(target, { only: !!target.only }) : null)
    setStep(0)
  }, [target])

  const open = !!target && !!base
  /* A scene's rules — no amber — and a preset's tag keeps them too (colourPage offAmber). */
  const scene = offAmber(target)
  const swatches = target ? sheetSwatches(target) : []
  const yours = target ? yoursFor(target, { only }) : null
  const pick = open ? shadeOf(base, step, { scene }) : null
  const steps = open ? shades(base, { scene }) : { darker: [], lighter: [] }
  const warning = open ? nextToWarning(target, pick, { chain, only }) : null
  /* Drawn as Play will draw it: a colour of his own as he picked it, the look's own as the look draws it (Tile `picked`). */
  const picked = open ? pickIsPicked(target, pick, { only }) : false

  /* What the pick is called, for the line under the tiles and for a screen reader. */
  const named = swatches.find((s) => s.fill === base)
  const baseName = named ? named.said : yours && base === yours ? 'your own colour' : 'the colour it has now'
  const backLabel = target ? backWords(target, { only }) : ''

  /* Every preset, or just this one: the tiles show what each would be. */
  const scope = (to) => {
    setOnly(to)
    setBase(colourNow(target, { only: to }))
    setStep(0)
  }

  /*
   * As many 56-point squares across as fit, never fewer than four or more
   * than six — "everything you press is at least 56pt" (Press) holds for a
   * swatch too, and on a phone six of them do not fit across with a gap
   * between, where on a tablet they do.
   */
  const gap = space.sm
  const cols = Math.max(4, Math.min(6, Math.floor((grid + gap) / (TAP + gap)) || 4))
  const side = grid ? Math.max(TAP, Math.floor((grid - gap * (cols - 1)) / cols)) : TAP

  const use = (fill) => {
    paint(target, fill, { only }, sync)
    onClose?.()
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={target ? `${target.name} colour` : ''}
      /*
       * WHERE IT APPLIES. A family's colour is the family's, on every unit and
       * in every preset: a drive that is red in one song and green in the next
       * is exactly what these colours exist to stop. A scene's is for every
       * preset, or for the one that is loaded (the choice under the tiles); a
       * preset's tag is that preset's on this unit, like its star.
       */
      note={target ? sheetNote(target, { only }) : null}
      foot={
        open ? (
          <>
            {yours ? <Press label={backLabel} onPress={() => use(null)} /> : null}
            <View style={{ flexDirection: 'row', gap: space.sm }}>
              <Press label="Cancel" grow onPress={onClose} />
              <Press label="Use it" grow tone="signal" on onPress={() => use(pick)} />
            </View>
          </>
        ) : null
      }
    >
      {open ? (
        <>
          {/*
            THE TILE, LIT AND UNLIT, at the size Play draws it, side by side:
            the colour is chosen for both. Drawn by Play's own Tile, so what is
            here is what the stage will show — the switched-off one in grey if
            that is what Settings says. Silent and untouchable: the sheet's
            title already says what it is. A preset's tag is drawn as its row
            in the list is, bar and all.
          */}
          <View
            pointerEvents="none"
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={{ flexDirection: 'row', gap: space.sm }}
          >
            {target.kind === 'preset' ? (
              <TagPreview words={target.name} fill={pick} />
            ) : (
              [true, false].map((lit) =>
                target.kind === 'scene' ? (
                  <Tile
                    key={String(lit)}
                    caption={String(target.index + 1)}
                    /* The scene's own name where it has one, as Play draws it. */
                    label={target.label || target.name}
                    bar
                    ring
                    wrap
                    fill={pick}
                    picked={picked}
                    on={lit}
                    haptic={null}
                    style={{ flex: 1 }}
                  />
                ) : (
                  <Tile
                    key={String(lit)}
                    label={shortName(target.slug)}
                    icon={loadIcons(sync) ? blockIcon(target.slug) : undefined}
                    topLeft={lit ? 'On' : 'Off'}
                    effect
                    fill={pick}
                    picked={picked}
                    on={lit}
                    haptic={null}
                    style={{ flex: 1 }}
                  />
                )
              )
            )}
          </View>
          <Text style={{ color: color.silkDim, fontSize: font.small }}>{shadeWords(capital(baseName), step)}</Text>

          {/*
            THE NEIGHBOUR LINE, right under the name of the pick, where the eye
            is when a swatch has just been tapped. It sat under the grid and
            under Lighter and Darker, which on a phone up to an iPhone 15 is
            below the bottom of the sheet: Red tapped for the amp, "Hard to
            tell from Drive next to it" said where nobody could see it. Its
            room is kept when there is nothing to say — two lines, because the
            colour-blind one takes two on any phone — so the buttons under it
            never jump as a swatch is tried.
          */}
          <Text
            accessibilityLiveRegion="polite"
            style={{ color: color.signal, fontSize: font.small, minHeight: 40, lineHeight: 20 }}
          >
            {warning || ''}
          </Text>

          {/*
            LIGHTER AND DARKER, three steps each way at most, and only as far
            as the letters still read and an unlit tile still shows on the
            black stage. Where a way has nothing left, its button rests: red
            has no Darker at all. Up here beside the pick they change, rather
            than under two dozen swatches where somebody who never scrolls the
            sheet would never find them.
          */}
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <Press
              label="Darker"
              grow
              accessibilityLabel="A step darker"
              disabled={step <= -steps.darker.length}
              onPress={() => setStep(step - 1)}
            />
            <Press
              label="Lighter"
              grow
              accessibilityLabel="A step lighter"
              disabled={step >= steps.lighter.length}
              onPress={() => setStep(step + 1)}
            />
          </View>

          {/*
            EVERY PRESET, OR JUST THIS ONE, for a scene painted while a preset
            is loaded: Fractal's own PERFORM layout makes Clean, Crunch and
            Lead green, yellow and red in the one preset that wants them. Above
            the grid, because it changes what the grid is painting — the tiles
            over it change to the colour the scene has in the presets chosen.
          */}
          {target.kind === 'scene' && target.preset ? (
            <View accessibilityRole="radiogroup" accessibilityLabel="Which presets" style={{ flexDirection: 'row', gap: space.sm }}>
              <Press label={SCOPE_WORDS.every} grow tone="signal" on={!only} onPress={() => scope(false)} />
              <Press label={SCOPE_WORDS.only} sub={target.preset.words} grow tone="signal" on={only} onPress={() => scope(true)} />
            </View>
          ) : null}

          <View
            onLayout={(e) => setGrid(e.nativeEvent.layout.width)}
            accessibilityRole="radiogroup"
            style={{ flexDirection: 'row', flexWrap: 'wrap', gap }}
          >
            {swatches.map((s, i) => {
              const chosen = s.fill === base
              const ink = inkOn(s.fill)
              return (
                <Pressable
                  key={`${i}${s.fill}`}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: chosen }}
                  accessibilityLabel={spokenSwatch(target, s, { yours: s.fill === yours && !s.own })}
                  onPress={() => {
                    tick()
                    setBase(s.fill)
                    setStep(0)
                  }}
                  style={({ pressed }) => ({
                    width: side,
                    height: side,
                    borderRadius: radius.md,
                    backgroundColor: s.fill,
                    /* The chosen one is ringed in amber, the app's own mark
                       for "this one". On paper a pale swatch needs an edge or
                       white is a hole in the sheet. */
                    borderWidth: chosen ? 3 : 1,
                    borderColor: chosen ? color.signal : isDark() ? s.fill : paperEdge(s.fill),
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: pressed ? 0.7 : 1
                  })}
                >
                  {chosen ? <Text style={{ color: ink, fontSize: font.lead, fontWeight: '700' }}>✓</Text> : null}
                  {s.own ? <Text style={{ color: ink, fontSize: font.micro, fontWeight: '700' }}>{s.name}</Text> : null}
                </Pressable>
              )
            })}
          </View>
        </>
      ) : null}
    </Sheet>
  )
}

const capital = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s)

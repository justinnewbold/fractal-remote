import { useEffect, useState } from 'react'
import { Pressable, Text, View } from 'react-native'

import { color, font, isDark, radius, space, TAP } from '../lib/theme'
import { inkOn, paperEdge } from '../lib/ink'
import { lookById } from '../lib/blockPalettes'
import { lookId } from '../lib/looks'
import { colourNow, nextToWarning, paint, shadeOf, shadeWords, shades, sheetSwatches, spokenSwatch, yoursFor } from '../lib/colourPage'
import { shortName } from '../lib/shortName'
import { blockIcon } from '../lib/blockIcons'
import { loadIcons } from '../lib/gigSize'
import { sync } from '../lib/store'
import { tick } from '../lib/feedback'
import Press from './Press'
import Sheet from './Sheet'
import Tile from './Tile'

/**
 * THE COLOUR SHEET: one effect, or one scene, and the colours it can be.
 *
 * "A section where a user can edit the colors of the blocks/presets and
 * effects." A bottom sheet, because it is where a thumb is — the tile at the
 * top so you can see what you are painting, the swatches under it, and
 * Cancel and Use it in the sheet's foot, which stays at the bottom however
 * far the grid scrolls.
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
  /* Each opening starts from the colour the tile has now. Closing forgets the
     last one, so the next opening never shows it for a frame. */
  useEffect(() => {
    setBase(target ? colourNow(target) : null)
    setStep(0)
  }, [target])

  const open = !!target && !!base
  const scene = target?.kind === 'scene'
  const swatches = target ? sheetSwatches(target) : []
  const yours = target ? yoursFor(target) : null
  const pick = open ? shadeOf(base, step, { scene }) : null
  const steps = open ? shades(base, { scene }) : { darker: [], lighter: [] }
  const warning = open ? nextToWarning(target, pick, { chain }) : null

  /* What the pick is called, for the line under the tiles and for a screen reader. */
  const named = swatches.find((s) => s.fill === base)
  const baseName = named ? named.said : yours && base === yours ? 'your own colour' : 'the colour it has now'
  const look = lookById(lookId())
  const backLabel = look.id === 'unit' ? 'Back to the unit’s colour' : `Back to ${look.name}’s colour`

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
    paint(target, fill, {}, sync)
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
       * preset — and this is where "Just this preset" goes, the day the Play
       * screen draws one preset's own scene colours (lib/colourPage paint
       * already takes a preset).
       */
      note={scene ? 'For this scene in every preset' : 'For every one of these, in every preset'}
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
            title already says what it is.
          */}
          <View
            pointerEvents="none"
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={{ flexDirection: 'row', gap: space.sm }}
          >
            {[true, false].map((lit) =>
              scene ? (
                <Tile
                  key={String(lit)}
                  caption={String(target.index + 1)}
                  label={target.name}
                  bar
                  ring
                  wrap
                  fill={pick}
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
                  on={lit}
                  haptic={null}
                  style={{ flex: 1 }}
                />
              )
            )}
          </View>
          <Text style={{ color: color.silkDim, fontSize: font.small }}>{shadeWords(capital(baseName), step)}</Text>

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

          {/*
            LIGHTER AND DARKER, three steps each way at most, and only as far
            as the letters still read and an unlit tile still shows on the
            black stage. Where a way has nothing left, its button rests: red
            has no Darker at all.
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

          {/* The neighbour line. Its room is kept when there is nothing to
              say, so the buttons under it never jump as a swatch is tried. */}
          <Text
            accessibilityLiveRegion="polite"
            style={{ color: color.signal, fontSize: font.small, minHeight: 20, lineHeight: 20 }}
          >
            {warning || ''}
          </Text>
        </>
      ) : null}
    </Sheet>
  )
}

const capital = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s)

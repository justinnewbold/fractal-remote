import { useEffect, useState, useSyncExternalStore } from 'react'
import { Pressable, Text, View } from 'react-native'

import { color, font, radius, space, TAP } from '../lib/theme'
import { LOOKS } from '../lib/blockPalettes'
import { clearYours, lookId, looksVersion, offMode, ownColourCount, resetAll, setLook, setOffMode, watchLooks, yourFamily, yourScene } from '../lib/looks'
import { blockColor } from '../lib/blockColors'
import { sceneColor } from '../lib/sceneColors'
import {
  FAMILY_NAMES,
  PUT_BACK_WORDS,
  UNDO_MS,
  chooseScenes,
  familyTarget,
  lookCard,
  lookWhy,
  OFF_WORDS,
  pageSceneCount,
  presetFamilies,
  sceneTarget,
  scenesAllRed,
  unitFamilies,
  wearLook
} from '../lib/colourPage'
import { blockIcon } from '../lib/blockIcons'
import { loadIcons } from '../lib/gigSize'
import { shortName } from '../lib/shortName'
import { useRig } from '../lib/rig'
import { presetLabel, slotLabel } from '../lib/device'
import { sync } from '../lib/store'
import { tick } from '../lib/feedback'
import { deviceNoun } from '../lib/device-word'
import ColourSheet from './ColourSheet'
import Note from './Note'
import Press from './Press'
import Sheet from './Sheet'
import Tile from './Tile'
import { useStillNews } from './Toast'

/**
 * SETTINGS → COLOURS: the looks, the effects, the scenes, and the way back.
 *
 * "Additionally i want to make a section where a user can edit the colors of
 * the blocks/presets and effects. Let's figure out the best way to implement
 * that as well. Maybe even make some preset themes?"
 *
 * Top to bottom, in the order somebody arrives with: a whole look in one tap
 * (and Undo for a moment after, because one tap repaints the whole app), then
 * one effect at a time, then the scenes, then how a switched-off effect is
 * drawn, and last the button that puts everything back.
 *
 * NOTHING HERE IS ON PLAY. Play's tiles are footswitches — a tap switches and
 * a hold picks a channel — and a colour control among them would be a
 * footswitch that does not switch. So the colours are chosen here, and Play
 * only wears them.
 *
 * Every tile on this page is Play's own Tile, so a card or a swatch shows
 * exactly what the stage will draw: the Fractal Remote card lifted the way
 * the phone has always lifted those colours, a switched-off effect grey if
 * that is the choice.
 */
export default function Colours() {
  /* Repaint on any change to the colours, from here or from the unit answering. */
  useSyncExternalStore(watchLooks, looksVersion, looksVersion)
  const blocks = useRig((s) => s.allBlocks)
  const sceneNames = useRig((s) => s.sceneNames)
  const preset = useRig((s) => s.preset)
  const addressing = useRig((s) => s.capabilities?.presets?.addressing)
  /* As many scene tiles as the unit has scenes, as Play draws: an AM4 has four. */
  const sceneCount = useRig((s) => pageSceneCount(s.capabilities))
  /* The preset that is loaded, so a scene can be painted for just this one: "012 Lead Rig". */
  const here = Number.isInteger(preset?.number)
    ? { number: preset.number, words: `${slotLabel(preset.number, addressing)} ${presetLabel(preset)}` }
    : undefined
  const wearing = lookId()
  const chain = presetFamilies(blocks)
  const [painting, setPainting] = useState(null)
  const [more, setMore] = useState(false)
  /* 'all' for Put every colour back, 'yours' for Clear them: both cost something, so both ask. */
  const [asking, setAsking] = useState(null)
  const [wide, setWide] = useState(0)
  const icons = loadIcons(sync)
  /* Of the scenes, only the ones this unit has: the page shows four on an AM4, and so does the count. */
  const own = ownColourCount({ scenes: sceneCount })
  const allRed = scenesAllRed(sceneCount)

  /* Undo belongs to this page: leaving it takes the offer with it. */
  useEffect(() => () => offerUndo(null), [])

  const wear = (id) => {
    const done = wearLook(id, sync)
    if (done && done.was !== done.now) offerUndo({ ...done, at: Date.now() })
  }

  /* Two across at TAP height, and four across for the scenes, as Play lays them out. */
  const half = wide ? Math.floor((wide - space.sm) / 2) : undefined
  const quarter = wide ? Math.floor((wide - space.sm * 3) / 4) : undefined
  /*
   * But two across on the narrowest phones, as Play draws its scenes there:
   * at 320 wide a quarter is 66pt, and "IIC+ Hot Lead" came out "IIC+ Hot ..".
   * "Scene names cut short" was the tester's complaint once already. From 72pt
   * a quarter holds the AM4's and FM3's own names whole.
   */
  const sceneWidth = quarter !== undefined && quarter < 72 ? half : quarter
  const rest = unitFamilies().filter((f) => !chain.includes(f))
  const effectTile = (f) => {
    const hue = blockColor(f)
    return (
      <Tile
        key={f}
        label={FAMILY_NAMES[f] || f}
        /* "A small dot in a corner marks a colour you chose." Words rather than a
           dot, so it says what it means and a screen reader says it too. */
        sub={yourFamily(f) ? 'Your colour' : undefined}
        icon={icons ? blockIcon(f) : undefined}
        fill={hue.fill}
        ink={hue.ink}
        picked={hue.picked}
        on
        height={TAP}
        onPress={() => setPainting(familyTarget(f))}
        style={{ width: half }}
      />
    )
  }

  return (
    <View style={{ gap: space.xl }} onLayout={(e) => setWide(e.nativeEvent.layout.width)}>
      {/* ------------------------------------------------------------ looks */}
      <View style={{ gap: space.md }}>
        <Heading>Looks</Heading>
        <Note>One tap puts a whole look on every tile. Your own colours stay on top of it.</Note>
        <View accessibilityRole="radiogroup" style={{ gap: space.sm }}>
          {LOOKS.map((look) => (
            <LookCard key={look.id} look={look} on={look.id === wearing} onPress={() => wear(look.id)} />
          ))}
        </View>
        {own ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
            <Text style={{ flex: 1, color: color.silkDim, fontSize: font.small }}>
              {own === 1 ? '1 of your own colours on top' : `${own} of your own colours on top`}
            </Text>
            <Press label="Clear them" onPress={() => setAsking('yours')} />
          </View>
        ) : null}
      </View>

      {/* ---------------------------------------------------------- effects */}
      <View style={{ gap: space.md }}>
        <Heading>Effects</Heading>
        <Note>Tap one to give it a colour of your own. It is used in every preset.</Note>
        {chain.length ? (
          <>
            <Text style={{ color: color.silkDim, fontSize: font.small }}>In this preset</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>{chain.map(effectTile)}</View>
            {rest.length ? (
              <Press label={more ? 'Fewer effects' : 'More effects'} onPress={() => setMore(!more)} />
            ) : null}
          </>
        ) : null}
        {/* With no preset read there is nothing to put first, so the unit's whole list is shown. */}
        {rest.length && (more || !chain.length) ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>{rest.map(effectTile)}</View>
        ) : null}
      </View>

      {/* ----------------------------------------------------------- scenes */}
      <View style={{ gap: space.md }}>
        <Heading>Scenes</Heading>
        {/*
          ALL RED IS THE UNIT. Every Scene switch on an FM3, FM9 or Axe-Fx III
          lights red, and an AM4 lights all four bars red in Scene mode: the
          number and the name say which. A colour each is the app's own idea,
          and some players find a scene faster by it.
        */}
        <View accessibilityRole="radiogroup" style={{ gap: space.sm }}>
          <Press
            label="All red, like the unit"
            tone="signal"
            on={allRed}
            onPress={() => chooseScenes(false, sync)}
          />
          <Press
            label="A colour for each scene"
            tone="signal"
            on={!allRed}
            onPress={() => chooseScenes(true, sync)}
          />
        </View>
        {/* Lit, every one, so each one's colour can be seen: on Play only the live one is. */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
          {Array.from({ length: sceneCount }, (_, i) => {
            const hue = sceneColor(i)
            return (
              <Tile
                key={i}
                caption={yourScene(i) ? `${i + 1} · yours` : String(i + 1)}
                label={sceneNames?.[i] || `Scene ${i + 1}`}
                bar
                wrap
                fill={hue.fill}
                ink={hue.ink}
                picked={hue.picked}
                on
                height={TAP}
                onPress={() => setPainting(sceneTarget(i, { preset: here, called: sceneNames?.[i] }))}
                style={{ width: sceneWidth }}
              />
            )
          })}
        </View>
        <Text style={{ color: color.silkDim, fontSize: font.small }}>
          Tap a scene to give it a colour, in every preset or just the one that is loaded.
        </Text>
      </View>

      {/* ---------------------------------------------------- switched off */}
      <View style={{ gap: space.md }}>
        <Heading>Switched-off effects</Heading>
        <View accessibilityRole="radiogroup" style={{ gap: space.sm }}>
          {/* Words that hold on both pages (lib/colourPage OFF_WORDS): the tile
              beside them is dark on the stage and pale on the Light page,
              whichever way is chosen. */}
          <OffChoice mode="colour" label="Keep their colour" sub={OFF_WORDS.colour} />
          <OffChoice mode="grey" label="Grey when off" sub={OFF_WORDS.grey} />
        </View>
      </View>

      {/* -------------------------------------------------------- put back */}
      <View style={{ gap: space.md }}>
        <Press label="Put every colour back" sub={PUT_BACK_WORDS} onPress={() => setAsking('all')} />
        <Note>{`Your colours are kept on this ${deviceNoun()}. The computer’s screen keeps its own.`}</Note>
      </View>

      <ColourSheet target={painting} chain={chain} onClose={() => setPainting(null)} />

      {/*
        THE CONFIRM, with its two big buttons at the bottom of the screen where
        the thumb is. Putting colours back cannot be undone, so it is never one
        tap from the page.
      */}
      <Sheet
        open={!!asking}
        onClose={() => setAsking(null)}
        title={asking === 'yours' ? 'Clear your own colours?' : 'Put every colour back?'}
        foot={
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <Press label="Keep mine" grow onPress={() => setAsking(null)} />
            <Press
              label="Put back"
              grow
              tone="signal"
              on
              onPress={() => {
                if (asking === 'yours') clearYours(sync)
                else resetAll(sync)
                setAsking(null)
              }}
            />
          </View>
        }
      >
        <Text style={{ color: color.silk, fontSize: font.body, lineHeight: 22 }}>
          {asking === 'yours'
            ? 'Every effect and scene you gave a colour of your own goes back to the colours of the look you are wearing. The look stays.'
            : 'Back to Match my unit: every effect in your unit’s own colours, every scene red, and switched-off effects in their own colour. Every colour you chose goes.'}
        </Text>
      </Sheet>
    </View>
  )
}

/**
 * One look: its name, why somebody would wear it, and five of its tiles —
 * Drive, Amp, Delay, Reverb and scene 1 — drawn by Play's own Tile in the
 * look's colours on this unit. The whole card is the button; the tiles in it
 * are pictures, so a tap anywhere on it lands on the card.
 */
function LookCard({ look, on, onPress }) {
  const tiles = lookCard(look.id)
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: on }}
      accessibilityLabel={`${look.name}. ${lookWhy(look)}`}
      onPress={() => {
        tick()
        onPress()
      }}
      style={({ pressed }) => ({
        minHeight: 64,
        gap: space.sm,
        padding: space.md,
        borderRadius: radius.md,
        borderWidth: on ? 2 : 1,
        borderColor: on ? color.signal : color.rule,
        backgroundColor: pressed ? color.panelHi : color.panel
      })}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md }}>
        <Text style={{ flexShrink: 1, color: color.silk, fontSize: font.lead, fontWeight: '700' }}>{look.name}</Text>
        {on ? <Text style={{ color: color.signal, fontSize: font.small, fontWeight: '700' }}>✓ Wearing</Text> : null}
      </View>
      <Text style={{ color: color.silkDim, fontSize: font.small, lineHeight: 19 }}>{lookWhy(look)}</Text>
      <View
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{ flexDirection: 'row', gap: space.xs }}
      >
        {tiles.map((t) =>
          t.slug ? (
            <Tile key={t.slug} label={shortName(t.slug)} fill={t.fill} on asLook={look.id} height={44} haptic={null} style={{ flex: 1 }} />
          ) : (
            <Tile key="scene" label="1" bar fill={t.fill} on ring asLook={look.id} height={44} haptic={null} style={{ flex: 1 }} />
          )
        )}
      </View>
    </Pressable>
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
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: on }}
      accessibilityLabel={`${label}. ${sub}`}
      onPress={() => {
        tick()
        setOffMode(mode, sync)
      }}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.md,
        padding: space.md,
        borderRadius: radius.md,
        borderWidth: on ? 2 : 1,
        borderColor: on ? color.signal : color.rule,
        backgroundColor: pressed ? color.panelHi : color.panel
      })}
    >
      <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Tile label={shortName('drive')} topLeft="Off" effect offAs={mode} fill={hue.fill} ink={hue.ink} picked={hue.picked} height={TAP} haptic={null} style={{ width: 84 }} />
      </View>
      <View style={{ flex: 1, gap: space.xs }}>
        <Text style={{ color: color.silk, fontSize: font.body, fontWeight: '600' }}>{label}</Text>
        <Text style={{ color: color.silkDim, fontSize: font.small, lineHeight: 19 }}>{sub}</Text>
      </View>
    </Pressable>
  )
}

function Heading({ children }) {
  return (
    <Text
      accessibilityRole="header"
      style={{ color: color.silkFaint, fontSize: font.micro, letterSpacing: 1.5, textTransform: 'uppercase' }}
    >
      {children}
    </Text>
  )
}

/* ------------------------------------------------------------------ */
/* Undo, for a moment after a look goes on                              */
/* ------------------------------------------------------------------ */

/*
 * The offer lives outside the page because it is drawn outside it: over the
 * bottom of the screen, where it cannot push the cards up or down under a
 * thumb, while the page scrolls underneath. Settings puts it there, and it
 * only ever has something to say while this page is open.
 */
let undo = null
const undoWatchers = new Set()
const offerUndo = (next) => {
  undo = next
  for (const fn of undoWatchers) fn()
}
const watchUndo = (fn) => {
  undoWatchers.add(fn)
  return () => undoWatchers.delete(fn)
}
const undoNow = () => undo

/**
 * "Now: Sunlight · Undo", for UNDO_MS after a look goes on, and Undo puts the
 * last one back on. One tap repaints every tile in the app, so a tap that
 * landed on the wrong card is one more tap from being as it was. With a
 * screen reader on it stays until it is answered (Toast's useStillNews): an
 * offer that goes before it is heard has not been made.
 */
export function LookUndo() {
  const offer = useSyncExternalStore(watchUndo, undoNow, undoNow)
  const left = offer ? Math.max(0, offer.at + UNDO_MS - Date.now()) : 0
  const now = offer ? LOOKS.find((l) => l.id === offer.now)?.name : null
  const showing = useStillNews(now ? `Now: ${now}` : null, offer?.at, left)
  if (!offer || !showing) return null
  return (
    <View
      style={{
        position: 'absolute',
        left: space.lg,
        right: space.lg,
        bottom: space.lg,
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.md,
        padding: space.sm,
        paddingLeft: space.md,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: color.rule,
        backgroundColor: color.chassis,
        shadowColor: '#000',
        shadowOpacity: 0.35,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 2 },
        elevation: 6
      }}
    >
      <Text style={{ flex: 1, color: color.silk, fontSize: font.body }}>{`Now: ${now}`}</Text>
      <Press
        label="Undo"
        onPress={() => {
          setLook(offer.was, sync)
          offerUndo(null)
        }}
      />
    </View>
  )
}

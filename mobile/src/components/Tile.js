import { useEffect, useLayoutEffect, useState } from 'react'
import { Image, PixelRatio, Platform, Pressable, StyleSheet, Text, View } from 'react-native'

import { color, font, isDark, radius, space, TAP } from '../lib/theme'
import { at, inkOn, lighter, vivid } from '../lib/vivid'
import { LIGHT_INK, enoughOn, mix, paperEdge } from '../lib/ink'
import { isFractalRemoteLook, offMode } from '../lib/looks'
import { OFF_GREY, liftedLook } from '../lib/colourPage'
import { tick } from '../lib/feedback'
import { fire, said } from '../lib/tapped'
import { cornerFit, mustSayFit } from '../lib/tile-corners'
import { laidWhole } from '../lib/tileGrid'
import { NAME_REF, NAME_TRACK, fitName } from '../lib/name-fit'

/**
 * A coloured tile, for the two things on this screen that have an identity.
 *
 * `Press` is the app's button and stays the app's button: one shape, one
 * meaning of colour, amber for the audio path. That grammar works for a row of
 * controls and breaks for a grid of eight scenes, because every tile in the
 * grid would then be the same colour and tell you nothing until you read it.
 *
 * THE RULE THIS FOLLOWS, and it is the browser's, in sceneColors' own words:
 * colour is identity and brightness is state. A scene keeps its hue whether or
 * not it is live; a filled tile is the one you are in. The blocks say the same
 * thing one step further — a drive is red on the unit's own screen, so a screen
 * pretending to be that hardware had better agree, and the fill says engaged
 * while the edge keeps saying drive even when it is off.
 *
 * That is the whole reason this is worth a component rather than a style prop.
 * On a dark stage the eye finds the red long before three letters resolve, and
 * an app that only agreed with the unit some of the time would be worse than
 * one that never tried.
 *
 * The colours themselves are not decided here. `blockColors.js` and
 * `sceneColors.js` are generated from the browser's copies by
 * `npm run sync:rules`, so the two screens cannot drift into disagreeing about
 * which tile is the delay.
 */

/*
 * THE GLASS, AND WHICH WAY IT FALLS.
 *
 * A lit tile has a sheen: a tenth of white over its top half, which is a
 * gradient's job done without one (see the note where it is drawn). On a
 * tile with black letters that only helps them. On one with WHITE letters it
 * is the half they read worst on — an AM4's chorus, darkened just enough to
 * carry white letters as the unit does, lost them under it. So a tile with
 * white letters takes the same tenth as a shade over its BOTTOM half instead:
 * still lit from above, and never lighter anywhere than the colour its
 * letters were chosen for. The browser's edit strip does the same with its
 * gradients, and a test measures both ends of both against every look.
 */
const SHEEN = 'rgba(255,255,255,0.10)'
const SHADE = 'rgba(0,0,0,0.10)'
/* Two pixels, because the edge is doing real work when the tile is off. An absolute child's offsets are taken inside it. */
const BORDER = 2
/*
 * Whether a whole name fits, as its twin last laid it out: by the name, the
 * tile's width and the phone's text size. Kept here rather than only in the
 * tile, because the pedals are drawn again from nothing at every preset step
 * (the grey cards stand in while the chain loads) and every return to Play,
 * and a tile that had to wait for its twin drew its three letters for a
 * frame and then the name, at the moment the player looks at them.
 */
const WHOLE = new Map()
/*
 * A fitted name's measure (lib/name-fit), by the name and the phone's text
 * size: each word's width, a space's and a line's height, at NAME_REF. Kept
 * for the same reason as WHOLE: a scene tile drawn again for a name it has
 * measured before is drawn at its size at once, never small for a frame
 * first.
 */
const MEASURED = new Map()
/* The rule under a scene's name and its gap (the bar, below): what a fitted name leaves room for. */
const BAR = 5 + 3
/* Which words a name is, as the twin lays them out one to a line. */
const wordsOf = (name) => String(name || '').trim().split(/\s+/).filter(Boolean)

export default function Tile({
  label: given,
  sub,
  caption,
  /*
   * THE TWO CORNERS: On or Off at the top left, the channel at the top right.
   *
   * "For the on off just put those up in the top left and then for the
   * channel number put that at the top right." They used to share a line
   * under the name, which cost the tile a line of height it did not have
   * once the picture went on top. In the corners they cost none.
   */
  topLeft,
  topRight,
  /*
   * Two corner words that are one phrase, shown together or not at all.
   *
   * The looper's tile says Rec in one corner and Play in the other, and
   * either one alone would read as the only thing a tap on it does. On/Off
   * and a channel letter are two separate facts, so an effect tile leaves
   * this off and each of its corners shows on its own.
   */
  pair = false,
  /*
   * A top-left word that is ALWAYS seen: an AM4 amp's Boost on, Boost off or
   * Amp off (lib/am4-boost), which is the whole of what its tap does. "It
   * should say Boost on, Boost off when they tap it", and at the sizes most
   * phones use the corner had no room for it beside the picture, so it was
   * hidden and the tile was a dark AMP that read as a bypassed amp. Where its
   * corner has no room beside the picture, the picture is cleared from under
   * it and the word stays in its corner, with the channel letter beside it
   * wherever the row holds both (the corner rule's own choice where it does
   * not: the word, as for every tile). Only a word too wide for its row even
   * then (a large system text size) goes across the tile, in the picture's
   * place. The tile's height does not move.
   */
  mustSay = false,
  /*
   * What a screen reader says for the top-left word, where that is not the
   * word itself: an unread boost has no word on it and says it is not read.
   */
  saysLeft,
  /*
   * A state not read from the unit yet, drawn with a dashed edge so it is
   * never taken for an Off (the browser's own unread VP4 pedal does the same).
   */
  unread = false,
  /*
   * The picture above the letters, cut from Justin's mockup of this screen.
   * White in the file and tinted here, so one copy serves every hue — see
   * lib/blockIcons. Optional by design: a family he did not draw shows the
   * letters alone, exactly as the grid looked before any of this.
   */
  icon,
  /*
   * The rule under the name, in the tile's own colour. Scenes wear one and
   * blocks do not — see the note where it is drawn.
   */
  bar = false,
  /*
   * One of the chain's two ends, drawn as a quiet outline rather than a lit
   * tile: "the plumbing, not the tone", as the browser has always drawn them.
   * Neither has an on or off, so `on` here only says it is the one open.
   */
  quiet = false,
  /*
   * The live scene's amber ring, the browser's. Every scene is the same red in
   * Match my unit, and so is an AM4's drive: the ring is what says which of
   * the red tiles is the scene you are standing in.
   */
  ring = false,
  /*
   * An effect a tap switches on and off: the only kind of tile "Grey when
   * off" (Settings → Colours) turns grey. A scene that is not the live one
   * is not switched off, and the Edit strip's `on` means the one open, so
   * neither of those passes it.
   */
  effect = false,
  /*
   * The Colours page's previews, which draw a look or a switched-off choice
   * that is not the one being worn — each card shows its look as Play would.
   * Left out, the tile is drawn in what is being worn, which is every tile
   * anywhere else.
   */
  asLook,
  offAs,
  /*
   * A colour somebody picked — his own, or the Colours page's Scenes choice —
   * rather than the look's own (lib/blockColors and lib/sceneColors say which,
   * as `picked`). Only matters in Fractal Remote, which this tile lifts the
   * way it always did: that is right for the look's own colours and wrong for
   * his. A white he chose came out grey, and five of the colours on the sheet
   * lost their letters under the lift and the sheen, while the browser drew
   * them as chosen. So a picked colour is drawn as it is, in every look.
   */
  picked = false,
  /*
   * A name that may take a second line, a size down: "Crunch Bot UP" rather
   * than "Cru…". It began as the four-across scene tile's, which leaves room
   * for five letters at the usual size — and then the tester, at two across:
   * "Scene names cut short." A scene name is the thing a player thinks in, so
   * every scene tile wraps now, at every width.
   */
  wrap: wraps = false,
  /*
   * THE NAME AS BIG AS THE TILE HAS ROOM FOR (lib/name-fit), for a scene's.
   * "The scene names are kind of small on the AM4. Can we make those auto
   * adjust to the screen size so the text is bigger on screens that allow
   * it?" Its words are measured once, unseen, then the biggest size that
   * keeps the whole name on two lines, no word cut, inside the tile's room
   * under its number, is the size drawn: an AM4's four big tiles get big
   * names, an FM3's eight keep the size they had, which is the floor. Until
   * the measure is in, the name is drawn as a wrapped name always was.
   *
   * One size for the whole grid: the tile says what fits it (`onFit`, the
   * size or null) and draws at most `fitCap`, the smallest that fits every
   * scene on the screen (lib/name-fit `together`), so "Jumped" is not drawn
   * twice the size of "Crunch Bright" beside it.
   */
  fit = false,
  fitCap,
  onFit,
  /*
   * A WHOLE NAME TO SHOW IN PLACE OF `label`, where it fits: a pedal's
   * "Compressor" for CMP on a Play wide enough to spell it out
   * (lib/playShape `names`). Two lines, a size down, as a wrapped name
   * always is; a name that would need a third line, or a word cut in two,
   * keeps `label` (lib/tileGrid laidWhole), so a tile is never a name with
   * an ellipsis. Left out, as it is on every phone, the tile is exactly what
   * it was: nothing about it is measured or drawn.
   */
  full,
  fill,
  ink,
  on = false,
  onPress,
  onLongPress,
  height = TAP,
  haptic = tick,
  style
}) {
  /*
   * THE WHOLE NAME, OR THE THREE LETTERS (`full`). Measured on a twin of the
   * whole name laid out unseen at the tile's own width, and only ever taken
   * at the width it was measured at: until the twin has said, and at a new
   * width until it says again, the tile shows the label it was given, so a
   * name too long for the tile is never drawn cut short for a frame. The
   * name drawn, said and logged is then `label`, and a whole name wraps as a
   * wrapped name does. With no `full`, both are exactly what was given.
   * A tile drawn again shows at once what a twin said last for that name at
   * that width and text size (WHOLE); a name or a width never laid out
   * before still waits for its own twin.
   */
  const [whole, setWhole] = useState(null)
  const wholeAt = full ? `${full}|${StyleSheet.flatten(style)?.width}` : null
  const wholeKey = full ? `${wholeAt}|${PixelRatio.getFontScale()}` : null
  const wholeFits = whole?.at === wholeAt ? whole.fits : WHOLE.get(wholeKey)
  const named = !!full && wholeFits === true
  const label = named ? full : given
  const wrap = wraps || named
  /*
   * THE FITTED NAME. Measured by the name and the phone's text size, then
   * sized from the room: the tile's width less its border and padding, and
   * its height less those, the number above the name (measured as it is
   * drawn) and the rule under it.
   */
  const measureKey = fit && label ? `${label}|${PixelRatio.getFontScale()}` : null
  const [measured, setMeasured] = useState(null)
  const measure = measureKey ? (measured?.key === measureKey ? measured : MEASURED.get(measureKey)) || null : null
  const [captionTall, setCaptionTall] = useState(0)
  const tileWide = StyleSheet.flatten(style)?.width
  const fitted =
    measure && typeof tileWide === 'number' && (!caption || captionTall > 0)
      ? fitName({
          words: measure.words,
          space: measure.space,
          line: measure.line,
          ref: NAME_REF,
          width: tileWide - 2 * BORDER - 2 * space.sm,
          height: height - 2 * BORDER - 2 * space.sm - (caption ? captionTall + 1 : 0) - (bar ? BAR : 0),
          min: font.small
        })
      : null
  /*
   * Said up to the grid, which hands every tile the one size they share: the
   * size it fits at, 0 for a name that fits at no size, nothing until it is
   * measured, and always with the name it is about, so an answer for the
   * last preset's name is never taken for this one's. Before the screen is
   * drawn (a layout effect): a name measured before is then drawn at the
   * grid's size in its first frame, not at its own for one frame first.
   */
  const fitsAt = fitted?.fits ? fitted.size : null
  const told = fitted ? fitsAt || 0 : null
  useLayoutEffect(() => {
    if (fit) onFit?.(told, label)
  }, [fit, told, label])
  /* Drawn fitted only where the name fits and the grid has its one size; otherwise exactly as it was. */
  const drawnAt = fitsAt && fitCap > 0 ? Math.min(fitsAt, fitCap) : null
  /*
   * THE COLOUR AS IT IS AUTHORED — EXCEPT IN THE ONE LOOK THAT WAS LIFTED.
   *
   * The palettes are Fractal's own colours now, set at the brightness a lit
   * tile on a dark stage needs, and the browser draws them as they are. This
   * screen used to lift every colour on top (`vivid`: saturation up, hue kept)
   * — which turned an AM4's red drive orange with black letters here. So the
   * lift is gone, except in Fractal Remote, the app's colours as they always
   * were, which is drawn exactly as it always was: "I just don't wanna lose
   * all the colors and current color scheme cause I like those also." Its own
   * colours, that is: one somebody picked on top of it is his (`picked`), and
   * drawn as he picked it, its glass falling away from its letters. The look's
   * edges and words stay the look's, as they do in the browser.
   *
   * Off is the same hue at a seventh, over the chassis, rather than a flat
   * panel: the tile stays recognisably its own colour while being obviously
   * unlit, which is the distinction the whole grid rests on.
   */
  const asBefore = asLook ? liftedLook(asLook) : isFractalRemoteLook()
  const lift = asBefore && !picked
  const hue = lift ? vivid(fill) : fill
  /*
   * GREY WHEN OFF, the other way a switched-off effect can look: as the units
   * draw a bypassed block, a dark tile, a grey outline and dim letters — the
   * letters lifted to read at 4.5:1, which the FM3's own grey does not. One
   * grey for every unit and every look, a paler one on the Light page
   * (OFF_GREY, shared with the browser). Lit tiles are untouched: "keep
   * their colour" is about the ones that are off.
   */
  const grey = effect && !on && !quiet && (offAs || offMode()) === 'grey'
  const off = isDark() ? OFF_GREY.dark : OFF_GREY.light
  const background = quiet ? 'transparent' : grey ? off.fill : on ? hue : at(hue, 0.14)
  /*
   * BLACK LETTERS ON A LIGHT TILE, WHITE ON A DARK ONE — FROM THE COLOUR
   * ACTUALLY DRAWN.
   *
   * "Fix the text so when it's on lighter icons, it's black and when it's on
   * darker icons, it's white like we already had set up." The palette's ink
   * was chosen for the palette's colour, and `vivid` above draws a brighter
   * one: a grey gate and an orange EQ came out light enough that their white
   * letters stopped reading. `inkOn` picks whichever of the two has more
   * contrast against the colour on the screen. The palette's ink is only the
   * answer for a colour it cannot read.
   */
  const lit = inkOn(hue, ink)
  const foreground = quiet ? (on ? color.signal : color.silkDim) : grey ? off.ink : on ? lit : color.silk
  /*
   * AN UNLIT PICTURE IS ITS OWN COLOUR, LIT LESS.
   *
   * "When the effects were off they turned to white instead of just being
   * lighter colored." White said nothing about which effect it was. The
   * effect's own hue, lifted toward white on the dark stage, keeps the
   * picture naming the block while plainly not being lit. On the light
   * theme lifting it toward white would wash it into the page, so there it
   * is the hue as it is.
   */
  const unlitPicture = grey ? off.ink : isDark() ? lighter(hue, 0.35) : hue
  const pictureTint = on ? lit : unlitPicture
  /*
   * THE QUIET WORDS ON AN UNLIT TILE — its number, Off, the channel — in the
   * dim silkscreen grey, unless the wash under them is too bright for it.
   *
   * The new looks' colours are brighter than the old ones, and a seventh of a
   * pale Sunlight scene or of Match my unit's red on the Light page lifts the
   * tile enough that the dim grey came to 4.2:1 on it. So it is taken toward
   * the full lettering colour just far enough to read at 4.5:1 on the tile as
   * drawn, over either ground a tile sits on, and no further: where the grey
   * already reads, it is the grey. Fractal Remote keeps its grey as it was.
   */
  const quietWords = asBefore
    ? color.silkDim
    : enoughOn(color.silkDim, color.silk, [mix(color.chassis, hue, 0.14), mix(color.panel, hue, 0.14)])
  /*
   * The glow, and it is iOS only by nature rather than by choice: Android has
   * no coloured shadow, only `elevation`, which is grey. Rather than fake a
   * halo with an extra View behind every tile in a grid that can hold twenty
   * of them, Android gets the lift and iOS gets the light. Both read as raised;
   * only one of them glows.
   */
  /*
   * THE PICTURE GOES ON TOP, AT EVERY HEIGHT — THE AM4'S LAYOUT.
   *
   * "Let's make them look exactly like the AM4 and the VP4." A short chain's
   * tall tiles had the picture above the letters; a long chain squeezed to
   * fit put it beside them, which is the look he did not like. Now it is
   * above them everywhere and only its size moves: a third of the tile,
   * never under 14 so it is still a picture, never over 28 so a roomy tile
   * does not turn into a billboard. With On/Off and the channel moved up
   * into the corners, the 44pt tile of a squeezed chain has room for both.
   */
  const picture = icon ? Math.max(14, Math.min(28, Math.round(height * 0.32))) : 0
  const cornered = !!(topLeft || topRight)

  /*
   * A CORNER WORD IS NEVER DRAWN ON THE PICTURE.
   *
   * "Looks like we need to fix the overlapping play word on the looper." The
   * corners cost the tile no height, and the picture is centred in the rest,
   * so on a short tile the picture rises into the corner row. There is no
   * height to push them apart with — Fit owns it — so a word sits beside the
   * picture or it is not drawn, and cornerFit decides which from what was
   * actually laid out. See shared/tile-corners.mjs for the rule.
   *
   * Kept only when a measurement moves by half a point or more, so a layout
   * that lands where it was does not draw the tile again. A word that is not
   * drawn keeps its place, so it can still be measured, and it is still in
   * the accessibility label below, so a screen reader still says it.
   */
  const [laid, setLaid] = useState({})
  const keep = (key, value, at) =>
    setLaid((was) =>
      was[key] != null && Math.abs(was[key] - value) < 0.5 && was.at?.[key] === at
        ? was
        : { ...was, [key]: value, at: { ...was.at, [key]: at } }
    )
  /*
   * AND ONLY AT THE SIZE THEY WERE TAKEN AT.
   *
   * A tile on screen that gets smaller — a preset that takes the chain from
   * three across to four, Fit shrinking the rows — is drawn at its new size
   * before onLayout says what that size is, and the looper keeps its key, so
   * it is never drawn afresh. For a frame or two the old width said Play had
   * room, while the picture had already moved up under it. So the tile's
   * width and the picture's top are each marked with the size they were
   * measured at, and a frame drawn at any other size has no measurements at
   * all: the words wait, hidden, for the layout that says where they go.
   *
   * A size that moves nothing gets no layout: at the floor a tile is as tall
   * as what is in it, and a little more height asked for leaves it where it
   * was. Nothing moved, so what was measured is still true, and it is taken
   * as the new size's once the layout it would have brought has had time to
   * come and has not.
   */
  const sized = `${height}|${picture}|${StyleSheet.flatten(style)?.width}`
  const current = laid.at?.width === sized && laid.at?.top === sized
  useEffect(() => {
    if (!cornered) return undefined
    const still = setTimeout(
      () =>
        setLaid((was) =>
          was.width == null || was.top == null || (was.at?.width === sized && was.at?.top === sized)
            ? was
            : { ...was, at: { ...was.at, width: sized, top: sized } }
        ),
      200
    )
    return () => clearTimeout(still)
  }, [sized, cornered])
  const shows = cornerFit({
    width: current ? laid.width : undefined,
    picture,
    pictureTop: current ? laid.top : undefined,
    bandBottom: laid.band,
    inset: laid.inset,
    left: topLeft ? laid.left : 0,
    right: topRight ? laid.right : 0,
    pair
  })
  /*
   * THE WORD THAT MUST BE SEEN (`mustSay`): beside the picture where it fits
   * there; otherwise in its own corner with the picture cleared from under
   * it, the channel beside it where the row holds both; only a word too wide
   * for its row goes across the tile, in the picture's place. The browser's
   * rule too (shared/tile-corners.mjs mustSayFit). Decided from the corner's
   * own measurements at this size, which the decision does not change: the
   * picture keeps its box, drawn clear. The word's width is taken on the
   * word across the tile (the same word in the same face, `laid.middle`),
   * which its row does not cut short: the corner word is laid out no wider
   * than its row, so measured there a word too wide for the row (a large
   * system text size) always fitted it, and was drawn "Boost …" in its
   * corner. The phone's edge is the same lit or not, so nothing is lifted.
   */
  const say =
    mustSay && cornered && !!String(topLeft || '').trim() && current
      ? mustSayFit(
          {
            width: laid.width,
            picture,
            pictureTop: laid.top,
            bandBottom: laid.band,
            inset: laid.inset,
            left: laid.middle,
            right: topRight ? laid.right : 0,
            pair
          },
          { moved: laid.middle, movedTop: picture ? laid.top : 0 }
        )
      : null
  /* The picture cleared from under a word that has moved, and the word across the tile. */
  const cleared = !!say?.at
  const middle = say?.at === 'across'
  const leftShown = say ? say.at !== 'across' : shows.left
  const rightShown = say ? say.right : shows.right
  const cornerInk = quiet || grey ? foreground : on ? lit : quietWords
  /*
   * Every pedal but the one whose word must be seen keeps 1.87.48's corner
   * row exactly: a word the rule does not draw stays in the row, unseen, so
   * the row, and what is measured in it, never move with the rule's answer.
   *
   * The pedal whose word must be seen (`mustSay`, an AM4 amp's boost) is the
   * one exception, and it is placed by laid.middle, a width no corner word
   * changes. Its word moved across the tile leaves the row while the channel
   * letter is drawn, so the letter keeps to its own corner rather than being
   * pushed past it by the unseen word (`marginLeft: 'auto'` holds it right
   * on its own). And neither of its words ever shrinks, as on a phone, where
   * Yoga shrinks no word: drawn in a browser to be measured, a word squeezed
   * by its unseen neighbour measured narrower, which moved the answer, which
   * moved the word, every frame.
   */
  const leftOut = mustSay && !leftShown && rightShown && !!String(topRight || '').trim()
  const leftWord = { color: cornerInk, fontSize: font.micro, fontWeight: '600', opacity: leftShown ? 1 : 0, ...(mustSay ? { flexShrink: 0 } : null), ...(leftOut ? { position: 'absolute', left: 0 } : null) }
  const rightWord = { color: cornerInk, fontSize: font.micro, fontWeight: '700', opacity: rightShown ? 1 : 0, ...(mustSay ? { flexShrink: 0, marginLeft: 'auto' } : null) }

  /*
   * THE EDGE, which on an unlit tile is the only thing still naming the block.
   *
   * It was the colour at a little over half strength, which on the dark stage
   * came to 1.7:1 against the black — an outline you had to look for. Now it
   * is the colour itself, which every look keeps bright enough to stand 3:1
   * off the page. On the Light page a pale colour is nearly the paper, so
   * there the edge is the colour half way to black, lit or not, and the lit
   * tile keeps an edge too instead of dissolving into the page. Fractal
   * Remote keeps the edges it always had.
   */
  const edge = (() => {
    if (quiet) return on ? color.signal : color.rule
    if (grey) return off.edge
    if (asBefore) return at(hue, on ? 0.85 : 0.55)
    if (ring && on) return color.signal
    if (!isDark()) return paperEdge(hue)
    return on ? at(hue, 0.85) : hue
  })()
  /* Which way the glass falls: see SHEEN and SHADE above. Over the top, as it
     always was, only on a colour that is lifted. */
  const shadeBelow = !lift && lit === LIGHT_INK

  const glow = on && !quiet
    ? Platform.select({
        ios: {
          shadowColor: hue,
          shadowOpacity: 0.55,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: 0 }
        },
        default: { elevation: 3 }
      })
    : null

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      /* Blank parts left out: an unread pedal's corner holds a space, and "AMP,  , C" read an empty item out. */
      accessibilityLabel={[label, saysLeft ?? topLeft, topRight, sub, caption].filter((part) => !!String(part ?? '').trim()).join(', ')}
      onPress={() => {
        haptic?.()
        fire(`press ${said(label, sub || topLeft)}`, onPress)
      }}
      onLongPress={
        onLongPress
          ? () => {
              haptic?.()
              fire(`hold ${said(label, sub || topLeft)}`, onLongPress)
            }
          : undefined
      }
      delayLongPress={450}
      /* The tile's outer width, which the picture is centred in. */
      onLayout={cornered ? (e) => keep('width', e.nativeEvent.layout.width, sized) : undefined}
      style={({ pressed }) => [
        {
          minHeight: height,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: space.sm,
          /* A tile with corners has them sitting in its top edge, so the
             middle can use the height the padding would have taken. */
          paddingVertical: cornered ? space.xs : space.sm,
          borderRadius: radius.md,
          /* Two pixels, because the edge is doing real work when the tile is
             off — it is the only thing still naming the block. */
          borderWidth: BORDER,
          borderColor: edge,
          ...(unread ? { borderStyle: 'dashed' } : null),
          backgroundColor: background,
          opacity: pressed ? 0.7 : 1,
          ...glow
        },
        style
      ]}
    >
      {/*
        A sheen across the top, which is a gradient's job done without one.
        A real one needs expo-linear-gradient — native code, so it would move
        the fingerprint and cost a build to add a highlight. A single
        translucent white panel over the top half reads as the same thing at
        arm's length on a dark stage.

        pointerEvents none, and absolute so it takes no part in layout: this
        tile's height is what the fit-to-screen arithmetic is budgeting, and a
        decoration must not move it.
      */}
      {on && !quiet ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            height: '50%',
            ...(shadeBelow
              ? { bottom: 0, borderBottomLeftRadius: radius.md - 2, borderBottomRightRadius: radius.md - 2 }
              : { top: 0, borderTopLeftRadius: radius.md - 2, borderTopRightRadius: radius.md - 2 }),
            backgroundColor: shadeBelow ? SHADE : SHEEN
          }}
        />
      ) : null}
      {cornered ? (
        <View
          pointerEvents="none"
          /* Where the corner words start, and where their row ends. The row
             sits 5pt inside the 2pt border, so its words start 7pt in from
             the tile's edge — measured here rather than written down, so
             the number cannot drift from where Yoga actually put them. */
          onLayout={(e) => {
            const { x, y, height: tall } = e.nativeEvent.layout
            keep('inset', x)
            keep('band', y + tall)
          }}
          style={{
            position: 'absolute',
            left: 5,
            right: 5,
            top: 3,
            flexDirection: 'row',
            justifyContent: 'space-between'
          }}
        >
          <Text numberOfLines={1} onLayout={(e) => keep('left', e.nativeEvent.layout.width)} style={leftWord}>
            {topLeft || ''}
          </Text>
          <Text numberOfLines={1} onLayout={(e) => keep('right', e.nativeEvent.layout.width)} style={rightWord}>
            {topRight || ''}
          </Text>
        </View>
      ) : null}
      {mustSay && cornered ? (
        <View
          pointerEvents="none"
          /* Over the picture's own box (the column's top, less the border the
             offsets are taken inside of), or the corner row's place on a tile
             with no picture, for a word too wide for its corner row. The
             corner word's own face, and laid out always, unseen unless it is
             drawn here: its width is the word's whole width, which the rule
             places it by (laid.middle). */
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: picture ? Math.max(0, (laid.top ?? BORDER) - BORDER) : 3,
            height: picture || undefined,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: middle ? 1 : 0
          }}
        >
          <Text numberOfLines={1} onLayout={(e) => keep('middle', e.nativeEvent.layout.width)} style={{ color: cornerInk, fontSize: font.micro, fontWeight: '600' }}>
            {topLeft || ''}
          </Text>
        </View>
      ) : null}
      {measureKey && !measure ? (
        <Text
          /* The fitted name's measure, unseen and untouchable: each word on a
             line of its own, then "n n" and "nn", whose difference is one
             space, at NAME_REF and the tracking a fitted name is drawn with,
             in a box too wide for any word to wrap. */
          pointerEvents="none"
          accessible={false}
          importantForAccessibility="no-hide-descendants"
          onTextLayout={(e) => {
            const lines = e.nativeEvent.lines || []
            const words = wordsOf(label)
            if (lines.length !== words.length + 2) return
            const got = {
              key: measureKey,
              words: words.map((_, i) => lines[i].width),
              space: Math.max(0, lines[words.length].width - lines[words.length + 1].width),
              /* A middle line's height, "n n": Android adds the face's padding to the first line and the last, and a line here is a line between two. */
              line: lines[words.length].height
            }
            if (!got.words.every((w) => w > 0) || !(got.line > 0)) return
            MEASURED.set(measureKey, got)
            setMeasured(got)
          }}
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: 4000,
            opacity: 0,
            fontSize: NAME_REF,
            fontWeight: '700',
            letterSpacing: NAME_REF * NAME_TRACK
          }}
        >
          {[...wordsOf(label), 'n n', 'nn'].join('\n')}
        </Text>
      ) : null}
      {full ? (
        <Text
          /* The whole name's twin, unseen and untouchable, at the width the
             name would be drawn at (the tile's padding in from its border):
             what it lays out decides whether the name is drawn. */
          pointerEvents="none"
          accessible={false}
          importantForAccessibility="no-hide-descendants"
          onTextLayout={(e) => {
            const fits = laidWhole(full, e.nativeEvent.lines)
            WHOLE.set(wholeKey, fits)
            setWhole((was) => (was?.at === wholeAt && was.fits === fits ? was : { at: wholeAt, fits }))
          }}
          style={{
            position: 'absolute',
            left: space.sm,
            right: space.sm,
            top: 0,
            opacity: 0,
            fontSize: font.small,
            fontWeight: '700',
            letterSpacing: 0.5,
            textAlign: 'center'
          }}
        >
          {full}
        </Text>
      ) : null}
      <View
        /* The picture is this column's first child, so its top is the
           picture's top. */
        onLayout={cornered ? (e) => keep('top', e.nativeEvent.layout.y, sized) : undefined}
        style={{ alignItems: 'center' }}
      >
        {picture ? (
          <Image
            source={icon}
            /* Silent: the Pressable above already says the block's name and
               state, and a second announcement for the picture of it would
               make every tile read itself out twice. */
            accessible={false}
            /* Clear, keeping its box, while a word that must be seen is in its place or over it (`mustSay`). */
            style={{ width: picture, height: picture, marginBottom: 2, tintColor: quiet ? foreground : pictureTint, ...(cleared ? { opacity: 0 } : null) }}
            resizeMode="contain"
          />
        ) : null}
        {caption ? (
          <Text
            numberOfLines={1}
            onLayout={fit ? (e) => setCaptionTall(e.nativeEvent.layout.height) : undefined}
            style={{ color: quiet || grey ? foreground : on ? lit : quietWords, fontSize: font.micro, marginBottom: 1 }}
          >
            {caption}
          </Text>
        ) : null}
        <Text
          numberOfLines={drawnAt ? 2 : wrap ? 2 : 1}
          style={{
            color: foreground,
            fontSize: drawnAt || (wrap ? font.small : font.body),
            /* The measured line already has the phone's text size in it, and both phones scale a line height by it
               again, so it is taken back out; rounded down, so a line is never taller than the room it was fitted to. */
            ...(drawnAt ? { lineHeight: Math.floor((measure.line * drawnAt) / NAME_REF / PixelRatio.getFontScale()) } : null),
            fontWeight: '700',
            letterSpacing: drawnAt ? Math.round(drawnAt * NAME_TRACK * 10) / 10 : 0.5,
            textAlign: 'center'
          }}
        >
          {label}
        </Text>
        {sub ? (
          <Text
            numberOfLines={1}
            style={{ color: quiet || grey ? foreground : on ? lit : quietWords, fontSize: font.micro, marginTop: 2 }}
          >
            {sub}
          </Text>
        ) : null}
        {/*
          THE BAR UNDER THE NAME, which is the one thing his mockup of the
          play screen has that this did not.

          Every scene tile in it carries a short rule under the name in the
          tile's own hue. It does a real job rather than a decorative one: the
          grid is eight tiles, and on an unlit one the only colour is a
          two-pixel border at arm's length. The bar puts a piece of that hue
          in the middle of the tile where the eye already is, which is the
          whole argument for colouring these tiles at all.

          Scenes only — the chain tiles in the same mockup have no bar, and a
          block already says On or Off in words.

          Its width is the tile's rather than the name's: a rule that changed
          length with the word would read as a progress bar.
        */}
        {bar ? (
          <View
            pointerEvents="none"
            style={{
              marginTop: 5,
              width: '52%',
              height: 3,
              borderRadius: 2,
              backgroundColor: on ? at(lit, 0.8) : hue
            }}
          />
        ) : null}
      </View>
    </Pressable>
  )
}

import { useState } from 'react'
import { Image, PixelRatio, Pressable, Text, View } from 'react-native'

import { color, font, radius, space, TAP } from '../lib/theme'
import { STEP_LINE_EDGE, STEP_WORD_LEAST, fitStep } from '../lib/line-fit'
import { tick } from '../lib/feedback'
import { fire, said } from '../lib/tapped'

/* The height of the line under a button (`under`), fixed so a name arriving never moves anything. */
export const UNDER_LINE = 14

/* The pictures beside a label (Picture, below), square, and every button's border. */
const PICTURE = 20
const BORDER = 1

/*
 * What `fit` has measured, kept for the whole app by what was measured (the
 * text, its size and the system text size): a name seen once is fitted from
 * the first frame it is drawn in, rather than drawn at the last name's size
 * until its own measure comes back, which is a frame later. The labels
 * (Previous, Next) and their heights on their own, never let go; the names
 * let go of the oldest past NAMES_KEPT, more than any unit holds. And the
 * last width of each fitted button, by its label, so Play's Previous is
 * fitted on the frame it opens with.
 */
const LABELS = new Map()
const TALL = new Map()
const NAMES = new Map()
const NAMES_KEPT = 2000
const BOXES = new Map()

/**
 * Every button in the app.
 *
 * One component so the stage rules hold everywhere without anyone remembering
 * them: nothing below 56pt, a visible pressed state that does not depend on
 * colour alone, and a haptic on every press because the screen is the thing you
 * cannot look at.
 *
 * `tone` is meaning, not decoration. 'signal' is the audio path — a block that
 * is on, the scene that is live. 'live' is the link. 'plain' is everything
 * else, which is most of it.
 */
export default function Press({
  label,
  sub,
  caption,
  /*
   * A picture beside the words, cut from Justin's mockup of the play screen.
   * White in the file and tinted to whatever the label is, so one copy works
   * on a lit button and an unlit one. Optional: a button he drew without an
   * icon still gets none.
   */
  icon,
  /*
   * A second picture, on the right. The preset button wears both — the list
   * on the left saying what it opens, the chevron on the right saying it
   * opens somewhere — and Next wears this one alone, because there the
   * chevron IS the direction rather than a decoration on it.
   */
  after,
  /*
   * Something small in the top right corner — the tempo light on Tap. Drawn
   * over the button rather than in the row, so it never moves the label.
   */
  badge,
  /*
   * One small line under the whole button, across its full width: what Next
   * (or Previous) will load. "'Next: song name' under the Next button."
   *
   * Not `sub`. That one sits beside the chevron, in what is left of the
   * button once the picture has its room (under forty points on a small
   * phone), and is allowed two lines, so a song name there wrapped and made
   * the whole foot row taller. This one is a single line with a fixed height,
   * and the button gives it four points of its own padding at each edge, so
   * the button is the size it always was at both foot heights (Stage's 56
   * and the 48 of the Smallest size).
   *
   * DRAWN WHENEVER IT IS GIVEN, even blank. A line that appeared when the
   * name was known would move the word Next up under the thumb on its way;
   * a line that is always there means nothing moves. Previous has one too,
   * what it will load, so the two words sit level. Blank is a no-break
   * space, not a space: a line holding only a space can fold away to
   * nothing, and then the word moves anyway.
   *
   * Never part of what a screen reader hears unless the screen says so with
   * `accessibilityLabel`: the screen knows how to say it ("Next, Schism").
   */
  under,
  /*
   * Mirror the left picture. Previous and Next are the same chevron pointing
   * opposite ways, and one file flipped is better than two files that could
   * drift apart.
   */
  flip = false,
  /*
   * Fit the label and the line under it to the button rather than cut them.
   * "The previous/next buttons and the preset names are not showing up
   * correctly": Play's Previous read "Previ..." over "OLIVIA RODRI..." on a
   * third of an iPhone, the word cut by the chevron beside it and the name
   * by the button's own side padding. So with `fit` each is measured, and
   * one too wide for its room is drawn smaller, just as much as it needs,
   * down to a floor (shared/line-fit.mjs), and only past the floor cut as
   * before. The line under reaches into the side padding, to 4 from the
   * edge. And a word that would be drawn small beside its picture (under 13)
   * is drawn without the picture whenever that draws it bigger: the
   * chevron goes before the word shrinks, because the word is what says
   * which way the button goes (shared/line-fit.mjs fitStep).
   */
  fit = false,
  /*
   * The labels of the buttons drawn beside this one at the same width
   * (Previous's is ['Next'], Next's ['Previous']): with `fit`, every word in
   * the row is drawn at the smallest size any of them needs, so "Previous"
   * at 11 never sits beside "Next" at 15 (the scene names' rule, one size
   * for the row: two sizes read as two kinds of button).
   */
  fitWith,
  onPress,
  onLongPress,
  tone = 'plain',
  on = false,
  disabled = false,
  /* Working on its press (ComputerCard's Switching…): said busy to a screen reader, and drawn in full. */
  busy = false,
  grow = false,
  height = TAP,
  /* The label's size, for the one button whose label is the headline: the
     preset name on the stage screen. Everything else keeps the body size. */
  labelSize = font.body,
  haptic = tick,
  style,
  /*
   * What a screen reader says instead of the visible words.
   *
   * Almost every button here reads fine off its own label. A stepper does
   * not: "−" and "+" are shapes, and a person who cannot see which control
   * they sit either side of is told nothing at all. Passing this was silently
   * ignored before, which is worse than not offering it.
   */
  accessibilityLabel,
  /* What a hold does, where a button has one nobody can see: "Hold to give it a colour". */
  accessibilityHint
}) {
  const accent = tone === 'signal' ? color.signal : tone === 'live' ? color.live : color.silk
  const background = on ? accent : color.panel
  const ink = on ? color.onSignal : disabled ? color.silkFaint : color.silk

  /* The button's own width, and how wide the label and the line under it are at their usual sizes, from the unseen copy below. */
  const [box, setBox] = useState(() => (fit ? BOXES.get(label) || 0 : 0))
  const [, remeasured] = useState(0)
  const scale = fit ? PixelRatio.getFontScale() : 1
  const labelKey = `${labelSize}|${scale}|${label}`
  const shownUnder = under || '\u00a0'
  const underKey = `${font.micro}|${scale}|${shownUnder}`
  const measuredLabel = (e) => {
    const { width, height } = e.nativeEvent.layout
    if (LABELS.get(labelKey) === width && TALL.get(labelKey) === height) return
    LABELS.set(labelKey, width)
    TALL.set(labelKey, height)
    remeasured((n) => n + 1)
  }
  const measuredBeside = (key) => (e) => {
    const { width } = e.nativeEvent.layout
    if (LABELS.get(key) === width) return
    LABELS.set(key, width)
    remeasured((n) => n + 1)
  }
  const measuredUnder = (e) => {
    const { width } = e.nativeEvent.layout
    if (NAMES.get(underKey) === width) return
    if (NAMES.size >= NAMES_KEPT) NAMES.delete(NAMES.keys().next().value)
    NAMES.set(underKey, width)
    remeasured((n) => n + 1)
  }
  const step = fit
    ? fitStep({
        box,
        pad: space.md,
        border: BORDER,
        gap: space.sm,
        picture: PICTURE,
        pictures: (icon ? 1 : 0) + (after ? 1 : 0),
        word: LABELS.get(labelKey) || 0,
        size: labelSize,
        under: NAMES.get(underKey) || 0,
        underSize: font.micro
      })
    : null
  /* Each word beside it fitted the same way, from its own unseen copy below, and the row drawn at the smallest. */
  const besideKeys = fit && Array.isArray(fitWith) ? fitWith.map((t) => `${labelSize}|${scale}|${t}`) : []
  const besideSizes = besideKeys
    .filter((k) => LABELS.has(k))
    .map((k) => fitStep({ box, pad: space.md, border: BORDER, gap: space.sm, picture: PICTURE, pictures: (icon ? 1 : 0) + (after ? 1 : 0), word: LABELS.get(k), size: labelSize }).label.size)
  const own = step ? step.label : { size: labelSize, fits: true }
  const word = besideSizes.length ? { ...own, size: Math.min(own.size, ...besideSizes) } : own
  const bare = step ? step.bare : false
  const line = step ? step.line : { size: font.micro, fits: true }
  /* A new name is drawn once it is measured, never first at the last one's size: its line keeps its height, so nothing moves. */
  const lineWaits = fit && under !== undefined && !NAMES.has(underKey)
  /* The row is as tall as the label at its usual size, so a fitted word sits level with an unfitted one beside it at any text size. */
  const rowTall = fit ? Math.max(PICTURE, TALL.get(labelKey) || 0) : undefined

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: on, disabled, busy }}
      accessibilityLabel={accessibilityLabel || [caption, label, sub].filter(Boolean).join(', ')}
      accessibilityHint={accessibilityHint}
      disabled={disabled}
      onPress={() => {
        haptic?.()
        fire(`press ${said(caption, label)}`, onPress)
      }}
      /* A hold is a different thing from a press, and RN keeps them apart: a
         press that becomes a hold never fires onPress. Only wired when asked
         for, so a button with nothing to hold ignores a slow finger. */
      onLongPress={
        onLongPress
          ? () => {
              haptic?.()
              fire(`hold ${said(caption, label)}`, onLongPress)
            }
          : undefined
      }
      delayLongPress={450}
      onLayout={
        fit
          ? (e) => {
              const w = e.nativeEvent.layout.width
              BOXES.set(label, w)
              setBox((was) => (was === w ? was : w))
            }
          : undefined
      }
      style={({ pressed }) => [
        {
          minHeight: height,
          flexGrow: grow ? 1 : 0,
          flexBasis: grow ? 0 : 'auto',
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: space.md,
          paddingVertical: under !== undefined ? space.xs : space.sm,
          borderRadius: radius.md,
          borderWidth: BORDER,
          borderColor: on ? accent : color.rule,
          backgroundColor: background,
          opacity: disabled ? 0.45 : pressed ? 0.7 : 1
        },
        style
      ]}
    >
      {/* As tall as a picture even when the pictures give way, so a fitted Previous sits level with Next. */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: rowTall }}>
        {icon && !bare ? <Picture source={icon} tint={ink} flip={flip} /> : null}
        <View style={{ alignItems: 'center', flexShrink: 1 }}>
          {/*
            A word ABOVE the label, for the one button whose name does not say
            what it is. "All" between Previous and Next reads as a caption; the
            word Source over it says that pressing it changes what those two do.
          */}
          {caption ? (
            <Text
              numberOfLines={1}
              style={{
                color: on ? color.onSignal : color.silkFaint,
                fontSize: font.micro,
                letterSpacing: 1.2,
                textTransform: 'uppercase',
                marginBottom: 1
              }}
            >
              {caption}
            </Text>
          ) : null}
          <Text
            numberOfLines={1}
            /* A last guard where a system text size grows text faster than its size (Android 14's large scales): never below the floor. */
            adjustsFontSizeToFit={fit || undefined}
            minimumFontScale={fit ? Math.min(1, STEP_WORD_LEAST / word.size) : undefined}
            style={{
              color: ink,
              fontSize: word.size,
              fontWeight: labelSize > font.body ? '700' : '600',
              textAlign: 'center'
            }}
          >
            {label}
          </Text>
          {/*
            Two lines, not one: "Help text cut off mid-sentence." The line
            under a button is the one that says what it will do, and cut at
            the width of the button it said half of that.
          */}
          {sub ? (
            <Text
              numberOfLines={2}
              style={{
                color: on ? color.onSignal : color.silkDim,
                fontSize: font.micro,
                marginTop: 2,
                textAlign: 'center'
              }}
            >
              {sub}
            </Text>
          ) : null}
        </View>
        {after && !bare ? <Picture source={after} tint={ink} /> : null}
      </View>
      {under !== undefined ? (
        <Text
          numberOfLines={1}
          style={{
            alignSelf: 'stretch',
            marginHorizontal: fit ? -(space.md - STEP_LINE_EDGE) : 0,
            opacity: lineWaits ? 0 : 1,
            color: on ? color.onSignal : color.silkDim,
            fontSize: line.size,
            lineHeight: UNDER_LINE,
            marginTop: 2,
            textAlign: 'center'
          }}
        >
          {under || '\u00a0'}
        </Text>
      ) : null}
      {/*
        The unseen copy `fit` measures: the label and the line at their usual
        sizes, each as wide as it is when nothing cuts it. Laid out in a wide
        box of no height, so it never shows, never takes a touch, and is
        never read out.
      */}
      {fit ? (
        <View pointerEvents="none" accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={MEASURE}>
          <Text numberOfLines={1} onLayout={measuredLabel} style={{ fontSize: labelSize, fontWeight: labelSize > font.body ? '700' : '600' }}>
            {label}
          </Text>
          {(fitWith || []).map((t, i) => (
            <Text key={t} numberOfLines={1} onLayout={measuredBeside(besideKeys[i])} style={{ fontSize: labelSize, fontWeight: labelSize > font.body ? '700' : '600' }}>
              {t}
            </Text>
          ))}
          {under !== undefined ? (
            <Text numberOfLines={1} onLayout={measuredUnder} style={{ fontSize: font.micro }}>
              {shownUnder}
            </Text>
          ) : null}
        </View>
      ) : null}
      {badge ? (
        <View pointerEvents="none" style={{ position: 'absolute', top: space.sm, right: space.sm }}>
          {badge}
        </View>
      ) : null}
    </Pressable>
  )
}

/**
 * The picture on a button.
 *
 * Silent to a screen reader on purpose — the Pressable above already carries
 * the words, and a chevron that announced itself would make Next read out
 * twice. Sized once here so every button in the row agrees.
 */
function Picture({ source, tint, flip = false }) {
  return (
    <Image
      source={source}
      accessible={false}
      resizeMode="contain"
      style={{ width: 20, height: 20, tintColor: tint, transform: flip ? [{ scaleX: -1 }] : undefined }}
    />
  )
}

/* Where `fit` measures: wide enough that nothing in it wraps, and no height, so it is never seen. */
const MEASURE = { position: 'absolute', left: 0, top: 0, width: 2000, height: 0, overflow: 'hidden', opacity: 0, alignItems: 'flex-start' }

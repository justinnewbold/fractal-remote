import { Image, Pressable, Text, View } from 'react-native'

import { color, font, radius, space, TAP } from '../lib/theme'
import { tick } from '../lib/feedback'
import { fire, said } from '../lib/tapped'

/* The height of the line under a button (`under`), fixed so a name arriving never moves anything. */
export const UNDER_LINE = 14

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
          borderWidth: 1,
          borderColor: on ? accent : color.rule,
          backgroundColor: background,
          opacity: disabled ? 0.45 : pressed ? 0.7 : 1
        },
        style
      ]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
        {icon ? <Picture source={icon} tint={ink} flip={flip} /> : null}
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
            style={{
              color: ink,
              fontSize: labelSize,
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
        {after ? <Picture source={after} tint={ink} /> : null}
      </View>
      {under !== undefined ? (
        <Text
          numberOfLines={1}
          style={{
            alignSelf: 'stretch',
            color: on ? color.onSignal : color.silkDim,
            fontSize: font.micro,
            lineHeight: UNDER_LINE,
            marginTop: 2,
            textAlign: 'center'
          }}
        >
          {under || '\u00a0'}
        </Text>
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

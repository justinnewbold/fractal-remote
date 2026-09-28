import { Image, Platform, Pressable, Text, View } from 'react-native'

import { color, font, isDark, radius, space, TAP } from '../lib/theme'
import { at, inkOn, lighter, vivid } from '../lib/vivid'
import { tick } from '../lib/feedback'
import { fire, said } from '../lib/tapped'

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
export default function Tile({
  label,
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
   * THE HUE IS THE PALETTE'S; THE VIBRANCY IS THIS SCREEN'S.
   *
   * `vivid` lifts saturation and leaves hue exactly where it was, so a drive
   * is still the red the unit shows and a delay is still the same blue — see
   * lib/vivid for why that distinction is worth a function. It is applied here
   * rather than in the palettes because those are shared with the browser, and
   * repainting the computer app was not what was asked for.
   *
   * Off is the same hue at a seventh, over the chassis, rather than a flat
   * panel: the tile stays recognisably its own colour while being obviously
   * unlit, which is the distinction the whole grid rests on.
   */
  const hue = vivid(fill)
  const background = on ? hue : at(hue, 0.14)
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
  const foreground = on ? lit : color.silk
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
  const unlitPicture = isDark() ? lighter(hue, 0.35) : hue
  const pictureTint = on ? lit : unlitPicture
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

  const glow = on
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
      accessibilityLabel={[label, topLeft, topRight, sub, caption].filter(Boolean).join(', ')}
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
          borderWidth: 2,
          borderColor: on ? at(hue, 0.85) : at(hue, 0.55),
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
      {on ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 0,
            height: '50%',
            borderTopLeftRadius: radius.md - 2,
            borderTopRightRadius: radius.md - 2,
            backgroundColor: 'rgba(255,255,255,0.10)'
          }}
        />
      ) : null}
      {cornered ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: 5,
            right: 5,
            top: 3,
            flexDirection: 'row',
            justifyContent: 'space-between'
          }}
        >
          <Text numberOfLines={1} style={{ color: on ? lit : color.silkDim, fontSize: font.micro, fontWeight: '600' }}>
            {topLeft || ''}
          </Text>
          <Text numberOfLines={1} style={{ color: on ? lit : color.silkDim, fontSize: font.micro, fontWeight: '700' }}>
            {topRight || ''}
          </Text>
        </View>
      ) : null}
      <View style={{ alignItems: 'center' }}>
        {picture ? (
          <Image
            source={icon}
            /* Silent: the Pressable above already says the block's name and
               state, and a second announcement for the picture of it would
               make every tile read itself out twice. */
            accessible={false}
            style={{ width: picture, height: picture, marginBottom: 2, tintColor: pictureTint }}
            resizeMode="contain"
          />
        ) : null}
        {caption ? (
          <Text
            numberOfLines={1}
            style={{ color: on ? lit : color.silkDim, fontSize: font.micro, marginBottom: 1 }}
          >
            {caption}
          </Text>
        ) : null}
        <Text
          numberOfLines={1}
          style={{
            color: foreground,
            fontSize: font.body,
            fontWeight: '700',
            letterSpacing: 0.5,
            textAlign: 'center'
          }}
        >
          {label}
        </Text>
        {sub ? (
          <Text
            numberOfLines={1}
            style={{ color: on ? lit : color.silkDim, fontSize: font.micro, marginTop: 2 }}
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

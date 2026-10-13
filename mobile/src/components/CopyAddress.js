import { useState } from 'react'
import { Image, Platform, Pressable, Text, View } from 'react-native'
import * as Clipboard from 'expo-clipboard'

import { color, font, mono, radius, space } from '../lib/theme'
import { P6 } from '../lib/onboarding'
import { tick } from '../lib/feedback'
import { DOWNLOADS_URL } from '../lib/downloadLink'
import copyIcon from '../../assets/icons/copy.png'
import checkIcon from '../../assets/icons/check.png'

const face = Platform.select(mono)

/* Just after the address's slash: "fractal.newbold.cloud/" and "downloads". */
const CUT = DOWNLOADS_URL.indexOf('/') + 1

/*
 * THE ADDRESS IN A SENTENCE, given one place to break: after its slash.
 *
 * Read as one long word, the address in a narrow card can split wherever
 * the line runs out, as "…cloud/download" and "s", and "/download" is the
 * web app rather than the downloads page. A zero-width space after the
 * slash is a place to break that draws nothing, and only a line too short
 * for the whole address uses it. The card's text cannot be selected, so
 * nobody copies the space along with it; the box below copies the address
 * itself.
 */
export const breakableAddress = (text) =>
  text.replace(DOWNLOADS_URL, `${DOWNLOADS_URL.slice(0, CUT)}\u200B${DOWNLOADS_URL.slice(CUT)}`)

/**
 * THE DOWNLOADS ADDRESS, AND A TAP COPIES IT.
 *
 * "Is it possible to make the computer link able to just be copied if they
 * tap it? And then a confirmation that it was copied." A Mac on the same
 * Apple account pastes what the iPhone copied, and anybody can paste it into
 * an email to themselves.
 *
 * Copied, never opened: the page at the far end holds installers for a
 * computer, and a tap that opened it would start fetching one onto the phone
 * — which is why this was printed rather than pressable in the first place.
 * The copy carries https:// so it pastes as a link.
 *
 * On the walkthrough's "installed?" step and the phone's Connect screen.
 */
/*
 * `row` is the Connect a computer page's version, from his mockup: the
 * address in a box, one line, with a square copy button at its right end
 * that turns into a tick once it has copied. The card version stays for the
 * walkthrough, where the whole card is the button.
 */
/*
 * `saidSize` is the size of the "Copied." line under the row. Small on
 * Connect a computer; body size on Updating the computer app, where every
 * line is in type that can be read at arm's length.
 *
 * `split` draws the row's address on two lines, broken after the slash, for
 * the same page. On one line the 31 characters at 18pt need about 336pt
 * beside the copy button, so it shrank to fit: to about 14pt on a 375-wide
 * iPhone and 11.5pt on a 320-wide one, under the page's 15pt. Its first line
 * alone is 22 characters, about 238pt, so it stays at 18pt from 360 wide
 * and goes no smaller than about 16pt at 320. The break is a line end of its
 * own rather than a place the phone may choose, because a phone that cannot
 * fit the first line breaks it wherever the line runs out and calls two
 * lines a fit, while a line end leaves it only the one way to fit: smaller.
 */
export default function CopyAddress({ size = font.body, row = false, saidSize = font.small, split = false }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await Clipboard.setStringAsync(`https://${DOWNLOADS_URL}`)
      tick()
      setCopied(true)
    } catch {
      /* Nothing to say: the address is on screen to read either way. */
    }
  }
  if (row) {
    return (
      <View style={{ gap: space.sm }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${DOWNLOADS_URL}. ${P6.copyHint}`}
          onPress={copy}
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            gap: space.sm,
            paddingLeft: space.md,
            paddingRight: space.sm,
            paddingVertical: space.sm,
            borderRadius: radius.md,
            borderWidth: 1,
            borderColor: copied ? color.signal : color.rule,
            backgroundColor: pressed ? color.panelHi : color.chassis
          })}
        >
          <Text
            numberOfLines={split ? 2 : 1}
            adjustsFontSizeToFit
            minimumFontScale={0.6}
            style={{ flex: 1, color: color.silk, fontSize: size, fontFamily: face }}
          >
            {split ? `${DOWNLOADS_URL.slice(0, CUT)}\n${DOWNLOADS_URL.slice(CUT)}` : DOWNLOADS_URL}
          </Text>
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: radius.md,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: copied ? color.signal : color.panelHi
            }}
          >
            <Image
              source={copied ? checkIcon : copyIcon}
              style={{ width: 22, height: 22, tintColor: copied ? color.onSignal : color.signal }}
            />
          </View>
        </Pressable>
        {copied ? (
          <Text style={{ color: color.signal, fontSize: saidSize, fontWeight: '700' }}>{P6.copied}</Text>
        ) : null}
      </View>
    )
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${DOWNLOADS_URL}. ${P6.copyHint}`}
      onPress={copy}
      style={({ pressed }) => ({
        gap: space.sm,
        padding: space.lg,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: copied ? color.signal : color.rule,
        backgroundColor: pressed ? color.panelHi : color.panel
      })}
    >
      {/* One line, shrunk to fit: it used to break as "download / s". */}
      <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} style={{ color: color.silk, fontSize: size, fontFamily: face }}>
        {DOWNLOADS_URL}
      </Text>
      <Text style={{ color: copied ? color.signal : color.silkDim, fontSize: font.small, fontWeight: copied ? '700' : undefined }}>
        {copied ? P6.copied : P6.copyHint}
      </Text>
    </Pressable>
  )
}

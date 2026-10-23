import { useRef, useState } from 'react'
import { Image, Platform, Text, View } from 'react-native'

import { color, font, radius, space } from '../lib/theme'
import { SHOTS_MAX, SHOT_WORDS, pasteWords, thumbSize, withShot } from '../lib/report-rules'
import { pasteShot } from '../lib/shots'
import Note from './Note'
import Press from './Press'

/**
 * How to copy a screenshot so it can be pasted, for the phone in hand.
 *
 * Checked on 22 and 23 October 2026. An iPhone or iPad on iOS 26 or 27 opens
 * a new screenshot full screen, with a check mark at the top right; with
 * Full-Screen Previews off it is a little picture in the corner, and tapping
 * it opens the same full screen, check mark and all. Before iOS 26 the button
 * there says Done. Either way, Copy and Delete puts it on the clipboard and
 * keeps it out of the photo library.
 *
 * Android has no Copy on its own screenshot preview, and the way to copy a
 * picture differs by maker. On a Pixel (Android 15 and 16) any picture on
 * screen can be copied from Recent apps: hold it, or on the March 2026 update
 * and later tap Select, then the picture, then Copy. That is the Pixel's own:
 * a Samsung's Recent apps has no Copy, and its Gallery has Copy to clipboard
 * under ⋮ instead. Both are named, as the support page names them. The photo
 * picker in docs/pending makes this one tap, with the next build.
 */
export function copyHint(os = Platform.OS) {
  return os === 'ios'
    ? 'To copy one: take a screenshot (if only a little picture shows in the corner, tap it), tap the check mark at the top right, then Copy and Delete. On older versions the button says Done.'
    : 'To copy one on a Pixel: open the screenshot in Photos, go to Recent apps, hold the picture (or tap Select, then the picture) and choose Copy. On a Samsung: open it in Gallery, tap ⋮, then Copy to clipboard.'
}

/**
 * Screenshots for a report: Paste a screenshot, what has been added as small
 * pictures, each with its own Remove, and the line saying how to copy one.
 *
 * `shots` is the list and `onChange` takes a function of it (a state
 * setter), so a paste that lands after a Remove adds to the list as it is
 * then. Up to SHOTS_MAX. Nothing here sends anything; the screen's own Send
 * hands the list to lib/reports.
 */
export default function Shots({ shots = [], onChange, disabled = false }) {
  const [said, setSaid] = useState(null)
  const [pasting, setPasting] = useState(false)
  const busy = useRef(false)
  const full = shots.length >= SHOTS_MAX

  const paste = async () => {
    if (busy.current) return
    if (full) {
      setSaid(SHOT_WORDS.full)
      return
    }
    busy.current = true
    setPasting(true)
    setSaid(null)
    try {
      const { shot, why } = await pasteShot()
      if (shot) onChange((list) => withShot(list, shot))
      else setSaid(pasteWords(why, Platform.OS))
    } finally {
      busy.current = false
      setPasting(false)
    }
  }

  return (
    <View style={{ gap: space.sm }}>
      {shots.length ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
          {shots.map((shot, i) => (
            <View key={`${i}-${shot.size}`} style={{ gap: space.xs, alignItems: 'center' }}>
              <Image
                source={{ uri: shot.uri }}
                accessibilityLabel={`Screenshot ${i + 1}`}
                /* The whole picture, in its own shape (shared/report-rules thumbSize), as the browser shows it. */
                resizeMode="contain"
                style={{
                  ...thumbSize(shot.width, shot.height, 64),
                  borderRadius: radius.sm,
                  borderWidth: 1,
                  borderColor: color.rule,
                  backgroundColor: color.panel
                }}
              />
              <Press
                label="Remove"
                height={40}
                disabled={disabled}
                accessibilityLabel={`Remove screenshot ${i + 1}`}
                onPress={() => onChange((list) => list.filter((s) => s !== shot))}
              />
            </View>
          ))}
        </View>
      ) : null}
      <Press
        label={pasting ? 'Pasting…' : 'Paste a screenshot'}
        sub={shots.length ? `${shots.length} of ${SHOTS_MAX} added` : SHOT_WORDS.limit}
        height={48}
        disabled={disabled || pasting || full}
        onPress={paste}
      />
      {/* What a paste said, straight under the button tapped, so a short scroller never hides it under the hint. */}
      {said ? <Note tone="fault">{said}</Note> : null}
      <Text style={{ color: color.silkFaint, fontSize: font.micro, lineHeight: 18 }}>{copyHint()}</Text>
    </View>
  )
}

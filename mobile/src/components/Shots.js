import { useRef, useState } from 'react'
import { Image, Platform, Text, View } from 'react-native'

import { color, font, radius, space } from '../lib/theme'
import { SHOTS_MAX, SHOT_WORDS, withShot } from '../lib/report-rules'
import { pasteShot } from '../lib/shots'
import Note from './Note'
import Press from './Press'

/**
 * How to copy a screenshot so it can be pasted, for the phone in hand.
 *
 * Checked on 22 October 2026. An iPhone or iPad on iOS 26 or 27 opens a new
 * screenshot full screen, with a check mark at the top; on older versions, or
 * with Full-Screen Previews off, it is a little picture in the corner to tap
 * first, and the button says Done. Either way, Copy and Delete puts it on the
 * clipboard and keeps it out of the photo library.
 *
 * Android has no Copy on its own screenshot preview. On a Pixel (Android 15
 * and 16) any picture on screen can be copied from Recent apps: hold it, or
 * on the March 2026 update and later tap Select, then the picture, then Copy.
 * Other phones vary, so the line says what to look for. The photo picker in
 * docs/pending makes this one tap, with the next build.
 */
export function copyHint(os = Platform.OS) {
  return os === 'ios'
    ? 'To copy one: take a screenshot, tap the check mark at the top (or tap the little picture, then Done), then Copy and Delete.'
    : 'To copy one: open the screenshot, go to Recent apps, then hold the picture (or tap Select, then the picture) and choose Copy.'
}

/** What a tap with nothing on the clipboard says. On an iPhone the same nothing comes back when Allow Paste was not chosen. */
export function emptyWords(os = Platform.OS) {
  return os === 'ios'
    ? 'There’s no picture to paste. Copy a screenshot first, and choose Allow Paste if you are asked.'
    : 'There’s no picture to paste. Copy a screenshot first.'
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
      else setSaid(why === 'empty' ? emptyWords() : SHOT_WORDS[why] || SHOT_WORDS.unreadable)
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
                resizeMode="cover"
                style={{
                  width: 64,
                  height: shot.width && shot.height ? Math.min(128, Math.round((64 * shot.height) / shot.width)) : 96,
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
      <Text style={{ color: color.silkFaint, fontSize: font.micro, lineHeight: 18 }}>{copyHint()}</Text>
      {said ? <Note tone="fault">{said}</Note> : null}
    </View>
  )
}

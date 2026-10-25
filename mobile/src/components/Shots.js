import { useRef, useState } from 'react'
import { Image, Platform, Text, View } from 'react-native'

import { color, font, radius, space } from '../lib/theme'
import { SHOTS_MAX, SHOT_WORDS, pasteWords, thumbSize, withShot } from '../lib/report-rules'
import { pasteShot, pickShots } from '../lib/shots'
import Note from './Note'
import Press from './Press'

/**
 * How to copy a screenshot so it can be pasted, for the phone in hand.
 *
 * Checked on 22 and 23 October 2026. An iPhone or iPad on iOS 26 or 27 opens
 * a new screenshot full screen, with a check mark at the top right; with
 * Full-Screen Previews off it is a little picture in the corner, and tapping
 * it opens the same full screen, check mark and all. Before iOS 26 the button
 * there says Done, and it is at the top LEFT (the top right holds share and
 * delete), so the words say which corner for each (second review). Either
 * way, Copy and Delete puts it on the clipboard and keeps it out of the
 * photo library.
 *
 * Android has no Copy on its own screenshot preview, and the way to copy a
 * picture differs by maker, so there Choose a screenshot comes first: the
 * phone's own photo picker, where screenshots are a folder of their own.
 * Paste stays for a picture already copied.
 */
export function copyHint(os = Platform.OS) {
  return os === 'ios'
    ? 'Choose one from your photos, or copy one to paste: take a screenshot (if only a little picture shows in the corner, tap it), tap the check mark at the top right, then Copy and Delete. On older versions, tap Done at the top left instead.'
    : 'Choose one from your photos (screenshots have a folder of their own), or paste one you have copied.'
}

/* What a picked picture that could not be used says: in the picker's words, never a file format. */
const PICK_WORDS = {
  tooBig: 'That picture is too big to send, even made smaller. Choose a screenshot instead.',
  unreadable: 'That picture couldn’t be opened. Choose another one.'
}

/**
 * Screenshots for a report: Paste a screenshot, what has been added as small
 * pictures, each with its own Remove, and the line saying how to copy one.
 *
 * `shots` is the list and `onChange` takes a function of it (a state
 * setter), so a paste that lands after a Remove adds to the list as it is
 * then. Up to SHOTS_MAX. Nothing here sends anything; the screen's own Send
 * hands the list to lib/reports.
 *
 * What a paste says goes under its button, or to `say` when the screen
 * gives one: the log screen does, so it is said in the fixed foot under
 * Send, where nothing scrolls it out of sight. In the log screen's short
 * scroller it was cut off below the edge, the Settings path with it, the one
 * way back once the iPhone stops asking (second review, 23 October 2026).
 */
export default function Shots({ shots = [], onChange, disabled = false, say }) {
  const [own, setOwn] = useState(null)
  const setSaid = say || setOwn
  const said = say ? null : own
  const [pasting, setPasting] = useState(false)
  const [picking, setPicking] = useState(false)
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

  /* The phone's own photo picker, for as many as there is room for. */
  const choose = async () => {
    if (busy.current || full) return
    busy.current = true
    setPicking(true)
    setSaid(null)
    try {
      const { shots: got, why } = await pickShots(SHOTS_MAX - shots.length)
      if (got.length) onChange((list) => got.reduce((all, shot) => withShot(all, shot), list))
      if (why) setSaid(why === 'full' ? SHOT_WORDS.full : PICK_WORDS[why] || PICK_WORDS.unreadable)
    } finally {
      busy.current = false
      setPicking(false)
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
                /* Opened at the thumbnail's size on Android, not as the whole screenshot of up to 1600
                   across: thumbSize always gives it a size, so it never waits for one it will not get. */
                resizeMethod="resize"
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
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <Press
          grow
          label={picking ? 'Opening…' : 'Choose a screenshot'}
          height={48}
          disabled={disabled || pasting || picking || full}
          onPress={choose}
        />
        <Press
          grow
          label={pasting ? 'Pasting…' : 'Paste a screenshot'}
          height={48}
          disabled={disabled || pasting || picking || full}
          onPress={paste}
        />
      </View>
      <Text style={{ color: color.silkDim, fontSize: font.micro }}>
        {shots.length ? `${shots.length} of ${SHOTS_MAX} added` : SHOT_WORDS.limit}
      </Text>
      {/* What a paste or a pick said, straight under the buttons tapped, when the screen has nowhere better for it. */}
      {said ? <Note tone="fault">{said}</Note> : null}
      <Text style={{ color: color.silkFaint, fontSize: font.micro, lineHeight: 18 }}>{copyHint()}</Text>
    </View>
  )
}

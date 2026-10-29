import { useRef, useState } from 'react'
import { Image, Platform, Text, View } from 'react-native'

import { color, font, radius, space } from '../lib/theme'
import { SHOTS_MAX, SHOT_WORDS, mbWords, pasteWords, thumbSize, videoLength, withShot } from '../lib/report-rules'
import { pasteShot, pickMedia } from '../lib/shots'
import Note from './Note'
import Press from './Press'

/* What a picked picture that could not be used says: in the picker's words, never a file format. */
const PICK_WORDS = {
  tooBig: 'That picture is too big to send, even made smaller. Choose a screenshot instead.',
  unreadable: 'That picture couldn’t be opened. Choose another one.'
}

/**
 * PHOTOS AND A VIDEO FOR A REPORT: "upload a photo or video" (Justin, 29
 * October 2026). Add a photo or video opens the phone's own picker for both
 * (lib/shots pickMedia): up to SHOTS_MAX pictures, each made smaller as a
 * screenshot always was, and one video, sent as it is from the phone. Paste
 * a screenshot stays beside it for a picture already copied, which is the
 * quickest way on an iPhone ("Copy and Delete" on a new screenshot).
 *
 * `shots` and `onShots` are the pictures (a state setter, so a paste that
 * lands after a Remove adds to the list as it is then), `video` and
 * `onVideo` the one video or null. Nothing here sends anything; the
 * screen's own Send hands them to lib/reports.
 *
 * Built beside components/Shots, which the log screen keeps: there a report
 * goes in one tap and carries screenshots only.
 */
export default function Attach({ shots = [], onShots, video = null, onVideo, disabled = false }) {
  const [said, setSaid] = useState(null)
  const [pasting, setPasting] = useState(false)
  const [picking, setPicking] = useState(false)
  const busy = useRef(false)
  const room = SHOTS_MAX - shots.length
  const full = room <= 0 && !!video

  const paste = async () => {
    if (busy.current) return
    if (room <= 0) {
      setSaid(SHOT_WORDS.full)
      return
    }
    busy.current = true
    setPasting(true)
    setSaid(null)
    try {
      const { shot, why } = await pasteShot()
      if (shot) onShots((list) => withShot(list, shot))
      else setSaid(pasteWords(why, Platform.OS))
    } finally {
      busy.current = false
      setPasting(false)
    }
  }

  const choose = async () => {
    if (busy.current || full) return
    busy.current = true
    setPicking(true)
    setSaid(null)
    try {
      const got = await pickMedia(room, !video)
      if (got.shots.length) onShots((list) => got.shots.reduce((all, shot) => withShot(all, shot), list))
      if (got.video) onVideo(got.video)
      const words = [got.why ? (got.why === 'full' ? SHOT_WORDS.full : PICK_WORDS[got.why] || PICK_WORDS.unreadable) : '', got.videoWhy || '']
      setSaid(words.filter(Boolean).join(' ') || null)
    } finally {
      busy.current = false
      setPicking(false)
    }
  }

  const tile = { borderRadius: radius.sm, borderWidth: 1, borderColor: color.rule, backgroundColor: color.panel }

  return (
    <View style={{ gap: space.sm }}>
      {shots.length || video ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
          {shots.map((shot, i) => (
            <View key={`${i}-${shot.size}`} style={{ gap: space.xs, alignItems: 'center' }}>
              <Image
                source={{ uri: shot.uri }}
                accessibilityLabel={`Picture ${i + 1}`}
                /* As components/Shots draws them: opened near the size drawn, in the picture's own shape. */
                resizeMethod="resize"
                resizeMultiplier={1.5}
                resizeMode="contain"
                style={{ ...thumbSize(shot.width, shot.height, 64), ...tile }}
              />
              <Press
                label="Remove"
                height={40}
                disabled={disabled}
                accessibilityLabel={`Remove picture ${i + 1}`}
                onPress={() => onShots((list) => list.filter((s) => s !== shot))}
              />
            </View>
          ))}
          {video ? (
            <View style={{ gap: space.xs, alignItems: 'center' }}>
              {/* No picture of a video without a new package, so its length and size, which are what tell one from another. */}
              <View
                accessible
                accessibilityLabel={`Video${videoLength(video.duration) ? `, ${videoLength(video.duration)} long` : ''}, ${mbWords(video.size)}`}
                style={{ width: 64, height: 96, ...tile, alignItems: 'center', justifyContent: 'center', gap: space.xs }}
              >
                <Text style={{ color: color.silk, fontSize: font.title }}>▶</Text>
                <Text style={{ color: color.silkDim, fontSize: font.micro }}>{videoLength(video.duration) || 'Video'}</Text>
                {video.size ? <Text style={{ color: color.silkFaint, fontSize: font.micro }}>{mbWords(video.size)}</Text> : null}
              </View>
              <Press label="Remove" height={40} disabled={disabled} accessibilityLabel="Remove the video" onPress={() => onVideo(null)} />
            </View>
          ) : null}
        </View>
      ) : null}
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <Press
          grow
          label={picking ? 'Opening…' : 'Add a photo or video'}
          height={48}
          disabled={disabled || pasting || picking || full}
          onPress={choose}
        />
        <Press
          grow
          label={pasting ? 'Pasting…' : 'Paste a screenshot'}
          height={48}
          disabled={disabled || pasting || picking || room <= 0}
          onPress={paste}
        />
      </View>
      <Text style={{ color: color.silkDim, fontSize: font.micro }}>
        {`Up to ${SHOTS_MAX} pictures and one video. Pictures are made smaller before they go.`}
      </Text>
      {/* What a paste or a pick said, straight under the buttons tapped. */}
      {said ? <Note tone="fault">{said}</Note> : null}
    </View>
  )
}

import { useState } from 'react'
import { Platform, Text, View, useWindowDimensions } from 'react-native'

import { color, font, mono, space, TAP } from '../lib/theme'
import Note from './Note'
import Press from './Press'
import { setEdgeFlash, setMetronome, setMetronomeSound, useEdgeFlash, useMetronome, useUnitHeardOn } from '../lib/metronome'
import { PLACES, beatMs, clicks, placeLit, placesFor, unitClick } from '../lib/metronome-rules'
import { EDGE_WORDS, SOUND_WORDS, deviceSounds, soundChoices, soundLine, soundLit } from '../lib/edgeFlash'
import { useRig } from '../lib/rig'
import { useDemo } from '../lib/demo'
import { useBluetoothOn } from '../lib/bluetooth'
import { deviceNoun } from '../lib/device-word'

const face = Platform.select(mono)
const ofSlug = (s) => s.deviceSlug
const ofBpm = (s) => s.bpm
/* Each part a sentence: the place notes are written as labels, with no full stop. */
const sentence = (t) => (/[.!?]$/.test(t) ? t : `${t}.`)
/*
 * The shortest window the sound row and the flash are drawn in. They add two
 * rows of buttons to a pop-up that has no scrolling in it (the slider above
 * is why: components/Volume), and on a window shorter than this, a phone on
 * its side, the Done button would be pushed off the bottom. There the
 * pop-up keeps only on and off, as it was, and Settings → Metronome has the
 * rest, where the page scrolls.
 */
const ROOM_FOR_CHOICES = 600

/**
 * THE METRONOME, ON AND OFF, IN THE VOLUME POP-UP.
 *
 * "Make it so the metronome can be turned on and off in the volume section
 * of the app." The volume pop-up is the one thing on Play that opens over
 * the screen for a moment and goes again, which is exactly how a click is
 * wanted between songs: on for the count-in, off for the song.
 *
 * Only on and off, for every account but one offered the choices below.
 * Where it clicks (Unit, Phone, Both) is chosen once, in Settings →
 * Metronome, and this says which in a line. The unit is written exactly as
 * Settings writes it — the same setMetronome, the same "here" — so the two
 * can never disagree about whether the unit's own click was told.
 *
 * THE SOUND AND THE FLASH, HERE TOO (16 November 2026, lib/edgeFlash has
 * the why). "Add a feature where you can either have sound on, sound off,
 * or you can have it flash on the phone with sound or flash on the phone
 * without sound on the phone only with sound playing on the phone, or on
 * the device only playing with sound." Under the switch, for an account
 * offered them and never in the tempo box: one row for the sound (Off, this
 * device, Unit, Both: only Off and the device where the unit's own click
 * cannot be switched), and the flash's own switch. Every one of his is a
 * pair of those. The words on each are words, the one lit is said selected,
 * and the line under them says what the metronome does now.
 *
 * And in the tempo box, the same switch: "can we add the metronome on and off
 * to this screen as well so they can quickly turn the metronome on and off?"
 * Not a copy — this component, so the box writes the unit exactly as the
 * volume pop-up and Settings do and says the same line about where the click
 * is. `compact` is how the box differs, and only in what it shows:
 *
 *   - No heading. The METRONOME title and the unit's BPM beside it sat under
 *     a field that is already headed TEMPO and already holds the number, and
 *     a second, different figure under the one being typed reads as the box
 *     disagreeing with itself.
 *   - One block of words under the button, not two. "The unit didn't take
 *     it" takes the line's place rather than coming in under it, so the box
 *     is no taller at the moment it has the most to say. The box sits above
 *     a number pad; a note that pushed it down would put itself under the
 *     keys exactly when it is needed.
 *   - `lines`, the most that block may take. The box asks for two on a small
 *     phone, where four lines of Bluetooth would otherwise reach the keys;
 *     the whole of it stays here in the volume pop-up and in Settings.
 *
 * The fault is never cut short: it is two lines, and it is the one thing then
 * that has to be read.
 */
export default function MetronomeSwitch({ compact = false, lines }) {
  const setting = useMetronome()
  const slug = useRig(ofSlug)
  const bpm = useRig(ofBpm)
  const demo = useDemo()
  const bluetooth = useBluetoothOn()
  /* The same "here" as Settings → Metronome: not over Bluetooth, not on an AM4, not in the demo. */
  const clickHere = { bluetooth: bluetooth && !demo, demo }
  const unitCan = unitClick(slug, clickHere)
  const heard = useUnitHeardOn(slug)
  const [said, setSaid] = useState(null)
  /* The sound and the flash as choices: for an account offered them, in the pop-up, where there is room. */
  const choice = useEdgeFlash()
  const { height: tall } = useWindowDimensions()
  const choices = !compact && choice.offered && tall >= ROOM_FOR_CHOICES

  const TOLD = 'The unit didn’t take it. Check it’s connected, then try again.'
  const toggle = async () => {
    setSaid(null)
    const answer = await setMetronome({ on: !setting.on }, slug, clickHere)
    if (answer?.ok === false && !answer?.unsupported) setSaid(TOLD)
  }
  const pickSound = async (key) => {
    setSaid(null)
    const answer = await setMetronomeSound(key, slug, clickHere)
    if (answer?.ok === false && !answer?.unsupported) setSaid(TOLD)
  }

  const places = placesFor(unitCan.can)
  const sounds = soundChoices(places)
  const lit = soundLit({ quiet: choice.quiet, places, lit: (key) => placeLit(setting, key, unitCan.can) })
  const place = PLACES.find((p) => placeLit(setting, p.key, true))
  /* Said for an account offered the choices wherever it is drawn, the tempo box too: with the sound Off, "clicks out loud" would not be so. */
  const where = choice.offered
    ? choice.quiet || unitCan.can
      ? soundLine({ quiet: choice.quiet, edge: choice.on, where: place?.key, note: place?.note || '', unit: unitCan.can, demo, noun: deviceNoun() })
      : unitCan.why
    : unitCan.can
      ? place?.note || ''
      : unitCan.why
  const sounding = deviceSounds({ clicks: clicks(setting, unitCan.can, heard).phone, offered: choice.offered, quiet: choice.quiet })
  const untilHeard = unitCan.can && setting.on && setting.where === 'unit' && !heard ? `Until the unit says its click is on, the ${deviceNoun()} keeps time as well.` : ''
  const noTempo =
    setting.on && !beatMs(bpm)
      ? sounding
        ? `No tempo from the unit yet, so the ${deviceNoun()} has nothing to click to.`
        : choice.quiet && choice.on
          ? SOUND_WORDS.noTempo(deviceNoun())
          : ''
      : ''
  const line = [where, untilHeard, noTempo].filter(Boolean).map(sentence).join(' ')

  return (
    <View style={{ gap: space.sm }}>
      {!compact ? (
        <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <Text accessibilityRole="header" style={{ color: color.silkFaint, fontSize: font.micro, letterSpacing: 1.5 }}>
            METRONOME
          </Text>
          {Number.isFinite(bpm) ? (
            <Text style={{ color: color.silkDim, fontSize: font.body, fontFamily: face }}>{`${Math.round(bpm)} BPM`}</Text>
          ) : null}
        </View>
      ) : null}
      <Press label={setting.on ? 'Metronome on' : 'Metronome off'} tone="live" on={setting.on} height={TAP} onPress={toggle} />
      {choices ? (
        <>
          <Text accessibilityRole="header" style={{ color: color.silkFaint, fontSize: font.micro, letterSpacing: 1.5 }}>
            {SOUND_WORDS.section.toUpperCase()}
          </Text>
          {/* One row, each word fitted to its share of it at one size (Press fit): four words across the narrowest phone. */}
          <View accessibilityRole="radiogroup" accessibilityLabel={SOUND_WORDS.section} style={{ flexDirection: 'row', gap: space.sm }}>
            {sounds.map((c) => (
              <Press
                key={c.key}
                label={c.label}
                tone="live"
                on={c.key === lit}
                grow
                fit
                fitWith={sounds.filter((o) => o.key !== c.key).map((o) => o.label)}
                height={TAP}
                accessibilityLabel={SOUND_WORDS.said(c.label)}
                onPress={() => pickSound(c.key)}
              />
            ))}
          </View>
          <Press label={choice.on ? EDGE_WORDS.on : EDGE_WORDS.off} tone="live" on={choice.on} height={TAP} onPress={() => setEdgeFlash(!choice.on)} />
        </>
      ) : null}
      {compact && said ? (
        <Text accessibilityLiveRegion="polite" style={{ color: color.fault, fontSize: font.small, paddingHorizontal: space.sm }}>
          {said}
        </Text>
      ) : (
        <Text numberOfLines={compact ? lines : undefined} style={{ color: color.silkDim, fontSize: font.small, paddingHorizontal: space.sm }}>
          {line}
        </Text>
      )}
      {!compact && said ? (
        <Note tone="fault" onDismiss={() => setSaid(null)}>
          {said}
        </Note>
      ) : null}
    </View>
  )
}

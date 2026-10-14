import { useEffect, useRef, useState } from 'react'
import { Modal, Platform, Pressable, Text, View, useWindowDimensions } from 'react-native'
import { BlurView } from 'expo-blur'
import { at as tint } from '../lib/vivid'

import { color, font, mono, radius, space, TAP } from '../lib/theme'
import Note from './Note'
import Press from './Press'
import { useBluetoothOn } from '../lib/bluetooth'
import { useRig } from '../lib/rig'
import { NOT_CONNECTED } from '../lib/relay-rules'

const ofUnitTuner = (s) => s.unitTuner
/* In the words on the AM4's own menus, so he can find the setting from here. */
const NO_UNIT_TUNER = 'The AM4’s own tuner stays as it is: its Tuner setting has no MIDI number (SETUP > MIDI/Remote > Tuner).'

const face = Platform.select(mono)

/**
 * The needle, over everything else.
 *
 * "Tuner displays under the tuner button and isn't visible without scrolling."
 * It was drawn in the flow of a screen that scrolls, at the bottom, under the
 * button that turns it on — so switching the tuner on did nothing you could
 * see. Tuning is not a thing you do alongside something else: for as long as it
 * is on, it is the only thing on the screen, and it is the size of the screen.
 *
 * A modal rather than a panel, because it has to cover the link bar and the
 * preset and everything else. Tapping anywhere closes it and stops the tuner at
 * the unit, which is the gesture somebody makes without looking.
 *
 * WHY THE READING CAN BE ABSENT, which is most of why this file is longer than
 * a needle needs to be. `POST /tuner` is allowed over the relay, so a phone can
 * start the unit's tuner and then never see a reading: the relay bridges
 * discrete change events and deliberately filters the roughly eight-per-second
 * telemetry streams to keep the channel quiet, and the tuner is one of them. The
 * poll runs at the Mac and every answer stays there.
 *
 * So after five silent seconds it says exactly that, rather than showing a
 * needle that will never move while somebody stands there playing an open E.
 * Tracked by time rather than by a flag, so a newer host that does bridge the
 * stream lights this up with no change here.
 */
export default function Tuner({ reading, on, onClose, down = false }) {
  const [stalled, setStalled] = useState(false)
  /* Over Bluetooth there is no computer to blame: the unit itself is quiet. */
  const bluetooth = useBluetoothOn()
  /*
   * Whether the AM4's own tuner screen came up with this one. The phone opens
   * it with the number set under the AM4's Tuner setting, the one a MIDI
   * pedal uses; with none set there, the AM4 stays on its preset and this
   * says where to set one.
   */
  const unitTuner = useRig(ofUnitTuner)
  const lastAt = useRef(0)
  const { width } = useWindowDimensions()

  useEffect(() => {
    if (!reading) return
    lastAt.current = Date.now()
    setStalled(false)
  }, [reading])

  useEffect(() => {
    if (!on) {
      setStalled(false)
      return undefined
    }
    const since = Date.now()
    const timer = setTimeout(() => {
      if (lastAt.current < since) setStalled(true)
    }, 5000)
    return () => clearTimeout(timer)
  }, [on])

  const cents = reading?.cents ?? 0
  const inTune = Math.abs(cents) <= 3
  /* Clamped to the width of the bar. A string a whole tone flat is off the
     scale, and pinning the needle at the end is the honest picture of that. */
  const offset = Math.max(-50, Math.min(50, cents))
  const ink = inTune ? color.ok : color.signal

  /* The dial is as wide as the phone allows, less a comfortable margin. Read
     from the window rather than measured, because this covers the window. */
  const dial = Math.min(width - space.xl * 2, 420)

  return (
    <Modal visible={on} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Close the tuner"
        onPress={onClose}
        style={{ flex: 1 }}
      >
        {/*
          The glass. A real blur rather than a dark panel, because the thing
          underneath is a lit-up rig and the point of glass is that you can
          still tell it is there.
        */}
        <BlurView
          intensity={70}
          tint="dark"
          experimentalBlurMethod="dimezisBlurView"
          /*
           * NEARLY SOLID BEHIND IT. "Overlay opacity is too low for me. Is
           * there a need to see things behind the tuner? Maybe 0% so the
           * tuner is focused?" There is no need: on an Android phone the blur
           * often draws as barely anything, and scene names showed through
           * the middle of the reading. The screen behind goes almost black.
           */
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            padding: space.xl,
            backgroundColor: tint(color.chassis, 0.94)
          }}
        >
          <View
            style={{
              width: dial,
              alignItems: 'center',
              gap: space.lg,
              paddingVertical: space.xl,
              paddingHorizontal: space.lg,
              borderRadius: radius.lg * 2,
              /* A hairline of light along the edge, which is what makes a pane
                 of glass read as a pane rather than as a stain. */
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.14)',
              backgroundColor: color.panel,
              overflow: 'hidden'
            }}
          >
            {/* ------------------------------------------------------- note */}
            <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
              <Text
                accessibilityLabel={reading?.note ? `${reading.note}${reading.octave ?? ''}` : 'no note'}
                accessibilityLiveRegion="polite"
                style={{
                  color: reading?.note ? ink : color.silkFaint,
                  fontSize: Math.min(dial * 0.5, 160),
                  fontWeight: '800',
                  lineHeight: Math.min(dial * 0.55, 176)
                }}
              >
                {reading?.note || '—'}
              </Text>
              {reading?.octave !== undefined && reading?.note ? (
                <Text style={{ color: color.silkDim, fontSize: font.hero, fontFamily: face }}>
                  {reading.octave}
                </Text>
              ) : null}
            </View>

            {/* -------------------------------------------------------- bar */}
            <View
              style={{
                width: '100%',
                height: 22,
                borderRadius: radius.pill,
                backgroundColor: 'rgba(0,0,0,0.35)',
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.12)',
                justifyContent: 'center'
              }}
            >
              {/* Centre first, so the needle draws over it. */}
              <View
                style={{
                  position: 'absolute',
                  left: '50%',
                  width: 2,
                  marginLeft: -1,
                  top: 0,
                  bottom: 0,
                  backgroundColor: color.silkFaint
                }}
              />
              {/* Nothing to show is the centre, not wherever the last string
                  left it. */}
              <View
                style={{
                  position: 'absolute',
                  left: `${50 + (reading?.note ? offset : 0)}%`,
                  marginLeft: -11,
                  width: 22,
                  height: 22,
                  borderRadius: 11,
                  backgroundColor: ink
                }}
              />
            </View>

            {/*
              NOT CONNECTED, IN HERE TOO. "When the link drops, Play says so
              right away." The word Stage floats over the tiles is drawn
              under this: the tuner is a modal, over the whole screen and
              everything on it, the link bar as well. So with the tuner open
              the needle simply stopped and the screen said "Play a string"
              to somebody playing one, with no reason given. While the link
              is down this one line says it instead — the same line, the
              same size, so nothing in the pane moves when it comes or goes.
              Stop tuner below stays lit and works: a close always goes.
            */}
            <Text
              numberOfLines={1}
              accessibilityLiveRegion="polite"
              style={
                down
                  ? { color: color.fault, fontSize: font.lead, fontFamily: face, fontWeight: '700', letterSpacing: 2 }
                  : { color: color.silk, fontSize: font.lead, fontFamily: face }
              }
            >
              {down ? NOT_CONNECTED : reading?.note ? `${cents > 0 ? '+' : ''}${cents} cents` : 'Play a string'}
            </Text>

            {stalled && bluetooth ? (
              <Note tone="warn">
                The tuner is on, but the unit isn’t sending readings over Bluetooth. Use the unit’s own
                display for now.
              </Note>
            ) : stalled ? (
              <Note tone="warn">
                The tuner is running on the unit, but the readings aren’t reaching this phone — your
                computer keeps them to itself over a remote link. Use the unit’s own display, or tune at
                the computer.
              </Note>
            ) : null}

            {on && unitTuner === 'none' ? <Note>{NO_UNIT_TUNER}</Note> : null}

            <Press label="Stop tuner" height={TAP} tone="live" onPress={onClose} style={{ alignSelf: 'stretch' }} />
            <Text style={{ color: color.silkFaint, fontSize: font.micro }}>Tap anywhere to close</Text>
          </View>
        </BlurView>
      </Pressable>
    </Modal>
  )
}

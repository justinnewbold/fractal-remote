/*
 * THE WHEEL'S CLICK: a tick you hear and a small tap you feel, for each
 * preset that crosses the middle of the preset wheel (lib/presetWheel).
 *
 * "It makes like a clicking and a vibration kind of like the old iPod wheels
 * did" (Justin, 11 November 2026).
 *
 * THE TAP is the system's own selection tap, the one a date picker gives:
 * made for exactly this, and lighter than the tap a button gives.
 *
 * THE SOUND is the metronome's click, played quietly. It is a nicety, so it
 * is silent when the device is (the ringer switch off, or silent mode), and
 * it plays over whatever else the device is playing rather than stopping a
 * backing track: the quiet, mixing mode, set once, and only while the
 * metronome has not asked to be heard in silent mode (lib/audioMode).
 *
 * The players are made when the wheel opens and let go when it closes, so a
 * player who never chooses the wheel never loads a sound. Every call is
 * swallowed: a device that cannot click still scrolls.
 */
import { Platform } from 'react-native'
import { createAudioPlayer, setAudioModeAsync } from 'expo-audio'
import * as Haptics from 'expo-haptics'
import clickSound from '../../assets/click.wav'
import clickPadded from '../../assets/click-pad.wav'

import { isLoud } from './audioMode'

const IOS = Platform.OS === 'ios'
/* How loud, of the device's own volume: a tick under the thumb, not the metronome's beat. */
const VOLUME = 0.35
/* An iPhone plays a click from whichever player is free, so quick ones overlap; Android's one player starts again (the metronome's own two shapes). */
const PLAYERS = IOS ? 3 : 1

let players = null
let turn = 0
let users = 0

const quietly = (run) => {
  try {
    const done = run()
    if (done?.catch) done.catch(() => {})
  } catch {
    /* A device that cannot click still scrolls. */
  }
}

/** The wheel has opened: make the players. Counted, so two wheels on screen (a list beside Play and one in a third side) share them. */
export function openWheelClick() {
  users += 1
  if (players) return
  quietly(() => {
    if (!isLoud()) setAudioModeAsync({ playsInSilentMode: false, interruptionMode: 'mixWithOthers' }).catch(() => {})
    players = Array.from({ length: PLAYERS }, () => {
      const player = createAudioPlayer(IOS ? clickSound : clickPadded)
      player.volume = VOLUME
      return player
    })
    turn = 0
  })
}

/** The wheel has closed: let them go once nobody is using them. */
export function closeWheelClick() {
  users = Math.max(0, users - 1)
  if (users || !players) return
  const gone = players
  players = null
  for (const player of gone) quietly(() => player.remove())
}

/** One click: the tap, and the sound if the players are there. */
export function wheelClick() {
  quietly(() => Haptics.selectionAsync())
  if (!players) return
  quietly(() => {
    const player = players[turn]
    turn = (turn + 1) % players.length
    const back = player.seekTo(0)
    if (back?.catch) back.catch(() => {})
    player.play()
  })
}

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
 * IT HAS TO SOUND WHEN THE NAME CROSSES THE LINE, NOT AFTER. The first try
 * rewound a player and played it in the same breath, and let the device's
 * sound go to sleep between clicks, so each click waited for both: "doesn't
 * match up with the clicks properly" (Justin, the same day, on his phone).
 * So, the metronome's own two lessons (lib/metronome):
 *
 *   - an iPhone plays a player that was rewound BEFORE it was needed. Four
 *     players take turns, and the one played two clicks ago is rewound as
 *     this one plays, so it has had two clicks' time by its turn;
 *   - the device's sound is kept awake while a wheel is on screen
 *     (`keepAudioSessionActive`), and let go when the last wheel closes.
 *
 * Android plays its seek and its play in order, so one player does, with
 * the click that has silence in front for its fade-in.
 *
 * The players are made when the wheel opens and let go when it closes, so a
 * player who never chooses the wheel never loads a sound. Every call is
 * swallowed: a device that cannot click still scrolls.
 */
import { Platform } from 'react-native'
import { createAudioPlayer, setAudioModeAsync, setIsAudioActiveAsync } from 'expo-audio'
import * as Haptics from 'expo-haptics'
import clickSound from '../../assets/click.wav'
import clickPadded from '../../assets/click-pad.wav'

import { isLoud } from './audioMode'

const IOS = Platform.OS === 'ios'
/* How loud, of the device's own volume: a tick under the thumb, not the metronome's beat. */
const VOLUME = 0.35
/* Four on an iPhone, so the one whose turn it is was rewound two clicks ago; one on Android. */
const PLAYERS = IOS ? 4 : 1

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
      const player = IOS ? createAudioPlayer(clickSound, { keepAudioSessionActive: true }) : createAudioPlayer(clickPadded)
      player.volume = VOLUME
      return player
    })
    turn = 0
  })
}

/** The wheel has closed: let them go once nobody is using them, and the device's sound with them unless the metronome has it. */
export function closeWheelClick() {
  users = Math.max(0, users - 1)
  if (users || !players) return
  const gone = players
  players = null
  for (const player of gone) quietly(() => player.remove())
  if (IOS && !isLoud()) quietly(() => setIsAudioActiveAsync(false))
}

/** One click: the tap, and the sound if the players are there. */
export function wheelClick() {
  quietly(() => Haptics.selectionAsync())
  if (!players) return
  quietly(() => {
    if (!IOS) {
      const back = players[0].seekTo(0)
      if (back?.catch) back.catch(() => {})
      players[0].play()
      return
    }
    const now = players[turn]
    /* The one played two clicks ago, whose turn comes in two more: rewound now, never the one about to sound. */
    const next = players[(turn + 2) % players.length]
    turn = (turn + 1) % players.length
    now.play()
    const back = next.seekTo(0)
    if (back?.catch) back.catch(() => {})
  })
}

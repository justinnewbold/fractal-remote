import AsyncStorage from '@react-native-async-storage/async-storage'

import { SWIPE_HINT_KEY } from './swipe-hint'

/**
 * Whether the channel tip has been seen on this phone.
 *
 * ITS OWN KEY, NOT THE WALKTHROUGH'S, because the two are answered at
 * different moments and one must not silence the other. The walkthrough is
 * done the moment somebody reaches the Play screen; this tip has not been
 * shown yet at that point and may not be for a while, because it waits for a
 * preset whose blocks actually have channels. Sharing a key would mean
 * finishing the walkthrough cancelled a tip that was never drawn.
 *
 * DEFAULTS TO SEEN, the same as walkthroughSeen and for the same reason:
 * AsyncStorage answers late, and a tip that flashes up over somebody's rig
 * because storage had not replied yet is worse than a tip that never appears.
 * The real answer arrives a moment later and the card can open then.
 */
const KEY = 'fractal.coach.channels.v1'

export async function coachSeen() {
  try {
    return (await AsyncStorage.getItem(KEY)) === 'done'
  } catch {
    /* A phone refusing storage would otherwise meet this every launch. */
    return true
  }
}

export function markCoach() {
  AsyncStorage.setItem(KEY, 'done').catch(() => {
    /* Costs one more showing, and nothing else. */
  })
}

/*
 * The setlist's "Swipe left to remove a song", once per phone. Its own key,
 * so a phone that has already seen the channel tip still meets this one.
 */
export async function swipeHintSeen() {
  try {
    return (await AsyncStorage.getItem(SWIPE_HINT_KEY)) === 'done'
  } catch {
    return true
  }
}

export function markSwipeHint() {
  AsyncStorage.setItem(SWIPE_HINT_KEY, 'done').catch(() => {})
}

/*
 * "How the user uses the Apple Watch", once per phone, the first time the
 * Play screen finds a paired watch with the app on it. Shown on the phone
 * because the phone's words travel in an update and the watch's need a build.
 */
const WATCH_TIP_KEY = 'fractal.coach.watch.v1'

export async function watchTipSeen() {
  try {
    return (await AsyncStorage.getItem(WATCH_TIP_KEY)) === 'done'
  } catch {
    return true
  }
}

export function markWatchTip() {
  AsyncStorage.setItem(WATCH_TIP_KEY, 'done').catch(() => {})
}

/*
 * "Match your unit’s colors in Settings", once, on Play (components/
 * ColoursNotice): the colours start as the app's own, Fractal Remote, since
 * 19 October 2026, and Match my unit is a look on Settings → Colors.
 *
 * For everybody, a first run included, after the startup card and the
 * walkthrough (App draws those in place of Play, so the line is never under
 * them). A new key: the line before it ("Colours now match your unit",
 * under 'fractal.coloursNoticed') stopped being true when the default
 * changed, so somebody who heard that one hears this one once as well.
 * Remembered in memory too, so the write and a second read in the same
 * launch can never disagree.
 */
const COLOURS_KEY = 'fractal.coloursOffer.v1'
let coloursSettled = false

export async function coloursNoticeSeen() {
  if (coloursSettled) return true
  try {
    return (await AsyncStorage.getItem(COLOURS_KEY)) === 'done'
  } catch {
    return true
  }
}

export function markColoursNotice() {
  coloursSettled = true
  AsyncStorage.setItem(COLOURS_KEY, 'done').catch(() => {})
}

/*
 * Edit's note on what Bluetooth can and cannot do there (screens/Edit
 * BLE_NOTE), until its cross is pressed. "Make it so that this is a
 * dismissible thing, the only stays up temporarily, until they hit like an X."
 * Remembered when it is put away, not when it is shown, because it is the one
 * place that says a change made over Bluetooth is lost unless it is saved on
 * the unit: it stays until somebody has said they read it. A new key if the
 * words ever change enough to be read again.
 */
const BLE_EDIT_KEY = 'fractal.coach.bleEdit.v1'
let bleEditSettled = false

export async function bleEditNoteSeen() {
  if (bleEditSettled) return true
  try {
    return (await AsyncStorage.getItem(BLE_EDIT_KEY)) === 'done'
  } catch {
    return true
  }
}

export function markBleEditNote() {
  bleEditSettled = true
  AsyncStorage.setItem(BLE_EDIT_KEY, 'done').catch(() => {})
}

/*
 * PLAY'S ONE-TIME NOTES TAKE TURNS: ONE AT A TIME, IN THIS ORDER (Stage).
 *
 * The notes at the top of Play that come before the rest: a purchase made on
 * this phone that has not reached an account, first because it is money; the
 * demo VP4's sentence, what a real VP4 does not do from the app yet, before
 * anything is offered for one; then the demo card. After them, in Stage, the
 * quick tip on holding a block, how the watch is used, and last "Match your
 * unit’s colors in Settings".
 */
export const NOTE_TURNS = Object.freeze(['only', 'vp4', 'offer'])

/**
 * Whether a note before `which` has the turn: wants the top of Play (true),
 * or has not yet heard from the phone's storage (null), in `wants`, which
 * holds each note's own answer. With no `which`, whether any of them has it,
 * which is what everything after them waits for. Only false is "go ahead":
 * a note that has not answered yet would come up a moment later, over a
 * note that went first.
 */
export function turnTaken(wants, which) {
  const at = which === undefined ? NOTE_TURNS.length : NOTE_TURNS.indexOf(which)
  return NOTE_TURNS.slice(0, at < 0 ? NOTE_TURNS.length : at).some((k) => wants?.[k] !== false)
}

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
 * "Colours now match your unit · Settings → Colours", once, on Play, after
 * the update that changed them. Every tile on the stage changed colour in
 * one go, and somebody who had learned the old ones deserves to be told why
 * and where the way back is (Fractal Remote, the app's own look as it was).
 *
 * Only for somebody who HAD the app: a first run never saw the old colours,
 * so App marks this the moment it finds the walkthrough not yet done.
 * Remembered in memory too, because that write and the Play screen's read
 * can meet on the first launch and the read must not win.
 */
const COLOURS_KEY = 'fractal.coloursNoticed'
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
 * PLAY'S ONE-TIME NOTES TAKE TURNS: ONE AT A TIME, IN THIS ORDER (Stage).
 *
 * The notes at the top of Play that come before the rest: a purchase made on
 * this phone that has not reached an account, first because it is money; the
 * demo VP4's sentence, what a real VP4 does not do from the app yet, before
 * anything is offered for one; then the demo card. After them, in Stage, the
 * quick tip on holding a block, how the watch is used, and last "Colours now
 * match your unit".
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

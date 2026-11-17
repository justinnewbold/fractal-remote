import { useEffect, useSyncExternalStore } from 'react'
import { Platform } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { createAudioPlayer, setAudioModeAsync, setIsAudioActiveAsync } from 'expo-audio'
import clickSound from '../../assets/click.wav'
import clickPadded from '../../assets/click-pad.wav'

import { readUnitMetronome, setUnitMetronome } from './device'
import { DEFAULT_METRONOME, beatMs, clicks, flashLead, flashNudge, followSwitch, metronomeSetting, nextBeat, unitClick, unitMetronome } from './metronome-rules'
import { useRig } from './rig'
import { useBluetoothAdmin, useBluetoothOn } from './bluetooth'
import { isDemo } from './demo'
import { tick } from './feedback'
import { logDebug } from './debugLog'
import { isUnsupported } from './unsupported'
import { EDGE_KEY, QUIET_KEY, deviceSounds, edgeBeat, edgeChoiceOn, edgeKept, edgeToKeep, quietKept, quietToKeep, soundPicked } from './edgeFlash'
import { BEAT_LOCK_FOR_EVERYONE, METRONOME_FLASH_CHOICE_FOR_EVERYONE, METRONOME_LINE_UP_FOR_EVERYONE } from './features'
import { BEAT_LOCK, beatLockOn, heldOnWith, inStepWith, moveFor, sameTempo, slewPart } from './beatLock'
import { followUnitBeat } from './unitBeat'
import { LINE_UP_KEYS, TAP_ALONG, lineUpKept, lineUpNudge, lineUpOpen, lineUpTimes, lineUpToKeep, lineUpWords, offBeat, samePhase, tapAlong } from './lineUp'

/**
 * THE METRONOME SETTING, and the two things it drives.
 *
 * "A metronome that plays out loud that can be toggled on and off in
 * settings … play on the unit or the phone or both." Settings → Metronome is
 * the switch and the choice of where; this keeps the answer, tells the unit,
 * and runs the phone's half. The rules — which number switches which unit,
 * and when a beat is due — are shared/metronome.mjs's.
 */

const KEY = 'fractal.metronome'
let setting = DEFAULT_METRONOME
const watchers = new Set()

const announce = () => {
  for (const fn of watchers) fn()
}

AsyncStorage.getItem(KEY)
  .then((raw) => {
    if (!raw) return
    setting = metronomeSetting(JSON.parse(raw))
    announce()
  })
  .catch(() => {})

export const metronome = () => setting

export function useMetronome() {
  return useSyncExternalStore(
    (fn) => {
      watchers.add(fn)
      return () => watchers.delete(fn)
    },
    () => setting,
    () => setting
  )
}

/*
 * Whether the unit has said its own click is on, since the app last switched
 * it — for the unit it said it of.
 *
 * "It doesn't turn it on the unit on the FM3." The unit answers the write
 * "ok" whenever it does not object, and nobody has yet seen an FM3 act on its
 * switch, so "ok" is not taken for a click. Until the switch reads back as on,
 * Unit keeps the phone clicking as well (shared clicks()), and the phone stops
 * the moment the unit says it is clicking.
 */
let heard = { slug: null, on: false }
const hear = (slug, on) => {
  if (heard.slug === slug && heard.on === on) return
  heard = { slug, on }
  announce()
}
export const unitHeardOn = (slug) => heard.slug === slug && heard.on

/** unitHeardOn as a hook: the Metronome page and the phone's click both follow it. */
export function useUnitHeardOn(slug) {
  return useSyncExternalStore(
    (fn) => {
      watchers.add(fn)
      return () => watchers.delete(fn)
    },
    () => unitHeardOn(slug),
    () => unitHeardOn(slug)
  )
}

/**
 * Switch the unit's click, then follow where the unit says its switch is.
 *
 * Its answers go into the log — "ok" only means the unit did not object —
 * and into `heard`, because the phone keeps time until the unit says it is
 * clicking. Asked again while Unit is picked (shared followSwitch), so a lost
 * answer, or the switch changed at the unit by hand, is caught. Switching it
 * off is believed straight away: the phone clicking on through a moment of
 * silence costs nothing.
 */
let unfollow = () => {}
const stopFollowing = () => {
  unfollow()
  unfollow = () => {}
}

async function switchUnit(slug, on) {
  stopFollowing()
  if (!on) hear(slug, false)
  const said = await setUnitMetronome(slug, on)
  if (said?.ok === false && !said?.unsupported) logDebug('metronome', 'the unit did not take it', JSON.stringify(said))
  if (said?.ok === false || said?.simulated) return said
  /* The unit has taken a switch, whoever asked (a press, or its arriving): what it refused before is put right, or overtaken, and is not asked again. */
  if (untold !== null && untold.slug === slug) untold = null
  const tell = (value) =>
    logDebug(
      'metronome',
      value === null ? 'the unit did not say where its metronome switch is' : `the unit says its metronome switch is at ${value}`,
      `asked for ${on ? 'on' : 'off'}`
    )
  if (!on) {
    readUnitMetronome(slug).then(tell).catch(() => {})
    return said
  }
  /* Into the log when the answer changes, not every half minute. */
  let told
  /* Only while the setting still asks for it: a quick on-then-off must not hear the first answer last. */
  unfollow = followSwitch({
    read: () => readUnitMetronome(slug),
    wanted: () => clicks(setting, true).unit,
    answer: (heardOn, value) => {
      if (value !== told) tell(value)
      told = value
      hear(slug, heardOn)
    },
    wait: (fn, ms) => setTimeout(fn, ms),
    stop: (t) => clearTimeout(t)
  })
  return said
}

/*
 * WHAT THE UNIT WAS LAST ASKED FOR AND DID NOT TAKE, to ask again.
 *
 * The setting is kept before the unit is written, so that the device does
 * what was asked at the press. But a unit that then refused, or could not
 * be reached, was left as it was, and the next press of the same thing
 * changed nothing in the setting: so nothing was written, the answer was
 * "ok", and the words "the unit didn't take it … then try again" went away
 * with the unit still doing what it had been told to stop. Found with the
 * sound picked Off (16 November 2026): Off lit, the unit clicking, and a
 * second press that sent nothing. So what was refused is remembered, for
 * that unit, and the same pick pressed again (Off again, the same place
 * again) is written again though the setting no longer changes.
 *
 * ONLY a pick, a press that names the place. The switch, and the watch's
 * tap, ask nothing of the unit when its half does not change, and must not
 * write it: somebody may have turned the unit's click on or off by hand
 * since, and a press of "Tap on the watch" is no reason to turn it back.
 * And forgotten as soon as the unit takes a switch from anywhere
 * (switchUnit), its arriving included.
 */
let untold = null

/*
 * Change the setting, and tell the unit if its half changed.
 *
 * Only the unit's half is written, and only when it changes, or when it is
 * what the unit last refused: turning the phone's tap on must not reach out
 * and switch the unit's click off when somebody had turned it on at the unit
 * by hand.
 */
async function change(patch, slug, here = {}) {
  /* Where the unit's click cannot be switched (an AM4, Bluetooth, the demo), its half never changes. */
  const can = unitClick(slug, here).can
  const before = clicks(setting, can).unit
  setting = metronomeSetting({ ...setting, ...patch })
  announce()
  AsyncStorage.setItem(KEY, JSON.stringify(setting)).catch(() => {})
  const after = clicks(setting, can).unit
  const again = can && untold !== null && untold.slug === slug && untold.on === after && !!patch && 'where' in patch
  if (before === after && !again) return { ok: true }
  untold = null
  try {
    const said = (await switchUnit(slug, after)) || { ok: true }
    if (said.ok === false && !said.unsupported) untold = { slug, on: after }
    return said
  } catch (err) {
    /* A unit (or a link: Bluetooth refuses every setting write) that has no
       click to switch is not a unit that failed to take it. */
    if (isUnsupported(err)) return { ok: false, unsupported: true }
    untold = { slug, on: after }
    logDebug('metronome', 'could not reach the unit', String(err?.message || err))
    return { ok: false, message: String(err?.message || err) }
  }
}

/**
 * Change the setting, and tell the unit if its half changed (`change`,
 * above).
 *
 * A place picked is a sound picked: it lets go of Off (lib/edgeFlash),
 * whoever picks it and from whichever page. Settings' own row writes the
 * place through here for an account not offered the sound as a choice, on a
 * device another account may have left on Off; without this the unit came
 * back to that account clicking under a lit Off.
 */
export async function setMetronome(patch, slug, here = {}) {
  if (patch && 'where' in patch) setQuiet(false)
  return change(patch, slug, here)
}

/**
 * THE TAP ON THE WRIST ALONE, on or off: the setting's `watch`, and nothing
 * else. The Apple Watch's Tempo page asks for it with its own switch
 * (lib/watchBridge, a `wrist` request), which is this page's "Tap on the
 * watch" from the wrist. Never the metronome itself, and never the unit:
 * its click is no part of `watch`, so nothing is written to it from here.
 */
export function setWatchTap(on) {
  const next = metronomeSetting({ ...setting, watch: on === true })
  if (next.watch === setting.watch) return
  setting = next
  announce()
  AsyncStorage.setItem(KEY, JSON.stringify(setting)).catch(() => {})
}

/**
 * Tell a unit that has just arrived, when its click is meant to be on.
 *
 * A unit switched on after the phone, or the other unit picked under Which
 * unit, has its own idea of whether it is clicking. If the setting says the
 * unit clicks, this says so to the unit in front of it now. A unit that goes
 * is no longer heard clicking, so the phone covers until the next one says.
 */
export function useUnitMetronome(slug, present, here = {}) {
  const bluetooth = Boolean(here.bluetooth)
  useEffect(() => {
    if (!present) {
      stopFollowing()
      hear(null, false)
      return
    }
    /* Not asked again where it cannot click any more: Bluetooth turned on, say. */
    if (!clicks(setting, unitClick(slug, { bluetooth }).can).unit) {
      stopFollowing()
      return
    }
    switchUnit(slug, true).catch((err) => logDebug('metronome', 'could not tell the unit it arrived clicking', String(err?.message || err)))
  }, [slug, present, bluetooth])
}

/* Whether this unit's own click can be switched from here: the phone keeps time where it cannot. */
const ofSlug = (s) => s.deviceSlug
function useUnitCan() {
  const slug = useRig(ofSlug)
  const demo = isDemo()
  const bluetooth = useBluetoothOn() && !demo
  return { can: unitClick(slug, { bluetooth, demo }).can, heard: useUnitHeardOn(slug), slug }
}

/*
 * FLASH TIMING: how much later (or earlier) than standard the flash and the
 * tap come, for this phone and whatever it plays through. Settings → Metronome
 * moves it; shared/metronome.mjs says what standard is and keeps it in range.
 */
const FLASH_KEY = 'fractal.metronome.flash'
let nudge = 0
AsyncStorage.getItem(FLASH_KEY)
  .then((raw) => {
    if (raw === null) return
    nudge = flashNudge(Number(raw), Platform.OS)
    announce()
  })
  .catch(() => {})
export const flashTiming = () => nudge
export function setFlashTiming(ms) {
  nudge = flashNudge(ms, Platform.OS)
  announce()
  AsyncStorage.setItem(FLASH_KEY, String(nudge)).catch(() => {})
}
export function useFlashTiming() {
  return useSyncExternalStore(
    (fn) => {
      watchers.add(fn)
      return () => watchers.delete(fn)
    },
    () => nudge,
    () => nudge
  )
}

/*
 * THE FLASH ROUND THE EDGE, AS A CHOICE (lib/edgeFlash has the why): kept
 * on the device, on until somebody switches it off, and read only for an
 * account the choice is offered to.
 */
let edge = true
AsyncStorage.getItem(EDGE_KEY)
  .then((raw) => {
    edge = edgeKept(raw)
    announce()
  })
  .catch(() => {})
export function setEdgeFlash(on) {
  edge = on === true
  announce()
  AsyncStorage.setItem(EDGE_KEY, edgeToKeep(edge)).catch(() => {})
}

/*
 * NO SOUND, AS A CHOICE (lib/edgeFlash has the why): kept on the device, a
 * sound until somebody picks Off, and read only for an account the choice is
 * offered to.
 */
let quiet = false
AsyncStorage.getItem(QUIET_KEY)
  .then((raw) => {
    quiet = quietKept(raw)
    announce()
  })
  .catch(() => {})
function setQuiet(on) {
  if (quiet === (on === true)) return
  quiet = on === true
  announce()
  AsyncStorage.setItem(QUIET_KEY, quietToKeep(quiet)).catch(() => {})
}

/**
 * Pick the metronome's sound: Off (lib/edgeFlash SOUND_OFF) or one of the
 * shared rule's places. The sound row in the volume pop-up and on Settings →
 * Metronome both come through here, so the two cannot disagree.
 *
 * Off goes quiet FIRST, before the unit has answered: the device stops at
 * the press. Then the place is set to the device, which is the shared rule
 * switching the unit's own click off by the road it has always used (and
 * asking it again, if it refused: `untold`), and the light is switched on,
 * being all that is left. So Off is only ever kept with the place on the
 * device. A place lets go of Off, and is written only where the unit's click
 * can be switched; where it cannot, the place kept is left as it is.
 */
export async function setMetronomeSound(key, slug, here = {}, { start = false } = {}) {
  const picked = soundPicked(key, { can: unitClick(slug, here).can })
  setQuiet(picked.quiet)
  if (picked.edge) setEdgeFlash(true)
  /*
   * AND, FROM THE VOLUME POP-UP, A PICK STARTS IT (`start`). "The light
   * only runs while the metronome itself is switched on" (report 8be38966,
   * 16 November 2026): Phone, Unit, Both and the flash were pressed with the
   * metronome off, and nothing flashed. So a pick in the pop-up's row while
   * it is off switches it on, Off included (Off is the light with no
   * sound), in the SAME change as the place: the unit is written once, and
   * the re-ask after a refusal (`untold`, which wants `where` in the patch)
   * still works. Settings → Metronome passes no `start`: a pick there is
   * kept for when it is switched on.
   */
  const patch = { ...(picked.where ? { where: picked.where } : null), ...(start === true && !setting.on ? { on: true } : null) }
  if (!Object.keys(patch).length) return { ok: true }
  /* Past setMetronome, which would let go of the Off just set. */
  return change(patch, slug, here)
}

/** The choices, and whether whoever is signed in here is offered them: `{ offered, on, quiet }`. `on` is the flash; `quiet` is no sound, false for an account not offered it. */
export function useEdgeFlash() {
  const offered = edgeChoiceOn({ admin: useBluetoothAdmin(), everyone: METRONOME_FLASH_CHOICE_FOR_EVERYONE })
  const on = useSyncExternalStore(
    (fn) => {
      watchers.add(fn)
      return () => watchers.delete(fn)
    },
    () => edge,
    () => edge
  )
  const silenced = useSyncExternalStore(
    (fn) => {
      watchers.add(fn)
      return () => watchers.delete(fn)
    },
    () => quiet,
    () => quiet
  )
  return { offered, on, quiet: offered && silenced }
}

/*
 * LINING UP THE LIGHT AND THE CLICK (lib/lineUp has the why): three nudges
 * kept on the device, the light, the device's own click and the Apple
 * Watch's tap, none until somebody moves one, and applied only for an
 * account the line-up is offered to. The watch's is kept and sent to a
 * watch that knows it, and drawn nowhere yet.
 */
const LINE_UP_PARTS = ['light', 'click', 'watch']
const LINE_UP_NAMES = { light: 'the light', click: 'the click', watch: 'the watch' }
let lined = { light: 0, click: 0, watch: 0 }
for (const part of LINE_UP_PARTS) {
  AsyncStorage.getItem(LINE_UP_KEYS[part])
    .then((raw) => {
      const kept = lineUpKept(raw)
      if (kept === lined[part]) return
      lined = { ...lined, [part]: kept }
      announce()
    })
    .catch(() => {})
}
export const lineUpNow = () => lined

/**
 * Move one nudge or more (`{ light, click, watch }`, milliseconds), and say
 * in the log, once, what changed: "the light 20 ms later". `why` is said
 * with it (Tap along's measure). Nothing is written to the unit.
 */
export function setLineUp(patch = {}, why = '') {
  const next = { ...lined }
  for (const part of LINE_UP_PARTS) if (patch && part in patch) next[part] = lineUpNudge(patch[part])
  const moved = LINE_UP_PARTS.filter((part) => next[part] !== lined[part])
  if (!moved.length) return false
  lined = next
  announce()
  for (const part of moved) AsyncStorage.setItem(LINE_UP_KEYS[part], lineUpToKeep(next[part])).catch(() => {})
  logDebug('metronome', `line up: ${moved.map((part) => `${LINE_UP_NAMES[part]} ${lineUpWords(next[part]).toLowerCase()}`).join(', ')}${why ? ` (${why})` : ''}`)
  return true
}

/** One press of Earlier or Later: `part` moved `by` from where it is now, not from where the screen last drew it. */
export const nudgeLineUp = (part, by) => setLineUp({ [part]: (lined[part] ?? 0) + by })

/** The nudges, and whether whoever is signed in here is offered them: `{ offered, light, click, watch }`. */
export function useLineUp() {
  const offered = lineUpOpen({ admin: useBluetoothAdmin(), everyone: METRONOME_LINE_UP_FOR_EVERYONE })
  const now = useSyncExternalStore(
    (fn) => {
      watchers.add(fn)
      return () => watchers.delete(fn)
    },
    () => lined,
    () => lined
  )
  return { offered, ...now }
}

/*
 * THE DEVICE'S OWN BEAT, WHILE IT KEEPS ONE (usePhoneClick), for Tap along
 * and for the Apple Watch.
 *
 * `ownBeat` is the beat as it is played now: its count (startedAt), how far
 * apart (beat) and how long after each the beat is heard or seen with
 * nothing nudged (offset: the click's lead with a sound, nothing in
 * silence). Tap along holds every tap against it (offOwnBeat).
 *
 * `beatShown` is what the watch is told (lib/watchBridge, the contract is
 * there): one moment the device's light lands, as lined up, and the tempo
 * it is counted at. It is set when the beat starts and changed ONLY when
 * that moment moves: a nudge, Flash timing, a tempo, or a move onto the
 * unit's beat (where the beat is HEADING, not each little step of the way
 * there). Never every beat, so the watch is not woken every beat.
 */
let ownBeat = null
let beatShown = null
const beatShownWatchers = new Set()
const showBeat = (next) => {
  if (beatShown === next) return
  beatShown = next
  for (const fn of beatShownWatchers) fn()
}
/** The device's beat for the watch: `{ at, bpm, nudge }`, or null while it keeps none. */
export const phoneBeat = () => beatShown
/** Told whenever phoneBeat() changes. */
export function onPhoneBeatMoved(fn) {
  beatShownWatchers.add(fn)
  return () => beatShownWatchers.delete(fn)
}
/** How far a moment is from the device's own nearest beat as it is heard or seen with nothing nudged (lib/lineUp offBeat), or null while it keeps none. */
export const offOwnBeat = (t) => (ownBeat ? offBeat(t, ownBeat.startedAt + ownBeat.offset, ownBeat.beat) : null)

/*
 * TAP ALONG (lib/lineUp tapAlong): the player taps a pad on every click
 * heard from the unit, each tap held against the device's own beat as it
 * lands, and Done sets both nudges to what the taps say, or nothing if they
 * are too uneven to go by. Here, not in the screen, so the bench can run it
 * on the real beat.
 */
let tapping = { open: false, offsets: [], said: null }
const tapWatchers = new Set()
const tapSay = (next) => {
  tapping = next
  for (const fn of tapWatchers) fn()
}
export const tapAlongNow = () => tapping
export function useTapAlong() {
  return useSyncExternalStore(
    (fn) => {
      tapWatchers.add(fn)
      return () => tapWatchers.delete(fn)
    },
    () => tapping,
    () => tapping
  )
}
export function startTapAlong() {
  tapSay({ open: true, offsets: [], said: null })
}
export function cancelTapAlong() {
  tapSay({ open: false, offsets: [], said: null })
}
/**
 * One tap, at `t` (now): held against the device's beat as it is now. Done
 * by itself at TAP_ALONG.most.
 *
 * And `held`: whether every tap so far came while this device's beat was
 * held on the unit's (heldOn, below), and on the same beat as the first tap's (the
 * lock moved it nowhere, nothing started it again elsewhere). One that did
 * not, and the run sets nothing (finishTapAlong): the taps were measured
 * against more than one beat, or one that starts wherever it happens to
 * (lib/lineUp tapAlongHere has why).
 */
export function tapAlongTap(t = Date.now()) {
  if (!tapping.open) return null
  const off = offOwnBeat(t)
  if (off === null) return null
  const now = { at: ownBeat.startedAt + ownBeat.offset, beat: ownBeat.beat }
  const first = tapping.first || now
  const held = tapping.held !== false && heldOn && first.beat === now.beat && samePhase(first.at, now.at, now.beat)
  tapSay({ ...tapping, offsets: [...tapping.offsets, off], first, held })
  return tapping.offsets.length >= TAP_ALONG.most ? finishTapAlong() : null
}
/** What the taps come to (lib/lineUp tapAlong), and, if steady, both nudges set to it. Said once in the log either way. */
export function finishTapAlong() {
  if (!tapping.open) return null
  /* A run whose beat moved, or was not held on the unit's, sets nothing, however steady. */
  const result = tapping.held === false ? { ...tapAlong(tapping.offsets), steady: false, ms: null, why: 'moved' } : tapAlong(tapping.offsets)
  const measure = `tapped along: ${result.taps} taps, ${result.kept} kept${result.spread === null ? '' : `, spread ${Math.round(result.spread)} ms`}`
  if (result.steady) {
    if (!setLineUp({ light: result.ms, click: result.ms }, measure)) logDebug('metronome', `line up: unchanged, ${lineUpWords(result.ms).toLowerCase()} (${measure})`)
  } else logDebug('metronome', `line up: nothing changed, ${result.why === 'moved' ? 'the beat moved or left the unit’s while tapping' : result.why === 'far' ? 'too far' : result.why === 'few' ? 'too few taps' : 'too uneven'} (${measure})`)
  tapSay({ open: false, offsets: [], said: result })
  return result
}

/*
 * WHETHER THIS DEVICE'S BEAT IS ON THE UNIT'S RIGHT NOW (lib/beatLock): the
 * unit's own beat has been heard in the last twenty seconds while this
 * device kept a beat beside it, and the device's beat was put on it. The
 * words that say the two can be apart say they are in step instead
 * (lib/edgeFlash apartOrInStep), and go back by themselves when the unit's
 * beat stops being heard.
 */
let inStep = false
let inStepTimer = null
const stepWatchers = new Set()
function noteInStep(on, until = null) {
  clearTimeout(inStepTimer)
  /* Held until `until` (the unit's beat last heard, plus heldMs), never restarted by the device's own beat catching up. */
  const left = on ? (Number.isFinite(until) ? until - Date.now() : BEAT_LOCK.heldMs) : 0
  if (on && left <= 0) on = false
  inStepTimer = on ? setTimeout(() => noteInStep(false), left) : null
  if (inStep === on) return
  inStep = on
  for (const fn of stepWatchers) fn()
}
export function useInStep() {
  return useSyncExternalStore(
    (fn) => {
      stepWatchers.add(fn)
      return () => stepWatchers.delete(fn)
    },
    () => inStep,
    () => inStep
  )
}

/*
 * WHETHER THIS DEVICE'S BEAT IS HELD ON THE UNIT'S (lib/beatLock
 * heldOnWith): a sure belief about the unit's beat and the move onto it
 * made, however wide the window, with the unit's beats at this device's
 * own tempo by the computer's gap (sameTempo). Let go of the same way as in step, twenty
 * seconds after the unit's beat was last heard. Through a computer over the
 * internet this is so where in step never is (the window is wider than
 * inStepMs), and it is what Tap along goes by (lib/lineUp tapAlongHere):
 * the device's beat sits on the unit's as nearly as the road places it.
 *
 * And `beatWhy`: why there is nothing to go on, as the beat follower last
 * learned it (lib/unitBeat onWhy: 'old', 'none', 'finding', 'tempo',
 * 'stale', 'slow', 'failed', 'bad'), null while it is still finding the
 * beat or has it, 'tempo' too where a window came whose gap is not this
 * device's tempo (align, below), and
 * 'off' where the device is not following the unit's beat at all. Tap
 * along's closed line says it (lib/lineUp tapAlongClosedWords).
 */
let heldOn = false
let heldOnTimer = null
let beatWhy = null
const heldWatchers = new Set()
const heldSay = () => {
  for (const fn of heldWatchers) fn()
}
function noteHeldOn(on, until = null) {
  clearTimeout(heldOnTimer)
  const left = on ? (Number.isFinite(until) ? until - Date.now() : BEAT_LOCK.heldMs) : 0
  if (on && left <= 0) on = false
  heldOnTimer = on ? setTimeout(() => noteHeldOn(false), left) : null
  if (heldOn === on) return
  heldOn = on
  heldSay()
}
function noteBeatWhy(why) {
  if (beatWhy === why) return
  beatWhy = why
  heldSay()
}
const heldWatch = (fn) => {
  heldWatchers.add(fn)
  return () => heldWatchers.delete(fn)
}
export function useBeatHeld() {
  return useSyncExternalStore(heldWatch, () => heldOn, () => heldOn)
}
export function useBeatWhy() {
  return useSyncExternalStore(heldWatch, () => beatWhy, () => beatWhy)
}

/*
 * Every beat the phone clicks, for anything else that lights on it — the
 * green dot on Tap — so it lights with the click and the edge flash rather
 * than on a clock of its own.
 */
const beatWatchers = new Set()
export function onPhoneBeat(fn) {
  beatWatchers.add(fn)
  return () => beatWatchers.delete(fn)
}
let clickingNow = false
const clickingWatchers = new Set()
const setClicking = (on) => {
  if (clickingNow === on) return
  clickingNow = on
  for (const fn of clickingWatchers) fn()
}
/** Whether the phone is clicking right now, as a hook. */
export function usePhoneClicking() {
  return useSyncExternalStore(
    (fn) => {
      clickingWatchers.add(fn)
      return () => clickingWatchers.delete(fn)
    },
    () => clickingNow,
    () => clickingNow
  )
}

/*
 * THE CLICK ITSELF: thirty milliseconds of tick, loaded once and played on
 * every beat. Made when the click first starts, not at launch, so a phone
 * that never turns the metronome on never opens audio.
 *
 * Plays with the ring switch on silent — a metronome somebody turned on is a
 * sound they asked for — and alongside whatever else is playing, so a backing
 * track keeps going under it.
 *
 * WHY TWO PLAYERS ON AN iPHONE, and why it is ready before the first beat.
 * "The flash is not matching up with the sound." It was the sound that was
 * late, and late by a different amount every beat:
 *
 * - The player rewound itself on the beat. The rewind is an asynchronous call
 *   that only runs after the beat's own code has finished, and the play is
 *   immediate — so the play came first, at the end of the last click, and
 *   the sound waited on the rewind landing behind it.
 * - The phone let go of its audio a tenth of a second after every click, and
 *   took it back on the next one, so every beat started the speaker (and any
 *   Bluetooth link) from cold.
 *
 * So on an iPhone two players take turns: the one that sounds was rewound a
 * whole beat ago, and the one that sounded last is rewound behind it. The
 * audio is kept awake while the click runs, and let go two seconds after it
 * stops (a tap-tempo press restarts the click, and must not pause it).
 *
 * Android plays its seek and its play in order, so one player does; but it
 * starts a new audio track for every click and fades each one in over 20 ms,
 * which took the whole click with it. Its click (assets/click-pad.wav) starts
 * with 25 ms of silence for the fade to spend itself on, and FLASH_LEAD
 * counts it.
 */
const IOS = Platform.OS === 'ios'
let players = null
let turn = 0
let preparing = null
let releaseTimer = null

function prepareClick() {
  if (!preparing) {
    preparing = (async () => {
      await setAudioModeAsync({ playsInSilentMode: true, interruptionMode: 'mixWithOthers' }).catch(() => {})
      players = IOS
        ? [createAudioPlayer(clickSound, { keepAudioSessionActive: true }), createAudioPlayer(clickSound, { keepAudioSessionActive: true })]
        : [createAudioPlayer(clickPadded)]
      /* Loaded before the first beat, or the first click is a click that never sounds. */
      for (let waited = 0; waited < 500 && !players.every((p) => p.isLoaded); waited += 20) {
        await new Promise((resolve) => setTimeout(resolve, 20))
      }
    })().catch(() => {
      // A phone that cannot make the sound still flashes and taps.
    })
  }
  return preparing.then(async () => {
    /* Every player at the top before a run starts: a run that stopped mid-turn left one at the end. */
    if (!players) return
    await Promise.all(
      players.map((p) => {
        try {
          p.pause()
          return Promise.resolve(p.seekTo(0)).catch(() => {})
        } catch {
          return null
        }
      })
    )
  })
}

function click() {
  if (!players) return null
  try {
    if (!IOS) {
      Promise.resolve(players[0].seekTo(0)).catch(() => {})
      players[0].play()
      return players[0]
    }
    const now = players[turn]
    turn = 1 - turn
    now.play()
    /* Rewound after this beat's code, which is when an iPhone runs it: never in front of this click. */
    Promise.resolve(players[turn].seekTo(0)).catch(() => {})
    return now
  } catch {
    return null
  }
}

/* Two seconds after the click stops: the audio is let go, unless it has started again. */
function releaseLater() {
  clearTimeout(releaseTimer)
  releaseTimer = setTimeout(() => {
    releaseTimer = null
    try {
      players?.forEach((p) => p.pause())
    } catch {
      // Gone already.
    }
    if (IOS) setIsAudioActiveAsync(false).catch(() => {})
  }, 2000)
}

/*
 * HOW LATE THE CLICK REALLY STARTS, on his phone, into the log. A few beats
 * into each run the iPhone's player is asked where it has got to, a moment
 * after it was told to play and again a little later if it had not started:
 * how long it has really been since the play, less what it has played, is
 * how long it took to start. (The time since is read, not assumed: a timer
 * here fires on the next screen frame, which can be most of a click late.)
 * Said once a run, so "Send logs to developer" brings back a number nobody
 * had to measure by ear.
 */
const LAG_PROBES_MS = [10, 30, 60, 100]
const CLICK_S = 0.03
function probeLag(player, lags, lead, asked) {
  if (!IOS || !player || lags.done) return
  const ask = (i) =>
    setTimeout(() => {
      if (lags.done) return
      let at
      try {
        at = player.currentTime
      } catch {
        return
      }
      const since = Date.now() - asked
      if (!(at > 0)) {
        if (i + 1 < LAG_PROBES_MS.length) return ask(i + 1)
        /* Not started yet, this long after: at least that late. */
        lags.push(since)
      } else if (at < CLICK_S - 0.001) lags.push(since - at * 1000)
      /* Over already: started sooner than this probe could see. Not counted. */ else return
      if (lags.length < 6) return
      lags.done = true
      const sorted = [...lags].sort((a, b) => a - b)
      const mid = Math.max(0, Math.round((sorted[2] + sorted[3]) / 2))
      logDebug('metronome', `the click starts about ${mid} ms after the beat; the flash comes ${lead} ms after it`)
    }, LAG_PROBES_MS[i] - (i ? LAG_PROBES_MS[i - 1] : 0))
  ask(0)
}

/**
 * The phone's half: a click out loud on every beat, a tap you feel with it,
 * and a flash for the screen.
 *
 * Counted from when it started rather than from the last beat (nextBeat), so
 * a timer that runs late once does not drag every beat after it. `onBeat` is
 * handed each beat so a screen can flash with it.
 *
 * Answers whether it is keeping time right now: the setting says the phone
 * clicks, or lights its edge in silence, AND there is a tempo to keep.
 * MetronomeBeat keeps the screen awake on that, and on nothing wider, so a
 * phone with the click switched on but no tempo yet still sleeps as it
 * always has.
 *
 * `onBeat` is called only on a beat the edge of the screen is to light on
 * (lib/edgeFlash edgeBeat): with the choice switched off the click and the
 * tap carry on and nothing lights; with the click on the unit alone, or the
 * sound picked Off, for an account offered the choice, the beat runs here in
 * silence, no sound and no tap, only for the light.
 *
 * AND WHERE THE UNIT CLICKS TOO, THE BEAT HERE GOES ONTO THE UNIT'S
 * (lib/beatLock), for an account it is switched on for: while the unit's
 * own beat can be heard (lib/unitBeat), what the beats here are counted
 * from is moved so the click heard, or in silence the light, lands on it.
 * The first beat waits for the unit's when one is already known; a move
 * once the beat is going is made a little each beat (slewOfBeat), so no
 * beat is ever dropped, doubled or jumped; and a move too small to hear is
 * not made. With no beat heard from the unit, nothing here is any
 * different from before.
 *
 * "The unit clicks too" is the player's choice of Unit or Both, not whether
 * the app can switch the unit's click: over Bluetooth it cannot, and the
 * unit may be clicking all the same, switched on at the unit.
 */
export function usePhoneClick(bpm, onBeat) {
  const s = useMetronome()
  const { can, heard: heardOn, slug } = useUnitCan()
  const choice = useEdgeFlash()
  /* Never while it is quiet: the sound picked Off (lib/edgeFlash) is the device's too, and the light alone is left. */
  const sound = deviceSounds({ clicks: clicks(s, can, heardOn).phone, offered: choice.offered, quiet: choice.quiet })
  const { flash, silent } = edgeBeat({ offered: choice.offered, edge: choice.on, metronomeOn: s.on, deviceClicks: sound })
  const on = sound || silent
  const beat = beatMs(bpm)
  const running = Boolean(on && beat)
  /*
   * Only beside a unit the player has clicking (Unit or Both, whether or not
   * the app can switch it from here: over Bluetooth it cannot), and only a
   * unit that sends its beat (the three whose click the app knows). A device
   * keeping time alone has nothing to line up with. Never in the demo.
   */
  const follow = beatLockOn({ admin: useBluetoothAdmin(), everyone: BEAT_LOCK_FOR_EVERYONE }) && clicks(s).unit && Boolean(unitMetronome(slug)) && !isDemo()
  /* The light and the click lined up by hand or by Tap along (lib/lineUp): only for an account it is offered to. */
  const lining = lineUpOpen({ admin: useBluetoothAdmin(), everyone: METRONOME_LINE_UP_FOR_EVERYONE })
  useEffect(() => {
    if (!on || !beat) return undefined
    let startedAt = 0
    let timer = null
    let alive = true
    let n = 0
    /* When the last beat's code ran, and where the unit's beat is believed to be (lib/beatLock): null for neither yet. */
    let clicked = null
    let unitAt = null
    /* How much of a move onto the unit's beat is still to be made, a little each beat (lib/beatLock slewPart). */
    let left = 0
    /* Whether the beats here have something to be counted from yet: the sound is made ready first. */
    let started = false
    /* The clicks, flashes and taps still to come, cleared when the beat stops: none lands after it. */
    const later = new Set()
    const lags = []
    /* How long after a beat's own moment its click is heard, or with no sound nothing: read each time, so Flash timing moves it at once. */
    const lead = () => (sound ? flashLead(Platform.OS, nudge) : 0)
    /* When the click, the tap and the light come on a beat, the nudges read each time too (lib/lineUp lineUpTimes). With none, exactly as before. */
    const times = () => lineUpTimes({ sound, lead: lead(), light: lining ? lined.light : 0, click: lining ? lined.click : 0 })
    /*
     * Run at once where the moment is here, past, or less than a millisecond
     * off, else when it comes: a beat moved by nothing is run in the same
     * breath, as it always was. Date.now() is whole milliseconds and a beat
     * seldom is (130 BPM is 461.538 ms), so a step that runs in the beat's
     * own millisecond sees a fraction still to wait; a timer for that
     * fraction fires on the next screen frame, a frame late.
     */
    const soon = (at, fn) => {
      const wait = at - Date.now()
      if (wait < 1) return fn()
      const t = setTimeout(() => {
        later.delete(t)
        if (alive) fn()
      }, wait)
      later.add(t)
      return undefined
    }
    /* For the watch, the moment the light lands, as lined up, changed only when that moment moves (beatShown, above). */
    const shown = (at) => {
      const lands = at + left + times().lightAt
      const watch = lining ? lined.watch : 0
      if (beatShown && beatShown.beat === beat && beatShown.nudge === watch && samePhase(beatShown.at, lands, beat)) return
      showBeat({ at: Math.round(lands), bpm: Math.round((60000 / beat) * 1000) / 1000, nudge: watch, beat })
    }
    /* Book the beat whose own moment is `at`: its code runs `early` before, so a nudge earlier is never booked in the past. */
    const book = (at) => {
      timer = setTimeout(() => step(at), Math.max(0, at - times().early - Date.now()))
    }
    const step = (at) => {
      if (!alive) return
      clicked = Date.now()
      const when = times()
      shown(at)
      if (sound) {
        soon(at + when.clickAt, () => {
          const asked = Date.now()
          const sounding = click()
          if (n++ >= 2) probeLag(sounding, lags, lead(), asked)
        })
        /* The tap is with the click, as it is heard: see FLASH_LEAD. */
        soon(at + when.tapAt, () => tick())
      }
      /* The light waits for the sound too, and in silence there is none to wait for. */
      soon(at + when.lightAt, () => {
        if (flash) onBeat?.()
        for (const fn of beatWatchers) fn()
      })
      /* The next beat after this one, or after now where this one's code ran late. */
      let due = nextBeat(startedAt, Math.max(at, Date.now() + when.early), beat)
      /* Part of a move onto the unit's beat: the next beat a little early or late, never dropped or doubled. */
      const part = slewPart(left, beat)
      if (part) {
        startedAt += part
        due += part
        left -= part
        if (!left) {
          noteInStep(inStepWith(unitAt), unitAt.at + BEAT_LOCK.heldMs)
          noteHeldOn(heldOnWith(unitAt, 0, beat), unitAt.at + BEAT_LOCK.heldMs)
        }
      }
      /* The beat as it is played from here on, for Tap along to hold a tap against. */
      ownBeat = { startedAt, beat, offset: lead() }
      book(due)
    }
    if (sound) {
      clearTimeout(releaseTimer)
      releaseTimer = null
    }
    /*
     * The beat here onto the unit's: what the beats are counted from moves
     * by the least that puts the click heard (`lead` after its beat), or in
     * silence the light, on the unit's beat. Before the first click it is
     * moved at once and the first beat booked on it; after, a little each
     * beat (step). "In step" only where the unit's beat is known closely
     * and the device's is that near it (lib/beatLock inStepWith). The
     * nudges are on top of this: lined up by ear, never by the unit.
     */
    const align = () => {
      if (!alive || !started || !unitAt) return
      const by = moveFor(startedAt, unitAt, beat, lead())
      if (clicked === null) {
        startedAt += by
        left = 0
        clearTimeout(timer)
        /* The first beat on it whose code can still run on time: now itself where nothing had to move. */
        const now = Date.now() + times().early
        book(startedAt + Math.ceil((now - startedAt) / beat) * beat)
      } else left = by
      noteInStep(inStepWith(unitAt, left), unitAt.at + BEAT_LOCK.heldMs)
      noteHeldOn(heldOnWith(unitAt, left, beat), unitAt.at + BEAT_LOCK.heldMs)
      /* A window whose own gap says the unit keeps another tempo than this device's: Tap along waits, and says why (lib/lineUp tapAlongClosedWords). */
      if (Number.isFinite(unitAt.gap) && !sameTempo(unitAt.gap, beat)) noteBeatWhy('tempo')
      if (by) logDebug('metronome', `this device’s beat goes ${Math.abs(Math.round(by))} ms ${by > 0 ? 'later' : 'earlier'}, onto the unit’s (known to within ${Math.round(unitAt.half)} ms)${clicked === null ? '' : ', a little each beat'}`)
    }
    noteBeatWhy(follow ? null : 'off')
    const unfollow = follow
      ? followUnitBeat({
          beat,
          onWindow: (window) => {
            unitAt = window
            align()
          },
          onWhy: (why) => {
            if (alive) noteBeatWhy(why)
          }
        })
      : null
    setClicking(true)
    /* The sound is made ready only where there is one: a beat kept in silence opens no audio. */
    ;(sound ? prepareClick() : Promise.resolve()).finally(() => {
      if (!alive) return
      /* Its first beat now, or a nudge's worth later where something is nudged earlier, so nothing is booked in the past. */
      startedAt = Date.now() + times().early
      started = true
      /* The unit's beat already known: the first beat here is the next one on it, not this moment. Else now, as ever. */
      if (unitAt) align()
      /* In this same breath, as it always was: its code is due now. */
      if (timer === null) step(startedAt)
    })
    return () => {
      alive = false
      unfollow?.()
      if (follow) {
        noteInStep(false)
        noteHeldOn(false)
      }
      noteBeatWhy(null)
      clearTimeout(timer)
      for (const t of later) clearTimeout(t)
      later.clear()
      setClicking(false)
      ownBeat = null
      showBeat(null)
      if (sound) releaseLater()
    }
  }, [on, sound, flash, beat, onBeat, follow, lining])
  return running
}

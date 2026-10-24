import { useEffect, useRef, useSyncExternalStore } from 'react'
import { AppState, Linking, Platform } from 'react-native'

import { isAdmin } from './admin'
import { OTHER_AMP_SAYS, ampPedal, isAm4 } from './am4-boost'
import { chainActs } from './chain-view'
import { logDebug } from './debugLog'
import { vp4Here } from './device'
import { deviceNoun } from './device-word'
import { linkState, probeNow, untilConnected } from './link'
import { nameOf } from './presetNames'
import { NOT_SENT, NOT_SENT_LATE, tapDeadline } from './relay-rules'
import {
  chainViewOf,
  getState,
  loadPreset,
  notSentNow,
  onPresetAnswered,
  pedalSlug,
  tunerAskWaits,
  tunerAsksWaiting,
  writeBypass,
  writeScene,
  writeTempo,
  writeTuner
} from './rig'
import { SIRI_ANSWER_MS, SIRI_SAYS, linksOpen, parseLink, pedalMatches, pedalWord, sentWords, spoken } from './siri-rule'
import { SIRI_PEDALS, answerSiri, onSiriCommand, siriPresent } from './siriPipe'
import { installedStoreVersion } from './storeVersion'
import { tempoRange } from './tempo'
import { idOf, sceneShape, slotCount, slotLabel } from './unit.mjs'
import { VP4_NO_TEMPO } from './vp4-safety'

/*
 * SIRI'S COMMANDS, CARRIED OUT.
 *
 * "Let's add all of the Siri commands to the build that we can." (Justin,
 * 23 October 2026.) The phrases live in the iPhone app and hand each command
 * here through lib/siriPipe with the moment the app received it; everything
 * that decides what a command does is this file, so an update can fix it.
 * The words are lib/siri-rule's.
 *
 * ONE RULE: PLAY ON SCREEN. Every command but Tuner off works only with Play
 * up, because Play is where its result and a "Not sent" are shown, where the
 * setlist stepping lives (Stage.step, which Play hands over by useSiriPlay),
 * and where the tuner's Stop button is. Anywhere else in the app Siri is told
 * to open Play on this device, and so is it on the startup card, the
 * walkthrough, the sign-in and the paywall, from none of which Play comes by
 * itself (lib/siri-rule playElsewhereOf). While the app is still starting
 * (its stored answers loading, an account being checked after a sign-in,
 * Finding your computer) a command waits for Play for as long as its tap
 * rule lasts, and is not sent after that.
 *
 * THE 1.5-SECOND TAP RULE, counted from `at`: when the Swift took the
 * command, not when it reached this side. A command held while the app
 * started, or arriving at a phone that slept, gets no fresh second and a
 * half. It goes through the rig's own writes with that `at`, exactly as a tap
 * on Play does (relay-rules TAP_DEADLINE_MS), and one that cannot make it is
 * said on Play the way a late tap is.
 *
 * TUNER OFF FROM ANYWHERE, AND NEVER DROPPED: the tuner mutes the rig, so a
 * close that could not go would leave it muted. It waits for the link and is
 * tried once more, by the watch's own rule (lib/watchBridge): never over a
 * tuner opened since, nor ahead of a Tuner on still on its way, and, once
 * the app has gone into the background, never after SIRI_CLOSE_WINDOW_MS.
 * Siri is answered before any of that wait.
 *
 * THE DEMO: nothing here asks whether it is the demo. The rig answers the
 * demo's simulated unit at the same door as a real one, so Apple's reviewer,
 * with no unit, can say "Scene 3 in Fractal Remote" and see it land.
 *
 * SIRI IS ANSWERED ONCE, within SIRI_ANSWER_MS of `at`: the Swift says "Not
 * sent." itself at five seconds, and a command it has already answered that
 * way (`answered`) is only acted on where acting late is safe, which is
 * Tuner off. Every word naming the device in hand is deviceNoun()'s.
 *
 * THE LINKS, fractalremote://next, previous, scene/1 to 8 and tuner/off,
 * come through here too, from Shortcuts' Open URL, the Action button, Back
 * Tap, or Tasker on Android: the same commands, the same Play rule, the same
 * tap rule counted from when the link arrived, with nobody to answer, so the
 * result is Play's alone. Never tuner on (lib/siri-rule parseLink). Open to
 * Justin's account only, until this copy of the app is itself the new store
 * version (lib/siri-rule linksOpen says why and how that is told).
 */

/* Play's own Previous and Next, while Play is on screen (useSiriPlay). */
let play = null
const playWatchers = new Set()
/* Another screen of the app is up (App.js): Play is not coming by itself. */
let elsewhere = false
/* The last commands carried out, so one handed over twice is carried out once. */
const seen = []

const pause = (ms) => new Promise((go) => setTimeout(go, ms))

/*
 * HOW LONG AFTER `at` A TUNER OFF MAY STILL GO, either try, ONCE THE APP HAS
 * GONE INTO THE BACKGROUND. Every Siri command brings the app to the front
 * (SiriShortcuts.swift: openAppWhenRun, and supportedModes
 * .foreground(.immediate)), and so does every link, so the close starts
 * with the app on screen. But "Tuner off" is said to put the phone away and
 * play, and the moment Siri has answered, the player may lock it or go back
 * to another app: nothing holds the app up then (the Siri module takes no
 * background time, unlike the watch's 25-second wake), so the phone stops
 * it within seconds, timers and all, and they go on where they stopped at
 * the next launch, minutes or hours later. A close still waiting would go
 * then, over a tuner opened on the unit or another device since, which this
 * app knows nothing of. So once the app has gone into the background
 * (AppState 'background', which iOS says before it stops the app), it goes
 * inside this window or not at all: as long as the watch's
 * (WATCH_CLOSE_WINDOW_MS). The clock runs on while the app is stopped,
 * which is what says so.
 *
 * NOT WHILE THE APP STAYS ON SCREEN, because there the chain can run well
 * past it with nothing wrong: besides the first try's 0.4 + 8 seconds for
 * the link, the pause and the second try's link wait, a close is a request
 * to the relay, which can wait up to RELAY_GRACE (8 s) for a channel that
 * is down, and then up to timeoutFor('POST', '/tuner') (20 s) for a
 * computer gone with the channel still joined. The first try alone can use
 * the whole window, and a window kept then would only drop the second try,
 * with the rig muted under a Play that says the tuner is off. With Play
 * still up, nothing stops the app, so every wait the chain ever had stands.
 */
export const SIRI_CLOSE_WINDOW_MS = 20000

/**
 * For Stage: Play's Previous and Next (`step(by, at)`, which returns its
 * loadPreset), where each would land (`landing(by)`), and why they cannot
 * step at all (`stuck()`: a VP4 slot by slot, or null). Held while Play is
 * mounted, and only then.
 */
export function useSiriPlay(here) {
  const ref = useRef(here)
  ref.current = here
  useEffect(
    () =>
      showPlay({
        step: (by, at) => ref.current.step(by, at),
        landing: (by) => ref.current.landing(by),
        stuck: () => ref.current.stuck?.() ?? null
      }),
    []
  )
}

/** Play on screen, from useSiriPlay; returns the way to say it has gone. */
export function showPlay(here) {
  play = here
  for (const fn of [...playWatchers]) fn()
  return () => {
    if (play === here) play = null
  }
}

/** For App.js: true while a screen other than Play is up in its place (Settings, Presets, Setlists, Edit…, and the card, the walkthrough, the sign-in, the paywall). */
export function siriElsewhere(on) {
  elsewhere = on === true
}

/* Play, as soon as it is up, for at most `ms`: true when it came. */
function playWithin(ms) {
  if (play) return Promise.resolve(true)
  return new Promise((resolve) => {
    const came = () => {
      if (!play) return
      clearTimeout(timer)
      playWatchers.delete(came)
      resolve(true)
    }
    const timer = setTimeout(() => {
      playWatchers.delete(came)
      resolve(Boolean(play))
    }, Math.max(0, ms))
    playWatchers.add(came)
  })
}

/* One answer per command, and only to Siri, only while Siri is still waiting. */
function answerer(cmd) {
  let said = false
  return (words) => {
    if (said) return
    said = true
    const out = spoken(words)
    /* A link has nobody to answer: what Siri would have heard goes in the log, and Play shows the rest. */
    if (cmd.from !== 'siri' || cmd.answered || !cmd.id) return logDebug('siri', `${cmd.command}: ${out}`)
    logDebug('siri', 'said', out)
    answerSiri(cmd.id, out)
  }
}

/* What Play says about a write that did not go: its own note, or the fault card's words. */
function failedWords() {
  const s = getState()
  return s.dropped || s.error || SIRI_SAYS.notSent
}

/*
 * NOT SENT, SAID ON PLAY AS A LATE TAP IS, and to Siri in the same words.
 * `late` false for a link that never came back.
 */
function notSent(cmd, say, { late = true } = {}) {
  notSentNow(`${cmd.from} ${cmd.command}`, { late })
  say(late ? NOT_SENT_LATE : NOT_SENT)
}

/*
 * THE ANSWER TO A WRITE. `going` is the rig's own write, true when it landed
 * and false when it did not (Play then says why, and so does Siri). `early`
 * is a preset's select answered (rig.onPresetAnswered), which comes before
 * the reads behind it. Whichever is first; and a write still out when Siri
 * must be answered is said as sent, which it is, past its own deadline.
 */
function answerWrite(cmd, say, going, { what, done, early = null }) {
  const timer = setTimeout(() => say(sentWords(what)), Math.max(0, cmd.at + SIRI_ANSWER_MS - Date.now()))
  const finish = (ok, words = null) => {
    clearTimeout(timer)
    if (ok === true) say(done())
    else if (ok === null) say(sentWords(what))
    else say(words || failedWords())
  }
  if (early) early.then((e) => finish(e.ok, e.words))
  return Promise.resolve(going).then(
    (ok) => finish(ok === true),
    () => finish(false)
  )
}

/* The first answer to a select of this slot, for at most a little past Siri's wait. */
function presetHeard(number) {
  let off = () => {}
  const heard = new Promise((resolve) => {
    off = onPresetAnswered((e) => {
      if (e.number !== number) return
      off()
      resolve(e)
    })
  })
  setTimeout(() => off(), SIRI_ANSWER_MS + 1000)
  return heard
}

/* A slot's name as Play has it: the preset on screen's own, or the preset list's. */
function presetName(number) {
  const p = getState().preset
  if (p?.number === number && p.name) return p.name
  const listed = nameOf(number)
  return typeof listed === 'string' ? listed : ''
}

/*
 * WHO THE LINKS ARE OPEN TO (lib/siri-rule linksOpen): Justin's account, by
 * the session kept on the phone as Bluetooth (beta) is told (App.js asks
 * haveSession(), never the account server, which answers nobody at a gig
 * with no signal); and everybody once this copy is the new store version,
 * which is a fact about the copy itself and nothing an update can switch.
 */
let linksAdmin = false
let installed
const gateWatchers = new Set()
const builtIn = () => {
  if (installed === undefined) installed = installedStoreVersion()
  return installed
}

/** For App.js, at launch and at every change of who is signed in: the id of the session kept on this phone, or nothing. */
export function allowSiriLinks(id) {
  const was = siriLinksOpen()
  linksAdmin = isAdmin(id)
  if (siriLinksOpen() !== was) for (const fn of [...gateWatchers]) fn()
  return siriLinksOpen()
}

/** Whether a fractalremote:// link is acted on, for this account on this copy of the app. Settings → Siri asks it too. */
export const siriLinksOpen = () => linksOpen({ native: siriPresent(), platform: Platform.OS, installed: builtIn(), admin: linksAdmin })

const subscribeGate = (fn) => {
  gateWatchers.add(fn)
  return () => gateWatchers.delete(fn)
}

/** The same, redrawn when it changes: for the Settings page that says how to use them. */
export const useSiriLinksOpen = () => useSyncExternalStore(subscribeGate, siriLinksOpen, siriLinksOpen)

/* The gate open within `ms`, for a link that started the app before who is signed in was known. */
function openWithin(ms) {
  if (siriLinksOpen()) return Promise.resolve(true)
  return new Promise((resolve) => {
    const opened = () => {
      if (!siriLinksOpen()) return
      clearTimeout(timer)
      gateWatchers.delete(opened)
      resolve(true)
    }
    const timer = setTimeout(() => {
      gateWatchers.delete(opened)
      resolve(siriLinksOpen())
    }, ms)
    gateWatchers.add(opened)
  })
}

/*
 * HOW LONG A LINK THAT STARTED THE APP WAITS FOR THE APP TO KNOW WHO IS
 * SIGNED IN: a tuner/off link from a phone whose app had been closed, with
 * the gate still deciding.
 */
export const LAUNCH_GATE_MS = 5000

/**
 * One fractalremote:// link. `launch` for the link that started the app:
 * that one is only ever Tuner off. Its tap was made before the app had even
 * started, so anything else would land seconds late, by the tap rule; and the
 * phone hands the same launch link over again after the app reloads itself
 * for an update, which must not step a setlist on by itself. True when it was
 * taken as a command.
 */
export async function carryOutLink(url, { launch = false } = {}) {
  const asked = parseLink(url)
  if (!asked) return false
  if (launch && asked.command !== 'tunerOff') {
    logDebug('siri', `link ${asked.command}: it started the app, so it is not sent (the tap rule)`)
    return false
  }
  if (!(launch ? await openWithin(LAUNCH_GATE_MS) : siriLinksOpen())) {
    logDebug('siri', `link ${asked.command}: not open to this account on this copy of the app yet`)
    return false
  }
  carryOut({ ...asked, id: null, at: Date.now(), answered: false, from: 'link' })
  return true
}

/** One command, from Siri (`from: 'siri'`) or a link. Exported for the tests; the app reaches it by startSiri. */
export function carryOut(cmd) {
  if (cmd.id) {
    if (seen.includes(cmd.id)) return Promise.resolve()
    seen.push(cmd.id)
    if (seen.length > 32) seen.shift()
  }
  const say = answerer(cmd)
  logDebug('siri', `${cmd.from} ${cmd.command}`, `${cmd.value ?? ''}${cmd.answered ? ' (Siri already told Not sent)' : ''}`)
  const run = cmd.command === 'tunerOff' ? tunerOff(cmd, say) : onPlay(cmd, say)
  return Promise.resolve(run).catch((err) => {
    logDebug('siri', `${cmd.command} failed`, err?.message || String(err))
    say(SIRI_SAYS.notSent)
  })
}

/* Every command but Tuner off: Play, the tap rule from `at`, the link after a sleep, then the command. */
async function onPlay(cmd, say) {
  /*
   * A TUNER ON IS ON ITS WAY FROM HERE (rig tunerAskWaits), before any wait:
   * for Play while the app starts, or for the link after a sleep. A Tuner
   * off's second try, Siri's or the watch's, waits while one is, and then
   * goes only over a tuner that is not open. Without it, a close first to
   * hear the link back would go ahead of this open, and be stamped as it is
   * sent, later than this open's `at`: the relay would keep the close as the
   * newer of the two, and the tuner asked for would never open. Let go of
   * once it has pressed, when rig.writeTuner counts the open itself until
   * the unit answers, or as soon as it never will press.
   */
  const waiting = cmd.command === 'tunerOn' ? tunerAskWaits() : () => {}
  try {
    const deadline = tapDeadline(cmd.at)
    /* Siri was told "Not sent." already, and it would be late now anyway. */
    if (cmd.answered) return notSent(cmd, say)
    if (!play) {
      if (elsewhere) return say(SIRI_SAYS.openPlay(deviceNoun()))
      /*
       * Still starting: Play may be up inside the tap rule, and if not, the
       * command would land late. Unless there is no computer to land on: with
       * the link started and not up ('joining' or 'no-answer': signed in
       * with no computer yet, or one that does not answer, which is the
       * waiting screen in Play's place), it is Not sent because nothing is
       * connected, as Play says it. A link not started yet ('off', the app
       * still reading who is signed in, the demo included, whose link is
       * 'connected' once it starts) has said nothing about the computer, so
       * that stays late.
       */
      const nobody = ['joining', 'no-answer'].includes(linkState().link)
      if (!(await playWithin(deadline - Date.now()))) return notSent(cmd, say, { late: !nobody })
    }
    if (Date.now() >= deadline) return notSent(cmd, say)
    /*
     * NOT ON SCREEN YET: Siri's panel over the app, or the app coming forward
     * from a sleep. A link that is up goes at once; one that slept with the
     * app is waited for, inside the tap rule and no longer, as a watch tap
     * that woke the phone is.
     */
    if (AppState.currentState !== 'active') {
      const up = await untilConnected(Math.max(0, deadline - Date.now()))
      if (!up) return notSent(cmd, say, { late: false })
      if (Date.now() >= deadline) return notSent(cmd, say)
    }
    if (!play) return say(SIRI_SAYS.openPlay(deviceNoun()))
    /* Pressed as this returns, if it presses at all: the answer is not waited for here. */
    return command(cmd, say)
  } finally {
    waiting()
  }
}

function command(cmd, say) {
  const s = getState()
  const caps = s.capabilities
  const addressing = caps?.presets?.addressing
  const { at, value } = cmd

  if (cmd.command === 'scene') {
    const shape = sceneShape(caps)
    if (!shape.hasScenes) return say(SIRI_SAYS.noScenes)
    /* Spoken 1-based, 1 to 8; an AM4 has four. */
    if (!Number.isInteger(value) || value < 1 || value > shape.count) return say(SIRI_SAYS.sceneCount(shape.count))
    const index = value - 1
    return answerWrite(cmd, say, writeScene(index, at), {
      what: `Scene ${value}`,
      done: () => SIRI_SAYS.scene(value, getState().sceneNames?.[index] || '')
    })
  }

  if (cmd.command === 'next' || cmd.command === 'previous') {
    const by = cmd.command === 'next' ? 1 : -1
    const to = play.landing(by)
    if (to === null) {
      /* A VP4 slot by slot: Play's own button says why on screen too. At the end of the slots, nothing. */
      const why = play.stuck?.() ?? null
      if (why) play.step(by, at)
      return say(why || SIRI_SAYS.end(by))
    }
    const label = slotLabel(to, addressing)
    const early = presetHeard(to)
    return answerWrite(cmd, say, play.step(by, at), {
      what: by > 0 ? 'Next song' : 'Previous song',
      done: () => SIRI_SAYS.step(by, label, presetName(to)),
      early
    })
  }

  if (cmd.command === 'preset') {
    /* The number Play prints in front of the name: 12 for 012, or 012 D01 on an AM4. */
    const count = slotCount(caps)
    if (!Number.isInteger(value) || value < 0 || (count !== null && value >= count)) return say(SIRI_SAYS.presetRange(count))
    const label = slotLabel(value, addressing)
    /* The one on screen already: loading it again would throw away what has not been saved, for a word Siri may have misheard. */
    if (s.preset?.number === value) return say(SIRI_SAYS.presetSame(label))
    const early = presetHeard(value)
    return answerWrite(cmd, say, loadPreset(value, at), {
      what: `Preset ${label}`,
      done: () => SIRI_SAYS.preset(label, presetName(value)),
      early
    })
  }

  if (cmd.command === 'tempo') {
    if (vp4Here()) return say(VP4_NO_TEMPO)
    /* This unit's own range (lib/tempo): what the tempo box takes. */
    const range = tempoRange(s.deviceSlug, caps?.via)
    if (!Number.isInteger(value) || value < range.min || value > range.max) return say(SIRI_SAYS.tempoRange(range.min, range.max))
    return answerWrite(cmd, say, writeTempo(value, at), { what: `Tempo ${value}`, done: () => SIRI_SAYS.tempo(value) })
  }

  if (cmd.command === 'tunerOn') {
    /* The tuner mutes the rig, and its Stop button is on Play: said so in the answer. */
    if (caps?.tuner === false) return say(SIRI_SAYS.noTuner)
    if (s.tunerOn) return say(SIRI_SAYS.tunerAlready)
    return answerWrite(cmd, say, writeTuner(true, at), { what: 'Tuner on', done: () => SIRI_SAYS.tunerOn })
  }

  if (cmd.command === 'pedalOn' || cmd.command === 'pedalOff') {
    const on = cmd.command === 'pedalOn'
    if (!SIRI_PEDALS.includes(value)) return say(SIRI_SAYS.notSent)
    /*
     * PLAY'S OWN CHAIN, AND ONLY ONCE IT IS THIS PRESET'S, read: never the
     * outline drawn before the chain read, and never the last preset's chain
     * still up after a song change (lib/chain-view chainActs), whose pedal of
     * the same kind is another song's.
     */
    if (!chainActs(chainViewOf(s))) return say(SIRI_SAYS.notRead)
    const blocks = s.blocks || []
    let block
    if (value === 'boost') {
      /* An AM4 amp's boost (lib/am4-boost), sent as Boost on or off and never as a bypass. */
      const slug = pedalSlug()
      if (!isAm4(slug)) return say(SIRI_SAYS.boostNotHere)
      const amps = blocks.filter((b) => ampPedal(slug, b) !== null)
      if (!amps.length) return say(SIRI_SAYS.noAmp)
      if (amps.length > 1) return say(SIRI_SAYS.manyPedals('amp'))
      if (ampPedal(slug, amps[0]) === 'other') return say(OTHER_AMP_SAYS)
      block = amps[0]
    } else {
      /* Exactly one of the kind, never a guess: Delay 1 and Delay 2 is a reason to use the screen. */
      const found = pedalMatches(blocks, value)
      if (!found.length) return say(SIRI_SAYS.noPedal(value))
      if (found.length > 1) return say(SIRI_SAYS.manyPedals(value))
      block = found[0]
    }
    /* On or off as asked, never a flip: said twice, it is the same thing twice. */
    return answerWrite(cmd, say, writeBypass(idOf(block), !on, at), {
      what: `${pedalWord(value)} ${on ? 'on' : 'off'}`,
      done: () => SIRI_SAYS.pedal(value, on)
    })
  }

  return say(SIRI_SAYS.notSent)
}

/*
 * TUNER OFF, FROM ANY SCREEN, NEVER DROPPED. A close has no deadline and is
 * never refused (rig.writeTuner). With the link up it goes at once; with it
 * asleep, Siri is answered first and the close waits for the link, and either
 * way one that did not go is tried once more. Sent whatever the app thinks
 * the tuner is doing: after a cold start it knows nothing, and the rig may
 * still be muted on the unit's tuner.
 *
 * UP OR ASLEEP IS THE LINK'S WORD, NOT AppState's, as it is for onPlay:
 * Siri's own panel over the app makes it 'inactive' with the link up, which
 * is the most common way this is said (Play open, rig connected), and taking
 * that for a sleep told the player the connection was down when it was not,
 * and spent Siri's one answer on it. A link that only looks up after a sleep
 * is the second try's to catch. And a close still out when Siri must be
 * answered is said as sent, unless the link has gone in the meantime.
 * AppState says one thing here only: whether the app has gone into the
 * background, after which the window holds (SIRI_CLOSE_WINDOW_MS).
 */
function tunerOff(cmd, say) {
  const up = () => linkState().link === 'connected'
  const ready = up()
  let timer = null
  if (ready) timer = setTimeout(() => say(up() ? sentWords('Tuner off') : SIRI_SAYS.tunerOffSoon), Math.max(0, cmd.at + SIRI_ANSWER_MS - Date.now()))
  else say(SIRI_SAYS.tunerOffSoon)
  const close = () => writeTuner(false)
  /* What is left of SIRI_CLOSE_WINDOW_MS, by the clock, which runs on while the app is stopped. */
  const left = () => Math.max(0, cmd.at + SIRI_CLOSE_WINDOW_MS - Date.now())
  /*
   * AWAY: the app has gone into the background since this began, or was
   * there as it began. iOS says so before it stops the app, so a chain that
   * goes on at the next launch has heard it. Only then is the window kept:
   * with the app still on screen nothing stops it, and the close itself can
   * take most of the window (SIRI_CLOSE_WINDOW_MS says how).
   */
  let away = AppState.currentState === 'background'
  let sub = null
  try {
    sub = AppState.addEventListener('change', (s) => {
      if (s === 'background') away = true
    })
  } catch {
    sub = null
  }
  const late = () => away && left() <= 0
  const tooLate = () => {
    logDebug('siri', 'tuner off: too late to try again')
    clearTimeout(timer)
    say(SIRI_SAYS.notSent)
    return null
  }
  /* With the link asleep, the first try too: the app may have been stopped while it waited. */
  const first = ready
    ? close()
    : (probeNow(), pause(400).then(() => untilConnected()).then(() => (late() ? tooLate() : close())))
  return Promise.resolve(first).then(async (ok) => {
    if (ok === null) return undefined
    if (ok) {
      clearTimeout(timer)
      return say(SIRI_SAYS.tunerOff)
    }
    logDebug('siri', 'tuner off: the first try did not go; trying once more')
    await pause(1500)
    /* On screen, the link's own wait, as it always was; away, no longer than the window. */
    await untilConnected(away ? left() : 8000)
    /*
     * NOT AHEAD OF A TUNER ON STILL ON ITS WAY (rig tunerAskWaits): one
     * waiting for the same link, or for Play, which has pressed nothing yet,
     * and one pressed and not yet answered, which tunerOn already shows as
     * open though nothing has opened. Each is waited for (inside the window,
     * once the app is away): one that lands is the tuner now, and one
     * dropped, refused or failed opened nothing, so the rig still wants its
     * close.
     */
    while (tunerAsksWaiting() > 0 && !late()) await pause(100)
    if (late()) return tooLate()
    /*
     * NOT OVER A NEWER PRESS. The first try is also false when a newer press
     * of the tuner overtook it (rig.writeTuner), and in the second and a half
     * since, the player may have tapped Tuner on Play to tune, or said it.
     * That press set tunerOn, which nothing but rig.writeTuner sets, and it
     * has been answered, so it is open now because somebody opened it: a
     * close sent over it would shut the tuner mid-tune and put the open
     * strings through the PA. A newer close leaves it false, and then one
     * more close does no harm.
     */
    if (getState().tunerOn) {
      logDebug('siri', 'tuner off: opened again since, so not tried again')
      return say(SIRI_SAYS.tunerAlready)
    }
    if (await close()) return say(SIRI_SAYS.tunerOff)
    logDebug('siri', 'tuner off: gave up')
    return say(failedWords())
  }).finally(() => sub?.remove?.())
}

/**
 * For App.js, once: listen for Siri's commands and the links for the life
 * of the app. Returns the way to stop. No Siri on a build without the Siri
 * module (lib/siriPipe), on Android and in the browser; the links on any
 * build, for whoever they are open to.
 */
export function startSiri() {
  const offSiri = onSiriCommand((cmd) => {
    carryOut({ ...cmd, from: 'siri' })
  })
  let sub = null
  try {
    sub = Linking.addEventListener('url', (event) => {
      carryOutLink(event?.url)
    })
  } catch {
    sub = null
  }
  let alive = true
  Promise.resolve()
    .then(() => Linking.getInitialURL())
    .then((url) => {
      if (alive && url) carryOutLink(url, { launch: true })
    })
    .catch(() => {})
  return () => {
    alive = false
    offSiri()
    sub?.remove?.()
  }
}

import { useEffect, useRef } from 'react'
import { AppState } from 'react-native'
import { requireOptionalNativeModule } from 'expo'

import { blockColor } from './blockColors'
import { logDebug } from './debugLog'
import { idOf, sameBlock } from './device'
import { probeNow, untilConnected } from './link'
import { shortBlock } from './shortName'
import { getState, noTapTempo, tapTempo, tunerAskWaits, tunerAsksWaiting, writeBypass, writeChannel, writeScene, writeTuner } from './rig'
import { tapDeadline } from './relay-rules'
import { createWatchSender, watchCommand, watchState, watchTapInTime } from './watch-link'
import { metronome, setWatchTap, useMetronome } from './metronome'
import { boostPedals } from './am4-boost'
import { boostNow, pedalSlug } from './rig'
import { noteWatchKnows, pagesToSend, tunerStaysToSend, useWatchPages, watchChecksIn, watchHasTempo } from './watchPages'
import { onQuickChange, quickAsked, quickFollows, quickHeard, quickToSend } from './watchQuickEdit'

/*
 * THE APPLE WATCH, FROM THE PHONE'S SIDE.
 *
 * The watch draws what the phone tells it and asks for one of eleven things —
 * see lib/watch-link (shared/watch-link.mjs) for both halves of that. This is
 * the phone keeping its end: a fresh picture whenever the stage screen's
 * changes, and each request carried out with the same calls the stage
 * screen's own buttons make, so a scene from the wrist is the scene from the
 * screen.
 *
 * INERT UNTIL THE WATCH IS BUILT IN. The link itself is native (Apple's
 * WatchConnectivity, the FractalWatch module), and it only exists in a build
 * that carries the watch app. Without it `requireOptionalNativeModule` answers
 * null and every line below does nothing, so this can ship in an ordinary
 * update ahead of that build.
 */

/*
 * THE PICTURE FOR THE WATCH THAT IS THERE. What Play gave (`from`), with the
 * things only a watch that has said it knows them is sent: its pages
 * (lib/watchPages pagesToSend), its Tempo page's tempo (watchHasTempo), the
 * tuner's "stays on when you swipe away" switch (tunerStaysToSend), and
 * quick edit: whether a hold offers it here (`quickOffered`, Play's own
 * answer) and the open sheet's knobs (lib/watchQuickEdit quickToSend). To
 * any other watch none of them is in the picture at all, and it is field
 * for field what it always was.
 */
const pictured = (from) => watchState({ ...from, tempo: watchHasTempo() ? from.tempo : null, tunerStays: tunerStaysToSend(), ...pagesToSend(), ...quickToSend(from.quickOffered) })

let native
function link() {
  if (native !== undefined) return native
  try {
    native = requireOptionalNativeModule('FractalWatch')
  } catch {
    native = null
  }
  return native
}

/** Whether this build can talk to a watch at all. */
export const watchSupported = () => !!link()

/*
 * How long after the phone heard a Tuner off from a woken phone its second
 * try may still go: under the 25 seconds the phone is kept awake for a
 * watch request (FractalWatchModule WAKE_SECONDS), so it is never left to
 * go at the next launch, over whatever tuner is up by then.
 */
export const WATCH_CLOSE_WINDOW_MS = 20000

/*
 * HOW THE WATCH IS USED, in the order somebody meets it. One list for both
 * places that say it: the note the Play screen shows once, and Settings →
 * Apple Watch, where it can be read again.
 *
 * WATCH_HOW_LOCKED promises only what a woken tap does (the 2 November 2026
 * audit). It used to say to lock the iPhone and put it away, but a tap that
 * wakes a locked iPhone is dropped when the connection is not back inside
 * the tap's second and a half (WOKEN BY THE TAP, below), and after the
 * iPhone has slept it mostly is not. The connection keeps coming back while
 * the tap holds the iPhone awake (25 seconds, FractalWatchModule
 * WAKE_SECONDS), so a tap again straight away usually lands; one after that
 * is a first tap after a long pause again. So: every tap lands with the
 * iPhone unlocked on Play, and locked, the first tap after a long pause may
 * not, and the retry is to tap again straight away. The Play screen's note
 * was shown once under the old words, so its key moved with them (lib/coach
 * WATCH_TIP_KEY, v2).
 */
export const WATCH_HOW_OPEN = 'Keep the Play screen open on your iPhone while you use the watch. The watch works through this app, so it stops when the app is closed or the phone locks.'
export const WATCH_HOW_LOCKED = 'For every tap on the watch to land, keep your iPhone unlocked with this app on the Play screen. With the iPhone locked, the first tap after a long pause may not go through; tap again straight away and it usually does. The live tuner needs the phone open.'
/*
 * AND FOR A WATCH THAT CHECKS IN (its hello's `here`, lib/watchPages
 * watchChecksIn): while the watch app is on the watch's screen it keeps
 * this app awake on a locked iPhone, so the "long pause" of
 * WATCH_HOW_LOCKED is now the wrist being down. Said with what it costs
 * (the iPhone awake, so more of its battery) and no more than happens: the
 * watch app stops when the wrist goes down, the iPhone sleeps about half a
 * minute after (FractalWatchModule's 25 seconds), and an app that has been
 * swiped closed is not on Play for the watch to reach.
 */
export const WATCH_HOW_LOCKED_HERE =
  'For every tap on the watch to land, keep your iPhone unlocked with this app on the Play screen. With the iPhone locked, the watch keeps this app awake while the watch app is on the watch’s screen, which uses more of the iPhone’s battery. Lower your wrist and the iPhone goes back to sleep about half a minute later; the first tap after that may not go through, so tap again straight away. The live tuner needs the phone open. If this app has been swiped closed on the iPhone, open it again: the watch can’t.'
export const WATCH_HOW = [
  WATCH_HOW_OPEN,
  'Swipe up or down on the watch, or turn the Digital Crown, to move between its four pages: Scenes, Pedals, Presets and Tuner.',
  'Tap a scene or a pedal to switch it. Presets has Previous and Next.',
  'The tuner starts only when you tap it, and turns off when you leave its page.'
]

/** Whether this build wakes on a watch tap, so the phone may stay locked. */
export function watchWakes() {
  try {
    return link()?.wakes?.() === true
  } catch {
    return false
  }
}

/** How the watch is used, in this build's words: the first line depends on wake on tap. */
const howLines = () => (watchWakes() ? [watchChecksIn() ? WATCH_HOW_LOCKED_HERE : WATCH_HOW_LOCKED, ...WATCH_HOW.slice(1)] : WATCH_HOW)

/*
 * AND IN THIS WATCH'S: one that has the Tempo page (its hello's `tempo`,
 * lib/watchPages) has five pages, not the four WATCH_HOW names, and a line
 * for the new one. A watch from before that build is told what it always
 * was, since those are the pages it has.
 */
export const WATCH_HOW_PAGES_TEMPO = 'Swipe up or down on the watch, or turn the Digital Crown, to move between its pages: Scenes, Pedals, Presets, Tempo and Tuner.'
export const WATCH_HOW_TEMPO = 'Tempo shows the tempo. Tap its button in time to set a new one.'
/* And the tuner's line, where its "stays on when you swipe away" switch is on (components/WatchTunerStays, on the same page): WATCH_HOW's says it turns off when its page is left, which that switch undoes. */
export const WATCH_HOW_TUNER_STAYS = 'The tuner starts only when you tap it. Leaving its page doesn’t stop it, as you chose above: tap Stop tuning.'
export function watchHow() {
  const lines = howLines()
  const tuner = tunerStaysToSend() === true ? WATCH_HOW_TUNER_STAYS : lines[3]
  return watchHasTempo() ? [lines[0], WATCH_HOW_PAGES_TEMPO, lines[2], WATCH_HOW_TEMPO, tuner] : [...lines.slice(0, 3), tuner]
}

/** A watch is paired with this phone and has the watch app on it. False on any doubt. */
export function watchPaired() {
  try {
    return link()?.isPaired?.() === true
  } catch {
    return false
  }
}

/**
 * Kept by the stage screen: `picture` is the watch's state as that screen
 * sees it now (watch-link's watchState input, with the stage's own blocks as
 * `chain`), `step(by)` its own Previous and Next, which already know the
 * setlist and the ends of the list.
 */
export function useWatchBridge(picture, step) {
  /*
   * ON AN AM4 THE AMP'S PEDAL IS ITS BOOST, on the wrist as on Play (lib/
   * am4-boost): lit for Boost on, what Play shows (rig.boostNow), with Play's
   * own word for it under its name (Boost on, Boost off, Amp off, or none
   * until the unit has said), and a tap asks for the boost the wrist shows it
   * will turn to, which rig.writeBypass sends as it is and never as a bypass:
   * the same message twice is the same boost twice.
   */
  picture = { ...picture, chain: boostPedals(picture?.chain, { slug: pedalSlug(), shown: boostNow() }) }
  /* Whether Play can be seen (Stage `awake`, in the picture): left out means yes, as every caller before it. */
  const awake = picture.awake !== false
  const sender = useRef(null)
  const last = useRef(null)
  /* What the last picture was made from, so it can be made again the moment the watch says what it knows (the hello, below). */
  const lastFrom = useRef(null)
  const stepRef = useRef(step)
  stepRef.current = step
  /* The watch's pages as chosen and whether the watch takes them (lib/watchPages): read here so a change to either draws this again, and the picture below goes out with it. */
  useWatchPages()
  /* And the metronome's setting, so the wrist's own switch (a `wrist` request, below) is in the next picture and not the one after something else moves. */
  useMetronome()

  /* One sender and one listener for the life of the screen, and none while
     Play is kept out of sight beside a tool that fills the window (`awake`
     false, components/Sides): the watch sees what it sees when Play is not
     open, and a Play shown again starts afresh. */
  useEffect(() => {
    const watch = link()
    if (!watch) return undefined
    if (!awake) return undefined
    sender.current = createWatchSender({
      send: (state, { urgent }) => watch.sendState(JSON.stringify(state), urgent)
    })
    /*
     * QUICK EDIT'S KNOBS MOVED (lib/watchQuickEdit): read, read again, a
     * turn taken or the sheet closed, none of which draws Play. So the
     * picture is made again from what Play last gave and goes out at the
     * usual pace.
     */
    onQuickChange(() => {
      if (!lastFrom.current || !sender.current) return
      last.current = pictured(lastFrom.current)
      sender.current.push(last.current)
    })
    const sub = watch.addListener?.('onCommand', (event) => {
      let msg = null
      try {
        msg = JSON.parse(event?.json || 'null')
      } catch {
        msg = null
      }
      const cmd = watchCommand(msg, last.current)
      if (!cmd) return
      /* Anything the watch asks says it is there, which is how long an open quick edit sheet's knobs are kept (lib/watchQuick WATCH_QUICK_IDLE_MS). */
      quickHeard()
      /*
       * WHEN THE PHONE HEARD IT, which is as near the wrist as this end can
       * know: a request carries no time, and the watch's own retry can make
       * it a second late already. Every write below is bound by the deadline
       * counted from here (relay-rules TAP_DEADLINE_MS), exactly as a tap on
       * the phone's own screen is from the press.
       *
       * Heard by the phone's Swift, not by this listener: `at` is when the
       * FractalWatch module took the request, and one it held while nothing
       * listened (Play not yet open, or the app launched by the tap) keeps
       * that time rather than starting a fresh 1.5 seconds up to fifteen
       * seconds later. A build from before `at` sends none, and then it is now.
       */
      const receivedAt = Number.isFinite(event?.at) ? Math.min(event.at, Date.now()) : Date.now()
      const asleep = AppState.currentState !== 'active'
      /*
       * THE CHECK-IN (watch-link THE CHECK-IN): the watch is on screen, and
       * says so every twenty seconds so the iPhone stays awake while it is
       * looked at. The holding awake is the native half's, which renews its
       * 25 seconds on any message; here it is NOTHING: no request to the
       * unit, no setting, no log line every twenty seconds on a phone that
       * is awake anyway. One thing only: a phone it found asleep is set to
       * rejoin its connection, as the hello does, so what the unit does
       * next can reach the watch.
       */
      if (cmd.do === 'here') {
        if (asleep) {
          logDebug('watch', 'here', 'the watch is on screen (kept the phone awake)')
          probeNow()
        }
        return
      }
      logDebug('watch', cmd.do, `${JSON.stringify(cmd)}${asleep ? ' (woke the phone)' : ''}`)
      if (cmd.do === 'hello') {
        /*
         * WHAT THE WATCH KNOWS, said in its hello (watch-link WATCH_KNOWS):
         * kept, and the picture it is about to be sent made again with it,
         * so a watch that takes its pages from the phone opens on the ones
         * chosen rather than on the usual four for a quarter of a second. A watch from
         * before says nothing, the answer is "nothing", and its picture is
         * the one it always had.
         */
        noteWatchKnows(cmd.knows)
        if (lastFrom.current) last.current = pictured(lastFrom.current)
        sender.current?.flush(last.current)
        if (asleep) probeNow()
        return
      }
      /*
       * THE TEMPO PAGE'S SWITCH: the metronome's "Tap on the watch", on or
       * off (lib/metronome setWatchTap). A setting kept on the phone, with
       * nothing to send to the unit, so it needs no connection and is the
       * same whether the phone was awake or woken by it.
       */
      if (cmd.do === 'wrist') {
        setWatchTap(cmd.on)
        return
      }
      /*
       * THE TEMPO PAGE'S TAP: one press of Play's own Tap button, by the
       * function that button calls (rig.tapTempo), so the same count, the
       * same range, the same limits and the same refusals. Not through the
       * woken phone's wait below: A TAP IS A BEAT, and one held until the
       * connection is back would be counted at the wrong moment. So it is
       * pressed as it arrives or not at all: a tap the app comes to more
       * than WATCH_TAP_LATE_MS after the phone heard it is not counted, and
       * one that finds the link down is refused by tapTempo itself, as
       * Play's is ("nothing counted, nothing shown"). A phone woken by it
       * is set to rejoin, so the taps after it have a link to go by.
       */
      if (cmd.do === 'tap') {
        if (!watchTapInTime(receivedAt)) {
          logDebug('watch', 'tap not counted: it was held too long on its way')
          return
        }
        if (asleep) probeNow()
        tapTempo()
        return
      }
      /*
       * A QUICK EDIT SHEET CLOSING on the wrist (lib/watchQuickEdit): the
       * phone lets its knobs go. Nothing for the unit, so it waits for no
       * connection and is the same from a phone awake or woken.
       */
      if (cmd.do === 'knobs' && cmd.id === null) {
        quickAsked(cmd)
        return
      }
      const run = () => {
        if (cmd.do === 'scene') return writeScene(cmd.index, receivedAt)
        if (cmd.do === 'pedal') return writeBypass(cmd.id, !cmd.on, receivedAt)
        if (cmd.do === 'preset') return stepRef.current?.(cmd.step, receivedAt)
        /*
         * A pedal held on the wrist, and a channel picked: the Play screen's
         * channel sheet's own write, which turns down the outline and another
         * preset's chain by itself. And only for a block the chain on screen
         * still has: a phone woken by the tap checks the request against the
         * picture it sent before it locked, so this at least refuses an id the
         * chain no longer has. (An id names a kind of block, Drive 1 or Delay
         * 2, so a newer preset with the same block still takes it — as a
         * switch on or off from the wrist does today.) Bound by the deadline
         * counted from when the phone heard it, like every other tap.
         */
        if (cmd.do === 'channel') {
          const here = getState().blocks.some((b) => sameBlock(b, cmd.id))
          return here ? writeChannel(cmd.id, cmd.channel, receivedAt) : undefined
        }
        if (cmd.do === 'tuner' && getState().tunerOn !== cmd.on) return writeTuner(cmd.on, receivedAt)
        /*
         * QUICK EDIT, from a pedal held on the wrist (lib/watchQuickEdit):
         * its knobs read when the sheet opens, and one of them put where
         * the Digital Crown says. Both by Edit's own read and Edit's own
         * checked write and by nothing else, so the guards that hold a knob
         * turned on the screen hold these. Each was checked against the
         * last picture already: only where it offered quick edit, and a
         * turn only of a knob it listed for that pedal.
         */
        if (cmd.do === 'knobs' || cmd.do === 'knob') return quickAsked(cmd)
        return undefined
      }
      if (!asleep) {
        run()
        return
      }
      const pause = (ms) => new Promise((r) => setTimeout(r, ms))
      /*
       * THE TUNER CLOSING, from a woken phone, as it always went: the tuner
       * mutes the unit, and leaving its page is the watch saying "stop" — a
       * close that was dropped would leave the unit muted. So it waits for
       * the connection and is tried once more, and is never dropped.
       *
       * SENT WHATEVER THE APP THINKS THE TUNER IS DOING, unlike run()'s
       * close on a phone awake. A woken phone may have been started afresh
       * by this very request, with the app gone from memory in the pocket:
       * it knows nothing of the tuner, and the rig may still be muted on it.
       *
       * AND TRIED AGAIN WHEN IT DID NOT GO. rig.writeTuner never throws: a
       * close that did not go answers false, so that is what is asked here.
       *
       * NEVER OVER A TUNER OPENED SINCE. While the first try is out and the
       * second waits, the screens say the tuner is off, so the watch offers
       * Tuner on, and Play does too. An open tapped then is the player's to
       * keep. One that pressed is in tunerOn. One that woke the phone and
       * waits for the same link has pressed nothing yet, so the second try
       * waits for every such request to press or be dropped (rig
       * tunerAskWaits) before it reads tunerOn: first to hear the link
       * back, it would otherwise close as the newer press and take the
       * open's place before it landed. And one that was dropped or refused
       * opened nothing, so it keeps nothing back: the rig still wants its
       * close.
       *
       * AND ONLY WHILE THE WATCH IS STILL WAITING FOR IT. The phone is woken
       * for 25 seconds (FractalWatchModule WAKE_SECONDS) and the code then
       * stops where it is, so a second try still waiting for a link that
       * never came would go at the next launch or wake, minutes or hours
       * later, over a tuner opened on the unit or another device since. It
       * goes inside WATCH_CLOSE_WINDOW_MS of the request or not at all, and
       * the clock, which runs on while the code is stopped, is what says so.
       */
      if (cmd.do === 'tuner' && !cmd.on) {
        const close = () => writeTuner(false, receivedAt)
        const left = () => Math.max(0, receivedAt + WATCH_CLOSE_WINDOW_MS - Date.now())
        probeNow()
        pause(400)
          .then(() => untilConnected())
          .then(close)
          .then(async (ok) => {
            if (ok) return
            logDebug('watch', 'tuner off: the first try did not go; trying once more')
            await pause(1500)
            await untilConnected(left())
            while (tunerAsksWaiting() > 0 && left() > 0) await pause(100)
            if (left() <= 0) {
              logDebug('watch', 'tuner off: too late to try again')
              return
            }
            if (getState().tunerOn) {
              logDebug('watch', 'tuner off: opened again since, so not tried again')
              return
            }
            if (!(await close())) logDebug('watch', 'tuner off: gave up')
          })
          .catch((err) => logDebug('watch', 'gave up', err?.message || String(err)))
        return
      }
      /*
       * WOKEN BY THE TAP, the phone locked in a pocket. The connection to the
       * computer slept with the app, so it is rejoined first — but only for
       * as long as the tap's deadline lasts. "A scene tap that can't get
       * through is dropped": one that would land seconds after the wrist is
       * worse than one that never lands, so it is not sent, and not tried
       * again, which could only land later still. The watch shows what the
       * unit is really on with its next picture; it never moved by itself.
       *
       * Most phones locked long enough to sleep the connection will not be
       * back inside the deadline, so most of these taps are now dropped.
       * That is the rule as it was agreed, said here so it is not mistaken
       * for a fault. The relay itself waits for a connection still coming
       * back, inside the same deadline, so no pause is put in front of it.
       */
      const deadline = tapDeadline(receivedAt)
      /* A Tuner on waiting here is one a Tuner off's second try waits for (rig tunerAskWaits): let go of once it has pressed, when its open counts itself until answered, or never will press. */
      const waiting = cmd.do === 'tuner' ? tunerAskWaits() : () => {}
      probeNow()
      untilConnected(Math.max(0, deadline - Date.now()))
        .then((up) => {
          try {
            if (!up || Date.now() >= deadline) {
              logDebug('watch', `${cmd.do} not sent: the phone could not reach the rig in time after waking`)
              return undefined
            }
            return run()
          } finally {
            waiting()
          }
        })
        .finally(waiting)
        .catch((err) => logDebug('watch', 'not sent', err?.message || String(err)))
    })
    return () => {
      sub?.remove?.()
      onQuickChange(null)
      sender.current?.stop()
      sender.current = null
    }
  }, [awake])

  /* Every render of the stage screen is a chance the picture moved. */
  useEffect(() => {
    if (!sender.current) return
    const { chain, channels, awake: seen, quickEdit, ...rest } = picture
    /* Each pedal with its channel and what a hold may switch it to: the
       stage screen's own list, empty wherever its own hold does nothing.
       And its word: an AM4 amp's Boost on, Boost off or Amp off, as Play's
       tile says it, put on it above by boostPedals; none on any other. */
    const pedals = (chain || []).map((b) => ({ id: idOf(b), name: b.name, short: shortBlock(b), on: !b.bypassed, ...blockColor(b.slug), channel: b.channel, channels, word: b.word }))
    /* The metronome's tap, when the watch's switch is on: see lib/metronome. */
    const beat = metronome()
        /* And the Tempo page: the tempo Play's Tap button shows, whether that button sends anything here and Play's sentence where it does not (rig.noTapTempo), the wrist's switch, and whether the metronome is running at all. */
    const tempo = { bpm: getState().bpm, why: noTapTempo(), wrist: beat.watch === true, running: beat.on === true }
    lastFrom.current = { ...rest, pedals, metronome: { on: beat.on && beat.watch, bpm: getState().bpm }, tempo, quickOffered: quickEdit === true }
    /* Quick edit: whether a hold offers it here (Stage's `quickEdit`, from App, above), and an open sheet's knobs kept only while it does and its pedal is still drawn, and read again when the block is not what was read (another scene, another channel). */
    quickFollows(quickEdit === true, pedals)
    const state = pictured(lastFrom.current)
    last.current = state
    sender.current.push(state)
  })
}

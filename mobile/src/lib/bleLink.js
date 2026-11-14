import { AppState, Platform } from 'react-native'

import { bluetoothOn, setSwitch } from './bleSwitch'
import {
  adapterBackUnderNewId,
  adapterDevices,
  adapterName,
  bluetoothAdmin,
  bluetoothLooksOff,
  bluetoothSettings,
  bluetoothSupported,
  closeWire,
  connectAdapter,
  endLinkWait,
  noteBluetooth,
  onAdapter,
  openWire,
  refreshKeptAdapter,
  releaseAdapter,
  subscribeBluetooth,
  unitName
} from './bluetooth'
import { isCable } from './bleAdapters'
import { getState, handleEvent, refreshAll, reset as resetRig, set as setRig, stopWatching, watchUnit, writeTuner } from './rig'
import { mayConnectBluetooth, subscribePurchase } from './purchases'
import { logDebug } from './debugLog'

/**
 * BLUETOOTH (BETA): KEEPING THE PHONE CONNECTED TO THE ADAPTER.
 *
 * link.js's job, for the case where there is no computer. With Bluetooth on,
 * startLink hands over to this instead of joining the computer, and the link
 * state it keeps means the same things it always has, one step closer:
 *
 *   'joining'   — looking for the adapter (the bar says connecting);
 *   'connected' — the ADAPTER is connected. Whether the UNIT answers is the
 *                 rig store's `unit`, exactly as it is over the computer,
 *                 where 'connected' is the computer and the unit is its own
 *                 word in the bar;
 *   'off'       — not trying: no unit chosen, no adapter picked, not
 *                 unlocked, or the player pressed Disconnect.
 *
 * Like link.js it is a loop rather than a button: an adapter that drops (out
 * of range, the unit switched off, iOS letting an idle link go) is looked for
 * again, every three seconds and then less often, up to every thirty.
 *
 * NOTHING HERE IMPORTS link.js, which imports this. It is handed link.js's
 * own `set` instead, so there is one link state and one place it is logged.
 */

export const RETRY_FIRST = 3000
export const RETRY_CAP = 30000
const nextDelay = (previous) => (!previous || previous < RETRY_FIRST ? RETRY_FIRST : Math.min(previous * 2, RETRY_CAP))

/* Between startBluetoothLink and stopBluetoothLink: link.js wants Bluetooth. */
let wanted = false
/* The loop is up: past the unlock check, listening to the adapter. */
let running = false
/* link.js's set. */
let tell = null
let offs = []
let timer = null
let delay = 0
/* Which attempt to connect this is; anything that finishes for an older one is ignored. */
let attempt = 0
let inFlight = false
let wire = null
let unhear = null
/* The player pressed Disconnect: stay off until they ask again. */
let held = false
/* The unit and adapter the loop last acted on, so a change to either is noticed. */
let seen = { unit: null, adapter: null }
/* Whether the module was ever asked to connect, so there is something to let go of. */
let touched = false
/*
 * A 0 the AM4's own tuner is still owed. A wire let go of with the AM4 on
 * its tuner and the 0 not out (the adapter already gone, or a stored preset
 * still coming back) says so, and it is kept here, across the drop and
 * across any connection that sends nothing, until one has closed it, opened
 * it again or found its Tuner setting at NONE. See connected() and
 * settledUnitTuner.
 */
let unitTunerOwed = false
/*
 * The same for an FM3, FM9 or Axe-Fx III: what a wire let go of said its
 * tuner left the unit on, {unit, push, page}, carried to the next
 * connection to THAT unit, and handed to its wire the moment it is made
 * (oweGen3Tuner). From then on the wire keeps it: closed by the first close
 * on it that really goes, or handed back by its own close() if it goes
 * first. So it is settled only by messages that went, and never by an
 * answer that merely came back. See connected().
 */
let gen3TunerOwed = null
/* A wire being let go of once the AM4's own tuner has been closed in its turn (see letGoOfWireInTurn). */
let letting = null
/* Stopped at the unlock while wanted: the purchase watched, to start the link the moment it lets this account in (see waitForPurchase). */
let unlockWait = null
/*
 * THE ADAPTER KEPT DID NOT CONNECT on a try since begin() last ran, and the
 * page has been told (noteBluetooth notThere). "It was trying to only let
 * me connect to a Widi master cause that's what I connected to previously
 * and I had a widi jack hooked up now" (Justin, 3 November 2026): the loop
 * goes on trying it, as it must for an adapter that is only out of range,
 * and the page offers the one it can see beside it (lib/bluetooth
 * otherAdapterNow), on a tap. Told once a round, not at every try.
 */
let missed = false
/*
 * A CONNECTION THAT CAME UP AND STAYED SILENT HAS BEEN MADE AFRESH, once, this
 * round. "Connected to the WIDI Jack, 21 questions unanswered for 101 s"
 * (Justin's tablet, 7 November 2026): Android kept a first connection up that
 * never carried a byte back, nothing said 'disconnected', so nothing ever
 * tried again, and the cure was his own Turn off Bluetooth and Connect, a
 * fresh connection that answered in 133 ms. So when the wake question and
 * its second asking bring back nothing at all (the wire's bytesIn), the link
 * lets go of the adapter and connects to it again by itself, once (see
 * connected()). Back to false when a connection hears anything, and at
 * every new round: Connect, Disconnect, another unit or adapter.
 */
let afresh = false
/* The rig's "missing" or "silent" that a new connection took back to "being asked" (connected), kept until a read has said something in its place. */
let askedOver = null
/* Android said Bluetooth was off at the last try (the trouble 'bluetooth-off'): its going is the moment to try again (settingsMoved). */
let wasOff = false
/*
 * Android answers a connect no this quickly with its Bluetooth off, and an
 * adapter that is merely away takes its fifteen seconds (FractalBleMidiModule.kt
 * OPEN_TIMEOUT_MS). Not only then: an adapter whose MIDI port another app
 * holds is refused as fast, so a quick no is only a reason to ask
 * (lib/bluetooth bluetoothLooksOff asks the module's own search).
 */
const OFF_ANSWER_MS = 500

const say = (line, detail) => logDebug('ble', line, detail)

/*
 * A UNIT ON A USB CABLE (bleAdapters isCable) is the same wire as an
 * adapter, on a different cable: everything here goes as it does for an
 * adapter, and the log and the link's name say the cable. On Android it is
 * asked of the list, as an iPhone's port is: a cable that is not plugged in
 * cannot connect, and its plugging in is what the loop waits for.
 */
const onCable = () => isCable(bluetoothSettings().adapter)
const fallbackName = (a) => (isCable(a) ? 'the USB cable' : 'the Bluetooth adapter')

function clearTimer() {
  if (timer) clearTimeout(timer)
  timer = null
}

function later(fn, ms) {
  clearTimer()
  timer = setTimeout(fn, ms)
}

/** Start connecting. Idempotent: a second call is a poke, not a second loop. */
export function startBluetoothLink(set) {
  if (typeof set === 'function') tell = set
  wanted = true
  if (running) {
    pokeBluetooth()
    return
  }
  if (!bluetoothSupported()) {
    tell?.({ link: 'off' })
    noteBluetooth({ phase: 'off' })
    say('Bluetooth is on, but this build or this phone cannot do it')
    return
  }
  /*
   * THE UNLOCK, as the paywall applies it: somebody who may not drive a real
   * unit is not connected to one. Over Bluetooth that is the purchase itself
   * (the one remembered on the phone included), and never "the store cannot
   * be reached", which the computer's link takes as a yes: Bluetooth works
   * with no signal, and a free account in airplane mode would have a rig for
   * good (unlock-rule mayDriveBluetooth). His account keeps mayConnect's answer.
   */
  if (!mayConnectBluetooth(bluetoothAdmin())) {
    tell?.({ link: 'off' })
    noteBluetooth({ phase: 'locked' })
    say('not connecting over Bluetooth: the app is not unlocked on this phone')
    waitForPurchase()
    return
  }
  stopWaitingForPurchase()
  running = true
  held = false
  afresh = false
  delay = 0
  wasOff = false
  const s = bluetoothSettings()
  seen = { unit: s.unit, adapter: s.adapter?.id || null }
  offs = [
    onAdapter('onState', heardState),
    onAdapter('onDevices', heardDevices),
    subscribeBluetooth(settingsMoved),
    AppState.addEventListener('change', screen)
  ]
  begin()
}

/*
 * WAITING ON THE PURCHASE, while the link is wanted and stopped at the
 * unlock. Nothing else starts it again: App.js restarts the link on a
 * change of who is signed in, of the demo or of Bluetooth, never of the
 * purchase, so a purchase that lands after the link was asked (the one
 * remembered on the phone read late at a launch with no signal, a Restore,
 * a Buy with Bluetooth on) left a paying customer's link 'off' until
 * somebody tapped Connect. So the purchase is watched, once, and the link
 * starts when it lets this account in; it stops being watched when the
 * link starts or is no longer wanted.
 */
function waitForPurchase() {
  if (unlockWait) return
  unlockWait = subscribePurchase(() => {
    if (!wanted || running || !mayConnectBluetooth(bluetoothAdmin())) return
    stopWaitingForPurchase()
    say('the app is unlocked on this phone now: connecting over Bluetooth')
    startBluetoothLink(tell)
  })
}

function stopWaitingForPurchase() {
  const off = unlockWait
  unlockWait = null
  off?.()
}

/** Where the loop stands, said to the link and to the page; then, if there is an adapter to try, try it. */
function begin() {
  clearTimer()
  if (!running) return
  missed = false
  const s = bluetoothSettings()
  if (!s.unit) {
    tell?.({ link: 'off', macName: null, hostVersion: null })
    noteBluetooth({ phase: 'no-unit', notThere: false })
    return
  }
  /* By its name, never its Bluetooth address: the link keeps this as macName, and the log's head prints it (lib/bluetooth adapterName). */
  const name = adapterName(s.adapter) || fallbackName(s.adapter)
  /*
   * With no adapter picked nothing is being looked for, so the link is 'off'
   * as it is for no unit: 'joining' put "Finding the Bluetooth adapter" on
   * the stage for ever, with a button that looked again for nothing.
   */
  tell?.({ link: held || !s.adapter ? 'off' : 'joining', macName: name, hostVersion: null })
  if (held) return noteBluetooth({ phase: 'held', notThere: false })
  if (!s.adapter) return noteBluetooth({ phase: 'no-adapter', notThere: false })
  noteBluetooth({ phase: 'connecting', notThere: false })
  tryConnect()
}

async function tryConnect() {
  timer = null
  if (!running || held || wire || inFlight || letting) return
  /*
   * iPhone: the adapter kept, back in Apple's list under a new id, is chosen
   * again (lib/bluetooth adapterBackUnderNewId), and the change of adapter
   * starts the try with it (settingsMoved).
   */
  if (Platform.OS === 'ios' && adapterBackUnderNewId()) return
  const s = bluetoothSettings()
  if (!s.adapter) return
  const mine = ++attempt
  let ok = false
  inFlight = true
  try {
    /*
     * On an iPhone the adapter is a port that CoreMIDI lists for as long as
     * Apple's Bluetooth keeps it connected. An offline one is not asked:
     * it would "connect" to nothing, and the next change to the list (see
     * heardDevices) is the moment to try again. The same for a unit on a
     * USB cable on either phone: one not plugged in is not asked.
     */
    const here = (Platform.OS !== 'ios' && !isCable(s.adapter)) || adapterDevices().some((d) => d.id === s.adapter.id && !d.offline)
    if (here) {
      touched = true
      const asked = Date.now()
      ok = await connectAdapter(s.adapter.id)
      /*
       * ANDROID WITH ITS BLUETOOTH OFF answers no at once: asked whether it
       * is off, and when it is, said, so the page and the waiting screen
       * offer Turn on Bluetooth, and the link tries again the moment it is on
       * (lib/bluetooth bluetoothLooksOff). Before, the page said "Connecting
       * to WIDI Jack…" for ever. With Bluetooth on, the ordinary backoff.
       */
      if (!ok && mine === attempt && Platform.OS === 'android' && !isCable(s.adapter) && Date.now() - asked < OFF_ANSWER_MS) await bluetoothLooksOff()
    }
    if (ok) noteBluetooth({ trouble: null })
  } catch (err) {
    if (mine === attempt && err?.code === 'E_PERMISSION') noteBluetooth({ trouble: 'permission' })
    say('could not connect to the adapter', err?.message || String(err))
  } finally {
    inFlight = false
  }
  if (!running || held) return
  if (mine !== attempt) {
    /* Overtaken while it waited (another adapter was picked, say): the one wanted now is tried now. */
    if (!wire) tryConnect()
    return
  }
  if (ok) {
    /* The module says 'connected' as it connects (heardState); this is for an event that never arrived. */
    if (!wire) connected({ id: s.adapter.id, name: s.adapter.name })
    return
  }
  if (!missed) {
    missed = true
    noteBluetooth({ notThere: true })
  }
  const was = delay
  delay = nextDelay(delay)
  /* Said while the wait grows, then quiet: thirty lines an hour of the same sentence bury the one that matters. */
  if (delay !== was) say(`${isCable(s.adapter) ? 'the USB cable is not plugged in yet' : 'the adapter is not there yet'}; trying again in ${delay / 1000} s`)
  later(tryConnect, delay)
}

/**
 * The adapter is connected: a fresh wire for the chosen unit, and the rig
 * asks the unit everything, the way join() does over the computer. Then the
 * unit watch and the footswitch watch, while the screen is on.
 */
async function connected(e) {
  if (!running || wire || held || letting) return
  /* An adapter kept as its id and name alone (before 1.89.27) learns its driver now, so a unit on a USB cable is called one from here on. */
  refreshKeptAdapter()
  const s = bluetoothSettings()
  clearTimer()
  delay = 0
  const made = openWire()
  if (!made) return
  wire = made
  /*
   * WHAT THE CONNECTION BEFORE LEFT A GEN 3 UNIT'S TUNER ON, handed to this
   * wire before anything is asked, so a drop at any moment from here hands
   * it back (letGoOfWire). Only to a wire for that same unit: another unit
   * picked while Bluetooth was off (no settingsMoved to forget it) is
   * handed nothing of it, an AM4 least of all.
   */
  if (gen3TunerOwed && gen3TunerOwed.unit === made.unit && typeof made.oweGen3Tuner === 'function') {
    made.oweGen3Tuner({ push: gen3TunerOwed.push, page: gen3TunerOwed.page })
    gen3TunerOwed = null
  }
  unhear = made.subscribe(handleEvent)
  setSwitch({ on: bluetoothOn(), wire: made })
  const name = adapterName(e) || adapterName(s.adapter) || fallbackName(s.adapter)
  missed = false
  /*
   * A NEW CONNECTION HAS NOT BEEN ASKED YET, so the last one's "not
   * answering" is not its word. The rig's word for the unit was only cleared
   * for another unit, never for another adapter, a fresh connection or a
   * drop that came back: the moment the new one was up the page was already
   * "isn't answering", and since Use a different adapter is drawn there too
   * (14 November 2026), a tap on Use WIDI Uhost redrew the same red line
   * with Use WIDI Master where the button just tapped had been. Until the
   * first read says, the unit is being asked.
   */
  if (getState().unit === 'missing' || getState().unit === 'silent') {
    askedOver = getState().unit
    setRig({ unit: 'unknown' })
  }
  noteBluetooth({ phase: 'connected', connectedTo: name, trouble: null, answeredAs: null, notThere: false })
  tell?.({ link: 'connected', macName: name, hostVersion: null })
  say(`connected to ${name}${isCable(s.adapter) ? ' by USB cable' : ''}; asking the ${unitName(s.unit)} what it is`)
  /*
   * ONE QUESTION TO WAKE THE LINK, ITS ANSWER NOT USED. On the AM4 test the
   * first question after connecting went unanswered, and the same question a
   * moment later was answered in 132 ms, as was everything after it. So the
   * first question on a new link is asked here and thrown away, and the real
   * ones start after it: the page no longer says "isn't answering" about a
   * unit that is. It is the unit's own probe, so on the AM4 it is a frame on
   * the allowlist; one extra read on connecting is all it costs. Why the
   * first is lost is not known yet — the debug log of the next test says.
   */
  let woke = null
  try {
    woke = await made.request('/device/detect')
  } catch {
    woke = null
  }
  const heard = () => (typeof made.bytesIn === 'function' ? made.bytesIn() : null)
  /* With how much came back, when something did: an answer the app could not read is not a silent line. */
  say(woke?.connected ? 'the first question was answered' : heard() > 0 ? `no answer to the first question (${heard()} bytes came back); asking again` : 'no answer to the first question; asking again')
  if (wire !== made || !running) return
  /*
   * NOT ANSWERED: asked once more here, and still nothing, the other units'
   * own questions (an AM4 on the adapter does not answer an FM3's, so
   * nothing named it: bleWire askAround), asked whether bytes came back or
   * not, since a unit sending only a timing clock is still not the unit
   * picked. And with NOTHING AT ALL back (see `afresh`), not one byte, the
   * adapter is let go of and connected to again, once a round. That returns
   * before the rig's read, so no "did not answer in time" goes up for a
   * connection about to be replaced. Not for a VP4, which never answers
   * over Bluetooth, nor a unit on a USB cable, which is plugged in or not.
   */
  if (!woke?.connected && made.unit !== 'vp4' && !onCable()) {
    if (heard() === 0) say(`nothing at all has come back from ${name} since it connected (0 bytes)`)
    let again = null
    try {
      again = await made.request('/device/detect')
    } catch {
      again = null
    }
    if (wire !== made || !running) return
    if (!again?.connected) {
      const who = typeof made.askAround === 'function' ? await made.askAround() : null
      if (wire !== made || !running) return
      if (!who && heard() === 0) {
        if (!afresh) {
          afresh = true
          say(`still nothing at all from ${name}: letting go of it and connecting to it again, once`)
          return againAfresh(name)
        }
        say(`nothing at all came back on this connection to ${name} either`)
      }
    }
  }
  /* A connection that heard anything is a working line: the one made afresh by itself is owed again. */
  if (woke?.connected || heard() > 0) afresh = false
  try {
    await refreshAll()
  } catch {
    // The rig store keeps what it learned, including the failure.
  }
  /*
   * A READ THAT FAILED BEFORE IT SAID ANYTHING leaves the word at "being
   * asked", which nothing ever takes back: the rig's own watch reads a unit
   * whole again only when one called missing or silent starts answering, so
   * the bar would say Looking for good, with no Connect again and no Use a
   * different adapter. The word this connection took over (askedOver) goes
   * back, on this same wire, and the watch finds it as it always did.
   */
  if (wire === made && askedOver && getState().unit === 'unknown') setRig({ unit: askedOver })
  if (getState().unit !== 'unknown') askedOver = null
  if (wire !== made || !running) return
  /*
   * BACK WITH THE TUNER STILL OPEN. A drop leaves the app's tuner open and
   * this new connection's closed: the needle froze, and on the AM4 the unit's
   * own tuner screen was the old connection's. Opened again here, so the
   * readings come back and the unit is on its tuner as the phone says.
   */
  if (getState().tunerOn) {
    say('the tuner was open when the adapter went; opening it again')
    made.request('/tuner', { method: 'POST', body: '{"on":true}' }).then(settledUnitTuner(made), () => {
      /*
       * NOT OPENED AGAIN (a Gen 3 unit silent through the wake and the read,
       * so nothing is sent to it, say): the wire's tuner is closed, so no
       * reading would ever come, and Play's tuner stayed up over a needle
       * that never moved. It goes down, as a press refused the same way puts
       * it down (rig writeTuner), and its close goes through this wire: held
       * for the unit's first answer (closeWhenHeard) when the unit may still
       * be on its tuner from before.
       */
      if (wire !== made || !getState().tunerOn) return
      say('the tuner could not be opened again; the phone’s goes down')
      writeTuner(false)
    })
  } else if (unitTunerOwed && made.unit === 'am4') {
    /*
     * CLOSED WHILE THE ADAPTER WAS AWAY. The phone's tuner went off with no
     * connection to say so on, and the AM4 was left on its own tuner screen,
     * which no later press would ever close. So the new connection closes
     * it: it reads the Tuner setting first, then sends the 0. Only on a
     * connection to an AM4: another unit picked while Bluetooth was off has
     * no AM4 tuner to close, and is not kept from closing its own (below).
     */
    say('the phone’s tuner is closed but the AM4 may still be on its own from before; closing it now')
    made.request('/tuner', { method: 'POST', body: '{"on":false}' }).then(settledUnitTuner(made), () => {})
  } else if (made.gen3TunerOwes?.()) {
    /*
     * The same on an FM3, FM9 or Axe-Fx III: closed while the adapter was
     * away, the unit stayed on its tuner, muted, and this connection, which
     * never opened it, would find nothing to close. Its wire was handed what
     * the last one left open, and this close closes exactly that, in its
     * turn: a Tuner pressed after it goes after it, and is never shut by it.
     * What did not go (the adapter would not take it) stays in the wire, and
     * its close() hands it on again. With the phone's tuner open instead
     * (above), the tuner's own Close closes it, the same way.
     */
    say(`the phone’s tuner is closed but the ${unitName(s.unit)} may still be on its tuner from before; closing it now`)
    made.request('/tuner', { method: 'POST', body: '{"on":false}' }).catch(() => {})
  }
  if (AppState.currentState !== 'background') {
    watchUnit()
    made.startPolls()
  } else made.screenOff()
}

/*
 * The owed 0 is settled only by what THIS connection's turn at the AM4's
 * tuner really did, as the wire answers it: opened it again ('opened', and
 * so its own to close), sent the 0 ('closed'), or found the Tuner setting at
 * NONE ('none': there is no number left to send a 0 on). A turn that sent
 * nothing — the AM4 silent about the setting, or unclear — leaves it owed to
 * the next connection: settled on any answer, that 0 was forgotten after one
 * reconnect, and the AM4 stayed on its tuner for good. Nor is it settled by
 * a wire that has gone in the meantime: that wire's close() has already
 * said whether the 0 is still owed.
 */
const SETTLES_IT = ['opened', 'closed', 'none']
const settledUnitTuner = (made) => (r) => {
  if (wire === made && SETTLES_IT.includes(r?.unitTuner)) unitTunerOwed = false
}

/* The wire goes, and with it everything waiting on it; the switch goes back to refusing. */
function letGoOfWire() {
  const was = wire
  unhear?.()
  unhear = null
  wire?.stopPolls()
  wire = null
  closeWire()
  /* Asked once it is closed: whether it left the AM4 on its own tuner, its 0 not sent. */
  if (was?.unitTunerOwed?.()) unitTunerOwed = true
  /*
   * And what it left a Gen 3 unit's tuner on: everything it was handed and
   * did not close, and whatever it opened itself. Added to anything still
   * kept for that unit (a wire that went before it was ever handed it).
   */
  const g = was?.gen3TunerOwed?.()
  if (g) {
    const kept = gen3TunerOwed?.unit === was.unit ? gen3TunerOwed : null
    gen3TunerOwed = { unit: was.unit, push: !!(g.push || kept?.push), page: !!(g.page || kept?.page) }
  }
  setSwitch({ on: bluetoothOn(), wire: null })
}

/*
 * LETTING GO WITH THE AM4 ON ITS OWN TUNER, THE ADAPTER STILL THERE
 * (Disconnect, Bluetooth off, another unit or adapter picked). The wire's
 * own close() would send the 0 straight out on the number read at the open,
 * with no read first, and the player may have moved the Tuner setting with
 * the tuner up: with CC 20 given to Output Volume, that 0 is silence. So the
 * wire first closes it in its turn, as a press on the phone does — the
 * setting read again, the 0 on the number the AM4 names now, or none — and
 * only then is it let go of. Given a second at most: an AM4 that has not
 * finished by then is let go of anyway, and close()'s 0 is the fallback.
 *
 * `then(had)` runs once the wire has gone, `had` that it was still this
 * link's to let go of (not taken by a drop meanwhile); straight away, as
 * before, when the AM4's tuner is not open. While it waits, the rig and the
 * switch have already let go of the wire, so only that close reaches it;
 * nothing new is connected (tryConnect and connected wait for it), and
 * whatever is waiting starts the loop again in `then`.
 */
export const LET_GO_MS = 1000
function letGoOfWireInTurn(then) {
  const made = wire
  /* Asked again while one is closing: once it has gone, whatever wire is there by then. */
  if (letting) return letting.then(() => letGoOfWireInTurn(then))
  /*
   * AND AN FM3, FM9 OR AXE-FX III ON ITS TUNER the same way, with the adapter
   * still there: the wire's close() sends a Gen 3 unit nothing, only notes
   * what was left on for a later Bluetooth connection, so turning Bluetooth
   * off (or Disconnect, or another unit picked) left the unit on its tuner,
   * muted, under a Play that said closed, and another unit picked forgot
   * even that (settingsMoved). Closed in its turn first, as a press does; a
   * close that cannot go is handed back by close() as before.
   */
  const am4 = !!made?.unitTunerOpen?.()
  if (!am4 && !made?.gen3TunerLeftOn?.()) {
    letGoOfWire()
    return then(!!made)
  }
  say(am4 ? 'letting go with the AM4 on its own tuner: closing it first' : `letting go with the ${unitName(made.unit)} on its tuner: closing it first`)
  unhear?.()
  unhear = null
  made.stopPolls()
  setSwitch({ on: bluetoothOn(), wire: null })
  let timer = null
  const closed = made.request('/tuner', { method: 'POST', body: '{"on":false}' }).then(
    (r) => say(am4 ? `the AM4’s own tuner before letting go: ${r?.unitTuner || 'unknown'}` : `the ${unitName(made.unit)}’s tuner closed before letting go`),
    () => {}
  )
  const capped = new Promise((resolve) => (timer = setTimeout(resolve, LET_GO_MS)))
  letting = Promise.race([closed, capped]).then(() => {
    clearTimeout(timer)
    letting = null
    const had = wire === made
    if (had) letGoOfWire()
    return then(had)
  })
  return letting
}

/*
 * THE SAME AS TURN OFF BLUETOOTH, THEN CONNECT, in one go: the wire let go
 * of (the AM4's or a Gen 3 unit's tuner closed first, as ever), the adapter
 * released, and after RETRY_FIRST, which gives Android's MIDI service time
 * to let go of the old connection, a fresh one asked for. Said to the bar
 * and the page as connecting meanwhile.
 */
function againAfresh(name) {
  attempt++
  clearTimer()
  stopWatching()
  return letGoOfWireInTurn((had) => {
    if (!running || held) return
    if (touched) releaseAdapter()
    tell?.({ link: 'joining', macName: name, hostVersion: null })
    noteBluetooth({ phase: 'connecting', answeredAs: null, notThere: false })
    delay = 0
    later(tryConnect, RETRY_FIRST)
    return had
  })
}

/**
 * CONNECT AGAIN, by hand: the Bluetooth page's button, and the one in Play's
 * Bluetooth note, while the adapter is connected and the unit says nothing.
 * Exactly what Turn off Bluetooth and then Connect did for him on 7 November
 * 2026, in one tap: a fresh connection to the same adapter. True when it
 * started one.
 */
export function connectBluetoothAgain() {
  if (!running || held || letting || !wire) return false
  const s = bluetoothSettings()
  const name = adapterName(s.adapter) || fallbackName(s.adapter)
  /* Asked for by hand: the one by itself is not owed on top of it. */
  afresh = true
  say(`connecting to ${name} again, as asked`)
  againAfresh(name)
  return true
}

function heardState(e) {
  if (!running) return
  const id = bluetoothSettings().adapter?.id
  if (!id || (e?.id && e.id !== id)) return
  if (e?.state === 'connected') {
    connected(e)
    return
  }
  if (e?.state === 'disconnected') dropped(e?.reason)
}

/* The adapter went: out of range, the unit switched off, or iOS letting an idle link go. Look again. */
function dropped(reason) {
  const had = !!wire
  /* How much that connection carried back, for the log: none at all is a connection that never worked. */
  const back = typeof wire?.bytesIn === 'function' ? wire.bytesIn() : null
  letGoOfWire()
  stopWatching()
  if (!running || held) return
  const cable = onCable()
  const carried = had && back !== null ? ` (${back} bytes came back on that connection)` : ''
  say(had ? (cable ? 'the USB cable was unplugged' : `the adapter went away${carried}`) : cable ? 'the USB cable did not stay connected' : 'the adapter did not stay connected', reason || undefined)
  /*
   * A connection that heard anything, however late (a unit that finished
   * starting up after the fresh connection was made), was a working line:
   * the one fresh connection by itself is owed to the next. Never by the
   * app's own letting go, which says no 'disconnected', so no loop.
   */
  if (back > 0) afresh = false
  delay = 0
  begin()
}

/*
 * iPhone: the adapter came back online in CoreMIDI's list, so try now rather
 * than at the next turn. And a unit on a USB cable, on either phone: plugged
 * back in, it connects at once.
 */
function heardDevices(e) {
  if (!running || held || wire || (Platform.OS !== 'ios' && !onCable())) return
  /* The adapter kept, back under a new id in Apple's list: chosen again, and its change of adapter tries it (settingsMoved). */
  if (Platform.OS === 'ios' && !inFlight && !letting && adapterBackUnderNewId()) return
  const id = bluetoothSettings().adapter?.id
  const list = Array.isArray(e?.devices) ? e.devices : []
  if (id && list.some((d) => d?.id === id && !d.offline)) {
    clearTimer()
    tryConnect()
  }
}

/*
 * THE PAGE CHANGED SOMETHING. A different adapter is let go of and the new
 * one tried. A different UNIT is a different rig — another model byte,
 * another chain, other presets in the same slots — so the store is cleared
 * and the new unit asked everything, over the same Bluetooth connection.
 */
function settingsMoved(s) {
  if (!running) return
  /*
   * BLUETOOTH BACK ON (the wait in lib/bluetooth took the trouble off):
   * tried now, not at the end of a wait that may have grown to thirty
   * seconds.
   */
  const back = wasOff && s.trouble !== 'bluetooth-off'
  wasOff = s.trouble === 'bluetooth-off'
  if (back && !wire && !inFlight && !held && !letting && s.adapter?.id === seen.adapter) {
    say('Bluetooth is on again: trying the adapter now')
    delay = 0
    clearTimer()
    tryConnect()
  }
  const unit = s.unit
  const adapter = s.adapter?.id || null
  if (unit === seen.unit && adapter === seen.adapter) return
  const unitMoved = unit !== seen.unit
  const adapterMoved = adapter !== seen.adapter
  seen = { unit, adapter }
  /* Another unit or adapter is a new round: one connection made afresh by itself is owed to it again. */
  afresh = false
  const name = s.connectedTo
  attempt++
  clearTimer()
  stopWatching()
  return letGoOfWireInTurn((had) => {
    if (unitMoved) {
      resetRig()
      askedOver = null
      /* Another unit: an owed close, the AM4's 0 or a Gen 3 unit's, is not for it. */
      unitTunerOwed = false
      gen3TunerOwed = null
    }
    if (!running) return
    if (adapterMoved) {
      say(adapter ? (isCable(s.adapter) ? 'a unit on a USB cable was chosen' : 'a different adapter was chosen') : 'the adapter was forgotten')
      if (touched) releaseAdapter()
      held = false
      delay = 0
      begin()
      return
    }
    say(`the unit is now the ${unitName(unit)}: asking it everything`)
    if (had) connected({ id: adapter, name })
    else begin()
  })
}

function screen(status) {
  logDebug('app', status === 'active' ? 'back on screen' : `put to sleep (${status})`)
  if (!running) return
  if (status === 'active') {
    /* Being let go of: nothing is asked of it, and the loop starts again once it has gone. */
    if (letting) return
    if (wire) {
      watchUnit()
      wire.startPolls()
      wire.screenOn()
    } else if (!held) {
      delay = 0
      clearTimer()
      tryConnect()
    }
    return
  }
  /* A phone in a pocket has no screen to be wrong on: nothing is asked until it is back. */
  stopWatching()
  wire?.stopPolls()
  /*
   * Nor is the AM4 held on its own tuner from a pocket, or put back on it the
   * moment the app is back (bleWire keepUnitTuner). 'inactive' is not a
   * pocket: Control Center, Siri or the app switcher over Play leaves the
   * tuner kept up, as link.js does for the computer.
   */
  if (status !== 'inactive') wire?.screenOff()
}

/** True while an attempt to connect to the adapter is under way: the Bluetooth half of link.js's joiningNow. */
export const bluetoothJoining = () => inFlight

/**
 * Look again NOW: the waiting screen's button, the page's Connect, a watch
 * tap that woke the phone. Starts the loop again if it was stopped at the
 * unlock check and the app has been unlocked since.
 */
export function pokeBluetooth() {
  if (!wanted) return
  if (!running) {
    startBluetoothLink(tell)
    return
  }
  if (wire) return
  held = false
  afresh = false
  delay = 0
  begin()
}

/** The page's Disconnect: let go of the adapter and stay off until asked again. */
export function holdBluetooth() {
  if (!running || held) return
  held = true
  afresh = false
  attempt++
  clearTimer()
  stopWatching()
  return letGoOfWireInTurn(() => {
    if (touched) releaseAdapter()
    say(onCable() ? 'disconnected from the USB cable, as asked' : 'disconnected from the adapter, as asked')
    begin()
  })
}

/** Stop everything: link.js's stopLink, before it resets the link and the rig. */
export function stopBluetoothLink() {
  wanted = false
  stopWaitingForPurchase()
  if (!running) return
  running = false
  attempt++
  clearTimer()
  for (const off of offs.splice(0)) {
    try {
      off?.remove ? off.remove() : off?.()
    } catch {
      // Unbinding twice is not a failure worth reporting.
    }
  }
  stopWatching()
  /*
   * The computer picked (Use the computer instead, Stop, a sign-out): the
   * wait for Bluetooth this link started ends, and its "Bluetooth is off"
   * goes with it (lib/bluetooth endLinkWait). Here, not running any more and
   * no longer listening, so the trouble going starts no try.
   */
  endLinkWait()
  return letGoOfWireInTurn(() => {
    /* Started again while the AM4's tuner was closing: the new loop keeps the adapter, and goes on from here. */
    if (running) return begin()
    if (touched) releaseAdapter()
    touched = false
    held = false
    missed = false
    noteBluetooth({ phase: bluetoothOn() ? 'idle' : 'off', connectedTo: null, notThere: false })
  })
}

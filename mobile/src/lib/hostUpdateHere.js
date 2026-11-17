/*
 * THE COMPUTER'S UPDATE ON THIS DEVICE (lib/hostUpdate has the rules and the
 * words; components/HostUpdate draws them under the computer's card).
 *
 * What is here is the wiring only: whose account it is open to (his, by the
 * sign-in kept on the device, as Quick build's useQuickBuild), the log line
 * when the computer's note changes, and one Update now run at a time, with
 * the request written through the relay to the computer driven.
 *
 * NOTHING HERE WRITES FOR AN ACCOUNT THE SWITCH IS OFF FOR: every write is
 * asked of `mayWrite`, which asks the switch again at that moment.
 */
import { useEffect, useState, useSyncExternalStore } from 'react'
import { bluetoothAdmin, subscribeBluetooth, useBluetoothAdmin } from './bluetooth'
import { logDebug } from './debugLog'
import { COMPUTER_UPDATE_FOR_EVERYONE } from './features'
import { HOST_UPDATE_PATH, askUpdate, busySending, computerUpdateOn, factsAt, hostFactsFrom, noteKey, noteSaid, sameNameTwice, stillSo, whyNotAsk } from './hostUpdate'
import { linkState, linkVia, readHostAgain, subscribeLink } from './link'
import { keptAccount, remoteHosts, remoteRequest, remoteRollCall, remoteUserId, sendingHere } from './relay'

/** Whether whoever is signed in here has the computer's update on Phone & computer: his account until COMPUTER_UPDATE_FOR_EVERYONE. */
export const useComputerUpdate = () => computerUpdateOn({ admin: useBluetoothAdmin(), everyone: COMPUTER_UPDATE_FOR_EVERYONE })
/** The same, asked at a moment rather than drawn. */
export const computerUpdateNow = () => computerUpdateOn({ admin: bluetoothAdmin() === true, everyone: COMPUTER_UPDATE_FOR_EVERYONE })

/* What the computer said about its update, in the log when it changes: only where the switch is on, so no other account's log grows a line. */
let saidKey
subscribeLink((s) => {
  /* How the last Update now ended goes once it no longer describes the computer driven: another computer, another version, another note. */
  if (run.result && !run.phase && !stillSo(run.at, s)) clearUpdateRun()
  if (!computerUpdateNow()) return
  const key = s.link === 'connected' && s.macName ? `${s.macName}|${noteKey(s.hostUpdate)}` : null
  if (key === null || key === saidKey) return
  saidKey = key
  logDebug('update', noteSaid(s.macName, s.hostUpdate))
})

/** The signed-in account's id: the relay's, else the sign-in kept on the device. */
async function accountNow() {
  return remoteUserId() || (await keptAccount())?.id || null
}

/* One Update now at a time, for any computer, and where it has got to, for the card. `at` is what the computer said when it ended (hostUpdate factsAt). */
let run = { name: null, phase: null, result: null, at: null }
let going = false
const seers = new Set()
const tell = (patch) => {
  run = { ...run, ...patch }
  for (const fn of seers) fn()
}
const subscribe = (fn) => {
  seers.add(fn)
  return () => seers.delete(fn)
}
const current = () => run
/* And it goes when the switch goes off for whoever is signed in here: a sign-out, or another account. */
subscribeBluetooth(() => {
  if (run.result && !run.phase && !computerUpdateNow()) clearUpdateRun()
})
/** Where this device's Update now has got to: { name, phase, result, at }. */
export const useUpdateRun = () => useSyncExternalStore(subscribe, current, current)

/** Why Update now may not be written to `name` this moment (hostUpdate whyNotAsk), with everything asked afresh. */
export async function whyNotNow(name) {
  const s = linkState()
  return whyNotAsk({
    update: s.macName === name ? s.hostUpdate : null,
    switchOn: computerUpdateNow(),
    clash: sameNameTwice(remoteHosts(), name),
    busyHere: busySending(sendingHere()),
    name,
    account: await accountNow(),
    linked: s.link === 'connected' && linkVia() === 'computer'
  })
}

/**
 * Update now, for the computer driven by `name`: written at most twice,
 * answered or given up on within hostUpdate GIVE_UP_MS. Answers the run's
 * end (askUpdate's answer). A second tap while one is out, for this computer
 * or any other, does nothing and answers null.
 */
export async function updateNow(name) {
  if (going) return null
  going = true
  try {
    return await runOnce(name)
  } finally {
    going = false
  }
}

async function runOnce(name) {
  const s = linkState()
  const version = s.hostUpdate?.version
  const from = s.hostVersion
  const account = await accountNow()
  tell({ name, phase: 'asking', result: null, at: null })
  let result
  try {
    result = await askUpdate({
      name,
      version,
      from,
      account,
      write: (body) => remoteRequest(HOST_UPDATE_PATH, { method: 'PUT', body: JSON.stringify(body) }),
      readNote: readHostAgain,
      mayWrite: () => {
        /* Asked synchronously at each write: the account was read above, the rest is read now. */
        const now = linkState()
        return whyNotAsk({
          update: now.macName === name ? now.hostUpdate : null,
          switchOn: computerUpdateNow(),
          clash: sameNameTwice(remoteHosts(), name),
          busyHere: busySending(sendingHere()),
          name,
          account,
          linked: now.link === 'connected' && linkVia() === 'computer'
        })
      },
      sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
      log: (line) => logDebug('update', line),
      onState: (phase) => tell({ phase })
    })
  } catch (err) {
    logDebug('update', `Update now: stopped — ${err?.message || String(err)}`)
    result = { state: 'gave-up', version: from }
  }
  /* Kept with what the computer said as it ended, and not at all once the switch is off here (signed out meanwhile). */
  tell({ phase: null, result: computerUpdateNow() ? result : null, at: factsAt(linkState()) })
  return result
}

/** Forget how the last Update now ended (the card's line goes back to what the computer says). */
export const clearUpdateRun = () => tell({ name: null, phase: null, result: null, at: null })

/**
 * What each computer in the last roll call said beside its name
 * ([{ name, version, os, update }], hostUpdate hostFactsFrom), read from the
 * answers the roll call already has, with no request. Read only while `on`
 * (the switch, for this account), and again when the names change.
 */
export function useHostFacts(on) {
  const [facts, setFacts] = useState([])
  const names = on ? remoteHosts().join('\n') : null
  useEffect(() => {
    if (names === null) return undefined
    let live = true
    const { answers, read } = remoteRollCall()
    hostFactsFrom(answers, read)
      .then((found) => {
        if (live) setFacts(found)
      })
      .catch(() => {})
    return () => {
      live = false
    }
  }, [names])
  return on ? facts : []
}

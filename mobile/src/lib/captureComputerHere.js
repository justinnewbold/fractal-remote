/*
 * WHICH COMPUTER A CAPTURE WOULD GO THROUGH NOW, for the TONE3000 card
 * (lib/captureComputer has the rule and its words). Read off the link and
 * the device's own say on whether a capture goes through the computer; it
 * sends nothing and asks the unit nothing, so the card still reaches a unit
 * by the captures' three calls alone (test/tone3000.mjs).
 */
import { capturesThroughComputer } from './device'
import { linkState, subscribeLink } from './link'
import { computerTooOld, oldAfterSend } from './captureComputer'

/** The computer a capture would go through now, where its app has said a version too old to have one kept: `{ name, version }`, else null. Over Bluetooth, the unit's USB cable and the demo, null: those send from the device itself. */
export const oldComputerHere = () => {
  const l = linkState()
  return computerTooOld({ through: capturesThroughComputer(), version: l.hostVersion, name: l.macName })
}

/** After a send the unit did not keep: the computer it went through, where that computer did not say which byte went (`old`, lib/captureSend) and its version is not known to be new enough. */
export const oldAfterSendHere = (old) => {
  const l = linkState()
  return oldAfterSend({ old, version: l.hostVersion, name: l.macName })
}

/** Be told whenever the link changes (a computer says its version, the device moves to Bluetooth). Returns the way to stop. */
export const watchComputer = (fn) => subscribeLink(fn)

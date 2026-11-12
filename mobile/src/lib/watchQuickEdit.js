import { logDebug } from './debugLog'
import { blockParams, sameBlock, setParamConfirmed } from './device'
import { editPages } from './editPages'
import { isSilencingParam } from './guardrails'
import { oneWriteAtATime } from './knob-keys'
import { getState, noteEdited } from './rig'
import { fromNormalized, toNormalized } from './scale'
import { WATCH_QUICK_MAX, watchKnobText } from './watch-link'
import { createWatchQuick, quickKnob, quickParams } from './watchQuick'
import { watchKnowsQuick } from './watchPages'

/*
 * QUICK EDIT ON THE APPLE WATCH, JOINED TO EDIT'S OWN ROUTES.
 *
 * lib/watchQuick is the rule and what is kept while a held pedal's sheet is
 * open on the wrist; it imports nothing and reaches nothing. This is the
 * one place it is handed a way to the unit, and every one of them is
 * Edit's:
 *
 *   the read   lib/device blockParams, the read Edit's panel makes of a
 *              block (and the hold pop-up's knobs, components/PopKnobs).
 *   the write  lib/device setParamConfirmed, the checked write Edit makes
 *              when a knob is let go: written, read back, and tried the
 *              other way if the unit did not take it.
 *
 * Both are marked as Edit's inside lib/device (its `EDITING`), so over
 * Bluetooth or a USB cable the phone answers them only while Edit is open
 * to this account on this unit, and every frame is held by the same guards
 * as a knob turned on the screen (bleWire: am4EditAllowed, and the gen-3
 * units' own). Through the computer they are the requests Edit sends, to
 * the same relay rules. Nothing else in this file, or in lib/watchQuick,
 * can send anything: no model, no on or off, no channel, no save.
 *
 * WHAT IS LISTED is Edit's too: its pages (lib/editPages) over its own list
 * with the levels and the routing taken out (lib/guardrails
 * isSilencingParam), so a block's Level is never a knob on the wrist, as it
 * is never one under a thumb. The value a turn comes to is Edit's own scale
 * (lib/scale), rounded as Edit's knob rounds what it sends
 * (components/Knob).
 */

/** The block on Play with that id, or none: the chain the pedals are drawn from, as a channel from the wrist asks (lib/watchBridge). */
const blockOf = (id) => (getState().blocks || []).find((b) => sameBlock(b, id)) || null

/** What a block is now: it moves with the preset, the scene, a reload of the preset and the block's channel, which are what Play's own pop-up reads its knobs again for (components/PopKnobs). */
const sigOf = (id) => {
  const s = getState()
  const block = blockOf(id)
  return block ? `${s.preset?.number}:${s.sceneIndex}:${s.bufferRev}:${block.channel || ''}` : null
}

/** A place in a knob's range as the value Edit's knob would send for it: Edit's scale, to three places. */
const valueAt = (p, at) => Math.round(fromNormalized(at, p) * 1000) / 1000

let onChange = null

const quick = createWatchQuick({
  read: (id) => blockParams(id),
  write: (id, p, value) => setParamConfirmed(id, p.id, value, p),
  edited: noteEdited,
  sig: sigOf,
  /* Not a block the wire has no knobs for (lib/holdPop popKnobsFor: an Axe-Fx III's NAM and IR Player over Bluetooth): its sheet is its channels. */
  readable: (id) => blockOf(id)?.knobs !== false,
  params: (read) => quickParams(read, { pages: editPages, silencing: isSilencingParam, max: WATCH_QUICK_MAX }),
  valueAt,
  knob: (p, value) => quickKnob(p, value, { toNormalized, text: watchKnobText }),
  oneAtATime: oneWriteAtATime,
  changed: () => onChange?.(),
  log: logDebug
})

/** The bridge's way to hear that the knobs moved, so the picture goes out again; null when Play's bridge goes. */
export function onQuickChange(fn) {
  onChange = fn
}

/**
 * What goes in the picture: nothing at all for a watch that has not said it
 * knows `quick`; for one that has, whether a hold offers quick edit
 * (`offered`: Play's own answer, lib/watchQuick watchQuickOn) and the open
 * sheet's knobs once they are read.
 */
export const quickToSend = (offered) => (watchKnowsQuick() ? { quickEdit: offered === true, quick: offered === true ? quick.now() : null } : null)

/** The watch said something: it is there (the open sheet is kept only while it is). */
export const quickHeard = () => quick.heard()

/** One of quick edit's two requests, already checked against the last picture (watch-link watchCommand). */
export function quickAsked(cmd) {
  if (cmd.do === 'knobs') return cmd.id === null ? quick.close() : quick.open(cmd.id)
  if (cmd.do === 'knob') return quick.turn(cmd.id, cmd.key, cmd.at)
  return undefined
}

/**
 * Asked every time Play draws: whether the open sheet's knobs are still to
 * be kept (quick edit still offered, and its pedal among the ones this
 * picture shows), and read again if the block is not what was read.
 */
export function quickFollows(offered, pedals) {
  const id = quick.openOn()
  if (id === null) return
  quick.follow(offered === true && (pedals || []).some((p) => p.id === id))
}

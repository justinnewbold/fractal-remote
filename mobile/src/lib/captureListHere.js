/*
 * THE UNIT'S CAPTURES ON THIS DEVICE: lib/captureList's list, handed the
 * device's own asker (lib/device, over the wire or through the computer,
 * whichever the device is connected by), its clock and its storage.
 *
 * ONE LIST FOR THE APP. Only an Axe-Fx III has captures, and nothing the
 * unit says tells one III from another, so there is one list, kept under one
 * key. It is shown at once from what was written down the last time, and
 * read again when there is reason to (lib/captureList says which): a
 * capture sent from the app, a slot that reads differently from the list,
 * or the player asking.
 *
 * Through a computer the unit answers in a blink, so a piece is as many
 * slots as the computer takes at once and nothing waits between two. Over
 * the device's own wire a piece is eight slots, about a second on an adapter
 * on the MIDI jacks, with a moment between two for a tap and the footswitch
 * watch.
 */
import { useSyncExternalStore } from 'react'

import { capturesThroughComputer, namHeadsHere, namPickHere, onCaptureSent } from './device'
import { captureList } from './captureList'
import { NAM_HEADS_MOST } from './nam-install'
import { getState, useRig } from './rig'
import { hydrate, sync } from './store'

const KEY = 'fractal.captures'
/* An AM4's own (firmware 3.00, lib/am4-nam): 128 slots and one more, which is not offered, as an Axe-Fx III's last is not. Kept apart: a player with both units has two lists. */
const AM4_KEY = 'fractal.captures.am4'
const AM4_LISTED = 128

const make = (key, listed) => {
  const list = captureList({
    heads: (from, count) => namHeadsHere(from, count),
    pause: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    piece: () => (capturesThroughComputer() ? NAM_HEADS_MOST : 8),
    rest: () => (capturesThroughComputer() ? 0 : 150),
    keep: (kept) => sync.setItem(key, JSON.stringify(kept)),
    listed
  })
  /* What was written down the last time, once the disk has been read. */
  hydrate().then(() => {
    try {
      list.recall(JSON.parse(sync.getItem(key) || 'null'))
    } catch {
      // Nothing kept that can be read: the list is read from the unit.
    }
  })
  return list
}
const iii = make(KEY, undefined)
const am4 = make(AM4_KEY, AM4_LISTED)
/* The list of the unit linked now, by the name the rig has for it: an AM4's, else the Axe-Fx III's, which is the one there has always been. */
const onAm4 = (st) => (st?.deviceName || '') === 'AM4'
const here = () => (onAm4(getState()) ? am4 : iii)
/* For the lines below, which were written when there was one list. */
const list = { load: (how) => here().load(how), ensure: (slot, how) => here().ensure(slot, how), head: (slot) => here().head(slot), note: (slot, name) => here().note(slot, name), stale: (slot, name) => here().stale(slot, name), turn: (run) => here().turn(run) }
/* A capture sent from the app (the TONE3000 card): the send says which slot it went into and what the unit said that slot holds afterwards, so it is in the list at once, the newest; the rest of the list is read again. */
onCaptureSent((got) => list.stale(got?.slot, got?.name))

/** The list as the screen draws it: { list, asked, total, loading, done, stale, at, fault }. */
export const useCaptures = () => {
  const which = useRig(onAm4) ? am4 : iii
  return useSyncExternalStore(which.subscribe, which.get, which.get)
}
/** Read the list, unless it is here and nothing says it has changed; `{ again: true }` reads it whatever. */
export const loadCaptures = (how) => list.load(how)
/** The head of the slot a block is on, asked of the unit by itself. */
export const nameCapture = (slot) => list.ensure(slot, { fresh: true })
/** What is known of one slot, an empty one and the 257th too: read while drawing, after `useCaptures` (which says when it changes). */
export const captureHead = (slot) => list.head(slot)
/**
 * Point a NAM block (206 or 207) at a slot: { block, slot, name }, as the
 * unit said it back. In its turn behind whatever piece of the list is being
 * read, since the capture tools take one job at a time.
 *
 * THE UNIT SAYS WHAT THE SLOT HOLDS as it points the block at it. Where that
 * is not the name the row had (the captures were changed on the unit since
 * the list was read, or this is another unit), the list is out of date: it
 * is marked so, and the answer carries `listed`, the name that was tapped,
 * so Edit can say what happened rather than show another name with no word.
 */
export const chooseCapture = (block, slot) => {
  const row = list.head(slot)
  const listed = row && !row.empty && typeof row.name === 'string' ? row.name.trim() : ''
  return list
    .turn(() => namPickHere(block, slot))
    .then((got) => {
      const name = typeof got?.name === 'string' ? got.name.trim() : null
      list.note(got?.slot, got?.name)
      if (listed && name !== null && got?.slot === slot && name !== listed) {
        list.stale()
        return { ...got, listed }
      }
      return got
    })
}

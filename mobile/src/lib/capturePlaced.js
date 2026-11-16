/*
 * THE CAPTURES THIS APP HAS PUT ON THE UNIT, AND WHERE, for as long as the
 * app runs: TONE3000's capture id to { slot, sure }. Not one drawing of a
 * tone's view: Back and the same tone again would offer Preview and Get on
 * a capture that is already there, and a second copy takes a second slot,
 * which nothing in the app can give back. `sure` is whether the unit said,
 * after the send, that the slot holds it; where it did not say, the line
 * reads "Sent to slot", never "On the unit". One is forgotten only when the
 * unit names its slot <EMPTY>.
 *
 * AND EVERY DRAWING OF THE PAGE THAT IS UP IS TOLD (`watchPlaced`, since
 * 1.90.71). A send goes on after the page it was started on is left, and
 * lands here. The page opened after it used to take what was here ONCE, as
 * it was first drawn: a capture that landed a moment later was still
 * offered with Preview and Get, and a tap on either did nothing at all,
 * with nothing on the screen to say why (it was "on the unit already").
 * Now whatever is drawn hears of it as it lands.
 *
 * AND WHEN A SEND ENDS WITHOUT LANDING (`settled`): a send that failed, or
 * that the unit took and did not keep, places nothing, and a page that had
 * said "a capture is still going, tap again when it has finished" went on
 * saying so for good (a second independent read found it). Whoever does
 * the work says when it is over, kept or not, and every drawing looks
 * again.
 *
 * AND WHERE ONE WAS TAKEN AND NOT KEPT (`notKept`, an independent read,
 * 16 November 2026). A file with no hash has one way (lib/captureSend), so a
 * unit that files it LATE (the slot reads <EMPTY> at both looks, then holds
 * it) is never asked again in that send, and the card says "not kept". The
 * next tap went looking for an empty slot, passed this one, which held it
 * by then, and put a second copy in the next. So the slot is remembered,
 * and the next send of the same capture goes into it again, not over what
 * is there: a capture the unit filed late is found there and said as kept,
 * and one it did not keep goes into the same empty slot.
 *
 * PURE: no React, no wire. The page keeps what this answers and draws it.
 */
const placed = new Map()
const unkept = new Map()
const watching = new Set()

/** What is on the unit now, as a plain object of its own (changing it changes nothing kept here): { id: { slot, sure } }. */
export const placedNow = () => Object.fromEntries([...placed].map(([id, at]) => [id, { ...at }]))

/** Whether the app has put this capture on the unit. */
export const isPlaced = (id) => placed.has(String(id))

/* Each drawing gets its own copy, and one that throws does not keep the rest from hearing. */
const tell = () => {
  for (const heard of [...watching]) {
    try {
      heard(placedNow())
    } catch {
      /* A drawing that is going away. */
    }
  }
}

/** This capture is in `slot` now; `sure` is whether the unit named the slot as holding it. */
export function place(id, slot, sure) {
  placed.set(String(id), { slot, sure })
  unkept.delete(String(id))
  tell()
}

/** The unit took this capture into `slot` and then read the slot <EMPTY>: the next send of it goes there again. */
export function notKept(id, slot) {
  if (Number.isInteger(slot)) unkept.set(String(id), slot)
}

/** The slot this capture was last taken into and not kept, or null. */
export const notKeptIn = (id) => (unkept.has(String(id)) ? unkept.get(String(id)) : null)

/** Forget it: the send into it ended some other way (refused, stopped, kept). */
export function forgetNotKept(id) {
  unkept.delete(String(id))
}

/** The unit named its slot <EMPTY>: it is not on the unit after all. */
export function unplace(id) {
  if (placed.delete(String(id))) tell()
}

/** A send, or a block being pointed, has ended, kept or not: every drawing looks again. */
export function settled() {
  tell()
}

/** Be told, with `placedNow()`, each time what is on the unit changes, and each time a send ends (`settled`). Answers the way to stop being told. */
export function watchPlaced(heard) {
  watching.add(heard)
  return () => {
    watching.delete(heard)
  }
}

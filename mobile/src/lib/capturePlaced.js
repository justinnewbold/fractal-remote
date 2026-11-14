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
 * PURE: no React, no wire. The page keeps what this answers and draws it.
 */
const placed = new Map()
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
  tell()
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

/*
 * A PRESET INTO A SETLIST, FROM ALL PRESETS.
 *
 * "Drag a preset from All presets into a setlist" was one of the ideas
 * Justin said yes to on 10 November 2026 ("yes to all your other non build
 * suggestions as well"). Until now a song got into a setlist from the
 * setlist's own page only (Add songs…, or Add the preset that is loaded),
 * so somebody browsing All presets who found the one he wanted had to
 * remember its number, leave, open Setlists and find it again.
 *
 * WHAT IS BUILT IS THE HOLD, ON EVERY DEVICE. Hold a preset in All presets
 * and a sheet comes up with his setlists: tap one and the preset is added
 * to the end of it, by the same two calls the Setlists page makes
 * (lib/lists addTo and updateList), and a line says "Added to <setlist>".
 * A setlist that has the preset already says so and cannot be tapped.
 * Starred is on the sheet too, since the star on the same row adds to it
 * today, and New setlist makes one (lib/lists createList, as the Setlists
 * page's own button does) with the preset in it.
 *
 * THE HOLD WAS TAKEN. A hold on a row has opened its colour tag since the
 * colour button came off the row (screens/Presets, lib/colourPage
 * TAG_HOLD). So the sheet carries that too: Give it a color… is its last
 * row, and opens the colour sheet the hold used to open. One more tap for
 * a colour, done once a song; nothing new on the row itself, whose width
 * is the preset's name.
 *
 * THE DRAG IS NOT BUILT. Dragging a row out of one scrolling list, across
 * the line between two sides and into another, with nothing but React
 * Native's own touch handling, could not be made dependable without a
 * device to try it on (the list wants the same finger for scrolling, and
 * the two sides are separate screens). With Setlists open beside All
 * presets the hold does the same job in two taps, and the song appears in
 * the open setlist as it is added.
 *
 * His account until features ADD_TO_SETLIST_FOR_EVERYONE. Closed to an
 * account, a hold on a preset is its colour tag, exactly as it was.
 *
 * Nothing here imports anything, so the tests run it as it is. Kept on the
 * device as the setlists are: nothing here is sent anywhere.
 */

/** The words of the sheet, the line under the list, and the line that says it worked. */
export const ADD_WORDS = Object.freeze({
  /* Over the setlists on the sheet. */
  section: 'Add to setlist',
  /* A setlist the preset is in already: said under its name, and it cannot be tapped. */
  already: 'Already in this setlist',
  /* The one Previous and Next are following now. */
  inUse: 'On now',
  starred: '★ Starred',
  alreadyStarred: 'Already starred',
  fresh: 'New setlist',
  freshSub: 'Makes one with this preset in it',
  /* What the hold used to open. */
  colour: 'Give it a color…',
  /* At the end of the list, in place of the colour tag's own line. */
  hold: 'Hold a preset to add it to a setlist or give it a color.',
  /* What a screen reader adds to a row. */
  hint: 'Hold to add it to a setlist or give it a color',
  failed: 'That did not save. Try again.'
})

/** How long "Added to …" stays up, in ms; until its ✕ with a screen reader on (components/Toast). */
export const ADDED_MS = 4000
/** How long after the sheet starts closing the colour sheet opens: one sheet is away before the next comes up. */
export const COLOUR_AFTER_MS = 400

/** Whether a hold on a preset offers Add to setlist: his account (`admin`), or everyone once the switch says so. */
export const addToSetlistOn = ({ admin = false, everyone = false } = {}) => everyone === true || admin === true

const isSlot = (n) => Number.isInteger(n) && n >= 0
const slotsOf = (list) => (list && Array.isArray(list.presets) ? list.presets : [])

/** "1 song", "12 songs", "Empty": the Setlists page's own count. */
export const songsSay = (n) => (n > 0 ? `${n} song${n === 1 ? '' : 's'}` : 'Empty')

/**
 * THE ROWS OF THE SHEET for the preset in `slot`: every setlist of this
 * unit (`lists`, lib/lists listsFor), the one Previous and Next follow now
 * (`source`) first and the rest in the order they were made, then Starred
 * (`favourites`, the starred slots).
 *
 *   { kind: 'list' | 'starred', id, name, sub, has, inUse }
 *
 * `has` is whether the preset is in it already: such a row says so and is
 * not tapped. Never a row for something that is not a setlist.
 */
export function addChoices({ lists = [], source = null, favourites = [], slot = null } = {}) {
  const ok = isSlot(slot)
  const rows = (Array.isArray(lists) ? lists : [])
    .filter((l) => l && typeof l.id === 'string' && l.id)
    .map((l) => {
      const presets = slotsOf(l)
      const has = ok && presets.includes(slot)
      const inUse = l.id === source
      const count = songsSay(presets.length)
      return {
        kind: 'list',
        id: l.id,
        name: typeof l.name === 'string' && l.name.trim() ? l.name.trim() : 'Setlist',
        sub: has ? ADD_WORDS.already : inUse ? `${count} · ${ADD_WORDS.inUse}` : count,
        has,
        inUse
      }
    })
  const first = rows.filter((r) => r.inUse)
  const rest = rows.filter((r) => !r.inUse)
  const stars = Array.isArray(favourites) ? favourites : []
  const starred = ok && stars.includes(slot)
  return [
    ...first,
    ...rest,
    {
      kind: 'starred',
      id: 'starred',
      name: ADD_WORDS.starred,
      sub: starred ? ADD_WORDS.alreadyStarred : stars.length ? `${stars.length} preset${stars.length === 1 ? '' : 's'}` : 'Nothing starred yet',
      has: starred,
      inUse: source === 'starred'
    }
  ]
}

/** "Added to Friday gig". */
export const addedSays = (name) => `Added to ${typeof name === 'string' && name.trim() ? name.trim() : 'the setlist'}`

/**
 * Whether the preset is really in the setlist now: asked of the lists as
 * they read back after the save (lib/lists updateList answers with them),
 * so "Added to …" is never said of a save that did not land.
 */
export const landedIn = (lists, id, slot) => {
  const list = (Array.isArray(lists) ? lists : []).find((l) => l && l.id === id)
  return Boolean(list) && isSlot(slot) && slotsOf(list).includes(slot)
}

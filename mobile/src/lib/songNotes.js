/*
 * A SONG'S NOTES: lyrics, chords or cues for each song in a setlist.
 *
 * "Song notes beside Play: lyrics, chords or cues for the current setlist
 * song in the other half." (One of the ideas Justin said yes to on 10
 * November 2026.) Each song in a setlist can carry a page of the player's
 * own words, shown beside Play on a window with two sides (the Notes tool,
 * components/SongNotes), over the lower part of Stage view, and written in
 * the song's own setup on the Setlists screen.
 *
 * KEPT ON THIS DEVICE, IN A DRAWER OF THEIR OWN, AND NOT ON THE SETLIST.
 * A setlist's songs are cleaned on every read to a scene and a tempo and
 * nothing else (lib/setlists cleanSong, the browser's own file, which the
 * computer app carries and the account sync merges through), so a `notes`
 * field put on a song there would be dropped by this device's next read and
 * by every other device's merge. Teaching that file about notes changes the
 * browser and the computer app and what the account stores, which is a
 * bigger thing than a page of lyrics. So the notes sit beside the setlists
 * under their own key, keyed the way a song is (the unit's drawer, the
 * setlist's id, the slot), and they stay on the device they were written
 * on: never sent to the account, the computer or anywhere else.
 *
 * A song taken out of a setlist keeps its notes in the drawer, so putting
 * it back brings them back; a setlist deleted leaves its notes behind,
 * unread, since its id is never used again.
 *
 * Storage is handed in, as lib/setlists takes it, so a test can hand in a
 * Map-backed stand-in; lib/notesHere binds the phone's own. Nothing here
 * imports anything.
 */

/** Where the notes are kept. Under `fractal.`, so lib/store carries it in memory with the rest. */
export const NOTES_KEY = 'fractal.songNotes'
/** And the size they are read at. */
export const NOTES_SIZE_KEY = 'fractal.songNotesSize'

/** The most one song's notes may be: a long song's lyrics with chords, and no more. */
export const NOTES_MAX = 4000

/** The sizes the notes can be read at (points), and what each is called. */
export const NOTE_SIZES = [18, 24, 32]
export const NOTE_SIZE_NAMES = ['Small', 'Medium', 'Large']
/** The one they start at: the middle. */
export const NOTE_SIZE_START = 1

/** Its name on the side's bar and in the list of what goes beside Play. */
export const NOTES_NAME = 'Notes'
/** With nothing written for the song yet. */
export const NOTES_EMPTY = 'No notes for this song yet'
/** The button that starts some, and the one that changes them. */
export const NOTES_ADD = 'Add notes'
export const NOTES_EDIT = 'Edit notes'
/** In the side with no setlist on (the stars or the slots stepping instead): the list does not offer Notes then, and a side left open says why it is empty. */
export const NOTES_NO_SETLIST = 'No setlist is on. Pick one in Setlists and each song’s notes show here.'
/** With a preset on that is not one of the setlist's songs. */
export const NOTES_NOT_A_SONG = 'This preset isn’t in the setlist, so it has no notes.'
/** Over the box they are typed in. `device` is the word for the device in hand (lib/device-word deviceNoun). */
export const notesHint = (device = 'device') => `Lyrics, chords or cues. Up to ${NOTES_MAX.toLocaleString('en-US')} characters, kept on this ${device} only.`

/** Notes as kept: plain text, line ends made one kind, no more than NOTES_MAX, and nothing at all when it is only space. */
export function cleanNotes(text) {
  if (typeof text !== 'string') return ''
  const plain = text.replace(/\r\n?/g, '\n').slice(0, NOTES_MAX)
  return plain.trim() ? plain.replace(/\s+$/, '') : ''
}

function readAll(storage) {
  try {
    const raw = storage?.getItem(NOTES_KEY)
    const all = raw ? JSON.parse(raw) : null
    return all && typeof all === 'object' && !Array.isArray(all) ? all : {}
  } catch {
    return {}
  }
}

const drawerOf = (all, key) => {
  const d = all[key]
  return d && typeof d === 'object' && !Array.isArray(d) ? d : {}
}

const ok = (drawer, listId, slot) => typeof drawer === 'string' && drawer !== '' && typeof listId === 'string' && listId !== '' && Number.isInteger(slot) && slot >= 0

/** One song's notes: '' when it has none, or anything asked is not a song. */
export function notesIn(storage, drawer, listId, slot) {
  if (!ok(drawer, listId, slot)) return ''
  return cleanNotes(drawerOf(drawerOf(readAll(storage), drawer), listId)[slot])
}

/**
 * Keep one song's notes, cleaned; nothing written clears them, and a list
 * or a unit left with none is taken out of the drawer. Answers what was
 * kept. A storage that refuses costs the next launch, not this press.
 */
export function putNotes(storage, drawer, listId, slot, text) {
  if (!ok(drawer, listId, slot)) return ''
  const kept = cleanNotes(text)
  const all = readAll(storage)
  const unit = { ...drawerOf(all, drawer) }
  const list = { ...drawerOf(unit, listId) }
  if (kept) list[slot] = kept
  else delete list[slot]
  if (Object.keys(list).length) unit[listId] = list
  else delete unit[listId]
  if (Object.keys(unit).length) all[drawer] = unit
  else delete all[drawer]
  try {
    storage?.setItem(NOTES_KEY, JSON.stringify(all))
  } catch {
    /* A full or refusing storage: what is on screen is still right for now. */
  }
  return kept
}

/** How many songs on this device have notes, over every unit: the one thing about them a log may say. */
export function notesCount(storage) {
  let n = 0
  for (const unit of Object.values(readAll(storage))) {
    for (const list of Object.values(unit && typeof unit === 'object' ? unit : {})) {
      for (const text of Object.values(list && typeof list === 'object' ? list : {})) if (cleanNotes(text)) n += 1
    }
  }
  return n
}

/** Whether an account has song notes at all: his, or everyone once the switch is on. */
export const songNotesOn = ({ admin = false, everyone = false } = {}) => admin === true || everyone === true

/** The setlist Previous and Next are stepping through, or null: only a setlist has songs (not the stars, not the slots). */
export function setlistOn(source, lists) {
  if (typeof source !== 'string' || !source) return null
  return (Array.isArray(lists) ? lists : []).find((l) => l && l.id === source) || null
}

/**
 * Whether the Notes tool is offered beside Play: an account that has song
 * notes, with a setlist on. With the stars or the slots there is no song to
 * have notes, so it is not on the list at all.
 */
export const notesOffered = ({ allowed = false, source = null, lists = [] } = {}) => allowed === true && setlistOn(source, lists) !== null

/**
 * The song Notes is showing: the setlist that is on, the slot of the preset
 * the unit is on, and where that is in the set (`at`, 1-based; 0 when the
 * preset is not one of its songs, and then there is no song). Null with no
 * setlist on.
 */
export function songNow({ source = null, lists = [], current = null } = {}) {
  const list = setlistOn(source, lists)
  if (!list) return null
  const presets = Array.isArray(list.presets) ? list.presets : []
  const at = Number.isInteger(current) ? presets.indexOf(current) + 1 : 0
  return { list, slot: at ? current : null, at, count: presets.length }
}

/** A size step as kept: a whole number inside NOTE_SIZES, or the start. */
export function cleanSize(step) {
  const n = Number(step)
  return Number.isInteger(n) && n >= 0 && n < NOTE_SIZES.length ? n : NOTE_SIZE_START
}

/** The step the notes are read at, as kept on the device. */
export function sizeIn(storage) {
  try {
    const raw = storage?.getItem(NOTES_SIZE_KEY)
    return raw === null || raw === undefined ? NOTE_SIZE_START : cleanSize(Number(raw))
  } catch {
    return NOTE_SIZE_START
  }
}

/** Keep a step, a size up or down from `step` by `by`, held at the ends. Answers the step kept. */
export function stepSize(storage, step, by) {
  const next = Math.max(0, Math.min(NOTE_SIZES.length - 1, cleanSize(step) + (by < 0 ? -1 : 1)))
  try {
    storage?.setItem(NOTES_SIZE_KEY, String(next))
  } catch {
    /* Kept for this run only. */
  }
  return next
}

/** The first line of some notes, for a row that has one line to show them in. */
export function notesPeek(text, most = 60) {
  const line = cleanNotes(text).split('\n').find((l) => l.trim()) || ''
  const flat = line.trim().replace(/\s+/g, ' ')
  return flat.length > most ? `${flat.slice(0, most - 1).trimEnd()}…` : flat
}

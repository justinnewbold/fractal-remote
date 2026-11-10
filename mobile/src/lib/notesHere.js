/*
 * A SONG'S NOTES, already told where the bytes live (lib/songNotes has the
 * rules and takes its storage as an argument; this binds the phone's own,
 * as lib/lists does for the setlists).
 *
 * IN THE SAME DRAWER AS THE SETLIST THEY BELONG TO: the unit's own, or in
 * the demo the demo's (shared/device-slug stageKey), asked at the moment of
 * each read and write, so notes written in the demo never land on a real
 * unit's songs. Kept on this device only (lib/songNotes says why).
 */
import { sync } from './store'
import { isDemo } from './demo'
import { stageKey } from './device-slug'
import { notesIn, putNotes, sizeIn, stepSize } from './songNotes'

const drawer = (device) => stageKey(device, isDemo())

/** One song's notes on this unit: '' for none. */
export const notesFor = (device, listId, slot) => notesIn(sync, drawer(device), listId, slot)

/** Keep one song's notes; nothing written clears them. Answers what was kept. */
export const keepNotes = (device, listId, slot, text) => putNotes(sync, drawer(device), listId, slot, text)

/** The size step the notes are read at, and a step up or down from it, kept. */
export const noteSize = () => sizeIn(sync)
export const stepNoteSize = (step, by) => stepSize(sync, step, by)

/*
 * A PRESET KEPT ON THIS DEVICE, over Bluetooth or the unit's USB cable.
 *
 * "OK now go ahead and build the Bluetooth back up for the phones" (Justin,
 * 22 November 2026). Through a computer the backups are the computer's
 * (lib/backups). With no computer there is nowhere to keep one but here, so
 * a backup is the unit's own answer to "send me the preset you have loaded"
 * (lib/gen3-grid buildGridDump: a head, the chunks, a foot), kept as it
 * came, on this device.
 *
 * AN FM3, FM9 OR AXE-FX III ONLY: the phone has no whole-preset read for an
 * AM4, and a VP4's wire sends no SysEx at all.
 *
 * WHAT IS BACKED UP IS WHAT IS LOADED: the preset as it sounds now, changes
 * not yet saved included. (The computer's Back up this preset is the other
 * thing: the preset as it is saved on the unit.)
 *
 * PLAYING ONE sends those same frames back, as the computer app does
 * (ForgeFX gen3.ts loadPresetBytes), with the head pointed at the edit
 * buffer first: a head that names a slot is a STORE to that slot
 * (forgefx-midi retargetPresetDumpToEditBuffer). So nothing here ever sends
 * a head that names a slot: `loadable` rewrites it, and the wire's way out
 * (`loadAllowed`) refuses any head that is not the edit buffer's. A slot is
 * only ever written by the app's own Save, afterwards, on the player's tap.
 *
 * NOT SEEN ON A UNIT: no preset has been sent back from a phone. The
 * computer sends these bytes over USB; down a Bluetooth adapter they have
 * never gone.
 *
 * This file imports only the frame helpers, so a test runs it whole.
 */
import { checksum } from './fractal-sysex.mjs'
import { DUMP, gridDumpPart, parseGridDump } from './gen3-grid.js'

/** The edit buffer, where a head names a slot: 0x3FFF. */
export const EDIT_BUFFER = Object.freeze([0x7f, 0x7f])

/** Whether these bytes are a frame of a preset dump for this unit, by shape alone: what the way out holds. */
export const dumpShaped = (bytes, model) => Array.isArray(bytes) && bytes.length >= 8 && bytes[0] === 0xf0 && bytes[4] === model && (bytes[5] === DUMP.HEAD || bytes[5] === DUMP.CHUNK || bytes[5] === DUMP.FOOT)

const same = (a, b) => a.length === b.length && a.every((x, i) => x === b[i])

/**
 * Whether the way out may pass `bytes`: only as, byte for byte, one of the
 * frames of the one preset being sent now (`hand`), and a head only if it
 * names the edit buffer.
 */
export function loadAllowed(bytes, hand) {
  if (!Array.isArray(bytes) || !Array.isArray(hand)) return false
  if (bytes[5] === DUMP.HEAD && (bytes[6] !== EDIT_BUFFER[0] || bytes[7] !== EDIT_BUFFER[1])) return false
  return hand.some((f) => Array.isArray(f) && same(f, bytes))
}

/** A head pointed at the edit buffer, its checksum made again. A copy. */
export function toEditBuffer(head) {
  const out = head.slice()
  out[6] = EDIT_BUFFER[0]
  out[7] = EDIT_BUFFER[1]
  out[out.length - 2] = checksum(out, out.length - 2)
  return out
}

/**
 * The frames to send for a kept preset, or null when what was kept is not a
 * whole preset of this unit: a head, nothing but chunks, a foot, every
 * checksum right and the CRC over the whole (parseGridDump). The head comes
 * back pointed at the edit buffer.
 */
export function loadable(frames, model) {
  if (!Array.isArray(frames) || frames.length < 3 || !frames.every((f) => Array.isArray(f) && f.every((b) => Number.isInteger(b) && b >= 0 && b <= 0xff))) return null
  if (!parseGridDump(frames, model)) return null
  const head = toEditBuffer(frames[0])
  if (gridDumpPart(head, model) !== 'head') return null
  return [head, ...frames.slice(1).map((f) => f.slice())]
}

/* ---------------- kept as text ---------------- */

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

/** Frames as one line of text, for the device's storage (base64 of every byte in order). */
export function packFrames(frames) {
  const bytes = frames.flat()
  let out = ''
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i]
    const b = bytes[i + 1]
    const c = bytes[i + 2]
    out += B64[a >> 2] + B64[((a & 3) << 4) | ((b ?? 0) >> 4)] + (b === undefined ? '=' : B64[((b & 15) << 2) | ((c ?? 0) >> 6)]) + (c === undefined ? '=' : B64[c & 63])
  }
  return out
}

/** The frames back out of that text: cut after every F7. Null for text that is not that. */
export function unpackFrames(text) {
  if (typeof text !== 'string' || !text.length || text.length % 4 !== 0) return null
  const bytes = []
  for (let i = 0; i < text.length; i += 4) {
    const n = [0, 1, 2, 3].map((k) => (text[i + k] === '=' ? -1 : B64.indexOf(text[i + k])))
    if (n[0] < 0 || n[1] < 0 || n.some((v, k) => v < 0 && text[i + k] !== '=')) return null
    bytes.push((n[0] << 2) | (n[1] >> 4))
    if (n[2] >= 0) bytes.push(((n[1] & 15) << 4) | (n[2] >> 2))
    if (n[2] >= 0 && n[3] >= 0) bytes.push(((n[2] & 3) << 6) | n[3])
  }
  const frames = []
  let at = 0
  for (let i = 0; i < bytes.length; i++) {
    if (bytes[i] !== 0xf7) continue
    frames.push(bytes.slice(at, i + 1))
    at = i + 1
  }
  return at === bytes.length && frames.length ? frames : null
}

/* ---------------- the list ---------------- */

/** How many are kept: of one preset on one unit, and in all. An Axe-Fx III's is some 66,000 characters. */
export const KEEP_PER_PRESET = 5
export const KEEP_IN_ALL = 20
/*
 * NOT under `fractal.`: lib/store reads every key with that prefix into
 * memory when the app starts, and these are tens of thousands of characters
 * each.
 */
export const INDEX_KEY = 'frbackups.index'
export const dataKey = (id) => `frbackups.preset.${id}`

const clean = (e) =>
  e && typeof e.id === 'string' && e.id && typeof e.unit === 'string' && e.unit && Number.isFinite(e.at)
    ? { id: e.id, unit: e.unit, slot: Number.isInteger(e.slot) ? e.slot : null, name: typeof e.name === 'string' ? e.name.slice(0, 64) : '', at: e.at, bytes: Number.isInteger(e.bytes) ? e.bytes : 0 }
    : null

/** The list as kept, newest first, with anything that is not an entry left out. */
export const cleanIndex = (list) =>
  (Array.isArray(list) ? list : [])
    .map(clean)
    .filter(Boolean)
    .sort((a, b) => b.at - a.at)

/**
 * The list with one more in it, and the ids that go to make room: the oldest
 * of the same preset on the same unit past KEEP_PER_PRESET, then the oldest
 * of all past KEEP_IN_ALL. Never the one just added.
 */
export function afterAdding(list, entry) {
  const added = clean(entry)
  const before = cleanIndex(list).filter((e) => e.id !== added?.id)
  if (!added) return { index: before, dropped: [] }
  let index = [added, ...before].sort((a, b) => b.at - a.at)
  const dropped = []
  const mine = index.filter((e) => e.unit === added.unit && e.slot === added.slot)
  for (const e of mine.slice(KEEP_PER_PRESET)) if (e.id !== added.id) dropped.push(e.id)
  index = index.filter((e) => !dropped.includes(e.id))
  while (index.length > KEEP_IN_ALL) {
    const last = [...index].reverse().find((e) => e.id !== added.id)
    if (!last) break
    dropped.push(last.id)
    index = index.filter((e) => e.id !== last.id)
  }
  return { index, dropped }
}

/** The rows the page shows: this unit's, and with `slot` only that preset's. */
export const phoneRows = (list, { unit, slot = null } = {}) => cleanIndex(list).filter((e) => e.unit === unit && (slot === null || e.slot === slot))

/** How long a frame is given to leave before the next: a MIDI jack carries 3,125 bytes a second; a USB cable needs only a breath. */
export const paceFor = (bytes, onCable) => (onCable ? 40 : Math.ceil(bytes / 3.125) + 60)

/* ---------------- words ---------------- */

export const PHONE_WHERE = (device) => `Backups are kept on this ${device}, not on the unit. A backup is the preset as it is loaded now, with any changes you haven’t saved.`
export const PHONE_KEEP_NOTE_SLOW = 'Over Bluetooth this takes about half a minute. Keep the app open until it’s done.'
export const PHONE_NONE_SLOT = (device) => `No backups of this preset on this ${device} yet.`
export const PHONE_NONE = (device) => `No backups on this ${device} yet.`
export const PHONE_ONLY_GEN3 = 'Over Bluetooth or a USB cable, backups work on an FM3, FM9 and Axe-Fx III. For this unit, connect through a computer.'
export const PHONE_PLAY_NOTE = 'Play it loads the backup on the unit without saving it. To keep it, save the preset afterwards: that writes it over the preset the unit is on.'
export const PHONE_REMOVE = 'Remove'
export const phonePlayAsk = (row, { on = null, unsaved = false } = {}) => ({
  title: `Play “${row.name || 'this backup'}”?`,
  body: `It replaces what is loaded on the unit now${unsaved ? ', and the changes you haven’t saved are lost' : ''}. Nothing is saved${Number.isInteger(on) && Number.isInteger(row.slot) && on !== row.slot ? `. This backup came from preset ${row.slot}, and the unit is on preset ${on}: saving afterwards would write it over preset ${on}` : ''}.`,
  yes: 'Play it'
})
export const phoneRemoveAsk = (row) => ({ title: `Remove “${row.name || 'this backup'}”?`, body: 'It is deleted from this device. The unit is not touched.', yes: 'Remove' })
export const keepingWords = (p) => (p && p.of ? `Reading the preset from the unit… ${Math.min(99, Math.floor((p.got / p.of) * 100))}%` : 'Reading the preset from the unit…')
export const playingWords = (p) => (p && p.of ? `Sending the backup to the unit… ${Math.min(100, Math.floor((p.sent / p.of) * 100))}%` : 'Sending the backup to the unit…')
export const KEPT = (name) => `Backed up${name ? ` “${name}”` : ''}.`
export const PLAYED = (name, saves) => `${name ? `“${name}”` : 'The backup'} is loaded on the unit. ${saves ? 'Save the preset to keep it.' : 'Save it on the unit to keep it.'}`
export const NOT_KEPT_HERE = 'The backup was read but couldn’t be kept on this device. Its storage may be full: remove an old backup and try again.'
export const GONE = 'That backup is no longer on this device.'
export const NOT_WHOLE = 'That backup isn’t a whole preset for this unit, so nothing was sent.'

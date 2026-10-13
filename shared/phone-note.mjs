/**
 * A phone saying, every couple of minutes, that it is using the computer.
 *
 * WHY THIS EXISTS. Laptops idle-sleep at gigs, and the computer app holds
 * them awake while a phone is using them (desktop/lib/awake.mjs, 1.87.23). It
 * first looked for a phone the only way the computer could see one: a
 * connection to the device server's port from another machine. That catches a
 * phone's web browser on the same wifi and nothing else. The phone app never
 * makes one — everything it asks goes through the relay, on the internet
 * ("there is no code in this app that speaks to a computer over wifi", the
 * Playing with no internet page says), and the relay's requests reach the
 * device server from inside its own process, where the computer app cannot
 * see them. So for every customer playing from the app, the laptop slept
 * exactly as before.
 *
 * So the phone says so. While its link to a computer is up, the phone app —
 * and the website, when a phone is using it through the account — writes this
 * note into the computer's own document store, and the computer app looks
 * once a minute at whether it has changed (phoneNoteChange in
 * desktop/lib/awake.mjs). A change is a phone using the computer; half an hour
 * with none and the computer may sleep again.
 *
 * Nothing about it is new to the relay: a document in the store's `config`
 * collection, which hostAllows has let a phone write all along — the same
 * place the computer writes its name, and the phone parks a save. Writing it
 * makes the computer announce it to everything listening, and every listener
 * picks its documents by name, so nothing else hears it as news. And it says
 * nothing about anybody: the phone's own clock at the moment it wrote, which
 * the computer only ever compares with the last one it read, never with a
 * clock of its own.
 *
 * Plain ESM and zero imports, for the browser, Node and Metro alike; the
 * phone's copy is mobile/src/lib/phone-note.js, made by npm run sync:rules.
 * The computer app carries the name on its own (PHONE_NOTE_ID in
 * desktop/lib/awake.mjs), and a test holds the two together.
 */

/** The document's name in the computer's store. */
export const PHONE_NOTE_ID = 'phone.seen'

/** Where a phone writes it, over the relay. */
export const PHONE_NOTE_PATH = `/store/config/${PHONE_NOTE_ID}`

/**
 * How often a connected phone says so again.
 *
 * Two minutes, well inside the half hour the computer stays awake for after
 * the last one, so a note lost on the way costs nothing. Next to the
 * keepalive the link already sends every eight seconds it is nothing.
 */
export const TELL_COMPUTER_MS = 2 * 60 * 1000

/**
 * Whether it is time to say so: connected, not to two computers that clash
 * (every write is refused then), and not said in the last TELL_COMPUTER_MS.
 * A clock that went backwards says it again rather than waiting for ever.
 */
export function timeToTell({ link = null, clash = null, toldAt = 0, now = 0, every = TELL_COMPUTER_MS } = {}) {
  if (link !== 'connected' || clash) return false
  if (!toldAt) return true
  return now - toldAt >= every || now < toldAt
}

/** What goes in it: the moment it was written, on the phone's clock. */
export const phoneNote = (now) => ({ data: { at: now }, origin: 'fractal' })

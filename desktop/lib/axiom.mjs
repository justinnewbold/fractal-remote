/**
 * "Also let Axiom use this pedal."
 *
 * WHY THIS EXISTS. "Please let Axiom (https://axiom.newbold.cloud) use the
 * Fractal app's ForgeFX again, so both apps share the pedal at the same time
 * on my Raspberry Pis" (Justin, 2 November 2026). Axiom's page runs in
 * Chromium on the same Pi and calls the device server at
 * http://localhost:5056. Since the device server's guard (computer app
 * 1.87.55, ForgeFX 93c1530) lets in only the pages it knows, and Axiom is
 * not one of them, so every call it made got a 403.
 *
 * So the computer app can name it, and only when told to. The switch is off
 * unless somebody turns it on, so every customer's computer answers exactly
 * as before; and it lets Axiom onto the unit's own routes and nothing else
 * (ForgeFX's FORGEFX_DEVICE_ORIGINS, its 'device' class): presets, scenes,
 * blocks, the tempo, the tuner, the events. Never the account routes, never
 * the computer's own. Fractal Remote stays the app that owns the unit's port
 * and serves it; Axiom is let in alongside.
 *
 * WHERE IT IS KEPT. In the device server's own store, the `config`
 * collection, as the document `fractal.axiom`: { on: true } is on, and
 * anything else is off. Not in this app's own settings folder, because the
 * phone has to be able to turn it on for a Pi with no keyboard, and the
 * phone reaches this computer only through the device server (a phone may
 * read and write `/store/config/<id>` over the relay, and the computer's own
 * window may write it like any other page). The store lives outside the app
 * (FORGEFX_DATA_DIR, or ~/.axis, as ForgeFX's own fsStoreBackend), so it
 * stays as it was through restarts and app updates.
 *
 * HOW IT IS HONOURED. The guard reads its lists once, when the device server
 * starts, so the app reads the switch before every start (serverEnv's
 * `axiom`), watches the store's file, and when the switch has changed starts
 * the device server again with the new list (main.js, relookAxiom). A few
 * seconds without the unit, once, when somebody changes it.
 *
 * Read straight from the file rather than asked of the device server,
 * because the answer is needed before the server is started. ForgeFX reads
 * its store from disk on every call and keeps nothing of it in memory, and
 * this only ever reads, so the two cannot disagree.
 *
 * The phone and the website carry the same name and address in
 * shared/axiom.mjs, which this app does not carry; a test holds them
 * together.
 */
import { homedir } from 'node:os'
import { join } from 'node:path'

/** Axiom's page, exactly as its browser names it in an Origin header. */
export const AXIOM_ORIGIN = 'https://axiom.newbold.cloud'

/** The switch's document in the device server's `config` collection. */
export const AXIOM_ID = 'fractal.axiom'

/**
 * The store file the switch is in: <data dir>/store/config.json, where the
 * data dir is FORGEFX_DATA_DIR or ~/.axis, the same rule ForgeFX's own store
 * uses (server/src/runtime/fsStoreBackend.ts DATA_DIR). The device server is
 * started with this app's environment, so the two always name one file.
 */
export function axiomStorePath({ env = process.env, home = homedir() } = {}) {
  return join(env.FORGEFX_DATA_DIR ?? join(home, '.axis'), 'store', 'config.json')
}

/**
 * Whether the store file's text says Axiom is let in: true only for a
 * document `fractal.axiom` that is not deleted and whose data says
 * `on: true`. No file, a file cut short or not JSON, no document, a deleted
 * one, or one that says anything else is off. Never throws.
 */
export function axiomOn(text) {
  if (typeof text !== 'string' || !text) return false
  try {
    const all = JSON.parse(text)
    const doc = all && typeof all === 'object' && !Array.isArray(all) ? all[AXIOM_ID] : null
    return Boolean(doc && typeof doc === 'object' && !doc.deleted && doc.data && doc.data.on === true)
  } catch {
    return false
  }
}

/**
 * The switch as this computer's store says it now, read through `read`
 * (readFileSync, handed in so this is tested without a disk). Off when the
 * file cannot be read.
 */
export function readAxiom({ env = process.env, home = homedir(), read } = {}) {
  if (typeof read !== 'function') return false
  try {
    return axiomOn(read(axiomStorePath({ env, home })))
  } catch {
    return false
  }
}

/** What the log says when the switch has changed and the device server is started again for it. */
export const axiomLine = (on) =>
  on
    ? '[axiom] Axiom may use this pedal now; starting the part that talks to the unit again with it let in'
    : '[axiom] Axiom may no longer use this pedal; starting the part that talks to the unit again without it'

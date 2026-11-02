/**
 * "Also let Axiom use this pedal": the switch, as the phone and the computer's
 * own window see it.
 *
 * "Please let Axiom (https://axiom.newbold.cloud) use the Fractal app's
 * ForgeFX again, so both apps share the pedal at the same time on my
 * Raspberry Pis ... OFF by default so customers see no change ... It must be
 * easy to switch on for a Pi with no keyboard, from the Pi's window (I use
 * Raspberry Pi Connect) or from the phone app. It must stay on through
 * restarts and app updates." (Justin, 2 November 2026.)
 *
 * The switch is one document in the computer's store, `fractal.axiom` in its
 * `config` collection: written by the computer's window like any other
 * document, and by a phone over the relay (hostAllows has let a phone write
 * `/store/config/<id>` all along). The computer app reads it before every
 * start of its device server and starts the server again when it changes
 * (desktop/lib/axiom.mjs, which carries the same name and address; a test
 * holds the two together). On, Axiom's page gets the unit's own routes and
 * nothing more: presets, scenes, blocks, tempo, the tuner. Never the account,
 * never the computer's own routes.
 *
 * Shown to Justin's account only (isAdmin), as a developer's switch: no
 * customer is shown it, and none has the document, so none sees a change.
 *
 * Plain ESM and zero imports, for the browser, Node and Metro alike; the
 * phone's copy is mobile/src/lib/axiom.js, made by npm run sync:rules.
 */

/** The switch's document in the computer's store. */
export const AXIOM_ID = 'fractal.axiom'

/** Where it is read and written. */
export const AXIOM_PATH = `/store/config/${AXIOM_ID}`

/** Axiom's page, as its browser names it. */
export const AXIOM_ORIGIN = 'https://axiom.newbold.cloud'

/**
 * The first computer app that reads the switch. A phone talking to an older
 * one is not shown it: the document would be written and nothing would read
 * it, and the tick would say Axiom is let in when it is not.
 */
export const AXIOM_COMPUTER_FROM = '1.89.26'

/** The tick box's own words. */
export const AXIOM_LABEL = 'Also let Axiom use this pedal'

/**
 * The line under it. `where` is the computer, as the reader would name it:
 * "this computer" in its own window, its name on a phone.
 */
export const axiomSub = (where = 'this computer') =>
  `For Axiom’s page in a browser on ${where}. It gets presets, scenes, blocks, tempo and the tuner, never the account. Changing this restarts the link to the unit for a few seconds.`

/** What the line says when the change could not be made. */
export const AXIOM_FAILED = 'That didn’t reach the computer. Try again.'

/** Whether a document's data says Axiom is let in: on is `on: true` and nothing else. */
export const axiomOnIn = (data) => Boolean(data && typeof data === 'object' && data.on === true)

/** What goes in the document: on or off, and when, on the writer's clock (never read as a time). */
export const axiomData = (on, now) => ({ on: on === true, at: now })

/**
 * Whether this computer's app reads the switch: true from AXIOM_COMPUTER_FROM
 * on, false below it or when its version is not known. `isOlder` is
 * shared/versions.mjs's, handed in so this file keeps no imports.
 */
export const axiomComputerCan = (version, isOlder) =>
  typeof version === 'string' && version !== '' && isOlder(version, AXIOM_COMPUTER_FROM) === false

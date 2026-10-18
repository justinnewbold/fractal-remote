/**
 * Whose app this is, and whose it is not.
 *
 * "Leave the name, but add a disclaimer that we are in no way affiliated or
 * endorsed by Fractal Audio Systems."
 *
 * AND THEN FRACTAL AUDIO WROTE (18 October 2026). Their letter on Approved
 * Vendor status asks for a clear statement, shown at startup, that the app
 * "is independently developed and is not affiliated with, endorsed by, or
 * supported by Fractal Audio Systems, LLC", for no logos, official product
 * photographs or other proprietary artwork, for their products to be named
 * in plain text only to say what the app works with, and for support to come
 * through Justin's own channels. Justin's answer: "I wanna comply as much as
 * I can. I'm just not gonna change the app name unless Fractal pushes back on
 * it." So the sentence below is theirs, word for word, and it is the one
 * every copy carries.
 *
 * THREE WORDS MOVED, and each was a fault. "Supported by" was missing, and it
 * is the one Fractal cares about most: a player who thinks the app is theirs
 * writes to them when it breaks. "Sponsored by" said something they did not
 * ask for in its place. And every copy called the company "Inc.", which
 * Fractal is not: it is Fractal Audio Systems, LLC, on its own website's
 * footer and on the letter. A disclaimer naming a company that does not
 * exist reads as careless about exactly the point it is making.
 *
 * WHY IT IS ONE STRING IN ONE FILE. This sentence has to appear in several
 * places — the startup card on every end, the startup screens, both About
 * screens, the website's pages, the third-party notices and the store
 * listings — and the version of it that matters is whichever one somebody's
 * lawyer reads. Hand-typed copies drift, and a disclaimer that says three
 * different things in three places is worse than one that says nothing,
 * because it reads as carelessness about exactly the point it is making. The
 * copies that cannot import it (the website's static pages, the store text,
 * the computer app's tray) are held to it by tests.
 *
 * IT IS ALSO AN OBLIGATION WE INHERITED. The preset codec this app carries is
 * Apache-2.0 and ships a NOTICE file whose trademark section says the same
 * thing about its own author. Section 4(d) requires we carry that forward, as
 * its author wrote it ("Inc." included: it is his notice, not ours), so some
 * version of this was going to be in the product whatever anybody decided.
 *
 * The marks named are the ones that actually appear in this app — model names
 * the unit reports and hardware the app connects to. Naming a trademark to say
 * truthfully what your product works with is ordinary, and Fractal's letter
 * says it is fine with them; the disclaimer is there so nobody reads it as a
 * claim of endorsement. Never "official", "certified", "approved" or
 * "endorsed" about the app, anywhere: and if Approved Vendor status ever
 * comes, the letter says it "does not constitute certification or
 * endorsement", so it is never presented as one.
 */

/** The full sentence, Fractal Audio's own words, for every place with room for it. */
export const NOT_AFFILIATED =
  'Fractal Remote is independently developed and is not affiliated with, ' +
  'endorsed by, or supported by Fractal Audio Systems, LLC.'

/** What the marks are and why they appear here at all. */
export const TRADEMARKS =
  '“Fractal Audio”, “Axe-Fx”, “FM3”, “FM9”, “AM4” and “VP4” are trademarks of ' +
  'Fractal Audio Systems, LLC, used here only to say which hardware this app ' +
  'works with.'

/**
 * The line at the foot of the first screen of the walkthrough.
 *
 * It was his own wording, "This product is not affiliated or endorsed by
 * Fractal Audio Systems.", in the faintest colour at the smallest size. It is
 * the full sentence now, readable, because it is the one disclaimer every
 * new player meets on the first screen, and Fractal asked for that sentence.
 */
export const WELCOME_NOTICE = NOT_AFFILIATED

/** Both, for the places that show one block of small print. */
export const AFFILIATION = `${NOT_AFFILIATED} ${TRADEMARKS}`

/**
 * The short form, for somewhere with one line to spare: the computer app's
 * tray menu, and the App Store's promotional text.
 *
 * Deliberately still carries "not affiliated" rather than shortening to
 * "independent" alone — independent is a positioning word and this is a
 * disclaimer, and the whole point of it is the part a shortener would drop.
 * And all three verbs, because "supported by" is the one Fractal asked for.
 */
export const NOT_AFFILIATED_SHORT = 'Not affiliated with, endorsed by, or supported by Fractal Audio Systems, LLC.'

/**
 * Where help with the app comes from, which is never Fractal Audio.
 *
 * Their letter: support through the developer's own channels. Feedback is a
 * row under Troubleshooting on the phone, in the browser and in the computer
 * app alike (Settings → Troubleshooting → Feedback), and the support page is
 * the website's own. Said with the sentence above wherever there is room.
 */
export const SUPPORT_LINE =
  'For help with this app, use Settings → Troubleshooting → Feedback or visit ' +
  'fractal.newbold.cloud/support.html. Fractal Audio does not provide support for this app.'

/** The address that line names, for the About pages' Help with this app row. */
export const SUPPORT_URL = 'https://fractal.newbold.cloud/support.html'

/**
 * The startup card's heading, over the sentence and the line above: once on
 * every device, before anything else, with one button, OK.
 */
export const STARTUP_NOTICE_TITLE = 'An independent app'

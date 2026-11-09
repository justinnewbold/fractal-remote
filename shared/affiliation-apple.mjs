/**
 * The trademark line as it goes to Apple: shared/affiliation.mjs's, with no
 * VP4.
 *
 * "Leave out all the stuff on the VP4. ... Seriously remove it. It's getting
 * frustrating. I have to keep deleting it every time I submit it to Apple
 * and they approve it just fine so stop." (Justin, 9 November 2026.) So the
 * App Store's Description, from 1.90.0 (the first whose Description went
 * without the VP4), carries this line, and nothing else drafted for App
 * Store Connect names the VP4. Only the trademark line is cut: Fractal
 * Audio's sentence, NOT_AFFILIATED, is word for word in both. The app, the
 * website and Google Play keep TRADEMARKS, which names every unit the app
 * works with.
 *
 * WHY A FILE OF ITS OWN. shared/affiliation.mjs is inside the computer app
 * (the web app it serves imports it), so a line added there moves the
 * computer's fingerprint (scripts/computer-fingerprint.mjs) and the merge
 * puts out a computer release with nothing new in it. Nothing the app, the
 * computer or the website draws uses this line; only the store's records and
 * their tests do, so it lives here, outside every bundle. Never import it
 * from src/, desktop/ or mobile/: test/independent.mjs holds it to
 * TRADEMARKS with only the VP4 taken out.
 */
import { NOT_AFFILIATED } from './affiliation.mjs'

export const TRADEMARKS_APPLE =
  '“Fractal Audio”, “Axe-Fx”, “FM3”, “FM9” and “AM4” are trademarks of ' +
  'Fractal Audio Systems, LLC, used here only to say which hardware this app ' +
  'works with.'

/** The App Store's block of small print: Fractal Audio's sentence, then the trademark line without the VP4. */
export const AFFILIATION_APPLE = NOT_AFFILIATED + ' ' + TRADEMARKS_APPLE

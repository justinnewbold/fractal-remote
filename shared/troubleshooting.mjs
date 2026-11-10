/**
 * What to try when it isn't working, in the order worth trying it.
 *
 * Written for somebody standing in front of a rig that has stopped answering,
 * possibly on a stage, possibly in the dark. So: the thing most likely to fix
 * it first, no jargon, and never "check your configuration" — every step is a
 * thing you can physically do.
 *
 * ONE COPY, BOTH ENDS. The browser and the phone show the same guide, because
 * a fix that exists on one and not the other is a fix somebody cannot find
 * from wherever they happen to be standing. mobile/src/lib/troubleshooting.js
 * is generated from this file by `npm run sync:rules`.
 *
 * Each fix has an `id` because the error notices link to one: a message that
 * says what went wrong and offers nothing to do about it is where this started.
 */
import { COMPUTER_NEEDED, isOlder } from './versions.mjs'
import { WINDOWS_DRIVER, quitEditor } from './editors.mjs'
import { deviceNoun } from './device-word.mjs'

export const FIXES = [
  {
    id: 'frozen',
    title: 'The unit stopped answering',
    when: 'It was working, and now nothing moves.',
    steps: [
      'Turn the unit off, wait five seconds, and turn it back on.',
      'Give it about ten seconds to start up before expecting the app to find it.',
      'Still nothing? Unplug the USB cable at both ends and plug it back in.'
    ]
  },
  {
    id: 'connect',
    title: 'It will not connect at all',
    when: 'The app has never found the unit, or stopped after a restart.',
    /* Read when the guide is opened, so the last step names the device in
       hand, or "phone or tablet" on the computer (device-word.mjs). */
    get steps() {
      return [
        'Use a USB data cable. A charge-only cable fits but carries nothing, and it’s the most common cause.',
        'Plug straight into the computer, not through a hub.',
        /* The other common one: Fractal's own editor already has the unit. */
        quitEditor(null),
        /* The one a new Windows user can hit before any of the above. */
        WINDOWS_DRIVER,
        'Check the Fractal Remote app is running on the computer: in the menu bar on a Mac, by the clock on Windows (maybe behind the ^ arrow), a window on Linux.',
        /* "I think it's connected to a different account on the computer." A
           computer on another account never hears this app, and looks exactly
           like one that is switched off. */
        'Check the app is signed into the same account here and on the computer. Settings on each shows which one.',
        /* Over the internet the wifi is not the question: the phone and the
           computer can be in different cities. What stops it is a computer that
           is asleep or offline, or something on it blocking the app. */
        `If your ${deviceNoun()} still cannot reach the computer, check it’s awake and online (a closed laptop lid puts it to sleep) and no firewall or VPN blocks the app. The same wifi isn’t needed.`
      ]
    }
  },
  {
    id: 'versions',
    title: 'The app and the computer disagree',
    when: 'Things half-work: a blank screen, or a button that does nothing.',
    steps: [
      /* Not "the same number" any more: a computer version is made only when
         the computer's own part changes, so the computer app is usually a
         few numbers behind this one and that is fine. */
      'Check the line below. The computer app doesn’t need the same number as this one, just one new enough.',
      'If it’s behind, let it update: it checks by itself, and its Settings has an Updates panel.',
      'Then reload this page, or close and reopen the app on your phone or tablet.'
    ]
  },
  {
    id: 'preset',
    title: 'A preset will not load, or loads wrong',
    when: 'The name or blocks are from the last preset, or nothing changes.',
    steps: [
      'Pick the preset again. Asking twice gets past what the computer last read.',
      'Use Read the unit again in Settings to start fresh from the unit.',
      'Names wrong or missing? Scan the preset list again from the preset sheet.'
    ]
  }
]

/** A fix by id, for the notices that link to one. */
export const fixById = (id) => FIXES.find((f) => f.id === id) || null

/**
 * Which fix an error message points at.
 *
 * Deliberately a small set of plain signals rather than a parser. An error
 * this cannot place gets no link, which is honest — a wrong fix offered
 * confidently costs more than no fix offered at all.
 */
export function fixFor(message) {
  const said = String(message || '').toLowerCase()
  if (!said) return null
  /*
   * WHICH THING IS NAMED DECIDES IT, and that ordering is the whole subtlety.
   * "The unit stopped answering" and "the computer is not answering" are the
   * same words about different boxes, and they want opposite advice: power
   * cycle the one in front of you, or go and look at the cable and the app on
   * the computer. So the computer is asked about first, and silence from
   * anything else falls through to the unit.
   */
  const quiet = /timed out|timeout|no answer|not answering|stopped answering|not responding|unreachable/.test(said)
  const computer = /computer|mac|host|helper|server/.test(said)
  /* Before the computer, because "the computer app is older than this one"
     names the computer only to say whose version it is talking about. */
  if (/version|older than|out of date|update/.test(said)) return 'versions'
  /*
   * NOTHING FOR A VP4'S OWN WORDS, past the one above ("Update the Fractal
   * Remote app on your computer…", which is a version fix). Every other
   * sentence the app says about a VP4 (shared/vp4-safety.mjs, and the
   * computer's copies of them) already says what to do — set the number in
   * Settings > VP4 scenes & presets, check SETUP > MIDI/Remote, tap again —
   * and the word "preset" in them sent the player to "A preset will not load":
   * pick it again, which on a VP4 reloads it and throws away what has not
   * been saved, the very thing the app warns about where presets are picked.
   */
  if (/\bvp4\b/.test(said)) return null
  /*
   * NOR FOR AN AM4 AMP'S BOOST (shared/am4-boost.mjs): each of its sentences
   * says what to do already, and "The preset is still loading, so the boost
   * wasn't sent. Try it again in a moment." sent the player to "A preset will
   * not load": pick it again, which loads it again and throws away what has
   * not been saved, when all it needed was a moment.
   */
  if (/\bboost\b/.test(said)) return null
  if (computer) return 'connect'
  if (/not connected|no unit|cannot find|no device|disconnected|gone/.test(said)) return 'connect'
  if (quiet) return 'frozen'
  if (/preset|slot|name/.test(said)) return 'preset'
  return null
}

/**
 * Whether the pieces are on the same version, said in a sentence.
 *
 * TWO OF THE THREE, and the third is named rather than guessed at. The app
 * knows its own version and the computer tells it one (see link.js), so those
 * two can be compared. The unit's FIRMWARE is not something either end can
 * read — no route on the device server reports it — so this says so instead of
 * leaving a row that looks like a check nobody ran.
 *
 * `null` for the computer's version is its own answer, not an error: a
 * computer app older than 7.205.0 never sent one, and so did every phone
 * running on the relay before that.
 *
 * BEHIND MEANS BELOW WHAT THIS APP NEEDS, the same rule as the red line on
 * the computer's card (link-chain.mjs). A computer version is made only when
 * the computer's own part changes, so a computer a few numbers behind this
 * app is usually on the newest release there is, and calling that "behind"
 * would send somebody looking for an update that does not exist. Behind this
 * app but at or above `needed` (COMPUTER_NEEDED) is 'ok', said plainly.
 *
 * AND WHAT THE UNIT NEEDS, the same as the red line. `lacks` names something
 * the unit on that computer needs from a newer computer app (vp4-safety.mjs
 * vp4ComputerLacks: a VP4's scenes and presets, on a computer that does not
 * say it can). A VP4 tap on such a computer says to update it, links here,
 * and this line said "That is fine". Now it says the same as the tap and the
 * red line: behind, and what for. Still only when the computer is behind this
 * app, so nobody is sent looking for a version newer than this one. Nothing
 * else passes it, so every other unit reads this line as before.
 */
export function versionsInSync({ app, host, needed = COMPUTER_NEEDED, lacks = null }) {
  if (!app) return { state: 'unknown', says: 'This app cannot tell what version it is.' }
  if (!host)
    return {
      state: 'unknown',
      says: 'The computer has not said which version it is running. That is normal on older versions of the computer app.'
    }
  if (app === host) return { state: 'ok', says: `Both on v${app}.` }
  const behind = isOlder(host, app)
  if (behind === null) return { state: 'unknown', says: `This app is v${app}; the computer said "${host}".` }
  if (!behind)
    return {
      state: 'ahead',
      says: `The computer app is v${host} and this one is v${app}. Reload this app to catch up.`
    }
  return isOlder(host, needed) === true
    ? {
        state: 'behind',
        says: `The computer app is v${host}, and this app needs v${needed} or newer. Let the computer update, then reload this app.`
      }
    : lacks
      ? {
          state: 'behind',
          says: `The computer app is v${host}, and this app needs a newer one for ${lacks}. Let the computer update, then reload this app.`
        }
      : {
          state: 'ok',
          says: `The computer app is v${host} and this one is v${app}. That is fine: the computer app has everything this one needs.`
        }
}

/** What the guide says about the one version nobody can read. */
export const FIRMWARE_NOTE =
  /* "under Setup" is the FM3's OWN menu, on the unit's front panel — not this
     app's Settings screen. The app's was renamed; the hardware's is what Fractal
     calls it and renaming it here would send somebody looking in the wrong box. */
  'The unit’s own firmware version is not something this app can read — check it on the unit itself, under Setup.'

/**
 * The same app at both ends, or a written reason why not.
 *
 * There are four things you can install and two sets of screens. The Mac app
 * loads the browser's own build, so it cannot drift from the web by
 * construction, and one Expo project builds both phones, so those two cannot
 * drift from each other. What is left is the real seam: `src/` and `mobile/`,
 * two screens written by hand for the same rig.
 *
 * Nothing used to watch that seam. The chain editor was fixed on the phone in
 * 7.311.0 and did not reach the browser until 7.320.0 — nine versions of a
 * screen that existed on one end and not the other, with nothing failing, and
 * the only way anyone found out was by opening the app and not seeing it.
 *
 * So: every button either exists at both ends, or is written down here with the
 * reason it does not. A new button on one side fails this test until somebody
 * says which it is. That is the whole mechanism — it does not decide anything,
 * it refuses to let the decision go unmade.
 *
 * WHAT IT CANNOT SEE, deliberately. A label built out of a variable is skipped
 * rather than guessed at, and so is a busy caption ("Removing…"). An extractor
 * that cries wolf gets an allowlist that becomes a junk drawer, and then it is
 * worse than nothing. This one is quiet where it cannot read and loud where it
 * can, which covers the plain `Move` / `Add` / `Remove` that drift is made of.
 */
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')

/**
 * What counts as something a person taps: a short capitalised phrase.
 *
 * Three words at the outside. Anything longer is a sentence on a screen rather
 * than a button, and the app has plenty of those.
 */
const LOOKS_LIKE_A_BUTTON = /^[A-Z][A-Za-z’']*(?: [A-Za-z’'&]+){0,2}$/

const tidy = (s) => s.replace(/&rsquo;/g, '’').replace(/\s+/g, ' ').trim()

/** "Removing…" is the same button mid-press, not a second button. */
const isBusy = (s) => /…$/.test(s)

function wordsIn(text) {
  const out = new Set()
  const keep = (raw) => {
    const t = tidy(raw)
    if (!isBusy(t) && LOOKS_LIKE_A_BUTTON.test(t)) out.add(t)
  }
  for (const m of text.matchAll(/>([^<>{}]+)</g)) keep(m[1])
  for (const m of text.matchAll(/'([^']{1,24})'|"([^"]{1,24})"/g)) keep(m[1] ?? m[2])
  return out
}

/**
 * Where a `<button>`'s opening tag ends.
 *
 * Counted rather than searched for, because an attribute is full of the
 * character being looked for: `onClick={() => move(a, b)}` has three `>` in it
 * before the one that matters.
 */
function endOfOpeningTag(src, from) {
  let depth = 0
  let quote = null
  for (let i = from; i < src.length; i++) {
    const c = src[i]
    if (quote) {
      if (c === quote) quote = null
      continue
    }
    if (c === '"' || c === "'" || c === '`') quote = c
    else if (c === '{') depth++
    else if (c === '}') depth--
    else if (c === '>' && depth === 0) return i
  }
  return -1
}

/**
 * What the browser's buttons say.
 *
 * Only what is between the tags. A `title` is a tooltip somebody has to hover
 * to read, which a phone has no way to show and no reason to match.
 */
export function webButtons(src) {
  const found = new Set()
  let i = 0
  while ((i = src.indexOf('<button', i)) !== -1) {
    const opened = endOfOpeningTag(src, i + 7)
    const closed = src.indexOf('</button>', i)
    if (opened === -1 || closed === -1) break
    for (const w of wordsIn(src.slice(opened, closed + 1))) found.add(w)
    i = closed + 9
  }
  return found
}

/**
 * The text of a `{...}` beginning at `open`, or null if it never closes.
 *
 * Quotes are tracked as well as depth, because a brace inside a string is not
 * a brace — and a label is one of the few places a `}` shows up in prose.
 */
function braced(src, open) {
  let depth = 0
  let quote = null
  for (let i = open; i < src.length; i++) {
    const c = src[i]
    if (quote) {
      if (c === '\\') i++
      else if (c === quote) quote = null
      continue
    }
    if (c === '"' || c === "'" || c === '`') quote = c
    else if (c === '{') depth++
    else if (c === '}' && --depth === 0) return src.slice(open + 1, i)
  }
  return null
}

/**
 * What the phone's buttons say.
 *
 * `<Press label="Add" />` — the phone puts the word in an attribute because
 * the same string is read out by VoiceOver, so this reads the attribute.
 */
export function phoneButtons(src) {
  const found = new Set()
  /*
   * A caption is the small word ABOVE a button's label, and it is a word on
   * the button as surely as the label is — the Setlists button on the stage
   * screen is "Setlists" over the name of the list, and reading only the
   * label saw the name and missed what the button is for. Only literal
   * captions are read; the rest are a scene number or a block's name, which
   * are contents rather than words anybody wrote.
   */
  for (const m of src.matchAll(/\bcaption="([^"]{1,40})"/g)) {
    for (const w of wordsIn(`>${m[1]}<`)) found.add(w)
  }
  for (const m of src.matchAll(/\blabel=(?:"([^"]{1,40})"|\{)/g)) {
    if (m[1] !== undefined) {
      for (const w of wordsIn(`>${m[1]}<`)) found.add(w)
      continue
    }
    /*
     * The braces are counted rather than read up to the first `}`.
     *
     * A label built from a template — `` label={`${songs(l)} · tap to rename`} ``
     * — closes one brace early, and a scan that stops there carries on eating
     * the file. That is how "Empty", a word for a setlist with no songs in it
     * forty lines further down, arrived in the survey as a button the browser
     * was missing. Unbalanced is worse than unread: it invents findings.
     */
    const body = braced(src, m.index + m[0].length - 1)
    if (body !== null) for (const w of wordsIn(body)) found.add(w)
  }
  return found
}

export const buttonsIn = (side, files) => {
  const out = new Set()
  const pick = side === 'web' ? webButtons : phoneButtons
  for (const f of files) for (const w of pick(read(f))) out.add(w)
  return out
}

/**
 * Every button, what it does, and what each end calls it.
 *
 * A one-sided button is not a bug — the phone is a stage remote and the
 * browser is where you sit down and build a tone, and plenty of things
 * belong at one end only. What was missing is anybody writing that down. So
 * an entry with `phone: null` or `web: null` has to carry a `why`, and the
 * `why` is allowed to be "only in the browser" where that is the honest state
 * of it. The list is then a list of the open questions, which is worth having
 * on its own.
 *
 * `unreadable` marks an end where the word is built out of a variable, so it
 * is here for a reader and not checked against the file. `also` is the other
 * words the same control shows — a toggle's second face, a tab pair.
 *
 * `notButtons` names words that sit inside a button and are not its label —
 * `{entry.name || 'Untitled'}` is what an unnamed preset is CALLED in the row
 * you press. The obvious rule for those, a literal after `||`, was written
 * first and immediately ate `{copied || 'Share as file'}`, an ordinary
 * button's ordinary label. The two shapes are identical and nothing around
 * them tells them apart, so they are named instead: a list cannot quietly
 * swallow a button the way a clever rule can. For a check whose whole job is
 * noticing what went missing, a silent miss is the failure that matters.
 *
 * Per area rather than global, because the same word is a name in one place
 * and a button in another: "Empty" is what an empty preset slot is called in
 * the list, and it is the empty chain slot you press in the editor.
 */
export const AREAS = [
  {
    area: 'the chain and block editor',
    web: ['src/components/GridEditor.jsx', 'src/components/Modifiers.jsx'],
    phone: ['mobile/src/screens/Edit.js'],
    buttons: [
      { does: 'put a new block in an empty slot', web: 'Add', phone: 'Add', unreadable: ['web'] },
      {
        does: 'change which amp, cab or drive a block is',
        web: null,
        phone: 'Model',
        why: 'only on the phone — the browser edits a block\u2019s controls but has no model picker at all, so an amp on the browser is whatever the unit was already set to'
      },
      {
        does: 'swap the block in a full slot for a different one',
        web: 'Replace',
        phone: null,
        unreadable: ['web'],
        why: 'the phone has Add and Remove and no single Replace — two taps for what the browser does in one'
      },
      { does: 'take a block out of the chain', web: 'Remove', phone: 'Remove' },
      {
        does: 'change your mind after pressing Remove, before anything is sent',
        web: 'Keep it',
        phone: null,
        why: 'the phone asks in the system’s own alert, whose Cancel is drawn by iOS and Android rather than written in the screen — the question and its words are the same at both ends'
      },
      {
        does: 'the empty slot you press to put something in it',
        web: 'Empty — tap to add',
        phone: 'Empty'
      },
      {
        does: 'move a block to another slot from a button',
        web: 'Move',
        phone: null,
        why: 'both ends drag a block by holding its ≡ grip; only the browser also keeps a Move button, for a mouse'
      },
      {
        does: 'abandon a move already started',
        web: 'Cancel move',
        phone: null,
        why: 'the browser’s Move starts a move that then waits for a target slot; a drag on the phone ends when the finger lifts, so there is nothing to abandon'
      },
      { does: 'close the block sheet without changing anything', web: 'Cancel', phone: 'Close' },
      {
        does: 'ask the unit for its block list again after that read failed',
        web: 'Try again',
        phone: null,
        why: 'only in the browser — nobody has decided whether the phone should offer it'
      },
      {
        does: 'build a starting chain on an empty preset',
        web: 'Starter chain',
        phone: null,
        why: 'only in the browser — nobody has decided whether the phone should offer it'
      },
      { does: 'attach a modifier to a control', web: 'Attach', phone: 'Attach' },
      {
        does: 'read what each scene holds for a modifier',
        web: 'Read scenes',
        phone: null,
        why: 'only in the browser — nobody has decided whether the phone should offer it'
      },
      {
        does: 'open the chain editor',
        web: null,
        phone: 'Edit chain',
        why: 'in the browser the chain is a section of the page under its own heading, so there is nothing to open'
      },
      {
        does: 'open the modifiers panel',
        web: null,
        phone: 'Modifiers',
        why: 'as above — a section of the page in the browser, a sheet on the phone'
      },
      {
        does: 'show whether a block is bypassed, and switch it',
        web: null,
        phone: 'Bypassed',
        /* "Turn it off" on a real VP4, whose on/off nothing reads: the press says what it does, not a state nobody read (shared/vp4-safety.mjs). */
        also: ['Engaged', 'Turn it off'],
        why: 'the browser says a block’s on or off on the play screen instead, beside the block'
      },
      {
        does: 'put a control back where it was',
        web: null,
        phone: 'Undo',
        why: 'only on the phone — nobody has decided whether the browser should have it'
      },
      {
        does: 'leave the block editor',
        web: null,
        phone: 'Done',
        why: 'the browser’s editor is part of the page, so there is nothing to leave'
      },
      {
        does: 'put away what a knob does, after its ? opened it',
        web: null,
        phone: 'Hide',
        why: 'the browser’s ? opens into the line itself and a second tap on it closes it; the phone’s knobs are three across, so the line opens under them and its button says Hide'
      },
      {
        does: 'give the open block’s kind a colour of its own, on the colour sheet',
        web: 'Color',
        phone: 'Color',
        /* The browser's is at the top of the block panel (Console.jsx BlockColour),
           which this area's files do not hold; the per-preset colours test
           further down holds it there, beside the phone's. */
        unreadable: ['web']
      }
      /*
       * The page tabs over a block's controls are not listed: they are named
       * by the unit (Basic, Tone, Preamp…), not written here, and both ends
       * draw them from the same lib/editPages.js.
       */
    ]
  },
  {
    area: 'the play screen',
    /* Tap lives in its own file now, because Edit draws the same button. */
    web: ['src/components/Gig.jsx', 'src/components/TapTempo.jsx'],
    phone: ['mobile/src/screens/Stage.js'],
    buttons: [
      { does: 'open the block editor', web: 'Edit', phone: 'Edit' },
      { does: 'tap a tempo in', web: 'Tap', phone: 'Tap' },
      {
        does: 'put away the one-time note on using the Apple Watch',
        web: null,
        phone: 'Got it',
        why: 'the watch pairs with an iPhone and works through the phone app; a browser has no watch to explain'
      },
      /* The looper is a pedal tile in the chain at both ends now, not a
         labelled button, so it is held by its own tests in run.mjs and
         mobile.mjs rather than by name here. */
      {
        does: 'turn the tuner on and off',
        web: 'Tuner',
        phone: 'Tuner',
        also: ['Stop tuner']
      },
      /* 'ask the app for a tone' — Ask here, ✦ Tone on the phone — was listed
         here until both went with the AI. Neither end has it now. */
      {
        does: 'step to the preset before this one',
        /* The word is the same at both ends; only the arrow differs. The
           browser draws its chevron as a character in the label — "‹ Previous"
           — and the phone draws it as a picture beside the label, cut from
           Justin's own mockup of this screen. So the browser's copy never
           matches this scanner's idea of a button name and the phone's now
           does, which is the whole of the difference recorded here. */
        web: '‹ Previous',
        phone: 'Previous'
      },
      {
        does: 'step to the preset after this one',
        web: 'Next ›',
        phone: 'Next'
      },
      {
        does: 'choose what Previous and Next step through',
        /* Both ends name the button after the list it is stepping through, and
           both say "All" when that is every preset on the unit. */
        web: 'All',
        phone: 'All'
      },
      {
        does: 'the word "Setlists" above that button',
        web: 'Setlists',
        phone: 'Setlists'
      },
      {
        does: 'show whether a block is bypassed',
        web: 'On',
        also: ['Off'],
        phone: null,
        why: 'the phone’s block tile carries the block’s short name and its channel, with no on/off word'
      },
      {
        does: 'ask the unit for its block list again after that read failed',
        web: 'Try again',
        phone: null,
        why: 'only in the browser — nobody has decided whether the phone should offer it'
      },
      {
        /* 1.87.17: "App keeps jumping back-and-forth from this page every
           few seconds instead of offering suggestions on what to check." */
        does: 'open Troubleshooting once the computer has been gone fifteen seconds with a rig on screen',
        web: null,
        phone: 'Troubleshooting',
        why: 'the browser leaves its Play screen for its connecting screen once the computer has been gone ten seconds, and the Troubleshooting there is listed under getting connected; the phone keeps its Play screen and floats the waiting screen’s advice and buttons over it'
      }
    ]
  },
  {
    /*
     * The one place a survey of this went wrong, and worth saying why.
     *
     * The browser has a button that says "Star this preset"; the phone stars
     * from an icon whose label is built out of the preset's name, and an
     * earlier pass read that as a phone with no way to star anything. It has
     * had one all along. So every entry below was checked against the other
     * end's whole app rather than the one file that looked like its opposite
     * number — which is also why the file lists here are lists.
     */
    area: 'the setlists and the preset list',
    /* CloudPresets.jsx and Recent.jsx were here too. Both held the library of
       tones the AI had made, and went with it. */
    web: ['src/components/Setlists.jsx'],
    phone: ['mobile/src/screens/Setlists.js', 'mobile/src/screens/Presets.js', 'mobile/src/components/SongPicker.js'],
    notButtons: {
      Empty: 'what an empty slot is called in the list — the chain editor’s Empty IS a button, which is why this is per area'
    },
    buttons: [
      {
        does: 'make a preset one of the starred ones',
        web: 'Star this preset',
        also: ['Starred', 'Star', 'Unstar'],
        phone: 'Star',
        /* The phone's says "Star <name>" / "Unstar <name>" — the same button,
           named after what it is about to star, because on a list of forty
           rows a button that only says "Star" says nothing about which. */
        unreadable: ['web']
      },
      {
        does: 'take a preset out of the list it is in',
        /* The browser's used to be a bare "Remove", on the library of tones the
           AI had made. That list went with the AI; what is left is the setlist
           row, which names what it is about to remove exactly as the phone
           does — on a list of forty rows a button that only says "Remove" says
           nothing about which. */
        web: 'Remove <name> from <setlist>',
        phone: 'Remove <name>',
        unreadable: ['web', 'phone']
      },
      {
        does: 'move a song up or down the running order',
        web: 'Move <name> — hold and drag, or use the arrow keys',
        phone: 'Drag <name>',
        unreadable: ['web', 'phone'],
        why: 'the same grip and the same gesture at both ends; the browser also answers the arrow keys, because a grip that only takes a pointer takes the running order away from anybody driving it with a keyboard, which is not a thing a phone has'
      },
      {
        does: 'read the preset list off the unit again',
        web: null,
        phone: 'Refresh',
        why: 'the browser re-reads the list by itself, on opening it and after every change; the phone offers it by hand as well, for a list that went stale in a pocket'
      },
      {
        does: 'close the setlist sheet',
        web: null,
        phone: 'Done',
        why: 'setlists are a page in the browser, with nothing to close'
      },
      {
        does: 'open every preset to tick songs into the setlist',
        web: 'Add songs…',
        phone: 'Add songs…'
      },
      {
        does: 'stop adding songs without adding the ones ticked',
        web: 'Cancel',
        phone: 'Cancel'
      }
    ]
  },
  {
    /*
     * These three words were two different sets of words until 7.325.0 — the
     * browser said Copy log and Clear, the phone said Copy the log and Clear
     * the log, and the account button said Create account in one place, Create
     * an account in another and Make an account on the phone. Nothing was
     * broken by it and nobody was confused, but the log is the thing you are
     * told to press when something has gone wrong, and being told to press a
     * button by a name it does not have is a bad moment to have on a stage.
     * They are one set of words now, and this is what keeps them one.
     */
    area: 'the log',
    web: ['src/components/DebugLog.jsx'],
    phone: ['mobile/src/screens/Log.js'],
    buttons: [
      /* Four words, so the scan above reads it as a sentence rather than a button; written down for a reader all the same. */
      { does: 'send the log to the developer in one press, with nothing to write', web: 'Send logs to developer', phone: 'Send logs to developer' },
      { does: 'put the whole log on the clipboard', web: 'Copy Logs', phone: 'Copy Logs' },
      { does: 'throw the log away', web: 'Clear Logs', phone: 'Clear Logs' },
      {
        does: 'hand the log over as a file instead of a paste',
        web: 'Share as file',
        phone: null,
        why: 'only in the browser — the log is capped at 400 lines, which pastes into a chat whole, so the phone has never needed it'
      },
      {
        does: 'close the log',
        web: null,
        phone: 'Done',
        why: 'the browser’s log is a panel in the settings page, with nothing to close'
      }
    ]
  },
  {
    area: 'getting connected and signed in',
    web: ['src/components/ConnectScreen.jsx', 'src/components/SignIn.jsx', 'src/components/SignInSheet.jsx'],
    phone: ['mobile/src/screens/Connect.js', 'mobile/src/screens/SignIn.js', 'mobile/src/components/WrongAccount.js'],
    buttons: [
      {
        does: 'make a new account',
        /*
         * At both ends now. It was the phone only — "do not allow an account
         * to be created on any of the desktop or the web app version" — until
         * the browser could sell the unlock: "somebody should be able to
         * create an account on the web and desktops, and make purchases as
         * well." The same two words at both ends.
         */
        web: 'Create account',
        /* The two-button fallback the connect screen keeps for a caller that
           hands it no form. His mockup's form says "Create account". */
        also: ['Create Account'],
        phone: 'Create account'
      },
      { does: 'sign in to an account you have', web: 'Sign in', phone: 'Sign in' },
      {
        /* The confirmation email carries a code as well as its link, for the
           one new customer in seven who never tapped the link. Both ends take
           it, under the same two words. */
        does: 'confirm a new account with the code from its email',
        web: 'Confirm account',
        phone: 'Confirm account'
      },
      {
        does: 'email yourself the computer download link',
        web: null,
        phone: 'Send link',
        /*
         * "A phone can't download desktop software, it also isn't suppose to
         * go to GitHub directly." So the phone's answer to "how do I connect
         * a computer" is the address to type there, or this — the link sent
         * somewhere the computer can open it. A browser running ON the
         * computer needs neither: it links straight to the downloads page.
         */
        why: 'the browser is already on a computer that can open the link'
      },
      {
        does: 'connect with the account this device already remembers',
        web: 'Connect',
        phone: null,
        /* The browser's connect screen remembers a signed-in account and
           offers to rejoin with it. The phone does that without asking: a
           session it already holds goes straight to the rig. */
        why: 'a phone with a session rejoins on its own rather than offering a button'
      },
      {
        does: 'join the computer with a pairing code',
        web: null,
        phone: null,
        /* "I want the QR code gone and the scanner gone. It has never worked
           once." Signing in on both ends is the pairing now. */
        why: 'there are no pairing codes at either end any more'
      },
      {
        does: 'send yourself a password reset',
        web: 'Forgot password?',
        /* Both ask now: his mockup puts "Forgot password?" in a button beside
           Create account at both ends. */
        phone: 'Forgot password?',
        unreadable: ['web']
      },
      {
        does: 'find out how to get a computer on the other end',
        web: 'Set up phone remote',
        phone: 'How to connect my computer',
        why: 'the browser says it from the computer being set up, the phone from the end that needs one — "Instead of saying connect my computer on the android app, have it say how to connect my computer", because a tester read the action as the way to sign in'
      },
      {
        does: 'open Troubleshooting when the computer or the unit will not come up',
        web: 'Troubleshooting',
        phone: 'Troubleshooting'
      },
      {
        does: 'look around without a rig',
        /* Both ends say it the same way now. "Change just looking to just Try
           the Demo - no text underneath" was carried out on the phone and not
           here, so the browser went on asking "Just looking?" with the offer
           tucked into the sentence as a chip. It is a button under the primary
           at both ends. */
        web: 'Try the Demo',
        also: ['Try now', 'Go'],
        phone: 'Try the Demo',
        why: 'the same offer at both ends, in the same three words; the browser also says Try now on the not-connected screen and Go beside the code box, neither of which the phone has a place for'
      },
      {
        does: 'go into the demo, for somebody who has paid',
        /* "If they are already signed in and the app is unlocked, instead of
           saying try the demo, have it just say Demo." The phone says it on
           Setup's Phone & computer page; the browser says it here too,
           because this is the screen a paid phone is left on while its
           computer is not answering. */
        web: 'Demo',
        phone: null,
        why: 'the phone’s Demo button is on Setup → Phone & computer rather than on its sign-in screen, which somebody who has paid never sees'
      },
      {
        does: 'choose which of the five Fractals the demo is',
        web: 'Demo Unit',
        phone: 'Demo Unit',
        unreadable: ['web', 'phone'],
        why: 'both ends now say "Demo Unit" — it was "Which unit the demo is" at both, which is a sentence rather than a label and read as one in a list of two-word rows. NEITHER end is readable from here: the browser says it as a Setup row in App.jsx and the phone as a sheet title in components/DemoUnit.js, and this area scans the connect and sign-in screens at both ends. The old wording was five words, so LOOKS_LIKE_A_BUTTON never matched it and the check skipped itself silently; the new one is two words and matches, which is how the gap showed up at all.'
      },
      {
        does: 'read the pairing code off the computer’s screen with the camera',
        web: null,
        phone: null,
        /* "I want the QR code gone and the scanner gone. It has never worked
           once. Every time I've ever tried it, you tell me something
           different." The camera, the QR code and the code box all went
           together; signing in on both ends is the pairing now. */
        why: 'there is no camera and no code to read at either end any more'
      },
      {
        does: 'close the sign-in sheet',
        web: null,
        phone: 'Done',
        why: 'signing in is a page in the browser, with nothing to close'
      }
    ]
  },
  {
    /*
     * Settings → Colours, and the colour sheet it opens. "A section where a
     * user can edit the colors of the blocks/presets and effects." What it
     * offers is lib/colourPage at both ends; this holds the buttons, and the
     * test further down holds the looks, the swatches and the words.
     */
    area: 'the Colours page',
    web: ['src/components/Colours.jsx', 'src/components/ColourSheet.jsx'],
    phone: ['mobile/src/components/Colours.js', 'mobile/src/components/ColourSheet.js'],
    notButtons: {
      'Your color': 'the word on an effect tile that wears a colour you chose — the tile is the button, and what it opens is the colour sheet',
      On: 'the corner word on the lit tile at the top of the colour sheet, a picture of Play’s tile rather than a control',
      Off: 'the corner word on the unlit tiles drawn beside the switched-off choices and at the top of the sheet, pictures of Play’s tile'
    },
    buttons: [
      { does: 'take your own colours off and keep the look', web: 'Clear them', phone: 'Clear them' },
      { does: 'show the rest of the unit’s effects, and hide them again', web: 'More effects', phone: 'More effects', also: ['Fewer effects'] },
      {
        does: 'draw switched-off effects in their own colour',
        /* A radio button's label at this end, which the scan of <button>s cannot see: the words are held by the test below. */
        web: 'Keep their color',
        phone: 'Keep their color',
        unreadable: ['web']
      },
      { does: 'draw switched-off effects grey, as the unit does', web: 'Gray when off', phone: 'Gray when off', unreadable: ['web'] },
      { does: 'change your mind about putting the colours back', web: 'Keep mine', phone: 'Keep mine' },
      { does: 'put the colours back, once asked', web: 'Put back', phone: 'Put back' },
      { does: 'wear the look you had before, a moment after a new one went on', web: 'Undo', phone: 'Undo' },
      { does: 'close the colour sheet without painting anything', web: 'Cancel', phone: 'Cancel' },
      { does: 'paint the tile in the colour picked', web: 'Use it', phone: 'Use it' },
      { does: 'take the colour a step darker', web: 'Darker', phone: 'Darker' },
      { does: 'take the colour a step lighter', web: 'Lighter', phone: 'Lighter' },
      {
        does: 'pick any colour at all, or type its colour code',
        web: 'Any color…',
        phone: null,
        why: 'the browser has a colour picker of its own; the phone would need a package with native code for one, which moves the fingerprint and costs a build, and the grid with Lighter and Darker covers it (lib/colourPage freePick says what a free pick goes through, for both)'
      }
    ]
  }
]

/** Every word an entry accounts for, whichever end it is at. */
const covered = (b) => [b.web, b.phone, ...(b.also || [])].filter((w) => typeof w === 'string')

export function run(test) {
  for (const area of AREAS) {
    const notButtons = area.notButtons || {}
    const drop = (words) => new Set([...words].filter((w) => !(w in notButtons)))
    const ends = {
      web: drop(buttonsIn('web', area.web)),
      phone: drop(buttonsIn('phone', area.phone))
    }

    /* A name that stopped appearing is an excuse nobody needs any more, and
       left alone it would go on excusing a button that arrived later under the
       same word. */
    test(`nothing on ${area.area} is excused that is not there`, () => {
      const raw = new Set([...buttonsIn('web', area.web), ...buttonsIn('phone', area.phone)])
      for (const word of Object.keys(notButtons)) {
        assert.ok(
          raw.has(word),
          `"${word}" is listed under notButtons for ${area.area} and no longer appears there. ` +
            'Take it out of AREAS in test/both-ends.mjs.'
        )
      }
    })

    test(`every button on ${area.area} is at both ends or written down`, () => {
      const named = new Set()
      for (const b of area.buttons) for (const w of covered(b)) named.add(w)
      for (const side of ['web', 'phone']) {
        for (const word of ends[side]) {
          assert.ok(
            named.has(word),
            `"${word}" is a button on ${area.area} in the ${side === 'web' ? 'browser' : 'phone'} app ` +
              'and is not in AREAS in test/both-ends.mjs. Add it there with what the other end calls it, ' +
              'or with the reason it is only at this one.'
          )
        }
      }
    })

    test(`a button ${area.area} lists at an end is still there`, () => {
      for (const b of area.buttons) {
        for (const side of ['web', 'phone']) {
          const word = b[side]
          if (typeof word !== 'string') continue
          if ((b.unreadable || []).includes(side)) continue
          if (!LOOKS_LIKE_A_BUTTON.test(word)) continue
          assert.ok(
            ends[side].has(word),
            `"${word}" — ${b.does} — is listed on ${area.area} in the ` +
              `${side === 'web' ? 'browser' : 'phone'} app and is not there any more. ` +
              'If it went on purpose, update AREAS in test/both-ends.mjs.'
          )
        }
      }
    })
  }

  test('a button at one end only says why', () => {
    for (const area of AREAS) {
      for (const b of area.buttons) {
        if (b.web !== null && b.phone !== null) continue
        assert.ok(
          b.why,
          `"${b.web || b.phone}" on ${area.area} is at one end only and no reason is written down. ` +
            'Put one in AREAS in test/both-ends.mjs — "only in the browser" is a fine answer, ' +
            'a blank is not.'
        )
      }
    }
  })
  /*
   * COLOUR MEANS THE SAME THING AT BOTH ENDS, or it means nothing.
   *
   * "The dot next to the unit name was changed to green a while back. Looks
   * like it didn't hit the web app. We need to be better at keeping all
   * versions of the app in sync with changes."
   *
   * The survey above walks both apps for the WORDS on their buttons, which is
   * why a rename cannot land at one end only. Colour had no such check, and
   * the lamp beside the unit name drifted for weeks: green on the phone, cyan
   * in the browser, for the same fact about the same rig. Cyan is not a
   * near-miss either — it is the colour that means "the computer is
   * answering", one link further back down the chain, so the browser was
   * quietly saying something different rather than something faded.
   *
   * Two checks, because there are two ways for this to go wrong. The palettes
   * can disagree about what a colour IS, and the lamps can disagree about
   * which colour a state GETS.
   */
  test('the two apps paint the same palette', () => {
    /*
     * mobile/src/lib/theme.js says in its own first paragraph that it is "the
     * same palette as the web app's :root, and for the same reason: nothing
     * is coloured for decoration". That was true when it was written and
     * nothing has ever held it true since.
     */
    const css = read('src/styles.css')
    const root = css.slice(css.indexOf(':root {'), css.indexOf('}', css.indexOf(':root {')))
    const cssVar = (name) => {
      const hit = root.match(new RegExp(`--${name}:\\s*([^;]+);`))
      return hit ? hit[1].trim().toLowerCase() : null
    }

    const theme = read('mobile/src/lib/theme.js')
    const dark = theme.slice(theme.indexOf('const DARK = {'), theme.indexOf('\n}', theme.indexOf('const DARK = {')))
    const phoneColour = (key) => {
      const hit = dark.match(new RegExp(`\\b${key}:\\s*'([^']+)'`))
      return hit ? hit[1].trim().toLowerCase() : null
    }

    /* The semantic four and the ink they sit on. Anything decorative is
       deliberately not here — the two apps are different shapes and are
       allowed to be. What has to match is what a colour MEANS. */
    for (const [phone, web] of [
      ['signal', 'signal'],
      ['live', 'live'],
      ['fault', 'fault'],
      ['ok', 'ok'],
      ['chassis', 'chassis'],
      ['panel', 'panel'],
      ['rule', 'rule'],
      ['silk', 'silk'],
      ['silkDim', 'silk-dim'],
      ['silkFaint', 'silk-faint']
    ]) {
      const a = phoneColour(phone)
      const b = cssVar(web)
      assert.ok(a, `the phone has no ${phone}`)
      assert.ok(b, `the browser has no --${web}`)
      assert.equal(a, b, `${phone} is ${a} on the phone and ${b} in the browser`)
    }
  })

  test('a lamp means the same thing at both ends', () => {
    /*
     * Three lamps in each app and two colours that are easy to confuse,
     * because they are next to each other in the chain: the COMPUTER
     * answering is cyan, the UNIT answering is green. A rig with a sleeping
     * computer and a rig with an unplugged FM3 are different evenings, and
     * the dot is the fastest way to tell which one you are having.
     */
    const lamp = read('mobile/src/components/Lamp.js')
    const css = read('src/styles.css')

    /* What the phone paints for each state — the FILL, not the halo. Read
       whole, the halo line's `color.okHalo` overwrites the fill's `color.ok`
       and the check then compares the wrong pair. */
    const fill = lamp.slice(lamp.indexOf('const fill ='), lamp.indexOf('const halo ='))
    assert.ok(fill.length > 40, 'the lamp was rewritten; this check reads its fill')
    const phone = Object.fromEntries(
      [...fill.matchAll(/state === '(\w+)' \? color\.(\w+)/g)].map((m) => [m[1], m[2]])
    )
    assert.equal(phone.good, 'ok', 'the phone no longer paints an answering unit green')
    assert.equal(phone.live, 'live', 'the phone no longer paints an answering computer cyan')
    assert.equal(phone.fault, 'fault', 'the phone no longer paints a fault red')

    /* And what the browser paints, per lamp. The unit's is scoped to the top
       bar; the link lamps take the unscoped rule. */
    const ruleFor = (selector) => {
      const at = css.indexOf(`${selector} {`)
      assert.notEqual(at, -1, `${selector} is gone, so a lamp lost its colour`)
      return css.slice(at, css.indexOf('}', at))
    }
    assert.match(ruleFor(".topbar .lamp[data-state='live']"), /background: var\(--ok\)/, 'the browser paints an answering unit something other than green')
    assert.match(ruleFor(".lamp[data-state='live']"), /background: var\(--live\)/, 'the browser paints an answering computer something other than cyan')
    assert.match(ruleFor(".lamp[data-state='fault']"), /background: var\(--fault\)/, 'the browser paints a fault something other than red')

    /*
     * And the browser's unit lamp really is the top bar's. If TopBar stopped
     * drawing it inside .topbar the scoped rule above would silently stop
     * applying and the dot would go back to cyan with every check still green.
     */
    const bar = read('src/components/TopBar.jsx')
    assert.match(bar, /<div className="topbar"/, 'the top bar is not .topbar any more, so the unit lamp loses its colour')
    assert.match(bar, /<span className="lamp" data-state=\{lampState\} \/>/, 'the unit lamp is not in the top bar')
  })

  test('a setlist is renamed in the row you chose, at both ends', () => {
    /*
     * "Typing should happen in the blue cell and the duplicate deleted."
     *
     * The phone got this right first: the chosen setlist's card IS the name
     * box, so the name you are reading is the name you change. The browser
     * kept the older shape — the row you tapped, and then a separate NAME
     * field under it holding the same word an inch away. Two boxes for one
     * name is a question about which one is real, and it is exactly the kind
     * of drift this file exists to catch.
     */
    const web = read('src/components/Setlists.jsx')
    const phone = read('mobile/src/screens/Setlists.js')

    for (const [where, src] of [['the browser', web], ['the phone', phone]]) {
      /* The box is inside the row, handed down the same way at both ends. */
      assert.match(src, /editing=\{[\s\S]{0,240}?value: draft \?\? l\.name/, `${where} does not put the name box in the chosen row`)
      assert.match(src, /tap the name to rename/, `${where} never says the row can be typed in`)
      /*
       * And storage hears about it ONCE, when the typing is done. Writing per
       * keystroke re-renders the sheet between letters, which is what made a
       * name impossible to clear and made new setlists arrive named twice.
       */
      assert.match(src, /const commitName = \(\) => \{/, `${where} has no single place a typed name is saved`)
      assert.ok(!/onChange(Text)?=\{[^}]*updateList/.test(src), `${where} writes the name on every keystroke again`)
    }

    /* And the second name box is gone from the browser, not merely hidden. */
    assert.ok(!/setlist-name/.test(web), 'the browser still carries a second box for the same name')
    assert.ok(!/setlist-name/.test(read('src/styles.css')), 'the second name box is styled, so something still draws it')
  })

  test('a model read off the unit can still be looked up, at both ends', async () => {
    /*
     * "I thought you were creating the descriptions...."
     *
     * They were created. 109 of the 119 amp families, 75 of the 86 drives and
     * all 45 cabs have one written, and the ten and eleven that do not are the
     * deliberate blanks — boutique amps nobody here has played and Fractal's
     * own designs with no real pedal behind them. Every one of the written
     * ones was INVISIBLE the moment a unit was plugged in.
     *
     * The gear sheet builds its rows two ways. `fromCatalog` is the printed
     * list, used when nothing is connected, and it carries `slug` — the block
     * the name came from. `fromRoster` is the list the unit itself hands over,
     * and it built `{ name, gear }` and stopped there.
     *
     * That draws the LIST correctly, which is why it survived: both columns
     * are there and the sheet looks finished. It is the model's PAGE that
     * breaks, because the description and the photograph are both looked up
     * per block kind, and a row that has forgotten which block it came from
     * cannot be asked for either. So "1987X Treble" on a real FM3 opened a
     * page reading "Nothing written down about this one yet", with the
     * sentence sitting in amp-lineage.json the whole time.
     *
     * Backwards, too: the descriptions were there until the app could reach a
     * unit, and then went away.
     */
    const ends = {
      browser: await import('../src/lib/gearCatalog.js'),
      phone: await import('../mobile/src/lib/gearCatalog.js')
    }
    const lines = {
      browser: await import('../src/lib/lineage.js'),
      phone: await import('../mobile/src/lib/lineage.js')
    }

    /* A roster shaped like the one a unit answers with: names and nothing
       else, which is exactly what an AM4 gives back. */
    const said = { amp: [{ name: '1987X Treble' }], drive: [{ name: 'T808 OD' }] }

    for (const [where, { groupsFor }] of Object.entries(ends)) {
      const { descriptionFor } = lines[where]
      const built = groupsFor(said).filter((g) => g.fromUnit)
      assert.ok(built.length >= 2, `${where} did not take the unit's own lists`)

      for (const group of built) {
        for (const row of group.entries) {
          assert.equal(row.slug, group.key, `${where} loses which block "${row.name}" came from`)
          assert.ok(
            descriptionFor(row.slug, row.name),
            `${where} cannot find the description for "${row.name}" once the unit has answered`
          )
        }
      }
    }

    /*
     * And the printed list and the unit's list agree about a row's shape, or
     * the page works on one path and not the other — which is the bug, one
     * layer up.
     */
    for (const [where, { groupsFor }] of Object.entries(ends)) {
      const printed = groupsFor({}).find((g) => g.key === 'amp')
      const asked = groupsFor(said).find((g) => g.key === 'amp')
      for (const field of ['slug', 'name', 'gear', 'basedOn', 'manufacturer']) {
        assert.ok(field in printed.entries[0], `${where}'s printed row has no ${field}`)
        assert.ok(field in asked.entries[0], `${where}'s row from the unit has no ${field}`)
      }
    }
  })

  test('a model page holds a spec line and as many paragraphs as were written', async () => {
    /*
     * "Your descriptions are not very captivating. I thought I described it
     * clearly how I wanted them previously when I uploaded the photo... I
     * didn't say I wanted a scrape of anything. I said I wanted it 'like'
     * this."
     *
     * The reference is a SHAPE: the model's name, what it really is, the
     * photograph, a line of numbers, then several paragraphs. This page could
     * hold one sentence. Anything longer written into the catalog came out as
     * a single block with the paragraph breaks eaten, which makes the writing
     * look worse the more of it there is — the opposite of what a person
     * filling these in deserves.
     *
     * So the plumbing goes in first and the words come after. Whoever writes
     * them types a blank line between paragraphs and gets paragraphs.
     */
    const lines = {
      browser: await import('../src/lib/lineage.js'),
      phone: await import('../mobile/src/lib/lineage.js')
    }

    for (const [where, lib] of Object.entries(lines)) {
      const { descriptionFor, specsFor, paragraphsOf } = lib

      /* Blank lines are paragraph breaks; a single newline inside one is just
         how the file was wrapped and is not a break. */
      assert.deepEqual(paragraphsOf('one\n\ntwo\n\nthree'), ['one', 'two', 'three'], `${where} loses paragraph breaks`)
      assert.deepEqual(paragraphsOf('wrapped\nover two lines'), ['wrapped over two lines'], `${where} breaks on a soft wrap`)

      /* Nothing written is an empty list, not a list holding an empty string —
         the "nothing written down yet" message hangs off exactly this. */
      for (const nothing of [null, undefined, '', '   ', '\n\n']) {
        assert.deepEqual(paragraphsOf(nothing), [], `${where} turns nothing into a paragraph`)
      }

      /* The one filled in as the worked example, in the shape the reference
         has: a spec line, and more than one paragraph. */
      const jvm = 'Brit JVM OD1 Orange'
      assert.match(specsFor('amp', jvm), /watt/, `${where} has no spec line for the JVM`)
      assert.ok(paragraphsOf(descriptionFor('amp', jvm)).length > 1, `${where} draws the JVM as one block`)

      /* And a model inherits its family's page whole — spec line and all
         the paragraphs — rather than only the first sentence of it. */
      assert.ok(paragraphsOf(descriptionFor('amp', '1987X Treble')).length > 1, `${where} gives a voicing only part of its family's page`)
      assert.match(specsFor('amp', '1987X Treble'), /50 watt/, `${where} loses the family's spec line on a voicing`)

      /* Nothing written is still nothing drawn: a block with no catalog at
         all must not acquire a spec line from somewhere. */
      assert.equal(specsFor('reverb', 'Ambient'), null, `${where} invents a spec line`)
    }

    /* Both pages read all three, or the fields exist and nothing draws them. */
    for (const [where, file] of [['browser', 'src/components/GearCard.jsx'], ['phone', 'mobile/src/components/GearCard.js']]) {
      const card = read(file)
      assert.match(card, /paragraphsOf\(descriptionFor\(/, `${where}'s model page still draws one block`)
      assert.match(card, /specsFor\(entry\.slug, entry\.name\)/, `${where}'s model page never asks for the spec line`)
      /* And the picture comes before the writing, which is the order asked
         for and the order the questions arrive in. */
      assert.ok(card.indexOf('photo.credit') < card.indexOf('about.map'), `${where} puts the writing above the photograph`)
    }
  })


  /*
   * THE SETUP LIST, WHICH NOTHING WAS WATCHING.
   *
   * "It looks like some of the menus aren't matching up, some of the changes
   * we made recently, like nesting some of the menus and things like that,
   * and some of the wording. I also thought we had checks in place to make
   * sure that they didn't drift apart??"
   *
   * There were, and they did not cover this. The AREAS above watch five
   * screens — the chain editor, the play screen, setlists, the log, and
   * getting connected — and Setup is not one of them. They also only see a
   * label a person could mistake for a button name: LOOKS_LIKE_A_BUTTON tops
   * out at three words, so "Amp & pedal names" and "Rename presets and
   * scenes" were invisible to the whole mechanism.
   *
   * And none of it watches SHAPE. Every check in this file asks whether a
   * word exists somewhere in a file. A row that moved one level down still
   * exists, so "Move walkthrough, updates and troubleshooting INSIDE of the
   * 'About' menu" could be carried out on the phone and skipped in the
   * browser with everything green.
   *
   * This reads the two lists as lists: which rows are on the front page, in
   * what order, and which are behind About. A row that exists at one end only
   * is fine and has to be written down with the reason, exactly as a button
   * does above.
   */
  test('Setup is the same list, in the same order, at both ends', () => {
    /* A row at one end only, and why. Same contract as AREAS: unexplained
       fails, explained passes, and the list is the open questions. */
    const ONE_END = {
      'Apple Watch':
        'iPhone only — the watch app comes with the iPhone app and works through it; a browser has no watch, and there is no Android watch app',
      'Bluetooth (beta)':
        'phone only — a browser cannot reach a Bluetooth MIDI adapter; the phone does it through its own native module, and since 11 October 2026 only on Justin’s account (useBluetoothAllowed, mobile/src/lib/bluetooth.js)',
      Footswitches:
        'phone only as a Settings row — the browser shows the same panel, from the same shared/footswitches.mjs, as a section of the Edit sheet, where it has been since it was built',
      'Get it on your phone or tablet': 'browser only — a phone has no use for a way to get itself onto a phone, and it stays on the front page rather than inside About because "somebody who has a rig connected and wants the remote in their pocket is the likeliest buyer there is"'
      /* 'Unlock the full version' was here as phone-only — "the browser has
         nothing to sell". Web Billing changed that, and the row is at both
         ends now, in the same place. */
    }

    /* The phone's PAIR_TITLE is Phone & computer by another name: iPad &
       computer on an iPad (shared/device-word.mjs). The same row. */
    const rowsIn = (block, attr) =>
      [...block.matchAll(new RegExp(`<SetupRow\\b[\\s\\S]*?${attr}=(?:"([^"]+)"|\\{([A-Z_]+)\\})`, 'g'))].map((m) =>
        m[2] === 'PAIR_TITLE' ? 'Phone & computer' : m[1] || m[2]
      )

    /* The browser: the front list is the first setup-rows block on the
       Settings sheet, and About's rows are the first one inside its page. */
    const web = read('src/App.jsx')
    const webSheet = web.slice(web.indexOf('title="Settings"'))
    const firstList = (block) => {
      const at = block.indexOf('<div className="setup-rows">')
      assert.notEqual(at, -1, 'the browser Setup list moved; this check reads it')
      return block.slice(at, block.indexOf('</div>', at))
    }
    /* The front page is every group now, from the account card to the first page behind it. */
    const webFront = rowsIn(webSheet.slice(webSheet.indexOf('setup-account-card'), webSheet.indexOf("setupPage === 'appearance'")), 'title')
    const webAbout = rowsIn(firstList(webSheet.slice(webSheet.indexOf("setupPage === 'about'"))), 'title')

    /* The phone: the front page is `page === null`, About is `page === 'about'`. */
    const app = read('mobile/src/screens/Settings.js')
    const between = (from, to) => {
      const at = app.indexOf(from)
      assert.notEqual(at, -1, `the phone Setup screen moved; this check reads ${from}`)
      const end = to ? app.indexOf(to, at) : -1
      return app.slice(at, end === -1 ? undefined : end)
    }
    /* Up to the first page that is not the front one — 'unit', today. Named
       by the shape rather than by which page happens to come first, so adding
       a page does not silently widen the slice. */
    const phoneFront = rowsIn(between('{page === null ? (', "{page === 'account' ? ("), 'title')
    const phoneAbout = rowsIn(between("{page === 'about' ? (", '<Section>The small print</Section>'), 'title')

    for (const [where, rows] of [['browser front', webFront], ['phone front', phoneFront], ['browser About', webAbout], ['phone About', phoneAbout]]) {
      assert.ok(rows.length > 0, `${where} came back empty; this check no longer reads the list`)
    }

    /* Rows only one end has drop out, with a written reason. Everything left
       is a row both have, and those must be in the same order. */
    const shared = (rows, other) =>
      rows.filter((r) => {
        if (other.includes(r)) return true
        assert.ok(
          ONE_END[r],
          `"${r}" is on one end's Setup and not the other's, and no reason is written down. ` +
            'Put one in ONE_END in test/both-ends.mjs, or put the row on both ends.'
        )
        return false
      })

    /*
     * AN EXCUSE THAT NO LONGER APPLIES FAILS TOO. "Unlock the full version"
     * sat in ONE_END as phone-only after the browser had grown the same row,
     * and nothing complained — an entry that excuses a row present at both
     * ends is a reason that has stopped being true, and left there it would go
     * on excusing the next row to drift under that name.
     */
    for (const row of Object.keys(ONE_END)) {
      const web = webFront.includes(row) || webAbout.includes(row)
      const phone = phoneFront.includes(row) || phoneAbout.includes(row)
      assert.ok(web !== phone, `"${row}" is excused in ONE_END as one-end-only, and it is ${web && phone ? 'at both ends' : 'at neither'} now. Take it out.`)
    }

    const bothFront = [shared(webFront, phoneFront), shared(phoneFront, webFront)]
    assert.deepEqual(
      bothFront[0],
      bothFront[1],
      `the Setup front page is a different order at the two ends:\n  browser: ${webFront.join(', ')}\n  phone:   ${phoneFront.join(', ')}`
    )

    const bothAbout = [shared(webAbout, phoneAbout), shared(phoneAbout, webAbout)]
    assert.deepEqual(
      bothAbout[0],
      bothAbout[1],
      `the About page is a different order at the two ends:\n  browser: ${webAbout.join(', ')}\n  phone:   ${phoneAbout.join(', ')}`
    )

    /*
     * AND THE NESTING ITSELF, named rather than inferred. Updates stays inside
     * About at both ends. Troubleshooting and the walkthrough came back out to
     * the front, under Help — "think of anything that can be made so that the
     * user has an easier time quickly locating settings" — and the three
     * developer tools are behind one Developer row.
     */
    assert.ok(webAbout.includes('Updates'), "Updates is not inside the browser's About")
    assert.ok(phoneAbout.includes('Updates'), "Updates is not inside the phone's About")
    for (const row of ['Troubleshooting', 'REPLAY', 'Developer']) {
      assert.ok(webFront.includes(row), `${row} is not on the browser's front list`)
      assert.ok(phoneFront.includes(row), `${row} is not on the phone's front list`)
    }
    for (const row of ['Give someone access', 'Sales at a glance', 'Everyone with an account']) {
      assert.ok(!webFront.includes(row) && !phoneFront.includes(row), `${row} is back on a front list instead of inside Developer`)
    }
  })

  /*
   * THE TWO COLOURS PAGES OFFER THE SAME THING.
   *
   * "Additionally i want to make a section where a user can edit the colors
   * of the blocks/presets and effects." The phone's page came first, and the
   * browser's was written to it: the same looks in the same order, the same
   * swatches with the same names said for them, the same words. The scan of
   * buttons above sees the buttons; this sees the rest — every sentence each
   * page shows, read out of the code itself (the babel parser, as
   * test/structure.mjs reads the tests), so a heading or a note that changes
   * at one end and not the other fails here rather than on a stage.
   */
  test('the two Colours pages offer the same looks, the same swatches and the same words', async () => {
    const { parse } = await import('@babel/parser')
    const babelTraverse = (await import('@babel/traverse')).default
    const traverse = babelTraverse.default || babelTraverse
    /* What only one end says, and why. Unexplained fails; explained passes. */
    const WEB_ONLY = {
      'Your colors are kept on this computer. A phone or tablet keeps its own.':
        'the computer app’s own window, which is not the remote: it says what a phone or tablet does instead',
      'Your colors are kept {}. The computer’s screen keeps its own.':
        'the phone’s sentence, with the device said by onThis() — "in this browser", "on this iPad" — where the phone says "on this {deviceNoun()}" (held word for word below)',
      'Any color…': 'the browser’s free colour picker, which the phone cannot have without a build (AREAS above)',
      'Pick any color': 'the label on that picker',
      'Or type its color code': 'the label on the box beside it',
      Dismiss: 'what the browser’s cross on the colours’ one-time line says to a screen reader; the phone’s Note says the same from its own file (components/Note)',
      'Scene {}{}{}': 'what a screen reader says for a scene tile, its name and "your colour" with it; the phone’s Tile says its own caption and label'
    }
    const PHONE_ONLY = {
      'Your colors are kept on this {}. The computer’s screen keeps its own.': 'the same sentence as the browser’s, which names the device by onThis() rather than "on this" and deviceNoun()'
    }
    const KEYS = new Set(['Escape', 'Enter', 'Tab', 'ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown', 'Home', 'End'])
    const shown = (files) => {
      const out = new Set()
      const keep = (raw) => {
        const t = String(raw).replace(/\s+/g, ' ').trim()
        /* Something a person reads: it starts with a capital and has words in it. */
        if (!t || KEYS.has(t) || !/^[^A-Za-z{]*[A-Z]/.test(t) || !/[a-z]/.test(t)) return
        out.add(t)
      }
      for (const f of files) {
        traverse(parse(read(f), { sourceType: 'module', plugins: ['jsx'] }), {
          ImportDeclaration: (p) => p.skip(),
          StringLiteral(p) {
            if (!(p.parentPath.isObjectProperty() && p.parentPath.node.key === p.node)) keep(p.node.value)
          },
          /* A sentence built round a value is read with the value as {}: "{} of your own colours on top". */
          TemplateLiteral: (p) => keep(p.node.quasis.map((q) => q.value.cooked).join('{}')),
          JSXText: (p) => keep(p.node.value)
        })
      }
      return out
    }
    const web = shown(['src/components/Colours.jsx', 'src/components/ColourSheet.jsx', 'src/components/ColoursNotice.jsx'])
    const phone = shown(['mobile/src/components/Colours.js', 'mobile/src/components/ColourSheet.js', 'mobile/src/components/ColoursNotice.js'])
    assert.ok(web.size > 30 && phone.size > 30, 'the pages came back nearly empty; this check no longer reads them')
    for (const [where, mine, theirs, excused] of [
      ['browser', web, phone, WEB_ONLY],
      ['phone', phone, web, PHONE_ONLY]
    ]) {
      for (const w of mine) {
        if (theirs.has(w)) continue
        assert.ok(excused[w], `"${w}" is on the ${where}’s Colours page and not the other end’s, and no reason is written down`)
      }
      for (const w of Object.keys(excused)) assert.ok(mine.has(w) && !theirs.has(w), `"${w}" is excused as ${where}-only and is ${mine.has(w) ? 'at both ends' : 'gone'} now. Take it out.`)
    }
    /* The remote's own sentence is the phone's, the device named by what it is. */
    assert.match(read('src/components/Colours.jsx'), /`Your colors are kept \$\{onThis\(\)\}\. The computer’s screen keeps its own\.`/)
    assert.match(read('mobile/src/components/Colours.js'), /`Your colors are kept on this \$\{deviceNoun\(\)\}\. The computer’s screen keeps its own\.`/)

    /* The same looks, in the same order, each card in its own look's colours. */
    for (const f of ['src/components/Colours.jsx', 'mobile/src/components/Colours.js']) {
      const page = read(f)
      assert.match(page, /\{LOOKS\.map\(\(look\) => \(\s*<LookCard key=\{look\.id\}/, `${f} does not offer every look, in order`)
      assert.match(page, /const tiles = lookCard\(look\.id\)/, `${f} draws a look’s card from something other than lib/colourPage`)
      assert.match(page, /const rest = unitFamilies\(\)\.filter\(\(f\) => !chain\.includes\(f\)\)/, `${f} offers effects of its own choosing`)
      assert.match(page, /const chain = presetFamilies\(blocks\)/, `${f} does not put the loaded preset’s effects first`)
    }
    /* The same swatches, said the same way. */
    for (const f of ['src/components/ColourSheet.jsx', 'mobile/src/components/ColourSheet.js']) {
      const sheet = read(f)
      assert.match(sheet, /const swatches = target \? sheetSwatches\(target\) : \[\]/, `${f} draws swatches of its own`)
      assert.match(sheet, /spokenSwatch\(target, s, \{ yours: s\.fill === yours && !s\.own \}\)/, `${f} names its swatches some other way`)
      assert.match(sheet, /const pick = open && base \? shadeOf\(base, step, \{ scene \}\) : null/, `${f} goes lighter and darker by some other rule`)
      assert.match(sheet, /const warning = open \? nextToWarning\(target, pick, \{ chain, spelt, only \}\) : null/, `${f} warns by some other rule`)
    }
    /* And every rule the phone's page takes from lib/colourPage, the browser's takes too. */
    const fromPage = (f) => new Set((read(f).match(/import \{([^}]*)\} from '\.\.\/lib\/colourPage'/)?.[1] || '').split(',').map((x) => x.trim()).filter(Boolean))
    for (const [phoneFile, webFile] of [
      ['mobile/src/components/Colours.js', 'src/components/Colours.jsx'],
      ['mobile/src/components/ColourSheet.js', 'src/components/ColourSheet.jsx']
    ]) {
      const web = fromPage(webFile)
      for (const name of fromPage(phoneFile)) assert.ok(web.has(name), `${webFile} does without ${name}, which the phone’s page is drawn by`)
    }
  })

  /*
   * ONE PRESET'S COLOURS, THE SAME AT BOTH ENDS.
   *
   * "Make a section where a user can edit the colors of the blocks/presets
   * and effects." A scene can be coloured for just the preset that is loaded,
   * and a preset can wear a colour tag; both are filed per unit and preset
   * number in lib/looks and painted through lib/colourPage at both ends. What
   * this holds is everything around that: that Play at both ends asks for
   * this preset's scene colours (and Scene arrange, which is every preset's
   * layout, does not), that the tag is drawn in the same places by the same
   * rule, and that the ways in — a hold on a row of the preset list, the
   * Colours page, the scene names, the open block on Edit — are at both ends.
   */
  test('one preset’s colours are the same at both ends: its scenes on Play, its tag, and the ways in', async () => {
    const gig = read('src/components/Gig.jsx')
    const stage = read('mobile/src/screens/Stage.js')
    /* Play: this preset's colour for a scene, then yours, then the look's. */
    assert.match(gig, /'--scene-fill': sceneColor\(i, preset\?\.number\)\.fill, '--scene-ink': sceneColor\(i, preset\?\.number\)\.ink/, 'the browser’s Play does not ask for this preset’s scene colours')
    assert.match(stage, /const hue = sceneColor\(i, preset\?\.number\)/, 'the phone’s Play does not ask for this preset’s scene colours')
    /* Scene arrange lays out every preset's scenes, so it wears every preset's colours. */
    assert.match(read('src/components/SceneArrange.jsx'), /'--scene-fill': sceneColor\(scene\)\.fill/)
    assert.match(read('mobile/src/components/SceneArrange.js'), /const hue = sceneColor\(scene\)\n/)

    /* The tag beside the name on Play, at both ends, and nothing for a preset without one. */
    assert.match(gig, /\{presetTag\(preset\?\.number\) \? \(\s*<span className="gig-name-tag" aria-hidden="true" style=\{\{ '--tag': presetTag\(preset\.number\) \}\} \/>\s*\) : null\}/)
    assert.match(stage, /style=\{\[\{ paddingHorizontal: space\.lg \}, tagEdge\(presetTag\(preset\?\.number\)\)\]\}/)
    /*
     * In the preset list, by HOLDING a row (or right-clicking it, at a
     * computer), and the bar on the row. Not a button beside the star: one on
     * every row came out of every name's width, in the list a player reads
     * most. A hold never loads — RN keeps a hold from being a press, and
     * lib/longPress swallows the click a hold ends in — and the row and the
     * star are the only things on a line, as they were before colours.
     */
    const list = read('src/components/Console.jsx')
    const rows = list.slice(list.indexOf('export function PresetList('), list.indexOf('export function BlockPanel('))
    assert.ok(!/preset-colour/.test(rows), 'the browser’s Colour button is back beside the star')
    assert.match(rows, /<Held onHold=\{presetTarget\(slot\.number\) \? \(\) => setPainting\(presetTarget\(slot\.number, \{ words: wordsFor\(slot\) \}\)\) : null\}>\s*\{\(hold\) => \(\s*<button\s+\{\.\.\.hold\}\s+className=\{`preset-row/, 'a browser row cannot be held for its colour')
    assert.match(list, /function Held\(\{ onHold, children \}\) \{\s+return children\(useLongPress\(onHold, \{ enabled: !!onHold \}\)\)/)
    assert.match(rows, /data-tag=\{presetTag\(slot\.number\) \? 'yes' : undefined\}\s+style=\{presetTag\(slot\.number\) \? \{ '--tag': presetTag\(slot\.number\) \} : undefined\}/)
    assert.match(rows, /title=\{presetTarget\(slot\.number\) \? TAG_HOLD\.browserHint : undefined\}/)
    assert.match(rows, /\{shown\.length && presetTarget\(shown\[0\]\.number\) \? <p className="hint pad preset-hold-hint">\{TAG_HOLD\.browser\}<\/p> : null\}/, 'the browser’s list does not say how a preset gets its colour')
    assert.match(rows, /<ColourSheet target=\{painting\} onClose=\{\(\) => setPainting\(null\)\} \/>/)
    const presets = read('mobile/src/screens/Presets.js')
    assert.ok(!/TagButton/.test(presets), 'the phone’s Colour button is back beside the star')
    assert.match(presets, /onLongPress=\{target \? \(\) => setPainting\(target\) : undefined\}\s+accessibilityHint=\{target \? TAG_HOLD\.hint : undefined\}/, 'a phone row cannot be held for its colour')
    assert.match(presets, /style=\{tagEdge\(tag\)\}\s*\/>\s*<Star/, 'something sits between the phone’s row and its star again')
    assert.match(presets, /ListFooterComponent=\{\s*shown\.length && presetTarget\(shown\[0\]\) \? \([\s\S]{0,200}\{TAG_HOLD\.phone\}/, 'the phone’s list does not say how a preset gets its colour')
    assert.match(presets, /<ColourSheet target=\{painting\} onClose=\{\(\) => setPainting\(null\)\} \/>/)
    /* The Press a hold is wired through keeps a hold from loading. */
    assert.match(read('mobile/src/components/Press.js'), /onLongPress=\{\s+onLongPress\s+\? \(\) => \{/)
    /* And from Settings → Colours, the loaded preset with a tap, and the hold said there too. */
    const webPage = read('src/components/Colours.jsx')
    assert.match(webPage, /const tagHere = preset \? presetTarget\(preset\.number, \{ words: preset\.words \}\) : null/)
    assert.match(webPage, /onClick=\{\(\) => setPainting\(tagHere\)\}/)
    assert.match(webPage, /<p className="hint">\{TAG_HOLD\.browserPage\}<\/p>/)
    const phonePage = read('mobile/src/components/Colours.js')
    assert.match(phonePage, /const tagHere = here \? presetTarget\(here\.number, \{ words: here\.words \}\) : null/)
    assert.match(phonePage, /<TagRow words=\{tagHere\.name\} fill=\{presetTag\(tagHere\.number\)\} onPress=\{\(\) => setPainting\(tagHere\)\} \/>/)
    assert.match(phonePage, /\{TAG_HOLD\.phonePage\}/)
    /* And on a song's row in a setlist. */
    assert.match(read('src/components/Setlists.jsx'), /\$\{presetTag\(n\) \? ' tagged' : ''\}[\s\S]{0,400}\.\.\.\(presetTag\(n\) \? \{ '--tag': presetTag\(n\) \} : \{\}\)/)
    assert.match(read('mobile/src/screens/Setlists.js'), /tag=\{presetTag\(n\)\}/)
    assert.match(read('mobile/src/screens/Setlists.js'), /tagEdge\(tag\)\n\s*\]\}/)

    /* THE ONE RULE THE BAR IS DRAWN BY: the colour on the dark page, half way to black on paper, four wide. */
    const page = await import('../src/lib/colourPage.js')
    const ink = await import('../src/lib/ink.js')
    assert.equal(page.TAG_WIDTH, 4)
    const css = read('src/styles.css')
    const half = Math.round(ink.PAPER_EDGE * 100)
    assert.match(css, /button\.preset-row\[data-tag\],\n\.colours-tag\[data-tagged\],\n\.gig-name-tag,\n\.setlist-song\.tagged,\n\.colour-tag-preview \{\n  --tag-drawn: var\(--tag\);\n\}/, 'the browser draws the bar in something other than the colour on the dark page')
    assert.match(css, new RegExp(`\\[data-theme='light'\\] \\.colour-tag-preview \\{\\n  --tag-drawn: color-mix\\(in srgb, var\\(--tag\\) ${half}%, black\\);`), 'the browser’s bar on paper is not the colour half way to black, as lib/ink’s PAPER_EDGE is')
    for (const where of ['button.preset-row[data-tag]', '.setlist-song.tagged', '.colours-tag[data-tagged]']) {
      assert.ok(css.includes(`${where} {\n  box-shadow: inset ${page.TAG_WIDTH}px 0 0 var(--tag-drawn);`), `${where} is not a bar ${page.TAG_WIDTH} wide`)
    }
    const tag = read('mobile/src/components/PresetTag.js')
    assert.match(tag, /return \{ borderLeftWidth: TAG_WIDTH, borderLeftColor: tagFill\(fill, \{ light: !isDark\(\) \}\) \}/, 'the phone draws the bar by some other rule')
    for (const s of page.TAG_SWATCHES) {
      assert.equal(page.tagFill(s.fill), s.fill)
      assert.equal(page.tagFill(s.fill, { light: true }), ink.paperEdge(s.fill))
      for (const p of ['#0d0f12', '#15181d']) assert.ok(ink.contrast(page.tagFill(s.fill), p) >= 3, `a ${s.name} tag is lost on the dark page`)
      for (const p of ['#f2efe9', '#faf8f4', '#f4f2ee', '#ffffff']) assert.ok(ink.contrast(page.tagFill(s.fill, { light: true }), p) >= 3, `a ${s.name} tag is lost on paper (${p})`)
    }

    /* The ways in. The scene names: a colour for this preset's scene, opening on Just this preset. */
    /* With the scene's own name, so the sheet's tiles say "Pushed AC" as Play does rather than "Scene 2". */
    assert.match(read('src/components/Scenes.jsx'), /setPainting\(sceneTarget\(current, \{ preset: presetHere, only: true, called: names\[current\] \}\)\)/)
    assert.match(read('mobile/src/components/RenamePreset.js'), /setPainting\(sceneTarget\(i, \{ preset: here, only: true, called: scenes\[i\] \}\)\)/)
    assert.match(read('src/components/ColourSheet.jsx'), /<span className="gig-scene-name">\{target\.label \|\| target\.name\}<\/span>/, 'the browser sheet’s scene tiles say Scene 2 where Play says the name')
    assert.match(read('mobile/src/components/ColourSheet.js'), /label=\{target\.label \|\| target\.name\}/, 'the phone sheet’s scene tiles say Scene 2 where Play says the name')
    /* The open block on Edit, for its family, never for the chain's two ends. */
    const block = list.slice(list.indexOf('export function BlockPanel('))
    assert.match(block, /\{paintable\(block\?\.slug\) \? <BlockColour slug=\{block\.slug\} \/> : null\}/)
    assert.match(list, /setPainting\(familyTarget\(slug\)\)\}>\s*<span className="block-colour-dot"[^>]*\/>\s*Color\s*<\/button>/)
    const edit = read('mobile/src/screens/Edit.js')
    assert.match(edit, /\{paintable\(block\.slug\) \? <BlockColour slug=\{block\.slug\} \/> : null\}/)
    assert.match(edit, /<Press label="Color" height=\{40\} onPress=\{\(\) => setPainting\(familyTarget\(slug\)\)\} \/>/)
    assert.equal(page.paintable('Input 1'), false)
    assert.equal(page.paintable('drive2'), true)
    /* The preset is named the same way at both ends: "012 Lead Rig". */
    for (const f of ['src/App.jsx', 'mobile/src/components/Colours.js', 'mobile/src/components/RenamePreset.js']) {
      assert.match(read(f), /words: `\$\{slotLabel\(preset\.number, [^)]+\)\} \$\{presetLabel\(preset\)\}`/, `${f} names the loaded preset some other way`)
    }
    /* And both sheets paint, and change between every preset and this one, by the same rule. */
    for (const f of ['src/components/ColourSheet.jsx', 'mobile/src/components/ColourSheet.js']) {
      const sheet = read(f)
      assert.match(sheet, /paint\(target, fill, \{ only \}/, `${f} paints in some other presets`)
      assert.match(sheet, /setBase\(colourNow\(target, \{ only: to \}\)\)/, `${f} does not show the colour the presets chosen have`)
      assert.match(sheet, /\{SCOPE_WORDS\.every\}|label=\{SCOPE_WORDS\.every\}/, `${f} does not offer every preset`)
      assert.match(sheet, /\{SCOPE_WORDS\.only\}<\/span> <span className="colour-scope-which">\{target\.preset\.words\}|label=\{SCOPE_WORDS\.only\} sub=\{target\.preset\.words\}/, `${f} does not offer just this preset, named`)
      assert.match(sheet, /target\.kind === 'scene' && target\.preset \?|const choosing = !!target && target\.kind === 'scene' && !!target\.preset[\s\S]*\{choosing \? \(/, `${f} offers the choice where there is no preset to make it about`)
    }
  })

  test('the web unlock page says what the phone paywall says, word for word', () => {
    /*
     * "I do not like the way that you write copy." So the browser's unlock
     * page has none of mine: every sentence on it is the phone paywall's.
     * This holds them together, so rewording one end without the other fails.
     */
    const web = read('src/App.jsx')
    /* Written once and drawn twice — the Unlock page and the screen an unpaid
       phone sees instead of connecting — so the words are read where they are. */
    assert.match(web, /setupPage === 'unlock' \? \([\s\S]{0,400}\{unlockBody\}/, 'the Unlock page no longer draws the paywall’s words')
    assert.match(web, /\{mustPay \? \([\s\S]{0,600}\{unlockBody\}/, 'the unpaid phone’s screen no longer draws the paywall’s words')
    const page = web.slice(web.indexOf('const unlockBody = ('), web.indexOf('{mustPay ? ('))
    const phone = read('mobile/src/screens/Paywall.js')
    const norm = (t) => t.replace(/&rsquo;/g, '’').replace(/&amp;/g, '&').replace(/\s+/g, ' ')
    for (const line of [
      'Phone Remote',
      'One-time payment unlocks the full version of this app, forever, including all future updates, on all supported Fractal devices:',
      'Sign in with the same account on another phone or tablet and it is unlocked there too.',
      'You’ll be able to control and switch presets, scenes, amp & effects blocks, tuner, tap tempo, setlists, and so much more.',
      'Unlock Full Version — ${'
    ]) {
      assert.ok(norm(phone).includes(line), `the phone paywall no longer says: ${line}`)
      assert.ok(norm(page).includes(line), `the web unlock page does not say what the phone says: ${line}`)
    }
    /*
     * AND WHAT A VP4 GETS OF THAT LIST, under it at both ends, from one
     * sentence. "I didn't know that those settings didn't work on the VP4 ...
     * we need to put that in there for now." The VP4 is named above among the
     * units this unlocks, so the line comes with it; shared/vp4-safety.mjs
     * words it, and test/vp4-safety.mjs holds the words to what the app does.
     */
    assert.match(phone, /import \{ VP4_SO_FAR \} from '\.\.\/lib\/vp4-safety'/, 'the phone paywall does not take its VP4 line from the shared rule')
    assert.match(web, /import \{ VP4_SO_FAR \} from '\.\.\/shared\/vp4-safety\.mjs'/, 'the web unlock page does not take its VP4 line from the shared rule')
    assert.match(phone, /and so much more\.\s*<\/Text>[\s\S]{0,1200}?<Text[^>]*>\s*\{VP4_SO_FAR\}\s*<\/Text>\s*<\/View>/, 'the phone paywall does not say what a VP4 gets, under the list of what the app does')
    assert.match(page, /and so much more\.\s*<\/p>[\s\S]{0,300}?<p className="hint">\{VP4_SO_FAR\}<\/p>/, 'the web unlock page does not say what a VP4 gets, under the list of what the app does')
    /* The Setup row is the phone's row, word for word. */
    const settings = read('mobile/src/screens/Settings.js')
    assert.match(settings, /title="Unlock the full version"/, 'the phone renamed its unlock row')
    assert.match(web, /title="Unlock the full version"/, 'the web unlock row is named differently from the phone’s')
    assert.ok(settings.includes('`Drive a real rig · ${purchase.price}`') && web.includes('`Drive a real rig · ${webPriceText}`'), 'the unlock row’s price line differs between the two ends')
  })

  test('a web purchase belongs to the account, and cannot take real money by accident', () => {
    const src = read('src/lib/webPurchase.js')
    /*
     * FILED UNDER THE ACCOUNT. appUserId is the signed-in account's id — the
     * same id the phone gives RevenueCat's logIn — which is the whole reason a
     * card taken in a browser unlocks the phone.
     */
    assert.match(src, /Purchases\.configure\(\{ apiKey: WEB_KEY, appUserId: accountId \}\)/, 'the web purchase is not filed under the account')
    const app = read('src/App.jsx')
    assert.match(app, /const accountId = link\.account\?\.id \|\| null/, 'the web unlock does not take the signed-in account’s id')
    assert.match(src, /if \(!accountId\) return \{ ok: false/, 'a purchase can be made with no account to belong to')

    /* The package by product id, as on the phone — first-wins could sell a
       subscription on a page that says "One-time payment". */
    assert.match(src, /p\?\.webBillingProduct\?\.identifier === PRODUCT_ID/, 'the web picks a package by position')
    assert.match(src, /export const PRODUCT_ID = 'cloud\.newbold\.fractalremote\.full'/, 'the web sells a different product id from the phones')

    /*
     * THE LIVE KEY, BECAUSE HE SAID SO. It shipped on sandbox until the
     * checkout had been walked through: "Payment on web working. You can go
     * ahead and set it live instead of the sandbox." Which key it is stays
     * written down here, on purpose, so going back to test cards is a
     * decision somebody makes rather than a default that drifts.
     */
    assert.match(src, /export const WEB_KEY = PRODUCTION_KEY/, 'the web checkout is on test cards; if that was meant, change this check with it')
    assert.match(src, /const PRODUCTION_KEY = 'rcb_(?!sb_)/, 'the live key is a sandbox key')
    assert.match(src, /const SANDBOX_KEY = 'rcb_sb_/, 'the sandbox key is not a sandbox key')

    /* Loaded only when there is a price to show: nobody driving their own rig downloads Stripe. */
    assert.match(src, /await import\('@revenuecat\/purchases-js'\)/, 'the payment library is loaded for everybody')
    assert.ok(!/^import .*@revenuecat\/purchases-js/m.test(src), 'the payment library is in the main bundle')

    /* And the row is only offered to somebody who can use it. */
    /* To anybody who has not paid, signed in or not, as on the phone — the
       sign-in, or the new account, comes on the way to the unlock page. */
    /* On the Account page now, with signing in, as on the phone. */
    assert.match(app, /\{paid\.checked && !paid\.unlocked \? \(\s*<div className="setup-rows">\s*<SetupRow\s*key="unlock"[\s\S]{0,260}onClick=\{openUnlock\}/, 'the unlock row hides from somebody signed out, or skips the sign-in')
  })

  /*
   * PAID TWICE, AND WHAT THE WEBSITE DOES SO IT IS NOT ASKED AGAIN.
   *
   * A customer bought the unlock on his iPhone before he had an account. He
   * made the account on the website, the website truthfully heard "not paid"
   * — the phone's purchase was on no account until the phone signed in, two
   * minutes later — and it sold him the unlock again by card.
   *
   * These run webPurchase.js itself, not a description of it: the file with
   * its two imports pointed at stand-ins for the server's session and for
   * RevenueCat's library, written beside it.
   */
  const webPurchase = async (tweak = (src) => src) => {
    const dir = mkdtempSync(join(tmpdir(), 'webbuy-'))
    const src = tweak(read('src/lib/webPurchase.js'))
      .replace("from './remote'", "from './remote.mjs'")
      .replace("import('@revenuecat/purchases-js')", "import('./purchases-js.mjs')")
    assert.doesNotMatch(src, /from '\.\/remote'|import\('@revenuecat/, 'webPurchase.js imports something new; these stand-ins no longer cover it')
    writeFileSync(
      join(dir, 'remote.mjs'),
      `export const DEFAULT_PROJECT = { url: 'https://project.test', anonKey: 'anon' }
       export const supabaseClient = () => ({ auth: { getSession: async () => ({ data: { session: globalThis.__webSession } }) } })`
    )
    /* RevenueCat's own numbers for the two errors, checked against its own file below. */
    writeFileSync(
      join(dir, 'purchases-js.mjs'),
      `export const ErrorCode = { UserCancelledError: 1, ProductAlreadyPurchasedError: 6 }
       export const Purchases = {
         configure: ({ appUserId }) => globalThis.__webRevenueCat(appUserId),
         generateRevenueCatAnonymousAppUserId: () => '$RCAnonymousID:visitor'
       }`
    )
    writeFileSync(join(dir, 'webPurchase.mjs'), src)
    const mod = await import(pathToFileURL(join(dir, 'webPurchase.mjs')).href)
    return { mod, done: () => rmSync(dir, { recursive: true, force: true }) }
  }
  const reply = (status, body) => async () =>
    new Response(typeof body === 'string' ? body : JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
  const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms))

  test('a fault from the server is never read as “not paid” on the website or the computer', async () => {
    const { mod, done } = await webPurchase()
    const realFetch = globalThis.fetch
    try {
      const ask = (answer) => {
        globalThis.fetch = answer
        return mod.checkUnlocked()
      }
      globalThis.__webSession = { access_token: 'token' }
      assert.deepEqual(await ask(reply(200, { unlocked: true })), { unlocked: true, unknown: false })
      assert.deepEqual(await ask(reply(200, { unlocked: false })), { unlocked: false, unknown: false }, 'a real no is no longer a no')
      assert.deepEqual(await ask(reply(200, { unlocked: true, unknown: true })), { unlocked: true, unknown: true }, 'the server’s own “could not ask” is lost')
      /*
       * Every one of these used to come out a definite "not paid" — and the
       * browser on a phone puts the $9.99 page in front of a definite no.
       */
      for (const [what, answer] of [
        ['an error page', reply(502, '<html>Bad gateway</html>')],
        ['an error that says no', reply(500, { unlocked: false })],
        ['a session the server no longer knows', reply(401, { unlocked: false, why: 'signed out' })],
        ['a reply that is not JSON', reply(200, 'Service Unavailable')],
        ['a reply with no answer in it', reply(200, {})],
        ['an answer that is not a yes or a no', reply(200, { unlocked: 'no' })],
        ['no reply at all', async () => { throw new TypeError('Failed to fetch') }]
      ]) {
        assert.deepEqual(await ask(answer), { unlocked: false, unknown: true }, `${what} reads as a definite “not paid”`)
      }
      /* Nobody signed in is still a plain no, and nothing is asked. */
      let asked = 0
      globalThis.__webSession = null
      assert.deepEqual(await ask(async () => { asked += 1; return reply(200, { unlocked: true })() }), { unlocked: false, unknown: false })
      assert.equal(asked, 0, 'the server is asked about nobody')
    } finally {
      globalThis.fetch = realFetch
      delete globalThis.__webSession
      done()
    }
  })

  test('the website asks RevenueCat itself before the card, and takes none from somebody who has it, or when it cannot ask', async () => {
    /* The stand-in's error numbers are RevenueCat's own. */
    const types = read('node_modules/@revenuecat/purchases-js/dist/Purchases.es.d.ts')
    assert.match(types, /UserCancelledError = 1,/)
    assert.match(types, /ProductAlreadyPurchasedError = 6,/)
    assert.match(types, /getCustomerInfo\(\): Promise<CustomerInfo>;/, 'the web library no longer has getCustomerInfo')

    const { mod, done } = await webPurchase()
    const realFetch = globalThis.fetch
    const now = { owned: false, cannotAsk: false, checkout: null }
    let checkouts = 0
    let told = 0
    try {
      globalThis.__webSession = { access_token: 'token' }
      globalThis.fetch = async () => {
        told += 1
        return reply(200, { unlocked: true })()
      }
      globalThis.__webRevenueCat = () => ({
        getOfferings: async () => ({ current: { availablePackages: [{ webBillingProduct: { identifier: mod.PRODUCT_ID } }] }, all: {} }),
        getCustomerInfo: async () => {
          if (now.cannotAsk) throw new Error('Network error')
          return { entitlements: { active: now.owned ? { full: { isActive: true } } : {} } }
        },
        purchase: async () => {
          checkouts += 1
          return now.checkout()
        }
      })
      const buy = () => mod.buyOnWeb({ accountId: 'account-1', email: 'a@x.com' })
      const yes = { ok: true, cancelled: false, message: null }
      /* Found bought already: unlocked, nothing taken, and said so — the page unlocks and goes. */
      const had = { ok: true, cancelled: false, message: 'You already have the full version, so nothing was charged.' }
      assert.equal(mod.ALREADY_HAD, had.message)

      /* Bought on a phone that has signed in, or a gift: no checkout at all, and the server is told. */
      now.owned = true
      assert.deepEqual(await buy(), had, 'somebody who has it is not told nothing was charged')
      assert.equal(checkouts, 0, 'the checkout opened for somebody RevenueCat says has it')
      await tick(5)
      assert.ok(told >= 1, 'the server is not told, so its table stays behind')

      /* RevenueCat cannot be asked: no money, and a plain reason. */
      now.owned = false
      now.cannotAsk = true
      assert.deepEqual(await buy(), { ok: false, cancelled: false, message: 'Couldn’t check your purchase just now. Try again in a moment.' })
      assert.equal(checkouts, 0, 'a card is taken without knowing whether this account has it')

      /* Not bought: the checkout, once. */
      now.cannotAsk = false
      now.checkout = async () => ({ customerInfo: { entitlements: { active: { full: { isActive: true } } } } })
      assert.deepEqual(await buy(), yes)
      assert.equal(checkouts, 1, 'somebody who has not bought it cannot buy it')

      /* The checkout itself saying "already bought" is bought, not a fault. */
      now.checkout = async () => {
        throw Object.assign(new Error('Product already purchased'), { errorCode: 6 })
      }
      assert.deepEqual(await buy(), had, 'RevenueCat’s “already bought” shows as an error, or unlocks without saying nothing was charged')
      now.checkout = async () => {
        throw Object.assign(new Error('Cancelled'), { errorCode: 1 })
      }
      assert.deepEqual(await buy(), { ok: false, cancelled: true, message: null })
      now.checkout = async () => {
        throw new Error('Your card was declined.')
      }
      assert.deepEqual(await buy(), { ok: false, cancelled: false, message: 'Your card was declined.' }, 'an error with no code reads as bought or as cancelled')

      /*
       * And a payment library that would not load at all — a lost download on
       * a bad connection. Its error has no code and there are no codes to
       * match it against, and nothing matched nothing: it read as a silent
       * cancel, or as already bought, which unlocked the page with nothing paid.
       */
      const broken = await webPurchase((src) => src.replace("import('@revenuecat/purchases-js')", "import('./not-there.mjs')"))
      try {
        const out = await broken.mod.buyOnWeb({ accountId: 'account-1', email: 'a@x.com' })
        assert.equal(out.ok, false, 'a library that would not load reads as bought')
        assert.equal(out.cancelled, false, 'a library that would not load reads as a cancel, and says nothing')
        assert.ok(typeof out.message === 'string' && out.message.length > 0, 'a library that would not load says nothing')
      } finally {
        broken.done()
      }
    } finally {
      globalThis.fetch = realFetch
      delete globalThis.__webSession
      delete globalThis.__webRevenueCat
      done()
    }
  })

  test('the website says nothing was charged when Buy finds the account has it, after the page has gone', () => {
    /*
     * Buy finding it bought already unlocks the page and puts it away. Said
     * on the page, it went with it; said nowhere, somebody who had just
     * pressed the price and watched it unlock believed he was charged again.
     */
    const app = read('src/App.jsx').replace(/\s+/g, ' ')
    assert.match(app, /const out = await buyOnWeb\(\{ accountId, email: link\.account\?\.email \}\) setBuying\(false\) if \(out\.ok\) return nowUnlocked\(out\.message\)/, 'what Buy found is thrown away')
    assert.match(app, /const nowUnlocked = async \(said = null\) => \{ setPaid\(\{ checked: true, unlocked: true, for: accountId \}\) if \(said\) setPaidSaid\(said\)/)
    /* Through the reload that ends the demo, too. */
    assert.match(app, /if \(isDemo\(\)\) \{ if \(said\) \{ try \{ sessionStorage\.setItem\(PAID_SAID, said\) \}/, 'the demo’s reload loses “nothing was charged”')
    assert.match(app, /const said = sessionStorage\.getItem\(PAID_SAID\) sessionStorage\.removeItem\(PAID_SAID\) return said \|\| null/)
    /* Drawn outside every page, so the page going does not take it with it. */
    const notice = app.indexOf('{paidSaid ? ( <div className="notice" data-kind="did" role="status"> <h2>{paidSaid}</h2>')
    assert.ok(notice > app.indexOf('{mustPay ? ('), 'the line is drawn inside a page that goes when it unlocks')
    assert.ok(notice < app.indexOf('{justDid ? ('), 'the line is not with the other things said outside the pages')
    /* The asking that finds a phone's purchase is not Buy, and says nothing of a charge. */
    assert.match(app, /return askUntilUnlocked\(nowUnlocked, ask\)/)
    assert.match(read('src/lib/webPurchase.js'), /if \(out\?\.unlocked === true && !out\.unknown\) \{\s*stop\(\)\s*onYes\(\)/, 'the asking hands its own answer on as something Buy said')
  })

  test('the unlock page asks again until a phone has signed in: often at first, never while hidden, and only a yes ends it', async () => {
    /* Quick, so the test does not wait on the real seconds; it has to have changed. */
    const { mod, done } = await webPurchase((src) => {
      const quick = src
        .replace(/const ASK_FAST_MS = \d+/, 'const ASK_FAST_MS = 10')
        .replace(/const ASK_SLOW_MS = \d+/, 'const ASK_SLOW_MS = 5000')
        .replace(/const FAST_FOR_MS = [^\n]+/, 'const FAST_FOR_MS = 80')
      assert.match(quick, /ASK_FAST_MS = 10\n[\s\S]*ASK_SLOW_MS = 5000\n[\s\S]*FAST_FOR_MS = 80\n/, 'how often it asks could not be shortened, so this is not testing it')
      return quick
    })
    const real = read('src/lib/webPurchase.js')
    assert.match(real, /const ASK_FAST_MS = 5000\n/, 'the first two minutes are not every five seconds')
    assert.match(real, /const ASK_SLOW_MS = 30000\n/, 'after that is not every thirty seconds')
    assert.match(real, /const FAST_FOR_MS = 2 \* 60 \* 1000\n/, 'the quick asking does not last two minutes')

    const was = { window: Object.getOwnPropertyDescriptor(globalThis, 'window'), document: Object.getOwnPropertyDescriptor(globalThis, 'document') }
    const heard = { window: {}, document: {} }
    const target = (bag) => ({
      addEventListener: (kind, fn) => (bag[kind] = bag[kind] || new Set()).add(fn),
      removeEventListener: (kind, fn) => bag[kind]?.delete(fn)
    })
    const fire = (bag, kind) => [...(bag[kind] || [])].forEach((fn) => fn())
    const listening = () => [...Object.values(heard.window), ...Object.values(heard.document)].reduce((n, set) => n + set.size, 0)
    globalThis.window = target(heard.window)
    globalThis.document = { ...target(heard.document), visibilityState: 'visible' }
    /* Every one started is stopped at the end, so a failed check cannot leave one asking for ever. */
    const started = []
    const start = (onYes, ask) => {
      const stop = mod.askUntilUnlocked(onYes, ask)
      started.push(stop)
      return stop
    }
    try {
      let answer = { unlocked: false, unknown: false }
      let asks = 0
      const ask = async () => {
        asks += 1
        return answer
      }

      /* Every few moments at first, then hardly at all. */
      let yeses = 0
      let stop = start(() => (yeses += 1), ask)
      await tick(70)
      const early = asks
      assert.ok(early >= 2, `it asked ${early} times in its quick first stretch`)
      await tick(250)
      assert.ok(asks - early <= 2, `it went on asking ${asks - early} more times once the quick stretch was over`)
      /* Coming back to the window asks at once. */
      const before = asks
      fire(heard.window, 'focus')
      await tick()
      assert.equal(asks, before + 1, 'coming back to the window does not ask straight away')
      /* A definite yes ends it, once, and it stops listening. */
      answer = { unlocked: true, unknown: false }
      fire(heard.window, 'focus')
      await tick()
      assert.equal(yeses, 1, 'a yes does not unlock the page')
      assert.equal(listening(), 0, 'it goes on listening after the yes')
      const after = asks
      fire(heard.window, 'focus')
      await tick(30)
      assert.equal(asks, after, 'it goes on asking after the yes')
      stop()

      /* The server's "could not ask RevenueCat" is not a purchase to act on. */
      asks = 0
      answer = { unlocked: true, unknown: true }
      yeses = 0
      stop = start(() => (yeses += 1), ask)
      await tick(40)
      assert.equal(yeses, 0, 'the server failing open reads as bought')
      assert.ok(asks >= 2, 'it stopped asking after an answer that was not one')
      stop()
      assert.equal(listening(), 0, 'stopping leaves it listening')
      const stopped = asks
      await tick(40)
      assert.equal(asks, stopped, 'stopping does not stop it')

      /* Hidden, it asks nothing; shown again, it asks at once. */
      answer = { unlocked: false, unknown: false }
      asks = 0
      globalThis.document.visibilityState = 'hidden'
      stop = start(() => {}, ask)
      await tick(50)
      fire(heard.window, 'focus')
      await tick()
      assert.equal(asks, 0, 'it asks while nobody can see the page')
      globalThis.document.visibilityState = 'visible'
      fire(heard.document, 'visibilitychange')
      await tick()
      assert.equal(asks, 1, 'showing the page again does not ask straight away')
      /* Hidden again part way through: the next turn does not come. */
      globalThis.document.visibilityState = 'hidden'
      fire(heard.document, 'visibilitychange')
      await tick(50)
      assert.equal(asks, 1, 'it keeps asking once the page is hidden')
      stop()

      /* The focus and the visibility change that come together are one question, not two. */
      globalThis.document.visibilityState = 'visible'
      asks = 0
      let answerNow = null
      const slow = () => {
        asks += 1
        return new Promise((r) => (answerNow = () => r({ unlocked: false, unknown: false })))
      }
      stop = start(() => {}, slow)
      fire(heard.window, 'focus')
      fire(heard.document, 'visibilitychange')
      await tick()
      assert.equal(asks, 1, 'two questions are in flight at once')
      answerNow()
      stop()

      /*
       * A question in flight when the asking is stopped — Buy opened the
       * checkout, or the page was put away — that then comes back yes: nothing
       * is done over a page that is gone. Done, it would reload the demo under
       * RevenueCat's open checkout, or close the computer's sheet.
       */
      let lateYeses = 0
      let answerLate = null
      const late = () => new Promise((r) => (answerLate = () => r({ unlocked: true, unknown: false })))
      stop = start(() => (lateYeses += 1), late)
      fire(heard.window, 'focus')
      await tick()
      assert.ok(answerLate, 'the bench never put a question')
      stop()
      answerLate()
      await tick(5)
      assert.equal(lateYeses, 0, 'a yes that came back after the asking stopped still acted on the page')
    } finally {
      for (const stop of started) stop()
      for (const name of ['window', 'document']) {
        if (was[name]) Object.defineProperty(globalThis, name, was[name])
        else delete globalThis[name]
      }
      done()
    }
  })

  test('an owner on the website or the computer never reaches an enabled Buy, and the unlock page says how a phone purchase gets there', () => {
    const app = read('src/App.jsx')
    /*
     * The page waits on the phone: named once and asked about while it is up
     * (a name, so test/structure.mjs still finds each screen by its own
     * conditional), never while a checkout is open over it, and on a yes it
     * does exactly what buying does.
     */
    assert.match(app, /const unlockOnScreen = mustPay \|\| \(sheet === 'settings' && setupPage === 'unlock'\)/, 'the asking does not follow the unlock page')
    assert.match(
      app,
      /if \(!unlockOnScreen \|\| !accountId \|\| ownedSure \|\| buying\) return undefined[\s\S]{0,400}return askUntilUnlocked\(nowUnlocked, ask\)/,
      'the unlock page no longer asks again while it is up, or asks while a checkout is open'
    )
    /* Held back on "could not ask", it asks too, and a definite no gives Buy back. */
    assert.match(
      app,
      /if \(!out\.unknown && !out\.unlocked\) \{\s*setPaid\(\(p\) => \(p\.for === accountId && p\.unknown \? \{ checked: true, unlocked: false, unknown: false, for: accountId \} : p\)\)/,
      'a page held back on a question that could not be put stays held after a definite no'
    )
    assert.match(app, /if \(out\.ok\) return nowUnlocked\(out\.message\)/, 'buying and being found to have bought lead different places')

    /* The Unlock card, the bar and Settings' row all come through openUnlock: an owner goes to the account. */
    assert.match(app, /setSetupPage\(ownedSure \? 'account' : 'unlock'\)/, 'an owner who presses Unlock is shown the Buy button, or a fault is sent to “unlocked”')
    /*
     * The server's "could not ask RevenueCat" counts as owned for holding Buy
     * back, and never as being told they have it: every "nothing more to
     * pay" goes by a definite answer.
     */
    assert.match(app, /const ownedSure = owned && !paid\.unknown/, 'the server failing open reads as having paid')
    assert.match(app, /'Full version — the phone remote is unlocked\.'/, 'the account page no longer says it is unlocked')

    const body = app.slice(app.indexOf('const unlockBody = ('), app.indexOf('{mustPay ? ('))
    assert.match(body, /disabled=\{buying \|\| !accountId \|\| owned\}/, 'Buy can be pressed by somebody who has it')
    const line = body.indexOf('Bought it on your phone or tablet? Don&rsquo;t pay again. Open the app there and sign in with')
    assert.ok(line > 0 && line < body.indexOf('className="primary unlock-buy"'), 'the words about a phone purchase are not above Buy')
    assert.match(
      body,
      /\) : signedInHere \? \(\s*<p className="hint unlock-phone">[\s\S]{0,140}sign in with\{' '\}\s*<strong>\{link\.account\.email\}<\/strong> — this page unlocks by itself as soon as you do\./,
      'the page does not say which email to sign in with on the phone'
    )
    assert.match(body, /\{ownedSure \? \(\s*<p className="hint">This account has the full version already\. There is nothing more to pay\.<\/p>/, 'a greyed Buy is not explained, or a fault is called paid')
    assert.match(
      body,
      /\) : owned \? \(\s*<p className="hint">Couldn&rsquo;t check your purchase just now, so Buy is off for a moment\. This page asks again by itself\.<\/p>/,
      'Buy held back on a question that could not be put is not explained'
    )
    assert.match(
      body.replace(/\s+/g, ' '),
      /as soon as you do\. If the app there is signed in with a different email, sign in here with that one instead\./,
      'a phone signed in with another email is sent to sign in with this one, which moves nothing'
    )

    /* The walkthrough's phone-remote card knows, and carries an owner on to setting up. */
    assert.match(app, /<PhoneWalkthrough[\s\S]{0,1600}paid=\{ownedSure\}/, 'the walkthrough is never told who has paid, or says “nothing more to pay” on a fault')
    const walk = read('src/components/PhoneWalkthrough.jsx').replace(/\s+/g, ' ')
    assert.match(walk, /\{paid \? OWNED\.body : computer \? C3\.phone\.body : P3\.real\.body\}/, 'the card still sells to an owner')
    assert.match(
      walk,
      /\{paid \? \( <button type="button" className="chip pw-go" onClick=\{\(\) => leave\(onAccount\)\}> \{computer \? OWNED\.computerGo : OWNED\.phoneGo\} <\/button> \) : \(/,
      'an owner is not carried on to setting up'
    )
    const ownerCard = walk.slice(walk.indexOf('{paid ? ( <button'), walk.indexOf(') : ( <> <label className="pw-agree">'))
    assert.ok(ownerCard.length > 0 && !/onUnlock/.test(ownerCard), 'the owner’s card can still open the unlock')

    /* And "hasn't unlocked yet" is said on a definite answer only. */
    assert.match(app, /paid=\{answeredFor && !paid\.unknown \? paid\.unlocked : null\}/, 'the computer’s steps say “hasn’t unlocked” on a fault')

    /* Signed out, the sign-in on the way to the unlock says which email to use. */
    assert.match(app, /forUnlock=\{unlockAfterSignIn\}/, 'the sign-in is not told it is on the way to the unlock')
    const sheet = read('src/components/SignInSheet.jsx')
    /*
     * Which email, for either side of the form — and for a phone with no
     * account yet, the one it will sign in with: the buyer this was written
     * for had used none on the phone, and could not sign in there before
     * the account he was making here existed.
     */
    assert.match(
      sheet,
      /\{forUnlock \? \(\s*<p className="hint">\s*\{side === 'sent'\s*\? 'Bought it on your phone or tablet already\? Don’t pay again here\. Once you’ve confirmed the account, sign in with this email there, and this unlocks by itself\.'\s*: making\s*\? 'Bought it on your phone or tablet already\? Don’t pay again here\. Make the account with the email you’ll use there, then sign in with it there, and this unlocks by itself\.'\s*: 'Bought it on your phone or tablet already\? Don’t pay again here\. Sign in with the same email you use in the app there\. If the app there isn’t signed in yet, sign in there too, and this unlocks by itself\.'\}\s*<\/p>\s*\) : null\}\s*<SignIn/,
      'the sign-in on the way to the unlock does not say which email to use'
    )
    /*
     * Said as "don't pay", and never as a step before paying: "…on the
     * phone before you pay here" read, to somebody who had paid on the
     * phone, as sign in there and then pay here. And once the account is
     * made, the line is about the phone, not about making the account.
     */
    const lines = [...sheet.matchAll(/'(Bought it on your phone or tablet already\?[^']*)'/g)].map((m) => m[1])
    assert.equal(lines.length, 3, 'one line for each side of the form: making, made, signing in')
    for (const line of lines) {
      assert.match(line, /^Bought it on your phone or tablet already\? Don’t pay again here\./, `the line does not say not to pay first: ${line}`)
      assert.ok(!/before you pay|pay here\./.test(line.replace('Don’t pay again here.', '')), `the line reads as an order to pay here after the phone: ${line}`)
    }
    assert.ok(!/Make the account/.test(lines[0]), 'once the account is made, the line still says to make it')
    const plain = sheet.slice(sheet.indexOf('if (account) {'), sheet.indexOf('  return (\n    <Sheet\n'))
    assert.ok(plain.includes('{forUnlock ? ('), 'the line is not on the plain sign-in the unlock opens')
  })

  test('deleting the account never promises a website purchase comes back, here, on the phone or in the privacy policy', () => {
    /*
     * Deleting the account deletes the RevenueCat customer named after it.
     * A store purchase comes back with Restore, because Apple or Google still
     * holds the receipt; a card purchase on the website, or a gift, has no
     * receipt anywhere else, and goes. The website said it "stays with the
     * account you paid with, and Restore a purchase brings it back" — to the
     * very people who paid by card, who would make the account again and be
     * sold it again.
     */
    const app = read('src/App.jsx').replace(/\s+/g, ' ')
    const sheet = app.slice(app.indexOf('aria-label="Delete account"'), app.indexOf('Delete my account'))
    assert.ok(sheet.length > 0, 'the website’s Delete account moved; this check reads it')
    assert.match(sheet, /A full version bought in the App Store or on Google Play stays with that Apple ID or Google account, and Restore a purchase in the app on your phone or tablet brings it back on a new account\. One bought with a card on the website or in the computer app, or given to you, belongs to this account and goes with it for good\./, 'the website promises a card purchase survives deleting the account')
    assert.ok(!/stays with the account you paid with/.test(app), 'the old promise is still on the website')

    const policy = read('public/privacy.html').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')
    const deleting = policy.slice(policy.indexOf('Deleting your data'), policy.indexOf('Children'))
    assert.match(deleting, /A full version bought in the App Store or on Google Play stays with your Apple ID or Google account, and Restore a purchase brings it back on a new account\. One bought on the website or in the computer app, or given to you, belongs to the account and is deleted with it\./, 'the privacy policy promises every purchase survives deleting the account')
  })

  /**
   * THE DEMO'S BAR SAYS UNLOCK AND THE PRICE, IN THE BROWSER AS ON THE PHONE.
   *
   * "When someone's on the demo, it should always say unlock, and then the
   * price at the top? Otherwise, how's a user supposed to know how to go to
   * settings to sign in?"
   *
   * The phone has had it since the demo could be bought from; the browser
   * said DEMO and sent people to a page about the phone app, because at the
   * time a browser could not take a card. It can now, so the two bars say the
   * same thing: UNLOCK and the price for somebody who has not paid, DEMO and
   * Exit demo for somebody who has.
   */
  test('the demo bar says unlock and the price in the browser, as on the phone', () => {
    const bar = read('src/components/TopBar.jsx')
    const phone = read('mobile/src/components/TopBar.js')

    /* The same rule at both ends: the word is UNLOCK only while there is
       something to sell this person. */
    assert.match(phone, /const word = canBuy \? 'unlock' : demo \? 'demo'/, 'the phone bar stopped saying unlock in the demo')
    assert.match(bar, /const canBuy = demo && Boolean\(onUnlock\)/, 'the browser bar offers the unlock outside the demo')
    assert.match(bar, /\? canBuy\s*\? 'unlock'\s*: 'demo'/, 'the browser bar does not say unlock in the demo')

    /* The word and the pill both go to the unlock, and the pill is the price. */
    assert.match(bar, /onClick=\{onUnlock\}[\s\S]*?aria-label="Unlock the full version"/, 'UNLOCK does not open the unlock')
    assert.match(bar, /\{canBuy && unlockPrice \? \(/, 'the price pill is not drawn beside UNLOCK')
    assert.match(bar, /<span className="topbar-pill-face">\{unlockPrice\}<\/span>/, 'the pill says something other than the price')

    /* His words for the way out, and only for somebody who has paid. */
    assert.match(bar, /<span className="topbar-pill-face">Exit demo<\/span>/, 'Exit demo is missing from the browser bar')

    const app = read('src/App.jsx')
    assert.match(
      app,
      /onUnlock=\{isDemo\(\) && paid\.checked && !paid\.unlocked \? openUnlock : null\}/,
      'the browser bar offers the unlock to somebody who has paid, or outside the demo'
    )
    assert.match(app, /onExitDemo=\{isDemo\(\) && paid\.unlocked \?/, 'Exit demo is offered to somebody who has not paid')

    /*
     * Signed out, the unlock asks for the sign-in first and then lands on the
     * unlock page by itself — the whole point of the request is that nobody
     * has to find Settings. And not for somebody who turns out to have paid.
     */
    assert.match(app, /setUnlockAfterSignIn\(true\)[\s\S]{0,300}setSignInStart\('up'\)\s*setSignIn\('account'\)/, 'signed out, UNLOCK does not ask for the sign-in')

    /*
     * And that sign-in is the plain one. On the website the demo takes the
     * computer's role, whose own sign-in turns the phone remote on through a
     * helper a website does not have — it failed every time. "There's
     * actually no place to even sign in anywhere on the web app."
     */
    assert.match(app, /if \(signIn === 'account'\) \{\s*await signInAccount\(/, 'the unlock’s sign-in sets up a phone remote instead of signing in')
    const link = read('src/lib/link.js')
    const plain = link.slice(link.indexOf('export async function signInAccount'), link.indexOf('export async function reconnectPhone'))
    assert.ok(plain.length > 0 && !/join\(|turnOnMac|autoConnect/.test(plain), 'the plain sign-in has an errand attached again')

    /* The phone's Setup has a way in from the demo; so does the browser's, in the phone's words. */
    assert.match(read('mobile/src/screens/Settings.js'), /label="Sign in with an email and password"/, 'the phone lost its sign-in button')
    assert.match(
      app,
      /\{setupPage === 'account' \? \([\s\S]{0,900}'Not signed in on this device\.'[\s\S]{0,2500}Sign out on this device[\s\S]{0,700}setSignIn\('account'\)[\s\S]{0,120}Sign in with an email and password/,
      'the browser’s Setup has no way to sign in from the demo'
    )
    assert.match(app, /paid\.for !== accountId/, 'the unlock page can open on the signed-out answer, before the new account’s is in')
    assert.match(app, /if \(paid\.unlocked\) return\s*setSheet\('settings'\)\s*setSetupPage\('unlock'\)/, 'somebody who has paid is sent to the unlock page after signing in')

    /* The price reaches somebody not signed in; the purchase still does not. */
    const buy = read('src/lib/webPurchase.js')
    assert.match(buy, /purchasesFor\(accountId \|\| \(await visitorId\(\)\)\)/, 'the demo cannot show the price before a sign-in')
    assert.match(buy, /generateRevenueCatAnonymousAppUserId\(\)/, 'the visitor id is invented here rather than asked of RevenueCat')
    const buyer = buy.slice(buy.indexOf('export async function buyOnWeb'))
    assert.ok(!/visitorId/.test(buyer), 'a purchase can be filed under an anonymous visitor')

    /* And buying in the demo ends it, as on the phone. */
    assert.match(app, /if \(isDemo\(\)\) \{\s*(?:if \(said\) \{[\s\S]{0,300}?\}\s*)?setDemo\(false\)\s*window\.location\.reload\(\)/, 'buying in the browser leaves the person in the demo')
  })

  /**
   * THE BROWSER ON A PHONE PLAYS BY THE PHONE'S RULES.
   *
   * "We need to make sure we're on the same page as far as what the app does
   * and what the web app does… Everything's chaos." A play-through of both
   * found the browser acting as a phone breaking three of the phone's rules:
   * it connected for somebody who had not paid, it offered "Try the Demo" to
   * somebody who had, and when nothing answered it never said which account
   * it was on — which was the whole of why it did not connect that night.
   */
  test('the browser acting as a phone plays by the phone’s rules', () => {
    const app = read('src/App.jsx')
    const phoneRule = read('mobile/src/lib/unlock-rule.js')

    /* Not paid: the unlock first, as the phone's shouldAskToPay does — and
       only on a definite no, as the phone fails open. */
    assert.match(phoneRule, /export const shouldAskToPay/, 'the phone’s paywall rule moved; this check follows it')
    assert.match(
      app,
      /const mustPay = Boolean\(link\.role === 'remote' && !isDemo\(\) && answeredFor && !paid\.unlocked && !paid\.unknown\)/,
      'the browser on a phone drives a rig for somebody who has not paid, or shuts out somebody the server could not answer for'
    )
    assert.match(app, /unknown: out\.unknown/, 'a question the server could not answer is read as a no')

    /* Paid: "Demo", never "Try the Demo". */
    const connect = read('src/components/ConnectScreen.jsx')
    assert.match(connect, /\{owned \? 'Demo' : 'Try the Demo'\}/, 'the connect screen offers Try the Demo to somebody who has paid')
    assert.match(app, /\{owned \? 'Demo' : 'Try the demo'\}/, 'the fault notice offers Try the demo to somebody who has paid')
    assert.match(app, /owned=\{owned\}/, 'the connect screen is never told who has paid')

    /* Connecting, and nothing answering: which account this is, in his words —
       "make sure you're connected to your computer using and then show the
       user's email address". At both ends. */
    const using = /Make sure you&rsquo;re connected to your computer using <strong>\{email\}<\/strong>\./
    assert.match(connect, using, 'the connect screen does not say which account it is using')
    assert.equal((connect.match(/<Using email=\{remembered\} paired=\{paired\} \/>/g) || []).length, 2, 'the account line is missing while connecting or when nothing answers')
    const phoneApp = read('mobile/App.js')
    const phoneSettings = read('mobile/src/screens/Settings.js')
    for (const [where, src] of [['the phone’s connecting screen', phoneApp], ['the phone’s Phone & computer page', phoneSettings]]) {
      assert.ok(src.includes('Make sure you’re connected to your computer using '), `${where} does not say which account it is using`)
    }

    /* Signing in ends the demo, as the phone's onSignedIn does — "make sure
       demos disappear when you're logged in" — and out of the demo a phone
       signed in connects, rather than stopping one tap short. */
    const after = app.slice(app.indexOf('const afterAccount = async () => {'), app.indexOf('const afterAccount = async () => {') + 700)
    assert.match(after, /if \(isDemo\(\)\) \{[\s\S]*?setDemo\(false\)\s*window\.location\.reload\(\)/, 'signing in leaves the person in the demo')
    assert.match(after, /if \(linkState\(\)\.role === 'remote'\) await reconnectPhone\(\)/, 'a phone signed in from the unlock stops at “Connect as …”')
    assert.equal((app.match(/await afterAccount\(\)/g) || []).length, 2, 'signing in and making an account lead to different places')
    assert.match(read('mobile/App.js'), /onSignedIn=\{[\s\S]{0,1200}setDemo\(false\)/, 'the phone’s sign-in stopped ending the demo; this check follows it')
  })

  /**
   * A PHONE GETS THE PHONE'S WALKTHROUGH, in the browser too.
   *
   * The browser showed every visitor the computer's — "YOU ARE HERE · This
   * computer", "Plug your unit into this computer" — and most of them are on
   * a phone. The phone app's own walkthrough is drawn instead there, from the
   * same words and the same pictures as the phone's.
   */
  test('the computer app starts with three ways in, and an account without the unlock is offered it', async () => {
    /*
     * "It's not showing any unlock options, basically in the beginning… I
     * didn't see any demo options whatsoever… there needs to be a clear way
     * to unlock it from the beginning or try a demo or just use the Mac app
     * without the phone." And: signing in on the computer "gave that error…
     * realtime CHANNEL_ERROR. Also, no way to unlock it at that point."
     */
    const { C3, D4 } = await import('../shared/onboarding.mjs')
    const web = read('src/components/PhoneWalkthrough.jsx').replace(/\s+/g, ' ')
    /* Three cards on the computer: here, the demo, the phone remote. */
    for (const piece of ['{C3.here.title}', "onClick={() => onHere?.()}", '{P3.demo.go}', '{computer ? C3.phone.title : P3.real.title}', '{P3.real.agree}']) {
      assert.ok(web.includes(piece), `the computer's choice screen lost ${piece}`)
    }
    assert.ok(!/no account/i.test(C3.here.body), 'the computer card promises no account, which the pairing rule forbids')

    /* The sign-in asks about the unlock before it turns the phone remote on. */
    const link = read('src/lib/link.js')
    const setUp = link.slice(link.indexOf('export async function setUpMac'), link.indexOf('/** The relay'))
    assert.ok(setUp.indexOf('checkUnlocked()') > 0 && setUp.indexOf('checkUnlocked()') < setUp.indexOf('await turnOnMac('), 'the phone remote is turned on before anybody asks whether it was bought')
    assert.match(setUp, /err\.code = 'not-unlocked'/)
    assert.match(link, /CHANNEL_ERROR\|channel error/, 'the relay’s refusal reaches the screen in its own words again')

    /* And the app answers that with the unlock, then turns it on once bought. */
    const app = read('src/App.jsx').replace(/\s+/g, ' ')
    assert.match(app, /if \(err\?\.code !== 'not-unlocked'\) throw err/, 'an account without the unlock is shown an error rather than the unlock')
    assert.match(app, /setUnlockAfterSignIn\(true\) return/, 'the unlock does not open after that sign-in')
    assert.match(app, /linkState\(\)\.role === 'mac'\) \{ await checkUnlocked\(\) try \{ await setMacRemote\(true\)/, 'buying on the computer does not turn its phone remote on')

    /* The sign-in step says so too, rather than waiting for ever. */
    const onb = read('src/components/Onboarding.jsx')
    assert.match(onb, /\{D4\.unlock\}/)
    assert.match(onb, /D4\.notUnlocked\(link\.account\.email\)/)
    /*
     * And what step 3 opens is on top of it. "The sign-in button on this mac
     * app screen doesn't work" — it opened the sign-in under the walkthrough.
     */
    const css = read('src/styles.css')
    const z = (name) => Number((css.match(new RegExp(`--z-${name}: (\\d+);`)) || [])[1])
    assert.match(css, /\.onb \{[^}]*z-index: var\(--z-onb\);/, 'the walkthrough has a height of its own again')
    assert.ok(z('bar') < z('onb') && z('onb') < z('scrim'), 'the walkthrough is over a sheet it opens, or under the bar it covers')
    assert.equal(D4.notUnlocked('a@b.c'), 'a@b.c hasn’t unlocked the phone remote yet. This computer app is free to use on its own; the phone remote is the one-time unlock.')
  })

  test('a phone gets the phone’s walkthrough, in the browser too', () => {
    const app = read('src/App.jsx')
    const web = read('src/components/PhoneWalkthrough.jsx')
    const phone = read('mobile/src/screens/Onboarding.js')

    assert.match(app, /const phoneEnd = link\.role === 'remote' \|\| link\.role === 'wifi' \|\| \(isDemo\(\) && link\.canHost === false\)/, 'the browser no longer tells a phone from a computer for its walkthrough')
    assert.match(app, /<PhoneWalkthrough\s+open=\{walkthrough && \(phoneEnd \|\| \(computerEnd && !computerSetup\)\)\}/, 'a phone’s browser is not shown the phone’s walkthrough')
    /*
     * And the computer gets its welcome too, then its own plug-in steps.
     * "There needs to be a clear way to unlock it from the beginning or try a
     * demo or just use the Mac app without the phone."
     */
    assert.match(app, /computer=\{computerEnd\}/, 'the computer is shown the phone’s choice screen, without its own cards')
    assert.match(app, /<Onboarding\s+open=\{walkthrough && computerEnd && computerSetup\}\s+start="unit"/, 'the computer’s plug-in steps are shown to something that is not the computer, or before it chose to use it here')

    /* The same steps, from the same words file, in the same order. */
    for (const words of ['P1.head', 'P1.go', 'P1.haveCode', 'P2.head', 'P2.go', 'P3.head', 'P3.demo.go', 'P3.real.go', 'P3.signIn', 'P4.head', 'P4.go(unitName)', 'P4.back', 'P9.demo.head', 'P9.go']) {
      assert.ok(phone.includes(words), `the phone’s walkthrough no longer says ${words}; this check follows it`)
      assert.ok(web.includes(words), `the browser’s phone walkthrough does not say ${words}, and the phone’s does`)
    }
    assert.match(web, /from '\.\.\/\.\.\/shared\/onboarding\.mjs'/, 'the browser’s phone walkthrough has words of its own')
    /* His pictures, the phone's own files, and the plain box that took the
       place of the two with Fractal's logo on them (test/independent.mjs). */
    for (const art of ['unit-plain.png', 'piece-computer.png', 'piece-phone.png']) {
      assert.ok(web.includes(`mobile/assets/${art}`), `the browser’s phone walkthrough is missing ${art}`)
    }
  })

  /*
   * An attached modifier is said out loud, at both ends, in the same words.
   * "Attaching a modifier (Amp → Gain → LFO) only showed an orange border —
   * confirmation/persistence unclear." The browser told only its change log.
   */
  test('attaching a modifier says what now moves what, at both ends', () => {
    const phone = read('mobile/src/screens/Edit.js')
    const web = read('src/components/Modifiers.jsx')
    assert.ok(phone.includes('setSaid(`${src?.name} now moves ${b?.name} ${p?.name}.`)'), 'the phone changed its words for an attach; this check follows them')
    assert.ok(web.includes('setSaid(`${src?.name} now moves ${block?.name} ${param?.name}.`)'), 'the browser does not say what an attach did, in the phone’s words')
    assert.match(web, /\{said \? \(\s*<p className="mod-said" role="status">/, 'the browser keeps the attach to its change log again')
  })

  /*
   * PHONE & COMPUTER IS ONE PAGE AT BOTH ENDS, and it opens the same way.
   *
   * "This screen is supposed to pull up when you tap the unit name in the
   * top left of the screen, and it works fine on one platform, then not the
   * other… I thought we had testing in place to make sure that when you
   * change one platform that it automatically will change the other."
   *
   * Only for what a test was written for, which this had not been: the
   * phone's unit name opened the Settings list and the browser's opened the
   * page, and a comment in the suite recorded the difference as a limit
   * rather than a fault. So, held here: the name opens the page at both
   * ends, both pages open on the same three cards worded in one shared
   * file, and CONNECTED says which computer at both ends.
   */
  test('Phone & computer opens from the unit name and shows the same chain, at both ends', async () => {
    const phoneApp = read('mobile/App.js')
    const webApp = read('src/App.jsx').replace(/\s+/g, ' ')
    assert.match(phoneApp, /onOpenUnit=\{\(\) => \(demo \? setPickUnit\(true\) : link\.hosts\?\.length > 1 \? setPickLive\(true\) : openSettings\('link'\)\)\}/, 'the phone’s unit name no longer opens Phone & computer')
    assert.match(read('mobile/src/screens/Settings.js'), /const \[page, setPage\] = useState\(startPage\)/, 'the phone’s Settings cannot open on a page')
    assert.match(webApp, /onOpenUnit=\{\(\) => \{.*setSetupPage\(isDemo\(\) \? 'demo' : 'link'\)/, 'the browser’s unit name no longer opens Phone & computer')

    /* One set of words for the chain, and both pages draw it. */
    assert.match(read('mobile/src/screens/Settings.js'), /<ChainCards\s+cards=\{linkChain\(\{\s+here: 'phone'/, 'the phone’s Phone & computer does not open on the chain')
    assert.match(webApp, /<ChainCards cards=\{linkChain\(\{/, 'the browser’s Phone & computer does not open on the chain')
    assert.match(read('mobile/src/lib/link-chain.js'), /Generated from shared\/link-chain\.mjs/, 'the phone words its chain for itself')
    const { linkChain } = await import('../shared/link-chain.mjs')
    const cards = linkChain({ here: 'phone', unit: { name: 'FM3', firmware: '13.0', state: 'present' }, computer: { name: 'MacBook Pro', version: '1.86.8', link: 'connected' }, phone: { version: '1.86.8' } })
    assert.deepEqual(cards.map((c) => c.body), ['FM3 · firmware 13.0', 'MacBook Pro · v1.86.8', 'v1.86.8'])
    assert.deepEqual(cards.map((c) => c.lit), [true, true, undefined], 'a wire between two answering ends is not lit')

    /* And CONNECTED says which computer, at both ends. */
    assert.match(read('src/components/LinkChip.jsx'), /<p className="hint">\{said\.sentence\}\.<\/p>/, 'the browser’s CONNECTED stopped saying which computer')
    const bar = read('mobile/src/components/TopBar.js')
    assert.match(bar, /setSaying\(\(open\) => !open\)/, 'the phone’s CONNECTED is a label again')
    assert.match(bar, /`Connected to \$\{where\}\.`/, 'the phone’s CONNECTED note does not name the computer')
  })

  /*
   * Over Bluetooth (beta) the screen drew the adapter as a computer, joined
   * to the unit by a USB cable, under a note about the computer's version.
   */
  test('over Bluetooth (beta) the chain is the unit, the adapter and the phone, with no computer in it', async () => {
    const { linkChain } = await import('../shared/link-chain.mjs')
    const blue = (adapter, unit = { name: 'AM4', state: 'present' }) =>
      linkChain({ here: 'phone', via: 'bluetooth', unit, computer: { name: adapter.name, link: adapter.link }, adapter, phone: { version: '1.87.3' } })
    const cards = blue({ name: 'WIDI Uhost Bluetooth', link: 'connected' })
    assert.deepEqual(cards.map((c) => c.key), ['unit', 'adapter', 'phone'])
    assert.deepEqual(cards.map((c) => c.label), ['YOUR UNIT', 'BLUETOOTH ADAPTER', 'THIS PHONE'])
    assert.deepEqual(cards.map((c) => c.wire), ['MIDI CABLE', 'BLUETOOTH', undefined])
    assert.deepEqual(cards.map((c) => c.body), ['AM4', 'WIDI Uhost Bluetooth', 'v1.87.3'])
    assert.deepEqual(cards.map((c) => c.lit), [true, true, undefined])
    /* Changed on purpose, 13 October 2026 (1.87.21): the computer's wire is
       SECURE WIRELESS LINK now, and either name of it is a computer leaking in. */
    for (const c of cards) assert.doesNotMatch(`${c.label} ${c.body} ${c.wire || ''}`, /computer|USB|SECURE( WIRELESS)? LINK/i, `a computer is still in the Bluetooth chain: ${c.label}`)

    const finding = blue({ name: 'WIDI Uhost Bluetooth', link: 'joining' })
    assert.deepEqual([finding[0].body, finding[0].tone], ['Reached through the Bluetooth adapter', 'dim'])
    assert.deepEqual([finding[1].body, finding[1].tone], ['Looking for WIDI Uhost Bluetooth…', 'busy'])
    assert.deepEqual([blue({ name: 'WIDI Uhost Bluetooth', link: 'off' })[1].body, blue({ link: 'off' })[1].tone], ['Not connected', 'dim'])
    const quiet = blue({ name: 'WIDI Uhost Bluetooth', link: 'connected' }, { name: 'AM4', state: 'missing' })[0]
    assert.equal(quiet.tone, 'bad')
    assert.match(quiet.body, /MIDI IN/)
    assert.match(quiet.body, /MIDI OUT/)
    assert.doesNotMatch(quiet.body, /USB/)

    /* Nothing else moves: the computer's chain, the demo, and the computer's own end. */
    const fm3 = { here: 'phone', unit: { name: 'FM3', state: 'present' }, computer: { name: 'MacBook Pro', version: '1.86.8', link: 'connected' }, phone: { version: '1.86.8' } }
    assert.deepEqual(linkChain(fm3), linkChain({ ...fm3, via: 'computer' }))
    assert.deepEqual(linkChain({ ...fm3, demo: true, via: 'bluetooth' }).map((c) => c.key), ['unit', 'computer', 'phone'], 'the demo drew an adapter')
    assert.deepEqual(linkChain({ ...fm3, here: 'computer', via: 'bluetooth' }).map((c) => c.key), ['unit', 'computer', 'phone'])

    const settings = read('mobile/src/screens/Settings.js')
    const flat = settings.replace(/\s+/g, ' ')
    assert.match(flat, /const throughAdapter = bluetooth && !demo/)
    assert.ok(settings.indexOf('const throughAdapter') > settings.indexOf('const demo = useDemo()'), 'throughAdapter is read before demo exists')
    assert.match(flat, /via: throughAdapter \? 'bluetooth' : 'computer'/)
    assert.match(flat, /adapter: \{ name: macName, link \}/)
    assert.match(flat, /link === 'connected' && !demo && !throughAdapter && \(unitState === 'missing' \|\| unitState === 'silent'\)/, 'the USB and editor advice shows over Bluetooth')
    assert.ok(cards.every((c) => !c.warn), 'the Bluetooth chain tells somebody to update a computer')
    assert.doesNotMatch(flat, /didn’t say which version/, 'the computer-version note is back on Phone & computer')
    const walk = read('mobile/src/components/Walk.js').replace(/\s+/g, ' ')
    assert.match(walk, /import bluetoothIcon from '\.\.\/\.\.\/assets\/icons\/bluetooth\.png'/)
    assert.match(walk, /const CHAIN_ICONS = \{ unit: ampIcon, computer: laptopIcon, adapter: bluetoothIcon, phone: phoneIcon \}/)
  })

  /*
   * "Change red text about updating computer to a link that shows
   * instructions when tapped on how to update it." (13 October 2026, 1.87.21)
   *
   * The red line said what to do and never how. Now the card it sits on is
   * the link, at both ends, and it opens one page of steps worded once in
   * shared/computer-update.mjs. The steps name things on the computer — a
   * menu item, a line in its menu, a button — so they are held here to the
   * computer app's own words for them: if the updater's wording moves, this
   * fails until the steps move with it.
   */
  test('the red line on the computer card opens how to update it, at both ends', async () => {
    const { UPDATE_STEPS } = await import('../shared/computer-update.mjs')
    assert.deepEqual(UPDATE_STEPS, {
      title: 'Updating the computer app',
      intro: 'The computer app downloads new versions by itself, but it only puts one in when you quit it and open it again. A computer that stays open for days falls behind.',
      steps: [
        {
          label: '1  QUIT, THEN OPEN IT AGAIN',
          body: 'On the computer, click the Fractal Remote icon — in the menu bar at the top of a Mac’s screen, or by the clock on Windows (it may be behind the ^ arrow; right-click it) — and choose Quit. Then open Fractal Remote again. Any update it has already downloaded goes in.'
        },
        {
          label: '2  CHECK FOR UPDATES',
          body: 'Click the icon again (right-click on Windows) and choose Check for updates…. When it says “Update … installs when you quit”, quit and open it once more. It can take two rounds.'
        },
        {
          label: '3  STILL BEHIND? DOWNLOAD IT',
          body: 'On the computer, quit Fractal Remote as in step 1, then go to fractal.newbold.cloud/downloads and install the newest version over the old one. On a Mac, drag it into Applications and choose Replace. Then open Fractal Remote again. Your settings and sign-in stay.'
        }
      ],
      after: 'The red line under YOUR COMPUTER goes away by itself a couple of minutes after the computer is up to date.',
      ifItSays: [
        {
          says: '“Move Fractal Remote to Applications to get updates”',
          body: 'A Mac only updates an app in its Applications folder. Open Fractal Remote and choose Move to Applications when it asks, or in its window go to ⚙ → About → Updates → Move to Applications.'
        },
        { says: '“Version … is still being built”', body: 'A new version is a few minutes from ready. Choose Check for updates… again in ten minutes.' },
        { says: 'A password box, on Linux', body: 'The .deb package asks for your computer’s password when it installs. Type it to finish. The AppImage never asks.' }
      ]
    })
    /* The lines about every computer say "computer". Only a step that differs by platform names one. */
    for (const line of [UPDATE_STEPS.title, UPDATE_STEPS.intro, UPDATE_STEPS.after, ...UPDATE_STEPS.steps.map((s) => s.label)]) {
      assert.doesNotMatch(line, /\bMac\b/, `"${line}" calls every computer a Mac`)
    }

    /* The phone carries a generated copy, listed with the others. */
    const { FILES } = await import('../scripts/sync-relay-rules.mjs')
    assert.ok(
      FILES.some((f) => f.source === '../shared/computer-update.mjs' && f.target === '../mobile/src/lib/computer-update.js' && !f.raw),
      'the phone has no copy of the steps'
    )
    assert.match(read('mobile/src/lib/computer-update.js'), /Generated from shared\/computer-update\.mjs/, 'the phone words the steps for itself')

    /* HELD TO THE COMPUTER APP'S OWN WORDS. */
    const { updateLine } = await import('../desktop/lib/updates.mjs')
    /* A quoted line, with … standing for the version the menu puts there. */
    const quoted = (says) => {
      const escaped = says.replace(/[“”]/g, '').replace(/[.*+?^$()|[\]\\{}]/g, '\\$&')
      return new RegExp('^' + escaped.replace(/…/g, '\\S+') + '$')
    }
    const ready = UPDATE_STEPS.steps[1].body.match(/“([^”]+)”/)[1]
    assert.match(updateLine({ kind: 'ready', version: '1.87.21' }), quoted(ready), 'step 2 quotes a line the computer’s menu does not say')
    assert.equal(updateLine({ kind: 'misplaced' }), UPDATE_STEPS.ifItSays[0].says.replace(/[“”]/g, ''), 'the steps quote a Mac line the menu does not say')
    assert.match(updateLine({ kind: 'building', version: '1.87.21' }), quoted(UPDATE_STEPS.ifItSays[1].says), 'the steps quote a building line the menu does not say')
    const main = read('desktop/main.js')
    assert.match(main, /label: 'Check for updates…',/, 'the steps send somebody to a menu item that is not there')
    assert.match(main, /\{ label: 'Quit', click: \(\) => app\.quit\(\) \}/, 'the menu has no Quit')
    /*
     * A click opens the window on Windows, so every step that goes to the
     * icon's menu says right-click there: step 2 once said only "Click the
     * icon again", which on Windows opens the window and no menu. And Windows
     * 10 and 11 tuck a new app's icon behind the ^ arrow by the clock, and the
     * app does nothing to bring it out, so step 1 says to look there.
     */
    assert.match(main, /tray\.on\('click', openWindow\)/)
    assert.match(main, /tray\.setContextMenu\(menu\)/)
    assert.match(UPDATE_STEPS.steps[0].body, /on Windows \(it may be behind the \^ arrow; right-click it\)/, 'step 1 does not say where the icon hides on Windows')
    assert.match(UPDATE_STEPS.steps[1].body, /^Click the icon again \(right-click on Windows\) and choose Check for updates…/, 'step 2 opens the window on Windows, not the menu')
    assert.match(main, /buttons: \['Move to Applications', 'Not now'\]/, 'the Mac does not ask to move itself any more')
    assert.match(read('src/components/Updates.jsx'), /Move to Applications\s*<\/button>/, 'the Updates page has no Move to Applications')
    assert.match(read('src/components/TopBar.jsx'), /<span aria-hidden="true">⚙<\/span>/, 'the window’s gear is not ⚙')
    const app = read('src/App.jsx')
    assert.match(app, /<SetupRow key="about" title="About"/)
    assert.match(app, /<SetupRow key="updates" title="Updates"/)
    assert.match(read('desktop/electron-builder.yml'), /deleteAppDataOnUninstall: false/, 'a reinstall on Windows throws the settings away')
    /* Step 3 quits first and opens after: Finder will not replace an app that
       is open, and only the Windows installer starts the app when it is done. */
    assert.match(UPDATE_STEPS.steps[2].body, /^On the computer, quit Fractal Remote as in step 1, then go to [\s\S]*choose Replace\. Then open Fractal Remote again\./)
    assert.match(read('desktop/electron-builder.yml'), /runAfterFinish: true/)
    assert.doesNotMatch(read('desktop/electron-builder.yml'), /^dmg:/m, 'the Mac image has settings of its own now: check whether it reopens the app')
    /* Read rather than imported: downloadLink.js imports './project' the way Metro resolves it, which Node does not. */
    const downloads = read('mobile/src/lib/downloadLink.js').match(/export const DOWNLOADS_URL = '([^']+)'/)[1]
    assert.ok(UPDATE_STEPS.steps[2].body.includes(`go to ${downloads} `), 'step 3 sends somebody to a page the phone does not')
    assert.match(read('public/downloads.html'), /Download Fractal Remote/)

    /* THE PHONE: the computer card's tap opens the page, and the page draws the shared words. */
    const settings = read('mobile/src/screens/Settings.js')
    const flat = settings.replace(/\s+/g, ' ')
    assert.match(settings, /import \{ UPDATE_STEPS \} from '\.\.\/lib\/computer-update'/)
    assert.match(flat, /<ChainCards cards=\{linkChain\(\{[\s\S]*?\}\)\} onWarn=\{\(\) => setPage\('updating'\)\} \/>/, 'the red line on the phone opens nothing')
    assert.match(settings, /const PARENT = \{ offline: 'link', updating: 'link',/, 'back from the steps does not go to Phone & computer')
    const phonePage = settings.slice(settings.indexOf("{page === 'updating' ? ("), settings.indexOf("{page === 'watch' ? ("))
    assert.ok(phonePage.length > 200, 'the phone has no page of steps')
    for (const drawn of ["head(UPDATE_STEPS.title, 'back')", 'UPDATE_STEPS.intro', 'UPDATE_STEPS.steps.map', 'UPDATE_STEPS.after', 'UPDATE_STEPS.ifItSays.map']) {
      assert.ok(phonePage.includes(drawn), `the phone’s page does not draw ${drawn}`)
    }
    assert.match(phonePage, /<View key=\{step\.label\} style=\{\{ gap: space\.sm \}\}>\s*<TipCard icon=/, 'the phone’s steps are not numbered cards')
    assert.ok(!/font\.small/.test(phonePage), 'the steps are in the small type')
    assert.ok(!/mayDrive|purchase/.test(phonePage), 'the steps are kept from somebody who has not paid, whose computer is just as behind')

    /* THE BROWSER: the same, from the same file. */
    assert.match(app, /import \{ UPDATE_STEPS \} from '\.\.\/shared\/computer-update\.mjs'/)
    assert.match(app.replace(/\s+/g, ' '), /\}\)\} onWarn=\{\(\) => setSetupPage\('updating'\)\} \/>/, 'the red line in the browser opens nothing')
    assert.match(app, /updating: UPDATE_STEPS\.title,/)
    assert.match(app, /const SETUP_PARENT = \{[^}]*updating: 'link'/, 'back from the browser’s steps does not go to Phone & computer')
    const webAt = app.indexOf("{setupPage === 'updating' ? (")
    const webPage = app.slice(webAt, app.indexOf("setupPage === '", webAt + 5))
    assert.ok(webPage.length > 200, 'the browser has no page of steps')
    for (const drawn of ['SETUP_PAGES.updating', "upLabel('updating')", 'UPDATE_STEPS.intro', 'UPDATE_STEPS.steps.map', 'UPDATE_STEPS.after', 'UPDATE_STEPS.ifItSays.map', '<Fragment key={step.label}>', '<TipCard icon=']) {
      assert.ok(webPage.includes(drawn), `the browser’s page does not draw ${drawn}`)
    }
    assert.ok(!/<Section/.test(webPage), 'a folded section on the steps page (and structure.mjs would count it)')
    /* And neither end types the steps out for itself. */
    for (const [end, text] of [['phone', settings], ['browser', app]]) {
      assert.ok(!text.includes('QUIT, THEN OPEN IT AGAIN') && !text.includes('install the newest version over the old one'), `the ${end} has its own copy of the steps`)
    }

    /*
     * THE ADDRESS AGAIN, in a box of its own under the step that gives it. In the
     * step card's narrow column it broke as "…cloud/download" and "s" at the
     * commonest phone widths, and "/download" is the web app, not the
     * downloads page. Both ends draw it again in the Connect a computer
     * page's box, and a tap copies it.
     *
     * Both ends break it only after the slash, in the card and in the box.
     * On one line the box shrank it under the page's body size on most
     * phones (11.5pt at 320 wide, 14.4pt at 375 on the phone; 10.8px and
     * 13.7px in the browser), and in the browser the card did not break it at
     * all, so it ran out of a 320-wide screen. The card gets a place to break
     * that adds nothing to the text (a zero-width space on the phone, whose
     * card text cannot be selected; <wbr> in the browser, so a copied
     * sentence holds the address as it is), and the box draws two lines.
     */
    assert.equal(UPDATE_STEPS.steps.filter((s) => s.body.includes(downloads)).length, 1, 'more than one step, or none, gives the address')
    assert.match(settings, /import CopyAddress, \{ breakableAddress \} from '\.\.\/components\/CopyAddress'/)
    assert.match(phonePage, /\{step\.body\.includes\(DOWNLOADS_URL\) \? <CopyAddress row split size=\{font\.lead\} saidSize=\{font\.body\} \/> : null\}/, 'the phone’s address is only inside the card, where it breaks')
    assert.match(phonePage, /<TipCard icon=\{\[laptopIcon, setupIcon, sendIcon\]\[i\]\} label=\{step\.label\} body=\{breakableAddress\(step\.body\)\} \/>/, 'the phone’s card breaks the address wherever its line runs out')
    const phoneCopy = read('mobile/src/components/CopyAddress.js')
    assert.match(phoneCopy, /const CUT = DOWNLOADS_URL\.indexOf\('\/'\) \+ 1\n/)
    assert.match(phoneCopy, /export const breakableAddress = \(text\) =>\s+text\.replace\(DOWNLOADS_URL, `\$\{DOWNLOADS_URL\.slice\(0, CUT\)\}\\u200B\$\{DOWNLOADS_URL\.slice\(CUT\)\}`\)/, 'the phone’s card has nowhere to break the address but anywhere')
    /* Two lines that shrink together only once the first no longer fits: a line end, not a place the phone may choose. */
    assert.match(phoneCopy, /<Text\s+numberOfLines=\{split \? 2 : 1\}\s+adjustsFontSizeToFit\s+minimumFontScale=\{0\.6\}/, 'the phone’s address box can break the address again')
    assert.match(phoneCopy, /\{split \? `\$\{DOWNLOADS_URL\.slice\(0, CUT\)\}\\n\$\{DOWNLOADS_URL\.slice\(CUT\)\}` : DOWNLOADS_URL\}/, 'the phone’s box does not break the address after its slash')
    assert.ok(downloads.indexOf('/') > 0 && downloads.indexOf('/') === downloads.lastIndexOf('/'), 'the address has no slash to break after, or more than one')
    /* And its "Copied." line in the page's own size, not the small type. */
    assert.match(phoneCopy, /\{ size = font\.body, row = false, saidSize = font\.small, split = false \}/)
    assert.match(phoneCopy, /fontSize: saidSize, fontWeight: '700' \}\}>\{P6\.copied\}/)
    assert.match(app, /import CopyAddress, \{ withAddressBreak \} from '\.\/components\/CopyAddress'/)
    assert.match(webPage, /<TipCard icon=\{\[laptopIcon, setupIcon, sendIcon\]\[i\]\} label=\{step\.label\} body=\{withAddressBreak\(step\.body\)\} \/>/, 'the browser’s card runs the address out of a narrow screen')
    assert.match(webPage, /\{step\.body\.includes\(DOWNLOADS_URL\) \? <CopyAddress \/> : null\}/, 'the browser’s address is only inside the card, where it breaks')
    const webCopy = read('src/components/CopyAddress.jsx')
    assert.match(webCopy, /navigator\.clipboard\.writeText\(`https:\/\/\$\{DOWNLOADS_URL\}`\)/, 'a tap does not copy the address in the browser')
    assert.match(webCopy, /<div className="updating-address">\s*<button type="button" className="cc-address"/)
    assert.match(webCopy, /const CUT = DOWNLOADS_URL\.indexOf\('\/'\) \+ 1\n/)
    assert.match(webCopy, /\{text\.slice\(0, at \+ CUT\)\}\s*<wbr \/>\s*\{text\.slice\(at \+ CUT\)\}/, 'the browser’s card has nowhere to break the address')
    assert.match(webCopy, /<span className="mono">\s*<span className="updating-address-line">\{DOWNLOADS_URL\.slice\(0, CUT\)\}<\/span>\s*<span className="updating-address-line">\{DOWNLOADS_URL\.slice\(CUT\)\}<\/span>\s*<\/span>/, 'the browser’s box does not break the address after its slash')
    assert.ok(!/window\.open|location\.href|<a /.test(webCopy), 'the address opens the downloads page on the phone')
    const css = read('src/styles.css')
    const box = css.slice(css.indexOf('.cc-address .mono {'), css.indexOf('}', css.indexOf('.cc-address .mono {')))
    assert.match(box, /white-space: nowrap;/, 'the address box lets the address break')
    const fit = css.slice(css.indexOf('.updating-address .mono {'), css.indexOf('}', css.indexOf('.updating-address .mono {')))
    /* 13.6em holds the 22 characters of "fractal.newbold.cloud/", the longer line. */
    assert.match(fit, /font-size: min\(var\(--f-4\), calc\(\(100cqi - 80px\) \/ 13\.6\)\);/, 'the browser’s address does not shrink to its column')
    assert.equal(downloads.slice(0, downloads.indexOf('/') + 1).length, 22, 'the address’s first line changed length: work out the 13.6 in .updating-address .mono again')
    assert.match(css.slice(css.indexOf('.updating-address-line {'), css.indexOf('}', css.indexOf('.updating-address-line {'))), /display: block;/, 'the browser’s address is on one line again')
    assert.match(css.slice(css.indexOf('.updating-address {'), css.indexOf('}', css.indexOf('.updating-address {'))), /container-type: inline-size;/)
    assert.match(css.slice(css.indexOf('.updating-address .cc-copied {')), /^\.updating-address \.cc-copied \{\s*font-size: var\(--f-4\);/)

    /* THE CARD AT BOTH ENDS: pressable only while it shows the red line, underlined then. */
    const walk = read('mobile/src/components/Walk.js').replace(/\s+/g, ' ')
    assert.match(walk, /const warnLink = Boolean\(warn && onWarn\) const press = onPress \|\| \(warnLink \? onWarn : null\)/)
    assert.match(walk, /accessibilityRole=\{press \? 'button' : undefined\} accessibilityHint=\{warnLink \? hint : undefined\} disabled=\{!press\}/, 'a card with no red line can be pressed')
    assert.match(walk, /textDecorationLine: warnLink \? 'underline' : 'none'/, 'the red line does not read as a link')
    assert.match(walk, /export function ChainCards\(\{ cards, onWarn \}\)/)
    assert.match(walk, /warn=\{card\.warn\} onWarn=\{onWarn\} hint="Shows how to update the computer app"/)
    /* The lamp stays on the right; no chevron joins it. */
    assert.match(walk, /\{right \|\| \(onPress \? <Image source=\{chevronIcon\}/)
    const webWalk = read('src/components/Walk.jsx').replace(/\s+/g, ' ')
    assert.match(webWalk, /const warnLink = Boolean\(warn && onWarn\) const press = onClick \|\| \(warnLink \? onWarn : null\)/)
    assert.match(webWalk, /return press \? \( <button type="button" className=\{warnLink \? 'walk-card walk-card-link' : 'walk-card'\} onClick=\{press\}>/, 'the browser’s card is not the button')
    assert.match(webWalk, /export function ChainCards\(\{ cards, onWarn \}\)/)
    assert.match(webWalk, /warn=\{card\.warn\} onWarn=\{onWarn\}/)
    /* One button: the red line inside it stays a span. */
    assert.match(webWalk, /\{warn \? <span className="walk-card-warn">\{warn\}<\/span> : null\}/, 'a button inside the card’s button')
    assert.match(read('src/styles.css'), /\.walk-card-link \.walk-card-warn \{\s*text-decoration: underline;/, 'the browser’s red line does not read as a link')
    /* A card with no red line, given onWarn, is not a link: only the computer card shows the line. */
    const { linkChain } = await import('../shared/link-chain.mjs')
    const old = linkChain({ here: 'phone', unit: { name: 'FM3', state: 'present' }, computer: { name: 'MacBook Pro', version: '1.86.69', link: 'connected' }, phone: { version: '1.87.21' } })
    assert.deepEqual(old.filter((c) => c.warn).map((c) => c.key), ['computer'], 'a card other than the computer’s carries the red line')
  })

  /*
   * "Also, where it says secure link, change that to say secure wireless
   * link." (13 October 2026, 1.87.21) The one wire between the computer and
   * the phone, wherever it is drawn: Phone & computer at both ends, How it
   * works on the phone and in a phone's browser, and the computer's welcome.
   */
  test('the wire between the computer and the phone says SECURE WIRELESS LINK everywhere it is drawn', async () => {
    const { linkChain } = await import('../shared/link-chain.mjs')
    for (const here of ['phone', 'computer']) {
      const wires = linkChain({ here, unit: { name: 'FM3', state: 'present' }, computer: { name: 'MacBook Pro', link: 'connected' } }).map((c) => c.wire)
      assert.deepEqual(wires, ['USB CABLE', 'SECURE WIRELESS LINK', undefined], `Phone & computer at the ${here} end`)
    }
    const { CHAIN } = await import('../shared/onboarding.mjs')
    const computer = CHAIN.find((b) => b.key === 'computer')
    assert.equal(computer.wire, 'SECURE WIRELESS LINK', 'the computer’s welcome still says SECURE LINK')
    assert.equal(computer.phoneWire, 'SECURE WIRELESS LINK', 'How it works still says SECURE LINK')
    for (const file of ['shared/link-chain.mjs', 'shared/onboarding.mjs', 'mobile/src/lib/link-chain.js', 'mobile/src/lib/onboarding.js']) {
      assert.ok(!read(file).includes("'SECURE LINK'"), `${file} still says SECURE LINK`)
    }
    /* Each end draws the wire from those words rather than its own. */
    assert.match(read('mobile/src/screens/Onboarding.js'), /\{box\.phoneWire \? <Wire label=\{box\.phoneWire\} \/> : null\}/)
    assert.match(read('src/components/PhoneWalkthrough.jsx'), /<span className="pw-wire-label">\{box\.phoneWire\}<\/span>/)
    assert.match(read('src/components/Onboarding.jsx'), /<span className="onb-wire mono">\{box\.wire\}<\/span>/)
    /*
     * The computer's welcome holds its three boxes in one row between two
     * labels. On one line the longer label would have pushed the row onto two
     * at windows that held it before, leaving the label at the end of the
     * first row pointing at nothing. One word to a line, it is narrower than
     * SECURE LINK was.
     */
    const css = read('src/styles.css')
    const onbWire = css.slice(css.indexOf('.onb-wire {'), css.indexOf('}', css.indexOf('.onb-wire {')))
    assert.match(onbWire, /width: min-content;/, 'the welcome’s wire label is one long line again')
    assert.ok(!/white-space: nowrap/.test(onbWire), 'the welcome’s wire label is held to one line again')
  })

  /*
   * THE MODEL PAGE TURNS TO THE NEXT MODEL, at both ends.
   *
   * "Make it so swiping left or right on the screen takes you forward or
   * backwards to the next amp model. Also have little arrow buttons on each
   * side of the screen." Each end gets the tab's list, arrows either side,
   * a swipe, and a "3 of 24", and neither lets a sideways swipe leave the page.
   */
  test('the amp and pedal page steps to the next model with a swipe or an arrow, at both ends', () => {
    const phone = read('mobile/src/components/GearCard.js')
    const web = read('src/components/GearCard.jsx')
    for (const [end, src] of [['phone', phone], ['browser', web]]) {
      assert.match(src, /export default function GearCard\(\{ entry, entries = \[\], onGo, onBack \}\)/, `the ${end}’s model page has no list to step through`)
      assert.match(src, /`\$\{at \+ 1\} of \$\{list\.length\}`/, `the ${end} does not say where in the list you are`)
      assert.match(src, /Previous: /, `the ${end} has no back arrow`)
      assert.match(src, /Next: /, `the ${end} has no forward arrow`)
      assert.match(src, /\(i \+ dir \+ l\.length\) % l\.length/, `the ${end}’s list stops at its ends instead of wrapping`)
    }
    assert.match(phone, /PanResponder\.create/, 'the phone’s page does not follow a swipe')
    assert.match(phone, /onPanResponderTerminationRequest: \(\) => false/, 'a swipe on the phone’s model page can still be taken by the back gesture')
    assert.match(phone, /BackHandler\.addEventListener\('hardwareBackPress'/, 'Android’s back leaves the app from the model page')
    assert.match(web, /onTouchMove=\{onTouchMove\}/, 'the browser’s page does not follow a swipe')
    assert.match(web, /e\.key === 'ArrowRight'/, 'the keyboard’s arrows do not step through the models')
  })

  /*
   * A TESTER'S NOTES, held so they stay fixed.
   *
   * Android's back button closed the app from any screen with a Done button;
   * back on the demo's Play screen gave no "Exit demo?"; a block could be
   * removed with one tap and no way back; and the tuner and volume showed the
   * scenes through them.
   */
  test('Android back steps back, removing a block asks first, and the tuner is not see-through', () => {
    const app = read('mobile/App.js')
    assert.match(app, /BackHandler\.addEventListener\('hardwareBackPress'/, 'Android back still closes the app from any screen')
    assert.match(app, /setScreen\(BACK_TO\[screen\] \|\| 'stage'\)/, 'Android back does not step back a screen')
    assert.match(app, /Alert\.alert\('Exit demo\?'/, 'back on the demo’s Play screen does not offer to leave the demo')
    assert.match(read('mobile/src/screens/Settings.js'), /BackHandler\.addEventListener\('hardwareBackPress', \(\) => \{\s*goBack\(\)/, 'Android back skips Settings’ own pages')

    /* Asked first, at both ends, in the same words. */
    const phone = read('mobile/src/screens/Edit.js')
    const web = read('src/components/GridEditor.jsx')
    assert.match(phone, /onRemove=\{\(\) => confirmRemove\(/, 'the phone removes a block with no question')
    /* In the page, not a browser pop-up: a blocked pop-up answers "no"
       without showing itself, and Remove did nothing and said nothing. */
    assert.match(web, /onClick=\{\(\) => setAsking\(at\)\}/, 'the browser removes a block with no question')
    assert.match(web, /\{asking === at \? \([\s\S]*?role="alertdialog"[\s\S]*?remove\(lane\.row, item\.col, b\.name\)/, 'the browser’s question does not lead to the remove')
    assert.ok(!/window\.confirm\(/.test(web), 'the browser asks in a pop-up that a blocked pop-up answers “no” to unseen')
    for (const src of [phone, web]) {
      assert.ok(src.includes('Its settings go with it. Adding it again brings it back with every knob at its default.'), 'the two ends word the question differently')
    }

    for (const f of ['mobile/src/components/Tuner.js', 'mobile/src/components/Volume.js']) {
      assert.match(read(f), /backgroundColor: tint\(color\.chassis, 0\.94\)/, `${f} shows the screen through it again`)
    }
  })

  /*
   * A TESTER'S SECOND ROUND: every block to add, and Save from Play.
   */
  test('the chain editor offers every kind of block, and Play has a Save once something changed', async () => {
    /* The demo offers a grid unit's whole list, not just what the chain holds. */
    const { createMockDevice } = await import('../src/lib/mockDevice.js').catch(() => ({}))
    const mock = read('src/lib/mockDevice.js')
    assert.match(mock, /unit\.grid\s*\?\s*fm3Blocks/, 'the demo offers only the blocks its chain already holds')
    assert.ok(typeof createMockDevice === 'undefined' || typeof createMockDevice === 'function')

    /* One button per kind, the next one not in the chain. */
    const edit = read('mobile/src/screens/Edit.js')
    assert.match(edit, /: nextOfEachKind\(palette \|\| \[\], used\)/, 'the phone lists every block instead of one of each kind')

    /* Save in the phone's bar, only with something to save, asked first. */
    const bar = read('mobile/src/components/TopBar.js')
    assert.match(bar, /const canSave = saveHere && \(saveTo\.saving \|\| \(!!unsaved && unsaved\.number === preset\?\.number && saveTo\.can\)\)/, 'the phone’s bar has no Save for changes made on Play')
    assert.match(bar, /Alert\.alert\('Save preset\?', 'This will overwrite the current preset\.'/, 'the bar saves without asking')
    assert.match(read('mobile/App.js'), /saveHere=\{screen !== 'edit'\}/, 'Edit shows two Save buttons')
    /* The browser has had one in its bar all along. */
    assert.match(read('src/App.jsx'), /<SaveBar[\s\S]{0,120}dirty=\{dirty\}/, 'the browser lost its Save in the bar')
  })

  /*
   * "Can we set it up for demos to actually save on their phone when they do
   * changes?" Save in the demo said "The demo has no answer for PUT
   * /store/config/fractal.pendingSave.axefxiii". Now it keeps the preset on
   * the device, and a fresh start opens it as saved.
   */
  test('a save in the demo is kept on the device and opens as saved next time', async () => {
    const had = 'localStorage' in globalThis
    const before = globalThis.localStorage
    const disk = new Map()
    globalThis.localStorage = {
      getItem: (k) => (disk.has(k) ? disk.get(k) : null),
      setItem: (k, v) => disk.set(k, String(v)),
      removeItem: (k) => disk.delete(k)
    }
    try {
      const { createMockDevice } = await import('../src/lib/mockDevice.js')
      const { savedPresets } = await import('../src/lib/demoMemory.js')

      const unit = createMockDevice('axefx3')
      const slot = unit.preset().number
      const block = unit.presetBlocks().find((b) => !['input', 'output'].includes(b.slug))
      const wasOff = block.bypassed
      unit.setBypass(block.effectId, !wasOff)
      const knob = unit.blockParams(block.effectId).named[0]
      unit.setParam(block.effectId, knob.id, 0.9)
      const turned = unit.blockParams(block.effectId).named[0].value
      unit.setPresetName('My Tone')
      const res = unit.storePreset(slot)
      assert.equal(res.ok, true)
      assert.equal(res.kept, true, 'the save was not written to the device')

      /* Closing the app and opening it again is a new simulated unit. */
      const again = createMockDevice('axefx3')
      again.selectPreset(slot)
      assert.equal(again.preset().name, 'My Tone', 'the saved name did not come back')
      const back = again.presetBlocks().find((b) => b.effectId === block.effectId)
      assert.ok(back, 'the saved chain did not come back')
      assert.equal(back.bypassed, !wasOff, 'the block went back to how it shipped')
      assert.equal(again.blockParams(block.effectId).named[0].value, turned, 'the knob went back to how it shipped')
      assert.equal(again.storedNames()[slot], 'My Tone', 'the preset list still shows the old name')

      /* Another demo unit's slot is its own. */
      const other = createMockDevice('am4')
      assert.notEqual(other.storedNames()[slot], 'My Tone', 'a save on one demo unit showed up on another')
      assert.deepEqual(Object.keys(savedPresets('am4')), [])

      /* Saved over another slot, that slot becomes this preset. */
      again.storePreset(slot + 7)
      const third = createMockDevice('axefx3')
      third.selectPreset(slot + 7)
      assert.equal(third.preset().name, 'My Tone')
      assert.equal(third.presetBlocks().find((b) => b.effectId === block.effectId)?.bypassed, !wasOff)

      /* And a saved preset the demo cannot read opens as it shipped. */
      disk.set(`fractal.demo.saved.axefx3.${slot}`, 'not json')
      const fresh = createMockDevice('axefx3')
      assert.ok(fresh.presetBlocks().length, 'a broken save broke the demo')
    } finally {
      if (had) globalThis.localStorage = before
      else delete globalThis.localStorage
    }

    /* The phone keeps it in its own store, reads that before opening a preset,
       and its Save goes to the simulated unit rather than to a computer. */
    const demo = read('mobile/src/lib/demo.js')
    assert.match(demo, /useDemoStorage\(sync\)/, 'the phone demo keeps its saves nowhere')
    assert.ok(demo.indexOf('await hydrate()') > -1 && demo.indexOf('await hydrate()') < demo.indexOf('mock = createMockDevice(unit)\n      announce()'), 'the demo opens before its saves are read')
    const saver = read('mobile/src/components/SaveToSlot.js')
    assert.ok(saver.indexOf('if (isDemo())') > -1 && saver.indexOf('if (isDemo())') < saver.indexOf('startComputerSave({'), 'the demo still asks a computer that is not there')
    assert.match(saver, /await saveInDemo\(preset\?\.number\)/)
    assert.doesNotMatch(read('src/lib/demoMemory.js'), /\blocalStorage\.(get|set)Item/, 'the demo reaches for a localStorage the phone does not have')
  })

  /*
   * "Can you make it so I can copy and paste off of this page? Or that I can
   * click on it to give them access from that screen?"
   */
  test('a person on Everyone with an account can be copied and given access from the list, at both ends', async () => {
    const { accountSections, accountChoices } = await import('../shared/admin.mjs')
    const answer = {
      ok: true,
      total: 4,
      accounts: [
        { email: 'new@x.com', signed_up: Date.now(), confirmed: true, last_sign_in: Date.now(), unlocked: false },
        { email: 'paid@x.com', signed_up: Date.now(), confirmed: true, last_sign_in: Date.now(), unlocked: true },
        { email: 'me@x.com', signed_up: Date.now(), confirmed: true, last_sign_in: Date.now(), unlocked: true, source: 'owner' }
      ],
      waiting: [{ email: 'soon@x.com', added: Date.now() }]
    }
    const [people, waiting] = accountSections(answer)
    const row = (email) => people.rows.concat(waiting.rows).find((r) => r.email === email)
    assert.equal(row('new@x.com').email, 'new@x.com', 'a row does not say whose it is')
    assert.match(row('new@x.com').value, /^new@x\.com\n/, 'the list reads differently than it did')
    assert.deepEqual(accountChoices(row('new@x.com')), { give: true, takeBack: false })
    assert.deepEqual(accountChoices(row('paid@x.com')), { give: false, takeBack: true })
    assert.deepEqual(accountChoices(row('me@x.com')), { give: false, takeBack: false }, 'the owner can take his own access away')
    assert.deepEqual(accountChoices(row('soon@x.com')), { give: false, takeBack: true })
    assert.deepEqual(accountChoices({ label: '', value: 'Nobody has made an account yet.' }), { give: false, takeBack: false })

    /* The phone: a tap opens the person in a sheet; the words can be held and copied. */
    const facts = read('mobile/src/components/Facts.js')
    assert.match(facts, /onPress: \(\) => onRow\(row\)/, 'a person on the phone cannot be tapped')
    assert.match(facts, /<Text selectable/, 'the phone’s facts cannot be copied')
    const phone = read('mobile/src/components/AccountsTool.js')
    assert.match(phone, /onRow=\{pick\}/)
    assert.match(phone, /Clipboard\.setStringAsync\(open\.email\)/, 'the phone has no Copy email')
    assert.match(phone, /act\('grant'\)/, 'the phone cannot give access from the list')
    assert.match(phone, /act\('revoke'\)/)
    assert.match(phone, /accountChoices\(open\)/)

    /* The browser: a click opens the row in place, with the same three. */
    const web = read('src/components/AccountsTool.jsx')
    assert.match(web, /onRow=\{pick\} detail=\{detail\}/, 'a person in the browser cannot be clicked')
    assert.match(web, /navigator\.clipboard\.writeText\(open\.email\)/, 'the browser has no Copy email')
    assert.match(web, /act\('grant'\)/)
    assert.match(web, /accountChoices\(open\)/)
    assert.match(read('src/styles.css'), /\.facts-pick \{[\s\S]*?user-select: text;/, 'a clickable email can no longer be selected in the browser')
  })

  /*
   * "Can we make it easier to add songs to a setlist, kind of like how they
   * go through and hit favorites where it pulls up all of the presets and
   * they can just go through and select a bunch and then select done?"
   */
  test('songs are added to a setlist by ticking several from every preset, at both ends', async () => {
    const { addAll, togglePick, pickMatches } = await import('../src/lib/setlists.js')
    /* Ticked in an order, and untick takes one out without reshuffling. */
    let picked = []
    for (const n of [12, 3, 40]) picked = togglePick(picked, n)
    assert.deepEqual(picked, [12, 3, 40])
    assert.deepEqual(togglePick(picked, 3), [12, 40])
    /* Added at the end, in that order, and never twice. */
    assert.deepEqual(addAll([7, 3], [12, 3, 40]), [7, 3, 12, 40])
    assert.deepEqual(addAll([], []), [])
    /* "350" finds slot 350 whether or not its name has been read. */
    assert.ok(pickMatches('350', 350, undefined, '350'), 'a slot with no name read cannot be found by its number')
    assert.ok(pickMatches('master', 5, 'Master of Puppets', '005'))
    assert.ok(pickMatches('a01', 0, '', '000 A01'), 'a bank letter does not find its slot')
    assert.ok(!pickMatches('zzz', 5, 'Master of Puppets', '005'))
    assert.ok(pickMatches('', 5, undefined, '005'), 'an empty box hides slots')

    /* The phone: a full-screen list of every slot, tick in order, one Add. */
    const picker = read('mobile/src/components/SongPicker.js')
    assert.match(picker, /setPicked\(\(was\) => togglePick\(was, n\)\)/, 'a tap on the phone does not tick')
    assert.match(picker, /onAdd\?\.\(picked\)/)
    assert.match(picker, /`Add \$\{count\} song\$\{count === 1 \? '' : 's'\}`/, 'the phone’s button does not say how many')
    assert.ok(!/loadPreset/.test(picker), 'ticking a song on the phone changes what the amp plays')
    assert.match(read('mobile/src/screens/Setlists.js'), /onAdd=\{\(picked\) => setPresets\(addAll\(chosen\.presets, picked\)\)\}/)

    /* The browser: the same, in the sheet. */
    const web = read('src/components/Setlists.jsx')
    assert.match(web, /onClick=\{\(\) => setPicked\(\(was\) => togglePick\(was, s\.number\)\)\}/, 'a click in the browser does not tick')
    assert.match(web, /setPresets\(addAll\(chosen\.presets, picked\)\)/)
    assert.match(web, /`Add \$\{picked\.length\} song\$\{picked\.length === 1 \? '' : 's'\}`/)
    assert.ok(!/\.slice\(0, 40\)/.test(web), 'the browser still cuts the list at forty')
  })

  /*
   * "'Next: song name' under the Next button." One line at both ends, worked
   * out by one function from each end's own preset list, so the phone on the
   * stand and the computer beside it cannot say two different things about
   * the same press when their lists agree.
   */
  test('the line under Next says the same at both ends, for the same press', async () => {
    const bare = (t) => t.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')
    const stage = bare(read('mobile/src/screens/Stage.js'))
    const gig = bare(read('src/components/Gig.jsx'))
    const line = (src, start) => {
      const from = src.indexOf(start)
      assert.ok(from > 0, `${start} is not where this test reads it`)
      return src.slice(from, src.indexOf('\n', from))
    }
    const phoneAhead = line(stage, 'const ahead = nextWords(')
    const webLookup = line(gig, 'const slotNames = useMemo(')
    const webAhead = line(gig, 'const ahead = nextWords(')
    /* Each end's preset list as it stands: the phone's (presetNames.nameOf, what Presets draws), the browser's (the slots App hands the picker and Play). */
    assert.match(stage, /import \{ nameOf, useNamesHeard \} from '\.\.\/lib\/presetNames'/)
    /* nameOf, but for the row of the preset a real VP4 is on, which takes the name its record carried (test/vp4-safety.mjs): never a slot Next loads. */
    const presets = read('mobile/src/screens/Presets.js').replace(/\s+/g, ' ')
    assert.match(presets, /const name = nameHere\(n\)/, 'the phone’s preset list reads its names from somewhere else')
    assert.match(presets, /const nameHere = \(n\) => \(vp4Playing !== null && n === preset\.number \? vp4Playing : nameOf\(n\)\)/, 'the phone’s preset list reads its names from somewhere else')
    assert.match(stage, /\bnextWords,?\n[\s\S]*?\} from '\.\.\/lib\/lists'/, 'the phone works out its line some other way than the shared rule')
    assert.match(gig, /\bnextWords,\n[\s\S]*?\} from '\.\.\/lib\/setlists'/, 'the browser works out its line some other way than the shared rule')
    /* lib/lists hands the phone the generated copy of the browser's own file. */
    assert.match(read('mobile/src/lib/lists.js'), /export \{[^}]*\bnextWords\b[^}]*\} from '\.\/setlists'/)

    const phone = await import('../mobile/src/lib/setlists.js')
    const web = await import('../src/lib/setlists.js')
    const names = { 0: 'Clean', 7: 'Schism', 12: '<EMPTY>k Album Chug', 13: '', 40: 'Opener', 45: 'Plexi', 200: 'A Very Long Preset Name For A Small Phone' }
    /* The browser's list in its own shape: a row per slot, the unread ones with no name at all. */
    const slots = Array.from({ length: 256 }, (_, n) => (n in names ? { number: n, name: names[n] } : { number: n }))
    const phoneSays = new Function('order', 'preset', 'nextAt', 'nameOf', 'nextWords', `${phoneAhead}\nreturn ahead`)
    const webSays = new Function('order', 'preset', 'nextAt', 'slots', 'useMemo', 'nextWords', `${webLookup}\n${webAhead}\nreturn ahead`)
    for (const order of [null, [40, 7, 200], [7], [], [200, 12, 13, 0]]) {
      for (const current of [undefined, 0, 7, 12, 13, 40, 44, 200]) {
        for (const nextAt of [null, 0, 7, 12, 13, 40, 45, 46, 200, 300]) {
          const preset = current === undefined ? null : { number: current }
          const p = phoneSays(order, preset, nextAt, (n) => names[n], phone.nextWords)
          const w = webSays(order, preset, nextAt, slots, (fn) => fn(), web.nextWords)
          assert.deepEqual(p, w, `the phone and the browser disagree under Next (${JSON.stringify(order)} on ${current}, Next to ${nextAt})`)
        }
      }
    }

    /* And the words live in the shared rule, not in either screen's button. */
    const next = gig.slice(gig.lastIndexOf('<button', gig.indexOf('Next ›')), gig.indexOf('</button>', gig.indexOf('Next ›')))
    assert.deepEqual([...webButtons(next + '</button>')].filter((w) => w !== 'Next ›'), [], 'the browser’s Next carries words of its own under it')
    assert.ok(!stage.includes(web.NEXT_WRAPS) && !gig.includes(web.NEXT_WRAPS), 'one end spells out the end-of-setlist words itself, and the two can drift')
  })

  /* "Can we add that to the previous button as well?" The same, under Previous. */
  test('the line under Previous says the same at both ends, for the same press', async () => {
    const bare = (t) => t.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')
    const stage = bare(read('mobile/src/screens/Stage.js'))
    const gig = bare(read('src/components/Gig.jsx'))
    const line = (src, start) => {
      const from = src.indexOf(start)
      assert.ok(from > 0, `${start} is not where this test reads it`)
      return src.slice(from, src.indexOf('\n', from))
    }
    const phoneBehind = line(stage, 'const behind = previousWords(')
    const webLookup = line(gig, 'const slotNames = useMemo(')
    const webBehind = line(gig, 'const behind = previousWords(')
    assert.match(stage, /\bpreviousWords,?\n[\s\S]*?\} from '\.\.\/lib\/lists'/, 'the phone works out its line some other way than the shared rule')
    assert.match(gig, /\bpreviousWords,\n[\s\S]*?\} from '\.\.\/lib\/setlists'/, 'the browser works out its line some other way than the shared rule')
    assert.match(read('mobile/src/lib/lists.js'), /export \{[^}]*\bpreviousWords\b[^}]*\} from '\.\/setlists'/)

    const phone = await import('../mobile/src/lib/setlists.js')
    const web = await import('../src/lib/setlists.js')
    const names = { 0: 'Clean', 7: 'Schism', 12: '<EMPTY>k Album Chug', 13: '', 40: 'Opener', 45: 'Plexi', 200: 'A Very Long Preset Name For A Small Phone' }
    const slots = Array.from({ length: 256 }, (_, n) => (n in names ? { number: n, name: names[n] } : { number: n }))
    const phoneSays = new Function('order', 'preset', 'lastAt', 'nameOf', 'previousWords', `${phoneBehind}\nreturn behind`)
    const webSays = new Function('order', 'preset', 'lastAt', 'slots', 'useMemo', 'previousWords', `${webLookup}\n${webBehind}\nreturn behind`)
    for (const order of [null, [40, 7, 200], [7], [], [200, 12, 13, 0]]) {
      for (const current of [undefined, 0, 7, 12, 13, 40, 44, 200]) {
        for (const lastAt of [null, 0, 7, 12, 13, 40, 43, 44, 200, 300]) {
          const preset = current === undefined ? null : { number: current }
          const p = phoneSays(order, preset, lastAt, (n) => names[n], phone.previousWords)
          const w = webSays(order, preset, lastAt, slots, (fn) => fn(), web.previousWords)
          assert.deepEqual(p, w, `the phone and the browser disagree under Previous (${JSON.stringify(order)} on ${current}, Previous to ${lastAt})`)
        }
      }
    }

    /* And the words live in the shared rule, not in either screen's button. */
    const previous = gig.slice(gig.lastIndexOf('<button', gig.indexOf('‹ Previous')), gig.indexOf('</button>', gig.indexOf('‹ Previous')))
    assert.deepEqual([...webButtons(previous + '</button>')].filter((w) => w !== '‹ Previous'), [], 'the browser’s Previous carries words of its own under it')
    assert.ok(!stage.includes(web.PREVIOUS_WRAPS) && !gig.includes(web.PREVIOUS_WRAPS), 'one end spells out the start-of-setlist words itself, and the two can drift')
  })

  /*
   * "Where it says chain above the pedals, also put hold to switch channels.
   * So users know that they can just hold the things to switch between
   * channels, A B C and D."
   */
  test('the chain says a block can be held to switch channels, at both ends', () => {
    const stage = read('mobile/src/screens/Stage.js')
    assert.match(stage, /export const HOLD_FOR_CHANNELS = 'Hold to switch channels'/)
    assert.match(stage, /\{channels\?\.length > 1 && blocks\.length \? \(\s*<Text[^>]*>\s*\{HOLD_FOR_CHANNELS\}/, 'the words are not beside CHAIN, or show on a unit with no channels')
    /* The same condition as the hold itself, so the words never promise a hold that does nothing. */
    assert.match(stage, /onLongPress=\{\s*channels\?\.length > 1/)
    const gig = read('src/components/Gig.jsx')
    /* An AM4 amp's pedal says it switches the boost (shared/am4-boost.mjs), and can be held the same. */
    assert.match(gig, /title=\{boost \? `Tap to switch its boost on or off\.\$\{has \? ' Hold, or right-click, to switch channels\.' : ''\}` : has \? 'Tap to switch on or off\. Hold, or right-click, to switch channels\.' : undefined\}/, 'the browser’s tiles do not say they can be held')
  })

  /*
   * "On a tablet it's showing everything on the left side… it shows
   * everything in one line straight down as far as the scenes go instead of
   * putting them up on the side of each other."
   */
  test('a row of tiles never adds up to more than the row, on any screen density', async () => {
    const { tileWidth } = await import('../mobile/src/lib/tileGrid.js')
    const gap = 8
    /* A tablet's 1.33 is the one that wrapped; the rest are common phones. */
    for (const scale of [1, 1.33125, 1.5, 1.75, 2, 2.625, 2.75, 3, 3.5]) {
      for (let width = 280; width <= 1400; width += 7.3) {
        for (const n of [1, 2, 3, 4, 5, 6]) {
          const w = tileWidth(width, n, gap, scale)
          /* What the phone draws: each tile rounded UP to its own pixels. */
          const drawn = Math.ceil(w * scale) / scale
          const total = drawn * n + gap * (n - 1)
          assert.ok(total <= width + 1e-9, `${n} across ${width.toFixed(1)}pt at ${scale}x comes to ${total.toFixed(2)}pt, so the last one wraps`)
          /* And it is not visibly short either: within two pixels of the exact share. */
          const exact = (width - gap * (n - 1)) / n
          assert.ok(exact - w <= 2 / scale + 1e-9, `${n} across is ${(exact - w).toFixed(2)}pt narrower than it should be`)
        }
      }
    }
    assert.equal(tileWidth(0, 4, gap, 2), undefined)
    assert.match(read('mobile/src/screens/Stage.js'), /const tileWidth = \(width, n\) => tileWidthIn\(width, n, space\.sm, PixelRatio\.get\(\)\)/, 'the Play screen does not round its tiles to the screen')
  })

  /*
   * "Let's make the how to connect without internet its own button, kind of
   * like where it says how to connect computer, where it takes it to its own
   * page. The text on it right now is extremely small and hard to read."
   */
  test('playing with no internet is a card that opens its own page, in readable type', () => {
    const settings = read('mobile/src/screens/Settings.js')
    assert.match(settings, /label="PLAYING WITH NO INTERNET"[\s\S]{0,120}onPress=\{\(\) => setPage\('offline'\)\}/, 'there is no card for it on Phone & computer')
    assert.match(settings, /\{page === 'offline' && mayDrive\(purchase\) \? \(/, 'the page is not there, or is shown to somebody who has not paid')
    assert.match(settings, /head\('Playing with no internet', 'back'\)/)
    assert.match(settings, /const PARENT = \{ offline: 'link'[,} ]/, 'back from the page does not go to Phone & computer')
    assert.match(settings, /link: `‹ \$\{PAIR_TITLE\}`/)
    /* Each step its own card, not a paragraph in small type. */
    for (const step of ['1  SAME WIFI', '2  OPEN THE CODE', '3  POINT THE CAMERA', 'OR TYPE THE ADDRESS']) {
      assert.ok(settings.includes(`label="${step}"`), `the page has no ${step} card`)
    }
    const page = settings.slice(settings.indexOf("{page === 'offline'"), settings.indexOf("{page === 'about'"))
    assert.ok(!/font\.small/.test(page), 'the page is still in the small type')
    /* And the old paragraph is gone from the link page, not left beside the card. */
    assert.ok(!/<Section>Playing with no internet<\/Section>/.test(settings), 'the small-print version is still on Phone & computer')
  })

  /*
   * "How can I resend a verification email to this person. He said he didn't
   * get it. Can we set up a way for me to do that myself?" Resend was already
   * on Give someone access; Confirm their account now sits beside it, at
   * both ends, asks the server (grant-access, 'confirm'), then Checks again so
   * the lookup says Yes and the password reset takes the resend's place.
   */
  test('Confirm their account now is beside the resend on Give someone access, at both ends, and Checks again after', () => {
    for (const file of ['mobile/src/components/AccessTool.js', 'src/components/AccessTool.jsx']) {
      const ui = read(file)
      const flat = ui.replace(/\s+/g, ' ')
      /* One way to the server, as the signed-in account, for every button. */
      assert.match(flat, /const ask = async \(action, address\) => \{[\s\S]{0,200}?return accessAction\(\{ url: DEFAULT_PROJECT\.url, anonKey: DEFAULT_PROJECT\.anonKey, token: data\?\.session\?\.access_token, action, email: address \}\)/, `${file}: the buttons no longer ask as the signed-in account`)
      assert.match(flat, /setSaid\(await ask\(action, address\)\)/, `${file}: Check, Give and Take it back no longer go through ask`)
      const confirm = flat.slice(flat.indexOf('const confirmNow = async () => {'), flat.indexOf('const run = async'))
      assert.ok(confirm.length > 0, `${file}: there is no Confirm now`)
      assert.match(confirm, /const address = said\.email setBusy\('confirmNow'\) setHelped\(null\)/, `${file}: Confirm now is not busy while it works, or not for the address looked up`)
      assert.match(confirm, /const done = await ask\('confirm', address\) setHelped\(signInHelpWords\('confirmNow', address, done\.ok \? null : done\.message\)\)/, `${file}: Confirm now asks for something else, or does not say how it went`)
      assert.match(confirm, /if \(done\.ok\) setSaid\(await ask\('check', address\)\)/, `${file}: the page still says "Not yet" after confirming`)
      assert.match(confirm, /finally \{ setBusy\(null\) \}/)
      /* Drawn only for an address that has not confirmed, between the resend and the reset. */
      const button = ui.indexOf("'Confirm their account now'")
      assert.ok(button > ui.indexOf('Resend their "confirm your email" link') && button < ui.indexOf('Send them a password reset'), `${file}: Confirm now is not beside the resend`)
      assert.match(flat, /\{signInHelp\(said\)\.confirmNow \? \(/, `${file}: Confirm now is not tied to the lookup`)
      assert.match(flat, /busy === 'confirmNow' \? 'Confirming…' : 'Confirm their account now'/)
      assert.match(flat, /disabled=\{!!busy\} (onPress|onClick)=\{confirmNow\}|(onPress|onClick)=\{confirmNow\}/, `${file}: the button does not run Confirm now`)
      assert.ok(/\{confirmNowHint\(said\)\}/.test(ui), `${file}: no line says when to use it, or not for the address looked up`)
    }
    /* Both buttons wait for the others, as every button on the page does. */
    assert.match(read('mobile/src/components/AccessTool.js').replace(/\s+/g, ' '), /height=\{TAP\} disabled=\{!!busy\} onPress=\{confirmNow\}/)
    assert.match(read('src/components/AccessTool.jsx'), /disabled=\{!!busy\} onClick=\{confirmNow\}/)
  })

  /*
   * Where the confirmation email went. A customer signed up, both emails were
   * delivered to his Gmail, and he never saw either. Everywhere that says to
   * confirm from the email now says where else to look, and a sign-in turned
   * away for it offers to send the email again.
   */
  test('the confirmation email: where else to look, and Send it again when Sign in is turned away, at both ends', async () => {
    const { NOT_IN_INBOX, explainAuth, notConfirmed, sentAgain } = await import('../shared/relay-rules.mjs')
    assert.equal(NOT_IN_INBOX, 'If it isn’t in your inbox, look in Spam, Junk or Promotions for an email from Fractal Remote.')
    const refused = explainAuth('Email not confirmed')
    assert.ok(refused.endsWith(NOT_IN_INBOX), 'the "not confirmed" sign-in error does not say where else to look')
    assert.doesNotMatch(refused, /password/i, 'an unconfirmed account reads as a bad password again')
    assert.ok(!explainAuth('Invalid login credentials').includes('Spam'), 'a wrong password is told to look in Spam')
    assert.equal(sentAgain('a@b.c'), `A new confirmation email is on its way to a@b.c. ${NOT_IN_INBOX}`)
    /* Which refusal is which: by the service's code, or its words on an older one. */
    assert.equal(notConfirmed({ code: 'email_not_confirmed', message: 'Email not confirmed' }), true)
    assert.equal(notConfirmed({ message: 'Email not confirmed' }), true)
    assert.equal(notConfirmed({ code: 'invalid_credentials', message: 'Invalid login credentials' }), false, 'a wrong password is offered the confirmation email')
    assert.equal(notConfirmed(null), false)

    /* Each end's sign-in says which refusal it was. */
    assert.match(read('mobile/src/lib/relay.js').replace(/\s+/g, ' '), /noMatch: [^}]*, notConfirmed: notConfirmed\(error\) \}/, 'the phone cannot tell an unconfirmed email from any other refusal')
    assert.match(read('src/lib/remote.js'), /if \(error\) throw Object\.assign\(new Error\(explainAuth\(error\.message\)\), \{ notConfirmed: notConfirmed\(error\) \}\)/, 'the website cannot tell an unconfirmed email from any other refusal')

    /* The website: the Account made screen, and Send it again under the refusal on both forms. */
    const web = read('src/components/SignIn.jsx')
    const flatWeb = web.replace(/\s+/g, ' ')
    assert.match(flatWeb, /or tap the link in that email and then sign in\. \{NOT_IN_INBOX\}/, 'Account made does not say where else to look')
    assert.match(flatWeb, /setProblem\(err\.message\) setUnconfirmed\(mode === 'in' && err\?\.notConfirmed \? address : null\)/, 'the website does not notice the email was never confirmed, or forgets which address was refused')
    assert.match(flatWeb, /setNote\(null\) setUnconfirmed\(null\) const address = email\.trim\(\)/, 'a new try still offers to send the email again')
    /* To the address that was refused, not whatever the box says by the time it is tapped. */
    const webAgain = flatWeb.slice(flatWeb.indexOf('const sendAgain = async () => {'), flatWeb.indexOf('const confirm = async () => {'))
    assert.match(webAgain, /^const sendAgain = async \(\) => \{ const address = unconfirmed if \(!address\) return setProblem\(null\)/, 'Send it again on the website sends to what is in the box now')
    assert.doesNotMatch(webAgain, /email\.trim\(\)/, 'Send it again on the website reads the box')
    assert.match(webAgain, /await resendConfirmation\(\{ \.\.\.project\(\), email: address \}\) setCode\(''\) setNote\(sentAgain\(address\)\)/, 'Send it again sends something else, or does not say it went')
    /* And it keeps waiting, now on the new email and its new code. */
    assert.doesNotMatch(webAgain, /setUnconfirmed\(/, 'Send it again on the website takes the box for the code away')
    assert.match(flatWeb, /const waiting = \(mode === 'in' \|\| mode === 'sent'\) && unconfirmed const again = waiting && problem \? \( <button type="button" className="chip signin-wide" onClick=\{sendAgain\} disabled=\{off\}> Send the confirmation email again <\/button>/, 'Send it again shows on the Create account or Forgot side')
    assert.equal(web.split('{again}').length - 1, 3, 'Send it again is missing from one of the two forms, or from Account made')

    /* The phone: Account made says where else to look; a refusal offers Send it again. */
    const phone = read('mobile/src/screens/SignIn.js').replace(/\s+/g, ' ')
    assert.match(phone, /then sign in\.' \) setUnconfirmed\(\{ why: 'made', email: email\.trim\(\) \}\) setMode\('in'\)/, 'Account made on the phone does not say where else to look, or forgets which address the code is for')
    assert.match(phone, /\{note \? <Note>\{unconfirmed\?\.why === 'made' \? `\$\{note\} \$\{NOT_IN_INBOX\}` : note\}<\/Note> : null\}/)
    assert.match(phone, /if \(mode === 'in' && err\?\.notConfirmed\) setUnconfirmed\(\{ why: 'refused', email: email\.trim\(\) \}\)/, 'the phone does not notice the email was never confirmed, or forgets which address was refused')
    /*
     * Every new try, and every switch of side, starts it again, BEFORE
     * anything can be refused for another reason: a short password on Create
     * account once showed "Send the confirmation email again" under "Your
     * password is at least 6 characters."
     */
    assert.match(phone, /const go = async \(\) => \{ setUnconfirmed\(null\) if \(!ready\) \{/, 'a try refused for its password still offers the confirmation email')
    assert.match(phone, /const reset = async \(\) => \{ setUnconfirmed\(null\) if \(!email\.includes\('@'\)\)/, 'Forgot password, refused for its address, still offers the confirmation email')
    const switchTo = phone.slice(phone.indexOf('const switchTo = (next) => {'))
    assert.match(switchTo, /^const switchTo = \(next\) => \{ setMode\(next\) setError\(null\) setNote\(null\) setNoAccount\(false\) setUnconfirmed\(null\) \}/, 'Create account still remembers the sign-in that was refused')
    /* Under a refusal, and under a code that did not work, whose words say to send a new one. */
    assert.match(phone, /\{mode === 'in' && unconfirmed\?\.email && error \? \( <Press label="Send the confirmation email again" disabled=\{busy\} onPress=\{sendAgain\} \/>/, 'Send it again shows on the Create account side')
    /* To the address that was refused, not whatever the box says by the time it is tapped. */
    const phoneAgain = phone.slice(phone.indexOf('const sendAgain = async () => {'), phone.indexOf('const confirm = async () => {'))
    assert.match(phoneAgain, /^const sendAgain = async \(\) => \{ const address = unconfirmed\?\.email if \(!address\) return setBusy\(true\)/, 'Send it again on the phone sends to what is in the box now')
    assert.doesNotMatch(phoneAgain, /email\.(trim|includes)\(/, 'Send it again on the phone reads the box')
    assert.match(phoneAgain, /await resendConfirmation\(address\) setUnconfirmed\(\{ why: 'again', email: address \}\) setCode\(''\) setNote\(sentAgain\(address\)\)/, 'Send it again on the phone sends something else, does not say it went, or takes the box for the code away')
  })

  /*
   * THE CODE IN THE CONFIRMATION EMAIL, a second way past it.
   *
   * About one new customer in seven never tapped the email's link: on a
   * phone it opens a browser, the browser opens the website, and then they
   * have to find their way back to the app and sign in. So the same email
   * carries a code, and both ends take it where the person already is. The
   * link is untouched — the last test here holds it to that.
   */
  test('the code from a confirmation email: spaces and dashes out, six to ten digits, and the same words at both ends', async () => {
    const { cleanCode, codeRefused, CODE_NOT_DIGITS, CODE_DIDNT_WORK, CONFIRMED_SIGN_IN } = await import('../shared/confirm-code.mjs')
    assert.equal(cleanCode('123456'), '123456')
    assert.equal(cleanCode(' 123 456 '), '123456', 'a code typed with a space in it is refused')
    assert.equal(cleanCode('123-456'), '123456', 'a code typed with a dash in it is refused')
    assert.equal(cleanCode('123–456'), '123456', 'a code pasted with a long dash in it is refused')
    assert.equal(cleanCode('12 34-56 78'), '12345678', 'an eight-digit code in pairs is refused')
    assert.equal(cleanCode('1234567890'), '1234567890', 'the longest code the account service can send is refused')
    /* Pasted out of a mail app, with what came along that nobody can see. */
    for (const [pasted, what] of [
      ['906\u200B921', 'a zero-width space'],
      ['\u2060906921\u2060', 'word joiners'],
      ['906\u00AD921', 'a soft hyphen'],
      ['\u200E906921\u200F', 'direction marks'],
      ['\u202A906921\u202C', 'a direction embedding'],
      ['906\u00A0921', 'a non-breaking space'],
      ['\uFEFF906921', 'a byte-order mark'],
      ['906921\n', 'the line it was copied from']
    ]) {
      assert.equal(cleanCode(pasted), '906921', `a code pasted with ${what} in it is refused`)
    }
    for (const [typed, what] of [
      ['12345', 'too few digits'],
      ['12345678901', 'too many digits'],
      ['12a456', 'a letter in it'],
      ['abcdef', 'letters for digits'],
      ['123.456', 'a full stop in it'],
      ['', 'nothing in it'],
      [null, 'nothing at all'],
      [undefined, 'nothing at all']
    ]) {
      assert.equal(cleanCode(typed), null, `a code with ${what} would be sent to the account service`)
    }
    /* The words, once, for both ends. */
    assert.equal(CODE_NOT_DIGITS, 'Type the code from the email — it is all numbers.')
    assert.equal(CODE_DIDNT_WORK, 'That code didn’t work. Check it against the email, or send a new one.')
    assert.equal(CONFIRMED_SIGN_IN, 'Your account is confirmed. Sign in with your email and password.')
    /* A wrong code and an old one, by the service's code or its words on an older one; anything else is not the code's fault. */
    assert.equal(codeRefused({ code: 'otp_expired', message: 'Token has expired or is invalid' }), true)
    assert.equal(codeRefused({ message: 'Token has expired or is invalid' }), true)
    assert.equal(codeRefused({ message: 'Failed to fetch' }), false, 'no signal is called a wrong code')
    assert.equal(codeRefused({ code: 'email_not_confirmed', message: 'Email not confirmed' }), false)
    assert.equal(codeRefused(null), false)
    /* One rule: the phone's is a generated copy, and each end's sign-in takes it from there. */
    const { FILES } = await import('../scripts/sync-relay-rules.mjs')
    assert.ok(
      FILES.some((f) => f.source === '../shared/confirm-code.mjs' && f.target === '../mobile/src/lib/confirm-code.js' && !f.render),
      'the phone has no plain copy of the code rule'
    )
    assert.match(read('mobile/src/lib/relay.js'), /import \{ CODE_DIDNT_WORK, CODE_NOT_DIGITS, CONFIRMED_SIGN_IN, cleanCode, codeRefused \} from '\.\/confirm-code'/)
    assert.match(read('src/lib/remote.js'), /import \{ CODE_DIDNT_WORK, CODE_NOT_DIGITS, cleanCode, codeRefused \} from '\.\.\/\.\.\/shared\/confirm-code\.mjs'/)
    assert.match(read('src/components/SignIn.jsx'), /import \{ CONFIRMED_SIGN_IN \} from '\.\.\/\.\.\/shared\/confirm-code\.mjs'/)
  })

  /*
   * Each end's confirmWithCode, run rather than read: the file itself, beside
   * a pretend account service that writes down what it was asked and answers
   * what the test tells it to. Everything else either file imports is the
   * real thing, copied in, or nothing at all where nothing is used.
   */
  const confirmBench = async (end) => {
    const dir = mkdtempSync(join(tmpdir(), 'confirm-'))
    const files = {
      'package.json': '{ "type": "module" }',
      'service.mjs': `export const made = []
        export const asked = []
        export const said = { answer: () => ({ data: {}, error: { message: 'the bench was not told what to say' } }) }
        export const createClient = (url, key, options) => {
          made.push({ url, key, options })
          return { auth: { verifyOtp: async (params) => { asked.push(params); return said.answer(params) } } }
        }`,
      'nothing.mjs': 'export const logDebug = () => {}\nexport const decode = () => null\nexport const withRetry = (fn) => fn()\nexport const notForever = (...a) => fetch(...a)\nexport default {}\n',
      'confirm-code.mjs': read('shared/confirm-code.mjs'),
      'relay-rules.mjs': read('shared/relay-rules.mjs'),
      'device-word.mjs': read('shared/device-word.mjs'),
      'project.mjs': end === 'phone' ? read('mobile/src/lib/project.js') : read('desktop/lib/project.mjs')
    }
    const swaps =
      end === 'phone'
        ? [
            ["from '@react-native-async-storage/async-storage'", "from './nothing.mjs'"],
            ["from '@supabase/supabase-js'", "from './service.mjs'"],
            ["from './debugLog'", "from './nothing.mjs'"],
            ["from './project'", "from './project.mjs'"],
            ["from './decode'", "from './nothing.mjs'"],
            ["from './retry'", "from './nothing.mjs'"],
            ["from './notForever'", "from './nothing.mjs'"],
            ["from './relay-rules'", "from './relay-rules.mjs'"],
            ["from './confirm-code'", "from './confirm-code.mjs'"],
            ["from './device-word'", "from './device-word.mjs'"]
          ]
        : [
            ["from '../../desktop/lib/project.mjs'", "from './project.mjs'"],
            ["from '../../shared/relay-rules.mjs'", "from './relay-rules.mjs'"],
            ["from '../../shared/confirm-code.mjs'", "from './confirm-code.mjs'"],
            ["from '../../shared/device-word.mjs'", "from './device-word.mjs'"],
            ["from './debugLog.js'", "from './nothing.mjs'"],
            ["import('@supabase/supabase-js')", "import('./service.mjs')"]
          ]
    let src = read(end === 'phone' ? 'mobile/src/lib/relay.js' : 'src/lib/remote.js')
    for (const [from, to] of swaps) {
      assert.ok(src.includes(from), `${end}: no longer has ${from}; the bench needs telling`)
      src = src.replaceAll(from, to)
    }
    const left = [...src.matchAll(/^\s*(?:import|export)\b[^'\n]*from '([^']+)'|import\('([^']+)'\)/gm)]
      .map((m) => m[1] ?? m[2])
      .filter((p) => !(p.startsWith('./') && p.slice(2) in files))
    assert.deepEqual(left, [], `${end}: imports something new; the bench does not cover it`)
    files['under-test.mjs'] = src
    for (const [name, text] of Object.entries(files)) writeFileSync(join(dir, name), text)
    const at = (f) => pathToFileURL(join(dir, f)).href
    return {
      mod: await import(at('under-test.mjs')),
      service: await import(at('service.mjs')),
      done: () => rmSync(dir, { recursive: true, force: true })
    }
  }

  /* What both ends must do with the same answers from the account service. */
  const sameRulesAtEach = async (mod, service, end) => {
    const email = 'player@example.com'
    /* Not a code: said at once, and nothing asked. */
    for (const code of ['12345', '12a456', '', 'abcdef']) {
      await assert.rejects(mod.confirmWithCode({ email, code }), { message: 'Type the code from the email — it is all numbers.' }, `${end}: “${code}” is taken for a code`)
    }
    assert.equal(service.asked.length, 0, `${end}: something that is not a code went to the account service`)
    /* A code turned down, in plain words, wrong or old alike. */
    service.said.answer = () => ({ data: { user: null, session: null }, error: { code: 'otp_expired', status: 403, message: 'Token has expired or is invalid' } })
    await assert.rejects(mod.confirmWithCode({ email, code: '654321' }), { message: 'That code didn’t work. Check it against the email, or send a new one.' }, `${end}: a code turned down is said in the service's words`)
    /* No signal is not the code: said the way every sign-in says it. */
    service.said.answer = () => ({ data: {}, error: { message: 'Failed to fetch' } })
    await assert.rejects(mod.confirmWithCode({ email, code: '654321' }), { message: /^Couldn’t reach the account service\./ }, `${end}: no signal is called a wrong code`)
    /* And each that was asked was asked as an email code. */
    assert.deepEqual(service.asked, [
      { email, token: '654321', type: 'email' },
      { email, token: '654321', type: 'email' }
    ])
    service.asked.length = 0
  }

  test('the phone sends the code as an email code, cleaned, and is signed in by the answer', async () => {
    const { mod, service, done } = await confirmBench('phone')
    try {
      await sameRulesAtEach(mod, service, 'phone')
      service.said.answer = () => ({ data: { user: { id: 'acct-1' }, session: { access_token: 't', user: { id: 'acct-1' } } }, error: null })
      assert.equal(await mod.confirmWithCode({ email: 'player@example.com', code: ' 123-456 ' }), 'acct-1', 'a good code does not hand back the account')
      assert.deepEqual(service.asked, [{ email: 'player@example.com', token: '123456', type: 'email' }], 'the code was not sent as an email code, cleaned of its space and dash')
      /* Signed in, the way signIn leaves it: the id the link and everything after it reads. */
      assert.equal(mod.remoteUserId(), 'acct-1', 'a good code leaves the phone signed in as nobody')
      /* The one client for the life of the app, the one Sign in uses, so the session is where the rest of the app looks. */
      assert.equal(service.made.length, 1, 'the code was checked on a client of its own, which the rest of the app never sees')
      /* Confirmed but handed no session: told to sign in, and nobody is taken for signed in. */
      service.said.answer = () => ({ data: { user: { id: 'acct-1' }, session: null }, error: null })
      await assert.rejects(mod.confirmWithCode({ email: 'player@example.com', code: '123456' }), { message: 'Your account is confirmed. Sign in with your email and password.' })
      assert.equal(mod.remoteUserId(), null, 'an answer with no session left somebody signed in')
    } finally {
      done()
    }
  })

  test('the website sends the code the same way, keeps no session from it, and leaves the sign-in to the form', async () => {
    const { mod, service, done } = await confirmBench('web')
    try {
      await sameRulesAtEach(mod, service, 'website')
      service.said.answer = () => ({ data: { user: { id: 'acct-2' }, session: { access_token: 't', user: { id: 'acct-2' } } }, error: null })
      assert.equal(await mod.confirmWithCode({ email: 'fan@example.com', code: '98 76 54' }), 'acct-2')
      assert.deepEqual(service.asked, [{ email: 'fan@example.com', token: '987654', type: 'email' }], 'the code was not sent as an email code, cleaned of its spaces')
      const { DEFAULT_PROJECT } = await import('../desktop/lib/project.mjs')
      const client = service.made.at(-1)
      assert.equal(client.url, DEFAULT_PROJECT.url, 'the code was checked against another project')
      assert.equal(client.options?.auth?.persistSession, false, 'the website keeps a session from the code that nothing signed in with')
      /* Not signed in by it: the form's own Sign in does that, with the errand it was opened for. */
      assert.equal(mod.remoteUserId(), null, 'the code signed the website in behind the form’s back')
      /* A project of its own when one is set, as Send it again does. */
      await mod.confirmWithCode({ url: 'https://other.test', anonKey: 'k', email: 'fan@example.com', code: '987654' })
      assert.equal(service.made.at(-1).url, 'https://other.test')
    } finally {
      done()
    }
  })

  test('the box for the code shows wherever an account waits on its email, at both ends, and a good code goes the way Sign in goes', () => {
    const flat = (t) => t.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ').replace(/\s+/g, ' ')

    /* The phone: every waiting state carries the address, and the box waits on that alone. */
    const phone = flat(read('mobile/src/screens/SignIn.js'))
    assert.match(phone, /setUnconfirmed\(\{ why: 'made', email: email\.trim\(\) \}\)/, 'Account made forgets which address the code is for')
    assert.match(phone, /setUnconfirmed\(\{ why: 'refused', email: email\.trim\(\) \}\)/, 'a refused sign-in forgets which address the code is for')
    const opens = phone.indexOf("{mode === 'in' && unconfirmed?.email ? ( <View")
    assert.ok(opens > 0, 'the phone has no box for the code, or it waits on one waiting state rather than any')
    const phoneBox = phone.slice(opens, phone.indexOf(') : null}', opens))
    for (const needed of [
      'placeholder="Code from the email"',
      'accessibilityLabel="Code from the email"',
      'textContentType="oneTimeCode"',
      'autoComplete="one-time-code"',
      'keyboardType="number-pad"',
      'onSubmitEditing={() => !busy && confirm()}',
      "<Press label={confirming ? 'Confirming…' : 'Confirm account'} disabled={busy} onPress={confirm} />"
    ]) {
      assert.ok(phoneBox.includes(needed), `the phone's box for the code lost ${needed}`)
    }
    /* A good code: confirmed, then exactly what a good Sign in does, and nothing it does not. */
    const confirm = phone.slice(phone.indexOf('const confirm = async () => {'), phone.indexOf('const switchTo ='))
    assert.match(confirm, /^const confirm = async \(\) => \{ const address = unconfirmed\?\.email if \(!address\) return/, 'the code goes to whatever the box says now, not the address that is waiting')
    assert.match(confirm, /try \{ await confirmWithCode\(\{ email: address, code \}\) onSignedIn\(\) \} catch \(err\) \{ setError\(err\.message\) \}/, 'a good code does not go the way a good Sign in goes')
    assert.ok(!/onAccountMade|linkNewAccount|signIn\(/.test(confirm), 'a good code hands a purchase over a second time, or signs in again')
    assert.match(phone, /import \{ NOT_IN_INBOX, confirmWithCode, resendConfirmation, sendPasswordReset, sentAgain, signIn, signUp \} from '\.\.\/lib\/relay'/)

    /* The website: the same box on Account made and under a refusal, on both of its forms. */
    const raw = read('src/components/SignIn.jsx')
    const web = flat(raw)
    assert.match(web, /if \(needsConfirmation\) \{ setUnconfirmed\(address\) setMode\('sent'\) \}/, 'Account made forgets which address the code is for')
    assert.match(web, /setUnconfirmed\(mode === 'in' && err\?\.notConfirmed \? address : null\)/)
    assert.match(web, /const waiting = \(mode === 'in' \|\| mode === 'sent'\) && unconfirmed/, 'the box waits on something other than an address, on Account made and the Sign in side')
    const webBox = web.slice(web.indexOf('const codeBox = waiting ? ('), web.indexOf("if (mode === 'sent') {"))
    for (const needed of [
      '<span>Code from the email</span>',
      'inputMode="numeric"',
      'autoComplete="one-time-code"',
      "if (e.key !== 'Enter') return e.preventDefault() if (!off) confirm()",
      "className={mode === 'sent' ? 'primary signin-wide' : 'chip signin-wide'} onClick={confirm} disabled={off}",
      "{confirming ? 'Confirming…' : 'Confirm account'}"
    ]) {
      assert.ok(webBox.includes(needed), `the website's box for the code lost ${needed}`)
    }
    assert.equal(raw.split('{codeBox}').length - 1, 3, 'the box for the code is missing from Account made or one of the two forms')
    const sent = web.slice(web.indexOf("if (mode === 'sent') {"), web.indexOf('if (stage) {'))
    assert.ok(sent.includes('{codeBox}'), 'Account made has no box for the code')
    assert.ok(sent.includes('{problem}'), 'a code that did not work says nothing on Account made')
    /* A good code: the form's own sign-in, for the address that was waiting, with the password still in it. */
    const webConfirm = web.slice(web.indexOf('const confirm = async () => {'), web.indexOf('const waiting ='))
    assert.match(webConfirm, /^const confirm = async \(\) => \{ const address = unconfirmed if \(!address\) return/)
    assert.match(webConfirm, /await confirmWithCode\(\{ \.\.\.project\(\), email: address, code \}\)/)
    assert.match(webConfirm, /if \(password\.length >= 6\) await onSubmit\(\{ email: address, password \}\) else setNote\(CONFIRMED_SIGN_IN\)/, 'a good code does not go the way the form’s Sign in goes')

    /* The same sentence at both ends for an account made with nothing bought. */
    const said = 'Type the code from the email we just sent in the box below, or tap the link in that email and then sign in.'
    assert.ok(phone.includes(`'Account made. ${said}'`), 'the phone’s Account made says something else')
    assert.ok(web.includes(`${said} {NOT_IN_INBOX}`), 'the website’s Account made says something else')
  })

  test('the email’s link still works exactly as it did, at both ends', () => {
    const phone = read('mobile/src/lib/relay.js')
    const web = read('src/lib/remote.js')
    for (const [end, src, client] of [['phone', phone, 'supabase()'], ['website', web, 'c']]) {
      /* The email is the same email: made by the same sign-up, sent again the same way. */
      assert.ok(src.includes(`await ${client}.auth.signUp({ email, password })`), `${end}: the sign-up that sends the email changed`)
      assert.ok(src.includes(`await ${client}.auth.resend({ type: 'signup', email })`), `${end}: Send it again sends something other than the confirmation email`)
      /* And the code is the only thing checked in the app: one verifyOtp, in confirmWithCode, never the link's token. */
      assert.equal(src.split('.verifyOtp(').length - 1, 1, `${end}: the code is checked in more than one place`)
      const fn = src.slice(src.indexOf('export async function confirmWithCode('))
      assert.ok(fn.slice(0, fn.indexOf('\n}\n')).includes(".verifyOtp({ email, token, type: 'email' })"), `${end}: the code is checked outside confirmWithCode`)
      assert.ok(!/token_hash|emailRedirectTo/.test(src), `${end}: the link's route was moved into the app`)
    }
    /* The website still reads a session out of the address the link opens; the phone never had one to read. */
    assert.ok(!/detectSessionInUrl/.test(web), 'the website stopped picking up the session the link brings')
    assert.match(phone, /detectSessionInUrl: false/)
    /* And after the link, Sign in is where it was at both ends. */
    const webForm = read('src/components/SignIn.jsx').replace(/\s+/g, ' ')
    assert.match(webForm, /<button className="chip signin-wide" type="button" onClick=\{\(\) => setMode\('in'\)\} disabled=\{off\}> Sign in <\/button>/, 'Account made lost its way to Sign in after the link')
    const phoneForm = read('mobile/src/screens/SignIn.js').replace(/\s+/g, ' ')
    assert.match(phoneForm, /\} else \{ await signIn\(\{ email: email\.trim\(\), password \}\) \} onSignedIn\(\)/, 'Sign in after the link no longer signs in')
    assert.match(phoneForm, /label=\{busy \? 'Working…' : mode === 'up' \? 'Create account' : 'Sign in'\}/)
  })

  /*
   * "The app pretty much always uses the word phone instead of device. This
   * app will work on phones, iPads, tablets … is there a way to detect what
   * device they're using and change what it says?" (16 October 2026). There
   * is, with nothing new to install: the words are shared/device-word.mjs's,
   * and each end says what it is once, at the start.
   */
  test('the app names the device it is on: an iPhone, an iPad, an Android phone or tablet, or a browser on a computer', async () => {
    const d = await import('../shared/device-word.mjs')
    /* The phone app, from what React Native says. */
    assert.equal(d.appDevice({ os: 'ios', pad: false, width: 393, height: 852 }), 'phone')
    assert.equal(d.appDevice({ os: 'ios', pad: true, width: 820, height: 1180 }), 'ipad')
    assert.equal(d.appDevice({ os: 'android', width: 411, height: 914 }), 'phone')
    assert.equal(d.appDevice({ os: 'android', width: 800, height: 1280 }), 'tablet')
    assert.equal(d.appDevice({ os: 'android', width: 1280, height: 800 }), 'tablet', 'a tablet on its side is a phone')
    assert.equal(d.appDevice({}), 'phone')
    /* The website, from the browser. iPadOS Safari calls itself a Mac, and owns up to the touch screen. */
    const mac = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15'
    assert.equal(d.browserDevice({ userAgent: mac, touchPoints: 5 }), 'ipad')
    assert.equal(d.browserDevice({ userAgent: mac, touchPoints: 0 }), 'browser', 'a Mac is called an iPad')
    assert.equal(d.browserDevice({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Mobile/15E148' }), 'phone')
    assert.equal(d.browserDevice({ userAgent: 'Mozilla/5.0 (Linux; Android 15; Pixel 9) Chrome/129.0 Mobile Safari/537.36' }), 'phone')
    assert.equal(d.browserDevice({ userAgent: 'Mozilla/5.0 (Linux; Android 14; SM-X710) Chrome/129.0 Safari/537.36' }), 'tablet')
    assert.equal(d.browserDevice({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/129.0 Safari/537.36' }), 'browser')
    /* An iPhone asking for the desktop site says Macintosh too, from a phone's screen. */
    assert.equal(d.browserDevice({ userAgent: mac, touchPoints: 5, width: 390, height: 844 }), 'phone', 'an iPhone in desktop mode is called an iPad')
    assert.equal(d.browserDevice({ userAgent: mac, touchPoints: 5, width: 820, height: 1180 }), 'ipad')
    /* Chrome on a big Android tablet asks for the desktop site by default, and says only Linux. */
    const desktopChrome = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36'
    assert.equal(d.browserDevice({ userAgent: desktopChrome, touchPoints: 5, width: 800, height: 1280 }), 'tablet', 'an Android tablet in desktop mode is called a browser')
    assert.equal(d.browserDevice({ userAgent: desktopChrome, touchPoints: 0, width: 1920, height: 1080 }), 'browser', 'a Linux computer is called a tablet')
    assert.equal(d.browserDevice({ userAgent: 'Mozilla/5.0 (X11; CrOS x86_64 15000.0.0) Chrome/129.0', touchPoints: 10, width: 800, height: 1280 }), 'browser', 'a Chromebook is called a tablet')
    /* The words, in a sentence, at the start of one, and in the cards' capitals. */
    assert.deepEqual(['phone', 'ipad', 'tablet', 'browser', 'computer'].map((k) => d.deviceNoun(k)), ['phone', 'iPad', 'tablet', 'browser', 'phone or tablet'])
    assert.deepEqual(['phone', 'ipad', 'tablet'].map((k) => d.DeviceNoun(k)), ['Phone', 'iPad', 'Tablet'])
    /* Never iPAD: Apple's marketing guidelines forbid its names in capitals, and a small i before capitals. */
    assert.deepEqual(['phone', 'ipad', 'tablet'].map((k) => d.DEVICE_NOUN(k)), ['PHONE', 'iPad', 'TABLET'])
    assert.deepEqual(['phone', 'ipad', 'browser'].map((k) => d.onThis(k)), ['on this phone', 'on this iPad', 'in this browser'])
    assert.deepEqual(['phone', 'ipad', 'tablet', 'computer'].map((k) => d.pairTitle(k)), ['Phone & computer', 'iPad & computer', 'Tablet & computer', 'Phone & computer'])
    assert.equal(d.setDevice('a toaster'), 'phone', 'something unknown is not a phone')

    /* And the shared sentences follow what the end said it is. */
    const { linkChain } = await import('../shared/link-chain.mjs')
    const onboarding = await import('../shared/onboarding.mjs')
    const metronome = await import('../shared/metronome.mjs')
    const { fixById } = await import('../shared/troubleshooting.mjs')
    try {
      d.setDevice('ipad')
      assert.equal(linkChain({ here: 'phone', demo: true }).at(-1).label, 'THIS iPad')
      assert.equal(onboarding.P1.head, 'CONTROL YOUR FRACTAL FROM YOUR iPad.')
      assert.equal(onboarding.P1.sub, 'Presets, scenes, blocks, tuner and tap tempo - all on your iPad.', 'an iPad is in a pocket')
      assert.equal(onboarding.CHAIN.at(-1).phoneTitle, 'THIS iPad')
      assert.equal(metronome.PLACES.find((p) => p.key === 'phone').label, 'iPad')
      assert.match(metronome.unitClick('am4').why, /so the iPad keeps time\.$/)
      assert.match(fixById('connect').steps.at(-1), /^If your iPad still cannot reach the computer/)
      /* The browser's click is the page's, whatever the device. */
      assert.match(metronome.unitClick('am4', { ours: 'this screen' }).why, /so this screen keeps time\.$/)
      d.setDevice('computer')
      assert.equal(linkChain({ here: 'computer', phone: { remote: 'off' } }).at(-1).label, 'YOUR PHONE OR TABLET')
      assert.equal(onboarding.CHAIN.at(-1).phoneTitle, 'YOUR PHONE OR TABLET', 'the computer calls itself the remote')
      assert.match(fixById('connect').steps.at(-1), /^If your phone or tablet still cannot reach the computer/)
      d.setDevice('browser')
      assert.equal(onboarding.P6.address, 'TYPE THIS ON YOUR COMPUTER', 'a laptop is told not to type it on itself')
    } finally {
      d.setDevice('phone')
    }
    assert.equal(onboarding.P1.head, 'CONTROL YOUR FRACTAL FROM YOUR PHONE.')

    /* Each end says it once, at the start: the phone app before anything else is loaded, the website by its role. */
    assert.match(read('mobile/App.js'), /^\/\*[^\n]*\*\/\nimport '\.\/src\/lib\/thisDevice'\n/, 'the phone app does not say which device it is first')
    assert.match(read('mobile/src/lib/thisDevice.js'), /setDevice\(appDevice\(\{ os: Platform\.OS, pad: Platform\.isPad === true, width: screen\.width, height: screen\.height \}\)\)/)
    const { deviceForRole } = await import('../src/lib/link.js')
    assert.equal(deviceForRole('mac'), 'computer')
    /* The demo is the Mac's role everywhere; one that cannot host is the device it is on (App.jsx's phoneEnd). */
    assert.equal(deviceForRole('mac', { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)' }, {}, false), 'phone')
    assert.equal(deviceForRole('mac', { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)' }, {}, true), 'computer')
    assert.equal(deviceForRole('remote', { userAgent: mac, maxTouchPoints: 5 }, {}), 'ipad')
    assert.equal(deviceForRole('wifi', { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)' }, {}), 'phone')
    assert.equal(deviceForRole('remote', { userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }, {}), 'browser')
    /* An iPad cannot be paired with a watch, so it is not offered one. */
    const settings = read('mobile/src/screens/Settings.js')
    assert.equal((settings.match(/Platform\.OS === 'ios' && deviceKind\(\) !== 'ipad' && watchSupported\(\)/g) || []).length, 2, 'an iPad is offered the Apple Watch')
  })
}

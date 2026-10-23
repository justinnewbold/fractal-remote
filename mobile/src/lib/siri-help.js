/**
 * SETTINGS → SIRI, AS WORDS: what the page says, and nothing it draws.
 *
 * "Let's add all of the Siri commands to the build that we can and update a
 * section in the app that will say how to manage Siri." (Justin, 23 October
 * 2026.) The page is components/SiriHelp; these are its words, kept apart so
 * a test can read every one of them without a phone: test/siri-page.mjs holds
 * each phrase here to the Swift's own (mobile/targets/watch/_shared/
 * SiriShortcuts.swift), each link to lib/siri-rule parseLink, the tempo range
 * to shared/tempo.mjs, and all of it to plain US words that never say "this
 * phone" and never call the app official.
 *
 * WHO SEES WHICH PAGE (Settings.js asks lib/siri useSiriLinksOpen first, the
 * links' own gate, so the page is never offered where nothing on it works):
 *
 *   - an iPhone or iPad whose copy of the app has the Siri phrases (lib/
 *     siriPipe siriPresent): the whole page, phrases first;
 *   - an iPhone or iPad without them, on Justin's account: the links half,
 *     which is how his own named shortcuts reach the app today;
 *   - Android: the links, for Tasker and apps like it. There is no Siri, and
 *     no voice route Google opens to apps like this one yet.
 *
 * Every fact about Apple's settings is from Apple's own pages for iOS 27,
 * read on 23 October 2026, and is said no more firmly than they say it:
 *
 *   - Siri asks to unlock first: the Shortcuts User Guide, "Use Siri to run
 *     shortcuts with your voice" ("When your device is locked and you run a
 *     shortcut that opens an app, Siri asks to unlock your device before
 *     continuing"). Every command here opens the app.
 *   - Lock Screen access: the iPhone User Guide for iOS 27, "Turn on Lock
 *     Screen features" (Settings → Face ID & Passcode, or Touch ID &
 *     Passcode, → Allow Access When Locked). Its list is not given, so the
 *     page says to look there. iOS 26 and 18 have the switch in Siri's own
 *     settings, as Allow Siri When Locked ("Change Siri settings", 26.0).
 *   - Turning Siri off for one app: iOS 27's "Change Siri settings" puts it
 *     at Settings → Siri → App Access → the app, and says the switches there
 *     depend on the app and the version of Siri; Apple's Siri privacy page
 *     (apple.com/legal/privacy/data/en/ask-siri-dictation) names the switch,
 *     Use with Siri Requests, at Settings → Siri → Apps → the app, the iOS 26
 *     words. And Turn Off Siri, for all of it, is iOS 27's own.
 *   - Siri's language: Settings → Siri → Language (iOS 27).
 *   - The Action button: Settings → Action Button → swipe to Shortcut →
 *     Choose a Shortcut (iPhone User Guide, and the Shortcuts guide's "Run
 *     shortcuts with the Action button": "iPhone 15 Pro or later"). Not on an
 *     iPad, which has none.
 *   - Back Tap: Settings → Accessibility → Touch → Back Tap → Double Tap or
 *     Triple Tap → a shortcut (both guides). An iPhone feature, on every
 *     iPhone the app installs on (iOS 16.4: iPhone 8 and later).
 *   - The watch answering instead: Apple's "How Siri works with multiple
 *     devices" (HT208472): the device that heard best, or was raised or used
 *     last, answers; raise or press the button of the one you mean.
 *   - Shortcuts: the App Shortcuts list in the Shortcuts app, an app's
 *     shortcuts as steps of your own ("Run app shortcuts"), a shortcut run by
 *     saying its name, and one named like a standard Siri command running
 *     instead of it ("Use Siri to run shortcuts"); Open URLs, the step that
 *     opens a link ("Use another app's URL scheme").
 *
 * And no promise about what Siri says back: Apple's docs make none for a
 * command that brings the app to the front, so the page promises Play's own
 * note, as a tap has, and says Siri "may" speak.
 *
 * Nothing here imports anything: the device in hand comes in as `noun`
 * (lib/device-word deviceNoun) and everything else as a plain fact.
 */

/** What Siri hears for a pedal, the Swift's PedalKind words, Boost last (an AM4 amp's). */
export const SIRI_PEDAL_WORDS = Object.freeze([
  'Delay',
  'Drive',
  'Reverb',
  'Chorus',
  'Flanger',
  'Phaser',
  'Tremolo',
  'Pitch',
  'Wah',
  'Compressor',
  'Filter',
  'Rotary',
  'Gate',
  'Boost'
])

/** The tempos Siri takes: every unit with a tempo the app can set (shared/tempo.mjs UNIT_BPM). */
export const SIRI_TEMPO = Object.freeze({ min: 24, max: 250 })

/** The links, as a person types them into a shortcut, and what each does. Never one for Tuner on. */
export const SIRI_LINKS = Object.freeze([
  Object.freeze({ url: 'fractalremote://next', does: 'Next song' }),
  Object.freeze({ url: 'fractalremote://previous', does: 'Previous song' }),
  Object.freeze({ url: 'fractalremote://scene/3', does: 'Scene 3: any scene from 1 to 8' }),
  Object.freeze({ url: 'fractalremote://tuner/off', does: 'Tuner off, from any screen' })
])

const list = (words) => `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`

/* The pedals that are on every unit: everything but Boost, which is the AM4 amp's. */
const PEDALS_SAID = list(SIRI_PEDAL_WORDS.filter((w) => w !== 'Boost'))

/**
 * The row on Settings: its title and its one line. A row's line is one line
 * (Settings SetupRow), and one of 43 characters ran out on a 320-wide phone,
 * so each is kept well short of that.
 */
export function siriRow({ os = 'ios', native = false } = {}) {
  if (os === 'android') return { title: 'Links for Tasker', status: 'Songs, scenes and tuner off' }
  return { title: 'Siri', status: native ? 'Scenes, songs and pedals by voice' : 'Your own shortcuts, by link' }
}

/*
 * THE PHRASES, the first of each of the Swift's, with what each does. `say`
 * is what is spoken, word for word as the Swift has it with "Fractal Remote"
 * for the app's name and an example in place of the scene or the pedal.
 */
const PHRASES = (noun) => [
  {
    say: ['Scene 3 in Fractal Remote'],
    does: 'Any scene from 1 to 8, or 1 to 4 on an AM4. The same as tapping its tile.'
  },
  {
    say: ['Next song in Fractal Remote'],
    does: 'The Next button: the next song in your setlist, with its own scene and tempo, or the next preset.'
  },
  {
    say: ['Previous song in Fractal Remote'],
    does: 'The Previous button, the same way.'
  },
  {
    say: ['Load a preset in Fractal Remote'],
    does: 'Siri asks which number. Say the number Play shows in front of the name: 12 for 012, and on an AM4, 12 for 012 D01. Like any preset change, it throws away changes you haven’t saved, except that the number of the preset already on screen does nothing.'
  },
  {
    say: ['Set the tempo in Fractal Remote'],
    does: `Siri asks for the tempo. Anything from ${SIRI_TEMPO.min} to ${SIRI_TEMPO.max}. A VP4 has no tempo the app can set.`
  },
  {
    say: ['Delay on in Fractal Remote', 'Delay off in Fractal Remote'],
    does: `Also ${PEDALS_SAID}. On an AM4, Boost is the amp’s boost. Only when the preset has exactly one pedal of that kind: with two delays, use the screen.`
  },
  {
    say: ['Tuner on in Fractal Remote'],
    does: 'Opens the tuner on Play. The tuner mutes your rig.'
  },
  {
    say: ['Tuner off in Fractal Remote'],
    does: `Closes the tuner, from any screen of the app on this ${noun}.`
  }
]

/* The Play rule, said the same on every page: lib/siri's onPlay and tunerOff. */
const PLAY_RULE = (noun, what) => [
  `${what} work only with the Play screen open. Anywhere else in the app, ${what === 'They' ? 'nothing is sent' : `Siri says to open Play on this ${noun}`}.`,
  'Tuner off is the exception: it works from any screen, and if the connection is asleep it waits for it and tries again, so your rig isn’t left muted.'
]

/* The tap rule (relay-rules TAP_DEADLINE_MS, counted from when the app received the command). */
const HOW_FAST = [
  'Siri takes a moment to understand you, so use it between songs, not on a downbeat. Once Siri has it, the change goes out as fast as a tap.',
  'And the same rule as a tap: a change that can’t reach your unit within a second and a half isn’t sent at all, so nothing lands late in the middle of a verse. Play then shows Not sent. Say it again.'
]

const LINKS_RULE = [
  'There’s no link for Tuner on, so a link on a web page or in a message can never mute your rig.',
  'Use one link per shortcut: a shortcut doesn’t wait for one link to land before it opens the next.'
]

/* The Action button and Back Tap: an iPhone's, never an iPad's. */
const IPHONE_BUTTONS = [
  {
    title: 'Action button',
    lines: [
      'On an iPhone with an Action button (iPhone 15 Pro and later): Settings → Action Button, swipe to Shortcut, tap Choose a Shortcut, and pick one, such as a shortcut of your own made from Fractal Remote’s commands.'
    ]
  },
  {
    title: 'Back Tap',
    lines: [
      'Settings → Accessibility → Touch → Back Tap, choose Double Tap or Triple Tap, then pick a shortcut. Use Triple Tap for anything that changes your sound: a double tap is easier to set off by accident.'
    ]
  }
]

/* Locked, as Apple says it (see the top). `system` is iOS or iPadOS. */
const LOCKED = (noun, system) =>
  `With this ${noun} locked, Siri asks you to unlock it first, because these commands open the app. If Siri won’t listen at all while it’s locked: on ${system} 27, look under Allow Access When Locked in Settings → Face ID & Passcode (or Touch ID & Passcode). On ${system} 26 and earlier, turn on Allow Siri When Locked in Settings → Siri.`

/**
 * The page, as sections in order: each `{ title, note?, phrases?, links?,
 * lines? }`. `os` is 'ios' or 'android'; `kind` lib/device-word's ('phone',
 * 'ipad', 'tablet'); `native` whether this copy has the Siri phrases; `noun`
 * what to call the device in hand (deviceNoun()).
 */
export function siriPage({ os = 'ios', kind = 'phone', native = false, noun = 'phone' } = {}) {
  if (os === 'android') {
    return [
      {
        title: 'Links for Tasker',
        note: 'There are no voice commands on Android yet. What there is: links that an automation app, such as Tasker, can open. In the app, add a step that opens a link, and give it one of these.',
        links: SIRI_LINKS
      },
      { title: 'Keep Play open', lines: PLAY_RULE(noun, 'They') },
      {
        title: 'How fast',
        lines: [
          `Most reliable with Play already on screen. Android cuts the connection while the app is in the background, so a link that brings the app back may show Not sent the first time. The next one goes.`,
          'A change that can’t reach your unit within a second and a half isn’t sent at all, the same as a tap, so nothing lands late in the middle of a verse.'
        ]
      },
      { title: 'Good to know', lines: LINKS_RULE }
    ]
  }

  const system = kind === 'ipad' ? 'iPadOS' : 'iOS'
  const iphone = kind !== 'ipad'
  const linksSection = (lead) => ({ title: 'Links', note: lead, links: SIRI_LINKS, lines: LINKS_RULE })

  if (!native) {
    /* His account on a copy without the phrases: his own named shortcuts, by link. */
    return [
      linksSection(
        'Siri runs a shortcut when you say its name. In Apple’s Shortcuts app, make one whose only step is Open URLs with one of these links, and call it, for example, “Scene three”. Then say “Siri, scene three”. Nothing is said back: Play shows what happened.'
      ),
      { title: 'Keep Play open', lines: PLAY_RULE(noun, 'They') },
      { title: 'How fast', lines: HOW_FAST },
      { title: 'Good to know', lines: [LOCKED(noun, system), 'Fractal Remote’s own Siri phrases come with a newer version of the app.'] },
      ...(iphone ? IPHONE_BUTTONS : [])
    ]
  }

  return [
    {
      title: 'What to say',
      note: 'Start Siri the way you always do, then say one of these. Every phrase has “Fractal Remote” in it: Apple asks for the app’s name, and it keeps Siri from changing your sound by accident.',
      phrases: PHRASES(noun),
      lines: ['You can also put the app’s name first: “Fractal Remote next song”.', 'It all works in the demo too.']
    },
    { title: 'Keep Play open', lines: PLAY_RULE(noun, 'All of these except Tuner off') },
    { title: 'How fast', lines: [...HOW_FAST, 'Play shows what happened, as it does for a tap, and Siri may say it too.'] },
    {
      title: 'Good to know',
      lines: [
        LOCKED(noun, system),
        ...(iphone
          ? ['If you wear an Apple Watch, the watch may answer instead, and these commands don’t run on the watch. Raise the iPhone first, or hold its side button to talk to Siri on the iPhone.']
          : []),
        'In a loud room Siri may not hear you over the rig. Starting Siri with the button, rather than by voice, means it doesn’t have to hear “Siri” first.',
        `While Siri listens, this ${noun}’s own metronome click may stop.`,
        'The phrases are in English, so Siri’s language has to be English: Settings → Siri → Language.'
      ]
    },
    {
      title: 'Your own shortcuts',
      lines: [
        'Every command is also in Apple’s Shortcuts app, under App Shortcuts → Fractal Remote, and can be a step in a shortcut of your own. For example, a shortcut called “Song four” that loads preset 4, then goes to scene 2, then sets the tempo to 120. Say “Siri, song four”, with no app name. Each step waits for the one before it to finish.',
        'Give it a name of its own: a shortcut named like one of Siri’s own commands, such as “next song”, runs instead of that command.'
      ]
    },
    ...(iphone ? IPHONE_BUTTONS : []),
    linksSection('A shortcut can also open one of these links, with its Open URLs step. Nothing is said back: Play shows what happened.'),
    {
      title: 'Turning it off',
      lines: [
        `To stop Siri using Fractal Remote: Settings → Siri → App Access → Fractal Remote, then turn off Use with Siri Requests. On ${system} 26 and earlier, that list is called Apps.`,
        'To turn Siri off altogether: Settings → Siri → Turn Off Siri.'
      ]
    },
    {
      title: 'What Siri won’t do, on purpose',
      lines: [
        'Tap tempo: Siri takes a different time to answer every time, so spoken taps wouldn’t be on the beat. Set the tempo by number instead.',
        'Volume: one misheard word could silence a preset.',
        'Saving: a save writes over a preset on your unit, and one misheard word would overwrite a song.',
        'Editing: knobs, models and names changed by voice would be changed blind, with nothing on screen to check.',
        'Global settings and the unit’s own click: they change the whole unit, not one preset, so they stay on the screen.',
        'The looper: a looper press depends on the exact moment, and Siri can’t keep time.'
      ]
    }
  ]
}

/** Every word the page can say, for the tests: the row, every section, every phrase and link. */
export function siriWords(args = {}) {
  const row = siriRow(args)
  const out = [row.title, row.status]
  for (const s of siriPage(args)) {
    out.push(s.title)
    if (s.note) out.push(s.note)
    for (const p of s.phrases || []) out.push(...p.say, p.does)
    for (const l of s.links || []) out.push(l.url, l.does)
    out.push(...(s.lines || []))
  }
  return out
}

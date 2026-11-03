/**
 * What each update changed, for Settings → About → What's new.
 *
 * Generated from shared/whats-new.json by `npm run sync:rules`
 * (scripts/whats-new.mjs). Do not edit: change the list and run it.
 */

/** How many days the app shows; the website page has them all. */
export const SHOWN_IN_APP = 10

export const WHATS_NEW = [
  {
    "date": "2026-11-03",
    "day": "3 November 2026",
    "version": "1.89.30",
    "lines": [
      {
        "text": "On the website and the computer app, the top bar and Settings now match the phone app’s: the version on the left, one button that says Live, your unit and which computer it’s on, and Settings in sections that fold, with Done on every page.",
        "only": null
      },
      {
        "text": "The walkthrough shows both ways to connect, Computer (the best way) or Bluetooth, its pages are numbered 1 to 4, and the box before Unlock says both ways. The purchase page lists every Bluetooth adapter, and Playing with no internet says Bluetooth needs none.",
        "only": null
      },
      {
        "text": "On the computer app, signing in under Settings → Account now turns the phone remote on too, so your phone finds the computer straight away after you switch accounts. On a Raspberry Pi set to start by itself, closing the app’s window no longer stops it saving presets you send from your phone.",
        "only": null
      },
      {
        "text": "If the part of the computer app that talks to your unit stops, it now starts again by itself on every computer, and the phone remote comes back on once it’s running. Links in the computer app open in your normal web browser.",
        "only": null
      },
      {
        "text": "The website and the computer app’s window carry their own fonts now, so they work with no internet. The support page names Feedback’s tick boxes the way the app shows them, and the page for getting the app leads with the store.",
        "only": null
      },
      {
        "text": "Show the walkthrough no longer leaves you stuck at the sign-in screen: when you’re already signed in, Back to your own rig at the top takes you straight back.",
        "only": null
      }
    ]
  },
  {
    "date": "2026-11-02",
    "day": "2 November 2026",
    "version": "1.89.27",
    "lines": [
      {
        "text": "Settings → About opens straight onto its rows, the Bluetooth page’s three help pages open properly again, and Phone & computer has its Connect over Bluetooth button back and checks again for your computers and their units each time it opens.",
        "only": null
      },
      {
        "text": "Stars and setlists you make while trying the demo now stay in the demo, never changing your real ones or your account’s. The end of the demo walkthrough and the sign-in screen say you can connect with a computer or, with no computer, by Bluetooth, and that the computer is the best way.",
        "only": null
      },
      {
        "text": "Restore a purchase, tapped while signed out, says first that the purchase belongs to the account you bought it with, and offers to sign in to it. On a VP4, the purchase page and the demo say presets and scenes go as the messages a MIDI foot controller sends, and the FM3 warning on the Bluetooth page reads more plainly.",
        "only": null
      },
      {
        "text": "On an iPhone or iPad set to another language, the Bluetooth page no longer mistakes its own Wi-Fi MIDI connection for your adapter. With no adapter connected, it now says so.",
        "only": "ios"
      },
      {
        "text": "Settings → Siri shows the newer way to stop Siri using the app on iOS 27.2 and later, and the Apple Watch tips say plainly to keep your iPhone unlocked on Play for every tap to land, and to tap again if the first one after a long pause doesn’t.",
        "only": "ios"
      },
      {
        "text": "The back button inside Settings goes up one page instead of jumping straight to Play, and on the feedback screen it asks before throwing away what you wrote.",
        "only": "android"
      }
    ]
  },
  {
    "date": "2026-10-31",
    "day": "31 October 2026",
    "version": "1.89.18",
    "lines": [
      {
        "text": "New: What’s new, under Settings → About, lists what each update changed.",
        "only": null
      },
      {
        "text": "On a wide screen, such as a tablet or a folding phone opened out, Previous and Next sit at the two ends of the buttons under Play.",
        "only": null
      },
      {
        "text": "Shorter Bluetooth pages, and the heat warning is shown only for the FM3, the one unit that needs it.",
        "only": null
      }
    ]
  },
  {
    "date": "2026-10-30",
    "day": "30 October 2026",
    "version": "1.89.14",
    "lines": [
      {
        "text": "Less to read: the Bluetooth page, Settings, the purchase page and Edit say the same things in fewer words.",
        "only": null
      }
    ]
  },
  {
    "date": "2026-10-29",
    "day": "29 October 2026",
    "version": "1.89.12",
    "lines": [
      {
        "text": "One screen for feedback and problem reports: type what happened, add a photo or video, and choose whether to include your email and the app’s log.",
        "only": null
      },
      {
        "text": "New, and only if you say yes: share which gear works with Fractal Remote, to help build a list of everything that works. It is not linked to you. Settings → Troubleshooting → Share what gear works.",
        "only": null
      },
      {
        "text": "Settings sections fold open and closed, so the list is shorter.",
        "only": null
      },
      {
        "text": "The quick preset jump numbers are no longer cut off on smaller screens.",
        "only": null
      },
      {
        "text": "Edit’s beta note has an X, and stays closed once you close it.",
        "only": null
      }
    ]
  },
  {
    "date": "2026-10-28",
    "day": "28 October 2026",
    "version": "1.89.5",
    "lines": [
      {
        "text": "Saving works when the computer app runs on a Raspberry Pi that starts it at power-on.",
        "only": null
      },
      {
        "text": "Quick preset jumps start at 0.",
        "only": null
      },
      {
        "text": "After Bluetooth connects and the unit answers, the app goes straight back to Play.",
        "only": null
      }
    ]
  },
  {
    "date": "2026-10-26",
    "day": "26 October 2026",
    "version": "1.89.3",
    "lines": [
      {
        "text": "The Bluetooth page starts with two steps: pick your unit, then Connect. How to connect, Troubleshooting and What Bluetooth can’t do each have a page of their own, with every way to hook up each unit and what to buy.",
        "only": null
      },
      {
        "text": "If Bluetooth won’t connect after you plug the adapter back in, close the app completely and open it again.",
        "only": null
      }
    ]
  },
  {
    "date": "2026-10-25",
    "day": "25 October 2026",
    "version": "1.89.0",
    "lines": [
      {
        "text": "New: Bluetooth, from version 1.89.0. With the full version and a Bluetooth MIDI adapter on your unit, control an AM4, FM3, FM9, Axe-Fx III or VP4 with no computer (on a VP4, presets and scenes). The computer is still the best way: Bluetooth has more lag and fewer features. Settings → My rig → Bluetooth.",
        "only": null
      },
      {
        "text": "Report a Bluetooth problem, on the Bluetooth page, sends a report straight from the app.",
        "only": null
      },
      {
        "text": "On a tablet, the app turns sideways with the screen.",
        "only": "android"
      },
      {
        "text": "On the Apple Watch, an AM4’s or VP4’s scenes and pedals fill the screen.",
        "only": "ios"
      },
      {
        "text": "Previous and Next, and the names under them, are drawn smaller rather than cut off.",
        "only": null
      }
    ]
  },
  {
    "date": "2026-10-24",
    "day": "24 October 2026",
    "version": "1.88.6",
    "lines": [
      {
        "text": "Scene names are as big as their tiles have room for, one size across the whole grid.",
        "only": null
      },
      {
        "text": "Play’s top bar says which unit you are on, and on which computer. Tap it to switch.",
        "only": null
      },
      {
        "text": "A problem report can carry a screenshot.",
        "only": null
      },
      {
        "text": "On the Apple Watch, an AM4 amp’s pedal says Boost on, Boost off or Amp off.",
        "only": "ios"
      }
    ]
  }
]

/** The days as this phone shows them: a line for the other phone left out, and a day left with none left out too. */
export const daysFor = (os) =>
  WHATS_NEW.map((d) => ({ ...d, lines: d.lines.filter((l) => !l.only || l.only === os).map((l) => l.text) })).filter((d) => d.lines.length)

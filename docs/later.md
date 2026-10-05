# Later

Things Justin wants, but not yet. Each one says what it is in plain words and
what it would take. Start from here when he says "let's do the next one".

## Justin's own tools (only on justinnewbold@icloud.com)

Built so far: **Give someone access** with the **Customer lookup** under it, and
**Sales at a glance**, **Messages from users** (1.86.57), and the Customer lookup's **Help someone sign in** buttons (1.86.58), and **What's live** (1.86.59). Delete account works on the website and the Mac app too (1.86.60). **View as a new customer** is on the phone (1.86.61). All in Settings → Developer. "Do number one and five
for now, and then after that, let's put them on a list of to do sometime
later."

Nothing is left on this list.

## AM4

- **Tap tempo and the tempo box on the AM4.** "Put on a todo for us to figure
  out the tempo on AM4." Every tempo read and write on an AM4 answers
  "unsupported" (Justin's log, 1.86.69, 5 October 2026): the computer app's
  AM4 driver (ForgeFX `server/src/drivers/am4.ts`) has no `getTempo` or
  `setTempo`, and the codec (forgefx-midi `src/am4/params.ts`) has no
  preset-tempo parameter mapped — only the per-block tempo divisions and
  `GLOBAL_TEMPO_CC`. What it takes: find where the AM4 keeps the preset's
  tempo, by recording what AM4-Edit sends while the tempo is changed on
  Justin's AM4, then add the two calls to the AM4 driver on the mirror's
  branch and move `desktop/forgefx.lock.json` to it. That is a new computer
  app for Justin to install, not a phone build. The metronome follows the
  unit's tempo already, so it starts following taps once this lands.

## Older Fractal units

The Axe-Fx II (Mark I, Mark II, XL and XL+) is in as of 1.86.0: presets,
scenes, blocks on and off, X/Y, placing blocks, knobs. None of it has been on
a real one yet — a friend of Justin's is the first tester. After that:

- **Axe-Fx II: tuner, tempo, scene names, the preset name list.** Each needs a
  recording of what the unit sends, from the tester's rig.
- **AX8.** Easy once the Axe-Fx II is proven: it is an Axe-Fx II with fewer
  blocks and a different model byte. Needs an AX8 owner to test.
- **FX8 and FX8 Mk II.** Medium to hard. Fractal never published how it talks,
  and it has an 8-slot chain instead of a grid. Needs an owner and recordings
  of FX8-Edit.
- **Original Axe-Fx (Standard, Ultra).** Hard. A different language, no USB
  (a MIDI cable interface), no scenes, no X/Y. Needs an owner.

## Waiting on something

- **The GitHub description** still says "AI-powered preset builder…". It
  needs changing by hand on the repository's page (the gear next to About).
- **RevenueCat's sample products.** The test store still holds the three
  sample packages RevenueCat starts every project with. They need deleting
  in the RevenueCat dashboard.

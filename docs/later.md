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

- ~~**Tap tempo and the tempo box on the AM4.**~~ **Done, 1.86.79, and
  confirmed on Justin's AM4 ("It works now").** Found without AM4-Edit or
  MIDI Monitor, with the app's own AM4 check: Controllers → Tempo is the
  parameter (0x0002, 0x001C), 24..250 BPM. Details in docs/am4-testing.md.
- **The AM4's own metronome level.** Global (0x0001, 0x0061), −64..+32 dB,
  read but never written. A Global write froze his AM4 on SAVING once, so
  the first write is to be tried by hand with the unit in view.

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

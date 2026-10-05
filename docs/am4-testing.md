# AM4 testing: finding what the app cannot do yet

"I'm ready to do the testing for the AM4 tap tempo metronome. And if there's
anything else the AM4 can't do, we could figure out how to set those up with
testing."

## What the AM4 cannot do from the app today

What the computer app's AM4 driver (ForgeFX `server/src/drivers/am4.ts`) lacks
that the FM3's has (`gen3.ts`), kept to what an AM4 actually has on it:

| Missing | What it costs in the app |
|---|---|
| `getTempo` / `setTempo` / `tapTempo` | Tap and the tempo box say the tempo can't be set; the metronome cannot follow taps |
| Metronome on/off is a guess | `global.metronome` = 1/0, never seen on a real AM4 |
| `sceneState` | Which pedals are on in each scene, without switching to it |
| `cabState` / `cabIrs` | The cab picker |
| `fcReadState` / `fcReadSwitch` | What each footswitch does |
| `meters` | The output level bar |
| `presetSummary` | Names and blocks of other presets without loading them |

## How we find out

Nothing in the app can see what AM4-Edit says to the AM4, but the Mac can:
**MIDI Monitor** (free, snoize.com) listens to everything AM4-Edit sends to
the AM4 and everything it says back. One short recording per action, each
saved as its own file, and the bytes that change are the answer.

1. On the laptop with the AM4: quit Fractal Remote (menu bar icon → Quit), so
   only AM4-Edit is talking to the unit.
2. Open AM4-Edit and let it connect.
3. Open MIDI Monitor. Under Sources, tick **Spy on output to destinations →
   AM4**, and tick the **AM4** source too. Leave System Exclusive ticked.
4. For each test: press **Clear**, do the one thing, wait three seconds, then
   **File → Save As** with the name below.

| File | Do this in AM4-Edit |
|---|---|
| `tempo` | Set the preset's tempo to 120, wait, then to 90 |
| `tap` | Press Tap four times, steadily |
| `metronome` | Turn the metronome on, wait, then off |
| `metronome-level` | Move the metronome level, then back |
| `scene` | Switch to scene 2, then back to scene 1 |
| `cab` | In the Cab block, pick a different cab, then the original |
| `footswitch` | Open the footswitch page and change one switch's job, then change it back |

5. Send the files back. Each one becomes a change to the computer app's AM4
   driver, which is a new computer app to install — not a phone build.

## Never again: the "everything" sweep froze an AM4 (1.86.72)

The AM4 finder in 1.86.72 asked the unit for every block id from 1 to 255
(GET_ALL_PARAMS) plus the active preset dump, one after another. On his AM4
the first snapshot left the screen stuck on **SAVING** for minutes; it took a
power cycle. The second snapshot then said nothing changed although he had
changed the metronome speed — because tempo and the metronome are preset and
global settings, which that question never reaches. 1.86.73 took the finder
out of the app entirely.

Rules for anything that talks to an AM4 directly:

- Never ask about ids nobody has seen the AM4 answer. Only the block ids
  AM4-Edit itself asks about, at AM4-Edit's own pace.
- Tempo and the metronome are single settings, read one at a time (fn 0x01),
  not part of any block's list.
- One question at a time, with a pause, and stop at the first odd answer.

# What Justin's Axe-Fx III said (the block reader's readings)

The block reader (Developer → Testing → Block reader; `mobile/src/lib/gen3-describe.js`)
ran on a real unit for the first time on 13 November 2026: Justin's own
Axe-Fx III ("AX3"), over Bluetooth from an iPhone, app 1.90.44. It is an
Axe-Fx III Mark II on firmware 33.01 (Axe-Edit III said so the same day).
This is what it read, kept here so it is not only in a conversation.

Nothing here is Fractal's artwork or text: it is numbers and names the unit
itself sent when asked.

## The reader against a block the app already knows: Input 1 (effect 37)

Every setting it read agrees with the app's own table for the Axe-Fx III
(`mobile/src/lib/axefx3-knobs.js`, family INPUT):

| Setting | The unit said | The app's table |
|---|---|---|
| 0 | -100..0 | Threshold, -100..0 |
| 1 | 1..20 | Ratio, 1..20 |
| 2 | 0.01..1, shown ×1000 | Release, 10..1000 |
| 3 | 0.0001..0.1, shown ×1000 | Attack, 0.1..100 |
| 4 | a list of 13: AUTO, 1M, 1M+CAP, 230K … 22K+CAP | Input 1 / Instr impedance (switch) |
| 5 | -40..40 | Output Level, -40..40 |

Its whole read was 40 values, 10 a channel, which is the table's stride.

## Block 201: the preset's Performance page

In every preset's status answer on a III, and nobody's until this read. Its
whole read is 350 values in five runs of ten slots:

| Values | What they are |
|---|---|
| 0–9 | each slot's kind (7 for the three on/off slots, 1 for the seven knobs) |
| 10–19 | the effect id each slot points at (58 Amp 1, 70 Delay 1, 66 Reverb 1, 46 Comp 1, 90 Phaser 1, 78 Chorus 1, 82 Flanger 1, 86 Rotary 1) |
| 20–29 | the setting's number in that block |
| 30–189 | each slot's label, 16 characters, one a value: "Amp GEQ", "BOOST", "AMP1", "DLY1", "REV1", "CMP1", "PHR1", "CHO1", "FLG1", "ROT1" |
| 190–349 | each setting's own name, 16 characters: "Off / On", "Off/On", "Fat", "Mix", "Mix", "Compression", "Rate" ×4 |

Ten controls with a label, a block and a setting: the unit's per-preset
PERFORM page. It is not a block a player switches, so it is in
`NOT_BLOCKS` (`mobile/src/lib/gen3Catalog.js`) from 1.90.45.

**It also checked the app's Axe-Fx III table.** Each slot names a setting by
number and by the unit's own name for it, and all ten agree with
`axefx3-knobs.js`: Amp 126 "Off / On", Amp 40 Boost, Amp 78 Fat, Delay 17 Mix,
Reverb 13 Mix, Compressor 13 Compression, Phaser 2 Rate, Chorus 2 Rate,
Flanger 1 Rate, Rotary 0 Rate. That is the first check of ForgeFX's Axe-Fx III
tables against a unit. It is ten settings, not the whole table.

**Axe-Edit III's Perform page confirmed it the same day.** Its "Per-Preset
Performance Controls" are ten slots, in the reader's order and with the
reader's words: Amp GEQ (Off / On), BOOST (Off/On), AMP1 (Fat), then DLY1 Mix,
REV1 Mix, CMP1 Compression, PHR1 Rate, CHO1 Rate, FLG1 Rate and ROT1 Rate.
Three switches and then seven knobs, which is the kinds 7, 7, 7 and 1 seven
times. A player can rename a slot's label there. Beside them Axe-Edit has
"Global Performance Controls", ten more slots, all empty on his unit; where
those live was not read.

## The NAM block (effects 206 and 207)

NAM 1 and NAM 2 read the same: 16 settings, and a whole read of 72 values,
18 a channel, four channels. Settings 0 to 15 are whole-read values 0 to 15 of
each channel; values 16 and 17 have no definition at settings 16 and 17, and
what they are is not known.

| Setting | Type code | Range as sent | Value read | What it is |
|---|---|---|---|---|
| 0 | 16 | list, 0..256 | a capture's name | The capture: 257 slots, 29 named on his unit, the rest `<EMPTY>` |
| 1 | 385 | -80..20, step 0.05 | (unreadable) | Level, dB |
| 2 | 145 | -1..1, shown ×100 | "0.0" | Balance |
| 3 | 176 | 0..1, step 0.001 | "THRU" | probably Bypass Mode. Name not confirmed |
| 4 | 224 | list: OFF, ON | "ENGAGED" | the block's on and off |
| 5 | 306 | -20..20, step 0.1 | (unreadable) | a level in dB. Name not confirmed |
| 6 | 16 | list: NORMAL, INVERT | "NORMAL" | phase |
| 7 | 16 | list: OFF, ON | "OFF" | a switch. Name not confirmed |
| 8 | 16 | 0..2 | "POST" | three choices, labels not read. Name not confirmed |
| 9 | 16 | list of 12 | "ACTIVE" | tone stack type: ACTIVE, BROWNFACE, BLACKFACE, BASSGUY, TOP BOOST, PLEXI, USA MARK IV, USA PRE LD2, RECTO ORANGE, RECTO RED, SKYLINE, PVH 6160 |
| 10 | 50 | 0..1, shown ×10 | "5.00" | probably Bass |
| 11 | 50 | 0..1, shown ×10 | "5.00" | probably Mid |
| 12 | 50 | 0..1, shown ×10 | "5.00" | probably Treble |
| 13 | 16 | 0..2 | "SUM L+R" | input select, three choices, labels not read |
| 14 | 50 | -1..1, shown ×10 | "0.00" | Name not confirmed |
| 15 | 2113 | 10..10000 | (unreadable) | a frequency, at about 470 Hz. Name not confirmed |

**The names marked "not confirmed" come from the unit's own screen**, which
the wire does not send: a photo of the NAM block's pages, or Axe-Edit III's.
They came the same day, and are the next section.

### The names, from Axe-Edit III's NAM page, 13 November 2026

Axe-Edit III, on the same unit, showed channel A of the block as: Level 0.0
dB, Balance 0.0, Input Gain 0.00 dB, Bass 5.00, Mid 5.00, Treble 5.00, Tone
Stack Type Active, Tone Stack Location Post, Input Mode Sum L+R, Bright 0.00,
Bright Cap 470.0 pF. (Type was slot 0 then.) The block's whole read of that
channel, 18 values, was:

    0 52427 32767 0 0 32767 0 0 1 0 32767 32767 32767 2 32767 36526 56445 63805

Setting N is value N of those, for N = 0 to 15. Put side by side:

| Setting | Axe-Edit's name | What the unit said |
|---|---|---|
| 0 | Type (the NAM capture) | list, 0..256: 257 slots, named by whatever is loaded on that unit. Axe-Edit numbers them from 001, so 28 on the wire shows as "029: MV25 Ch1 Crunch" |
| 1 | Level | -80..20 dB, step 0.05 |
| 2 | Balance | -1..1 on the wire, shown ×100 (-100..100) |
| 3 | Bypass Mode | 0 THRU, 1 MUTE (the second read, below). Defined as 0..1 in steps of 0.001, type code 176, not as a plain list, yet it reads 0 and 1 |
| 4 | (the block's bypass) | ENGAGED / BYPASSED |
| 5 | Input Gain | -20..20 dB, step 0.1; 32767 is 0.00 dB, so a straight line |
| 6 | Phase Invert | list: 0 NORMAL, 1 INVERT (the second read, below) |
| 7 | Scene Ignore | list: 0 OFF, 1 ON (the third read, below) |
| 8 | Tone Stack Location | 0 PRE, 1 POST, 2 OFF (the second read, below; PRE by elimination) |
| 9 | Tone Stack Type | list of 12, from 0: ACTIVE, BROWNFACE, BLACKFACE, BASSGUY, TOP BOOST, PLEXI, USA MARK IV, USA PRE LD2, RECTO ORANGE, RECTO RED, SKYLINE, PVH 6160 |
| 10, 11, 12 | Bass, Mid, Treble | 0..1 on the wire, shown ×10 (0..10); 32767 is 5.00, a straight line |
| 13 | Input Mode | 0 LEFT, 1 RIGHT, 2 SUM L+R (the second read, below; RIGHT by elimination) |
| 14 | Bright | -1..1 on the wire, shown ×10 (-10..10); 32767 is 0.00, a straight line |
| 15 | Bright Cap | 10..10000 pF; 36526 is 470.0 pF, so the travel is LOGARITHMIC: 10 × 1000^(36526 ÷ 65534) is 469.98 |

So the "frequency, at about 470 Hz" above is a capacitor, in picofarads, and
the "level in dB" at setting 5 is the Input Gain.

### The second read: four switches set in Axe-Edit, and another capture

To find out which number is which choice, he set four switches in Axe-Edit III
on NAM 1, channel A: Bypass Mode to Mute, Phase Invert on, Tone Stack Location
to Off and Input Mode to Left, with capture slot "029: MV25 Ch1 Crunch" loaded,
and read the block again (app 1.90.45). Channel A was then:

    28 52427 32767 1 0 32767 1 0 2 0 32767 32767 32767 0 32767 36526 8640 54248

and the unit's own text for the settings that moved:

| Setting | Before | After | So |
|---|---|---|---|
| 0 | 0 | 28, "MV25 Ch1 Crunch" | Axe-Edit's "029" is the unit's 28: Axe-Edit numbers the captures from 001, the unit from 0 |
| 3 | 0, "THRU" | 1, "MUTE" | Bypass Mode: 0 THRU, 1 MUTE. Both read |
| 6 | 0, "NORMAL" | 1, "INVERT" | setting 6 is Phase Invert: 0 NORMAL, 1 INVERT. Both read |
| 7 | 0, "OFF" | 0, "OFF" | setting 7 did not move, so it is not Phase Invert. A list OFF / ON, still with no name |
| 8 | 1, "POST" | 2, "OFF" | Tone Stack Location: 1 POST, 2 OFF read; 0 is PRE by elimination |
| 13 | 2, "SUM L+R" | 0, "LEFT" | Input Mode: 0 LEFT, 2 SUM L+R read; 1 is RIGHT by elimination |
| 16, 17 | 56445, 63805 | 8640, 54248 | they moved when the capture changed and nothing else of theirs did: they follow the capture |

Axe-Edit's own menus list exactly: Bypass Mode: Mute, Thru. Tone Stack
Location: Off, Post, Pre. Input Mode: Left, Right, Sum L+R. **Axe-Edit sorts
its menus by the alphabet, so its order is not the unit's numbering**: the
numbers above are the unit's. The two by elimination (PRE at 0, RIGHT at 1)
are the one choice left in a list of three; the amp block's own lists in the
app's table run the same way (Tonestack Location PRE, POST …; Input Select
LEFT, RIGHT, SUM L+R).

### The third read: setting 7 is Scene Ignore

Axe-Edit III's NAM page has a Scene Ignore button beside Bypass. He switched
it on, with every other switch back where it started, and read NAM 1 again
(03:01 UTC, app 1.90.45). Channel A was:

    28 52427 32767 0 0 32767 0 1 1 0 32767 32767 32767 2 32767 36526 8640 54248

Setting 7 read "ON", value 1, and nothing else had moved from its default
(3 THRU, 6 NORMAL, 8 POST, 13 SUM L+R). So setting 7 is Scene Ignore: 0 OFF,
1 ON. It is a value of the channel (channels B, C and D still read 0).

**Still not known:**

- what values 16 and 17 of each channel mean. They follow the capture, no
  setting describes them, and nothing ever writes them;
- the capture list is per unit: its names are whatever is loaded, so no list
  in the app can name them.

**What the app does with it** (1.90.46, his account only): Edit over Bluetooth
has the NAM block's Input Gain, Bass, Mid, Treble, Bright and Bright Cap as
knobs and its Level as every block's Level is, and reads its Balance and five
switches: Bypass Mode, Phase Invert, Tone Stack Location, Tone Stack Type and
Input Mode (`mobile/src/lib/axefx3-own-knobs.js`, behind
`NAM_KNOBS_FOR_EVERYONE` in `mobile/src/lib/features.js`). The phone's Edit
draws no switch of any block, so the five are read and can be written through
the wire, with nothing on the screen for them. The capture (0), the block's
own bypass (4), setting 7 (Scene Ignore, named after the list was written)
and values 16 and 17 are left out, so nothing can be written to them. All of the above was READ off the unit.

**The knobs were then turned from the app, and they work**: "Knobs all work
over Bluetooth correctly" (Justin, 13 November 2026, app 1.90.48, his iPhone
over Bluetooth). The first write of Edit's to a NAM block, and the first knob
Edit turned on any Axe-Fx III. The five switches have not been written: Edit
draws none yet.

## The blocks the app had no name for (13 November 2026)

"double check we have all those blocks already set up" (Justin, with
Axe-Edit III's list of every block on his unit). Five kinds were not on Play
over Bluetooth. He put one of each in a preset (0385) with a NAM and an IR
Player, read each with the block reader (app 1.90.45), and sent Axe-Edit III's
page for each. What follows is the unit's numbers beside Axe-Edit's names.
A name marked "by position" is where Axe-Edit draws it, not proven by a
second read.

| Effect id | Block | Channels | Settings | Whole read | On Play since |
|---|---|---|---|---|---|
| 134 | Vocoder | none | 67 | 67 values | 1.90.47 |
| 142 | Crossover 1 (143 is Crossover 2, the next id, not read) | A and B | 15 | 30 = 2 × 15 | 1.90.47 |
| 170 | Tone Match | none | 22 | 22 values | 1.90.47 |
| 174 | RTA, the Realtime Analyzer | none | 5 | 6 values | never: it has no on and off |
| 195 | IR Player 1 | four | 20 | 80 = 4 × 20 | 1.89.73 |
| 202 | Dynamic Distortion 1 (203 is Dynamic Distortion 2, the next id, not read) | four | 14 | 56 = 4 × 14 | 1.90.47 |

134, 142, 170, 174 and 195 are also what Fractal's published effect-ID enum
says (ID_VOCODER1, ID_CROSSOVER1, ID_TONEMATCH1, ID_RTA1, ID_IRPLAYER1), so
these reads confirm the enum on five ids. 202 is not in the enum: it is the
unit's own id, as NAM's 206 and 207 are. Axe-Edit's block list on this
firmware offers two Crossovers and two Dynamic Distortions.

A bypass (type code 224, ENGAGED / BYPASSED) is setting 18 of the Vocoder, 14
of the Crossover, 8 of Tone Match, 10 of the IR Player and 11 of Dynamic
Distortion. **The RTA has none**, nor a Level or a Bypass Mode, and Axe-Edit's
page for it has no Bypass button: there is nothing for Play to switch, so it
is in `NOT_BLOCKS` (`mobile/src/lib/gen3Catalog.js`) and never drawn.

Play draws and switches them over Bluetooth. From 1.90.49 Edit over Bluetooth
has knobs for five of them on an Axe-Fx III, for his account first
(`mobile/src/lib/axefx3-own-knobs.js`): only the settings below whose name is
Axe-Edit's, whose range the unit gave, and whose number in the whole read
comes out as the unit showed it. What read the same as its neighbours, has no
name, or picks an impulse response is left out. None has been turned from the
app yet.

From 1.90.51 the computer app serves these blocks' knobs too (ForgeFX
0488f11, `server/src/ownBlocks.ts`, this same list), for a block read by its
effect id, on an Axe-Fx III. Its chain read is unchanged:

Through the computer the engine (ForgeFX) has no name in the chain for any of
them, nor for the NAM block: it passes each on with its place, its on and
off, its channel and its effect id, and its on/off and channel routes take
any id. From 1.90.48 the phone names them itself on the way in
(`mobile/src/lib/ownBlocks.js`) and Play draws and switches them through the
computer, for his account first. They stay a New block to everything that
moves or edits the chain.

### Vocoder (134)

| Setting | Axe-Edit's name | What the unit said |
|---|---|---|
| 0 | Analysis Source | list, 0..9; reads "INPUT 2" at 1 |
| 1 | Analysis Channel | list: LEFT, RIGHT |
| 2 | Bands | 4..24; 16 |
| 3 | Min Frequency | 20..2000 Hz; 200.0 |
| 4 | Max Frequency | 2000..20000 Hz; 5000 |
| 5 | Frequency Shift | 0.5..2; 1.000 |
| 6 | Freeze | list: OFF, ON |
| 7 | Master Level | 0..1 on the wire, shown as a percentage; 100.0 % |
| 8 | Master Pan | -1..1 on the wire |
| 9 | Filter Resonance | 0.2..5; 1.000 |
| 10 | Attack | 0.005..1 s, shown in ms; 10.00 ms |
| 11 | Decay | 0.005..1 s, shown in ms; 50.00 ms |
| 12 | Highpass Mix | 0..100 %; 0.0 % |
| 13 | Mix | 0..100 %; 100.0 % |
| 14 | Level | -80..20 dB |
| 15 | Balance | -1..1, shown ×100 |
| 16 | Bypass Mode | list: THRU, MUTE FX OUT, MUTE OUT |
| 17 | not named (type code 208) | list: OFF, ON. Probably the global-mix switch beside Mix; not proven |
| 18 | (the block's bypass) | ENGAGED / BYPASSED |
| 19–42 | band Level 1 to 24 | 0.1..10; all 1.000 |
| 43–66 | band Pan 1 to 24 | -1..1, shown ×100; all 0.0 |

Its first whole read gave no answer; the second, minutes later, gave 67
values, one for each setting.

**Settings 5 and 9 were entered the other way round until 1.90.51.** Both
read 1.000, so the page could not say which was which. The codec's own
table for the III (forgefx-midi AXE3_PARAMS, mined from the editor's
definitions) names setting 5 VOCODER_CSHIFT, "Frequency Shift", 0.5 to 2,
and setting 9 VOCODER_RES, "Filter Resonance", 0.2 to 5: the ranges the unit
gave at those two settings. It also names setting 17 (VOCODER_GLOBALMIX).

That table has every one of these five blocks (VOCODER, CROSSOVER,
TONEMATCH, IRPLAYER, DYNDIST) with the record counts read here (67, 15, 22,
20, 14). It settles the Crossover: 2 Low Level Left, 3 Hi Level Left, 4 Low
Level Right, 5 Hi Level Right, and the pans 6 to 9 in the same order; 10 is
its mix. On Tone Match, 4 is Match, 13 Reference Solo, 14 a taper, 15
accumulate. Its ranges are not all the unit's own (Dynamic Distortion's
Drive is 1 to 1000 there; the unit shows 0 to 10), so the app serves the
rows written here, and checks names against it.

### Crossover (142)

| Setting | Axe-Edit's name | What the unit said |
|---|---|---|
| 0 | Freq | 40..800 Hz; 100.0 |
| 1 | Freq Multiplier | list: X 1, X 10 |
| 2, 3, 4, 5 | Low Level Left, Low Level Right, Hi Level Left, Hi Level Right | four levels, -80..0 dB, all 0.00. WHICH IS WHICH IS NOT PROVEN: all four read the same |
| 6, 7 | the two Left pans (Low Pan Left, Hi Pan Left) | both read "-50.0" |
| 8, 9 | the two Right pans (Low Pan Right, Hi Pan Right) | both read "50.0" |
| 10 | not named (type code 0) | 0..1 |
| 11 | Level | -80..20 dB |
| 12 | Balance | -1..1, shown ×100 |
| 13 | Bypass Mode | list: THRU, MUTE |
| 14 | (the block's bypass) | ENGAGED / BYPASSED |

The pans run Left, Left, Right, Right, so most likely the levels do too (2 Low
Level Left, 3 Hi Level Left, 4 Low Level Right, 5 Hi Level Right) and each
pair is Low then Hi. Moving one knob in Axe-Edit and reading again would
settle it. Axe-Edit offers this block channels A and B only, and the whole
read is two sets of 15.

### Tone Match (170)

Axe-Edit's pages for it are Capture, Config, Monitor and Export.

| Setting | Axe-Edit's name | What the unit said |
|---|---|---|
| 0 | Amount | 0..100 %; 100.0 % |
| 1 | Smoothing | 0..100 %; 0.0 % |
| 2 | Start Reference (by position) | list: OFF, ON |
| 3 | Start Local (by position) | list: OFF, ON |
| 4 | a button, Match or Start Both; not known which | a list with no labels, 0..0 |
| 5 | Level | -80..20 dB |
| 6 | Balance | -1..1, shown ×100 |
| 7 | Bypass Mode | reads "THRU" |
| 8 | (the block's bypass) | ENGAGED / BYPASSED |
| 9 | Reference Source | list, 0..14; reads "INPUT 3" at 2 |
| 10 | Averaging Time | 0.1..100; 5.000 |
| 11, 12 | Reference Channel, Local Channel (by position) | lists, 0..2; both read "LEFT" |
| 13 | Reference Solo, probably | 0..1; reads "OFF" |
| 14 | not on any page seen | 0..2; reads "LIN" |
| 15 | not known | 0..1; reads "OFF" |
| 16, 17 | nothing | no definition |
| 18 | the export's bank | 2..3; reads "USER 1" |
| 19 | the export's number | 0..1023 |
| 20 | Reference Level | -40..20 dB; 0.00 |
| 21 | Mode | list: LIVE, OFF-LINE |

### RTA, the Realtime Analyzer (174)

| Setting | Axe-Edit's name | What the unit said |
|---|---|---|
| 0 | Input Select | list: Left, Right, L+R |
| 1 | Bands | 0..2; reads "64" at 1 |
| 2 | Decay Time | 0..0.1 s, shown in ms; 25.0 ms |
| 3 | Window Type | list: Hann, Blackman |
| 4 | not on the page | a list with no labels, 0..127 |

### IR Player (195)

| Setting | Axe-Edit's name | What the unit said |
|---|---|---|
| 0 | the first IR's bank | list, 0..6; reads "FACTORY 1" |
| 1 | the first IR's number | 0..1023; Axe-Edit counts from 1, the unit from 0 |
| 2 | Low Cut | 20..2000 Hz; 20.0 |
| 3 | High Cut | 200..20000 Hz; 20000 |
| 4 | Filter Slope | list: 6 dB/OCT, 12 dB/OCT |
| 5 | Input Select | list, 0..3; reads "STEREO" |
| 6 | the first IR's Length | 0..4; reads "MAX" |
| 7 | Level | -80..20 dB |
| 8 | Balance | -1..1, shown ×100 |
| 9 | Bypass Mode | reads "THRU" |
| 10 | (the block's bypass) | ENGAGED / BYPASSED |
| 11 | the second IR's bank | list, 0..6 |
| 12 | the second IR's number | 0..1023 |
| 13 | the second IR's Length | 0..4; reads "OFF" at 4 |
| 14, 15 | the two IRs' Levels (first then second, by position) | -40..0 dB |
| 16, 17 | the two IRs' Pans (first then second, by position) | -1..1, shown ×100 |
| 18 | Mix | 0..100 % |
| 19 | Mode | list: PARALLEL, SERIES |

### Dynamic Distortion (202)

| Setting | Axe-Edit's name | What the unit said |
|---|---|---|
| 0 | Filter Type | list, 4..6; reads "PEAKING" at 6 |
| 1 | Frequency | 20..20000 Hz; 500.0 |
| 2 | Q | 0.1..10; 0.500 |
| 3 | Gain | -20..20 dB; 0.00 |
| 4 | Clip Shape | list, 0..4; reads "MEDIUM" at 2 |
| 5 | not on Axe-Edit's page | 0..1, shown ×10; reads "5.00" |
| 6 | Bias | 0..1, shown ×10; 0.00 |
| 7 | Drive | 0.1..100; 6.67 |
| 8 | Level | -80..20 dB |
| 9 | Pan (Axe-Edit says Pan here, not Balance) | -1..1, shown ×100 |
| 10 | Bypass Mode | list: THRU, MUTE |
| 11 | (the block's bypass) | ENGAGED / BYPASSED |
| 12 | Mono/Stereo | list: MONO, STEREO |
| 13 | Type | list of 7, from 0: Flat, Dynamic Mid Boost, Dynamic Mid Cut, Dynamic Presence Boost, Dynamic Presence Cut, Dynamic Depth Boost, Dynamic Depth Cut |

Its first whole read gave no answer; the second gave 56 values, four
channels of 14.

## What the readings say about the wire

- **A definition's five numbers.** The codec calls them min, max, scale, def
  and step. On this unit "scale" is the setting's default in its own units
  (Level 0, the three tone knobs 0.5, the frequency 470, a list's default
  choice) and "def" is what the value is multiplied by to be shown (1, 10,
  100, 1000). The reader prints them under the codec's names.
- **A value that has a unit did not come back as plain text.** Every dB, Hz
  and ms value read as "?" (and so did the impedance, and NAM 1's capture
  name, though NAM 2's read). The ranges came through, which is what a
  catalog needs. From 1.90.45 the reader prints what the unit sent for such a
  value instead of a bare "?".
- **And what it sent is a C string in a 32-byte buffer, with old bytes after
  the NUL.** The unit answers a value with the text, a NUL, and whatever an
  earlier answer left in the buffer behind it:

      Level       30 2E 30 20 64 42 00 25 00 42 6C 6F 00 …        "0.0 dB"
      Input Gain  30 2E 30 30 20 64 42 00 00 48 7A 00 …           "0.00 dB"
      Bright Cap  34 37 30 2E 30 20 70 46 00 00 6D 6D 00 …        "470.0 pF"
      Input Mode  4C 45 46 54 00 2B 52 00 …                       "LEFT"  (the "+R" is left from "SUM L+R")
      Type        4D 56 32 35 20 43 68 31 20 43 72 75 6E 63 68 00 42 41 4C 32 00 47 61 69 6E 20 36 2C 20 41 4B 00
                                                                  "MV25 Ch1 Crunch"

  The codec's reader (and ours, a port of it) dropped the noughts off the end
  and then wanted every byte left to be a letter, so the NUL in the middle
  made each of these nothing. From 1.90.46 the reader takes a value's or a
  label's text as the bytes up to the first NUL
  (`mobile/src/lib/gen3-describe.js` decodeDescribe). That is a deliberate
  difference from the pinned codec, which has the same blind spot.
- **A label asked of a setting that is not a list was answered with nothing,
  and the unit carried on.** Thirty times, on block 201's first thirty
  values. That is this unit on this firmware; the rule against asking on a
  guess stays (an FM3 froze on one).
- **A list whose default is not its first choice is never asked for its
  labels** (settings 8 and 13 here), by the codec's own rule, which the
  reader keeps. Their choices come from the screen too.
- **One read stopped part-way** (NAM 1, "the unit stopped answering" at 152
  questions) and the next ran to its end. Two questions in a row went
  unanswered; the reader stopped as it is meant to.
- **A whole read that gets no answer is the link, not the block.** The
  Vocoder's and Dynamic Distortion's whole reads came back with nothing the
  first time, while each of their settings answered, and both answered whole
  a few minutes later.
- **Not every block has four channels.** The Crossover has two; the Vocoder,
  Tone Match and the RTA have none, and their whole read is one set.

## The chain editor and NAM blocks, through the Pi (15 November 2026)

> "Chain editing and adding a NAM block to empty preset works."

His Axe-Fx III, the phone on 1.90.76, through the Raspberry Pi 5 on computer
app 1.90.63. From the log he sent with it:

- **A move.** Preset 385, Cab 1 and NAM 2 swapped in a row: `clear Cab 1
  from column 8`, `clear NAM 2 from column 7`, `place Cab 1 at column 7`,
  `place NAM 2 at column 8`, each `ok`, then `Cab 1: column 7 → 6 — landed`
  and `NAM 2: column 6 → 7 — landed`. Saved to slot 385.
- **A block into an empty row.** `add block 78 at row 1, column 1 — ok`
  (Chorus 1), and `row 1, column 1 after the add — holds the block`.
- **NAM blocks into a preset.** Preset 386: `add block 206 at row 1, column
  2 — ok` and `holds the block` (NAM 1), saved; then `add block 207 at row
  2, column 1 — ok` and `holds the block` (NAM 2), saved. The unit takes
  206 and 207 from the chain editor as it takes any block.
- **From Play.** `block 206 off — ok`, and scenes 1 and 2.
- The three taps with nothing after them (Wah 1, Drive 1, Formant 1, on a
  full row) are the report 1.90.78 answered: an Add with nowhere to go now
  says so under the card and in the log.

Not in this log: Quick build, the starter chains, anything over Bluetooth,
and a capture picked for a NAM block (the tap is there, on NAM 2, with the
app put to sleep straight after it and no line of what it wrote).


## Quick build through the Pi: built, and not joined (15 November 2026)

> "I'm confused by the built but not joined? Can't build an auto joined
> rig? Or make sure the user selects what's needed to build a playable
> starter rig?"

His Axe-Fx III, the phone on 1.90.80, through the Raspberry Pi 5 on computer
app 1.90.63. Two builds, each on a preset with nothing in it at all (no
Input, no Output: the app put both in).

- **Preset 388**: Input 1, Compressor 1, NAM 1, Amp 1, Phaser 1, Output 1 on
  row 2, columns 1 to 6, then five cables along the row, each `ok`, and
  `quick build landed — 6 in, 0 not`. He tapped Back to Play; what the card
  said is not in the log (the log did not yet say whether a row read as
  joined).
- **Preset 389**: Input 1, Drive 1, NAM 1, Output 1 on row 2, columns 1 to
  4, three cables (`cable row 2 column 1 → row 2 — ok`, column 2, column 3),
  `quick build landed — 4 in, 0 not`, and the card: "Built, but not joined
  all the way … it stops at column 2." Saved to slot 389 as it was.

So every block went where it was sent, every cable was "taken" (which only
means the unit sent no refusal within a tenth of a second), and both
presets were read back whole straight afterwards with every block in (the
"landed" line is only written from a read back). Preset 389's showed the
first cable not there. Whether its other two took, that read back did not
say (the card names only where the row first stops). Whether 388's row read
as joined is not known: the log line did not yet say, and its card is not
in the log. One row seen not joined, not two.

### Why: the cable message named another cell

A cable is function 0x01, sub 0x35, and its last three bytes say which two
cells. On an FM3 the codec's rule (FM3-Edit's own messages bear it out) is
the two cells' numbers, eight bits each, packed seven to a byte:

```
from = (srcCol − 1) × rows + (srcRow − 1)        the cell the cable leaves
to   = srcCol × rows + (destRow − 1)             the cell it feeds, one column on
b21 = from >> 1     b22 = ((from & 1) << 6) | (to >> 2)     b23 = (to & 3) << 5
```

For six rows (FM9, Axe-Fx III) the codec has a fitted "law" instead
(`colTerm`, `destSign`, `|destRow − 3|`). Over the 432 cables it builds:

| The cable goes | The law's bytes are |
|---|---|
| into row 3 or 4, from any column | the packing |
| out of an odd column into row 1, 5 or 6 | the packing |
| into row 2, from any column | NOT: they name row 6 of the source's own column |
| out of an even column into row 1 | NOT: they name row 3 of the source's own column |
| out of an even column into row 5 or 6 | NOT: they name row 1 or 2 of the next column |

270 cables are the packing and 162 are not. What went to his unit for row 2:

| Asked for | Sent (the law) | Which names | The packing |
|---|---|---|---|
| row 2, column 1 → row 2, column 2 | `00 41 20` | column 1, row 6 | `00 41 60` |
| row 2, column 2 → row 2, column 3 | `03 42 60` | column 2, row 6 | `03 43 20` |
| row 2, column 3 → row 2, column 4 | `06 44 20` | column 3, row 6 | `06 44 60` |

The codec's notes say the law was fitted to 26 cables recorded from
FM9-Edit, and hold none of the recordings; its own test examples for row 2
are, two of them, the FM3's bytes for the same cells. Three independent
reads of the codec, the server and the phone (15 November) found no other
cause along the way (the numbering, the read back, a stale copy, the order
of the messages) and no recorded message that contradicts the packing.

### What changed (1.90.82)

- **The computer app builds the packing itself for six rows** (ForgeFX
  07bc01a, `server/src/gridCable.ts`): the same bytes as before wherever the
  law was the packing, the cells that were asked for in the other 162. The
  codec still says what is a cable at all, so the top row from an even
  column is still refused. This is every feature that joins cells through
  the computer on an FM9 or an Axe-Fx III: the rows editor, the looper at
  the end, putting a block back, the browser's Starter chain, Quick build.
- **The phone's own Bluetooth builder is the same packing**
  (`mobile/src/lib/gen3-grid.js`), held to the same three frames as the
  server's test.
- **Quick build puts a six-row chain on the THIRD row** where the preset has
  no Input or Output to say (`homeRow` in shared/starter-chains.mjs), and
  the browser's Starter chain does the same on a preset with neither (and
  builds on the row of the preset's own Input or Output where it has one).
  A cable along row 3 is the same bytes from the law and from the packing,
  so that row does not depend on which computer app is sending. His Pi was
  on 1.90.63.
- **The log says the whole row as read back** (`[chain] quick build — row 3
  as read: column 1 Input 1, column 2 Drive 1 (fed from row 3), column 3
  NAM 1 (fed from row 3), column 4 Output 1 (fed from row 3)`), and the
  line before it says whether it read as connected (`quick build landed —
  4 in, 0 not; connected from the input to the output`, or `; NOT
  connected, stops at column 2`), not only how many blocks are in.

### Not known yet

- **Whether a unit takes the packing where the law was wrong.** Nobody has
  seen one do it. The first build on row 2 (a preset that already has its
  Input there) through a computer app from 1.90.82, or over Bluetooth, is
  the first check, and the "as read" line is where to look.
- **Whether row 3 joins**, which rests on the law being right where it
  agrees with the packing. His next Quick build on an empty preset is that
  check, through the Pi as it is.
- **What the unit did with the three messages it was sent.** They named
  cells in row 6 that hold nothing. A read of the preset does not show
  cables into an empty cell, so preset 389 as saved may carry three marks
  there that nothing draws. It has no sound path either way; build again on
  another empty preset rather than mend it.
- **The top row from an even column.** The codec calls it "not decoded" and
  refuses it. It is very likely just the packing: out of an even column the
  law is wrong into four of the six rows (1, 2, 5 and 6), so recordings of
  those cables could not have been made to fit it. It stays refused until a
  row-2 build has been seen to join.
- **What Axe-Edit III itself sends.** One recording of it drawing a cable
  into row 2 (MIDI Monitor, as for the capture) would settle every line
  above at once.

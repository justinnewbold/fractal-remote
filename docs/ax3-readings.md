# What Justin's Axe-Fx III said (the block reader's readings)

The block reader (Developer → Testing → Block reader; `mobile/src/lib/gen3-describe.js`)
ran on a real unit for the first time on 13 November 2026: Justin's own
Axe-Fx III ("AX3"), over Bluetooth from an iPhone, app 1.90.44. The firmware
was not said; it has the NAM block, so 33 or later. This is what it read, kept
here so it is not only in a conversation.

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
Until then NAM has no catalog and Edit no knobs for it.

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

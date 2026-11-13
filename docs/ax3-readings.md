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
| 7 | NOT KNOWN | list: OFF, ON. Not Phase Invert |
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

**Still not known:**

- the name of setting 7 (a list, OFF or ON);
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
own bypass (4), setting 7 and values 16 and 17 are left out, so nothing can be
written to them. All of the above was READ off the unit. Nothing has been
written to a NAM block from the app yet.

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

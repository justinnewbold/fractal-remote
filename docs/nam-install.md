# Putting a NAM capture on an Axe-Fx III

What Axe-Edit III says to the unit when it loads a capture, learned from
Justin's recording on 13 November 2026: MIDI Monitor on his Mac ("Spy on
output to destinations", with the unit's own answers), his Axe-Fx III
Mark II on firmware 33.01, Axe-Edit III loading one TONE3000 capture
("Orange Amp: Flat EQ, Gain 6, AK…") into the first empty slot, reading the
list back, pointing NAM 1 at it and saving the preset. 20,778 messages in
114 seconds, every checksum right.

**The recording is not in the repository.** It holds a creator's capture
(TONE3000's terms: nothing cached) and the names of Fractal's own captures.
Justin has the file (`NAM.mmon`). What is written here, and held by
test/nam-install.mjs, is the protocol's own messages.

The code is mobile/src/lib/nam-install.js. Before it was merged it rebuilt
all 130 messages of the recorded upload from the recorded words, byte for
byte, and read all 257 slot answers.

## The upload

Every message is the unit's usual frame: `F0 00 01 74 10 <function> …
<checksum> F7`, the checksum every byte from F0 XORed and kept to seven
bits. Axe-Edit waits for the unit's answer to each before sending the next.

| Sent | What it carries | The unit answers |
| --- | --- | --- |
| `0x54` | `00`, the slot (`1D 00` for 29), `00 00 01` (16,384 words) | `64 54 00` |
| `0x55`, 128 times | `00 01` (128 words), then 128 words of five bytes each, low seven bits first | `64 55 00` after each |
| `0x56` | every word of the record XORed together, as five bytes | `64 56 00` |

Straight before the `0x54` Axe-Edit writes **1** to setting 114 of block 1
(function `0x01`, the typed write `09 00`), and after the `0x56` it writes
**0** there. Taken for "a transfer is under way"; sent the same.

On USB the whole of it took 0.4 seconds. It is 130 messages and about
83 KB, so about 27 seconds through a Bluetooth adapter on the MIDI jacks
(3,125 bytes a second), and the wait for each answer paces it by itself.

**Only seen for a slot under 128.** Which two of `00 1D 00` hold a bigger
slot number is a guess, so the code names no slot over 127
(`NAM_SLOT_PROVEN_MOST`) until an upload to one has been seen.

## The record

16,384 words of 32 bits (65,536 bytes), whatever the capture:

| Where | What |
| --- | --- |
| bytes 0–31 | the name. The unit keeps 31 characters and ends it itself: Axe-Edit sent a 32nd, and the unit's own list answered with a NUL there. |
| bytes 32–63 | who made it (`modeled_by`) |
| bytes 64–95 | the gear's make |
| bytes 96–127 | the gear's model |
| bytes 128–159 | the gear's kind (`amp`, `amp_cab`) |
| bytes 160–191 | the tone's kind (`crunch`, `hi_gain`, `metal`) |
| bytes 192–223 | spare, noughts |
| bytes 224–255 | thirty-two bytes Axe-Edit fills for a TONE3000 capture. **Not known what.** Fractal's own captures have noughts there, so the unit plays one without them; the code sends noughts. |
| words 64–67 | loudness (dB), gain, input level and output level (dBu), each `7FC00000` ("not a number") where the file has none |
| words 68–14084 | the capture's 14,017 numbers as single-precision floats in the file's order: the lite network's 1,871, then the full network's 12,146 |
| words 14085–14094 | ten `7FC00000` |
| the rest | noughts |

## What is not proven yet: `NAM_PACKING_PROVEN`

That words 68–14084 are the `.nam` file's own numbers, untouched and in the
file's order. Everything says so: the count is exactly an A2 capture's, the
lite network ends at word 1938 on the same closing number the full network
ends on (as both networks of the open NAM engine's A2 example do), and the
four numbers before them are the file's own notes. But the `.nam` that was
loaded has not been set beside the recording. **Until it has, nothing in
the app sends a record**: a capture packed wrong would play as noise. When
it has, say so here, set the switch, and build the sender with its own way
out, as every other write over the wire has.

## The list of slots

257 slots, 0 to 256 (Axe-Edit counts from 001). Function `0x01`, sub-action
`08 01`, block 0, setting 0, the slot as the value, answers that slot's
first 272 bytes (everything above up to word 67), eight bits packed into
seven, high bit first, after a length of `10 02`. The answer does not say
which slot it is. An empty slot's name is `<EMPTY>` and the rest noughts.
Axe-Edit asked all 257 in 0.4 seconds.

## Pointing a NAM block at a slot

An ordinary typed write (function `0x01`, `09 00`): the block (206 or 207),
setting 0, the slot as a float (29.0). The unit answers with the slot over
256 (0.11328125) and the capture's name. The block's own data then reads
29 where it read 0. Axe-Edit then saved the preset the usual way (`26 00`).

## Also in the recording, not used

- `0x1F` with a block's id answers that block's data as `0x74`, `0x75`,
  `0x76` (Axe-Edit asked NAM 1 and NAM 2 again and again).
- Function `0x01`, `56 00`, at a NAM block with setting `2D 7F`: 32 bytes
  of something, the same every time for one block.
- Function `0x01`, `14 00`, at a NAM block: a 0 or a 1.

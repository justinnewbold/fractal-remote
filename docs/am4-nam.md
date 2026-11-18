# NAM on an AM4 (firmware 3.00 beta): what his unit and AM4-Edit said

Everything here is from Justin's own AM4, 18 November 2026. The recording
(a MIDI Monitor file, "Fractal Remote.mmon", 43,725 messages over 127
seconds, AM4-Edit on his Mac) is NOT in the repository: it holds a
creator's capture. He has it.

## The block

- The NAM Player is block **0xD1 (209)**; a second one is **0xD2 (210)**.
  Both are in the recording (AM4-Edit reads 209 and 210 throughout), and
  his phone's log the same day said "slot 2 holds 0xd1 (209)".
- Its on and off is read as every AM4 block's is (setting 3, action 0x0D):
  AM4-Edit asked 0xD1 that way and was answered.

## Loading a capture: the same messages as an Axe-Fx III, at model 0x15

AM4-Edit loaded "Orange Amp: Flat EQ, Gain 6, AKG 414 + sm57" (the same
TONE3000 capture as the III's recording of 13 November). In order:

1. `01 | block 1, setting 0x5C, action 1 | 1.0`: "a transfer is under way"
   (the III's is a typed write of setting 114 of block 1; the AM4's is
   setting 92, by the AM4's own write shape). Answered.
2. `54 | 00 01 00 | 00 00 01`: slot 1 (AM4-Edit's 002), 16,384 words.
   Answered `64 54 00`.
3. 128 of `55 | 00 01 | 128 words`, each answered `64 55 00`.
4. `56 | the XOR of every word`. Answered `64 56 00`, **589 ms** later
   (every message before it: about 3 ms).
5. The same setting 0x5C written 0.0.

The whole of it took 0.66 s on USB.

**The record is the III's, word for word in its layout**: seven 32-byte
text lines (name with 0x60 as its 32nd byte, maker, gear make, model, gear
kind, tone kind, a spare), the file's hash, loudness and gain, two NaNs,
then the weights. And `namUploadFrames(0x15, 1, words)` from
mobile/src/lib/nam-install.js rebuilds all 130 recorded messages byte for
byte. So the phone's packer and upload builder need nothing new for an AM4
but the model byte and the "transfer under way" write.

## The list of slots (worked out the same evening)

After the upload AM4-Edit asked 129 questions: `01 | 0, 0, action 0x45,
hdr4 4 | the slot`, the slot a 32-bit number packed eight bits into seven,
high bit first (slot n is `n>>1, (n&1)<<6, 0, 0, 0`). Each answer is 327
bytes: the same header, `hdr4` 272, then 272 bytes packed the same way,
which are **the III's slot head exactly** (the text lines, the hash, the
four numbers; `namHead` reads them). An empty slot's name is "<EMPTY>".

- Slot 0 answered "Orange Amp…", slot 1 the same, 2 to 128 "<EMPTY>".
- **Slots count from 0, as on the III.** Before the upload both NAM blocks
  read (setting 10, action 0x0D) as slot 0, "Orange Amp…": he had loaded
  that capture once already, so AM4-Edit took the first EMPTY slot, 1.
  The 0x54 message named slot 1 and the pick wrote 1.0.
- 129 answers, where the III has 257: taken as 128 slots (0 to 127) and
  one more, as the III's 256 and one more. Index 128 read "<EMPTY>".

## Pointing a block at a capture

`01 | block 0xD2, setting 0x0A, action 1, hdr4 4 | 1.0` (the AM4's own
float packing): NAM 2 pointed at slot 1. The 62-byte answer unpacks to the
slot as a 16-bit number (then `80 3F`), four more bytes, and the
capture's name. Reading it back is the same block and setting with action
0x0D: the slot, and the name. On the III it is setting 0; on the AM4 it
is setting **10**.

Then the preset was saved (`action 0x1B`, the save the phone already has).

## Seen and not understood yet

- `block, setting 0x3E81, action 0x17` at 0xD1, 0xD2, 0xC3 and 0xC4, each
  answered with 62 bytes. Asked when a block's page opens.
- `0xCE, setting 0x10, action 1` with a float, once, before the pick.
- Reads of 0xD1 and 0xD2 with action 0x26 (several hundred), and of 0xCE
  with action 0x1F: AM4-Edit's own screen.

## What is built, and what is next

- 2.0.9: the block is named and switched on Play over Bluetooth, his
  account only (`AM4_NAM_FOR_EVERYONE`).
- 2.1.0: the Bluetooth wire answers the capture tools' routes for an AM4
  (the list, the first empty slot, a send, a pick), his account only, with
  mobile/src/lib/am4-nam.js holding the AM4's own four messages. No screen
  reaches them yet.
- 2.1.1: TONE3000 on a held AM4 NAM block, over its channels (the block has no knobs in the app yet), his account only. The page's words are the Axe-Fx III's with "AM4" put in (mobile/src/lib/captureUnit.js). Not built: a picker for the captures already on an AM4.
- 2.1.2: that picker, as a Capture button under TONE3000 on the held block (components/HeldCapture). The wire answers which capture a block is on (GET /nam/blocks/<id>/slot, AM4-Edit's own read), and the AM4 has a list of its own, 128 slots.
- Next: the screens (the TONE3000 page and its words by unit, the door on a
  held NAM block, a capture picker for a block with no knobs), then the
  same through the computer (ForgeFX), then the block's knobs.

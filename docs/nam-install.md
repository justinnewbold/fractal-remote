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
| bytes 0–31 | the name: 31 characters and a check byte. The 32nd byte is the other 31 XORed together (`namCheck`), so the field XORs to nought: Axe-Edit sent 0x60 there, which is exactly that for the name it sent. The unit's own list answers a NUL in its place. |
| bytes 32–63 | who made it (`modeled_by`) |
| bytes 64–95 | the gear's make |
| bytes 96–127 | the gear's model |
| bytes 128–159 | the gear's kind (`amp`, `amp_cab`) |
| bytes 160–191 | the tone's kind (`crunch`, `hi_gain`, `metal`) |
| bytes 192–223 | a seventh line of text. Axe-Edit sent noughts there for the file it loaded, and so does the app. It is not always empty on a unit: 20 of the 31 captures on his hold `TONE3000` there and 11 hold noughts (the one Axe-Edit had just loaded among them), so the unit keeps both and stamps nothing itself. |
| bytes 224–255 | the file's own `weights_hash` (`nam-content-v1:` and 64 hex digits) as its 32 bytes. Fractal's own captures have noughts there, so the unit plays one without them, and a file with no hash sends noughts. |
| words 64–67 | loudness (dB), gain, input level and output level (dBu), each `7FC00000` ("not a number") where the file has none |
| words 68–14084 | the capture's 14,017 numbers as single-precision floats in the file's order: the lite network's 1,871, then the full network's 12,146 |
| words 14085–14094 | ten `7FC00000` |
| the rest | noughts |

## The packing is proven: `NAM_PACKING_PROVEN`

Justin sent the three `.nam` files he had for that tone the same day. The
one that was loaded is "Orange Amp: Flat EQ, Gain 6, AKG 414 + sm57": all
14,017 of its numbers are the recording's, bit for bit as single-precision
floats, in the file's order; its loudness and gain are the two numbers
before them; and its `weights_hash` is the thirty-two bytes. Packed by
`namRecord`, the file is the record Axe-Edit sent, word for word, the
name's check byte (0x60) included. The other two files (other microphones)
share not one number with it. The files are not in the repository either
(TONE3000's terms: a capture is fetched when a player asks, and not kept).

## The name's check byte, and the first send that was not kept

The first build sent a NUL as the name's 32nd byte: Axe-Edit had sent 0x60
there and the unit's own list answered a NUL, so it was taken for something
the unit wrote over. Justin's first send (14 November 2026, a different A2
capture, over Bluetooth) was answered "taken" at all 130 messages, and when
NAM 1 was then pointed at the slot the unit named it `<EMPTY>`: it took the
capture and did not keep it.

0x60 is the other 31 bytes of that name XORed together, so the name field
XORs to nought. That byte was the one difference between the app's record
and Axe-Edit's, and `namRecord` now sends it. This is the best explanation
of the bytes, not something seen to work yet: until a send from the app is
kept by a unit, treat it as likely and not proven. For a name shorter than
31 characters the byte still goes 32nd (the rest of the field is noughts,
so it is the name's own characters XORed); only a 31-character name has
been seen.

**A short name is sent as it is first, and filled out only if the unit
drops that** (1.90.61). The unit's own list shows short names with nothing
after them, so Axe-Edit does not pad them, and neither does the app on its
first try. But where the check byte goes for a short name has not been
seen. So when a short-named capture is taken and not kept, the card sends
it once more into the same slot with the name filled out to all 31 places
with spaces (`namRecord`'s `fill`): the one shape proven kept, whatever the
rule for a short name is. A name is read from the unit without those spaces
(both senders). The log says which of the two a unit kept ("KEPT WITH THE
NAME FILLED OUT, not as it was"), and that settles it: if a short name is
kept as it is, the fill is never used; if only the filled one is kept, the
short rule is not this one, and `namRecord` fills every name until it is
understood. If neither is kept, the check byte was not the reason.

What the app does now so that the next try says why, whichever way it goes:
after a send it reads the slot back, and a slot that still reads `<EMPTY>`
is said as "took it and did not keep it", with no Play button; the log
carries the slot's name as the unit said it, and the pick's answer.

And the log says how long the unit took over the closing message (`0x56`).
In the recording it answered every message before it in under 3 ms on
average (never over 28), and took 272 ms over the last: most likely the
time it spent filing the capture, though that is not proven. So a closing
message answered as fast as the rest, with a slot that then reads
`<EMPTY>`, says the unit judged the record and dropped it (the name's check
byte, or something else in the record); one that took a quarter of a second
and still reads `<EMPTY>` says it filed something and the trouble is later.

## What else Axe-Edit sent round the upload, and why none of it is a step

Checked on 14 November 2026, because a missing "store it" message would
explain a capture taken and not kept as well as the check byte does. There
is none. Between "a transfer is under way" and the unit's answer to the
closing message Axe-Edit sent the 130 messages and nothing else. After that
answer, and before "it is over", it sent 30 reads: `01 2E` once, `01 01`
for each block of the preset (17), `01 04 01` (5) and `01 39` for NAM 1's
settings (7). Every one of those is its screen refreshing: the same four
kinds were sent 89, 2,261, 2,709 and 315 times in the minutes before the
upload, the same ones were sent just before "a transfer is under way", and
the `01 39` answers come back as they went. None writes anything.
The app sends none of them. After "it is over" Axe-Edit sent nothing for
335 ms and then read its list of slots.

## The sender

The wire's (mobile/src/lib/bleWire.js `namEmptySlot`, `namInstall`,
`namPick`), over Bluetooth or the unit's USB cable into the device, on an
Axe-Fx III only and for his account only, from Developer → Testing →
TONE3000. It is Axe-Edit's sequence: the slot read first (written only if
it says `<EMPTY>`, unless told to replace), "a transfer is under way", the
130 messages each sent only when the unit has answered the one before, "it
is over", the slot read back. While it goes the watch asks nothing and any
other write is refused. Every frame of these shapes is held at the way out
(`namShaped`, `namAllowed`): an upload's own frames byte for byte, a slot's
question while the list is read, the one pick being made. test/bluetooth.mjs
holds it against a unit that answers as his did.

**One send from the app so far** (14 November 2026, over Bluetooth): taken
at every message and not kept. "The name's check byte, and the first send
that was not kept", above, has what was changed for the next one.

While a capture goes, nothing but its own messages leaves the phone
(bleWire `pump`): Axe-Edit sent nothing else between "a transfer is under
way" and the unit's answer to the last message, and the first build let
reads through (the rig's half-minute "which preset are you on?" among them).
A read asked meanwhile waits and goes after; anything that would change the
unit is refused. The hold is from the slot's own first read to the slot
read back after "it is over" (1.90.61), so that read back is the first
thing the unit hears after the quiet, as it was Axe-Edit's. The rests are
Axe-Edit's (`NAM_REST`: 30 ms between the unit's answer to "a transfer is
under way" and the opening message, 150 ms before "it is over", 350 ms
before the slot is read back; a test holds each by the clock), and a slot
that reads `<EMPTY>` is read once more a second later before it is called
not kept. Slot 257 (the last) listed the same head as slot 029 in
the recording, so it may not be a slot of its own: it is never a target,
and is not offered as a pick until it is understood.

## Through the computer, or the Raspberry Pi

"But this will only work over Bluetooth or plugged in directly? Why not over
a raspberry pi?" (Justin, 14 November 2026.) Since the computer release that
carries ForgeFX 4e6f05b, the computer app sends the same messages itself
(ForgeFX `server/src/namCaptures.ts`, a port of the message half of
`nam-install.js`; THE TWO ARE KEPT THE SAME, each held to the recorded frames
by its own test). Three routes, for an Axe-Fx III only:

- `GET /nam/empty`: the slots read from the first up to the first that says
  `<EMPTY>`.
- `POST /nam/slots/<n>` with `{ record }`: the record the device packed, as
  base64 of its words (four bytes a word, low byte first, up to the last word
  that is not nought; `mobile/src/lib/nam-travel.js`). The computer reads the
  slot, says "a transfer is under way", sends the 130 messages each when the
  one before is answered, says "it is over", and reads the slot back. The
  meters' polling is held while it goes.
- `POST /nam/blocks/<id>/slot` with `{ slot }`: NAM 1 or NAM 2 pointed at a
  slot, only when that block is in the preset.

The computer packs nothing: one packer, the device's, proven. And it has no
replace: a slot is written only when it reads `<EMPTY>`, which is why a
device may ask for these through the relay at all (`remoteAllowed` in
ForgeFX, `hostAllows` in shared/relay-rules.mjs, kept in step). A capture is
never sent twice (`NOT_REPEATABLE`), and gets the long wait. There is no
count as it goes: it is one message to the computer, about 75,000 characters,
and on USB the unit takes it in about a second.

The Developer card's buttons are the same; lib/device sends by whichever way
the device is connected. An older computer app is answered "Update the
computer app to send a capture through it." **Nothing has been sent to a
real unit through the computer yet.**

**The computer sends it as one piece, from the release that carries ForgeFX
14e2c4f (1.90.61).** Each of the 130 messages used to be its own turn on the
computer's queue, so another request (a device asking which preset the unit
is on, the computer's own window) could go between two of them. The whole
send, from the slot's own read to the slot read back, is one turn now
(`Transport.exclusive`, on both of ForgeFX's transports), and what is asked
meanwhile goes after it. The rests are the phone's numbers (`NAM_REST`),
"it is over" is said even when the start went unanswered, a slot that reads
`<EMPTY>` is asked once more, and the computer's log has the same line as
the phone's, the closing message's time in it. And the computer puts the
name's check byte into a record that came without it (`namNameChecked`):
the one thing it ever does to a record, so that a copy of the phone app from
before 1.90.60 cannot send one the unit drops. A computer app from before
that release lets other requests in between a capture's messages, so the
computer (or the Raspberry Pi) is updated before a send through it is
judged.

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

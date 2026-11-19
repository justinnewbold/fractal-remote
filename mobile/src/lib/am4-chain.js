/*
 * AN AM4'S FOUR SLOTS, OVER BLUETOOTH OR ITS OWN USB CABLE: a block put in
 * a slot, a slot emptied.
 *
 * "I need everything with the chain builder to work over Bluetooth also"
 * (Justin, 15 November 2026). An AM4 has no grid and no cables: four slots
 * in a line, each holding one block or nothing, and which block each holds
 * comes in the AM4's one preset answer (the structure read the phone has
 * always sent). What was missing was the write.
 *
 * WHAT IS SENT IS THE COMPUTER'S OWN, BYTE FOR BYTE: forgefx-midi's
 * buildSetBlockType at the commit desktop/forgefx.lock.json pins. One
 * 23-byte frame, the preset's own register (0x00CE) at 0x000F for slot 1 up
 * to 0x0012 for slot 4, "set", four bytes of value: the block's code as a
 * float, or 0 for an empty slot. The codec's notes: slots 2, 3 and 4 were
 * seen to land on a real AM4, and one address further (0x0013) answered
 * wrongly and disturbed another slot, so there are four and never a fifth;
 * slot 1's address is in no recording on disk, though a drive placed there
 * through the computer app landed. test/gen3-grid.mjs holds every frame
 * this file can build to the codec.
 *
 * THE AM4 HAS FROZEN TWICE ON A MESSAGE IT DID NOT EXPECT (lib/
 * fractal-sysex.mjs AM4_ALLOWED), which is why this is held as tightly as
 * anything it is sent: only the seventeen block codes the AM4 itself
 * reports, or nought; only slots one to four; and at the way out only the
 * one frame the wire is sending for a slot at that moment
 * (`am4SlotAllowed`). A second copy of a block (a second drive is 0x77) is
 * not offered: nobody has placed one from here.
 *
 * The AM4 does not answer this write (over USB its acknowledgement "has not
 * been seen once, while every write lands", ForgeFX am4.ts), so the wire
 * reads the preset back and says whether the slot holds the block, as the
 * computer does.
 */
import { AM4, AM4_BLOCKS, AM4_NEW_BLOCKS, am4Float, am4Frame, am4ReadFloat, checksumOk, decode14, isFractal, MODELS, FN } from './fractal-sysex.mjs'

/** The first slot's address in the preset's register; the fourth is three above it. */
export const AM4_SLOT_FIRST = 0x000f
export const AM4_SLOTS = 4

/** What the AM4's blocks are called where one is picked: the computer app's own labels (ForgeFX am4BlockLabel). */
const NAMES = Object.freeze({ geq: 'Graphic EQ', peq: 'Parametric EQ', volpan: 'Vol/Pan' })
const labelOf = (slug) => NAMES[slug] ?? `${slug[0].toUpperCase()}${slug.slice(1)}`

/** The blocks an AM4's slot can be given, as the computer app lists them (GET /blocks): one of each, `page` its code. */
export const AM4_PALETTE = Object.freeze(Object.entries(AM4_BLOCKS).map(([slug, page]) => Object.freeze({ slug, family: slug, instance: 1, name: labelOf(slug), page })))

/**
 * THE NAM PLAYER (AM4 firmware 3.00), AS A BLOCK A SLOT MAY BE GIVEN.
 *
 * "Under the edit chain, the AM4 for NAM and pitch blocks are not showing
 * up" (Justin, 19 November 2026). Its code, 0xD1, is the AM4's own: read off
 * his unit's slots on the 3.00 beta, and AM4-Edit's recording reads the
 * block at it (docs/am4-nam.md). The message is the one every block is
 * placed by, with that code as its value. NOBODY HAS SEEN A SLOT GIVEN THIS
 * BLOCK FROM HERE: it is offered and sent only where `more` is true, which
 * the wire answers per account (lib/features AM4_NAM_ADD_FOR_EVERYONE), and
 * the slot is read back like any other. One of it, as of every block: a
 * second (0xD2) is not offered. An AM4 on older firmware has no such block;
 * what it does with the code is not known, and the read back says whether
 * the slot took it.
 *
 * The Pitch block the same firmware brought is offered beside it
 * (AM4_PITCH_PLACE), by a code that is likely and not read off a unit.
 */
export const AM4_NAM_PLACE = Object.freeze({ slug: 'nam', family: 'NAM', instance: 1, name: 'NAM', page: AM4_NEW_BLOCKS.nam })
/** And the Pitch block, by its likely code (fractal-sysex AM4_NEW_BLOCKS says what that rests on). */
export const AM4_PITCH_PLACE = Object.freeze({ slug: 'pitch', family: 'pitch', instance: 1, name: 'Pitch', page: AM4_NEW_BLOCKS.pitch })
const MORE = Object.freeze([AM4_NAM_PLACE, AM4_PITCH_PLACE])

/** The blocks offered: the palette, with the NAM Player after it where `more` is true. */
export const am4Palette = (more = false) => (more === true ? [...AM4_PALETTE, ...MORE] : AM4_PALETTE)

/** Whether `code` is one a slot may be sent: a block the palette names, or 0 for empty; the NAM Player's too where `more` is true. */
export const am4SlotCode = (code, more = false) => code === 0 || AM4_PALETTE.some((b) => b.page === code) || (more === true && MORE.some((b) => b.page === code))

/** Put `code` in slot 1 to 4 (0 empties it). Null for a slot or a code that is never sent. */
export function buildAm4Slot(slot, code, more = false) {
  if (!Number.isInteger(slot) || slot < 1 || slot > AM4_SLOTS || !am4SlotCode(code, more)) return null
  return am4Frame({ pidLow: AM4.PRESET_REG, pidHigh: AM4_SLOT_FIRST + slot - 1, action: AM4.SET, hdr4: 4, payload: am4Float(code) })
}

/** What a frame of this shape says, `{ slot, code }`, or null when it is not a slot write at all. */
export function readAm4Slot(f) {
  if (!isFractal(f) || f.length !== 23 || f[4] !== MODELS.am4 || f[5] !== FN.PARAM || !checksumOk(f)) return null
  if (decode14(f[6], f[7]) !== AM4.PRESET_REG) return null
  const high = decode14(f[8], f[9])
  if (high < AM4_SLOT_FIRST || high >= AM4_SLOT_FIRST + AM4_SLOTS) return null
  if (decode14(f[10], f[11]) !== AM4.SET || decode14(f[12], f[13]) !== 0 || decode14(f[14], f[15]) !== 4) return null
  const code = am4ReadFloat(f, 16)
  return { slot: high - AM4_SLOT_FIRST + 1, code }
}

/**
 * THE WAY OUT'S RULE: a slot write goes only if it is one this file would
 * build (a slot of the four, a code of the palette or nought) AND is, byte
 * for byte, a frame the wire is sending for a slot at this moment (`now`).
 */
export function am4SlotAllowed(f, now, more = false) {
  const said = readAm4Slot(f)
  if (!said || !Array.isArray(now)) return false
  const made = buildAm4Slot(said.slot, said.code, more)
  if (!made || made.length !== f.length || !made.every((b, i) => b === f[i])) return false
  return now.some((n) => Array.isArray(n) && n.length === f.length && n.every((b, i) => b === f[i]))
}

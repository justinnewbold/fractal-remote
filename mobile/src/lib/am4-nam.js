/**
 * AN AM4'S NAM CAPTURES (firmware 3.00): the list of slots, a NAM block
 * pointed at one, and a capture sent to the unit, as AM4-Edit does each.
 *
 * "Fractal just announced NAM support for AM4 ... let's get the support
 * built in as well." (Justin, 18 November 2026.) Every byte here is from his
 * own recording of AM4-Edit loading one capture into his AM4 that day
 * (docs/am4-nam.md; the recording is not in the repository).
 *
 * WHAT IS THE SAME AS AN AXE-FX III (lib/nam-install): the record, word for
 * word in its layout, and the upload itself (0x54, 128 of 0x55, 0x56, each
 * answered 0x64). `namUploadFrames` at the AM4's model byte rebuilt all 130
 * recorded messages byte for byte, so the record and the upload are that
 * file's, and nothing of them is written again here.
 *
 * WHAT IS THE AM4'S OWN, in the AM4's own message shape (fractal-sysex
 * am4Frame: a register, a setting, an action):
 *
 *   "A transfer is under    register 1, setting 0x5C, action 1, the value
 *   way", and "it is over"  1.0 and then 0.0. Answered, 64 bytes.
 *   One slot's head         register 0, setting 0, action 0x45, the slot as
 *                           a 32-bit number. Answered with 272 bytes packed
 *                           eight into seven, which are the III's slot head.
 *   A block pointed at a    the block (0xD1 or 0xD2), setting 0x0A, action
 *   slot                    1, the slot as a number. Answered with the slot
 *                           and the capture's name.
 *
 * SLOTS COUNT FROM 0, 128 of them and one more (AM4-Edit asked 129), as the
 * III's 256 and one more. The one upload seen named slot 1.
 *
 * NOTHING HERE HAS BEEN SENT TO AN AM4 FROM THE APP, and an AM4 froze once on
 * a message it did not expect: the wire holds every frame of these shapes to
 * the one job in hand (`am4NamAllowed`).
 *
 * Pure: bytes in, bytes out.
 */
import { AM4, AM4_NEW_BLOCKS, FN, MODELS, am4Float, am4Frame, checksumOk, decode14, isFractal, sameBytes, unpackMsb } from './fractal-sysex.mjs'
import { NAM_FN, NAM_HEAD_BYTES, namHead } from './nam-install.js'

/** The slots AM4-Edit asks about: 0 to 128. */
export const AM4_NAM_SLOTS = 129
/** The last slot offered for a capture: the 129th is left alone, as the III's 257th is. */
export const AM4_NAM_SLOT_MOST = 127
/** The NAM Player's two blocks. */
export const AM4_NAM_BLOCKS = Object.freeze([AM4_NEW_BLOCKS.nam, AM4_NEW_BLOCKS.nam + 1])
/** The setting of a NAM block that says which capture it plays. */
export const AM4_NAM_CAPTURE = 0x0a
/** "A transfer is under way": register 1, setting 0x5C. */
export const AM4_NAM_BUSY = Object.freeze({ register: 1, setting: 0x5c })
/** The action that asks for one slot's head. */
export const AM4_NAM_LIST = 0x45

const slotOk = (n) => Number.isInteger(n) && n >= 0 && n < AM4_NAM_SLOTS

/* A 32-bit number as the AM4 packs it for the list: its four bytes, low first, eight bits into seven, high bit first. */
const packU32 = (n) => {
  const b = [n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff]
  const out = []
  let acc = 0
  let bits = 0
  for (const x of b) {
    acc = (acc << 8) | x
    bits += 8
    while (bits >= 7) {
      out.push((acc >>> (bits - 7)) & 0x7f)
      bits -= 7
    }
    acc &= (1 << bits) - 1
  }
  out.push((acc << (7 - bits)) & 0x7f)
  return out
}

/** "A transfer is under way" (true) and "it is over" (false). */
export const am4NamBusyFrame = (on) => am4Frame({ pidLow: AM4_NAM_BUSY.register, pidHigh: AM4_NAM_BUSY.setting, action: AM4.SET, hdr4: 4, payload: am4Float(on ? 1 : 0) })

const head = (f, low, high, action) => isFractal(f) && checksumOk(f) && f[4] === MODELS.am4 && f[5] === FN.PARAM && decode14(f[6], f[7]) === low && decode14(f[8], f[9]) === high && decode14(f[10], f[11]) === action

/** The AM4's answer to am4NamBusyFrame: the same head, and longer than the write. */
export const am4NamBusyAnswer = (f) => head(f, AM4_NAM_BUSY.register, AM4_NAM_BUSY.setting, AM4.SET) && f.length > 23

/** Ask for one slot's head. Null for a slot there is not. */
export function am4NamSlotQuery(slot) {
  if (!slotOk(slot)) return null
  return am4Frame({ pidLow: 0, pidHigh: 0, action: AM4_NAM_LIST, hdr4: 4, payload: packU32(slot) })
}

/** The AM4's answer to am4NamSlotQuery: that slot's head (nam-install namHead), or null for anything else. It does not say which slot it is; the asker knows. */
export function readAm4NamSlot(f) {
  if (!head(f, 0, 0, AM4_NAM_LIST)) return null
  if (decode14(f[14], f[15]) !== NAM_HEAD_BYTES) return null
  const septets = f.slice(16, f.length - 2)
  if (septets.length < Math.ceil((NAM_HEAD_BYTES * 8) / 7)) return null
  return namHead(unpackMsb(septets, NAM_HEAD_BYTES))
}

/** Point a NAM block at a slot. Null for a block that is no NAM block, or a slot there is not. */
export function am4NamPickFrame(block, slot) {
  if (!AM4_NAM_BLOCKS.includes(block) || !slotOk(slot)) return null
  return am4Frame({ pidLow: block, pidHigh: AM4_NAM_CAPTURE, action: AM4.SET, hdr4: 4, payload: am4Float(slot) })
}

/** Ask which capture a NAM block plays. */
export function am4NamPickRead(block) {
  if (!AM4_NAM_BLOCKS.includes(block)) return null
  return am4Frame({ pidLow: block, pidHigh: AM4_NAM_CAPTURE, action: AM4.READ_LONG })
}

/** The AM4's answer to either: `{ slot, name }`, or null for anything else (the write's own bytes come back shorter, and carry no name). */
export function readAm4NamPick(f, block) {
  if (!AM4_NAM_BLOCKS.includes(block) || f?.length !== 64) return null
  if (!head(f, block, AM4_NAM_CAPTURE, AM4.SET) && !head(f, block, AM4_NAM_CAPTURE, AM4.READ_LONG)) return null
  const raw = unpackMsb(f.slice(16, f.length - 2), 40)
  let name = ''
  for (let i = 8; i < 40 && raw[i]; i++) name += String.fromCharCode(raw[i])
  /* The 32nd place of a name is its marker byte, not a letter (nam-install NAM_NAME_BYTE_AXE). */
  return { slot: raw[0] | (raw[1] << 8), name: name.slice(0, 31).replace(/ +$/, '') }
}

/**
 * THE ONE WAY OUT. Whether these bytes have the shape of anything a capture
 * job sends an AM4: a message of an upload, the list's question, "a
 * transfer is under way", or a NAM block's capture setting written.
 */
export function am4NamShaped(bytes) {
  if (!Array.isArray(bytes) || bytes[0] !== 0xf0 || bytes[4] !== MODELS.am4) return false
  if (bytes[5] === NAM_FN.begin || bytes[5] === NAM_FN.words || bytes[5] === NAM_FN.end) return true
  if (bytes[5] !== FN.PARAM || bytes.length < 13) return false
  const low = decode14(bytes[6], bytes[7])
  const high = decode14(bytes[8], bytes[9])
  const action = decode14(bytes[10], bytes[11])
  if (action === AM4_NAM_LIST) return true
  if (low === AM4_NAM_BUSY.register && high === AM4_NAM_BUSY.setting) return true
  return AM4_NAM_BLOCKS.includes(low) && high === AM4_NAM_CAPTURE
}

/**
 * Whether a frame of those shapes may go, given what the wire is doing with
 * captures at this moment (`going`, null when nothing), as nam-install's
 * namAllowed:
 *   going.list    any slot's question, 0 to 128, and nothing else;
 *   going.frames  only those very frames, byte for byte;
 *   going.pick    { block, slot }: that one write, or the read of that block.
 */
export function am4NamAllowed(bytes, going) {
  if (!going || !am4NamShaped(bytes)) return false
  if (going.list === true) {
    for (let s = 0; s < AM4_NAM_SLOTS; s++) if (sameBytes(bytes, am4NamSlotQuery(s))) return true
  }
  if (Array.isArray(going.frames) && going.frames.some((f) => sameBytes(f, bytes))) return true
  if (going.pick) {
    const w = am4NamPickFrame(going.pick.block, going.pick.slot)
    const r = am4NamPickRead(going.pick.block)
    return (!!w && sameBytes(bytes, w)) || (!!r && sameBytes(bytes, r))
  }
  return false
}

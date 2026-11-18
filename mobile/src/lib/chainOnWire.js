/**
 * THE CHAIN EDITOR OVER BLUETOOTH OR A USB CABLE: where it is offered, when
 * its chain is ready to draw, and the words it says while it reads.
 *
 * "I want to enable all of the items currently available to computer bridge
 * users to Bluetooth like chain editing" (Justin, 18 November 2026). The
 * editor itself is the one Edit has always had: it reaches a unit through
 * lib/device and never asks which wire is under it. What it needs is every
 * block's row and column, which Play's read over Bluetooth does not carry,
 * so while it is open the wire is asked for the chain with its places
 * (lib/device wantPlacedChain, bleWire gen3PlacedBlocks): the preset read
 * whole, half a minute down an adapter from a gen-3 unit and a moment on a
 * USB cable or an AM4.
 *
 * Pure: no imports, so a test reads it as it is. Phone-only.
 */

/**
 * Whether Edit offers the chain editor here. Through a computer, always (as
 * before). Over Bluetooth or a USB cable, only where the wire says so
 * (capabilities `chainEditor`: the chain open to this account, the editor's
 * own switch, Edit open on the unit). Never a VP4, and never over another
 * preset's chain.
 */
export const chainEditorHere = ({ vp4 = false, viaBle = false, caps = null, elsewhere = false } = {}) =>
  vp4 !== true && elsewhere !== true && (viaBle !== true || caps?.chainEditor === true)

/**
 * Whether the chain on screen has every block's place, so the editor can be
 * drawn from it. An empty chain has nothing to place. One block without a
 * whole row and column and it is not ready: a block drawn in the wrong
 * space is a block written over.
 */
export const placedReady = (blocks) => {
  const list = Array.isArray(blocks) ? blocks.filter((b) => b && typeof b === 'object') : []
  return list.every((b) => Number.isInteger(b.row) && b.row >= 0 && Number.isInteger(b.col) && b.col >= 0)
}

/** How far a read of the whole preset has got, as a whole percentage, or null when it has not said. Never 100 before the read has ended. */
export const placedPercent = (p) => {
  const got = Number(p?.got)
  const of = Number(p?.of)
  if (!Number.isFinite(got) || !Number.isFinite(of) || of <= 0 || got < 0) return null
  return Math.max(0, Math.min(99, Math.floor((got / of) * 100)))
}

export const PLACED_READING = 'Reading the chain from the unit…'
export const PLACED_READING_BACK = 'Reading the chain back from the unit…'
/** The line while the chain is read: with how far it has got where the wire says. `back` after a change. */
export const placedReadingLine = (p, { back = false } = {}) => {
  const pct = placedPercent(p)
  const words = back ? PLACED_READING_BACK : PLACED_READING
  return pct === null ? words : `${words} ${pct}%`
}

/** Said under it where the read is the slow one (lib/bleSwitch gridReadTakesLong): never on a USB cable, an AM4 or through a computer. `unit` is the unit's own name. */
export const placedSlowLine = (unit) =>
  `Over Bluetooth the ${unit || 'unit'} is read again after every change, which takes about half a minute to a minute. Keep the app open until it’s done.`

export const PLACED_FAILED = 'The chain couldn’t be read from the unit.'

/**
 * The blocks whose own controls can be sent from here: every one but a
 * looper the chain editor's read over Bluetooth handed on (`noControls`,
 * bleWire gen3PlacedBlocks), whose buttons are the computer's. Play looks
 * for its looper among these, so it draws none whose buttons would do
 * nothing; the chain editor still sees the block and holds its cell.
 */
export const withControls = (blocks) => (Array.isArray(blocks) ? blocks.filter((b) => b?.noControls !== true) : blocks)

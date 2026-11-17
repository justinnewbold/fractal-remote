/*
 * WHERE THE PHONE'S OWN NAMES ARE HANDED TO THE CHAIN READ (lib/ownBlocks).
 *
 * lib/device reads the chain and must not learn about catalogs or accounts
 * (it imports neither, and dozens of tests copy it alone), so it takes a
 * namer instead (setChainNamer), and this file is the one place that sets
 * it: imported once, by App.js, for what it does on the way in.
 *
 * Asked at every read: which unit the computer has (the rig's own slug for
 * it) and whether this account is offered the names: his alone
 * (lib/bluetooth bluetoothAdmin, the sign-in kept on the device) until
 * lib/features OWN_BLOCKS_THROUGH_COMPUTER_FOR_EVERYONE says everybody.
 */
import { setChainNamer } from './device'
import { getState } from './rig'
import { bluetoothAdmin, ownKnobsLevel } from './bluetooth'
import { OWN_BLOCKS_THROUGH_COMPUTER_FOR_EVERYONE } from './features'
import { nameOwnBlocks, ownCellName, ownInChainEditor, ownInPalette } from './ownBlocks'

/* Whether this account is offered the phone's own names for a unit's blocks through the computer. */
const openHere = () => bluetoothAdmin() === true || OWN_BLOCKS_THROUGH_COMPUTER_FOR_EVERYONE

/** The chain editor's list of blocks to add, with the unit's own blocks in it for the accounts they are named for (lib/ownBlocks ownInPalette). */
export const ownPaletteHere = (list) => ownInPalette(list, getState().deviceSlug, openHere())

/** The chain as the chain editor takes it: a block named here is one it can move and remove (lib/ownBlocks ownInChainEditor). */
export const ownChainHere = (blocks) => ownInChainEditor(blocks, openHere())

/** A grid cell's name as the phone has it, for Quick build's log line (lib/ownBlocks ownCellName). Log only, so not behind the account's switch: it changes nothing on a screen. */
export const ownCellNameHere = (cell) => ownCellName(cell, getState().deviceSlug)

setChainNamer((blocks) => nameOwnBlocks(blocks, getState().deviceSlug, bluetoothAdmin() === true || OWN_BLOCKS_THROUGH_COMPUTER_FOR_EVERYONE, ownKnobsLevel(bluetoothAdmin() === true)))

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
import { bluetoothAdmin } from './bluetooth'
import { OWN_BLOCKS_THROUGH_COMPUTER_FOR_EVERYONE } from './features'
import { nameOwnBlocks } from './ownBlocks'

setChainNamer((blocks) => nameOwnBlocks(blocks, getState().deviceSlug, bluetoothAdmin() === true || OWN_BLOCKS_THROUGH_COMPUTER_FOR_EVERYONE))

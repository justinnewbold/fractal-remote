/*
 * What the NAM & TONE3000 help page is told about this account, so the page
 * itself reaches nothing that talks to a unit. Read only: two switches.
 */
import { am4NamAddHere, am4NamOverBluetooth } from './bluetooth'

/** Whether the app itself puts a NAM block in an AM4's slot for this account: the same two gates the list of blocks to add asks. */
export const am4AddsHere = () => am4NamOverBluetooth() && am4NamAddHere()

import { useBluetoothAdmin } from './bluetooth'
import { BACKUPS_FOR_EVERYONE } from './features'
import { backupsOn } from './backups'

/**
 * Whether whoever is signed in on this device has Backups (lib/backups):
 * his account (the sign-in kept here) until features BACKUPS_FOR_EVERYONE,
 * and everyone after. Read where the row and the page are drawn.
 */
export const useBackups = () => backupsOn({ admin: useBluetoothAdmin(), everyone: BACKUPS_FOR_EVERYONE })

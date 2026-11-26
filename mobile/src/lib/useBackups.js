import { useBluetoothAdmin } from './bluetooth'
import { AUTO_BACKUP_FOR_EVERYONE, BACKUPS_FOR_EVERYONE, BACKUPS_OVER_BLUETOOTH_FOR_EVERYONE } from './features'
import { backupsOn } from './backups'

/**
 * Whether whoever is signed in on this device has Backups (lib/backups):
 * his account (the sign-in kept here) until features BACKUPS_FOR_EVERYONE,
 * and everyone after. Read where the row and the page are drawn.
 */
export const useBackups = () => backupsOn({ admin: useBluetoothAdmin(), everyone: BACKUPS_FOR_EVERYONE })

/**
 * Whether the Backups page keeps backups on this device over Bluetooth or
 * the unit's USB cable (lib/presetDump): his account until features
 * BACKUPS_OVER_BLUETOOTH_FOR_EVERYONE. The wire asks the same of
 * lib/bluetooth backupsOverBluetooth.
 */
export const usePhoneBackups = () => backupsOn({ admin: useBluetoothAdmin(), everyone: BACKUPS_OVER_BLUETOOTH_FOR_EVERYONE })

/**
 * Whether a save from this device asks the computer to keep a copy of the
 * slot first, and Edit draws Restore preset (components/RestorePreset): his
 * account until features AUTO_BACKUP_FOR_EVERYONE.
 */
export const useAutoBackup = () => backupsOn({ admin: useBluetoothAdmin(), everyone: AUTO_BACKUP_FOR_EVERYONE })

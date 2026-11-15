import { useBluetoothAdmin } from './bluetooth'
import { QUICK_BUILD_FOR_EVERYONE } from './features'
import { quickBuildOn } from './quickBuild'

/**
 * Whether whoever is signed in on this device has Quick build and starter
 * chains (lib/quickBuild): his account (the sign-in kept here) until
 * features QUICK_BUILD_FOR_EVERYONE, and everyone after. A hook, read where
 * each piece is drawn (Edit, Play and Settings), so all three follow one
 * answer.
 */
export const useQuickBuild = () => quickBuildOn({ admin: useBluetoothAdmin(), everyone: QUICK_BUILD_FOR_EVERYONE })

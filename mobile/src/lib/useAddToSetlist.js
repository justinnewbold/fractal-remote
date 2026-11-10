import { useBluetoothAdmin } from './bluetooth'
import { ADD_TO_SETLIST_FOR_EVERYONE } from './features'
import { addToSetlistOn } from './addToSetlist'

/**
 * Whether a hold on a preset in All presets offers Add to setlist
 * (lib/addToSetlist) to whoever is signed in on this device: his account
 * (the sign-in kept here, the same read App.js calls `sidesAdmin`) until
 * features ADD_TO_SETLIST_FOR_EVERYONE, and everyone after. A hook, read
 * where the rows are drawn (screens/Presets), so the list beside Play, in
 * a third side and on its own all follow one answer with nothing handed
 * down to them.
 */
export const useAddToSetlist = () => addToSetlistOn({ admin: useBluetoothAdmin(), everyone: ADD_TO_SETLIST_FOR_EVERYONE })

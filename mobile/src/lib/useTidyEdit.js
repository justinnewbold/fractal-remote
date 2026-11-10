import { useBluetoothAdmin } from './bluetooth'
import { TIDY_EDIT_FOR_EVERYONE } from './features'

/**
 * Whether the tidier Edit (lib/tidyEdit) and the handle on the line between
 * the two sides (lib/sidesSplit) are open to whoever is signed in on this
 * device: his account (the sign-in kept here, the same read App.js calls
 * `sidesAdmin`) until features TIDY_EDIT_FOR_EVERYONE, and everyone after.
 * A hook, read where the rows are drawn (Edit, its block panel), so the
 * knobs in Play's hold pop-up and in Derek's panel follow the same answer
 * with nothing handed down to them.
 */
export const useTidyEdit = () => {
  const his = useBluetoothAdmin()
  return TIDY_EDIT_FOR_EVERYONE || his
}

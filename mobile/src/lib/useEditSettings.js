import { useBluetoothAdmin } from './bluetooth'
import { EDIT_SETTINGS_FOR_EVERYONE } from './features'

/**
 * Whether Edit draws a block's list settings under its knobs
 * (lib/editSettings, components/BlockSettings): his account's, by the
 * sign-in kept on the device, until lib/features EDIT_SETTINGS_FOR_EVERYONE
 * says everybody. The same gate as the tidier Edit's (lib/useTidyEdit).
 */
export const useEditSettings = () => {
  const his = useBluetoothAdmin()
  return EDIT_SETTINGS_FOR_EVERYONE || his
}

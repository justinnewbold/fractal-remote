import { useBluetoothAdmin } from './bluetooth'
import { NAM_PICKER_FOR_EVERYONE } from './features'

/**
 * Whether Edit draws the capture picker on a NAM block (lib/captureList,
 * components/CapturePicker): his account's, by the sign-in kept on the
 * device, until lib/features NAM_PICKER_FOR_EVERYONE says everybody. The
 * same gate as Edit's list settings (lib/useEditSettings).
 */
export const useCapturePicker = () => {
  const his = useBluetoothAdmin()
  return NAM_PICKER_FOR_EVERYONE || his
}

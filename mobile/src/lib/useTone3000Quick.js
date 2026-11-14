import { useBluetoothAdmin } from './bluetooth'
import { TONE3000_QUICK_FOR_EVERYONE } from './features'

/**
 * Whether a held NAM block's pop-up offers TONE3000 (lib/tone3000Quick,
 * components/Tone3000Quick): his account's, by the sign-in kept on the
 * device, until lib/features TONE3000_QUICK_FOR_EVERYONE says everybody.
 * The same gate as the capture picker's (lib/useCapturePicker).
 */
export const useTone3000Quick = () => {
  const his = useBluetoothAdmin()
  return TONE3000_QUICK_FOR_EVERYONE || his
}

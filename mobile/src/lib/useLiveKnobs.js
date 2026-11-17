import { useBluetoothAdmin } from './bluetooth'
import { LIVE_KNOBS_FOR_EVERYONE } from './features'

/**
 * Whether Edit's knobs follow the unit for this account (lib/liveKnobs,
 * lib/liveKnobsHere): his, by the sign-in kept on the device, until
 * lib/features LIVE_KNOBS_FOR_EVERYONE says everybody. The same gate as
 * the block's list settings (lib/useEditSettings). The wire asks its own
 * (lib/bluetooth liveKnobsOverBluetooth).
 */
export const useLiveKnobs = () => {
  const his = useBluetoothAdmin()
  return LIVE_KNOBS_FOR_EVERYONE || his
}

import { useBluetoothAdmin } from './bluetooth'
import { PRESET_WHEEL_FOR_EVERYONE } from './features'
import { presetWheelOn } from './presetWheel'

/**
 * Whether whoever is signed in on this device is offered the preset wheel
 * (lib/presetWheel) at all: his account (the sign-in kept here, the same
 * read App.js calls `sidesAdmin`) until features PRESET_WHEEL_FOR_EVERYONE,
 * and everyone after. A hook, read where the choice is drawn (Settings →
 * Tiles & scenes) and where the list is (screens/Presets), so the list
 * beside Play, in a third side and on its own all follow one answer.
 *
 * Whether the wheel is CHOSEN is the device's own setting
 * (presetWheel.wheelSetting): an account it is not offered to gets the list
 * whatever the device has kept.
 */
export const usePresetWheelOffered = () => presetWheelOn({ admin: useBluetoothAdmin(), everyone: PRESET_WHEEL_FOR_EVERYONE })

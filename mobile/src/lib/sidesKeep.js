import AsyncStorage from '@react-native-async-storage/async-storage'

/*
 * WHICH SIDE PLAY IS ON, kept on this device (lib/twoSides says the rest).
 *
 * "Play starts on the right with the tool on the left, the way you described
 * it. Swap flips them, and the app remembers your choice." Only this one
 * choice is kept: which tool was open is not, so nothing reopens by itself
 * when the app starts (you start on Play, on the side you picked last), and
 * it is never synced to the account, since it is about the hands holding
 * this one device. In try/catch, as every stored convenience here is: a
 * device that cannot read it starts on the default and loses nothing.
 */
const KEY = 'fractal-remote:play-on-right'

/** The default: Play on the right, the tool on the left. */
export const PLAY_ON_RIGHT = true

/** Which side Play was on last time, or the default when nothing was kept or nothing could be read. */
export async function readPlayOnRight() {
  try {
    const v = await AsyncStorage.getItem(KEY)
    return v === 'left' ? false : v === 'right' ? true : PLAY_ON_RIGHT
  } catch {
    return PLAY_ON_RIGHT
  }
}

/** Keep the choice for next time. Never throws, never awaited. */
export function keepPlayOnRight(onRight) {
  AsyncStorage.setItem(KEY, onRight ? 'right' : 'left').catch(() => {})
}

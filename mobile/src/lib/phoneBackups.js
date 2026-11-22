/*
 * THE BACKUPS KEPT ON THIS DEVICE (lib/presetDump has the rules and why):
 * the list, and each preset's frames under a key of its own, in the
 * device's storage. Read only when the Backups page asks; nothing here is
 * loaded when the app starts.
 */
import AsyncStorage from '@react-native-async-storage/async-storage'

import { INDEX_KEY, afterAdding, cleanIndex, dataKey, packFrames, unpackFrames } from './presetDump'

const readIndex = async () => {
  try {
    return cleanIndex(JSON.parse((await AsyncStorage.getItem(INDEX_KEY)) || '[]'))
  } catch {
    return []
  }
}

/** The list, newest first. */
export const listPhoneBackups = () => readIndex()

/**
 * Keep one. The frames are written first and the list after, so the list
 * never names a backup that is not there. Throws when the storage will not
 * take it.
 */
export async function keepPhoneBackup({ unit, slot, name, frames }, now = Date.now()) {
  const id = `p${now.toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`
  const entry = { id, unit, slot, name, at: now, bytes: frames.reduce((n, f) => n + f.length, 0) }
  await AsyncStorage.setItem(dataKey(id), packFrames(frames))
  const { index, dropped } = afterAdding(await readIndex(), entry)
  await AsyncStorage.setItem(INDEX_KEY, JSON.stringify(index))
  if (dropped.length) await AsyncStorage.multiRemove(dropped.map(dataKey)).catch(() => {})
  return { entry, index }
}

/** One backup's frames, or null when it is gone or damaged. */
export async function readPhoneBackup(id) {
  try {
    return unpackFrames(await AsyncStorage.getItem(dataKey(id)))
  } catch {
    return null
  }
}

/** Remove one; the list that is left. */
export async function removePhoneBackup(id) {
  const index = (await readIndex()).filter((e) => e.id !== id)
  await AsyncStorage.setItem(INDEX_KEY, JSON.stringify(index))
  await AsyncStorage.removeItem(dataKey(id)).catch(() => {})
  return index
}

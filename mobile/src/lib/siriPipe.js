import { requireOptionalNativeModule } from 'expo'

/*
 * SIRI'S HAND-OFF, FROM THE JAVASCRIPT SIDE: the native FractalSiri module
 * (mobile/modules/fractal-siri), and nothing more.
 *
 * The phrases are in the iPhone app (mobile/targets/watch/_shared/
 * SiriShortcuts.swift). Each one hands this side a command and when it
 * arrived, and waits for the words Siri is to say. Deciding what to do with a
 * command is the handler's, which uses these few calls: Play on screen, the
 * 1.5-second tap rule counted from `at`, Tuner off from any screen, the
 * checks, the demo and every word. The contract is written out in
 * FractalSiriModule.swift; the names below are held to it by
 * test/siri-native.mjs.
 *
 * INERT ON ANY OTHER BUILD. requireOptionalNativeModule answers null on a
 * build made before the native module, on Android and in the browser, so this
 * can ship by update ahead of the build, and `siriPresent()` is the check on
 * the binary itself, which an update cannot switch on.
 */

/** Every command the phrases send, by the name the Swift gives it. */
export const SIRI_COMMANDS = Object.freeze(['scene', 'next', 'previous', 'tunerOn', 'tunerOff', 'tempo', 'preset', 'pedalOn', 'pedalOff'])

/** The kinds of pedal Siri can name, for pedalOn and pedalOff. Boost is an AM4 amp's. */
export const SIRI_PEDALS = Object.freeze(['delay', 'drive', 'reverb', 'chorus', 'flanger', 'phaser', 'tremolo', 'pitch', 'wah', 'compressor', 'filter', 'rotary', 'gate', 'boost'])

/** How long Siri waits for reply() before the Swift says SIRI_NOT_SENT itself, counted from `at`. */
export const SIRI_REPLY_MS = 5000

/** What the Swift tells Siri when no reply came in time. */
export const SIRI_NOT_SENT = 'Not sent.'

let native
function pipe() {
  if (native !== undefined) return native
  try {
    native = requireOptionalNativeModule('FractalSiri')
  } catch {
    native = null
  }
  return native
}

/** Whether this build carries the Siri phrases at all. */
export const siriPresent = () => !!pipe()

/**
 * One event from the module, checked: `{ id, at, command, value, answered }`,
 * or null for anything that is not one. `at` is when the app received the
 * command (milliseconds, the clock Date.now() reads), never later than now;
 * `value` is the scene, tempo or preset number, or the kind of pedal, and
 * null when the command has none.
 */
export function siriCommand(event) {
  const id = typeof event?.id === 'string' && event.id ? event.id : null
  const command = SIRI_COMMANDS.includes(event?.command) ? event.command : null
  if (!id || !command) return null
  const now = Date.now()
  const at = Number.isFinite(event.at) ? Math.min(event.at, now) : now
  const v = event.value
  const value = Number.isInteger(v) || typeof v === 'string' ? v : null
  return { id, at, command, value, answered: event.answered === true }
}

/**
 * Listen for Siri's commands. The first listener is what lets the module hand
 * over the commands it held while nothing listened. Returns the way to stop.
 */
export function onSiriCommand(listener) {
  const mod = pipe()
  if (!mod?.addListener) return () => {}
  const sub = mod.addListener('onCommand', (event) => {
    const cmd = siriCommand(event)
    if (cmd) listener(cmd)
  })
  return () => sub?.remove?.()
}

/** The words Siri says for command `id`. Once; a second reply, or one after the wait, is ignored. */
export function answerSiri(id, words) {
  try {
    pipe()?.reply?.(String(id), String(words))
  } catch {
    /* A reply that cannot be given leaves Siri to say SIRI_NOT_SENT. */
  }
}

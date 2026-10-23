import { isOlder } from './versions.js'

/**
 * SIRI AND THE LINKS, AS PURE RULES: the words, the pedal kinds, what a
 * fractalremote:// link says, and who the links are open to.
 *
 * "Let's add all of the Siri commands to the build that we can." (Justin,
 * 23 October 2026.) The phrases are in the iPhone app (mobile/targets/watch/
 * _shared/SiriShortcuts.swift) and hand each command to lib/siri.js, which
 * decides what to do with it. This is the part of that which needs nothing
 * from a phone, so a test can call it: it imports nothing but the version
 * rule, and everything about the device in hand is passed in.
 */

/*
 * WHEN SIRI IS ANSWERED BY, counted from when the app received the command.
 * The Swift waits SIRI_REPLY_MS (five seconds, lib/siriPipe) and then says
 * "Not sent." itself, so the JavaScript answers a second before that: a write
 * still out by then is said as sent and not yet answered, never left to the
 * Swift's "Not sent.", which would be wrong about a command that went.
 */
export const SIRI_ANSWER_MS = 4000

/*
 * WHAT EACH KIND OF PEDAL SIRI CAN NAME IS, by the block slugs a unit's chain
 * read gives (lib/shortName has them all). A delay is any of the delays, so a
 * preset with one Plex Delay takes "Delay on", and one with Delay 1 and a Plex
 * Delay is two delays, which is never a guess. Boost is an AM4 amp's (lib/
 * am4-boost), and has no slug of its own: lib/siri finds it by the amp.
 */
export const PEDAL_SLUGS = Object.freeze({
  delay: Object.freeze(['delay', 'multitap', 'plex', 'megatap', 'tentap']),
  drive: Object.freeze(['drive']),
  reverb: Object.freeze(['reverb']),
  chorus: Object.freeze(['chorus']),
  flanger: Object.freeze(['flanger']),
  phaser: Object.freeze(['phaser']),
  tremolo: Object.freeze(['tremolo']),
  pitch: Object.freeze(['pitch']),
  wah: Object.freeze(['wah']),
  compressor: Object.freeze(['comp', 'compressor', 'multicomp']),
  filter: Object.freeze(['filter']),
  rotary: Object.freeze(['rotary']),
  gate: Object.freeze(['gate']),
  boost: Object.freeze([])
})

/** A kind of pedal as it is said: "Delay", "Compressor", "Boost". */
export const pedalWord = (kind) => (typeof kind === 'string' && kind ? kind[0].toUpperCase() + kind.slice(1) : '')

/** The blocks in a chain that are this kind of pedal: one is the one, none or two is a reason, never a guess. */
export function pedalMatches(blocks, kind) {
  const slugs = PEDAL_SLUGS[kind] || []
  return (Array.isArray(blocks) ? blocks : []).filter((b) => slugs.includes(b?.slug))
}

/*
 * EVERY WORD SIRI IS GIVEN, in plain US English, and the device in hand by
 * the noun it is passed (lib/device-word deviceNoun): never "this phone".
 * Play's own notes ("Not sent — not connected") are said as they are, with
 * the dash made a comma for speaking (`spoken`, below).
 */
export const SIRI_SAYS = Object.freeze({
  openPlay: (noun) => `Open Play on this ${noun}, then say it again.`,
  notSent: 'Not sent.',
  scene: (n, name) => (name ? `Scene ${n}, ${name}.` : `Scene ${n}.`),
  noScenes: 'This unit has no scenes.',
  sceneCount: (count) => `This unit has ${count} scenes.`,
  step: (by, label, name) => `${by > 0 ? 'Next' : 'Previous'}: ${name ? `${name}, preset ${label}` : `preset ${label}`}.`,
  end: (by) => (by > 0 ? 'There’s no next preset.' : 'There’s no previous preset.'),
  preset: (label, name) => (name ? `Preset ${label}, ${name}.` : `Preset ${label}.`),
  presetSame: (label) => `Already on preset ${label}.`,
  presetRange: (count) => (Number.isInteger(count) && count > 0 ? `This unit’s presets go from 0 to ${count - 1}.` : 'There’s no preset with that number.'),
  tempo: (bpm) => `Tempo ${bpm}.`,
  tempoRange: (min, max) => `This unit takes a tempo from ${min} to ${max}.`,
  tunerOn: 'Tuner on. Your rig is muted.',
  tunerAlready: 'The tuner is already on. Your rig is muted.',
  noTuner: 'This unit has no tuner the app can open.',
  tunerOff: 'Tuner off.',
  tunerOffSoon: 'Closing the tuner as soon as the connection is back.',
  pedal: (kind, on) => `${pedalWord(kind)} ${on ? 'on' : 'off'}.`,
  noPedal: (kind) => `This preset has no ${kind}.`,
  manyPedals: (kind) => `This preset has more than one ${kind}, so use the screen.`,
  notRead: 'This preset’s pedals aren’t read yet. Try again in a moment.',
  noAmp: 'This preset has no amp.',
  boostNotHere: 'Only an AM4’s amp has a boost the app can switch.'
})

/** A write that went and has not been answered when Siri must be: `what` is the command, as "Scene 3". */
export const sentWords = (what) => `Sent: ${what}. The unit hasn’t answered yet.`

/**
 * Words as Siri is handed them: one line, Play's dash made a comma, ending in
 * a stop, and never past the 300 characters the Swift keeps.
 */
export function spoken(words) {
  let out = String(words ?? '')
    .replace(/\s*\n+\s*/g, ' ')
    .replace(/\s+—\s+/g, ', ')
    .replace(/\s{2,}/g, ' ')
    .trim()
  if (out && !/[.!?]$/.test(out)) out += '.'
  return out.slice(0, 300)
}

/*
 * THE LINKS: fractalremote://next, previous, scene/1 to 8 and tuner/off.
 *
 * Never tuner on: any web page or message can open a link, and that one would
 * mute the rig. Anything else under the scheme, the bare scheme included, is
 * not a command and is left alone.
 */
export const LINK_SCHEME = 'fractalremote'

/** The command a link asks for, as `{ command, value }`, or null when it is not one of the four. */
export function parseLink(url) {
  const found = /^fractalremote:\/*([^?#]*)/i.exec(String(url ?? '').trim())
  if (!found) return null
  const parts = found[1].split('/').filter(Boolean).map((p) => p.toLowerCase())
  if (parts.length === 1 && parts[0] === 'next') return { command: 'next', value: null }
  if (parts.length === 1 && parts[0] === 'previous') return { command: 'previous', value: null }
  if (parts.length === 2 && parts[0] === 'scene' && /^[1-8]$/.test(parts[1])) return { command: 'scene', value: Number(parts[1]) }
  if (parts.length === 2 && parts[0] === 'tuner' && parts[1] === 'off') return { command: 'tunerOff', value: null }
  return null
}

/*
 * WHO THE LINKS ARE OPEN TO.
 *
 * They come by update, and an update reaches the 1.87.1 and 1.87.11 copies
 * too, whose approved review notes say nothing of them (Apple 2.3.1(a) and
 * 3.3.1(C), Google's rule on features switched on remotely, CLAUDE.md's
 * Bluetooth rule). So until the new store version they are Justin's alone,
 * by the account kept on the phone (isAdmin, as Bluetooth (beta) does), and
 * they open to everybody only on a copy of the app that is itself the new
 * store version. That is a fact about the copy, never a switch an update can
 * flip:
 *
 *   - on an iPhone or iPad, the Siri module is in it (lib/siriPipe
 *     siriPresent: requireOptionalNativeModule('FractalSiri') is null on
 *     every older build);
 *   - on Android, which has no Siri piece, the version built into the copy
 *     (lib/storeVersion installedStoreVersion, which an update never
 *     touches) is newer than LINKS_AFTER_STORE.
 *
 * LINKS_AFTER_STORE is the newest store version made before the links, on
 * both stores (docs/expo-builds.md: 1.87.11 on 11 October 2026, and nothing
 * built since). Every store build after it carries them.
 */
export const LINKS_AFTER_STORE = '1.87.11'

/** Whether a fractalremote:// link is acted on, for this account on this copy of the app. */
export function linksOpen({ native = false, platform = null, installed = null, admin = false } = {}) {
  if (admin === true || native === true) return true
  return platform === 'android' && isOlder(LINKS_AFTER_STORE, installed) === true
}

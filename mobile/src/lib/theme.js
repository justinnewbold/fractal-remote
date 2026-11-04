/**
 * The unit itself: anodized black chassis, warm silkscreen lettering, and the
 * two lights the hardware actually shows you — amber for signal, cyan for
 * connection.
 *
 * The same palette as the web app's `:root`, and for the same reason: nothing
 * is coloured for decoration. Colour here means something is on.
 *
 * Sizes are the stage's, not the desk's. Everything you press is at least 56pt
 * because it is pressed in the dark, at arm's length, sometimes mid-song, and
 * Apple's 44pt floor is a minimum for a phone held six inches from your face.
 */
const DARK = {
  chassis: '#0d0f12',
  panel: '#15181d',
  panelHi: '#1c2027',
  rule: '#262b33',
  silk: '#e6e3dc',
  silkDim: '#878d97',
  silkFaint: '#7a8189',

  /* semantic, not decorative */
  signal: '#f0a73c', // the audio path, and only that
  live: '#5fbfd1', // the Mac is answering
  fault: '#e0684f',
  ok: '#63c68c',
  /* Bluetooth (beta): the unit answering over Bluetooth, not through a
     computer. "Can we change the connected thing to be blue when it's on a
     Bluetooth connection instead of green?" Bluetooth's own blue, lifted to
     read on this black. The phone only: the browser never talks Bluetooth. */
  ble: '#5aa5ff',

  onSignal: '#14161a', // ink on an amber ground
  /* Ink on the red of a destructive ground. White in BOTH themes, unlike
     onSignal: amber is light and takes dark ink, and both of these reds
     are dark enough to need the opposite. */
  onFault: '#fff6f3',
  signalWash: 'rgba(240, 167, 60, 0.12)',
  liveHalo: 'rgba(95, 191, 209, 0.2)',
  faultHalo: 'rgba(224, 104, 79, 0.2)',
  okHalo: 'rgba(99, 198, 140, 0.2)',

  /* FROSTED GLASS, for the chrome only: buttons, bars, sheets, panes and
     list groups. The content (tiles, pedals, swatches) keeps its colours.
     Each fill is chosen to read at 4.5:1 or better with NO credit for
     blur, because Android draws none (lib/glass says which piece wears
     which). The shadows are strings React Native reads as box-shadow. */
  glassFill: 'rgba(21, 24, 29, 0.78)', // over the chassis it draws #13161b
  glassFillHi: 'rgba(28, 32, 39, 0.5)', // pressed; over the chassis #15181d
  glassBar: 'rgba(21, 24, 29, 0.55)', // the top bar, as it was
  glassRim: 'rgba(255, 255, 255, 0.12)',
  /* For a piece with a 1px border of its own: the light along the top and a soft drop. */
  glassLift: 'inset 0 1px 0 rgba(255, 255, 255, 0.18), 0 3px 10px rgba(0, 0, 0, 0.45)',
  /* For a piece with no border: the rim is drawn as a ring inside it, so nothing moves by a point. */
  glassLiftRing: 'inset 0 0 0 1px rgba(255, 255, 255, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.18), 0 3px 10px rgba(0, 0, 0, 0.45)',
  /* Ring and top light with no drop: rows, notes, cards inside a sheet. */
  glassFlat: 'inset 0 0 0 1px rgba(255, 255, 255, 0.10), inset 0 1px 0 rgba(255, 255, 255, 0.16)',
  glassTop: 'inset 0 1px 0 rgba(255, 255, 255, 0.18)',
  /* A lit amber, cyan or silk control, and one that already glows. */
  glassLit: 'inset 0 1px 0 rgba(255, 255, 255, 0.45), 0 3px 10px rgba(0, 0, 0, 0.35)',
  glassLitTop: 'inset 0 1px 0 rgba(255, 255, 255, 0.45)',
  /* Only ever over a lit control, whose ink is dark here, so the light half never costs it contrast. */
  glassSheen: 'linear-gradient(180deg, rgba(255, 255, 255, 0.22) 0%, rgba(255, 255, 255, 0) 45%, rgba(0, 0, 0, 0.1) 100%)',
  sheetFill: 'rgba(13, 15, 18, 0.93)',
  sheetLift: 'inset 0 1px 0 rgba(255, 255, 255, 0.18), 0 -6px 24px rgba(0, 0, 0, 0.35)',
  scrim: 'rgba(13, 15, 18, 0.45)',
  grabber: 'rgba(255, 255, 255, 0.28)',
  glassWell: 'rgba(0, 0, 0, 0.35)'
}

/**
 * The same rig under stage lighting that is actually on.
 *
 * "I'm not seeing where the light/dark/auto theme buttons are anymore. Please
 * put that back on Setup." The browser has had all three for a long time; the
 * phone never had any of them and was dark whatever the handset was set to,
 * which is wrong in a lit room and wrong on a phone in light mode.
 *
 * NOT AN INVERSION. The four semantic colours are darkened rather than
 * swapped, because their whole job is to mean something at a glance — amber
 * is the audio path, cyan is the computer answering, red is a fault, green is
 * good, blue is the unit answering over Bluetooth — and amber at #f0a73c on
 * white is a colour you cannot read. Same meanings, enough contrast to carry
 * them.
 */
const LIGHT = {
  chassis: '#f4f2ee',
  panel: '#ffffff',
  panelHi: '#e9e6e0',
  rule: '#d5d1c9',
  silk: '#1b1e23',
  silkDim: '#5b626c',
  /* Darker than it was (3.72:1 on the chassis), for 4.5:1 on light glass
     and under the edge of a light shadow. The phone's only: the browser's
     Light faint is darker still. */
  silkFaint: '#636a74',

  signal: '#a8650a',
  live: '#1d6b7a',
  fault: '#b23c26',
  ok: '#2c7a4b',
  ble: '#1f5fc4',

  /* Plain white, for 4.5:1 on the amber (the warm white was 4.46). */
  onSignal: '#ffffff',
  onFault: '#fff6f3',
  signalWash: 'rgba(168, 101, 10, 0.12)',
  liveHalo: 'rgba(29, 107, 122, 0.18)',
  faultHalo: 'rgba(178, 60, 38, 0.18)',
  okHalo: 'rgba(44, 122, 75, 0.18)',

  /* The same glass in daylight: white frost, a grey rim, a lighter drop.
     The rim at 0.22, not lighter: it is the only edge on a text field and an
     unticked box, and it must not read fainter than the old rule did
     (#d5d1c9, 1.36:1 on the chassis); the ring is the same rim, inside. */
  glassFill: 'rgba(255, 255, 255, 0.8)',
  glassFillHi: 'rgba(233, 230, 224, 0.6)',
  glassBar: 'rgba(255, 255, 255, 0.55)',
  glassRim: 'rgba(27, 30, 35, 0.22)',
  glassLift: 'inset 0 1px 0 rgba(255, 255, 255, 0.95), 0 2px 6px rgba(27, 30, 35, 0.1)',
  glassLiftRing: 'inset 0 0 0 1px rgba(27, 30, 35, 0.22), inset 0 1px 0 rgba(255, 255, 255, 0.95), 0 2px 6px rgba(27, 30, 35, 0.1)',
  glassFlat: 'inset 0 0 0 1px rgba(27, 30, 35, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.95)',
  glassTop: 'inset 0 1px 0 rgba(255, 255, 255, 0.95)',
  glassLit: 'inset 0 1px 0 rgba(255, 255, 255, 0.35), 0 2px 6px rgba(27, 30, 35, 0.16)',
  glassLitTop: 'inset 0 1px 0 rgba(255, 255, 255, 0.35)',
  /* A shade only, never a light: the ink on the amber is white here, and lightening under it would cost it. */
  glassSheen: 'linear-gradient(180deg, rgba(0, 0, 0, 0) 0%, rgba(0, 0, 0, 0) 45%, rgba(0, 0, 0, 0.1) 100%)',
  sheetFill: '#ffffff',
  sheetLift: 'inset 0 1px 0 rgba(255, 255, 255, 0.95), 0 -6px 24px rgba(27, 30, 35, 0.14)',
  scrim: 'rgba(13, 15, 18, 0.45)',
  grabber: 'rgba(27, 30, 35, 0.22)',
  glassWell: '#f4f2ee'
}

/**
 * The glass made solid: Sunlight, the look for reading in bright light, and
 * an iPhone set to Reduce Transparency (lib/glass chromeSolid says when).
 *
 * Only the five fills change, each to the exact colour it draws on the plain
 * ground, so on the chassis nothing looks different and nowhere does anything
 * show through. The shapes, the rims, the top light, the sheen and the
 * shadows all stay: "keeps the new shapes and light edge but is OPAQUE". The
 * scrim stays too, because it is a dim behind a sheet, not chrome.
 */
const SOLID_DARK = {
  glassFill: '#13161b',
  glassFillHi: '#15181d',
  glassBar: '#111418',
  sheetFill: '#0d0f12',
  glassWell: '#080a0c'
}

const SOLID_LIGHT = {
  glassFill: '#fdfcfc',
  glassFillHi: '#edebe6',
  glassBar: '#faf9f7',
  sheetFill: '#ffffff',
  glassWell: '#f4f2ee'
}

/**
 * The palette every screen reads, MUTATED IN PLACE when the mode changes.
 *
 * This is the whole trick, and it is worth saying why rather than leaving
 * somebody to find it. There are 252 reads of `color.something` across 25
 * files, every one of them inline in a render — this app has no
 * StyleSheet.create anywhere, which is usually a small inefficiency and here
 * is the thing that makes a theme possible at all. Inline styles are read
 * fresh on every render, so swapping the VALUES on this object and then
 * re-rendering repaints the app without a single call site changing.
 *
 * The alternative was a context and a hook, and 252 edits across 25 files on
 * the evening before a build. The object is exported frozen-shaped and never
 * replaced: `import { color }` anywhere still points at this one.
 */
export const color = { ...DARK }

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 }

/* `card` is the glass's: cards, list groups, text fields and the two-line buttons, whose line under reaches 4pt from the edge (a capsule would cut it). The four before it stay as they were, because the tiles read them. */
export const radius = { sm: 6, md: 10, lg: 14, pill: 999, card: 18 }

export const font = {
  micro: 11,
  small: 13,
  body: 15,
  lead: 18,
  title: 24,
  hero: 34,
  /** The preset name, read from a stand. */
  display: 40
}

/** Nothing pressable is smaller than this. */
export const TAP = 56

/**
 * A monospace face that exists on both platforms.
 *
 * Slot numbers, BPM and cents are all things you compare at a glance, and
 * proportional digits move under you while they change.
 */
export const mono = { ios: 'Menlo', android: 'monospace', default: 'monospace' }


/* ------------------------------------------------------------------ */
/* Light, dark, or whatever the phone is set to                        */
/* ------------------------------------------------------------------ */

/** The three, in the order the buttons show them. */
export const MODES = ['auto', 'light', 'dark']

const KEY = 'fractal.theme'

/*
 * DARK UNTIL SOMEBODY CHOOSES. "Can we make the default dark mode on the
 * app?" Justin, 18 October 2026. Auto was the default, and a phone set to
 * light came up on the paper theme on a dark stage. Somebody who chose Auto
 * (or Light) keeps it: the phone has always written the choice down, Auto
 * included, so only a phone that never chose starts dark.
 */
const DEFAULT = 'dark'

let mode = DEFAULT
let systemDark = true
/* Whether the glass is drawn solid (setSolidChrome). */
let solid = false
const watchers = new Set()

/** Which of the three is chosen. Not which one is being shown — see `isDark`. */
export const getMode = () => mode

/** Whether the dark palette is the one on screen right now. */
export const isDark = () => (mode === 'auto' ? systemDark : mode === 'dark')

/**
 * Put the right palette into `color`, and tell anybody watching.
 *
 * Every key is written every time rather than only the ones that differ: a
 * palette that gained a colour in one theme and not the other would otherwise
 * leave the old theme's value behind on it, and that bug shows up as one
 * wrong-coloured thing on one screen in one mode.
 */
function paint() {
  const dark = isDark()
  const next = { ...(dark ? DARK : LIGHT), ...(solid ? (dark ? SOLID_DARK : SOLID_LIGHT) : null) }
  for (const key of Object.keys(next)) color[key] = next[key]
  for (const tell of watchers) tell()
}

/**
 * The glass drawn solid, or see-through again: the Sunlight look, or an
 * iPhone set to Reduce Transparency (lib/glass chromeSolid, asked by
 * lib/useSolidChrome at the root). Only the five fills change, and in place,
 * like a theme, so the next render repaints everything. Asking for what is
 * already so paints nothing and tells nobody.
 */
export function setSolidChrome(on) {
  const next = on === true
  if (next === solid) return
  solid = next
  paint()
}

/** Whether the glass is drawn solid right now. */
export const isSolidChrome = () => solid

/** Choose one. Remembered on this phone. */
export function setMode(next, storage) {
  mode = MODES.includes(next) ? next : DEFAULT
  try {
    storage?.setItem(KEY, mode)
  } catch {
    /* Costs the next launch, not this press. */
  }
  paint()
}

/** What was chosen last time. Nothing chosen, or anything unreadable, is Dark. */
export function loadMode(storage) {
  try {
    const saved = storage?.getItem(KEY)
    mode = MODES.includes(saved) ? saved : DEFAULT
  } catch {
    mode = DEFAULT
  }
  paint()
  return mode
}

/**
 * What the handset itself is set to, which Auto follows.
 *
 * Passed in rather than read here so this file stays free of react-native
 * imports — it is loaded by the test suite under plain Node, where
 * `Appearance` does not exist.
 */
export function setSystemDark(dark) {
  systemDark = dark !== false
  paint()
}

/** Re-render on a change. Returns the unsubscribe, for useSyncExternalStore. */
export function watchTheme(tell) {
  watchers.add(tell)
  return () => watchers.delete(tell)
}

/** A version that changes whenever the palette does, for a store subscription. */
let painted = 0
watchers.add(() => {
  painted += 1
})
export const themeVersion = () => painted

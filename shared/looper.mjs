/**
 * The looper's buttons, for both apps.
 *
 * "If you click the looper pedal, it pops up the looper controls." The unit's
 * Looper block is driven by the host's POST /preset/looper/control, which
 * takes the block, a button and whether it is down — the same float 1.0/0.0
 * write FM3-Edit's looper page sends.
 *
 * Record, Play, Dub, Reverse and Half latch: one tap turns it on, the next
 * turns it off. Stop, Undo and Once are a quick press — down, then up a moment
 * later — the way a footswitch is. This is how Axiom drives the same block on
 * the same server, and it is where the split came from.
 *
 * The unit does not say which of its looper buttons are lit, so the lit ones
 * here are what THIS APP switched on. A footswitch on the floor can move the
 * unit without telling us, which is why the panel says so in words.
 */

export const LOOPER_TOGGLES = ['record', 'play', 'overdub', 'reverse', 'half']
export const LOOPER_ROWS = [
  ['record', 'play', 'stop'],
  ['overdub', 'undo', 'once'],
  ['reverse', 'half']
]
export const LOOPER_LABEL = {
  record: 'Rec',
  play: 'Play',
  stop: 'Stop',
  overdub: 'Dub',
  undo: 'Undo',
  once: 'Once',
  reverse: 'Rev',
  half: '½ Speed'
}

/** How long a quick press is held down before it is let go. */
export const PRESS_MS = 120

export const IDLE_LATCH = Object.freeze({ record: false, play: false, overdub: false, reverse: false, half: false })

export const isLooper = (b) => b?.slug === 'looper'
export const findLooper = (blocks) => (blocks || []).find(isLooper) || null
export const isToggle = (action) => LOOPER_TOGGLES.includes(action)

/** One latch per preset and block, so a different preset starts idle. */
export const looperKey = (presetNumber, eid) => `${presetNumber ?? '?'}:${eid}`

/**
 * What a tap sends, and what is lit after it.
 *
 * `sends` is the list of (on) values to write in order: one for a latch, a
 * press and a release for a quick press.
 */
export function looperTap(latch, action) {
  const now = latch || IDLE_LATCH
  if (isToggle(action)) {
    const on = !now[action]
    return { sends: [on], next: { ...now, [action]: on } }
  }
  if (action === 'stop') return { sends: [true, false], next: { ...now, record: false, play: false, overdub: false } }
  return { sends: [true, false], next: now }
}

/**
 * "There needs to be something in settings … for when it keeps playing."
 *
 * Every write that stands for "stop": Stop pressed and let go, then Record,
 * Dub and Play written off. Writing off to a button that is already off moves
 * nothing, so this is safe to send whatever state the looper is really in —
 * which is the point, since nobody reaching for it knows.
 */
export const STOP_EVERYTHING = [
  ['stop', true],
  ['stop', false],
  ['record', false],
  ['overdub', false],
  ['play', false]
]

/** The word beside "Looper". The latch says record and dub; a moving playhead says it is playing. */
export function looperStatus(latch, moving) {
  const now = latch || IDLE_LATCH
  if (now.record) return 'Recording'
  if (now.overdub) return 'Overdub'
  if (moving || now.play) return 'Playing'
  return 'Stopped'
}

/** The host's telemetry answer, made safe to draw: a 0..1 envelope and a 0..1 playhead, or nothing. */
export function readTelemetry(raw) {
  const wave = Array.isArray(raw?.wave) ? raw.wave.map((v) => Math.max(0, Math.min(1, Number(v) || 0))) : []
  const p = raw?.position == null ? null : Number(raw.position)
  return { wave, position: Number.isFinite(p) ? Math.max(0, Math.min(1, p)) : null }
}

/**
 * The envelope cut down to a number of bars a phone can draw as plain views.
 * The host sends roughly six hundred points; each bar is the loudest of its share.
 */
export function waveBars(wave, bars = 60) {
  if (!wave?.length) return []
  if (wave.length <= bars) return wave.slice()
  const out = []
  for (let i = 0; i < bars; i++) {
    const a = Math.floor((i * wave.length) / bars)
    const b = Math.max(a + 1, Math.floor(((i + 1) * wave.length) / bars))
    let top = 0
    for (let j = a; j < b; j++) top = Math.max(top, wave[j])
    out.push(top)
  }
  return out
}

/**
 * How often the open panel asks where the playhead is. Each ask is three
 * reads at the unit. A second and a half keeps that well clear of the meter
 * traffic that once made the audio cut out, and only while the panel is open.
 */
export const TELEMETRY_MS = 1500
/** After this many unanswered asks in a row the panel stops asking. */
export const TELEMETRY_MISSES = 3

/**
 * What the footswitches do, read off the unit and said in words.
 *
 * "See what the footswitches do" was a request neither app could answer,
 * because nothing in either one ever asked the unit. The host has had the two
 * routes for it all along: GET /fc/model, which is only a dictionary — the
 * words for each kind of action, each function inside it and each LED colour
 * — and GET /fc/state, which is one switch's actual settings.
 *
 * That second one is the expensive part, and the reason this file is careful.
 * One switch is about twenty-nine questions to the unit, one after another:
 * seven for the tap and hold actions and the light, and eleven letters each
 * for the tap and hold labels (the pinned server, gen3.ts fcReadState). A
 * unit busy answering those is a unit that is also making sound, so:
 *
 *   - one view at a time, the three switches a player's feet are on
 *   - only when somebody opens it, never on a timer and never in the
 *     background
 *   - one switch after another with a breath between, never three at once
 *   - and it stops the moment the panel closes
 *
 * Only on a unit that says it can (`capabilities.fc.liveState`). Today that is
 * the FM3: an FM9 and an Axe-Fx III serve the dictionary but not the read.
 *
 * WHICH scene, preset or block a switch picks, which layout and view are on
 * now and what the layouts are called come from the computer, when its
 * device server has the reads for them (ForgeFX `fc.current`, `fc.names` and
 * `fc.picks`, FM3 only, all reads on the same question kind as the rest).
 * A computer from before them says none of it, and the page then looks
 * exactly as it did: FC_NOT_YET under the switches, the pickers on Layout 1,
 * View 1. Nothing here raises COMPUTER_NEEDED: the page works without them.
 * And the label-mode number is not trusted — so a custom label is shown
 * whenever the unit has one stored, rather than only when the mode says
 * "Custom".
 *
 * Shared, with no imports, so the phone can say the same words the day it
 * grows the same panel.
 */

/** Whether this unit can have its switches read at all. Nothing else opens the panel. */
export const fcReadable = (capabilities) => capabilities?.fc?.liveState === true

/** The full sentence, above the switches. Its short form is the fold's own
 * note in App.jsx, which is what is seen before anything is read. */
export const FC_BUSY_WARNING =
  'Reading the switches asks the unit a lot of questions, so it is best done between songs.'

/** And the one below them: what is not shown, so nobody hunts for it. */
export const FC_NOT_YET = 'Which scene, preset or block a switch picks isn’t shown yet.'

/** In its place when the computer says what the switches pick: the kinds it says it for. */
export const FC_PICKS_SOME = 'What a switch picks is shown for scene, preset and effect switches.'

/** Whether the computer said what these switches pick (its /fc/state carries tapPick). */
export const fcSaysPicks = (states) => (states || []).some((s) => !!s && typeof s === 'object' && 'tapPick' in s)

/** Whether the computer can say which layout and view are on now (GET /fc/current). */
export const fcKnowsCurrent = (capabilities) => fcReadable(capabilities) && capabilities.fc.current === true

/** Whether the computer can read the layout names (GET /fc/names). */
export const fcKnowsNames = (capabilities) => fcReadable(capabilities) && capabilities.fc.names === true

/** The host's routes for the two. Both only ask; neither changes anything on the unit. */
export const FC_CURRENT_PATH = '/fc/current'
export const FC_NAMES_PATH = '/fc/names'

/** The breath between one switch and the next, in milliseconds. */
export const FC_PAUSE_MS = 300

/**
 * How the switches are laid out. An FM3 has 9 layouts (the last is Master),
 * 4 views in each and 3 switches in a view; the host says so in /fc/model and
 * these are only what to assume if a field is missing from it.
 */
export function fcGeometry(model) {
  const whole = (n, fallback) => (Number.isInteger(n) && n > 0 ? n : fallback)
  return {
    layouts: whole(model?.layouts, 9),
    views: whole(model?.views, 4),
    switches: whole(model?.switches, 3)
  }
}

/** "Layout 3", or "Master" for the ninth of nine — the unit's own word for it. */
export const layoutName = (index, layouts = 9) =>
  layouts === 9 && index === 8 ? 'Master' : `Layout ${index + 1}`

const isMaster = (index, layouts) => layouts === 9 && index === 8

/**
 * Which layout and view the unit's own switches are on, out of GET
 * /fc/current: { layout, view }, both counted from 0, or null when the
 * computer did not say or said something outside the unit's layouts.
 */
export function currentOf(answer, geometry = fcGeometry(null)) {
  const now = answer && typeof answer === 'object' && !answer.error ? answer.current : null
  if (!now || typeof now !== 'object') return null
  const { layout, view } = now
  if (!Number.isInteger(layout) || layout < 0 || layout >= geometry.layouts) return null
  if (!Number.isInteger(view) || view < 0 || view >= geometry.views) return null
  return { layout, view }
}

/**
 * The layout names out of GET /fc/names, one per layout: the unit's own
 * text, or null where it gave none. The Master's is left out: the page calls
 * it Master whatever it is named, as the unit's own list does.
 */
export function namesOf(answer, layouts = 9) {
  const list = answer && typeof answer === 'object' && !answer.error && Array.isArray(answer.names) ? answer.names : []
  return Array.from({ length: layouts }, (_, i) => {
    const t = typeof list[i] === 'string' ? list[i].trim() : ''
    return t && !isMaster(i, layouts) ? t : null
  })
}

/** "Layout 2 · SCENES", and "· on now" after the one the unit is on. */
export function layoutLabel(index, { layouts = 9, names = null, now = null } = {}) {
  const name = names?.[index]
  const words = name ? `${layoutName(index, layouts)} · ${name}` : layoutName(index, layouts)
  return now && now.layout === index ? `${words} · on now` : words
}

/** "View 2", and "· on now" when the layout on screen is the one the unit is on and this is its view. */
export function viewLabel(index, { layout, now = null } = {}) {
  const words = `View ${index + 1}`
  return now && now.layout === layout && now.view === index ? `${words} · on now` : words
}

/** The line over the pickers: "The unit is on Layout 2 (SCENES), View 1 right now." */
export function nowWords(now, { layouts = 9, names = null } = {}) {
  if (!now) return null
  const name = names?.[now.layout]
  const where = name ? `${layoutName(now.layout, layouts)} (${name})` : layoutName(now.layout, layouts)
  return `The unit is on ${where}, View ${now.view + 1} right now.`
}

/** The host's route for one switch. All three numbers count from 0. */
export const fcStatePath = (layout, view, sw) =>
  `/fc/state?layout=${layout}&view=${view}&switch=${sw}`

/**
 * One action (tap or hold) in words.
 *
 * `null` from the host means that question went unanswered, which is not the
 * same as "nothing on this switch" and must not read like it.
 */
function actionWords(category, fn, model) {
  if (category == null) return 'Couldn’t read'
  if (category === 0) return 'Nothing'
  const kind = model?.categories?.[category]
  if (!kind) return 'Something this app can’t name yet'
  const named = fn == null ? null : (model?.functions?.[category] || []).find((f) => f?.ord === fn)?.name
  /* Per-Preset's one function is called "Placeholder", which says nothing. */
  if (!named || named === 'Placeholder' || named === 'Unassigned') return kind
  /* "Utility · Tap Tempo" is two words for one thing. */
  if (kind === 'Utility') return named
  return `${kind} · ${named}`
}

/*
 * THE LIGHTS, IN THE EDITORS' OWN COLOURS AND WORDS.
 *
 * These were the host's dictionary (GET /fc/model), and ForgeFX's table is an
 * approximation: Red #e23b3b where FM3-Edit's ring is #cc0000, Purple #9b59f5
 * against #6633cc, a golden Yellow, a hot Pink, Teal called "Turquoise" — and
 * no Default at all, which is what most switches are set to, so most of them
 * read "a colour this app can't name yet". This is the most literal "button
 * colors" the app has, so the app keeps its own table: the fills of FM3-Edit's
 * footswitch/led-ring-*.svg, under the names the Footswitch Functions Guide
 * uses, by the numbers the official .fclayout files use for them (the Master
 * layout's Presets, Scenes and Effects switches are 4, 1 and 6: Green, Red,
 * Cyan). Off is the editor's unlit ring.
 */
export const RING_COLOURS = Object.freeze({
  1: { name: 'Red', hex: '#cc0000' },
  2: { name: 'Orange', hex: '#ff9933' },
  3: { name: 'Yellow', hex: '#ffff00' },
  4: { name: 'Green', hex: '#66cc33' },
  5: { name: 'Blue', hex: '#0055ff' },
  6: { name: 'Cyan', hex: '#00ccff' },
  7: { name: 'Purple', hex: '#6633cc' },
  8: { name: 'White', hex: '#ffffff' },
  9: { name: 'Pink', hex: '#ff99cc' },
  10: { name: 'Teal', hex: '#009999' },
  11: { name: 'Lime', hex: '#ccff33' },
  12: { name: 'Off', hex: '#777777' }
})

/*
 * 0 IS "DEFAULT": the switch lights whatever its kind lights by default, from
 * the Footswitch Functions Guide v1.3 — Scene red, Effect cyan, Preset green,
 * Bank orange, Utility blue, Layout yellow, Control Switch purple, View teal.
 * That 0 means Default on the wire is inferred from the layout files, where
 * 77 of 108 switches in each OMG layout carry it; no live read has shown one
 * yet. A kind the guide gives no single colour (the looper's switches each
 * have their own) is said as Default with no colour drawn.
 */
const KIND_DEFAULT = {
  Scene: 1,
  Effect: 6,
  Preset: 4,
  Bank: 2,
  Utility: 5,
  Layout: 3,
  Control: 7,
  'Control Switch': 7,
  View: 10,
  Setlist: 2,
  Song: 4,
  'Song Section': 1
}

/** One switch's light: { name, hex }, Default with the colour its kind lights, or a number nobody has a name for. */
function lightOf(ord, kind, model) {
  if (ord === 0) {
    const shade = RING_COLOURS[KIND_DEFAULT[kind]]
    return { name: 'Default', hex: shade?.hex ?? null, shade: shade?.name ?? null }
  }
  const known = RING_COLOURS[ord]
  if (known) return { name: known.name, hex: known.hex }
  /* A number past the editor's twelve: the host's word for it, if it has one. */
  const host = model?.colors?.[ord]
  return host?.name ? { name: host.name, hex: host.hex ?? null } : { name: null, hex: null }
}

/** A label the unit has stored, or null. Padding is not a label. */
const labelOf = (s) => {
  const t = typeof s === 'string' ? s.trim() : ''
  return t || null
}

/*
 * WHAT A SWITCH PICKS, IN WORDS.
 *
 * The computer hands back the codec's own description of the function — its
 * slots, each with a role, a type and the raw number the unit holds — for the
 * three kinds the codec has checked against FM3-Edit: Preset, Scene and
 * Effect. Every other kind (Bank, Layout, Looper, …) is said by its name
 * alone, as it always was. So is a Preset or Scene "Increment / Decrement":
 * which way it steps is a signed number nobody has read off a unit yet.
 *
 * HOW THE NUMBERS COUNT. A preset is the number the unit and this app show
 * (000 to 511). A scene is taken to be stored as the number on the screen,
 * 1 to 8: FM3-Edit's layout files keep every numbered slot that way (Song
 * Section 1 to 6, limits 1 to 32), and the codec gives a scene slot the range
 * 1 to 8. That is an inference, not a reading off a unit — a number outside
 * 1 to 8 is not said as a scene at all — and docs/fc-recording.md asks for
 * the one comparison that settles it. A channel is A to D by its order. An
 * effect is the block the computer named from its id.
 */
const CHANNELS = ['A', 'B', 'C', 'D']
const SCENE_FIRST = 1
const SCENE_LAST = 8

const slotOf = (pick, i) => (Array.isArray(pick?.slots) ? pick.slots.find((s) => s?.i === i) : undefined)
const numberAt = (pick, i) => {
  const v = slotOf(pick, i)?.value
  return Number.isInteger(v) ? v : null
}
const sceneAt = (pick, i) => {
  const v = numberAt(pick, i)
  return v !== null && v >= SCENE_FIRST && v <= SCENE_LAST ? v : null
}
const presetAt = (pick, i) => {
  const v = numberAt(pick, i)
  return v !== null && v >= 0 && v <= 1023 ? String(v).padStart(3, '0') : null
}
const inBankAt = (pick, i) => {
  const v = numberAt(pick, i)
  return v !== null && v >= 0 && v <= 2 ? String(v + 1) : null
}
const channelAt = (pick, i) => CHANNELS[numberAt(pick, i) ?? -1] ?? null
const blockAt = (pick, i) => {
  const b = slotOf(pick, i)?.block
  return b && typeof b.name === 'string' && b.name.trim() ? b.name.trim() : null
}

/** What one side picks, in plain words ("Scene 3", "Preset 125", "Drive 1 on/off"), or null. */
export function pickWords(pick) {
  if (!pick || typeof pick !== 'object' || !Number.isInteger(pick.category) || !Number.isInteger(pick.function)) return null
  const { category, function: fn } = pick
  if (category === 3) {
    if (fn === 0) {
      const n = sceneAt(pick, 0)
      return n === null ? null : `Scene ${n}`
    }
    if (fn === 1) {
      const a = sceneAt(pick, 0)
      const b = sceneAt(pick, 1)
      return a === null || b === null ? null : `Scene ${a} and ${b}, in turn`
    }
    return null
  }
  if (category === 2) {
    if (fn === 0) {
      const n = presetAt(pick, 0)
      return n === null ? null : `Preset ${n}`
    }
    if (fn === 1) {
      const n = inBankAt(pick, 0)
      return n === null ? null : `Preset ${n} in the bank`
    }
    if (fn === 2) {
      const a = presetAt(pick, 0)
      const b = presetAt(pick, 1)
      return a === null || b === null ? null : `Preset ${a} and ${b}, in turn`
    }
    if (fn === 3) {
      const a = inBankAt(pick, 0)
      const b = inBankAt(pick, 1)
      return a === null || b === null ? null : `Preset ${a} and ${b} in the bank, in turn`
    }
    return null
  }
  if (category === 4) {
    const block = blockAt(pick, 0)
    if (!block) return null
    if (fn === 0) return `${block} on/off`
    if (fn === 1) {
      const ch = channelAt(pick, 1)
      return ch ? `${block} to channel ${ch}` : null
    }
    if (fn === 2) {
      const a = channelAt(pick, 1)
      const b = channelAt(pick, 2)
      return a && b ? `${block} channel ${a} and ${b}, in turn` : null
    }
    if (fn === 3) return `${block} through its channels`
    return null
  }
  return null
}

/**
 * One switch, as the panel draws it.
 *
 *   { number, tap: { action, label, pick }, hold: { action, label, pick }, light, unread }
 *
 * `pick` is what that side picks in words when the computer said and the
 * words are sure (pickWords), otherwise null; the panel shows it in place of
 * the action, which says the same thing less exactly.
 *
 * `light` is { name, hex }, or { name: 'Default', hex, shade } for a switch
 * left on its kind's colour, or { name: null, hex: null } when the unit gave a
 * colour this app has no name for, or null when the unit did not say. "Off"
 * is a colour the unit has, not a missing one.
 */
export function describeSwitch(state, model) {
  const f = state?.fields || {}
  const ord = f.color
  /* What the switch does on a tap decides its default colour; a switch that
     only does something on a hold takes that. */
  const kind = model?.categories?.[f.tapCategory || f.holdCategory] ?? null
  /* A number with no name is still an answer, not a failed read. */
  const light = ord == null ? null : lightOf(ord, kind, model)
  return {
    number: Number.isInteger(state?.switch) ? state.switch + 1 : null,
    tap: { action: actionWords(f.tapCategory, f.tapFunction, model), label: labelOf(state?.tapLabel), pick: pickWords(state?.tapPick) },
    hold: { action: actionWords(f.holdCategory, f.holdFunction, model), label: labelOf(state?.holdLabel), pick: pickWords(state?.holdPick) },
    light,
    /* Every field came back empty: the unit did not answer this switch at all. */
    unread: ['tapCategory', 'holdCategory', 'color'].every((k) => f[k] == null)
  }
}

/** What the light line says. */
export const lightWords = (light) =>
  !light
    ? 'Light: couldn’t read'
    : !light.name
      ? 'Light: a color this app can’t name yet'
      : light.name === 'Off'
        ? 'Light off'
        : light.name === 'Default'
          ? light.shade
            ? `${light.shade} light (the default)`
            : 'Default light'
          : `${light.name} light`

const sleep = (ms) => new Promise((go) => setTimeout(go, ms))

/**
 * Read one view's switches, one after another.
 *
 * `get(path)` is the app's own request — so it goes over the relay from a
 * phone and straight to the host at the Mac, with the same timeouts and the
 * same debug log as everything else. `stopped()` is asked before every
 * switch, so closing the panel stops the next question rather than the
 * answer already on its way. `onSwitch(index, state)` hands each one over as
 * it lands, so the first switch is on screen while the third is still being
 * read.
 *
 * The first failure ends the read. The usual reasons — the unit gone, the
 * host saying it cannot — are just as true for the next switch, and asking
 * two more times only keeps the unit busy for nothing.
 *
 * Resolves { states, error, stopped }. Never throws.
 */
export async function readView(get, { layout, view, switches = 3, pause = FC_PAUSE_MS, wait = sleep, stopped = () => false, onSwitch } = {}) {
  const states = []
  for (let sw = 0; sw < switches; sw++) {
    if (stopped()) return { states, error: null, stopped: true }
    if (sw > 0 && pause > 0) {
      await wait(pause)
      if (stopped()) return { states, error: null, stopped: true }
    }
    try {
      const state = await get(fcStatePath(layout, view, sw))
      if (!state || typeof state !== 'object' || state.error) {
        return { states, error: state?.error || 'The unit did not answer.', stopped: false }
      }
      states.push(state)
      onSwitch?.(sw, state)
    } catch (err) {
      return { states, error: err?.message || String(err), stopped: false }
    }
  }
  return { states, error: null, stopped: false }
}

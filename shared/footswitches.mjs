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
 * What it cannot say yet, and says so: WHICH scene, preset or block a switch
 * picks. Those numbers are in the unit, but the pinned server does not read
 * them, and which layout is active is the same story. Both are a server
 * change. And the label-mode number is not trusted either — so a custom label
 * is shown whenever the unit has one stored, rather than only when the mode
 * says "Custom".
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

/** A label the unit has stored, or null. Padding is not a label. */
const labelOf = (s) => {
  const t = typeof s === 'string' ? s.trim() : ''
  return t || null
}

/**
 * One switch, as the panel draws it.
 *
 *   { number, tap: { action, label }, hold: { action, label }, light, unread }
 *
 * `light` is { name, hex }, or { name: null, hex: null } when the unit gave a
 * colour this app has no name for, or null when the unit did not say. "Off"
 * is a colour the unit has, not a missing one.
 */
export function describeSwitch(state, model) {
  const f = state?.fields || {}
  const ord = f.color
  const known = ord == null ? null : model?.colors?.[ord]
  /* A number with no name is still an answer, not a failed read. */
  const light = ord == null ? null : known ? { name: known.name, hex: known.hex } : { name: null, hex: null }
  return {
    number: Number.isInteger(state?.switch) ? state.switch + 1 : null,
    tap: { action: actionWords(f.tapCategory, f.tapFunction, model), label: labelOf(state?.tapLabel) },
    hold: { action: actionWords(f.holdCategory, f.holdFunction, model), label: labelOf(state?.holdLabel) },
    light,
    /* Every field came back empty: the unit did not answer this switch at all. */
    unread: ['tapCategory', 'holdCategory', 'color'].every((k) => f[k] == null)
  }
}

/** What the light line says. */
export const lightWords = (light) =>
  !light ? 'Light: couldn’t read' : !light.name ? 'Light: a colour this app can’t name yet' : light.name === 'Off' ? 'Light off' : `${light.name} light`

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

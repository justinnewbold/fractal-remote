/**
 * Undo after a model change, putting back every setting and not only the model.
 *
 * "Amp model change resets the tone; Undo only restores the model." It did,
 * and it is not the app resetting anything: the FM3 itself loads the new
 * model's own settings the moment the model changes — one write, and every
 * knob on the block moves with it. The Undo the app offered remembered the
 * model's number and name and nothing else, so taking a pick back gave you
 * the old amp with the new amp's settings on it. On the phone the Undo even
 * offered another Undo.
 *
 * So the way back is a snapshot. Just before the model write the block is
 * read fresh — its knobs, its switches (the choices out of a list), its model
 * and which channel it is on — and Undo works from that:
 *
 *   - It refuses if the block is on another channel now. The settings belong
 *     to the channel they were read from, and writing channel A's tone onto
 *     channel B is a second mistake, not an undo. And it keeps asking: every
 *     write goes to whichever channel is live when it lands, so a footswitch,
 *     a channel tap or another preset in the seconds it runs stops it there
 *     rather than sending the rest of A's settings to B.
 *   - It writes the old model back, reads the block, and writes only the
 *     settings that differ from the snapshot.
 *   - It reads again, and anything that still differs gets the checked write,
 *     which tries the unit's other way of taking a value before giving up.
 *   - It reads a last time and says what happened in a guitarist's words:
 *     "Put back all 23 settings the app can see", or "21 of 23 — Bass and
 *     Bright didn't take".
 *
 * "The settings the app can see", because that is all a snapshot can hold.
 * The block has controls the unit never reports, and a sentence that
 * promised "your tone" would be promising those too.
 *
 * A new model deliberately starts from its own settings — no carrying Gain or
 * Bass across. The tester's call, and Justin's: auditioning models is many
 * picks in a row, and each one should sound like the model it is. The hint
 * line under the picker says so instead of a dialog on every pick.
 *
 * Shared, with no imports, because the browser and the phone have to do the
 * same writes in the same order and say the same thing about them. Cab blocks
 * are not handled here: a cab has no model to write — see cab-pick.
 */

/** Under the picker, while it is open. No dialog: auditioning is many picks. */
export const MODEL_HINT = 'A new model starts from its own settings — Undo puts yours back.'

/* Half a percent of a knob's travel is the same setting: the unit rounds a
   value on its way back, and the display value is rounded again after that. */
const TRAVEL_SLACK = 0.005

const finite = (n) => typeof n === 'number' && Number.isFinite(n)

/**
 * What to put back, from a read of the block taken just before the model
 * write. `read` is what the params read answers: `named` (the knobs), `enums`
 * (the switches) and `type` (the model). Null when the read says no model,
 * because there is then nothing an Undo could name.
 */
export function modelSnapshot(read, { channel = null } = {}) {
  const type = read?.type
  if (!type || !finite(type.value)) return null
  const knobs = (Array.isArray(read.named) ? read.named : [])
    .filter((p) => p && finite(p.id) && finite(p.value))
    .map((p) => ({
      id: p.id,
      name: p.name,
      value: p.value,
      norm: finite(p.norm) ? p.norm : null,
      min: p.min,
      max: p.max,
      log: p.log,
      unit: p.unit
    }))
  const enums = (Array.isArray(read.enums) ? read.enums : [])
    .filter((e) => e && finite(e.id) && finite(e.value))
    .map((e) => ({ id: e.id, name: e.name, value: e.value }))
  return {
    type: { value: type.value, name: type.name || '' },
    channel: channel ?? null,
    knobs,
    enums
  }
}

/** How many settings a snapshot holds — the number every sentence counts. */
export const settingsIn = (snap) => (snap ? snap.knobs.length + snap.enums.length : 0)

/**
 * Whether a knob on the unit is where the snapshot had it. By its position
 * along its travel when both ends know it — that is exact, where the display
 * value has been rounded for reading — and by value otherwise.
 */
export function knobAgrees(want, now) {
  if (!now) return false
  if (finite(want.norm) && finite(now.norm)) return Math.abs(want.norm - now.norm) <= TRAVEL_SLACK
  if (!finite(now.value)) return false
  const span = finite(want.min) && finite(want.max) ? Math.abs(want.max - want.min) : 0
  const slack = span ? span * TRAVEL_SLACK : Math.max(0.05, Math.abs(want.value) * 0.02)
  return Math.abs(now.value - want.value) <= slack
}

/**
 * Which of a snapshot's settings a read disagrees with. A setting the read
 * does not carry at all counts: it cannot be put back if it cannot be seen.
 */
export function stillOff(snap, read) {
  const named = new Map((read?.named || []).map((p) => [p.id, p]))
  const enums = new Map((read?.enums || []).map((e) => [e.id, e]))
  const knobs = snap.knobs.filter((k) => !knobAgrees(k, named.get(k.id)))
  const switches = snap.enums.filter((e) => enums.get(e.id)?.value !== e.value)
  return { knobs, enums: switches, named, count: knobs.length + switches.length }
}

/* A read that could not be made is an answer of its own, not a throw — except
   a dropped link, which stops everything. */
async function tryRead(read) {
  try {
    return (await read()) || null
  } catch (err) {
    if (err?.linkDown) throw err
    return null
  }
}

/* A write that threw is not a write that went. Said apart from an answer, so
   "sent your settings" is never said about settings that were never sent. */
const FAILED = Symbol('write failed')

async function tryWrite(fn) {
  try {
    return await fn()
  } catch (err) {
    if (err?.linkDown) throw err
    return FAILED
  }
}

/* A check that could not be read is not an answer: what the writes left is.
   The panel is drawn from this, and a knob drawn at the new model's value
   would be dragged from there — away from the setting the unit now holds. */
function laidOver(read, snap, ids) {
  const knobs = new Map(snap.knobs.filter((k) => ids.has(k.id)).map((k) => [k.id, k]))
  const sw = new Map(snap.enums.filter((e) => ids.has(e.id)).map((e) => [e.id, e]))
  return {
    ...read,
    named: (read.named || []).map((p) =>
      knobs.has(p.id) ? { ...p, value: knobs.get(p.id).value, norm: knobs.get(p.id).norm ?? p.norm } : p
    ),
    enums: (read.enums || []).map((e) => (sw.has(e.id) ? { ...e, value: sw.get(e.id).value } : e))
  }
}

/**
 * Put a block back the way the snapshot has it.
 *
 * `io` is the app's own plumbing, so the rule is the same at both ends:
 *   channel      the channel the block is on NOW
 *   setType(v)   the model write
 *   read()       a fresh params read of the block
 *   write(p, v)  one plain knob write (p is the knob as the unit reports it)
 *   writeEnum(id, v)
 *   writeChecked(p, v)  the checked knob write, for a second try
 *   progress({ step, done, total })  said while it runs: 'model', 'settings', 'checking'
 *   stillHere()  whether the block is still on the channel, scene and preset
 *                it was when Undo was tapped; asked before every write and read
 *
 * Answers `{ refused }` when nothing was written ('channel', or 'model' when
 * the unit would not go back to the old model), `{ stopped }` when stillHere
 * said no partway, or `{ total, missed, unchecked, last }` — `missed` naming
 * the settings that did not go back, `last` the final read for the panel to
 * show (`unsent` too when the check could not be read and no setting went).
 */
export async function restoreModel(snap, io) {
  const say = (p) => {
    try {
      io.progress?.(p)
    } catch {
      /* A progress line is never worth stopping the writes for. */
    }
  }
  if (!snap) return { refused: 'gone' }
  if (snap.channel != null && io.channel != null && snap.channel !== io.channel) return { refused: 'channel' }

  const total = settingsIn(snap)
  /* The channel above is the one Undo was tapped on. This is the one now. */
  const moved = () => {
    try {
      return io.stillHere ? !io.stillHere() : false
    } catch {
      return false
    }
  }
  const stopped = { stopped: true, total, missed: [], unchecked: true, last: null }
  if (moved()) return stopped
  say({ step: 'model', done: 0, total })
  const sent = await tryWrite(() => io.setType(snap.type.value))
  if (moved()) return stopped
  let read = await tryRead(io.read)
  if (!read) return { refused: 'unread', modelSent: sent?.ok !== false }
  if (read.type?.value !== snap.type.value) return { refused: 'model', last: read }

  /* The plain write first, for everything the new model moved. Most settings
     take it; a checked write per knob would be a read per knob down a relay. */
  const first = stillOff(snap, read)
  const sent1 = new Set()
  let done = 0
  say({ step: 'settings', done, total: first.count })
  for (const k of first.knobs) {
    if (moved()) return stopped
    const now = first.named.get(k.id)
    if (now && (await tryWrite(() => io.write({ ...k, ...now }, k.value))) !== FAILED) sent1.add(k.id)
    say({ step: 'settings', done: ++done, total: first.count })
  }
  for (const e of first.enums) {
    if (moved()) return stopped
    if ((await tryWrite(() => io.writeEnum(e.id, e.value))) !== FAILED) sent1.add(e.id)
    say({ step: 'settings', done: ++done, total: first.count })
  }

  if (first.count) {
    say({ step: 'checking', done: 0, total: first.count })
    if (moved()) return stopped
    const again = await tryRead(io.read)
    if (!again)
      return sent1.size
        ? { total, missed: [], unchecked: true, last: laidOver(read, snap, sent1) }
        : { total, missed: [], unchecked: true, unsent: true, last: read }
    read = again
    const second = stillOff(snap, read)
    if (second.count) {
      /* The misses, once more, the careful way. */
      const sent2 = new Set()
      for (const k of second.knobs) {
        if (moved()) return stopped
        const now = second.named.get(k.id)
        if (now && (await tryWrite(() => io.writeChecked({ ...k, ...now }, k.value))) !== FAILED) sent2.add(k.id)
      }
      for (const e of second.enums) {
        if (moved()) return stopped
        if ((await tryWrite(() => io.writeEnum(e.id, e.value))) !== FAILED) sent2.add(e.id)
      }
      if (moved()) return stopped
      const last = await tryRead(io.read)
      if (!last) return { total, missed: [], unchecked: true, last: laidOver(read, snap, sent2) }
      read = last
    }
  }

  const off = stillOff(snap, read)
  const missed = [...off.knobs, ...off.enums].map((s) => s.name || `#${s.id}`)
  return { total, missed, unchecked: false, last: read }
}

/* "Bass", "Bass and Bright", "Bass, Mid and Bright", "Bass, Mid, Treble and 3 more". */
function listed(names) {
  if (names.length <= 1) return names.join('')
  if (names.length <= 3) return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
  return `${names.slice(0, 3).join(', ')} and ${names.length - 3} more`
}

/** The offer, while it stands. Says what Undo can reach and no more. */
export function undoOffer(snap) {
  if (!snap) return ''
  const n = settingsIn(snap)
  const name = snap.type.name || 'the last model'
  if (!n) return `Was ${name}`
  return `Was ${name} — Undo puts back the model and the ${n} setting${n === 1 ? '' : 's'} the app can see.`
}

/** What is said while an Undo runs. It takes seconds over the relay. */
export function undoProgress(p, snap) {
  const name = snap?.type?.name || 'the last model'
  if (!p || p.step === 'model') return `Putting ${name} back…`
  if (p.step === 'checking') return 'Checking they went back…'
  return p.total ? `Putting your settings back… ${p.done} of ${p.total}` : 'Putting your settings back…'
}

/**
 * What is said when it is over, and whether the offer stays up. `keep` is
 * true when nothing useful happened and trying again is the right next step.
 */
export function undoResult(r, snap) {
  const name = snap?.type?.name || 'the last model'
  /* Some of it went, so trying again is right — on the channel it was for. */
  if (r?.stopped)
    return {
      text: snap?.channel
        ? `Stopped partway — the channel or preset changed. Go back to channel ${snap.channel} and tap Undo to finish.`
        : 'Stopped partway — the block changed. Tap Undo to finish.',
      bad: true,
      keep: true
    }
  if (r?.refused === 'channel')
    return {
      text: `Undo is for channel ${snap.channel}. Switch back to ${snap.channel}, then tap Undo.`,
      bad: true,
      keep: true
    }
  if (r?.refused === 'model') return { text: `The unit didn't go back to ${name}. Nothing else was changed.`, bad: true, keep: true }
  if (r?.refused === 'unread')
    return {
      text: `${name} was sent, but the app couldn't read the block to put your settings back. Try Undo again.`,
      bad: true,
      keep: true
    }
  if (r?.refused) return { text: "Couldn't undo that. Pick the model from the list instead.", bad: true, keep: false }
  const total = r?.total ?? 0
  if (r?.unchecked && r.unsent)
    return {
      text: `Put ${name} back, but couldn't reach the unit to put your settings back. Try Undo again.`,
      bad: true,
      keep: true
    }
  if (r?.unchecked)
    return {
      text: `Put ${name} back and sent your settings, but couldn't read them back to check.`,
      bad: true,
      keep: false
    }
  if (!total) return { text: `Put ${name} back.`, bad: false, keep: false }
  const missed = r.missed || []
  if (!missed.length)
    return { text: `Put back all ${total} setting${total === 1 ? '' : 's'} the app can see.`, bad: false, keep: false }
  return {
    text: `Put back ${total - missed.length} of ${total} — ${listed(missed)} didn't take.`,
    bad: true,
    keep: false
  }
}

/* Generated from shared/copy-tools.mjs by scripts/sync-relay-rules.mjs.
 * Do not edit. Change the source and run `npm run sync:rules`; the test suite
 * fails on any difference between the two. */

/**
 * COPY A SCENE, COPY A CHANNEL — the two "start from that one" tools.
 *
 * From the play test's list of easy wins: "Copy a scene to another scene —
 * build scene 2 starting from scene 1, instead of switching every pedal by
 * hand", and "copy one channel to another (A → B), to make B a small
 * variation of A". The device server has no copy of its own for either, so
 * each is made of the reads and writes the app already uses, and both ends
 * run this one copy (npm run sync:rules gives the phone its own).
 *
 * Zero imports. Each end hands in its wire: the functions that talk to its
 * unit, by the same names on both.
 *
 * Neither saves anything. Both change the preset the unit has loaded, and
 * Save keeps it, as with every other change in Edit.
 */

/**
 * What scene `to` needs changed to match scene `from`: for each block the
 * first scene lists, the bypass and channel the second does not already
 * have. A block one scene lists and the other does not is left alone — it is
 * in the preset either way, and a status read that missed it says nothing.
 */
export function sceneCopyPlan(fromStates, toStates) {
  const now = new Map((Array.isArray(toStates) ? toStates : []).filter((s) => Number.isInteger(s?.effectId)).map((s) => [s.effectId, s]))
  const out = []
  for (const s of Array.isArray(fromStates) ? fromStates : []) {
    const there = now.get(s?.effectId)
    if (!there) continue
    const write = { effectId: s.effectId }
    if (typeof s.bypassed === 'boolean' && s.bypassed !== there.bypassed) write.bypassed = s.bypassed
    if (typeof s.channel === 'string' && s.channel && s.channel !== there.channel) write.channel = s.channel
    if ('bypassed' in write || 'channel' in write) out.push(write)
  }
  return out
}

/**
 * Scene `from` (0-based) laid over scene `to`, on the unit.
 *
 * `wire` is { setScene(index), sceneState(), setBypass(eid, bypassed),
 * setChannel(eid, letter) }. Goes to `from` to read it, to `to` to write it,
 * and stays on `to` so what was made is what is heard. The scene's name is
 * not copied: two scenes called CHORUS is not what anybody wanted.
 *
 * { ok, changed } — or { ok: false, error, changed } at the first write the
 * unit or the link throws on, with what had been done by then.
 */
export async function copyScene({ from, to, wire }) {
  if (!Number.isInteger(from) || !Number.isInteger(to) || from === to) return { ok: false, error: 'Pick two different scenes.', changed: 0 }
  let changed = 0
  try {
    await wire.setScene(from)
    const was = await wire.sceneState()
    if (!Array.isArray(was) || !was.length) return { ok: false, error: `Scene ${from + 1} could not be read.`, changed }
    await wire.setScene(to)
    const now = await wire.sceneState()
    if (!Array.isArray(now)) return { ok: false, error: `Scene ${to + 1} could not be read.`, changed }
    for (const w of sceneCopyPlan(was, now)) {
      if ('channel' in w) await wire.setChannel(w.effectId, w.channel)
      if ('bypassed' in w) await wire.setBypass(w.effectId, w.bypassed)
      changed += 1
    }
    return { ok: true, changed }
  } catch (err) {
    return { ok: false, error: err?.message || String(err), changed }
  }
}

/** The channel letters a block can be on. */
export const CHANNELS = ['A', 'B', 'C', 'D']

/**
 * What channel `to` needs written to match channel `from`, from two reads of
 * the block (GET /preset/blocks/{eid}/params, one on each channel): the model
 * when it differs, then every knob and switch whose value differs. Values
 * are in each parameter's own units, as the reads give them.
 */
export function channelCopyPlan(fromRead, toRead) {
  const type = fromRead?.type && toRead?.type && fromRead.type.value !== toRead.type.value ? fromRead.type : null
  const index = (list) => new Map((Array.isArray(list) ? list : []).filter((p) => Number.isInteger(p?.id)).map((p) => [p.id, p]))
  const theirs = index(toRead?.named)
  const knobs = []
  for (const p of Array.isArray(fromRead?.named) ? fromRead.named : []) {
    const there = theirs.get(p?.id)
    if (!there || typeof p.value !== 'number' || p.value === there.value) continue
    knobs.push({ id: p.id, value: p.value, param: there })
  }
  const theirEnums = index(toRead?.enums)
  const switches = []
  for (const e of Array.isArray(fromRead?.enums) ? fromRead.enums : []) {
    const there = theirEnums.get(e?.id)
    if (!there || !Number.isInteger(e.value) || e.value === there.value) continue
    switches.push({ id: e.id, value: e.value })
  }
  return { type, knobs, switches }
}

/**
 * Channel `from` of one block copied onto channel `to`, on the unit.
 *
 * `wire` is { setChannel(eid, letter), readBlock(eid), setType(eid, value),
 * setParam(eid, id, value, param), setEnum(eid, id, ordinal) }. Reads the
 * block on `from`, switches to `to`, puts the model across first (a model
 * change brings that model's defaults, so the knobs are read again after it),
 * then every value that differs. Stays on `to`: this scene now plays the
 * copy, which is the one to listen to.
 *
 * { ok, changed } — or { ok: false, error, changed }.
 */
export async function copyChannel({ eid, from, to, wire }) {
  if (!CHANNELS.includes(from) || !CHANNELS.includes(to) || from === to) return { ok: false, error: 'Pick two different channels.', changed: 0 }
  let changed = 0
  try {
    await wire.setChannel(eid, from)
    const source = await wire.readBlock(eid)
    if (!source?.named?.length) return { ok: false, error: `Channel ${from} could not be read.`, changed }
    await wire.setChannel(eid, to)
    let target = await wire.readBlock(eid)
    const first = channelCopyPlan(source, target)
    if (first.type) {
      await wire.setType(eid, first.type.value)
      changed += 1
      target = await wire.readBlock(eid)
    }
    const plan = channelCopyPlan(source, target)
    for (const k of plan.knobs) {
      await wire.setParam(eid, k.id, k.value, k.param)
      changed += 1
    }
    for (const s of plan.switches) {
      await wire.setEnum(eid, s.id, s.value)
      changed += 1
    }
    return { ok: true, changed }
  } catch (err) {
    return { ok: false, error: err?.message || String(err), changed }
  }
}

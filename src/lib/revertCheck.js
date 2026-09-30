/**
 * What was turned since the last save, and whether a Revert really took it
 * back.
 *
 * On the play test a Gain turned to 25 still read 25 after Revert, with
 * Save and Revert gone as if it had worked. Revert asks the unit to load the saved slot again, and
 * the app then put Save and Revert away on the strength of having asked. It
 * never looked. A select the unit did not take came back as {ok:false} with
 * a 200 and read as a yes; and a unit that treats "load the preset you are
 * already on" as nothing to do answers yes and leaves every change where it
 * was. Either way the only thing on screen saying the changes were gone was
 * the app.
 *
 * So the knobs turned by hand are kept here as a list — which block, which
 * control, what it was before the first turn and what it was turned to —
 * rather than only as a sentence in the log, which is all there used to be
 * and which nothing can compare against. After the reload each block on the
 * list is read once, and every control on it has to be back: at the value it
 * had before it was first turned, or at what the saved slot holds.
 *
 * The slot itself is read only when a control is not back at its old value.
 * That read is a dump of the whole slot, which is a lot to ask of a unit that
 * has just loaded one, and in the usual case — one Revert of a few knobs
 * turned on a clean preset — the old values already are the saved ones. It
 * is for the case where they are not: knobs turned on top of something that
 * was never saved, where only the slot knows what "saved" means.
 *
 * Only the knobs. A block moved, an effect switched or a rename has no value
 * here to read back, and for those the unit's own answer is still the check.
 */

/* One entry per control, per channel: the same knob on channel B is another knob. */
const keyOf = (e) => `${e.eid}:${e.channel ?? ''}:${e.paramId}`

/**
 * One more turn of one knob, onto the list. The first turn keeps its "before";
 * every later one only moves the "after". Returns a new list.
 */
export function noteEdit(list, change) {
  if (!change || !Number.isFinite(change.eid) || !Number.isFinite(change.paramId)) return list
  const key = keyOf(change)
  const at = list.findIndex((e) => keyOf(e) === key)
  if (at < 0) {
    return [
      ...list,
      {
        eid: change.eid,
        paramId: change.paramId,
        channel: change.channel ?? null,
        block: change.block ?? '',
        param: change.param ?? '',
        from: change.from,
        fromNorm: change.fromNorm,
        to: change.to,
        min: change.min,
        max: change.max
      }
    ]
  }
  const next = [...list]
  next[at] = { ...next[at], to: change.to }
  return next
}

/* The saved slot's raw values are u16 over the unit's 0..65534 model, the same
   model a live read's `norm` is taken from — so the two agree whatever the
   display units do in between. */
const VALUE_MODEL_MAX = 65534
const NORM_SLACK = 0.0005

/* Close enough to be the same setting, in the knob's own units. Half a percent
   of its travel covers a value rounded differently on the way back. */
function sameValue(a, b, min, max) {
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false
  const span = Number.isFinite(min) && Number.isFinite(max) ? Math.abs(max - min) : 0
  return Math.abs(a - b) <= Math.max(span * 0.005, 1e-6)
}

/**
 * The saved slot's copy of one control, or null when the slot cannot say
 * for sure.
 *
 * An amp comes back once per channel, each marked with its channel. A block
 * that comes back once, unmarked, is taken as its first channel and nothing
 * else: a value from channel A said to be channel B's would call a Revert
 * that worked a failure.
 */
export function savedParam(blocks, eid, channel, paramId, channels = ['A', 'B', 'C', 'D']) {
  if (!Array.isArray(blocks)) return null
  const same = blocks.filter((b) => b?.effectId === eid)
  if (!same.length) return null
  const index = channel == null ? null : channels.indexOf(channel)
  const marked = same.some((b) => Number.isInteger(b.channel))
  const block = marked ? same.find((b) => b.channel === (index ?? 0)) : index === null || index === 0 ? same[0] : null
  return block?.params?.find((p) => p?.paramId === paramId) ?? null
}

/* Whether the live control reads as the slot's saved one. */
function atSaved(live, saved, edit) {
  if (!saved) return false
  if (Number.isFinite(live.norm) && Number.isFinite(saved.raw))
    return Math.abs(live.norm - saved.raw / VALUE_MODEL_MAX) <= NORM_SLACK
  return sameValue(live.value, saved.value, edit.min ?? live.min, edit.max ?? live.max)
}

/* Whether the live control reads as it did before the first turn. */
function atBefore(live, edit) {
  if (Number.isFinite(live.norm) && Number.isFinite(edit.fromNorm)) return Math.abs(live.norm - edit.fromNorm) <= NORM_SLACK
  return sameValue(live.value, edit.from, edit.min ?? live.min, edit.max ?? live.max)
}

/**
 * Read back what was turned, after the reload.
 *
 *   readBlock(eid)   the block's live values, as GET /preset/blocks/:id/params
 *   readSaved()      the slot, as GET /presets/:n/params — asked at most once
 *   channelOf(eid)      the channel the block is on now
 *   channelBefore(eid)  the channel it was on just before the reload
 *
 * Says `back` when what could be read is all back, `stuck` when any of it is
 * not, `unknown` when none of it could be read, and `nothing` only when no
 * knob was moved at all. A control on a channel the block is not showing now
 * cannot be read without switching channel — which would be an edit — so it
 * is not known rather than guessed at. Gain turned on channel A, channel B
 * tapped, then a Revert the unit ignored: the amp is still on B, and leaving
 * the A knob out called that done. Only a block that changed channel across
 * the reload says the buffer was loaded again.
 */
export async function checkRevert({
  edits = [],
  readBlock,
  readSaved,
  channelOf = () => null,
  channelBefore = () => null,
  channels
} = {}) {
  /* A knob turned and turned back again is no evidence either way. */
  const moved = edits.filter((e) => !sameValue(e.from, e.to, e.min, e.max))
  if (!moved.length) return { state: 'nothing', checked: 0, missed: [] }

  let saved
  const slot = async () => {
    if (saved !== undefined) return saved
    try {
      const res = await readSaved?.()
      saved = Array.isArray(res?.blocks) && res.blocks.length ? res.blocks : null
    } catch {
      saved = null
    }
    return saved
  }

  const byBlock = new Map()
  for (const e of moved) byBlock.set(e.eid, [...(byBlock.get(e.eid) || []), e])

  let checked = 0
  let unread = 0
  let unsure = 0
  let switched = false
  const missed = []
  for (const [eid, list] of byBlock) {
    let live
    try {
      live = await readBlock(eid)
    } catch {
      unread += 1
      continue
    }
    const named = Array.isArray(live?.named) ? live.named : []
    /* A bulk read the unit never answered still comes back as a read: every
       knob at 0, no type, no selectors (the server's blockParams catch). That
       is nothing read, not a block of knobs all at their minimum — taken as a
       read, a knob that started at 0 looked "back" and a Revert the unit
       ignored was called done. */
    const zeroed = live?.type == null && !live?.enums?.length && named.every((x) => x?.norm === 0 && x?.value === 0)
    if (!named.length || zeroed) {
      unread += 1
      continue
    }
    const now = channelOf(eid) ?? null
    const was = channelBefore(eid) ?? null
    if (was != null && now != null && was !== now) switched = true
    for (const e of list) {
      if ((e.channel ?? null) !== now) {
        unsure += 1
        continue
      }
      const p = named.find((x) => x.id === e.paramId)
      if (!p) {
        unsure += 1
        continue
      }
      if (atBefore(p, e)) {
        checked += 1
        continue
      }
      const kept = savedParam(await slot(), eid, e.channel, e.paramId, channels)
      if (kept && atSaved(p, kept, e)) {
        checked += 1
        continue
      }
      /* Not where it was, and not what the slot holds. Still at the value
         it was turned to is the change still on the unit — but only with the
         slot read to say so: without it, a knob that something else moved
         first and the player turned back sits at `to` because `to` is the
         saved value. Anywhere else is not known either. */
      if (kept && sameValue(p.value, e.to, e.min ?? p.min, e.max ?? p.max))
        missed.push({ block: e.block, param: e.param, now: p.value, to: e.to })
      else unsure += 1
    }
  }

  if (missed.length) return { state: 'stuck', checked, missed }
  /* One control back where it was is the whole buffer reloaded: a reload
     that did not happen leaves every turned knob where it was turned. */
  if (checked) return { state: 'back', checked, missed }
  /* A block on another channel after the reload than before it: the buffer
     was loaded again, even with every knob turned on a channel not showing. */
  if (switched) return { state: 'back', checked, missed }
  return { state: 'unknown', checked, missed }
}

/** Whether Save and Revert can go: only once what was turned is shown back. */
export const revertTook = (check) => check?.state === 'back' || check?.state === 'nothing'

/**
 * What to say when a Revert did not take, or could not be checked. The unit's
 * short name when there is one: this is Justin's FM3, and a sentence about
 * "the unit" reads as being about something else.
 */
export function revertSaid(state, unit) {
  const who = unit ? `The ${unit}` : 'The unit'
  if (state === 'unknown')
    return `Revert was sent, but the app couldn't read the ${unit || 'unit'} back to check it worked. Save and Revert are still here.`
  return `${who} didn't go back to the saved preset — your changes are still on it.`
}

/** The log's lines for a Revert that did not take: which knobs are still where they were turned. */
export const stuckLines = (check) =>
  (check?.missed || []).map((m) => `${m.block ? `${m.block} · ` : ''}${m.param} is still ${m.now}`)

/*
 * QUICK EDIT ON THE APPLE WATCH: THE RULES, AND WHAT THE PHONE KEEPS WHILE A
 * HELD PEDAL'S SHEET IS OPEN ON THE WRIST.
 *
 * "On the watch, we have pushed to hold on the channels to switch amps. Can
 * we set up quick edits on that as well? And change the name to hold to
 * quick edit?" Then, of three pictures: "For the watch, mock up B." (Justin,
 * 12 November 2026.) Mockup B: holding a pedal opens its channels in one
 * row and, under them, a list of the block's knobs, a name and a value to a
 * row; a tap picks one and the Digital Crown turns it.
 *
 * IT IS THE PHONE'S OWN QUICK EDIT, FROM THE WRIST. On Play a hold opens a
 * pop-up with the block's knobs over its channels (lib/holdPop), and those
 * knobs are Edit's own, read and written by Edit's own senders. So are
 * these: the knobs listed are the first ones Edit's panel would draw for
 * the block (`quickParams`, by Edit's own pages and Edit's own rule for
 * what is never a knob, a block's Level among them), a turn is written by
 * Edit's checked write and read back by Edit's read, and nothing here has a
 * way to the unit of its own. What they are is handed in (lib/
 * watchQuickEdit does the handing), which is also what lets the tests run
 * this file as it is.
 *
 * WHERE (`watchQuickOn`). Where the phone's own pop-up carries knobs
 * (lib/holdPop popKnobsOn: Edit's door open for this account, unit and
 * connection, never a VP4), for an account the watch's is open to: his,
 * until features WATCH_QUICK_EDIT_FOR_EVERYONE. And only for a watch that
 * has said it knows `quick` in its hello (lib/watchPages), which no watch
 * does before the build that carries the sheet. Everywhere else the
 * picture says nothing of it and the watch's hold is its channels, with
 * the words it always had.
 *
 * NO SAVING, as in the pop-up: a change plays, and is the preset's unsaved
 * change like any knob turned in Edit.
 *
 * Pure: no imports. test/watch-quick.mjs runs it as it is.
 */

/**
 * Whether a pedal held on the watch offers quick edit: `popKnobs`, the
 * phone's own answer for its hold pop-up (lib/holdPop popKnobsOn), and
 * `allowed` for this account. Each has to be exactly right: an answer not
 * yet in is a no, and the sheet is the channels alone.
 */
export function watchQuickOn({ allowed = false, popKnobs = false } = {}) {
  return allowed === true && popKnobs === true
}

/** How long the phone keeps an open sheet's knobs with nothing heard from the watch: its check-in comes every twenty seconds while it is on screen, so a minute of silence is a wrist that went down, or an app that was closed, with the sheet still open. */
export const WATCH_QUICK_IDLE_MS = 60000

const finite = (n) => typeof n === 'number' && Number.isFinite(n)

/** A knob the watch can place and turn: a number, in a range with room in it. */
const placed = (p) => Boolean(p) && finite(p.value) && finite(p.min) && finite(p.max) && p.max > p.min

/**
 * The knobs a held pedal lists on the watch, out of one read of the block
 * (lib/device blockParams): the first `max` that Edit's panel would draw,
 * in Edit's order. `silencing` is Edit's rule for what is never a knob
 * (lib/guardrails isSilencingParam: a level, a routing control) and `pages`
 * Edit's own pages (lib/editPages editPages), which also leave out the
 * meters and give each knob the name the unit's editor gives it. Not the
 * last page of things Fractal's own editor does not show, and not a knob
 * with no range to place it in.
 */
export function quickParams(read, { pages, silencing, max = 8 } = {}) {
  const named = Array.isArray(read?.named) ? read.named : []
  const editable = named.filter((p) => p && !silencing(p.name))
  const out = []
  for (const page of pages(editable, read?.layout || null)) {
    if (page.key === 'hidden') continue
    for (const p of page.params) {
      if (out.length >= max) return out
      if (!placed(p) || out.some((q) => q.id === p.id)) continue
      out.push(p)
    }
  }
  return out
}

/** Whether a knob runs on a logarithmic scale, by Edit's own test (lib/scale): said so, with both ends over nought. */
const logScale = (p) => p.log === true && p.min > 0 && p.max > 0

/**
 * One knob as the picture carries it (shared/watch-link.mjs, QUICK EDIT ON
 * THE WRIST): its key, the name Edit draws it under, its value as Edit
 * writes it (`text`, handed the value and the unit), where it sits in its
 * range (`toNormalized`, Edit's own scale), and the range itself so the
 * watch can write the number as the Crown turns. `value` is the one to
 * show: the unit's, or one the wrist has just asked for.
 */
export function quickKnob(p, value, { toNormalized, text }) {
  return {
    key: String(p.id),
    name: p.label || p.name || '',
    text: text(value, p.unit),
    at: toNormalized(value, p) ?? 0,
    min: p.min,
    max: p.max,
    log: logScale(p),
    unit: typeof p.unit === 'string' ? p.unit : ''
  }
}

/**
 * WHAT THE PHONE KEEPS WHILE A SHEET IS OPEN ON THE WRIST, and nothing
 * between sheets.
 *
 *   open(id)           the sheet opened on that pedal: its knobs are read.
 *   close()            it closed: the knobs are let go. A turn already on
 *                      its way to the unit still lands.
 *   turn(id, key, at)  the Crown put that knob there, 0 to 1.
 *   follow(alive)      asked every time Play draws: `alive` is whether
 *                      quick edit is still offered and the pedal still on
 *                      Play. Not alive, or nothing heard from the watch
 *                      for WATCH_QUICK_IDLE_MS, and the knobs are let go.
 *                      Alive and the block is not what was read (another
 *                      scene, another channel, the preset loaded again):
 *                      read again, with nothing shown in between.
 *   heard()            the watch said something, anything: it is there.
 *   now()              what goes in the picture: { id, knobs }, or null
 *                      while nothing is open or the read is still out.
 *
 * WHAT IT IS HANDED:
 *
 *   read(id)           Edit's read of a block's knobs.
 *   write(id, p, v)    Edit's checked write of one knob; answers { ok }.
 *   edited()           Edit's mark that the preset has an unsaved change.
 *   sig(id)            what the block is now, as one string that moves
 *                      with the preset, the scene, the channel and a
 *                      reload; null when the block is not there.
 *   readable(id)       whether the block has knobs to read at all.
 *   params(read)       the knobs to list (quickParams, with Edit's rules).
 *   valueAt(p, at)     a place in a knob's range as the value Edit's own
 *                      knob would send for it.
 *   knob(p, value)     one knob for the picture (quickKnob).
 *   oneAtATime         shared/knob-keys oneWriteAtATime: one write out per
 *                      knob, and only the newest waiting value next, as
 *                      Edit sends a knob under a thumb.
 *   changed()          the picture moved: send it.
 *   log(...), clock()  the debug log, and the time in milliseconds.
 *
 * A TURN NEVER LANDS ON ANOTHER BLOCK'S SETTINGS. Every write lands on
 * whichever channel is live, so each turn carries what the block was when
 * the phone heard it (`sig`), and is dropped, not sent, if the block is
 * something else by the time its write would go: a footswitch, a channel
 * picked, another preset.
 */
export function createWatchQuick({ read, write, edited, sig, readable, params, valueAt, knob, oneAtATime, changed, log = () => {}, clock = () => Date.now() }) {
  /* The open sheet: { id, sig, list, byKey, asked }; `list` null while its read is out. `asked` is what the wrist has put a knob to that the unit has not confirmed yet, by key. */
  let sheet = null
  /* Which read is the newest: an older one that answers late is not shown. */
  let reads = 0
  let heardAt = clock()

  const take = (fresh) => {
    const list = params(fresh)
    sheet.list = list
    sheet.byKey = new Map(list.map((p) => [String(p.id), p]))
  }

  const fetch = async () => {
    const mine = ++reads
    const { id } = sheet
    const at = sig(id)
    sheet.sig = at
    sheet.list = null
    sheet.byKey = new Map()
    sheet.asked = new Map()
    let fresh = null
    if (at !== null && readable(id)) {
      try {
        fresh = await read(id)
      } catch (err) {
        log('watch', 'quick edit: could not read the knobs', err?.message || String(err))
      }
    }
    /* Closed, opened on another pedal or read again since: this answer is nobody's. */
    if (mine !== reads || !sheet || sheet.id !== id) return
    take(fresh)
    changed()
  }

  const writes = oneAtATime(
    async ({ id, key, p, value, at }) => {
      /* Not the block the Crown was turned on any more: dropped, never sent to whatever is there now. */
      if (sig(id) !== at) {
        log('watch', 'quick edit: a turn was not sent', 'the block changed first')
        return
      }
      const mine = () => sheet && sheet.id === id && sheet.sig === at && sig(id) === at
      try {
        const res = await write(id, p, value)
        /* Before the read-back, as in Edit: the write is out, and the unit holds a value the slot does not. */
        edited()
        if (res?.ok === false) log('watch', 'quick edit: the unit did not take a turn', `${p.name || key} asked ${value}`)
        const fresh = await read(id)
        if (!mine()) return
        take(fresh)
      } catch (err) {
        log('watch', 'quick edit: a turn failed', err?.message || String(err))
        if (!mine()) return
      }
      /* The unit's word from here, unless the wrist has moved the knob on since. */
      if (sheet.asked.get(key) === value) sheet.asked.delete(key)
      changed()
    },
    { same: (a, b) => a.value === b.value }
  )

  const drop = () => {
    if (!sheet) return
    sheet = null
    reads++
    changed()
  }

  return {
    heard() {
      heardAt = clock()
    },
    open(id) {
      heardAt = clock()
      sheet = { id, sig: null, list: null, byKey: new Map(), asked: new Map() }
      changed()
      return fetch()
    },
    close() {
      heardAt = clock()
      drop()
    },
    turn(id, key, at) {
      heardAt = clock()
      const p = sheet && sheet.id === id && sheet.list ? sheet.byKey.get(key) : null
      if (!p) return undefined
      const value = valueAt(p, at)
      if (!finite(value)) return undefined
      const lane = `${id}:${key}`
      /* Where it already is, with nothing on its way: nothing to send. */
      if (value === p.value && !writes.busy(lane)) return undefined
      sheet.asked.set(key, value)
      changed()
      return writes.send(lane, { id, key, p, value, at: sheet.sig })
    },
    follow(alive) {
      if (!sheet) return undefined
      if (alive !== true || clock() - heardAt > WATCH_QUICK_IDLE_MS) {
        drop()
        return undefined
      }
      const at = sig(sheet.id)
      if (at === null) {
        drop()
        return undefined
      }
      if (at === sheet.sig) return undefined
      /* Another scene, another channel, the preset loaded again: read again, and nothing of the old one is shown meanwhile. */
      const going = fetch()
      changed()
      return going
    },
    now() {
      if (!sheet || !sheet.list) return null
      return { id: sheet.id, knobs: sheet.list.map((p) => knob(p, sheet.asked.has(String(p.id)) ? sheet.asked.get(String(p.id)) : p.value)) }
    },
    /** Which pedal's sheet is open, or null: for the bridge's own questions. */
    openOn: () => (sheet ? sheet.id : null)
  }
}

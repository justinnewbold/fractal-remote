/**
 * EDIT'S KNOBS FOLLOW THE UNIT: THE RULES (his account only, until
 * lib/features LIVE_KNOBS_FOR_EVERYONE).
 *
 * "Changing a parameter on the unit itself doesn't reflect on the Amp." (A
 * customer's FM9 over Bluetooth through a WIDI Master, 16 November 2026.)
 * Edit read a block's knobs once, as its panel opened, and again only after
 * its own changes, a scene, a channel or a preset. A knob turned on the unit
 * never showed while the panel stayed open.
 *
 * Four ways the panel hears of it now, on an FM3, an FM9 or an Axe-Fx III
 * (never an AM4, whose block reads every few seconds were heard as glitches
 * when the computer app did them, and never a VP4, which is read nothing):
 *
 *   A. THE UNIT'S OWN BLOCK REPORT. An FM9 and an Axe-Fx III send a block's
 *      settings unasked when a knob is turned on the unit (the 0x74, 0x75,
 *      0x76 burst; forgefx-midi setParam.ts, seen with an editor on USB).
 *      Over Bluetooth or the cable the wire now listens for it (bleWire
 *      heardReport), writes it in the log, keeps it as the block's read and
 *      says so ('blockReport'); the panel then reads the block from that
 *      copy, which sends nothing but the small list of what is on.
 *   B. A READ ON A TIMER, over Bluetooth or the cable: the open block read
 *      afresh, never from the five-second copy, and only when nothing else
 *      is waiting for the line or on it (the wire's `ifIdle`). The gap after
 *      a read ends is the larger of four seconds and five times what that
 *      read took; twelve seconds after two minutes with no touch on the
 *      panel; fifteen once this connection has heard a report (A), which
 *      then does the work. Paused while a finger is on a knob, a value is
 *      waiting to go, a write is out, for 2.5 s after a write's check, for
 *      3 s after a Play tap, a scene or a preset, while the tuner is open or
 *      a capture is going, and while the app is away.
 *   C. A READ WHEN THE APP COMES BACK TO THE FRONT, and as the panel opens
 *      (that one in Edit's own read, made fresh: lib/liveKnobsHere).
 *   D. THE COMPUTER APP'S NEWS. Through a computer, the computer app sends a
 *      'param' for every knob it sees move on the unit, which the phone threw
 *      away; one for the open block now reads it again, 0.4 s after the last
 *      of a run, and never while the panel's own write is out or for 2 s
 *      after it (the computer sends one for every write it makes, this
 *      device's included).
 *
 * WHAT A READ CHANGES ON SCREEN: a knob only where its value differs, never
 * one whose new value is still waiting to go, and nothing at all from a read
 * sent before a write began (the write's own check reads it after).
 *
 * Imports nothing, so a test runs every path of it with a clock it turns by
 * hand (test/live-knobs.mjs).
 */

/* B's numbers (the investigation of 16 November 2026, which has the sums). */
export const LIVE_GAP_MS = 4000
export const LIVE_GAP_TIMES = 5
export const LIVE_IDLE_AFTER_MS = 2 * 60 * 1000
export const LIVE_IDLE_GAP_MS = 12000
export const LIVE_HEARD_GAP_MS = 15000
export const LIVE_AFTER_WRITE_MS = 2500
export const LIVE_AFTER_MOVE_MS = 3000
/* A turn that was paused, or found the line busy, looks again this soon: a look sends nothing. */
export const LIVE_LOOK_AGAIN_MS = 500
/* D: the read waits this long after the last piece of news in a run. */
export const NEWS_SETTLE_MS = 400
/* D: news this soon after the panel's own write is that write coming back. */
export const NEWS_OWN_MS = 2000

/* The units it is for, as the rig names them (lib/device-slug) and as the wire does (bleWire). */
export const LIVE_SLUGS = Object.freeze(['fm3', 'fm9', 'axefxiii'])
export const LIVE_WIRE_UNITS = Object.freeze(['fm3', 'fm9', 'axefx3'])
export const liveUnit = (slug) => LIVE_SLUGS.includes(slug)

/**
 * How long after a read ends the next timer read goes (B).
 *
 * `lastReadMs` is what the last read took, `idleMs` how long since the
 * panel was last touched, `heard` whether this connection has heard the
 * unit's own report (A). Never sooner than five times the last read, so a
 * slow line is never kept busier than a fifth of the time by this.
 */
export function liveGap({ lastReadMs = 0, idleMs = 0, heard = false } = {}) {
  let gap = Math.max(LIVE_GAP_MS, LIVE_GAP_TIMES * (Number.isFinite(lastReadMs) && lastReadMs > 0 ? lastReadMs : 0))
  if (idleMs >= LIVE_IDLE_AFTER_MS) gap = Math.max(gap, LIVE_IDLE_GAP_MS)
  if (heard) gap = Math.max(gap, LIVE_HEARD_GAP_MS)
  return gap
}

const same = (a, b) => a === b || (typeof a === 'number' && typeof b === 'number' && Number.isNaN(a) && Number.isNaN(b))

/**
 * A read laid over what the panel shows, setting by setting (knobs or list
 * settings, each {id, value}).
 *
 * `pending` is what is still waiting to go, by id: those stay as they are.
 * Answers {list, changed}: `list` is `shown` itself where nothing changed,
 * so the screen is not drawn again for nothing, and `changed` says what
 * moved, {id, name, from, to}. Where the read has other settings than the
 * panel (the model was changed on the unit) it is taken whole, `whole`,
 * unless something is waiting to go, `held`, when it is left for the next.
 */
export function mergeKnobs(shown, fresh, pending = {}) {
  const now = Array.isArray(shown) ? shown : []
  if (!Array.isArray(fresh)) return { list: now, changed: [] }
  const waiting = (id) => pending && pending[id] !== undefined
  const ids = (list) => list.map((p) => p?.id).join(',')
  if (ids(now) !== ids(fresh)) {
    if (now.some((p) => waiting(p?.id))) return { list: now, changed: [], held: true }
    const before = new Map(now.map((p) => [p.id, p]))
    const changed = fresh.filter((p) => !before.has(p.id) || !same(before.get(p.id).value, p.value)).map((p) => ({ id: p.id, name: p.label || p.name, from: before.get(p.id)?.value, to: p.value }))
    return { list: fresh, changed, whole: true }
  }
  const changed = []
  const list = now.map((p, i) => {
    const f = fresh[i]
    if (waiting(p.id) || same(p.value, f.value)) return p
    changed.push({ id: p.id, name: p.label || p.name, from: p.value, to: f.value })
    return f
  })
  return { list: changed.length ? list : now, changed }
}

/** A value as the log says it: a whole number as it is, anything else to two places. */
export const said = (v) => (typeof v === 'number' && Number.isFinite(v) ? (Number.isInteger(v) ? String(v) : String(Math.round(v * 100) / 100)) : String(v))

/** The log line for what a read moved: "Gain 5 → 6.2, Bass 3 → 4, changed on the unit". */
export const changedWords = (changed) => `${changed.map((c) => `${c.name} ${said(c.from)} → ${said(c.to)}`).join(', ')}, changed on the unit`

const realClock = { now: () => Date.now(), setTimeout: (fn, ms) => setTimeout(fn, ms), clearTimeout: (id) => clearTimeout(id) }

/**
 * The open panel's reads (B, C, D), one panel, one of these.
 *
 * `ends()` answers, asked at every turn (never kept from when this was made):
 *   on()              the panel follows the unit at all (the switch, the unit)
 *   timer()           B may run: over Bluetooth or the unit's own cable
 *   eid()             the open block
 *   held()            why the panel is busy now, in words, or null: a finger
 *                     on a knob, a value waiting to go, a read of its own,
 *                     the tuner, a capture
 *   tapAt()           when Play was last tapped, on this clock
 *   heard()           this connection has heard the unit's own report (A)
 *   read({fresh, ifIdle})   the block's read; a throw with `skipped` is the
 *                     line busy, nothing sent
 *   apply(read, why)  lay it over the panel (mergeKnobs)
 *   log(line)
 */
export function createLiveKnobs(ends, clock = realClock) {
  const t0 = clock.now()
  const s = {
    stopped: false,
    timer: null,
    wakeAt: null,
    reading: false,
    /* When the last read ended, and what it took. */
    lastEnd: t0,
    lastMs: 0,
    touchAt: t0,
    finger: false,
    away: false,
    /* Writes begun, writes out, and when the last one's check ended. */
    begun: 0,
    out: 0,
    wroteAt: -Infinity,
    movedAt: -Infinity,
    /* A read owed (C or D): 'fresh' from the unit, 'copy' where the wire already holds the unit's report (A); and when it may go. */
    owed: null,
    owedAt: 0,
    reads: 0
  }
  const e = () => ends()
  const on = () => !s.stopped && e().on() === true
  const timerOn = () => on() && e().timer() === true

  /* Why no read may go now, and until when where that is a matter of time ({why, until}), or null. */
  function pausedNow(now) {
    if (s.away) return { why: 'the app is away', until: null }
    if (s.finger) return { why: 'a finger is on a knob', until: now + LIVE_LOOK_AGAIN_MS }
    if (s.out > 0) return { why: 'a write is out', until: now + LIVE_LOOK_AGAIN_MS }
    const held = e().held()
    if (held) return { why: held, until: now + LIVE_LOOK_AGAIN_MS }
    if (now < s.wroteAt + LIVE_AFTER_WRITE_MS) return { why: 'a write was just checked', until: s.wroteAt + LIVE_AFTER_WRITE_MS }
    const tap = e().tapAt?.()
    const moved = Math.max(s.movedAt, Number.isFinite(tap) ? tap : -Infinity)
    if (now < moved + LIVE_AFTER_MOVE_MS) return { why: 'Play was just tapped, or the scene or preset changed', until: moved + LIVE_AFTER_MOVE_MS }
    return null
  }

  const gapNow = (now) => liveGap({ lastReadMs: s.lastMs, idleMs: now - s.touchAt, heard: e().heard?.() === true })
  const dueNow = (now) => s.lastEnd + gapNow(now)

  function wake(at) {
    if (s.timer !== null) clock.clearTimeout(s.timer)
    s.timer = null
    s.wakeAt = null
    if (at === null || s.stopped) return
    const now = clock.now()
    s.wakeAt = Math.max(now, at)
    s.timer = clock.setTimeout(tick, s.wakeAt - now)
  }

  /* When to look next: an owed read when it may go, else the timer's next read. */
  function plan() {
    if (s.stopped || s.reading || !on()) return wake(null)
    if (s.owed) return wake(s.owedAt)
    if (s.away || !timerOn()) return wake(null)
    return wake(dueNow(clock.now()))
  }

  function tick() {
    s.timer = null
    s.wakeAt = null
    if (s.stopped || s.reading || !on()) return
    const now = clock.now()
    const owed = s.owed
    if (!owed && (!timerOn() || now < dueNow(now))) return plan()
    if (owed && now < s.owedAt) return plan()
    const p = pausedNow(now)
    if (p) return p.until === null ? wake(null) : wake(p.until)
    if (owed) {
      s.owed = null
      return readNow(owed === 'copy' ? 'report' : owed === 'front' ? 'front' : 'news', owed !== 'copy')
    }
    return readNow('timer', true, true)
  }

  async function readNow(why, fresh, ifIdle = false) {
    s.reading = true
    const began = clock.now()
    const writes = s.begun
    let got = null
    let skipped = false
    let failed = false
    try {
      got = await e().read({ fresh, ifIdle })
    } catch (err) {
      if (err?.skipped === true) skipped = true
      else failed = true
    }
    s.reading = false
    if (s.stopped) return
    if (skipped) {
      /* The line was busy and nothing went: not a read, and looked at again in a moment. */
      return wake(clock.now() + LIVE_LOOK_AGAIN_MS)
    }
    s.lastEnd = clock.now()
    s.lastMs = s.lastEnd - began
    s.reads++
    if (!failed && got) {
      if (s.begun !== writes) e().log(`a read of the block was not used: a change was sent while it was out`)
      else if (s.finger) {
        /*
         * A finger came down while the read was out: laid over the knob under
         * it, the value jumped under the thumb and back (an independent read,
         * 16 November 2026). Not used; a read owed for news or the front is
         * owed again, since through the computer no timer would catch it up.
         */
        e().log(`a read of the block was not used: a finger was on a knob`)
        if (why !== 'timer' && s.owed === null) {
          s.owed = why === 'report' ? 'copy' : why === 'front' ? 'front' : 'fresh'
          s.owedAt = clock.now()
        }
      } else e().apply(got, why)
    }
    plan()
  }

  function wrote() {
    s.begun++
    s.out++
    s.touchAt = clock.now()
    plan()
  }
  function checked() {
    s.out = Math.max(0, s.out - 1)
    s.wroteAt = clock.now()
    plan()
  }

  return {
    /** Start following (as the panel opens): its own first read counts as the read before. */
    start() {
      s.lastEnd = clock.now()
      s.touchAt = clock.now()
      plan()
    },
    stop() {
      s.stopped = true
      wake(null)
    },
    /** The panel was touched: the gap is the short one again. */
    touched() {
      s.touchAt = clock.now()
      plan()
    },
    /** A finger down on a knob, or let go. */
    lock(down) {
      s.finger = down === true
      if (s.finger) s.touchAt = clock.now()
      plan()
    },
    /** A write of the panel's own begins: a read already out is not used. */
    wrote,
    /** That write and its check are over. */
    checked,
    /** A write and its check, from start to end. */
    async during(run) {
      wrote()
      try {
        return await run()
      } finally {
        checked()
      }
    },
    /** The panel's own read ended, after `ms`: the gap starts again from it. */
    loaded(ms) {
      s.lastEnd = clock.now()
      if (Number.isFinite(ms) && ms >= 0) s.lastMs = ms
      plan()
    },
    /** The scene or the preset changed. */
    moved() {
      s.movedAt = clock.now()
      s.touchAt = clock.now()
      plan()
    },
    /** The app came back to the front (C): one read now, from the unit. */
    front() {
      s.away = false
      s.touchAt = clock.now()
      if (on()) {
        s.owed = 'front'
        s.owedAt = clock.now()
      }
      plan()
    },
    /** The app went away: nothing is read until it is back. */
    back() {
      s.away = true
      plan()
    },
    /**
     * News of a knob on the unit (D, A): the computer's {type: 'param',
     * effectId} or the wire's {type: 'blockReport', eid}. For the open block
     * only, and never the panel's own write coming back.
     */
    news(event) {
      if (!on() || !event) return false
      const eid = event.type === 'param' ? event.effectId : event.type === 'blockReport' ? event.eid : undefined
      if (eid === undefined || eid !== e().eid()) return false
      const now = clock.now()
      if (s.out > 0 || now - s.wroteAt < NEWS_OWN_MS) return false
      /* The unit's report is the wire's copy already; anything else is read from the unit. A read owed afresh stays afresh. */
      s.owed = event.type === 'blockReport' && (s.owed === null || s.owed === 'copy') ? 'copy' : s.owed === 'front' ? 'front' : 'fresh'
      s.owedAt = now + NEWS_SETTLE_MS
      plan()
      return true
    },
    /** Something the pause depends on changed: look again now. */
    kick() {
      plan()
    },
    /** For the tests and the log. */
    state: () => ({ ...s, due: dueNow(clock.now()), gap: gapNow(clock.now()) })
  }
}

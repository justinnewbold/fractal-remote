/*
 * THE CAPTURES ON THE UNIT, FOR THE PICKER IN EDIT.
 *
 * An Axe-Fx III's NAM block plays one of the captures the unit holds, and
 * which ones those are is the unit's own business: 257 slots, named by
 * whatever was loaded into them. Edit said "The capture is chosen on the unit
 * itself." The picker (components/CapturePicker, his account's until
 * lib/features NAM_PICKER_FOR_EVERYONE) shows which capture a NAM block is on
 * and lets another be chosen, and this is the list it chooses from.
 *
 * HOW THE LIST IS READ. There is no "send me the list": Axe-Edit asks each
 * slot what is in it, one question a slot (lib/nam-install namSlotQuery), and
 * so does this. Through a computer that is a few seconds. Over a Bluetooth
 * adapter on the unit's MIDI jacks each answer is a ninth of a second, so the
 * whole list is about half a minute. So:
 *
 *   - IT IS READ IN PIECES, a few slots a request, and shown as it comes.
 *     Between two pieces a pick, a tap on Play and the footswitch watch each
 *     get their turn; a piece is short enough that none waits long.
 *   - IT IS READ ONCE AND KEPT, for the session and on the device, so the
 *     second time the list is opened it is simply there. "Read the list
 *     again" reads it again, and it is read again by itself when there is
 *     reason to think it has changed: a capture was sent from the app
 *     (`stale`), or the slot a block is on reads as something other than the
 *     list has for it (`ensure`).
 *   - THE SLOT A BLOCK IS ON IS ASKED BY ITSELF, FRESH, when the block is
 *     opened (`ensure`): one question, so the button can say the capture's
 *     name at once and never says a name the unit no longer has there.
 *
 * A SLOT THAT SAYS NOTHING. A slot's answer does not say which slot it is.
 * So the sender ends a piece at the first slot that did not answer in time
 * (`stopped`), and NO SLOT IS ASKED, by the list or for a block's button,
 * until an answer that came late is gone (`again`, longer than the senders'
 * own idea of how late one can come); then the list asks from that slot
 * again. A slot that says nothing twice is left out of the list. A unit that
 * has never answered a slot (a firmware older than the NAM block) is said so
 * after two questions, not 257. One that has answered and then stops (its
 * MIDI cable pulled, or switched off, with the adapter still there) is said
 * so when two slots running have each said nothing twice: four questions,
 * not two for every slot left and then called read. One slot of its own
 * that will not say, with a lost answer from the one after it, is not that.
 *
 * A READ THAT FAILS LEAVES THE LIST AS IT WAS: what it heard is taken (it is
 * what the unit said), nothing is taken out, nothing is written down, and
 * the next open reads again.
 *
 * SLOT 257 IS NOT LISTED. In the recording of Axe-Edit the last slot listed
 * the same capture as the one just loaded, so it may be no slot of its own:
 * it is not offered as a pick until it is understood (docs/nam-install.md).
 * A block that is on it still says so.
 *
 * ONE THING AT A TIME (`turn`): the pieces, the one-slot question and a pick
 * go one after another through here, so the capture tools, which take one
 * job at a time, are never asked for two.
 *
 * PURE: the asker, the pause and the keeping are handed in
 * (lib/captureListHere gives it the device's), so a test runs it whole.
 */

/** How many slots are listed and offered: 001 to 256. */
export const CAPTURES_LISTED = 256
/** How many rows the list draws at once; more, and it says to type to narrow it down (as the model list and the cab list do). */
export const CAPTURES_SHOWN = 40
/** What is said where a unit answers none of the slots' questions. */
export const NO_CAPTURE_LIST = 'The unit didn’t say what its capture slots hold. Its firmware may be older than the NAM block.'
/** And where it answered some of them and then stopped. */
export const CAPTURES_STOPPED = 'The unit stopped answering part-way through its captures. Check its connection and try again.'
/** A slot as the unit and Axe-Edit count it: from 001. */
export const captureNumber = (slot) => String(slot + 1).padStart(3, '0')

/** A capture picked from a row whose name is not what the unit then said the slot holds: the list was out of date. */
export const captureNotAsListed = (slot, listed, name) =>
  name === '<EMPTY>' || !name
    ? `Slot ${captureNumber(slot)} is empty on the unit now, not “${listed}”. The list of captures will be read again.`
    : `The unit has “${name}” in slot ${captureNumber(slot)}, not “${listed}”. The list of captures will be read again.`

/** What a capture is called on a button or a row: its number and its name, or its number alone until the name is known. */
export function captureSaid(slot, head) {
  if (!Number.isInteger(slot)) return ''
  const name = typeof head?.name === 'string' ? head.name.trim() : ''
  if (head?.empty) return `${captureNumber(slot)} (empty)`
  return name ? `${captureNumber(slot)} ${name}` : captureNumber(slot)
}

/** The line under a capture's name: who made it and of what, where the capture says. */
export function captureMore(head) {
  const said = (x) => (typeof x === 'string' ? x.trim() : '')
  const gear = [said(head?.make), said(head?.model)].filter(Boolean).join(' ')
  return [said(head?.by) ? `by ${said(head.by)}` : '', gear].filter(Boolean).join(' · ')
}

/** The captures whose number, name, maker or gear holds every word typed. */
export function capturesFound(list, text) {
  const words = String(text || '')
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
  if (!words.length) return list
  return list.filter((h) => {
    const hay = `${captureNumber(h.slot)} ${h.name || ''} ${h.by || ''} ${h.make || ''} ${h.model || ''}`.toLowerCase()
    return words.every((w) => hay.includes(w))
  })
}

const text = (x) => (typeof x === 'string' ? x : '')
/* A head as the list keeps it: what the row needs, and nothing the unit did not say. */
const headOf = (h) => ({ slot: h.slot, name: text(h.name), by: text(h.by), make: text(h.make), model: text(h.model), gearType: text(h.gearType), toneType: text(h.toneType), empty: h.empty === true })

/**
 * The list.
 *
 * @param {object} c
 * @param {(from: number, count: number) => Promise<{ heads: object[], stopped?: number }>} c.heads  some slots' heads, in order from `from`
 * @param {(ms: number) => Promise<void>} c.pause
 * @param {() => number} [c.now]
 * @param {() => number} [c.piece]   how many slots a request asks for
 * @param {() => number} [c.rest]    ms between two pieces, for everything else that wants the line
 * @param {number} [c.again]         ms no slot is asked after one said nothing: longer than a late answer can take (the wire's 2 s)
 * @param {number} [c.busyEvery]     ms between two tries while the capture tools are at work for somebody else
 * @param {number} [c.busyFor]       ms of that before it is said instead of waited out
 * @param {(kept: object) => void} [c.keep]  write the list down
 */
export function captureList({ heads, pause, now = () => Date.now(), piece = () => 8, rest = () => 150, again = 2500, busyEvery = 1200, busyFor = 45000, keep = () => {} }) {
  /* Every slot that has answered, empty ones too, by slot. */
  const bySlot = new Map()
  let asked = 0
  let loading = null
  let done = false
  let stale = false
  /* How many times something has said the unit's captures changed: a read that began before the last of them does not clear `stale`. */
  let changes = 0
  let at = null
  let fault = null
  let snapshot = null
  const listeners = new Set()

  const publish = () => {
    snapshot = null
    for (const fn of [...listeners]) fn()
  }
  /** What the screen draws: the same object until something changes. */
  const get = () => {
    if (!snapshot) {
      const list = [...bySlot.values()].filter((h) => !h.empty && h.slot < CAPTURES_LISTED).sort((a, b) => a.slot - b.slot)
      snapshot = Object.freeze({ list, asked, total: CAPTURES_LISTED, loading: loading !== null, done, stale, at, fault })
    }
    return snapshot
  }
  const subscribe = (fn) => {
    listeners.add(fn)
    return () => listeners.delete(fn)
  }

  /* One thing at a time: whatever this sends waits for what it sent before. */
  let lane = Promise.resolve()
  const turn = (run) => {
    const p = lane.then(run, run)
    lane = p.then(
      () => {},
      () => {}
    )
    return p
  }

  /*
   * THE QUIET AFTER A SLOT SAID NOTHING. Its answer may still be on its way,
   * and would be taken for the next slot question's, so no slot is asked
   * until `again` ms have passed. The wait is taken OUTSIDE the lane: a pick
   * tapped meanwhile is not a slot question, and goes straight in. Then,
   * with the lane in hand, it is looked at once more (another asker's slot
   * may have said nothing since), and waited out again if so.
   */
  let quietUntil = 0
  const silentNow = () => {
    quietUntil = now() + again
  }
  /* Never longer than the quiet itself, whatever the clock does. */
  const quietLeft = () => Math.min(quietUntil - now(), again)
  const QUIET = {}
  async function ask(from, count) {
    for (;;) {
      const until = quietUntil
      const wait = quietLeft()
      if (wait > 0) {
        await pause(wait)
        /* Waited out: over, unless a slot has said nothing since. */
        if (quietUntil === until) quietUntil = 0
      }
      const got = await turn(async () => {
        if (quietLeft() > 0) return QUIET
        /*
         * A slot that says nothing begins the quiet HERE, with the lane still
         * in hand: the next job in the lane starts before whoever asked this
         * hears the answer, and a slot question waiting there would otherwise
         * be sent straight into the quiet.
         */
        try {
          const answer = await heads(from, count)
          if (Number.isInteger(answer?.stopped)) silentNow()
          return answer
        } catch (err) {
          if (err?.status === 504) silentNow()
          throw err
        }
      })
      if (got !== QUIET) return got
    }
  }

  const take = (h) => {
    if (!h || !Number.isInteger(h.slot) || h.slot < 0) return false
    bySlot.set(h.slot, headOf(h))
    return true
  }
  const written = () => ({ at, heads: get().list.map((h) => ({ slot: h.slot, name: h.name, by: h.by, make: h.make, model: h.model })) })

  /*
   * Whether the unit has answered a slot's question of late, in a read or
   * for a block's button: one that has is not "a firmware older than the NAM
   * block" when it goes quiet, it has stopped answering. Of late, not for
   * ever: there is one list for the app, and nothing says when another unit
   * has been connected.
   */
  const ANSWERED_FOR = 10 * 60 * 1000
  let answeredAt = null
  const heardNow = () => {
    answeredAt = now()
  }
  const hasAnswered = () => answeredAt !== null && Math.abs(now() - answeredAt) < ANSWERED_FOR

  /* The read itself. Answers with the slots that said nothing twice and were left out, each with what the list had for it then. */
  async function read() {
    const total = CAPTURES_LISTED
    let from = 0
    /* The slot that said nothing last, and how many times running. */
    let silentAt = null
    let silent = 0
    /* Slots left out one after another, none answering between: two is a unit that has stopped answering, not a slot of its own that will not say. */
    let leftRun = 0
    /* Requests in a row that failed as "no answer" without saying which slot. */
    let thrown = 0
    const leftOut = []
    /* The capture tools were at work for somebody else (another device's send through the same computer): asked again for a while, then said. */
    let busy = 0
    const busyMost = Math.max(1, Math.ceil(busyFor / Math.max(1, busyEvery)))
    /* Nothing below can go round for ever: every pass moves on, or counts toward a stop. */
    for (let pass = 0; from < total; pass++) {
      if (pass > total * 4) throw new Error(hasAnswered() ? CAPTURES_STOPPED : NO_CAPTURE_LIST)
      const count = Math.max(1, Math.min(Math.floor(piece()) || 1, total - from))
      let got
      try {
        got = await ask(from, count)
      } catch (err) {
        if (err?.status === 409 && busy++ < busyMost) {
          await pause(busyEvery)
          continue
        }
        if (err?.status !== 504) throw err
        /* A sender that says "no answer" as a failure, not which slot stopped: waited out (the quiet began as it failed, in ask) and asked again, a few times. No slot is left out on its word. */
        if (++thrown >= (hasAnswered() ? 4 : 2)) throw new Error(hasAnswered() ? CAPTURES_STOPPED : NO_CAPTURE_LIST)
        continue
      }
      busy = 0
      const list = (Array.isArray(got?.heads) ? got.heads : []).filter((h) => Number.isInteger(h?.slot) && h.slot >= from && h.slot < from + count)
      let next = from
      for (const h of list) {
        if (h.slot !== next) break
        take(h)
        heardNow()
        leftRun = 0
        thrown = 0
        next++
      }
      if (Number.isInteger(got?.stopped) && got.stopped >= next) {
        /* The first slot not heard said nothing (wherever the sender says it stopped): no slot is asked until its late answer is gone (the quiet began as the answer came, in ask), and it is asked once more. Twice running, it is left out. */
        const quiet = next
        silent = silentAt === quiet ? silent + 1 : 1
        silentAt = quiet
        if (silent >= 2) {
          if (!hasAnswered()) throw new Error(NO_CAPTURE_LIST)
          if (++leftRun >= 2) throw new Error(CAPTURES_STOPPED)
          leftOut.push([quiet, bySlot.get(quiet)])
          from = quiet + 1
          silentAt = null
          silent = 0
        } else from = quiet
        asked = from
        publish()
        continue
      }
      if (next === from) throw new Error('The list of captures came back with nothing in it. Try again.')
      silentAt = null
      silent = 0
      from = next
      asked = from
      publish()
      if (from < total) {
        const wait = rest()
        if (wait > 0) await pause(wait)
      }
    }
    return leftOut
  }

  /**
   * Read the list, unless it is here and nothing says it has changed
   * (`again: true` reads it whatever). One read at a time: a second ask
   * while one is going is handed the one that is going.
   */
  function load({ again: whatever = false } = {}) {
    if (loading) return loading
    if (done && !stale && !whatever) return Promise.resolve(get())
    fault = null
    asked = 0
    const began = changes
    const run = (async () => {
      try {
        const leftOut = await read()
        /* Only now, with every slot asked, is what did not answer taken out: only what this read heard stays. A read that failed takes nothing out. And a slot that has answered since it was left out (asked by itself, for a block's button) keeps what it said. */
        for (const [slot, was] of leftOut) if (bySlot.get(slot) === was) bySlot.delete(slot)
        done = true
        /* A capture sent while this was being read may be in a slot it had already passed: still out of date, and the next open reads again. */
        stale = changes !== began
        at = now()
        keep(written())
      } catch (err) {
        fault = err?.message || 'The list of captures couldn’t be read.'
        /* What is on show is part this read's and part the last one's: the next open reads again. Nothing is written down. */
        if (done) stale = true
      } finally {
        loading = null
        publish()
      }
      return get()
    })()
    loading = run
    publish()
    return run
  }

  /**
   * One slot's head, asked by itself: what a block's button says before
   * (or without) the whole list. `fresh` asks the unit even where the list
   * has the slot, and a name that is not the list's marks the list out of
   * date, so it is read again the next time it is opened.
   */
  async function ensure(slot, { fresh = false } = {}) {
    if (!Number.isInteger(slot) || slot < 0) return null
    const known = bySlot.get(slot) || null
    if (known && !fresh) return known
    let got
    try {
      got = await ask(slot, 1)
    } catch {
      return bySlot.get(slot) || null
    }
    const head = (Array.isArray(got?.heads) ? got.heads : []).find((h) => h?.slot === slot)
    if (head) heardNow()
    /* Against what the list has NOW: a piece of it may have been read while this waited its turn. */
    const had = bySlot.get(slot) || null
    if (!head) return had
    const differs = had ? had.name !== text(head.name) || had.empty !== (head.empty === true) : head.empty !== true && slot < CAPTURES_LISTED
    /* While the list is being read, that only says it is out of date for a slot the read has already passed: one still ahead of it is about to be read anyway. */
    if (differs && (loading ? slot < asked : done)) outOfDate()
    take(head)
    publish()
    return bySlot.get(slot)
  }

  /** What is known of one slot, empty ones and the 257th too (the list on show leaves those out): what a block's button says. */
  const head = (slot) => bySlot.get(slot) || null

  /**
   * What the unit said a slot holds when a block was pointed at it: the
   * list's name for it follows. The entry is a new one even where the name
   * is the one the list had: the unit has just answered for this slot, and a
   * read that had left it out as silent must not take it out when it ends.
   */
  function note(slot, name) {
    if (!Number.isInteger(slot) || slot < 0 || typeof name !== 'string') return
    const had = bySlot.get(slot)
    const said = name.trim()
    const same = !!had && had.name === said && had.empty === (said === '<EMPTY>')
    bySlot.set(slot, headOf({ ...(had || {}), slot, name: said, empty: said === '<EMPTY>' }))
    heardNow()
    if (!same) publish()
  }

  /** The unit's captures may have changed (one was sent from the app): what is here stays on show, and the next open reads again. */
  const outOfDate = () => {
    changes++
    stale = true
  }
  function markStale() {
    const was = stale
    outOfDate()
    if (!was) publish()
  }

  /** What was written down the last time (lib/store): shown at once, whole, until there is reason to read again. */
  function recall(kept) {
    if (done || loading || bySlot.size) return false
    const list = Array.isArray(kept?.heads) ? kept.heads.filter((h) => Number.isInteger(h?.slot) && h.slot >= 0 && h.slot < CAPTURES_LISTED && typeof h.name === 'string' && h.name) : []
    if (!list.length || !Number.isFinite(kept?.at)) return false
    for (const h of list) take({ ...h, empty: false })
    done = true
    at = kept.at
    asked = CAPTURES_LISTED
    publish()
    return true
  }

  return { get, subscribe, load, ensure, head, note, stale: markStale, recall, turn }
}

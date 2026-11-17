import { useCallback, useEffect, useRef } from 'react'
import { AppState } from 'react-native'
import { bluetoothWire } from './bleSwitch'
import { blockParams, captureGoing, lastTapAt, liveBlockParams, unitReportsHeard } from './device'
import { isDemo } from './demo'
import { logDebug } from './debugLog'
import { getState, onKnobNews, refreshSceneState, useRig } from './rig'
import { LIVE_WIRE_UNITS, changedWords, createLiveKnobs, liveUnit, mergeKnobs } from './liveKnobs'
import { useLiveKnobs } from './useLiveKnobs'

/*
 * EDIT'S KNOBS FOLLOW THE UNIT, IN THE PANEL THAT DRAWS THEM (screens/Edit
 * BlockPanel: Edit, the hold pop-up and the big screen's panel are all it).
 * The rules are lib/liveKnobs; this is where they meet the panel: what it is
 * busy with, the app going away and coming back, the scene and the preset,
 * the news of a knob moved on the unit, and what a read changes on screen.
 *
 * Open only to his account until lib/features LIVE_KNOBS_FOR_EVERYONE
 * (lib/useLiveKnobs), on an FM3, an FM9 or an Axe-Fx III (the rig's name for
 * the unit), never in the demo and never on a block with no knobs to read.
 * Closed, the panel is exactly what it was: no reads of this file's, no
 * listener, its first read the one it always made, its lock and its writes
 * handed straight through.
 */

const ofSlug = (s) => s.deviceSlug
const ofScene = (s) => s.sceneIndex
const ofPreset = (s) => s.preset?.number ?? null
const ofBufferRev = (s) => s.bufferRev

/* The device's own clock, handed to the rules (which take any). */
const CLOCK = {
  now: () => Date.now(),
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (id) => clearTimeout(id)
}

/* What the panel is busy with that no read may cross, in words for the log, or null. */
const busyOf = (q) =>
  q.loading
    ? 'the block is being read'
    : q.picking
      ? 'the model list is open'
      : Object.keys(q.choosing || {}).length
        ? 'a setting is being chosen'
        : q.capturing !== null && q.capturing !== undefined
          ? 'a capture is being picked'
          : q.rereading
            ? 'the block is being read again'
            : q.restoring
              ? 'an Undo is going'
              : null

/**
 * `p`, the panel as it is drawn now: { eid, block, lockAbove (the scroll
 * lock it was handed), params, enums, type, layout, capture, local (values
 * waiting to go), loading, picking, choosing, capturing, rereading,
 * restoring, and setParams, setEnums, setType, setLayout, setCapture }.
 *
 * Answers { lock, during, firstRead, open }: the scroll lock to hand the knobs
 * (it tells the rules a finger is down, then the lock it was given), a
 * write of the panel's own from start to end, and the panel's first read
 * (fresh from the unit where its knobs follow it: C).
 */
export function useLiveKnobsHere(p) {
  const his = useLiveKnobs()
  const slug = useRig(ofSlug)
  const scene = useRig(ofScene)
  const preset = useRig(ofPreset)
  const rev = useRig(ofBufferRev)
  const open = his === true && liveUnit(slug) && !isDemo() && p.block?.knobs !== false
  const now = useRef(p)
  now.current = p
  const openNow = useRef(open)
  openNow.current = open
  const lockAbove = useRef(p.lockAbove)
  lockAbove.current = p.lockAbove
  /* The channel a read last found the block on, on the unit, where it was not the panel's: what is on is asked once for it. */
  const askedFor = useRef(null)

  const ends = useRef(null)
  ends.current = {
    on: () => openNow.current,
    /* B: over Bluetooth or the unit's own cable, on a unit the wire follows. */
    timer: () => openNow.current && LIVE_WIRE_UNITS.includes(bluetoothWire()?.unit),
    eid: () => now.current.eid,
    held: () => {
      const q = now.current
      if (q.local && Object.keys(q.local).length) return 'a value is waiting to go'
      const busy = busyOf(q)
      if (busy) return busy
      if (getState().tunerOn) return 'the tuner is open'
      if (captureGoing()) return 'a capture is being sent'
      return null
    },
    tapAt: lastTapAt,
    heard: unitReportsHeard,
    read: ({ fresh, ifIdle }) => liveBlockParams(now.current.eid, { fresh, ifIdle }),
    apply: (got) => {
      const q = now.current
      if (!got || !Array.isArray(got.named)) return
      /*
       * A read the computer could not finish answers every knob at nought,
       * with no range, no settings and no model (ForgeFX gen3 blockParams'
       * catch): laid over the panel it blanked every knob and the model (an
       * independent read, 16 November 2026). Edit's capture path has always
       * known the shape; so does this one now. The panel keeps what it has.
       */
      if (got.named.length && got.named.every((k) => k?.value === 0 && typeof k?.min !== 'number') && (q.params || []).some((k) => typeof k?.min === 'number')) {
        logDebug('edit', `${q.block?.name || `block ${q.eid}`}: a read came back with every knob at nought and no ranges (the computer could not read the unit): not used`)
        return
      }
      if (got.type == null && q.type != null) {
        logDebug('edit', `${q.block?.name || `block ${q.eid}`}: a read came back with no model: not used`)
        return
      }
      /* The unit is on another channel than the panel: its knobs are not this panel's. What is on is read (small), and the panel opens on the right one. */
      if (typeof got.channel === 'string' && typeof q.block?.channel === 'string' && got.channel !== q.block.channel) {
        if (askedFor.current !== got.channel) {
          askedFor.current = got.channel
          logDebug('edit', `${q.block.name} is on channel ${got.channel} on the unit, not ${q.block.channel}: what is on is read again`)
          refreshSceneState().catch(() => {})
        }
        return
      }
      const pending = q.local || {}
      const knobs = mergeKnobs(q.params, got.named, pending)
      const settings = mergeKnobs(q.enums, Array.isArray(got.enums) ? got.enums : [], q.choosing || {})
      const model = got.type?.value ?? null
      const modelMoved = model !== (q.type?.value ?? null)
      /* A change of the whole block (another model) waits while anything of the panel's is waiting to go. */
      if (knobs.held || settings.held || (modelMoved && Object.keys(pending).length)) return
      if (knobs.list !== q.params) q.setParams(knobs.list)
      if (settings.list !== q.enums) q.setEnums(settings.list)
      if (modelMoved) q.setType(got.type ?? null)
      if (JSON.stringify(got.layout || null) !== JSON.stringify(q.layout || null)) q.setLayout(got.layout || null)
      const slot = got.capture?.slot
      if (Number.isInteger(slot) && slot !== q.capture?.slot && (q.capturing === null || q.capturing === undefined) && !q.rereading) q.setCapture(got.capture)
      const changed = [...knobs.changed, ...settings.changed]
      if (modelMoved) changed.unshift({ name: 'Model', from: q.type?.name ?? q.type?.value, to: got.type?.name ?? model })
      if (changed.length) logDebug('edit', `${q.block?.name || `block ${q.eid}`}: ${changedWords(changed)}`)
    },
    log: (line) => logDebug('edit', line)
  }

  const live = useRef(null)
  if (open && !live.current) live.current = createLiveKnobs(() => ends.current, CLOCK)

  /* Following: from the start, the news of a knob moved on the unit (D, A), and stopped with the panel. */
  useEffect(() => {
    if (!open) return undefined
    const l = live.current
    l.start()
    const off = onKnobNews((event) => l.news(event))
    /* C: the app back at the front reads the block; away, nothing is read. */
    if (AppState.currentState && AppState.currentState !== 'active') l.back()
    const sub = AppState.addEventListener('change', (status) => (status === 'active' ? l.front() : l.back()))
    return () => {
      off()
      sub?.remove?.()
      l.kick()
    }
  }, [open])
  useEffect(() => () => live.current?.stop(), [])

  /* The panel's own read: the gap starts again from its end, and it says what that read took. */
  const loadFrom = useRef(null)
  useEffect(() => {
    if (p.loading) {
      loadFrom.current = Date.now()
      return
    }
    if (loadFrom.current === null) return
    const took = Date.now() - loadFrom.current
    loadFrom.current = null
    live.current?.loaded(took)
  }, [p.loading])

  /* A setting being chosen, a capture picked, an Undo: writes of the panel's own, from start to end. */
  const writing = Object.keys(p.choosing || {}).length > 0 || (p.capturing !== null && p.capturing !== undefined) || p.rereading === true || !!p.restoring
  useEffect(() => {
    if (!writing) return undefined
    const l = live.current
    l?.wrote()
    return () => l?.checked()
  }, [writing])

  /* The scene or the preset changed (a remount follows the scene and the read preset; the preset's number comes first). */
  const moveKey = `${scene}:${preset}:${rev}`
  const lastMove = useRef(moveKey)
  useEffect(() => {
    if (lastMove.current === moveKey) return
    lastMove.current = moveKey
    live.current?.moved()
  }, [moveKey])

  /* A value set down or cleared: looked at again now rather than at the next look. */
  const waitingCount = Object.keys(p.local || {}).length
  useEffect(() => {
    live.current?.kick()
  }, [waitingCount])

  const lock = useCallback((down) => {
    if (openNow.current) live.current?.lock(down === true)
    lockAbove.current?.(down)
  }, [])
  const during = useCallback((run) => (openNow.current && live.current ? live.current.during(run) : run()), [])
  const firstRead = useCallback((eid) => (openNow.current ? liveBlockParams(eid) : blockParams(eid)), [])
  return { lock, during, firstRead, open }
}

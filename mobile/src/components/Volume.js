import { useEffect, useRef, useState } from 'react'
import { Modal, PanResponder, Platform, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native'
import { BlurView } from 'expo-blur'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { color, font, mono, radius, space, TAP } from '../lib/theme'
import { paneRim } from '../lib/glass'
import { ANY_WAY_UP, clearSides } from '../lib/screenShape'
import Note from './Note'
import { blockParams, idOf, setParam, setParamConfirmed } from '../lib/device'
import { noteEdited, useRig } from '../lib/rig'
import { useOutputAndSceneLevels } from '../lib/bluetooth'
import { sceneLevelParam, sceneLevelParams, sceneNudged, volumeOutput } from '../lib/sceneLevel'
import {
  latestWriter,
  NUDGE_SETTLE_MS,
  nudged,
  outputLevelParam,
  volumeLabel,
  volumeNudge,
  volumePercent
} from '../lib/volume'
import { tick } from '../lib/feedback'
import { logDebug } from '../lib/debugLog'
import Press from './Press'
import MetronomeSwitch from './MetronomeSwitch'
import { at as tint } from '../lib/vivid'

const face = Platform.select(mono)

/**
 * The volume, on the stage screen.
 *
 * "Add volume slider to the play screen to quickly turn volume up or down."
 *
 * It moves the Output block's Level — the one control that is the whole
 * preset's volume, and the thing a soundperson means by "give me a bit less".
 * The edit screen shows it and will not turn it, deliberately: a level dragged
 * to the bottom by accident makes a preset that looks right and is silent. That
 * rule is about a knob among thirty others under a thumb. This is the opposite
 * — one control, the width of the screen, that is FOR moving the volume, with
 * the number on it the whole time.
 *
 * WHY THE DRAG DOES NOT SEND EVERY VALUE. A slider reports one per frame, and
 * the unit takes one request at a time down a serial port with a relay to a Mac
 * in front of it. Sent as they come, a two-second drag queues a hundred writes
 * that the unit works through for the next ten seconds — landing on the value
 * you let go of long after you let go, and holding up the scene you pressed
 * next. `latestWriter` is shared with the Mac and does the coalescing: one
 * write out, the newest value replacing whatever was queued behind it.
 *
 * AND THE LAST ONE IS CONFIRMED. Everything mid-drag goes out unconfirmed,
 * because a read-back per frame is the same jam by another name. The value the
 * thumb comes off on is written again the careful way, because that is the one
 * that has to be true.
 *
 * MINUS AND PLUS EITHER SIDE. "Do a plus minus on the sides of the volume
 * slider that does 1 dB at a time." A dB is the unit a soundperson talks in and
 * a whole one is the smallest change worth a press: the slider is for the
 * sweep, the buttons for landing on a number.
 */
/*
 * IT IS A POP-UP, and that is not decoration — it is the fix.
 *
 * "Volume slider also tries to scroll the screen when sliding the volume. Just
 * an overlay that pops up on the screen separately would be cool… whatever we
 * gotta do to fix that so that when you tap the volume button, the volume
 * slider pops up and is able to be slid without scrolling or moving anything
 * else."
 *
 * A slider drags across a screen that scrolls, and on iOS the scroll view's pan
 * gesture recogniser is NATIVE: it takes the touch back and terminates the drag
 * rather than losing to a JavaScript responder. There are fixes that fight
 * that — the bench's knobs use one — but for a control that is wanted twice a
 * night the better answer is to take the fight away entirely. In a modal there
 * is no scroll view behind it and nothing to argue with.
 *
 * The browser reached the same place from the other direction: "put a sound
 * button that looks like a speaker in the header, and when it's tapped you can
 * slide the volume left or right… but it's not there on the main screen."
 */
/**
 * Why there is nothing to write to, told apart rather than guessed at.
 *
 * This said "the chain is still loading" for both, and it was the wrong half
 * of the time: the chain HAD been read, and the Output block in it came back
 * with no id to address. Blaming a read that already happened sends somebody
 * to wait for something that has finished, which is the worst kind of wrong
 * message — it looks like patience is the answer.
 *
 * With the bar's speaker now asking the same question this does, neither
 * should be reachable at all. They are kept because they are what says so if
 * the two ever disagree again.
 */
const noOutput = (present, onError) => {
  const why = present
    ? 'the unit reported an Output block with no id to write to'
    : 'the chain has not been read'
  logDebug('set', 'volume: no Output block known yet', why)
  onError?.(
    present
      ? 'This preset’s Output block came back without a level this app can move.'
      : 'No output level to move yet — the chain is still loading.'
  )
}

/*
 * WHICH PRESET, ON WHICH UNIT, the level under the slider belongs to.
 *
 * The Output block's id does not say: it is the same number in every preset
 * of an FM3, FM9 or Axe-Fx III, and the same on all three. So a preset
 * stepped to from a footswitch while the pop-up was open left the last
 * preset's level on the slider, and a press of + still waiting to be
 * confirmed was confirmed on the NEW preset: its level moved to the old
 * one's, and Save lit for a change nobody made. The level is the preset's,
 * so it is dropped and read again when the preset is another one, whatever
 * the block's id (found by the review, 16 November 2026).
 *
 * What it cannot do: the app hears of a footswitch a moment after the unit
 * has stepped, and a press confirmed inside that moment has already gone to
 * the new preset.
 */
const ofSounding = (s) => `${s.deviceSlug}:${s.preset?.number}`

/* The scene the unit is on, from 0 (the rig's own, as the scene tiles have it), and its name. */
const ofScene = (s) => s.sceneIndex
const ofSceneNames = (s) => s.sceneNames

export default function Volume({ blocks, open, onClose, onError }) {
  /*
   * OUTPUT 1, AND THIS SCENE'S LEVEL, for an account lib/bluetooth
   * outputAndSceneLevels opens (his, until lib/features
   * OUTPUT_AND_SCENE_LEVELS_FOR_EVERYONE): the volume moves Output 1
   * whatever order the chain lists the Output blocks in, and a row under it
   * reads and writes the Output block's level for the scene the unit is on
   * (lib/sceneLevel). Every other account: the first Output block the chain
   * lists, and no row, exactly as before (volumeOutput).
   */
  const levels = useOutputAndSceneLevels()
  const output = volumeOutput(blocks, levels)
  const eid = idOf(output)
  const sounding = useRig(ofSounding)
  const sceneIndex = useRig(ofScene)
  const sceneNames = useRig(ofSceneNames)

  const [param, setParamState] = useState(null)
  const [value, setValue] = useState(null)
  /*
   * THE LEVEL, WHERE IT IS READ FROM. The state above is what is drawn; this
   * is the level as it was last set, by a thumb, a press, a read of the unit
   * or the unit's own answer, and it is what everything that runs later
   * reads: where a drag starts from, what a press steps from, what the
   * landing confirms.
   *
   * It is set in the same breath as the state (`show`), and by nothing else.
   * It used to ride on the ref below, which is written again after every
   * draw from what was drawn: and a draw's after-work can run later than the
   * next move of a thumb (React leaves it for after a touch-move's draw). So
   * the draw of +10 could put +10 back over the +15 the thumb had since
   * moved to, and a thumb that came off just then had +10 confirmed on a
   * unit already at +15, under a slider showing +15, with nothing said.
   */
  const level = useRef(null)
  const show = (v) => {
    level.current = v
    setValue(v)
  }
  /*
   * EVERY SCENE'S LEVEL (lib/sceneLevel), drawn where the switch opens them:
   * the settings the Output block's read named (`scenes`: the same read as the
   * main level's, nothing more is asked of the unit), and the level each was
   * last set to, by that read, a press or the unit's answer, by its setting
   * (`sceneAt`). That is what a press steps from, as `level` is the main
   * level's, and it is set only with what is drawn (`showScene`). A scene
   * changed on the unit only changes which one is drawn: all eight were read.
   */
  const [scenes, setScenes] = useState([])
  const sceneAt = useRef({})
  const [sceneShown, setSceneShown] = useState({})
  const showScene = (id, v) => {
    sceneAt.current = { ...sceneAt.current, [id]: v }
    setSceneShown(sceneAt.current)
  }
  const [dragging, setDragging] = useState(false)
  /* Measured, because the thumb's position has to be a fraction of the real
     track rather than of a number typed here. */
  const [width, setWidth] = useState(0)
  /* And the window, for how wide the panel itself should be, and how tall the metronome's part of it may be. */
  const { width: width0, height: height0 } = useWindowDimensions()
  const insets = useSafeAreaInsets()

  /*
   * WHAT THE POP-UP KNOWS NOW, for everything that runs later than the render
   * it was made in: the writer, the slider's touch handler and the landing at
   * the end of a drag. The level's own control, how wide the track is, the
   * block, whether there is an Output block at all, and where an error is
   * said. Never the level itself: that is `level`, above, and why.
   */
  const live = useRef({ param: null, width: 0, eid: null, present: false, onError: null })
  /* And the same for this scene's row: whether it is open here, every scene's level setting the last read named, and the scene the unit is on. */
  const sceneLive = useRef({ open: false, scenes: [], index: null })
  useEffect(() => {
    live.current = { param, width, eid, present: !!output, onError }
    sceneLive.current = { open: levels === true, scenes, index: sceneIndex }
  })

  /*
   * One write on the wire at a time; see the note above.
   *
   * THE WRITER READS THE BLOCK OFF THE REF, NOT THE RENDER. It is made once,
   * on the first render, and the first render is before the chain has been
   * read, so the Output block it closed over was nothing at all -- and stayed
   * nothing for the life of the screen. Every press of − and + after that
   * went out as a write to block "undefined": twenty-seven of them in one
   * log, each refused with a sentence about doing it at the computer, while
   * the guard on the button saw the block it had by then and let them
   * through. The ref is what the guard looks at, so the writer looks there
   * too.
   */
  const writer = useRef(null)
  if (!writer.current) {
    writer.current = latestWriter((v) => {
      const { param: p, eid: block } = live.current
      if (!Number.isInteger(block)) return Promise.reject(new Error('The chain has not been read yet, so there is no output level to write.'))
      return setParam(block, p.id, v, p)
    })
  }

  /*
   * READ WHEN THE SHEET OPENS, NOT WHEN THE BAR IS DRAWN.
   *
   * This read the Output block's knobs the moment the stage screen appeared,
   * and again at every preset change, for a sheet opened twice a night. A
   * block's knobs read that way also tell the computer somebody is editing
   * that block, and it then re-reads it every two seconds for as long as the
   * app is open — reads at a unit that is making sound, for a slider nobody
   * was touching. Opening the sheet is when the level is wanted, and reading
   * then also means it shows the level the unit has now, not the one it had
   * when the screen was drawn.
   */
  const [reading, setReading] = useState(false)
  /*
   * Another preset's Output block is another level: not shown as this one's
   * while this one is read. And a press still waiting to be confirmed was a
   * press on the level that has gone: its wait is dropped with it, or it
   * fired later and "confirmed" a level on a preset it was never made on,
   * lighting Save for a change nobody made.
   *
   * `turn` is counted up each time, and is how anything still going out
   * knows the level it was sent for has gone (the landing, below). The
   * block a wait was for is forgotten too: a block that goes and comes
   * BACK under the same id (the chain read again while a drag was still
   * being confirmed) is another turn, and the read of it must not be held
   * back for a landing from before it went. It was: the slider read "—"
   * and every press was dropped until the pop-up was closed and opened.
   */
  useEffect(() => {
    setParamState(null)
    show(null)
    clearTimeout(settle.current.timer)
    settle.current.timer = null
    settle.current.again = false
    settle.current.eid = null
    settle.current.turn += 1
    /* And every scene's level with it: another preset's, or another block's. A press on one still waiting is not confirmed (sceneLanding `turn`). */
    setScenes([])
    sceneAt.current = {}
    setSceneShown({})
    const s = sceneLanding.current
    for (const id of Object.keys(s.timers)) clearTimeout(s.timers[id])
    s.timers = {}
    s.again = {}
    s.turn += 1
  }, [eid, sounding])
  useEffect(() => {
    if (!open || !Number.isInteger(eid)) return undefined
    let stop = false
    setReading(true)
    ;(async () => {
      try {
        const res = await blockParams(eid)
        if (stop) return
        const found = outputLevelParam(res?.named)
        setParamState(found)
        /*
         * A press or a drag still landing ON THIS BLOCK from before a quick
         * close and open is newer than this answer, which was asked before
         * it landed. One that was landing on the block before this one is
         * not: held back for it, the new block's level was never shown, the
         * slider read "—" until the next open, and the next press of + went
         * to the bottom of the range, the sound all but gone ("the next
         * press drops the volume", found by the review, 16 November 2026:
         * a press, then a footswitch to another unit's preset inside the
         * same second).
         */
        const landing = (settle.current.timer !== null || settle.current.landing) && settle.current.eid === eid
        if (!landing) show(found ? found.value : null)
        /* Every scene's level out of the same answer (drawn only where the switch opens them, below); one with a press still landing keeps the press's (sceneSettling). */
        const list = sceneLevelParams(res?.named)
        setScenes(list)
        for (const q of list) if (!sceneSettling(q.id)) showScene(q.id, q.value)
      } catch (err) {
        if (!stop) onError?.(err.message)
      } finally {
        if (!stop) setReading(false)
      }
    })()
    return () => {
      stop = true
    }
  }, [open, eid, sounding, onError])

  /** Where the thumb was when the finger landed, as a value. */
  const from = useRef(0)

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        from.current = level.current
        setDragging(true)
        tick()
      },
      onPanResponderMove: (_, gesture) => {
        const { param: p, width: w } = live.current
        /* Never from a level that is not known: nothing counted from nothing is a level to send. */
        if (!p || !w || typeof from.current !== 'number') return
        const span = p.max - p.min
        const next = clamp(from.current + (gesture.dx / w) * span, p.min, p.max)
        const rounded = Math.round(next * 100) / 100
        /* Drawn, and kept where the landing reads it: the thumb can come off before the screen has drawn this value. */
        show(rounded)
        writer.current.send(rounded)
        /* Save is told as the level is sent (see the press, below). */
        noteEdited()
      },
      onPanResponderRelease: () => {
        setDragging(false)
        landDrag()
      },
      onPanResponderTerminate: () => {
        setDragging(false)
        landDrag()
      }
    })
  ).current

  /**
   * The end of a drag: let the queue empty, then write the value under the
   * thumb once more, the careful way.
   *
   * The unit accepts a write it then ignores and says nothing about it, so the
   * one value that matters — the one you stopped on — is the one worth paying a
   * read-back for.
   *
   * IT READS THE BLOCK OFF THE REF, AS THE WRITER DOES. "When I tried to turn
   * the decibels up or down, it gave me an error": No output level to move
   * yet — the chain is still loading, with the level on screen and the chain
   * read long before. The slider's touch handler is made once, on the first
   * render, and the landing it calls at the end of a drag was the first
   * render's too: from before the chain was read, holding no block for the
   * life of the screen. So every drag moved the level (the writer reads the
   * ref) and then said there was nothing to move, and the value the thumb
   * came off on was never confirmed, nor Save told. Nothing in here may be
   * read from the render: whichever render's landing is called, it is the
   * same landing.
   */
  const land = async () => {
    const { param: p, eid: block, present, onError: say } = live.current
    const v = level.current
    if (!p || typeof v !== 'number') return
    if (!Number.isInteger(block)) {
      noOutput(present, say)
      return
    }
    const turn = settle.current.turn
    try {
      const failed = await writer.current.settled()
      if (failed) say?.(failed.message)
      /* The level went while the writes were still going out (another preset, another unit's block, the chain read again): it was the old one's, and is not confirmed on what is there now. */
      if (settle.current.turn !== turn) return
      const res = await setParamConfirmed(block, p.id, v, p)
      /* The level is a parameter like any other, so the Save button should
         know about it — see rig.noteEdited. */
      noteEdited()
      /* A newer value arrived while this one was being checked: its own
         check follows, and a miss against a value nobody wants any more is
         not a miss. */
      if (level.current !== v) return
      if (!res.ok) {
        /* The unit answered neither read of the check: not a miss, and not said as one (lib/device setParamConfirmed `unverified`). */
        if (res.unverified) {
          say?.('Couldn’t check that the volume took: the unit didn’t answer. It may have.')
          return
        }
        /* Say what the unit is holding, and show it: a slider left pointing
           at a number the unit refused is a slider lying about the volume. */
        const holding = typeof res.actual === 'number' ? res.actual : null
        if (holding !== null) show(holding)
        say?.(
          holding === null
            ? `The volume didn’t take. You asked for ${volumeLabel(v, p)}.`
            : `The volume didn’t take. You asked for ${volumeLabel(v, p)}; the unit says ${volumeLabel(holding, p)}.`
        )
      }
    } catch (err) {
      say?.(err.message)
    }
  }

  /*
   * A press goes to the unit now, through the same coalescing writer as a
   * drag; the careful read-back waits until the presses stop, and runs one
   * at a time. See NUDGE_SETTLE_MS for the evening that taught this.
   */
  /*
   * `eid` is the block the press or the drag that is landing was made on, so
   * a read of ANOTHER block is never held back for it (the open's read,
   * above); `turn` counts the levels this pop-up has had under it (the
   * reset, above).
   */
  const settle = useRef({ timer: null, landing: false, again: false, eid: null, turn: 0 })
  useEffect(() => () => clearTimeout(settle.current.timer), [])
  const settleNow = async () => {
    if (settle.current.landing) {
      settle.current.again = true
      return
    }
    /* A drag let go while presses were still waiting lands for them too: one landing, not theirs after it. */
    clearTimeout(settle.current.timer)
    settle.current.timer = null
    settle.current.landing = true
    try {
      await land()
    } finally {
      settle.current.landing = false
      if (settle.current.again) {
        settle.current.again = false
        settleNow()
      }
    }
  }
  /*
   * The end of a drag lands the way a burst of presses does, and is marked
   * as landing while it does: a quick close and open during it used to show
   * the level the unit held when the open asked, under the one the thumb
   * had just left, and the landing then said nothing, because it only
   * speaks for the level on screen.
   */
  const landDrag = () => {
    settle.current.eid = live.current.eid
    settleNow()
  }
  const nudge = (direction) => {
    const { param: p, eid: block, present, onError: say } = live.current
    if (!p) return
    if (!Number.isInteger(block)) {
      noOutput(present, say)
      return
    }
    /* Never from a level that is not known: the rule steps an unknown level from the bottom of its range, which is the sound all but gone. */
    if (typeof level.current !== 'number') return
    const next = nudged(level.current, p, volumeNudge(p) * direction)
    show(next)
    writer.current.send(next)
    /*
     * SAVE IS TOLD AS THE LEVEL IS SENT, not only once it has been confirmed.
     * It is in the unit's edit buffer from the moment it goes, and the wait
     * to confirm it can be dropped: by another preset, and also by a preset
     * change that did not happen. The watch's Next puts the new number up
     * at once, and a unit that refuses it puts the old one back: the level
     * here is dropped and read again both times, the press's wait goes with
     * it, and the unit is left holding a level Save had never heard of.
     * Told here, it is told for the preset the press was made on.
     */
    noteEdited()
    clearTimeout(settle.current.timer)
    settle.current.eid = block
    settle.current.timer = setTimeout(settleNow, NUDGE_SETTLE_MS)
  }

  /*
   * THIS SCENE'S LEVEL: − and +, a whole dB a press (lib/sceneLevel), the
   * main level's rules. Each scene's level is its own setting, so each has
   * its own writer (one write on the wire, the newest press next, as the
   * main level's), and its own careful read-back once the presses on it
   * stop (NUDGE_SETTLE_MS), one at a time. A press is for the scene the row
   * names when it is pressed: the setting it writes names that scene, so a
   * footswitch to another scene after it does not move where it lands.
   * `turn` is counted up when the level goes (another preset or block, the
   * reset above), and a press made before is not confirmed after.
   */
  const sceneWriters = useRef(null)
  if (!sceneWriters.current) sceneWriters.current = new Map()
  const sceneWriter = (id) => {
    let w = sceneWriters.current.get(id)
    if (!w) {
      w = latestWriter(({ out, p, v }) => setParam(out, p.id, v, p))
      sceneWriters.current.set(id, w)
    }
    return w
  }
  /* `busy` is, by setting, the turn of the check that is out for it, if one is. */
  const sceneLanding = useRef({ timers: {}, busy: {}, again: {}, turn: 0 })
  useEffect(() => () => Object.values(sceneLanding.current.timers).forEach(clearTimeout), [])
  /*
   * A press on this setting is still waiting to be confirmed, or being
   * confirmed, on THIS preset: a read that comes back now does not put its
   * older level over it. A check still out from the last preset holds back
   * nothing of this one's (it held the new preset's level off the row).
   */
  const sceneSettling = (id) => sceneLanding.current.timers[id] !== undefined || sceneLanding.current.busy[id] === sceneLanding.current.turn
  const sceneLand = async (p, out, turn) => {
    const tell = live.current.onError
    const v = sceneAt.current[p.id]
    if (typeof v !== 'number') return
    const failed = await sceneWriter(p.id).settled()
    if (failed) tell?.(failed.message)
    if (sceneLanding.current.turn !== turn) return
    const res = await setParamConfirmed(out, p.id, v, p)
    noteEdited()
    /* The level went (another preset, another block), or a newer press is wanted: this one is not said. */
    if (sceneLanding.current.turn !== turn || sceneAt.current[p.id] !== v) return
    if (res.ok) return
    if (res.unverified) {
      tell?.(`Couldn’t check that scene ${p.index + 1}’s level took: the unit didn’t answer. It may have.`)
      return
    }
    const holding = typeof res.actual === 'number' ? res.actual : null
    if (holding !== null) showScene(p.id, holding)
    tell?.(
      holding === null
        ? `Scene ${p.index + 1}’s level didn’t take. You asked for ${volumeLabel(v, p)}.`
        : `Scene ${p.index + 1}’s level didn’t take. You asked for ${volumeLabel(v, p)}; the unit says ${volumeLabel(holding, p)}.`
    )
  }
  const sceneSettle = async (p, out, turn) => {
    const s = sceneLanding.current
    clearTimeout(s.timers[p.id])
    delete s.timers[p.id]
    if (s.busy[p.id] !== undefined) {
      s.again[p.id] = { p, out, turn }
      return
    }
    s.busy[p.id] = turn
    try {
      await sceneLand(p, out, turn)
    } catch (err) {
      live.current.onError?.(err.message)
    } finally {
      delete s.busy[p.id]
      const next = s.again[p.id]
      delete s.again[p.id]
      if (next && next.turn === s.turn) sceneSettle(next.p, next.out, next.turn)
    }
  }
  const sceneNudge = (direction) => {
    const { eid: out } = live.current
    const { open: here, scenes: list, index } = sceneLive.current
    /* Only where the switch opens it now (an account signed out with the pop-up open takes it with it), on a scene the unit has said, with a block to write to. */
    const p = here ? sceneLevelParam(list, index) : null
    if (!p || !Number.isInteger(out)) return
    /* Never from a level that is not known, and nothing past either end (sceneNudged). */
    const next = sceneNudged(sceneAt.current[p.id], p, direction)
    if (next === null) return
    showScene(p.id, next)
    sceneWriter(p.id).send({ out, p, v: next })
    /* Save is told as the level is sent, as the main level's press does. */
    noteEdited()
    const s = sceneLanding.current
    const turn = s.turn
    clearTimeout(s.timers[p.id])
    s.timers[p.id] = setTimeout(() => sceneSettle(p, out, turn), NUDGE_SETTLE_MS)
  }

  const pct = volumePercent(value, param)
  /* This scene's row: where the switch opens it, once the Output block has been read, on a scene the unit has said whose level the read named. */
  const sceneParam = levels === true ? sceneLevelParam(scenes, sceneIndex) : null
  const sceneRow = Number.isInteger(eid) && !reading && !!sceneParam
  const sceneName = sceneRow ? String(sceneNames?.[sceneParam.index] || '').trim() : ''
  /* Its margin from the phone's own down each side, where it has any (lib/screenShape clearSides: the Duo's strip), not from under it. */
  const sides = clearSides(insets, space.xl)
  const panel = Math.min(width0 - sides.paddingLeft - sides.paddingRight, 460)

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent supportedOrientations={ANY_WAY_UP}>
      <Pressable accessibilityRole="button" accessibilityLabel="Close the volume" onPress={onClose} style={{ flex: 1 }}>
        <BlurView
          intensity={70}
          tint="dark"
          experimentalBlurMethod="dimezisBlurView"
          /*
           * NEARLY SOLID BEHIND IT. "Overlay opacity is too low for me. Is
           * there a need to see things behind the tuner? Maybe 0% so the
           * tuner is focused?" There is no need: on an Android phone the blur
           * often draws as barely anything, and scene names showed through
           * the middle of the reading. The screen behind goes almost black.
           */
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            padding: space.xl,
            ...sides,
            backgroundColor: tint(color.chassis, 0.94)
          }}
        >
          {/*
            The panel swallows presses so a thumb that slips off the slider does
            not close the thing it is holding. Only the glass around it closes.
          */}
          <Pressable
            onPress={() => {}}
            style={{
              width: panel,
              gap: space.lg,
              paddingVertical: space.xl,
              paddingHorizontal: space.lg,
              borderRadius: radius.lg * 2,
              /* A pane of glass (lib/glass): the rim, the light along its top
                 and a soft shadow, on its own opaque panel. */
              borderWidth: 1,
              borderColor: paneRim(),
              boxShadow: color.glassLift,
              backgroundColor: color.panel
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
              <Text style={{ color: color.silkFaint, fontSize: font.micro, letterSpacing: 1.5 }}>VOLUME</Text>
              <Text style={{ color: color.silk, fontSize: font.hero, fontFamily: face }}>
                {param ? volumeLabel(value, param) : '—'}
              </Text>
            </View>

            {/* No slider at all on a unit whose output block has no level this
                app can move — a control that can only disappoint is worse than
                none. The panel still opens and says so. */}
            {/* Every open, not only the first: the level on screen from last
                time may be another preset's, and a press worked out from it —
                or an answer landing after one — would put the wrong level on
                the unit. */}
            {Number.isInteger(eid) && reading ? (
              <Note>Reading the level…</Note>
            ) : !Number.isInteger(eid) || !param ? (
              <Note tone="warn">
                This unit’s output block has no level this app can move. Use the knob on the unit.
              </Note>
            ) : (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
        <Press
          label="−"
          height={TAP}
          style={{ width: TAP, borderRadius: TAP / 2 }}
          accessibilityLabel="Volume down"
          onPress={() => nudge(-1)}
        />

        {/*
          AN iOS SLIDER. "Make the volume slider more iOS type looking, where
          it's more like a pill shaped with rounded edges." A thin rounded
          track, amber up to the level, and a round white knob, the way the
          iPhone's own sliders are drawn and the way the browser's already
          was. The whole 44pt row is still the thing a thumb grabs; only the
          drawing got thinner. The knob's half-width is padding either side,
          so at the ends it sits on the track rather than off it.
        */}
        <View
          {...pan.panHandlers}
          accessibilityRole="adjustable"
          accessibilityLabel="Volume"
          accessibilityValue={{ min: param.min, max: param.max, now: value, text: volumeLabel(value, param) }}
          accessibilityActions={ROTOR}
          onAccessibilityAction={(e) => nudge(e.nativeEvent.actionName === 'increment' ? 1 : -1)}
          style={{ flex: 1, height: TAP, justifyContent: 'center', paddingHorizontal: KNOB / 2 }}
        >
          <View
            pointerEvents="none"
            onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
            style={{ height: TRACK, borderRadius: TRACK / 2, backgroundColor: tint(color.silk, 0.22) }}
          >
            <View
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                bottom: 0,
                width: `${pct}%`,
                borderRadius: TRACK / 2,
                backgroundColor: color.signal
              }}
            />
            <View
              style={{
                position: 'absolute',
                left: `${pct}%`,
                top: TRACK / 2 - KNOB / 2,
                width: KNOB,
                height: KNOB,
                marginLeft: -KNOB / 2,
                borderRadius: KNOB / 2,
                backgroundColor: '#ffffff',
                transform: [{ scale: dragging ? 1.12 : 1 }],
                shadowColor: '#000',
                shadowOpacity: 0.35,
                shadowRadius: 4,
                shadowOffset: { width: 0, height: 2 },
                elevation: 4
              }}
            />
          </View>
        </View>

        <Press
          label="+"
          height={TAP}
          style={{ width: TAP, borderRadius: TAP / 2 }}
          accessibilityLabel="Volume up"
          onPress={() => nudge(1)}
        />
      </View>
            )}

            {/*
              THIS SCENE'S LEVEL (lib/sceneLevel), under the preset's own, for
              an account the switch opens: the level of the scene the unit is
              on, with − and + a whole dB at a time. Presses only: nothing here
              is dragged, so it needs no room of its own from a scroll view.
            */}
            {sceneRow ? (
              <View style={{ gap: space.xs }}>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
                  <Text style={{ color: color.silkFaint, fontSize: font.micro, letterSpacing: 1.5 }}>THIS SCENE</Text>
                  <Text numberOfLines={1} style={{ flexShrink: 1, color: color.silkFaint, fontSize: font.micro }}>
                    {sceneName ? `Scene ${sceneParam.index + 1} · ${sceneName}` : `Scene ${sceneParam.index + 1}`}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                  <Press
                    label="−"
                    height={TAP}
                    style={{ width: TAP, borderRadius: TAP / 2 }}
                    accessibilityLabel={`Scene ${sceneParam.index + 1} level down`}
                    onPress={() => sceneNudge(-1)}
                  />
                  <Text
                    accessibilityLabel={`Scene ${sceneParam.index + 1} level`}
                    style={{ flex: 1, textAlign: 'center', color: color.silk, fontSize: font.title, fontFamily: face }}
                  >
                    {volumeLabel(sceneShown[sceneParam.id], sceneParam)}
                  </Text>
                  <Press
                    label="+"
                    height={TAP}
                    style={{ width: TAP, borderRadius: TAP / 2 }}
                    accessibilityLabel={`Scene ${sceneParam.index + 1} level up`}
                    onPress={() => sceneNudge(1)}
                  />
                </View>
              </View>
            ) : null}

            {/* "Make it so the metronome can be turned on and off in the volume
                section of the app." Outside the level's own reading and no-level
                notes: a unit with no level to move can still click. */}
            {/*
              ITS OWN SCROLLING, AND ONLY ITS OWN. The pop-up has no scroll
              view round it, and must not: the slider above is dragged
              sideways, and a scroll view under a drag is the fight this
              pop-up was made to end. But the metronome's part grew a row of
              sounds and the flash's switch, with a line under them that runs
              to five on a narrow phone over Bluetooth, and the panel is
              centred: too tall, and Done went off the bottom with no way to
              reach it. So this part alone scrolls, in what the window leaves
              once everything round it is drawn (metronomeRoom). The slider is
              not inside it, and where it all fits nothing moves.
            */}
            <ScrollView
              style={{ flexGrow: 0, maxHeight: metronomeRoom(height0, insets, sceneRow) }}
              alwaysBounceVertical={false}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator
            >
              <MetronomeSwitch />
            </ScrollView>

            <Press label="Done" height={TAP} tone="signal" onPress={onClose} />
            <Text style={{ color: color.silkFaint, fontSize: font.micro, textAlign: 'center' }}>
              Tap outside to close
            </Text>
          </Pressable>
        </BlurView>
      </Pressable>
    </Modal>
  )
}

/* The slider's drawing: the track's thickness and the knob's size. */
const TRACK = 6
const KNOB = 28

/*
 * How tall the metronome's part may be: the window, less the screen's own
 * edges, less everything drawn round it. That is the glass's padding and the
 * panel's (space.xl each, top and bottom), the four gaps between the panel's
 * five parts, the VOLUME row with its big number, the slider's row, Done, and
 * the line under it. Never under the switch and one line of words, so on a
 * window with no room at all the switch is still whole.
 */
const VOLUME_ROW = 44
const CLOSE_LINE = 16
const AROUND_METRONOME = 4 * space.xl + 4 * space.lg + VOLUME_ROW + 2 * TAP + CLOSE_LINE
/* This scene's row, where it is drawn (`scene`): its gap, its heading's line, its gap and its buttons. */
const SCENE_ROW = space.lg + CLOSE_LINE + space.xs + TAP
const LEAST_METRONOME = TAP + 2 * space.xl
const metronomeRoom = (height, insets, scene = false) => Math.max(LEAST_METRONOME, height - (insets?.top || 0) - (insets?.bottom || 0) - AROUND_METRONOME - (scene ? SCENE_ROW : 0))

/** What VoiceOver's rotor offers on the slider. */
const ROTOR = [{ name: 'increment' }, { name: 'decrement' }]

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))

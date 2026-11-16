import { useEffect, useRef, useState } from 'react'
import { Modal, PanResponder, Platform, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native'
import { BlurView } from 'expo-blur'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { color, font, mono, radius, space, TAP } from '../lib/theme'
import { paneRim } from '../lib/glass'
import { ANY_WAY_UP, clearSides } from '../lib/screenShape'
import Note from './Note'
import { blockParams, idOf, setParam, setParamConfirmed } from '../lib/device'
import { noteEdited } from '../lib/rig'
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

export default function Volume({ blocks, open, onClose, onError }) {
  const output = (blocks || []).find((b) => b.slug === 'output')
  const eid = idOf(output)

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
  useEffect(() => {
    live.current = { param, width, eid, present: !!output, onError }
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
  /* Another preset's Output block is another level: not shown as this one's
     while this one is read. */
  useEffect(() => {
    setParamState(null)
    show(null)
  }, [eid])
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
        /* A press still settling from before a quick close and open is newer
           than this answer, which was asked before it landed. */
        if (!settle.current.timer && !settle.current.landing) show(found ? found.value : null)
      } catch (err) {
        if (!stop) onError?.(err.message)
      } finally {
        if (!stop) setReading(false)
      }
    })()
    return () => {
      stop = true
    }
  }, [open, eid, onError])

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
        if (!p || !w) return
        const span = p.max - p.min
        const next = clamp(from.current + (gesture.dx / w) * span, p.min, p.max)
        const rounded = Math.round(next * 100) / 100
        /* Drawn, and kept where the landing reads it: the thumb can come off before the screen has drawn this value. */
        show(rounded)
        writer.current.send(rounded)
      },
      onPanResponderRelease: () => {
        setDragging(false)
        land()
      },
      onPanResponderTerminate: () => {
        setDragging(false)
        land()
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
    try {
      const failed = await writer.current.settled()
      if (failed) say?.(failed.message)
      const res = await setParamConfirmed(block, p.id, v, p)
      /* The level is a parameter like any other, so the Save button should
         know about it — see rig.noteEdited. */
      noteEdited()
      /* A newer value arrived while this one was being checked: its own
         check follows, and a miss against a value nobody wants any more is
         not a miss. */
      if (level.current !== v) return
      if (!res.ok) {
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
  const settle = useRef({ timer: null, landing: false, again: false })
  useEffect(() => () => clearTimeout(settle.current.timer), [])
  const settleNow = async () => {
    if (settle.current.landing) {
      settle.current.again = true
      return
    }
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
  const nudge = (direction) => {
    const { param: p, eid: block, present, onError: say } = live.current
    if (!p) return
    if (!Number.isInteger(block)) {
      noOutput(present, say)
      return
    }
    const next = nudged(level.current, p, volumeNudge(p) * direction)
    show(next)
    writer.current.send(next)
    clearTimeout(settle.current.timer)
    settle.current.timer = setTimeout(settleNow, NUDGE_SETTLE_MS)
  }

  const pct = volumePercent(value, param)
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
              style={{ flexGrow: 0, maxHeight: metronomeRoom(height0, insets) }}
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
const LEAST_METRONOME = TAP + 2 * space.xl
const metronomeRoom = (height, insets) => Math.max(LEAST_METRONOME, height - (insets?.top || 0) - (insets?.bottom || 0) - AROUND_METRONOME)

/** What VoiceOver's rotor offers on the slider. */
const ROTOR = [{ name: 'increment' }, { name: 'decrement' }]

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))

import { useEffect, useRef, useState } from 'react'
import { setTempo } from '../lib/forgefx'
import { useDevice, refreshTempo, getSnapshot, chainNumberOf } from '../lib/deviceState'
import { keepTaps, tappedBpm, tempoSender, TAP_REREAD_MS } from '../../shared/tempo.mjs'
import { tick as haptic } from '../lib/feedback'
import { useLongPress } from '../lib/longPress'
import { useDismiss } from '../lib/dismiss'
import BpmBox from './BpmBox'

/* Hoisted: a selector rebuilt each render re-reads the store on every notify. */
const ofBpm = (s) => s.bpm

/**
 * Tap tempo: tap for the tempo, hold (or right-click) to type one.
 *
 * One button, in two places. It lived inside Play and nowhere else, because
 * the Edit screen's tempo went when Home and Controls were merged — and then
 * the tester, deep in a delay block on Edit: "There's no tempo control on the
 * Edit screen." Setting the time of a delay is exactly when you want it. So
 * this is Play's own button lifted out whole, and both screens draw it: two
 * copies would be two ideas of how a tap turns into a tempo, and the whole
 * history below is about getting that ONE idea right.
 *
 * `where` is only the dress: 'bar' is Play's bottom bar, where the box opens
 * upward off a bar stuck to the foot of the screen; 'row' is a chip in Edit's
 * row beside the scene, near the top, where it opens downward instead.
 *
 * `onChanged` hears about a tempo that was set, typed or tapped. A tapped one
 * counts as a change to the preset as much as a typed one does — the phone
 * has always said so — so it is reported once per burst of taps rather than
 * once per tap: one line in the history for "I tapped it in", not eight.
 */
export default function TapTempo({ onError, onChanged, where = 'bar' }) {
  const bpm = useDevice(ofBpm)
  /* The preset being loaded, or loaded: see the burst below. */
  const going = useDevice(chainNumberOf)
  /* The latest, for a report sent after this has gone — see the unmount below. */
  const said = useRef(onChanged)
  said.current = onChanged

  /*
   * Tap tempo, which had no button anywhere.
   *
   * forgefx.js has carried tapTempo() the whole time and nothing called it —
   * so the one control on the stage screen a player uses WHILE PLAYING, in
   * time, was the one control that did not exist. On Play it sits in the bar
   * at the bottom next to the tuner: the two things you reach for between
   * songs rather than inside one, and the two that were competing with the
   * scenes for the middle of the screen.
   */
  const reread = useRef(null)
  const taps = useRef([])
  /* The number this burst of taps last sent, until it has been reported. */
  const burst = useRef(null)
  /*
   * The preset the burst was tapped on.
   *
   * The report waits for the burst to settle, nearly a second after the last
   * tap. Tap, then pick the next song inside that second, and it landed on
   * the NEW song: "Tempo → 132 BPM (tapped)" against a preset nobody had
   * touched, and Save lit on it. That tempo went with the song that was left.
   * Held as chainNumberOf, not preset.number: the number moves only after
   * the switch has already cleared Unsaved.
   */
  const burstOn = useRef(null)
  /* The last number of this burst the unit actually took. A write it refused
     (port shut, unit gone) changed nothing, and the banner already said so. */
  const landed = useRef(null)
  /* Closed while a write was still on its way: report when it lands. */
  const closing = useRef(false)
  const dropBurst = () => {
    burst.current = null
    landed.current = null
    closing.current = false
  }
  /*
   * What the taps mean, shown while they are still happening.
   *
   * "It should change the tempo based on the tap and change the number
   * immediately and then read the device and then change it if it needs to
   * after that … right now it takes a few seconds after doing the tap, so you
   * can't even tell the tempo you're tapping at."
   *
   * The number used to come only from the unit, and the unit can only be asked
   * once tapping stops — see TAP_REREAD_MS — so it lagged the last press by
   * nearly a second. That defeats what tapping is FOR: you tap to find a
   * tempo, and a tempo you cannot see while tapping is one you cannot aim.
   *
   * So this is shown the instant it can be worked out, and the unit's own
   * answer replaces it when it arrives. Cleared there rather than on a timer,
   * so the two never both hold a figure.
   */
  const [tapped, setTapped] = useState(null)
  /*
   * The number goes to the unit; the taps never leave this machine.
   *
   * "Right now after I tap it a few times slowly, it'll send a number and
   * then I'm done tapping and it sends back a different one."
   *
   * Because the taps themselves were being forwarded, one POST per press, and
   * the unit worked the tempo out from the spacing between them AS THEY
   * ARRIVED — which is the thumb's spacing plus whatever the wifi, the relay
   * and the computer's queue added to each one, differently each time. The
   * unit then reported, correctly, the tempo of what it had actually heard.
   * See the note at the top of shared/tempo.mjs.
   *
   * Nothing at the far end could fix that: the timing is destroyed on the
   * way. So the gaps are measured here and what crosses the network is the
   * NUMBER — the same call a typed tempo makes.
   */
  const sender = useRef(null)
  if (!sender.current) {
    sender.current = tempoSender(
      async (bpm) => {
        try {
          await setTempo(bpm)
          landed.current = bpm
        } finally {
          /* After the sender has noted this one as done, not inside it. */
          if (closing.current) setTimeout(() => reportBurst(), 0)
        }
      },
      (err) => onError(err.message)
    )
  }

  /** Tell the screen a burst of taps changed the preset, once, if one did. */
  const reportBurst = () => {
    if (burst.current == null) return
    /* A hold, or the screen going, while the last number is still on its way. */
    if (!sender.current.idle) {
      closing.current = true
      return
    }
    const got = landed.current
    const on = burstOn.current
    dropBurst()
    /* Only what reached the unit, and only on the preset it was tapped on. */
    if (got == null) return
    if (chainNumberOf(getSnapshot()) !== on) return
    const n = Math.round(got)
    said.current?.(`Tempo → ${n} BPM (tapped)`)
  }

  /* Another preset: the unit threw the tapped tempo away with the last one,
     so there is nothing left to report, and the old figure comes off. */
  useEffect(() => {
    dropBurst()
    setTapped(null)
  }, [going])

  const tap = async () => {
    /*
     * The number goes NOW; the read-back waits for the burst to end.
     *
     * The read still cannot follow each press — it would answer about the
     * number sent one tap ago — but it can no longer surprise anybody, which
     * was the complaint. The unit is told 132 rather than asked to work
     * something out, so 132 is what it says.
     */
    clearTimeout(reread.current)
    haptic()
    taps.current = keepTaps(taps.current, Date.now())
    const guess = tappedBpm(taps.current)
    if (guess != null) {
      setTapped(guess)
      if (burst.current == null) {
        dropBurst()
        burstOn.current = chainNumberOf(getSnapshot())
      }
      sender.current.push(guess)
      burst.current = guess
    }
    reread.current = setTimeout(async () => {
      /* Never read over a write still in the air: that read answers with the
         tempo from before it. */
      if (!sender.current.idle) {
        reread.current = setTimeout(() => tapSettled(), TAP_REREAD_MS)
        return
      }
      await tapSettled()
    }, TAP_REREAD_MS)
  }

  /** Confirm what the unit ended up on, and stop showing our own arithmetic. */
  const tapSettled = async () => {
    await refreshTempo()
    setTapped(null)
    reportBurst()
  }

  /* A pending read on a screen that has gone is a write into nothing. */
  useEffect(() => () => clearTimeout(reread.current), [])
  /* But the tempo it sent did land. Switching from Edit to Play inside the
     second after the last tap unmounts this before the read-back — and the
     change still has to leave Save showing. */
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => () => reportBurst(), [])

  /* Read aloud, the face is "Tap 120" — which is a tempo, not an instruction.
     The label says what the button does and what the number means. */
  const tapLabel = Number.isFinite(bpm)
    ? `Tap tempo — currently ${Math.round(bpm)} BPM. Hold to type a tempo.`
    : 'Tap tempo. Hold to type a tempo.'

  /*
   * Hold Tap, or right-click it, to type the tempo.
   *
   * "On the tap button, let's do where they hold the tap button they can
   * manually enter in the beats per minute they want. On the Mac let them
   * right click to pull up the text box to enter the BPM."
   *
   * Tapping gets you close; a song chart says 132. The same hold-or-right-click
   * the block tiles use opens a box over the button with the current tempo
   * selected, so typing replaces it; Enter sets it, Escape or a tap elsewhere
   * leaves it alone. The tap that would have followed the hold is swallowed by
   * useLongPress, so holding never sends a stray beat.
   */
  const [typing, setTyping] = useState(false)
  const tapCell = useRef(null)
  const holdTap = useLongPress(() => {
    haptic()
    /* The re-read is left running: it is what puts the unit's own number
       back on the button. Cancelled here, the tapped figure stayed on it over
       a tempo typed straight after. */
    setTyping(true)
    /* Reported now; the re-read then finds nothing left to report. */
    reportBurst()
  })
  useDismiss(tapCell, () => setTyping(false), { open: typing })
  const typeTempo = async (n) => {
    try {
      await setTempo(n)
      await refreshTempo()
      /* A typed tempo takes the face over from any tapped one. */
      setTapped(null)
      onChanged?.(`Tempo → ${n} BPM`)
    } catch (err) {
      onError(err.message)
    }
  }

  /*
   * The tempo lives on the button that sets it.
   *
   * A tap button with no readout is a control you have to trust: you tap
   * four times and find out whether it took by listening to the delay. The
   * figure is what the unit currently holds, so it is also the answer to
   * "what is this preset at" without opening anything.
   *
   * Absent until the unit has said — a dash would read as zero, and a
   * unit whose driver has no tempo at all should not be shown one.
   */
  return (
    <div className={`gig-tap-cell ${where === 'row' ? 'tap-row' : ''}`} ref={tapCell}>
      <button
        className={`${where === 'row' ? 'chip' : 'gig-bar-btn'} gig-tap`}
        onClick={tap}
        aria-label={tapLabel}
        {...holdTap}
      >
        {/* "Change the label on the tap tempo button to just say Tap." */}
        <span>Tap</span>
        {/* "A green light dot ... that flashes at the current tempo." The
            unit's Tap LED, on the button. Only with a tempo from the unit. */}
        {Number.isFinite(bpm) && bpm >= 20 && bpm <= 400 ? (
          <span className="tap-dot" aria-hidden="true" style={{ '--beat': `${60 / bpm}s` }} />
        ) : null}
        {Number.isFinite(tapped ?? bpm) ? (
          <span className="gig-tap-bpm mono">{Math.round(tapped ?? bpm)}</span>
        ) : null}
      </button>
      {typing ? (
        <div className="gig-tempo" role="group" aria-label="Type a tempo">
          <span className="silk-label">Tempo</span>
          <BpmBox bpm={bpm} autoFocus onSet={typeTempo} onError={onError} onDone={() => setTyping(false)} />
          <span className="hint">Enter sets it</span>
        </div>
      ) : null}
    </div>
  )
}

import { useEffect, useMemo, useRef, useState } from 'react'
import { AccessibilityInfo, ActivityIndicator, Image, Pressable, Text, TextInput, View } from 'react-native'

import { color, font, radius, space, TAP } from '../lib/theme'
import { blockCatalog, clearCell, gridCells, placeBlock, setCable } from '../lib/device'
import { beginChainWrite, endChainWrite, followPresetAfterChainWrite, getState, refreshBlocks, unitOnPreset, useRig } from '../lib/rig'
import { logDebug } from '../lib/debugLog'
import { gridShape } from '../lib/grid-plan'
import { UNDO_STALE, runPlan, stepWords } from '../lib/split-chain'
import { blockColor } from '../lib/blockColors'
import { blockIconOwn } from '../lib/blockIcons'
import { shortName } from '../lib/shortName'
import { ownCellNameHere, ownPaletteHere } from '../lib/ownBlocksHere'
import { NAME_PRESET, NAME_PRESET_SUB, takeQuickBuildAsk } from '../lib/quickBuild'
import { addStarterHere, adoptUnlinkedHere, keepPaletteHere, roomForStarterHere, useStarterChains } from '../lib/starterChainsHere'
import {
  BACK_TO_PLAY,
  BLOCKS_HEAD,
  BLOCKS_NOT_READ,
  BUILDING,
  UNDO_BUSY,
  CANCEL_BUTTON,
  CHAIN_NONE_YET,
  CHECKING_EMPTY,
  DEFAULT_BADGE,
  EMPTY_LINE,
  FROM_A_CHAIN,
  JOINING,
  KEEP_BUTTON,
  KEEP_OPEN,
  KEEP_STARTER,
  KEEP_STARTER_SUB,
  MAKE_YOUR_OWN,
  MORE_CHIP,
  NAME_LABEL,
  NOTHING_SAVED,
  NOTHING_SAVED_ON_UNIT,
  QUICK_BUILD_HOW,
  QUICK_BUILD_SUB,
  QUICK_BUILD_TITLE,
  READING_BACK,
  READING_BLOCKS,
  PRESET_MOVED,
  PRESET_MOVED_AFTER,
  PRESET_MOVED_BEFORE,
  READ_FAILED,
  SAVE_PRESET,
  STARTERS_FULL,
  STARTER_NAME_MAX,
  TAKES_LONG,
  TRY_AGAIN,
  UNDOING,
  UNDO_MOVED_AFTER,
  UNIT_QUIET,
  UNIT_QUIET_BEFORE,
  UNDO_LABEL,
  YOUR_CHAIN,
  buildBlocked,
  buildLabel,
  buildPanel,
  buildRoom,
  chainFull,
  chipsFor,
  familyName,
  keptLine,
  leftLine,
  missingLine,
  pickToggled,
  placingLine,
  UNDO_NOT_READ,
  planBuild,
  resolveChain,
  rowAsRead,
  stillIn,
  stoppedLine,
  undoMissedLine,
  undoNotJoinedLine,
  undoStale,
  undoSteps,
  undoSub,
  undoUnjoined,
  undoWiringLeftLine,
  undoneLine,
  whatLanded
} from '../lib/starter-chains'
import Note from './Note'
import Press from './Press'
import Sheet from './Sheet'

/*
 * QUICK BUILD, ON AN EMPTY PRESET (shared/starter-chains.mjs has the rules,
 * the words and the plan; lib/quickBuild the door).
 *
 * "Let's also look into building out a way to build a preset quickly from an
 * empty preset." The four pictures he passed on 15 November 2026 are what
 * this draws: on the empty preset, Quick build and the starter chains (1);
 * the sheet where blocks are tapped in order (2); what it says afterwards,
 * with one Undo (3). Settings → Starter chains (4) is
 * components/StarterChains, with this file's picker.
 *
 * THE UNIT IS ASKED ONLY THROUGH FIVE CALLS of lib/device: blockCatalog
 * (what it has), gridCells (what is in the grid, read fresh before and
 * after), and placeBlock, clearCell and setCable, run by split-chain's
 * runPlan. Nothing here asks which wire is under them, so a Bluetooth wire
 * that answers the same routes needs nothing changed here (lib/quickBuild).
 *
 * Every write is wrapped as the chain editor's are (components/ChainUndo):
 * beginChainWrite, the steps, endChainWrite with no refresh of its own, then
 * the rig's quiet read, so the screen and the unit agree before anything is
 * said. Every step is in the log.
 */

const ofNumber = () => getState().preset?.number ?? null
/* The unit's own name, as the rig keeps it from the detect answer (as Settings → Starter chains reads it): the capabilities carry none, over Bluetooth or through the computer. */
const ofDeviceName = (s) => s.deviceName

/** One block of a chain, as a small tile in the app's block colors with its short name (NAM's own picture beside it). */
export function BlockPill({ family, label = null }) {
  const hue = blockColor(family)
  const own = blockIconOwn(family)
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        minHeight: 32,
        paddingHorizontal: space.sm,
        borderRadius: radius.md,
        backgroundColor: hue.fill
      }}
    >
      {own ? <Image source={own} style={{ width: 16, height: 16 }} resizeMode="contain" /> : null}
      <Text style={{ color: hue.ink, fontSize: font.small, fontWeight: '700' }}>{label || shortName(family)}</Text>
    </View>
  )
}

/** A chain, in order, with a small arrow between each block. */
export function ChainStrip({ blocks, empty = null }) {
  const list = Array.isArray(blocks) ? blocks : []
  if (!list.length) return empty ? <Text style={{ color: color.silkDim, fontSize: font.small }}>{empty}</Text> : null
  const seen = new Map()
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
      {list.map((family, i) => {
        const nth = (seen.get(family) || 0) + 1
        seen.set(family, nth)
        return (
          <View key={`${family}:${i}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <BlockPill family={family} label={nth > 1 ? `${shortName(family)} ${nth}` : null} />
            {i < list.length - 1 ? <Text style={{ color: color.silkFaint, fontSize: font.small }}>›</Text> : null}
          </View>
        )
      })}
    </View>
  )
}

/** A small uppercase heading, as Edit's own. */
export function Heading({ children }) {
  return (
    <Text accessibilityRole="header" style={{ color: color.silkFaint, fontSize: font.micro, letterSpacing: 1.5, textTransform: 'uppercase' }}>
      {children}
    </Text>
  )
}

/** One chip: its place number when picked, outlined; quiet when the chain is full. */
function Chip({ chip, quiet, onPress }) {
  const picked = chip.place !== null
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: picked, disabled: quiet && !picked }}
      accessibilityLabel={picked ? `${chip.label}, number ${chip.place} in the chain` : chip.label}
      accessibilityHint={picked ? 'Takes it out of the chain' : 'Adds it to the end of the chain'}
      disabled={quiet && !picked}
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        minHeight: 44,
        paddingHorizontal: space.md,
        borderRadius: radius.pill,
        borderWidth: picked ? 2 : 1,
        borderColor: picked ? color.signal : color.rule,
        opacity: quiet && !picked ? 0.4 : 1
      }}
    >
      {picked ? (
        <View style={{ minWidth: 20, height: 20, borderRadius: 10, backgroundColor: color.signal, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: color.onSignal, fontSize: font.micro, fontWeight: '700' }}>{chip.place}</Text>
        </View>
      ) : null}
      <Text style={{ color: picked ? color.signal : color.silk, fontSize: font.body, fontWeight: picked ? '700' : '400' }}>{chip.label}</Text>
    </Pressable>
  )
}

/**
 * THE PICKER (mock-up 2): YOUR CHAIN in order, and the unit's blocks as
 * chips, the common ones first and the rest behind More…. `room` caps the
 * count (the free cells, four on an AM4): past it the chips go quiet.
 * `hidden` while a build runs: no chip can be tapped then, and the picker
 * stays as it was (More… open, if it was) for a build that fails.
 */
export function ChainPicker({ palette, picks, onPicks, room = Infinity, linear = false, fullLine = null, hidden = false }) {
  const [more, setMore] = useState(false)
  const chips = useMemo(() => chipsFor(palette, picks), [palette, picks])
  const full = picks.length >= room
  const common = chips.filter((c) => c.common)
  const rest = chips.filter((c) => !c.common)
  const tap = (c) => onPicks(pickToggled(picks, c.family, c.nth, room))
  return (
    <View style={hidden ? { display: 'none' } : { gap: space.md }}>
      <Text style={{ color: color.silkDim, fontSize: font.body }}>{QUICK_BUILD_HOW}</Text>
      <Heading>{YOUR_CHAIN}</Heading>
      <ChainStrip blocks={picks} empty={CHAIN_NONE_YET} />
      <Heading>{BLOCKS_HEAD}</Heading>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
        {common.map((c) => (
          <Chip key={`${c.family}#${c.nth}`} chip={c} quiet={full} onPress={() => tap(c)} />
        ))}
        {rest.length && !more ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="More blocks"
            onPress={() => setMore(true)}
            style={{ minHeight: 44, paddingHorizontal: space.md, borderRadius: radius.pill, borderWidth: 1, borderColor: color.rule, justifyContent: 'center' }}
          >
            <Text style={{ color: color.silkDim, fontSize: font.body }}>{MORE_CHIP}</Text>
          </Pressable>
        ) : null}
        {more
          ? rest.map((c) => (
              <Chip key={`${c.family}#${c.nth}`} chip={c} quiet={full} onPress={() => tap(c)} />
            ))
          : null}
      </View>
      {full && Number.isFinite(room) ? <Text style={{ color: color.silkDim, fontSize: font.small }}>{fullLine || chainFull(room, linear)}</Text> : null}
    </View>
  )
}

/** The box a starter chain's name is typed in, with its Keep and Cancel. */
export function NameRow({ name, onName, onKeep, onCancel, keepLabel = KEEP_BUTTON, problem = null }) {
  return (
    <View style={{ gap: space.sm }}>
      <TextInput
        value={name}
        onChangeText={onName}
        placeholder={NAME_LABEL}
        placeholderTextColor={color.silkFaint}
        accessibilityLabel={NAME_LABEL}
        maxLength={STARTER_NAME_MAX}
        returnKeyType="done"
        onSubmitEditing={onKeep}
        style={{
          minHeight: TAP,
          backgroundColor: color.chassis,
          borderWidth: 1,
          borderColor: color.live,
          borderRadius: radius.md,
          paddingHorizontal: space.md,
          color: color.silk,
          fontSize: font.lead
        }}
      />
      {problem ? <Text style={{ color: color.fault, fontSize: font.small }}>{problem}</Text> : null}
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        {onCancel ? <Press grow label={CANCEL_BUTTON} onPress={onCancel} /> : null}
        <Press grow label={keepLabel} tone="signal" on onPress={onKeep} />
      </View>
    </View>
  )
}

/** The result card: green when it all went in, amber when something did not, red when nothing did. */
function ResultCard({ tone, title, text }) {
  const edge = tone === 'ok' ? color.ok : tone === 'warn' ? color.signal : color.fault
  const wash = tone === 'ok' ? color.okHalo : tone === 'warn' ? color.signalWash : color.faultHalo
  return (
    <View accessibilityLiveRegion="polite" style={{ gap: 4, padding: space.md, borderRadius: radius.md, borderWidth: 1, borderColor: edge, backgroundColor: wash }}>
      <Text style={{ color: edge, fontSize: font.lead, fontWeight: '700' }}>{tone === 'ok' ? `✓ ${title}` : title}</Text>
      <Text style={{ color: color.silk, fontSize: font.body }}>{text}</Text>
    </View>
  )
}

/**
 * THE CARD WHILE A BUILD OR AN UNDO RUNS (shared/starter-chains buildPanel):
 * its three steps, the one going with a turning circle (React Native's own,
 * drawn by the phone, so it turns while the app is busy taking in the
 * preset), a tick on each done, and a bar where how far it has got is known:
 * the preset's bytes as they come down an adapter, and the steps sent.
 */
function BuildProgress({ stage, line, unit, takesLong }) {
  const panel = buildPanel({ kind: stage.kind, step: stage.step, got: stage.got, of: stage.of, line, unit })
  const now = panel.rows.find((r) => r.state === 'now')
  /* A screen reader is told each step as it starts (VoiceOver has no live regions). */
  const told = useRef(null)
  useEffect(() => {
    const key = `${stage.kind}:${stage.step}`
    if (!now || told.current === key) return
    told.current = key
    AccessibilityInfo.announceForAccessibility?.(now.label)
  }, [stage.kind, stage.step, now])
  return (
    <View style={{ gap: space.sm, padding: space.md, borderRadius: radius.md, borderWidth: 1, borderColor: color.rule, backgroundColor: color.panel }}>
      {panel.rows.map((r) => (
        <View key={r.n} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space.sm }}>
          <View style={{ width: 24, minHeight: 22, alignItems: 'center', justifyContent: 'center' }}>
            {r.state === 'now' ? (
              <ActivityIndicator size="small" color={color.signal} />
            ) : r.state === 'done' ? (
              <Text style={{ color: color.ok, fontSize: font.body, fontWeight: '700' }}>✓</Text>
            ) : (
              <Text style={{ color: color.silkFaint, fontSize: font.body }}>{r.n}</Text>
            )}
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={{ color: r.state === 'next' ? color.silkFaint : color.silk, fontSize: font.body, fontWeight: r.state === 'now' ? '700' : '400' }}>{r.label}</Text>
            {r.state === 'now' && panel.line ? (
              <Text accessibilityLiveRegion="polite" style={{ color: color.silkDim, fontSize: font.small }}>
                {panel.line}
              </Text>
            ) : null}
            {r.state === 'now' && panel.percent !== null ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                <View
                  accessibilityRole="progressbar"
                  accessibilityValue={{ min: 0, max: 100, now: panel.percent }}
                  style={{ flex: 1, height: 6, borderRadius: 3, overflow: 'hidden', backgroundColor: color.rule }}
                >
                  <View style={{ width: `${panel.percent}%`, height: 6, backgroundColor: color.signal }} />
                </View>
                <Text style={{ color: color.silkDim, fontSize: font.small, fontVariant: ['tabular-nums'] }}>{panel.tally}</Text>
              </View>
            ) : null}
          </View>
        </View>
      ))}
      {takesLong ? (
        <>
          <Text style={{ color: color.silkDim, fontSize: font.small }}>{TAKES_LONG}</Text>
          <Text style={{ color: color.silkDim, fontSize: font.small }}>{KEEP_OPEN}</Text>
        </>
      ) : null}
    </View>
  )
}

/** What a chain asks for that this palette cannot give, and what the picker starts with. */
const startFrom = (blocks, palette, room) => {
  const { picks, missing } = resolveChain(blocks, palette)
  const families = picks.map((p) => p.family)
  return { picks: families.slice(0, room), missing: missing.map((m) => m.name), left: families.slice(room).map((f) => familyName(f)) }
}

/**
 * Quick build on Edit. `bare` is Edit's own answer that the chain read holds
 * nothing but the ends (shared isBareChain); the sheet stays open past it,
 * since the build is what ends it. `chain` is the chain read, for the room
 * the row has before the grid is read; `pending` is Edit's own "there is
 * something to save here", which is where Save is offered; `saves` whether
 * the app has a Save at all on this connection (over Bluetooth it may not),
 * so the line under the sheet never points at a button that is not there.
 * `takesLong` where reading the chain takes half a minute (Edit's word,
 * lib/bleSwitch gridReadTakesLong: this file never asks which wire it is
 * on), so it is said before the tap and under the card.
 */
export default function QuickBuild({ bare, caps, chain, pending = false, saves = true, takesLong = false, onSave, onPlay, onRename = null }) {
  const starters = useStarterChains()
  const unitName = useRig(ofDeviceName)
  const [palette, setPalette] = useState(null)
  const [open, setOpen] = useState(false)
  const [picks, setPicks] = useState([])
  const [said, setSaid] = useState(null)
  const [busy, setBusy] = useState(null)
  const [done, setDone] = useState(null)
  const [undoSaid, setUndoSaid] = useState(null)
  const [naming, setNaming] = useState(false)
  const [name, setName] = useState('')
  const [kept, setKept] = useState(null)
  /* Where a build or an Undo has got, for its card: { kind, step, got, of } (BuildProgress). Gone wherever the run ends, which is wherever `busy` is let go of. */
  const [stage, setStage] = useState(null)
  const alive = useRef(true)
  useEffect(
    () => () => {
      alive.current = false
    },
    []
  )
  useEffect(() => {
    if (!busy) setStage(null)
  }, [busy])
  /* The card is up while a run is: the picker hidden under it, the foot's own line not said twice. */
  const building = !!busy && stage !== null
  const toStep = (kind, step) => {
    if (alive.current) setStage({ kind, step, got: null, of: null })
  }
  /* How far a read of the preset has got (lib/device gridCells onProgress): only into the step it was asked for, so a late word from one read never moves another's bar. */
  const toldFor = (step) => (p) => {
    if (alive.current && p && Number.isFinite(p.got) && Number.isFinite(p.of)) setStage((s) => (s && s.step === step ? { ...s, got: p.got, of: p.of } : s))
  }
  /* Step 2 from here: how many of the run's steps have gone before the one going, told as each goes, once the unit has said it is still on this preset (held), so a step stopped there is never counted. */
  const sentCounter = (kind, of) => {
    let sent = 0
    if (alive.current) setStage({ kind, step: 2, got: 0, of })
    return (call) => (...args) => {
      if (alive.current) setStage({ kind, step: 2, got: sent, of })
      sent += 1
      return call(...args)
    }
  }

  const shape = gridShape(caps)
  const room = palette ? Math.max(0, buildRoom({ cells: [], shape, palette, blocks: chain })) : 0
  /* Why nothing can be built on this preset at all (its Input and Output on different rows, no free cell between them), in words: said in place of a picker with every block greyed out over an empty row. */
  const blocked = palette ? buildBlocked({ cells: [], shape, palette, blocks: chain }) : null

  /*
   * The unit's own list, once for each unit (a new link brings new
   * capabilities), and kept for a picker with no unit linked. A read that
   * FAILED is not a unit with no blocks: the list stays unread (null), the
   * page says the unit did not answer, and Try again asks once more.
   */
  const [listFailed, setListFailed] = useState(false)
  useEffect(() => {
    setPalette(null)
    setListFailed(false)
  }, [caps])
  const wanted = bare || open
  useEffect(() => {
    if (!wanted || palette !== null || listFailed) return undefined
    let stop = false
    ;(async () => {
      try {
        const list = ownPaletteHere(await blockCatalog())
        if (stop) return
        setPalette(list)
        keepPaletteHere(list)
        /* A real unit has just answered with its blocks, and it is one Quick build is offered on: chains kept before any unit was known are its now (never in the demo). */
        adoptUnlinkedHere()
      } catch (err) {
        logDebug('chain', 'quick build: block list', err?.message || String(err))
        if (!stop) setListFailed(true)
      }
    })()
    return () => {
      stop = true
    }
  }, [wanted, palette, listFailed])

  const openWith = (blocks) => {
    /* Against a list that was read, and a preset that can be built on: otherwise every block would be "missing" or "left out" for a reason that is not the unit's. */
    const start = palette && !blocked ? startFrom(blocks || [], palette, room) : { picks: [], missing: [], left: [] }
    setPicks(start.picks)
    setSaid(start.missing.length || start.left.length ? [start.missing.length ? missingLine(start.missing) : null, start.left.length ? leftLine(start.left) : null].filter(Boolean).join(' ') : null)
    setDone(null)
    setUndoSaid(null)
    setNaming(false)
    setKept(null)
    setOpen(true)
  }

  /* Play's Quick build: Edit opened with the sheet up, once, on a bare preset. */
  useEffect(() => {
    if (bare && takeQuickBuildAsk()) openWith([])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bare])

  const close = () => {
    if (busy) return
    setOpen(false)
  }

  /*
   * A PLAN IS MANY REQUESTS, AND THE UNIT CAN BE STEPPED TO ANOTHER PRESET
   * BETWEEN ANY TWO (a footswitch). So before every step the unit itself is
   * asked which preset it is on (rig unitOnPreset, which says why nothing
   * else can be gone by: the preset on the screen is held still while the
   * chain is written, and the news of a change does not always come). Moved,
   * and the run stops there (runPlan stops at a throw) with `gone.moved`
   * set; a unit that will not say stops it too, since the app does not go
   * on writing to a preset it cannot name. `gone.unsent` is whether the step
   * that threw was stopped HERE, before it was sent: one that threw on its
   * own way may have reached the unit. Over Bluetooth the wire holds the
   * same line itself (bleWire chainSeen).
   */
  /* The screen's own number counts as a move only when it names a real preset: a unit gone quiet shows -1 there, which is not another preset, and then the unit is asked (and "unknown" is the answer if it will not say). */
  const where = async (n) => {
    const here = ofNumber()
    return Number.isInteger(here) && here >= 0 && here !== n ? 'moved' : unitOnPreset(n)
  }
  /* What stopped a run, in words: the app's own reason when it stopped the step itself (said once, as it is), else the step and the unit's or the link's reason; "read again" only where the chain was. */
  const stoppedWords = (res, gone, read) => (res.ok ? null : gone.unsent ? res.error : stoppedLine(res.failed, res.error, read))
  const held = (n, gone, call) => async (...args) => {
    gone.unsent = true
    const on = gone.moved ? 'moved' : await where(n)
    if (on === 'moved') {
      gone.moved = true
      throw new Error(PRESET_MOVED)
    }
    if (on !== 'same') throw new Error(UNIT_QUIET)
    gone.unsent = false
    return call(...args)
  }
  /* How many of a run's steps may have reached the unit: the ones answered, and the one that threw unless it was stopped before it was sent. */
  const triedOf = (res, gone) => (res.ok ? res.done : res.done + (gone.unsent ? 0 : 1))

  /* The five calls, with each step said while it goes, counted on the card, and written in the log. */
  const wire = (plan, n, gone) => {
    const sending = sentCounter('build', plan.steps.length)
    return {
      placeBlock: held(n, gone, sending((row, col, blockId) => {
        const step = plan.steps.find((s) => s.kind === 'place' && s.row === row && s.col === col && s.blockId === blockId)
        if (alive.current) setBusy(placingLine(step?.name))
        return placeBlock(row, col, blockId)
      })),
      clearCell: held(n, gone, sending((row, col) => clearCell(row, col))),
      setCable: held(n, gone, sending((srcRow, srcCol, destRow, connect) => {
        if (alive.current && connect) setBusy(JOINING)
        return setCable(srcRow, srcCol, destRow, connect)
      }))
    }
  }

  const logSteps = (label, steps, res) =>
    steps.forEach((step, i) =>
      logDebug('chain', `${label}: ${stepWords(step)}`, i < res.done ? 'sent' : res.failed === step ? `stopped: ${res.error}` : 'not sent')
    )

  const build = async () => {
    if (busy || !picks.length) return
    setSaid(null)
    toStep('build', 1)
    setBusy(CHECKING_EMPTY)
    /* The preset this is for, taken BEFORE its chain is read: the plan is made from that read, and every step is held to this number. With no preset known there is nothing to hold them to. */
    const n = ofNumber()
    if (!Number.isInteger(n) || n < 0) {
      setBusy(null)
      setSaid(READ_FAILED)
      return
    }
    let cells
    try {
      cells = await gridCells({ onProgress: toldFor(1) })
    } catch (err) {
      logDebug('chain', 'quick build: grid read', err?.message || String(err))
      setBusy(null)
      /* The wire's own words where it refused the read (the preset changed while it was being read); else that the unit did not answer. */
      setSaid(err?.status === 409 && err?.message ? err.message : READ_FAILED)
      return
    }
    const { picks: entries } = resolveChain(picks, palette || [])
    const plan = planBuild({ cells, shape, palette: palette || [], picks: entries, blocks: getState().allBlocks || [] })
    logDebug('chain', 'quick build', plan.ok ? `${plan.placed.length} cells, ${plan.steps.length} steps on row ${plan.row + 1}${plan.left.length ? `, left out ${plan.left.join(', ')}` : ''}` : plan.why)
    if (!plan.ok) {
      setBusy(null)
      setSaid(plan.why)
      return
    }
    const gone = { moved: false, unsent: false }
    beginChainWrite()
    if (alive.current) setBusy(BUILDING)
    let res
    try {
      res = await runPlan(plan.steps, wire(plan, n, gone))
    } catch (err) {
      res = { ok: false, done: 0, failed: plan.steps[0], error: err?.message || String(err) }
    }
    logSteps('quick build', plan.steps, res)
    const tried = triedOf(res, gone)
    /* Where the unit is now, asked while the chain write is still held. */
    const on = gone.moved ? 'moved' : await where(n)
    endChainWrite({ refresh: false })
    /*
     * On another preset now: the chain that would be read back is not the
     * one this was built in, so nothing is said of it and no Undo is
     * offered. The news the chain write noted is followed, so the screen
     * shows the preset the unit is on. And the words say what happened: a
     * run that was stopped, one that never began, or one that had finished.
     */
    if (on === 'moved') {
      followPresetAfterChainWrite()
      logDebug('chain', 'quick build', `the preset changed (${tried} of ${plan.steps.length} steps may have gone); nothing read back`)
      if (!alive.current) return
      setBusy(null)
      /* "After the build was sent" only of a run that finished: one that stopped on the way, whatever stopped it, was not all sent. */
      setSaid(tried === 0 ? PRESET_MOVED_BEFORE : gone.moved || !res.ok ? PRESET_MOVED : PRESET_MOVED_AFTER)
      return
    }
    /* Not one step went (a run with no move that sent nothing can only have been stopped by a unit that would not say which preset it is on): nothing was built, and no result is drawn for it, whatever the unit says now. */
    if (tried === 0) {
      if (on !== 'same') followPresetAfterChainWrite()
      logDebug('chain', 'quick build', 'the unit did not say which preset it is on; nothing sent')
      if (!alive.current) return
      setBusy(null)
      setSaid(UNIT_QUIET_BEFORE)
      return
    }
    /* Null when the unit did not answer: what landed is then not known, which is not the same as nothing landing (whatLanded). And where it would not say which preset it is on, nothing is read back as this preset's at all. */
    let after = null
    if (on === 'same') {
      toStep('build', 3)
      if (alive.current) setBusy(READING_BACK)
      await refreshBlocks({ quiet: true })
      try {
        after = await gridCells({ onProgress: toldFor(3) })
      } catch (err) {
        logDebug('chain', 'quick build: read back', err?.message || String(err))
      }
    } else {
      followPresetAfterChainWrite()
      logDebug('chain', 'quick build', 'the unit did not say which preset it is on; nothing read back')
    }
    const landed = whatLanded(plan, after, tried)
    logDebug('chain', 'quick build landed', landed.unread ? 'not read' : `${landed.landed.length} in, ${landed.missing.length} not${landed.missing.length ? `: ${landed.missing.map((p) => p.name).join(', ')}` : ''}${plan.joined ? (landed.joined ? '; connected from the input to the output' : `; NOT connected${Number.isInteger(landed.stops) ? `, stops at column ${landed.stops + 1}` : ''}`) : ''}`)
    /* The whole row as the unit read it back, not only where it first stops: which cables took is what tells a dropped message from a wrong one. */
    /* With the names the phone has for the III's own blocks: through the computer the grid read calls NAM 1 "eid_206". Log only. */
    const read = rowAsRead(plan, after, ownCellNameHere)
    if (read) logDebug('chain', 'quick build', read)
    const undo = undoSteps(plan, tried)
    if (!alive.current) return
    setBusy(null)
    setDone({
      plan,
      landed,
      stopped: stoppedWords(res, gone, after !== null),
      undo: undo.length ? undo : null,
      /* What Undo says it takes out: the blocks the read back shows. Where it did not come, no number: what was sent is not what the unit said it holds. */
      count: landed.unread ? 0 : landed.landed.filter((p) => !p.end).length,
      ran: tried,
      n
    })
  }

  const runUndo = async () => {
    const d = done
    if (!d?.undo || busy) return
    toStep('undo', 1)
    setBusy(UNDOING)
    /* Still on the preset the build was made in? Asked of the unit, as before every step. */
    const before = await where(d.n)
    if (before !== 'same') {
      logDebug('chain', 'quick build undo', before === 'moved' ? 'another preset now; not run' : 'the unit did not say which preset it is on; not run')
      if (!alive.current) return
      setBusy(null)
      if (before === 'moved') setDone({ ...d, undo: null })
      setUndoSaid({ bad: true, text: before === 'moved' ? UNDO_STALE : READ_FAILED })
      return
    }
    /*
     * The chain as it is now, before anything is taken out: a block swapped
     * into one of these cells since (at the unit, or from the computer's
     * window) is not the build's to remove (undoStale). Not read, not run:
     * the Undo stays, to be tapped again.
     */
    let now
    try {
      now = await gridCells({ onProgress: toldFor(1) })
    } catch (err) {
      logDebug('chain', 'quick build undo: grid read', err?.message || String(err))
      if (!alive.current) return
      setBusy(null)
      setUndoSaid({ bad: true, text: err?.status === 409 && err?.message ? err.message : READ_FAILED })
      return
    }
    /* The screen's number by the same rule as `where`: a -1 there (a unit gone quiet) is not another preset, and the unit itself has just said it is on this one. */
    const shown = ofNumber()
    if ((Number.isInteger(shown) && shown >= 0 && shown !== d.n) || undoStale(d.plan, now, d.ran)) {
      logDebug('chain', 'quick build undo', 'the chain has changed since; not run')
      if (!alive.current) return
      setBusy(null)
      setDone({ ...d, undo: null })
      setUndoSaid({ bad: true, text: UNDO_STALE })
      return
    }
    const gone = { moved: false, unsent: false }
    beginChainWrite()
    let res
    try {
      const sending = sentCounter('undo', d.undo.length)
      res = await runPlan(d.undo, { setCable: held(d.n, gone, sending(setCable)), placeBlock: held(d.n, gone, sending(placeBlock)), clearCell: held(d.n, gone, sending(clearCell)) })
    } catch (err) {
      res = { ok: false, done: 0, failed: d.undo[0], error: err?.message || String(err) }
    }
    logSteps('quick build undo', d.undo, res)
    const on = gone.moved ? 'moved' : await where(d.n)
    endChainWrite({ refresh: false })
    if (on === 'moved') {
      followPresetAfterChainWrite()
      logDebug('chain', 'quick build undo', 'the preset changed; nothing read back')
      if (!alive.current) return
      setBusy(null)
      setDone({ ...d, undo: null })
      setUndoSaid({ bad: true, text: gone.moved || !res.ok ? PRESET_MOVED : UNDO_MOVED_AFTER })
      return
    }
    /* Not one step of the Undo went: nothing was taken out, the build is still in the preset, and the Undo stays to be tapped again. */
    if (!res.ok && res.done === 0 && gone.unsent) {
      if (on !== 'same') followPresetAfterChainWrite()
      logDebug('chain', 'quick build undo', 'the unit did not say which preset it is on; nothing sent')
      if (!alive.current) return
      setBusy(null)
      setUndoSaid({ bad: true, text: UNIT_QUIET_BEFORE })
      return
    }
    /* Null when the unit did not answer, or would not say which preset it is on: then nothing is said to be out. */
    let after = null
    if (on === 'same') {
      toStep('undo', 3)
      await refreshBlocks({ quiet: true })
      try {
        after = await gridCells({ onProgress: toldFor(3) })
      } catch (err) {
        logDebug('chain', 'quick build undo: read back', err?.message || String(err))
      }
    } else {
      followPresetAfterChainWrite()
    }
    const still = after === null ? [] : stillIn(d.plan, after)
    /* The blocks out is half of it: the wiring the preset had before has to be back too, or it is a preset with no sound. */
    const unjoined = after === null ? null : undoUnjoined(d.plan, after, d.ran)
    const words = !res.ok
      ? { bad: true, text: stoppedWords(res, gone, after !== null) }
      : after === null
        ? { bad: true, text: UNDO_NOT_READ }
        : still.length
          ? { bad: true, text: undoMissedLine(still.map((p) => p.name)) }
          : unjoined !== null
            ? { bad: true, text: undoNotJoinedLine(unjoined, d.count) }
            : d.plan.wiringKnown === false
              ? { bad: false, text: undoWiringLeftLine(d.count) }
              : { bad: false, text: undoneLine(d.count) }
    logDebug('chain', 'quick build undo', words.text)
    if (!alive.current) return
    setBusy(null)
    setDone({ ...d, undo: null })
    setUndoSaid(words)
  }

  const keep = () => {
    const r = addStarterHere({ name, blocks: picks })
    if (!r.ok) {
      setKept({ bad: true, text: r.why })
      return
    }
    setNaming(false)
    setName('')
    setKept({ bad: false, text: keptLine(r.chain.name) })
  }

  const full = !roomForStarterHere()

  const foot = done ? null : (
    <View style={{ gap: space.sm }}>
      {busy && !building ? <Text accessibilityLiveRegion="polite" style={{ color: color.silk, fontSize: font.body }}>{busy}</Text> : null}
      <Press label={busy ? BUILDING : buildLabel(picks.length)} tone="signal" on={picks.length > 0} disabled={!picks.length || !!busy} busy={!!busy} onPress={build} />
      {/* Before the tap, where it is a long wait: said once more under the card. */}
      {takesLong && !busy ? <Text style={{ color: color.silkDim, fontSize: font.small }}>{TAKES_LONG}</Text> : null}
      {busy ? null : naming ? (
        <NameRow name={name} onName={setName} onKeep={keep} onCancel={() => setNaming(false)} problem={kept?.bad ? kept.text : null} />
      ) : full ? (
        <Text style={{ color: color.silkDim, fontSize: font.small }}>{STARTERS_FULL}</Text>
      ) : (
        <Press label={KEEP_STARTER} sub={KEEP_STARTER_SUB} disabled={!picks.length || !!busy} onPress={() => setNaming(true)} />
      )}
      {kept && !kept.bad ? <Text style={{ color: color.ok, fontSize: font.small }}>{kept.text}</Text> : null}
      <Text style={{ color: color.silkDim, fontSize: font.small }}>{saves ? NOTHING_SAVED : NOTHING_SAVED_ON_UNIT}</Text>
    </View>
  )

  return (
    <>
      {bare ? (
        <View style={{ gap: space.md }}>
          <Text style={{ color: color.silkDim, fontSize: font.body }}>{EMPTY_LINE}</Text>
          {listFailed ? (
            <>
              <Note tone="warn">{BLOCKS_NOT_READ}</Note>
              <Press label={TRY_AGAIN} onPress={() => setListFailed(false)} />
            </>
          ) : null}
          {blocked ? <Note tone="warn">{blocked}</Note> : null}
          <Press label={QUICK_BUILD_TITLE} sub={QUICK_BUILD_SUB} tone="signal" on height={TAP + 16} disabled={palette === null || !!blocked} onPress={() => openWith([])} />
          <Heading>{FROM_A_CHAIN}</Heading>
          {starters.map((c) => (
            <Pressable
              key={c.id}
              accessibilityRole="button"
              accessibilityLabel={`${c.name}${c.isDefault ? ', the default' : ''}`}
              accessibilityHint="Opens Quick build with these blocks picked"
              disabled={palette === null || !!blocked}
              onPress={() => openWith(c.blocks)}
              style={{ gap: space.sm, padding: space.md, borderRadius: radius.md, borderWidth: 1, borderColor: color.rule, backgroundColor: color.panel }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm }}>
                <Text style={{ color: color.silk, fontSize: font.lead, fontWeight: '700', flexShrink: 1 }}>{c.name}</Text>
                {c.isDefault ? <Badge>{DEFAULT_BADGE}</Badge> : null}
              </View>
              <ChainStrip blocks={c.blocks} />
            </Pressable>
          ))}
          <Text style={{ color: color.silkDim, fontSize: font.body }}>{MAKE_YOUR_OWN}</Text>
        </View>
      ) : null}

      {/* The card in the sheet's head, which never scrolls, so it cannot sit out of view over a picker scrolled down; the ✕ faded, since nothing closes the sheet while it builds. */}
      <Sheet
        open={open}
        onClose={close}
        title={QUICK_BUILD_TITLE}
        head={building ? <BuildProgress stage={stage} line={stage.kind === 'undo' ? null : busy} unit={unitName} takesLong={takesLong} /> : null}
        foot={foot}
        tall
        locked={!!busy}
      >
        {done ? (
          <View style={{ gap: space.md }}>
            <ResultCard tone={done.landed.tone} title={done.landed.title} text={done.landed.text} />
            {done.stopped ? <Note tone="fault">{done.stopped}</Note> : null}
            <ChainStrip blocks={done.landed.landed.filter((p) => !p.end).map((p) => p.family)} />
            {done.plan.left.length ? <Text style={{ color: color.silkDim, fontSize: font.small }}>{leftLine(done.plan.left)}</Text> : null}
            <Press
              label={BACK_TO_PLAY}
              tone="signal"
              on
              disabled={!!busy}
              onPress={() => {
                setOpen(false)
                onPlay?.()
              }}
            />
            {onRename && done.landed.tone !== 'fault' ? (
              <Press
                label={NAME_PRESET}
                sub={NAME_PRESET_SUB}
                disabled={!!busy}
                onPress={() => {
                  setOpen(false)
                  onRename()
                }}
              />
            ) : null}
            {done.undo ? <Press label={busy ? UNDO_BUSY : UNDO_LABEL} sub={undoSub(done.count)} disabled={!!busy} busy={!!busy} onPress={runUndo} /> : null}
            {undoSaid ? <Note tone={undoSaid.bad ? 'fault' : 'hint'}>{undoSaid.text}</Note> : null}
            {pending && onSave ? (
              <Press
                label={SAVE_PRESET}
                tone="live"
                disabled={!!busy}
                onPress={() => {
                  setOpen(false)
                  onSave()
                }}
              />
            ) : null}
            <Text style={{ color: color.silkDim, fontSize: font.small }}>{saves ? NOTHING_SAVED : NOTHING_SAVED_ON_UNIT}</Text>
          </View>
        ) : (
          <View style={{ gap: space.md }}>
            {said ? <Note tone="warn">{said}</Note> : null}
            {palette === null && listFailed ? (
              <>
                <Note tone="warn">{BLOCKS_NOT_READ}</Note>
                <Press label={TRY_AGAIN} onPress={() => setListFailed(false)} />
              </>
            ) : palette === null ? (
              <Text style={{ color: color.silkDim, fontSize: font.body }}>{READING_BLOCKS}</Text>
            ) : blocked ? (
              <Note tone="warn">{blocked}</Note>
            ) : (
              <ChainPicker palette={palette} picks={picks} onPicks={setPicks} room={room} linear={shape.linear} hidden={building} />
            )}
          </View>
        )}
      </Sheet>
    </>
  )
}

/** The DEFAULT badge, as in the pictures. */
export function Badge({ children }) {
  return (
    <View style={{ paddingHorizontal: space.sm, paddingVertical: 2, borderRadius: radius.sm, backgroundColor: color.live }}>
      <Text style={{ color: color.chassis, fontSize: font.micro, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' }}>{children}</Text>
    </View>
  )
}


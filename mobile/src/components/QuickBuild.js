import { useEffect, useMemo, useRef, useState } from 'react'
import { Image, Pressable, Text, TextInput, View } from 'react-native'

import { color, font, radius, space, TAP } from '../lib/theme'
import { blockCatalog, clearCell, gridCells, placeBlock, setCable } from '../lib/device'
import { beginChainWrite, endChainWrite, followPresetAfterChainWrite, getState, leftPresetInChainWrite, refreshBlocks } from '../lib/rig'
import { logDebug } from '../lib/debugLog'
import { gridShape } from '../lib/grid-plan'
import { UNDO_STALE, runPlan, stepWords } from '../lib/split-chain'
import { blockColor } from '../lib/blockColors'
import { blockIconOwn } from '../lib/blockIcons'
import { shortName } from '../lib/shortName'
import { ownPaletteHere } from '../lib/ownBlocksHere'
import { takeQuickBuildAsk } from '../lib/quickBuild'
import { addStarterHere, keepPaletteHere, roomForStarterHere, useStarterChains } from '../lib/starterChainsHere'
import {
  BACK_TO_PLAY,
  BLOCKS_HEAD,
  BLOCKS_NOT_READ,
  CANCEL_BUTTON,
  CHAIN_NONE_YET,
  CHECKING_EMPTY,
  DEFAULT_BADGE,
  EMPTY_LINE,
  FROM_A_CHAIN,
  JOINING,
  KEEP_BUTTON,
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
  READ_FAILED,
  SAVE_PRESET,
  STARTERS_FULL,
  STARTER_NAME_MAX,
  TRY_AGAIN,
  UNDOING,
  UNDO_LABEL,
  YOUR_CHAIN,
  buildBlocked,
  buildLabel,
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
  sentBlocks,
  stillIn,
  stoppedLine,
  undoMissedLine,
  undoNotJoinedLine,
  undoStale,
  undoSteps,
  undoSub,
  undoUnjoined,
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
 */
export function ChainPicker({ palette, picks, onPicks, room = Infinity, linear = false, fullLine = null }) {
  const [more, setMore] = useState(false)
  const chips = useMemo(() => chipsFor(palette, picks), [palette, picks])
  const full = picks.length >= room
  const common = chips.filter((c) => c.common)
  const rest = chips.filter((c) => !c.common)
  const tap = (c) => onPicks(pickToggled(picks, c.family, c.nth, room))
  return (
    <View style={{ gap: space.md }}>
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
 */
export default function QuickBuild({ bare, caps, chain, pending = false, saves = true, onSave, onPlay }) {
  const starters = useStarterChains()
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
  const alive = useRef(true)
  useEffect(
    () => () => {
      alive.current = false
    },
    []
  )

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
   * A plan is many requests, and the unit can be stepped to another preset
   * between any two (a footswitch). So each step asks first whether the
   * unit is still on the preset the plan was made for (`n`), and the first
   * that finds it is not stops the run (runPlan stops at a throw) and says
   * so in `gone`. The preset on the screen is not enough to go by: while
   * the chain is being written its news is noted and not followed, so the
   * rig is asked, and it asks the unit where news has come in
   * (leftPresetInChainWrite). The wire holds the same over Bluetooth, sooner
   * than the screen can know (bleWire chainSeen).
   */
  const held = (n, gone, call) => async (...args) => {
    if (gone.moved || ofNumber() !== n || (await leftPresetInChainWrite(n))) {
      gone.moved = true
      throw new Error(PRESET_MOVED)
    }
    return call(...args)
  }
  /* After a run: whether the unit is on another preset now. */
  const leftFor = async (n, gone) => gone.moved || ofNumber() !== n || (await leftPresetInChainWrite(n))

  /* The five calls, with each step said while it goes and written in the log. */
  const wire = (plan, n, gone) => ({
    placeBlock: held(n, gone, (row, col, blockId) => {
      const step = plan.steps.find((s) => s.kind === 'place' && s.row === row && s.col === col && s.blockId === blockId)
      if (alive.current) setBusy(placingLine(step?.name))
      return placeBlock(row, col, blockId)
    }),
    clearCell: held(n, gone, (row, col) => clearCell(row, col)),
    setCable: held(n, gone, (srcRow, srcCol, destRow, connect) => {
      if (alive.current && connect) setBusy(JOINING)
      return setCable(srcRow, srcCol, destRow, connect)
    })
  })

  const logSteps = (label, steps, res) =>
    steps.forEach((step, i) =>
      logDebug('chain', `${label}: ${stepWords(step)}`, i < res.done ? 'sent' : res.failed === step ? `stopped: ${res.error}` : 'not sent')
    )

  const build = async () => {
    if (busy || !picks.length) return
    setSaid(null)
    setBusy(CHECKING_EMPTY)
    let cells
    try {
      cells = await gridCells()
    } catch (err) {
      logDebug('chain', 'quick build: grid read', err?.message || String(err))
      setBusy(null)
      setSaid(READ_FAILED)
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
    const n = ofNumber()
    const gone = { moved: false }
    beginChainWrite()
    let res
    try {
      res = await runPlan(plan.steps, wire(plan, n, gone))
    } catch (err) {
      res = { ok: false, done: 0, failed: plan.steps[0], error: err?.message || String(err) }
    }
    logSteps('quick build', plan.steps, res)
    const left = await leftFor(n, gone)
    endChainWrite({ refresh: false })
    /* On another preset now: the chain that would be read back is not the one this was built in, so nothing is said of it and no Undo is offered. The news the chain write noted is followed, so the screen shows the preset the unit is on. */
    if (left) {
      followPresetAfterChainWrite()
      logDebug('chain', 'quick build', 'the preset changed part-way; nothing read back')
      if (!alive.current) return
      setBusy(null)
      setSaid(PRESET_MOVED)
      return
    }
    if (alive.current) setBusy(READING_BACK)
    await refreshBlocks({ quiet: true })
    /* Null when the unit did not answer: what landed is then not known, which is not the same as nothing landing (whatLanded). */
    let after = null
    try {
      after = await gridCells()
    } catch (err) {
      logDebug('chain', 'quick build: read back', err?.message || String(err))
    }
    const landed = whatLanded(plan, after, res.done)
    logDebug('chain', 'quick build landed', `${landed.landed.length} in, ${landed.missing.length} not${landed.missing.length ? `: ${landed.missing.map((p) => p.name).join(', ')}` : ''}`)
    const undo = undoSteps(plan, res.done)
    if (!alive.current) return
    setBusy(null)
    setDone({
      plan,
      landed,
      stopped: res.ok ? null : stoppedLine(res.failed, res.error),
      undo: undo.length ? undo : null,
      /* What Undo says it takes out: the blocks the read back shows, or where it did not come, the ones that were sent. */
      count: landed.unread ? sentBlocks(plan, res.done) : landed.landed.filter((p) => !p.end).length,
      ran: res.done,
      n
    })
  }

  const runUndo = async () => {
    const d = done
    if (!d?.undo || busy) return
    if (ofNumber() !== d.n) {
      setDone({ ...d, undo: null })
      setUndoSaid({ bad: true, text: UNDO_STALE })
      return
    }
    setBusy(UNDOING)
    /*
     * The chain as it is now, before anything is taken out: a block swapped
     * into one of these cells since (at the unit, or from the computer's
     * window) is not the build's to remove (undoStale). Not read, not run:
     * the Undo stays, to be tapped again.
     */
    let now
    try {
      now = await gridCells()
    } catch (err) {
      logDebug('chain', 'quick build undo: grid read', err?.message || String(err))
      if (!alive.current) return
      setBusy(null)
      setUndoSaid({ bad: true, text: READ_FAILED })
      return
    }
    if (ofNumber() !== d.n || undoStale(d.plan, now, d.ran)) {
      logDebug('chain', 'quick build undo', 'the chain has changed since; not run')
      if (!alive.current) return
      setBusy(null)
      setDone({ ...d, undo: null })
      setUndoSaid({ bad: true, text: UNDO_STALE })
      return
    }
    const gone = { moved: false }
    beginChainWrite()
    let res
    try {
      res = await runPlan(d.undo, { setCable: held(d.n, gone, setCable), placeBlock: held(d.n, gone, placeBlock), clearCell: held(d.n, gone, clearCell) })
    } catch (err) {
      res = { ok: false, done: 0, failed: d.undo[0], error: err?.message || String(err) }
    }
    logSteps('quick build undo', d.undo, res)
    const left = await leftFor(d.n, gone)
    endChainWrite({ refresh: false })
    if (left) {
      followPresetAfterChainWrite()
      logDebug('chain', 'quick build undo', 'the preset changed part-way; nothing read back')
      if (!alive.current) return
      setBusy(null)
      setDone({ ...d, undo: null })
      setUndoSaid({ bad: true, text: PRESET_MOVED })
      return
    }
    await refreshBlocks({ quiet: true })
    /* Null when the unit did not answer: then nothing is said to be out. */
    let after = null
    try {
      after = await gridCells()
    } catch (err) {
      logDebug('chain', 'quick build undo: read back', err?.message || String(err))
    }
    const still = after === null ? [] : stillIn(d.plan, after)
    /* The blocks out is half of it: the wiring the preset had before has to be back too, or it is a preset with no sound. */
    const unjoined = after === null ? null : undoUnjoined(d.plan, after, d.ran)
    const words = !res.ok
      ? { bad: true, text: stoppedLine(res.failed, res.error) }
      : after === null
        ? { bad: true, text: UNDO_NOT_READ }
        : still.length
          ? { bad: true, text: undoMissedLine(still.map((p) => p.name)) }
          : unjoined !== null
            ? { bad: true, text: undoNotJoinedLine(unjoined) }
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
      {busy ? <Text accessibilityLiveRegion="polite" style={{ color: color.silk, fontSize: font.body }}>{busy}</Text> : null}
      <Press label={buildLabel(picks.length)} tone="signal" on={picks.length > 0} disabled={!picks.length || !!busy} busy={!!busy} onPress={build} />
      {naming ? (
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

      <Sheet open={open} onClose={close} title={QUICK_BUILD_TITLE} foot={foot} tall>
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
            {done.undo ? <Press label={busy ? UNDOING : UNDO_LABEL} sub={undoSub(done.count)} disabled={!!busy} busy={!!busy} onPress={runUndo} /> : null}
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
              <ChainPicker palette={palette} picks={picks} onPicks={setPicks} room={room} linear={shape.linear} />
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


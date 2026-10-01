import { useState } from 'react'
import { Alert, Text, View } from 'react-native'
import { color, font, space } from '../lib/theme'
import { blockCatalog, clearCell, gridCells, placeBlock, setCable } from '../lib/device'
import { beginChainWrite, endChainWrite, getState, refreshBlocks } from '../lib/rig'
import { logDebug } from '../lib/debugLog'
import { doubtfulWrite, gridShape } from '../lib/grid-plan'
import { gridMap, mainRow, planLooper, runPlan, stepWords } from '../lib/split-chain'
import Press from './Press'

/**
 * ADD A LOOPER, IN ONE TAP — at the end of the chain, right before the Output.
 *
 * "Let's make it easier to add just a looper block, cause I wanna add that to
 * a lot of my presets." Picking Looper and then a free cell put it wherever
 * the finger landed, and on a spare row that is joined to nothing, which is
 * no looper at all. This works out the place (shared/split-chain.mjs,
 * planLooper — the browser's own), puts it there, joins it in on both sides,
 * and reads the chain back. A looper found off the chain is moved, after a
 * question, because its settings go with it.
 */
export default function LooperAtEnd({ blocks, caps, palette, busy, onError, onAdded }) {
  const [running, setRunning] = useState(false)
  const [said, setSaid] = useState(null)
  const already = (blocks || []).find((b) => b.slug === 'looper')
  /* In the chain already: nothing to offer. Off it, on a row joined to nothing: offered a move. */
  const inChain = !!already && already.row === mainRow(gridMap([], blocks))

  const run = async (plan) => {
    setRunning(true)
    beginChainWrite()
    try {
      const res = await runPlan(plan.steps, { setCable, placeBlock, clearCell })
      for (const step of plan.steps) logDebug('chain', `looper: ${stepWords(step)}`, '')
      endChainWrite({ refresh: false })
      await refreshBlocks({ quiet: true })
      const landed = (getState().allBlocks || []).find((b) => b.slug === 'looper')
      if (!res.ok) setSaid({ bad: true, text: `Stopped at “${stepWords(res.failed)}” — ${res.error}. The chain has been read again, so what you see is what the unit holds.` })
      else if (!landed) setSaid({ bad: true, text: 'The unit did not take the looper. The chain has been read again.' })
      else if (res.doubtful) setSaid({ bad: true, text: doubtfulWrite({ ok: false }) })
      else {
        setSaid({ bad: false, text: `Looper added at column ${plan.col + 1}, at the end of the chain. Nothing is saved until you press Save.` })
        onAdded?.(plan)
      }
    } catch (err) {
      endChainWrite()
      setSaid({ bad: true, text: err?.message || String(err) })
      onError?.(err?.message)
    } finally {
      setRunning(false)
    }
  }

  const go = async () => {
    setSaid(null)
    let cells = []
    try {
      cells = await gridCells()
    } catch {
      /* The chain read still says where every block is; only the wires are a guess. */
    }
    let list = palette
    if (!Array.isArray(list) || !list.length) list = await blockCatalog().catch(() => [])
    const plan = planLooper(gridMap(cells, getState().allBlocks || blocks, gridShape(caps)), list)
    if (!plan.ok) {
      setSaid({ bad: !plan.here, text: plan.why })
      return
    }
    if (plan.moved) {
      Alert.alert(
        'Move the looper to the end of the chain?',
        'It is on a row that is not joined to the chain, so it makes no sound there. Moving it resets its settings.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Move it', onPress: () => run(plan) }
        ]
      )
      return
    }
    run(plan)
  }

  if (inChain && !said) return null

  return (
    <View style={{ gap: space.sm }}>
      <Press
        label={running ? 'Adding the looper…' : inChain ? 'The looper is in the chain' : already ? 'Put the looper at the end of the chain' : 'Add a looper'}
        sub="At the end of the chain, right before the Output"
        disabled={busy || running || inChain}
        onPress={go}
      />
      {said ? <Text style={{ color: said.bad ? color.fault : color.silkDim, fontSize: font.micro }}>{said.text}</Text> : null}
    </View>
  )
}

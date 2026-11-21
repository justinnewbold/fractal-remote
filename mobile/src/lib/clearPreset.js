/**
 * CLEAR THIS PRESET: every block out in one go, to start fresh.
 *
 * "I wanna create a way for them to quickly delete an entire preset so that
 * they can start fresh." (Justin, 21 November 2026.) He had been taking a
 * preset apart one Remove at a time (seven of them on his Axe-Fx III, 17
 * November) before a Quick build.
 *
 * It is the chain editor's own Remove, once for each block, and nothing
 * else: the same message, held to the preset it was begun on where the
 * editor holds its writes, the chain read back after, and what is said is
 * what that read shows. The Input and the Output stay (a preset with
 * neither is not one Quick build can fill by itself on every unit, and the
 * editor never removes them either). A block the editor only holds (a "New
 * block" it has no name for) is left where it is, and said. NOTHING IS
 * SAVED: the preset on the unit is as it was until Save, and loading it
 * again brings every block back.
 *
 * Pure: the screen (Edit's ChainEditor) hands it the lanes and does the
 * sending. Run whole by test/clear-preset.mjs.
 */
export const CLEAR_LABEL = 'Clear this preset'
export const CLEAR_SUB = 'Take every block out and start fresh'
export const CLEAR_ASK_TITLE = 'Clear this preset?'

const ENDS = ['input', 'output']

/** The blocks a clear takes out, in the order it takes them: every block of every lane but the Input and the Output. */
export function clearable(lanes) {
  const out = []
  for (const lane of lanes || []) {
    for (const b of lane?.blocks || []) {
      if (!b || ENDS.includes(b.slug) || b.fixed === true) continue
      if (!Number.isInteger(b.col)) continue
      out.push({ row: lane.row, col: b.col, name: b.name || 'a block' })
    }
  }
  return out
}

/** How many blocks the editor holds and cannot take out (lanes' `held`). */
export const heldCount = (lanes) => (lanes || []).reduce((n, lane) => n + (lane?.held || []).length, 0)

const blocksWord = (n) => `${n} block${n === 1 ? '' : 's'}`

/** What the confirm says before anything is sent. */
export function clearAsk(n, saves = true) {
  return `${n === 1 ? 'The 1 block' : `All ${n} blocks`} in this preset and ${n === 1 ? 'its' : 'their'} settings are taken out. The Input and Output stay. ${
    saves ? 'Nothing is saved until you save' : 'Nothing is saved on the unit by this'
  }: load the preset again to bring ${n === 1 ? 'it' : 'them'} back.`
}

/**
 * What became of it. `asked` the blocks it set out to take, `sent` how many
 * removes went, `left` the ones the read after still shows, `stopped` why it
 * stopped early ('moved', 'unknown') or null, `read` whether the chain was
 * read after. → { tone: 'ok' | 'warn', text }
 */
export function clearSaid({ asked = 0, sent = 0, left = [], stopped = null, read = true, held = 0 } = {}) {
  if (stopped === 'moved') {
    return { tone: 'warn', text: sent ? `Stopped: the unit went to another preset after ${blocksWord(sent)} had been taken out. Nothing more was sent.` : 'Nothing was taken out: the unit is on another preset now.' }
  }
  if (stopped) {
    return { tone: 'warn', text: sent ? `Stopped after ${blocksWord(sent)}: the unit didn’t say which preset it’s on. Nothing more was sent.` : 'Nothing was taken out: the unit didn’t say which preset it’s on.' }
  }
  if (!read) return { tone: 'warn', text: `${blocksWord(sent)} asked out, but the chain couldn’t be read to check. Close Edit chain and open it again to see what is left.` }
  if (left.length) {
    return { tone: 'warn', text: `The unit kept ${left.length === asked ? (asked === 1 ? 'it' : 'all of them') : left.map((b) => b.name).join(', ')}. ${blocksWord(asked - left.length)} taken out.` }
  }
  const more = held ? ` ${held === 1 ? 'One block the app has no name for was' : `${held} blocks the app has no name for were`} left where ${held === 1 ? 'it is' : 'they are'}.` : ''
  return { tone: 'ok', text: `Took ${asked === 1 ? 'the block' : `all ${asked} blocks`} out. Nothing is saved until you save: load the preset again to bring ${asked === 1 ? 'it' : 'them'} back.${more}` }
}

/* Generated from shared/unit-watch.mjs by scripts/sync-relay-rules.mjs.
 * Do not edit. Change the source and run `npm run sync:rules`; the test suite
 * fails on any difference between the two. */

/**
 * Whether the unit is still on the other end of the cable.
 *
 * "I purposefully unplugged the FM3 from the computer and it still said
 * connected. I waited a few minutes, went ahead and tried to click some
 * buttons, go to different presets, still said connected, so it's lying."
 *
 * It was. Nothing in either app ever asked. The state came from the last
 * read that happened to run — which is at startup, and after that only when
 * something on screen needed a fresh answer. Between those, "connected" was
 * a fact about the past being drawn as a fact about now, and the longer
 * nothing happened the older it got.
 *
 * Pressing buttons did not settle it either, and that is the part worth
 * understanding: a command is a WRITE, and a write to a port whose far end
 * has gone does not necessarily fail. The bytes leave. What proves a unit is
 * there is an ANSWER, and the only calls that need one are reads.
 *
 * So both apps ask, on a timer, for the one thing every unit answers: which
 * preset is loaded. A unit that has gone says -1 — see refreshPreset, where
 * that rule was already written down for the phone's top bar — or nothing at
 * all.
 */

/**
 * How often to ask, in milliseconds.
 *
 * Fifteen seconds at the machine with the cable, where the question is a
 * loopback request and costs nothing anybody can feel. Thirty over the
 * relay, where it is a round trip to a server and back and there is a phone
 * on a cell connection at the other end of it.
 *
 * The number is a compromise and it is worth saying which way. Longer is
 * cheaper and means a dead unit can read as live for that much longer;
 * shorter catches it sooner and fills the log with questions. Fifteen was
 * picked because it is under the time it takes to walk to the amp and back,
 * which is roughly how long somebody spends not looking at the screen before
 * they look at it and believe it.
 */
export const WATCH_MS = 15000
export const WATCH_MS_REMOTE = 30000

/**
 * How many quiet answers in a row before the screen stops saying connected.
 *
 * Not one. "My Mac is connected just fine. The phone app says it has lost
 * the unit." A single call can come back empty while the next is answered
 * perfectly — the app at the Mac is asking the same port several times a
 * second, and a question that loses that race looks exactly like a unit that
 * has gone. Two in a row, thirty seconds apart, is not a race.
 */
export const STRIKES = 2

/** How often to ask, given which end is asking. */
export const watchEvery = (remote) => (remote ? WATCH_MS_REMOTE : WATCH_MS)

/**
 * What one probe means: 'answering', or 'quiet'.
 *
 * `preset` is whatever the read came back with, `failed` whether it threw.
 * A preset with no number is quiet for the same reason -1 is: the unit did
 * not say which one it is on, and that is the first thing a frozen unit
 * stops doing.
 */
export function probeSays({ preset, failed = false } = {}) {
  if (failed) return 'quiet'
  const n = preset?.number
  return Number.isInteger(n) && n >= 0 ? 'answering' : 'quiet'
}

/** The run of quiet answers after this one. Any answer at all clears it. */
export const countQuiet = (quiet, said) => (said === 'answering' ? 0 : (Number(quiet) || 0) + 1)

/** Whether that run is long enough to stop claiming a unit is there. */
export const unitGone = (quiet) => (Number(quiet) || 0) >= STRIKES

/**
 * A VP4 IS ASKED WHICH SCENE IT IS ON, NOT WHICH PRESET.
 *
 * A VP4 cannot say which preset it is on: every computer app answers GET
 * /preset for one with a 501, which both apps take as the quiet "can't
 * tell" (shared/vp4-safety.mjs). As the probe above, that is a quiet answer
 * on every tick, so the browser handed over to a whole re-read every second
 * tick for as long as a page was open — every 30 seconds at the computer and
 * every minute from away. Each one asked the unit who it is and what
 * firmware it runs all over again, and on the computer apps out there now,
 * which fall back to the sweep that froze an AM4 whenever the one safe read
 * of a VP4 is late, it read the chain too. And it wrote "the unit stopped
 * answering" in the log every time, which was not true. The phone wrote the
 * same line.
 *
 * GET /scene is that one safe read on every computer app, old and new: the
 * record VP4-Edit itself polls, and nothing else. So a VP4 is asked that,
 * and only a read that fails, or names no scene, is quiet. A computer app
 * from before the fixed VP4 driver answers scene 1 for a read the VP4 did
 * not answer, so behind one of those a VP4 that has stopped answering is not
 * caught by this; it is caught by the next tap. That costs less than reading
 * it from scratch twice a minute.
 */
export function sceneProbeSays({ scene, failed = false } = {}) {
  if (failed) return 'quiet'
  const i = scene?.index
  return Number.isInteger(i) && i >= 0 ? 'answering' : 'quiet'
}

/**
 * One timed check, at either end: `{ said, heard }`. `heard` is the preset
 * the unit named, for the screen to follow one changed at the front panel —
 * never on a VP4, which names none. `currentPreset` and `getScene` are that
 * end's own reads; a VP4 is asked only the second.
 */
export async function probeUnit({ vp4 = false, currentPreset, getScene } = {}) {
  try {
    if (vp4) return { said: sceneProbeSays({ scene: await getScene() }), heard: null }
    const heard = await currentPreset()
    return { said: probeSays({ preset: heard }), heard }
  } catch {
    return { said: probeSays({ failed: true }), heard: null }
  }
}

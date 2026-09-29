/* Generated from shared/own-echo.mjs by scripts/sync-relay-rules.mjs.
 * Do not edit. Change the source and run `npm run sync:rules`; the test suite
 * fails on any difference between the two. */

/**
 * What an announcement from the computer is allowed to cost the unit, decided
 * once for the phone and the browser.
 *
 * "The Fractals are set up to have gapless switching of scenes and effects
 * ... the sound should never cut out." And from a tester: "the preset changes
 * almost immediately on the unit, but after that there is drop in sound,
 * until the android app loads the new page."
 *
 * The switch was never the problem; what followed it was. The computer
 * announces every write it makes, including the one this app just asked for,
 * and says nothing about who asked: a scene comes back as `scene`, a bypass
 * as `changed` with scope 'grid', a preset as `changed` with scope 'preset'.
 * Both apps used to answer every one of those by reading the chain, which is
 * the whole preset dumped down the port, about 24KB, landing on a unit that
 * is still in the middle of the switch.
 *
 * Shared because the two ends are looking at the same unit through the same
 * computer. The Mac window re-reading the chain after a phone tap is the same
 * dump as the phone doing it, so a rule that holds on one end and not the
 * other has not fixed anything.
 */

/** How long an answered write waits for its own announcement before it is forgotten. */
export const OWN_ECHO_MS = 1500

/*
 * How long a write still waiting for its ANSWER keeps its expectation, at
 * most: the relay's own write timeout, so a request that never comes back
 * cannot swallow somebody else's change for good.
 */
export const OWN_PENDING_MS = 20000

/*
 * How long the chain read after a preset change waits for the unit to finish
 * loading, and how long a chain read counts as current.
 *
 * Longer for a change made somewhere else: the app hears of it late, and it
 * is somebody else's change to finish. And fifteen seconds is the time the
 * computer keeps its own copy of the chain, so a chain read within it is the
 * same answer read twice.
 */
export const OWN_SETTLE_MS = 800
export const PRESET_SETTLE_MS = 1500
export const CHAIN_FRESH_MS = 15000

/**
 * Which kind of announcement an event is: 'scene', 'preset', 'grid', or null
 * for anything that is not about the chain at all.
 */
export function announcementKind(event) {
  if (event?.type === 'scene') return 'scene'
  if (event?.type === 'changed') return event.scope === 'preset' ? 'preset' : 'grid'
  return null
}

/**
 * The writes this app has made that are still waiting for their announcement.
 *
 * Each write owes exactly one, noted just before it is sent, and the first
 * matching announcement pays it off. Anything else — or the same thing
 * arriving twice — is somebody else and is followed.
 *
 * Not a quiet window after each write, deliberately: a window would swallow a
 * block that another client really did move in the same second.
 *
 * `now` is handed in so each app keeps its own clock, and a test can turn it.
 */
export function createOwnEchoes({ now = () => Date.now(), ms = OWN_ECHO_MS, pendingMs = OWN_PENDING_MS } = {}) {
  let owed = []
  const alive = (x, t) => t - x.at <= (x.answered ? ms : pendingMs)
  return {
    /** A write is about to be announced back. `value` undefined matches any. */
    owe(kind, value) {
      const token = { kind, value, at: now(), answered: false }
      owed.push(token)
      return token
    },
    /*
     * The computer announces a write BEFORE it answers it, and the write can
     * wait seconds behind a dump in the serial queue, or for the relay to
     * rejoin. So an expectation does not run out while its write is still in
     * the air: the window starts when the write is answered.
     */
    restamp(token) {
      token.at = now()
      token.answered = true
    },
    /* A write the computer refused is announced by nobody. */
    disown(token) {
      owed = owed.filter((t) => t !== token)
    },
    /** Whether this announcement is one of ours, spending it if it is. */
    take(kind, value) {
      const t = now()
      owed = owed.filter((x) => alive(x, t))
      const i = owed.findIndex((x) => x.kind === kind && (x.value === undefined || Object.is(x.value, value)))
      if (i < 0) return false
      owed.splice(i, 1)
      return true
    },
    clear() {
      owed = []
    }
  }
}

/**
 * What another client's `changed` with scope 'grid' was: 'switch' when it
 * only switched a block on or off (or moved its channel), 'chain' when the
 * chain itself changed, 'same' when the status read shows nothing new.
 *
 * The computer announces a bypass exactly as it announces a block added or
 * moved, and says nothing about who made it. So the phone's effect taps made
 * the Mac window dump the whole preset, and the Mac's made the phone do it:
 * the drop "the sound should never cut out" is about, one client removed.
 * The small status read tells them apart — the same blocks, one of them
 * switched, is a switch.
 *
 * `shown` is the chain on screen; `states` is GET /preset/scene-state;
 * `known` the ids the status read listed last time, because the status read
 * can list a block the chain does not draw.
 *
 * Anything it cannot be sure of is 'chain': no status read, a block on
 * screen that the status read does not list (removed), one it lists that
 * nobody has seen (added). 'same' is the same blocks with nothing switched:
 * a move, a model swap, a cable — or a second switch in a quick pair whose
 * first status read already showed it. The caller knows which.
 */
export function classifyGridNews(shown, states, known = new Set(), idOf = (b) => b?.effectId) {
  if (!Array.isArray(states) || !states.length || !shown?.length) return 'chain'
  const byId = new Map(states.map((s) => [s?.effectId, s]))
  const onScreen = new Set(shown.map(idOf))
  for (const id of onScreen) if (!byId.has(id)) return 'chain'
  for (const id of byId.keys()) if (!onScreen.has(id) && !known.has(id)) return 'chain'
  const switched = shown.some((b) => {
    const s = byId.get(idOf(b))
    return (typeof s.bypassed === 'boolean' && s.bypassed !== b.bypassed) || (s.channel != null && s.channel !== b.channel)
  })
  return switched ? 'switch' : 'same'
}

/**
 * Whether the computer's copy of the loaded preset is the preset on screen.
 *
 * The chain and the loaded preset's scene names both come out of one copy the
 * computer keeps for fifteen seconds, with no preset number on it. A dump of
 * the preset just left, still on the wire when the next one was chosen, is
 * kept as fresh; and a preset changed at the front panel is never told to the
 * computer at all. Either way it answers with the last song — and scene names
 * are saved, so that one would stay on this song's tiles for good.
 *
 * GET /preset/grid is answered out of the same copy and carries its name.
 * Returns the scene names when the copy is this preset, 'stale' when it is
 * another, and null when it cannot say: an AM4, whose copy holds no names; a
 * computer that did not answer; a preset whose name is not known yet (pass
 * undefined for that, not '').
 */
export function judgeCopy(copy, shownName) {
  const scenes = Array.isArray(copy?.scenes) ? copy.scenes : null
  if (!scenes?.length || typeof copy.name !== 'string') return null
  /*
   * Only a name nobody has learned yet is "cannot say". A blank name is a
   * name: an empty slot, or a preset somebody never named, and both are
   * where a preset gets built. Giving up on those sent every read of them
   * on to the summary, a dump of the slot (and on the Mac a backup, a
   * second), each time a block went in.
   */
  if (typeof shownName !== 'string') return null
  return copy.name.trim() === shownName.trim() ? scenes : 'stale'
}

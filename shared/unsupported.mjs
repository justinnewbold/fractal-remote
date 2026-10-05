/**
 * WHAT THIS UNIT HAS SAID IT CANNOT DO, so it is not asked again.
 *
 * From an AM4 log: every preset change asked GET /presets/N/summary, and
 * every few seconds GET /tempo, and the computer answered "unsupported" every
 * time — its AM4 driver has neither. Each refusal is a round trip over the
 * relay and a red line in the log, and none of them was ever going to be
 * different the next time.
 *
 * So the first 501 "unsupported" for a kind of request is remembered, and the
 * same kind is answered from memory until the unit changes. "A kind" is the
 * method and the path with its numbers taken out: preset 97's summary and
 * preset 98's are one question. Forgotten whenever the unit is detected
 * again — a different unit, or the same one behind an updated computer app,
 * may well say yes.
 *
 * Both apps use this file; the phone through the copy `npm run sync:rules`
 * writes.
 */

/** Whether a failed request was the computer saying the unit has no such thing. */
export const isUnsupported = (err) =>
  err?.status === 501 || String(err?.message || '').trim().toLowerCase() === 'unsupported'

/** The kind of request: method and path, numbers out. */
export const requestKind = (method, path) =>
  `${String(method || 'GET').toUpperCase()} ${String(path || '').split('?')[0].replace(/\/\d+(?=\/|$)/g, '/:n')}`

/* Never remembered: what decides which unit this is, and the computer's own liveness. */
const NEVER = [/^GET \/device(\/detect)?$/, /^GET \/healthz$/, /^GET \/ports$/]

export function unsupportedMemo() {
  const said = new Set()
  return {
    /** True when this kind of request has already been refused as unsupported. */
    known: (method, path) => said.has(requestKind(method, path)),
    /** Note a failure; only "unsupported" is kept. */
    heard(method, path, err) {
      const kind = requestKind(method, path)
      if (isUnsupported(err) && !NEVER.some((re) => re.test(kind))) said.add(kind)
    },
    /** A unit has just been (re)detected: ask it everything afresh. */
    forget: () => said.clear(),
    size: () => said.size
  }
}

/** The answer given from memory: shaped like the computer's own refusal. */
export function rememberedRefusal(method, path) {
  const err = new Error('unsupported')
  err.status = 501
  err.unsupported = true
  err.remembered = true
  err.kind = requestKind(method, path)
  return err
}

/**
 * What the Tap button says when the unit's tempo cannot be reached.
 *
 * "unsupported", nine times in a row, was the whole of what an AM4 said to a
 * burst of taps. It is not the button that is broken: the computer app has
 * no way to set that unit's tempo yet (docs/later.md, AM4). So the button says
 * that once, in words, and what to do instead.
 */
export const NO_TEMPO = 'The app can’t set this unit’s tempo yet. Tap tempo on the unit itself for now.'

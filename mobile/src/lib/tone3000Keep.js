/*
 * WHERE TONE3000'S PASS IS KEPT, AND WHERE ITS ONE-TIME WORD COMES FROM,
 * once a build brings the phone's secure storage and secure random numbers
 * (lib/tone3000Parts). No phone in here: lib/tone3000Here hands in the
 * phone's, and a test hands in its own.
 *
 * THE PASS MOVES ITSELF. Until that build the pass is in the app's ordinary
 * storage. The first time it is read on a copy that has the secure storage,
 * it is put there and taken out of the ordinary one, so nobody signs in
 * again because the app was updated, and nothing is left behind.
 *
 * THE RULE THAT KEEPS IT RIGHT: a value in the ordinary storage is always
 * the newest. It is there only because it has not moved yet, or because the
 * secure storage refused the last write (an Android Keystore does, on some
 * phones, some days), and every write takes it out of the ordinary storage
 * BEFORE it goes into the secure one. So reading looks in the ordinary
 * storage first, and never finds something older than what the secure one
 * holds.
 *
 * A phone whose secure storage will not take a value keeps working: the
 * value stays in the ordinary storage, as it is on every copy today, the
 * log says so once, and the next read tries the move again.
 *
 * One thing at a time for each name: a read that is moving a value and a
 * write of a newer one would otherwise cross, and the older could land on
 * top.
 */

/**
 * `plain` and `secure` are `{ get, set, remove }`, each a promise, values
 * as strings. With no `secure` this IS `plain`: a copy without the secure
 * storage behaves exactly as it always has.
 */
export function movingStore({ secure = null, plain, log = () => {} }) {
  if (!secure) return plain
  const said = new Set()
  const once = (what, err) => {
    if (said.has(what)) return
    said.add(what)
    /* The error's own words name the key and the keystore, never what was kept. */
    log(`${what}: ${err?.message || err}`)
  }

  const lanes = new Map()
  const inTurn = (key, run) => {
    const next = (lanes.get(key) || Promise.resolve()).then(run, run)
    const tail = next.then(
      () => {},
      () => {}
    )
    lanes.set(key, tail)
    /* Nothing waits for ever on a name nobody is using. */
    tail.then(() => {
      if (lanes.get(key) === tail) lanes.delete(key)
    })
    return next
  }

  /** Into the secure storage and out of the ordinary one. False when the secure storage would not take it. */
  const move = async (key, value) => {
    try {
      await secure.set(key, value)
    } catch (err) {
      once('the secure storage would not take TONE3000’s sign-in, so it stays in the ordinary storage', err)
      return false
    }
    try {
      await plain.remove(key)
    } catch (err) {
      /* It is in both, the same in each; the next read moves it again. */
      once('TONE3000’s sign-in could not be taken out of the ordinary storage after it was moved', err)
    }
    return true
  }

  return {
    get: (key) =>
      inTurn(key, async () => {
        const waiting = await plain.get(key)
        if (waiting != null) {
          await move(key, waiting)
          return waiting
        }
        return secure.get(key)
      }),
    set: (key, value) =>
      inTurn(key, async () => {
        /* Out of the ordinary storage first: from here nothing older than this write can be read from it. */
        await plain.remove(key)
        try {
          await secure.set(key, value)
        } catch (err) {
          once('the secure storage would not take TONE3000’s sign-in, so it stays in the ordinary storage', err)
          /*
           * Into the ordinary storage FIRST: stopped between these two lines,
           * the newer value is kept and is the one read. The other way round
           * there would be a moment with nothing kept at all.
           */
          await plain.set(key, value)
          /* What the secure storage holds is older than this now. If it will not let go either, the ordinary storage is read first anyway. */
          try {
            await secure.remove(key)
          } catch {
            /* nothing more to do about it here */
          }
        }
      }),
    remove: (key) =>
      inTurn(key, async () => {
        /*
         * The secure storage first, and nothing else if it will not let go:
         * the pass is then still on the device, so this says so (never
         * "signed out"), and the ordinary storage is left as it is. It may be
         * holding a NEWER value than the secure one (a write the secure
         * storage refused); taking that out would leave the older one to be
         * read from here on.
         */
        await secure.remove(key)
        await plain.remove(key)
      })
  }
}

/**
 * Random bytes for the one-time word: `count` numbers, 0 to 255, as a plain
 * list. `fill(bytes)` fills a Uint8Array from the phone's secure source;
 * `spare(count)` is what the app used before (lib/tone3000 `randomBytes`).
 * The spare is used when there is no secure source, when it throws, and
 * when it hands back nothing but noughts: a source that did nothing at all
 * would otherwise make every one-time word the same, and say nothing.
 */
export function sureRandom(fill, spare, log = () => {}) {
  if (typeof fill !== 'function') return spare
  let said = false
  return (count) => {
    try {
      const bytes = new Uint8Array(count)
      const got = fill(bytes) || bytes
      if (got.length !== count) throw new Error(`asked for ${count} random numbers and got ${got.length}`)
      const out = Array.from(got)
      /* Eight noughts in a row by chance is one time in 18 million million million. */
      if (count >= 8 && out.every((b) => b === 0)) throw new Error('the secure random numbers came back all nought')
      return out
    } catch (err) {
      if (!said) {
        said = true
        log(`the phone’s secure random numbers were not used: ${err?.message || err}`)
      }
      return spare(count)
    }
  }
}

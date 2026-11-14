/*
 * TONE3000'S LIST, IN THE APP: what is asked for, when, and what is shown
 * of the answer. No phone and no screen in here: components/Tone3000Browser
 * draws what this holds, and lib/tone3000's client does the asking.
 *
 * "It to look like that and function like that. Not just going off a
 * built-in web browser in our app but actually native in our app using the
 * API." (Justin, 14 November 2026, with a picture of the Tones tab of his
 * HeadRush app.) That tab (headrush mobile/src/t3k.tsx) is what this copies:
 * a search box with a Search button, one row of chips for the order
 * (Trending, Newest, Most downloaded) and the kind of gear, 25 tones to a
 * page with More under them, and a tap on a tone opens it. There the board
 * asks TONE3000; here the phone does.
 *
 * WHAT IS ASKED, AND ONLY THEN. TONE3000 limits its search more heavily
 * than anything else it answers, and asks apps to respect that. So nothing
 * is asked for on a keystroke or a timer: only when the screen opens, when
 * Search is tapped, when a chip is, and for More.
 *
 * A LATE ANSWER IS DROPPED. Each question is numbered, and an answer to
 * anything but the newest is thrown away: tap Newest and then Trending and
 * the list is Trending's, whichever of the two comes back last.
 *
 * WHERE SEARCH IS NOT OPEN TO THIS APP'S KEY (TONE3000 answers 403; its
 * search is for apps with a commercial agreement), the screen is not a dead
 * end: Trending and Newest show TONE3000's own short lists, ten at most
 * (fewer once cut down to what the NAM block plays), which every key may
 * ask for, and the screen says that is what they are.
 * It is remembered for as long as the screen is up, so search is not asked
 * again and again for the same no.
 *
 * NOTHING IS KEPT. The list lives while the screen is up and is asked for
 * again the next time it opens (their terms: nothing cached).
 */
import { gearSaid, T3K_GEARS, T3K_SORTS } from './tone3000.js'

export const ASKING = 'Asking TONE3000…'
export const NO_TONES = 'No tones found.'
/*
 * Search is not open to this app's key. Each says what the rows under it
 * are (no number: TONE3000's ten are cut down here to what the NAM block
 * plays, and for Newest to the kind of gear asked for), and where the rest
 * is. "Every capture the NAM block can play", not "everything": TONE3000's
 * own page is opened for those captures alone.
 */
const ELSEWHERE = 'Browse TONE3000, below, has every capture the NAM block can play.'
/** There is a short list of what is trending to show instead. */
export const TRENDING_ONLY = `TONE3000 hasn’t opened its search to this app yet, so this is its own short trending list. ${ELSEWHERE}`
/** There is a short list of the newest to show instead. */
export const NEWEST_ONLY = `TONE3000 hasn’t opened its search to this app yet, so these are from its newest tones. ${ELSEWHERE}`
/** There is nothing to show instead (a search for words, or Most downloaded). */
export const SEARCH_NOT_OPEN = `TONE3000 hasn’t opened its search to this app yet. ${ELSEWHERE}`

/** 44988 as "44,988". Written out: the phone's engine is not relied on for it. */
export function grouped(n) {
  const whole = Math.max(0, Math.floor(Number(n) || 0))
  return String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

/** Who made a tone, as TONE3000 shows them: the name a verified creator set, else the username. */
export const creatorOf = (tone) => tone?.user?.display_name || tone?.user?.username || ''

/** The small line under a tone's title: who made it, the kind of gear, the format, how often it has been downloaded. */
export function toneLine(tone) {
  const parts = [creatorOf(tone), gearSaid(tone?.gear), 'NAM']
  if (tone?.downloads_count != null) parts.push(`${grouped(tone.downloads_count)} download${Number(tone.downloads_count) === 1 ? '' : 's'}`)
  return parts.filter(Boolean).join(' · ')
}

/** A tone's picture, or null: the first of its images, when it is a web address. */
export const toneImage = (tone) => {
  const first = Array.isArray(tone?.images) ? tone.images[0] : null
  return typeof first === 'string' && /^https:\/\//.test(first) ? first : null
}

/** A creator's picture, or null. */
export const creatorImage = (tone) => {
  const at = tone?.user?.avatar_url
  return typeof at === 'string' && /^https:\/\//.test(at) ? at : null
}

/** TONE3000's short list that stands in for an order when search is closed, or null where there is none. */
const feedFor = (sort) => (sort === 'trending' ? 'trending' : sort === 'newest' ? 'latest' : null)

/**
 * Whether to say "No tones found": a question was asked, answered, and
 * the answer was empty. Not while one is out, not over a fault, and not
 * where nothing was asked because search is closed (that note says why).
 */
export const nothingFound = (state) => !!state?.tones && !state.tones.length && !state.busy && !state.fault && state.note !== SEARCH_NOT_OPEN

/**
 * The list. `search(what)` and `feed(which, gear)` are lib/tone3000's.
 * `get()` is `{ query, sort, gear, tones, page, pages, total, busy, fault,
 * note }`: `tones` is null until the first answer, `busy` is 'list' while a
 * first page is out and 'more' while a further one is.
 */
export function toneBrowser({ search, feed }) {
  let state = { query: '', sort: T3K_SORTS[0].key, gear: T3K_GEARS[0].key, tones: null, page: 0, pages: 1, total: 0, busy: null, fault: '', note: '' }
  const heard = new Set()
  let asked = 0
  /* TONE3000 said no to search for this app's key, for as long as this list is up. */
  let closed = false

  const put = (next) => {
    state = { ...state, ...next }
    for (const f of [...heard]) f(state)
  }

  /** TONE3000's own short list in place of a search it will not answer. */
  const short = async (mine) => {
    const which = feedFor(state.sort)
    /* Words typed, or an order with no short list of its own: nothing stands in for those. */
    if (!which || state.query) {
      put({ tones: [], page: 1, pages: 1, total: 0, busy: null, fault: '', note: SEARCH_NOT_OPEN })
      return
    }
    try {
      const tones = await feed(which, state.gear)
      if (mine !== asked) return
      put({ tones, page: 1, pages: 1, total: tones.length, busy: null, fault: '', note: which === 'latest' ? NEWEST_ONLY : TRENDING_ONLY })
    } catch (err) {
      if (mine !== asked) return
      put({ tones: [], page: 1, pages: 1, total: 0, busy: null, fault: err?.message || 'TONE3000 couldn’t be reached.', note: '' })
    }
  }

  const run = async (page) => {
    const mine = ++asked
    const first = page <= 1
    put({ busy: first ? 'list' : 'more', fault: '', ...(first ? { note: '' } : null) })
    if (closed) {
      if (first) await short(mine)
      /* No further page will come: the list ends where it is, so More goes with it. */
      else put({ busy: null, pages: state.page })
      return
    }
    try {
      const got = await search({ query: state.query, page, sort: state.sort, gear: state.gear })
      if (mine !== asked) return
      /* A further page is added under what is there; a tone TONE3000 hands over twice (the list moved between the two pages) is shown once. */
      const had = first ? [] : state.tones || []
      const seen = new Set(had.map((t) => t.id))
      const tones = [...had, ...got.tones.filter((t) => !seen.has(t.id))]
      put({ tones, page: got.page, pages: got.pages, total: got.total, busy: null, fault: '', note: '' })
    } catch (err) {
      if (mine !== asked) return
      if (err?.status === 403) {
        closed = true
        if (first) await short(mine)
        /* Refused part-way down a list: what is there stays, and it ends there. A More left up would ask nothing for ever. */
        else put({ busy: null, pages: state.page, note: SEARCH_NOT_OPEN })
        return
      }
      /* A first page that failed leaves nothing under the new question (the old list would read as its answer), and no More under nothing; a further one leaves what is there. */
      put({ busy: null, fault: err?.message || 'TONE3000 couldn’t be reached.', ...(first ? { tones: [], page: 1, pages: 1, total: 0 } : null) })
    }
  }

  return {
    get: () => state,
    subscribe(f) {
      heard.add(f)
      return () => heard.delete(f)
    },
    /** The first list, when the screen opens. Asks once: a screen drawn again has what it has. */
    start() {
      if (state.tones === null && !state.busy) return run(1)
      return Promise.resolve()
    },
    /** Search was tapped, with what is in the box. */
    find(query) {
      put({ query: String(query || '').trim() })
      return run(1)
    },
    /*
     * A chip asks with what is in the box (`query`, where the screen hands
     * it over), as Search does and as the HeadRush tab's chips do: the rows
     * are never an answer to words the box no longer shows. Still one
     * question a tap.
     */
    /** A chip for the order. The one already on asks nothing. */
    sort(key, query) {
      if (key === state.sort || !T3K_SORTS.some((s) => s.key === key)) return Promise.resolve()
      put({ sort: key, ...(query === undefined ? null : { query: String(query || '').trim() }) })
      return run(1)
    },
    /** A chip for the kind of gear. The one already on asks nothing. */
    gear(key, query) {
      if (key === state.gear || !T3K_GEARS.some((g) => g.key === key)) return Promise.resolve()
      put({ gear: key, ...(query === undefined ? null : { query: String(query || '').trim() }) })
      return run(1)
    },
    /** More: the next page, where there is one and nothing is out. */
    more() {
      if (state.busy || !state.tones || state.page >= state.pages) return Promise.resolve()
      return run(state.page + 1)
    },
    /** Whether More has anything to fetch. */
    hasMore: () => !!state.tones && state.page < state.pages
  }
}

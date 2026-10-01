/**
 * EDIT'S PAGES, the way Fractal's own editor splits a block.
 *
 * "Splitting EDIT's long list of controls into pages, like Fractal's own
 * editor." The unit already says what those pages are: a block's params read
 * carries `layout` — the editor's pages, each a set of rows of controls, each
 * control naming the parameter it turns — on the four units that ship one
 * (FM3, FM9, Axe-Fx III, AM4). A Drive reads Basic, Tone, Graphic EQ,
 * Advanced; an Amp reads Authentic, Ideal, Preamp, Power Amp and on.
 *
 * Before this the list was cut after six controls into Main and More, which
 * put an amp's Presence three pages of scrolling away from its Bass.
 *
 * WHAT GOES ON A PAGE: the controls in its `parameters` rows that this app
 * draws as knobs — `editable` is already the list with levels taken out, and
 * a control the list does not have (a switch, a dropdown, a spacer) is left
 * out rather than drawn as something it is not. A control the editor shows on
 * two pages is on both here too, which is what somebody who knows the editor
 * expects to find.
 *
 * ONLY TODAY'S PAGES. "Phaser has two More tabs." The layout carries pages
 * that only exist on old firmware whenever no newer page shares their name, so
 * a Phaser came up with eight tabs where Fractal's editor shows three. A page
 * marked for firmware below some version is left out — unless every page is,
 * as on some Tremolos, and then the newest of them stay, so there is always
 * something to turn. And no two tabs ever share a name.
 *
 * WHAT A KNOB IS CALLED: what Fractal's editor calls it on that page ("Bright
 * Cap", "62 Hz"), with its line breaks made spaces. The server's name was the
 * catalog's, and where the catalog has none that is the raw internal one,
 * numbered across the whole block ("Gain 3", "Presence 2"). Where two controls
 * on one page carry the same caption, both keep the server's name, which at
 * least tells them apart. The bare numbers on an EQ page are frequencies, so
 * they say so — "80 Hz", "2 kHz" — and nowhere else, because a Vocoder's "1" to
 * "24" are bands, not hertz.
 *
 * METERS ARE NOT KNOBS. "Gain", "HEADROOM" and "B+" on an amp are read-outs on
 * the unit, and the layout says so; drawing them as knobs invited turning
 * something that does nothing. A control the layout marks as a meter anywhere
 * is left out.
 *
 * WHAT IS LEFT: the `mixer` rows, which the editor repeats under every page
 * (Mix, Balance), go on one page of their own, Mix. Anything the layout never
 * places at all goes last, on Hidden, which says why it is there — Fractal's
 * own editor does not show these, but the unit sent them, and nothing it sent
 * is unreachable.
 *
 * AND WITHOUT A LAYOUT — the older units, or a block the editor has none for
 * — it is the old split, six and the rest.
 */
export const FIRST_PAGE = 6

/** The last tab's name and its one line. "Hidden" read as a tab of things
    you are not meant to touch, which is not what it holds. */
export const HIDDEN_PAGE = 'Extras'
export const HIDDEN_NOTE = 'Fractal’s own editor doesn’t show these.'

/** "maj,min" as one comparable number; nothing is 0. */
const fwBound = (v) => {
  const [maj = 0, min = 0] = String(v || '')
    .split(',')
    .map((s) => Number(s.trim()) || 0)
  return maj * 1000 + min
}

/** A page that only exists below some firmware version. */
const oldFirmware = (page) => page?.fw?.lt != null

/** Today's pages, or — when there are none — the newest of the old ones. */
export function currentPages(layout) {
  const all = (layout?.pages || []).filter(Boolean)
  const now = all.filter((p) => !oldFirmware(p))
  if (now.length || !all.length) return now
  const newest = Math.max(...all.map((p) => fwBound(p.fw.lt)))
  return all.filter((p) => fwBound(p.fw.lt) === newest)
}

/*
 * A control turning ANOTHER block's setting. Its paramId is that block's
 * number, not this one's: an FM3 Multitap is handed the Delay block's page,
 * whose DELAY_LEVEL is id 1 — and id 1 on a Multitap is "Delay 1". Matched on
 * the number alone, turning "Level" moved a delay time. So a control is only
 * this block's when its name says so, and the rest are not matched at all.
 */
const foreign = (control, family) =>
  !!control?.crossBlock || !!(family && control?.paramName && !String(control.paramName).startsWith(`${family}_`))

/** Every setting the layout draws as a meter, on any page. */
function meterIds(layout) {
  const out = new Set()
  for (const page of layout?.pages || [])
    for (const row of page?.rows || [])
      for (const c of row?.controls || [])
        if (c?.widget === 'meter' && c.paramId != null && !foreign(c, layout?.family)) out.add(c.paramId)
  return out
}

/** A caption on one line. */
const oneLine = (label) =>
  String(label ?? '')
    .replace(/\s+/g, ' ')
    .trim()

/** An EQ band's bare number, as the frequency it is. */
function bandLabel(label) {
  const hz = /^(\d+(?:\.\d+)?)$/.exec(label)
  if (hz) return `${hz[1]} Hz`
  const khz = /^(\d+(?:\.\d+)?)\s*k$/i.exec(label)
  if (khz) return `${khz[1]} kHz`
  return label
}

const isEqPage = (page) => /\bEQ\b/i.test(page?.name || '')

/**
 * The controls of some rows, each with the name it goes by here: the caption,
 * unless it is empty or repeats among these, and then the server's name.
 */
function labelled(found, eq) {
  const count = new Map()
  for (const { caption } of found) if (caption) count.set(caption, (count.get(caption) || 0) + 1)
  return found.map(({ p, caption }) => ({
    ...p,
    label: caption && count.get(caption) === 1 ? (eq ? bandLabel(caption) : caption) : p.name
  }))
}

function collect(page, section, byId, meters, family) {
  const found = []
  for (const row of page?.rows || []) {
    if (row?.section !== section) continue
    for (const control of row.controls || []) {
      if (foreign(control, family)) continue
      const p = byId.get(control?.paramId)
      if (!p || meters.has(p.id) || found.some((f) => f.p === p)) continue
      found.push({ p, caption: oneLine(control.label) })
    }
  }
  return found
}

/** No two tabs with one name: a second "Basic" is "Basic 2". */
function uniqueNames(pages) {
  const seen = new Map()
  return pages.map((pg) => {
    const n = (seen.get(pg.name) || 0) + 1
    seen.set(pg.name, n)
    return n === 1 ? pg : { ...pg, name: `${pg.name} ${n}` }
  })
}

const asIs = (p) => ({ ...p, label: p.name })

export function editPages(editable, layout) {
  const list = editable || []
  const meters = meterIds(layout)
  const drawn = list.filter((p) => !meters.has(p.id))
  const byId = new Map(drawn.map((p) => [p.id, p]))
  const kept = currentPages(layout)
  const placed = new Set()
  const pages = []
  for (const page of kept) {
    const found = collect(page, 'parameters', byId, meters, layout?.family)
    if (!found.length) continue
    for (const f of found) placed.add(f.p.id)
    pages.push({
      key: `page-${pages.length}`,
      name: oneLine(page.name) || `Page ${pages.length + 1}`,
      params: labelled(found, isEqPage(page))
    })
  }

  if (!pages.length) {
    const main = drawn.slice(0, FIRST_PAGE).map(asIs)
    const more = drawn.slice(FIRST_PAGE).map(asIs)
    return more.length
      ? [
          { key: 'main', name: 'Main', params: main },
          { key: 'more', name: 'More', params: more }
        ]
      : [{ key: 'main', name: 'Main', params: main }]
  }

  /* The mixer rows, once, from whichever page has each first. */
  const mixed = []
  for (const page of kept) {
    for (const f of collect(page, 'mixer', byId, meters, layout?.family)) {
      if (placed.has(f.p.id) || mixed.some((m) => m.p === f.p)) continue
      mixed.push(f)
    }
  }
  if (mixed.length) {
    for (const f of mixed) placed.add(f.p.id)
    pages.push({ key: 'mix', name: 'Mix', params: labelled(mixed, false) })
  }

  const left = drawn.filter((p) => !placed.has(p.id))
  if (left.length) pages.push({ key: 'hidden', name: HIDDEN_PAGE, note: HIDDEN_NOTE, params: left.map(asIs) })
  return uniqueNames(pages)
}

/**
 * Every control the pages would draw, once, under the name its first page
 * gives it — so a search finds "Bright Cap" where the knob says Bright Cap,
 * and never offers a meter to turn.
 *
 * And where two settings on different pages carry one caption (the amp's
 * main Gain and its Input EQ Gain), the page tells them apart: "Gain · Input
 * EQ". Otherwise the search fell back to a range in brackets, "Gain
 * (-20-20)", which is on neither knob.
 */
export function namedAsOnPages(params, layout) {
  const first = new Map()
  for (const page of editPages(params, layout))
    for (const p of page.params) if (!first.has(p.id)) first.set(p.id, { label: p.label, page: page.name })
  const times = new Map()
  for (const { label } of first.values()) times.set(label, (times.get(label) || 0) + 1)
  return (params || [])
    .filter((p) => first.has(p.id))
    .map((p) => {
      const { label, page } = first.get(p.id)
      return { ...p, label: times.get(label) > 1 ? `${label} · ${page}` : label }
    })
}

/** The page a tab key names, or the first one when the pages have changed under it. */
export const pageFor = (pages, key) => pages.find((p) => p.key === key) || pages[0]

/** The first page holding a control, for a search that lands on it. */
export const pageHolding = (pages, paramId) => pages.find((p) => p.params.some((q) => q.id === paramId))

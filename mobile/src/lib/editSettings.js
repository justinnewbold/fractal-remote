/**
 * A BLOCK'S SETTINGS THAT ARE PICKED FROM A LIST, under its knobs in Edit.
 *
 * Edit drew knobs and nothing else. A setting that is one of a list (Bypass
 * Mode, Tone Stack Type, Input Mode) came back with every block's read, in
 * `enums`, and had nowhere to go: it was read, guarded, could be written,
 * and had nothing on screen. Shown three ways on a NAM block (A, a row for
 * each that opens a list; B, buttons for a short list and a row for a long
 * one; C, a tab of its own), Justin picked B: "Yes, I like B for the edit
 * screen" and "Menu style B" (13 November 2026).
 *
 * B, AS BUILT. Under the knobs of the page that is showing, a SETTINGS
 * heading and one entry a setting: two or three choices are buttons, all on
 * show, one tap (`SHORT_MOST`); more is a row with the choice it is on, which
 * opens the list. Every choice is said in the unit's own words, as the read
 * gave them ("THRU", "SUM L+R"): nothing is renamed or tidied here.
 *
 * WHICH PAGE A SETTING IS ON: the one Fractal's own editor has it on, as the
 * knobs are (lib/editPages, which this reads and does not change: that file
 * is the browser's too). A block's read carries the editor's pages, each a
 * set of rows of controls; a setting goes with the knobs of every page that
 * has a control for it. Its mixer rows, which the editor repeats under every
 * page, go with the Mix page. What the editor places on a page with no knobs
 * of ours, or nowhere, goes on the last page there is (Extras, where the
 * unit's leftovers already are), so nothing the unit sent is unreachable.
 * With no pages from the unit, which is every block of an older unit and an
 * Axe-Fx III's own blocks, the settings go on the last page: for a NAM
 * block, the only one.
 *
 * LEFT OUT: a list with nothing to choose (one choice), one whose choices
 * have no names (the unit gave only their numbers), the block's own bypass, and
 * every setting of a Cab block, whose lists are impulse responses and mics
 * that the cab picker owns (and that a phone over Bluetooth has no names
 * for).
 *
 * Pure: it imports the editor's page rule and nothing else, so a test runs
 * it as it is.
 */
import { currentPages } from './editPages.js'

/** The heading over them. */
export const SETTINGS_HEAD = 'SETTINGS'

/** The most choices drawn as buttons; one more and it is a row that opens a list. */
export const SHORT_MOST = 3

/** Blocks whose lists are not drawn here: the cab picker owns a Cab's. */
export const NO_SETTINGS_ON = Object.freeze(['cab'])

/** How many choices a list sheet shows before it offers a box to find one in. */
export const FIND_FROM = 13

const named = (o) => typeof o?.label === 'string' && o.label.trim() !== '' && o.label.trim() !== String(o.value)

/** The settings of a block's read that can be drawn: see LEFT OUT above. */
export function blockSettings(enums, slug) {
  if (NO_SETTINGS_ON.includes(String(slug || '').toLowerCase())) return []
  const seen = new Set()
  const out = []
  for (const s of Array.isArray(enums) ? enums : []) {
    if (!s || !Number.isInteger(s.id) || seen.has(s.id)) continue
    if (typeof s.name !== 'string' || !s.name.trim() || /^bypass$/i.test(s.name.trim())) continue
    const options = Array.isArray(s.options) ? s.options.filter((o) => o && Number.isInteger(o.value)) : []
    /* Names for its choices: at least one the unit named, and none with no words at all. (A list of OFF, 1, 2, 3 is named; one of 0, 1, 2 is only numbers.) */
    if (options.length < 2 || !options.some(named) || !options.every((o) => typeof o.label === 'string' && o.label.trim() !== '')) continue
    seen.add(s.id)
    out.push({ id: s.id, name: s.name.trim(), value: s.value, options: options.map((o) => ({ value: o.value, label: o.label.trim() })) })
  }
  return out
}

/** Buttons, or a row that opens a list. */
export const settingKind = (setting) => (setting.options.length <= SHORT_MOST ? 'buttons' : 'list')

/** The choice a setting is on: the one just tapped while its write is out (`picked`), else what the unit said. */
export const settingValue = (setting, picked) => (picked && picked[setting.id] !== undefined ? picked[setting.id] : setting.value)

/** What the row says it is on, in the unit's words; a number the list has no name for is said as the number. */
export const choiceSaid = (setting, value) => setting.options.find((o) => o.value === value)?.label ?? String(value ?? '')

/** The choices a find box leaves: every word typed, anywhere in the name. */
export function choicesFound(setting, text) {
  const words = String(text || '').toLowerCase().split(/\s+/).filter(Boolean)
  if (!words.length) return setting.options
  return setting.options.filter((o) => words.every((w) => o.label.toLowerCase().includes(w)))
}

/* A control that turns another block's setting (lib/editPages `foreign`, the same rule): never this block's. */
const foreign = (control, family) => !!control?.crossBlock || !!(family && control?.paramName && !String(control.paramName).startsWith(`${family}_`))

const idsIn = (page, family, want) => {
  const out = new Set()
  for (const row of page?.rows || []) {
    if (!want(row?.section)) continue
    for (const c of row?.controls || []) if (c?.paramId != null && !foreign(c, family)) out.add(c.paramId)
  }
  return out
}

/**
 * Which settings go under the knobs of each of Edit's pages: a Map from a
 * page's key (lib/editPages) to its settings, in the read's order.
 *
 * @param settings  blockSettings()
 * @param layout    the read's `layout`, or null
 * @param pages     editPages()'s answer for the same read
 */
export function settingsByPage(settings, layout, pages) {
  const byPage = new Map()
  const list = Array.isArray(pages) ? pages.filter(Boolean) : []
  if (!settings?.length || !list.length) return byPage
  const last = list[list.length - 1].key
  const put = (key, s) => {
    if (!byPage.has(key)) byPage.set(key, [])
    if (!byPage.get(key).includes(s)) byPage.get(key).push(s)
  }
  const family = layout?.family
  /*
   * The editor's pages that became pages here, in order: one with a knob of
   * ours in its parameter rows (lib/editPages makes a page of exactly those,
   * keyed page-0, page-1 and on). Every knob drawn is on some page, so the
   * knobs on all of them together are the knobs there are.
   */
  const knobIds = new Set(list.flatMap((pg) => (pg.params || []).map((p) => p.id)))
  const ours = list.filter((pg) => /^page-\d+$/.test(pg.key))
  const theirs = currentPages(layout).filter((page) => [...idsIn(page, family, (section) => section === 'parameters')].some((id) => knobIds.has(id)))
  const mix = list.find((pg) => pg.key === 'mix')
  const placed = new Set()
  if (ours.length === theirs.length) {
    theirs.forEach((page, i) => {
      const here = idsIn(page, family, (section) => section !== 'mixer')
      const mixed = idsIn(page, family, (section) => section === 'mixer')
      for (const s of settings) {
        if (here.has(s.id)) {
          put(ours[i].key, s)
          placed.add(s.id)
        } else if (mixed.has(s.id) && mix) {
          put(mix.key, s)
          placed.add(s.id)
        }
      }
    })
  }
  for (const s of settings) if (!placed.has(s.id)) put(last, s)
  /* In the read's own order on every page, whichever way they were found. */
  for (const [key, on] of byPage) byPage.set(key, settings.filter((s) => on.includes(s)))
  return byPage
}

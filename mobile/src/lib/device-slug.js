/* Generated from shared/device-slug.mjs by scripts/sync-relay-rules.mjs.
 * Do not edit. Change the source and run `npm run sync:rules`; the test suite
 * fails on any difference between the two. */

/**
 * The name a unit's own things are filed under.
 *
 * Setlists, stars and which of them Previous and Next step through are all kept
 * per unit, because slot 4 on an FM3 and slot 4 on an AM4 are different sounds
 * and a setlist of one must never play as the other.
 *
 * "Per unit" means per THIS STRING. Two apps that derive it differently do not
 * disagree loudly — they file into two buckets that never meet, so a setlist
 * built at the Mac is simply not on the phone, and the sync that is supposed to
 * carry it across has nothing to match on. That failure is silent, survives a
 * reinstall, and looks exactly like a sync that is broken.
 *
 * So it lives here, once, and both apps are handed the same copy by
 * `npm run sync:rules`.
 *
 * The rule itself is the browser's, unchanged: the unit's short name if it has
 * one, otherwise its long name, lowercased with everything that is not a letter
 * or a digit removed. `FM3` and `Axe-Fx III` become `fm3` and `axefxiii`.
 *
 * `'device'` is the fallback, and it is deliberately a real bucket rather than
 * null: a unit that answered without naming itself still has setlists worth
 * keeping, and they are better in a shared drawer than dropped.
 */
export const DEFAULT_SLUG = 'device'

/**
 * @param {{short?: string, name?: string}|string|null|undefined} unit
 *   Either the detect response, or a label already pulled out of it.
 */
export function deviceSlug(unit) {
  const label = typeof unit === 'string' ? unit : unit?.short || unit?.name
  if (!label) return DEFAULT_SLUG
  return String(label).toLowerCase().replace(/[^a-z0-9]/g, '') || DEFAULT_SLUG
}

/**
 * THE DEMO'S OWN DRAWER, for the stars, the setlists and which of them
 * Previous and Next step through.
 *
 * The demo's FM3 and a real FM3 both come out of deviceSlug as 'fm3', so the
 * demo filed its stars and setlists in the real unit's drawer. The 2 November
 * 2026 audit found it going wrong two ways. A star tapped in the demo on a new
 * phone, and then a sign-in: that tap was the newest the account had seen, so
 * the sync kept it whole (lib/setlistMerge: the later tap wins) and the real
 * stars on every device were replaced by the demo's. And somebody signed in
 * who opened the demo to look around was editing the real gig setlist.
 *
 * So in the demo they are filed under `fm3:demo`, the way the preset names
 * already are (nameOwner, on both ends), and outside it under the slug exactly
 * as before, so every drawer already on a phone or in a browser reads as it
 * did. A real slug never has a colon in it (deviceSlug keeps letters and
 * digits only), so the two can never meet.
 *
 * The demo's drawer stays on the device it was made on: lib/setlistMerge
 * leaves every key isDemoStage answers for out of the sync, both ways.
 */
export const DEMO_STAGE = ':demo'

/** Where a unit's stars and setlists are filed: `slug` as it always was, or the demo's own drawer while `demo` is true. */
export const stageKey = (slug, demo) => (demo ? `${slug || DEFAULT_SLUG}${DEMO_STAGE}` : slug)

/** Whether a drawer is the demo's, and so never the account's. */
export const isDemoStage = (key) => typeof key === 'string' && key.endsWith(DEMO_STAGE)

/**
 * WHETHER ANOTHER UNIT ANSWERED THAN THE LAST REAL ONE.
 *
 * Two computers on one account, an FM3 on one and an AM4 on the other: at
 * launch the FM3's answered first, and once the AM4's was found, the AM4's
 * preset 53 kept the FM3's scene names for preset 53 ("FREAK ON A LEASH"),
 * because a row of tiles that has names is never asked again. A unit that
 * changed is a clean start for both ends (rig.startClean on the phone,
 * deviceState.startClean in the browser).
 *
 * `was` is the last REAL unit read, not the starting 'device', or the first
 * connect of every launch would start clean too; and a unit that went
 * missing and came back the same is not another one.
 */
export function unitMoved(was, now) {
  const real = (slug) => typeof slug === 'string' && slug !== '' && slug !== DEFAULT_SLUG
  return real(was) && real(now) && was !== now
}

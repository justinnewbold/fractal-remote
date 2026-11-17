/**
 * A NEW APP STORE VERSION'S TEXTS, WRITTEN FOR JUSTIN ON HIS WORD.
 *
 * "Are you sure you can't edit those lines for me? I believe you can"
 * (17 November 2026, of the 2.0.0 review notes, What's New and one sentence
 * of the Description). The standing rule is still that he sets the listing
 * himself; this is for the one version he asks for, named in
 * store/app-store/<version>.json, and it never presses Add for Review.
 *
 * What it does, each step skipped where it is already so:
 *   - makes the version in App Store Connect if it is not there;
 *   - attaches the build;
 *   - What's New: the file's text;
 *   - Description: the file's sentence swaps, on what is there;
 *   - Notes for App Review: the file's swaps on what is there (the newest
 *     earlier version's notes where the new one has none), the "New in"
 *     block and the Tested on line replaced. The notes hold private links
 *     and a login, so they are changed inside this job and NEVER printed:
 *     only which swaps were made, and sizes.
 *
 *   node scripts/store-release.mjs 2.0.0           says what it would do
 *   node scripts/store-release.mjs 2.0.0 --apply   does it, then reads it back
 */
import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { APPLE } from '../shared/stores.mjs'
import { token } from './store-text.mjs'

/** One sentence for another, exactly once; says whether it was there, already done, or missing. */
export function swap(text, [from, to]) {
  if (text.includes(to)) return { text, did: 'already' }
  const n = text.split(from).length - 1
  if (n !== 1) return { text, did: n ? 'ambiguous' : 'missing' }
  return { text: text.replace(from, () => to), did: 'changed' }
}

/** The "New in x:" heading and the bullets under it, replaced whole. */
export function newBlock(notes, block) {
  if (notes.includes(block)) return { text: notes, did: 'already' }
  const lines = notes.split('\n')
  const at = lines.findIndex((l) => /^New (in|since) \d/.test(l))
  if (at < 0) return { text: notes, did: 'missing' }
  let end = at + 1
  while (end < lines.length && /^\s*•/.test(lines[end])) end++
  if (end === at + 1) return { text: notes, did: 'missing' }
  lines.splice(at, end - at, ...block.split('\n'))
  return { text: lines.join('\n'), did: 'changed' }
}

export function testedOn(notes, line) {
  if (notes.includes(line)) return { text: notes, did: 'already' }
  const lines = notes.split('\n')
  const at = lines.findIndex((l) => l.startsWith('Tested on:'))
  if (at < 0) return { text: notes, did: 'missing' }
  lines[at] = line
  return { text: lines.join('\n'), did: 'changed' }
}

/** Every change to the notes, with a report that names no word of them. */
export function newNotes(notes, plan) {
  const report = []
  let text = notes
  for (const pair of plan.notes ?? []) {
    const r = swap(text, pair)
    text = r.text
    report.push(`"${pair[0].slice(0, 40)}…": ${r.did}`)
  }
  const b = newBlock(text, plan.notesNew)
  text = b.text
  report.push(`the New in block: ${b.did}`)
  const t = testedOn(text, plan.testedOn)
  text = t.text
  report.push(`the Tested on line: ${t.did}`)
  const bytes = Buffer.byteLength(text)
  if (bytes > 4000) throw new Error(`the notes would be ${bytes} bytes; App Store Connect takes 4000`)
  if (/VP4/i.test(plan.notesNew + plan.whatsNew + plan.testedOn)) throw new Error('a VP4 in a text for Apple')
  return { text, report, bad: report.filter((l) => /missing|ambiguous/.test(l)) }
}

async function main() {
  const version = process.argv[2]
  const apply = process.argv.includes('--apply')
  if (!/^\d+\.\d+\.\d+$/.test(version ?? '')) throw new Error('which version? e.g. 2.0.0')
  const plan = JSON.parse(readFileSync(new URL(`../store/app-store/${version}.json`, import.meta.url), 'utf8'))
  const { ASC_KEY_ID: keyId, ASC_ISSUER_ID: issuerId, ASC_KEY_PATH: keyPath } = process.env
  if (!keyId || !issuerId || !keyPath) throw new Error('ASC_KEY_ID, ASC_ISSUER_ID and ASC_KEY_PATH are all needed')
  const jwt = token({ keyId, issuerId, p8: readFileSync(keyPath, 'utf8') })
  const asc = async (path, init = {}, { missingIsNone = false } = {}) => {
    const res = await fetch(`https://api.appstoreconnect.apple.com${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' }
    })
    if (missingIsNone && res.status === 404) return null
    /* Apple's refusals are printed by status, code and title only: a body could echo what was sent. */
    if (!res.ok) {
      let why = ''
      try {
        why = (JSON.parse(await res.text()).errors ?? []).map((e) => `${e.code}: ${e.title}`).join('; ')
      } catch {}
      throw new Error(`${init.method ?? 'GET'} ${path.split('?')[0]} answered ${res.status} ${why}`)
    }
    const body = await res.text()
    return body ? JSON.parse(body) : null
  }
  const say = (did, what) => console.log(`${apply ? did : 'would be ' + did}: ${what}`)

  const { data: versions } = await asc(`/v1/apps/${APPLE.id}/appStoreVersions?filter[platform]=IOS&limit=20`)
  let mine = versions.find((v) => v.attributes.versionString === version)
  const state = (v) => v.attributes.appVersionState ?? v.attributes.appStoreState
  if (mine && !/PREPARE_FOR_SUBMISSION|REJECTED/.test(state(mine))) {
    throw new Error(`${version} is ${state(mine)}: not a version that can be edited`)
  }
  if (!mine) {
    say('made', `version ${version}`)
    if (apply) {
      mine = (
        await asc('/v1/appStoreVersions', {
          method: 'POST',
          body: JSON.stringify({
            data: {
              type: 'appStoreVersions',
              attributes: { platform: 'IOS', versionString: version },
              relationships: { app: { data: { type: 'apps', id: APPLE.id } } }
            }
          })
        })
      ).data
    }
  } else console.log(`version ${version} is there (${state(mine)})`)

  /* The build. */
  const { data: builds } = await asc(
    `/v1/builds?filter[app]=${APPLE.id}&filter[version]=${plan.build}&filter[preReleaseVersion.version]=${version}&limit=5`
  )
  if (builds.length !== 1) throw new Error(`looked for build ${version} (${plan.build}) and found ${builds.length}`)
  console.log(`build ${version} (${plan.build}) is ${builds[0].attributes.processingState}`)
  if (mine) {
    const has = await asc(`/v1/appStoreVersions/${mine.id}/relationships/build`, {}, { missingIsNone: true })
    if (has?.data?.id === builds[0].id) console.log('the build is already attached')
    else {
      say('attached', `build ${plan.build}`)
      if (apply) {
        await asc(`/v1/appStoreVersions/${mine.id}/relationships/build`, {
          method: 'PATCH',
          body: JSON.stringify({ data: { type: 'builds', id: builds[0].id } })
        })
      }
    }
  }

  /* What's New and the Description, on the version's own texts, or the newest earlier version's where it is not made yet. */
  const older = versions.filter((v) => v !== mine && /READY_FOR/.test(state(v)))[0]
  const from = mine ?? older
  const { data: locales } = await asc(`/v1/appStoreVersions/${from.id}/appStoreVersionLocalizations`)
  for (const locale of locales) {
    const a = locale.attributes
    let description = a.description ?? ''
    const said = []
    for (const pair of plan.description ?? []) {
      const r = swap(description, pair)
      description = r.text
      said.push(r.did)
    }
    const patch = {}
    if ((a.whatsNew ?? '') !== plan.whatsNew) patch.whatsNew = plan.whatsNew
    if (description !== (a.description ?? '')) patch.description = description
    console.log(`${a.locale}: What's New ${patch.whatsNew ? 'changes' : 'already says this'} (${[...plan.whatsNew].length} characters); Description swaps: ${said.join(', ') || 'none'}`)
    if (Object.keys(patch).length && mine) {
      say('written', `${a.locale} ${Object.keys(patch).join(' and ')}`)
      if (apply) {
        await asc(`/v1/appStoreVersionLocalizations/${locale.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ data: { type: 'appStoreVersionLocalizations', id: locale.id, attributes: patch } })
        })
        const { data: after } = await asc(`/v1/appStoreVersionLocalizations/${locale.id}`)
        for (const k of Object.keys(patch)) if (after.attributes[k] !== patch[k]) throw new Error(`${k} did not read back as written`)
      }
    }
  }

  /* The notes. Never printed. */
  const detailOf = (v) => asc(`/v1/appStoreVersions/${v.id}/appStoreReviewDetail?fields[appStoreReviewDetails]=notes`, {}, { missingIsNone: true })
  const own = mine ? await detailOf(mine) : null
  const source = own?.data ? own : older ? await detailOf(older) : null
  if (!source?.data) throw new Error('no review notes to start from')
  const { text, report, bad } = newNotes(source.data.attributes.notes ?? '', plan)
  for (const line of report) console.log(`notes, ${line}`)
  console.log(`notes: ${Buffer.byteLength(text)} bytes of 4000, started from ${own?.data ? 'this version’s own' : 'the last version’s'}`)
  if (bad.length) throw new Error('a line the notes were to change is not there as expected; nothing was written to the notes')
  if (mine && apply) {
    if (own?.data) {
      if (text !== (own.data.attributes.notes ?? '')) {
        await asc(`/v1/appStoreReviewDetails/${own.data.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ data: { type: 'appStoreReviewDetails', id: own.data.id, attributes: { notes: text } } })
        })
      }
    } else {
      console.log('::warning::the new version has no review details of its own; made with the notes only. Check the contact and sign-in boxes in App Review Information.')
      await asc('/v1/appStoreReviewDetails', {
        method: 'POST',
        body: JSON.stringify({
          data: {
            type: 'appStoreReviewDetails',
            attributes: { notes: text },
            relationships: { appStoreVersion: { data: { type: 'appStoreVersions', id: mine.id } } }
          }
        })
      })
    }
    const after = await detailOf(mine)
    if ((after?.data?.attributes?.notes ?? '') !== text) throw new Error('the notes did not read back as written')
    console.log('the notes are written and read back the same')
  }
  console.log(apply ? `\nDone. ${version} is ready for Add for Review, which is his to press.` : '\nNothing was written. Run with "Write it" ticked to do it.')
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((e) => {
    console.error(`::error::${e.message}`)
    process.exit(1)
  })
}

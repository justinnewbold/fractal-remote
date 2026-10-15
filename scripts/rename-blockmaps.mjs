#!/usr/bin/env node
/**
 * Rename the Mac blockmaps already on GitHub to the name the updater asks for.
 *
 * "Every Mac downloads the full 140 MB each time, because the file that lets
 * it fetch only the changes is uploaded under the wrong name."
 *
 * desktop/blockmapNames.js fixes the name for every release made from now
 * on. This is for the ones already made. A computer fetching only the changed
 * pieces reads TWO lists: the new version's, and the one for the version it
 * is running now, at the same address with the old number in it,
 *
 *   .../download/v1.87.4/Fractal-Remote-1.87.4-arm64-mac.zip.blockmap
 *
 * and on every Mac release so far that answers 404, because the file there
 * is Fractal.Remote-1.87.4-arm64-mac.zip.blockmap (a space GitHub turned into
 * a dot). Renaming it is all it takes: the content is right.
 *
 * WHAT IT BUYS, honestly. The computers on 1.86.75 or older, which still ask
 * GitHub's own feed and so ask for one piece at a time, and any check on a
 * newer computer that fell back to that feed. It does NOT shrink the next
 * download for a computer on 1.86.76 to 1.87.28: those ask for many pieces
 * in one request, GitHub answers that 501, and they fetch the whole file
 * whatever the names (desktop/lib/updates.mjs, useMultipleRangeRequest). From
 * the first release that carries that fix, the names below are what decides.
 *
 * DRY RUN UNLESS TOLD. It only reads GitHub, and prints every rename it
 * would make. With --apply it makes them, one PATCH per file, and that needs
 * GH_TOKEN with contents: write on the repository. A rename is undone by
 * renaming back, and nothing else about the release changes: not the files,
 * not latest-mac.yml (which names the zips, never the blockmaps).
 *
 *   node scripts/rename-blockmaps.mjs            # what it would do
 *   GH_TOKEN=... node scripts/rename-blockmaps.mjs --apply
 *   node scripts/rename-blockmaps.mjs --releases list.json   # a dry run from a saved list
 *
 * Not run by CI and not run by anybody yet: it edits public releases, so a
 * person decides.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

export const REPO = 'justinnewbold/fractal-remote'

/** A computer release: v and three numbers. Not apk-v…, not the stray v2. */
const COMPUTER_TAG = /^v\d+\.\d+\.\d+$/
/** A Mac zip's blockmap under the dotted name. */
const DOTTED = /^Fractal\.Remote-(.+\.zip\.blockmap)$/

/**
 * Every rename to make, from a list of releases as GitHub's API gives them.
 *
 *   [{ tag, id, from, to }]
 *
 * A file whose right name is already on the same release is left alone,
 * because GitHub refuses two assets of one name, and the right one is what
 * the updater reads anyway.
 */
export function renamesFor(releases) {
  const out = []
  for (const release of releases || []) {
    if (!release || !COMPUTER_TAG.test(String(release.tag_name))) continue
    const names = new Set((release.assets || []).map((a) => a.name))
    for (const asset of release.assets || []) {
      const m = DOTTED.exec(String(asset.name))
      if (!m) continue
      const to = `Fractal-Remote-${m[1]}`
      if (names.has(to)) continue
      out.push({ tag: release.tag_name, id: asset.id, from: asset.name, to })
    }
  }
  return out
}

const api = (path, init = {}) => {
  const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN
  return fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers || {})
    }
  })
}

/** Every release, page by page. */
export async function allReleases(get = api, repo = REPO) {
  const all = []
  for (let page = 1; page <= 50; page++) {
    const res = await get(`/repos/${repo}/releases?per_page=100&page=${page}`)
    if (!res.ok) throw new Error(`GitHub answered ${res.status} for page ${page} of the releases`)
    const batch = await res.json()
    all.push(...batch)
    if (batch.length < 100) return all
  }
  throw new Error('more than 50 pages of releases; stopped rather than guess')
}

async function main() {
  const apply = process.argv.includes('--apply')
  /* A saved list (the API's own JSON, one array or one per page) for a dry
     run somewhere GitHub's API cannot be reached directly. Never with
     --apply: renaming by ids from a file that may be stale is a guess. */
  const from = process.argv.indexOf('--releases')
  if (from !== -1 && apply) throw new Error('--apply reads the releases from GitHub itself, never from a file')
  const releases =
    from !== -1
      ? JSON.parse(readFileSync(process.argv[from + 1], 'utf8')).flat()
      : await allReleases()
  const plan = renamesFor(releases)
  const tags = new Set(plan.map((r) => r.tag))
  for (const r of plan) console.log(`${r.tag}  ${r.id}  ${r.from}  ->  ${r.to}`)
  console.log(`\n${plan.length} files on ${tags.size} releases ${apply ? 'to rename' : 'would be renamed'} (of ${releases.length} releases read).`)
  if (!apply) {
    console.log('Dry run: nothing was changed. Run again with --apply and a GH_TOKEN that can write releases.')
    return
  }
  if (!(process.env.GH_TOKEN || process.env.GITHUB_TOKEN)) throw new Error('--apply needs GH_TOKEN (contents: write)')
  let done = 0
  for (const r of plan) {
    const res = await api(`/repos/${REPO}/releases/assets/${r.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: r.to })
    })
    if (!res.ok) throw new Error(`${r.tag} ${r.from}: GitHub answered ${res.status}; ${done} renamed before it`)
    done++
    console.log(`renamed ${r.tag} ${r.to}`)
  }
  console.log(`${done} renamed.`)
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((err) => {
    console.error(err.message || err)
    process.exit(1)
  })
}

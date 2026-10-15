#!/usr/bin/env node
/**
 * WHETHER A MERGE MAKES A NEW COMPUTER APP.
 *
 * "Fewer, smaller computer updates. The computer app put out 28 versions in
 * 4 days, and every Mac downloads the full 140 MB each time … So the red
 * 'update the computer' line is on most of the time, and people learn to
 * ignore it. After the fix: a new computer version only when its own part
 * changed, small Mac updates, and the red line only when it really matters."
 *
 * Every merge to main published a computer release, because every merge
 * moves the version number and the release is named after it. Most of those
 * merges changed nothing inside the computer app: a phone screen, a website
 * page, the docs. This works out what IS inside it, as a fingerprint (a hash
 * of every file that ends up in it, with the version number taken out), and
 * desktop.yml's `decide` job compares that with the fingerprint written on
 * the newest computer release. The same: no release, and the builds are
 * skipped. Different, or anything at all in doubt: a release, as before.
 *
 * WHAT IS INSIDE THE COMPUTER APP, and so what counts:
 *
 *   desktop/, every tracked file but the READMEs: main.js, preload.js, lib/,
 *     the tray icons, package.json, the build hooks, electron-builder.yml,
 *     and forgefx.lock.json, which pins the device server it carries
 *   scripts/vendor-forgefx.mjs, which fetches and builds that server
 *   the web app it serves from inside itself (extraResources ../dist in
 *     electron-builder.yml): every local file vite builds the bundle from,
 *     found the way vite finds them, import by import from index.html's
 *     script, because the bundle reaches past src/ and shared/ into
 *     mobile/src/lib, mobile/assets and desktop/lib, and a list of folders
 *     would miss those
 *   index.html, vite.config.js, package.json and package-lock.json, which
 *     shape that bundle and say which libraries go into it
 *   public/, which vite copies into dist whole, less the pages only the
 *     website ever serves (WEBSITE_ONLY). The computer window opens its own
 *     privacy.html and notices.txt from "The small print", and draws gear
 *     from public/gear, so those count
 *   .github/workflows/desktop.yml, which decides how all of it is built
 *
 * WHAT DOES NOT: the version number in package.json, desktop/package.json
 * and package-lock.json (it moves on every merge and is the one thing that
 * always differs), the prose in forgefx.lock.json's `_why`, mobile/ except
 * what the bundle imports, docs/, supabase/, test/, the READMEs, and the
 * website-only pages.
 *
 * Inputs, not outputs: the built bundle carries the version and the build's
 * date and time (vite.config.js), so no two builds of it are ever the same.
 *
 * A KNOWN BLIND SPOT. desktop/ has no lock file, so `npm install` there takes
 * the newest Electron 33.x, electron-builder 25.x and electron-updater 6.x on
 * the day. Two releases with the same fingerprint can differ by that, and a
 * skipped merge picks none of it up. The Publish box on a hand-started run,
 * or a desktop-v tag, makes a release whatever this says, but only under a
 * version with no computer release yet: a computer takes only a higher
 * number, and electron-builder will not upload into a release more than two
 * hours old. So merge a change first (one that changes nothing in here
 * makes no release of its own), then tick Publish on main. desktop.yml's
 * release job stops a forced run whose version is already out.
 *
 *   node scripts/computer-fingerprint.mjs            the fingerprint
 *   node scripts/computer-fingerprint.mjs --list     the files it is made from
 *   node scripts/computer-fingerprint.mjs --json     the record a release carries
 *   node scripts/computer-fingerprint.mjs --decide   desktop.yml's question (CI only)
 */
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync, appendFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, extname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { COMPUTER_NEEDED, isOlder } from '../shared/versions.mjs'

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
export const REPO = 'justinnewbold/fractal-remote'

/** The record's shape. Moved only when what is hashed is worked out differently. */
export const FORMAT = 1
/** The record's name on a release. */
export const RECORD = 'computer-fingerprint.json'

/**
 * The public/ files only the website serves. Nothing in src/ or index.html
 * links them (a test holds that), so they are in the computer's copy of dist
 * without ever being opened there. A list of what is LEFT OUT rather than
 * of what is kept, so a new public file counts until somebody says it does
 * not.
 */
export const WEBSITE_ONLY = [
  'public/android.html',
  'public/bluetooth-guide.html',
  'public/bluetooth.html',
  'public/downloads.html',
  'public/raspberry-pi.html',
  'public/support.html',
  /* Read by the phone from the website's address, never from a computer. */
  'public/store-versions.json'
]

/** Files that are always in it. Each must exist: a rename is a change to notice. */
const ALWAYS = [
  '.github/workflows/desktop.yml',
  'index.html',
  'package-lock.json',
  'package.json',
  'scripts/vendor-forgefx.mjs',
  'vite.config.js'
]

const posix = (p) => p.split(sep).join('/')

/* ------------------------------------------------------------ the bundle */

/* vite's own order (resolve.extensions), then a folder's index file. */
const EXTENSIONS = ['.mjs', '.js', '.mts', '.ts', '.jsx', '.tsx', '.json']
const CODE = new Set(['.js', '.jsx', '.mjs', '.cjs', '.ts', '.tsx', '.mts'])

let parser = null
const parse = (text, file) => {
  parser ??= createRequire(join(ROOT, 'package.json'))('@babel/parser')
  try {
    return parser.parse(text, { sourceType: 'module', plugins: ['jsx'] })
  } catch (err) {
    throw new Error(`cannot read ${file} to follow its imports: ${err.message}`)
  }
}

/** A specifier vite would resolve to a file of ours, rather than a package or a web address. */
const local = (spec) => spec.startsWith('.') || (spec.startsWith('/') && !spec.startsWith('//'))

function resolveLocal(root, from, spec) {
  const clean = spec.split(/[?#]/)[0]
  const bases = clean.startsWith('/')
    ? /* Rooted at the project, or failing that at public/ (a CSS url('/x')). */
      [join(root, clean), join(root, 'public', clean)]
    : [resolve(dirname(from), clean)]
  for (const base of bases) {
    for (const tryPath of [base, ...EXTENSIONS.map((e) => base + e), ...EXTENSIONS.map((e) => join(base, `index${e}`))]) {
      if (existsSync(tryPath) && statSync(tryPath).isFile()) return tryPath
    }
  }
  throw new Error(`cannot find "${spec}", imported by ${posix(relative(root, from))}`)
}

const isImportMeta = (node, prop) =>
  node?.type === 'MemberExpression' &&
  node.object?.type === 'MetaProperty' &&
  node.object.meta?.name === 'import' &&
  node.property?.name === prop

/** A string an import names, or null when it is not written out in full. */
const literal = (node) =>
  node?.type === 'StringLiteral'
    ? node.value
    : node?.type === 'TemplateLiteral' && node.expressions.length === 0
      ? node.quasis[0].value.cooked
      : null

/**
 * Every file a module names. Refuses, rather than guesses, at the import
 * styles it cannot follow (an import of a worked-out name, import.meta.glob):
 * a file it cannot see is a change it cannot see, and refusing means the
 * computer is released, which is what happened before any of this.
 */
function specsOf(file, text, root) {
  const ext = extname(file)
  if (ext === '.css') {
    return [...text.matchAll(/@import\s+(?:url\()?\s*['"]?([^'")\s;]+)['"]?\s*\)?|url\(\s*['"]?([^'")]+)['"]?\s*\)/g)]
      .map((m) => (m[1] || m[2]).trim())
      .filter((s) => !/^(data:|https?:|#|\/\/)/.test(s))
  }
  if (!CODE.has(ext)) return []
  const out = []
  const where = posix(relative(root, file))
  const visit = (node) => {
    if (!node || typeof node.type !== 'string') return
    if ((node.type === 'ImportDeclaration' || node.type === 'ExportNamedDeclaration' || node.type === 'ExportAllDeclaration') && node.source) {
      out.push(node.source.value)
    } else if (node.type === 'ImportExpression' || (node.type === 'CallExpression' && node.callee?.type === 'Import')) {
      const spec = literal(node.type === 'ImportExpression' ? node.source : node.arguments[0])
      if (spec === null) throw new Error(`${where} imports a name worked out while it runs; the fingerprint cannot see what that is`)
      out.push(spec)
    } else if (node.type === 'CallExpression' && isImportMeta(node.callee, 'glob')) {
      throw new Error(`${where} uses import.meta.glob; the fingerprint cannot see what that picks up`)
    } else if (node.type === 'NewExpression' && node.callee?.name === 'URL' && isImportMeta(node.arguments?.[1], 'url')) {
      const spec = literal(node.arguments[0])
      if (spec === null) throw new Error(`${where} makes a file's address from a worked-out name; the fingerprint cannot see what that is`)
      out.push(spec)
    }
    for (const key of Object.keys(node)) {
      if (key === 'loc' || key === 'start' || key === 'end' || key === 'extra' || key === 'comments' || key === 'leadingComments' || key === 'trailingComments') continue
      const value = node[key]
      if (Array.isArray(value)) value.forEach(visit)
      else if (value && typeof value === 'object') visit(value)
    }
  }
  visit(parse(text, where).program)
  return out
}

/**
 * The local files the web bundle is made from, as paths from the root.
 *
 * Checked against vite's own list of modules on a real build when this was
 * written (the same 251 files, src/ and shared/ and the rest), and a test
 * holds the parts that are easy to lose: the reach into mobile/ and
 * desktop/lib, and that phone screens are NOT in it.
 */
export function bundleInputs(root = ROOT) {
  const html = readFileSync(join(root, 'index.html'), 'utf8')
  const entries = [...html.matchAll(/<script\b[^>]*\btype=["']module["'][^>]*\bsrc=["']([^"']+)["']/g)].map((m) => m[1])
  if (entries.length === 0) throw new Error('index.html names no module script, so there is no bundle to follow')
  const seen = new Set()
  const queue = entries.filter(local).map((s) => resolveLocal(root, join(root, 'index.html'), s))
  while (queue.length) {
    const file = queue.pop()
    if (seen.has(file)) continue
    seen.add(file)
    for (const spec of specsOf(file, readFileSync(file, 'utf8'), root)) {
      if (local(spec)) queue.push(resolveLocal(root, file, spec))
    }
  }
  return [...seen].map((f) => posix(relative(root, f))).sort()
}

/* ------------------------------------------------------------ the rest */

/**
 * Files under a folder, as git sees them: tracked, or new and not ignored,
 * and on disk. In CI that is exactly the commit being built; on a laptop it
 * is that commit plus whatever is about to be added to it. A tree with no
 * git at all (a `git archive` of an old commit, which is how the replay in
 * the pull request was made) is walked instead, and holds only tracked
 * files by construction.
 */
function filesUnder(root, dir) {
  if (!existsSync(join(root, '.git'))) {
    const walk = (rel) =>
      readdirSync(join(root, rel), { withFileTypes: true }).flatMap((d) =>
        d.name === 'node_modules' ? [] : d.isDirectory() ? walk(`${rel}/${d.name}`) : [`${rel}/${d.name}`]
      )
    return existsSync(join(root, dir)) ? walk(dir) : []
  }
  const out = execFileSync('git', ['-C', root, 'ls-files', '-z', '--cached', '--others', '--exclude-standard', '--', dir], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024
  })
  return [...new Set(out.split('\0').filter(Boolean))].filter((p) => existsSync(join(root, p)))
}

/** Every file that ends up in the computer app, as sorted paths from the root. */
export function computerInputs(root = ROOT) {
  for (const f of ALWAYS) if (!existsSync(join(root, f))) throw new Error(`${f} is gone; the fingerprint has to be told where it went`)
  const files = new Set([
    ...ALWAYS,
    ...bundleInputs(root),
    ...filesUnder(root, 'public').filter((p) => !WEBSITE_ONLY.includes(p)),
    ...filesUnder(root, 'desktop').filter((p) => !/\.md$/i.test(p))
  ])
  return [...files].sort()
}

const json = (buf) => JSON.parse(buf.toString('utf8'))
const without = (obj, ...keys) => {
  for (const k of keys) delete obj[k]
  return obj
}

/**
 * A file's bytes with what does not count taken out. The version moves on
 * every merge by rule ("Every change needs a new version number"), so it is
 * never a reason for a computer release on its own.
 */
export function normalise(path, buf) {
  if (path === 'package.json' || path === 'desktop/package.json') return Buffer.from(JSON.stringify(without(json(buf), 'version')))
  if (path === 'package-lock.json') {
    const lock = without(json(buf), 'version')
    if (lock.packages?.['']) delete lock.packages[''].version
    return Buffer.from(JSON.stringify(lock))
  }
  /* The pin is repo, tag, commit and branch; `_why` is the story of it. */
  if (path === 'desktop/forgefx.lock.json') return Buffer.from(JSON.stringify(without(json(buf), '_why')))
  return buf
}

const sha256 = (data) => createHash('sha256').update(data).digest('hex')

/** { format, hash, files: { path: sha256 } }: what a computer release carries as its record. */
export function computerFingerprint(root = ROOT) {
  const files = {}
  for (const path of computerInputs(root)) files[path] = sha256(normalise(path, readFileSync(join(root, path))))
  const hash = sha256(
    Object.keys(files)
      .sort()
      .map((p) => `${p}\0${files[p]}\n`)
      .join('')
  )
  return { format: FORMAT, hash, files }
}

/** The paths that differ between two records' `files`, sorted. */
export function changedFiles(before = {}, after = {}) {
  return [...new Set([...Object.keys(before), ...Object.keys(after)])].filter((p) => before[p] !== after[p]).sort()
}

/* ------------------------------------------------------------ the decision */

/** A computer release's tag: v and three numbers. Not apk-v…, not the stray v2. */
export const COMPUTER_TAG = /^v\d+\.\d+\.\d+$/

/** A release a merge could be compared with: a computer one, out, and not a trial. */
const isComputerRelease = (r) => Boolean(r && !r.draft && !r.prerelease && COMPUTER_TAG.test(String(r.tag_name)))

/**
 * The release a merge is compared with: the newest computer release, by
 * when it was published (never by its number: numbers have been reset
 * before, and android.html and downloads.html learned the same lesson).
 *
 * The newest, whatever state it is in. Only a release whose every platform
 * made it carries a record (the complete job writes it last), so a release
 * that failed part of the way has none, and the next merge makes a new one
 * rather than leave a platform stranded on it. A re-run writing into a
 * release again takes its record off first (the release and complete jobs
 * in desktop.yml), because electron-builder deletes a file before it puts
 * the new one up, and a re-run that fails between the two leaves a gap.
 */
export function pickBase(releases) {
  const when = (r) => Date.parse(r.published_at || r.created_at || '') || 0
  return (
    (releases || [])
      .filter(isComputerRelease)
      .sort((a, b) => when(b) - when(a))[0] || null
  )
}

/**
 * Skip or not, and why, in a sentence for the run's summary.
 *
 *   { skip: boolean, why: string }
 *
 * Only a push to main is ever skipped, and only when the newest computer
 * release says it was made from exactly what is inside the computer app
 * now. Everything else is not skipped: a desktop-v tag and the Publish box
 * are how a release is asked for whatever this says, a pull request builds
 * without publishing as it always has, and doubt (no record, an unreadable
 * one, a fingerprint that could not be worked out) is a release.
 *
 * And not skipped when the phones need a newer computer app than the newest
 * release is (COMPUTER_NEEDED in shared/versions.mjs). That would leave
 * every computer told to update to a version that does not exist; a release
 * made now is that version.
 */
export function decide({ event, ref, publishBox = false, fingerprint, record, baseTag, needed = COMPUTER_NEEDED }) {
  const go = (why) => ({ skip: false, why })
  if (event === 'push' && String(ref).startsWith('refs/tags/desktop-v')) return go('a desktop-v tag always makes a release')
  if (event === 'workflow_dispatch') return go(publishBox ? 'started by hand with Publish ticked' : 'started by hand: it builds, and publishes nothing')
  if (event === 'pull_request') return go('a pull request builds, and never publishes')
  if (!(event === 'push' && ref === 'refs/heads/main')) return go(`a ${event || 'run'} on ${ref || 'no ref'} is not a merge to main`)
  if (!fingerprint?.hash) return go('what is inside the computer app could not be worked out')
  if (!baseTag) return go('there is no computer release to compare with')
  if (!record) return go(`${baseTag} carries no ${RECORD}`)
  if (record.format !== fingerprint.format || typeof record.hash !== 'string') return go(`${baseTag}'s ${RECORD} was worked out another way`)
  if (record.hash !== fingerprint.hash) return go(`the computer app's own files changed since ${baseTag}`)
  const base = baseTag.replace(/^v/, '')
  if (isOlder(base, needed) !== false) return go(`the phones need computer app ${needed} or newer, and the newest release is ${base}`)
  return { skip: true, why: `nothing inside the computer app changed since ${baseTag}` }
}

/* ------------------------------------------------------------ in CI */

async function getJson(get, url, token) {
  const res = await get(url, {
    headers: {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    }
  })
  if (!res.ok) throw new Error(`${url} answered ${res.status}`)
  return res.json()
}

/** The most pages of releases read looking for the first computer one. */
export const MOST_PAGES = 20

/**
 * The newest releases, page by page, as far as the newest computer one and
 * one page past it.
 *
 * NOT EVERY RELEASE. Every merge makes an Android release and many make a
 * computer one, so the list grows by about ten a day: 325 on 15 October
 * 2026. Reading all of them with a limit would have run into that limit in
 * a few months, and then every merge would have made a computer version
 * again with nothing saying so but a line in the run's summary. GitHub
 * lists releases newest made first, so the newest computer release is on
 * the first page or two; the page after the one it is found on is read as
 * well, because the comparison goes by when a release was published, and a
 * release made a little earlier but published later can sit just below.
 *
 * Twenty pages with no computer release on any of them is an error, and so
 * a release, and that release is then on the first page for the next merge.
 */
export async function recentReleases(get, repo, token) {
  const all = []
  let found = false
  let last = MOST_PAGES
  for (let page = 1; page <= last; page++) {
    const batch = await getJson(get, `https://api.github.com/repos/${repo}/releases?per_page=100&page=${page}`, token)
    if (!Array.isArray(batch)) throw new Error(`page ${page} of the releases is not a list`)
    all.push(...batch)
    if (batch.length < 100) return all
    if (!found && batch.some(isComputerRelease)) {
      found = true
      last = page + 1
    }
  }
  if (found) return all
  throw new Error(`no computer release in the newest ${all.length} releases`)
}

/**
 * desktop.yml's decide step. Writes skip, fingerprint, base and why to
 * $GITHUB_OUTPUT, a line to the run's summary, and the record to `out` for
 * the complete job to put on the release. Never fails the step over a doubt:
 * every error is a release, said in the summary. `fetch`, `root` and `log`
 * are parameters so the tests can hand it a GitHub and a tree of their own.
 *
 *   resolves to { skip, why, fingerprint, base, changed }
 */
export async function inCi(env, out, { fetch: get = globalThis.fetch, root = ROOT, log = console.log } = {}) {
  const event = env.GITHUB_EVENT_NAME
  const ref = env.GITHUB_REF
  let fingerprint = null
  let base = null
  let record = null
  let trouble = null
  try {
    fingerprint = computerFingerprint(root)
    writeFileSync(out, `${JSON.stringify({ ...fingerprint, commit: env.GITHUB_SHA || null }, null, 1)}\n`)
  } catch (err) {
    trouble = `what is inside the computer app could not be worked out (${err.message})`
  }
  if (!trouble && event === 'push' && ref === 'refs/heads/main') {
    try {
      base = pickBase(await recentReleases(get, env.GITHUB_REPOSITORY || REPO, env.GH_TOKEN || env.GITHUB_TOKEN))
      const asset = base?.assets?.find((a) => a.name === RECORD)
      if (asset) {
        /* The public download address, with no token: the release is public,
           and a token sent on to where GitHub keeps the file is refused. */
        const res = await get(asset.browser_download_url)
        if (!res.ok) throw new Error(`${base.tag_name}'s ${RECORD} answered ${res.status}`)
        record = JSON.parse(await res.text())
      }
    } catch (err) {
      trouble = `the newest computer release could not be read (${err.message})`
    }
  }
  const verdict = trouble
    ? { skip: false, why: trouble }
    : decide({ event, ref, publishBox: env.PUBLISH_BOX === 'true', fingerprint, record, baseTag: base?.tag_name })
  const changed = record?.files && fingerprint ? changedFiles(record.files, fingerprint.files) : []

  const lines = [
    `skip=${verdict.skip}`,
    `fingerprint=${fingerprint?.hash || ''}`,
    `base=${base?.tag_name || ''}`,
    `why=${verdict.why.replace(/[\r\n]+/g, ' ')}`
  ]
  if (env.GITHUB_OUTPUT) appendFileSync(env.GITHUB_OUTPUT, `${lines.join('\n')}\n`)
  const summary = [
    verdict.skip ? '### No new computer version' : '### A computer build',
    '',
    `${verdict.why[0].toUpperCase()}${verdict.why.slice(1)}.`,
    ...(changed.length ? ['', 'Changed inside the computer app:', '', ...changed.slice(0, 40).map((p) => `- \`${p}\``), ...(changed.length > 40 ? [`- and ${changed.length - 40} more`] : [])] : [])
  ]
  if (env.GITHUB_STEP_SUMMARY) appendFileSync(env.GITHUB_STEP_SUMMARY, `${summary.join('\n')}\n`)
  log(lines.join('\n'))
  if (changed.length) log(`changed:\n  ${changed.join('\n  ')}`)
  return { ...verdict, fingerprint: fingerprint?.hash || null, base: base?.tag_name || null, changed }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const args = process.argv.slice(2)
  if (args.includes('--decide')) {
    const at = args.indexOf('--out')
    const out = at !== -1 ? args[at + 1] : join(process.cwd(), RECORD)
    await inCi(process.env, out).catch((err) => {
      /* Even this is a release: the builds run unless told skip=true. */
      console.log(`::warning::the computer fingerprint step went wrong, so this publishes as before: ${err.message}`)
      if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, 'skip=false\n')
    })
  } else if (args.includes('--list')) {
    console.log(computerInputs(ROOT).join('\n'))
  } else if (args.includes('--json')) {
    console.log(JSON.stringify(computerFingerprint(ROOT), null, 1))
  } else {
    console.log(computerFingerprint(ROOT).hash)
  }
}

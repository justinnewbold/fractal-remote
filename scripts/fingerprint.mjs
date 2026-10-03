#!/usr/bin/env node
/**
 * Whether this change costs an iOS build, answered before it is merged.
 *
 * AN UPDATE ONLY REACHES A BUILD WHOSE FINGERPRINT MATCHES IT. That is the
 * whole of the safety in EAS Update and it is the whole of the trap: change
 * anything native and every phone already carrying this app stops receiving
 * updates, silently, until somebody spends a build. There is no error. The
 * updates simply never arrive, and the way you find out is that a handset
 * sitting in front of you is on a version from last week.
 *
 * It has happened here. Three native changes went in after the last build —
 * two Expo packages at 7.328.0, the camera at 7.329.0, the opaque iOS icon at
 * 7.349.0 — and nothing said so. An update was published, reported as
 * published, and could never have landed on anything.
 *
 * So this compares what the app hashes to now against mobile/fingerprint.json,
 * and fails a pull request that moves either number.
 *
 *   npm run fingerprint          check, and fail if it moved
 *   npm run fingerprint -- --write   record the new values on purpose
 *
 * The second one is the point as much as the first. A native change is not
 * forbidden — it is a decision with a price, and the diff on that file is
 * where the price gets named.
 */
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const file = join(root, 'mobile/fingerprint.json')
const write = process.argv.includes('--write')

/* Run from mobile/, because that is where the app and its node_modules are —
   the fingerprint hashes the installed native packages, not just the config. */
const hashFor = (platform) => {
  const out = execFileSync(
    'npx',
    ['@expo/fingerprint', 'fingerprint:generate', '--platform', platform],
    { cwd: join(root, 'mobile'), encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }
  )
  const { hash } = JSON.parse(out)
  if (!hash) throw new Error(`no hash came back for ${platform}`)
  return hash
}

/*
 * THE WATCH, WHICH EXPO'S FINGERPRINT DOES NOT SEE. The watch app is Swift in
 * mobile/targets/watch, built by @bacons/apple-targets, and @expo/fingerprint
 * hashes none of it: switching the watch's pages from up-and-down to sideways
 * read "Unchanged". That is right for the runtime, since an update carries no
 * Swift and the phone's half of the link is unaffected. It is wrong for the
 * question this script answers, because a change there reaches nobody until
 * an iOS build. So it gets its own hash: every file git knows of under the
 * folder, path and contents, in order.
 */
const watchHash = () => {
  const list = execFileSync('git', ['ls-files', '-co', '--exclude-standard', 'mobile/targets'], { cwd: root, encoding: 'utf8' })
    .split('\n')
    .filter(Boolean)
    .sort()
  const h = createHash('sha1')
  for (const f of list) {
    h.update(`${f}\0`)
    h.update(readFileSync(join(root, f)))
    h.update('\0')
  }
  return h.digest('hex')
}

const recorded = JSON.parse(readFileSync(file, 'utf8'))
const now = { android: hashFor('android'), ios: hashFor('ios'), watch: watchHash() }

const moved = ['android', 'ios', 'watch'].filter((p) => recorded[p] !== now[p])

if (write) {
  writeFileSync(file, `${JSON.stringify({ ...recorded, ...now }, null, 2)}\n`)
  console.log(
    moved.length
      ? `Recorded. ${moved.join(' and ')} moved — this change needs a build before any phone sees it.`
      : 'Recorded. Nothing moved.'
  )
  process.exit(0)
}

for (const p of ['android', 'ios', 'watch']) {
  console.log(`${p.padEnd(8)} ${now[p]}${recorded[p] === now[p] ? '' : `   was ${recorded[p]}`}`)
}

if (!moved.length) {
  console.log('\nUnchanged, so this ships as an update and costs no build.')
  process.exit(0)
}

/*
 * Named per platform, because the two do not cost the same. Android builds
 * are an ordinary runner and free; the iOS ones are a handful a month and
 * when they run out development stops until the month turns over.
 */
const cost = {
  ios: 'iOS: a build slot, and there are only a few a month.',
  watch: 'Watch: an iOS build. Updates keep reaching phones; the watch change waits for the build.',
  android: 'Android: a free APK from .github/workflows/apk.yml.'
}
console.error(
  [
    '',
    `NATIVE CHANGE — ${moved.join(' and ')} moved.`,
    '',
    ...(moved.some((p) => p !== 'watch')
      ? [
          'Every copy of this app already on a phone stops receiving updates until a',
          'new build is made and installed. Nothing will say so at the time; the',
          'updates just stop arriving.'
        ]
      : ['Phones keep taking updates. The watch change reaches nobody until the next iOS build.']),
    '',
    ...moved.map((p) => `  ${cost[p]}`),
    '',
    'If that is not what this change was meant to do, find the native part and',
    'take it out — a new dependency, an app.json plugin or permission, an icon,',
    'or an Expo package moving version.',
    '',
    'If it IS intended, run `npm run fingerprint -- --write` and commit the',
    'change to mobile/fingerprint.json, so the diff records what it cost.',
    ''
  ].join('\n')
)
process.exit(1)

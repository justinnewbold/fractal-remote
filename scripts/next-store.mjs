#!/usr/bin/env node
/**
 * WHETHER THE UPDATE ABOUT TO GO TO THE NEXT STORE VERSION'S TESTERS CAN
 * REACH THEM.
 *
 * mobile.yml's update job publishes every update twice while a store build
 * is out to testers ahead of its release: once from main as it is, for the
 * copies in the stores, and once with docs/pending's patches put in
 * (scripts/apply-pending.sh), for the testers' build, which was made the same
 * way. An update reaches only a build whose fingerprint it matches, and the
 * build's are written down in docs/pending/next-store.json when it is
 * started:
 *
 *   { "version": "2.0.0", "ios": "<fingerprint>", "android": "<fingerprint>" }
 *
 * This works out the fingerprints of the tree as it is now (patched, its
 * packages installed) and says, before the publish, whether they are still
 * the build's. They stop being so when a patch, a package or anything else
 * native changes after the build: the testers then take no update until
 * another build, and the log says so here rather than nowhere. It never
 * stops the publish: an update for a fingerprint no copy has reaches nobody
 * and harms nobody, and main's own update has already gone.
 *
 *   node scripts/next-store.mjs
 */
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/** Per platform, whether `now` is what the build carries, and what to say. */
export function compareWithBuild(recorded, now) {
  const lines = []
  let reaches = true
  for (const p of ['ios', 'android']) {
    const was = recorded?.[p]
    if (!was) {
      reaches = false
      lines.push({ level: 'warning', text: `${p}: docs/pending/next-store.json has no fingerprint for the ${recorded?.version ?? 'next store'} build, so whether this update reaches its testers is not known.` })
    } else if (was === now[p]) {
      lines.push({ level: 'notice', text: `${p}: ${now[p]}, the ${recorded.version} build's own, so its testers take this update.` })
    } else {
      reaches = false
      lines.push({ level: 'warning', text: `${p}: this update is ${now[p]} and the ${recorded.version} build is ${was}. Its testers take no update until another build (something native changed since that build).` })
    }
  }
  return { reaches, lines }
}

const hashFor = (root, platform) => {
  const out = execFileSync('npx', ['@expo/fingerprint', 'fingerprint:generate', '--platform', platform], {
    cwd: join(root, 'mobile'),
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024
  })
  return JSON.parse(out).hash
}

const main = () => {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
  const recorded = JSON.parse(readFileSync(join(root, 'docs/pending/next-store.json'), 'utf8'))
  const now = { ios: hashFor(root, 'ios'), android: hashFor(root, 'android') }
  for (const { level, text } of compareWithBuild(recorded, now).lines) console.log(`::${level}::${text}`)
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main()

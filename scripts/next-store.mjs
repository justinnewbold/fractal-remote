#!/usr/bin/env node
/**
 * WHETHER WHAT IS IN docs/pending NOW IS STILL WHAT THE NEXT STORE VERSION'S
 * TEST BUILD CARRIES.
 *
 * mobile.yml's update job publishes every update twice while a store build
 * is out to testers ahead of its release: once from main as it is, for the
 * copies in the stores, and once with docs/pending's patches put in
 * (scripts/apply-pending.sh), for the testers' build, which was made the same
 * way. An update reaches only a build whose fingerprint it matches, and the
 * build's are written down in docs/pending/next-store.json when it is
 * started:
 *
 *   { "version": "2.0.0", "ios": "<fingerprint>", "android": "<fingerprint>",
 *     "watch": "<the watch's own hash>" }
 *
 * This works out the same three for the tree as it is now (patched, its
 * packages installed) and says whether they are still the build's. They stop
 * being so when a patch, a package or anything else native changes after the
 * build: the testers then take no update until another build, and on release
 * day the build that is sent for review would not carry the change. The watch
 * is not in what updates are matched on (scripts/fingerprint.mjs says why it
 * has its own hash), so a watch that moved stops no update; it means the
 * build's watch is not the one in docs/pending.
 *
 *   node scripts/next-store.mjs            say it (the update job): never stops
 *                                          the publish, since an update for a
 *                                          fingerprint no copy has reaches
 *                                          nobody and harms nobody, and main's
 *                                          own has already gone
 *   node scripts/next-store.mjs --strict   fail on any of the three (web.yml's
 *                                          `testers` job, on every pull
 *                                          request while a build is out)
 *
 * The strict run is what keeps a pull request that only touches docs/pending
 * (no app file, so main's fingerprint says Unchanged and every other check is
 * green) from being merged as if it cost nothing (an independent read before
 * the 2.0.0 pair). When such a change is wanted all the same, it is another
 * build: Justin's yes, the new values written into next-store.json in that
 * pull request on purpose, and the build started right after the merge.
 */
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const PARTS = ['ios', 'android', 'watch']

/** Per part, whether `now` is what the build carries, and what to say. */
/* The update job's exit code for "published, but not the build's": mobile.yml reads this number. */
export const NOT_THE_BUILD = 3

export function compareWithBuild(recorded, now, { strict = false } = {}) {
  const lines = []
  let reaches = true
  const bad = strict ? 'error' : 'warning'
  const which = recorded?.version ?? 'next store'
  for (const p of PARTS) {
    const was = recorded?.[p]
    if (!was) {
      reaches = false
      lines.push({ level: bad, text: `${p}: docs/pending/next-store.json has no ${p === 'watch' ? 'watch hash' : 'fingerprint'} for the ${which} build, so whether ${p === 'watch' ? 'its watch is the one in docs/pending' : 'this update reaches its testers'} is not known.` })
    } else if (was === now[p]) {
      lines.push({ level: 'notice', text: p === 'watch' ? `watch: ${now[p]}, the ${which} build's own.` : `${p}: ${now[p]}, the ${which} build's own, so its testers take this update.` })
    } else {
      reaches = false
      lines.push({
        level: bad,
        text: p === 'watch'
          ? `watch: docs/pending's watch is ${now[p]} and the ${which} build's is ${was}. The watch the testers have, and the one sent for review on release day, is not this one: that is another build.`
          : `${p}: this is ${now[p]} and the ${which} build is ${was}. Its testers take no update until another build (something native changed since that build).`
      })
    }
  }
  return { reaches, lines }
}

/*
 * NEVER THE STORE COPIES' OWN. The testers' update is published to the
 * production branch, which every store copy listens on too; it reaches only
 * the copies whose fingerprint it has. If the patched tree's were main's own
 * (mobile/fingerprint.json at this commit, which the check job holds to the
 * store copies'), the waiting patches' code would go to every customer as
 * an ordinary update, after main's own. Today play-internal keeps the two
 * apart, so this is the lock for the day it does not (an independent read,
 * before the 2.0.0 pair). It stops the publish in both modes.
 */
export const sameAsStores = (stores, now) => ['ios', 'android'].filter((p) => stores?.[p] && stores[p] === now[p])

const hashFor = (root, platform) => {
  const out = execFileSync('npx', ['@expo/fingerprint', 'fingerprint:generate', '--platform', platform], {
    cwd: join(root, 'mobile'),
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024
  })
  const { hash } = JSON.parse(out)
  if (!hash) throw new Error(`no hash came back for ${platform}`)
  return hash
}

/** scripts/fingerprint.mjs `watchHash`, the same bytes in the same order (test/mobile.mjs holds the two equal). */
export const watchHash = (root) => {
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

const main = () => {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
  const strict = process.argv.includes('--strict')
  const recorded = JSON.parse(readFileSync(join(root, 'docs/pending/next-store.json'), 'utf8'))
  const now = { ios: hashFor(root, 'ios'), android: hashFor(root, 'android'), watch: watchHash(root) }
  const { reaches, lines } = compareWithBuild(recorded, now, { strict })
  for (const { level, text } of lines) console.log(`::${level}::${text}`)
  const stores = JSON.parse(execFileSync('git', ['show', 'HEAD:mobile/fingerprint.json'], { cwd: root, encoding: 'utf8' }))
  const same = sameAsStores(stores, now)
  if (same.length) {
    console.log(`::error::With docs/pending in, ${same.join(' and ')} is ${same.map((p) => now[p]).join(' and ')}, the store copies' own, so the testers' update would reach every customer. Nothing is published for the testers.`)
    process.exit(1)
  }
  /*
   * Strict (web.yml's testers job): any part that is not the build's fails
   * the pull request. Otherwise (the update job) the update is published all
   * the same, since one that matches no build reaches nobody, and THEN the
   * step goes red, so the testers taking nothing more is seen on the day it
   * starts, not when one of them asks why (an independent read, before the
   * 2.0.0 pair). The store copies' own fingerprint, above, stops it in both.
   */
  if (!reaches) process.exit(strict ? 1 : NOT_THE_BUILD)
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main()

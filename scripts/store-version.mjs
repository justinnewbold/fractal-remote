#!/usr/bin/env node
/**
 * THE NUMBER A STORE BUILD CARRIES, set in that build's copy only.
 *
 * "dont change the build number to 2.0.0 on the updartes currently going.
 * only after we do the native builds" (Justin, 16 November 2026.)
 *
 * mobile.yml's build job runs this when "The version number the stores show
 * for this build" is filled in. It writes the number into mobile/app.json's
 * `expo.version` on the runner, where `eas build` reads it (the build number
 * under it is Expo's own, eas.json `appVersionSource: remote`), and nothing
 * is committed: main, and every update made from it, keeps its own number.
 * That is the number App Store Connect, TestFlight, Google Play and the
 * copy's own `installedStoreVersion()` read, so it is what Bluetooth's and
 * Edit's store-version switches are measured against on that copy.
 *
 * The version is left out of the fingerprint (mobile/fingerprint.config.js),
 * so this changes nothing about which updates the build takes.
 *
 * Refused, so nothing is built: anything but three plain numbers (a "2.0"
 * compares as nothing in shared/versions.mjs and would keep Bluetooth shut
 * for every customer on the build), a last place of more than one digit
 * (CLAUDE.md, the numbering), and a number below what a store already has
 * (public/store-versions.json), which neither store would take.
 *
 *   node scripts/store-version.mjs 2.0.0
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { isOlder } from '../shared/versions.mjs'

/** Why `wanted` cannot be a store build's number, or null when it can. */
export function storeVersionProblem(wanted, live) {
  const v = String(wanted ?? '').trim()
  if (!/^\d+\.\d+\.\d+$/.test(v)) return `"${v}" is not three numbers, such as 2.0.0`
  if (!/\.\d$/.test(v)) return `${v} has more than one digit in its last place: after x.y.9 comes x.(y+1).0`
  for (const store of ['ios', 'android']) {
    if (live?.[store] && isOlder(v, live[store])) return `${v} is below ${live[store]}, which the ${store === 'ios' ? 'App Store' : 'Google Play'} copy already is`
  }
  return null
}

/** app.json's text with `expo.version` set to `version`, everything else as it was. */
export function withStoreVersion(appJsonText, version) {
  const config = JSON.parse(appJsonText)
  if (!config?.expo || typeof config.expo.version !== 'string') throw new Error('mobile/app.json has no expo.version')
  config.expo.version = version
  return `${JSON.stringify(config, null, 2)}\n`
}

const main = () => {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
  const wanted = String(process.argv[2] ?? '').trim()
  const live = JSON.parse(readFileSync(join(root, 'public/store-versions.json'), 'utf8'))
  const problem = storeVersionProblem(wanted, live)
  if (problem) {
    console.error(`::error::The version for this build: ${problem}. Nothing was built.`)
    process.exit(1)
  }
  const file = join(root, 'mobile/app.json')
  const before = JSON.parse(readFileSync(file, 'utf8')).expo.version
  writeFileSync(file, withStoreVersion(readFileSync(file, 'utf8'), wanted))
  console.log(`::notice::This build is ${wanted} in the stores (main and its updates stay ${before}; nothing is committed).`)
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main()

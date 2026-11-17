#!/usr/bin/env node
/*
 * EXPERIMENT ONLY (.github/workflows/turn-check.yml). Run from the repository
 * root of a throwaway checkout, AFTER scripts/apply-pending.sh:
 *
 *   node mobile/turn-check/tweak.mjs <variant>
 *
 * variant: default | never-upright | no-initial | force-landscape
 *
 * 1. Puts mobile/turn-check/PhoneTurns.experiment.js in place of
 *    mobile/src/components/PhoneTurns.js, with the variant baked in.
 * 2. In mobile/app.json: turns expo-updates off (a Release build would
 *    otherwise fetch the real published update on its first launch and run
 *    it on the next one, which is not this JavaScript); for no-initial,
 *    drops expo-screen-orientation's initialOrientation, so the built
 *    Info.plist has no EXDefaultScreenOrientationMask.
 * 3. Prints what it changed and what app.json now says about orientation.
 *
 * Nothing here is ever committed by the workflow.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const VARIANTS = ['default', 'never-upright', 'no-initial', 'force-landscape']
const variant = process.argv[2] || 'default'
const root = resolve(process.argv[3] || '.')
if (!VARIANTS.includes(variant)) {
  console.error(`::error::unknown variant "${variant}" (one of ${VARIANTS.join(', ')})`)
  process.exit(2)
}

const target = join(root, 'mobile/src/components/PhoneTurns.js')
const template = join(root, 'mobile/turn-check/PhoneTurns.experiment.js')
if (!existsSync(target)) {
  console.error('::error::mobile/src/components/PhoneTurns.js is not there: run scripts/apply-pending.sh first (phone-turns.patch makes it)')
  process.exit(1)
}
const before = readFileSync(target, 'utf8')
if (!/export function PhoneTurns\(/.test(before)) {
  console.error('::error::PhoneTurns.js does not export PhoneTurns as App.js imports it; the patch has changed shape')
  process.exit(1)
}
const app = readFileSync(join(root, 'mobile/App.js'), 'utf8')
if (!app.includes("import { PhoneTurns } from './src/components/PhoneTurns'") || !app.includes('<PhoneTurns ')) {
  console.error('::error::App.js does not import and mount PhoneTurns; the patch has changed shape')
  process.exit(1)
}
const body = readFileSync(template, 'utf8').replace("'__VARIANT__'", JSON.stringify(variant).replace(/"/g, "'"))
if (body.includes('__VARIANT__\'')) {
  console.error('::error::the variant was not written into the experiment file')
  process.exit(1)
}
writeFileSync(target, body)
console.log(`PhoneTurns.js replaced by the experiment (variant ${variant})`)

const appJsonPath = join(root, 'mobile/app.json')
const appJson = JSON.parse(readFileSync(appJsonPath, 'utf8'))
const expo = appJson.expo
expo.updates = { ...(expo.updates || {}), enabled: false }
console.log('app.json: expo.updates.enabled = false (the embedded JavaScript runs, never a downloaded update)')

const plugins = expo.plugins || []
const at = plugins.findIndex((p) => p === 'expo-screen-orientation' || (Array.isArray(p) && p[0] === 'expo-screen-orientation'))
if (at < 0) {
  console.error('::error::app.json has no expo-screen-orientation plugin: phone-turns.patch is not applied')
  process.exit(1)
}
if (variant === 'no-initial') {
  plugins[at] = 'expo-screen-orientation'
  console.log('app.json: expo-screen-orientation without initialOrientation (no EXDefaultScreenOrientationMask)')
}
writeFileSync(appJsonPath, `${JSON.stringify(appJson, null, 2)}\n`)

console.log('app.json now says:')
console.log(`  orientation: ${JSON.stringify(expo.orientation)}`)
console.log(`  ios.infoPlist.UISupportedInterfaceOrientations: ${JSON.stringify(expo.ios?.infoPlist?.UISupportedInterfaceOrientations)}`)
console.log(`  ios.infoPlist["EXDefaultScreenOrientationMask~ipad"]: ${JSON.stringify(expo.ios?.infoPlist?.['EXDefaultScreenOrientationMask~ipad'])}`)
console.log(`  plugin: ${JSON.stringify(plugins[at])}`)
console.log(`  updates: ${JSON.stringify(expo.updates)}`)

/**
 * SCREENSHOTS FOR AN APP STORE VERSION, ON HIS WORD.
 *
 * "Add these iPhone screenshots to App Store Connect" (Justin, 17 November
 * 2026). The pictures are his own, from his phone, kept in
 * store/app-store/screenshots/<version>/<device>/ and sent in the files'
 * name order. Added AFTER the ones already there, never in their place, and
 * only to a version that can still be edited. It never sends a version for
 * review. One thing takes pictures away, and only when asked for by name:
 * --clear-iphone empties the iPhone's row first (the iPad's and the watch's
 * are never touched), for when he wants a whole new set.
 *
 *   node scripts/store-shots.mjs 2.0.0           what is there, and what would be added
 *   node scripts/store-shots.mjs 2.0.0 --apply   adds them, then reads the set back
 */
import { createHash } from 'node:crypto'
import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { pathToFileURL, fileURLToPath } from 'node:url'
import { APPLE } from '../shared/stores.mjs'
import { token } from './store-text.mjs'

/* The folder's name, Apple's name for the size, and the only sizes Apple takes there (upright). */
export const DEVICES = {
  iphone: { type: 'APP_IPHONE_67', sizes: ['1320x2868', '1290x2796', '1260x2736'] },
  ipad: { type: 'APP_IPAD_PRO_3GEN_129', sizes: ['2064x2752', '2048x2732'] }
}
export const MOST = 10

export function pngSize(buf) {
  if (buf.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') throw new Error('not a PNG')
  return `${buf.readUInt32BE(16)}x${buf.readUInt32BE(20)}`
}

/** What is in a version's folder, checked against Apple's sizes before anything is sent. */
export function shotsFor(version, root = fileURLToPath(new URL('../store/app-store/screenshots/', import.meta.url))) {
  const out = []
  for (const [device, { type, sizes }] of Object.entries(DEVICES)) {
    const dir = `${root}${version}/${device}`
    if (!existsSync(dir)) continue
    for (const name of readdirSync(dir).filter((n) => n.endsWith('.png')).sort()) {
      const data = readFileSync(`${dir}/${name}`)
      const size = pngSize(data)
      if (!sizes.includes(size)) throw new Error(`${device}/${name} is ${size}; Apple takes ${sizes.join(' or ')} there`)
      out.push({ device, type, name, data, size, md5: createHash('md5').update(data).digest('hex') })
    }
  }
  return out
}

async function main() {
  const version = process.argv[2]
  const apply = process.argv.includes('--apply')
  /* "Just remove all of them and I'll give you all the new screenshots I want" (Justin, 17 November 2026): the iPhone's row only, on his word, each time. */
  const clear = process.argv.includes('--clear-iphone')
  if (!/^\d+\.\d+\.\d+$/.test(version ?? '')) throw new Error('which version? e.g. 2.0.0')
  const shots = shotsFor(version)
  const { ASC_KEY_ID: keyId, ASC_ISSUER_ID: issuerId, ASC_KEY_PATH: keyPath } = process.env
  if (!keyId || !issuerId || !keyPath) throw new Error('ASC_KEY_ID, ASC_ISSUER_ID and ASC_KEY_PATH are all needed')
  const jwt = token({ keyId, issuerId, p8: readFileSync(keyPath, 'utf8') })
  const asc = async (path, init = {}) => {
    const res = await fetch(`https://api.appstoreconnect.apple.com${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' }
    })
    if (!res.ok) {
      let why = ''
      try {
        why = (JSON.parse(await res.text()).errors ?? []).map((e) => `${e.code}: ${e.title} ${e.detail ?? ''}`).join('; ')
      } catch {}
      throw new Error(`${init.method ?? 'GET'} ${path.split('?')[0]} answered ${res.status} ${why}`)
    }
    const body = await res.text()
    return body ? JSON.parse(body) : null
  }

  const { data: versions } = await asc(`/v1/apps/${APPLE.id}/appStoreVersions?filter[platform]=IOS&limit=20`)
  const mine = versions.find((v) => v.attributes.versionString === version)
  if (!mine) throw new Error(`there is no version ${version} in App Store Connect`)
  const state = mine.attributes.appVersionState ?? mine.attributes.appStoreState
  if (!/PREPARE_FOR_SUBMISSION|REJECTED/.test(state)) throw new Error(`${version} is ${state}: not a version that can be edited`)
  const { data: locales } = await asc(`/v1/appStoreVersions/${mine.id}/appStoreVersionLocalizations`)
  const locale = locales.find((l) => l.attributes.locale === 'en-US') ?? locales[0]

  const setsNow = async () => {
    const { data, included = [] } = await asc(`/v1/appStoreVersionLocalizations/${locale.id}/appScreenshotSets?include=appScreenshots&limit=50&limit[appScreenshots]=50`)
    return data.map((set) => ({
      id: set.id,
      type: set.attributes.screenshotDisplayType,
      shots: (set.relationships?.appScreenshots?.data ?? []).map((r) => included.find((i) => i.id === r.id)).filter(Boolean)
    }))
  }
  const show = (sets) => {
    for (const s of sets) {
      console.log(`${s.type}: ${s.shots.length} picture(s)`)
      s.shots.forEach((p, i) => console.log(`  ${i + 1}. ${p.attributes.fileName} (${p.attributes.imageAsset?.width ?? '?'}x${p.attributes.imageAsset?.height ?? '?'}, ${p.attributes.assetDeliveryState?.state ?? '?'})`))
    }
    if (!sets.length) console.log('(no screenshots at all)')
  }
  let sets = await setsNow()
  console.log(`Version ${version} (${state}), ${locale.attributes.locale}, now:`)
  show(sets)

  if (clear) {
    const set = sets.find((s) => s.type === DEVICES.iphone.type)
    console.log(`\n${DEVICES.iphone.type}: ${apply ? 'removing' : 'would remove'} all ${set?.shots.length ?? 0} picture(s) there now. The iPad's and the watch's are left alone.`)
    if (apply && set) {
      for (const p of set.shots) {
        await asc(`/v1/appScreenshots/${p.id}`, { method: 'DELETE' })
        console.log(`  removed ${p.attributes.fileName}`)
      }
      set.shots = []
    } else if (set) set.shots = []
  }

  for (const type of new Set(shots.map((s) => s.type))) {
    const mineHere = shots.filter((s) => s.type === type)
    let set = sets.find((s) => s.type === type)
    const have = new Set((set?.shots ?? []).map((p) => p.attributes.sourceFileChecksum))
    const todo = mineHere.filter((s) => !have.has(s.md5))
    const total = (set?.shots.length ?? 0) + todo.length
    console.log(`\n${type}: ${todo.length} to add (${mineHere.length - todo.length} already there), making ${total}`)
    if (total > MOST) throw new Error(`${type} would hold ${total}; Apple takes ${MOST}. Nothing was added there.`)
    if (!apply || !todo.length) continue
    if (!set) {
      const made = await asc('/v1/appScreenshotSets', {
        method: 'POST',
        body: JSON.stringify({
          data: {
            type: 'appScreenshotSets',
            attributes: { screenshotDisplayType: type },
            relationships: { appStoreVersionLocalization: { data: { type: 'appStoreVersionLocalizations', id: locale.id } } }
          }
        })
      })
      set = { id: made.data.id, type, shots: [] }
    }
    for (const s of todo) {
      const { data: made } = await asc('/v1/appScreenshots', {
        method: 'POST',
        body: JSON.stringify({
          data: {
            type: 'appScreenshots',
            attributes: { fileName: s.name, fileSize: s.data.length },
            relationships: { appScreenshotSet: { data: { type: 'appScreenshotSets', id: set.id } } }
          }
        })
      })
      for (const op of made.attributes.uploadOperations ?? []) {
        const res = await fetch(op.url, {
          method: op.method,
          headers: Object.fromEntries((op.requestHeaders ?? []).map((h) => [h.name, h.value])),
          body: s.data.subarray(op.offset, op.offset + op.length)
        })
        if (!res.ok) throw new Error(`sending ${s.name} answered ${res.status}`)
      }
      await asc(`/v1/appScreenshots/${made.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ data: { type: 'appScreenshots', id: made.id, attributes: { uploaded: true, sourceFileChecksum: s.md5 } } })
      })
      console.log(`  sent ${s.device}/${s.name} (${s.size})`)
    }
  }

  if (apply) {
    await new Promise((r) => setTimeout(r, 20000))
    sets = await setsNow()
    console.log(`\nVersion ${version} after:`)
    show(sets)
    const failed = sets.flatMap((s) => s.shots).filter((p) => /FAILED/.test(p.attributes.assetDeliveryState?.state ?? ''))
    if (failed.length) throw new Error(`Apple refused ${failed.map((p) => p.attributes.fileName).join(', ')}`)
  } else console.log('\nNothing was sent. Run with "Write it" ticked to add them.')
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((e) => {
    console.error(`::error::${e.message}`)
    process.exit(1)
  })
}

/**
 * THE APP STORE'S FREE "7-DAY TRIAL" ITEM, made with the App Store Connect key.
 *
 * "Yes, you created yourself using the Apple key. If there's something you
 * cannot create, give me the instructions for grok bot to set it up for me."
 * (Justin, 7 November 2026.)
 *
 * Apple's guideline 3.1.1 lets an app that is not a subscription offer a free
 * trial only as a Non-Consumable in-app purchase at the free price, named like
 * "7-Day Trial". The iPhone's trial button buys it (mobile/src/lib/purchases.js
 * `startTrial`), and stays hidden until the store can sell it (`findStoreTrial`),
 * so the app went out before the item existed. This makes the item, every part
 * Apple asks for, exactly as docs/app-store.md "The seven-day free trial" lists
 * it, and can send it for review:
 *
 *   the item          Non-Consumable, productId TRIAL_PRODUCT_ID, Family Sharing off,
 *                     the review notes from docs/app-store.md
 *   English (U.S.)    the name and the description customers see
 *   price             Free (the 0.00 price point), set from the United States
 *   availability      the same countries as the full version's item
 *   review picture    docs/iap/trial-7day-review.png, the purchase page with the button
 *
 * Each part is made only if it is missing, so running it twice changes
 * nothing, and a run stopped half way is finished by the next. Nothing that
 * is there already is overwritten, except the item's own review notes and
 * the English name and description, which are brought back to the docs.
 *
 *   node scripts/iap-trial.mjs            says what is there and what it would do
 *   node scripts/iap-trial.mjs --apply    makes what is missing
 *   node scripts/iap-trial.mjs --submit   makes what is missing, then sends it for review
 *
 * Run by .github/workflows/iap-trial.yml with the key the builds already use
 * (ASC_KEY_ID, ASC_ISSUER_ID, ASC_KEY_P8). It builds nothing and spends no build slot.
 */
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { APPLE } from '../shared/stores.mjs'
import { TRIAL_DAYS, TRIAL_PRODUCT_ID } from '../shared/trial-rule.mjs'
import { fenced, token } from './store-text.mjs'

/** The full version's item: its countries are the trial's. purchases.js `PRODUCT_ID`. */
export const FULL_PRODUCT_ID = 'cloud.newbold.fractalremote.full'

/** Apple's limits for an in-app purchase, as App Store Connect enforces them. */
export const LIMITS = { referenceName: 64, displayName: 35, description: 55, reviewNote: 4000 }

/** The picture the reviewer is shown, and Apple's smallest size for it. */
export const SCREENSHOT = 'docs/iap/trial-7day-review.png'
export const SCREENSHOT_MIN = { width: 640, height: 920 }

/** The territory the price is set from; every other country follows it. */
export const BASE_TERRITORY = 'USA'

/**
 * What the item is, read from docs/app-store.md so the notes and the store
 * cannot disagree: the table under "App Store Connect: the free item" and the
 * fenced review notes under it. Refused if Apple would refuse it.
 */
export function trialItem(md) {
  const at = md.indexOf('### App Store Connect: the free item')
  if (at < 0) throw new Error('docs/app-store.md has no "### App Store Connect: the free item"')
  const section = md.slice(at, md.indexOf('\n### ', at + 4) > 0 ? md.indexOf('\n### ', at + 4) : undefined)
  const row = (field) => {
    const line = section.split('\n').find((l) => l.startsWith(`| ${field} |`))
    if (!line) throw new Error(`the free item's table has no "${field}" row`)
    const cell = line.split('|')[2].trim()
    const code = cell.match(/`([^`]+)`/)
    return code ? code[1] : cell.replace(/\*\*/g, '')
  }
  const item = {
    referenceName: row('Reference Name'),
    productId: row('Product ID'),
    displayName: row('Localization (English (U.S.)) Display Name'),
    description: row('Localization Description'),
    reviewNote: fenced(section, 'Review notes for the item:').split(/\s+/).filter(Boolean).join(' '),
    locale: 'en-US',
    type: 'NON_CONSUMABLE',
    familySharable: false
  }
  if (item.productId !== TRIAL_PRODUCT_ID) {
    throw new Error(`the docs say product ${item.productId}, the app buys ${TRIAL_PRODUCT_ID}`)
  }
  for (const key of Object.keys(LIMITS)) {
    const length = [...item[key]].length
    if (!length) throw new Error(`the free item's ${key} is empty`)
    if (length > LIMITS[key]) throw new Error(`the free item's ${key} is ${length} characters; App Store Connect takes ${LIMITS[key]}`)
  }
  if (!item.displayName.includes(`${TRIAL_DAYS}-Day`)) {
    throw new Error(`the name "${item.displayName}" does not say the trial's length, which 3.1.1 asks for`)
  }
  return item
}

/** The free price point among an item's price points, or null. */
export function freePoint(points) {
  return points.find((p) => Number(p?.attributes?.customerPrice) === 0) || null
}

/** A PNG's width and height, from its header; null for anything else. */
export function pngSize(bytes) {
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
  if (bytes.length < 24 || sig.some((b, i) => bytes[i] !== b)) return null
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) }
}

/** The review picture, refused if Apple would refuse it. */
export function reviewPicture(bytes) {
  const size = pngSize(bytes)
  if (!size) throw new Error(`${SCREENSHOT} is not a PNG`)
  if (size.width < SCREENSHOT_MIN.width || size.height < SCREENSHOT_MIN.height) {
    throw new Error(`${SCREENSHOT} is ${size.width}×${size.height}; Apple wants at least ${SCREENSHOT_MIN.width}×${SCREENSHOT_MIN.height}`)
  }
  return { ...size, bytes, fileSize: bytes.length, fileName: SCREENSHOT.split('/').pop(), checksum: createHash('md5').update(bytes).digest('hex') }
}

/** The states in which the item can be sent, and those in which it is already on its way or done. */
export const SENDABLE = new Set(['READY_TO_SUBMIT', 'DEVELOPER_ACTION_NEEDED', 'REJECTED'])
export const SENT = new Set(['WAITING_FOR_REVIEW', 'IN_REVIEW', 'PENDING_BINARY_APPROVAL', 'APPROVED', 'DEVELOPER_REMOVED_FROM_SALE', 'REMOVED_FROM_SALE'])

/**
 * Talks to App Store Connect. `fetch` is passed in so the whole run can be
 * held by a test against a pretend Apple (test/trial.mjs).
 */
export function client({ jwt, fetch = globalThis.fetch }) {
  const call = async (path, init = {}, { missingOk = false } = {}) => {
    const res = await fetch(`https://api.appstoreconnect.apple.com${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' }
    })
    const body = await res.text()
    if (missingOk && res.status === 404) return null
    if (!res.ok) throw new Error(`${init.method ?? 'GET'} ${path} answered ${res.status}: ${body.slice(0, 800)}`)
    return body ? JSON.parse(body) : null
  }
  /* Every page of a list, following Apple's `links.next`. */
  const all = async (path) => {
    const out = []
    let next = path
    while (next) {
      const page = await call(next)
      out.push(...(page?.data ?? []))
      const link = page?.links?.next
      next = link ? link.replace('https://api.appstoreconnect.apple.com', '') : null
    }
    return out
  }
  return { call, all, fetch }
}

const ref = (type, id) => ({ data: { type, id } })

/**
 * The run itself. `apply` makes what is missing; `submit` also sends it for
 * review. Without either it only reads, and says what it would do.
 */
export async function run({ asc, item, picture, apply = false, submit = false, log = console.log }) {
  const make = apply || submit
  const would = (what) => log(make ? `  making: ${what}` : `  would make: ${what}`)

  const items = await asc.all(`/v1/apps/${APPLE.id}/inAppPurchasesV2?limit=200`)
  const full = items.find((x) => x.attributes?.productId === FULL_PRODUCT_ID)
  let trial = items.find((x) => x.attributes?.productId === item.productId)
  log(`The full version's item: ${full ? `${full.attributes.name} (${full.attributes.state})` : `not found (${FULL_PRODUCT_ID})`}`)
  log(`The trial's item: ${trial ? `${trial.attributes.name} (${trial.attributes.state})` : 'not there yet'}`)

  /* 1. The item. */
  const attributes = {
    name: item.referenceName,
    reviewNote: item.reviewNote,
    familySharable: item.familySharable
  }
  if (!trial) {
    would(`the ${item.type} item ${item.productId}, "${item.referenceName}", Family Sharing off`)
    if (!make) {
      log('\nNothing else can be read before the item exists. Run with apply ticked to make it.')
      return { made: false }
    }
    const made = await asc.call('/v2/inAppPurchases', {
      method: 'POST',
      body: JSON.stringify({
        data: {
          type: 'inAppPurchases',
          attributes: { ...attributes, productId: item.productId, inAppPurchaseType: item.type },
          relationships: { app: ref('apps', APPLE.id) }
        }
      })
    })
    trial = made.data
  } else if (trial.attributes.inAppPurchaseType && trial.attributes.inAppPurchaseType !== item.type) {
    throw new Error(`${item.productId} exists as ${trial.attributes.inAppPurchaseType}; a product id can never change type, so it would need a new id`)
  } else {
    const stale = Object.keys(attributes).filter((k) => (trial.attributes[k] ?? null) !== attributes[k])
    if (stale.length && SENT.has(trial.attributes.state)) {
      log(`  left alone: ${stale.join(', ')} differ from the docs, but the item is ${trial.attributes.state}`)
    } else if (stale.length) {
      would(`the item's ${stale.join(', ')} brought back to the docs`)
      if (make) {
        await asc.call(`/v2/inAppPurchases/${trial.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ data: { type: 'inAppPurchases', id: trial.id, attributes } })
        })
      }
    }
  }
  const id = trial.id

  /* 2. The English name and description. */
  const locales = await asc.all(`/v2/inAppPurchases/${id}/inAppPurchaseLocalizations?limit=50`)
  const english = locales.find((l) => l.attributes?.locale === item.locale)
  const words = { name: item.displayName, description: item.description }
  if (!english) {
    would(`the ${item.locale} name "${words.name}" and description "${words.description}"`)
    if (make) {
      await asc.call('/v1/inAppPurchaseLocalizations', {
        method: 'POST',
        body: JSON.stringify({
          data: {
            type: 'inAppPurchaseLocalizations',
            attributes: { locale: item.locale, ...words },
            relationships: { inAppPurchaseV2: ref('inAppPurchases', id) }
          }
        })
      })
    }
  } else if (english.attributes.name !== words.name || english.attributes.description !== words.description) {
    if (SENT.has(trial.attributes.state)) {
      log(`  left alone: the ${item.locale} words differ from the docs, but the item is ${trial.attributes.state}`)
    } else {
      would(`the ${item.locale} name and description brought back to the docs`)
      if (make) {
        await asc.call(`/v1/inAppPurchaseLocalizations/${english.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ data: { type: 'inAppPurchaseLocalizations', id: english.id, attributes: words } })
        })
      }
    }
  }

  /* 3. The price: Free, from the United States. */
  const schedule = await asc.call(`/v2/inAppPurchases/${id}/iapPriceSchedule?include=manualPrices`, {}, { missingOk: true })
  const priced = Boolean(schedule?.data && (schedule.data.relationships?.manualPrices?.data?.length || schedule.included?.length))
  if (!priced) {
    const points = await asc.all(`/v2/inAppPurchases/${id}/pricePoints?filter[territory]=${BASE_TERRITORY}&limit=200`)
    const free = freePoint(points)
    if (!free) throw new Error(`App Store Connect offers no free price point for ${item.productId} in ${BASE_TERRITORY}; set Price to Free in App Store Connect by hand`)
    would(`the price: Free (price point ${free.id}), from ${BASE_TERRITORY}`)
    if (make) {
      await asc.call('/v1/inAppPurchasePriceSchedules', {
        method: 'POST',
        body: JSON.stringify({
          data: {
            type: 'inAppPurchasePriceSchedules',
            relationships: {
              inAppPurchase: ref('inAppPurchases', id),
              baseTerritory: ref('territories', BASE_TERRITORY),
              manualPrices: { data: [{ type: 'inAppPurchasePrices', id: '${free}' }] }
            }
          },
          included: [
            {
              type: 'inAppPurchasePrices',
              id: '${free}',
              attributes: { startDate: null },
              relationships: {
                inAppPurchaseV2: ref('inAppPurchases', id),
                inAppPurchasePricePoint: ref('inAppPurchasePricePoints', free.id)
              }
            }
          ]
        })
      })
    }
  } else {
    log('  the price is set already; left alone')
  }

  /* 4. The countries: the full version's. */
  const availability = await asc.call(`/v2/inAppPurchases/${id}/inAppPurchaseAvailability`, {}, { missingOk: true })
  if (!availability?.data) {
    let territories = []
    let inNew = true
    const fullAvailability = full ? await asc.call(`/v2/inAppPurchases/${full.id}/inAppPurchaseAvailability`, {}, { missingOk: true }) : null
    if (fullAvailability?.data) {
      inNew = fullAvailability.data.attributes?.availableInNewTerritories ?? true
      territories = await asc.all(`/v1/inAppPurchaseAvailabilities/${fullAvailability.data.id}/availableTerritories?limit=200`)
    }
    let from = "the full version's"
    if (!territories.length) {
      territories = await asc.all('/v1/territories?limit=200')
      from = 'every country App Store Connect lists'
    }
    would(`the countries: ${territories.length}, ${from}${inNew ? ', and new ones as Apple adds them' : ''}`)
    if (make) {
      await asc.call('/v1/inAppPurchaseAvailabilities', {
        method: 'POST',
        body: JSON.stringify({
          data: {
            type: 'inAppPurchaseAvailabilities',
            attributes: { availableInNewTerritories: inNew },
            relationships: {
              inAppPurchase: ref('inAppPurchases', id),
              availableTerritories: { data: territories.map((t) => ({ type: 'territories', id: t.id })) }
            }
          }
        })
      })
    }
  } else {
    log('  the countries are set already; left alone')
  }

  /* 5. The review picture. A failed upload is deleted and made again. */
  const shot = await asc.call(`/v2/inAppPurchases/${id}/appStoreReviewScreenshot`, {}, { missingOk: true })
  const shotState = shot?.data?.attributes?.assetDeliveryState?.state
  if (shot?.data && shotState !== 'FAILED') {
    log(`  the review picture is there already (${shotState ?? 'state unknown'}); left alone`)
  } else {
    would(`the review picture ${picture.fileName}, ${picture.width}×${picture.height}${shot?.data ? ', in place of the one that failed' : ''}`)
    if (make) {
      if (shot?.data) await asc.call(`/v1/inAppPurchaseAppStoreReviewScreenshots/${shot.data.id}`, { method: 'DELETE' })
      const reserved = await asc.call('/v1/inAppPurchaseAppStoreReviewScreenshots', {
        method: 'POST',
        body: JSON.stringify({
          data: {
            type: 'inAppPurchaseAppStoreReviewScreenshots',
            attributes: { fileSize: picture.fileSize, fileName: picture.fileName },
            relationships: { inAppPurchaseV2: ref('inAppPurchases', id) }
          }
        })
      })
      const sid = reserved.data.id
      for (const op of reserved.data.attributes.uploadOperations ?? []) {
        const headers = Object.fromEntries((op.requestHeaders ?? []).map((h) => [h.name, h.value]))
        const res = await asc.fetch(op.url, {
          method: op.method,
          headers,
          body: picture.bytes.subarray(op.offset, op.offset + op.length)
        })
        if (!res.ok) throw new Error(`uploading the review picture answered ${res.status}: ${(await res.text()).slice(0, 400)}`)
      }
      await asc.call(`/v1/inAppPurchaseAppStoreReviewScreenshots/${sid}`, {
        method: 'PATCH',
        body: JSON.stringify({
          data: { type: 'inAppPurchaseAppStoreReviewScreenshots', id: sid, attributes: { uploaded: true, sourceFileChecksum: picture.checksum } }
        })
      })
    }
  }

  if (!make) return { made: false, id }

  /* 6. Where it stands now, and the review. */
  const now = (await asc.call(`/v2/inAppPurchases/${id}`)).data.attributes.state
  log(`\nThe trial's item is now ${now}.`)
  if (!submit) return { made: true, id, state: now }
  if (SENT.has(now)) {
    log(`Not sent: it is ${now} already.`)
    return { made: true, id, state: now }
  }
  if (!SENDABLE.has(now)) {
    throw new Error(
      `it is ${now}, not ready to send. MISSING_METADATA usually means the review picture is still being processed: run it again in a few minutes.`
    )
  }
  await asc.call('/v1/inAppPurchaseSubmissions', {
    method: 'POST',
    body: JSON.stringify({ data: { type: 'inAppPurchaseSubmissions', relationships: { inAppPurchaseV2: ref('inAppPurchases', id) } } })
  })
  const after = (await asc.call(`/v2/inAppPurchases/${id}`)).data.attributes.state
  log(`Sent for review: it is ${after}.`)
  return { made: true, id, state: after, submitted: true }
}

async function main() {
  const submit = process.argv.includes('--submit')
  const apply = submit || process.argv.includes('--apply')
  const root = new URL('../', import.meta.url)
  const item = trialItem(readFileSync(new URL('docs/app-store.md', root), 'utf8'))
  const picture = reviewPicture(readFileSync(new URL(SCREENSHOT, root)))
  const { ASC_KEY_ID: keyId, ASC_ISSUER_ID: issuerId, ASC_KEY_PATH: keyPath } = process.env
  if (!keyId || !issuerId || !keyPath) throw new Error('ASC_KEY_ID, ASC_ISSUER_ID and ASC_KEY_PATH are all needed')
  const asc = client({ jwt: token({ keyId, issuerId, p8: readFileSync(keyPath, 'utf8') }) })
  console.log(`${item.referenceName} (${item.productId}), ${item.displayName}: "${item.description}"\n`)
  await run({ asc, item, picture, apply, submit })
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((err) => {
    console.error(`::error::${err.message}`)
    process.exit(1)
  })
}

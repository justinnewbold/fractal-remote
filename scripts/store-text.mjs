/**
 * PUT THE APP STORE'S PROMOTIONAL TEXT LIVE — the one paragraph Apple lets
 * change without a new build and without a review.
 *
 * It is the first thing on the listing, above the description, so it is where
 * "REQUIRES A COMPUTER" goes: "It's a lot of reading to get to that point. Just
 * want people to know up front what is needed." Everything else on the page
 * (description, subtitle, screenshots) belongs to a version, and only changes
 * when a new build goes in for review.
 *
 * The text is the fenced block under "### Promotional text" in
 * docs/app-store.md, so the notes and the store cannot disagree. Run by
 * .github/workflows/store-text.yml, which hands it the App Store Connect key
 * the builds already use (ASC_KEY_ID, ASC_ISSUER_ID, ASC_KEY_P8).
 *
 *   node scripts/store-text.mjs           shows what is there and what would change
 *   node scripts/store-text.mjs --apply   writes it, then reads it back
 */
import { createPrivateKey, sign } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { APPLE } from '../shared/stores.mjs'

export const PROMO_LIMIT = 170

/** The text of the fenced block under a heading, exactly as it would be pasted. */
export function fenced(md, heading) {
  const at = md.indexOf(heading)
  if (at < 0) throw new Error(`docs/app-store.md has no "${heading}"`)
  const open = md.indexOf('```', at)
  const close = md.indexOf('```', open + 3)
  if (open < 0 || close < 0) throw new Error(`"${heading}" has no fenced block under it`)
  return md.slice(md.indexOf('\n', open) + 1, close)
}

/** The promotional text as one paragraph, refused if Apple would refuse it. */
export function promoText(md) {
  const text = fenced(md, '### Promotional text').split(/\s+/).filter(Boolean).join(' ')
  if (!text) throw new Error('the promotional text is empty')
  const length = [...text].length
  if (length > PROMO_LIMIT) {
    throw new Error(`the promotional text is ${length} characters; App Store Connect takes ${PROMO_LIMIT}`)
  }
  return text
}

/**
 * The signed token App Store Connect asks for: ES256, the key's id in the
 * header, the issuer in the body, and an expiry no more than twenty minutes
 * out (Apple refuses a longer one). The signature is the raw 64-byte r||s
 * that JWT wants, not the DER that Node signs with by default.
 */
export function token({ keyId, issuerId, p8, now = Math.floor(Date.now() / 1000) }) {
  const part = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
  const head = part({ alg: 'ES256', kid: keyId, typ: 'JWT' })
  const body = part({ iss: issuerId, iat: now, exp: now + 15 * 60, aud: 'appstoreconnect-v1' })
  const signature = sign('sha256', Buffer.from(`${head}.${body}`), {
    key: createPrivateKey(p8),
    dsaEncoding: 'ieee-p1363'
  })
  return `${head}.${body}.${signature.toString('base64url')}`
}

/*
 * Which versions get the text. The one on sale, because that is the page
 * people see; and one still being put together, because a new version starts
 * as a copy of the old one's text and would otherwise put the old paragraph
 * back on the day it is released. A version in review is left alone.
 */
const LIVE = new Set(['READY_FOR_SALE', 'READY_FOR_DISTRIBUTION'])
const OPEN = new Set(['PREPARE_FOR_SUBMISSION', 'DEVELOPER_REJECTED', 'REJECTED', 'METADATA_REJECTED'])

export function targets(versions) {
  return versions.filter((v) => {
    const { appStoreState, appVersionState } = v.attributes ?? {}
    return [appStoreState, appVersionState].some((s) => LIVE.has(s) || OPEN.has(s))
  })
}

/*
 * And the ones it cannot touch yet but that are still coming: a version in
 * review, or approved and waiting to be released, carries its own copy of the
 * paragraph and puts it on the page the day it goes out. Not written, because
 * Apple's word on editing a version mid-review is not clear and a refusal
 * would stop the run before it reached the live one; SAID, so it is not a
 * surprise. Everything older is finished and never shown again.
 */
const GONE = new Set(['REPLACED_WITH_NEW_VERSION', 'REMOVED_FROM_SALE', 'DEVELOPER_REMOVED_FROM_SALE'])

export function coming(versions) {
  const chosen = new Set(targets(versions))
  return versions.filter((v) => {
    const { appStoreState, appVersionState } = v.attributes ?? {}
    return !chosen.has(v) && ![appStoreState, appVersionState].some((s) => GONE.has(s))
  })
}

async function main() {
  const apply = process.argv.includes('--apply')
  const text = promoText(readFileSync(new URL('../docs/app-store.md', import.meta.url), 'utf8'))
  const { ASC_KEY_ID: keyId, ASC_ISSUER_ID: issuerId, ASC_KEY_PATH: keyPath } = process.env
  if (!keyId || !issuerId || !keyPath) throw new Error('ASC_KEY_ID, ASC_ISSUER_ID and ASC_KEY_PATH are all needed')
  const jwt = token({ keyId, issuerId, p8: readFileSync(keyPath, 'utf8') })

  const asc = async (path, init = {}) => {
    const res = await fetch(`https://api.appstoreconnect.apple.com${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' }
    })
    const body = await res.text()
    if (!res.ok) throw new Error(`${init.method ?? 'GET'} ${path} answered ${res.status}: ${body.slice(0, 800)}`)
    return body ? JSON.parse(body) : null
  }

  console.log(`Promotional text (${[...text].length}/${PROMO_LIMIT}):\n  ${text}\n`)
  const { data: versions } = await asc(`/v1/apps/${APPLE.id}/appStoreVersions?filter[platform]=IOS&limit=20`)
  const chosen = targets(versions)
  if (!chosen.length) throw new Error('no version on sale or being prepared — nothing to put the text on')
  for (const v of coming(versions)) {
    const { versionString, appStoreState, appVersionState } = v.attributes
    console.log(
      `::warning::${versionString} is ${appVersionState ?? appStoreState} and was not changed. ` +
        'Run this again once it is released, or it goes out with its old paragraph.'
    )
  }

  for (const version of chosen) {
    const { versionString, appStoreState, appVersionState } = version.attributes
    const { data: locales } = await asc(`/v1/appStoreVersions/${version.id}/appStoreVersionLocalizations`)
    for (const locale of locales) {
      const was = locale.attributes.promotionalText ?? ''
      const where = `${versionString} (${appVersionState ?? appStoreState}), ${locale.attributes.locale}`
      if (was === text) {
        console.log(`${where}: already says this`)
        continue
      }
      console.log(`${where} now says:\n  ${was || '(nothing)'}`)
      if (!apply) {
        console.log('  — would change. Run with "Write it" ticked to change it.')
        continue
      }
      await asc(`/v1/appStoreVersionLocalizations/${locale.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          data: { type: 'appStoreVersionLocalizations', id: locale.id, attributes: { promotionalText: text } }
        })
      })
      const { data: after } = await asc(`/v1/appStoreVersionLocalizations/${locale.id}`)
      if (after.attributes.promotionalText !== text) {
        throw new Error(`${where}: wrote it, and it reads back as "${after.attributes.promotionalText}"`)
      }
      console.log('  — changed, and it reads back right.')
    }
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((err) => {
    console.error(`::error::${err.message}`)
    process.exit(1)
  })
}

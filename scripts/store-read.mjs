/**
 * READ WHAT THE APP STORE SAYS NOW, AND CHANGE NOTHING.
 *
 * "Also, can you read what's there on your own? I changed it last time and
 * it was fine." (Justin, 9 November 2026, of the review notes, which he had
 * edited by hand for 1.89.3.) Run by .github/workflows/store-text.yml with
 * "Show the texts" ticked: for the newest iOS versions it prints the
 * description, keywords, What's New and promotional text, the subtitle,
 * and the Notes for App Review, so the next version's texts start from his.
 *
 * Only GETs, never a write: test/limits.mjs holds that. The repository is
 * public and so are its Actions logs, so the review details print the notes
 * alone, never the demo account, its password or the contact, and the notes
 * pass through `redact` first in case a login was typed into them.
 *
 *   node scripts/store-read.mjs
 */
import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { APPLE } from '../shared/stores.mjs'
import { token } from './store-text.mjs'

/** The newest this many iOS versions are shown, newest first. */
export const SHOWN = 3

/** Emails and any line naming a password, a passcode or a login, hidden before a public log sees them. */
export function redact(text) {
  return String(text ?? '')
    .split('\n')
    .map((line) => (/pass(word|code)?\b|login|sign[- ]?in\s*:/i.test(line) && /[:=]/.test(line) ? '[a line with a login in it, left out]' : line))
    .join('\n')
    .replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, '[an email address]')
}

/** A field, as it would be pasted, with its length. */
export function field(name, value, unit = 'characters') {
  const text = String(value ?? '')
  const size = unit === 'bytes' ? Buffer.byteLength(text) : [...text].length
  return `--- ${name} (${size} ${unit}) ---\n${text || '(empty)'}\n`
}

async function main() {
  const { ASC_KEY_ID: keyId, ASC_ISSUER_ID: issuerId, ASC_KEY_PATH: keyPath } = process.env
  if (!keyId || !issuerId || !keyPath) throw new Error('ASC_KEY_ID, ASC_ISSUER_ID and ASC_KEY_PATH are all needed')
  const jwt = token({ keyId, issuerId, p8: readFileSync(keyPath, 'utf8') })
  const get = async (path) => {
    const res = await fetch(`https://api.appstoreconnect.apple.com${path}`, { headers: { Authorization: `Bearer ${jwt}` } })
    const body = await res.text()
    if (res.status === 404) return null
    if (!res.ok) throw new Error(`GET ${path} answered ${res.status}: ${body.slice(0, 600)}`)
    return body ? JSON.parse(body) : null
  }

  const { data: infos } = await get(`/v1/apps/${APPLE.id}/appInfos`)
  for (const info of infos ?? []) {
    const { data: locales } = await get(`/v1/appInfos/${info.id}/appInfoLocalizations`)
    for (const l of locales ?? []) {
      console.log(`App information (${info.attributes?.appStoreState ?? info.attributes?.state ?? '?'}), ${l.attributes.locale}`)
      console.log(field('Name', l.attributes.name))
      console.log(field('Subtitle', l.attributes.subtitle))
    }
  }

  const { data: versions } = await get(`/v1/apps/${APPLE.id}/appStoreVersions?filter[platform]=IOS&limit=${SHOWN}`)
  for (const v of versions ?? []) {
    const { versionString, appStoreState, appVersionState } = v.attributes
    console.log(`\n=========== ${versionString} (${appVersionState ?? appStoreState}) ===========`)
    const { data: locales } = await get(`/v1/appStoreVersions/${v.id}/appStoreVersionLocalizations`)
    for (const l of locales ?? []) {
      const a = l.attributes
      console.log(`Locale ${a.locale}`)
      console.log(field('Promotional text', a.promotionalText))
      console.log(field("What's New", a.whatsNew))
      console.log(field('Keywords', a.keywords))
      console.log(field('Description', a.description))
    }
    const review = await get(`/v1/appStoreVersions/${v.id}/appStoreReviewDetail`)
    console.log(field('Notes for App Review', redact(review?.data?.attributes?.notes), 'bytes'))
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((err) => {
    console.error(`::error::${err.message}`)
    process.exit(1)
  })
}

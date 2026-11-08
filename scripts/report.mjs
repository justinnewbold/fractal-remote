#!/usr/bin/env node
/*
 * READ A BUG REPORT, AND NOTHING ELSE.
 *
 * "So all of the bug reports people send you've just been getting from my
 * email? I thought we had it set up for you to read them directly?" (Justin,
 * 8 November 2026.) Every report a player sends lands in public.feedback and,
 * by the feedback-email function, in his inbox, with the whole log attached.
 * The email tool cannot open attachments, so this reads them where they are:
 * two fixed questions about reports, read only.
 *
 *   node scripts/report.mjs              the newest 10 reports, one line each
 *   node scripts/report.mjs --latest 25  the newest 25 (1 to 50)
 *   node scripts/report.mjs 014f2692     one report in full: its words, what
 *                                        it was sent from, and the whole log
 *                                        (the id or its first 8 characters,
 *                                        as the email's "Row" line and the
 *                                        log's file name give it)
 *
 * THROUGH THE read-reports FUNCTION, WITH A KEY THAT CAN DO NOTHING ELSE
 * (since 8 November 2026, "a read-only login for bug reports"). It asks
 * supabase/functions/read-reports, which answers those two questions about
 * public.feedback and nothing more, to a caller whose x-reports-key it has
 * enrolled. No token is needed here: in a Claude session the network proxy
 * adds the key to every request to the project's host, from the credential
 * Justin saved in its secure form, so this sends only the address. On a
 * machine without that proxy, READ_REPORTS_KEY in the environment is the key,
 * and it goes to curl on stdin (-H @-), never on its command line, where a
 * failed call's error message would print it (callError takes it out of
 * anything quoted, too). supabase/README.md, "Reading the reports without
 * the full-account key", says how the key is enrolled, rolled over and taken
 * back.
 *
 * The count is held to a whole number from 1 to 50 and an id to hex digits
 * and dashes, here and again in the function, and the questions themselves
 * are fixed in the database (read_reports_latest, read_report), so nothing
 * typed on the command line becomes SQL. It never writes, never deletes,
 * and reads no other table.
 *
 * THE OLD WAY, OFF UNLESS ASKED: --management-api sends the same two SELECTs
 * through the Management API with the full-account SUPABASE_TOKEN, as this
 * did before, for the day the function is down. That token can do anything
 * to the project, so it is never the default, and the token goes to curl on
 * stdin like the key.
 *
 * NO PERMISSION RULE ALLOWS IT, on purpose. A rule naming this command would
 * run whatever this file says on the branch checked out, so it would be a way
 * past the session's own check rather than a read-only door. Running it is
 * asked like any other command.
 *
 * Needs curl, which goes through whatever proxy the machine has.
 */
import { execFileSync } from 'node:child_process'

const PROJECT = 'biznwrqeckviawjuhvyg'
export const MOST = 50
/** The function this asks. */
export const FUNCTION_URL = `https://${PROJECT}.supabase.co/functions/v1/read-reports`
const MANAGEMENT_URL = `https://api.supabase.com/v1/projects/${PROJECT}/database/query`

/** A count for --latest, or a plain refusal. */
export function latestCount(count = 10) {
  const n = Number(count)
  if (!Number.isInteger(n) || n < 1 || n > MOST || !/^\d+$/.test(String(count).trim())) throw new Error(`--latest takes a whole number from 1 to ${MOST}`)
  return n
}

/** An id, or the start of one, lower-cased, or a plain refusal. */
export function reportPrefix(id) {
  const key = String(id || '').toLowerCase()
  if (!/^[0-9a-f-]{8,36}$/.test(key)) throw new Error('a report id is 8 to 36 hex digits and dashes, like 014f2692')
  return key
}

/** The two questions, as the function's addresses. Exported for the tests, which never touch the network. */
export const latestUrl = (count = 10) => `${FUNCTION_URL}?latest=${latestCount(count)}`
export const reportUrl = (id) => `${FUNCTION_URL}?id=${reportPrefix(id)}`

/**
 * curl's arguments for the function: a GET of the address, and nothing
 * secret. With `keyOnStdin` (READ_REPORTS_KEY set, off the proxy) the header
 * comes in on stdin; otherwise there is no header at all, and the proxy adds
 * it. Exported for the tests.
 */
export const functionArgs = (url, { keyOnStdin = false } = {}) => [
  '-sS',
  '--fail-with-body',
  '--max-time',
  '120',
  ...(keyOnStdin ? ['-H', '@-'] : []),
  url
]

/** The same two questions as SQL, for --management-api only. */
export function listQuery(count = 10) {
  return (
    'select id, created_at, kind, left(message, 140) as message, contact, ' +
    "context->>'unit' as unit, context->>'version' as version, context->>'os' as os, " +
    'length(log) as log_length from public.feedback order by created_at desc limit ' +
    latestCount(count)
  )
}

export function oneQuery(id) {
  return (
    'select id, created_at, kind, message, contact, context, log from public.feedback ' +
    `where id::text like '${reportPrefix(id)}%' order by created_at desc limit 2`
  )
}

/** curl's arguments for --management-api: the query in the body, and never the token, which goes in on stdin. Exported for the tests. */
export const managementArgs = (sql, url = MANAGEMENT_URL) => [
  '-sS',
  '--fail-with-body',
  '-X',
  'POST',
  url,
  '-H',
  '@-',
  '-H',
  'Content-Type: application/json',
  '--data-binary',
  JSON.stringify({ query: sql, read_only: true })
]

/** What to say when the function refused the key, in place of a bare 401. */
const NOT_ALLOWED =
  'The reports key was refused. In a Claude session it is the credential saved for ' +
  `${PROJECT}.supabase.co with the header x-reports-key, which the network proxy adds, and it has to have been enrolled ` +
  '(supabase/README.md, "Reading the reports without the full-account key"). Elsewhere, set READ_REPORTS_KEY.'

/** A failed call, said from its status and the service's answer only, never the command, and with the secret taken out of anything quoted. */
export function callError(err, secret) {
  const out = String(err?.stdout || '')
  const said = [err?.status != null ? `curl exited ${err.status}` : 'curl failed', out.slice(0, 300), String(err?.stderr || '').trim().slice(0, 300)]
    .filter(Boolean)
    .join(': ')
  const hint = /"why"\s*:\s*"not allowed"/.test(out) ? `\n${NOT_ALLOWED}` : ''
  return new Error((secret ? said.split(secret).join('***') : said) + hint)
}

/** The function's answer to one address: its rows. */
export function readAnswer(out) {
  let said
  try {
    said = JSON.parse(out)
  } catch {
    throw new Error(`unexpected answer: ${String(out).slice(0, 300)}`)
  }
  if (!said?.ok || !Array.isArray(said.reports)) throw new Error(`unexpected answer: ${String(out).slice(0, 300)}`)
  return said.reports
}

function askFunction(url) {
  const key = process.env.READ_REPORTS_KEY || ''
  /* A line break in it would be a second header on curl's stdin. */
  if (/[\r\n]/.test(key)) throw new Error('READ_REPORTS_KEY has a line break in it')
  let out
  try {
    out = execFileSync('curl', functionArgs(url, { keyOnStdin: Boolean(key) }), {
      input: key ? `x-reports-key: ${key}\n` : '',
      maxBuffer: 64 * 1024 * 1024,
      encoding: 'utf8'
    })
  } catch (err) {
    throw callError(err, key)
  }
  return readAnswer(out)
}

function askManagement(sql) {
  const token = process.env.SUPABASE_TOKEN
  if (!token) throw new Error('--management-api needs SUPABASE_TOKEN')
  let out
  try {
    out = execFileSync('curl', managementArgs(sql), { input: `Authorization: Bearer ${token}\n`, maxBuffer: 64 * 1024 * 1024, encoding: 'utf8' })
  } catch (err) {
    throw callError(err, token)
  }
  const rows = JSON.parse(out)
  if (!Array.isArray(rows)) throw new Error(`unexpected answer: ${out.slice(0, 300)}`)
  return rows
}

/** What the command line asks: the list or one report, and which way. Exported for the tests. */
export function plan(argv) {
  const all = argv.slice(2)
  const management = all.includes('--management-api')
  const args = all.filter((a) => a !== '--management-api')
  if (!args.length || args[0] === '--latest') {
    const count = latestCount(args[1] ?? 10)
    return { kind: 'list', management, count, url: latestUrl(count) }
  }
  return { kind: 'one', management, id: args[0], url: reportUrl(args[0]) }
}

function main(argv) {
  const asked = plan(argv)
  if (asked.kind === 'list') {
    const rows = asked.management ? askManagement(listQuery(asked.count)) : askFunction(asked.url)
    for (const r of rows) {
      const first = String(r.message || '').replace(/\s+/g, ' ').trim()
      const facts = [r.unit, r.version && `v${r.version}`, r.os].filter(Boolean).join(' · ')
      console.log(`${String(r.id).slice(0, 8)}  ${r.created_at}  ${r.kind || '?'}  ${r.contact || '(no email)'}  ${facts}  log ${r.log_length || 0} chars`)
      if (first) console.log(`          ${first}`)
    }
    if (!rows.length) console.log('No reports.')
    return
  }
  const rows = asked.management ? askManagement(oneQuery(asked.id)) : askFunction(asked.url)
  if (!rows.length) return console.log(`No report starts with ${asked.id}.`)
  if (rows.length > 1) console.log(`(more than one report starts with ${asked.id}: the newest is shown; give more of the id for the other)\n`)
  const r = rows[0]
  console.log(`Report ${r.id}\nSent ${r.created_at} · ${r.kind || '?'} · ${r.contact || '(no email)'}\n`)
  console.log(`${r.message || '(no words)'}\n`)
  console.log('What it was sent from:')
  console.log(JSON.stringify(r.context ?? {}, null, 2))
  console.log('\nThe log:\n')
  console.log(r.log || '(no log)')
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    main(process.argv)
  } catch (err) {
    console.error(String(err?.message || err))
    process.exit(1)
  }
}

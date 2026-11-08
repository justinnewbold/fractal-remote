#!/usr/bin/env node
/*
 * READ A BUG REPORT, AND NOTHING ELSE.
 *
 * "So all of the bug reports people send you've just been getting from my
 * email? I thought we had it set up for you to read them directly?" (Justin,
 * 8 November 2026.) Every report a player sends lands in public.feedback and,
 * by the feedback-email function, in his inbox, with the whole log attached.
 * The email tool cannot open attachments, and a free-form query on the live
 * database is a read of customers' data that has to be allowed by name. So
 * this is the one thing allowed: two fixed questions about reports, read only.
 *
 *   node scripts/report.mjs              the newest 10 reports, one line each
 *   node scripts/report.mjs --latest 25  the newest 25 (1 to 50)
 *   node scripts/report.mjs 014f2692     one report in full: its words, what
 *                                        it was sent from, and the whole log
 *                                        (the id or its first 8 characters,
 *                                        as the email's "Row" line and the
 *                                        log's file name give it)
 *
 * It sends nothing but a SELECT on public.feedback, built here from a fixed
 * shape: an id is held to hex digits and dashes, a count to a whole number
 * from 1 to 50, so nothing typed on the command line becomes SQL. It never
 * writes, never deletes, and reads no other table.
 *
 * NO PERMISSION RULE ALLOWS IT, on purpose. A rule naming this command
 * would run whatever this file says on the branch checked out, with the
 * full-account SUPABASE_TOKEN, so it would be a way past the session's own
 * check rather than a read-only door. Running it is asked like any other
 * command. An unprompted read would need a key that can do nothing but read
 * reports (a database role with SELECT on public.feedback alone), and that
 * is a change to the live database Justin decides.
 *
 * The token never goes on curl's command line, where a failed call's error
 * message would print it: curl reads the Authorization header from stdin
 * (-H @-), and an error is said without the command (callError).
 *
 * Needs SUPABASE_TOKEN (the Supabase access token, as every other server job
 * here uses) and curl, which goes through whatever proxy the machine has.
 */
import { execFileSync } from 'node:child_process'

const PROJECT = 'biznwrqeckviawjuhvyg'
const MOST = 50

/** The two questions, and only these. Exported for the tests, which never touch the network. */
export function listQuery(count = 10) {
  const n = Number(count)
  if (!Number.isInteger(n) || n < 1 || n > MOST) throw new Error(`--latest takes a whole number from 1 to ${MOST}`)
  return (
    'select id, created_at, kind, left(message, 140) as message, contact, ' +
    "context->>'unit' as unit, context->>'version' as version, context->>'os' as os, " +
    'length(log) as log_length from public.feedback order by created_at desc limit ' +
    n
  )
}

export function oneQuery(id) {
  const key = String(id || '').toLowerCase()
  if (!/^[0-9a-f-]{8,36}$/.test(key)) throw new Error('a report id is 8 to 36 hex digits and dashes, like 014f2692')
  return (
    'select id, created_at, kind, message, contact, context, log from public.feedback ' +
    `where id::text like '${key}%' order by created_at desc limit 2`
  )
}

/** curl's arguments: the query in the body, and never the token, which goes in on stdin. Exported for the tests. */
export const curlArgs = (sql, url = `https://api.supabase.com/v1/projects/${PROJECT}/database/query`) => [
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

/** A failed call, said from its status and the service's answer only, never the command, and with the token taken out of anything quoted. */
export function callError(err, token) {
  const said = [err?.status != null ? `curl exited ${err.status}` : 'curl failed', String(err?.stdout || '').slice(0, 300), String(err?.stderr || '').trim().slice(0, 300)]
    .filter(Boolean)
    .join(': ')
  return new Error(token ? said.split(token).join('***') : said)
}

function ask(sql) {
  const token = process.env.SUPABASE_TOKEN
  if (!token) throw new Error('SUPABASE_TOKEN is not set')
  let out
  try {
    out = execFileSync('curl', curlArgs(sql), { input: `Authorization: Bearer ${token}\n`, maxBuffer: 64 * 1024 * 1024, encoding: 'utf8' })
  } catch (err) {
    throw callError(err, token)
  }
  const rows = JSON.parse(out)
  if (!Array.isArray(rows)) throw new Error(`unexpected answer: ${out.slice(0, 300)}`)
  return rows
}

function main(argv) {
  const args = argv.slice(2)
  if (!args.length || args[0] === '--latest') {
    const rows = ask(listQuery(args[1] ?? 10))
    for (const r of rows) {
      const first = String(r.message || '').replace(/\s+/g, ' ').trim()
      const facts = [r.unit, r.version && `v${r.version}`, r.os].filter(Boolean).join(' · ')
      console.log(`${String(r.id).slice(0, 8)}  ${r.created_at}  ${r.kind || '?'}  ${r.contact || '(no email)'}  ${facts}  log ${r.log_length || 0} chars`)
      if (first) console.log(`          ${first}`)
    }
    if (!rows.length) console.log('No reports.')
    return
  }
  const rows = ask(oneQuery(args[0]))
  if (!rows.length) return console.log(`No report starts with ${args[0]}.`)
  if (rows.length > 1) console.log(`(more than one report starts with ${args[0]}: the newest is shown; give more of the id for the other)\n`)
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

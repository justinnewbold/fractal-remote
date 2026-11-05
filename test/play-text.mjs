/**
 * GOOGLE PLAY FROM GITHUB: THE LISTING, ITS PICTURES AND ITS CRASH REPORTS,
 * WRITTEN ONLY WHEN TOLD TO.
 *
 * scripts/play-text.mjs only ever runs with the real key, on GitHub, so
 * everything that can go wrong without it is RUN here, against a pretend
 * Google that answers the way the real one does and writes down every call:
 *
 *   - the sign-in Google checks (RS256, the robot, the scope, an hour at most);
 *   - a key that is broken, or another robot's, refused without a word of it
 *     in the message (the log is public);
 *   - the difference, paragraph by paragraph;
 *   - the limits and the words, checked before anything is sent;
 *   - nothing written without "Write it", and with it, only what differs,
 *     never a language added, and never a review in progress cancelled;
 *   - the pictures and the crash reports only read;
 *   - the job itself: by hand, on main, its key in one step's environment;
 *   - and the repo's copy of the words, the one docs/app-store.md keeps.
 */
import assert from 'node:assert/strict'
import { generateKeyPairSync, verify } from 'node:crypto'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')
const SCRIPT = '../scripts/play-text.mjs'
const ROBOT = 'fractal-remote-listing@fractal-remote.iam.gserviceaccount.com'
const APP = '/androidpublisher/v3/applications/cloud.newbold.fractalremote'
const REPORTS = '/v1beta1/apps/cloud.newbold.fractalremote'

/* One throwaway RSA key for every test here, made once: 2048 bits takes a moment. */
let made
const throwaway = () => {
  if (!made) {
    const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
    made = { pem: privateKey.export({ type: 'pkcs8', format: 'pem' }), publicKey }
  }
  return made
}

/** A service-account file the way Google gives one out, for the throwaway key. */
const keyFile = (over = {}) =>
  JSON.stringify({
    type: 'service_account',
    project_id: 'fractal-remote',
    private_key_id: 'kid-1',
    private_key: throwaway().pem,
    client_email: ROBOT,
    ...over
  })

/** The claims inside a signed note. */
const claimsOf = (jwt) => JSON.parse(Buffer.from(jwt.split('.')[1], 'base64url').toString('utf8'))

/**
 * A pretend Google: the token endpoint, the publishing interface with drafts
 * that are copies of the live listing until committed, and the reporting
 * interface. `commit` and `validate` may answer one themselves (a review in
 * progress, say), or throw, as a connection that drops does.
 */
function pretendGoogle({ listings = [], defaultLanguage = 'en-US', commit, validate, images = {}, reports = {} } = {}) {
  const calls = []
  const live = new Map(listings.map((l) => [l.language, { ...l }]))
  const drafts = new Map()
  let edits = 0
  const answer = (status, body) => ({
    ok: status >= 200 && status < 300,
    status,
    text: async () => (body === undefined ? '' : typeof body === 'string' ? body : JSON.stringify(body))
  })
  async function fetch(url, init = {}) {
    const method = init.method ?? 'GET'
    const u = new URL(url)
    const call = { method, url: String(url), host: u.host, path: u.pathname, query: Object.fromEntries(u.searchParams), body: init.body, headers: init.headers ?? {} }
    calls.push(call)
    if (u.host === 'oauth2.googleapis.com') return answer(200, { access_token: 'ya29.pretend-token', expires_in: 3600, token_type: 'Bearer' })
    if (u.host === 'androidpublisher.googleapis.com') {
      if (!u.pathname.startsWith(APP)) return answer(404, 'no such app')
      const rest = u.pathname.slice(APP.length)
      if (method === 'POST' && rest === '/edits') {
        const id = `e${++edits}`
        drafts.set(id, new Map([...live].map(([k, v]) => [k, { ...v }])))
        return answer(200, { id, expiryTimeSeconds: '1999999999' })
      }
      const m = rest.match(/^\/edits\/(e\d+)(.*)$/)
      if (m) {
        const [, id, tail] = m
        const draft = drafts.get(id)
        if (!draft) return answer(404, `no edit ${id}`)
        if (method === 'DELETE' && tail === '') {
          drafts.delete(id)
          return answer(200, {})
        }
        if (method === 'GET' && tail === '/details') return answer(200, { defaultLanguage, contactEmail: 'help@example.com' })
        if (method === 'GET' && tail === '/listings') return answer(200, { kind: 'androidpublisher#listingsListResponse', listings: [...draft.values()] })
        const one = tail.match(/^\/listings\/([^/]+)$/)
        if (one && method === 'GET') return draft.has(decodeURIComponent(one[1])) ? answer(200, draft.get(decodeURIComponent(one[1]))) : answer(404, 'no listing')
        if (one && method === 'PUT') {
          const body = JSON.parse(init.body)
          draft.set(decodeURIComponent(one[1]), body)
          return answer(200, body)
        }
        const pics = tail.match(/^\/listings\/([^/]+)\/([A-Za-z]+)$/)
        if (pics && method === 'GET') return answer(200, images[`${decodeURIComponent(pics[1])}/${pics[2]}`] ?? {})
        if (method === 'POST' && tail === ':validate') {
          const own = validate?.(call)
          if (own) return answer(...own)
          return answer(200, { id })
        }
        if (method === 'POST' && tail === ':commit') {
          const own = commit?.(call)
          if (own) return answer(...own)
          for (const [k, v] of draft) live.set(k, v)
          drafts.delete(id)
          return answer(200, { id })
        }
      }
      return answer(400, `pretend Google does not know ${method} ${u.pathname}`)
    }
    if (u.host === 'playdeveloperreporting.googleapis.com') {
      const rest = u.pathname.slice(REPORTS.length)
      if (reports[`${method} ${rest}`]) return answer(...reports[`${method} ${rest}`](call))
      return answer(400, `pretend Google does not know ${method} ${u.pathname}`)
    }
    return answer(400, `pretend Google has no ${u.host}`)
  }
  return { fetch, calls, live, drafts, google: () => calls.filter((c) => c.host !== 'oauth2.googleapis.com') }
}

/** A listing that passes every rule, with Fractal Audio's sentence and the trademark line as its second paragraph. */
const cleanListing = async (language = 'en-US') => {
  const { AFFILIATION } = await import('../shared/affiliation.mjs')
  return {
    language,
    title: 'Fractal Remote',
    shortDescription: 'Through a computer, or by Bluetooth. Not made or supported by Fractal Audio.',
    fullDescription: ['Your phone runs your rig from across the stage.', '', AFFILIATION, '', 'SUPPORTED UNITS', 'FM3, FM9, Axe-Fx III, AM4 and VP4.'].join('\n')
  }
}

/** A store/google-play/ folder of its own, so the real one's UNCHECKED marker stays out of it. Each is taken away when the run ends. */
const folders = []
const repoFolder = (langs) => {
  const dir = mkdtempSync(join(tmpdir(), 'play-text-'))
  if (!folders.length) process.once('exit', () => folders.forEach((d) => rmSync(d, { recursive: true, force: true })))
  folders.push(dir)
  for (const l of langs) {
    mkdirSync(join(dir, l.language))
    writeFileSync(join(dir, l.language, 'title.txt'), `${l.title}\n`)
    writeFileSync(join(dir, l.language, 'short_description.txt'), `${l.shortDescription}\n`)
    writeFileSync(join(dir, l.language, 'full_description.txt'), `${l.fullDescription}\n`)
    if (l.unchecked) writeFileSync(join(dir, l.language, 'UNCHECKED.txt'), 'filled from the docs\n')
  }
  return dir
}

/** Play as it is, with a video and a German listing the repo does not have; the repo with one paragraph moved on. */
const aDifference = async () => {
  const repo = await cleanListing()
  const live = {
    ...repo,
    fullDescription: repo.fullDescription.replace('from across the stage.', 'from anywhere.'),
    video: 'https://www.youtube.com/watch?v=pretend'
  }
  const german = { ...(await cleanListing('de-DE')), title: 'Fractal Remote', video: '' }
  return { repo, live, german }
}

const lines = () => {
  const out = []
  return Object.assign((...a) => out.push(a.join(' ')), { out, text: () => out.join('\n') })
}

/** Anything but a read: opening a draft, throwing one away and asking a report are the only other calls a read makes. */
const isWrite = (c) => {
  if (c.host === 'oauth2.googleapis.com' || c.method === 'GET') return false
  if (c.method === 'POST' && (c.path === `${APP}/edits` || /:query$/.test(c.path))) return false
  if (c.method === 'DELETE' && c.path.startsWith(APP) && /^\/edits\/e\d+$/.test(c.path.slice(APP.length))) return false
  return true
}

export function run(test) {
  test('the Google key signs in the way Google checks it', async () => {
    /*
     * Google's service-account sign-in: a note signed with the robot's own
     * key (RS256: RSA, SHA-256, PKCS#1 v1.5), the key's id in the header, the
     * robot as issuer, the scope asked for, Google's token address as the
     * audience, and an hour at most, which Google refuses past. Traded at
     * that address, form-encoded, for an hour's access token.
     */
    const { assertion, accessToken, TOKEN_URL, SCOPES, LISTING_ROBOT } = await import(SCRIPT)
    assert.equal(LISTING_ROBOT, ROBOT, 'the job takes some other robot than the listing one Justin made')
    assert.equal(TOKEN_URL, 'https://oauth2.googleapis.com/token')
    assert.equal(SCOPES.publisher, 'https://www.googleapis.com/auth/androidpublisher')
    assert.equal(SCOPES.reporting, 'https://www.googleapis.com/auth/playdeveloperreporting')

    const { pem, publicKey } = throwaway()
    const jwt = assertion({ email: ROBOT, privateKey: pem, keyId: 'kid-1', scope: SCOPES.publisher, now: 1_000_000 })
    const [head, body, signature] = jwt.split('.')
    assert.deepEqual(JSON.parse(Buffer.from(head, 'base64url').toString('utf8')), { alg: 'RS256', typ: 'JWT', kid: 'kid-1' })
    const claims = claimsOf(jwt)
    assert.equal(claims.iss, ROBOT)
    assert.equal(claims.scope, SCOPES.publisher)
    assert.equal(claims.aud, TOKEN_URL)
    assert.equal(claims.iat, 1_000_000)
    assert.ok(claims.exp > claims.iat && claims.exp - claims.iat <= 3600, 'Google refuses a note that lives past an hour')
    const raw = Buffer.from(signature, 'base64url')
    assert.equal(raw.length, 256, 'the signature is not a 2048-bit RSA one')
    assert.ok(verify('sha256', Buffer.from(`${head}.${body}`), publicKey, raw), 'the note does not verify against its own key')

    const g = pretendGoogle()
    const masked = []
    const token = await accessToken({ key: { email: ROBOT, privateKey: pem, keyId: 'kid-1' }, scope: SCOPES.reporting, fetch: g.fetch, mask: (t) => masked.push(t) })
    assert.equal(token, 'ya29.pretend-token')
    const [sent] = g.calls
    assert.deepEqual(masked, [new URLSearchParams(sent.body).get('assertion'), token], 'the signed note and the token are not masked the moment each exists')
    assert.equal(sent.url, TOKEN_URL)
    assert.equal(sent.method, 'POST')
    assert.equal(sent.headers['Content-Type'], 'application/x-www-form-urlencoded')
    assert.ok(sent.body.startsWith('grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion='), 'the sign-in is not the JWT-bearer grant Google takes')
    assert.equal(claimsOf(new URLSearchParams(sent.body).get('assertion')).scope, SCOPES.reporting, 'the note asks for another scope than the one wanted')

    /* A refusal says Google's reason, and nothing of the note. */
    const refusing = async () => ({ ok: false, status: 400, text: async () => JSON.stringify({ error: 'invalid_grant', error_description: 'Invalid JWT Signature.' }) })
    let said = ''
    try {
      await accessToken({ key: { email: ROBOT, privateKey: pem, keyId: 'kid-1' }, scope: SCOPES.publisher, fetch: refusing })
    } catch (err) {
      said = err.message
    }
    assert.equal(said, 'Google refused the sign-in (400): invalid_grant Invalid JWT Signature.')
  })

  test('a broken key, or another robot’s, is refused without a word of it in the message', async () => {
    /*
     * The log is public, and JSON.parse's own error quotes what it choked
     * on, which here is the key. So every refusal is a fixed sentence. And
     * only the listing robot's key is taken: the robot that sends builds
     * must never be handed to a job that can be started with one click.
     */
    const { serviceAccount, run: job } = await import(SCRIPT)
    const refusal = (raw) => {
      try {
        serviceAccount(raw)
      } catch (err) {
        return err.message
      }
      return null
    }
    for (const raw of ['{"private_key": "SECRETBYTES', 'SECRETBYTES', '', undefined, '[]', JSON.stringify({ type: 'authorized_user', private_key: 'SECRETBYTES' })]) {
      const said = refusal(raw)
      assert.equal(said, 'GOOGLE_PLAY_KEY is not a Google service-account key file', `a broken key gave "${said}"`)
    }
    const other = refusal(keyFile({ client_email: 'fractal-remote-play@fractal-remote.iam.gserviceaccount.com' }))
    assert.match(other ?? '', /belongs to fractal-remote-play@fractal-remote\.iam\.gserviceaccount\.com, not the listing robot/, 'the release robot’s key is taken')
    assert.ok(!/PRIVATE KEY/.test(other), 'the refusal carries the key')
    const odd = refusal(keyFile({ client_email: 'SECRETBYTES' }))
    assert.ok(odd && !odd.includes('SECRETBYTES'), 'a strange address is repeated into the log')
    assert.match(refusal(keyFile({ private_key: undefined })) ?? '', /no private_key/)
    const garbage = refusal(keyFile({ private_key: 'SECRETBYTES' }))
    assert.ok(garbage && !garbage.includes('SECRETBYTES'), 'a broken private key is repeated into the log')
    const ec = generateKeyPairSync('ec', { namedCurve: 'P-256' }).privateKey.export({ type: 'pkcs8', format: 'pem' })
    assert.match(refusal(keyFile({ private_key: ec })) ?? '', /not an RSA key/, 'a key Google cannot check RS256 against is taken')
    assert.deepEqual(serviceAccount(keyFile()), { email: ROBOT, privateKey: throwaway().pem, keyId: 'kid-1' })

    /*
     * GitHub masks the secret as stored, one line of JSON with the key's
     * line breaks written as \n; parsed, no line of the key matches that
     * mask. So every line of it is masked as soon as it is read, even from a
     * key that is then refused (its BEGIN and END lines are in every key).
     */
    const body = throwaway().pem.split('\n').filter((l) => l && !l.startsWith('-----'))
    assert.ok(body.length > 10, 'the throwaway key has no lines to mask')
    for (const raw of [keyFile(), keyFile({ client_email: 'fractal-remote-play@fractal-remote.iam.gserviceaccount.com' }), keyFile({ private_key: throwaway().pem.replace(/\n/g, '\r\n') })]) {
      const masked = []
      try {
        serviceAccount(raw, (t) => masked.push(t))
      } catch {}
      assert.deepEqual(masked, body, 'a line of the key is not masked the moment it is read')
    }

    /* And a run with a broken key says so before Google is asked anything. */
    for (const mode of ['listing', 'images', 'vitals']) {
      const g = pretendGoogle()
      const dir = repoFolder([await cleanListing()])
      await assert.rejects(job({ mode, rawKey: '{"SECRETBYTES', fetch: g.fetch, log: lines(), repoDir: dir }), (err) => !err.message.includes('SECRETBYTES'))
      assert.equal(g.calls.length, 0, `${mode}: Google was asked something with a broken key`)
    }
  })

  test('the difference is shown line by line, and the same words are the same', async () => {
    const { diffLines, showDiff, same } = await import(SCRIPT)
    const was = 'One.\n\nTwo.\n\nThree.'
    const now = 'One.\n\nTwo, and more.\n\nThree.'
    const d = diffLines(was, now)
    assert.deepEqual(d.filter((x) => x.kind === '-').map((x) => x.text), ['Two.'])
    assert.deepEqual(d.filter((x) => x.kind === '+').map((x) => x.text), ['Two, and more.'])
    assert.equal(d.filter((x) => x.kind === ' ').length, 4, 'a paragraph both say is shown as changed')
    assert.ok(diffLines(was, was).every((x) => x.kind === ' '))
    assert.deepEqual(diffLines('A', 'A\n\nB').filter((x) => x.kind !== ' ').map((x) => x.kind + x.text), ['+', '+B'], 'a paragraph added is not one paragraph added')

    /* Unchanged paragraphs far from the change fold away; the one next to it stays, so the change can be found. */
    const long = Array.from({ length: 12 }, (_, i) => `Paragraph ${i}.`)
    const shown = showDiff(diffLines(long.join('\n'), [...long.slice(0, 11), 'The last one, new.'].join('\n')))
    assert.match(shown, /… \(10 lines the same\)/)
    assert.match(shown, /^ {4}Paragraph 10\.$/m)
    assert.match(shown, /^ {2}- Paragraph 11\.$/m)
    assert.match(shown, /^ {2}\+ The last one, new\.$/m)
    assert.ok(!shown.includes('Paragraph 3.'), 'a paragraph far from the change is printed')

    assert.ok(same('One.\r\nTwo.\r\n', 'One.\nTwo.'), 'Windows line ends or a last newline count as a difference')
    assert.ok(same(undefined, ''), 'an empty box and a missing one differ')
    assert.ok(!same('One.', 'One!'))
  })

  test('lengths and words are checked before anything is sent', async () => {
    /*
     * Each rule is one this project already holds its store texts to:
     * Google's three limits; the name, which stays; Fractal Audio's sentence
     * and the trademark line, word for word; never official, certified,
     * approved, endorsed or authorised (the disclaimer's own "endorsed by"
     * aside); not Inc., not "sponsored by"; no "beta" for Bluetooth since 26
     * October 2026; nothing that says what has been tried (31 October 2026);
     * no free app; no shouting in the short description.
     */
    const { problems, run: job } = await import(SCRIPT)
    const { NOT_AFFILIATED, TRADEMARKS } = await import('../shared/affiliation.mjs')
    const clean = await cleanListing()
    assert.deepEqual(problems(clean), [], 'a listing that keeps every rule is refused')
    const { fullDescription: full } = clean
    for (const [why, change, says] of [
      ['a 31-character title', { title: 'Fractal Remote Fractal Remote X' }, /title is 31 characters; Google Play takes 30/],
      ['another title', { title: 'Fractal Remote Pro' }, /title is "Fractal Remote Pro", and the app is called Fractal Remote/],
      ['an empty title', { title: '' }, /title is empty/],
      ['an 81-character short description', { shortDescription: 'a'.repeat(81) }, /short description is 81 characters; Google Play takes 80/],
      ['a 4,001-character full description', { fullDescription: `${full}\n${'a'.repeat(4000 - [...full].length)}` }, /full description is 4,001 characters; Google Play takes 4,000/],
      ['no sentence of Fractal Audio’s', { fullDescription: full.replace(NOT_AFFILIATED, '') }, /does not carry Fractal Audio's sentence word for word/],
      ['the sentence reworded', { fullDescription: full.replace('or supported by', 'or sponsored by') }, /Fractal Audio's sentence/],
      ['no trademark line', { fullDescription: full.replace(TRADEMARKS, '') }, /does not carry the trademark line/],
      ['Inc.', { fullDescription: `${full}\nBy Fractal Audio Systems, Inc.` }, /calls Fractal Audio "Inc\."/],
      ['sponsored by', { shortDescription: 'Not sponsored by Fractal Audio.' }, /says "sponsored by"/],
      ['official', { fullDescription: `${full}\nThe official remote.` }, /says "official"/],
      ['approved', { shortDescription: 'An approved remote for your rig.' }, /says "approved"/],
      ['endorsed, outside the disclaimer', { fullDescription: `${full}\nEndorsed by players everywhere.` }, /says "Endorsed"/],
      ['Bluetooth (beta)', { fullDescription: `${full}\nBLUETOOTH (BETA)` }, /calls Bluetooth a beta/],
      ['a Bluetooth line that says beta', { fullDescription: `${full}\nBluetooth is in beta for now.` }, /calls Bluetooth a beta/],
      ['what has been tried', { fullDescription: `${full}\nSo far it has been tried on the AM4.` }, /says "tried"/],
      ['tested', { shortDescription: 'Tested on the AM4. Not made or supported by Fractal Audio.' }, /says "Tested"/],
      ['a free app', { fullDescription: `${full}\nGet the free desktop app.` }, /calls an app free/],
      ['capitals in the short description', { shortDescription: 'REQUIRES a computer or Bluetooth.' }, /shouts \("REQUIRES"\)/],
      ['officially', { fullDescription: `${full}\nAn officially recognised remote.` }, /says "officially"/],
      ['official, with a character nobody sees inside it', { shortDescription: 'The off\u200Bicial remote for your rig.' }, /says "official"/],
      ['approved, with a soft hyphen inside it', { fullDescription: `${full}\nAp\u00ADproved for the stage.` }, /says "Approved"/],
      ['beta in the paragraph after Bluetooth', { fullDescription: `${full}\nBluetooth works now.\nIt is a beta.` }, /calls Bluetooth a beta/],
      ['a beta beside Edit (Beta)', { fullDescription: `${full}\nEdit (Beta) and Bluetooth (in beta) are new.` }, /calls Bluetooth a beta/],
      ['a free app, after a hyphen-free word', { fullDescription: `${full}\nA hands-free remote, and a free app on the computer.` }, /calls an app free/],
      ['capitals beside MIDI', { shortDescription: 'MIDI by Bluetooth, LIVE. Not made or supported by Fractal Audio.' }, /shouts \("LIVE"\)/]
    ]) {
      const found = problems({ ...clean, ...change })
      assert.ok(found.some((p) => says.test(p)), `${why} is not refused (it said: ${found.join(' | ') || 'nothing'})`)
    }
    /* Capitals are fine in the full description, where SUPPORTED UNITS has been since launch. */
    assert.deepEqual(problems({ ...clean, fullDescription: `${full}\nWHAT IT DOES` }), [])
    /* And three right texts the rules once refused: a name in capitals, Edit (Beta) beside Bluetooth, and hands-free. */
    assert.deepEqual(problems({ ...clean, shortDescription: 'By computer or Bluetooth MIDI. Not made or supported by Fractal Audio.' }), [], 'MIDI, a name, is taken for shouting')
    assert.deepEqual(problems({ ...clean, fullDescription: `${full}\nEdit (Beta) does not work over Bluetooth yet.` }), [], 'Edit (Beta), which keeps its word, is taken for Bluetooth called a beta')
    assert.deepEqual(problems({ ...clean, fullDescription: `${full}\nHands-free control from the app.` }), [], 'hands-free is taken for a free app')

    /* The never-words are the ones test/independent.mjs holds the repo's own texts to, the same list. */
    const { NEVER } = await import(SCRIPT)
    const theirs = read('test/independent.mjs').match(/const words = \/(.+)\/i\n/)?.[1]
    assert.equal(theirs, NEVER.source, 'play-text and test/independent.mjs no longer refuse the same words')

    /* Refused BEFORE ANYTHING IS SENT: not the sign-in, not a draft. */
    const g = pretendGoogle({ listings: [clean] })
    const bad = repoFolder([{ ...clean, fullDescription: `${full}\nSo far it has been tried on the AM4.` }])
    await assert.rejects(job({ mode: 'listing', apply: true, rawKey: keyFile(), fetch: g.fetch, log: lines(), repoDir: bad }), /Nothing was sent\. "Write it" is refused:[\s\S]*en-US: the full description says "tried"/)
    assert.equal(g.calls.length, 0, 'Google was asked something before a text it would be refused for was caught')
    const seed = repoFolder([{ ...clean, unchecked: true }])
    await assert.rejects(job({ mode: 'listing', apply: true, rawKey: keyFile(), fetch: g.fetch, log: lines(), repoDir: seed }), /en-US was filled from docs\/app-store\.md, not read from Play[\s\S]*UNCHECKED\.txt/)
    assert.equal(g.calls.length, 0, 'Write it went ahead on a copy nobody checked against Play')

    /* Unticked, the same problems are only shown, and the run reads on. */
    const log = lines()
    await job({ mode: 'listing', rawKey: keyFile(), fetch: g.fetch, log, repoDir: bad })
    assert.match(log.text(), /Would be refused if written:\n::warning::en-US: the full description says "tried"/)
    assert.ok(g.calls.length > 0 && !g.calls.some(isWrite), 'a run without Write it wrote')
  })

  test('nothing is written without Write it, and with it only what differs', async () => {
    const { run: job } = await import(SCRIPT)
    const { repo, live, german } = await aDifference()
    const dir = repoFolder([repo])
    const listings = [live, german]

    /* Unticked: read, show, and throw the draft away. */
    let g = pretendGoogle({ listings })
    let log = lines()
    assert.deepEqual(await job({ mode: 'listing', rawKey: keyFile(), fetch: g.fetch, log, repoDir: dir }), { wrote: [] })
    assert.ok(!g.calls.some(isWrite), `a run without Write it wrote: ${g.calls.filter(isWrite).map((c) => `${c.method} ${c.path}`)}`)
    assert.deepEqual(g.google().at(-1) && [g.google().at(-1).method, g.google().at(-1).path], ['DELETE', `${APP}/edits/e1`], 'the draft opened to read Play is not thrown away')
    assert.equal(g.drafts.size, 0)
    assert.equal(g.live.get('en-US').fullDescription, live.fullDescription)
    const said = log.text()
    assert.match(said, /en-US, the title \(14\/30\): already says this/)
    assert.match(said, /en-US, the full description \(Play \d+, the repo \d+, of 4000\): Play says the lines with -, and the repo says the lines with \+:\n {2}- Your phone runs your rig from anywhere\.\n {2}\+ Your phone runs your rig from across the stage\./)
    assert.match(said, / {2}— would change\. Run with "Write it" ticked to change it\./)
    assert.match(said, /de-DE: no copy in store\/google-play\/, so it is left as it is/)
    assert.match(said, /Nothing was changed: the draft opened in Play Console to read this was thrown away\./)
    const tokenAsk = claimsOf(new URLSearchParams(g.calls[0].body).get('assertion'))
    assert.equal(tokenAsk.scope, 'https://www.googleapis.com/auth/androidpublisher', 'the listing asks for more than the publishing scope')
    /* Play's own text in the run's summary, whole, to copy into the repo. */
    const summary = []
    await job({ mode: 'listing', rawKey: keyFile(), fetch: pretendGoogle({ listings }).fetch, log: lines(), repoDir: dir, summary: (s) => summary.push(s) })
    assert.ok(summary.join('').includes(`~~~~text\n${live.fullDescription}\n~~~~`), 'the summary does not carry Play’s full description to copy')

    /* Ticked: the one listing that differs, the whole of it with its video, checked, then sent without cancelling anything. */
    g = pretendGoogle({ listings })
    log = lines()
    assert.deepEqual(await job({ mode: 'listing', apply: true, rawKey: keyFile(), fetch: g.fetch, log, repoDir: dir }), { wrote: ['en-US'] })
    const calls = g.google().map((c) => `${c.method} ${c.path.slice(APP.length)}`)
    const puts = g.google().filter((c) => c.method === 'PUT')
    assert.equal(puts.length, 1, 'more than the one listing that differs was written')
    assert.equal(puts[0].path, `${APP}/edits/e1/listings/en-US`)
    assert.deepEqual(JSON.parse(puts[0].body), { language: 'en-US', title: repo.title, shortDescription: repo.shortDescription, fullDescription: repo.fullDescription, video: live.video }, 'the listing written drops its video, or is not the repo’s')
    const at = (s) => calls.indexOf(s)
    assert.ok(at('PUT /edits/e1/listings/en-US') < at('POST /edits/e1:validate') && at('POST /edits/e1:validate') < at('POST /edits/e1:commit'), `not written, checked, then sent: ${calls.join(', ')}`)
    const commit = g.google().find((c) => c.path.endsWith(':commit'))
    assert.equal(commit.query.changesInReviewBehavior, 'ERROR_IF_IN_REVIEW', 'a commit could cancel a review in progress (Google’s default does)')
    assert.ok(!('changesNotSentForReview' in commit.query), 'the hold setting is sent without the hold box (as false, Google can answer it "must not be set")')
    assert.ok(!calls.includes('DELETE /edits/e1'), 'the draft that was sent is deleted afterwards')
    assert.ok(calls.includes('GET /edits/e2/listings/en-US') && calls.at(-1) === 'DELETE /edits/e2', 'it is not read back in a draft of its own, thrown away after')
    assert.ok(!calls.some((c) => c.includes('de-DE') && !c.startsWith('GET')), 'a language the repo does not have was written')
    assert.equal(g.live.get('en-US').fullDescription, repo.fullDescription)
    assert.equal(g.live.get('de-DE').title, german.title)
    assert.match(log.text(), /en-US, the full description: written\.\n {2}— sent to Google's review\.[\s\S]*— and it reads back right\./)

    /* The hold box: left in Play Console, to send by hand. */
    g = pretendGoogle({ listings })
    log = lines()
    await job({ mode: 'listing', apply: true, hold: true, rawKey: keyFile(), fetch: g.fetch, log, repoDir: dir })
    assert.equal(g.google().find((c) => c.path.endsWith(':commit')).query.changesNotSentForReview, 'true')
    assert.equal(g.google().find((c) => c.path.endsWith(':commit')).query.changesInReviewBehavior, 'ERROR_IF_IN_REVIEW')
    assert.ok(!g.google().some((c) => c.path.endsWith(':validate')), 'the hold box is checked by :validate, which takes no hold setting and refuses the very app the box is for')
    assert.match(log.text(), /left in Play Console under Changes not yet sent for review/)
    /* Hold alone writes nothing. */
    g = pretendGoogle({ listings })
    await job({ mode: 'listing', hold: true, rawKey: keyFile(), fetch: g.fetch, log: lines(), repoDir: dir })
    assert.ok(!g.calls.some(isWrite), 'the hold box wrote without Write it')

    /* Ticked, with nothing different: nothing sent, the draft thrown away. */
    g = pretendGoogle({ listings: [{ ...repo, video: '' }] })
    log = lines()
    assert.deepEqual(await job({ mode: 'listing', apply: true, rawKey: keyFile(), fetch: g.fetch, log, repoDir: dir }), { wrote: [] })
    assert.ok(!g.calls.some(isWrite), 'a listing that already says this was written again')
    assert.equal(g.google().at(-1).method, 'DELETE')
    assert.match(log.text(), /Nothing differs, so nothing was written\./)

    /* A language the repo has and Play does not is never added. */
    g = pretendGoogle({ listings: [{ ...repo }] })
    log = lines()
    await job({ mode: 'listing', apply: true, rawKey: keyFile(), fetch: g.fetch, log, repoDir: repoFolder([repo, await cleanListing('fr-FR')]) })
    assert.ok(!g.calls.some(isWrite), 'a language Play does not have was added')
    assert.match(log.text(), /::warning::Play has no fr-FR listing, and this job never adds a language/)

    /* And a mode it does not know is refused, naming the three. */
    await assert.rejects(job({ mode: 'everything', rawKey: keyFile(), fetch: g.fetch }), /there is no mode "everything": it is listing, images or vitals/)
  })

  test('while Google reviews something else, nothing is sent and nothing is cancelled', async () => {
    /*
     * Android 1.89.36 went straight to Google's review on 4 November 2026.
     * Google's default for a commit while something is in review is to
     * cancel that review and send everything again; this job asks Google
     * to say no instead, and says so in words.
     */
    const { run: job, explain, PlayError } = await import(SCRIPT)
    const { repo, live } = await aDifference()
    const dir = repoFolder([repo])
    let g = pretendGoogle({
      listings: [live],
      commit: () => [400, { error: { code: 400, message: 'The app has changes in review, and changesInReviewBehavior is ERROR_IF_IN_REVIEW.', status: 'FAILED_PRECONDITION' } }]
    })
    await assert.rejects(
      job({ mode: 'listing', apply: true, rawKey: keyFile(), fetch: g.fetch, log: lines(), repoDir: dir }),
      /Google is reviewing something else for this app right now, probably the new Android build\. Nothing was sent, and that review goes on as it was\./
    )
    const calls = g.google().map((c) => `${c.method} ${c.path.slice(APP.length)}`)
    assert.equal(calls.at(-1), 'DELETE /edits/e1', 'the draft Google would not take is left open')
    assert.equal(calls.filter((c) => c === 'POST /edits').length, 1, 'it went on to read back a change that was never sent')
    assert.ok(!calls.includes('PUT /edits/e2/listings/en-US'), 'it tried again in another draft')
    assert.equal(g.live.get('en-US').fullDescription, live.fullDescription)

    /*
     * The hold box, both ways. Google has two opposite answers (fastlane's
     * supply client catches both): "set ... changesNotSentForReview to true",
     * which can come from :validate too, and "... must not be set". Each is
     * told the box to run it with, and the advice never repeats what was
     * just done.
     */
    const TO_TRUE = { error: { code: 400, message: 'Changes cannot be sent for review automatically. Please set the query parameter changesNotSentForReview to true.' } }
    const NOT_SET = { error: { code: 400, message: 'The query parameter changesNotSentForReview must not be set.' } }
    const TICK_HOLD = /Run it again with "Write it" and the hold box both ticked/
    const WRITE_ALONE = /Run it again with "Write it" alone/
    for (const [where, opts, hold, says] of [
      ['commit', { commit: () => [400, TO_TRUE] }, false, TICK_HOLD],
      ['validate', { validate: () => [400, TO_TRUE] }, false, TICK_HOLD],
      ['commit', { commit: () => [400, NOT_SET] }, true, WRITE_ALONE]
    ]) {
      g = pretendGoogle({ listings: [live], ...opts })
      let said = ''
      await job({ mode: 'listing', apply: true, hold, rawKey: keyFile(), fetch: g.fetch, log: lines(), repoDir: dir }).catch((e) => (said = e.message))
      assert.match(said, says, `${where}, hold ${hold}: ${said}`)
      assert.ok(!/reviewing something else/.test(said), `${where}: a hold answer is taken for a review in progress`)
      assert.equal(g.google().at(-1).method, 'DELETE', `${where}: the draft Google would not take is left open`)
      assert.equal(g.live.get('en-US').fullDescription, live.fullDescription)
    }
    const holdAnswer = (path, text, ticked) => explain(new PlayError({ api: 'the Google Play Android Developer API', method: 'POST', path, status: 400, text }), { hold: ticked })
    assert.match(holdAnswer('/edits/e1:validate', JSON.stringify(TO_TRUE), false), TICK_HOLD)
    assert.match(holdAnswer('/edits/e1:commit?changesInReviewBehavior=ERROR_IF_IN_REVIEW', JSON.stringify(TO_TRUE), false), TICK_HOLD)
    assert.ok(!TICK_HOLD.test(holdAnswer('/edits/e1:commit?changesNotSentForReview=true', JSON.stringify(TO_TRUE), true)), 'a run with the hold box ticked is told to tick it')
    assert.match(holdAnswer('/edits/e1:commit?changesNotSentForReview=true', JSON.stringify(NOT_SET), true), WRITE_ALONE)
    assert.match(holdAnswer('/edits/e1:validate', JSON.stringify(NOT_SET), false), WRITE_ALONE)

    /* The other answers, in words that say what to do. */
    const err = (status, text, api = 'the Google Play Developer Reporting API') => new PlayError({ api, method: 'GET', path: '/crashRateMetricSet', status, text })
    assert.match(explain(err(403, '{"error":{"status":"PERMISSION_DENIED","details":[{"reason":"SERVICE_DISABLED"}]}}')), /^The Google Play Developer Reporting API is switched off in the fractal-remote Google Cloud project: Google Cloud → fractal-remote → APIs & Services → Library/)
    assert.equal(explain(err(500, 'boom')), 'GET /crashRateMetricSet answered 500: boom')

    /*
     * A refusal names the permission the call needed, since Google's own
     * words ("The caller does not have permission") never do, and says a
     * permission just given can take a day to reach Google's interface.
     */
    const PUB = 'the Google Play Android Developer API'
    const DENIED = '{"error":{"code":403,"message":"The caller does not have permission","status":"PERMISSION_DENIED"}}'
    for (const [api, method, path, status, needs] of [
      ['the Google Play Developer Reporting API', 'GET', '/crashRateMetricSet', 403, 'View app quality information (read-only)'],
      ['the Google Play Developer Reporting API', 'GET', '/errorIssues:search?pageSize=10', 403, 'View app quality information (read-only)'],
      [PUB, 'PUT', '/edits/e1/listings/en-US', 403, 'Manage store presence'],
      [PUB, 'POST', '/edits/e1:validate', 403, 'Manage store presence'],
      [PUB, 'POST', '/edits/e1:commit?changesInReviewBehavior=ERROR_IF_IN_REVIEW', 403, 'Manage store presence'],
      [PUB, 'GET', '/edits/e1/details', 403, 'View app information (read-only)'],
      [PUB, 'GET', '/edits/e1/listings', 401, 'View app information (read-only)'],
      [PUB, 'GET', '/edits/e1/listings/en-US/phoneScreenshots', 403, 'View app information (read-only)'],
      [PUB, 'POST', '/edits', 403, 'View app information (read-only)'],
      [PUB, 'DELETE', '/edits/e1', 403, 'View app information (read-only)']
    ]) {
      const said = explain(new PlayError({ api, method, path, status, text: DENIED }))
      assert.ok(
        said.startsWith(`The robot needs "${needs}" on Fractal Remote for this (${method} ${path}): Play Console → Users and permissions → fractal-remote-listing → App permissions. A permission given in the last day may not have reached Google's interface yet.`),
        `${method} ${path}: ${said}`
      )
    }
  })

  test('a send whose answer is lost says it may have gone, never that nothing was sent', async () => {
    /*
     * Google can take a commit and the answer never arrive (the connection
     * drops, a 5xx, a timeout). The draft is gone then, so throwing it away
     * answers 404, and "nothing in it was sent" would be the one thing the
     * log must not say.
     */
    const { run: job } = await import(SCRIPT)
    const { repo, live } = await aDifference()
    const dir = repoFolder([repo])
    let g
    const takenThenLost = (call) => {
      const id = call.path.match(/\/edits\/(e\d+):commit$/)[1]
      for (const [k, v] of g.drafts.get(id)) g.live.set(k, v)
      g.drafts.delete(id)
      throw new TypeError('fetch failed')
    }
    g = pretendGoogle({ listings: [live], commit: takenThenLost })
    const log = lines()
    await assert.rejects(job({ mode: 'listing', apply: true, rawKey: keyFile(), fetch: g.fetch, log, repoDir: dir }), /fetch failed/)
    assert.equal(g.live.get('en-US').fullDescription, repo.fullDescription, 'the pretend Google did not take the send')
    assert.match(log.text(), /::warning::The send may have reached Google before its answer was lost[^\n]*Check Play Console → Publishing overview before running this again\./)
    assert.ok(!/Nothing in it was sent/.test(log.text()), 'a send that may have gone is called nothing sent')

    /* A 5xx with the draft still there: it was not taken, it is thrown away, and nothing is said about it. */
    g = pretendGoogle({ listings: [live], commit: () => [503, 'unavailable'] })
    const quiet = lines()
    await assert.rejects(job({ mode: 'listing', apply: true, rawKey: keyFile(), fetch: g.fetch, log: quiet, repoDir: dir }), /answered 503/)
    assert.equal(g.google().at(-1).method, 'DELETE')
    assert.equal(g.drafts.size, 0)
    assert.ok(!/::warning::/.test(quiet.text()))

    /* And a read-back that differs shows Play with - and the repo with +, as the first look does. */
    g = pretendGoogle({
      listings: [live],
      commit: (call) => {
        const id = call.path.match(/\/edits\/(e\d+):commit$/)[1]
        for (const [k, v] of g.drafts.get(id)) g.live.set(k, { ...v, fullDescription: `${v.fullDescription}\nGoogle added this.` })
        g.drafts.delete(id)
        return [200, { id }]
      }
    })
    let said = ''
    await job({ mode: 'listing', apply: true, rawKey: keyFile(), fetch: g.fetch, log: lines(), repoDir: dir }).catch((e) => (said = e.message))
    assert.match(said, /en-US: sent, and the full description reads back as something else\. Play says the lines with -, and the repo says the lines with \+:\n/)
    assert.match(said, /^ {2}- Google added this\.$/m, 'what Play reads back is not on the - side')
  })

  test('pictures and crash reports are only read', async () => {
    const { run: job, IMAGE_TYPES, daysBefore, hourFloorUTC, flatInterval } = await import(SCRIPT)
    const { live, german } = await aDifference()

    /* The pictures: a draft opened, every kind asked for in every language, the draft thrown away. */
    let g = pretendGoogle({
      listings: [german, live],
      images: { 'en-US/phoneScreenshots': { images: [{ id: '1', url: 'https://play-lh.googleusercontent.com/one', sha256: 'abcdef0123456789' }, { id: '2', url: 'https://play-lh.googleusercontent.com/two' }] } }
    })
    let log = lines()
    await job({ mode: 'images', apply: true, rawKey: keyFile(), fetch: g.fetch, log, repoDir: '/nowhere' })
    const asked = g.google()
    assert.deepEqual([asked[0].method, asked[0].path], ['POST', `${APP}/edits`])
    assert.deepEqual([asked.at(-1).method, asked.at(-1).path], ['DELETE', `${APP}/edits/e1`])
    assert.ok(asked.slice(1, -1).every((c) => c.method === 'GET'), 'the pictures were not only read')
    for (const lang of ['en-US', 'de-DE']) {
      for (const [type] of IMAGE_TYPES) assert.ok(asked.some((c) => c.path === `${APP}/edits/e1/listings/${lang}/${type}`), `${lang} ${type} was not asked for`)
    }
    assert.deepEqual(IMAGE_TYPES.map(([t]) => t), ['phoneScreenshots', 'sevenInchScreenshots', 'tenInchScreenshots', 'tvScreenshots', 'wearScreenshots', 'icon', 'featureGraphic', 'tvBanner'])
    const said = log.text()
    assert.match(said, /"Write it" does nothing in images: it only reads\. Nothing was written\./)
    assert.ok(said.indexOf('en-US') < said.indexOf('de-DE'), 'the default language is not first')
    assert.match(said, /Phone screenshots: 2\n {4}1\. https:\/\/play-lh\.googleusercontent\.com\/one {2}sha256 abcdef012345…\n {4}2\. https:\/\/play-lh\.googleusercontent\.com\/two/)
    assert.match(said, /Feature graphic: none/)
    assert.match(said, /Chromebook screenshots are not in Google's interface for this/)

    /* The crash reports: the reporting interface only, its scope only, and no POST but the two queries. */
    const LA = { id: 'America/Los_Angeles' }
    /* Google refuses a daily point that carries an hour, so one in its own daily end (even 0) is not passed on. */
    const fresh = () => [200, { freshnessInfo: { freshnesses: [{ aggregationPeriod: 'DAILY', latestEndTime: { year: 2026, month: 11, day: 3, hours: 0, minutes: 0, timeZone: LA } },{ aggregationPeriod: 'HOURLY', latestEndTime: { year: 2026, month: 11, day: 3, hours: 7, timeZone: { id: 'UTC' } } }] } }]
    const row = (day, perceived, all, daily) => ({
      aggregationPeriod: 'DAILY',
      startTime: { year: 2026, month: 11, day, timeZone: LA },
      metrics: [
        { metric: perceived[0], decimalValue: { value: perceived[1] } },
        { metric: all[0], decimalValue: { value: all[1] } },
        { metric: daily[0], decimalValue: { value: daily[1] } }
      ]
    })
    g = pretendGoogle({
      reports: {
        'GET /crashRateMetricSet': fresh,
        'GET /anrRateMetricSet': fresh,
        'GET /errorCountMetricSet': fresh,
        'POST /crashRateMetricSet:query': () => [200, { rows: [row(2, ['userPerceivedCrashRate28dUserWeighted', '0.0012'], ['crashRate28dUserWeighted', '0.0015'], ['userPerceivedCrashRate', '0.0050']), row(1, ['userPerceivedCrashRate28dUserWeighted', '0.0011'], ['crashRate28dUserWeighted', '0.0014'], ['userPerceivedCrashRate', '0.0010'])] }],
        'POST /anrRateMetricSet:query': () => [200, {}],
        'GET /errorIssues:search': () => [200, { errorIssues: [{ type: 'CRASH', cause: 'java.lang.IllegalStateException', location: 'com.newbold.Ble.connect', errorReportCount: '12', distinctUsers: '3', firstAppVersion: { versionCode: '13' }, lastAppVersion: { versionCode: '14' }, lastErrorReportTime: '2026-11-02T10:00:00Z', issueUri: 'https://play.google.com/console/issue/1', annotations: [{ title: 'Likely a race at startup' }] }] }]
      }
    })
    log = lines()
    await job({ mode: 'vitals', rawKey: keyFile(), fetch: g.fetch, log, now: Date.UTC(2026, 10, 4, 12) })
    assert.ok(g.google().length > 0 && g.google().every((c) => c.host === 'playdeveloperreporting.googleapis.com'), 'vitals asked something of more than the reporting interface')
    assert.equal(claimsOf(new URLSearchParams(g.calls[0].body).get('assertion')).scope, 'https://www.googleapis.com/auth/playdeveloperreporting', 'vitals asked for more than the reporting scope')
    assert.deepEqual(g.google().filter((c) => c.method !== 'GET').map((c) => `${c.method} ${c.path.slice(REPORTS.length)}`), ['POST /crashRateMetricSet:query', 'POST /anrRateMetricSet:query'])
    assert.ok(!g.google().some((c) => /errorReports/.test(c.path)), 'single crash reports, which can carry what a player typed, were asked for')
    const crash = JSON.parse(g.google().find((c) => c.path.endsWith('crashRateMetricSet:query')).body)
    assert.deepEqual(crash.timelineSpec, { aggregationPeriod: 'DAILY', startTime: { year: 2026, month: 10, day: 6, timeZone: LA }, endTime: { year: 2026, month: 11, day: 3, timeZone: LA } }, 'the window is not the 28 days Google has, in its own days')
    assert.ok(crash.metrics.includes('userPerceivedCrashRate28dUserWeighted'), 'the rate Google judges by is not asked for')
    const issues = g.google().find((c) => c.path.endsWith('errorIssues:search')).query
    assert.deepEqual(issues, {
      'interval.startTime.year': '2026', 'interval.startTime.month': '10', 'interval.startTime.day': '6', 'interval.startTime.hours': '7', 'interval.startTime.timeZone.id': 'UTC',
      'interval.endTime.year': '2026', 'interval.endTime.month': '11', 'interval.endTime.day': '3', 'interval.endTime.hours': '7', 'interval.endTime.timeZone.id': 'UTC',
      orderBy: 'errorReportCount desc', pageSize: '10', sampleErrorReportLimit: '0'
    })
    const vitals = log.text()
    assert.match(vitals, /^Crashes, the 28 days to 2 November 2026 \(Google's days, Los Angeles time\): 0\.12% of people while they were using the app \(Google's figure 0\.0012; its line is 1\.09%\), 0\.15% counting crashes nobody saw, in the background\.$/m)
    assert.match(vitals, /The worst day: 2 November 2026, 0\.50%\./)
    assert.match(vitals, /^Freezes \(ANR: the app stopped answering\): Google has too few people's data to give a rate yet\.$/m)
    assert.match(vitals, /1\. Crash: java\.lang\.IllegalStateException in com\.newbold\.Ble\.connect — version codes 13 to 14, last on 2026-11-02\n {5}https:\/\/play\.google\.com\/console\/issue\/1\n {5}Google says: Likely a race at startup/)
    /* The log is public: no count of reports or people, which would say how many use the app. */
    assert.ok(!/\b\d+ (reports?|people|users?)\b/.test(vitals), 'vitals prints how many people or reports a problem had')
    assert.ok(!/\b(12|3)\b/.test(vitals.slice(vitals.indexOf('The problems'))), 'a problem’s report or people count is printed')

    /* Figures over 1 cannot be fractions, so the set is read as percentages already, and the line is judged on that. */
    g = pretendGoogle({
      reports: {
        'GET /crashRateMetricSet': fresh,
        'GET /anrRateMetricSet': fresh,
        'GET /errorCountMetricSet': fresh,
        'POST /crashRateMetricSet:query': () => [200, { rows: [row(2, ['userPerceivedCrashRate28dUserWeighted', '1.5'], ['crashRate28dUserWeighted', '0.4'], ['userPerceivedCrashRate', '0.3'])] }],
        'POST /anrRateMetricSet:query': () => [200, {}],
        'GET /errorIssues:search': () => [200, {}]
      }
    })
    log = lines()
    await job({ mode: 'vitals', rawKey: keyFile(), fetch: g.fetch, log, now: Date.UTC(2026, 10, 4, 12) })
    assert.match(log.text(), /: 1\.50% of people while they were using the app \(Google's figure 1\.5; its line is 1\.09%, OVER Google's line[^)]*\), 0\.40% counting crashes/)
    assert.match(log.text(), /The worst day: 2 November 2026, 0\.30%\./)

    /* The dates, alone. */
    assert.deepEqual(daysBefore({ year: 2026, month: 3, day: 1 }, 28), { year: 2026, month: 2, day: 1 })
    assert.deepEqual(daysBefore({ year: 2026, month: 1, day: 3, timeZone: LA }, 28), { year: 2025, month: 12, day: 6, timeZone: LA })
    assert.equal(hourFloorUTC(Date.UTC(2026, 10, 4, 12, 59, 59)).toISOString(), '2026-11-04T12:00:00.000Z')
    assert.equal(flatInterval(new Date(Date.UTC(2026, 0, 2, 3)), new Date(Date.UTC(2026, 0, 3, 4)))['interval.endTime.hours'], 4)
  })

  test('the job runs by hand, on main, with its key in one step’s environment, and installs nothing', () => {
    const yml = read('.github/workflows/play-text.yml')
    const on = yml.slice(yml.indexOf('\non:\n'), yml.indexOf('\npermissions:'))
    assert.ok(on.includes('  workflow_dispatch:'), 'the job is not started by hand')
    assert.ok(!/pull_request|push:|schedule:|workflow_run|repository_dispatch/.test(on), 'something other than a person starts the job')
    assert.match(yml, /\njobs:\n {2}play:\n {4}if: github\.ref == 'refs\/heads\/main'\n/, 'the job runs from a branch other than main')
    assert.match(yml, /\npermissions:\n {2}contents: read\n\n/, 'the job can write to the repository')
    assert.equal((yml.match(/permissions:/g) || []).length, 1, 'a step or job widens the permissions')
    assert.match(yml, /persist-credentials: false/)
    assert.equal((yml.match(/secrets\./g) || []).length, 1, 'the job is handed more than the Google key')
    assert.match(yml, /\n {8}env:\n {10}GOOGLE_PLAY_KEY: \$\{\{ secrets\.GOOGLE_PLAY_KEY \}\}\n/, 'the key is not in the step’s environment')
    assert.ok(!/\$\{?GOOGLE_PLAY_KEY/.test(yml), 'the shell touches the key (printed, or written to a file)')
    assert.ok(!/\b(echo|printf|cat|tee)\b/.test(yml.slice(yml.indexOf('steps:'))), 'a step prints something')
    assert.match(yml, /run: node scripts\/play-text\.mjs --mode "\$MODE" \$\{\{ inputs\.apply && '--apply' \|\| '' \}\} \$\{\{ inputs\.hold && '--hold' \|\| '' \}\}\n/)
    assert.match(yml, / {6}mode:\n {8}description: [^\n]+\n {8}type: choice\n {8}options:\n {10}- listing\n {10}- images\n {10}- vitals\n {8}default: listing\n/, 'the three modes are not offered, with listing first')
    const apply = (f) => read(f).match(/ {6}apply:\n {8}description: ([^\n]+)\n {8}type: boolean\n {8}default: false\n/)?.[1]
    assert.equal(apply('.github/workflows/play-text.yml'), apply('.github/workflows/store-text.yml'), 'Write it is not worded the way store-text words it')
    assert.match(yml, / {6}hold:\n {8}description: [^\n]+\n {8}type: boolean\n {8}default: false\n/)
    assert.match(yml, /node-version: 24/)
    assert.ok(!/npm (ci|install)/.test(yml), 'the job installs packages')
    /* Node's own modules and the project's shared files, and nothing from npm. */
    const src = read('scripts/play-text.mjs')
    const from = [...src.matchAll(/^import\s+(?:[^'"]*?\sfrom\s+)?['"]([^'"]+)['"]/gm)].map((m) => m[1])
    assert.ok(from.length >= 4, 'the script’s imports could not be read')
    assert.deepEqual(from.filter((f) => !f.startsWith('node:') && !f.startsWith('../shared/')), [], 'the script needs a package from npm')
    assert.ok(!/\bimport\s*\(|\brequire\s*\(/.test(src), 'the script loads something at run time that this cannot see')
    assert.ok(src.includes('process.env.GOOGLE_PLAY_KEY'), 'the script reads its key from somewhere else than the environment')
  })

  test('the repo’s copy of Play’s words is the one docs/app-store.md keeps, and the package is the app’s', async () => {
    const { readRepo, problems, PACKAGE, APP_NAME, REPO_DIR, UNCHECKED } = await import(SCRIPT)
    const { fenced } = await import('../scripts/store-text.mjs')
    const { GOOGLE } = await import('../shared/stores.mjs')
    const app = JSON.parse(read('mobile/app.json')).expo
    assert.equal(PACKAGE, app.android.package)
    assert.equal(GOOGLE.id, app.android.package, 'the Play address and the app’s package name are two different apps')
    assert.equal(APP_NAME, 'Fractal Remote')

    const store = read('docs/app-store.md')
    const repo = readRepo()
    assert.ok(repo['en-US'], 'store/google-play/ has no en-US, the listing’s default language')
    assert.equal(repo['en-US'].title, store.match(/\| \*\*Name\*\* \| 30 \| `([^`]+)` \|/)?.[1], 'the repo’s Play title is not the Name in docs/app-store.md')
    assert.equal(repo['en-US'].shortDescription, fenced(store, '### Google Play: short description').trim(), 'the repo’s short description is not docs/app-store.md’s')
    for (const [lang, l] of Object.entries(repo)) {
      if (l.unchecked) continue
      assert.deepEqual(problems(l), [], `store/google-play/${lang} would be refused`)
    }

    /* While en-US is the seed, it is the 1.89.0 Description word for word, and the docs say what it is and what clears it. */
    const section = store.slice(store.indexOf('### Google Play from GitHub (play-text)'), store.indexOf('### URLs'))
    assert.ok(section.length > 1500, 'docs/app-store.md has no play-text section before the URLs')
    assert.ok(store.indexOf('### Google Play from GitHub (play-text)') > store.indexOf('### Google Play: short description'), 'the play-text section sits above the short description, where fenced() would read it first')
    assert.ok(!section.includes('```'), 'the play-text section has a block to paste')
    const flat = section.replace(/\s+/g, ' ')
    assert.ok(flat.includes('**Nothing goes live without Write it.**'), 'the section does not say nothing goes live without Write it')
    for (const mode of ['**listing**', '**images**', '**vitals**']) assert.ok(flat.includes(mode), `the section does not say what ${mode} does`)
    assert.ok(flat.includes('Write it is ticked only when Justin has asked for that change on Google Play.'))
    if (existsSync(join(REPO_DIR, 'en-US', UNCHECKED))) {
      assert.equal(repo['en-US'].fullDescription, fenced(store, '### Description, from 1.89.0 (App Store and Google Play)').trim(), 'the seed is not the 1.89.0 Description it says it is')
      assert.ok(flat.includes('**store/google-play/en-US was filled from this file, not read from Play**'), 'the docs do not say the seed is not Play’s own text')
      assert.ok(flat.includes('UNCHECKED.txt'), 'the docs do not say what keeps Write it refused on the seed')
    }
  })
}

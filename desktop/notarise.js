/**
 * Apple's approval and Apple's stamp, kept apart.
 *
 * NOTARISATION is Apple checking the signed app and saying yes. It has to
 * happen on every release, and a no from Apple stops the release: an app
 * Apple has not approved is one a stranger's Mac refuses to open. That part
 * is exactly as strict as it was.
 *
 * STAPLING is fetching the yes back from Apple's ticket service and pinning
 * it to the app, so a Mac with no internet can see it too. From 1.87.14 on,
 * that fetch failed from GitHub's Mac machines on run after run — "The network
 * connection was lost" from api.apple-cloudkit.com, every time AFTER Apple had
 * already said Accepted. Five tries over two and a half minutes (1.87.20)
 * failed all five on 1.87.22's run, so it is not a blip. And on 1.87.21 it
 * failed INSIDE electron-builder's own notarise-and-staple, which took the
 * whole package step down before anything was published: no Mac files went
 * up, and for about three hours every computer's "Check for updates" said the
 * new version was "still being built".
 *
 * So the stamp is asked for, patiently, and its absence is a warning rather
 * than a failure. That is safe because of what a missing stamp changes, and
 * Justin's condition was that how the app opens must not change: "Right now
 * users just have to click the button about being from an unknown developer
 * and that's all to install. Just wanna make sure that's not gonna change."
 * It does not. The app is still signed with the Developer ID and still
 * approved by Apple on every release. Without the stamp, macOS asks Apple's
 * ticket service itself the first time the app is opened — the same lookup,
 * from the person's Mac instead of GitHub's — and shows the same one prompt.
 * The only Mac that would see anything different is one opening a fresh
 * download with no internet at all, and only on a release whose stamp
 * could not be fetched. Updates are not affected either way: a computer
 * that updates itself checks the new version's signature, not its stamp.
 *
 * Two ways in, one set of rules:
 *
 *   - electron-builder's afterSign hook (`afterSign: notarise.js` in
 *     electron-builder.yml, with its own notarising switched off), for each
 *     .app — after it is signed and BEFORE the zip and the disk image are
 *     made from it, so both carry the stamp whenever Apple answers.
 *   - `node notarise.js <file.dmg>…`, from the workflow, for the disk images.
 *
 * And one way to check: `node notarise.js --confirm <file>`, from the proof
 * step, for a file that came out with no stamp — Apple's notary asked
 * whether it accepted what this run sent (see confirm).
 *
 * Notarising is what @electron/notarize 2.5 (which electron-builder 25 uses)
 * does: zip the .app with ditto, `notarytool submit --wait --output-format
 * json`, and believe only a status of Accepted with a clean exit. Only the
 * staple at the end is different.
 */
const { spawn } = require('node:child_process')
const { mkdtempSync, rmSync, appendFileSync, readFileSync, realpathSync } = require('node:fs')
const { tmpdir } = require('node:os')
const { join, basename, dirname, extname, parse, resolve } = require('node:path')

/** Seconds to wait before each try at the stamp: five tries, about two and a half minutes. */
const STAPLE_WAITS_S = [0, 10, 20, 40, 80]
/** And before each question to Apple's notary about a submission it already answered (see confirm). */
const CONFIRM_WAITS_S = [0, 10, 30]

/**
 * Where each approval is written down for the rest of the run: one line per
 * file Apple accepted, "<submission id><tab><the file>", in the runner's own
 * temporary folder. The proof step reads it back (see confirm). Null off a
 * runner, where nothing reads it.
 */
function recordFile(env = process.env) {
  if (env.NOTARISED_RECORD) return env.NOTARISED_RECORD
  return env.RUNNER_TEMP ? join(env.RUNNER_TEMP, 'notarised.tsv') : null
}

/** A file's one true spelling, so the line written here and the path asked about later match. */
function wherever(file) {
  try {
    return realpathSync(file)
  } catch {
    return resolve(file)
  }
}

/**
 * The Apple ID to notarise with, from the environment the workflow sets.
 * None at all is null; some but not all is a mistake worth stopping on.
 */
function credentials(env = process.env) {
  const appleId = env.APPLE_ID || ''
  const password = env.APPLE_APP_SPECIFIC_PASSWORD || ''
  const teamId = env.APPLE_TEAM_ID || ''
  if (!appleId && !password && !teamId) return null
  const missing = [
    ['APPLE_ID', appleId],
    ['APPLE_APP_SPECIFIC_PASSWORD', password],
    ['APPLE_TEAM_ID', teamId]
  ]
    .filter(([, value]) => !value)
    .map(([name]) => name)
  if (missing.length) throw new Error(`Notarising needs ${missing.join(' and ')} as well`)
  return { appleId, password, teamId }
}

/** notarytool's sign-in, as arguments. Never printed. */
const signIn = (who) => ['--apple-id', who.appleId, '--password', who.password, '--team-id', who.teamId]

/**
 * What notarytool answered, from its JSON: { status, id, message }, or null
 * when it printed nothing that reads as an answer.
 */
function readAnswer(text) {
  const tryParse = (s) => {
    try {
      const v = JSON.parse(s)
      return v && typeof v === 'object' ? v : null
    } catch {
      return null
    }
  }
  const whole = tryParse(String(text || '').trim())
  const found =
    whole ||
    String(text || '')
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.startsWith('{'))
      .map(tryParse)
      .filter(Boolean)
      .pop() ||
    null
  if (!found) return null
  return {
    status: typeof found.status === 'string' ? found.status : null,
    id: typeof found.id === 'string' ? found.id : null,
    message: typeof found.message === 'string' ? found.message : null
  }
}

/**
 * Run a command and say how it went, without ever rejecting on a non-zero
 * exit: { code, stdout }. What it prints on stderr goes straight to the log.
 */
function run(cmd, args, { cwd } = {}) {
  return new Promise((resolve) => {
    let stdout = ''
    let child
    try {
      child = spawn(cmd, args, { cwd, stdio: ['ignore', 'pipe', 'inherit'] })
    } catch (err) {
      resolve({ code: -1, stdout: '', error: err })
      return
    }
    child.stdout.on('data', (chunk) => {
      stdout += chunk
    })
    child.on('error', (err) => resolve({ code: -1, stdout, error: err }))
    child.on('close', (code) => resolve({ code: code ?? -1, stdout }))
  })
}

const defaults = {
  run,
  log: (line) => console.log(line),
  sleep: (ms) => new Promise((done) => setTimeout(done, ms)),
  env: process.env,
  tmp: () => mkdtempSync(join(tmpdir(), 'notarise-')),
  remove: (dir) => rmSync(dir, { recursive: true, force: true }),
  // The record of approvals: see recordFile.
  append: (path, text) => appendFileSync(path, text),
  readText: (path) => readFileSync(path, 'utf8'),
  real: wherever
}

/**
 * Ask for the stamp, patiently. True once it is on the file; false, with a
 * warning on the run, when Apple's ticket service could not be reached.
 * Never throws: whatever happens here, the release goes out.
 */
async function staple(file, { run: exec = run, log = defaults.log, sleep = defaults.sleep, waits = STAPLE_WAITS_S } = {}) {
  const name = basename(file)
  for (const wait of waits) {
    if (wait) await sleep(wait * 1000)
    const result = await exec('xcrun', ['stapler', 'staple', name], { cwd: dirname(file) })
    if (result.code === 0) {
      log(`stamped ${name}`)
      return true
    }
    log(`the stamp for ${name} did not come back from Apple; asking again`)
  }
  log(
    `::warning::${name} is notarised but carries no stamp: Apple's ticket service could not be reached after ${waits.length} tries. ` +
      'The release goes out regardless. A Mac opening it looks the approval up with Apple instead, and shows the same prompt.'
  )
  return false
}

/**
 * Notarise one file — a .app or a .dmg — and then try to stamp it.
 *
 * Rejects when Apple does not say Accepted: refused, or no answer at all.
 * That stops the release, as it always has. Resolves { id, stapled } once
 * Apple has said yes, whether or not the stamp could be fetched.
 */
async function notarise(file, options = {}) {
  const { run: exec, log, sleep, env, tmp, remove, append, real } = { ...defaults, ...options }
  const who = credentials(env)
  if (!who) throw new Error(`Nothing to notarise ${basename(file)} with: APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD and APPLE_TEAM_ID are not set`)
  const name = basename(file)

  // notarytool takes a zip, a disk image or an installer package, not a .app folder.
  let upload = file
  let dir = null
  if (extname(file) === '.app') {
    dir = tmp()
    upload = join(dir, `${parse(file).name}.zip`)
    const zipped = await exec('ditto', ['-c', '-k', '--sequesterRsrc', '--keepParent', name, upload], { cwd: dirname(file) })
    if (zipped.code !== 0) {
      remove(dir)
      throw new Error(`Could not zip ${name} to send to Apple (ditto exited ${zipped.code})`)
    }
  }

  let answer = null
  try {
    log(`sending ${name} to Apple to be notarised, and waiting for the answer`)
    const submitted = await exec('xcrun', ['notarytool', 'submit', upload, ...signIn(who), '--wait', '--output-format', 'json'])
    answer = readAnswer(submitted.stdout)
    if (submitted.code !== 0 || answer?.status !== 'Accepted') {
      // What Apple found, for whoever reads the run: the log names every file it refused and why.
      let detail = ''
      if (answer?.id) {
        const report = await exec('xcrun', ['notarytool', 'log', answer.id, ...signIn(who)])
        detail = report.stdout ? `\n\nApple's notes on submission ${answer.id}:\n${report.stdout}` : ''
      }
      throw new Error(
        `Apple did not accept ${name} (${answer?.status || 'no answer'}${answer?.message ? `: ${answer.message}` : ''}; notarytool exited ${submitted.code}).${detail}`
      )
    }
  } finally {
    if (dir) remove(dir)
  }
  log(`Apple accepted ${name} (submission ${answer.id})`)
  remember(file, answer.id, { env, log, append, real })
  return { id: answer.id, stapled: await staple(file, { run: exec, log, sleep }) }
}

/*
 * Write the approval down for the proof step. Never throws: the approval
 * happened either way, and a record that could not be written only means the
 * proof step has to find its answer from Gatekeeper alone.
 */
function remember(file, id, { env, log, append, real }) {
  const path = recordFile(env)
  if (!path || !id) return
  try {
    append(path, `${id}\t${real(file)}\n`)
  } catch (err) {
    log(`::warning::could not write down that Apple accepted ${basename(file)}: ${err?.message || err}`)
  }
}

/**
 * Prove, from Apple's notary, that a file this run sent was accepted.
 *
 * For the proof step, when a file carries no stamp. Gatekeeper (spctl) is the
 * usual proof that Apple approved an app, and with a stamp on the file it
 * answers on the Mac it runs on. Without one it asks Apple online — through
 * the same ticket service (api.apple-cloudkit.com) that would not hand the
 * stamp over in the first place — and when that drops the line it answers
 * "rejected, source=Unnotarized Developer ID", which looks exactly like a real
 * no. So the proof falls back to Apple's notary service, which answered every
 * submission on every one of those runs: `notarytool info` on the submission
 * written down when the file was accepted, believed only when it says
 * Accepted.
 *
 * Rejects when there is no record of the file being accepted on this run,
 * when Apple's record says anything but Accepted, or when the notary does not
 * answer after a few tries. Resolves { id } otherwise.
 */
async function confirm(file, options = {}) {
  const { run: exec, log, sleep, env, readText, real } = { ...defaults, ...options }
  const waits = options.waits || CONFIRM_WAITS_S
  const who = credentials(env)
  if (!who) throw new Error(`Nothing to ask Apple about ${basename(file)} with: APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD and APPLE_TEAM_ID are not set`)
  const name = basename(file)
  const path = recordFile(env)
  let text = ''
  try {
    text = path ? readText(path) : ''
  } catch {
    text = ''
  }
  const want = real(file)
  const id =
    String(text)
      .split('\n')
      .map((line) => line.split('\t'))
      .filter(([sub, where]) => sub && where === want)
      .map(([sub]) => sub)
      .pop() || null
  if (!id) throw new Error(`No record that Apple accepted ${name} on this run, so nothing proves it was notarised`)

  for (const wait of waits) {
    if (wait) await sleep(wait * 1000)
    const asked = await exec('xcrun', ['notarytool', 'info', id, ...signIn(who), '--output-format', 'json'])
    const answer = readAnswer(asked.stdout)
    if (asked.code === 0 && answer?.status === 'Accepted') {
      log(`Apple's notary confirms it accepted ${name} (submission ${id})`)
      return { id }
    }
    // Any other status is Apple's answer, and asking again gets the same one.
    if (answer?.status && answer.status !== 'Accepted') {
      throw new Error(`Apple's notary says submission ${id} for ${name} is ${answer.status}${answer.message ? `: ${answer.message}` : ''}, not Accepted`)
    }
    log(`Apple's notary did not answer about ${name}; asking again`)
  }
  throw new Error(`Apple's notary did not answer about ${name} (submission ${id}) after ${waits.length} tries`)
}

/**
 * electron-builder's afterSign hook: notarise the .app it has just signed,
 * before the zip and the disk image are made from it.
 *
 * Only a Mac build signed with a real certificate. Without one (a pull
 * request, a build with no secrets) afterPack.js has signed it ad hoc, Apple
 * notarises nothing signed ad hoc, and this has nothing to do. With one, an
 * Apple ID is required: a Developer ID app that is not notarised is one
 * macOS refuses to open, so a missing sign-in stops the build here, before
 * anything is published.
 */
async function afterSign(context, options = {}) {
  if (context?.electronPlatformName !== 'darwin') return null
  const env = options.env || process.env
  if (!env.CSC_LINK) return null
  const app = join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`)
  return notarise(app, { ...options, env })
}

module.exports = { default: afterSign, afterSign, notarise, staple, confirm, readAnswer, credentials, recordFile, STAPLE_WAITS_S, CONFIRM_WAITS_S }

/*
 * From the workflow:
 *
 *   node notarise.js release/<image>.dmg      notarise, then try for the stamp.
 *                                             Fails only when Apple says no.
 *   node notarise.js --confirm <file>         ask Apple's notary whether the
 *                                             file this run sent was accepted.
 *                                             Fails unless it was.
 */
if (require.main === module) {
  const args = process.argv.slice(2)
  const checking = args[0] === '--confirm'
  const files = checking ? args.slice(1) : args
  if (!files.length) {
    console.error('usage: node notarise.js [--confirm] <file.dmg|file.app>…')
    process.exit(2)
  }
  ;(async () => {
    for (const file of files) await (checking ? confirm(file) : notarise(file))
  })().catch((err) => {
    console.log(`::error::${String(err?.message || err).split('\n')[0]}`)
    console.error(err?.message || err)
    process.exit(1)
  })
}

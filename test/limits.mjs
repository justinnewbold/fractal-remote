/**
 * What the Mac app is made of, and what it is allowed to claim.
 *
 * Packaging is the part of this project with no way to check itself at
 * runtime. A missing entitlement, a certificate that is present but empty, a
 * file the bundle references and does not ship, a device server pinned to a
 * commit that moved — every one of them builds cleanly and fails on somebody
 * else's machine, usually as "it won't open" with nothing to read.
 *
 * So these read the build config rather than the app: electron-builder.yml,
 * the entitlements, the workflow that signs it, and the lock file that says
 * which ForgeFX is inside.
 *
 * THIS FILE USED TO OPEN ON A DIFFERENT SUBJECT — the two clocks around a
 * generation, the serverless function's ceiling in vercel.json against the
 * browser's own cap in lib/stream.js, which disagreed badly enough that a
 * function killed at 60 seconds looked like the model going quiet. Both files
 * went with the AI, and so did the tests that held them together.
 */
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')

/** Every .js/.jsx under a directory, so a new file cannot quietly opt out. */
/*
 * Forward slashes, on every platform.
 *
 * `fileURLToPath` gives back the platform's own separators, and on Windows
 * that is a backslash — so `file.endsWith('/screens/Connect.js')` silently
 * stopped matching and `f.split('/mobile/')[1]` became undefined. Both are
 * real uses below, and both failed as something else: a screen that was meant
 * to be skipped got scanned, and a path came out as `mobile/undefined`.
 *
 * Node reads a forward-slash path perfectly well on Windows, so normalising
 * here costs nothing and means no caller has to think about it.
 */
function* walk(dir) {
  for (const entry of readdirSync(fileURLToPath(dir))) {
    const path = fileURLToPath(new URL(entry, dir))
    if (statSync(path).isDirectory()) yield* walk(new URL(`${entry}/`, dir))
    else if (/\.(js|jsx)$/.test(entry)) yield path.replaceAll('\\', '/')
  }
}

export function run(test) {
  
  
  
  
  test('picking a save destination cannot load it', () => {
    /*
     * The one way this feature can destroy work.
     *
     * The slot list in the save sheet is the same `PresetList` the preset menu
     * uses, and there `onSelect` LOADS the preset — which is right there and
     * catastrophic here: loading a preset replaces the edit buffer, so
     * choosing where to save would discard the very thing being saved.
     *
     * The two call sites must therefore differ, and they look nearly
     * identical. This asserts the save sheet's handler only sets the slot.
     */
    const sheet = read('src/components/SaveSheet.jsx').replace(/\/\/[^\n]*|\/\*[\s\S]*?\*\//g, ' ')
    const at = sheet.indexOf('onSelect=')
    assert.ok(at !== -1, 'the save sheet no longer offers a slot list')
    const handler = sheet.slice(at, at + 160)
    assert.match(handler, /onSlot\(/, 'the save sheet does not set the slot when a row is picked')
    assert.ok(
      !/jumpTo|selectPreset|onLoad/.test(handler),
      'the save sheet loads the preset it was asked to save into'
    )
  })

  
    test('the Mac app spawns Node and keeps one menu-bar icon', () => {
    /*
     * Both of these are Electron-only, so nothing here can run them — but both
     * are visible in the shape of the code, which is the same trade the rest of
     * the structural checks make.
     *
     * The spawn is the one that matters: without the flag the packaged app
     * launches a second copy of itself instead of the device server. The tray
     * is the one that would look like a mystery: buildTray runs twice, once at
     * launch and once when the phone status lands, and constructing the Tray
     * unconditionally leaves two icons in the menu bar.
     */
    const main = read('desktop/main.js')
    assert.match(
      main,
      /serverEnv\(\{ port, dist: distPath\(\), asNode: true \}\)/,
      'the device server is spawned without ELECTRON_RUN_AS_NODE, so a packaged app starts itself again'
    )
    const tray = main.slice(main.indexOf('function buildTray()'), main.indexOf('app.whenReady'))
    assert.match(tray, /if \(!tray\) \{/, 'buildTray constructs a Tray every time it draws the menu')
  })

  test('an unsigned build is still signed with nothing, so it can run at all', () => {
    /*
     * Apple Silicon will not execute a Mach-O binary with no signature, and
     * packaging invalidates the one Electron ships with — its binary is signed,
     * then renamed, given resources and repacked. Leave it there and macOS says
     * "damaged and can\'t be opened", which reads as a corrupt download and is
     * not one: there is nothing to check.
     *
     * The first person to install a build of this got exactly that, and it has
     * no way past it — unlike "unidentified developer", which does. An ad-hoc
     * signature proves nothing about who built the app, which is the honest
     * state of a test build, and is enough to make it runnable.
     */
    const yml = read('desktop/electron-builder.yml')
    assert.match(yml, /^afterPack: afterPack\.js$/m, 'nothing signs an unsigned build, so it will not open on Apple Silicon')
    const hook = read('desktop/afterPack.js')
    assert.match(hook, /'--sign', '-'/, 'the hook does not ad-hoc sign')
    assert.match(
      hook,
      /if \(process\.env\.CSC_LINK\) return/,
      'the hook would overwrite a real signature with an ad-hoc one, throwing away the thing people trust'
    )
  })

  test('everything the app loads at runtime is actually in the app', () => {
    /*
     * `files` is an allowlist. Anything main.js reaches for that is not named
     * there is simply absent from the packaged app, and the failures are quiet
     * by nature: Electron treats a missing preload as no preload, with no error
     * and nothing in the window.
     *
     * preload.js was missing from it for every release it existed in. So
     * `window.fractalDesktop` was never defined in a packaged build,
     * `desktopBridge()` answered null exactly as designed for a phone or the
     * hosted site, and the whole Updates section — version line, "Check for
     * updates", the ready notice — drew nothing. The feature looked unwritten.
     * It worked in development, where the file sits on disk beside main.js.
     *
     * So this reads what main.js actually asks for rather than checking one
     * name: every `join(__dirname, '<file>')` has to be covered by `files`, or
     * by `extraResources` for the two that are copied in beside the asar.
     */
    const main = read('desktop/main.js')
    const yml = read('desktop/electron-builder.yml')

    const listed = (block) => {
      const at = yml.indexOf(`${block}:`)
      if (at === -1) return []
      const rest = yml.slice(at + block.length + 1)
      const end = rest.search(/\n[a-zA-Z]/)
      return (end === -1 ? rest : rest.slice(0, end))
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.startsWith('- ') || l.startsWith('to: '))
        .map((l) => l.replace(/^-\s*/, '').replace(/^to:\s*/, '').trim())
    }
    const packaged = [...listed('files'), ...listed('extraResources')]
    assert.ok(packaged.includes('main.js'), 'the files list is no longer being read correctly')

    const wanted = [...main.matchAll(/join\(__dirname,\s*'([^']+)'/g)]
      .map((m) => m[1])
      // `..` climbs out of the app to the checkout, which only exists in
      // development — those paths sit behind an `app.isPackaged` ternary whose
      // other half reads process.resourcesPath.
      .filter((name) => name !== '..')
    assert.ok(wanted.length >= 2, 'nothing looks like a runtime path any more — has main.js changed shape?')

    for (const name of wanted) {
      const covered = packaged.some(
        (p) => p === name || p === `${name}/**` || p.startsWith(`${name}/`) ||
               (p.includes('*') && new RegExp(`^${p.replace(/\*+/g, '.*')}$`).test(name))
      )
      assert.ok(
        covered,
        `main.js loads ${name} at runtime and nothing packages it — in a built app it will not be there, ` +
          'and a missing preload or icon fails silently'
      )
    }
  })

  test('the menu offers the way in that works, and names the usual reason one does not', () => {
    /*
     * Two ways to a phone, and the menu only ever mentioned one — the wifi
     * address, with nothing said when macOS was quietly refusing connections
     * from other machines, and no mention of the relay even once it was on.
     */
    const main = read('desktop/main.js')
    assert.match(main, /firewall\.known && firewall\.on && firewall\.blocked !== false/, 'the menu never mentions the firewall, or mentions it when it is not the problem')
    /*
     * Changed on purpose, 12 October 2026 (1.87.19). This pinned the offer to
     * `phone?.on`, which is what armHost found at launch — and on 12 October
     * a phone got no answer through the relay while that still said on,
     * because the device server's link had been closed since. So the offer
     * follows `remoteOn`: the link as the device server last said it was,
     * and armHost's answer only until there has been a look. Still never
     * offered when it does not work.
     */
    assert.match(main, /\.\.\.\(remoteOn\n?\s*\?/, 'the relay is offered whether or not it works')
    assert.match(main, /const remoteOn = relay \? relay\.connected : Boolean\(phone\?\.on\)/, 'the offer does not follow the link as it is now')
    assert.match(main, /fractal\.newbold\.cloud/, 'the other way in is not offered at all')
  })

  test('nothing is shown until there is something to show', () => {
    /*
     * Electron-only, so structural. The window is opened on a URL the server
     * may not be answering yet, and Electron does not retry a page that failed
     * — so the order matters more than anything else here.
     */
    const main = read('desktop/main.js')
    assert.match(main, /return waitForServer\(\{ port \}\)/, 'start() does not wait for the server it spawned')
    /*
     * Read inside the launch itself. A loose search for the call found the
     * first `openWindow()` anywhere in the file, which is now the one that
     * reopens the window after it was closed — a different question, and one
     * that has nothing to wait for.
     */
    const launch = main.slice(main.indexOf('app.whenReady()'))
    assert.ok(launch, 'there is no launch block to read')
    const ready = launch.indexOf('const answering = await start()')
    assert.notEqual(ready, -1, 'the launch no longer waits on start()')
    assert.ok(ready < launch.indexOf('openWindow()'), 'the window is opened before the server is known to answer')
    assert.match(main, /if \(!answering\) \{/, 'a server that never answers leaves a blank window and no explanation')
    assert.match(main, /did-fail-load/, 'a page that fails to load is never retried')
  })

  test('the app asks who has the port before it starts a server on it', () => {
    /*
     * Structural because it is Electron-only. The window is opened on the port
     * the app asked for, so the check has to happen before anything is spawned
     * or the window shows a stranger's answer — which is exactly what the first
     * real run did.
     */
    const main = read('desktop/main.js')
    const at = main.indexOf('await whoHasPort(')
    assert.notEqual(at, -1, 'the app starts a server without asking whether the port is free')
    assert.ok(at < main.indexOf('spawn(process.execPath'), 'the port is checked after the server is started, which is too late')
    assert.match(main, /if \(held\.forgefx\)/, 'a ForgeFX already running is not told apart from anything else on the port')
  })

  test('a build with no certificate does not try to sign with an empty one', () => {
    /*
     * electron-builder decides whether to sign from whether CSC_LINK is
     * *defined*, not whether it is useful: `getCscLink` is commented "allow to
     * specify as empty string" and the gate is `cscLink == null`. GitHub turns
     * a secret that does not exist into an empty string, which is not null — so
     * naming the secret unconditionally means "sign, with this empty
     * certificate", and the build dies with "<dir> not a file".
     *
     * It cost a green pull request and a red manual build to find, because
     * electron-builder refuses to sign PR builds at all: the one trigger that
     * runs on every change is the one trigger that cannot reproduce it.
     *
     * An `env:` block cannot leave a variable unset, so the fix is two steps
     * and the guard is that the signing one is gated.
     */
    const wf = read('.github/workflows/desktop.yml')
    const signing = wf.slice(wf.indexOf('- name: Package, signed'))
    assert.ok(signing.includes('CSC_LINK'), 'the signed build no longer names the certificate — retarget this test')
    assert.match(
      signing.slice(0, signing.indexOf('run:')),
      /if: .*SIGNABLE == 'true'/,
      'the certificate is named by a step that can run without one, which reads as "sign with nothing"'
    )
    const unsigned = wf.slice(wf.indexOf('- name: Package\n'), wf.indexOf('- name: Package, signed'))
    assert.match(
      unsigned,
      /CSC_IDENTITY_AUTO_DISCOVERY: 'false'/,
      'the unsigned build does not say it has nothing to sign with, so it goes looking'
    )
    assert.ok(!/CSC_LINK/.test(unsigned), 'the unsigned build names a certificate')
  })

  test('the device server the app ships is pinned to a commit, and travels with it', () => {
    /*
     * We copy someone else's project into an installer we sign. What goes in
     * therefore has to be a fixed thing, and a tag is not one — whoever owns the
     * repository can move it. The lock file carries both: a tag to read and a
     * commit to verify, and scripts/vendor-forgefx.mjs refuses to build when
     * they disagree.
     */
    const lock = JSON.parse(read('desktop/forgefx.lock.json'))
    for (const name of ['forgefx', 'forgefx-midi']) {
      const spec = lock[name]
      assert.ok(spec, `${name} is not pinned at all`)
      assert.match(spec.repo, /^[\w.-]+\/[\w.-]+$/, `${name}.repo is not owner/name`)
      assert.match(
        spec.commit || '',
        /^[0-9a-f]{40}$/,
        `${name} is pinned by ${spec.tag || 'nothing'} alone — a tag can be moved, so the commit is what is checked`
      )
      assert.ok(spec.tag, `${name} has no tag, so nobody can read what version this is`)

      /*
       * And it is ours. We vendor from private mirrors rather than from
       * upstream, because what goes inside something we sign should not depend
       * on another account's repository still being there, still being public,
       * and still having the history it had last week. `upstream` is what a
       * copy loses first, so it is written down.
       */
      assert.match(
        spec.repo,
        /^justinnewbold\//,
        `${name} is vendored straight from ${spec.repo} — the installer would then depend on an account we do not control`
      )
      assert.match(
        spec.upstream || '',
        /^[\w.-]+\/[\w.-]+$/,
        `${name} does not say where it was mirrored from, which is the thing a copy loses first`
      )
    }

    /*
     * Asked for by commit, not cloned at a tag.
     *
     * The mirrors carry every branch and the whole history but no tags, so
     * there is nothing to clone — and naming the commit is the stricter shape
     * regardless: cloning a tag puts whatever it points at on disk and asks
     * questions afterwards, which is a window this has no reason to have.
     */
    const script = read('scripts/vendor-forgefx.mjs')
    assert.match(
      script,
      /'fetch', '--quiet', '--depth', '1', 'origin', spec\.commit/,
      'the vendor script no longer asks for the pinned commit by name'
    )
    assert.ok(
      !/'--branch', spec\.tag/.test(script),
      'the vendor script clones at the tag again — the mirrors have no tags, and a tag is not the pin'
    )

    /*
     * And the app has to be given it. Vendoring without wiring it up is the
     * state this replaced: a .dmg that says "ForgeFX is not installed" on every
     * machine that is not the one it was built on.
     */
    assert.match(
      read('desktop/main.js'),
      /findForgeFX\(\{ extra: \[vendored\(\)\] \}\)/,
      'the app does not offer findForgeFX the copy it ships with'
    )
    assert.match(
      read('desktop/electron-builder.yml'),
      /- from: vendor\n\s+to: vendor/,
      'the vendored server is not copied into the bundle'
    )
    // Built, not committed: it carries node_modules and a compiled tree.
    assert.match(read('.gitignore'), /^desktop\/vendor$/m, 'the vendored tree is not ignored')
  })

  test('a build that can sign, signs — and then proves it did', () => {
    /*
     * The gate used to be "only on a desktop-v* tag", which read as caution and
     * was actually a guess. The real constraint is narrower and has a reason:
     * electron-builder refuses to sign pull-request builds, because a PR from a
     * fork would otherwise get at the certificate. Every other trigger can sign,
     * and an artefact somebody installs is worth signing whether or not anyone
     * called it a release — the tag rule mostly meant the .dmg people actually
     * downloaded from a hand-started run was the unsigned one.
     */
    const wf = read('.github/workflows/desktop.yml')
    const signed = wf.slice(wf.indexOf('- name: Package, signed and notarised'))
    const gate = signed.slice(0, signed.indexOf('\n', signed.indexOf('if:')))
    assert.match(
      gate,
      /github\.event_name != 'pull_request'/,
      'the signed build is not gated on the one thing that actually forbids signing'
    )
    assert.ok(
      !/refs\/tags\/desktop-v/.test(gate),
      'signing is tied to a release tag again, so a hand-started build produces an unsigned .dmg'
    )

    /*
     * And it is checked. Three questions, and an artefact can pass one while
     * failing another: is the signature intact and complete, would Gatekeeper
     * open it (which, for a Developer ID app, it does only once Apple has
     * notarised it), and is the stamp on the file. The last two are the ones
     * nobody can answer by reading configuration — which is the whole point
     * of asking the build instead of guessing.
     */
    for (const [cmd, why] of [
      ['codesign --verify', 'nothing checks the signature covers what it should'],
      ['spctl --assess', "nothing asks whether Gatekeeper would open it, which is the proof Apple notarised it"],
      ['stapler validate', 'nothing says whether the stamp made it onto the file']
    ]) {
      assert.ok(wf.includes(cmd), `${cmd} is gone: ${why}`)
    }

    /*
     * Changed on purpose, 13 October 2026 (1.87.23). This held every stapler
     * call to the again() retry and let none of them fail quietly, so a stamp
     * Apple's ticket service would not hand over failed the release. From
     * 1.87.14 on it would not, from GitHub's Mac machines: "The network
     * connection was lost" from api.apple-cloudkit.com after Apple had said
     * Accepted, all five tries on 1.87.22. On 1.87.21 the same failure came
     * from INSIDE electron-builder's own notarise-and-staple, so no Mac files
     * reached the release and every computer said "still being built" for
     * about three hours.
     *
     * So what is held now is the line between approval and stamp. Justin's
     * condition, 13 October 2026: "Right now users just have to click the
     * button about being from an unknown developer and that's all to install.
     * Just wanna make sure that's not gonna change." Approval still happens on
     * every release and still fails it when Apple says no; only the stamp may
     * be missing, and a Mac with internet then looks the approval up itself
     * and shows the same prompt.
     */
    const code = (text) => text.split('\n').filter((line) => !/^\s*#/.test(line)).join('\n')
    const macJob = wf.slice(wf.indexOf('\n  mac:\n'), wf.indexOf('\n  windows:\n'))
    assert.ok(macJob.length > 100, 'the mac job is not where this reads it')
    const step = (name) => {
      const at = macJob.indexOf(`- name: ${name}\n`)
      assert.notEqual(at, -1, `the mac job has no step "${name}"`)
      const rest = macJob.slice(at + 1)
      const next = rest.search(/\n {6}- (name|uses):/)
      return code(next === -1 ? rest : rest.slice(0, next))
    }

    // electron-builder's own notarise-and-staple is off, and notarise.js does it instead, between signing and the zip.
    const yml = read('desktop/electron-builder.yml')
    const macConfig = yml.slice(yml.indexOf('\nmac:'), yml.indexOf('\nwin:'))
    assert.match(macConfig, /^ {2}notarize: false$/m, "electron-builder notarises and staples by itself again, and a staple that fails takes the Mac files off the release")
    assert.match(yml, /^afterSign: notarise\.js$/m, 'nothing notarises the app between signing and the zip, so the Mac release is not approved by Apple')
    const pack = step('Package, signed and notarised')
    for (const name of ['CSC_LINK', 'APPLE_ID', 'APPLE_APP_SPECIFIC_PASSWORD', 'APPLE_TEAM_ID']) {
      assert.ok(pack.includes(`${name}:`), `the package step no longer hands notarise.js ${name}, so the app is not notarised`)
    }

    // The disk images go through the same rules: approval checked, stamp best effort.
    const dmg = step('Notarise the disk image too')
    assert.match(dmg, /node notarise\.js "\$dmg"/, 'the disk image is no longer sent to Apple through notarise.js')
    assert.ok(!/notarytool submit/.test(dmg), 'the disk image is sent to Apple by a bare notarytool, whose answer nobody reads')
    for (const name of ['APPLE_ID', 'APPLE_APP_SPECIFIC_PASSWORD', 'APPLE_TEAM_ID']) {
      assert.ok(dmg.includes(`${name}:`), `the disk image step does not hand notarise.js ${name}`)
    }
    assert.ok(!/stapler staple/.test(code(wf)), 'something in the workflow staples by itself, where a failure stops the run')

    // Proof: the signature and Gatekeeper fail the run; the stamp is a warning.
    const prove = step('Prove the artefact is what it claims')
    assert.match(prove, /set -euo pipefail/, 'a failed check in the proof step no longer fails it')
    assert.match(prove, /^\s*codesign --verify --deep --strict --verbose=2 "\$app"$/m, 'the signature check can no longer fail the run')
    assert.match(prove, /^\s*again spctl --assess --type exec --verbose=4 "\$app"$/m, 'Gatekeeper is not asked, or its no can no longer fail the run')
    assert.match(prove, /"\$@" && return 0[\s\S]{0,120}return 1/, 'a Gatekeeper that says no five times no longer fails the step')
    assert.equal((code(wf).match(/^\s*again\(\) \{$/gm) || []).length, 1, 'the retry is defined somewhere it is not used, or twice')
    assert.ok(!/^\s*(again )?xcrun stapler validate/m.test(prove), 'a stamp that cannot be fetched fails the run again')

    /*
     * And the proof of approval follows the stamp. With one, Gatekeeper answers
     * from the file and its no fails the run. Without one, Gatekeeper asks
     * Apple online through the same ticket service that would not hand the
     * stamp over, and a dropped lookup reads "rejected, source=Unnotarized
     * Developer ID" — so its no is put to Apple's notary (notarise.js
     * --confirm), and only the notary's no, or its silence, fails the run.
     * Before this, a release whose stamp could not be fetched went red here
     * after it had gone out, for a lookup and not for a refusal.
     */
    assert.match(prove, /if xcrun stapler validate "\$app"; then\s*\n\s*again spctl --assess --type exec --verbose=4 "\$app"\s*\n\s*else\b/, 'Gatekeeper saying no to a stamped app no longer fails the run')
    assert.match(
      prove,
      /else\s*\n\s*if ! again spctl --assess --type exec --verbose=4 "\$app"; then\s*\n\s*node notarise\.js --confirm "\$app"\s*\n\s*fi\s*\n\s*nostamp "\$app"\s*\n\s*fi/,
      'an app with no stamp that Gatekeeper cannot vouch for is let through without asking Apple’s notary'
    )
    assert.match(prove, /if ! xcrun stapler validate "\$dmg"; then\s*\n\s*node notarise\.js --confirm "\$dmg"\s*\n\s*nostamp "\$dmg"\s*\n\s*fi/, 'a disk image with no stamp is let through without asking Apple’s notary')
    assert.match(prove, /nostamp\(\) \{\s*\n\s*echo "::warning::/, 'a missing stamp is not said on the run')
    assert.ok(!/notarise\.js --confirm[^\n]*(\|\||; *true|&& *true)/.test(prove), 'a no from Apple’s notary is swallowed')
    for (const name of ['APPLE_ID', 'APPLE_APP_SPECIFIC_PASSWORD', 'APPLE_TEAM_ID']) {
      assert.ok(prove.includes(`${name}:`), `the proof step does not hand notarise.js ${name}, so it cannot ask Apple's notary`)
    }

    /*
     * Run, on stand-ins for codesign, the stapler, Gatekeeper and the notary,
     * for every way it can go. Bash's own rules about when `set -e` stops a
     * script are the part reading the text cannot prove.
     */
    if (process.platform !== 'win32') {
      const script = (() => {
        const raw = wf.slice(wf.indexOf('- name: Prove the artefact is what it claims'))
        const body = raw.slice(raw.indexOf('run: |\n') + 'run: |\n'.length)
        const lines = []
        for (const line of body.split('\n')) {
          if (line.trim() && !line.startsWith('          ')) break
          lines.push(line.slice(10))
        }
        return lines.join('\n')
      })()
      const proveWith = ({ appStamp, dmgStamp = true, gatekeeper, notary }) => {
        const root = mkdtempSync(join(tmpdir(), 'prove-'))
        try {
          const bin = join(root, 'bin')
          const work = join(root, 'desktop')
          mkdirSync(bin)
          mkdirSync(join(work, 'release', 'mac-arm64', 'Fractal Remote.app'), { recursive: true })
          writeFileSync(join(work, 'release', 'Fractal-Remote-1.87.23-arm64.dmg'), '')
          const stub = (name, body) => {
            writeFileSync(join(bin, name), `#!/bin/sh\necho "$0 $*" >> "${join(root, 'asked')}"\n${body}\n`)
            chmodSync(join(bin, name), 0o755)
          }
          stub('sleep', 'exit 0')
          stub('codesign', 'exit 0')
          stub('spctl', `exit ${gatekeeper ? 0 : 3}`)
          stub('xcrun', `case "$3" in *.app) exit ${appStamp ? 0 : 65};; *.dmg) exit ${dmgStamp ? 0 : 65};; esac; exit 1`)
          stub('node', `exit ${notary ? 0 : 1}`)
          const out = spawnSync('bash', ['-c', script], { cwd: work, env: { PATH: `${bin}:/usr/bin:/bin` }, encoding: 'utf8' })
          let asked = ''
          try {
            asked = readFileSync(join(root, 'asked'), 'utf8')
          } catch {
            asked = ''
          }
          return { code: out.status, out: out.stdout, asked: asked.split('\n').filter(Boolean).map((l) => l.replace(/^.*\/bin\//, '')) }
        } finally {
          rmSync(root, { recursive: true, force: true })
        }
      }
      const notaryAsked = (r) => r.asked.filter((l) => l.startsWith('node notarise.js --confirm'))
      // Stamped and approved: green, nothing asked of the notary.
      const fine = proveWith({ appStamp: true, gatekeeper: true })
      assert.equal(fine.code, 0, fine.out)
      assert.deepEqual(notaryAsked(fine), [])
      // Stamped and refused by Gatekeeper: red, and the notary is not asked to overrule it.
      const refused = proveWith({ appStamp: true, gatekeeper: false, notary: true })
      assert.notEqual(refused.code, 0, 'Gatekeeper refusing a stamped app no longer fails the run')
      assert.deepEqual(notaryAsked(refused), [], 'the notary overrules Gatekeeper on a stamped app')
      assert.equal(refused.asked.filter((l) => l.startsWith('spctl')).length, 5)
      // No stamp, and Gatekeeper's lookup got through: green, with a warning.
      const looked = proveWith({ appStamp: false, gatekeeper: true })
      assert.equal(looked.code, 0, looked.out)
      assert.match(looked.out, /::warning::release\/mac-arm64\/Fractal Remote\.app is notarised but carries no stamp/)
      assert.deepEqual(notaryAsked(looked), [])
      // No stamp, Gatekeeper cannot get through, Apple's notary says Accepted: green, with a warning.
      const vouched = proveWith({ appStamp: false, gatekeeper: false, notary: true })
      assert.equal(vouched.code, 0, `a release whose stamp could not be fetched turns the run red after it went out:\n${vouched.out}`)
      assert.deepEqual(notaryAsked(vouched), ['node notarise.js --confirm release/mac-arm64/Fractal Remote.app'])
      assert.match(vouched.out, /::warning::.*carries no stamp/)
      // No stamp, and neither Gatekeeper nor the notary says yes: red.
      const unproven = proveWith({ appStamp: false, gatekeeper: false, notary: false })
      assert.notEqual(unproven.code, 0, 'an app nothing proves Apple approved passes the proof')
      // A disk image with no stamp that the notary does not vouch for: red.
      const image = proveWith({ appStamp: true, gatekeeper: true, dmgStamp: false, notary: false })
      assert.notEqual(image.code, 0, 'a disk image nothing proves Apple approved passes the proof')
      assert.deepEqual(notaryAsked(image), ['node notarise.js --confirm release/Fractal-Remote-1.87.23-arm64.dmg'])
      const imageOk = proveWith({ appStamp: true, gatekeeper: true, dmgStamp: false, notary: true })
      assert.equal(imageOk.code, 0, imageOk.out)
    }
  })

  test('Apple saying no stops the Mac release; Apple’s stamp never does', async () => {
    /*
     * desktop/notarise.js, run with Apple stood in for. It is electron-builder's
     * afterSign hook for each .app and the workflow's command for each .dmg, so
     * this is the whole of what decides whether a Mac release goes out.
     */
    const { createRequire } = await import('node:module')
    const n = createRequire(import.meta.url)('../desktop/notarise.js')
    const env = { APPLE_ID: 'justin@example.com', APPLE_APP_SPECIFIC_PASSWORD: 'secret-pw', APPLE_TEAM_ID: 'TEAM123' }
    const apple = ({ answer = { status: 'Accepted', id: 'sub-1' }, exit = 0, stamps = [] } = {}) => {
      const calls = []
      const lines = []
      const slept = []
      const removed = []
      let tries = 0
      const run = async (cmd, args, options = {}) => {
        calls.push({ line: [cmd, ...args].join(' '), cwd: options.cwd })
        if (cmd === 'ditto') return { code: 0, stdout: '' }
        if (args[0] === 'notarytool' && args[1] === 'submit') return { code: exit, stdout: answer ? JSON.stringify(answer) : 'Error: the network connection was lost.' }
        if (args[0] === 'notarytool' && args[1] === 'log') return { code: 0, stdout: '{"issues":[{"message":"The binary is not signed with a valid Developer ID certificate."}]}' }
        if (args[0] === 'stapler') return { code: stamps[tries++] ? 0 : 65, stdout: '' }
        throw new Error(`nothing else is run: ${cmd}`)
      }
      const options = { env, run, log: (l) => lines.push(l), sleep: async (ms) => slept.push(ms), tmp: () => '/tmp/notarise-1', remove: (d) => removed.push(d) }
      return { options, calls, lines, slept, removed }
    }
    assert.deepEqual(n.STAPLE_WAITS_S, [0, 10, 20, 40, 80], 'the stamp is asked for with less patience than before')

    // Accepted, and the ticket service never answers: notarised, no stamp, a warning, and the release goes on.
    const offline = apple()
    const out = await n.notarise('/r/Fractal-Remote-1.87.23.dmg', offline.options)
    assert.deepEqual(out, { id: 'sub-1', stapled: false }, 'a stamp that could not be fetched stops the release')
    assert.equal(offline.calls.filter((c) => c.line.startsWith('xcrun stapler staple')).length, 5)
    assert.deepEqual(offline.slept, [10000, 20000, 40000, 80000])
    assert.ok(offline.lines.some((l) => l.startsWith('::warning::') && /no stamp/.test(l)), 'a missing stamp is not said on the run')
    assert.ok(!offline.lines.some((l) => l.includes('secret-pw')), 'the Apple password is printed in the log')
    const submit = offline.calls.find((c) => c.line.startsWith('xcrun notarytool submit'))
    assert.match(submit.line, /--wait --output-format json$/, 'notarytool is not waited on, or its answer cannot be read')
    assert.match(submit.line, /--apple-id justin@example\.com --password secret-pw --team-id TEAM123/)

    // Accepted, and the stamp comes back on the second try.
    const later = apple({ stamps: [false, true] })
    assert.deepEqual(await n.notarise('/r/Fractal-Remote-1.87.23.dmg', later.options), { id: 'sub-1', stapled: true })
    assert.deepEqual(later.slept, [10000])

    // Refused: the release stops, with Apple's reasons, and nothing is stamped.
    const refused = apple({ answer: { status: 'Invalid', id: 'sub-2', message: 'Processing complete' } })
    await assert.rejects(n.notarise('/r/Fractal-Remote-1.87.23.dmg', refused.options), /Apple did not accept Fractal-Remote-1\.87\.23\.dmg \(Invalid[\s\S]*not signed with a valid Developer ID/, 'a refusal from Apple lets the release go out')
    assert.ok(!refused.calls.some((c) => c.line.startsWith('xcrun stapler')), 'a refused file is stamped')
    // No answer at all, or an answer with a failed exit, is not an approval either.
    await assert.rejects(n.notarise('/r/x.dmg', apple({ answer: null }).options), /no answer/)
    await assert.rejects(n.notarise('/r/x.dmg', apple({ exit: 1 }).options), /exited 1/)
    assert.equal(n.readAnswer('Conducting pre-submission checks…\n{"status":"Accepted","id":"sub-9"}').status, 'Accepted')
    assert.equal(n.readAnswer('not json'), null)

    // A .app is zipped beside itself to send, sent as the zip, stamped where it sits, and the zip cleaned up.
    const app = apple()
    await n.notarise('/out/mac-arm64/Fractal Remote.app', app.options)
    assert.deepEqual(app.calls[0], { line: 'ditto -c -k --sequesterRsrc --keepParent Fractal Remote.app /tmp/notarise-1/Fractal Remote.zip', cwd: '/out/mac-arm64' })
    assert.match(app.calls[1].line, /^xcrun notarytool submit \/tmp\/notarise-1\/Fractal Remote\.zip /)
    assert.deepEqual(app.calls.at(-1), { line: 'xcrun stapler staple Fractal Remote.app', cwd: '/out/mac-arm64' })
    assert.deepEqual(app.removed, ['/tmp/notarise-1'])

    // As electron-builder's hook: Mac builds with a real certificate only, and those must have an Apple ID.
    const hook = apple()
    const context = { electronPlatformName: 'darwin', appOutDir: '/out/mac', packager: { appInfo: { productFilename: 'Fractal Remote' } } }
    assert.equal(await n.afterSign({ ...context, electronPlatformName: 'win32' }, { ...hook.options, env: { ...env, CSC_LINK: 'p12' } }), null)
    assert.equal(await n.afterSign(context, hook.options), null, 'an ad-hoc signed build is sent to Apple, which notarises nothing ad hoc')
    assert.equal(hook.calls.length, 0)
    await assert.rejects(n.afterSign(context, { ...hook.options, env: { CSC_LINK: 'p12' } }), /APPLE_ID/, 'a Developer ID app goes out without being notarised')
    assert.deepEqual(await n.afterSign(context, { ...hook.options, env: { ...env, CSC_LINK: 'p12' } }), { id: 'sub-1', stapled: false })
    assert.match(hook.calls[0].line, /^ditto .* Fractal Remote\.app /)
    assert.equal(n.default, n.afterSign, 'electron-builder finds no hook in notarise.js')
    assert.throws(() => n.credentials({ APPLE_ID: 'a@b.c' }), /APPLE_APP_SPECIFIC_PASSWORD and APPLE_TEAM_ID/)
    assert.equal(n.credentials({}), null)

    /*
     * Every approval is written down for the proof step: which submission,
     * for which file, in the runner's own temporary folder. A file with no
     * stamp is proven from that record by asking Apple's notary, because
     * Gatekeeper's online answer goes through the ticket service that would
     * not hand the stamp over (see "Prove the artefact" in desktop.yml).
     */
    const book = []
    const onRunner = { ...env, RUNNER_TEMP: '/runner/tmp' }
    const real = (f) => `/real${f}`
    const written = apple()
    await n.notarise('/r/x.dmg', { ...written.options, env: onRunner, append: (path, text) => book.push([path, text]), real })
    assert.deepEqual(book, [['/runner/tmp/notarised.tsv', 'sub-1\t/real/r/x.dmg\n']], 'an approval is not written down for the proof step')
    await assert.rejects(n.notarise('/r/x.dmg', { ...apple({ answer: { status: 'Invalid', id: 'sub-2' } }).options, env: onRunner, append: (path, text) => book.push([path, text]), real }))
    assert.equal(book.length, 1, 'a refusal is written down as an approval')
    // A record that cannot be written is a warning: the approval happened, and the release goes on.
    const unwritten = apple()
    const kept = await n.notarise('/r/x.dmg', { ...unwritten.options, env: onRunner, append: () => { throw new Error('disk full') }, real })
    assert.equal(kept.id, 'sub-1')
    assert.ok(unwritten.lines.some((l) => l.startsWith('::warning::could not write down')))
    assert.equal(n.recordFile({}), null)
    assert.equal(n.recordFile({ NOTARISED_RECORD: '/x/r.tsv', RUNNER_TEMP: '/t' }), '/x/r.tsv')

    const notary = (answers) => {
      const calls = []
      const slept = []
      let i = 0
      const run = async (cmd, args) => {
        calls.push([cmd, ...args].join(' '))
        const a = answers[Math.min(i++, answers.length - 1)]
        return a ? { code: 0, stdout: JSON.stringify({ id: 'sub-7', name: 'Fractal Remote.zip', ...a }) } : { code: 69, stdout: 'Error: The network connection was lost.' }
      }
      const record = 'sub-0\t/real/r/other.dmg\nsub-7\t/real/out/mac-arm64/Fractal Remote.app\n'
      const options = {
        env: onRunner,
        run,
        real,
        log: () => {},
        sleep: async (ms) => slept.push(ms),
        readText: (path) => {
          assert.equal(path, '/runner/tmp/notarised.tsv')
          return record
        }
      }
      return { options, calls, slept }
    }
    const app7 = '/out/mac-arm64/Fractal Remote.app'
    assert.deepEqual(n.CONFIRM_WAITS_S, [0, 10, 30])
    const yes = notary([{ status: 'Accepted' }])
    assert.deepEqual(await n.confirm(app7, yes.options), { id: 'sub-7' })
    assert.deepEqual(yes.calls, ['xcrun notarytool info sub-7 --apple-id justin@example.com --password secret-pw --team-id TEAM123 --output-format json'], 'the notary is asked about some other submission, or not by its record')
    // Apple's own record saying anything but Accepted fails at once: that is an answer, not a dropped line.
    const no = notary([{ status: 'Invalid', message: 'Processing complete' }])
    await assert.rejects(n.confirm(app7, no.options), /submission sub-7 for Fractal Remote\.app is Invalid/, 'a submission Apple refused passes the proof')
    assert.equal(no.calls.length, 1)
    // No answer is asked again, and an answer that never comes fails.
    const late = notary([null, { status: 'Accepted' }])
    assert.deepEqual(await n.confirm(app7, late.options), { id: 'sub-7' })
    assert.deepEqual(late.slept, [10000])
    const silent = notary([null])
    await assert.rejects(n.confirm(app7, silent.options), /did not answer about Fractal Remote\.app \(submission sub-7\) after 3 tries/, 'a notary that never answers passes the proof')
    assert.equal(silent.calls.length, 3)
    // No record of the file on this run: nothing proves it, and nothing is asked.
    const none = notary([{ status: 'Accepted' }])
    await assert.rejects(n.confirm('/out/mac/Fractal Remote.app', none.options), /No record that Apple accepted Fractal Remote\.app/, 'a file nobody sent to Apple passes the proof')
    assert.equal(none.calls.length, 0)
    await assert.rejects(n.confirm(app7, { ...none.options, readText: () => { throw new Error('ENOENT') } }), /No record/)
    await assert.rejects(n.confirm(app7, { ...none.options, env: { RUNNER_TEMP: '/runner/tmp' } }), /APPLE_ID/)
  })

  test('the Windows app is built, and ships both halves of a release', async () => {
    /*
     * "Build a Windows desktop app matching the existing framework."
     *
     * Same Electron shell, same ForgeFX, same host.mjs — the differences are
     * all in packaging, and packaging is the part with no way to check itself
     * at runtime. Each of the things below builds cleanly when it is wrong and
     * fails on a PC that is not this one.
     */
    const yml = read('desktop/electron-builder.yml')
    const win = yml.slice(yml.indexOf('\nwin:'))
    assert.ok(yml.includes('\nwin:'), 'there is no Windows target at all')

    /*
     * TWO ARTEFACTS, AND BOTH ARE REQUIRED. The .exe is what a person
     * downloads; the .zip is what electron-updater downloads, exactly as on
     * macOS. Ship only the installer and the app finds an update it can never
     * install and says so every time it starts.
     */
    assert.match(win, /nsis/, 'no installer is produced')
    assert.match(win, /zip/, 'no zip is produced, so the app can never update itself')

    /* Not an administrator install. A PC at a venue is not always one somebody
       has the password for, and perMachine would ask for it. */
    assert.match(yml, /\nnsis:/, 'the installer has no settings of its own')
    assert.match(yml, /perMachine: false/, 'the installer asks for an administrator it does not need')

    /*
     * AND THE TRAY ICON IS THE ONE PLACE THE TWO PLATFORMS DIFFER ON PURPOSE.
     * macOS wants a template image — a silhouette it recolours for the menu
     * bar — and that same file on a Windows taskbar is a black square on a
     * black background. Two files, and the bundle has to carry the second.
     */
    assert.match(yml, /trayWin\.png/, 'the Windows build does not carry its own tray icon')
    const trayWin = readFileSync(new URL('../desktop/trayWin.png', import.meta.url))
    assert.deepEqual(
      [...trayWin.subarray(0, 8)],
      [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
      'the Windows tray icon is not a PNG'
    )
    const main = read('desktop/main.js')
    assert.match(main, /process\.platform === 'darwin'/, 'the tray icon is chosen without asking which platform this is')
    assert.match(main, /trayWin\.png/, 'the app never reaches for the Windows tray icon')
    assert.match(main, /setTemplateImage\(true\)/, 'the Mac tray icon is no longer a template, so it will not recolour')
    /* And drawn at tray size rather than downscaled from 1024, which is how a
       menu-bar icon ends up a grey smudge. */
    assert.match(read('scripts/icon.mjs'), /TRAY_WIN/, 'nothing generates the Windows tray icon, so it cannot be regenerated from the artwork')

    const wf = read('.github/workflows/desktop.yml')
    /*
     * Bounded at the next job, not at the end of the file.
     *
     * This read from `windows:` to EOF, which was right while windows was
     * last and silently wrong the moment a linux job was added after it: the
     * slice swallowed linux's own `Package` step and the publish-flag check
     * below failed against a step that was never meant to match. A slice that
     * depends on being last is a slice that breaks when somebody appends.
     */
    const jobBody = (name) => {
      const at = wf.indexOf(`\n  ${name}:\n`)
      assert.notEqual(at, -1, `the ${name} job is gone`)
      const next = wf.slice(at + 1).search(/\n {2}[a-z][a-z0-9-]*:\n/)
      return next === -1 ? wf.slice(at) : wf.slice(at, at + 1 + next)
    }
    const job = jobBody('windows')
    assert.match(job, /runs-on: windows-latest/, 'the Windows app is being built somewhere that is not Windows')
    /* bash for every step in that job: the heredoc, the loops over release/,
       and the publish flag below. */
    assert.match(job, /defaults:\n\s+run:\n\s+shell: bash/, 'the Windows job is not pinned to bash')

    /*
     * AND NO SHELL SYNTAX INSIDE THE DIST SCRIPT, which is a different rule
     * from that one and the reason this test exists.
     *
     * `--publish ${PUBLISH:-never}` lived in dist:win, and `shell: bash` did
     * not save it: that governs the STEP's command and nothing further, and
     * npm runs a script's body through its own shell — cmd.exe on Windows,
     * whatever the workflow asked for. electron-builder was handed the six
     * characters `${PUBL…` and failed with
     *   Argument: publish, Given: "${PUBLISH:-never}"
     * which names the right argument and never mentions a shell.
     *
     * The expansion belongs in the step, where bash is real. The Mac script
     * keeps its own copy and is fine — npm runs that one through sh.
     */
    const scripts = JSON.parse(read('desktop/package.json')).scripts
    assert.ok(
      !/[$][{]/.test(scripts['dist:win']),
      'dist:win carries shell syntax again, and npm will run it through cmd.exe on Windows'
    )
    for (const step of job.split('- name: ').filter((s) => s.startsWith('Package'))) {
      assert.match(
        step,
        /npm run dist:win -- --publish "\$\{PUBLISH:-never\}"/,
        'a Windows Package step no longer passes the publish flag, so it falls back to electron-builder\'s own default'
      )
    }

    /* The same question the Mac job asks: modules built against the runner's
       Node, loaded under Electron's. The symptom of getting it wrong is an app
       that opens perfectly and never sees the unit. */
    assert.match(job, /ELECTRON_RUN_AS_NODE=1/, 'nothing checks the native modules load under Electron on Windows')
    /* And that both halves of a release exist before one is published. */
    assert.match(job, /no zip was produced/, 'a release can go out with no way for the app to update itself')

    /*
     * AND THE UNSIGNED WINDOWS BUILD PUBLISHES, which is the one place this
     * job deliberately differs from the Mac one.
     *
     * An unsigned macOS app is not worth releasing — Gatekeeper refuses it and
     * a normal person has no way through. Windows is not like that: SmartScreen
     * shows a blue box with "More info → Run anyway" under it and the installer
     * then works exactly as a signed one would. Gating the Windows release on a
     * certificate would mean no Windows app at all, over a warning the connect
     * screen already tells people to expect.
     */
    const unsigned = job.slice(job.indexOf('- name: Package\n'), job.indexOf('- name: Package, signed'))
    assert.ok(unsigned.includes('PUBLISH:'), 'the unsigned Windows build cannot publish, so there is no Windows download until a certificate is bought')
    assert.ok(
      !/CSC_LINK/.test(unsigned),
      'the unsigned step names CSC_LINK — GitHub turns a missing secret into an empty string, which is not null, so electron-builder tries to sign with nothing'
    )
    /* And it still only ever publishes deliberately, from the default branch. */
    assert.match(unsigned, /github\.event_name != 'pull_request'/, 'a pull request could publish a release')
    assert.match(unsigned, /github\.ref == 'refs\/heads\/main'/, "a build from any branch could publish under main's name")
  })

  test('the Linux app builds both formats, and the .deb has the fields Debian demands', async () => {
    /*
     * "Do the Linux app."
     *
     * WHAT THIS TEST IS ACTUALLY FOR. The first Linux build failed, on both
     * architectures, at the very last step — the AppImage was already made,
     * the native modules had already been proved to load — because the .deb
     * target refused to assemble without a Homepage field and a maintainer
     * address. Neither is a thing anybody notices missing: the Mac and Windows
     * installers have never wanted them, and the config reads as complete.
     *
     * A whole CI cycle to be told a package needs an email address in it. That
     * is the kind of failure that is cheap to catch here and expensive to
     * catch there, so it is caught here.
     */
    const yml = read('desktop/electron-builder.yml')
    assert.ok(yml.includes('\nlinux:'), 'there is no Linux target at all')
    const linux = yml.slice(yml.indexOf('\nlinux:'))

    /*
     * BOTH FORMATS, AND THEY ARE NOT INTERCHANGEABLE. AppImage is the one that
     * runs anywhere without an install step, and the one that updates itself
     * with no password. (This said a .deb can never replace itself. Not so:
     * electron-updater 6's DebUpdater reads resources/package-type and runs
     * dpkg -i through pkexec or sudo at a clean quit — so it updates only
     * when somebody can give it a password, which is still the difference.)
     * The .deb is for the box in a rack that stays on, where `apt install
     * ./file.deb` is a thing somebody already knows. Drop either and a real
     * person loses something.
     */
    assert.match(linux, /AppImage/, 'no AppImage, so there is no Linux download that updates itself')
    assert.match(linux, /deb/, 'no .deb, so the rack machine has no package it recognises')

    /*
     * THE TWO FIELDS THE BUILD DIED ON, AND THEY LIVE IN DIFFERENT FILES.
     *
     * electron-builder reports them in one breath — "specify project homepage"
     * and "specify author email" — which makes it read as one missing block.
     * It is not. `maintainer` is a deb option and belongs in the yml;
     * `homepage` is package.json METADATA and is not a configuration key at
     * all. Putting it in the yml, which is the obvious response to the error,
     * fails the whole config on `unknown property 'homepage'` before anything
     * is packaged — a worse failure than the one being fixed, and the second
     * red CI run this test exists to have prevented.
     */
    const pkg = JSON.parse(read('desktop/package.json'))
    assert.match(
      String(pkg.homepage),
      /^https:\/\//,
      'desktop/package.json has no homepage, and the .deb build stops rather than defaulting'
    )
    assert.ok(
      !/^homepage:/m.test(yml),
      "homepage is in electron-builder.yml, where it is not a real option — electron-builder rejects the whole config"
    )
    const deb = yml.slice(yml.indexOf('\ndeb:'))
    assert.match(
      deb,
      /maintainer: .+ <[^@\s]+@[^>\s]+>/,
      'the .deb names no maintainer with a working address, and the build refuses to guess one'
    )

    /*
     * AND NO INVENTED KEYS ANYWHERE AT THE TOP LEVEL, which is the general
     * form of the mistake above.
     *
     * electron-builder validates its whole config against a schema before it
     * does any work, so one misremembered key name costs a full CI cycle and
     * produces nothing. This is that schema's top-level property list, copied
     * from electron-builder 25's own rejection message. It only needs revising
     * when the pinned electron-builder major moves.
     */
    const VALID_TOP_LEVEL = new Set(
      `afterAllArtifactBuild afterExtract afterPack afterSign apk appId appImage appx
       appxManifestCreated artifactBuildCompleted artifactBuildStarted artifactName asar
       asarUnpack beforeBuild beforePack buildDependenciesFromSource buildNumber buildVersion
       compression copyright cscKeyPassword cscLink deb defaultArch detectUpdateChannel
       directories disableDefaultIgnoredFiles disableSanityCheckAsar dmg downloadAlternateFFmpeg
       electronBranding electronCompile electronDist electronDownload electronLanguages
       electronUpdaterCompatibility electronVersion executableName extends extraFiles
       extraMetadata extraResources fileAssociations files flatpak forceCodeSigning framework
       freebsd generateUpdatesFilesForAllChannels icon includePdb includeSubNodeModules
       launchUiVersion linux mac mas masDev msi msiProjectCreated msiWrapped nativeRebuilder
       nodeGypRebuild nodeVersion npmArgs npmRebuild nsis nsisWeb onNodeModuleFile p5p pacman
       pkg portable productName protocols publish releaseInfo removePackageKeywords
       removePackageScripts rpm snap squirrelWindows target win $schema`.split(/\s+/)
    )
    const topLevel = yml.split('\n').flatMap((line) => {
      const m = /^([A-Za-z$][A-Za-z0-9$]*):/.exec(line)
      return m ? [m[1]] : []
    })
    for (const key of topLevel) {
      assert.ok(
        VALID_TOP_LEVEL.has(key),
        `electron-builder has no top-level option "${key}" — it rejects the entire config and builds nothing`
      )
    }

    /*
     * AND NO ARCHITECTURE LIST, which is the one thing here that is a decision
     * rather than a requirement. serialport and @julusian/midi are compiled
     * for whatever machine ran `npm ci`, so an x64 runner asked to emit an
     * arm64 package produces an installer that opens and never finds the unit.
     * Two jobs, each building only for itself, is what makes the Raspberry Pi
     * download real. A list here would quietly undo that.
     */
    const target = linux.slice(linux.indexOf('target:'))
    assert.ok(
      !/arch:/.test(target.slice(0, target.indexOf('\ndeb:') === -1 ? undefined : target.indexOf('\ndeb:'))),
      'the Linux target names architectures, so one runner will cross-build a package whose device layer cannot load'
    )

    /* No shell syntax in the script, for the same reason dist:win has none. */
    const scripts = JSON.parse(read('desktop/package.json')).scripts
    assert.ok(!/[$][{]/.test(scripts['dist:linux']), 'dist:linux carries shell syntax, which npm runs through its own shell')

    /*
     * AND THE ARM BUILD HAS A PACKAGER IT CAN ACTUALLY RUN.
     *
     * electron-builder shells out to fpm to make a .deb, and the copy it
     * downloads is published for linux-x86 only — there is no arm64 build of
     * it. On the arm runner the AppImage finishes, the .deb starts, and a
     * 32-bit x86 Ruby meets an arm64 kernel: "cannot execute binary file".
     * fpm is a gem, so installing it and pointing app-builder at PATH fixes
     * it; that is what the arm-only step does.
     *
     * THE FLAG HAS TO BE EXPORTED FROM THAT STEP, not set on Package with a
     * conditional value, and this is the part worth holding. app-builder
     * checks whether USE_SYSTEM_FPM is PRESENT and never reads its value, so
     * the natural `${{ ... || '' }}` spelling gives x64 an empty string that
     * still means yes — and x64 then hunts for an fpm nobody installed. The
     * variable must not exist there at all.
     */
    const wfL = read('.github/workflows/desktop.yml')
    const linuxJob = (() => {
      const at = wfL.indexOf('\n  linux:\n')
      assert.notEqual(at, -1, 'the linux job is gone')
      const next = wfL.slice(at + 1).search(/\n {2}[a-z][a-z0-9-]*:\n/)
      return next === -1 ? wfL.slice(at) : wfL.slice(at, at + 1 + next)
    })()
    assert.match(linuxJob, /gem install --no-document fpm/, 'nothing installs fpm, so the arm .deb cannot be built at all')
    assert.match(
      linuxJob,
      /echo "USE_SYSTEM_FPM=true" >> "\$GITHUB_ENV"/,
      'the system-fpm switch is not exported from the step that installs it, so the two can disagree'
    )
    /* Real YAML lines only — the paragraph above spells the bad form out in
       prose, and a naive search finds its own explanation. */
    const setsAsEnv = linuxJob
      .split('\n')
      .map((line) => line.trim())
      .some((line) => !line.startsWith('#') && line.startsWith('USE_SYSTEM_FPM:'))
    assert.ok(
      !setsAsEnv,
      'USE_SYSTEM_FPM is set as a step env — an empty value there still reads as ON, and x64 would look for an fpm it never installed'
    )
    /* And the install is arm-only: x64's bundled fpm works and needs no gem. */
    const fpmStep = linuxJob.slice(linuxJob.indexOf('- name: A packager that runs on this machine'))
    assert.match(
      fpmStep.slice(0, fpmStep.indexOf('- name: Package')),
      /if: matrix\.arch == 'arm64'/,
      'the fpm install is not limited to arm64, so the x64 build grew a dependency it does not need'
    )
  })

  test('every Linux build asks the app’s own process, and the packaged app, past the device server’s guard', () => {
    /*
     * ForgeFX's guard (23 October 2026) keeps the computer's account routes
     * for a caller that names no Origin. The app's main process is that
     * caller when it turns the phone remote on (armHost), and only a real
     * Electron main process can say what its fetch sends: ELECTRON_RUN_AS_NODE
     * is the device server's side, and a different fetch. Measured once by
     * hand on Electron 33.4.11; held on every build by these two steps.
     */
    const wf = read('.github/workflows/desktop.yml')
    const at = wf.indexOf('\n  linux:\n')
    assert.notEqual(at, -1, 'the linux job is gone')
    const next = wf.slice(at + 1).search(/\n {2}[a-z][a-z0-9-]*:\n/)
    const linuxJob = next === -1 ? wf.slice(at) : wf.slice(at, at + 1 + next)
    const step = (name) => {
      const from = linuxJob.indexOf(`- name: ${name}`)
      assert.notEqual(from, -1, `the step "${name}" is gone`)
      const rest = linuxJob.slice(from + 1)
      const to = rest.search(/\n {6}- (name|uses):/)
      return to === -1 ? rest : rest.slice(0, to)
    }

    const probe = step("The app's own process sends no Origin")
    assert.ok(linuxJob.indexOf("- name: The app's own process sends no Origin") < linuxJob.indexOf('- name: Package'), 'the probe runs after the release is made, so it cannot keep one back')
    assert.match(probe, /xvfb-run -a "\$ELECTRON" --no-sandbox "\$RUNNER_TEMP\/main-fetch\/main\.js"/, 'the probe is not run as Electron itself')
    assert.doesNotMatch(probe, /ELECTRON_RUN_AS_NODE=|ELECTRON_RUN_AS_NODE: /, 'the probe runs Electron as Node, which is not where the app turns the phone remote on')
    assert.match(probe, /process\.type !== 'browser'/, 'the probe does not check it is the main process')
    assert.match(probe, /const \{ armHost \} = await import\(pathToFileURL\(process\.env\.HOST_MJS\)\.href\)/, 'the probe no longer runs armHost itself')
    assert.match(probe, /s\.origin !== undefined \|\| s\.site !== undefined/, 'the probe stopped failing on an Origin or a Sec-Fetch-Site')
    assert.match(probe, /for \(const m of \['GET', 'PUT', 'POST'\]\)/, 'the probe stopped insisting armHost used every method it uses')

    const hidden = step('The app starts with no window, once, and stops when told')
    assert.match(hidden, /grep -q 'Phone remote: sign in once in the app to turn it on\\\.' "\$log"/, 'the packaged app is no longer held to being answered as a signed-out computer')
    assert.match(hidden, /for at in "localhost:5056" "127\.0\.0\.1:5056" "\$mdns:5056" "\$named:5056" \$\{lan:\+"\$lan:5056"\}; do/, 'an address the computer hands out is no longer asked')
    // The .local names are made the way both launchers make theirs, and one from an override.
    assert.match(hidden, /mdns="\$\(addr "h\.advertisedName\(\)"\)\.local"/, 'the .local name asked is not the one the app advertises')
    assert.match(hidden, /named="\$\(addr "h\.advertisedName\(\{ env: \{ FRACTAL_MDNS_NAME: 'pedal_board' \} \}\)"\)\.local"/, 'the name made from a FRACTAL_MDNS_NAME override is no longer asked')
    assert.match(hidden, /-X PUT -H "Host: \$at" -H "Origin: http:\/\/\$at"/, 'the write each address’s page makes is no longer asked')
    assert.match(hidden, /grep -q '\\\[forgefx\\\]\\\[guard\\\] refused' "\$log"/, 'a refusal of something the app asked no longer turns the build red')
  })

  test('every gear photograph says why we may use it, and names who took it', async () => {
    /*
     * "All the amp/cabs/drive photos have been uploaded to GitHub so you can
     * get those wired up."
     *
     * THE FIRST BATCH OF TWO HUNDRED WAS THROWN AWAY, and this is what it was
     * thrown away over. 123 of those records were a photograph of some OTHER
     * piece of gear standing in — a Bandmaster filed as a Bassman, a Vox AC15
     * filed as an AC20 — and roughly 71 came from retailers under a claimed
     * "fair use editorial", which does not survive a paid app.
     *
     * So two rules, both held here rather than remembered:
     *
     *   A photograph without a rights_url does not ship. Every one of these is
     *   Creative Commons, and CC BY and CC BY-SA both require the photographer
     *   be named wherever the picture appears — so a row that cannot say who
     *   took it is a row we cannot legally show.
     *
     *   A slug must name gear this app actually has. That is the check that
     *   catches the wrong-gear failure from the other end: a photograph filed
     *   under a name no model carries is one nobody thought about, and six of
     *   the second batch were exactly that.
     */
    const csv = read('public/gear/sources.csv').trim().split(/\r?\n/)
    const cols = csv[0].split(',')
    for (const want of ['slug', 'source_url', 'rights_url', 'copyright_holder', 'licence']) {
      assert.ok(cols.includes(want), `sources.csv no longer records ${want}`)
    }
    /* Quote-aware, as the generator is: six Commons file names carry a comma,
       and a plain split once moved the photographer's name into the licence
       column for every one of them — the credit under the picture read
       "_Recording_Fischer · _Compound_Recordings". */
    const rows = csv.slice(1).filter(Boolean).map((line) => {
      const v = line.match(/("([^"]|"")*"|[^,]*)(,|$)/g).map((c) => c.replace(/,$/, '').replace(/^"|"$/g, '').replace(/""/g, '"'))
      return Object.fromEntries(cols.map((c, i) => [c, (v[i] ?? '').trim()]))
    })
    assert.ok(rows.length > 0, 'there are no gear photographs at all')

    for (const r of rows) {
      assert.ok(r.rights_url, `${r.slug}: no rights_url, so nothing says why we may use it`)
      assert.ok(r.copyright_holder, `${r.slug}: nobody is named as the photographer`)
      /*
       * Retailers, forums and image searches are never a source. This is the
       * substance of the cull rather than a list of hostnames for its own
       * sake: those photographs belong to somebody who has not licensed them
       * to anybody, whatever the page they sit on implies.
       */
      const src = `${r.source_url} ${r.rights_url}`.toLowerCase()
      for (const never of ['thomann', 'andertons', 'sweetwater', 'guitarcenter', 'reverb.com', 'ebay.', 'google.com/imgres', 'pinterest']) {
        assert.ok(!src.includes(never), `${r.slug}: sourced from ${never}, which has not licensed it to us`)
      }
    }

    /* Every slug reaches real gear, by the same family rule the app matches
       with — a photograph filed under a name nothing carries is invisible, and
       invisible is how a wrong one survives review. */
    const slugify = (n) =>
      String(n)
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
    const names = []
    for (const f of ['src/data/amp-types.json', 'src/data/cab-types.json', 'src/data/drive-types.json']) {
      for (const m of JSON.parse(read(f))) names.push(slugify(m.name))
    }
    for (const r of rows) {
      assert.ok(
        names.some((n) => n === r.slug || n.startsWith(`${r.slug}-`)),
        `${r.slug}: names no model in the catalog, so this photograph can never appear`
      )
    }

    /* And the generated copy the app imports agrees with the record. A photo
       list that drifts from the licence list is one showing pictures whose
       terms nobody checked. */
    const photos = JSON.parse(read('src/data/gear-photos.json'))
    assert.deepEqual(
      Object.keys(photos).sort(),
      rows.map((r) => r.slug).sort(),
      'src/data/gear-photos.json is stale — run `npm run gear:photos`'
    )
    for (const r of rows) {
      /* The licence is a licence and the holder a name, never a fragment of a
         file name pushed sideways by a comma. */
      assert.match(r.licence, /^(CC|Public domain|Public Domain Mark|Original illustration)/i, `${r.slug}: "${r.licence}" is not a licence — a field has shifted`)
      assert.equal(r.is_illustration === 'yes', r.licence === 'Original illustration', `${r.slug}: is_illustration and the licence disagree`)
    }
    for (const [slug, p] of Object.entries(photos)) {
      assert.ok(p.holder && p.rights, `${slug}: the generated entry lost its attribution`)
      assert.ok(existsSync(new URL(`../public/gear/${p.file}`, import.meta.url)), `${slug}: names a file that is not there`)
    }

    /*
     * AND THE CREDIT CANNOT BE RENDERED WITHOUT THE PICTURE OR THE OTHER WAY
     * ROUND. photoFor hands back both in one object precisely so there is no
     * shape of this that draws an image with no attribution; this holds the
     * screen to using it that way.
     */
    const { photoFor, photoSlug } = await import('../src/lib/gearPhotos.js')
    const one = photoFor('1959SLP Treble')
    assert.ok(one?.src && one?.credit && one?.rights, 'photoFor no longer returns the credit with the picture')
    /* A name no model carries gets nothing, never a near miss. */
    assert.equal(photoFor('Not An Amp At All'), null, 'a name with no picture is being given one')
    /*
     * "Make sure that we're not missing any more photos for the app now."
     * Since 1.86.50 every amp, cab and drive in the catalog has a picture, a
     * photograph or a drawing marked as one. A model added without one fails
     * here, by name, rather than going quietly blank on the gear card.
     */
    /*
     * WITH ONE GAP, ON PURPOSE (18 October 2026): Fractal Audio's own models.
     * 34 of their drawings wore a FRACTAL AUDIO badge like a maker's, and
     * Fractal's letter asks for no logos or artwork of theirs, so they were
     * taken out, with FAS Buttery's (a Budda amp under a Fractal original's
     * name), and those 35 models show their words alone. The list is exact
     * both ways: a model that loses its picture by accident still fails here,
     * and so does one of these if a drawing of it comes back.
     */
    const bare = []
    for (const f of ['src/data/amp-types.json', 'src/data/cab-types.json', 'src/data/drive-types.json']) {
      for (const m of JSON.parse(read(f))) if (!photoFor(m.name)) bare.push(m.name)
    }
    const { FRACTAL_ORIGINALS } = await import('./independent.mjs')
    assert.deepEqual(
      [...new Set(bare.map(photoSlug))].sort(),
      [...FRACTAL_ORIGINALS].sort(),
      `these models have no picture: ${bare.join(', ')}`
    )
    /* A drawing says it is a drawing, and still names who it is from. */
    const drawn = photoFor('Bludojai Clean')
    assert.ok(drawn?.illustration && /^Illustration · /.test(drawn.credit), 'a drawing is being shown as if it were a photograph')
    assert.equal(photoFor(''), null)
    assert.equal(photoFor(), null, 'photoFor throws rather than answering for a missing name')

    const console_ = read('src/components/Console.jsx')
    assert.match(console_, /chosenPhoto\.src/, 'the screen never shows a photograph')
    assert.match(console_, /chosenPhoto\.credit/, 'the screen shows a photograph without naming the photographer')
  })

  test('the one-paste installers are gone, and stay gone', async () => {
    /*
     * "I think that we should just drop the helpers completely. Nobody wants
     * to deal with that kind of stuff in order for it to work."
     *
     * WHAT THIS GUARDS IS A GOOD IDEA THAT WAS NEVER A ROUTE. Two scripts in
     * `public/` let somebody paste one line into a shell and have the device
     * server built from source — which reads like the expert's shortcut, and
     * was in fact the opposite. They fetched three private repositories, so
     * the first `git fetch` failed for everybody on earth without a token,
     * and the printed steps had to say "ask Justin for one" out loud.
     *
     * A route whose opening instruction is to email the author costs a reader
     * their time before it admits it cannot help them. The three apps carry
     * the same server inside them, vendored at build time, and cover every
     * computer this runs on — so the download IS the tokenless version, and
     * there is nothing here to go back and finish.
     *
     * The files, the routes and the commands go together. Leaving any one of
     * them is how a dead end gets rebuilt by somebody reading the leftovers
     * as a plan.
     */
    for (const gone of ['public/mac.sh', 'public/windows.ps1']) {
      assert.ok(!existsSync(new URL(`../${gone}`, import.meta.url)), `${gone} is back`)
    }

    const src = read('shared/ways-in.mjs').replace(/\/\*[\s\S]*?\*\//g, ' ')
    for (const word of ['HELPER_SH', 'HELPER_PS1', 'mac.sh', 'windows.ps1']) {
      assert.ok(!src.includes(word), `ways-in.mjs still names ${word}`)
    }

    /*
     * AND NOTHING ASKS A STRANGER FOR A TOKEN. This is the substance of it
     * rather than the filenames: whatever routes exist, none may open by
     * requiring a credential only the author can hand out.
     *
     * Read off the routes rather than out of the file, because the paragraph
     * above explains the token in order to say why it is gone — and a search
     * of the source finds that explanation and calls it the crime. The same
     * trap comments have sprung here before; this reads the data instead.
     */
    const { WAYS } = await import('../shared/ways-in.mjs')
    const words = WAYS.flatMap((w) => [w.title, w.note, ...(w.steps || [])]).join(' ')
    assert.ok(
      !/FORGEFX_TOKEN|ask Justin|GitHub token/i.test(words),
      'a connect route asks for a token again, which is a wall rather than a route'
    )
  })


  test('a JS change can reach a phone without spending a build', () => {
    /*
     * THERE WAS NO WAY TO DO THIS AT ALL, which is the gap this closes.
     * mobile.yml could build and submit and nothing else, so every JavaScript
     * change since the last build — the debug log, the feedback forms, the
     * connect screen, the fixes guide — sat in main with no route onto a
     * handset short of spending one of a handful of iOS build slots.
     *
     * `eas update` costs nothing and is safe in a way a build is not, because
     * app.json pins runtimeVersion to the `fingerprint` policy: Expo hashes
     * everything native and an update only reaches a build whose hash matches.
     * A native change moves the hash and older builds never see the update
     * rather than downloading something they cannot run.
     */
    const wf = read('.github/workflows/mobile.yml')
    assert.match(wf, /\n {2}update:\n/, 'there is no way to publish an update')

    /* The fingerprint policy is what makes the above true. If it ever became
       appVersion or a literal, an update could land on a build whose native
       side does not match it. */
    const appJson = JSON.parse(read('mobile/app.json')).expo
    assert.equal(
      appJson.runtimeVersion?.policy,
      'fingerprint',
      'the runtime version is no longer a fingerprint, so an update could reach a build it does not fit'
    )

    /*
     * AND TICKING "UPDATE" MUST NOT ALSO START A BUILD. The two jobs run off
     * the same dispatch, and a workflow that quietly did both would spend the
     * thing this exists to avoid spending — on a repository where iOS build
     * slots are counted in single figures per month.
     */
    const jobIf = (name) => {
      const at = wf.indexOf(`\n  ${name}:\n`)
      assert.notEqual(at, -1, `the ${name} job is gone`)
      const line = wf.slice(at).match(/\n {4}if: (.+)/)
      return line ? line[1] : ''
    }
    assert.match(jobIf('build'), /!inputs\.update/, 'ticking update would also start a build')
    assert.match(jobIf('update'), /inputs\.update/, 'the update job is not gated on the update input')

    /*
     * And it proves the generated copies are current before publishing.
     * mobile/src/lib is generated from shared/ at the repository root, and an
     * update carrying a stale copy is exactly the drift sync:rules exists to
     * prevent — published straight onto a phone, where it is hardest to see.
     */
    const job = wf.slice(wf.indexOf('\n  update:\n'))
    assert.match(job, /npm run sync:rules/, 'the update job does not regenerate the shared copies')
    assert.match(job, /git diff --exit-code/, 'the update job would publish a stale generated copy')

    /* Both channels by default: which one an installed app listens to depends
       on the profile it was built with, and nobody should have to remember. */
    assert.match(wf, /default: both/, 'the update no longer goes to both channels by default')
    for (const channel of ['production', 'preview']) {
      assert.ok(job.includes(channel), `the update job never mentions the ${channel} channel`)
    }

    /*
     * AND IT HAPPENS BY ITSELF, which is the half that was missing. The job
     * existed and was gated on somebody opening this workflow and ticking a
     * box. Nobody ever did, so a handset sat on the version it was installed
     * at while thirty changes went past it — "The android app is still on
     * 3.171. It's supposed to be doing updates, right?"
     */
    assert.match(job, /github\.event_name == 'push'/, 'an update is published only when somebody remembers to ask')
    assert.match(wf, /\n {2}push:\n {4}branches: \[main\]/, 'nothing lands on main to publish from')
    assert.match(job, /needs: check/, 'a bundle that does not build could be published to a phone')

    /*
     * AND A PUSH CAN NEVER START A BUILD. This is the one that costs money if
     * it is ever wrong: main is pushed several times a day, iOS build slots
     * are counted in single figures a month, and the whole reason this
     * workflow was dispatch-only was to keep those two facts apart. The
     * update job now fires on a push, so the gate on the build job is no
     * longer a formality — it is the only thing standing between a merge and
     * a spent slot.
     */
    assert.match(
      jobIf('build'),
      /github\.event_name == 'workflow_dispatch'/,
      'a push to main can now start an iOS build, which is a build slot per merge'
    )
  })

  test('the Mac app is published when main moves, and never from a pull request', () => {
    /*
     * "When you make an update on phone versions, they need to make it on the
     * web version and Mac app as well, which I think that those are running
     * the same web app versions anyways."
     *
     * SAME CODE, NOT THE SAME COPY. The browser gets the new bundle from
     * Vercel the moment main moves. The Mac app serves `dist/` from INSIDE
     * the packaged app — `process.resourcesPath/dist` in desktop/main.js — so
     * it carries whatever web app it was built with, and nothing reaches that
     * machine until a new one is published.
     *
     * Nobody had published one. This built on pull requests and on a
     * `desktop-v*` tag, and published only from a tag or a ticked box, so the
     * last release went out at 7.372.0 while the browser and the phone moved
     * on without it. electron-updater was working the whole time and had
     * nothing to find.
     */
    const wf = read('.github/workflows/desktop.yml')
    assert.match(wf, /\n {2}push:\n {4}branches: \[main\]/, 'the desktop app is no longer built when something lands on main')
    assert.match(wf, /tags: \['desktop-v\*'\]/, 'the release tag no longer builds anything')

    /*
     * EVERY PUBLISH GATE AGREES. There are four — the Mac's signed package,
     * Windows signed and unsigned, and Linux — and a release is assembled from
     * all of them. One left behind does not publish a smaller release; it
     * publishes one missing the platform somebody is on.
     */
    const gates = [...wf.matchAll(/PUBLISH: >-\n([\s\S]*?)\n\s+(?:GH_TOKEN|run:)/g)].map((m) =>
      m[1].replace(/\s+/g, ' ').trim()
    )
    assert.equal(gates.length, 4, `expected four publish gates, found ${gates.length}`)
    for (const gate of gates) {
      assert.ok(
        gate.includes("github.event_name == 'push'") && gate.includes("github.ref == 'refs/heads/main'"),
        `a publish gate does not fire when main moves: ${gate}`
      )
    }

    /*
     * AND NONE OF THEM CAN FIRE FROM A PULL REQUEST. This is the one that
     * costs something if it is ever wrong: `createRelease` does not send a
     * commit to tag, so GitHub tags the default branch's head — a release
     * published from a branch would carry main's name and somebody else's
     * code, and electron-updater would hand it to every Mac on launch.
     *
     * The guard is allowed to be on the step or inside the expression; what
     * is held is that one of them is there.
     */
    const steps = wf.split(/\n      - name: /).slice(1)
    let checked = 0
    for (const step of steps) {
      if (!step.includes('PUBLISH: >-')) continue
      checked++
      const body = step.replace(/\s+/g, ' ')
      assert.ok(
        body.includes("github.event_name != 'pull_request'"),
        `a step publishes without ruling out a pull request: ${body.slice(0, 60)}`
      )
    }
    assert.equal(checked, 4, `expected four publishing steps, checked ${checked}`)
  })

  test('the APK carries only the processor a phone actually has', () => {
    /*
     * "It keeps hanging when it says it's all the way downloaded."
     *
     * 99.6 MB, and a phone browser giving up at the last step of it. Opened
     * up, the APK carried FOUR copies of every native library, one per
     * processor the Android toolchain knows about:
     *
     *   lib/x86           22.7 MB   emulators on a desktop, never a phone
     *   lib/x86_64        21.9 MB   the same
     *   lib/armeabi-v7a   14.0 MB   32-bit ARM, gone from phones years ago
     *   lib/arm64-v8a     20.5 MB   every Android phone made this decade
     *
     * Nearly 59 MB of the download was code the handset it was aimed at could
     * never load — and not this app's own code either: the largest single file
     * in the x86 pile is Google's barcode scanner, shipped prebuilt for all
     * four and packaged for all four.
     *
     * `reactNativeArchitectures` is the lever rather than anything hand-rolled:
     * React Native's gradle plugin turns it into AGP's `ndk.abiFilters`, which
     * filters every native library packaged into the APK, the ones arriving
     * inside third-party AARs included. That last part is what makes it worth
     * more than it looks.
     */
    const apk = read('.github/workflows/apk.yml')
    const at = apk.indexOf('reactNativeArchitectures=arm64-v8a')
    assert.notEqual(
      at,
      -1,
      'the APK is built for all four processors again — half of it is then native code no phone can run'
    )

    /*
     * After prebuild writes the file, and before the build reads it.
     *
     * Anchored on the COMMAND rather than the words: three comments in this
     * workflow mention `expo prebuild` and the first of them is at the top of
     * the file, so an order checked against the phrase is an order that can
     * never be wrong. See CLAUDE.md — the same trap, in a different file.
     */
    const prebuild = apk.indexOf('run: npx expo prebuild')
    const build = apk.indexOf('./gradlew assembleRelease')
    assert.notEqual(prebuild, -1, 'nothing generates the native project any more')
    assert.ok(prebuild < at, 'the architectures are pinned before prebuild, which then writes all four back')
    assert.ok(at < build, 'the architectures are pinned after the build has already read them')

    /*
     * And not in app.json, for the same reason as the memory settings and the
     * updates config: that file is hashed into the runtime fingerprint, and
     * moving that number cuts off every installed copy of the app from the
     * updates this exists to deliver.
     */
    const config = JSON.parse(read('mobile/app.json'))
    assert.ok(
      !JSON.stringify(config).includes('abiFilters'),
      'the architectures moved into app.json, which moves the fingerprint and cuts off every installed copy'
    )

    /* Somebody with an older handset gets told why rather than left with
       Android's own "App not installed" and nothing else. */
    assert.match(
      read('public/android.html'),
      /64-bit Android/,
      'the download page does not say which phones this build is for'
    )
  })

  test('the APK asks for the updates that are actually published', () => {
    /*
     * "The Android app is still on 7.391.0."
     *
     * NOT ONE APK THIS WORKFLOW HAS EVER PRODUCED COULD TAKE AN UPDATE —
     * including the ones built after the step beside this one was added to
     * make exactly that work. That step writes the runtime version into
     * `assets/fingerprint`, correctly. Then gradle overwrites it.
     *
     * `expo-updates` writes that asset itself during the build, in
     * createFingerprintForBuildAsync, and it RECOMPUTES the fingerprint
     * rather than reading the one already sitting there. What it computes is
     * different, for a reason that is its own doing: the fingerprint hashes
     * `node_modules/expo-updates/expo-updates-gradle-plugin`, and by the time
     * gradle asks, gradle has compiled that plugin and left its build output
     * inside that directory. Building the app changes the number that
     * identifies the app.
     *
     *   published updates ask for   826b1b536206f9405d315fdfa1761986b60ade12
     *   the 7.391.0 APK answered    35dd3dda164fc94d542d3d170cca62078137936b
     *   the next APK answered       b39d9d5a517bb773d5350ba31508878a1fd68059
     *
     * A phone whose runtime version matches nothing is handed nothing, for
     * ever, and is told nothing about it — which is the entire reason a
     * handset sat on the version it was installed at while thirty changes
     * went past it.
     *
     * The same function checks EXPO_UPDATES_FINGERPRINT_OVERRIDE first and
     * skips the recompute, so that is what it is given, out of the same file
     * `eas update` publishes under.
     */
    const apk = read('.github/workflows/apk.yml')

    assert.match(
      apk,
      /EXPO_UPDATES_FINGERPRINT_OVERRIDE: \$\{\{ steps\.fp\.outputs\.hash \}\}/,
      'the build recomputes the runtime version again, and gets one no published update is addressed to'
    )

    /* And that value is the published one rather than a second opinion. */
    const fp = apk.slice(apk.indexOf('id: fp'), apk.indexOf('\n      - name:', apk.indexOf('id: fp')))
    assert.match(fp, /fingerprint\.json/, 'the override is not the hash updates are published under')
    assert.match(fp, /echo "hash=\$hash" >> "\$GITHUB_OUTPUT"/, 'nothing hands the hash to the build step')

    /*
     * AND IT IS READ BACK OUT OF THE FINISHED APK. This failed silently for
     * every build there has ever been; the only honest guard is opening the
     * artefact and asking it, which is what a phone does.
     */
    const at = apk.indexOf('The APK asks for the updates that exist')
    assert.notEqual(at, -1, 'nothing checks the APK can take an update, which is how this went unnoticed for thirty versions')
    const step = apk.slice(at, apk.indexOf('\n      - name:', at))
    assert.match(step, /unzip -p .*assets\/fingerprint/, 'the check does not read the runtime version out of the APK itself')
    assert.match(step, /exit 1/, 'a mismatch is reported and the build goes green anyway')
  })

  test('an APK is built able to take the updates that are published', () => {
    /*
     * "The android app is still on 3.171. It's supposed to be doing updates,
     * right? For small changes without having to do any build?"
     *
     * It was, and it could not, and nothing anywhere said so. The app asked
     * Expo for an update every launch and was never going to be handed one,
     * because `expo prebuild` writes the updates URL and stops — the rest is
     * normally EAS Build's job, and this APK is built by gradle on an
     * ordinary runner precisely so it costs nothing.
     *
     * TWO PIECES WERE MISSING FROM EVERY APK THIS HAS EVER PRODUCED.
     *
     *   The runtime version. `runtimeVersion.policy` is `fingerprint`, which
     *   prebuild renders as the literal `file:fingerprint` — a sentinel
     *   telling expo-updates to read the real hash out of an asset called
     *   `fingerprint`. Nothing in a bare gradle build writes that asset, the
     *   read threw, and the whole updates configuration was invalid.
     *
     *   The channel. An update is published to a branch and an app says which
     *   branch it wants with an `expo-channel-name` header. EAS injects it
     *   from eas.json. A sideloaded APK had none, so even a correct
     *   fingerprint would have asked a question with no answer.
     *
     * Neither belongs in app.json: that file is hashed into the fingerprint,
     * so putting them there would move the number and cut off every installed
     * copy in order to fix the thing that stops installed copies being cut
     * off.
     */
    const apk = read('.github/workflows/apk.yml')
    const at = apk.indexOf('Make it able to take updates')
    assert.notEqual(at, -1, 'the APK is built unable to take an update again')
    const step = apk.slice(at, apk.indexOf('\n      - name:', at + 1))

    assert.match(step, /fingerprint\.json/, 'the runtime version is not the one updates are published under')
    assert.match(
      step,
      /printf '%s' "\$hash" > android\/app\/src\/main\/assets\/fingerprint/,
      'the fingerprint asset is written with a trailing newline, which is a different string from the one published'
    )
    assert.match(step, /expo-channel-name/, 'the APK asks for an update without saying which branch')
    assert.match(step, /preview/, 'the channel is not the one a directly-installed build is on')

    /*
     * Written after prebuild, or prebuild overwrites both of them.
     *
     * Against the COMMAND. This read `indexOf('expo prebuild')`, and the
     * first of the three mentions of that phrase is a comment at the top of
     * the file — so the assertion was true whatever the order, and had never
     * been able to fail.
     */
    assert.ok(
      apk.indexOf('run: npx expo prebuild') < at,
      'the updates config is written before prebuild, which then overwrites it'
    )
  })

  test('the unit is asked what firmware it is running, at both ends', async () => {
    /*
     * "I have another app I'm building called axiom... it definitely pulls the
     * firmware version so I'm not sure why you can't do it. It's basically the
     * same app."
     *
     * It was right, and what this app had written down was wrong. There was no
     * firmware anywhere on any screen, and the reason given was that nothing
     * this talks to carries one — an assumption that had never been checked,
     * stated as a fact about the protocol.
     *
     * The host carries it. This end was asking `/device/detect`, which answers
     * with the capabilities rather than the whole unit, and stopping there.
     * The other app asks `/device` as well and merges the two, which is all
     * that was ever between this app and a firmware version.
     *
     * BEST-EFFORT ON PURPOSE. The capabilities decide what every screen is
     * allowed to draw and are already in hand by then; the firmware is one
     * line on a Setup page. A host too old to answer the second question must
     * cost that line and never the connection, so the failure is swallowed and
     * the unit still detects.
     */
    for (const [where, file] of [
      ['the browser', 'src/lib/forgefx.js'],
      ['the phone', 'mobile/src/lib/device.js']
    ]) {
      const code = read(file).replace(/\s+/g, ' ')
      assert.match(code, /\/device\/detect/, `${where} no longer detects the unit at all`)
      /* The browser calls it `request` and the phone `remoteRequest`, so the
         match is on the path with a call bracket in front of it rather than on
         either name. */
      assert.match(code, /equest\('\/device'\)/, `${where} asks only for the capabilities, so it can never see a firmware version`)
      assert.match(code, /firmwareOf\(/, `${where} reads the firmware field raw rather than through the shared reader`)
      assert.match(code, /\} catch \{ return res \}/, `${where} would fail to detect a unit because the firmware read failed`)
    }

    /*
     * And the detect payload wins on anything both endpoints answer. `/device`
     * is the looser of the two and a second opinion about the grid is the kind
     * of drift that shows up as a chain drawn one row short.
     */
    const web = read('src/lib/forgefx.js').replace(/\s+/g, ' ')
    assert.match(web, /\{ \.\.\.whole, \.\.\.res, firmware:/, 'the looser payload now overrides the capabilities every screen is built from')

    /*
     * NOTHING IS INVENTED FOR A UNIT THAT DID NOT SAY. A simulated unit has no
     * firmware, a host too old to report one has nothing to report, and a host
     * that answers with a dash is saying it does not know. All three are the
     * same answer and all three draw nothing — a version number under a
     * simulated FM3 would be the confident wrong fact this project refuses
     * everywhere else.
     */
    const { firmwareOf } = await import('../shared/firmware.mjs')
    assert.equal(firmwareOf({ firmware: '27.01' }), '27.01')
    assert.equal(firmwareOf({ firmware: { version: '27.01' } }), '27.01', 'an object-shaped version is not read')
    assert.equal(firmwareOf({ fw: '8.02' }), '8.02', 'the short spelling is not read')
    for (const nothing of [{}, null, undefined, { firmware: '' }, { firmware: '—' }, { firmware: 'unknown' }]) {
      assert.equal(firmwareOf(nothing), null, `${JSON.stringify(nothing)} is being drawn as a firmware version`)
    }

    /* The demo says nothing, because a simulation has no firmware to report.
       Asked of the mock rather than grepped out of its source: the file
       mentions the word in a comment about stored preset names, and a test
       that reads comments is a test that fails on prose. */
    const { createMockDevice } = await import('../src/lib/mockDevice.js')
    for (const unit of ['fm3', 'am4', 'vp4']) {
      assert.equal(
        firmwareOf(createMockDevice(unit).detect()),
        null,
        `the demo invents a firmware version for a simulated ${unit}`
      )
    }

    /* And both screens draw it only when there is one. */
    /* Either bracket: the browser's fits on one line and opens a tag, the
       phone's wraps and opens a paren. What is held is the guard. */
    assert.match(read('src/components/DeviceDetail.jsx'), /\{firmware \? [(<]/, 'the browser draws a firmware line for a unit that never reported one')
    /* The phone's firmware is on the unit's card now, worded in
       shared/link-chain.mjs, which prints it only when the unit said one. */
    assert.match(read('mobile/src/screens/Settings.js'), /unit: \{[^}]*firmware,/, 'the phone no longer hands the unit card its firmware')
    assert.match(read('shared/link-chain.mjs'), /unit\.firmware \? `firmware \$\{unit\.firmware\}` : null/, 'the phone draws a firmware line for a unit that never reported one')
  })

  test('the phone icon is one Apple will accept, and the others keep their alpha', () => {
    /*
     * "The app icon can't contain alpha channels or transparencies" is an
     * automated rejection: it happens before a human opens the build, and it
     * costs a submission round trip to learn.
     *
     * The artwork is a rounded square filled #0d0f12, so only its four corners
     * were clear — enough to fail. It is rendered opaque for iOS now, which is
     * right because iOS applies its own corner mask to a full square anyway.
     *
     * THE OTHER THREE MUST KEEP THEIR TRANSPARENCY, which is why this is not
     * simply "no alpha anywhere". Android's adaptive icon is a foreground
     * layer the system masks itself, so filling its corners would put a dark
     * square inside Android's circle. The splash mark sits on the splash
     * colour. macOS does not mask app icons at all and wants the rounded
     * shape.
     */
    const png = (p) => readFileSync(new URL(`../${p}`, import.meta.url))
    const head = (b) => ({
      width: b.readUInt32BE(16),
      height: b.readUInt32BE(20),
      /* IHDR colour type: 4 and 6 carry an alpha channel, 0/2/3 do not. */
      alpha: b[25] === 4 || b[25] === 6
    })

    const ios = head(png('mobile/assets/icon.png'))
    assert.equal(ios.width, 1024, 'the iOS icon is not 1024 wide')
    assert.equal(ios.height, 1024, 'the iOS icon is not 1024 tall')
    assert.equal(ios.alpha, false, 'the iOS app icon has an alpha channel, which Apple rejects outright')

    for (const rel of ['mobile/assets/adaptive-icon.png', 'mobile/assets/splash-icon.png']) {
      assert.equal(head(png(rel)).alpha, true, `${rel} lost its transparency, which it needs`)
    }

    /* And the generator says which is which, so a regeneration cannot quietly
       put the alpha back. */
    const gen = read('scripts/icon.mjs')
    assert.match(gen, /opaque: true/, 'the icon script no longer renders any output opaque')
    assert.match(gen, /omitBackground: !out\.opaque/, 'the icon script ignores its own opaque flag')
  })

  /**
   * A DOWNLOAD PAGE, BECAUSE A RELEASES PAGE IS NOT ONE.
   *
   * "Right now it's just taking users to GitHub, which can be kind of
   * confusing to a lot of people I feel."
   *
   * A release carries twenty files. Two disk images, two zips, two AppImages,
   * two .deb packages, an .exe, four .yml and a pile of .blockmaps — and four
   * of those are the UPDATER's, which would do nothing at all if a person
   * downloaded one. Exactly one file is the one they want and nothing on that
   * page says which.
   */
  test('the download page offers one file, not twenty', () => {
    const page = read('public/downloads.html')

    /* Only the computer builds. The Android ones share the same list under
       apk-v, and GitHub's own /releases/latest hands back whichever of the
       two was published last. */
    assert.match(page, /\/\^v\\d\/\.test\(String\(r\.tag_name\)\)/, 'the page does not separate computer builds from Android ones')

    /* Newest by CLOCK, not by number — the same trap the Android page fell
       into. 1.0.1 loses to 7.397.0 on the number for ever. */
    assert.match(page, /when\(b\) - when\(a\)/, 'the page picks the highest version number, which the renumber broke')
    assert.match(page, /Date\.parse\(r\.published_at/, 'the newest build is not decided by when it was published')

    /* Both Macs, because the user agent cannot tell them apart and a wrong
       guess is a download that will not open. */
    assert.match(page, /-arm64\\\.dmg\$/, 'no Apple Silicon build is offered')
    assert.match(page, /About This Mac/, 'nothing tells somebody how to find out which Mac they have')

    /* And never a file that is not a program. A .blockmap or a latest.yml is
       for the updater and is a dead end in a person's downloads folder. */
    for (const dead of ['blockmap', 'latest-mac', 'latest.yml']) {
      assert.ok(
        !new RegExp(`href[^\n]*${dead}`).test(page),
        `the page offers ${dead}, which is for the updater and does nothing on its own`
      )
    }

    /* Routed before the catch-all, or /downloads is swallowed by the app. */
    const vercel = JSON.parse(read('vercel.json'))
    const paths = vercel.rewrites.map((r) => r.source)
    assert.ok(paths.includes('/downloads'), '/downloads is not routed')
    assert.ok(
      paths.indexOf('/downloads') < paths.indexOf('/(.*)'),
      '/downloads sits after the catch-all, so it never reaches the page'
    )

    /*
     * AND THE THREE PAGES A STORE ASKS FOR BY ADDRESS.
     *
     * Vercel checks the filesystem before these rewrites, so /support.html
     * has always worked and /support never has — it fell to the catch-all and
     * served the app. That is fine for a page nobody types, and not fine for
     * the Support URL on an App Store listing, which is exactly the kind of
     * address a reviewer pastes in.
     */
    for (const page of ['/support', '/privacy', '/notices']) {
      assert.ok(paths.includes(page), `${page} is not routed, so it serves the app instead`)
      assert.ok(
        paths.indexOf(page) < paths.indexOf('/(.*)'),
        `${page} sits after the catch-all, so it never reaches the page`
      )
    }
    /* Each one has to point at a file that is actually there. */
    for (const { source, destination } of vercel.rewrites) {
      if (source === '/(.*)') continue
      assert.ok(
        existsSync(new URL(`../public${destination}`, import.meta.url)),
        `${source} is routed to ${destination}, which does not exist in public/`
      )
    }
  })

  /*
   * A RASPBERRY PI IS OFFERED ITS OWN FILE, AND A PC NEVER IS.
   *
   * A customer on a Pi 3 took the page's only Linux button, the PC AppImage.
   * A Pi cannot run it: the file manager handed it to the shell, and an empty,
   * oddly named file appeared next to it. The Pi build was there all along,
   * behind a link to the releases page.
   *
   * The user agent cannot tell the two apart — Chromium and Firefox both say
   * "X11; Linux x86_64" on every Linux computer — so the Pi pair is on the
   * card for everybody, and only Chromium's own answer moves it to the top.
   *
   * And that answer is only half an answer. Chromium's "64" or "32" is the
   * KERNEL's, read off uname, and a Pi 4, 400, 5 or CM4 starts a 64-bit
   * kernel even under the 32-bit Raspberry Pi OS. So "32" is firm and "64"
   * is not: a "64" Pi still gets the dpkg check, above its button.
   */
  test('the download page offers a Raspberry Pi the file it can run', async () => {
    const page = read('public/downloads.html')
    const code = page.slice(page.lastIndexOf('<script>'))

    /* Always offered, through the same button as every other file. */
    assert.match(code, /find\(a, function \(n\) \{ return \/-arm64\\\.AppImage\$\/i\.test\(n\) \}\)/, 'the Raspberry Pi AppImage is not looked for')
    assert.match(code, /find\(a, function \(n\) \{ return \/_arm64\\\.deb\$\/i\.test\(n\) \}\)/, 'the Raspberry Pi .deb is not looked for')
    assert.match(code, /button\(linuxArm, [^\n]{0,40}'Raspberry Pi and other ARM &mdash; AppImage'/, 'the Pi AppImage has no button, or not a labelled one')
    assert.match(code, /button\(debArm, [^\n]{0,40}'Raspberry Pi and other ARM/, 'the Pi .deb has no button, or not a labelled one')
    /* Both orders carry both pairs: the guess moves them, never removes one. */
    assert.match(code, /arch \? pi \+ pc : pc \+ pi/, 'one of the two orders leaves a pair out')

    /* The PC files refuse anything named arm, not only arm64, so a future
       ARM file can never be offered to a PC under the PC's label. */
    assert.match(code, /var linux = find\(a, function \(n\) \{ return \/\\\.AppImage\$\/i\.test\(n\) && !\/arm\/i\.test\(n\) \}\)/, 'the PC AppImage could be an ARM file')
    assert.match(code, /var deb = find\(a, function \(n\) \{ return \/_amd64\\\.deb\$\/i\.test\(n\) && !\/arm\/i\.test\(n\) \}\)/, 'the PC .deb could be an ARM file')

    /* Asked of the browser inside a try, so a browser that refuses, or has
       no answer, leaves the page drawn as it was. */
    const guess = code.slice(code.indexOf('function armGuess()'), code.indexOf('function find('))
    assert.ok(guess.length > 100, 'armGuess moved; this check reads it')
    const ask = guess.indexOf("getHighEntropyValues(['architecture', 'bitness'])")
    assert.ok(ask > -1, 'the page does not ask the browser for its processor and bitness')
    assert.ok(guess.indexOf('try {') > -1 && guess.indexOf('try {') < ask && guess.indexOf('catch') > ask, 'the question is not inside a try')
    assert.match(guess, /\.catch\(function \(\) \{\s*return null/, 'a refusal from the browser is not caught')
    /* And the page is drawn before the answer, then re-drawn, only on Linux. */
    assert.ok(
      code.indexOf("innerHTML = order") < code.indexOf('armGuess().then'),
      'the page waits for the browser before drawing anything'
    )
    assert.match(code, /if \(me === 'linux'\) \{\s*armGuess\(\)\.then/, 'the guess is asked off Linux too')
    /* A 32-bit Pi is told what to change, because no file here runs on it. */
    assert.match(code, /arch === 'arm32'[\s\S]{0,200}32-bit Raspberry Pi OS[\s\S]{0,300}Raspberry Pi Imager/, 'a 32-bit Pi is not told it needs the 64-bit Raspberry Pi OS')
    /* Only a "32" is taken as settled. A "64" is a 64-bit kernel, which a
       32-bit Pi 4 or Pi 5 has too, so it is plain ARM, not arm64... */
    assert.match(guess, /return v\.bitness === '32' \? 'arm32' : 'arm'\s/, 'a 64-bit kernel is read as a 64-bit system again')
    /* ...and that Pi is asked to check before the button, not after it. */
    assert.match(code, /var check = lead\s*\?[\s\S]{0,200}dpkg --print-architecture[\s\S]{0,200}armhf/, 'a Pi the browser calls ARM is not asked to check its system')
    assert.match(code, /only32 \+ check \+ \(arch \? pi \+ pc : pc \+ pi\)/, 'the check is not above the Pi buttons')
    /* And with a 32-bit Pi, nothing on the card is the big green button. */
    assert.match(code, /var lead = arch === 'arm'\n/, 'the Pi AppImage leads on a system it cannot run on')
    assert.match(code, /button\(linuxArm, \(lead \? 'Download for ' : ''\) \+ 'Raspberry Pi and other ARM &mdash; AppImage', !lead\)/, 'the Pi AppImage leads on a system it cannot run on')

    /* The steps, and the words a Pi owner needs to check for themselves. */
    /*
     * The .deb's line was "the .deb does not" update itself. Changed on
     * purpose, 12 October 2026: electron-updater 6 has a DebUpdater, the
     * shipped .deb carries resources/package-type=deb and the feed lists the
     * .deb, so it does update, at a clean quit, through pkexec or sudo. What
     * is true is that it may need a password, which is why the AppImage
     * still leads.
     */
    assert.ok(!/the \.deb does not\./.test(code), 'the Linux card says the .deb never updates, and it does, with a password')
    for (const word of ['dpkg --print-architecture', 'arm64', 'armhf', 'libfuse2t64', 'chmod +x', 'keeps itself up to date', 'may ask for your password']) {
      assert.ok(code.includes(word), `the Linux card no longer says ${word}`)
    }
    /* The old hint sent ARM to the releases page, which is what hid it. */
    assert.ok(!/including ARM, are on the/.test(code), 'the Linux card sends a Pi to the releases page again')

    /*
     * AND THE BROWSER'S Connect a computer SAYS THE SAME. Its Linux steps
     * said the AppImage "works on any Linux" and that "a Raspberry Pi
     * works", which is how the wrong file reads as the right one. Read off
     * the data, not the source, because the source explains the old words.
     */
    const { wayById } = await import('../shared/ways-in.mjs')
    const linux = wayById('linux-app')
    const steps = linux.steps.join(' ')
    assert.ok(!/works on any Linux|a Raspberry Pi works/i.test(steps), 'the Linux route promises a Pi more than it can run again')
    for (const word of ['arm64', 'dpkg --print-architecture', 'armhf', '64-bit Raspberry Pi OS', 'libfuse2t64', 'keeps itself up to date', 'may ask for your password', 'dialout']) {
      assert.ok(steps.includes(word), `the Linux route no longer says ${word}`)
    }
    /* Lite on its own has no desktop, and the app opens a window, so the two
       packages are for a trimmed system that has one, on both. */
    for (const [where, words] of [['the download page', code], ['the Linux route', steps]]) {
      assert.ok(words.includes('Raspberry Pi OS Lite with a desktop added'), `${where} tells Lite alone that two packages are all it needs`)
    }
    /*
     * Changed on purpose, 14 October 2026: the Pi guide joins the download
     * page, second. The download page is still the first link, because it is
     * the one that labels the Pi files, and nothing goes to GitHub's list.
     */
    assert.deepEqual(
      linux.links.map((l) => l.url),
      ['https://fractal.newbold.cloud/downloads', 'https://fractal.newbold.cloud/raspberry-pi'],
      'the Linux route goes somewhere other than the download page, which is the one that labels the Pi files, and then the Pi guide'
    )
  })

  /*
   * THE RASPBERRY PI GUIDE ASKS HOW YOU ARE SETTING IT UP, AND SHOWS THAT WAY.
   *
   * "Maybe it would be a good idea to ask them how they're setting it up? And
   * then they click on one and it gives them the specific instructions for
   * that device." (Justin, 14 October 2026.)
   *
   * Four ways — from a Mac, a Windows PC, a Linux computer, or with a
   * keyboard, mouse and screen on the Pi — each complete from the memory card
   * to the gig, with the app's own steps in all four. The page's own script
   * is run here under a small stand-in for the browser, because what it does
   * with the address (#mac, #windows, #linux, #screen) and with Back is the
   * part a reader can't see is wrong until it strands them. And with scripts
   * off, nothing may be hidden.
   */
  test('the Raspberry Pi guide asks how you are setting it up, and every way is complete', async () => {
    const page = read('public/raspberry-pi.html')
    const html = page.replace(/<!--[\s\S]*?-->/g, '')
    const text = (s) =>
      s
        .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
        /* Inline tags join the words around them; the rest are a break. */
        .replace(/<\/?(?:strong|em|a|code|span)\b[^>]*>/g, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&ldquo;|&rdquo;/g, '"')
        .replace(/&mdash;/g, '—')
        .replace(/&amp;/g, '&')
        .replace(/\s+/g, ' ')
        .trim()
    const words = text(html)
    const WAYS = ['mac', 'windows', 'linux', 'screen']
    /* One way's markup: from its section's start tag to its end. */
    const panel = (id) => {
      const at = html.indexOf(`<section class="way" id="${id}"`)
      assert.ok(at > -1, `the guide has no ${id} way`)
      return html.slice(at, html.indexOf('</section>', at))
    }

    /* The site's own page: its title, its header line and its footer. */
    assert.match(page, /<title>Set up a Raspberry Pi — Fractal Remote<\/title>/, 'the guide has lost its title')
    assert.match(html, /<h1>Set up a Raspberry Pi for Fractal Remote<\/h1>/)
    assert.match(words, /Fractal Remote · last updated 14 October 2026/, 'the guide does not say when it was last checked')
    assert.match(page, /<meta name="viewport" content="width=device-width, initial-scale=1" \/>/, 'the guide is not laid out for a phone')
    assert.ok(!/noindex/.test(page), 'the guide asks search engines not to list it, and it is for everybody')
    const { NOT_AFFILIATED, TRADEMARKS } = await import('../shared/affiliation.mjs')
    const foot = text(html.slice(html.indexOf('<footer>'), html.indexOf('</footer>')))
    const flat = (s) => s.replace(/[“”]/g, '"').replace(/\s+/g, ' ')
    assert.ok(flat(foot).includes(flat(NOT_AFFILIATED)), 'the guide’s footer does not say the app is not Fractal Audio’s')
    assert.ok(flat(foot).includes(flat(TRADEMARKS)), 'the guide’s footer does not say whose the unit names are')
    assert.match(foot, /not connected with Raspberry Pi Ltd/, 'the guide does not say the app is not Raspberry Pi’s')
    for (const href of ['https://apps.apple.com/app/id6812916461', '/android', '/support', '/privacy', '/notices']) {
      assert.ok(html.slice(html.indexOf('<footer>')).includes(`href="${href}"`), `the guide’s footer does not link ${href}`)
    }
    /* Light and dark: the site's dark, the app's light, and the app's own choice. */
    assert.match(page, /@media \(prefers-color-scheme: light\)\s*\{\s*:root:not\(\[data-theme="dark"\]\)/, 'the guide does not follow a light system')
    assert.match(page, /:root\[data-theme="light"\]\s*\{/, 'the guide ignores the app’s Light choice')
    assert.match(page, /body \{[^}]*background: var\(--chassis\)/, 'the guide’s page has no background of its own')
    assert.match(page, /\[hidden\] \{ display: none !important; \}/, 'a style can show what the script hid')

    /* Routed without the extension, before the catch-all. */
    const vercel = JSON.parse(read('vercel.json'))
    const at = vercel.rewrites.findIndex((r) => r.source === '/raspberry-pi')
    assert.ok(at !== -1, '/raspberry-pi is not routed, so it serves the web app instead of the guide')
    assert.equal(vercel.rewrites[at].destination, '/raspberry-pi.html')
    assert.ok(at < vercel.rewrites.findIndex((r) => r.source === '/(.*)'), '/raspberry-pi sits after the catch-all, so it never reaches the guide')

    /* Linked from the download page, under the Pi's buttons and in the page itself, and from support. */
    const downloads = read('public/downloads.html')
    const card = downloads.slice(downloads.lastIndexOf('<script>'))
    assert.match(card, /var pi =\s*button\(linuxArm[^\n]*\n\s*button\(debArm[^\n]*\n\s*piGuide/, 'the Pi guide is not under the Pi’s download buttons')
    assert.match(card, /var piGuide =[\s\S]{0,80}New to Raspberry Pi\? <a href="\/raspberry-pi">Step-by-step setup<\/a>/, 'the download card does not offer the Pi guide')
    assert.match(downloads.slice(0, downloads.lastIndexOf('<script>')), /<a href="\/raspberry-pi">Step-by-step setup<\/a>/, 'with GitHub not answering, the download page has no way to the Pi guide')
    const support = read('public/support.html')
    assert.match(support, /<h3>I want a Raspberry Pi on my pedalboard<\/h3>[\s\S]{0,200}href="\/raspberry-pi"/, 'the support page does not send a Pi owner to the guide')
    assert.match(support, /<h2 id="contact">Reaching a person<\/h2>/, 'the guide’s link to the support page’s contact lands nowhere')
    assert.match(html, /href="\/support#contact"/, 'the guide does not say where to send a report')
    assert.match(words, /The Fractal Remote app is new on the Raspberry Pi\./, 'the guide does not say the app is new on the Pi')
    /* Feedback is a row under Troubleshooting, in the computer app and on the phone, not under Settings itself. */
    assert.match(words, /in the app, Settings → Troubleshooting → Feedback, or by email/, 'the guide names a way to Feedback the app does not have')
    assert.ok(!/Settings → Feedback/.test(words), 'the guide sends a report to Settings → Feedback, which is not there')

    /* The question, and its four answers. */
    assert.match(html, /<h3 class="ask" id="how">How are you setting it up\?<\/h3>/, 'the guide does not ask how the Pi is being set up')
    const pickAt = html.indexOf('<div class="pick" id="pick"')
    const pick = html.slice(pickAt, html.indexOf('</div>', pickAt))
    assert.match(pick, /role="group" aria-labelledby="how"/, 'the four buttons are not a group named by the question')
    const NAMES = {
      mac: 'From a Mac',
      windows: 'From a Windows PC',
      linux: 'From a Linux computer',
      screen: 'With a keyboard, mouse and screen on the Pi'
    }
    const buttons = [...pick.matchAll(/<button type="button" data-way="(\w+)" aria-pressed="false" aria-controls="(\w+)">\s*<span class="pick-name">([^<]+)<\/span>/g)]
    assert.deepEqual(buttons.map((b) => b[1]), WAYS, 'the four buttons are not Mac, Windows, Linux and screen, in that order')
    for (const [, way, controls, name] of buttons) {
      assert.equal(controls, way, `the ${way} button controls something else`)
      assert.equal(name, NAMES[way], `the ${way} button says "${name}"`)
      assert.match(panel(way), new RegExp(`<h3 id="${way}-h">${NAMES[way]}</h3>`), `the ${way} way does not open under its own heading`)
    }
    assert.equal((html.match(/data-way="/g) || []).length, 4, 'a button for a way sits outside the four')

    /* Scripts off: every way shows, the buttons and the hint don't, and a line of links jumps to each. */
    assert.match(html, /<div class="pick" id="pick" role="group" aria-labelledby="how" hidden>/, 'with scripts off, four buttons that do nothing are shown')
    assert.match(html, /<p class="pick-hint dim" id="pick-hint" hidden>Pick one to see its steps\.<\/p>/, 'the hint is not there, or shows with scripts off')
    for (const way of WAYS) {
      assert.ok(!/^<section[^>]*\bhidden\b/.test(panel(way)), `with scripts off, the ${way} way is hidden`)
    }
    /*
     * And nothing else hides them. Not one section at a time but the whole
     * page: one hidden attribute on the box the four sit in, a <details>
     * round one, or a rule in the styles hides them as surely as hiding
     * each, with scripts on and off, and the stand-in browser below only
     * sees elements with an id. So: the only things hidden in the markup are
     * the buttons and the hint; the only "display: none" is the rule that
     * keeps the script's hiding hidden; nothing folds, and no style uses
     * another way to make something vanish.
     */
    const bare = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    const hiddenTags = [...bare.matchAll(/<([a-z][a-z0-9]*)\b([^>]*)>/gi)]
      .filter((m) => [...m[2].matchAll(/([a-zA-Z][-a-zA-Z0-9]*)(?:="[^"]*")?/g)].some((a) => a[1].toLowerCase() === 'hidden'))
      .map((m) => m[0])
    assert.deepEqual(
      hiddenTags,
      ['<div class="pick" id="pick" role="group" aria-labelledby="how" hidden>', '<p class="pick-hint dim" id="pick-hint" hidden>'],
      'with scripts off, something besides the buttons and the hint is hidden'
    )
    assert.ok(!/\sstyle="/.test(bare), 'a tag carries its own style, which can hide it with scripts off')
    const css = [...page.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1]).join('\n').replace(/\/\*[\s\S]*?\*\//g, '')
    assert.equal((css.match(/display\s*:\s*none/g) || []).length, 1, 'a style hides something besides what the script hid')
    assert.match(css, /\[hidden\] \{ display: none !important; \}/, 'the one "display: none" is not the rule for what the script hid')
    for (const [what, how] of [['visibility', /visibility\s*:\s*hidden/], ['content-visibility', /content-visibility/], [':target', /:target\b/], ['opacity', /opacity\s*:\s*0(?![.\d])/]]) {
      assert.ok(!how.test(css), `a style uses ${what} to hide something, which scripts off cannot undo`)
    }
    const waysAt = html.indexOf('<div class="ways">')
    assert.ok(waysAt > html.indexOf('</div>', pickAt), 'the four ways sit inside the hidden buttons, so scripts off hides them')
    const waysBox = html.slice(waysAt, html.indexOf('<h2 id="trouble">'))
    /* Anywhere on the page, not only inside the box: a fold round the box from outside folds all four. */
    assert.ok(!/<(?:details|template|dialog|noscript)\b/i.test(bare), 'with scripts off, the ways are folded away or never drawn')
    assert.equal((waysBox.match(/<section class="way" id="/g) || []).length, 4, 'the four ways are not all in the box the question opens')
    const jump = html.slice(html.indexOf('<p class="dim" id="jump">'), html.indexOf('</p>', html.indexOf('id="jump"')))
    for (const way of WAYS) assert.ok(jump.includes(`<a href="#${way}">${NAMES[way]}</a>`), `with scripts off, nothing jumps to the ${way} way`)

    /*
     * Every way complete on its own. The app's steps are in all four, so nobody
     * scrolls past another way to reach them: the same steps, with the few
     * words that differ by way written for that way — which screen the reader
     * is looking at, how he right-clicks, and where the 64-bit system was
     * checked. Each of those is named here for every way, and with them set
     * aside the four copies are word for word the same. So a reader at a TV is
     * never told about screen sharing, nor a PC owner about a Mac's trackpad.
     */
    const APP_HEAD = /<h4>\d\. Put the Fractal Remote app on the Pi<\/h4>\s*<ol>([\s\S]*?)<\/ol>/
    const apps = WAYS.map((way) => panel(way).match(APP_HEAD)?.[1])
    for (const [i, way] of WAYS.entries()) assert.ok(apps[i], `the ${way} way has no steps for the app`)
    /* A link here opens on whatever the reader is reading this on, which is not the Pi. */
    for (const [i, way] of WAYS.entries()) assert.ok(!/href=/.test(apps[i]), `the ${way} way’s app steps link the download page, which then opens on the computer or the phone, not the Pi`)
    const ON_SCREEN_SHARING = {
      desk: 'On the Pi’s own desktop (in the screen sharing window, or on the TV if part 2 sent a Pi 3 there), open the web browser:',
      bar: 'In the Pi’s web browser, click its address bar. On screen sharing, that is the one inside the picture of the Pi’s desktop, not your own browser’s at the very top. Type fractal.newbold.cloud/downloads there and press Enter.',
      checked: 'you can skip that: you chose Raspberry Pi OS (64-bit) in Imager.',
      close: 'close the Pi’s web browser with the × at its top right. On screen sharing, close only that one, inside the picture, and leave your own browser open. The Pi’s browser is'
    }
    const OWN = {
      mac: { ...ON_SCREEN_SHARING, click: '(with a Mac trackpad, click with two fingers)' },
      windows: { ...ON_SCREEN_SHARING, click: '(on a laptop touchpad, tap with two fingers)' },
      linux: { ...ON_SCREEN_SHARING, click: '(on a touchpad, tap or click with two fingers)' },
      screen: {
        desk: 'On the Pi’s desktop, on the TV, open the web browser:',
        bar: 'In the Pi’s web browser, click its address bar at the top, type fractal.newbold.cloud/downloads there and press Enter.',
        checked: 'you can skip that: you checked it is the 64-bit one in part 3.',
        close: 'close the Pi’s web browser with the × at its top right. It is',
        click: '(with the right button on the mouse)'
      }
    }
    const common = WAYS.map((way, i) => {
      let steps = text(apps[i])
      for (const [part, own] of Object.entries(OWN[way])) {
        assert.equal(steps.split(own).length - 1, 1, `the ${way} way’s app steps do not say, once, its own "${own}"`)
        steps = steps.replace(own, `«${part}»`)
      }
      return steps
    })
    for (const [i, way] of WAYS.entries()) assert.equal(common[i], common[0], `the ${way} way’s app steps differ from the Mac’s beyond the words written for each way`)
    /* Nothing of another way's in any of them. */
    assert.ok(!/screen sharing|picture|your own browser|trackpad|touchpad/i.test(text(apps[3])), 'the screen way’s app steps talk of screen sharing or a trackpad, which that way never had')
    for (const way of ['windows', 'linux', 'screen']) assert.ok(!/\bMac\b/.test(text(apps[WAYS.indexOf(way)])), `the ${way} way’s app steps are written for a Mac`)
    assert.ok(!/this page has already made sure/.test(words), 'the app steps say this page checked the system, which it never did')
    /* The part 3 the screen way points to is the one that checks it. */
    assert.match(panel('screen'), /<h4>3\. Start the Pi, and answer its questions<\/h4>[\s\S]*dpkg --print-architecture[\s\S]*<h4>4\. Put the Fractal Remote app on the Pi<\/h4>/, 'the screen way says part 3 checked the system, and part 3 does not')
    const app = text(apps[0])
    assert.match(app, /In the Pi’s web browser, click its address bar\. On screen sharing, that is the one inside the picture of the Pi’s desktop, not your own browser’s at the very top\. Type fractal\.newbold\.cloud\/downloads there and press Enter\./, 'the app steps do not say to type the address on the Pi')
    /*
     * On screen sharing there are two browsers on the reader's screen, his own
     * and the Pi's inside it, and the one at the very top is his. Closing his
     * own closes the screen sharing and the Pi's desktop with it.
     */
    assert.match(app, /close the Pi’s web browser with the × at its top right\. On screen sharing, close only that one, inside the picture, and leave your own browser open\./, 'the app steps tell a reader on screen sharing to close the browser that holds it')
    for (const [i, way] of WAYS.entries()) assert.ok(!/click the address bar at the top|close the web browser\./.test(text(apps[i])), `a ${way} app step names a browser without saying it is the Pi’s`)
    assert.match(app, /arm64\.AppImage \(with a Mac trackpad, click with two fingers\)/, 'a Mac owner working the Pi from a trackpad is not told how to right-click')
    for (const said of [
      'fractal.newbold.cloud/downloads',
      'Click Raspberry Pi and other ARM — AppImage',
      'Not the Linux PC one, and not the .deb.',
      'arm64.AppImage',
      'set Execute to Anyone',
      'Leave the file where it is from now on: it is the app itself.',
      'Choose I already have an account',
      'click Turn on',
      'Create account',
      'Show the walkthrough',
      'choose About, and tick Start when this computer turns on.',
      'Plug your unit into one of the Pi’s USB ports',
      'On your phone, open Fractal Remote, signed in to that same account.',
      'Look for the computer again',
      'On a Pi 3:'
    ]) {
      assert.ok(app.includes(said), `the app steps no longer say "${said}"`)
    }
    /* What to do if the welcome screen isn't there comes before the button on it. */
    assert.match(app, /The app opens on its welcome screen\. \(If it doesn’t, open Settings with the gear ⚙ at the top right and choose Show the walkthrough\.\) Choose I already have an account,/, 'a reader whose app opened elsewhere hunts for the welcome screen’s button before he is told how to reach it')
    /* In the app's own words, read from the app, so a rename there fails here. */
    const { P1, REPLAY } = await import('../shared/onboarding.mjs')
    assert.equal(P1.haveCode, 'I already have an account', 'the welcome screen’s button was renamed; read the guide against it again')
    assert.equal(REPLAY, 'Show the walkthrough', 'Settings’ walkthrough row was renamed; read the guide against it again')
    assert.match(read('src/components/SignInSheet.jsx'), /submitLabel=\{phone \? 'Connect' : 'Turn on'\}/, 'the computer’s sign-in button no longer says Turn on')
    assert.match(read('src/components/SignIn.jsx'), />\s*Create account\s*</, 'the sign-in form no longer offers Create account')
    assert.match(read('src/components/StartAtBoot.jsx'), /Start when this computer turns on/, 'the switch was renamed; read the guide against it again')
    assert.match(read('src/App.jsx'), /\babout: 'About',/, 'Settings has no About page, which the guide sends people to')
    assert.match(read('src/App.jsx'), /\bhelp: 'Troubleshooting',/, 'Settings has no Troubleshooting page, where the guide says Feedback is')
    assert.match(read('src/App.jsx'), /<Section key="feedback" title="Feedback"/, 'the computer app’s Troubleshooting page has no Feedback, as the guide says')
    assert.match(read('mobile/src/screens/Settings.js'), /title="Troubleshooting"[\s\S]*title="Feedback"/, 'the phone’s Troubleshooting has no Feedback, as the guide says')
    assert.match(read('src/components/TopBar.jsx'), /className="topbar-gear"[\s\S]{0,200}⚙/, 'Settings is no longer behind the gear the guide names')
    assert.match(downloads, /'Raspberry Pi and other ARM &mdash; AppImage'/, 'the download button the guide names was renamed')
    assert.match(downloads, /return \/-arm64\\\.AppImage\$\/i\.test\(n\)/, 'the Pi’s file no longer ends in arm64.AppImage, as the guide says')
    for (const f of ['mobile/src/screens/Settings.js', 'mobile/src/screens/Stage.js']) {
      assert.match(read(f), /['"]Look for the computer again['"]/, `${f} no longer says Look for the computer again`)
    }

    /* What each way says that the others don't. */
    const said = (way) => text(panel(way))
    assert.match(said('mac'), /click Download for macOS/)
    assert.match(said('windows'), /click Download for Windows/)
    assert.match(said('windows'), /click Cancel\. Never Format/, 'Windows is not told to leave the written card alone')
    assert.match(said('linux'), /click Download for Linux \(x86_64\)/)
    assert.match(said('mac'), /click Ignore\. Never Initialize/, 'a Mac is not told to leave the written card alone')
    for (const way of ['mac', 'windows', 'linux']) {
      const w = said(way)
      for (const step of ['Enable Raspberry Pi Connect', 'Create auth key and launch Raspberry Pi Imager', 'within six hours', 'connect.raspberrypi.com', 'Connect via, then Screen sharing', 'Shutdown, then Shutdown', 'unplug the Pi’s power, and plug it back in']) {
        assert.ok(w.includes(step), `the ${way} way does not say "${step}"`)
      }
      /*
       * The Pi 3, right where screen sharing is: untried there, and a TV as the
       * fallback, in the reader's own way. Its card is written and it is
       * running, so the screen way's first steps (power off, write the card)
       * would be the wrong ones, and the parts after this are the same.
       */
      assert.match(w, /On a Pi 3: screen sharing should work on today’s Raspberry Pi OS, but nobody has tried it with this app on a Pi 3 yet\./, `the ${way} way promises a Pi 3 screen sharing`)
      assert.match(w, /then do parts 3 and 4 below on the TV instead of in your browser\. In part 4, unplug the keyboard, mouse and TV before you plug the power back in\./, `the ${way} way gives a Pi 3 with no screen sharing nowhere to go`)
      /*
       * Imager's own screens, as rpi-imager 2.0.12 draws them. The Connect
       * token arrives as the token itself in its box ("Token received from
       * browser" is only that box's placeholder, never seen once it is
       * filled), and a good write moves at once to "Write complete!", whose
       * Finish waits for the card to be ejected.
       */
      assert.ok(w.includes('the Authentication token box has filled itself in with a long code, and the Open Raspberry Pi Connect button has gone.'), `the ${way} way does not say what Imager shows when the Connect key arrives`)
      assert.ok(!/Token received/.test(w), `the ${way} way tells the reader to look for words Imager never shows`)
      assert.ok(w.includes('When Imager says Write complete!, wait until it says the storage device (the card) was ejected (if it shows an Eject button instead, click Eject), then click Finish.'), `the ${way} way sends the reader to a Finish that does not answer yet`)
      /* Imager's wifi, filled in or not, and the case before the card. */
      assert.match(w, /Fill in whatever it left empty: leave Secure network chosen, type your wifi’s name in the SSID box exactly as it appears \(capitals and spaces count\), and type the wifi password in both password boxes\. Leave Hidden SSID unticked\./, `the ${way} way leaves an empty wifi box to the reader`)
      assert.ok(w.indexOf('Put the Pi in its case') > -1 && w.indexOf('Put the Pi in its case') < w.indexOf('Push the memory card into the Pi’s card slot'), `the ${way} way never puts the Pi in its case`)
    }
    assert.equal((html.match(/data-go="/g) || []).length, 1, 'a way sends the reader across to another way’s first steps')
    const macOS = said('mac')
    assert.ok(macOS.indexOf('Your Mac needs macOS 13 Ventura or newer') > -1 && macOS.indexOf('Your Mac needs macOS 13 Ventura or newer') < macOS.indexOf('1. Put Raspberry Pi OS on the memory card'), 'an older Mac finds out it cannot open Imager only after downloading it')
    assert.match(panel('mac'), /On an older Mac, Raspberry Pi Imager won’t open, so take <a href="#screen" data-go="screen">With a keyboard, mouse and screen on the Pi<\/a> instead/, 'an older Mac is given nowhere to go')
    assert.match(said('screen'), /On a Mac \(it needs macOS 13 Ventura or newer\)/, 'the screen way’s Mac is not told the macOS Imager needs')
    const screen = said('screen')
    for (const step of ['Put the Pi in its case', 'socket marked FAN', 'micro-HDMI to HDMI cable, in the port marked HDMI0', 'On a Pi 3, use an ordinary HDMI cable', 'USB keyboard and the USB mouse', 'If the card came already loaded', 'If you have another computer', 'With no other computer (a Pi 4, 400, 5, 500 or 500+ only, not a Pi 3)', 'Skip customisation', 'Welcome to Raspberry Pi', 'Create User', 'dpkg --print-architecture', 'arm64', 'armhf', 'unplug the keyboard, the mouse and the screen']) {
      assert.ok(screen.includes(step), `the screen way does not say "${step}"`)
    }
    /*
     * The Pi 400's first screen port is the one by the card slot, not the
     * power socket as on a Pi 4 or 5; the other one shows nothing while it
     * starts, and the trouble section then sends him back to the wrong port.
     */
    assert.match(screen, /On a Pi 5 or Pi 4, use the micro-HDMI to HDMI cable, in the port marked HDMI0, next to the power socket\. On a Pi 400, use the same kind of cable in the micro-HDMI port next to the memory card slot\./, 'a Pi 400 is sent to the screen port that shows nothing at start-up')
    assert.ok(!/Pi 5, 4, 400, 500 or 500\+, use the micro-HDMI/.test(screen), 'a Pi 400 is told its first screen port is by the power socket')
    assert.match(words, /on a Pi 400, the one next to the memory card slot\), and the TV is switched to that HDMI input\./, 'a Pi 400 with no picture is not told which port is its first')
    /* On the Pi itself Imager's last button is Reboot, not Finish (rpi-imager 2.0.12, DoneStep.qml). */
    const noComputer = text(panel('screen').slice(panel('screen').indexOf('With no other computer'), panel('screen').indexOf('<h4>3.')))
    assert.match(noComputer, /it moves on to its last screen by itself\. Click Reboot there\./, 'the network install sends him to a Finish button that is not there')
    assert.ok(!/Finish/.test(noComputer), 'the network install names Imager’s Finish, which the Pi’s own Imager calls Reboot')
    /* The Pi's own Imager asks for a language first, and writes the moment Write is clicked: no "are you sure". */
    assert.match(noComputer, /If Imager first shows Welcome and asks for a language, choose yours and click Next\./, 'the network install leaves out the Welcome screen the Pi’s own Imager opens on')
    assert.match(noComputer, /Click Write\. Here it starts writing at once, with no box asking if you are sure/, 'the network install never warns that Write wipes the card at once')
    assert.ok(!/I understand, erase and write/.test(noComputer), 'the network install sends him to a box the Pi’s own Imager never shows')
    assert.ok(!/Write completed successfully/.test(words), 'the guide waits for words Imager shows only for a moment before it moves on')
    assert.equal(words.split('When Imager says Write complete!').length - 1, 4, 'a card written on another computer is not taken through Imager’s Write complete! screen')
    /* Wifi set up even with a cable in, because the pedalboard Pi has no cable. */
    assert.match(screen, /Do this even if a network cable is plugged in: on the pedalboard the Pi will need the wifi, or your phone’s hotspot/, 'the screen way lets the wifi be skipped, and the Pi then never reaches the phone')
    assert.match(words, /Is the Pi on the internet\? If you skipped wifi while setting it up/, 'a Pi with no wifi has nothing under The phone says there is no computer')
    /* An iPhone's hotspot needs its own switch on before a Pi, signed in to no Apple Account, can join it. */
    assert.match(words, /switch on Allow Others to Join, and keep that screen open until the Pi has joined/, 'the gig steps leave out the iPhone switch that lets the Pi join its hotspot')
    assert.match(words, /Maximize Compatibility in Settings → Personal Hotspot \(iPhone 12 or later; older iPhones already use 2\.4 GHz\)/, 'an older iPhone is told to switch on something it does not have')
    /* The server is only started again by itself once the app runs with no window; during setup a box comes up instead. */
    assert.match(words, /Once it starts by itself at power-on, if it runs out of memory, the part of the app that talks to your unit starts again by itself\./, 'the Pi 3 note promises a restart the app does not do while its window is open')
    assert.match(words, /During setup, a box says “The device server stopped”/, 'the box a Pi 3 can show during setup has nowhere to be looked up')
    /* A Pi setting up another Pi is told how to open Imager once it is installed. */
    assert.match(words, /then open Imager from the Raspberry Pi menu → Accessories → Imager/, 'a Pi used to write the card is never told how to open Imager')
    /* Set up at a TV: no Imager wifi to have mistyped, so the Pi's own screen is where to look. */
    assert.match(words, /Set it up with a keyboard and screen\? Look at the Pi’s own screen: if the network icon at the top right shows no wifi, click it and choose your network\./, 'the keyboard-and-screen reader is sent to Imager steps he never used')
    /* Mistyped wifi with no network cable, which the screenless ways never told him to buy. */
    assert.match(words, /No network cable\? Unplug the Pi’s power, take the card out, and write it again with Imager \(part 1 of the Mac, Windows PC or Linux way\)\./, 'a Pi that never joined the wifi, with no cable to hand, has nowhere to go')
    /* A 32-bit card and no other computer: not stranded. */
    assert.match(screen, /With no other computer, on a Pi 4, 400, 5, 500 or 500\+: shut the Pi down[^.]*, and take the way With no other computer above with this same card\. Holding Shift, as it says, starts it even on a card that already has a system on it\. On a Pi 3 you need another computer to write the card/, 'a 32-bit card with no other computer is left with nothing to do')

    /*
     * Never the 32-bit system, nor Lite. Every sentence that names either is
     * one of these four, read and agreed: the Pis that won't work, Imager's
     * warning off both, the armhf check, and the packages for Lite with a
     * desktop added. A new one fails here until somebody has read it, because
     * "Lite is fine on a Pi with no screen" is the wrong advice a reader with
     * no screen is most likely to believe, and no word list catches it.
     */
    const sentences = words.split(/(?<=[.!?])\s+/)
    const named = sentences.filter((s) => /32-bit|\bLite\b/.test(s))
    assert.deepEqual(
      [...new Set(named)],
      [
        'They can only run the 32-bit Raspberry Pi OS, and the Fractal Remote app needs the 64-bit one.',
        'Not Raspberry Pi OS (32-bit) just under it, and nothing under Raspberry Pi OS (other): the Lite system there has no desktop, and the app needs one.',
        'If it says armhf, it is the 32-bit system, which the app can’t run on.',
        'On a trimmed-down system, such as Raspberry Pi OS Lite with a desktop added, first type sudo apt install libfuse2t64 zlib1g-dev (on the older Bookworm release, libfuse2 in place of libfuse2t64).'
      ],
      'a sentence that names the 32-bit system or Lite has changed or been added; read it, and if it never offers either, put it here'
    )
    assert.equal(named.length, 8, 'the warning off the 32-bit system and Lite is missing from an Imager the guide walks through')
    const OS = 'choose Raspberry Pi OS (64-bit), the first one, marked Recommended.'
    assert.equal(words.split(OS).length - 1, 5, 'every Imager the guide walks through does not choose Raspberry Pi OS (64-bit)')

    /* Which Pi: the reason with each, and the ones that won't work said plainly. */
    const tier = (name) => text(html.slice(html.indexOf(`<div class="tier ${name}">`), html.indexOf('</div>', html.indexOf(`<div class="tier ${name}">`))))
    assert.match(tier('good'), /^Good: pick one of these Raspberry Pi 5 with 2 GB or more\./)
    assert.match(tier('good'), /Raspberry Pi 4 with 2 GB or more\./)
    assert.match(tier('slow'), /^Works, but slower Raspberry Pi 3 Model B or B\+\./)
    assert.match(tier('no'), /^Not recommended Raspberry Pi Zero 2 W and Pi 3 Model A\+\. Only 512 MB/)
    assert.match(tier('bad'), /^Won’t work Raspberry Pi 2, every Raspberry Pi 1, and the first Zero, Zero W and Zero WH\. They can only run the 32-bit Raspberry Pi OS, and the Fractal Remote app needs the 64-bit one\./, 'the guide does not say which Pis won’t work, and why')
    /* Nowhere else does the Zero 2 W come up, so nothing can say it works. */
    assert.equal(words.split('Zero 2 W').length - 1, 1, 'the guide names the Zero 2 W outside Not recommended')
    assert.match(words, /Already have a Pi 3\? It should work, but expect it to be slower/, 'the guide does not tell a Pi 3 owner what to expect')
    assert.ok(!/\bIt works\./.test(words), 'the guide says flatly that a Pi works, and nothing records the app running all the way on one')
    assert.match(words, /Switch off Active Desktop: Raspberry Pi menu → Preferences → Control Centre → Desktop, and turn off Active Desktop\. Raspberry Pi recommends that on any Pi with less than 2 GB/, 'a Pi 3 owner is not given Raspberry Pi’s own memory tip')
    /* And the two pages a reader goes to from here say the same of the Zero 2 W. */
    const { wayById: wayFor } = await import('../shared/ways-in.mjs')
    for (const [where, theirs] of [['the download page', downloads], ['the computer app’s Linux steps', wayFor('linux-app').steps.join(' ')]]) {
      assert.ok(!/Zero 2 W can run it/.test(theirs), `${where} says a Zero 2 W can run it, and the guide says it is not recommended`)
      /* Not recommended, and very likely too little: nobody has measured the app on 512 MB, so neither page says it as a fact. */
      assert.match(theirs, /A Zero 2 W or Pi 3 A\+ isn(’|&rsquo;)t recommended: 512 MB is very likely too little\./, `${where} does not say what the guide says of the Zero 2 W`)
      assert.ok(!/has too little memory/.test(theirs), `${where} says as a fact that the Zero 2 W has too little memory, which nobody has measured`)
    }
    assert.equal(downloads.split('A Zero 2 W or Pi 3 A+ isn&rsquo;t recommended: 512 MB is very likely too little.').length - 1, 3, 'one of the download page’s three Pi messages still oversells or undersells the Zero 2 W')
    assert.match(words, /a Pi 4 or Pi 5 with 2 GB or more is the fix/)

    /* What to buy: named, never priced, never a shop. */
    for (const part of ['A Raspberry Pi 5, 4 GB.', 'The official Raspberry Pi 27W USB-C Power Supply.', 'A case with a fan', 'A microSD card of 32 GB or more.', 'FM3, FM9 or Axe-Fx III: USB-A to USB-B', 'AM4: USB-A to USB-C.', 'It has to be a data cable, not a charge-only one.', 'a USB microSD card reader', 'the official Raspberry Pi 15W USB-C Power Supply', 'the official Raspberry Pi 12.5W micro USB Power Supply']) {
      assert.ok(words.includes(part), `the shopping list does not say "${part}"`)
    }
    assert.ok(!/[$€£]\s?\d/.test(words), 'the guide quotes a price, which goes stale')
    assert.match(words, /You also need Fractal Remote on your phone with the phone remote unlocked/, 'the guide never says the phone remote has to be unlocked, so its last check fails for somebody on the free app')
    assert.match(words, /On a Pi 3, have a TV or monitor, an ordinary HDMI cable, a USB keyboard and a USB mouse you could borrow/, 'a Pi 3 set up from another computer is not told to have a screen to hand')
    /* If something goes wrong, the screen way's own first trouble; and at a gig, what a venue's wifi can't do. */
    assert.match(words, /The TV or monitor shows nothing Check the cable is in the Pi’s port marked HDMI0/, 'a TV with no picture has nothing under If something goes wrong')
    assert.match(words, /Your phone’s hotspot is the surest[\s\S]{0,400}A venue’s wifi works only if the Pi has joined it before, from its desktop, and never if it has a sign-in page\./, 'the guide sends a Pi with no screen to a venue’s wifi it cannot join')
    assert.match(words, /keep that screen open until the Pi has joined/, 'an iPhone’s hotspot is not kept findable while the Pi joins it')
    const outside = [...html.matchAll(/href="(https?:[^"]*)"/g)].map((m) => m[1])
    const CHECKED = new Set(['https://www.raspberrypi.com/software/', 'https://connect.raspberrypi.com/', 'https://apps.apple.com/app/id6812916461'])
    for (const link of outside) assert.ok(CHECKED.has(link), `the guide links ${link}, which nobody checked`)
    /* The support page links here and may not carry the phone's other way in, so nor does this. */
    assert.ok(!/bluetooth/i.test(page), 'the guide mentions Bluetooth, which customers are not shown')

    /*
     * THE SCRIPT, run under a stand-in for the browser: an element for every
     * tag with an id or a data- attribute the script looks for, an address and
     * a history that keep each other honest, and the app's stored theme.
     */
    const { createContext, runInContext } = await import('node:vm')
    const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1])
    assert.equal(scripts.length, 2, 'the guide’s scripts are not the theme and the four ways')
    const markup = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    function browser({ hash = '', stored = null, refuse = false, pushState = true } = {}) {
      const all = []
      const focus = { on: null, scrolledTo: null }
      const element = (tag, attrs) => {
        const el = {
          tag,
          attrs,
          hidden: 'hidden' in attrs,
          listeners: {},
          getAttribute: (n) => (n in el.attrs ? el.attrs[n] : null),
          setAttribute: (n, v) => {
            el.attrs[n] = String(v)
          },
          addEventListener: (type, fn) => (el.listeners[type] ||= []).push(fn),
          focus: () => {
            focus.on = el
          },
          scrollIntoView: () => {
            focus.scrolledTo = el
          },
          click() {
            const event = { prevented: false, preventDefault() { this.prevented = true } }
            for (const fn of el.listeners.click || []) fn.call(el, event)
            return event
          }
        }
        return el
      }
      for (const m of markup.matchAll(/<([a-z][a-z0-9]*)\b([^>]*)>/gi)) {
        const attrs = {}
        for (const a of m[2].matchAll(/([a-zA-Z][-a-zA-Z0-9]*)(?:="([^"]*)")?/g)) attrs[a[1]] = a[2] ?? ''
        if (['id', 'data-way', 'data-go', 'data-again'].some((n) => n in attrs)) all.push(element(m[1].toLowerCase(), attrs))
      }
      /* Only the selectors the script uses; anything else is a script that changed under this test. */
      const select = (sel) => {
        const m = sel.match(/^([a-z]+)\[([-a-z]+)\]$/)
        if (!m) throw new Error(`the stand-in does not know the selector ${sel}`)
        return all.filter((el) => el.tag === m[1] && m[2] in el.attrs)
      }
      const root = element('html', {})
      const listeners = {}
      const location = { hash }
      const pushed = []
      const win = {
        document: {
          documentElement: root,
          getElementById: (id) => all.find((el) => el.attrs.id === id) || null,
          querySelectorAll: select
        },
        location,
        history: pushState
          ? {
              pushState: (state, title, url) => {
                pushed.push(url)
                location.hash = url
              }
            }
          : {},
        localStorage: {
          getItem: (key) => {
            if (refuse) throw new Error('storage is blocked')
            return key === 'fab.theme' ? stored : null
          }
        },
        addEventListener: (type, fn) => (listeners[type] ||= []).push(fn)
      }
      for (const el of all) el.querySelectorAll = select
      win.window = win
      const context = createContext(win)
      for (const code of scripts) runInContext(code, context)
      const byId = win.document.getElementById
      return {
        byId,
        select,
        pushed,
        focus,
        root,
        shown: () => WAYS.filter((way) => !byId(way).hidden),
        pressed: () => select('button[data-way]').filter((b) => b.getAttribute('aria-pressed') === 'true').map((b) => b.getAttribute('data-way')),
        button: (way) => select('button[data-way]').find((b) => b.getAttribute('data-way') === way),
        /* The reader presses Back, or follows a link to somewhere on the page. */
        go: (to, type = 'popstate') => {
          location.hash = to
          for (const fn of listeners[type] || []) fn({})
        }
      }
    }

    /* No choice yet: the buttons, the hint, and no way's steps. */
    const fresh = browser()
    assert.deepEqual(fresh.shown(), [], 'before any choice, the guide shows a way’s steps')
    assert.equal(fresh.byId('pick-hint').hidden, false, 'before any choice, the guide does not say to pick one')
    assert.equal(fresh.byId('pick').hidden, false, 'with the script running, the four buttons stay hidden')
    assert.equal(fresh.byId('jump').hidden, true, 'with the script running, the scripts-off links still show')
    assert.deepEqual(fresh.pressed(), [], 'a button is marked chosen before anything was chosen')

    /* A link straight to one way opens that one, and marks its button. */
    for (const way of WAYS) {
      const opened = browser({ hash: `#${way}` })
      assert.deepEqual(opened.shown(), [way], `#${way} opens ${opened.shown().join(', ') || 'nothing'}`)
      assert.deepEqual(opened.pressed(), [way], `#${way} does not mark its own button chosen`)
      assert.equal(opened.byId('pick-hint').hidden, true, `#${way} still says to pick one`)
    }
    assert.deepEqual(browser({ hash: '#trouble' }).shown(), [], 'an address that is not a way opens one')

    /* Choosing puts the way in the address, and Back goes back through them. */
    const b = browser()
    b.button('windows').click()
    assert.deepEqual(b.shown(), ['windows'])
    assert.deepEqual(b.pushed, ['#windows'], 'choosing a way does not put it in the address')
    b.button('windows').click()
    assert.deepEqual(b.pushed, ['#windows'], 'choosing the way already shown adds a second history entry')
    b.button('mac').click()
    assert.deepEqual(b.shown(), ['mac'])
    assert.deepEqual(b.pressed(), ['mac'], 'the chosen button is not the one marked')
    b.go('#windows')
    assert.deepEqual(b.shown(), ['windows'], 'Back does not go back to the way chosen before')
    b.go('#trouble', 'hashchange')
    assert.deepEqual(b.shown(), ['windows'], 'a link to another part of the page loses the chosen way')
    b.go('')
    assert.deepEqual(b.shown(), [], 'Back to the start still shows a way')
    assert.equal(b.byId('pick-hint').hidden, false, 'Back to the start does not say to pick one again')

    /* An older Mac's way across to the screen way: chosen, and gone to. */
    const across = browser({ hash: '#mac' })
    const toScreen = across.select('a[data-go]').filter((a) => a.getAttribute('data-go') === 'screen')
    assert.equal(toScreen.length, 1, 'an older Mac has no way across to the screen way')
    assert.ok(toScreen[0].click().prevented, 'the link across to the screen way jumps to a heading that is still hidden')
    assert.deepEqual(across.shown(), ['screen'], 'the link across to the screen way does not open it')
    assert.deepEqual(across.pressed(), ['screen'], 'the link across to the screen way does not mark its button')
    assert.deepEqual(across.pushed, ['#screen'], 'the link across to the screen way does not put it in the address')
    assert.equal(across.focus.scrolledTo, across.byId('screen'), 'the link across to the screen way leaves the reader where the Mac way was')

    /* Back to the four choices: the question in view, the chosen button focused, the way kept. */
    const again = across.select('a[data-again]')
    assert.equal(again.length, 4, 'a way has no way back to the four choices')
    assert.ok(again[0].click().prevented, 'Back to the four choices changes the address and loses the way')
    assert.equal(across.focus.scrolledTo, across.byId('how'), 'Back to the four choices does not go to the question')
    assert.equal(across.focus.on, across.button('screen'), 'Back to the four choices does not put the reader on the chosen button')
    assert.deepEqual(across.shown(), ['screen'], 'Back to the four choices forgets the way chosen')

    /* A browser that cannot change the address is left as scripts off leave it: every way shown. */
    const old = browser({ pushState: false })
    assert.deepEqual(old.shown(), WAYS, 'a browser with no history to write is shown no way at all')
    assert.equal(old.byId('pick').hidden, true, 'a browser with no history to write is shown buttons that cannot work')

    /* The app's own Light or Dark; the system's on Auto; Dark, the app's default, when nothing was chosen or storage refuses. */
    assert.equal(browser({ stored: 'light' }).root.getAttribute('data-theme'), 'light', 'the guide ignores the app’s Light choice')
    assert.equal(browser({ stored: 'dark' }).root.getAttribute('data-theme'), 'dark', 'the guide ignores the app’s Dark choice')
    assert.equal(browser({ stored: 'auto' }).root.getAttribute('data-theme'), null, 'the guide overrides the system when the app follows it')
    assert.equal(browser({}).root.getAttribute('data-theme'), 'dark', 'a browser that never chose sees the guide light, when the app it came from starts dark')
    assert.equal(browser({ stored: 'sepia' }).root.getAttribute('data-theme'), 'dark', 'a value the app never writes is taken as a choice')
    assert.equal(browser({ refuse: true }).root.getAttribute('data-theme'), 'dark', 'storage that refuses gives the guide a theme the app would not show')
  })

  /*
   * RETIRING AN OLD PI. "How can a user remove old units they aren't
   * connected to": a Pi leaves Which unit only by not answering, so the
   * guide says how at the Pi, in the computer app's own words, and the two
   * things a Pi 5 swap trips on: a card given away still signed in, and
   * Imager filling in the old Pi's Hostname for the new one.
   */
  test('the Pi guide says how to retire an old Pi, in the computer app’s own words', () => {
    const page = read('public/raspberry-pi.html').replace(/<!--[\s\S]*?-->/g, '')
    const text = (s) =>
      s
        .replace(/<\/?(?:strong|em|a|code|span)\b[^>]*>/g, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/\s+/g, ' ')
        .trim()
    const HEAD = '<h2 id="retire">Retiring an old Pi</h2>'
    const at = page.indexOf(HEAD)
    assert.ok(at > -1, 'the guide has no section for retiring an old Pi')
    assert.equal(page.split('id="retire"').length - 1, 1, 'two places on the guide answer to #retire')
    assert.ok(at > page.indexOf('<h2 id="gigs">') && at < page.indexOf('<footer>'), 'Retiring an old Pi is not the last section, after For gigs')
    assert.match(page, /<a href="#gigs">for gigs<\/a> ·\s*<a href="#retire">retiring an old Pi<\/a>\s*<\/p>/, 'the list at the top of the guide does not lead to it')
    const words = text(page.slice(at, page.indexOf('<footer>')))
    for (const said of [
      'still shows under Which unit while it is switched on',
      'open Fractal Remote from Downloads, which brings up its window',
      'Open Settings (the gear ⚙ at the top right), choose Phone & computer, open Phone remote, and click Turn off.',
      'It stays off through restarts, until someone clicks Turn on there.',
      'choose About and untick Start when this computer turns on',
      'the menu of the Fractal Remote icon',
      'Then shut the Pi down and unplug it, as in For gigs.',
      'close Fractal Remote all the way and open it again (in a web browser, reload the page): the old Pi is gone from Which unit.',
      /* A pick stays, as not answering, with Forget (relay.js and remote.js missingPick, missingPickRow), so the guide says so, or the steps look as if they did not work. */
      'If you had picked it there, it shows as not answering instead: press Forget beside it.',
      'First erase the card with Raspberry Pi Imager: choose Erase on its OS screen. The app on that card is still signed in to your Fractal Remote account.',
      'Give the new one a different Hostname in Imager. Imager fills in the name you gave last time'
    ]) {
      assert.ok(words.includes(said), `Retiring an old Pi no longer says "${said}": ${words}`)
    }
    for (const never of [/this phone/i, /sign out/i, /official/i, /grey/i, /Inc\./]) assert.ok(!never.test(words), `${never} in Retiring an old Pi`)
    /* The words are the computer app's: read from it, so a rename there fails here. */
    const app = read('src/App.jsx')
    assert.match(app, /link: 'Phone & computer',/)
    assert.match(app, /\babout: 'About',/)
    assert.match(app, /<Section key="phone-remote" title="Phone remote"/)
    assert.match(read('src/components/PhoneRemote.jsx'), /onAction\('mac-off'\)[^>]*>\s*Turn off\s*</)
    assert.match(read('src/components/PhoneRemote.jsx'), /onAction\('mac-on'\)[^>]*>\s*Turn on\s*</)
    assert.match(read('src/components/StartAtBoot.jsx'), /<input type="checkbox"[^\n]*\/>\s*<span>\s*Start when this computer turns on/, 'the switch under About is no longer a tick box called Start when this computer turns on')
    assert.match(read('desktop/main.js'), /label: 'Start when this computer turns on',\s*type: 'checkbox'/, 'the tray menu’s switch was renamed; read the guide against it again')
    assert.match(read('desktop/lib/host.mjs'), /wanted\.wanted === false\) \{\s*log\('Phone remote: off — it was turned off in the app\.'\)/, 'Turn off no longer lasts through a restart, as the guide says')
    /* Not answering and Forget are the app's own words for a pick that no longer answers. */
    const row = read('shared/relay-rules.mjs').match(/export const missingPickRow = [^\n]+/)?.[0] || ''
    assert.ok(row.includes('— not answering`') && row.includes("forget: 'Forget'"), `the row for a pick that does not answer no longer says not answering, with Forget: ${row}`)
    /* The guide's own Imager words, from its earlier steps: Hostname, filled in last time, and the OS screen. */
    assert.ok(page.includes('<li><strong>Hostname</strong>: type a name for the Pi') && page.includes('Imager fills in the name you gave last time'), 'the guide’s Imager steps no longer say Hostname, or that Imager fills it in')
    assert.ok(page.includes('On the <strong>OS</strong> screen, choose'), 'the guide’s Imager steps no longer call it the OS screen')
  })

  /*
   * AN AM4 ON A PI 3 OR PI 4: ONE SETTING, WHERE A PLAYER WILL FIND IT.
   *
   * "The same names are not showing up again at all. on the AM4" (Justin,
   * 21 October 2026, a Raspberry Pi 3). snd-seq-midi takes a USB-MIDI port's
   * input into a buffer one memory page long: 4 KB on a Pi 3, 4 or 400, 16 KB
   * on a Pi 5's own kernel, and an AM4 preset is 12,352 bytes. The fix he ran
   * is one line and a restart, and it is the one ForgeFX's AM4 driver names
   * when it sees the cut (am4BufferTooSmall) and desktop/README.md gives
   * whoever reads a report. The guide says it for a player: which Pis, how he
   * would notice, the line, the restart, a check that only reads, and the
   * undo, after the setup and before what to do when something goes wrong,
   * and every place a Pi owner with missing names looks points to it.
   *
   * Only the AM4. ForgeFX's check is the AM4's alone, and the FM3 is on
   * serial, which this buffer is not on, so the entry names no other unit.
   * And since 1.87.47 the loaded preset's names come from a small structure
   * read (the pin's am4structnames), which is why it says "now and then".
   *
   * And no more than is known. The cut has been seen, on his Pi 3 (3,095
   * bytes, then 3,863 twice, the shape the buffer predicts); the cure has
   * not, and a Pi 4 has the same 4 KB but has never been seen losing any,
   * so the entry says both plainly. The setting goes with the computer app's
   * own 2000-cell reader (1.87.47): with 64 KB a whole dump can be in flight
   * at once, more than RtMidi's 200 cells hold. And a number mistyped can
   * lose the unit altogether: one that won't parse stops the module loading
   * (the check then says No such file or directory), and one under 32 or
   * over 1 MB makes the port refuse to open (rawmidi.c), so the check says
   * what to do with an answer it doesn't list, and so does the trouble entry
   * for a unit the app can't find.
   */
  test('the Pi guide gives an AM4 on a Pi 3 or Pi 4 its one setting, a check that only reads, and the undo', async () => {
    const page = read('public/raspberry-pi.html').replace(/<!--[\s\S]*?-->/g, '')
    const text = (s) =>
      s
        .replace(/<\/?(?:strong|em|a|code|span)\b[^>]*>/g, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/\s+/g, ' ')
        .trim()
    const HEAD = '<h2 id="am4">An AM4 on a Pi 3 or Pi 4</h2>'
    const at = page.indexOf(HEAD)
    const trouble = page.indexOf('<h2 id="trouble">')
    assert.ok(at > -1, 'the guide has no entry for an AM4 on a Pi 3 or Pi 4')
    assert.equal(page.split('id="am4"').length - 1, 1, 'two places on the guide answer to #am4')
    assert.ok(at > page.lastIndexOf('</section>', trouble) && at < trouble, 'the AM4 entry is not after the four ways and before If something goes wrong')
    const entry = page.slice(at, trouble)
    const words = text(entry)

    /* The three lines to type, each whole in one box, so nothing is copied in halves. */
    const LINE = 'echo options snd-seq-midi input_buffer_size=65536 | sudo tee /etc/modprobe.d/fractal-remote-midi.conf'
    const CHECK = 'cat /sys/module/snd_seq_midi/parameters/input_buffer_size'
    const UNDO = 'sudo rm /etc/modprobe.d/fractal-remote-midi.conf'
    for (const cmd of [LINE, CHECK, UNDO]) {
      assert.equal(entry.split(`<code>${cmd}</code>`).length - 1, 1, `the AM4 entry does not give "${cmd}" to type, once, in one piece`)
    }
    /* The same option and file as ForgeFX's fix, as the lock and the computer app's README record it. */
    assert.match(read('desktop/forgefx.lock.json'), /options snd-seq-midi input_buffer_size=65536/, 'the lock no longer records the fix the guide gives')
    const readme = read('desktop/README.md')
    for (const part of ['options snd-seq-midi input_buffer_size=65536', '/etc/modprobe.d/fractal-remote-midi.conf', 'raspberry-pi#am4']) {
      assert.ok(readme.includes(part), `desktop/README.md no longer says ${part}`)
    }

    /* Which Pis, and why, in plain words. */
    assert.match(words, /On a Raspberry Pi 3 or Pi 4, the Pi 400 included, give the Pi one setting for an AM4\./, 'the entry does not say which Pis need it')
    assert.match(words, /sets aside 4 KB to catch what the AM4 sends, and a whole AM4 preset is about 12 KB\. A Pi 3 loses most of it on the way in\./, 'the entry does not say why')
    /* What has been seen, and what hasn't: the loss on a Pi 3 only, and the cure nowhere yet. */
    assert.match(words, /A Pi 4 or 400 sets aside the same 4 KB, though nobody has seen one lose any of a preset yet; the setting does it no harm, so give it the setting too\./, 'the entry says a Pi 4 loses the preset, which nobody has seen')
    assert.ok(!/so most of it is lost on the way in/.test(words), 'the entry says every Pi 3 and Pi 4 loses most of a preset')
    assert.match(words, /This setting is new\. What it fixes has been seen on a Pi 3, but the setting itself hasn’t yet been seen bringing the scene names back on a real Pi\. If it does on yours, or doesn’t, please say so: in the app, Settings → Troubleshooting → Feedback\./, 'the entry gives the setting as a known cure, and nobody has seen it work on a Pi yet')
    assert.match(words, /A Pi 5, 500 or 500\+ sets aside 16 KB by itself, room for a whole preset, so it shouldn’t need this; the check below says for sure on any Pi\./, 'a Pi 5 owner is not told it should not need this')
    /* How a player would notice, and why only now and then since the structure read. */
    assert.match(words, /the scene buttons in the app show numbers, 1 to 4, where your AM4’s scene names should be/, 'the entry does not say how a player would notice')
    assert.match(words, /From version 1\.87\.47 on, the computer app reads the loaded preset’s scene names a smaller way/, 'the entry does not say why the names may be missing only now and then')
    assert.match(read('desktop/forgefx.lock.json'), /"tag": "[^"]*\+am4structnames\b/, 'the pinned ForgeFX no longer reads the loaded AM4 preset’s scene names off its structure, as the guide says')
    /* The restart, the check's four answers, and the undo. */
    assert.match(words, /Restart the Pi: Raspberry Pi menu → Shutdown → Reboot\. The setting comes on as the Pi starts\./, 'the entry does not say the setting needs a restart')
    assert.match(words, /It only reads, and changes nothing\./, 'the entry does not say the check is safe to type')
    /* Connect does not hand the clipboard over by itself: it is a button at the top of the window. */
    assert.match(words, /On screen sharing you can paste it instead: copy the line from this page, click Paste to remote at the top of the screen sharing window, then right-click in Terminal and choose Paste\./, 'a reader on screen sharing is told to paste a line his own computer never handed to the Pi')
    /* The computer app's own reader, which a whole dump in flight at once needs. */
    assert.match(words, /It goes with the app on the Pi at version 1\.87\.47 or newer\. To see which it has: on your phone, Settings → Phone & computer shows the computer’s name and its version\./, 'the entry does not say which computer app the setting goes with')
    assert.match(read('desktop/README.md'), /From computer app 1\.87\.47 the unit's replies\s+come in through ForgeFX's own ALSA client/, 'the computer app’s README no longer says 1.87.47 brought the reader the guide’s version line is about')
    const { pairTitle } = await import('../shared/device-word.mjs')
    assert.equal(pairTitle('phone'), 'Phone & computer', 'the phone’s Settings row the guide names was renamed')
    for (const answer of [
      '65536: the setting is on.',
      '4096: it isn’t on yet.',
      '16384: the room a Pi 5 sets aside by itself',
      'Any other number: the line went in wrong. Type it again exactly as it is, or paste it, and restart.',
      'No such file or directory: the Pi hasn’t picked up the AM4 yet.'
    ]) {
      assert.ok(words.includes(answer), `the check does not say what "${answer.split(':')[0]}" means`)
    }
    assert.match(words, /type the check again\. If it still says this after you gave the Pi the setting, the line went in wrong: type it again exactly as it is, or paste it, and restart\./, 'a value that stopped the module loading is sent to check the cable, and nothing else')
    assert.match(words, /press Enter, and restart the Pi the same way\. The check then shows the Pi’s own size again\./, 'the undo does not say it needs a restart too')

    /* The AM4 alone, and the device in hand never "this phone". */
    assert.ok(!/\b(?:FM3|FM9|Axe-Fx|VP4)\b/.test(words), 'the AM4 entry names another unit, and only the AM4’s read is known to be cut')
    assert.ok(!/this phone/i.test(words), 'the AM4 entry says "this phone"')

    /* Pointed to from the page's own list, the Pi 3 notes, the trouble list and the support page. */
    const nav = page.slice(page.indexOf('On this page:'), page.indexOf('</p>', page.indexOf('On this page:')))
    assert.ok(nav.indexOf('href="#setup"') < nav.indexOf('href="#am4"') && nav.indexOf('href="#am4"') < nav.indexOf('href="#trouble"'), 'the page’s own list does not offer the AM4 entry where it sits')
    const pi3 = page.slice(page.indexOf('<h3 id="pi3">'), page.indexOf('<h2 id="buy">'))
    assert.match(text(pi3), /With an AM4, a Pi 3 also needs one setting so the AM4’s scene names come through: see An AM4 on a Pi 3 or Pi 4\./, 'a Pi 3 owner reading his own notes is not sent to the AM4 entry')
    assert.ok(pi3.includes('href="#am4"'))
    /* Every way ends by pointing to it, so a Pi 4 owner who only followed the setup finds it too. */
    for (const way of ['mac', 'windows', 'linux', 'screen']) {
      const at = page.indexOf(`<section class="way" id="${way}"`)
      const panel = page.slice(at, page.indexOf('</section>', at))
      const end = panel.slice(panel.lastIndexOf('</ol>'))
      assert.match(end, /<p>With an AM4 on a Pi 3, Pi 4 or Pi 400, give the Pi one more setting: see <a href="#am4">An AM4 on a Pi 3 or Pi 4<\/a>\.<\/p>/, `the ${way} way ends without sending an AM4 on a Pi 3 or Pi 4 to its setting`)
    }
    /* A unit gone after the setting is a line gone in wrong. */
    const findAt = page.indexOf('<h3>The app can’t find your unit</h3>')
    const find = page.slice(findAt, page.indexOf('</ul>', findAt))
    assert.match(text(find), /Went missing right after you gave the Pi the AM4 setting\? The line may have gone in wrong\./, 'a unit lost after the AM4 setting is not traced back to it')
    assert.ok(find.includes('href="#am4"'))
    const lostAt = page.indexOf('<h3>An AM4’s scene buttons show numbers, not names</h3>')
    assert.ok(lostAt > trouble && lostAt < page.indexOf('<h2 id="gigs">'), 'If something goes wrong has nothing for an AM4’s missing scene names')
    const lost = page.slice(lostAt, page.indexOf('</ul>', lostAt))
    assert.match(text(lost), /A scene with no name on the AM4 shows only its number\. That is normal\. On a Pi 3 or Pi 4, give the Pi the one setting in An AM4 on a Pi 3 or Pi 4\./)
    assert.ok(lost.includes('href="#am4"'), 'the trouble entry for missing scene names does not link the AM4 entry')
    const support = read('public/support.html')
    assert.match(support, /<h3>I want a Raspberry Pi on my pedalboard<\/h3>[\s\S]{0,700}With an AM4 on a Pi 3 or Pi 4,\s+give the Pi one setting for the AM4’s scene names: <a href="\/raspberry-pi#am4">/, 'the support page’s Pi answer does not send an AM4 owner to the setting')
  })

  /*
   * A RELEASE IS NOT DONE BECAUSE FOUR JOBS WENT GREEN.
   *
   * Twice in one evening a release shipped with a whole platform missing and
   * nothing said so. 1.14.0 lost Intel Linux to a race for the release
   * itself; 1.17.0 lost Windows to a network drop partway through downloading
   * Electron. Different causes, same shape: every other platform published,
   * so the page looked finished.
   */
  test('a release is checked for all four platforms before it is called done', () => {
    const wf = read('.github/workflows/desktop.yml')
    const job = wf.slice(wf.indexOf('\n  complete:'))
    assert.ok(job, 'nothing checks that a release carries every platform')

    /* After all three builders, or it reads a release still being written —
       and after decide, whose fingerprint it puts on the release. */
    assert.match(job, /needs: \[decide, mac, windows, linux\]/, 'the check no longer waits for every build')

    /*
     * And it runs when one of them FAILED, which is exactly when it earns its
     * place: the run is red either way, and this turns "something went wrong"
     * into the list of files that are not there.
     */
    assert.match(job, /if: \$\{\{ always\(\)/, 'the check is skipped when a build fails, which is when it matters most')

    /* The files a person downloads and the ones an updater reads. A missing
       latest-linux.yml is silent and permanent. */
    for (const needed of ['latest-mac.yml', 'latest.yml', 'latest-linux.yml', 'latest-linux-arm64.yml']) {
      assert.ok(job.includes(needed), `the check does not look for ${needed}`)
    }
    for (const kind of ['.dmg', 'Setup-$v.exe', '.AppImage', '_amd64.deb', '_arm64.deb']) {
      assert.ok(job.includes(kind), `the check does not look for ${kind}`)
    }
    /* A Mac updates from its zip, not the disk image, and the app now waits
       for the zip for its own processor before it says an update is ready —
       so a release without one is a release no Mac can take. */
    for (const zip of ['Fractal-Remote-$v-mac.zip', 'Fractal-Remote-$v-arm64-mac.zip']) {
      assert.ok(job.includes(zip), `the check does not look for ${zip}`)
    }
    /*
     * AND THE BLOCKMAPS AN UPDATE IS MADE SMALL WITH. "Every Mac downloads
     * the full 140 MB each time, because the file that lets it fetch only the
     * changes is uploaded under the wrong name." A computer reads the new
     * version's list and the one for the version it is running, so a release
     * without its own costs a full download twice: updating to it, and from
     * it. Spelled as electron-updater asks for them: the zip's or the
     * installer's own name with .blockmap on the end.
     */
    const want = job.slice(job.indexOf('cat > want.txt'), job.indexOf('WANT\n', job.indexOf('cat > want.txt') + 20))
    for (const map of ['Fractal-Remote-$v-mac.zip.blockmap', 'Fractal-Remote-$v-arm64-mac.zip.blockmap', 'Fractal-Remote-Setup-$v.exe.blockmap']) {
      assert.ok(want.includes(`\n          ${map}\n`), `the check does not look for ${map}, so a release that makes every update the full download looks complete`)
    }
    assert.ok(!/Fractal\.Remote-/.test(want), 'the check asks for the dotted name, which no updater ever reads')
    /* It has to actually fail, rather than printing and carrying on. */
    assert.match(job, /exit 1/, 'the check reports a gap without failing, so nobody sees it')
    /* And a release with a gap loses the record an earlier run left on it, before the step fails (run for real in the next test but one). */
    assert.match(job, /if \[ -n "\$missing" \]; then\n\s*take_record_off "files are missing" \|\| true\n[\s\S]*?\n\s*exit 1\n/, 'a release missing a file keeps the record that says it is whole')

    /*
     * Not when decide found nothing inside the computer app had changed:
     * there is no release to check. And `!= 'true'`, never `== 'false'`, so a
     * decide job that failed outright checks the release it published.
     */
    assert.match(job, /if: \$\{\{ always\(\) && needs\.decide\.outputs\.skip != 'true' &&/, 'the check runs on a merge that made no release, or is skipped when decide broke')

    /*
     * AND THE RECORD GOES ON LAST, after the check passed. The next merge is
     * compared with it; a release that failed part of the way must have none,
     * so the next merge makes a new one rather than leave a platform behind.
     */
    const check = job.indexOf('- name: Every platform is really on the release')
    const record = job.indexOf('- name: The release says what it was made from')
    assert.ok(check !== -1 && record > check, 'the fingerprint goes on a release before anybody has checked it is complete')
    const recordStep = job.slice(record)
    assert.ok(!/^\s+if:/m.test(recordStep.slice(0, recordStep.indexOf('run:'))), 'the record step runs whether or not the check passed')
    assert.match(recordStep, /gh release upload "\$tag" "\$RECORD" --clobber/, 'the release is never told what it was made from, so every merge publishes')
    /* Only from a run that built them: a forced run the release job stopped finds an earlier run's files. */
    assert.match(recordStep, /BUILT: \$\{\{ needs\.mac\.result \}\} \$\{\{ needs\.windows\.result \}\} \$\{\{ needs\.linux\.result \}\}/, 'the record step cannot tell whether this run built anything')
    assert.ok(
      /if \[ "\$BUILT" != "success success success" \]; then[^\n]*\n[^\n]*::warning::[^\n]*\n\s*exit 0/.test(recordStep) && recordStep.indexOf('"$BUILT"') < recordStep.indexOf('gh release upload'),
      'a run that built nothing puts its record on a release an earlier run made'
    )
    assert.match(job, /permissions:\s*\n\s*contents: write/, 'the check cannot put the record on the release')
  })

  /*
   * A NEW COMPUTER VERSION ONLY WHEN THE COMPUTER'S OWN PART CHANGED.
   *
   * "Fewer, smaller computer updates. The computer app put out 28 versions in
   * 4 days, and every Mac downloads the full 140 MB each time … After the
   * fix: a new computer version only when its own part changed, small Mac
   * updates, and the red line only when it really matters."
   *
   * scripts/computer-fingerprint.mjs says what is inside the computer app,
   * and desktop.yml's decide job skips the release when that is what the
   * newest computer release was made from. These hold the parts that are easy
   * to get wrong in a way nobody would see: a file that ends up in the app
   * but not in the fingerprint is a change that never reaches a computer.
   */
  const fingerprintTree = (files) => {
    const dir = mkdtempSync(join(tmpdir(), 'computer-fp-'))
    for (const [path, body] of Object.entries(files)) {
      if (body === null) continue
      mkdirSync(join(dir, path, '..'), { recursive: true })
      writeFileSync(join(dir, path), body)
    }
    return dir
  }
  const FIXTURE = {
    'index.html': '<!doctype html><script type="module" src="/src/main.jsx"></script>',
    'vite.config.js': 'export default {}\n',
    'package.json': JSON.stringify({ name: 'x', version: '1.0.0', dependencies: { react: '^18.3.1' } }),
    'package-lock.json': JSON.stringify({ name: 'x', version: '1.0.0', lockfileVersion: 3, packages: { '': { name: 'x', version: '1.0.0' } } }),
    'scripts/vendor-forgefx.mjs': '// fetches the device server\n',
    '.github/workflows/desktop.yml': 'name: desktop\n',
    'src/main.jsx': [
      "import './styles.css'",
      "import App from './App'",
      "import rules from '../shared/rules.mjs'",
      "import pic from '../mobile/assets/a.png'",
      "import notes from './notes.txt?raw'",
      "import { createRoot } from 'react-dom/client'",
      "export * from './more.js'",
      "const later = () => import('./lazy.js')",
      "const worker = new URL('./worker.js', import.meta.url)",
      'createRoot(document.body).render(<App rules={rules} pic={pic} notes={notes} later={later} worker={worker} />)'
    ].join('\n'),
    'src/App.jsx': 'export default function App() { return <div /> }\n',
    'src/styles.css': "@import './more.css';\n.a { background: url('/icon.svg') }\n.b { background: url(data:image/png;base64,AA==) }\n",
    'src/more.css': '.c {}\n',
    'src/more.js': 'export const more = 1\n',
    'src/notes.txt': 'hello\n',
    'src/lazy.js': 'export const lazy = 1\n',
    'src/worker.js': 'self.onmessage = () => {}\n',
    'shared/rules.mjs': 'export default 1\n',
    'shared/phone-only.mjs': 'export const phone = 1\n',
    'mobile/assets/a.png': 'not really a png',
    'mobile/src/screens/Stage.js': 'export default null\n',
    'public/icon.svg': '<svg/>',
    'public/privacy.html': 'privacy',
    'public/support.html': 'support',
    'desktop/main.js': 'main\n',
    'desktop/package.json': JSON.stringify({ name: 'd', version: '1.0.0', dependencies: { 'electron-updater': '^6.3.9' } }),
    'desktop/forgefx.lock.json': JSON.stringify({ _why: ['why'], forgefx: { repo: 'a/b', commit: 'a'.repeat(40) } }),
    'desktop/README.md': 'readme',
    'docs/notes.md': 'docs',
    'CLAUDE.md': 'notes'
  }

  test('the computer fingerprint is made of what ends up in the computer app, and nothing else', async () => {
    const fp = await import('../scripts/computer-fingerprint.mjs')
    const base = fingerprintTree(FIXTURE)
    try {
      const inputs = fp.computerInputs(base)
      /* Followed the way vite follows it: imports, re-exports, a lazy import,
         a worker's address, CSS @import and url(), a ?raw import, and a
         reach out of src/ into shared/ and mobile/assets. */
      for (const want of ['src/main.jsx', 'src/App.jsx', 'src/styles.css', 'src/more.css', 'src/more.js', 'src/notes.txt', 'src/lazy.js', 'src/worker.js', 'shared/rules.mjs', 'mobile/assets/a.png', 'public/icon.svg', 'public/privacy.html', 'desktop/main.js', 'desktop/package.json', 'desktop/forgefx.lock.json', 'index.html', 'vite.config.js', 'package.json', 'package-lock.json', 'scripts/vendor-forgefx.mjs', '.github/workflows/desktop.yml']) {
        assert.ok(inputs.includes(want), `${want} ends up in the computer app and is not in its fingerprint`)
      }
      for (const not of ['public/support.html', 'desktop/README.md', 'docs/notes.md', 'CLAUDE.md', 'mobile/src/screens/Stage.js', 'shared/phone-only.mjs']) {
        assert.ok(!inputs.includes(not), `${not} is in the computer fingerprint, so changing it makes a computer release for nothing`)
      }

      const hashWith = (changes) => {
        const dir = fingerprintTree({ ...FIXTURE, ...changes })
        try {
          return fp.computerFingerprint(dir).hash
        } finally {
          rmSync(dir, { recursive: true, force: true })
        }
      }
      const same = fp.computerFingerprint(base).hash
      assert.match(same, /^[0-9a-f]{64}$/)
      assert.equal(hashWith({}), same, 'the same files gave two fingerprints')

      /* The version number moves on every merge by rule, so on its own it is never a computer release. */
      assert.equal(
        hashWith({
          'package.json': FIXTURE['package.json'].replace('1.0.0', '1.0.1'),
          'package-lock.json': FIXTURE['package-lock.json'].replaceAll('1.0.0', '1.0.1'),
          'desktop/package.json': FIXTURE['desktop/package.json'].replace('1.0.0', '1.0.1')
        }),
        same,
        'a version number alone made a new computer release'
      )
      assert.equal(hashWith({ 'desktop/forgefx.lock.json': FIXTURE['desktop/forgefx.lock.json'].replace('"why"', '"a longer story"') }), same, 'the pin’s story alone made a new computer release')
      for (const [path, body] of [
        ['public/support.html', 'a website page'],
        ['desktop/README.md', 'the desktop notes'],
        ['docs/notes.md', 'docs'],
        ['mobile/src/screens/Stage.js', 'a phone screen'],
        ['shared/phone-only.mjs', 'export const phone = 2\n'],
        ['supabase/functions/x/index.ts', 'a server function']
      ]) {
        assert.equal(hashWith({ [path]: body }), same, `a change to ${path} made a computer release, and nothing inside the computer app changed`)
      }

      for (const [path, body] of [
        ['src/App.jsx', 'export default function App() { return <span /> }\n'],
        ['shared/rules.mjs', 'export default 2\n'],
        ['mobile/assets/a.png', 'another picture'],
        ['src/more.css', '.c { color: red }\n'],
        ['src/notes.txt', 'goodbye\n'],
        ['src/lazy.js', 'export const lazy = 2\n'],
        ['src/worker.js', '\n'],
        ['public/privacy.html', 'privacy, revised'],
        ['public/icon.svg', '<svg></svg>'],
        ['public/new.txt', 'a new public file counts until somebody says it does not'],
        ['desktop/main.js', 'main, changed\n'],
        ['desktop/lib/new.mjs', 'export {}\n'],
        ['desktop/forgefx.lock.json', FIXTURE['desktop/forgefx.lock.json'].replace('a'.repeat(40), 'b'.repeat(40))],
        ['package.json', FIXTURE['package.json'].replace('^18.3.1', '^18.3.2')],
        ['desktop/package.json', FIXTURE['desktop/package.json'].replace('^6.3.9', '^6.4.0')],
        ['index.html', FIXTURE['index.html'] + '<link rel="icon" href="/icon.svg">'],
        ['vite.config.js', 'export default { base: "/" }\n'],
        ['scripts/vendor-forgefx.mjs', '// fetches it differently\n'],
        ['.github/workflows/desktop.yml', 'name: desktop, built differently\n']
      ]) {
        assert.notEqual(hashWith({ [path]: body }), same, `a change to ${path} goes into the computer app and made no computer release`)
      }
    } finally {
      rmSync(base, { recursive: true, force: true })
    }
  })

  test('the computer fingerprint refuses an import it cannot follow, rather than missing it', async () => {
    /*
     * A file it cannot see is a change it cannot see. So an import style the
     * walk cannot follow fails it outright — the decide job then publishes,
     * which is what happened before any of this — and fails this test at
     * the pull request, where somebody can teach it.
     */
    const fp = await import('../scripts/computer-fingerprint.mjs')
    for (const [main, said] of [
      ["const name = './App.jsx'\nimport(name)\n", /worked out while it runs/],
      ["const all = import.meta.glob('./*.jsx')\n", /import\.meta\.glob/],
      ["const name = './w.js'\nnew URL(name, import.meta.url)\n", /worked-out name/],
      ["import './Missing.jsx'\n", /cannot find "\.\/Missing\.jsx"/]
    ]) {
      const dir = fingerprintTree({ ...FIXTURE, 'src/main.jsx': main })
      try {
        assert.throws(() => fp.computerFingerprint(dir), said, `the fingerprint quietly passed over: ${main.trim()}`)
      } finally {
        rmSync(dir, { recursive: true, force: true })
      }
    }
    /* And a file that is always in the app, gone, is not quietly left out. */
    const gone = fingerprintTree({ ...FIXTURE, 'vite.config.js': null })
    try {
      assert.throws(() => fp.computerFingerprint(gone), /vite\.config\.js is gone/)
    } finally {
      rmSync(gone, { recursive: true, force: true })
    }
  })

  test('this repository’s computer fingerprint reaches every part of the app, and no website page', async () => {
    const fp = await import('../scripts/computer-fingerprint.mjs')
    const root = fileURLToPath(new URL('..', import.meta.url))
    /*
     * The web app reaches out of src/ and shared/: the download link and the
     * project rules from mobile/src/lib, desktop/lib/project.mjs, the block
     * icons and the welcome pictures from mobile/assets. A fingerprint over a
     * list of folders would miss every one. When this was written the walk
     * matched vite's own module list for a real build exactly, 251 files.
     */
    const bundle = fp.bundleInputs(root)
    for (const want of ['src/main.jsx', 'src/App.jsx', 'src/styles.css', 'shared/link-chain.mjs', 'shared/versions.mjs', 'mobile/src/lib/downloadLink.js', 'desktop/lib/project.mjs', 'mobile/assets/unit-plain.png']) {
      assert.ok(bundle.includes(want), `the web app is built from ${want} and the computer fingerprint does not know it`)
    }
    assert.ok(bundle.length > 200, `the walk found only ${bundle.length} files of the web app`)
    assert.ok(!bundle.some((f) => f.startsWith('mobile/src/screens/') || f === 'mobile/App.js'), 'a phone screen is in the web app, or the walk is following the wrong imports')

    const inputs = fp.computerInputs(root)
    for (const want of ['desktop/main.js', 'desktop/preload.js', 'desktop/electron-builder.yml', 'desktop/forgefx.lock.json', 'desktop/notarise.js', 'scripts/vendor-forgefx.mjs', 'public/privacy.html', 'public/notices.txt', 'public/manifest.webmanifest', 'index.html', 'package-lock.json', '.github/workflows/desktop.yml']) {
      assert.ok(inputs.includes(want), `${want} is part of the computer app and not of its fingerprint`)
    }
    assert.ok(inputs.some((f) => f.startsWith('public/gear/')), 'the gear pictures the computer window draws are not in its fingerprint')
    for (const f of inputs) {
      assert.ok(!/^(docs|supabase|test)\//.test(f) && !/(^|\/)(README|CLAUDE|CHANGELOG)\.md$/.test(f), `${f} is in the computer fingerprint and is not in the computer app`)
    }
    assert.ok(!inputs.includes('mobile/app.json') && !inputs.includes('mobile/package.json'), 'the phone app’s build settings are in the computer fingerprint')

    /*
     * THE WEBSITE-ONLY PAGES ARE NEVER OPENED FROM THE COMPUTER WINDOW, which
     * is the whole reason they may be left out. Each is a real file, and
     * nothing in the web app links its local copy (a link to the website's
     * own address is fine: that is served by the website).
     */
    for (const page of fp.WEBSITE_ONLY) {
      assert.ok(existsSync(join(root, page)), `${page} is left out of the computer fingerprint and does not exist`)
      assert.ok(!inputs.includes(page), `${page} is website-only and in the fingerprint`)
    }
    const names = fp.WEBSITE_ONLY.map((p) => p.replace('public/', '').replace(/\.(html|json)$/, '').replace(/[.-]/g, '\\$&'))
    const localLink = new RegExp(`["'\`(]\\.?/(${names.join('|')})(\\.html|\\.json)?["'\`)?#]`)
    for (const file of [...walk(new URL('../src/', import.meta.url)), fileURLToPath(new URL('../index.html', import.meta.url))]) {
      const m = localLink.exec(readFileSync(file, 'utf8'))
      assert.ok(!m, `${file.split('/src/')[1] || 'index.html'} links ${m?.[0]} from the computer's own copy, so it is not website-only any more`)
    }
    /* No import style the walk cannot follow, anywhere in the web app. */
    for (const file of walk(new URL('../src/', import.meta.url))) {
      const text = readFileSync(file, 'utf8')
      assert.ok(!/import\.meta\.glob/.test(text), `${file.split('/src/')[1]} uses import.meta.glob, which the computer fingerprint cannot follow`)
    }
  })

  test('only a merge to main whose computer app is unchanged skips the release, and doubt never does', async () => {
    const { decide, pickBase, FORMAT, RECORD } = await import('../scripts/computer-fingerprint.mjs')
    const fingerprint = { format: FORMAT, hash: 'a'.repeat(64), files: {} }
    const record = { format: FORMAT, hash: 'a'.repeat(64) }
    const merge = { event: 'push', ref: 'refs/heads/main', fingerprint, record, baseTag: 'v1.87.30', needed: '1.87.23' }
    assert.deepEqual(decide(merge), { skip: true, why: 'nothing inside the computer app changed since v1.87.30' })
    for (const [change, why] of [
      [{ record: { ...record, hash: 'b'.repeat(64) } }, 'the computer app changed'],
      [{ record: null }, 'the newest release carries no record'],
      [{ record: { format: FORMAT + 1, hash: record.hash } }, 'the record was worked out another way'],
      [{ record: { format: FORMAT } }, 'the record has no hash'],
      [{ baseTag: null }, 'there is no computer release at all'],
      [{ fingerprint: null }, 'the fingerprint could not be worked out'],
      [{ needed: '1.87.31' }, 'the phones need a newer computer app than the newest release'],
      [{ ref: 'refs/tags/desktop-v1.87.31' }, 'a desktop-v tag'],
      [{ event: 'workflow_dispatch', publishBox: true }, 'the Publish box'],
      [{ event: 'workflow_dispatch' }, 'a hand-started build'],
      [{ event: 'pull_request', ref: 'refs/pull/9/merge' }, 'a pull request'],
      [{ ref: 'refs/heads/some-branch' }, 'a push to another branch']
    ]) {
      const said = decide({ ...merge, ...change })
      assert.equal(said.skip, false, `skipped the release when ${why}`)
      assert.ok(said.why.length > 10, `no reason given when ${why}`)
    }
    assert.match(decide({ ...merge, record: null }).why, new RegExp(`v1\\.87\\.30 carries no ${RECORD.replace('.', '\\.')}`))

    /*
     * Compared with the newest COMPUTER release by when it was published:
     * not an Android one, not the stray v2 or watch-screenshots tags, not a
     * draft or a prerelease, and not the highest number (it was reset from
     * 7.397.0 to 1.0.0 once).
     */
    const rel = (tag_name, published_at, extra = {}) => ({ tag_name, published_at, draft: false, prerelease: false, assets: [], ...extra })
    const list = [
      rel('apk-v1.87.40', '2026-10-20T10:00:00Z'),
      rel('v2', '2026-10-21T00:00:00Z'),
      rel('watch-screenshots', '2026-10-21T00:00:00Z'),
      rel('v1.87.39', '2026-10-19T12:00:00Z', { draft: true }),
      rel('v1.87.38', '2026-10-19T11:00:00Z', { prerelease: true }),
      rel('v1.87.29', '2026-10-17T00:00:00Z'),
      rel('v1.87.30', '2026-10-18T00:00:00Z'),
      rel('v7.397.0', '2026-09-01T00:00:00Z')
    ]
    assert.equal(pickBase(list)?.tag_name, 'v1.87.30', 'the merge is compared with the wrong release')
    assert.equal(pickBase([]), null)
    assert.equal(pickBase(null), null)
  })

  test('the decide step reads the newest computer release, and says skip only when its record matches', async () => {
    /*
     * The CI half of the decision, against a GitHub of the test's own: the
     * releases list (two pages, so the paging is real), the record on the
     * newest computer release, and the outputs the jobs read. Every way
     * GitHub can let it down is a release.
     */
    const fp = await import('../scripts/computer-fingerprint.mjs')
    const tree = fingerprintTree(FIXTURE)
    const work = mkdtempSync(join(tmpdir(), 'computer-decide-'))
    try {
      const now = fp.computerFingerprint(tree)
      const recordUrl = 'https://github.com/x/y/releases/download/v1.87.30/computer-fingerprint.json'
      const page1 = Array.from({ length: 100 }, (_, i) => ({ tag_name: `apk-v1.87.${100 + i}`, published_at: '2026-10-20T00:00:00Z', assets: [] }))
      const page2 = [
        { tag_name: 'v1.87.30', published_at: '2026-10-18T00:00:00Z', draft: false, prerelease: false, assets: [{ name: 'latest-mac.yml' }, { name: fp.RECORD, browser_download_url: recordUrl }] },
        { tag_name: 'v1.87.29', published_at: '2026-10-17T00:00:00Z', draft: false, prerelease: false, assets: [] }
      ]
      const github = ({ record = now, list = [page1, page2], recordStatus = 200, down = false } = {}) => {
        const asked = []
        const get = async (url, init = {}) => {
          asked.push({ url, auth: init.headers?.Authorization || null })
          if (down) throw new Error('getaddrinfo ENOTFOUND api.github.com')
          if (url === recordUrl) return { ok: recordStatus === 200, status: recordStatus, text: async () => JSON.stringify(record) }
          const page = Number(new URL(url).searchParams.get('page'))
          return { ok: true, status: 200, json: async () => list[page - 1] || [] }
        }
        return { get, asked }
      }
      const run = async (env, gh = github()) => {
        const output = join(work, `out-${Math.random()}`)
        const said = await fp.inCi({ GITHUB_EVENT_NAME: 'push', GITHUB_REF: 'refs/heads/main', GH_TOKEN: 'secret', GITHUB_OUTPUT: output, ...env }, join(work, 'record.json'), { fetch: gh.get, root: tree, log: () => {} })
        const outputs = Object.fromEntries(readFileSync(output, 'utf8').trim().split('\n').map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]))
        return { said, outputs, asked: gh.asked }
      }

      const same = await run({})
      assert.equal(same.outputs.skip, 'true', `a merge with nothing changed inside the computer app made a release: ${same.outputs.why}`)
      assert.equal(same.outputs.base, 'v1.87.30', 'the merge was not compared with the newest computer release, a page down below the Android ones')
      assert.equal(same.outputs.fingerprint, now.hash)
      assert.deepEqual(JSON.parse(readFileSync(join(work, 'record.json'), 'utf8')).files, now.files, 'the record for the release is not what was fingerprinted')
      assert.equal(same.asked.find((a) => a.url === recordUrl).auth, null, 'the token is sent on to where GitHub keeps the file')
      assert.ok(same.asked.filter((a) => a.url.includes('/releases?')).every((a) => a.auth === 'Bearer secret'), 'the releases are read without the token')

      const changed = await run({}, github({ record: { ...now, hash: 'f'.repeat(64), files: { ...now.files, 'src/App.jsx': 'old' } } }))
      assert.equal(changed.outputs.skip, 'false')
      assert.deepEqual(changed.said.changed, ['src/App.jsx'], 'the summary does not say what changed inside the computer app')

      for (const [gh, why] of [
        [github({ list: [[...page2.map((r) => ({ ...r, assets: [] }))]] }), 'no record on the newest release'],
        [github({ recordStatus: 404 }), 'the record not answering'],
        [github({ record: 'not a record' }), 'a record that is not one'],
        [github({ down: true }), 'GitHub not answering'],
        [github({ list: [[]] }), 'no computer release at all']
      ]) {
        const r = await run({}, gh)
        assert.equal(r.outputs.skip, 'false', `skipped the release with ${why}`)
        assert.ok(r.outputs.why.length > 10, `no reason given for ${why}`)
      }
      /* Anything but a merge to main asks GitHub nothing and skips nothing. */
      for (const env of [{ GITHUB_EVENT_NAME: 'pull_request', GITHUB_REF: 'refs/pull/9/merge' }, { GITHUB_EVENT_NAME: 'workflow_dispatch', PUBLISH_BOX: 'true' }, { GITHUB_REF: 'refs/tags/desktop-v1.87.31' }]) {
        const r = await run(env)
        assert.equal(r.outputs.skip, 'false', `${JSON.stringify(env)} skipped`)
        assert.equal(r.asked.length, 0, `${JSON.stringify(env)} asked GitHub for releases it does not need`)
      }
      /* And a tree it cannot fingerprint is a release, with no record to put on it. */
      const broken = fingerprintTree({ ...FIXTURE, 'src/main.jsx': "import './Missing.jsx'\n" })
      try {
        const output = join(work, 'broken-out')
        const r = await fp.inCi({ GITHUB_EVENT_NAME: 'push', GITHUB_REF: 'refs/heads/main', GITHUB_OUTPUT: output }, join(work, 'broken.json'), { fetch: github().get, root: broken, log: () => {} })
        assert.equal(r.skip, false)
        assert.ok(!existsSync(join(work, 'broken.json')), 'a record was written for a tree that could not be fingerprinted')
        assert.match(readFileSync(output, 'utf8'), /^skip=false$/m)
      } finally {
        rmSync(broken, { recursive: true, force: true })
      }
    } finally {
      rmSync(tree, { recursive: true, force: true })
      rmSync(work, { recursive: true, force: true })
    }
  })

  test('the decide step reads only as far as the newest computer release, however many releases there are', async () => {
    /*
     * Every merge makes an Android release and many make a computer one:
     * 325 on 15 October 2026, about ten more a day. Reading all of them
     * with a limit of twenty pages would have hit it within months, and
     * every merge after that would have made a computer version again,
     * quietly. GitHub lists them newest made first, so reading stops one
     * page past the first computer release, the extra page for one that was
     * made a little earlier and published later.
     */
    const fp = await import('../scripts/computer-fingerprint.mjs')
    const PAGES = fp.MOST_PAGES + 5
    const releases = ({ computerAt = [] } = {}) => {
      const list = []
      for (let i = 0; i < PAGES * 100; i++) {
        list.push({ tag_name: `apk-v1.${9000 - i}.0`, published_at: new Date(Date.UTC(2027, 0, 1) - i * 3600e3).toISOString(), draft: false, prerelease: false, assets: [] })
      }
      for (const [at, release] of computerAt) list[at] = { draft: false, prerelease: false, assets: [], ...release }
      return list
    }
    const github = (list) => {
      const pages = []
      const get = async (url) => {
        const page = Number(new URL(url).searchParams.get('page'))
        pages.push(page)
        return { ok: true, status: 200, json: async () => list.slice((page - 1) * 100, page * 100) }
      }
      return { get, pages }
    }

    const list = releases({
      computerAt: [
        [150, { tag_name: 'v1.87.30', published_at: '2026-12-20T00:00:00Z' }],
        /* Made earlier, published later: a page further down, and still the newest. */
        [260, { tag_name: 'v1.87.31', published_at: '2026-12-21T00:00:00Z' }],
        [2300, { tag_name: 'v1.87.29', published_at: '2026-10-01T00:00:00Z' }]
      ]
    })
    const gh = github(list)
    const read = await fp.recentReleases(gh.get, 'x/y', 'secret')
    assert.deepEqual(gh.pages, [1, 2, 3], 'the releases are read further than the page past the first computer one')
    assert.equal(read.length, 300)
    assert.equal(fp.pickBase(read)?.tag_name, 'v1.87.31', 'a release published later, a page down, is missed')

    /* A short page is the end of the list, wherever it comes. */
    const short = github(list.slice(0, 120))
    assert.equal((await fp.recentReleases(short.get, 'x/y')).length, 120)
    assert.deepEqual(short.pages, [1, 2])

    /*
     * The first computer release below the most pages it reads, and the list
     * longer than that: an error, so a release, and that release is on the
     * first page for the next merge. Never a skip.
     */
    const deep = github(releases({ computerAt: [[fp.MOST_PAGES * 100 + 10, { tag_name: 'v1.87.30', published_at: '2027-02-01T00:00:00Z' }]] }))
    await assert.rejects(fp.recentReleases(deep.get, 'x/y'), /no computer release in the newest 2000 releases/)
    assert.equal(Math.max(...deep.pages), fp.MOST_PAGES, 'it read past the most pages it should')

    const tree = fingerprintTree(FIXTURE)
    const work = mkdtempSync(join(tmpdir(), 'computer-deep-'))
    try {
      const output = join(work, 'out')
      const r = await fp.inCi({ GITHUB_EVENT_NAME: 'push', GITHUB_REF: 'refs/heads/main', GITHUB_OUTPUT: output }, join(work, 'record.json'), { fetch: github(releases()).get, root: tree, log: () => {} })
      assert.equal(r.skip, false, 'no computer release in reach was read as nothing to do')
      assert.match(readFileSync(output, 'utf8'), /^skip=false$/m)
      assert.match(r.why, /no computer release in the newest/)
    } finally {
      rmSync(tree, { recursive: true, force: true })
      rmSync(work, { recursive: true, force: true })
    }
  })

  test('the decide job runs first, and only its yes skips anything', () => {
    const wf = read('.github/workflows/desktop.yml')
    const jobBody = (name) => {
      const at = wf.indexOf(`\n  ${name}:\n`)
      assert.notEqual(at, -1, `the ${name} job is gone`)
      const next = wf.slice(at + 1).search(/\n {2}[a-z][a-z0-9-]*:\n/)
      return next === -1 ? wf.slice(at) : wf.slice(at, at + 1 + next)
    }
    const decideJob = jobBody('decide')
    assert.ok(wf.indexOf('\n  decide:\n') < wf.indexOf('\n  release:\n'), 'decide is not the first job')
    assert.match(decideJob, /node scripts\/computer-fingerprint\.mjs --decide/, 'decide does not ask the fingerprint')
    assert.match(decideJob, /skip: \$\{\{ steps\.decide\.outputs\.skip \}\}/, 'decide says nothing the other jobs can read')
    assert.match(decideJob, /PUBLISH_BOX: \$\{\{ inputs\.publish \}\}/, 'decide cannot tell that the Publish box was ticked')

    const release = jobBody('release')
    assert.match(release, /needs: decide\n/)
    assert.match(release, /if: \$\{\{ !cancelled\(\) && needs\.decide\.outputs\.skip != 'true' && \(startsWith/, 'the release is made when decide said skip, or not made when decide broke')
    for (const name of ['mac', 'windows', 'linux']) {
      const job = jobBody(name)
      assert.match(job, /needs: \[decide, release\]/, `the ${name} build does not wait for decide`)
      assert.match(job, /if: \$\{\{ always\(\) && needs\.decide\.outputs\.skip != 'true' && needs\.release\.result != 'failure'/, `the ${name} build ignores decide`)
      /*
       * A run stopped while decide is working leaves `release` skipped, not
       * cancelled, and `always()` would then start every build anyway: four
       * of them making the release at once, the 1.14.0 race. Only a cancel:
       * a decide that FAILED still lets them run, and publish, as before.
       */
      const cond = job.match(/\n {4}if: \$\{\{ (.*) \}\}\n/)?.[1] || ''
      assert.match(cond, /&& needs\.decide\.result != 'cancelled'/, `the ${name} build publishes into a release nobody made when the run is stopped during decide`)
      assert.ok(!/needs\.decide\.result == 'success'|needs\.decide\.result != 'failure'/.test(cond), `a decide that broke stops the ${name} build, when doubt should publish`)
    }
    /* `!= 'true'` everywhere: a decide job that failed says nothing, and nothing must read as skip. */
    assert.ok(!/outputs\.skip == /.test(wf), 'a job waits for decide to say skip=false, so a broken decide skips the release')
    assert.match(wf, /pull_request:\n {4}paths:[\s\S]*?'scripts\/computer-fingerprint\.mjs'/, 'a change to the decision itself is never built on a pull request')
  })

  test('a computer version already out is never published again, by hand or by tag', () => {
    /*
     * The Publish box and a desktop-v tag make the release for whatever
     * version desktop/package.json says. When that version already had one
     * (the merge it came in on made it), the run went green having put
     * nothing on any computer: electron-builder will not upload into a
     * release published more than two hours ago (electron-publish's
     * gitHubPublisher logs "skipped publishing" and returns), and the
     * complete job then found the old files and passed. Inside the two
     * hours it swapped a live release's files under a number no computer
     * that has it takes again. Run the step itself, on a stand-in GitHub,
     * for every way it can be met.
     */
    if (process.platform === 'win32') return
    const wf = read('.github/workflows/desktop.yml')
    const script = (() => {
      const raw = wf.slice(wf.indexOf('- name: The release exists before anything uploads to it'))
      const body = raw.slice(raw.indexOf('run: |\n') + 'run: |\n'.length)
      const lines = []
      for (const line of body.split('\n')) {
        if (line.trim() && !line.startsWith('          ')) break
        lines.push(line.slice(10))
      }
      return lines.join('\n')
    })()
    assert.match(script, /gh release create "\$tag"/, 'the release step no longer makes the release')

    const HOUR = 3600 * 1000
    const releaseWith = ({ event = 'push', ref = 'refs/heads/main', exists, publishedMsAgo = 0, record = false, deleteFails = false }) => {
      const root = mkdtempSync(join(tmpdir(), 'release-'))
      try {
        const bin = join(root, 'bin')
        mkdirSync(bin)
        mkdirSync(join(root, 'desktop'))
        writeFileSync(join(root, 'desktop', 'package.json'), '{"version":"1.87.31"}\n')
        const published = new Date(Date.now() - publishedMsAgo).toISOString().replace(/\.\d+Z$/, 'Z')
        const assets = ['Fractal-Remote-1.87.31-arm64-mac.zip', 'latest-mac.yml', ...(record ? ['computer-fingerprint.json'] : [])]
        const gh = [
          '#!/bin/sh',
          `echo "gh $*" >> "${join(root, 'asked')}"`,
          'case "$1 $2" in',
          `  "release view") ${exists ? '' : 'exit 1;'} case "$*" in *publishedAt*) echo "${published}";; *assets*) printf '%s\\n' ${assets.join(' ')};; esac; exit 0;;`,
          `  "release delete-asset") exit ${deleteFails ? 1 : 0};;`,
          '  "release create") exit 0;;',
          'esac',
          'exit 1'
        ].join('\n')
        writeFileSync(join(bin, 'gh'), `${gh}\n`)
        chmodSync(join(bin, 'gh'), 0o755)
        const summary = join(root, 'summary')
        const out = spawnSync('bash', ['-c', script], {
          cwd: root,
          env: {
            PATH: `${bin}:${join(process.execPath, '..')}:/usr/bin:/bin`,
            GITHUB_EVENT_NAME: event,
            GITHUB_REF: ref,
            GITHUB_REPOSITORY: 'justinnewbold/fractal-remote',
            GITHUB_SHA: 'abc123',
            GITHUB_STEP_SUMMARY: summary
          },
          encoding: 'utf8'
        })
        let asked = ''
        try {
          asked = readFileSync(join(root, 'asked'), 'utf8')
        } catch {
          asked = ''
        }
        return {
          code: out.status,
          out: `${out.stdout}${out.stderr}`,
          made: /gh release create v1\.87\.31/.test(asked),
          tookRecord: /gh release delete-asset v1\.87\.31 computer-fingerprint\.json --yes/.test(asked)
        }
      } finally {
        rmSync(root, { recursive: true, force: true })
      }
    }

    // A merge whose version has no release: made, as always.
    const merge = releaseWith({ exists: false })
    assert.equal(merge.code, 0, merge.out)
    assert.ok(merge.made, 'a merge with something new inside the computer app makes no release')
    // The Publish box, or a desktop-v tag, on a version with no release yet: made. This is the way to force one.
    for (const forced of [{ event: 'workflow_dispatch' }, { ref: 'refs/tags/desktop-v1.87.31' }]) {
      const fresh = releaseWith({ ...forced, exists: false })
      assert.equal(fresh.code, 0, fresh.out)
      assert.ok(fresh.made, `a forced run (${JSON.stringify(forced)}) on a new number makes no release`)
    }
    // The same, on a version already out: red, at once or hours later, and it says how to do it instead.
    for (const forced of [{ event: 'workflow_dispatch' }, { ref: 'refs/tags/desktop-v1.87.31' }]) {
      for (const publishedMsAgo of [10 * 60 * 1000, 5 * HOUR]) {
        const again = releaseWith({ ...forced, exists: true, publishedMsAgo, record: true })
        assert.notEqual(again.code, 0, `a forced run (${JSON.stringify(forced)}) on v1.87.31, already out, goes green and puts nothing new on any computer`)
        assert.ok(!again.made)
        assert.match(again.out, /::error::v1\.87\.31 is already a computer release[\s\S]*Merge a change first[\s\S]*tick Publish on main/, 'a forced run on a version already out does not say how to put one out')
        /* It writes nothing into the release, so the record on it is still true. */
        assert.ok(!again.tookRecord, 'a forced run that writes nothing takes the record off a whole release')
      }
    }
    // A merge's run meeting its own release within the two hours (a re-run): carries on, as before.
    const rerun = releaseWith({ exists: true, publishedMsAgo: 20 * 60 * 1000 })
    assert.equal(rerun.code, 0, rerun.out)
    assert.match(rerun.out, /v1\.87\.31 is already there; nothing to make\./)
    assert.ok(!rerun.tookRecord, 'a release with no record is asked to delete one')
    /*
     * And when that release already carries a record, it comes off before
     * anything is written into it again. electron-builder puts a file that
     * is already there up again by deleting it first (electron-publish's
     * overwriteArtifact), so a re-run failing between the two leaves the
     * release short of a file while the record says it is whole, and the
     * next phone-only merge would skip and leave the gap there.
     */
    const rerunRecorded = releaseWith({ exists: true, publishedMsAgo: 20 * 60 * 1000, record: true })
    assert.equal(rerunRecorded.code, 0, rerunRecorded.out)
    assert.ok(rerunRecorded.tookRecord, 'a re-run writes into a release whose record still says it is whole')
    assert.match(rerunRecorded.out, /took computer-fingerprint\.json off v1\.87\.31[\s\S]*v1\.87\.31 is already there; nothing to make\./)
    /* If it cannot come off, nothing is written: the step stops red, and the builds after it are skipped. */
    const stuck = releaseWith({ exists: true, publishedMsAgo: 20 * 60 * 1000, record: true, deleteFails: true })
    assert.notEqual(stuck.code, 0, 'a re-run carries on into a release whose record it could not take off')
    assert.ok(!/nothing to make/.test(stuck.out), stuck.out)
    // Any run meeting a release more than two hours old: red, because nothing it built would be uploaded.
    const stale = releaseWith({ exists: true, publishedMsAgo: 3 * HOUR, record: true })
    assert.notEqual(stale.code, 0, 'a run meeting a release more than two hours old goes green while every upload is skipped')
    assert.match(stale.out, /::error::v1\.87\.31 went out more than two hours ago/)
    assert.ok(!stale.tookRecord, 'a run that uploads nothing takes the record off a whole release')
  })

  test('a release that is not whole carries no computer fingerprint', () => {
    /*
     * The complete job puts the record on once every platform is there, and
     * takes it off again when the release is not whole any more. A re-run of
     * one build alone re-runs complete but not the release job, and that
     * build swaps its files one by one, each deleted before the new one goes
     * up. So a missing file, or a build of this run that failed or was
     * stopped (every name can still be there, a new zip under an old
     * latest-mac.yml that no longer matches it), takes the record off, and
     * the next merge makes a release instead of skipping. Run the step
     * itself, on a stand-in GitHub.
     */
    if (process.platform !== 'linux') return // GNU sed -i, as on the runner
    const wf = read('.github/workflows/desktop.yml')
    const job = wf.slice(wf.indexOf('\n  complete:'))
    const script = (() => {
      const raw = job.slice(job.indexOf('- name: Every platform is really on the release'))
      const body = raw.slice(raw.indexOf('run: |\n') + 'run: |\n'.length)
      const lines = []
      for (const line of body.split('\n')) {
        if (line.trim() && !line.startsWith('          ')) break
        lines.push(line.slice(10))
      }
      return lines.join('\n')
    })()
    assert.match(script, /exit 1/, 'the check no longer fails')

    const v = '1.87.31'
    const whole = [
      `Fractal-Remote-${v}.dmg`, `Fractal-Remote-${v}-arm64.dmg`,
      `Fractal-Remote-${v}-mac.zip`, `Fractal-Remote-${v}-arm64-mac.zip`,
      `Fractal-Remote-${v}-mac.zip.blockmap`, `Fractal-Remote-${v}-arm64-mac.zip.blockmap`, 'latest-mac.yml',
      `Fractal-Remote-Setup-${v}.exe`, `Fractal-Remote-Setup-${v}.exe.blockmap`, 'latest.yml',
      `Fractal-Remote-${v}.AppImage`, `fractal-remote-desktop_${v}_amd64.deb`, 'latest-linux.yml',
      `Fractal-Remote-${v}-arm64.AppImage`, `fractal-remote-desktop_${v}_arm64.deb`, 'latest-linux-arm64.yml'
    ]
    const checkWith = ({ assets, built = 'success success success', deleteFails = false }) => {
      const root = mkdtempSync(join(tmpdir(), 'complete-'))
      try {
        const bin = join(root, 'bin')
        mkdirSync(bin)
        mkdirSync(join(root, 'desktop'))
        writeFileSync(join(root, 'desktop', 'package.json'), `{"version":"${v}"}\n`)
        writeFileSync(join(root, 'assets'), `${assets.join('\n')}\n`)
        const gh = [
          '#!/bin/sh',
          `echo "gh $*" >> "${join(root, 'asked')}"`,
          'case "$1 $2" in',
          `  "release view") cat "${join(root, 'assets')}"; exit 0;;`,
          `  "release delete-asset") exit ${deleteFails ? 1 : 0};;`,
          'esac',
          'exit 1'
        ].join('\n')
        writeFileSync(join(bin, 'gh'), `${gh}\n`)
        chmodSync(join(bin, 'gh'), 0o755)
        const out = spawnSync('bash', ['-c', script], {
          cwd: root,
          env: {
            PATH: `${bin}:${join(process.execPath, '..')}:/usr/bin:/bin`,
            BUILT: built,
            GITHUB_REPOSITORY: 'justinnewbold/fractal-remote',
            GITHUB_STEP_SUMMARY: join(root, 'summary')
          },
          encoding: 'utf8'
        })
        let asked = ''
        try {
          asked = readFileSync(join(root, 'asked'), 'utf8')
        } catch {
          asked = ''
        }
        return { code: out.status, out: `${out.stdout}${out.stderr}`, tookRecord: new RegExp(`gh release delete-asset v${v.replace(/\./g, '\\.')} computer-fingerprint\\.json --yes`).test(asked) }
      } finally {
        rmSync(root, { recursive: true, force: true })
      }
    }
    const recorded = [...whole, 'computer-fingerprint.json']
    const short = recorded.filter((name) => name !== `Fractal-Remote-${v}-arm64-mac.zip`)

    // Whole, and every build green: passes, and the record stays for the record step to renew.
    const fine = checkWith({ assets: recorded })
    assert.equal(fine.code, 0, fine.out)
    assert.ok(!fine.tookRecord, 'a whole release built green loses its record')
    // A forced run the release job stopped built nothing and wrote nothing: the record is still true.
    const refused = checkWith({ assets: recorded, built: 'skipped skipped skipped' })
    assert.equal(refused.code, 0, refused.out)
    assert.ok(!refused.tookRecord, 'a run that wrote nothing takes the record off a whole release')
    // A file missing: red, the list of what is missing, and the record off.
    const gap = checkWith({ assets: short })
    assert.notEqual(gap.code, 0, 'a release missing the Apple Silicon zip passes the check')
    assert.match(gap.out, new RegExp(`missing:\\s*\\n\\s*Fractal-Remote-${v.replace(/\./g, '\\.')}-arm64-mac\\.zip`))
    assert.ok(gap.tookRecord, 'a release missing a file keeps a record saying it is whole, so the next phone-only merge skips and the gap stays')
    // The same with no record on it: nothing to take off, and nothing asked to.
    const gapBare = checkWith({ assets: short.filter((name) => name !== 'computer-fingerprint.json') })
    assert.notEqual(gapBare.code, 0)
    assert.ok(!gapBare.tookRecord, 'a release with no record is asked to delete one')
    // Every name there, but a build of this run failed or was stopped part of the way: the record comes off.
    for (const built of ['failure success success', 'success cancelled success', 'success success failure']) {
      const half = checkWith({ assets: recorded, built })
      assert.ok(half.tookRecord, `a build that ${built} may have swapped some files, and the record still says the release is whole`)
    }
    // And when it cannot come off, it says so, and still lists what is missing.
    const stuck = checkWith({ assets: short, deleteFails: true })
    assert.notEqual(stuck.code, 0)
    assert.match(stuck.out, /::error::computer-fingerprint\.json could not be taken off v1\.87\.31[\s\S]*missing:/, 'a record that could not be taken off goes unremarked')
    const stuckHalf = checkWith({ assets: recorded, built: 'failure success success', deleteFails: true })
    assert.notEqual(stuckHalf.code, 0, 'a record that could not be taken off a half-written release leaves the check green')
  })

  test('the Mac zips’ blockmaps go up under the name the updater asks for', async () => {
    /*
     * "Every Mac downloads the full 140 MB each time, because the file that
     * lets it fetch only the changes is uploaded under the wrong name."
     * electron-builder 25 hands the Mac zip's blockmap its RAW name, with the
     * space in "Fractal Remote", and GitHub turns the space into a dot. The
     * updater asks for the zip's own name plus .blockmap, and got 404 on
     * every Mac release.
     */
    const yml = read('desktop/electron-builder.yml')
    assert.match(yml, /^artifactBuildCompleted: blockmapNames\.js$/m, 'nothing renames the Mac blockmaps, so every Mac update is the full download')
    const files = yml.slice(yml.indexOf('\nfiles:'), yml.indexOf('\nasarUnpack:'))
    assert.ok(!/blockmapNames/.test(files), 'the build hook is packaged into the app')

    const { createRequire } = await import('node:module')
    const hook = createRequire(import.meta.url)('../desktop/blockmapNames.js').default
    assert.equal(typeof hook, 'function', 'electron-builder finds no hook in blockmapNames.js')
    const named = (file, safeArtifactName) => {
      const event = { file, safeArtifactName }
      hook(event)
      return event.safeArtifactName
    }
    const out = '/runner/desktop/release'
    assert.equal(named(`${out}/Fractal Remote-1.87.30-arm64-mac.zip.blockmap`, 'Fractal Remote-1.87.30-arm64-mac.zip.blockmap'), 'Fractal-Remote-1.87.30-arm64-mac.zip.blockmap')
    assert.equal(named(`${out}/Fractal Remote-1.87.30-mac.zip.blockmap`, null), 'Fractal-Remote-1.87.30-mac.zip.blockmap', 'a blockmap with no upload name goes up under its file name, space and all')
    /* Everything already right is left exactly as it was. */
    for (const [file, safe] of [
      [`${out}/Fractal Remote Setup 1.87.30.exe.blockmap`, 'Fractal-Remote-Setup-1.87.30.exe.blockmap'],
      [`${out}/Fractal-Remote-1.87.30-arm64.dmg.blockmap`, null],
      [`${out}/Fractal Remote-1.87.30-mac.zip`, 'Fractal-Remote-1.87.30-mac.zip'],
      [`${out}/Fractal Remote-1.87.30.AppImage`, 'Fractal-Remote-1.87.30.AppImage'],
      [`${out}/fractal-remote-desktop_1.87.30_amd64.deb`, null],
      [`${out}/Fractal Remote-1.87.30-mac.zip`, null]
    ]) {
      assert.equal(named(file, safe), safe, `${file.split('/').pop()} was renamed, and it was already right`)
    }
    assert.doesNotThrow(() => hook(undefined))
    assert.doesNotThrow(() => hook({}))

    /* And the releases already made, renamed by a script a person runs: dry by default. */
    const { renamesFor } = await import('../scripts/rename-blockmaps.mjs')
    const releases = [
      {
        tag_name: 'v1.87.4',
        assets: [
          { id: 1, name: 'Fractal.Remote-1.87.4-arm64-mac.zip.blockmap' },
          { id: 2, name: 'Fractal.Remote-1.87.4-mac.zip.blockmap' },
          { id: 3, name: 'Fractal-Remote-1.87.4.dmg.blockmap' },
          { id: 4, name: 'Fractal-Remote-Setup-1.87.4.exe.blockmap' },
          { id: 5, name: 'Fractal-Remote-1.87.4-mac.zip' }
        ]
      },
      { tag_name: 'v1.87.30', assets: [{ id: 6, name: 'Fractal-Remote-1.87.30-mac.zip.blockmap' }] },
      { tag_name: 'v1.87.29', assets: [{ id: 7, name: 'Fractal.Remote-1.87.29-mac.zip.blockmap' }, { id: 8, name: 'Fractal-Remote-1.87.29-mac.zip.blockmap' }] },
      { tag_name: 'apk-v1.87.4', assets: [{ id: 9, name: 'Fractal.Remote-1.87.4-mac.zip.blockmap' }] },
      { tag_name: 'v2', assets: [{ id: 10, name: 'Fractal.Remote-2-mac.zip.blockmap' }] }
    ]
    assert.deepEqual(renamesFor(releases), [
      { tag: 'v1.87.4', id: 1, from: 'Fractal.Remote-1.87.4-arm64-mac.zip.blockmap', to: 'Fractal-Remote-1.87.4-arm64-mac.zip.blockmap' },
      { tag: 'v1.87.4', id: 2, from: 'Fractal.Remote-1.87.4-mac.zip.blockmap', to: 'Fractal-Remote-1.87.4-mac.zip.blockmap' }
    ])
    const script = read('scripts/rename-blockmaps.mjs')
    assert.ok(script.indexOf('if (!apply)') !== -1 && script.indexOf('if (!apply)') < script.indexOf("method: 'PATCH'"), 'the rename script changes releases without being told to')
  })

  test('the oldest computer app the phones need is three numbers, and no newer than this app', async () => {
    /*
     * "The red line only shows when the phone really needs something the
     * computer doesn't have yet." COMPUTER_NEEDED is what it is measured
     * against. Above this app's own version it would tell every computer to
     * update to a version not made yet; anything but three numbers and
     * isOlder has no opinion, and the line would quietly never show.
     */
    const { COMPUTER_NEEDED, isOlder } = await import('../shared/versions.mjs')
    assert.match(COMPUTER_NEEDED, /^\d+\.\d+\.\d+$/, 'COMPUTER_NEEDED is not three plain numbers')
    const version = JSON.parse(read('package.json')).version
    assert.equal(isOlder(version, COMPUTER_NEEDED), false, `COMPUTER_NEEDED (${COMPUTER_NEEDED}) is above this app’s own version (${version})`)
    /* And the phone's copy says the same. */
    const phone = await import('../mobile/src/lib/versions.js')
    assert.equal(phone.COMPUTER_NEEDED, COMPUTER_NEEDED)
    /* CLAUDE.md says when it may be raised. */
    assert.match(read('CLAUDE.md'), /COMPUTER_NEEDED/, 'nothing tells the next change when to raise COMPUTER_NEEDED')
  })

  test('the downloads page reads enough releases to find the computer one', () => {
    /*
     * An Android release is made on every merge and a computer release only
     * when the computer's own part changes, so the newest computer release
     * can sit below thirty Android ones.
     */
    const page = read('public/downloads.html')
    assert.match(page, /\/releases\?per_page=100/, 'the downloads page reads too few releases to find the computer one')
  })

  test('the Android link is a bookmark rather than a thing to ask for', () => {
    /*
     * "Is there a link that I can just save to my bookmarks that will take me
     * and always show me what the latest link is, even if it doesn't download
     * directly, that way I don't have to keep asking for it."
     *
     * The APK's own address carries the version in it twice, so every build
     * makes a new address and any bookmark of one is stale the moment the next
     * build lands. This page's address never moves; what moves is what it
     * finds.
     *
     * THE FILTER IS THE WHOLE TRICK. The Mac app publishes into the same list
     * of releases, tagged `v` rather than `apk-v`, and both are cut from the
     * same commit — so GitHub's own /releases/latest can hand back the Mac one
     * and would send a phone a .dmg. And for the same reason the newest cannot
     * be "the one GitHub listed first": it sorts by when a release was
     * created, which the two share. The number in the tag decides.
     */
    const page = read('public/android.html')

    assert.match(page, /api\.github\.com\/repos\/' \+ REPO/, 'the page no longer asks GitHub what exists')
    assert.match(page, /justinnewbold\/fractal-remote/, 'the page names no repository')
    assert.match(page, /indexOf\('apk-v'\) === 0/, 'the page would offer a Mac release to a phone')
    /*
     * AND THE NEWEST IS THE MOST RECENTLY PUBLISHED, not the highest number.
     *
     * This sorted on the number in the tag, which was right for the problem it
     * was written for and wrong the moment the numbering was reset. The first
     * public release renumbers 7.397.0 down to 1.0.0, which puts every old
     * build above every new one — and this page would have gone on handing out
     * 7.397.0 for ever, to everybody, silently.
     *
     * The filter above already separates the Android builds from the Mac ones,
     * which is the job the number was doing. Within what is left, every APK is
     * published by a different run at a different minute, so the clock is
     * unambiguous and survives any renumbering.
     */
    assert.match(
      page,
      /\.sort\(\(a, b\) => when\(b\) - when\(a\)\)/,
      'the page picks the highest version number again, which freezes on the old builds the moment the numbering is reset'
    )
    assert.match(page, /Date\.parse\(r\.published_at/, 'the newest build is not decided by when it was published')
    assert.ok(
      !/const rank =/.test(page),
      'the version-number ranking is back; two ways to pick the newest is one way to pick the wrong one'
    )
    assert.match(page, /\/\\\.apk\$\/i/, 'the button no longer points at the APK itself')
    assert.match(page, /r\.draft/, 'a half-published build can be offered as the current one')

    /* Never a dead end. GitHub rate-limits by address, so an unlucky minute
       must still leave somewhere to go. */
    assert.match(page, /\.catch\(/, 'the page has nothing to say when GitHub does not answer')
    assert.match(page, /Open the releases page/, 'the failure case offers no way on')

    /*
     * And it is reachable without the extension, because a bookmark is typed
     * as often as it is tapped. The catch-all below sends everything that is
     * not a file on disk to the app, so this has to come first.
     */
    const vercel = JSON.parse(read('vercel.json'))
    const at = vercel.rewrites.findIndex((r) => r.source === '/android')
    const all = vercel.rewrites.findIndex((r) => r.source === '/(.*)')
    assert.ok(at !== -1, '/android goes to the app instead of the download page')
    assert.equal(vercel.rewrites[at].destination, '/android.html', '/android points somewhere else')
    assert.ok(at < all, '/android is behind the catch-all, so it never matches')

    /* Findable without the bookmark too, from the page a store sends people to. */
    assert.match(read('public/support.html'), /href="\/android"/, 'the support page does not say where the Android app comes from')
  })

  test('a store has somewhere to send people, and the app can be reviewed without hardware', () => {
    /*
     * Two things App Store Connect will not proceed without, and one that
     * decides whether the review succeeds.
     *
     * A support URL is required. And the reviewer will have no Fractal unit
     * and no computer running the device server — they open the app, see "no
     * computer", and reject it as non-functional. The demo is one tap away on
     * the first screen, but only if the review notes say so.
     */
    const support = read('public/support.html')
    assert.match(support, /justinnewbold@gmail\.com/, 'the support page offers no way to reach anybody')
    assert.match(support, /Feedback/, 'the support page never points at the in-app report')
    /* Either address serves the same page now that /privacy is routed, so the
       check is that the link is THERE rather than which spelling it uses. */
    assert.match(
      support,
      /href="\/privacy(\.html)?"/,
      'the support page does not link the privacy policy'
    )

    /* Linked both ways, so somebody landing on either finds the other. */
    assert.match(read('public/privacy.html'), /notices\.txt/, 'the privacy page does not link the licences')

    const store = read('docs/app-store.md')
    assert.match(store, /support\.html/, 'the store notes give no support URL')
    assert.match(store, /privacy\.html/, 'the store notes give no privacy URL')

    /*
     * THE REVIEW NOTE, checked against the actual buttons. If somebody renames
     * one, the instruction handed to Apple becomes wrong and this fails rather
     * than the submission.
     *
     * TWO THINGS CHANGED HERE, and the second is the one that mattered.
     *
     * The note no longer sends a reviewer to the sign-in screen at all. A
     * fresh install opens the WALKTHROUGH, and that is where the demo is three
     * taps in; the sign-in screen is only reached after it. The old note named
     * the sign-in screen's button while telling them to look on the first
     * screen, which is a real button on a screen they were not on.
     *
     * And this read the whole file, so a mention of a label ANYWHERE in it —
     * including prose explaining what the notes used to say — counted as the
     * notes naming it. That is a green light for a doc that no longer gives
     * the instruction. It reads the fenced block now, which is the text that
     * gets pasted.
     */
    const copy = read('shared/onboarding.mjs')
    const pastedAt = store.indexOf('## Review notes')
    const fence = store.indexOf('```', pastedAt)
    const pasted = store.slice(fence + 3, store.indexOf('```', fence + 3))
    for (const label of ['Get started', 'Got it', 'Start free demo']) {
      assert.ok(pasted.includes(label), `the review notes stopped telling Apple to tap "${label}"`)
      assert.ok(
        copy.includes(label),
        `the review notes tell Apple to tap "${label}", which the walkthrough no longer says`
      )
    }
    assert.match(store, /Review notes/, 'there are no review notes at all')
  })

  test('the store says what it needs first, and never calls the computer app free', async () => {
    /*
     * "I think we need to make it more clear that this app requires a computer
     * connected to the fractal to work. Maybe even in all caps. It's a lot of
     * reading to get to that point."
     *
     * The listing said it two-thirds of the way down, under HOW IT WORKS — and
     * above that, in the demo paragraph, "You need no hardware and no computer
     * to look around", which a skim reads as the opposite.
     *
     * And then: "Don't say free fractal remote app. That could confuse people
     * thinking the iOS/android app is free." So the computer app is the
     * desktop app, never the free one, anywhere in the store copy.
     *
     * And since 30 October 2026, with Bluetooth live in both stores: "It
     * doesn't require a computer anymore if people are using Bluetooth
     * instead. So we can drop that now." So the two parts that change any
     * time, the promotional text and the Play summary, open on the two ways,
     * the computer first; the Description and the subtitle still say the
     * computer until the next version, which is the only way Apple changes
     * them.
     */
    const { fenced, promoText, PROMO_LIMIT } = await import('../scripts/store-text.mjs')
    const store = read('docs/app-store.md')
    const promo = promoText(store)
    const description = fenced(store, '### Description')
    const short = fenced(store, '### Google Play: short description').trim()
    const subtitle = store.match(/\| \*\*Subtitle\*\* \| 30 \| `([^`]+)` \|/)?.[1]
    const length = (s) => [...s].length

    assert.match(promo, /^By computer or by Bluetooth\./, 'the top of the listing does not open on the two ways, the computer first')
    assert.ok(!/REQUIRES A COMPUTER/i.test(promo), 'the top of the listing still says a computer is required, and Bluetooth needs none')
    assert.match(description, /^REQUIRES A COMPUTER\./, 'the description no longer opens on the computer')
    /* Sentence case on Play alone: its help for this field says "Do not use
       capitalization for emphasis", and its metadata policy calls ALL CAPS
       outside a brand name a violation. */
    assert.match(short, /^Through a computer, or by Bluetooth\./, 'the Play summary does not open on the two ways, the computer first')
    assert.ok(!/requires a computer/i.test(short), 'the Play summary still says a computer is required, and Bluetooth needs none')
    assert.ok(!/\b[A-Z]{4,}\b/.test(short), 'the Play summary shouts, which Google asks it not to')
    assert.match(subtitle ?? '', /computer/i, 'the subtitle no longer says it needs a computer')
    assert.match(description.split('\n\n')[0], /stay on and connected/, 'the description stopped saying the computer is needed while you play')

    assert.ok(length(promo) <= PROMO_LIMIT, `the promotional text is ${length(promo)} characters`)
    assert.ok(length(short) <= 80, `the Play summary is ${length(short)} characters; Play takes 80`)
    assert.ok(length(subtitle) <= 30, `the subtitle is ${length(subtitle)} characters; Apple takes 30`)
    assert.ok(length(description) <= 4000, `the description is ${length(description)} characters; both stores take 4000`)

    assert.ok(!/no computer to look around/.test(description), 'the demo line reads as "no computer needed" again')
    /* The listing names VP4 and Fractal Audio, so its trademark line has to:
       the shared one does, and a hand-typed one left both out. */
    const { AFFILIATION } = await import('../shared/affiliation.mjs')
    assert.ok(description.includes(AFFILIATION), 'the description no longer carries the shared disclaimer')
    for (const [where, text] of [['promotional text', promo], ['description', description], ['Play summary', short], ['subtitle', subtitle]]) {
      assert.ok(!/\bfree\b[^.\n]{0,40}\bapp\b|\bapp\b[^.\n]{0,20}\bis free\b/i.test(text), `the ${where} calls an app free`)
    }
  })

  test('the promotional text goes to App Store Connect signed the way Apple checks it', async () => {
    /*
     * scripts/store-text.mjs only ever runs with the real key, on GitHub, so
     * the parts that can be wrong without it are proved here: a token Apple
     * would refuse (DER signature, an expiry past twenty minutes, the wrong
     * audience), and the choice of which versions get the text.
     */
    const { generateKeyPairSync, verify } = await import('node:crypto')
    const { token, targets } = await import('../scripts/store-text.mjs')
    const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' })
    const p8 = privateKey.export({ type: 'pkcs8', format: 'pem' })

    const jwt = token({ keyId: 'KEY123', issuerId: 'issuer-1', p8, now: 1_000_000 })
    const [head, body, signature] = jwt.split('.')
    const decode = (part) => JSON.parse(Buffer.from(part, 'base64url').toString('utf8'))
    assert.deepEqual(decode(head), { alg: 'ES256', kid: 'KEY123', typ: 'JWT' })
    const claims = decode(body)
    assert.equal(claims.aud, 'appstoreconnect-v1')
    assert.equal(claims.iss, 'issuer-1')
    assert.ok(claims.exp > claims.iat && claims.exp - claims.iat <= 20 * 60, 'Apple refuses a token that lives past twenty minutes')
    const raw = Buffer.from(signature, 'base64url')
    assert.equal(raw.length, 64, 'the signature is DER rather than the r||s a JWT carries')
    assert.ok(
      verify('sha256', Buffer.from(`${head}.${body}`), { key: publicKey, dsaEncoding: 'ieee-p1363' }, raw),
      'the token does not verify against its own key'
    )

    const v = (id, appStoreState, appVersionState) => ({ id, attributes: { appStoreState, appVersionState } })
    const chosen = targets([
      v('live', 'READY_FOR_SALE', 'READY_FOR_DISTRIBUTION'),
      v('next', 'PREPARE_FOR_SUBMISSION', 'PREPARE_FOR_SUBMISSION'),
      v('review', 'WAITING_FOR_REVIEW', 'WAITING_FOR_REVIEW'),
      v('old', 'REPLACED_WITH_NEW_VERSION', 'REPLACED_WITH_NEW_VERSION')
    ]).map((x) => x.id)
    assert.deepEqual(chosen, ['live', 'next'], 'the text goes on the wrong versions')
    const { coming } = await import('../scripts/store-text.mjs')
    assert.deepEqual(
      coming([
        v('live', 'READY_FOR_SALE', 'READY_FOR_DISTRIBUTION'),
        v('review', 'WAITING_FOR_REVIEW', 'WAITING_FOR_REVIEW'),
        v('held', 'PENDING_DEVELOPER_RELEASE', 'PENDING_DEVELOPER_RELEASE'),
        v('old', 'REPLACED_WITH_NEW_VERSION', 'REPLACED_WITH_NEW_VERSION')
      ]).map((x) => x.id),
      ['review', 'held'],
      'a version still to be released is not warned about, so its old paragraph comes back unannounced'
    )
  })

  test('an account made in the app can be deleted in the app, with everything under it', async () => {
    /*
     * Apple rejected 1.86.8 under Guideline 5.1.1(v): "The app supports
     * account creation but does not include an option to initiate account
     * deletion." Turning an account off is not enough, and neither is a
     * support email. So: a Delete account button on the phone's Account page,
     * named on the first page of Settings, and a server function that really
     * deletes the account.
     */
    const settings = read('mobile/src/screens/Settings.js')
    assert.match(settings, /label="Delete account"/, 'the phone has no Delete account button')
    assert.match(settings, /Password, sign out, delete account/, 'the first page of Settings no longer says where Delete account is')
    assert.match(settings, /await deleteAccount\(\)[\s\S]{0,200}onSignOut/, 'a deleted account is not signed out of')

    /*
     * And from the purchase page. Anybody can make an account on the phone
     * now, before paying, and one that has not been unlocked signs in to the
     * purchase page, imposed, with no way through to Settings — so an
     * account made in the app could not be deleted in it, which is the
     * rejection above all over again.
     */
    const paywall = read('mobile/src/screens/Paywall.js')
    assert.match(paywall, /label="Delete account"/, 'the purchase page an unpaid account lands on has no Delete account')
    assert.match(paywall, /await deleteAccount\(\)[\s\S]{0,200}onDeleted\?\.\(\)/, 'an account deleted from the purchase page is not signed out of')
    assert.match(paywall, /const canDelete = !asked && Boolean\(onDeleted\)/, 'the purchase page offers to delete an account to somebody in the demo')
    assert.match(paywall, /\}, \[canDelete\]\)/, 'the purchase page asks the account server who is signed in on every render')
    const phoneApp = read('mobile/App.js')
    assert.match(phoneApp, /<Paywall\s+onSignIn=\{toSignIn\}[\s\S]{0,1800}onDeleted=\{\(\) => \{\s*signOut\(\)/, 'the purchase page an unpaid account signs in to cannot delete it')

    /* And the browser and Mac app, for anybody who signed up there. */
    const web = read('src/App.jsx')
    assert.match(web, /Delete account\s*<\/button>/, 'the browser has no Delete account')
    assert.match(web, /await deleteAccount\(\)[\s\S]{0,120}linkAction\('signout'\)/, 'a deleted account stays signed in on the browser')
    assert.match(read('src/lib/remote.js'), /functions\/v1\/delete-account/)

    const fn = read('supabase/functions/delete-account/index.ts')
    /* Who is deleted comes from the verified session, never the request. */
    assert.match(fn, /\/auth\/v1\/user/, 'the function no longer verifies who is asking')
    assert.match(fn, /\/auth\/v1\/admin\/users\/\$\{id\}/, 'the function no longer deletes the account it verified')
    assert.ok(!/body\??\.(id|user|account|email)\b/.test(fn), 'the function reads whom to delete from the request body')
    assert.match(fn, /confirm !== 'delete'/, 'a call without the confirmation can delete an account')

    /* Everything saved under an account goes with it. A table that names a
       user without `on delete cascade` would outlive the deletion, which is
       the data Apple's rule is about. */
    const dir = new URL('../supabase/migrations/', import.meta.url)
    for (const f of readdirSync(dir)) {
      const sql = readFileSync(new URL(f, dir), 'utf8')
      for (const m of sql.matchAll(/references auth\.users\s*\(id\)([^,\n]*)/gi)) {
        assert.match(m[1], /on delete cascade/i, `${f}: a table references auth.users without on delete cascade`)
      }
    }
  })

  test('the app says whose it is not, everywhere somebody would look', async () => {
    /*
     * "Leave the name, but add a disclaimer that we are in no way affiliated
     * or endorsed by Fractal Audio Systems."
     *
     * Keeping "Fractal" in the name of a paid app makes this the sentence that
     * matters, and the version of it that matters is whichever one somebody's
     * lawyer happens to read. So there is one string and four places show it,
     * rather than four hand-typed copies that drift — a disclaimer saying three
     * different things in three places reads as carelessness about exactly the
     * point it is making.
     *
     * It is also inherited rather than invented: the preset codec is
     * Apache-2.0 and its NOTICE carries the same statement about its own
     * author, which section 4(d) requires we pass on.
     */
    const { AFFILIATION, NOT_AFFILIATED, TRADEMARKS } = await import('../shared/affiliation.mjs')

    /* The words themselves have to do the job. "Independent" alone is a
       positioning word; the disclaimer is the part about endorsement. And
       since 18 October 2026 they are Fractal Audio's own, word for word:
       "supported by" (the one they care about most), and "LLC", which is
       what they are. */
    assert.match(NOT_AFFILIATED, /independently developed and is not affiliated with, endorsed by, or supported by Fractal Audio Systems, LLC\./)
    assert.match(NOT_AFFILIATED, /Fractal Audio Systems/)
    assert.match(TRADEMARKS, /trademarks of Fractal Audio Systems, LLC/)
    assert.ok(AFFILIATION.includes(NOT_AFFILIATED) && AFFILIATION.includes(TRADEMARKS))

    /* Both apps show it, from the shared string rather than a copy. */
    for (const [where, file] of [
      ['the browser', 'src/App.jsx'],
      ['the phone', 'mobile/src/screens/Settings.js']
    ]) {
      const src = read(file)
      assert.match(src, /import \{ AFFILIATION\b[^}]*\} from '[./]+(?:shared\/affiliation\.mjs|lib\/affiliation)'/, `${where} does not import the shared disclaimer`)
      assert.match(src, /\{AFFILIATION\}/, `${where} imports the disclaimer and never shows it`)
    }

    /* The generated notices take it from the same place. */
    assert.match(read('scripts/notices.mjs'), /NOT_AFFILIATED, TRADEMARKS/, 'the notices generator keeps its own copy')
    assert.ok(read('NOTICES.md').includes(NOT_AFFILIATED), 'the notices file does not carry the disclaimer')

    /*
     * And the privacy page, which is static HTML and cannot import — so it
     * carries the words and this holds the two to each other. Compared with
     * the typographic quotes normalised, because the page writes them as
     * entities and the module writes them as characters.
     */
    const plain = (s) =>
      s
        .replace(/&ldquo;|&rdquo;/g, '“')
        .replace(/[“”]/g, '"')
        .replace(/\s+/g, ' ')
        .trim()
    const page = plain(read('public/privacy.html'))
    assert.ok(page.includes(plain(NOT_AFFILIATED)), 'the privacy page no longer matches the shared disclaimer')
    assert.ok(page.includes(plain(TRADEMARKS)), 'the privacy page no longer matches the shared trademark line')
  })

  test('the privacy policy describes what the app actually does', () => {
    /*
     * A store will not take a paid app without a privacy policy at a URL, and
     * a policy that is wrong is worse than the missing one it replaced —
     * it is a published claim nobody checked.
     *
     * SO THIS IS TIED TO THE CODE RATHER THAN TO A MEMO. The set of tables the
     * apps write to is read out of the source here; if a new one appears, this
     * fails until somebody has decided what the policy says about it. That is
     * the whole mechanism — it does not know what is private, it refuses to
     * let the question go unasked.
     *
     * It was written by reading that set rather than from memory, which is how
     * `rig_lookups` turned out to be a table the app had stopped writing to
     * when the tone builder came out: dead code whose test still passed.
     */
    const policy = read('public/privacy.html')

    const sources = [...walk(new URL('../src/', import.meta.url))]
      .concat([...walk(new URL('../mobile/src/', import.meta.url))])
      .map((f) => readFileSync(f, 'utf8'))
      .join('\n')

    /* `.from('x')` and `.from(TABLE)` with a const above it: both are used. */
    const tables = new Set()
    for (const m of sources.matchAll(/\.from\('([a-z_]+)'\)/g)) tables.add(m[1])
    for (const m of sources.matchAll(/const TABLE = '([a-z_]+)'/g)) tables.add(m[1])

    assert.deepEqual(
      [...tables].sort(),
      /* gear_reports since 26 October 2026: the opt-in gear notes, under "Which gear works". */
      ['feedback', 'gear_reports', 'stage_lists'],
      'the apps write to a table the privacy policy has never been checked against'
    )
    assert.match(policy, /Which gear works — only if you say yes/, 'nothing is said about the gear notes')

    /* And each of those is described, in the words a person would search for
       rather than the table's name. */
    assert.match(policy, /setlist/i, 'nothing is said about the setlists that sync')
    assert.match(policy, /[Bb]ug reports? and suggestions|Something is broken/, 'nothing is said about reports')
    assert.match(policy, /email address/i, 'nothing is said about the account')
    /* The unlock is sold, so the purchase record is said — and the camera the
       pairing scanner once used is not claimed. */
    assert.match(policy, /RevenueCat/, 'nothing is said about the purchase record')
    assert.ok(!/pairing code/.test(policy), 'the policy still describes the camera scanner that was removed')

    /*
     * THE LEAD, because it is the true and reassuring thing and it is what most
     * people do: on your own wifi, nothing leaves the room.
     */
    assert.match(policy, /sends nothing anywhere|nothing leaves the room/i, 'the policy buries the local-mode answer')

    /* No analytics, said plainly — and true, which is checked rather than
       claimed. A tracking SDK arriving later fails this. */
    assert.match(policy, /[Nn]o advertising, no analytics kit, and no tracking of any kind/, 'the policy does not say there is no tracking')
    for (const sdk of ['@sentry', 'mixpanel', 'amplitude', 'posthog', 'segment', 'react-ga']) {
      for (const manifest of ['package.json', 'mobile/package.json']) {
        assert.ok(
          !JSON.stringify(JSON.parse(read(manifest)).dependencies || {}).includes(sdk),
          `${manifest} installs ${sdk}, and the privacy policy claims there is no analytics`
        )
      }
    }

    /* The two things a regulator and a store both look for. */
    assert.match(policy, /justinnewbold@gmail\.com/, 'there is no way to ask for deletion')
    assert.match(policy, /children|under 13/i, 'nothing is said about children')

    /* And the debug log, which is the one thing here somebody might be
       surprised by — so the policy has to be straight about when it goes and
       that a suggestion never carries one. */
    assert.match(policy, /debug log/i, 'the log is not mentioned at all')
    assert.match(policy, /never/, 'the policy does not say a suggestion never carries the log')

    /*
     * Reachable from inside both apps. A policy at a URL nobody can find from
     * the thing it describes satisfies a form and nobody else.
     */
    assert.match(read('src/App.jsx'), /privacy\.html/, 'the browser never links its privacy policy')
    assert.match(read('mobile/src/screens/Settings.js'), /privacy\.html/, 'the phone never links its privacy policy')
    for (const [where, src] of [
      ['the browser', read('src/App.jsx')],
      ['the phone', read('mobile/src/screens/Settings.js')]
    ]) {
      assert.match(src, /notices\.txt/, `${where} never links the licences it ships under`)
    }
  })

  test('the privacy policy covers the testers’ list, Justin’s own pages, and Location', () => {
    /*
     * THREE THINGS THE POLICY LEFT OUT, found by reading the server rather
     * than the page, and each one tied to the code that does it so it cannot
     * quietly drift back out.
     *
     * The test above reads the tables the APPS write. These three are written
     * or read by the server on Justin's behalf, so that test never saw them:
     *
     *   - the testers' waiting list, an address kept before its owner has an
     *     account (migrations/20260924_waiting_grants.sql)
     *   - the "You have full access" email grant-access sends through Resend
     *   - what the Developer pages read back about every account: when it
     *     last signed in, its devices, and what RevenueCat last saw — which
     *     is what How many people counts. A page that said "Nobody is
     *     counting your sessions" beside a page that counts people was a
     *     published claim nobody had checked.
     */
    const policy = read('public/privacy.html')
    const words = policy.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')

    assert.match(read('supabase/migrations/20260924_waiting_grants.sql'), /create table if not exists public\.waiting_grants/)
    assert.match(words, /waiting list/, 'the policy never mentions the testers’ waiting list')
    assert.match(words, /the address and the date it was added, nothing else/, 'the policy does not say what the waiting list holds')

    /* The email, by the subject it is actually sent with. */
    const grant = read('supabase/functions/grant-access/index.ts')
    const subject = grant.match(/subject: '([^']+)'/)?.[1]
    assert.ok(subject, 'grant-access no longer sends a subject this can find')
    assert.ok(words.includes(subject), `the policy does not name the "${subject}" email`)
    assert.match(words, /Emails this app sends \([^)]*full access[^)]*\) go through Resend/, 'the list of emails Resend sends leaves the tester’s one out')

    /* What RevenueCat is read for, field by field, and where the policy says so. */
    for (const [field, said] of [
      ['last_seen_at', /when the app last asked/],
      ['last_seen_app_version', /which version of the app/],
      ['last_seen_platform_version', /of the phone's system/],
      ['last_seen_country', /which country/]
    ]) {
      assert.match(grant, new RegExp(field), `grant-access no longer reads ${field}; the policy should stop saying it`)
      assert.match(words, said, `grant-access reads RevenueCat's ${field} and the policy does not say so`)
    }
    assert.match(read('shared/admin.mjs'), /export function usageSections/)
    assert.match(words, /How many people/, 'the head count on the Developer pages is not described')
    assert.match(words, /naming nobody|names nobody/, 'the policy does not say the head count names nobody')
    assert.ok(!/Nobody\s+is\s+counting/i.test(words), 'the policy says nobody counts while How many people does')

    /*
     * RECORDED AND SENT ARE TWO DIFFERENT CLAIMS. The debug log is a record
     * of what the app did, with a line for every button pressed (logTap in
     * mobile/src/lib/debugLog.js), and the last lines of each run are kept on
     * the phone (mobile/src/lib/logKeep.js). So the policy can say nobody is
     * TOLD what you press, but not that nothing RECORDS it: the same page
     * describes that record a few paragraphs up, and a reader who gets that
     * far finds the page saying both.
     */
    assert.match(read('mobile/src/lib/debugLog.js'), /logDebug\('tap', what, detail\)/, 'the debug log no longer writes a line for each press; the policy can say less')
    if (words.includes('buttons pressed')) {
      assert.ok(!/Nothing records[^.]*(what you press|which screens)/.test(words), 'the policy says nothing records what you press, and describes the debug log that does')
    }
    assert.match(words, /the debug log described above stays on your phone or computer unless you send it with a report/, 'the policy does not say where the record of what you press stays')

    /*
     * THE EXCEPTIONS THE OPENING NAMES. "Each one is something you choose to
     * turn on" has two exceptions, and both happen every time the app opens
     * without anybody turning them on: the unlock check, and the update
     * checks (the phone's through Expo, mobile/app.json's updates.url; the
     * desktop's through GitHub, desktop/main.js). An opening that names one
     * while the page goes on to describe both is untrue in its first lines.
     */
    assert.match(read('mobile/app.json'), /"url": "https:\/\/u\.expo\.dev\//, 'the phone no longer checks Expo for updates; the policy should stop saying it does')
    assert.match(read('desktop/main.js'), /const LATEST_API_URL = 'https:\/\/api\.github\.com\//, 'the desktop app no longer checks GitHub for updates; the policy should stop saying it does')
    assert.match(words, /The desktop apps check for their own updates from GitHub, and the phone app checks for updates from Expo/, 'the policy does not describe the update checks')
    assert.ok(!/except one:/.test(words), 'the opening names one thing that is not turned on, and the page describes two')
    assert.match(words, /something you choose to turn on, except two: the phone app asking whether it is unlocked[^.]*and the apps checking for updates/, 'the opening does not name both things that happen without being turned on')

    /*
     * And the one thing the phone fetches from this website: the gear pages'
     * photographs, the one open and its neighbours either side (GearCard,
     * from HOSTED_ORIGIN). Nothing about the person goes with them, but the
     * opening says everything that uses the internet is described here.
     */
    assert.match(read('mobile/src/components/GearCard.js'), /photoFor\(entry\.name, `\$\{HOSTED_ORIGIN\}\/gear`\)/, 'the gear photographs no longer come from the website; the policy should stop saying they do')
    assert.match(words, /the photographs on the gear pages are fetched from this website as you look through them/, 'the policy does not say the phone fetches the gear photographs')

    /*
     * LOCATION. True on every phone in a store today, and kept true while the
     * Bluetooth code is in the build, even with Bluetooth shown to the
     * developer's account alone: on Android 11 and older, Android makes any
     * app that looks for a Bluetooth device hold the Location permission. The
     * Bluetooth module asks for it there, only from the Bluetooth page's
     * Connect, and never reads where the phone is. So the policy must not say
     * Location is "never asked for" while the app can ask anybody at all.
     */
    const pending = new URL('../docs/pending/bluetooth-beta.patch', import.meta.url)
    const manifest = new URL('../mobile/modules/fractal-ble-midi/android/src/main/AndroidManifest.xml', import.meta.url)
    const asks = [pending, manifest].some((f) => existsSync(f) && readFileSync(f, 'utf8').includes('ACCESS_FINE_LOCATION'))
    assert.match(words, /The app never reads where you are from the phone/, 'the policy stopped saying the app never reads where you are')
    /*
     * NOT "NEVER KEPT". This anchor used to be "Where you are is never read,
     * kept or sent anywhere", and the same page says RevenueCat notes which
     * country a phone asked from (last_seen_country, which grant-access reads
     * back, checked above). RevenueCat works that out from the internet
     * connection, not from the phone. So the page says the APP never reads
     * where you are, and says where the country comes from, beside it.
     */
    assert.ok(!/never read, kept or sent/.test(words), 'the policy says where you are is never kept, and RevenueCat keeps the country')
    assert.match(words, /The country RevenueCat notes[^.]*is worked out by RevenueCat from the internet connection, not from the phone's location/, 'No location leaves the country RevenueCat notes unexplained')
    if (asks) {
      assert.ok(!/Never asked for/.test(words), 'the policy says Location is never asked for, and Bluetooth asks on older Android')
      assert.match(words, /Android 11 and older/, 'the policy does not say which phones are asked for Location')
      assert.match(words, /when you tap Connect on the Bluetooth page/, 'the policy does not say when Location is asked for')
    }

    /*
     * AND WHO BLUETOOTH (BETA) IS FOR, which has changed twice, on purpose.
     * This page said it was "still being tested and is not open to customers
     * yet" while a list of accounts held it back. Then: "If Bluetooth is
     * ready, let's get it submitted" (Justin, 10 October 2026), and for one
     * day it said "part of the full version, for everyone who has unlocked
     * the app", which this pinned. Then: "Is there any way to just get the
     * Bluetooth on the developers mode for my own phone? I just feel like
     * it's not ready to have public." (11 October.) So it says the
     * developer's own account is the only one it is switched on for — tied
     * to the gate in the app, so the policy cannot outlive it. Over it, the
     * commands still reach the unit through no relay at all.
     *
     * AND THE ONE GAP, SAID AS IT IS. For a day this said the app "does not
     * show it to anyone else, and never asks anyone else" for anything. Not
     * quite true: the 1.87.1 builds run the copy built into them on their
     * first launch after an install or a store update (fallbackToCacheTimeout
     * 0), and that copy shows a Bluetooth card to an account with the
     * full version until the update has downloaded. Only a new build
     * closes that, so the page names the gap, and when anything is asked.
     * And now that the new build exists (1.87.11, 11 October 2026, made
     * with the hidden version inside it), the page says that version and
     * later do not show it at all.
     */
    assert.ok(!/for everyone who has unlocked the app|part of the full version, for/.test(words), 'the policy says Bluetooth is for everyone who has paid, and it is the developer’s alone')
    /*
     * And, written with the 1.89.0 texts (25 October 2026), in words true
     * before and after it is approved: in beta, open to everybody with the
     * full version from 1.89.0, and his alone before it.
     */
    assert.match(words, /Bluetooth lets the phone talk to your unit through a Bluetooth MIDI adapter, with no computer\. From version 1\.89\.0 it is in the app for everyone with the full version; earlier versions show it only on the developer's own account\./, 'the policy does not say who Bluetooth is open to, and from which version')
    /*
     * The Bluetooth report, and what its log's head says (docs/app-store.md,
     * 1.89.0 step 12). Since 29 October 2026 it opens the one report form,
     * where nothing goes until Send, in place of the one-tap answers.
     */
    assert.match(words, /Report a Bluetooth problem ?, on the Bluetooth page[^.]*opens the same form\. Nothing goes until you press Send/, 'the policy does not cover the Bluetooth report')
    assert.doesNotMatch(words, /when you tap one of its answers/, 'the policy still describes the one-tap Bluetooth answers')
    assert.match(words, /While the app is on Bluetooth, and on any report opened from Report a Bluetooth problem, those lines also say the unit picked/, 'the policy does not say what a Bluetooth report’s log head carries')
    assert.match(words, /The last fault the screen showed with the log only with the log only never/, 'the policy’s table does not say the last fault goes only with the log')
    assert.match(words, /There is one gap: the first time version 1\.87\.1 opens after it is installed or updated, before its first update has arrived, an account with the full version can still see a Bluetooth card under Settings → Phone &amp; computer\. It goes once the app has downloaded that update, usually from the next time it is opened\. Version 1\.87\.11 and later do not show it at all\. Nothing is asked for unless Connect is tapped on the Bluetooth page\./, 'the policy does not name the first-launch gap of the 1.87.1 builds, that 1.87.11 closes it, or when anything is asked for')
    assert.ok(!/does not show it to anyone else|never asks anyone else/.test(words), 'the policy says nobody else is ever shown Bluetooth or asked, and a fresh 1.87.1 install can show it on its first launch')
    assert.equal(JSON.parse(read('mobile/app.json')).expo.updates.fallbackToCacheTimeout, 0, 'the app now waits for its update before opening; the first-launch gap the policy names may be gone')
    assert.match(read('mobile/src/lib/bluetooth.js'), /export const useBluetoothAllowed = /, 'the app no longer keeps Bluetooth to one account; the policy should stop saying it does')
    assert.match(words, /Over Bluetooth they go from the phone to the adapter on your unit, through no relay and no internet at all/, 'the relay paragraph does not say Bluetooth goes through no relay')
  })

  test('the privacy policy says what the setup emails are, how many, what they keep, and for how long', () => {
    /*
     * "One friendly email a day after buying if no computer has signed in"
     * (15 October 2026). Four sentences on this page became untrue the day it
     * was written: the tester's email was "the only time", the Developer
     * pages recorded "nothing new", the list of emails left it out, and so
     * did how long things are kept. Each is tied here to what the migration
     * and the function do, so the page cannot drift from them.
     */
    const words = read('public/privacy.html').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')
    const sql = read('supabase/migrations/20261015_setup_reminders.sql')
    const fn = read('supabase/functions/setup-reminder/index.ts')

    assert.match(sql, /s\.unlocked_at <= now\(\) - interval '24 hours'/, 'the first email no longer waits a day; the policy should say when it goes')
    assert.match(sql, /s\.first_sent_at <= now\(\) - interval '4 days'/, 'the reminder no longer waits four days; the policy should say when it goes')
    assert.match(words, /If no computer app has signed in with your account a day after the full version arrives on it, one email goes to your address with the download link and the three steps to set it up, and one reminder at least four days later if there is still none\./, 'the policy does not say when the setup emails go')
    assert.match(words, /Never more than those two, none at all once a computer has signed in, and none to an address that was never confirmed\./, 'the policy does not say two is the most, or who never gets one')
    assert.match(fn, /const DEFAULT_REPLY_TO = 'justinnewbold@gmail\.com'/)
    assert.match(words, /A reply goes to Justin\./, 'the policy does not say where a reply goes')
    /*
     * EVERY DATE THE MIGRATION KEEPS, said. Read off the tables themselves,
     * so a new column fails here until the page says it: unlock_seen's date
     * (and whether it is an estimate of that date), setup_reminders' two sent
     * dates, the refusal and which email it was, and the leave-out.
     */
    const columns = (t) => {
      const body = sql.slice(sql.indexOf(`create table if not exists public.${t} (`))
      return [...body.slice(0, body.indexOf(');')).matchAll(/^\s+(\w+) (?:uuid|timestamptz|boolean|text)/gm)].map((m) => m[1])
    }
    assert.deepEqual(columns('unlock_seen'), ['account_id', 'first_seen_at', 'estimated'], 'what is kept about when somebody got the full version changed; the policy should say it')
    assert.deepEqual(columns('setup_reminders'), ['account_id', 'first_sent_at', 'reminder_sent_at', 'failed_at', 'failed_kind', 'left_out_at'], 'what is kept about the setup emails changed; the policy should say it')
    assert.deepEqual(columns('computer_seen'), ['account_id', 'first_seen_at'], 'what is kept about computers changed; the policy should say it')
    assert.match(words, /a few dates are kept with your account: when it was first seen with the full version, when each of those two emails went or was refused, and when Justin left you out of them, if he did\./, 'the policy does not say what is kept for the setup emails')
    /* The computer date is kept for EVERY account (note_setup_facts reads every computer app's sign-in), so it is said under An account, not under "only if you buy it". */
    assert.ok(!/entitlements/.test(sql.slice(sql.indexOf('insert into public.computer_seen'), sql.indexOf('insert into public.unlock_seen'))), 'the computer date is now kept only for buyers; the policy says every account')
    const account = words.slice(words.indexOf('An account — only if you make one'), words.indexOf('Unlocking the full version — a purchase record only if you buy it'))
    assert.match(account, /When a computer app first signed in with it Kept for every account, bought or not, so that nobody who has already set up the computer is told how to/, 'the account section does not say the first computer date is kept for every account')
    assert.match(account, /Your email address To sign you in, to reset a password, and for the help setting up the computer described under Unlocking the full version/, 'the account section says the address is only for signing in')
    assert.match(words, /So is the first time a computer app signed in with it, which is kept for every account \(see An account ?\)\./, 'the setup emails’ paragraph leaves out the computer date')
    /* The Resend list, with no parenthesis inside it: the test above reads it that way. */
    assert.match(words, /Emails this app sends \([^)]*the email about setting up the computer and its one reminder[^)]*\) go through Resend/, 'the list of emails Resend sends leaves the setup emails out')
    /* The four sentences that were true until now. */
    assert.ok(!/that is the only time\./.test(words), 'the tester’s email is still “the only time”, and a tester with no computer gets the setup emails too')
    assert.match(words, /that is the only time, apart from the help setting up the computer described under Unlocking the full version ?\./)
    assert.ok(!/Nothing new is recorded for these pages/.test(words), 'the Developer pages still “record nothing new”, and the setup emails keep dates')
    assert.ok(!/three dates/.test(words), 'the policy still says three dates, and more are kept')
    assert.match(words, /apart from the dates kept for the help setting up the computer, under An account and Unlocking the full version ?, and the marks on Sales described above\. Nothing else new is recorded for these pages/)
    assert.match(words, /Paid but no computer yet — each account with the full version that no computer app has signed in with: its email address and whether it is confirmed, how and when it got the full version \(which store, a test purchase, or given by hand\), and which of the emails about setting up the computer have gone to it or been refused\. He can leave an account out of those emails\./, 'the Developer pages do not list Paid but no computer yet, or leave out what it shows')
    /* What that list shows, read off the words that draw it. */
    const admin = read('shared/admin.mjs')
    for (const [shown, why] of [
      [/Email not confirmed, so the setup emails don’t go to them\./, 'whether the address is confirmed'],
      [/\(a test purchase, no money taken\)/, 'a test purchase'],
      [/Given the full version by hand/, 'given by hand'],
      [/Paid \$\{paidBy\(paid\.store\)\}/, 'which store'],
      [/was refused \$\{ago\(row\.failed_at, now\)\}/, 'a refusal']
    ]) {
      assert.match(admin, shown, `the list no longer shows ${why}; the policy should stop saying it does`)
    }
    const kept = words.slice(words.indexOf('How long it is kept'), words.indexOf('Deleting your data'))
    assert.match(kept, /The dates kept for the help setting up the computer, and when a computer app first signed in — until you delete the account\./, 'how long the setup emails’ dates are kept is not said')
    /* And what the two partners keep that the page says they are sent (5.1.1(i) asks for retention, not only collection). */
    assert.match(kept, /The purchase record, and the record of the app's checks , at RevenueCat — those under your account until you delete it, which deletes them there too\. Checks made while no account is signed in on a phone \(before signing in, after signing out, or after deleting the account\) are kept under that phone's made-up number/, 'how long RevenueCat keeps the purchase record and the launch checks is not said, or not for the checks under no account')
    assert.match(kept, /The update check's install number, and a crash's error message , at Expo — only for as long as is reasonably needed to provide the updates/, 'how long Expo keeps the install number and a crash message is not said')
    /* Every count the builder sees is said, Expo's included, and named as what the label calls Analytics. */
    assert.match(words, /these counts are what the App Store's privacy label means by Analytics/, 'the policy does not say which of its counts the label calls Analytics')
    assert.match(words, /Expo's own dashboard shows him how many installs took each update, how many launches crashed, and how many different installs that was/, 'the policy leaves out what Expo counts from the update check')
    for (const t of ['computer_seen', 'unlock_seen', 'setup_reminders']) {
      assert.match(sql, new RegExp(`create table if not exists public\\.${t} \\(\\s*account_id uuid primary key references auth\\.users \\(id\\) on delete cascade`), `${t} is not deleted with the account, and the policy says it is`)
    }
    /* "Except two" still holds: the setup emails go to people who bought, under Unlocking the full version. */
    assert.match(words, /something you choose to turn on, except two:/)
    const unlocking = words.slice(words.indexOf('Unlocking the full version — a purchase record only if you buy it'), words.indexOf('Your setlists — only if you are signed in'))
    assert.ok(unlocking.includes('Help setting up the computer.'), 'the setup emails are not described under Unlocking the full version')
    /* And the date moved with the words. */
    const when = words.match(/last updated (\d{1,2} \w+ 2026)/)?.[1]
    assert.ok(when && Date.parse(`${when} UTC`) >= Date.parse('15 October 2026 UTC'), `the privacy page still says it was last updated ${when}`)
  })

  test('the privacy policy says what a sale marked handled keeps, and for how long', () => {
    /*
     * "I wanna [be able to] mark as completed or so that it doesn't appear
     * anymore after it's been handled." (15 October 2026.) A mark is a new
     * thing kept about a customer, on a page that said nothing new is
     * recorded for it. Every column of the table is said, read off the
     * migration, so a new one fails here until the page says it too.
     */
    const words = read('public/privacy.html').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')
    const sql = read('supabase/migrations/20261015_sales_handled.sql')
    const body = sql.slice(sql.indexOf('create table if not exists public.sales_handled ('))
    const columns = [...body.slice(0, body.indexOf(');')).matchAll(/^\s+(\w+) (?:uuid|text|bigint|integer|timestamptz)/gm)].map((m) => m[1])
    assert.deepEqual(columns, ['account_id', 'kind', 'paid_until', 'bought_count', 'near_count', 'handled_at'], 'what a handled mark keeps changed; the policy should say it')
    assert.match(
      words,
      /Sales — each purchase: when, through which store, for how much, and by which account; and anybody who has paid twice, or paid on an account whose email was never confirmed, so he can put it right\. Once he has, he can mark it handled\. Then the account, which of those two it was, when he marked it, the time of the newest purchase it was about, and how many purchases it counted \(with any card sale beside it\) are kept, so it is not shown again unless they pay again\./,
      'the Developer pages do not say what marking a sale handled keeps'
    )
    assert.match(words, /and the marks on Sales described above\. Nothing else new is recorded for these pages/, 'the Developer pages still say nothing new is kept for them')
    const kept = words.slice(words.indexOf('How long it is kept'), words.indexOf('Deleting your data'))
    assert.match(kept, /A sale marked handled — the mark is kept until you delete the account\./, 'how long a handled mark is kept is not said')
    assert.match(body, /^create table if not exists public\.sales_handled \(\s*account_id uuid not null references auth\.users \(id\) on delete cascade,/, 'a handled mark outlives the account, and the policy says it does not')
  })

  test('the privacy policy names Expo and GitHub, says what the update check carries, and where an unpaid account is deleted', () => {
    /*
     * Apple's 5.1.1(i): the policy must "confirm that any third party with
     * whom an app shares user data ... will provide the same or equal
     * protection of user data as stated in the app's privacy policy". The
     * page named RevenueCat, Supabase and Resend in that sentence and left
     * out the update checks, calling them "ordinary download requests". But
     * every check the phone makes carries a number: expo-updates sends an
     * EAS-Client-ID header, a random UUID made the first time the app runs
     * and kept for that install. Never a name or an email address. The
     * desktop's GitHub check asks for the newest release and carries none.
     */
    const words = read('public/privacy.html').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')
    assert.match(words, /RevenueCat, Supabase, Resend, Expo \(the phone app's update checks\) and GitHub \(the desktop app's update checks\) each hold only what is described on this page, use it only to provide their part of the service, and protect it at least as this page describes\./, 'Expo and GitHub are not among those who protect what they hold')
    assert.match(words, /The phone's update check carries a random number for that install, made up the first time the app runs, so Expo can tell one install from another; never your name or email address\./, 'the policy does not say what the phone’s update check carries')
    assert.match(words, /The desktop's check carries no number at all\./)
    assert.ok(!/All of these are ordinary download requests/.test(words), 'the policy calls the update checks ordinary download requests, and the phone’s carries a number')
    /* Tied to the code: Expo's own updater, with no headers of the app's added, and a desktop check that sends only what it asks for. */
    assert.ok(JSON.parse(read('mobile/package.json')).dependencies['expo-updates'], 'the phone no longer uses expo-updates; the policy should stop describing its number')
    const updates = JSON.parse(read('mobile/app.json')).expo.updates
    assert.equal(updates.requestHeaders, undefined, 'the phone adds its own headers to the update check, and the policy says it carries only the install’s number')
    assert.match(read('desktop/main.js'), /web\.fetch\(LATEST_API_URL, \{\s+headers: \{ Accept: 'application\/vnd\.github\+json' \}/, 'the desktop update check sends something new; the policy says it carries no number')

    /*
     * DELETING AN ACCOUNT THAT HAS NOT PAID. Since 1.87.1 an account that
     * has not bought the full version signs in to the purchase page, with no
     * way through to Settings, and Delete account is at the bottom of that
     * page (Paywall.js). The policy only gave Settings → your account.
     * Google Play's User Data policy wants deletion explained in the app and
     * on the web, and a path somebody cannot reach is not one.
     */
    assert.match(read('mobile/src/screens/Paywall.js'), /label="Delete account"/, 'the purchase page has no Delete account, and the policy says it does')
    assert.match(words, /If you have not bought the full version, the app opens on the purchase page instead of Settings\. Delete account is at the bottom of that page, and does the same\./, 'the policy does not say where an account that has not paid is deleted')
    const deleting = words.slice(words.indexOf('Deleting your data'), words.indexOf('Children'))
    assert.ok(deleting.includes('the app opens on the purchase page'), 'the purchase page’s Delete account is not under Deleting your data')
  })

  test('the Bluetooth guide says it is a beta, names the parts it was tried with, and links only what was checked', async () => {
    /*
     * "We need to provide as much instructions as possible on how to connect
     * it and hook it up. So as far as I know, we need a CME Widi host. And
     * then for the AM4 I use these as well. Maybe we could add these with the
     * Amazon links on how to buy them? Cause I'm not sure what's needed for
     * every single device, but it is working with the AM4." (Justin, 10
     * October 2026.)
     *
     * public/bluetooth-guide.html is that page, at
     * https://fractal.newbold.cloud/bluetooth-guide.html. It was
     * public/bluetooth.html until 11 October 2026, when Bluetooth went
     * back to Justin's account alone ("I just feel like it's not ready to
     * have public"): kept whole for the day it comes back, and for his own
     * testing, but linked from nowhere on the website. Every check below
     * still holds it, the FM3 warning included. What this holds it to:
     *
     *   - THE DISCLAIMER, first: a beta that may not work with every unit or
     *     adapter, tried on one AM4 from an iPhone and not yet on the FM3,
     *     FM9 or Axe-Fx III or from an Android phone, with the computer way
     *     untouched.
     *   - NO CLAIM THE OTHER WAY, anywhere on the page. The labels alone did
     *     not hold it: "It works with the AM4, FM3, FM9 and Axe-Fx III" sat
     *     under What it is, three paragraphs below the note saying three of
     *     those had never been tried, with this test green. So a sentence
     *     saying Bluetooth works on an FM3, FM9 or Axe-Fx III fails here,
     *     and the page says which units can be picked instead.
     *   - THE THREE PARTS, at exactly the Amazon addresses checked on
     *     amazon.com itself on 10 October 2026 (title, seller and the page's
     *     own canonical address, read off the live page), as plain /dp/ links
     *     with nothing on the end. A different number is a different product.
     *   - NO OTHER OUTSIDE LINK than the ones checked that day, so an address
     *     nobody looked at cannot be added without this list changing too.
     *   - THE HOOK-UP where a guess goes wrong: black into MIDI IN, white
     *     into MIDI OUT, the cable in the Uhost's left socket and 5 volts in
     *     its right one, the unit started before the Uhost has power, and
     *     the Axe-Fx III's OUT rather than its THRU.
     *   - THE APP'S OWN WORDS. The two step headings, the three rows under
     *     them and View on Amazon, the two Connect hints, the Screen Time
     *     line and the "What's different from USB" list are read out of the
     *     app itself, so the app changing them without the guide fails here
     *     rather than leaving the guide describing another app.
     *   - NO TESTING TOOLS. They are a test bench folded away at the foot of
     *     the Bluetooth page, not a place to send a guitarist, so the guide
     *     neither sends anyone there nor quotes them ("found: Program
     *     Change" once did).
     *
     * Read with the HTML comment taken out, because the comment quotes
     * Justin and names the links: a search of the whole file finds the
     * explanation rather than the page (the same trap CLAUDE.md describes
     * for App.jsx).
     */
    const html = read('public/bluetooth-guide.html').replace(/<!--[\s\S]*?-->/g, '')
    const words = html
      .replace(/<[^>]+>/g, '')
      .replace(/&ldquo;|&rdquo;/g, '"')
      .replace(/&amp;/g, '&')
      .replace(/\s+/g, ' ')

    assert.match(html, /<title>Bluetooth setup/, 'the guide has lost its title')
    assert.match(words, /last updated 26 October 2026/i, 'the guide does not say when it was last checked')
    /* Where the app's Full setup guide goes, and nowhere a search engine sends a customer. */
    const { GUIDE_URL } = await import('../shared/bluetooth-gear.mjs')
    assert.equal(GUIDE_URL, 'https://fractal.newbold.cloud/bluetooth-guide.html', 'the app’s Full setup guide opens somewhere other than the guide')
    /* Listed since the live day (30 October 2026, 1.89.3 in both stores), and /bluetooth links it. */
    assert.ok(!/noindex/.test(html), 'the guide still asks search engines not to list it, and Bluetooth is live in both stores')
    /*
     * And anybody who lands on it is told which versions have it, in words
     * true before 1.89.0 is approved and after (written with the 1.89.0
     * texts, 25 October 2026: a reviewer opens it from the app). Until then
     * it said Bluetooth (beta) "isn't in the app for customers".
     */
    assert.match(words, /Bluetooth is in the app from version 1\.89\.0, for everyone with the full version\. Earlier versions show it only on the developer’s own account: if Settings → My rig has no Bluetooth row, update the app from the store\. Without it, the phone connects through the desktop app\./, 'the guide does not say which versions have Bluetooth')
    assert.match(html, /<a href="\/downloads">desktop app<\/a>/)
    assert.ok(!/will come back|comes back in a later/.test(words), 'the guide promises Bluetooth to customers')
    /*
     * Where it is in the app, said for who can see it. It said "part of the
     * full version, so the Bluetooth row shows once the app is
     * unlocked. If you don’t see it, update the app" — which sent a customer
     * who has unlocked it looking for a row they will never be shown.
     */
    assert.match(words, /In the app it is under Settings → My rig → Bluetooth, from version 1\.89\.0, with the full version\./, 'the guide does not say where the Bluetooth row is, and from which version')
    assert.ok(!/shows once the app is unlocked/.test(words), 'the guide says the Bluetooth row shows once the app is unlocked, which is not true before 1.89.0')

    /*
     * OUT OF BETA, 26 October 2026: "remove anything that says beta on it
     * for Bluetooth". This held the guide to opening on "Bluetooth is in
     * beta"; changed on purpose, with the app's note, which now opens on
     * where it has been tried.
     */
    assert.ok(!/\bbeta\b/i.test(words), 'the guide still calls Bluetooth a beta')
    const { BETA_NOTE_IPHONE, CLOSE_AND_REOPEN } = await import('../shared/bluetooth-gear.mjs')
    assert.ok(BETA_NOTE_IPHONE.startsWith('So far, Bluetooth has been tried on the AM4 and the FM3'), 'the app’s note says it was tried somewhere else than the guide does')
    /* The way out he found when unplugging and plugging the adapter back in left it not connecting (26 October 2026), the app's words. */
    assert.ok(words.includes(CLOSE_AND_REOPEN), 'the guide does not say to close the app completely when it will not connect after the adapter was plugged back in')
    /*
     * From an iPhone and, since 25 October 2026, from an Android phone ("I
     * have tried it from an android phone and it works great"). This held
     * Android to "not been tried yet"; changed on purpose, with the app's
     * Android beta note.
     */
    assert.match(words, /So far it has been tried on an AM4 and an FM3, from an iPhone and from an Android phone\. On the AM4, with the three parts below, and with a CME WIDI Master\. On the FM3, with a CME U2MIDI Pro in place of the C2MIDI Pro\./, 'the guide does not say the AM4 and the FM3, from both phones, and with what, are what it was tried on')
    assert.match(words, /It has not been tried yet on an FM9, Axe-Fx III or VP4\./, 'the guide does not say the FM9, Axe-Fx III and VP4 are untried')
    assert.ok(!/not been tried[^.]*Android/.test(words), 'the guide still says no Android phone has run it')
    /*
     * "The CME C2MIDI Pro got extremely hot on the FM3 and the connection
     * didn't work." The FM3's MIDI OUT has no current limit and the cable
     * feeds from it, so the guide says not to plug it in, and why — and lists
     * nothing to buy for it. Never "straight in": that word was there while a
     * way round it was offered, and with none any more it read as if there
     * still were one.
     */
    /* Since 26 October 2026: the WIDI Master and the C2MIDI Pro ran very hot on his FM3 and the WIDI Master did not work; the U2MIDI Pro works and stays cool. */
    assert.match(words, /On an FM3, the WIDI Master and the C2MIDI Pro got very hot, and the WIDI Master did not work: don’t use them on one/, 'the guide does not warn FM3 owners off what overheated, at the top')
    assert.match(words, /FM3 Tried, works with the U2MIDI Pro/, 'the FM3 is not marked as tried with the U2MIDI Pro')
    assert.match(words, /On an FM3, use the CME U2MIDI Pro, never the C2MIDI Pro or a WIDI Master\. When we tried the WIDI Master and the C2MIDI Pro on an FM3, both got very hot, and the WIDI Master did not work\. The U2MIDI Pro runs on USB power only: on an FM3 it works and stays cool\./, 'the FM3 section does not open on its warning')
    assert.ok(!/parts plugged straight in|plug straight in|straight into an FM3/i.test(words), 'the guide says not to plug it straight in, as if there were another way')
    /*
     * NO HOME-MADE WAY ROUND IT. This held the guide to what FM3 owners fit
     * (a 220-ohm resistor on pin 4, for "someone who solders"); changed on
     * purpose on 25 October 2026, here and in the app's warning. What
     * happened, what owners report, and to keep the parts off an FM3.
     */
    assert.ok(!/220-ohm|resistor|solder/i.test(words), 'the guide gives a home-made way round the FM3 again')
    assert.match(words, /FM3 owners have reported since 2021/, 'the guide says the FM3’s fault as fact rather than what owners report')
    assert.match(words, /So keep the C2MIDI Pro, the WIDI Master, and any adapter that takes its power from the MIDI OUT jack, off an FM3\./, 'the guide does not say to keep the parts that ran hot off an FM3')
    assert.match(words, /Powering the adapter from USB doesn’t stop it/)
    const fm3 = html.slice(html.indexOf('id="fm3"'), html.indexOf('<h3>FM9 and Axe-Fx III'))
    assert.ok(fm3.length > 200 && !/B0GVXTX5D1|c2midi-pro|widi-master/.test(fm3), 'the FM3 section gives somewhere to buy what overheated')
    assert.ok(fm3.includes('href="https://www.cme-pro.com/u2midi-pro-usb-to-midi-cable/"'), 'the FM3 section does not say where to find the U2MIDI Pro')
    assert.ok(!/<h3>FM3, FM9/.test(html), 'the FM3 is still grouped with the units the parts suit')
    assert.match(words, /if any cable or adapter on a MIDI jack gets more than slightly warm, unplug it at once\./i, 'the guide does not say to unplug anything that gets hot')
    assert.match(words, /Yamaha MD-BT01[^.]*\. It runs only on the MIDI OUT’s power, and on an FM3 it is reported hot about as often as not/, 'the Yamaha is offered to FM3 owners as the way round it')
    assert.match(words, /USB cable to a computer[^.]*keeps working as it always has/, 'the guide does not say the computer way is untouched')
    assert.match(words, /AM4 Tried, works/, 'the AM4 is not marked as the one it was tried on')
    assert.match(words, /FM9 and Axe-Fx III Not tried yet/, 'the other units are not marked as untried')
    assert.match(words, /VP4 Not tried yet/, 'the VP4 is not marked as untried')
    /* The VP4: the AM4's parts, one plug, and only presets and scenes (mobile/src/lib/bleVp4.js). */
    assert.match(words, /Leave the white plug out: the app only sends to a VP4, and nothing comes back over Bluetooth\./, 'the guide does not keep the white plug off a VP4')
    assert.match(words, /On a VP4, Bluetooth changes presets and scenes, the way a MIDI foot controller does, and nothing else\./, 'the guide promises a VP4 more than presets and scenes')
    const { VP4_OVER_BLUETOOTH } = await import('../shared/bluetooth-gear.mjs')
    assert.ok(words.includes(VP4_OVER_BLUETOOTH.replace(/^Over Bluetooth, the app changes a VP4’s presets and scenes, the way a MIDI foot controller does, and nothing else\. /, '')), 'the guide says something else about a VP4 than the app does')
    assert.match(words, /VP4: in SETUP (?:>|&gt;) MIDI\/Remote, set Receive MIDI PC to ON and the MIDI Channel to 1 \(or OMNI\)/, 'the guide does not say what to set on a VP4')
    assert.ok(!/isn’t offered over Bluetooth/.test(words), 'the guide still says the VP4 is not offered')

    /* And nothing on the page says the reverse. */
    assert.ok(!/\bworks with the AM4, FM3/.test(words), 'the guide says Bluetooth works with units nobody has tried')
    assert.ok(!/\bworks? (on|with)\b[^.]{0,60}\b(FM9|Axe-Fx III|VP4)\b/.test(words), 'the guide says Bluetooth works on an FM9, Axe-Fx III or VP4, and nobody has run it on those')
    assert.match(words, /You can pick an AM4, FM3, FM9, Axe-Fx III or VP4\. So far the AM4 and the FM3 have been tried, and each of the others says so in the app\./, 'the guide does not say which units can be picked, and which have been tried')

    /* The parts, at the addresses checked on 10 October 2026. */
    const PARTS = [
      ['CME WIDI Uhost', 'https://www.amazon.com/dp/B09GS326QW', 'https://www.cme-pro.com/widi-uhost/'],
      ['CME C2MIDI Pro', 'https://www.amazon.com/dp/B0GVXTX5D1', 'https://www.cme-pro.com/c2midi-pro/'],
      ['LOOTOOLS Type-A MIDI to 3.5 mm adapters', 'https://www.amazon.com/dp/B0FN83P5P7', null],
      /* The FM3's, since 26 October 2026, and the rest of the ways that day, each Amazon page's title checked. */
      ['CME U2MIDI Pro', 'https://www.amazon.com/dp/B0BH8DHCLY', 'https://www.cme-pro.com/u2midi-pro-usb-to-midi-cable/'],
      ['USB-C to USB-A adapter', 'https://www.amazon.com/dp/B01COOQIKU', null],
      ['CME WIDI Master', 'https://www.amazon.com/dp/B08F8F57JX', 'https://www.cme-pro.com/widi-master/'],
      ['CME WIDI Jack, TRS-35 bundle', 'https://www.amazon.com/dp/B08ZZSYKQX', 'https://www.cme-pro.com/widi-jack/'],
      ['CME WIDI Jack, 5-pin DIN bundle', 'https://www.amazon.com/dp/B08ZZSVM1J', null],
      ['Eldraqth', 'https://www.amazon.com/dp/B0FJRB9KGV', null]
    ]
    for (const [name, amazon, maker] of PARTS) {
      assert.ok(words.includes(name), `the guide does not name the ${name}`)
      if (amazon) assert.ok(html.includes(`href="${amazon}"`), `the guide does not link the ${name} at ${amazon}`)
      if (maker) assert.ok(html.includes(`href="${maker}"`), `the guide does not link CME's own page for the ${name}`)
    }
    assert.match(words, /They have to be Type A: the AM4 needs Type A, and Type B ones won’t work\./, 'the guide does not say the AM4 adapters must be Type A')

    /* Nothing outside this site that was not checked that day. */
    const CHECKED = new Set([
      ...PARTS.flatMap(([, amazon, maker]) => [amazon, maker]).filter(Boolean),
      'https://apps.apple.com/app/id6812916461'
    ])
    const outside = [...html.matchAll(/href="(https?:[^"]*)"/g)].map((m) => m[1])
    assert.ok(outside.length >= 6, 'the guide links fewer outside pages than it should; this read is probably broken')
    for (const link of outside) assert.ok(CHECKED.has(link), `the guide links ${link}, which nobody checked`)

    /* The hook-up, where a guess goes wrong. */
    assert.match(words, /black plug \[TO MIDI IN\] into the adapter in MIDI IN, and its white plug \[TO MIDI OUT\] into the adapter in MIDI OUT/, 'the AM4 steps do not say which plug goes where')
    assert.match(words, /black plug \[TO MIDI IN\] into the unit’s MIDI IN/, 'the 5-pin steps do not say the black plug goes in MIDI IN')
    assert.match(words, /white plug \[TO MIDI OUT\] into the unit’s MIDI out\. On an FM9 that is the jack marked MIDI OUT\/THRU\. On an Axe-Fx III it is MIDI OUT, not the separate THRU jack/, 'the 5-pin steps do not say which jack the white plug goes in, or keep it out of the Axe-Fx III’s THRU')
    assert.match(words, /USB-C plug into the Uhost’s left socket, USB Host\/Device/, 'the guide does not say the cable goes in the Uhost’s left socket')
    assert.match(words, /into the Uhost’s right socket, USB Power\. 5 volts only/, 'the guide does not say the power goes in the right socket, at 5 volts')
    assert.match(words, /Never use anything that puts out more than 5 volts/, 'the guide does not warn against more than 5 volts')
    assert.equal((words.match(/let it finish starting up/g) || []).length, 4, 'the hook-up does not start the unit before the Uhost, for the AM4, the FM3, the other 5-pin units and the VP4')
    assert.match(words, /MIDI Thru: Off/, 'the guide does not say to turn MIDI Thru off')
    assert.match(words, /FM3, if presets don’t change from the phone: in Setup → MIDI\/Remote, set Program Change on, the MIDI channel to 1 or Omni, and PC Mapping off\./, 'the guide does not say what to set on an FM3 when presets don’t change')
    /* The FM9 and Axe-Fx III change presets by Program Change alone since 25 October 2026, so for them it is for everybody, with Send Realtime Sysex for the tuner. */
    assert.match(words, /FM9 and Axe-Fx III: in Setup → MIDI\/Remote, also set Program Change on, the MIDI channel to 1 or Omni, PC Mapping off, MIDI PC Offset to 0, and Send Realtime Sysex on\./, 'the guide does not say what to set on an FM9 or Axe-Fx III')
    assert.ok(!/Testing tools|found: /i.test(words), 'the guide sends customers to the Testing tools, which are a test bench')

    /* Connecting, in the app's own words. */
    const app = read('mobile/src/screens/Bluetooth.js')
    for (const said of [
      '1 · Pick your unit',
      'How to connect my Bluetooth device',
      'Troubleshooting',
      'View on Amazon',
      'What Bluetooth can’t do',
      'Setup guide',
      '2 · Connect',
      'wait until it says Connected, then tap Done',
      /* The app names the device in hand there now (`The ${deviceNoun()} looks…`), the guide "The phone": the rest of the sentence is held. */
      'looks for the adapter for ten seconds, then connects to it.'
    ]) {
      assert.ok(app.includes(said), `the Bluetooth page no longer says "${said}"; read the guide against it again`)
      assert.ok(words.includes(said), `the guide does not say "${said}" as the app does`)
    }
    assert.match(words, /Connect it in the app, not in the iPhone’s Settings → Bluetooth\./, 'the guide does not say an iPhone connects the adapter in the app')
    assert.match(words, /Nearby devices/, 'the guide does not say what Android 12 and later asks for')
    assert.match(words, /On Android 11 and older it asks for Location instead[^.]*make sure Location is switched on/, 'the guide does not say Android 11 and older need Location on')
    assert.match(words, /Settings \(the gear at the top right\) → My rig → Bluetooth\./, 'the guide does not say where Bluetooth is in the app, under My rig as the app has it')
    assert.ok(read('mobile/src/screens/Settings.js').replace(/\s+/g, ' ').indexOf('<SetupRow title="Bluetooth"') > read('mobile/src/screens/Settings.js').replace(/\s+/g, ' ').indexOf('<Group title="My rig"'), 'the guide sends people to My rig for a row that is not there')
    /* The report, where the guide sends people: the app's own button. */
    assert.match(words, /Report a Bluetooth problem, on the Bluetooth page, one tap, with “It works on my unit” among its answers/, 'the guide does not send people to the one-tap report')
    /* Changed on purpose, 24 October 2026, with the page: Connect at the top, and the reading in rows under it ("a five-year-old could connect it"). */
    assert.match(words, /The two steps are at the top of the page\. While it is on, or when something is wrong, a line over them says so\./, 'the guide does not say the steps are at the top, as they are in the app')
    assert.match(words, /Under Connect are a few buttons\. Setup guide opens this page\. How to connect my Bluetooth device shows every way to hook up the unit you picked, simplest first/, 'the guide does not say the buttons sit under Connect, as they do in the app')
    assert.match(app, /<Heading>1 · Pick your unit<\/Heading>[\s\S]*<Heading>2 · Connect<\/Heading>[\s\S]*label="Setup guide"[\s\S]*label="How to connect my Bluetooth device"[\s\S]*label="Troubleshooting"[\s\S]*label="What Bluetooth can’t do"/, 'the buttons are no longer under the two steps; read the guide against the app again')
    /* Screen Time: the same place to look as the app's own line for it. */
    const restricted = read('mobile/src/lib/bluetooth.js').match(/export const RESTRICTED_WORDS =\s*`([^`]+)`/)?.[1] ?? ''
    assert.ok(restricted.includes('Settings → Screen Time → Content & Privacy Restrictions'), 'the app’s Screen Time line no longer says where to look; read the guide against it again')
    assert.match(words, /blocked by Screen Time[^.]*Settings → Screen Time → Content & Privacy Restrictions, allow Bluetooth Sharing/, 'the guide does not say what to do when Screen Time blocks Bluetooth')
    const settings = read('mobile/src/screens/Settings.js')
    assert.match(settings, /title=\{PAIR_TITLE\}/, 'Settings has no Phone & computer, which the guide names as the row above Bluetooth')
    assert.match(settings, /const PAIR_TITLE = pairTitle\(\)/, 'the Phone & computer row is not named by pairTitle')
    assert.match(settings, /title="Bluetooth"/, 'Settings has no Bluetooth row, which the guide sends people to')

    /* What's different from USB: the app's list, every line of it. */
    const different = app.match(/const DIFFERENT = \[([\s\S]*?)\n\]/)?.[1] ?? ''
    const lines = [...different.matchAll(/^\s*'([^']+)',?$/gm)].map((m) => m[1])
    assert.ok(lines.length >= 5, 'the Bluetooth page’s list of what is different could not be read')
    for (const line of lines) assert.ok(words.includes(line), `the guide leaves out "${line}", which the app says`)

    /* One thing driving the unit at a time: the app's own line under the steps (ONE_AT_A_TIME), word for word. */
    const { ONE_AT_A_TIME } = await import('../shared/bluetooth-gear.mjs')
    assert.ok(words.includes(ONE_AT_A_TIME), 'the guide does not say what the app says about the computer app and the USB cable while Bluetooth is used')

    /* When it doesn't work. */
    assert.match(words, /Only one phone or computer at a time\./, 'the guide does not say the adapter takes one phone or computer at a time')
    assert.match(words, /A Mac that has connected to it before grabs it again by itself/, 'the guide does not say a Mac grabs the adapter first')
    assert.match(words, /closed, or left in the background for a while, the phone lets the Bluetooth connection go/, 'the guide does not say why it drops after the app has been away')
    assert.match(words, /steady green means it has found the C2MIDI Pro \(or the U2MIDI Pro\) and has power/, 'the guide does not say what the green light means')
    assert.match(words, /a slow blue flash means it is waiting for the phone\. Steady blue means it is connected\. A fast blue flicker means messages are going through\./, 'the guide does not say what the blue light means')

    /* Other ways: each marked tried or not, both jacks, and the untried ones beyond the app's own list with nothing to buy them by. */
    assert.match(words, /CME WIDI Master Tried on the AM4/, 'the WIDI Master is not marked as tried on the AM4 only')
    assert.match(words, /CME WIDI Jack, TRS-35 bundle Tried on the AM4/, 'the WIDI Jack is not marked as untried')
    assert.match(words, /Not tried with Fractal Remote, so not linked here:/, 'the other adapters are not marked as untried')
    assert.match(words, /plug into both of the unit’s MIDI jacks, In and Out/, 'the guide does not say an adapter has to fill both jacks')
  })

  test('/bluetooth says Bluetooth is in the app, the computer first, and leads on to the guide, as the support page does', async () => {
    /*
     * From 11 October 2026 until the live day this held /bluetooth to a
     * short notice that Bluetooth was not in the app ("I just feel like it's
     * not ready to have public"), with nothing to buy and no way on to the
     * guide. 1.89.3 is live in both stores since 30 October 2026, so it is
     * the real page the live day promised (docs/app-store.md, Submission day,
     * step 18): which versions, the two ways with the computer first, what
     * it does, which units and which are untried, the FM3's warning, and the
     * guide for what to buy. Short, because the parts are the guide's.
     */
    const { BLUETOOTH_WAYS, NOT_FOR_FM3 } = await import('../shared/bluetooth-gear.mjs')
    const notice = read('public/bluetooth.html')
    const page = notice.replace(/<!--[\s\S]*?-->/g, '')
    const said = page.replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/g, ' ').replace(/\s+/g, ' ')
    assert.match(notice, /<title>Bluetooth — Fractal Remote<\/title>/)
    assert.match(said, /Bluetooth is in the app, from version 1\.89\.0\./, '/bluetooth does not say which versions have Bluetooth')
    assert.ok(said.includes(BLUETOOTH_WAYS), '/bluetooth does not say the computer is the best way, with more lag and fewer features on Bluetooth')
    assert.ok(said.indexOf(BLUETOOTH_WAYS) < said.indexOf('What it does'), '/bluetooth says what Bluetooth does before it says the computer is best')
    assert.match(said, /No editing or saving over Bluetooth/, '/bluetooth does not say editing and saving need the computer')
    assert.match(said, /on a VP4, presets and scenes/, '/bluetooth promises a VP4 more than presets and scenes')
    assert.match(said, /It has not been tried yet on an FM9, Axe-Fx III or VP4\./, '/bluetooth does not say which units are untried')
    assert.ok(said.replace(/\s+/g, ' ').includes(NOT_FOR_FM3), '/bluetooth does not carry the FM3’s warning word for word')
    assert.ok(!/beta/i.test(said), '/bluetooth still calls Bluetooth a beta')
    assert.match(page, /href="\/bluetooth-guide\.html"/, '/bluetooth does not lead on to the setup guide')
    assert.match(page, /href="\/downloads"/, '/bluetooth does not link the desktop app')
    assert.match(said, /Report a Bluetooth problem/, '/bluetooth does not say how to report a problem')
    /* What to buy is the guide's: this page links no shop. */
    assert.ok(!/amazon\.|cme-pro\.com|lootools/i.test(page), '/bluetooth links a shop, and the parts are the guide’s')
    const outside = [...page.matchAll(/href="(https?:[^"]*)"/g)].map((m) => m[1])
    assert.deepEqual(outside, ['https://apps.apple.com/app/id6812916461'], '/bluetooth links somewhere outside this site other than the App Store page')
    assert.ok(notice.length < 8000, '/bluetooth has grown into a second guide')

    /* Typed without the extension, as What's New wrote it: still this page, not the web app. */
    const vercel = JSON.parse(read('vercel.json'))
    const at = vercel.rewrites.findIndex((r) => r.source === '/bluetooth')
    assert.ok(at !== -1, '/bluetooth is not routed, so it serves the web app instead of the page')
    assert.equal(vercel.rewrites[at].destination, '/bluetooth.html')
    assert.ok(at < vercel.rewrites.findIndex((r) => r.source === '/(.*)'), '/bluetooth sits after the catch-all, so it never reaches the page')

    /* The support page: the two ways, the computer first, and /bluetooth for the rest. Help stays Justin's own channels. */
    const support = read('public/support.html').replace(/<!--[\s\S]*?-->/g, '')
    const supportWords = support.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')
    assert.ok(!/<h2>Bluetooth/.test(support), 'the support page has grown a Bluetooth section of its own')
    assert.ok(!/The phone doesn’t talk to the unit directly/.test(support), 'the support page still says the phone never talks to the unit itself')
    assert.ok(supportWords.includes(BLUETOOTH_WAYS), 'the support page does not say the two ways, the computer first')
    assert.ok(supportWords.indexOf('Through a computer.') > -1 && supportWords.indexOf('Through a computer.') < supportWords.indexOf('By Bluetooth, with no computer.'), 'the support page puts Bluetooth before the computer')
    assert.match(support, /href="\/bluetooth"/, 'the support page does not lead on to /bluetooth')
    assert.match(supportWords, /From version 1\.89\.0/, 'the support page does not say which versions have Bluetooth')
    /* The Android page is about getting the app, and still says nothing about Bluetooth. */
    assert.ok(!/bluetooth/i.test(read('public/android.html')), 'the Android page mentions Bluetooth')
  })

  test('the 1.87.11 store notes disclose the Bluetooth code in one paragraph, and nothing a customer reads offers Bluetooth', async () => {
    /*
     * This held the 1.87.1 notes to describing Bluetooth "for everyone
     * who has unlocked the app", with where to find it, a video and the
     * setup guide, and What's New and the Description to announcing it.
     * Changed on purpose, on 11 October 2026: "Is there any way to just get
     * the Bluetooth on the developers mode for my own phone? I just feel like
     * it's not ready to have public." So it is switched on for his account
     * alone, and the code stays in the binary.
     *
     * Apple's 2.3.1(a): "Don't include any hidden, dormant, or undocumented
     * features in your app". So the notes still say the code is there, in
     * one paragraph: whom it is for, that the reviewer and customers do not
     * see it, and that nobody else is asked for Bluetooth. Everything a
     * customer reads — the Description, What's New, the promotional text,
     * the Play summary — says nothing about Bluetooth at all, because a
     * listing that offered it would be promising what they cannot open
     * (Apple's 2.3, Google Play's metadata policy).
     *
     * Moved on from 1.87.1 to 1.87.11 on 11 October 2026, when the 1.87.11
     * pair was built: build 26 (1.87.1) never went to Apple, and the 1.87.11
     * build carries the hidden version inside it, so its notes are the ones
     * to paste and the 1.87.1 texts are kept at the end for the record.
     */
    const store = read('docs/app-store.md')
    const at = store.indexOf('## 1.87.11, the version in the store now (approved 12 October 2026)')
    assert.ok(at > 0, 'the 1.87.11 section is missing')
    const section = store.slice(at)
    const notesAt = section.indexOf('### Notes for App Review, 1.87.11')
    const open = section.indexOf('```', notesAt)
    const pasted = section.slice(open + 3, section.indexOf('```', open + 3))
    assert.match(section.slice(notesAt, open), /\*\*These are the ones Apple approved with this build,\*\* and the ones the next\s+version's notes start from\./, 'the 1.87.11 notes do not say they are the ones Apple approved, and where the next ones start')

    /*
     * AND THEY FIT THE BOX. App Store Connect's reference: "The Notes field
     * can contain up to 4000 bytes." Bytes, so a dash or an arrow counts as
     * three. The first draft of these notes came to over 5000, and Apple's
     * page would have cut it off or refused it on the day of submitting.
     * Held under 3950, so the brackets in "Tested on" still fit once filled.
     *
     * AND WITH THE THREE VIDEOS IN IT. On 11 October 2026 the notes came to
     * 3897 characters and the three Google Drive links (the FM3, presets,
     * deleting an account) would not fit after them, which the measure above
     * could not see: it counted the brackets, not the links that replace
     * them. So each video bracket is filled here with something as long as
     * a Drive link (85 for "https://drive.google.com/file/d/<33>/view?usp=
     * drive_link"), each Tested on bracket with 30 characters (longer than
     * "Series 11 (46mm)" or "26.0.1"), and the total still has to come in
     * under 3950.
     */
    const drive = 'https://drive.google.com/file/d/' + 'x'.repeat(33) + '/view?usp=drive_link'
    const brackets = pasted.match(/\[[^\]\n]*\]/g) || []
    assert.equal(brackets.filter((b) => /video link/.test(b)).length, 3, 'the 1.87.11 notes do not hold a place for the three video links')
    const filled = brackets.reduce((t, b) => t.replace(b, /video link/.test(b) ? drive : 'x'.repeat(30)), pasted.trim())
    const bytes = Buffer.byteLength(filled, 'utf8')
    assert.ok(bytes <= 3950, `the 1.87.11 notes are ${bytes} bytes with the links and brackets filled; Apple's Notes box takes 4000`)
    assert.match(pasted, /\nVideos:\n1\. FM3 hardware: \[FM3 video link\]\n2\. Presets: \[presets video link\]\n3\. Deleting an account: \[account deletion video link\]\s*$/, 'the three videos are not listed at the end of the 1.87.11 notes')
    assert.match(pasted, /real FM3 on\s+screen, from the first pairing through the whole workflow, is video 1 below\./, 'the Hardware paragraph does not point at the FM3 video')
    assert.match(pasted, /Deleting an account \(Guideline 5\.1\.1\(v\), video 3 below\):/, 'the Delete account paragraph does not point at its video')
    /*
     * AND THE WAY TO DELETE A NEW ACCOUNT IS IN THE DELETION PARAGRAPH. The
     * notes ask the reviewer to try it on a new account, and a new account
     * that has not bought opens on the purchase page with no gear, so the
     * gear-to-Settings path alone sends them looking for a button that is
     * not there. That page's Delete account was said six paragraphs up, in
     * Accounts before buying; the 1.86.83 notes Apple approved had it here,
     * and 1.86.8 was refused under 5.1.1(v).
     */
    const deleting = pasted.slice(pasted.indexOf('Deleting an account (Guideline 5.1.1(v)'), pasted.indexOf('\n\n', pasted.indexOf('Deleting an account (Guideline 5.1.1(v)')))
    assert.match(deleting, /purchase page[\s\S]{0,80}Delete account is at the foot of that page\. Please try it on a new account, not the demo account\./, 'the deletion paragraph does not say where an unpaid new account is deleted')

    /* The disclosure, said once. */
    assert.match(
      pasted,
      /Bluetooth MIDI code, switched on only for the developer\. This build\s+contains Bluetooth MIDI code for a feature that lets the phone reach the\s+guitar unit through a Bluetooth MIDI adapter instead of a computer\. While it\s+is tested, it is switched on only for the developer's own account\.\s+Customers and the review account don't see it in this build, and the app\s+doesn't ask them for Bluetooth permission\./,
      'the 1.87.11 notes do not say the Bluetooth code is there, whom it is for, and that nobody else sees it or is asked'
    )
    assert.match(pasted, /If it is offered to customers,\s+that will be in a later version, sent for review with notes that describe\s+it\./, 'the 1.87.11 notes do not say Bluetooth reaches customers only in a reviewed version, or they promise it will')
    /*
     * THOSE WORDS ARE TRUE OF A NEW BUILD ONLY. Build 26, made on 10
     * October, runs its built-in copy on a fresh install's first launch
     * (fallbackToCacheTimeout 0), and that copy shows a BLUETOOTH (BETA)
     * card to an account with the full version — which Apple's demo account
     * is. So the notes are written for a build made from main after 11
     * October, and say so where Justin reads it first.
     *
     * This pinned "Submit a build made from main after 1.87.8"; changed on
     * purpose on 12 October 2026, when Apple approved that build. The line
     * now says it was sent and approved, and that build 26 never is.
     */
    assert.match(section, /\*\*Sent and approved: the 1\.87\.11 build, made from main 3e7ffbf on 11 October\s+2026 \(run 38162666072\), not the 10 October build 26, whose first launch still\s+shows Bluetooth\.\*\*/, 'the 1.87.11 section does not say the build made after 1.87.8 was the one sent, rather than build 26')
    assert.match(section, /Build 26 stays on TestFlight and is never sent for review\./, 'the 1.87.11 section does not say build 26 is never sent for review')
    assert.ok(section.indexOf('Sent and approved: the 1.87.11 build') < notesAt + 200 && section.indexOf('Sent and approved: the 1.87.11 build') < open, 'the line about which build was sent is not above the notes')
    assert.ok(!/anywhere in the app|nothing for the reviewer to\s+reach|reviewer never meets it/.test(section), 'the 1.87.11 section says the reviewer can never meet Bluetooth, and build 26’s first launch shows it')
    const disclosure = pasted.slice(pasted.indexOf('Bluetooth MIDI code, switched on only for the developer.'), pasted.indexOf('\n\n', pasted.indexOf('Bluetooth MIDI code, switched on only for the developer.')))
    assert.ok(!/Bluetooth/.test(pasted.replace(disclosure, '')), 'Bluetooth is mentioned outside the one paragraph that discloses it')
    /* And none of what told a reviewer where it was, now that there is nothing for them to reach. */
    for (const [gone, why] of [
      [/for everyone who has unlocked the app/, 'say Bluetooth is for everyone who has paid'],
      [/Settings,\s+then\s+Bluetooth|BLUETOOTH \(BETA\)/, 'send the reviewer to a Bluetooth row they cannot see'],
      [/VIDEO LINK/, 'promise a video of Bluetooth'],
      [/bluetooth\.html|bluetooth-guide/, 'give the setup guide'],
      [/Amazon|amazon\.com/, 'mention the Amazon buttons on the Bluetooth page'],
      [/diagnostic panel/, 'describe a panel on a page the reviewer cannot open']
    ]) assert.ok(!gone.test(pasted), `the 1.87.11 notes still ${why}`)
    assert.match(pasted, /Regions: the app works the same in every country\.\n/, 'the 1.87.11 notes do not say it works the same in every country')

    /* Held to the app: the row and the page wait for the developer-only check, so the disclosure is what the build does. */
    const settings = read('mobile/src/screens/Settings.js').replace(/\s+/g, ' ')
    assert.match(settings, /\{mayDriveBluetooth\(purchase, bluetoothAdmin\) && bluetoothAllowed && bluetoothSupported\(\) \? \( <SetupRow title="Bluetooth"/, 'the notes say Bluetooth is the developer’s only, and the Settings row is not behind that')
    /*
     * And lib/bluetooth's answer, by the store copy: his account on every
     * copy, a customer's only on a copy whose built-in version opens it
     * (lib/ble-rule.js). This pinned `allowed = accountId(id) ? isAdmin(id) :
     * null`; changed on purpose on 25 October 2026. What the notes promise
     * holds as long as a 1.87.11 copy stays closed to a customer, which is
     * what is asked here, of the rule itself, on both phones.
     */
    assert.match(read('mobile/src/lib/bluetooth.js'), /allowed = accountId\(id\) \? bluetoothOpen\(\{ platform: Platform\.OS, installed: builtInVersion\(\), admin: isAdmin\(id\) \}\) : null/, 'the notes say Bluetooth is the developer’s only, and lib/bluetooth decides it some other way')
    const { bluetoothOpen } = await import('../mobile/src/lib/ble-rule.js')
    for (const platform of ['ios', 'android']) {
      assert.equal(bluetoothOpen({ platform, installed: '1.87.11', admin: false }), false, `a customer on the ${platform} 1.87.11 copy is shown Bluetooth, and its approved notes say they are not`)
      assert.equal(bluetoothOpen({ platform, installed: '1.87.11', admin: true }), true, `the developer’s own account is shut out of Bluetooth on the ${platform} 1.87.11 copy`)
    }

    /* Around the block: the rule that it never reaches customers by an update, and no step left over for a Bluetooth review. */
    assert.match(section, /\*\*Never switched on for customers by an update\.\*\*/, 'the 1.87.11 section does not say Bluetooth is never opened to customers by an update')
    assert.match(section, /3\.3\.1\(C\)/, 'the 1.87.11 section does not name Apple’s licence on changing a reviewed app')
    assert.match(section, /activated remotely/, 'the 1.87.11 section does not name Google’s rule on features activated remotely')
    /* The rule's own words, in 2.5.19 since Apple's guidelines of 16 October 2026 (2.3.1(a) before). */
    assert.match(section, /2\.5\.19 says\s+since 16 October 2026, "Don't include any\s+hidden, dormant, or undocumented\s+features in your app"/, 'the 1.87.11 section does not say why the code is disclosed at all')
    assert.match(section, /"accessible for review"/, 'the 1.87.11 section hides the one place Apple could push back')
    assert.ok(!/- \*\*The video\.\*\*|\*\*The guide is live\.\*\*/.test(section), 'the 1.87.11 section still asks for a Bluetooth video or a live guide before pasting')
    assert.match(section, /\*\*Four things every time that block is pasted\*\*/, 'the 1.87.11 section no longer lists what to check each time the notes are pasted')
    assert.ok(!/BLUETOOTH_TESTERS|Only if Bluetooth goes in/.test(section), 'the 1.87.11 section still says to check a list of accounts, or that Bluetooth may not go in')
    /* The history stays true: what was decided on the 10th is still said, beside what changed on the 11th. */
    assert.match(section, /On 10\s+October 2026 it was to go in this version for every paying customer \("If\s+Bluetooth is ready, let's get it submitted/, 'the 1.87.11 section no longer says what was decided on 10 October')
    assert.match(section, /On 11 October Justin took it back:\s+"Is there any way to just get the Bluetooth on the developers mode for my own\s+phone\? I just feel like it's not ready to have public\."/, 'the 1.87.11 section does not say why Bluetooth went back to his account')

    /* What's New: no Bluetooth line, Play's five lines, and the iPhone's Appearance line after them. */
    const news = section.indexOf("### What's New in This Version, 1.87.11")
    const nOpen = section.indexOf('```', news)
    const whatsNew = section.slice(section.indexOf('\n', nOpen) + 1, section.indexOf('```', nOpen + 3))
    assert.ok(!/bluetooth|adapter/i.test(whatsNew), 'What’s New announces Bluetooth, and customers cannot open it')
    /* Google Play gets its own list now, of what changed since its own 1.87.1. */
    const { fenced: fencedBlock } = await import('../scripts/store-text.mjs')
    const play = fencedBlock(section, '### Google Play release notes, 1.87.11').trim()
    assert.ok(!/bluetooth|adapter/i.test(play), 'the Play release notes announce Bluetooth, and customers cannot open it')
    assert.ok([...play].length <= 500, `the Play release notes come to ${[...play].length}; Play takes 500`)
    assert.ok([...whatsNew].length <= 4000, 'What’s New is longer than Apple takes')

    /*
     * THE DESCRIPTION, and every other block a customer reads: no Bluetooth.
     * It said, for one day, that "in beta, a Bluetooth MIDI adapter" could
     * take the computer's place; both places say the computer again, in
     * words that are true for the app a customer has.
     */
    const { fenced } = await import('../scripts/store-text.mjs')
    const { AFFILIATION } = await import('../shared/affiliation.mjs')
    const current = fenced(store, '### Description')
    /*
     * EXCEPT THE PROMOTIONAL TEXT AND THE PLAY SUMMARY, since 30 October
     * 2026: 1.89.3 is live in both stores, so customers can open Bluetooth,
     * and both change any time, so they say the two ways (the test on what
     * the store says first holds their words). Only while the live store
     * versions are ones that open it.
     */
    const live = JSON.parse(read('public/store-versions.json'))
    const atLeast = (v, w) => { const a = v.split('.').map(Number), b = w.split('.').map(Number); for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] > b[i]; return true }
    assert.ok(atLeast(live.ios, '1.89.0') && atLeast(live.android, '1.89.0'), 'the promotional text and the Play summary offer Bluetooth, and a live store version does not open it')
    const anyTime = [fenced(store, '### Promotional text').trim(), fenced(store, '### Google Play: short description').trim()]
    for (const [where, text] of [
      ['Description', current],
      ['live review notes', fenced(store, '## Review notes')]
    ]) assert.ok(!/bluetooth|adapter|cme\b|widi/i.test(text), `the ${where} mentions Bluetooth, and customers cannot open it`)
    assert.match(current, /Controlling your real unit needs the computer described at the top\.\n/, 'the demo paragraph does not say the computer is what controls a real unit')
    assert.match(current, /HOW IT WORKS\nA phone needs something between it and your Fractal unit: the desktop app\. It runs on your Mac, Windows PC or Linux computer, holds the USB cable, and your phone talks to it\. Get it at fractal\.newbold\.cloud\/downloads\.\n/, 'HOW IT WORKS does not say the desktop app is what sits between the phone and the unit')
    /* The VP4 in part, in the purchase page's words: test/vp4-safety.mjs holds the line to them. */
    assert.match(current, /^SUPPORTED UNITS\nFM3, FM9, Axe-Fx III and AM4, and the VP4 in part\.\nOn a VP4, the app turns effects on and off, /m, 'the supported units changed')
    assert.ok(current.includes(AFFILIATION), 'the Description no longer carries the shared disclaimer')
    assert.match(store, /\*\*This is the one written for 1\.87\.11, and the one the next version keeps\.\*\*\s+It says nothing about Bluetooth\./, 'the Description does not say it is the one for 1.87.11 and the next version, with no Bluetooth')
    assert.match(store, /\*\*On Google Play it can go on whenever\s+it suits:\*\* nothing in it waits for 1\.87\.11 any more\./)

    /* The draft that gave Bluetooth the opening line is withdrawn, with no copy left to paste. */
    const withdrawn = section.indexOf('### The Description with Bluetooth (beta): withdrawn')
    assert.ok(withdrawn > 0, 'the Bluetooth Description draft is not marked withdrawn')
    assert.ok(!/#### App Store copy|#### Google Play copy/.test(store), 'a copy of the Bluetooth Description draft is still in the file to be pasted')
    /*
     * And EVERY block in this file that gets pasted anywhere mentions
     * Bluetooth only to disclose it: the 1.87.11 notes for Apple and the App
     * access note for Google. A description, a What's New or a summary that
     * offers it fails here, whichever heading it sits under.
     *
     * EXCEPT THE 1.89.0 SECTION, the version that opens it to customers
     * (25 October 2026: "I have tried it from an android phone and it works
     * great"). Its blocks offer Bluetooth on purpose, are pasted only
     * on the day 1.89.0 is sent, and are held by their own test below. Every
     * other block keeps this rule as it was.
     */
    const opening = store.slice(store.indexOf('## 1.89.0: Bluetooth (beta) for customers'), store.indexOf('## Kept for the record: the 1.87.1 texts (not for pasting)'))
    assert.ok(opening.length > 1000 && store.indexOf('## 1.89.0: Bluetooth (beta) for customers') > at, 'the 1.89.0 section is missing, or sits above the 1.87.11 one')
    const blocks = store.replace(opening, '').split('```').filter((_, i) => i % 2 === 1)
    assert.ok(blocks.length >= 8, 'the blocks to paste could not be read')
    const offering = blocks.filter((b) => /bluetooth/i.test(b) && !/switched on only for the developer's own account/.test(b) && !anyTime.includes(b.trim()))
    assert.deepEqual(offering, [], 'a block to paste offers Bluetooth, and customers cannot open it')
    /* Apple's notes (1.87.11's, and the next version's), Google's App access note, and its short version for a box that will not take the long one. */
    assert.equal(blocks.filter((b) => /bluetooth/i.test(b) && !anyTime.includes(b.trim())).length, 4, 'Bluetooth is disclosed in some other block than Apple’s notes and Google’s App access (long and short)')
    const draftNote = section.slice(withdrawn, section.indexOf('### By hand in Play Console for 1.87.11'))
    assert.ok(!/```/.test(draftNote), 'the withdrawn draft still has a block to paste')
    /* The 1.87.1 texts are kept at the end for the record, quoted rather than fenced, so none of them is a block to paste. */
    const record = store.indexOf('## Kept for the record: the 1.87.1 texts (not for pasting)')
    assert.ok(record > at, 'the 1.87.1 texts are not kept for the record after the 1.87.11 ones')
    assert.ok(!/```/.test(store.slice(record)), 'a 1.87.1 text kept for the record is fenced, as though it were to be pasted')
    assert.match(store.slice(record), /build 26 went to TestFlight\s+only, and is not to be submitted/, 'the record does not say build 26 is not to be submitted')

    /*
     * BY HAND IN PLAY CONSOLE. What Google's own review found missing, none
     * of which a build can carry: the Data safety form leaves out the
     * purchase record, the account number, the made-up number for a phone
     * not signed in, and the buttons in a bug report's log; App access has
     * no record of the demo account; and the live listing is not this
     * file's.
     */
    const playAt = section.indexOf('### By hand in Play Console for 1.87.11')
    assert.ok(playAt > 0, 'the 1.87.11 section has no Play Console checklist')
    const playHand = section.slice(playAt)
    for (const [type, why] of [
      [/\*\*Financial info → Purchase history\.\*\* Required\./, 'Purchase history'],
      [/\*\*Personal info → User IDs\.\*\* Optional/, 'User IDs'],
      [/\*\*Device or other IDs\.\*\* Required\./, 'Device or other IDs'],
      [/\*\*App activity → App interactions\.\*\* Optional/, 'App interactions']
    ]) assert.match(playHand, type, `the Play checklist does not add ${why} to Data safety`)
    assert.match(playHand, /Keep \*\*No data shared with third parties\*\*/, 'the Play checklist does not say to keep "not shared"')
    assert.match(playHand, /\*\*2\. App access\*\*/, 'the Play checklist leaves out App access')
    const access = fenced(playHand, '**2. App access**')
    for (const label of ['Get started', 'Got it', 'Start free demo', 'Play with ']) {
      assert.ok(access.includes(label), `the Play reviewer is not told to tap "${label}"`)
      assert.ok(read('shared/onboarding.mjs').includes(label), `the Play reviewer is told to tap "${label}", which the walkthrough no longer says`)
    }
    assert.match(access, /This account has the full version\./)
    /* Google's reviewer is told the same as Apple's, in Android's words: the manifest declares Nearby devices and Location for the code that is there. */
    assert.ok(!/tap the gear at the top right for Settings, then Bluetooth|VIDEO LINK/.test(access), 'the Play reviewer is still sent to a Bluetooth row this account cannot see')
    /*
     * And the 1.87.1 note's line about the first launch is gone. It said the
     * copy built into the build could show the Bluetooth card on a fresh
     * install's first launch, which was true of 1.87.1, made on 10 October.
     * 1.87.11 carries the hidden version inside it, so a note that still
     * said it would describe an app Google's reviewer does not have.
     */
    assert.match(
      access,
      /^This build contains Bluetooth MIDI code for a feature \(reaching the guitar unit through a Bluetooth MIDI adapter instead of a computer\) that is switched on only for the developer's own account while it is tested\. No other account sees it, this one included\. That code is why the app declares Nearby devices, and Location on Android 11 and older, where Android needs it to find a Bluetooth device; it never reads where the phone is\. They are asked for only after Connect is tapped on the Bluetooth page, which this account cannot open\./m,
      'the Play reviewer is not told why Nearby devices and Location are declared, and when they are asked for'
    )
    assert.ok(!/first launch|BLUETOOTH \(BETA\)|card under Settings/.test(access), 'the Play note still describes the first-launch Bluetooth card of 1.87.1, which 1.87.11 does not have')
    assert.match(access, /Delete account: Settings \(the gear, top right\) → the account card at the top → Delete account → "Delete my account"\./, 'the Play reviewer is not told where Delete account is')
    assert.match(access, /Developer pages \(accounts, sales, messages, giving an account the full version\) that open only for the developer's own account; the server checks which account is asking\./, 'the Play note does not say the Developer pages are there, and whose they are')
    /* And the short version, for a box that will not take the long one, says the same in fewer words. */
    const short = fencedBlock(playHand, 'use this short version instead')
    for (const label of ['Get started', 'Got it', 'Start free demo', 'Play with ', 'Open Play']) {
      assert.ok(short.includes(label), `the short Play note does not name "${label}"`)
    }
    assert.match(short, /switched on only for the developer's own account while it is tested; this account never sees it\./)
    assert.ok(!/first launch|BLUETOOTH \(BETA\)/.test(short), 'the short Play note describes the 1.87.1 first-launch card')
    /*
     * THE RISK THAT LEAVES, NAMED. The manifest declares Nearby devices (and
     * Location up to Android 11) and the listing promotes nothing they
     * serve. Not changed for it: no listing text moves. If Google flags it,
     * the two ways out and what each costs.
     */
    assert.match(playHand, /\*\*A risk to know about: permissions the listing gives no reason for\.\*\*/, 'the Play checklist does not name the risk of declared permissions the listing gives no reason for')
    assert.match(playHand, /\*\*A build without the Android Bluetooth permissions\.\*\* That moves the\s+fingerprint, so it is a new build for both phones, one iOS and one Android\s+slot/, 'the Play checklist does not say what a build without the permissions costs')
    assert.match(playHand, /\*\*Listing Bluetooth, once customers have it\.\*\*/, 'the Play checklist does not give listing Bluetooth as the other way out')
    assert.match(playHand, /\*\*3\. The listing\*\* \(Grow users → Store presence → Store listings → the default\s+listing\), any time: nothing in it waits for 1\.87\.11 now\./)
    assert.ok(!/paste its \*\*Google Play\s+copy\*\* instead/.test(playHand), 'the Play checklist still offers the withdrawn Bluetooth draft')
    assert.match(playHand, /\*\*Short description:\*\* the one under \*Google Play: short description\*/, 'the Play checklist does not say to paste the lower-case short description')
    assert.match(playHand, /\*\*The trademark line\*\* in the second paragraph has to be the one in this\s+file, which names the VP4/, 'the Play checklist does not say the trademark line must name the VP4')
    assert.ok(AFFILIATION.includes('“VP4”'), 'the shared trademark line no longer names the VP4, and the Play checklist says it does')
  })

  test('the next version’s review notes describe what is new since 1.87.11, fit Apple’s box, and keep the 2.5.19 pair', () => {
    /*
     * Written on 24 October 2026, ahead of the next build pair,
     * because the paragraphs each change asked for came to about 5300 bytes
     * together, and Apple's Notes box takes 4000: cut on the day of
     * submitting, one of the descriptions 2.3.1(a) wants would have been
     * the one to go. Measured the way the 1.87.11 block is, with each video
     * bracket as long as a Drive link and each Tested on bracket 30 long.
     */
    const store = read('docs/app-store.md')
    /* Headed "1.88.3 (the next version)" since 25 October 2026, when 1.89.0's notes were written after it: two "next" blocks would be one too many. */
    const at = store.indexOf('### Notes for App Review, 1.88.3 (the next version)')
    assert.ok(at > 0, 'the next version has no Notes for App Review yet')
    const open = store.indexOf('```', at)
    const pasted = store.slice(open + 3, store.indexOf('```', open + 3))
    const drive = 'https://drive.google.com/file/d/' + 'x'.repeat(33) + '/view?usp=drive_link'
    const brackets = pasted.match(/\[[^\]\n]*\]/g) || []
    assert.equal(brackets.filter((b) => /video link/.test(b)).length, 3, 'the next notes do not hold a place for the three video links')
    const filled = brackets.reduce((t, b) => t.replace(b, /video link/.test(b) ? drive : 'x'.repeat(30)), pasted.trim())
    const bytes = Buffer.byteLength(filled, 'utf8')
    assert.ok(bytes <= 3950, `the next notes are ${bytes} bytes with the links and brackets filled; Apple's Notes box takes 4000`)

    /* The demo steps, in the walkthrough's words, with the startup card's OK first: a first launch meets the card before Get started. */
    const steps = [...pasted.matchAll(/^(\d)\. (.+)$/gm)].map((m) => m[2]).slice(0, 5)
    assert.match(steps[0], /^Tap "OK" on the card that says the app is independent$/, 'the demo steps do not start on the startup card')
    assert.match(read('mobile/src/components/IndependentNotice.js'), /<Press label="OK"/, 'the startup card has no OK button, and the notes say to tap it')
    for (const label of ['Get started', 'Got it', 'Start free demo', 'Play with ', 'Open Play']) {
      assert.ok(steps.some((t) => t.includes(label)), `the next notes do not say to tap "${label}"`)
      assert.ok(read('shared/onboarding.mjs').includes(label), `the next notes say to tap "${label}", which the walkthrough no longer says`)
    }

    /* Every new thing, one paragraph each, and each held to the app it describes. */
    for (const [line, what] of [
      [/^Siri\. Nine App Shortcuts, each phrase with the app's name/m, 'Siri'],
      [/^Colors\. Settings, then Colors, has six looks/m, 'Settings → Colors'],
      [/^Bigger screens\. On iPad and an opened iPhone Duo/m, 'the wider Play'],
      [/^Top bar\. Play's top bar says which unit, on which computer; tap it to change unit\./m, 'the top bar'],
      [/^AM4\. The amp's pedal on Play now switches the amp's boost/m, 'the AM4 boost'],
      [/^VP4\. The app changes a VP4's presets/m, 'the VP4'],
      [/^Apple Watch\. Hold a pedal on the watch to choose its channel\. The watch app is now named Fractal Remote\./m, 'the watch channels and the watch name'],
      [/^Screenshots\. Feedback and Log \(Settings, Troubleshooting\) can add up to three screenshots/m, 'the screenshots']
    ]) assert.match(pasted, line, `the next notes do not describe ${what}`)
    assert.equal((read('mobile/targets/watch/_shared/SiriShortcuts.swift').match(/AppShortcut\(/g) || []).length, 9, 'the notes say nine App Shortcuts, and the Swift has another number')
    assert.match(read('mobile/src/lib/vp4-safety.js'), /VP4_SETUP_TITLE = 'VP4 scenes & presets'/, 'the notes name the VP4 page by a title it no longer has')
    assert.match(read('mobile/targets/watch/expo-target.config.js'), /displayName: 'Fractal Remote'/, 'the notes say the watch app is named Fractal Remote, and it is not')
    assert.match(pasted, /open Fractal Remote on the watch/, 'the notes send the reviewer to the watch app by its old name')
    assert.match(read('mobile/src/components/Shots.js'), /'Choose a screenshot'/, 'the notes say screenshots are picked, and the button is gone')
    assert.match(read('mobile/src/components/TopBar.js'), /computer: link\?\.macName/, 'the notes say the top bar names the computer, and it does not')
    /* What's New for 1.88.0 and Google's release notes, within each store's box, with no Bluetooth line and no AM4 tuner line until Justin has seen it. */
    const pastedUnder = (h) => { const i = store.indexOf(h); const o = store.indexOf('```', i); return store.slice(o + 3, store.indexOf('```', o + 3)).trim() }
    /* The iPhone goes to Apple as 1.88.3 (build 29, Apple's iOS 27 fix for the Bluetooth screen); Android stays 1.88.0. */
    const whatsNew = pastedUnder("### What's New in This Version, 1.88.3")
    const playNotes = pastedUnder('### Google Play release notes, 1.88.0')
    assert.ok(whatsNew.length > 0 && whatsNew.length <= 4000, `What's New for 1.88.3 is ${whatsNew.length} characters; Apple takes 4000`)
    assert.ok(playNotes.length > 0 && playNotes.length <= 500, `Google's release notes for 1.88.0 are ${playNotes.length} characters; Play takes 500`)
    for (const t of [whatsNew, playNotes]) {
      assert.doesNotMatch(t, /bluetooth|tuner on the AM4 itself now stays up/i, 'a store text announces something customers cannot use, or the AM4 tuner line before Justin has seen it')
      assert.doesNotMatch(t, /\b(official|approved by|endorsed|certified|sponsored)\b/i)
    }
    assert.doesNotMatch(playNotes, /Siri/, 'Google is told about Siri, which Android does not have')

    /* The 2.5.19 pair, said whole: the Bluetooth code and the Developer pages. */
    assert.match(pasted, /This build contains Bluetooth MIDI code for a feature that lets the phone reach the guitar unit through a Bluetooth MIDI adapter instead of a computer\. While it is tested, it is switched on only for the developer's own account\. Customers and the review account don't see it in this build, and the app doesn't ask them for Bluetooth permission\./)
    assert.match(pasted, /Settings also has Developer pages \(accounts, sales, messages, giving an account the full version\) that open only for the developer's own account; the server checks which account is asking\./)
    /* And that opening it to customers is a later version with its own notes (2.3.1(a)), never an update to this one. */
    assert.match(pasted, /If it is offered to customers, that will be in a later version, sent for review with notes that describe it\./, 'the notes do not say Bluetooth reaches customers only in a later, reviewed version')
    /* And the deletion paragraph as Apple approved it, with where an unpaid account deletes. */
    assert.match(pasted, /Deleting an account \(Guideline 5\.1\.1\(v\), video 3 below\):[^\n]*purchase page[^\n]{0,80}Delete account is at the foot of that page\. Please try it on a new account, not the demo account\./)
    /* And where that new account is made, by the label the sign-in screen draws: the reviewer may not have met it. */
    assert.match(pasted, /not the demo account\. Create account is on the sign-in screen; the code it emails confirms it\./, 'the notes ask for a new account and do not say where to make one')
    assert.match(read('mobile/src/screens/SignIn.js'), /'Create account'/, 'the notes name a Create account button the sign-in screen no longer draws')
    assert.doesNotMatch(pasted, /\b(official|approved by|endorsed|certified|sponsored)\b/i, 'the notes call the app something Fractal Audio has not made it')
  })

  test('the 1.89.0 texts open Bluetooth to customers on every unit, marked beta, fit every store box, and keep the vendor rules', async () => {
    /*
     * 1.89.0 is the store version that opens Bluetooth to customers,
     * on both phones. Justin, 25 October 2026: "I have tried it from an
     * android phone and it works great", and "make it clear that there's
     * multiple ways to connect the device, but also make it clear that the
     * computer is the preferred method and that Bluetooth will have more lag
     * and not have as many features." Its texts sit in a section of their
     * own, pasted only on the day it is sent, and are held here to the app
     * as it is: every unit (CUSTOMER_UNITS, since "I want it built out for
     * all users" and "I don't wanna wait for the FM3 test", 25 October
     * 2026), the AM4 the only one tried, the beta in Justin's words, the
     * labels the Bluetooth page
     * and Settings draw, Apple's 4000 bytes and Play's 500 characters,
     * Fractal Audio's sentence second in the Description, no other platform
     * in Apple's texts (2.3.10), and the order of the day, Android never
     * sent to Google's review before its store page is in.
     */
    const store = read('docs/app-store.md')
    const { fenced } = await import('../scripts/store-text.mjs')
    const { AFFILIATION } = await import('../shared/affiliation.mjs')
    const { BLUETOOTH_WAYS } = await import('../shared/bluetooth-gear.mjs')
    const { CUSTOMER_UNITS, unitOffered } = await import('../mobile/src/lib/ble-rule.js')
    const { BLE_UNITS } = await import('../mobile/src/lib/bleWire.js')
    const from = store.indexOf('## 1.89.0: Bluetooth (beta) for customers')
    const to = store.indexOf('## Kept for the record: the 1.87.1 texts (not for pasting)')
    assert.ok(from > store.indexOf('### By hand in Play Console for 1.87.11') && to > from, 'the 1.89.0 section is missing, or out of place')
    const section = store.slice(from, to)
    const flat = (s) => s.replace(/\s+/g, ' ')
    const block = (heading) => fenced(section, heading).trim()
    const notes = block('### Notes for App Review, 1.89.0')
    const whatsNew = block("### What's New in This Version, 1.89.0")
    const description = block('### Description, from 1.89.0 (App Store and Google Play)')
    const keywords = block('### Keywords, from 1.89.0')
    const play = block('### Google Play release notes, 1.89.0')
    const access = block('### Google Play App access, 1.89.0')
    const accessShort = block('paste the short one instead')
    const paragraph = (text, start) => text.split('\n\n').find((p) => p.startsWith(start)) || ''

    /* APPLE'S BOX, measured the way the 1.87.11 and 1.88.3 blocks are, with a fourth video: Bluetooth's. */
    const drive = 'https://drive.google.com/file/d/' + 'x'.repeat(33) + '/view?usp=drive_link'
    const brackets = notes.match(/\[[^\]\n]*\]/g) || []
    assert.equal(brackets.filter((b) => /video link/.test(b)).length, 4, 'the 1.89.0 notes do not hold a place for four video links')
    const bytes = Buffer.byteLength(brackets.reduce((t, b) => t.replace(b, /video link/.test(b) ? drive : 'x'.repeat(30)), notes), 'utf8')
    assert.ok(bytes <= 3950, `the 1.89.0 notes are ${bytes} bytes with the links and brackets filled; Apple's Notes box takes 4000`)
    assert.match(notes, /\nVideos:\n1\. FM3 hardware: \[FM3 video link\]\n2\. Presets: \[presets video link\]\n3\. Deleting an account: \[account deletion video link\]\n4\. Bluetooth with an AM4: \[Bluetooth video link\]$/, 'the four videos are not listed at the end of the 1.89.0 notes')
    /* New since 1.87.11: 1.88.3 never went to the App Store ("Wait till the Bluetooth version"), so Apple last saw 1.87.11. */
    assert.match(notes, /\n\nNew since 1\.87\.11:\n\n/, 'the 1.89.0 notes do not say what they are new since')
    const also = paragraph(notes, 'Also new:')
    for (const [said, what] of [[/Siri/, 'Siri'], [/Colors/, 'Colors'], [/iPad/, 'the wider Play'], [/top bar/, 'the top bar'], [/boost/, 'the AM4 boost'], [/VP4 presets and scenes through the computer/, 'the VP4 by MIDI'], [/screenshots/, 'screenshots'], [/never the camera/, 'that the camera is never used'], [/never audio/, 'that Siri gets no audio']]) {
      assert.match(also, said, `the 1.89.0 notes leave out ${what}, new since 1.87.11`)
    }
    const steps = [...notes.matchAll(/^(\d)\. (.+)$/gm)].map((m) => m[2]).slice(0, 5)
    assert.match(steps[0], /^Tap "OK" on the card that says the app is independent$/, 'the 1.89.0 demo steps do not start on the startup card')
    for (const label of ['Get started', 'Got it', 'Start free demo', 'Play with ', 'Open Play']) {
      assert.ok(steps.some((t) => t.includes(label)), `the 1.89.0 notes do not say to tap "${label}"`)
      assert.ok(read('shared/onboarding.mjs').includes(label), `the 1.89.0 notes say to tap "${label}", which the walkthrough no longer says`)
    }

    /* EVERY LINE THAT SAID "ONLY THROUGH A COMPUTER" IS TRUE OF 1.89.0: the opening, the Hardware line and the Services line. */
    const opening = notes.split('\n\n')[0]
    assert.match(opening, /through a computer the unit is plugged into by USB, or, new in this version, through a Bluetooth MIDI adapter plugged into the unit, with no computer\.$/, 'the 1.89.0 notes still open by saying the app works only through a computer')
    assert.match(paragraph(notes, 'Hardware (Guideline 2.1)'), /video 1 below[^\n]*the computer way[^\n]*\. Video 4 shows Bluetooth with a real AM4\.$/, 'the Hardware line does not point at the Bluetooth video')
    assert.match(paragraph(notes, 'Services the app uses'), /Bluetooth goes from the phone straight to the adapter, through no server\.$/, 'the Services line leaves Bluetooth out')
    assert.doesNotMatch(notes, /switched on only for the developer|don't see it in this build/, 'the 1.89.0 notes keep the 1.88.3 disclosure, which is not true of a copy that opens Bluetooth')

    /* THE BLUETOOTH PARAGRAPH: where it is, what to tap first, when the permission is asked, and the video, by the labels the app draws. */
    const bt = paragraph(notes, 'Bluetooth, part of the full version, offered on the AM4, FM3, FM9, Axe-Fx III and VP4:')
    assert.ok(bt.length > 400, 'the 1.89.0 notes do not describe Bluetooth')
    for (const [said, why] of [
      [/It is not in the no-account demo\./, 'that the demo with no account has no Bluetooth'],
      [/Signed in with the demo account: tap the gear at the top right for Settings, then Bluetooth under My rig\./, 'where the row is'],
      [/tap AM4 under "1 · Pick your unit" first \(Connect stays dimmed until a unit is picked\), then tap Connect\./, 'to pick AM4 before Connect, which stays dimmed until a unit is picked'],
      [/Only then does the app ask for Bluetooth permission/, 'that nothing is asked before Connect'],
      [/With no adapter it finds none, and the page says no adapter was connected\./, 'what an empty Apple screen means'],
      [/Video 4 below shows it working: filmed on an iPhone signed in with the demo account/, 'where the video is, and whose account it was filmed on'],
      [/with no editing or saving/, 'that there is no editing or saving'],
      [/a VP4: presets and scenes only/, 'what a VP4 gets'],
      [/Tried so far on the AM4 and the FM3; the FM9, Axe-Fx III and VP4 each say on the page that they have not been tried yet/, 'which units it has been tried on, and that the others say so'],
      [/Report a Bluetooth problem sends a report in one tap/, 'the one-tap report'],
      [/the app earns nothing from them/, 'that the Amazon buttons earn nothing']
    ]) assert.match(bt, said, `the 1.89.0 Bluetooth paragraph does not say ${why}`)
    /* The words the notes quote are the app's own. */
    const gearWords = await import('../shared/bluetooth-gear.mjs')
    /* Out of beta since 26 October 2026 ("remove anything that says beta on it for Bluetooth"): the page's note and these texts say where it has been tried, and never "beta". */
    assert.ok(gearWords.BETA_NOTE_IPHONE.startsWith('So far, Bluetooth has been tried on the AM4 and the FM3'), 'the notes say it has been tried where the page does not')
    for (const [where, text] of [['notes', notes], ['What’s New', whatsNew], ['Description', description], ['Play release notes', play], ['App access note', access], ['short App access note', accessShort]]) {
      for (const l of text.split('\n').filter((x) => /bluetooth/i.test(x))) assert.doesNotMatch(l, /\bbeta\b/i, `the 1.89.0 ${where} still call Bluetooth a beta`)
    }
    assert.equal(gearWords.REPORT_BUTTON, 'Report a Bluetooth problem', 'the notes name a report button the page does not have')
    const page = read('mobile/src/screens/Bluetooth.js')
    assert.ok(page.includes('<Heading>1 · Pick your unit</Heading>'), 'the notes name step 1 by a heading the Bluetooth page no longer draws')
    assert.match(page, /const canStart = !!b\.unit && paid/, 'Connect no longer waits for a unit, and the notes say it does')
    assert.match(page, /disabled=\{!canStart \|\| b\.looking\}/, 'Connect is not the button that waits for a unit')
    assert.ok(page.includes(": 'Connect'}") && page.includes('No adapter was connected.'), 'the notes name a Connect button or a no-adapter line the page no longer has')
    assert.match(read('mobile/src/components/Press.js'), /opacity: disabled \? 0\.45/, 'a button that waits no longer looks dimmed, and the notes say Connect does')
    const settings = read('mobile/src/screens/Settings.js').replace(/\s+/g, ' ')
    assert.ok(settings.indexOf('<SetupRow title="Bluetooth"') > settings.indexOf('<Group title="My rig"'), 'the texts send people to Settings → My rig → Bluetooth, which is not there')

    /*
     * 2.5.19: what the developer's own account sees and the review account
     * does not, every piece of it. No unit any more: on the copy 1.89.0
     * makes, a customer is offered every unit his account is (they were
     * three units still being tried until 25 October 2026).
     */
    const BUILD = { ios: '1.89.0', android: '1.89.0' }
    const KEYED = Object.fromEntries(CUSTOMER_UNITS.map((u) => [u, BUILD]))
    const extra = BLE_UNITS.filter((u) => !unitOffered(u.key, { platform: 'ios', installed: '1.89.0', units: KEYED }))
    assert.deepEqual(extra, [], 'the 1.89.0 copy keeps a unit for the developer’s account, and the notes say none is')
    for (const [where, text] of [['Apple notes', paragraph(notes, "Only on the developer's own account:")], ['App access note', paragraph(access, "Only on the developer's own account:")]]) {
      assert.match(text, /Developer pages \(access, sales, accounts, messages, Bluetooth testing tools and the like\)/, `the ${where} leave out the Developer pages, or Access, the one that grants the full version`)
      assert.match(text, /testing tools/, `the ${where} leave out the Bluetooth page's testing tools`)
      for (const u of BLE_UNITS) assert.ok(!text.includes(u.name), `the ${where} name the ${u.name} as the developer’s alone, and every unit is the review account’s too`)
      assert.match(text, /No other account (is shown|sees) them, (the demo account|this one) included/, `the ${where} do not say the review account is shown none of it`)
    }

    /* THE UNITS: every Bluetooth text offers what CUSTOMER_UNITS offers, says it has been tried on the AM4 only, and promises a VP4 nothing it does not get. */
    const NAMES = Object.fromEntries(BLE_UNITS.map((u) => [u.key, u.name]))
    const offered = CUSTOMER_UNITS.map((k) => NAMES[k])
    const btHead = 'BLUETOOTH\n'
    const btDescription = description.slice(description.indexOf(btHead), description.indexOf('\n\n', description.indexOf(btHead)))
    const lines = (text) => text.split('\n').filter((l) => /bluetooth/i.test(l)).join('\n')
    for (const [where, text] of [
      ['notes', bt],
      ['What’s New', lines(whatsNew)],
      ['Description', btDescription],
      ['Play release notes', lines(play)],
      ['App access note', paragraph(access, 'Bluetooth')],
      ['short App access note', paragraph(accessShort, 'Bluetooth')]
    ]) {
      assert.ok(text.length > 80, `the 1.89.0 ${where} say nothing of Bluetooth`)
      for (const name of offered) assert.ok(new RegExp(`\\b${name}\\b`).test(text), `the 1.89.0 ${where} do not name the ${name}, a unit customers are offered`)
      if (where !== 'short App access note') assert.match(text, /[Tt]ried (so far )?on the AM4 and the FM3/, `the 1.89.0 ${where} do not say it has been tried on the AM4 and the FM3`)
      if (where !== 'short App access note') assert.match(text, /VP4[^.]*presets and scenes/, `the 1.89.0 ${where} do not say a VP4 gets presets and scenes only`)
      /* Never that it works on a unit nobody has run it on. */
      assert.doesNotMatch(text, /works (on|with) (the |an? )?(FM9|Axe-Fx III|VP4)|tried on (the |an? )?(FM9|Axe-Fx III|VP4)\b/, `the 1.89.0 ${where} say it works on a unit it has not run on`)
    }

    /* WHAT'S NEW: Bluetooth first, in his terms, and nothing that waits. Only this block may name Bluetooth; 1.87.11's and 1.88.3's are held above to naming none. */
    assert.ok([...whatsNew].length <= 4000, `What's New for 1.89.0 is ${[...whatsNew].length} characters; Apple takes 4000`)
    const newLine = whatsNew.split('\n')[0]
    assert.match(newLine, /^• New: Bluetooth, offered on the AM4, FM3, FM9, Axe-Fx III and VP4\./, 'What’s New does not open on Bluetooth for every unit')
    /* Everything since 1.87.11 on the App Store: the 1.88.3 list, which never reached it, comes along. */
    const old = fenced(store, "### What's New in This Version, 1.88.3").trim().split('\n')
    for (const line of old.filter((l) => !/No computer signed in yet\?/.test(l))) assert.ok(whatsNew.split('\n').some((l) => l.startsWith(line.slice(0, 40))), `What’s New for 1.89.0 leaves out "${line.slice(0, 60)}", new since 1.87.11`)
    assert.match(newLine, /There are now two ways to connect, and the computer is still the best one: Bluetooth has more lag and fewer features, with no editing or saving\./, 'What’s New does not say the two ways, the computer first, in Justin’s terms')
    assert.match(newLine, /part of the full version, and the adapter parts are sold separately, by other companies/, 'What’s New does not say it comes with the full version and needs parts bought elsewhere')
    assert.doesNotMatch(whatsNew, /tuner on the AM4 itself now stays up/, 'What’s New carries the AM4 tuner line before Justin has seen it')

    /* GOOGLE PLAY'S RELEASE NOTES, within 500, with the same three things. */
    assert.ok([...play].length <= 500, `Google's release notes for 1.89.0 are ${[...play].length} characters; Play takes 500`)
    assert.match(play, /^• New: Bluetooth, on the AM4, FM3, FM9, Axe-Fx III and VP4 \(a VP4: presets and scenes\)\. With the full version/, 'the Play notes do not open on Bluetooth for every unit')
    assert.match(play, /The computer is still the best way: Bluetooth has more lag and fewer features, with no editing or saving\./, 'the Play notes do not say the computer is the best way')
    assert.doesNotMatch(play, /Siri/, 'Google is told about Siri, which Android does not have')

    /* THE DESCRIPTION: today's, REQUIRES A COMPUTER still first and Fractal Audio's sentence still second, with three paragraphs made true and one section added. */
    const paragraphs = description.split('\n\n')
    assert.match(paragraphs[0], /^REQUIRES A COMPUTER\./, 'the 1.89.0 Description no longer opens on the computer')
    assert.match(paragraphs[0], /so the computer has to stay on and connected while you play\. There is also Bluetooth, with more lag: see below\.$/, 'the first paragraph does not say there is a second way')
    assert.equal(paragraphs[1], AFFILIATION, 'the 1.89.0 Description’s second paragraph is not the shared disclaimer')
    assert.equal(description.split(AFFILIATION).length, 2, 'the 1.89.0 Description says the disclaimer twice')
    assert.ok([...description].length <= 4000, `the 1.89.0 Description is ${[...description].length} characters; both stores take 4000`)
    const today = fenced(store, '### Description').trim().split('\n\n')
    assert.deepEqual(today.filter((p) => !paragraphs.includes(p)).map((p) => p.split(/[.\n]/)[0]), ['REQUIRES A COMPUTER', 'TRY THE DEMO, FOR AS LONG AS YOU LIKE', 'HOW IT WORKS'], 'the 1.89.0 Description changes more of today’s than the computer sentence, the demo paragraph and HOW IT WORKS')
    assert.equal(paragraphs.length, today.length + 1, 'the 1.89.0 Description is not today’s with one section added')
    assert.equal(paragraphs.indexOf(btDescription), paragraphs.findIndex((p) => p.startsWith('HOW IT WORKS\n')) + 2, 'the Bluetooth section is not straight after HOW IT WORKS')
    assert.match(paragraph(description, 'TRY THE DEMO'), /Controlling your real unit needs the computer described at the top \(or Bluetooth\)\.$/, 'the demo paragraph still says only the computer controls a real unit')
    assert.match(paragraph(description, 'HOW IT WORKS'), /^HOW IT WORKS\nA phone needs something between it and your Fractal unit, and the best one is the desktop app\./, 'HOW IT WORKS still says the desktop app is the only way')
    assert.ok(btDescription.includes(BLUETOOTH_WAYS), 'the Bluetooth section does not say the two ways in the app’s own words')
    for (const [said, why] of [
      [/It is offered on the AM4, FM3, FM9, Axe-Fx III and VP4/, 'every unit'],
      [/So far it has been tried on the AM4 and the FM3/, 'which units have been tried'],
      [/a CME U2MIDI Pro cable/, 'what the FM3 was tried with'],
      [/Never plug the C2MIDI Pro or a WIDI Master into an FM3/, 'that those are never for an FM3'],
      [/No editing or saving/, 'no editing or saving'],
      [/It is part of the full version\./, 'that it comes with the full version'],
      [/sold separately, by other companies/, 'that the parts are sold separately, by other companies'],
      [/gets nothing from the app's links to them/, 'that the app earns nothing from the links'],
      [/What to buy and how to plug it in: Settings → My rig → Bluetooth\.$/, 'where to find what to buy']
    ]) assert.match(btDescription, said, `the Bluetooth section does not say ${why}`)

    /* KEYWORDS: today's, with bluetooth and midi on the end, and no other company's names. */
    assert.equal(keywords, `${fenced(store, '### Keywords (100, commas, no spaces after them)').trim()},bluetooth,midi`, 'the 1.89.0 keywords are not today’s with bluetooth,midi')
    assert.ok(keywords.length <= 100 && !/,\s|\bcme\b|widi/i.test(keywords), `the 1.89.0 keywords are ${keywords.length} characters, or name CME's products`)

    /* GOOGLE'S APP ACCESS NOTE: where the row is, and the device it needs, held to the native module's own check. */
    const btAccess = paragraph(access, 'Bluetooth')
    assert.match(access, /^This account has the full version\./)
    for (const label of ['Get started', 'Got it', 'Start free demo', 'Play with ', 'Open Play']) {
      assert.ok(access.includes(label) && accessShort.includes(label), `Google's reviewer is not told to tap "${label}"`)
    }
    for (const [said, why] of [
      [/Settings \(the gear, top right\) → My rig → Bluetooth\./, 'where the row is'],
      [/The row is there only on a device that has both MIDI and Bluetooth LE, so a device or emulator without them does not show it\./, 'that a device or emulator without MIDI and Bluetooth LE shows no row'],
      [/tap AM4 under "1 · Pick your unit" first \(Connect stays dimmed until a unit is picked\), then Connect\./, 'to pick AM4 before Connect'],
      [/It has been tried on the AM4 and the FM3 so far, and each other unit says so\./, 'which units have been tried'],
      [/Only then does Android ask for Nearby devices \(Location on Android 11 and older/, 'when Nearby devices and Location are asked for'],
      [/the app never reads where the phone is\./, 'that the app never reads where the phone is'],
      [/it looks for ten seconds and says No adapter found\./, 'what happens with no adapter'],
      [/\[Bluetooth video link\]$/, 'the video']
    ]) assert.match(btAccess, said, `Google's App access note does not say ${why}`)
    assert.match(read('mobile/modules/fractal-ble-midi/android/src/main/java/cloud/newbold/fractalremote/blemidi/FractalBleMidiModule.kt'), /hasSystemFeature\(PackageManager\.FEATURE_MIDI\) &&\s+packages\.hasSystemFeature\(PackageManager\.FEATURE_BLUETOOTH_LE\)/, 'the row no longer needs MIDI and Bluetooth LE, and Google’s note says it does')
    assert.ok(read('mobile/src/lib/bluetooth.js').includes('No adapter found.') && page.includes('looks for the adapter for ten seconds'), 'Google’s note says what an Android phone shows with no adapter, and the app says something else')
    assert.doesNotMatch(access, /which this account cannot open|No other account sees it, this one included\. That code/, 'the App access note keeps the 1.87.11 note’s Bluetooth paragraph, which is not true of 1.89.0')
    /* And where a NEW account deletes itself, as Apple's notes say: it opens on the purchase page, not Settings, so the Settings path alone sends Google's reviewer nowhere. */
    assert.match(paragraph(access, 'Delete account:'), /^Delete account: Settings \(the gear, top right\) → the account card at the top → Delete account → "Delete my account"\. A new account, without the full version, opens on the purchase page instead, and Delete account is at the foot of that page\. Please try it on a new account, not this one\.$/, 'Google’s reviewer is sent to a new account to delete, and not told it opens on the purchase page')
    assert.match(read('mobile/src/screens/Paywall.js'), /label="Delete account"/, 'the purchase page has no Delete account, and Google’s note says it does')
    for (const [said, why] of [
      [/only on devices with MIDI and Bluetooth LE/, 'the device it needs'],
      [/Tap AM4, then Connect: only then is Nearby devices asked for \(Location on Android 11 and older\), never to read location\./, 'what to tap, and when the permission is asked'],
      [/\[Bluetooth video link\]/, 'the video'],
      [/Developer pages, testing tools: developer's only\./, 'what only the developer’s account sees']
    ]) assert.match(accessShort, said, `the short App access note does not say ${why}`)

    /* NO OTHER PLATFORM IN APPLE'S TEXTS (2.3.10), and the Description, which both stores share, names neither. */
    for (const [where, text] of [['notes', notes], ['What’s New', whatsNew], ['Description', description], ['keywords', keywords]]) {
      assert.doesNotMatch(text, /android|google play|play store/i, `the 1.89.0 ${where} name another platform, which Apple's 2.3.10 turns down`)
    }

    /* FRACTAL AUDIO'S RULES, in every 1.89.0 block: nothing official, no Inc., no "the Fractal app", no help from anyone but Justin, no app called free. */
    const disclaimer = /not affiliated with, endorsed by, or\s+supported by/gi
    for (const [where, text] of [['notes', notes], ['What’s New', whatsNew], ['Description', description], ['keywords', keywords], ['Play release notes', play], ['App access note', access], ['short App access note', accessShort]]) {
      assert.doesNotMatch(text.replace(disclaimer, ''), /\b(official|certified|approved|endorsed|authori[sz]ed|sponsored)\b/i, `the 1.89.0 ${where} call the app something Fractal Audio has not made it`)
      assert.doesNotMatch(text, /Fractal Audio Systems,? Inc\b|sponsored by/i, `the 1.89.0 ${where} say Inc. or sponsored`)
      assert.doesNotMatch(text, /\bfractal\s+(?:(?:desktop|computer|mac|windows|linux|pc|phone|watch)\s+)?app/i, `the 1.89.0 ${where} say "the Fractal app"`)
      assert.doesNotMatch(text, /fractalaudio\.com|contact Fractal|Fractal('s| Audio's)? support/i, `the 1.89.0 ${where} send somebody to Fractal Audio for help with the app`)
    }
    for (const [where, text] of [['What’s New', whatsNew], ['Description', description], ['Play release notes', play]]) {
      assert.ok(!/\bfree\b[^.\n]{0,40}\bapp\b|\bapp\b[^.\n]{0,20}\bis free\b/i.test(text), `the 1.89.0 ${where} call an app free`)
    }

    /* VIDEO 4, for Justin: the review account, the plugs first, a private link only, and no Fractal logo but the unit's own. */
    const video = flat(section.slice(section.indexOf('### Video 4: Bluetooth with an AM4'), section.indexOf('### Submission day for 1.89.0')))
    for (const [said, why] of [
      [/sign in with the review account \(the one in App Review Information\), not yours/, 'to film it on the review account'],
      [/Not a screen recording\./, 'that it is filmed, not recorded'],
      [/The AM4 itself is the one exception, and only in a private review video like this one/, 'that the unit is the only Fractal logo in it'],
      [/\*\*Anyone with the link\*\*/, 'how the link is shared'],
      [/\*\*Never make it public\*\*/, 'that it is never made public']
    ]) assert.match(video, said, `the video 4 steps do not say ${why}`)
    assert.ok(video.indexOf('**The plugs first.**') > 0 && video.indexOf('**The plugs first.**') < video.indexOf('then **Connect**'), 'the video does not show the plugs before Connect')

    /* THE DAY, IN ORDER, and Android never sent to Google's review by mobile.yml: its boxes named as the workflow has them. */
    const day = flat(section.slice(section.indexOf('### Submission day for 1.89.0, step by step'), section.indexOf('### If Bluetooth has to be switched off')))
    const workflow = read('.github/workflows/mobile.yml')
    for (const box of ['Which platform to build', 'Which eas.json build profile', 'Send it to TestFlight, and to Google Play production (everyone), when it finishes', 'Skip building; send the last build that succeeded', 'Publish a JS update instead of building']) {
      assert.ok(workflow.includes(`description: '${box}`), `the steps name a box mobile.yml does not have: ${box}`)
      assert.ok(day.includes(box), `the steps leave out the ${box} box`)
    }
    assert.match(day, /run 1, the build pair\.\*\*[^]*?Which platform to build: \*\*all\*\*[^]*?Which eas\.json build profile: \*\*production\*\*[^]*?when it finishes: \*\*unticked\*\*/, 'run 1 does not leave the Send box unticked')
    assert.match(day, /run 2, the iPhone to TestFlight\*\*[^]*?Which platform to build: \*\*ios\*\*[^]*?Skip building; send the last build that succeeded: \*\*ticked\*\*/, 'run 2 does not send the iPhone alone, with Skip building')
    assert.match(day, /\*\*Never with all or android\*\* for 1\.89\.0/, 'the steps do not warn that Skip building sends Android to Google’s review too')
    /* What the steps say of mobile.yml is what it does: the ticked box submits as it builds, Skip building submits the newest build, and eas.json still sends Android to production. */
    assert.match(workflow, /\$\{\{ inputs\.submit && '--auto-submit' \|\| '' \}\}/, 'the Send box no longer submits as it builds, and the steps say it does')
    assert.match(workflow, /if: \$\{\{ inputs\.submit_only \}\}[\s\S]{0,200}eas submit \\\s+--platform "\$\{\{ inputs\.platform \}\}"[\s\S]{0,120}--latest/, 'Skip building no longer sends the newest build of the platform picked')
    assert.equal(JSON.parse(read('mobile/eas.json')).submit.production.android.track, 'production', 'eas.json no longer sends Android to production, and the steps are written around it')
    assert.match(read('docs/expo-builds.md'), /\*\*That pair, 1\.89\.0, is started with the Send box unticked\*\*/, 'the build ledger does not say the 1.89.0 pair is started with Send unticked')
    const at = (s) => {
      const i = day.indexOf(s)
      assert.ok(i >= 0, `the submission steps no longer say ${s}`)
      return i
    }
    const order = [
      at('**Justin: App Store Connect → App Privacy**'),
      at('**Justin: Macs and Apple Vision Pro.**'),
      at('Managed publishing → on.**'),
      at('mobile.yml, run 1, the build pair.'),
      at('"Bluetooth (beta) for customers"'),
      at('mobile.yml, run 2, the iPhone to TestFlight'),
      at('**The guideline pass**'),
      at('**GitHub: the website, merged before anything is sent**'),
      at('**Manually release this version**'),
      at('**Create new release**'),
      at('**Send changes for review**'),
      at('**Release only once both have approved**'),
      at('Managed publishing → off**'),
      at("**Justin: Android's 100% day**"),
      at('raise the rollout to **100%**'),
      at('Full description: the 1.89.0 Description'),
      at("public/store-versions.json: that store's number to 1.89.0"),
      at("**The setup emails' Bluetooth paragraph**")
    ]
    assert.deepEqual([...order].sort((a, b) => a - b), order, 'the submission steps are out of order')
    /*
     * MANAGED PUBLISHING, ON AND OFF. On before the build, with 1.88.0 published by hand if it is waiting (step 4 needs it on his phone from
     * Play); off right after 1.89.0's Publish, or every later Android release passes review and reaches nobody.
     */
    assert.match(day, /\*\*So when Google approves 1\.88\.0, go to Publishing overview and press Publish changes straight away\*\*/, 'Managed publishing goes on with nothing telling Justin to publish 1.88.0')
    assert.match(day, /Google with 1\.88\.0 live in Production, not waiting under Changes ready to publish/, 'step 5 reads as done with 1.88.0 only approved')
    assert.match(day, /Apple with nothing in review and nothing waiting at Pending Developer Release/, 'step 5 reads as done with a version only approved, which keeps the + from making 1.89.0')
    /* THE LISTING FOLLOWS THE ROLLOUT: Play's sitting sends the release and App access only, and the Description goes in on the 100% day, as Google's staged-rollout page advises. */
    const playSitting = day.slice(at('**Justin: Play Console, in one sitting**'), at("**E. Each store's live day**"))
    assert.match(playSitting, /The store listing: \*\*no change today\.\*\*/, 'the Play sitting changes the listing while 4 in 5 Android customers are given 1.88.0')
    assert.match(playSitting, /the release and App access, both → \*\*Send changes for review\*\*/, 'the Play sitting sends something besides the release and App access')
    assert.ok(!playSitting.includes('Full description: the 1.89.0 Description'), 'the Play sitting still pastes the 1.89.0 Description')
    assert.match(playSitting, /"If your app update requires changes to the store listing, we recommend updating your store listing after your release rolls out to 100% of users\."/, 'the rollout choice does not cite Google’s own advice')
    /* THE IPHONE'S BRAKE: held for the release together, and phased over 7 days so a pause is there. */
    assert.match(day, /Phased Release for Automatic Updates: \*\*Release update over 7-day period using phased release\*\*/, 'the iPhone has no phased release, so nothing slows 1.89.0 reaching it')
    assert.match(day, /iPhone and iPad Apps on Apple Silicon Mac/, 'the steps do not say where the Mac setting is')
    const beforeSending = day.slice(at('**GitHub: the website, merged before anything is sent**'), at('**Justin: App Store Connect.**'))
    /* The Support URL a reviewer reads gets one sentence true before and after approval; /bluetooth waits for the live day. */
    assert.match(beforeSending, /\*\*bluetooth-guide\.html\*\*[^]*\*\*privacy\.html\*\*[^]*\*\*support\.html\*\*, the App Store's Support URL[^]*"From version 1\.89\.0, the app can also connect to your unit with no computer, by Bluetooth through an adapter; the computer is still the best way, and Bluetooth has more lag and fewer features\."[^]*\*\*Not yet\*\* \/bluetooth \(bluetooth\.html\), which says/, 'the guide, the privacy page and the support page do not change before submitting, or /bluetooth does')
    /* Done with the 1.89.0 texts; since the live day (30 October 2026) support.html says the two ways instead (step 18, held by the /bluetooth test). */
    /* The guideline pass, written down, with the date of the guidelines it read. */
    const pass = flat(section.slice(section.indexOf('### The guideline pass for 1.89.0'), section.indexOf('### Notes for App Review, 1.89.0')))
    assert.match(pass, /"Last Updated: October 16, 2026"/, 'the guideline pass does not say which guidelines it read')
    for (const g of ['2.1', '2.2', '2.3.1(a)', '2.5.19', '2.3.10', '2.3.12', '1.4', '3.1.1', '4.1(c)', '5.2.1', '5.1.1(i)', '5.1.1(v)', '5.1.2']) assert.ok(pass.includes(`**${g}`) || pass.includes(` ${g} `) || pass.includes(`${g} (`) || pass.includes(`and ${g}`), `the guideline pass leaves out ${g}`)
    const liveDay = day.slice(at("**E. Each store's live day**"))
    for (const [said, why] of [
      [/\/bluetooth \(bluetooth\.html\) becomes the real page/, '/bluetooth'],
      [/support\.html: "The phone doesn't talk to the unit directly" becomes the two ways/, 'the support page'],
      [/the noindex comes off/, 'the guide listed'],
      [/supabase\/README\.md, \*Bluetooth in the emails, from 1\.89\.0\*/, 'the setup emails']
    ]) assert.match(liveDay, said, `the live day does not change ${why}`)
    assert.ok(read('supabase/README.md').includes('### Bluetooth in the emails, from 1.89.0'), 'the steps send Justin to an email section supabase/README.md does not have')

    /* IF JUSTIN SKIPS 1.88.3, AND IF IT HAS TO BE SWITCHED OFF: written down, with what costs a build. */
    /* 1.88.3 was skipped ("Wait till the Bluetooth version"): the section says so, and is written for it. */
    assert.match(flat(section), /"Wait till the Bluetooth version"[^]{0,200}So 1\.88\.3 stays on TestFlight, and 1\.89\.0 is the first App Store version since 1\.87\.11/, 'the section does not say 1.88.3 was skipped, and 1.89.0 follows 1.87.11')
    const off = flat(section.slice(section.indexOf('### If Bluetooth has to be switched off, or Apple says no to it'), section.indexOf("### Later: Google's question about location")))
    for (const [said, why] of [
      [/\*\*A fresh install's first launch runs the copy built into it\*\*/, 'why no update can close it on a first launch'],
      [/\*\*Apple says no to Bluetooth itself\.\*\*/, 'what happens if Apple refuses it'],
      [/\*\*Halt rollout\*\*/, 'the Android halt'],
      [/\*\*Pause Phased Release\*\* stops automatic updates to 1\.89\.0/, 'the iPhone pause'],
      [/tap Restart now, or close the app fully and open it again/, 'how a reviewer sees words sent as an update, since a first launch runs the built-in ones'],
      [/\*\*Never leave approved changes waiting under Changes ready to publish:\*\*/, 'that an approved release left waiting goes out with the next Publish'],
      [/\*\*Developer Rejected\*\*/, 'how the version page is freed while 1.89.0 waits at Pending Developer Release'],
      [/\| Google says no to Bluetooth, and still no after a reply \| One Android build/, 'what Google refusing it costs'],
      [/\| Trouble after release: iPhone paused \| Nothing: Pause Phased Release/, 'the iPhone pause in the table'],
      [/an emergency step only/, 'that closing it by update is an emergency step'],
      [/\| Apple says no to Bluetooth, and still no after a reply \| One iPhone build/, 'what a refusal costs']
    ]) assert.match(off, said, `the switch-off plan does not say ${why}`)
    assert.match(read('mobile/app.json'), /"fallbackToCacheTimeout": 0/, 'a first launch waits for the update now, and the switch-off plan says it does not')

    /* AND GOOGLE'S LOCATION QUESTION, for later, held to the manifest it describes. */
    const location = section.slice(section.indexOf("### Later: Google's question about location (from 27 January 2027)"))
    assert.match(fenced(location, '### Later').trim(), /^Fractal Remote asks for precise location only on Android 11 and older, and only when the user taps Connect on its Bluetooth page/, 'the location answer is missing')
    /* Android 7 to 9 get precise location from the same one request, where approximate would do: the answer says so, never "not enough" of every version. */
    assert.match(fenced(location, '### Later').trim(), /approximate location is not enough there\. On Android 9 and older, where approximate location would be enough/, 'the location answer says approximate is not enough on Android 9 and older too')
    assert.match(read('mobile/modules/fractal-ble-midi/android/src/main/java/cloud/newbold/fractalremote/blemidi/FractalBleMidiModule.kt'), /arrayOf\(Manifest\.permission\.ACCESS_FINE_LOCATION\)/, 'below Android 12 the module no longer asks for precise location, and the answer says it does')
    const manifest = read('mobile/modules/fractal-ble-midi/android/src/main/AndroidManifest.xml')
    assert.match(manifest, /ACCESS_FINE_LOCATION" android:maxSdkVersion="30"/, 'precise location is no longer kept to Android 11 and older, and the answer says it is')
    assert.match(manifest, /BLUETOOTH_SCAN" android:usesPermissionFlags="neverForLocation"/, 'Bluetooth scanning no longer says it is never for location, and the answer says it is')
  })

  test('the licences of what we ship travel with it', () => {
    /*
     * THIS IS THE ONE THAT BECOMES A PROBLEM ONLY ONCE MONEY IS INVOLVED, which
     * is why it was missing: the app has been free and private, and neither
     * licence has ever been shipped anywhere.
     *
     * The desktop apps bundle two separate projects and they are not under the
     * same terms. ForgeFX is MIT — its copyright notice "shall be included in
     * all copies or substantial portions" — and we put a copy inside a signed
     * installer. forgefx-midi is Apache-2.0, which asks for three things: the
     * licence, the contents of its NOTICE file (section 4(d)), and prominent
     * notices stating that we changed the files (section 4(b)). We changed
     * both, heavily.
     *
     * So this checks that the texts are present and that the generated file
     * carries them, rather than that somebody remembered.
     */
    for (const [file, mustSay] of [
      ['licences/forgefx-MIT.txt', /MIT License/],
      ['licences/forgefx-midi-APACHE-2.0.txt', /Apache License/],
      ['licences/forgefx-midi-NOTICE.txt', /Apache License, Version 2\.0/]
    ]) {
      const text = read(file)
      assert.ok(text.trim().length > 200, `${file} is empty or a stub`)
      assert.match(text, mustSay, `${file} is not the licence it claims to be`)
      /* A licence with its copyright line stripped is the one failure mode
         that looks fine and satisfies nothing. */
      assert.match(text, /Copyright/i, `${file} has lost its copyright line`)
    }

    /* Section 4(b): say what we changed. The lock file records every change
       with the symptom that caused it; this is the notice that points at it. */
    const mods = read('licences/MODIFICATIONS.md')
    assert.match(mods, /forgefx-midi/, 'the modifications notice does not mention the codec')
    assert.match(mods, /Apache-2\.0 requires it|section 4\(b\)|Section 4\(b\)/, 'nothing says why the notice exists')
    for (const branch of ['claude/address-one-host', 'claude/huffman-guard']) {
      assert.ok(
        read('desktop/forgefx.lock.json').includes(branch),
        `the lock no longer pins ${branch}, so MODIFICATIONS.md describes something we do not ship`
      )
    }

    /*
     * And the generated file carries all of it. Checked by content rather than
     * by regenerating: the walk reads node_modules, which differs between a
     * machine that has vendored the device server and one that has not, so a
     * byte-for-byte staleness check would fail for a reason that is not a
     * fault.
     */
    const notices = read('NOTICES.md')
    assert.match(notices, /MIT License/, 'the notices file carries no MIT licence')
    assert.match(notices, /Apache License/, 'the notices file carries no Apache licence')
    assert.match(notices, /Stephen Staker/, "the codec's copyright holder is not named")
    assert.match(notices, /sKuhLight/, "the server's copyright holder is not named")

    /*
     * The trademark line, which is the upstream author's own and now ours. An
     * app sold under a name that includes somebody else's mark says plainly
     * that it is not theirs.
     */
    /* The wording itself is held by `the app says whose it is not` below,
       against shared/affiliation.mjs. Here it is only that the notices file
       carries a disclaimer at all — matched on the part of the sentence that
       is doing the work rather than on its opening words, which have already
       changed once. */
    assert.match(
      notices,
      /affiliated with, endorsed by, or supported by/i,
      'nothing disclaims affiliation with Fractal Audio Systems'
    )

    /*
     * EVERY PLACE THAT INSTALLS SOMETHING A USER RECEIVES, and the desktop
     * shell is the one that was missed: `desktop/package.json` brings
     * bonjour-service and electron-updater into the signed installer and
     * neither appeared in the first generated file. Electron itself is a
     * devDependency that ships anyway.
     */
    const gen = read('scripts/notices.mjs')
    for (const manifest of ['package.json', 'desktop/package.json', 'mobile/package.json']) {
      assert.ok(gen.includes(`'${manifest}'`), `the notices generator never walks ${manifest}`)
    }
    assert.match(notices, /### Electron/, 'Electron ships inside the apps and is not named')
    assert.match(notices, /serialport/, 'the compiled USB addon is not named')

    /* And it is reachable as a plain URL, which is what a store listing and an
       About screen can both be given. `public/` is served at the site root. */
    assert.ok(read('public/notices.txt').length > 1000, 'there is no plain-text copy to link to')
  })

  test('the Mac app has a face, and claims only entitlements it uses', () => {
    /*
     * The first real Mac build reported "default Electron icon is used —
     * application icon is not set", which is what ships if nobody looks: an
     * installer whose icon belongs to the framework it happens to be built on.
     *
     * The icon is a PNG rather than an .icns because electron-builder converts
     * one with its own bundled tool, so it can be generated from public/icon.svg
     * (npm run icon) on any machine instead of being a second hand-made copy of
     * the artwork that drifts from the first.
     */
    const png = readFileSync(new URL('../desktop/build/icon.png', import.meta.url))
    assert.deepEqual(
      [...png.subarray(0, 8)],
      [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
      'the Mac icon is not a PNG'
    )
    // IHDR: 8 bytes of signature, a length and a type, then width and height.
    const width = png.readUInt32BE(16)
    const height = png.readUInt32BE(20)
    assert.ok(width >= 512 && height >= 512, `the Mac icon is ${width}x${height}; macOS wants 512 upwards`)
    assert.match(
      read('desktop/electron-builder.yml'),
      /^\s*icon: build\/icon\.png$/m,
      'the icon is committed but the build does not name it, which is the same as not having one'
    )

    /*
     * App Sandbox entitlements are inert without com.apple.security.app-sandbox,
     * and this app is not sandboxed — it opens a serial port and listens on the
     * LAN, neither of which the sandbox permits. It carried device.usb anyway,
     * which does nothing and reads as an oversight. Parsed as keys rather than
     * matched as text, because the file explains the absence in a comment.
     */
    const plist = read('desktop/entitlements.mac.plist')
    const keys = [...plist.matchAll(/<key>([^<]+)<\/key>/g)].map((m) => m[1])
    assert.ok(keys.includes('com.apple.security.network.client'), 'the entitlements moved')
    const sandboxOnly = keys.filter((k) => /^com\.apple\.security\.(device|files|personal-information|assets)\./.test(k))
    if (!keys.includes('com.apple.security.app-sandbox')) {
      assert.deepEqual(sandboxOnly, [], `sandbox-only entitlements in an app with no sandbox: ${sandboxOnly.join(', ')}`)
    }
  })

  test('the Mac app and the app it carries claim the same version', () => {
    /*
     * The desktop package sat at 0.1.0 through six major versions of the thing
     * it packages, and nothing noticed because nothing compares them — until
     * something does. electron-updater decides whether an installed app is out
     * of date by comparing exactly this number against the newest release, and
     * the DMG is named with it. Left frozen, every build claims to be the same
     * version as the last one and no update ever installs; worse, the number a
     * person reads in About is not the number of the app they are running.
     *
     * One version, stamped from the root at build time. This is the check that
     * the stamping happened.
     */
    const root = JSON.parse(read('package.json')).version
    const desktop = JSON.parse(read('desktop/package.json')).version
    assert.equal(
      desktop,
      root,
      `the Mac app says ${desktop} while the app inside it says ${root} — ` +
        'an update compares the first and a person reads the second'
    )
  })


  /*
   * THE DEMO SHOWS EACH BLOCK'S OWN CONTROLS, AND EACH UNIT ITS OWN CHAIN.
   *
   * A ChatGPT play-through: "Input, Compressor, Wah, Cab, Delay, Reverb, and
   * Output all displayed the same generic controls: Mix, Drive 1, Tone, Bass,
   * Mid, Treble", and "the VP4 simulation displayed Amp and Cab blocks". The
   * lists are now the ones a real FM3 reported, and the VP4 and the AM4 get
   * their own four slots.
   */
  test('the demo shows each block its own controls, and each unit its own chain', async () => {
    const { createMockDevice } = await import('../src/lib/mockDevice.js')
    const fm3 = createMockDevice('fm3')
    const names = (eid) => fm3.blockParams(eid).named.map((p) => p.name)
    const blocks = fm3.presetBlocks()
    const list = Array.isArray(blocks) ? blocks : blocks.blocks
    const bySlug = Object.fromEntries(list.map((b) => [b.slug, b.page ?? b.effectId]))
    for (const slug of ['delay', 'reverb', 'cab', 'wah', 'comp', 'input', 'output']) {
      assert.ok(bySlug[slug], `the demo FM3 has no ${slug} block to check`)
      const said = names(bySlug[slug])
      assert.ok(said.length > 3, `the demo ${slug} has almost no controls`)
      assert.ok(!['Tone', 'Bass', 'Treble'].every((n) => said.includes(n)), `the demo ${slug} shows an amp's tone stack again`)
    }
    assert.ok(names(bySlug.delay).some((n) => /Time/.test(n)) && names(bySlug.delay).some((n) => /Feedback/.test(n)), 'the demo delay has no time or feedback')

    const chain = (unit) => {
      const got = createMockDevice(unit).presetBlocks()
      return (Array.isArray(got) ? got : got.blocks).map((b) => b.slug)
    }
    assert.deepEqual(chain('vp4'), ['comp', 'drive', 'delay', 'reverb'], 'the VP4 demo is not an effects-only four slots')
    assert.ok(!chain('vp4').includes('amp') && !chain('vp4').includes('cab'), 'the VP4 demo has an amp or a cab again')
    assert.deepEqual(chain('am4'), ['drive', 'amp', 'delay', 'reverb'], 'the AM4 demo is not its own four slots')
    const palette = (unit) => createMockDevice(unit).blockCatalog().map((b) => b.slug)
    assert.ok(!palette('vp4').includes('amp'), 'the VP4 demo can place an amp')
    assert.ok(!palette('am4').includes('cab') && !palette('vp4').includes('cab'), 'a unit whose amp carries its cab can place a separate one')
  })

  test('the slot box refuses what is not a slot, rather than turning it into one', async () => {
    /* "Slot -1 became slot 1… Slot 512 was accepted… Text such as abc became slot 0." */
    const { slotProblem } = await import('../src/lib/slots.js')
    assert.equal(slotProblem('', 512), null, 'an empty box no longer means the loaded slot')
    assert.equal(slotProblem('0', 512), null)
    assert.equal(slotProblem('511', 512), null)
    for (const bad of ['-1', 'abc', '1.5', '12a']) assert.ok(slotProblem(bad, 512), `"${bad}" is taken as a slot`)
    assert.match(slotProblem('512', 512), /0 to 511/, 'a slot past the end is not refused with the range')
    const sheet = read('src/components/SaveSheet.jsx')
    assert.ok(!/replace\(\/\[\^0-9\]\/g/.test(sheet), 'the slot box strips what was typed again')
    assert.match(sheet, /disabled=\{busy \|\| !!queued \|\| !!problem\}/, 'Save can be pressed with a bad slot in the box')
  })
}

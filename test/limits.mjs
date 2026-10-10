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
import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
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
    assert.match(main, /phone\?\.on\n?\s*\?/, 'the relay is offered whether or not it works')
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
     * open it, and did notarisation actually attach a ticket. The last is the
     * one nobody can answer by reading configuration — which is the whole point
     * of asking the build instead of guessing.
     */
    for (const [cmd, why] of [
      ['codesign --verify', 'nothing checks the signature covers what it should'],
      ['spctl --assess', "nothing asks whether Gatekeeper would open it"],
      ['stapler validate', 'nothing proves notarisation happened — a signed but un-notarised .dmg is still quarantined on a stranger\'s Mac']
    ]) {
      assert.ok(wf.includes(cmd), `${cmd} is gone: ${why}`)
    }

    /*
     * And the disk image gets its own ticket.
     *
     * electron-builder notarises the app and stops: `notarizeIfProvided` takes
     * the app path and runs during signing, before a .dmg exists. The first
     * build to reach the check above said so in one line — "does not have a
     * ticket stapled to it" — with the app beside it already "accepted,
     * source=Notarized Developer ID".
     *
     * The image is what macOS assesses first, so without this the download
     * still warns however well signed the app inside it is.
     */
    assert.ok(
      wf.includes('notarytool submit'),
      'the disk image is no longer notarised — electron-builder only ever does the app, and the image is what someone downloads'
    )
    assert.ok(
      wf.includes('stapler staple'),
      'the disk image is notarised but its ticket is never attached, so the check only passes with a network and a stranger offline still sees a warning'
    )
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
     * runs anywhere without an install step, and it is the ONLY Linux format
     * electron-updater knows how to update — a .deb can never replace itself.
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
    const { photoFor } = await import('../src/lib/gearPhotos.js')
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
    const bare = []
    for (const f of ['src/data/amp-types.json', 'src/data/cab-types.json', 'src/data/drive-types.json']) {
      for (const m of JSON.parse(read(f))) if (!photoFor(m.name)) bare.push(m.name)
    }
    assert.deepEqual(bare, [], `these models have no picture: ${bare.join(', ')}`)
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

    /* After all three builders, or it reads a release still being written. */
    assert.match(job, /needs: \[mac, windows, linux\]/, 'the check no longer waits for every build')

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
    /* It has to actually fail, rather than printing and carrying on. */
    assert.match(job, /exit 1/, 'the check reports a gap without failing, so nobody sees it')
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

  test('the store says it needs a computer first, and never calls the computer app free', async () => {
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
     */
    const { fenced, promoText, PROMO_LIMIT } = await import('../scripts/store-text.mjs')
    const store = read('docs/app-store.md')
    const promo = promoText(store)
    const description = fenced(store, '### Description')
    const short = fenced(store, '### Google Play: short description').trim()
    const subtitle = store.match(/\| \*\*Subtitle\*\* \| 30 \| `([^`]+)` \|/)?.[1]
    const length = (s) => [...s].length

    assert.match(promo, /^REQUIRES A COMPUTER\./, 'the top of the listing no longer opens on the computer')
    assert.match(description, /^REQUIRES A COMPUTER\./, 'the description no longer opens on the computer')
    /* Sentence case on Play alone: its help for this field says "Do not use
       capitalization for emphasis", and its metadata policy calls ALL CAPS
       outside a brand name a violation. */
    assert.match(short, /^Requires a computer\b/, 'the Play summary no longer opens on the computer')
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
    assert.ok(description.includes(AFFILIATION), 'the description no longer ends on the shared disclaimer')
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
    assert.match(phoneApp, /<Paywall\s+onSignIn=\{toSignIn\}[\s\S]{0,900}onDeleted=\{\(\) => \{\s*signOut\(\)/, 'the purchase page an unpaid account signs in to cannot delete it')

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
       positioning word; the disclaimer is the part about endorsement. */
    assert.match(NOT_AFFILIATED, /in no way affiliated with, endorsed by, or sponsored by/)
    assert.match(NOT_AFFILIATED, /Fractal Audio Systems/)
    assert.match(TRADEMARKS, /trademarks of Fractal Audio Systems/)
    assert.ok(AFFILIATION.includes(NOT_AFFILIATED) && AFFILIATION.includes(TRADEMARKS))

    /* Both apps show it, from the shared string rather than a copy. */
    for (const [where, file] of [
      ['the browser', 'src/App.jsx'],
      ['the phone', 'mobile/src/screens/Settings.js']
    ]) {
      const src = read(file)
      assert.match(src, /import \{ AFFILIATION \}/, `${where} does not import the shared disclaimer`)
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
      ['feedback', 'stage_lists'],
      'the apps write to a table the privacy policy has never been checked against'
    )

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
    assert.match(policy, /[Nn]o analytics and no tracking/, 'the policy does not say there is no tracking')
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
     * LOCATION. True on every phone in a store today, and kept true now that
     * Bluetooth (beta) is open to everyone who has paid: on Android 11 and older, Android
     * makes any app that looks for a Bluetooth device hold the Location
     * permission. The Bluetooth module asks for it there, only from the
     * Bluetooth page's Connect, and never reads where the phone is. So the
     * policy must not say Location is "never asked for" while the app — or
     * the waiting Bluetooth work that will become the app — can ask.
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
     * AND WHO BLUETOOTH (BETA) IS FOR, which changed on purpose. This page
     * said it was "still being tested and is not open to customers yet",
     * which was true while a list of accounts held it back. Then: "If
     * Bluetooth is ready, let's get it submitted ... let's just say that
     * Bluetooth is beta though in the app" (Justin, 10 October 2026). So it is
     * part of the full version for everyone who has unlocked the app, and a
     * policy still calling it closed would be the published claim nobody
     * checked. Over it, the commands reach the unit through no relay at all,
     * which the relay paragraph has to say rather than leave out.
     */
    assert.ok(!/not open to customers/.test(words), 'the policy says Bluetooth (beta) is closed to customers, and it is open to everyone who has paid')
    assert.match(words, /Bluetooth \(beta\) lets the phone talk to your unit through a Bluetooth MIDI adapter[^.]*part of the full version, for everyone who has unlocked the app/, 'the policy does not say who Bluetooth (beta) is for')
    assert.match(words, /Over Bluetooth \(beta\) they go from the phone to the adapter on your unit, through no relay and no internet at all/, 'the relay paragraph does not say Bluetooth goes through no relay')
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

  test('the Bluetooth (beta) guide says it is a beta, names the parts it was tried with, and links only what was checked', () => {
    /*
     * "We need to provide as much instructions as possible on how to connect
     * it and hook it up. So as far as I know, we need a CME Widi host. And
     * then for the AM4 I use these as well. Maybe we could add these with the
     * Amazon links on how to buy them? Cause I'm not sure what's needed for
     * every single device, but it is working with the AM4." (Justin, 10
     * October 2026.)
     *
     * public/bluetooth.html is that page, at
     * https://fractal.newbold.cloud/bluetooth.html. What this holds it to:
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
     *   - THE APP'S OWN WORDS. The two step headings, What you need between
     *     them and its three buttons, the two Connect hints, the Screen Time
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
    const html = read('public/bluetooth.html').replace(/<!--[\s\S]*?-->/g, '')
    const words = html
      .replace(/<[^>]+>/g, '')
      .replace(/&ldquo;|&rdquo;/g, '"')
      .replace(/&amp;/g, '&')
      .replace(/\s+/g, ' ')

    assert.match(html, /<title>Bluetooth \(beta\) setup/, 'the guide has lost its title')
    assert.match(words, /last updated 10 October 2026/i, 'the guide does not say when it was last checked')

    /* The disclaimer, in the words the app uses for it. */
    assert.match(words, /Bluetooth is new \(beta\), and it may not work correctly with every unit or adapter\./, 'the guide does not say it is a beta that may not work')
    assert.match(words, /So far it has been tried on one AM4, from an iPhone/, 'the guide does not say an AM4 from an iPhone is what it was tried on')
    assert.match(words, /not been tried yet on an FM3, FM9 or Axe-Fx III, or from an Android phone/, 'the guide does not say the FM3, FM9, Axe-Fx III and Android are untried')
    assert.match(words, /USB cable to a computer[^.]*keeps working as it always has/, 'the guide does not say the computer way is untouched')
    assert.match(words, /AM4 Tried, works/, 'the AM4 is not marked as the one it was tried on')
    assert.match(words, /FM3, FM9 and Axe-Fx III Not tried yet/, 'the other units are not marked as untried')

    /* And nothing on the page says the reverse. */
    assert.ok(!/\bworks with the AM4, FM3/.test(words), 'the guide says Bluetooth works with units nobody has tried')
    assert.ok(!/\bworks? (on|with)\b[^.]{0,60}\b(FM3|FM9|Axe-Fx III)\b/.test(words), 'the guide says Bluetooth works on an FM3, FM9 or Axe-Fx III, and nobody has tried those')
    assert.match(words, /You can pick an AM4, FM3, FM9 or Axe-Fx III, but so far only the AM4 has been tried\./, 'the guide does not say which units can be picked, and that only the AM4 has been tried')

    /* The parts, at the addresses checked on 10 October 2026. */
    const PARTS = [
      ['CME WIDI Uhost', 'https://www.amazon.com/dp/B09GS326QW', 'https://www.cme-pro.com/widi-uhost/'],
      ['CME C2MIDI Pro', 'https://www.amazon.com/dp/B0GVXTX5D1', 'https://www.cme-pro.com/c2midi-pro/'],
      ['LOOTOOLS Type-A MIDI to 3.5 mm adapters', 'https://www.amazon.com/dp/B0FN83P5P7', null]
    ]
    for (const [name, amazon, maker] of PARTS) {
      assert.ok(words.includes(name), `the guide does not name the ${name}`)
      assert.ok(html.includes(`href="${amazon}"`), `the guide does not link the ${name} at ${amazon}`)
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
    assert.match(words, /white plug \[TO MIDI OUT\] into the unit’s MIDI out\. On an FM3 or FM9 that is the jack marked MIDI OUT\/THRU\. On an Axe-Fx III it is MIDI OUT, not the separate THRU jack/, 'the 5-pin steps do not say which jack the white plug goes in, or keep it out of the Axe-Fx III’s THRU')
    assert.match(words, /USB-C plug into the Uhost’s left socket, USB Host\/Device/, 'the guide does not say the cable goes in the Uhost’s left socket')
    assert.match(words, /into the Uhost’s right socket, USB Power\. 5 volts only/, 'the guide does not say the power goes in the right socket, at 5 volts')
    assert.match(words, /Never use anything that puts out more than 5 volts/, 'the guide does not warn against more than 5 volts')
    assert.equal((words.match(/let it finish starting up/g) || []).length, 2, 'the hook-up does not start the unit before the Uhost, for both kinds of unit')
    assert.match(words, /MIDI Thru: Off/, 'the guide does not say to turn MIDI Thru off')
    assert.match(words, /FM3, FM9 and Axe-Fx III, if presets don’t change from the phone: in Setup → MIDI\/Remote, set Program Change on, the MIDI channel to 1 or Omni, and PC Mapping off\./, 'the guide does not say what to set on a 5-pin unit when presets don’t change')
    assert.ok(!/Testing tools|found: /i.test(words), 'the guide sends customers to the Testing tools, which are a test bench')

    /* Connecting, in the app's own words. */
    const app = read('mobile/src/screens/Bluetooth.js')
    for (const said of [
      '1 · Which unit is the adapter plugged into?',
      'What you need',
      'View on Amazon',
      'Show the parts and how they plug in',
      'Full setup guide',
      '2 · Connect',
      'wait until it says Connected, then tap Done',
      'The phone looks for the adapter for ten seconds, then connects to it.'
    ]) {
      assert.ok(app.includes(said), `the Bluetooth page no longer says "${said}"; read the guide against it again`)
      assert.ok(words.includes(said), `the guide does not say "${said}" as the app does`)
    }
    assert.match(words, /Connect it in the app, not in the iPhone’s Settings → Bluetooth\./, 'the guide does not say an iPhone connects the adapter in the app')
    assert.match(words, /Nearby devices/, 'the guide does not say what Android 12 and later asks for')
    assert.match(words, /On Android 11 and older it asks for Location instead[^.]*make sure Location is switched on/, 'the guide does not say Android 11 and older need Location on')
    assert.match(words, /Settings → Bluetooth \(beta\)/, 'the guide does not say where Bluetooth is in the app')
    assert.match(words, /The page has two steps, with What you need between them\./, 'the guide does not say What you need sits between the two steps, as it does in the app')
    assert.match(app, /<Heading>1 · [\s\S]*<Heading>What you need<\/Heading>[\s\S]*<Heading>2 · Connect<\/Heading>/, 'What you need no longer sits between the two steps; read the guide against the app again')
    /* Screen Time: the same place to look as the app's own line for it. */
    const restricted = read('mobile/src/lib/bluetooth.js').match(/export const RESTRICTED_WORDS =\s*'([^']+)'/)?.[1] ?? ''
    assert.ok(restricted.includes('Settings → Screen Time → Content & Privacy Restrictions'), 'the app’s Screen Time line no longer says where to look; read the guide against it again')
    assert.match(words, /blocked by Screen Time[^.]*Settings → Screen Time → Content & Privacy Restrictions, allow Bluetooth Sharing/, 'the guide does not say what to do when Screen Time blocks Bluetooth')
    const settings = read('mobile/src/screens/Settings.js')
    assert.match(settings, /title="Phone & computer"/, 'Settings has no Phone & computer, which the guide sends people to')
    assert.match(settings, /title="Bluetooth \(beta\)"/, 'Settings has no Bluetooth (beta) row, which the guide sends people to')

    /* What's different from USB: the app's list, every line of it. */
    const different = app.match(/const DIFFERENT = \[([\s\S]*?)\n\]/)?.[1] ?? ''
    const lines = [...different.matchAll(/^\s*'([^']+)',?$/gm)].map((m) => m[1])
    assert.ok(lines.length >= 5, 'the Bluetooth page’s list of what is different could not be read')
    for (const line of lines) assert.ok(words.includes(line), `the guide leaves out "${line}", which the app says`)

    /* When it doesn't work. */
    assert.match(words, /Only one phone or computer at a time\./, 'the guide does not say the adapter takes one phone or computer at a time')
    assert.match(words, /A Mac that has connected to it before grabs it again by itself/, 'the guide does not say a Mac grabs the adapter first')
    assert.match(words, /closed, or left in the background for a while, the phone lets the Bluetooth connection go/, 'the guide does not say why it drops after the app has been away')
    assert.match(words, /steady green means it has found the C2MIDI Pro and has power/, 'the guide does not say what the green light means')
    assert.match(words, /a slow blue flash means it is waiting for the phone\. Steady blue means it is connected\. A fast blue flicker means messages are going through\./, 'the guide does not say what the blue light means')

    /* Other adapters: not tried, both jacks, and nothing to buy them by. */
    assert.match(words, /None of these has been tried with Fractal Remote/, 'the other adapters are not marked as untried')
    assert.match(words, /plug into both of the unit’s MIDI jacks, In and Out/, 'the guide does not say an adapter has to fill both jacks')
  })

  test('Support and the Android page lead to the Bluetooth guide, and /bluetooth reaches it', () => {
    /*
     * A guide nobody can find is not instructions. The support page is the
     * one both stores link, so it says Bluetooth (beta) exists and links the
     * guide — and it no longer says the phone never talks to the unit
     * directly, which Bluetooth made untrue. The Android page links it in its
     * footer beside Support and Privacy.
     */
    const support = read('public/support.html')
    assert.match(support, /href="\/bluetooth(\.html)?"/, 'the support page does not link the Bluetooth guide')
    assert.match(support, /<h2>Bluetooth \(beta\)/, 'the support page has no Bluetooth (beta) section')
    assert.match(support, /may not work correctly with every unit or\s+adapter/, 'the support page does not say Bluetooth is a beta that may not work')
    /* Read on Android as much as on an iPhone, and it has never been run from an Android phone. */
    assert.match(support, /tried on an AM4, from an iPhone, not yet from an Android\s+phone/, 'the support page does not say it has been tried only from an iPhone')
    assert.ok(!/never talks to the unit directly/.test(support), 'the support page says the phone never talks to the unit, and over Bluetooth it does')
    assert.match(read('public/android.html'), /href="\/bluetooth\.html"/, 'the Android page does not link the Bluetooth guide')

    /* Typed without the extension, as the store's Support address is. */
    const vercel = JSON.parse(read('vercel.json'))
    const at = vercel.rewrites.findIndex((r) => r.source === '/bluetooth')
    assert.ok(at !== -1, '/bluetooth is not routed, so it serves the app instead of the guide')
    assert.equal(vercel.rewrites[at].destination, '/bluetooth.html')
    assert.ok(at < vercel.rewrites.findIndex((r) => r.source === '/(.*)'), '/bluetooth sits after the catch-all, so it never reaches the guide')
  })

  test('the 1.87.1 store notes put Bluetooth (beta) in what gets pasted, for everyone who has paid', async () => {
    /*
     * Until 10 October this paragraph waited outside the block that gets
     * pasted, because Bluetooth was shown only to a list of accounts and
     * Justin had not decided. He has: "If Bluetooth is ready, let's get it
     * submitted ... I don't do any close testing anymore ... It's all
     * production now so let's just say that Bluetooth is beta though in the
     * app". So the 1.87.1 notes say where it is, by the labels Settings
     * draws, and how it is reviewed without the hardware (a video), with no
     * list of accounts left in them. What's New tells every customer, beta
     * warning included, inside the five lines Google Play takes.
     *
     * The draft Description beside it is kept to the listing's own rules,
     * so a yes from Justin is a paste and not a rewrite.
     */
    const store = read('docs/app-store.md')
    const at = store.indexOf('## For the next version (1.87.1, not yet submitted)')
    assert.ok(at > 0, 'the 1.87.1 section is missing')
    const section = store.slice(at)
    const notesAt = section.indexOf('### Notes for App Review, 1.87.1')
    const open = section.indexOf('```', notesAt)
    const pasted = section.slice(open + 3, section.indexOf('```', open + 3))

    assert.match(pasted, /Bluetooth \(beta\)\. This version can also reach the guitar unit with no\s+computer/, 'the 1.87.1 notes do not describe Bluetooth (beta)')
    assert.match(pasted, /for everyone who has unlocked the app/, 'the 1.87.1 notes do not say who Bluetooth is for')
    assert.match(pasted, /tap the gear at the top right for\s+Settings, then Bluetooth \(beta\)\./, 'the 1.87.1 notes do not say where Bluetooth is')
    /* And where a reviewer's very first launch shows it, before the app has updated itself. */
    assert.match(pasted, /On the very first launch, before the\s+app has updated itself, it is under Settings, then Phone & computer, then\s+BLUETOOTH \(BETA\)/)
    const settings = read('mobile/src/screens/Settings.js')
    assert.match(settings, /title="Phone & computer"/)
    assert.match(settings, /title="Bluetooth \(beta\)"/)
    assert.match(pasted, /video of it\s+working[\s\S]{0,120}(\[VIDEO LINK[^\]]*\]|https:\/\/\S+)/, 'the 1.87.1 notes promise a video and give neither a link nor the place for one')
    assert.match(pasted, /the demo above still\s+needs no hardware at all/, 'the 1.87.1 notes do not say the demo still needs no hardware')
    assert.ok(pasted.includes('https://fractal.newbold.cloud/bluetooth.html'), 'the 1.87.1 notes do not give the setup guide')
    assert.ok(existsSync(new URL('../public/bluetooth.html', import.meta.url)), 'the notes point at a setup guide that is not there')
    /*
     * Until the guide is merged, its address serves the web app with a 200,
     * through the catch-all in vercel.json, so a check that it loads passes
     * either way. The check before pasting is the heading at the top, and
     * that heading has to be the guide's.
     */
    assert.match(section, /\*\*The guide is live\.\*\* Open https:\/\/fractal\.newbold\.cloud\/bluetooth\.html\s+and check that it says "Bluetooth \(beta\) setup" at the top/, 'the 1.87.1 section does not say to check the guide itself is live before pasting')
    assert.match(read('public/bluetooth.html'), /<h1>Bluetooth \(beta\) setup<\/h1>/, 'the guide no longer says "Bluetooth (beta) setup" at the top, which is what the notes say to look for')

    /* No account list anywhere in the section: there is none any more. */
    assert.ok(!/selected accounts|among\s+them|tester/i.test(pasted), 'the 1.87.1 notes still describe Bluetooth as shown to chosen accounts')
    assert.ok(!/BLUETOOTH_TESTERS|Only if Bluetooth goes in/.test(section), 'the 1.87.1 section still says to check a list of accounts, or that Bluetooth may not go in')

    /* What's New: Bluetooth, the beta warning, and Play's five lines. */
    const news = section.indexOf("### What's New in This Version, 1.87.1")
    const nOpen = section.indexOf('```', news)
    const whatsNew = section.slice(section.indexOf('\n', nOpen) + 1, section.indexOf('```', nOpen + 3))
    const play = whatsNew.trim().split('\n').slice(0, 5).join('\n')
    assert.match(play, /^• Bluetooth \(beta\):.*may not work with every unit or adapter/m, 'Bluetooth (beta) and its warning are not in the five lines Google Play takes')
    /* Everybody reading Play's copy is on Android, where it has never been run. */
    assert.match(play, /^• Bluetooth \(beta\):.*Tried so far on an AM4 from an iPhone/m, 'What’s New does not say Bluetooth was tried only from an iPhone')
    assert.ok([...play].length <= 500, `the five lines for Google Play come to ${[...play].length}; Play takes 500`)
    assert.ok([...whatsNew].length <= 4000, 'What’s New is longer than Apple takes')

    /* The draft Description, held to the rules the live one is. */
    const { fenced } = await import('../scripts/store-text.mjs')
    const { AFFILIATION } = await import('../shared/affiliation.mjs')
    /*
     * TWO COPIES NOW, ONE PER STORE. This held the one draft to "and not yet
     * from an Android phone", because Play was to show the same text. Changed
     * on purpose: the App Store's Description is metadata, and Apple's 2.3.10
     * says "don't include names, icons, or imagery of other mobile platforms
     * ... in your app or metadata". So the App Store copy names no other
     * phone, the Google Play copy keeps the clause for the people who are on
     * one, and the two are otherwise the same word for word.
     */
    const draftAt = section.indexOf('### Description and Subtitle with Bluetooth (beta)')
    assert.ok(draftAt > 0, 'the Bluetooth draft is missing')
    const apple = fenced(section.slice(draftAt), '#### App Store copy')
    const google = fenced(section.slice(draftAt), '#### Google Play copy')
    assert.equal(fenced(section, '### Description and Subtitle with Bluetooth (beta)'), apple, 'the first copy under the draft’s heading is not the App Store’s')
    for (const [store, draft] of [['App Store', apple], ['Google Play', google]]) {
      assert.match(draft, /^REQUIRES A COMPUTER\b/, `the ${store} draft no longer opens on the computer, which Justin asked for`)
      assert.match(draft, /beta/i, `the ${store} draft does not say Bluetooth is a beta`)
      assert.match(draft, /may not work correctly with every unit or adapter/, `the ${store} draft does not carry the beta warning`)
      assert.match(draft, /so far it has been tried on an AM4, from an iPhone, with a CME WIDI Uhost and a CME C2MIDI Pro cable/, `the ${store} draft does not say what it was tried on`)
      assert.ok([...draft].length <= 4000, `the ${store} draft is ${[...draft].length} characters; both stores take 4000`)
      assert.ok(draft.includes(AFFILIATION), `the ${store} draft does not end on the shared disclaimer`)
      assert.ok(!/\bfree\b[^.\n]{0,40}\bapp\b|\bapp\b[^.\n]{0,20}\bis free\b/i.test(draft), `the ${store} draft calls an app free`)
      assert.ok(draft.includes('FM3, FM9, Axe-Fx III, AM4 and VP4.'), `the ${store} draft changed the supported units`)
      /* The sentence the Description at the top lost, kept out of the draft too: over Bluetooth a phone does talk to the unit. */
      assert.ok(!/cannot talk to a Fractal unit on its own/.test(draft), `the ${store} draft says a phone cannot talk to a unit on its own, and over Bluetooth it does`)
      /* It names CME's products to say what to buy, so it says whose they are and that the app is not theirs. */
      assert.ok(draft.trim().endsWith(`${AFFILIATION} WIDI Uhost and C2MIDI Pro are CME products; Fractal Remote is not connected with CME.`), `the ${store} draft names CME’s products without saying the app is not connected with CME`)
    }
    assert.ok(!/android|google play|play store|\bapk\b/i.test(apple), 'the App Store copy of the draft names another platform, which Apple’s 2.3.10 rejects in metadata')
    assert.match(google, /tried on an AM4, from an iPhone,[^.]*and not yet from an Android phone\./, 'the Google Play copy does not say it has not been tried from an Android phone, and everybody reading it is on one')
    assert.equal(google.replace(', and not yet from an Android phone', ''), apple, 'the two copies of the draft say different things besides the Android clause')

    /*
     * THE DESCRIPTION THAT GOES WITH 1.87.1 if the draft is not used: the one
     * at the top. Two of its sentences stopped being true with Bluetooth
     * (beta), "Controlling your real unit needs the computer described at
     * the top" and "A phone cannot talk to a Fractal unit on its own", and
     * Apple's 2.3 asks metadata to "accurately reflect the app's core
     * experience ... with new versions". So both say a Bluetooth MIDI
     * adapter can take the computer's place, in beta, and the opening stays
     * "REQUIRES A COMPUTER." with its full stop (the test above).
     */
    const current = fenced(store, '### Description')
    assert.ok(!/needs the computer described at the top\./.test(current), 'the Description still says only the computer can control a real unit')
    /*
     * Both sentences name the units now. They said "a Bluetooth MIDI adapter
     * on the unit" and "plugged into the unit's MIDI In and MIDI Out", and
     * these two asserts pinned that wording. Changed on purpose: SUPPORTED
     * UNITS in the same text lists the VP4, and the Bluetooth page does not
     * offer the VP4, so a VP4 owner reading the listing would expect it to
     * work. "May not work with every unit" does not cover a unit the app
     * never offers (Apple 2.3, and Play's metadata accuracy).
     */
    assert.match(current, /Controlling your real unit needs the computer described at the top, or, in beta, a Bluetooth MIDI adapter on an AM4, FM3, FM9 or Axe-Fx III\./, 'the demo paragraph does not say Bluetooth (beta) can take the computer’s place, on which units')
    assert.ok(!/cannot talk to a Fractal unit on its own/.test(current), 'HOW IT WORKS still says a phone cannot talk to a unit on its own, and over Bluetooth it does')
    assert.match(current, /Or, in beta, on an AM4, FM3, FM9 or Axe-Fx III \(not the VP4\), a Bluetooth MIDI adapter plugged into the unit's MIDI In and MIDI Out takes the computer's place\. So far that has been tried on an AM4, from an iPhone, and it may not work with every unit or adapter\./, 'HOW IT WORKS does not say what Bluetooth (beta) is, on which units, where it was tried, and that it may not work')

    /*
     * And the units it names are the Bluetooth page's own, read from the
     * code rather than copied: every unit BLE_UNITS offers, and every unit
     * SUPPORTED UNITS lists that it does not offer named as "not the ...".
     * A unit added to Bluetooth, or one taken off, fails here until the
     * listing says so too. The drafts are held to the same list.
     */
    const { BLE_UNITS } = await import('../mobile/src/lib/bleWire.js')
    const offeredNames = BLE_UNITS.map((u) => u.name)
    const offered = `${offeredNames.slice(0, -1).join(', ')} or ${offeredNames.at(-1)}`
    const supported = (current.match(/^SUPPORTED UNITS\n(.+)\.$/m) || [, ''])[1].split(/, | and /)
    assert.ok(offeredNames.every((n) => supported.includes(n)), `Bluetooth offers a unit SUPPORTED UNITS does not list: ${offeredNames.filter((n) => !supported.includes(n)).join(', ')}`)
    const notOffered = supported.filter((n) => !offeredNames.includes(n))
    const bleSentences = current.split(/(?<=\.)\s+/).filter((s) => /Bluetooth MIDI adapter/.test(s))
    assert.equal(bleSentences.length, 2, 'the Description no longer has its two Bluetooth sentences, the demo one and the HOW IT WORKS one')
    for (const sentence of bleSentences) {
      assert.ok(sentence.includes(`on an ${offered}`), `"${sentence}" does not name the units Bluetooth offers (${offered})`)
      for (const unit of notOffered) {
        assert.ok(!new RegExp(`\\b${unit}\\b`).test(sentence.replace(`(not the ${unit})`, '')), `"${sentence}" offers the ${unit} over Bluetooth, and the app does not`)
      }
    }
    const howBle = bleSentences.find((s) => /takes the computer's place/.test(s)) || ''
    for (const unit of notOffered) assert.ok(howBle.includes(`(not the ${unit})`), `HOW IT WORKS does not say Bluetooth is not for the ${unit}, which SUPPORTED UNITS lists`)
    for (const [store, draft] of [['App Store', apple], ['Google Play', google]]) {
      assert.ok(draft.includes(`MIDI Out of an ${offered}, your phone`), `the ${store} draft does not name the units Bluetooth offers (${offered})`)
    }

    /*
     * What's New cannot name them: Play's five lines would go past 500. So
     * it says "most units" rather than "your unit", which to a VP4 owner
     * promised a unit the Bluetooth page never offers.
     */
    const bleNews = play.split('\n').find((l) => /^• Bluetooth \(beta\):/.test(l)) || ''
    assert.ok(!/\byour unit\b/.test(bleNews), 'What’s New says Bluetooth works through an adapter on "your unit", and it is not offered on every unit')
    assert.match(bleNews, /through a Bluetooth MIDI adapter on most units\./, 'What’s New does not say Bluetooth is for most units rather than all')
    assert.ok(!/android|google play|play store|\bapk\b/i.test(current), 'the Description, which goes on the App Store, names another platform')
    assert.match(store, /\*\*This is the one to paste for 1\.87\.1\.\*\*/, 'the Description does not say it is the one for 1.87.1')
    assert.match(store, /\*\*On Google Play, paste it the day 1\.87\.1 goes out\s+there, not before:\*\*/, 'nothing stops the Bluetooth Description going on Play before the Play copy has Bluetooth')

    /*
     * BY HAND IN PLAY CONSOLE. What Google's own review found missing, none
     * of which a build can carry: the Data safety form leaves out the
     * purchase record, the account number, the made-up number for a phone
     * not signed in, and the buttons in a bug report's log; App access has
     * no record of the demo account; and the live listing is not this
     * file's.
     */
    const playAt = section.indexOf('### By hand in Play Console for 1.87.1')
    assert.ok(playAt > 0, 'the 1.87.1 section has no Play Console checklist')
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
    assert.match(access, /^Bluetooth \(beta\): tap the gear at the top right for Settings, then Bluetooth \(beta\) \(on the very first launch, before the app updates itself: Settings, then Phone & computer, then BLUETOOTH \(BETA\)\)\. It needs a Bluetooth MIDI adapter on a Fractal unit; a video of it working is at \[VIDEO LINK\]\.$/m, 'the Play reviewer is not told where Bluetooth is, or given the video')
    assert.match(playHand, /\*\*Short description:\*\* the one under \*Google Play: short description\*/, 'the Play checklist does not say to paste the lower-case short description')
    assert.match(playHand, /paste its \*\*Google Play\s+copy\*\* instead/, 'the Play checklist does not say which copy of the draft Play gets')
    assert.match(playHand, /\*\*The trademark line\*\* at the end has to be the one in this file, which\s+names the VP4/, 'the Play checklist does not say the trademark line must name the VP4')
    assert.ok(AFFILIATION.includes('“VP4”'), 'the shared trademark line no longer names the VP4, and the Play checklist says it does')
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
      /affiliated with, endorsed by, or sponsored by/i,
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

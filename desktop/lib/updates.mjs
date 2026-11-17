/**
 * Keeping the Mac app up to date without ever interrupting a set.
 *
 * Everything here is the decision-making, with the updater injected, so it can
 * be tested from anywhere — the same reason `host.mjs` is shaped this way. The
 * only thing main.js adds is the real updater and a tray to draw on.
 *
 * The rule that shapes all of it: an app that restarts itself is intolerable
 * here. This runs on a machine with a guitar plugged into it, and the moment a
 * restart is worst is exactly the moment someone is using it. So the update
 * downloads quietly and is installed when the person quits — which they do
 * when they are finished, by definition.
 *
 * ONE EXCEPTION, AND IT IS NARROW. A Raspberry Pi on a pedalboard is never
 * quit: it is unplugged. An update that waits for a quit would wait for ever
 * there. So in the first minutes after power-on, before anybody is playing,
 * an update already downloaded goes in; and since 1.92.0 a Pi left on puts
 * one in once nobody has used it for half an hour, a day after the release
 * came out. A Mac or a PC still waits for a quit. The rule is
 * unattendedInstall in autostart.mjs; what a phone sees of it is updateNote
 * below, and a phone's Update now is updateAsk.
 *
 * Nothing here ever opens a dialog. A failed update check is not news: the
 * network was down, or GitHub was slow, and the app works regardless. It shows
 * as a line in the menu that says so and nothing more.
 */

import { RELEASE_SETTLE_MS } from './autostart.mjs'

/**
 * What the menu says, from the state below.
 *
 * One line, in words about the app rather than about updating: nobody needs to
 * be told a percentage of a download they did not ask for, but they do need to
 * know why the app is about to be a different version next time they open it.
 *
 * `selfUpdating` (selfUpdatingBox in autostart.mjs): a Raspberry Pi puts a
 * ready update in by itself once nobody is using it, so its line says that
 * rather than "when you quit". Every other line, and every other computer's,
 * is as it was.
 */
export function updateLine(state, { selfUpdating = false, deb = false } = {}) {
  /*
   * Null as well as missing: the menu asks before the updater has said
   * anything at all, and on a Linux build the updater cannot run in (an
   * AppImage's updater outside an AppImage) it never says anything. This
   * threw there, and took the menu — and the start-at-power-on switch, which
   * redraws it — down with it.
   */
  switch (state?.kind) {
    case 'checking':
      return 'Checking for updates…'
    case 'found':
      return state.version ? `Downloading ${state.version}…` : 'Downloading an update…'
    case 'downloading':
      return `Downloading an update… ${state.percent}%`
    case 'staging':
      // Downloaded by us; macOS is taking its copy. Not ready until it has.
      return state.version ? `Preparing ${state.version}…` : 'Preparing the update…'
    case 'ready':
      if (selfUpdating && !deb) {
        return state.version ? `Update ${state.version} goes in when nobody is using it` : 'Update goes in when nobody is using it'
      }
      return state.version
        ? `Update ${state.version} installs when you quit`
        : 'Update installs when you quit'
    case 'current':
      return 'Up to date'
    case 'building':
      return state.version ? `Version ${state.version} is still being built` : 'A new version is still being built'
    case 'trouble':
      return state.message ? `Update problem: ${state.message}` : "Couldn't check for updates"
    case 'stuck':
      return state.version ? `Update ${state.version} didn’t install` : 'The update didn’t install'
    case 'misplaced':
      return 'Move Fractal Remote to Applications to get updates'
    default:
      return null
  }
}

/**
 * Whether the last install actually happened.
 *
 * Before the app hands itself to macOS to be replaced it writes down which
 * version it expected to come back as. On the next launch this compares that
 * note with the version actually running. The same version again means macOS
 * relaunched the old app without swapping it — which, until this, the app
 * reported as "an update is available", for ever, with no word about why.
 *
 *   'installed' — the note names a version no newer than this one
 *   'stuck'     — the note names a newer version than this one
 *   null        — no note, or a note that cannot be read
 */
export function installOutcome({ marker, version }) {
  const wanted = marker?.version
  if (!wanted || !version) return null
  return compareVersions(version, wanted) >= 0 ? 'installed' : 'stuck'
}

/** Plain dotted versions, numerically. Anything else compares as text. */
export function compareVersions(a, b) {
  const pa = String(a).split('.').map((n) => parseInt(n, 10))
  const pb = String(b).split('.').map((n) => parseInt(n, 10))
  if (pa.some(Number.isNaN) || pb.some(Number.isNaN)) return String(a).localeCompare(String(b))
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0)
    if (d) return d < 0 ? -1 : 1
  }
  return 0
}

/**
 * Whether macOS will let this app be replaced where it sits.
 *
 * An app opened from the folder it was downloaded into is run by macOS from a
 * hidden, read-only copy — "app translocation" — and an app run from there
 * cannot be updated in place: the installer swaps the copy, the copy is thrown
 * away, and the original in Downloads is untouched. The update downloads,
 * "installs", relaunches, and the same update is offered again. Only moving
 * the app into Applications ends that, so that is what the app asks for.
 *
 *   { ok: true }
 *   { ok: false, reason: 'translocated' | 'not-applications' }
 */
export function installPlace({ exePath = '', inApplications = true }) {
  if (/\/AppTranslocation\//.test(String(exePath))) return { ok: false, reason: 'translocated' }
  if (!inApplications) return { ok: false, reason: 'not-applications' }
  return { ok: true }
}

/**
 * The first line of an error, for a menu that has room for one.
 *
 * Not the stack, not the URL of the feed: the sentence macOS or the library
 * gave, which is the one thing that says what actually went wrong.
 */
export function shortReason(err) {
  const text = String(err?.message || err || '').split('\n')[0].trim()
  return text ? text.slice(0, 160) : null
}

/**
 * Point the updater at a callback that redraws the menu.
 *
 * `autoInstallOnAppQuit` is what makes the promise above true: electron-updater
 * stages the download and swaps it in during quit, so there is no restart and
 * no prompt. Downloading is automatic because the decision a person actually
 * has is when to quit, not whether to accept a few megabytes.
 *
 * Returns `check`, which never rejects — a check that fails is a state, not an
 * error anyone has to handle.
 */
/**
 * The two files THIS computer's updater reads from a release: the list it
 * looks for (`manifest`) and the download it then fetches (`file`).
 *
 *   { manifest, file: RegExp }, or null for a computer this app is not built for
 *
 * The same choices electron-updater 6 makes, so a release is only called
 * ready here when the library will find what it needs in it:
 *
 *   Mac      latest-mac.yml, and the zip for this processor — the -arm64-mac.zip
 *            on Apple Silicon, the plain -mac.zip on Intel (MacUpdater never
 *            downloads the disk image)
 *   Windows  latest.yml, and the Setup .exe, which carries both processors
 *            (NsisUpdater downloads the installer, not the zip)
 *   Linux    latest-linux.yml on a PC and latest-linux-arm64.yml on a Pi
 *            (the library adds the processor's name unless it is x64), and the
 *            AppImage when this copy is one (APPIMAGE is set), the .deb when it
 *            is not — AppImageUpdater and DebUpdater respectively
 *
 * Until 1.87.23 every computer waited for the MAC files. So when the Mac job
 * failed on 1.87.21 and the release went out without them, every Windows PC
 * and every Pi said "still being built" too, for about three hours, with its
 * own files sitting on the release.
 */
export function updateFiles({ platform = 'darwin', arch = 'x64', appImage = false } = {}) {
  if (platform === 'darwin') {
    return { manifest: 'latest-mac.yml', file: arch === 'arm64' ? /-arm64-mac\.zip$/ : /^(?!.*-arm64-).*-mac\.zip$/ }
  }
  if (platform === 'win32') return { manifest: 'latest.yml', file: /\.exe$/i }
  if (platform === 'linux') {
    const manifest = `latest-linux${arch === 'x64' ? '' : `-${arch}`}.yml`
    if (appImage) {
      return { manifest, file: arch === 'x64' ? /^(?!.*-(arm64|armv7l|arm)\.AppImage$).*\.AppImage$/ : new RegExp(`-${arch}\\.AppImage$`) }
    }
    const debArch = { x64: 'amd64', arm64: 'arm64', arm: 'armhf', ia32: 'i386' }[arch] || arch
    return { manifest, file: new RegExp(`_${debArch}\\.deb$`) }
  }
  return null
}

/**
 * What GitHub's API says the newest release is, against the version running.
 *
 * "I keep clicking check for updates and it says no updates available. The
 * only way I can check for an update is to force close the app and restart
 * it." Two things made a check made from inside a running app unreliable:
 *
 * - The library asks github.com's web pages which release is newest, and
 *   those can answer from a copy minutes old.
 * - A release appears on GitHub about ten minutes BEFORE its files do,
 *   because every computer's build uploads into it as it finishes. A check in
 *   that gap found the release, could not find the file list, and failed.
 *
 * So a check first asks GitHub's API (api.github.com), which says what is
 * there now, and reads the answer here, for the computer `target` describes
 * (see updateFiles; left out, it is an Intel Mac, which is what this answered
 * for every computer before 1.87.23):
 *
 *   { kind: 'newer', version, feed, published? } — newer, and this
 *                                      computer's files are in; `published`
 *                                      is GitHub's published_at, when it
 *                                      says it, for releaseSettled
 *   { kind: 'building', version }    — newer, but this computer's files are not in yet
 *   { kind: 'same', version }        — nothing newer than this
 *   null                             — no answer worth acting on
 */
export function releaseVerdict(release, running, target = {}) {
  const tag = typeof release?.tag_name === 'string' ? release.tag_name : null
  if (!tag || release.draft || release.prerelease) return null
  const version = tag.replace(/^v/, '')
  if (!newerThan(version, running)) return { kind: 'same', version }
  const need = updateFiles(target)
  if (!need) return null
  const names = (Array.isArray(release.assets) ? release.assets : []).map((a) => a?.name).filter((n) => typeof n === 'string')
  if (!names.includes(need.manifest) || !names.some((n) => need.file.test(n))) return { kind: 'building', version }
  const feed = String(release.html_url || '').replace('/releases/tag/', '/releases/download/')
  return feed.includes('/releases/download/') ? { kind: 'newer', version, feed, ...(release.published_at ? { published: release.published_at } : {}) } : null
}

/*
 * LOOKING AGAIN, BY ITSELF, ON EVERY COMPUTER.
 *
 * Until 1.87.23 an ordinary start looked for a new version once, at launch,
 * and never again; only a start with no window looked twice a day. So a
 * computer left open for days fell behind every phone update until somebody
 * quit it. Now every start looks again:
 *
 *   - six hours after its last look;
 *   - a quarter of an hour after one that found the new version still being
 *     built for this computer, because that is minutes, not hours, on a
 *     good day — or that left a download under way (see downloading);
 *   - an hour after one that could not reach GitHub at all;
 *   - and half a minute after the computer wakes (WAKE_LOOK_MS), because the
 *     clocks these waits run on stop while a computer sleeps, so a laptop
 *     that sleeps most of the day would otherwise hardly ever reach six hours.
 *     Half a minute, not at once: a laptop's wifi comes back a little after
 *     the laptop does — the same reason the phone remote's link is looked at
 *     after a wake.
 *
 * Quietly, and the rest is as it was: what a look finds downloads by itself
 * and goes in only when the app quits or somebody presses Restart to update.
 * Nothing restarts itself.
 */
export const RECHECK_MS = 6 * 60 * 60 * 1000
export const BUILDING_RECHECK_MS = 15 * 60 * 1000
export const TROUBLE_RECHECK_MS = 60 * 60 * 1000
export const WAKE_LOOK_MS = 30 * 1000

/**
 * Whether a download is under way, so a look by itself now has nothing to add.
 *
 * The library carries on with a download it has started rather than starting
 * another, so a look mid-download fetches nothing new — it only flips the
 * menu from "Downloading an update… 40%" back to "Checking for updates…". And
 * on a Mac, while macOS is still taking its copy ('staging'), a look would ask
 * macOS for the update a second time, which is the "Preparing…" for ever that
 * `held` below exists to prevent. So a look that comes round mid-download
 * waits, and comes back a quarter of an hour later. Check for updates, pressed
 * by hand, is not held back by this.
 */
export function downloading(state) {
  return state?.kind === 'found' || state?.kind === 'downloading' || state?.kind === 'staging'
}

/** How long until the next look, from what the last one left the menu saying. */
export function nextLookMs(state) {
  if (state?.kind === 'building' || downloading(state)) return BUILDING_RECHECK_MS
  if (state?.kind === 'trouble') return TROUBLE_RECHECK_MS
  return RECHECK_MS
}

/** Whether version a is newer than b, both "1.2.3". Anything unreadable is not newer. */
export function newerThan(a, b) {
  const parts = (v) => String(v || '').split('.').map((n) => Number.parseInt(n, 10))
  const x = parts(a)
  const y = parts(b)
  if (x.length !== 3 || y.length !== 3 || [...x, ...y].some((n) => !Number.isFinite(n))) return false
  for (let i = 0; i < 3; i++) {
    if (x[i] !== y[i]) return x[i] > y[i]
  }
  return false
}

export function wireUpdates({ updater, native = null, onState, log = () => {}, lookup = null, running = null, target = undefined }) {
  if (!updater) return { check: async () => {} }

  updater.autoDownload = true
  updater.autoInstallOnAppQuit = true
  let version = null
  /*
   * The version macOS has taken and is holding to install on quit, once it
   * has one. After that, this run of the app is done with updating.
   *
   * "It should update when I go to the settings and click check for updates.
   * That isn't working. Only force closing and restarting works." macOS's
   * updater takes ONE update per run: once it holds one, it ignores every
   * further request until the app has quit. But Check for updates asked
   * anyway — the library compared against the version RUNNING, not the one
   * waiting, so it found the same update (or a newer one) again, downloaded
   * it, and said "Preparing…", which macOS then never finished. The Restart
   * button went with the "ready" it replaced, and the only way left was to
   * quit by force. So once something is held, a check says so and stops:
   * restart, and the new run checks again on its way up, newer versions
   * included.
   *
   * KEPT, ON PURPOSE, NOW THAT THE APP LOOKS EVERY SIX HOURS (1.87.23). The
   * wish was that a computer left open for days should end one quit from the
   * newest version rather than two — that a look after one update is held
   * should still fetch a newer one. Read against electron-updater 6.8 it is
   * not safe on any of the three:
   *
   *   - Mac: macOS's updater takes one update per run, as above. A newer
   *     download would sit at "Preparing…" for ever, which is the bug this
   *     rule was written to fix.
   *   - Linux AppImage: the library deletes the update it is holding the
   *     moment it starts fetching a newer one (validateDownloadedPath empties
   *     its pending folder when the checksum differs), but still points at
   *     it until the new one is in. A quit in that gap runs the AppImage
   *     install, which deletes the running AppImage FIRST and then moves the
   *     download into its place — a download that is no longer there. The
   *     computer is left with no app at all, and a Pi set to start at
   *     power-on starts nothing.
   *   - Windows and the .deb: the same deletion, without the lost app — a
   *     quit in the gap, or a newer download that fails, installs nothing
   *     where it would have installed the held update.
   *
   * So a held update is still the end of this run's updating, and the next
   * launch, on the version it held, looks again and finds the newest. Two
   * quits from a long way behind, still — which is what "IT CAN TAKE TWO
   * ROUNDS" in shared/computer-update.mjs tells people.
   */
  let held = null
  /*
   * When the release being fetched came out (GitHub's published_at, from the
   * API look in check), kept with it and carried on its 'ready', so the
   * update that goes in by itself can wait a day after it (releaseSettled).
   * Unknown, it waits: only a release this run saw come out is let in early.
   */
  let published = null
  let publishedFor = null
  let heldPublished = null
  const when = (v) => (v && v === publishedFor ? published : null)
  /* A ready state, with when it came out when that is known (and as it always was when not). */
  const ready = (v) => (heldPublished ? { kind: 'ready', version: v, published: heldPublished } : { kind: 'ready', version: v })

  const say = (state) => {
    try {
      onState(state)
    } catch {
      // Drawing a menu must never take the app down.
    }
  }

  const on = (event, handler) => {
    if (typeof updater.on === 'function') updater.on(event, handler)
  }

  on('checking-for-update', () => say({ kind: 'checking' }))
  on('update-not-available', () => say({ kind: 'current' }))
  on('update-available', (info) => {
    version = info?.version || null
    say({ kind: 'found', version })
  })
  on('download-progress', (p) =>
    say({ kind: 'downloading', percent: Math.max(0, Math.min(100, Math.round(p?.percent ?? 0))) })
  )
  /*
   * "Downloaded" is two things on a Mac, and the app used to call the first
   * one ready. The updater library fetches the file itself, says so, and then
   * hands it to macOS's own updater, which takes a copy and checks its
   * signature. Only after THAT does anything install — and a person who
   * pressed Restart in between waited on nothing and got the old app back. So
   * with the native updater in hand, the library's word is "preparing" and
   * macOS's word is "ready"; without it (tests, other platforms) the library's
   * word is the only one there is.
   */
  on('update-downloaded', (info) => {
    version = info?.version || version
    if (!native) {
      held = version
      heldPublished = when(version)
    }
    say(native ? { kind: 'staging', version } : ready(version))
  })
  // The library's own failures are the network, nearly always; "couldn't
  // check" is the whole truth and getaddrinfo is not a word for a menu.
  on('error', (err) => {
    log(err)
    say({ kind: 'trouble' })
  })
  if (native && typeof native.on === 'function') {
    native.on('update-downloaded', () => {
      held = version
      heldPublished = when(version)
      say(ready(version))
    })
    // macOS refusing the file — a signature it does not trust, a place it
    // cannot write — is the reason an install never happened, said out loud.
    native.on('error', (err) => {
      log(err)
      say({ kind: 'trouble', message: shortReason(err) })
    })
  }

  return {
    /**
     * Install it now and come back on the new version.
     *
     * Not the default and not automatic: installing on quit is what keeps a
     * restart from ever landing mid-set. This is the other way out, for the
     * case where quitting itself is what is broken — an update that installs on
     * quit and a quit that never finishes is a loop with no exit, and the fix
     * for the quit is inside the version that cannot be installed.
     *
     * Called by a person pressing a button, and by one other thing: a start
     * with no window, in its first three minutes (see unattendedInstall in
     * autostart.mjs). Never mid-set.
     */
    install: () => {
      try {
        updater.quitAndInstall()
      } catch {
        // Nothing to fall back to: the caller has already stopped serving and
        // the app is on its way out either way.
      }
    },

    check: async () => {
      if (held !== null) {
        say(ready(held))
        return
      }
      if (lookup && running) {
        let verdict = null
        try {
          verdict = releaseVerdict(await lookup(), running, target)
        } catch (err) {
          // No API answer: the library's own check below is still worth having.
          log(err)
        }
        if (verdict?.kind === 'building') {
          say({ kind: 'building', version: verdict.version })
          return
        }
        if (verdict?.kind === 'newer') {
          published = verdict.published ?? null
          publishedFor = verdict.version
        }
        // Point the library at exactly that release, so it cannot be told an
        // older one by a page answering from a stale copy.
        //
        // ONE PIECE PER REQUEST, which is the other half of "every Mac
        // downloads the full 140 MB each time". An update that fetches only
        // the changed pieces of the new file asks for them by byte range,
        // and electron-updater's generic feed asks for many ranges in one
        // request unless told otherwise (it assumes any server but S3 can).
        // GitHub's download servers cannot: a request for two ranges is
        // answered 501 "Unsupported client range", the library gives up on
        // the small download, and fetches the whole file. Its own GitHub
        // feed knows this and asks one range at a time; this feed is aimed
        // at the same GitHub files, so it says the same.
        if (verdict?.kind === 'newer' && typeof updater.setFeedURL === 'function') {
          try {
            updater.setFeedURL({ provider: 'generic', url: verdict.feed, useMultipleRangeRequest: false })
          } catch (err) {
            log(err)
          }
        }
      }
      try {
        await updater.checkForUpdates()
      } catch (err) {
        // Reported through the state above by the 'error' event; if the call
        // itself threw before emitting, say it here so the menu is not stuck
        // on "Checking…" for the life of the app.
        log(err)
        say({ kind: 'trouble' })
      }
    }
  }
}

/*
 * ------------------------------------------------------------------ BY ITSELF
 *
 * The update that goes in with nobody there (unattendedInstall in
 * autostart.mjs), what the phones are told about it, and a phone asking for
 * it now. Each is a decision with its inputs handed in; main.js does the
 * reading, the writing and the timing.
 */

/** The store document a phone writes to ask this computer to put its update in now. A phone's own copy is held to this by a test. */
export const HOST_UPDATE_ID = 'host.update'
/** How often a request is looked for while an update is ready on a computer that may take one; otherwise once a minute, only to keep the mark. */
export const UPDATE_ASK_LOOK_MS = 10 * 1000
/** How long the answer to a request stays in what the phones are told. */
export const ASKED_SHOWN_MS = 10 * 60 * 1000
/** Somebody touched the window this recently: they are at the screen. */
export const WINDOW_BUSY_MS = 2 * 60 * 1000
/** The unit changed something this recently, or another program on this computer used it: somebody is playing. */
export const UNIT_BUSY_MS = 2 * 60 * 1000
/** A phone's browser on the Wi-Fi used it this recently. */
export const LAN_BUSY_MS = 5 * 60 * 1000

/**
 * THE OWNER'S OWN ACCOUNT. A computer signed in to it skips the day's wait
 * before an update goes in by itself (unattendedInstall's ownerBox), so his
 * own Pis meet a new release first. A copy of ADMINS in shared/admin.mjs,
 * which this app cannot carry (the packaged app has main.js and lib/ only);
 * a test holds the two equal. Nothing on any screen says it.
 */
export const OWNER_ACCOUNTS = ['7dfe6912-e43b-49bf-84e4-b56afbd442b1']

/** Whether an account id (as the device server's /cloud/status gives it) is the owner's. Spelled as shared/owner-unlock.mjs accountId reads one. */
export function isOwnerAccount(id) {
  const at = String(id || '').trim().toLowerCase()
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(at) && OWNER_ACCOUNTS.includes(at)
}

/**
 * Whether a release has been out long enough to go in by itself: a day
 * (RELEASE_SETTLE_MS) since GitHub published it.
 *
 * The one place a time of day is read, and only ever to hold back: a time
 * that cannot be read is not settled, and a clock behind the release (a Pi
 * before the network has set its clock) is not either.
 */
export function releaseSettled({ published, now, settleMs = RELEASE_SETTLE_MS } = {}) {
  const at = typeof published === 'string' ? Date.parse(published) : NaN
  if (!Number.isFinite(at) || !Number.isFinite(now)) return false
  return now - at >= settleMs
}

/*
 * A RELEASE PULLED AFTER IT WAS DOWNLOADED (an independent read, 17
 * November 2026). Once a download is held, the looks above never ask GitHub
 * again that run (`held` in wireUpdates says why), and a Pi left on looks
 * every six hours, so it has usually downloaded a release long before
 * anybody could pull it: marked a pre-release by desktop.yml's held-back
 * step or by hand, or deleted. The day's wait protected nothing on it.
 *
 * So before any install nobody pressed for on this computer (the idle route,
 * the power-on route, a phone's Update now), the HELD version's own release
 * is asked about, by its tag (main.js askGitHub, the app's own lookup, never
 * the update library, so the download is not touched). Not whether it is
 * still the newest: several computer releases come out in a day here, and a
 * Pi holding the one before the newest must still put it in (it then looks
 * again and takes the newer one), or it would stay where it is for the rest
 * of the run.
 *
 *   'there'   — the release is there, not a draft, not a pre-release
 *   'pulled'  — a pre-release, a draft, or gone (404): never put in by
 *               itself this run, by any route
 *   'unknown' — no answer (offline, GitHub erroring, rate-limited, an answer
 *               that cannot be read)
 */
export const HELD_LOOK_MS = 10 * 60 * 1000

/** What GitHub's answer about the held version's own release says: 'there', 'pulled' or 'unknown'. */
export function heldStanding({ status, release, version } = {}) {
  if (status === 404) return 'pulled'
  if (status !== 200 || !release || typeof release !== 'object') return 'unknown'
  if (release.tag_name !== `v${version}`) return 'unknown'
  if (release.draft || release.prerelease) return 'pulled'
  return 'there'
}

/**
 * Whether GitHub may be asked about the held release now: never more often
 * than once in HELD_LOOK_MS, whatever the last answer was (GitHub lets one
 * address ask 60 times an hour without signing in, and a look runs every
 * minute). `last` is { at } of the last ask, on main.js's uptime().
 */
export function heldAskDue({ last = null, now = 0, everyMs = HELD_LOOK_MS } = {}) {
  return !last || !Number.isFinite(last.at) || now - last.at >= everyMs
}

/**
 * Whether an install nobody pressed for goes ahead, given that answer:
 *
 *   'there'   — every route goes on
 *   'pulled'  — no route
 *   'unknown' — the idle route waits for a later look (nothing is urgent on a
 *               Pi left on); the power-on route goes on as before (a Pi
 *               switched on at a gig with no internet); a phone's request
 *               goes on (a person asked)
 */
export function heldGoes({ standing, how } = {}) {
  if (standing === 'there') return true
  if (standing === 'pulled') return false
  return how === 'power-on' || how === 'phone'
}

const cut = (value) => String(value).slice(0, 20)
const NOTE_KINDS = {
  checking: 'checking',
  found: 'downloading',
  downloading: 'downloading',
  staging: 'downloading',
  ready: 'ready',
  current: 'current',
  building: 'building',
  trouble: 'trouble',
  stuck: 'stuck',
  misplaced: 'misplaced'
}
const ASKED_RESULTS = ['installing', 'not-ready', 'stuck', 'pulled', 'attended', 'password', 'screen', 'busy', 'other-account']

/**
 * What the phones are told about this computer's update, beside its name in
 * host.name (tellPhones in host.mjs): exactly these keys and no others.
 *
 *   null for nothing to say (no state, or 'idle')
 *   { kind, version?, percent?, goesIn, canNow, asked? }
 *
 * `goesIn` is how a ready one goes in: 'idle' (by itself once nobody is
 * using it), 'password' (the .deb, at the computer) or 'quit'. `canNow` is
 * whether a phone may ask for it now: ready, on a computer that takes its
 * own, not one whose last install did not take, and not a release found
 * pulled (heldStanding): that one is not offered, and goes in only when a
 * person at the computer presses Restart to update or quits. `asked` is the answer to
 * the last request ({ at, result }), at the phone's own `at`.
 */
export function updateNote(state, { selfUpdating = false, deb = false, stuck = false, pulled = false, asked = null } = {}) {
  const kind = NOTE_KINDS[state?.kind]
  if (!kind) return null
  const note = { kind }
  if (state.version !== undefined && state.version !== null && state.version !== '') note.version = cut(state.version)
  if (kind === 'downloading' && Number.isFinite(state.percent)) note.percent = Math.max(0, Math.min(100, Math.round(state.percent)))
  note.goesIn = selfUpdating && !pulled ? 'idle' : deb ? 'password' : 'quit'
  note.canNow = kind === 'ready' && Boolean(selfUpdating) && !stuck && !pulled
  if (asked && Number.isFinite(asked.at) && ASKED_RESULTS.includes(asked.result)) note.asked = { at: asked.at, result: cut(asked.result) }
  return note
}

/**
 * Whether somebody is at this computer right now, for a phone's request:
 *
 *   'screen' — the window was touched in the last WINDOW_BUSY_MS
 *   'busy'   — the unit changed something in the last UNIT_BUSY_MS, another
 *              program on this computer used it in that time, or a phone's
 *              browser on the Wi-Fi in the last LAN_BUSY_MS
 *   null     — nobody
 *
 * The phone app's notes are left out on purpose: the phone asking writes
 * them itself.
 */
export function askBusy({ now = 0, windowTouchedAt = null, unitActiveAt = null, lanSeenAt = null, otherLocalAt = null } = {}) {
  const within = (t, ms) => typeof t === 'number' && now - t < ms
  if (within(windowTouchedAt, WINDOW_BUSY_MS)) return 'screen'
  if (within(unitActiveAt, UNIT_BUSY_MS) || within(otherLocalAt, UNIT_BUSY_MS) || within(lanSeenAt, LAN_BUSY_MS)) return 'busy'
  return null
}

/**
 * What to do about a phone's request (HOST_UPDATE_ID) as last read:
 *
 *   { act: 'install' | 'refuse' | null, why, mark, at }
 *
 * `mark` is what to hand in next time, compared by value as phoneNoteChange
 * (awake.mjs) compares the phone's note: a request is acted on once, when it
 * changes. The first read of a run only learns it (one already there could be
 * days old; the phone writes again when nothing happens). A request for
 * another computer, or with no computer named, or from another account (or
 * with this computer's account unknown) is not this computer's to answer.
 * The rest are answered: refused, in this order, or installed. An install
 * is then still asked of GitHub (heldGoes) before it goes, and refused as
 * 'pulled' if the release has been pulled; `pulled` here is that answer
 * already known this run.
 */
export function updateAsk({ doc, mark, ownName, accountId, update, selfUpdating = false, deb = false, stuck = false, pulled = false, busy = null } = {}) {
  if (doc === undefined) return { act: null, mark }
  const next = doc === null ? null : JSON.stringify([doc.rev ?? null, doc.updatedAt ?? null, doc.data ?? null])
  if (mark === undefined || next === null || next === mark) return { act: null, mark: next }
  const data = doc.data && typeof doc.data === 'object' ? doc.data : {}
  if (typeof data.host !== 'string' || !data.host || data.host !== ownName) return { act: null, mark: next }
  if (!accountId || typeof data.account !== 'string' || data.account !== accountId) return { act: null, mark: next }
  const at = Number.isFinite(data.at) ? data.at : null
  const refuse = (why) => ({ act: 'refuse', why, mark: next, at })
  if (update?.kind !== 'ready' || String(data.version ?? '') !== String(update.version ?? '')) return refuse('not-ready')
  if (stuck) return refuse('stuck')
  if (pulled) return refuse('pulled')
  if (deb) return refuse('password')
  if (!selfUpdating) return refuse('attended')
  if (busy) return refuse(busy === 'screen' ? 'screen' : 'busy')
  return { act: 'install', why: null, mark: next, at }
}

/**
 * Starting by itself when the computer turns on, and running with nobody there.
 *
 * "Make the computer app start by itself when the Pi turns on, and run with no
 * window." The computer in question is a Raspberry Pi on a pedalboard with no
 * screen: Raspberry Pi OS logs its own user in to the desktop at power-on (the
 * default, Desktop Autologin), and with no monitor plugged in the desktop still
 * runs, on a screen that is not there. Anything listed in
 * ~/.config/autostart is started in that session — Raspberry Pi OS runs those
 * through lxsession-xdg-autostart, and GNOME, KDE and XFCE read the same
 * folder — so one small file is the whole of "start when it turns on", and the
 * app can write it itself, with no password.
 *
 * Electron has its own switch for this, and it does nothing on Linux: the
 * calls exist there and are empty, with no error. So the file is written here.
 *
 * Everything in this module is a decision with its inputs handed in — no
 * Electron, no file system — which is the same trade host.mjs makes, and the
 * reason it can be tested from any machine. main.js does the reading and the
 * writing. Paths are POSIX on purpose: this only ever runs on Linux, and the
 * tests run on all three systems.
 */
import { posix } from 'node:path'

/** The file's own name, in the autostart folder. */
export const ENTRY_NAME = 'fractal-remote.desktop'
/** What the entry is called, and how it is recognised as ours. */
export const APP_NAME = 'Fractal Remote'
/** What the entry asks for: the app, with no window. See startHidden in main.js. */
export const HIDDEN_FLAG = '--hidden'

/**
 * Where the entry lives: ${XDG_CONFIG_HOME:-~/.config}/autostart.
 *
 * A relative XDG_CONFIG_HOME is ignored, as the XDG spec says it must be —
 * otherwise the file lands wherever the app happened to be started from and
 * nothing ever reads it.
 */
export function entryPath({ env = {}, home = '' } = {}) {
  const xdg = env.XDG_CONFIG_HOME
  const base = xdg && posix.isAbsolute(xdg) ? xdg : posix.join(home || '/', '.config')
  return posix.join(base, 'autostart', ENTRY_NAME)
}

/**
 * What the entry starts, or null when there is nothing worth pointing at.
 *
 * - The AppImage: the AppImage FILE, from APPIMAGE. process.execPath is inside
 *   the temporary mount the AppImage unpacks itself into (/tmp/.mount_…),
 *   which is gone the moment the app quits.
 * - The .deb: the binary itself, "/opt/Fractal Remote/fractal-remote-desktop"
 *   — with a space in it, which is why the entry quotes it.
 * - Not packaged (a checkout, `npm start`): null. An entry that starts a
 *   developer's Electron with no app would be worse than none.
 *
 * A path the entry cannot carry is null too, rather than an entry that says
 * it is on and starts nothing: not absolute, a line break or other control
 * character in it, or a % sign (see execArg for why that one).
 */
export function launchTarget({ env = {}, execPath = '', packaged = false } = {}) {
  if (!packaged) return null
  const target = env.APPIMAGE || execPath
  return carriable(target) ? target : null
}

const carriable = (path) =>
  typeof path === 'string' && posix.isAbsolute(path) && !/[\u0000-\u001f\u007f%]/.test(path)

/**
 * One argument of an Exec line, as the Desktop Entry spec writes it.
 *
 * Two layers, and both are needed. The Exec rule: in double quotes, with
 * " ` $ and \ each given a backslash, and a literal % written %%. Then the
 * rule for every string in the file, applied on top: a backslash is itself
 * written as two. So a $ in the path is \\$ in the file, as the spec's own
 * example says — and it matters here in particular, because Raspberry Pi OS
 * reads the line with GLib, which refuses a value with \$ in it outright and
 * the entry then starts nothing at all.
 *
 * Checked against GLib on 12 October 2026, both ways a desktop reads it —
 * the key file plus shell parsing that lxsession-xdg-autostart does, and
 * GIO's own launcher that GNOME uses — with a path holding a space, $, ",
 * a backtick and a backslash: both started exactly that path.
 *
 * The one thing neither got right is %%. lxsession never turns it back into
 * %, and GIO looks for the program before it does, finds no file by that
 * name, and drops the entry. So a path with a % in it is not offered at all
 * (see launchTarget): an entry that is on and starts nothing is worse than
 * no entry. No install this app makes has one.
 */
export function execArg(path) {
  const quoted = `"${String(path).replace(/[\\"`$]/g, (c) => `\\${c}`).replace(/%/g, '%%')}"`
  return quoted.replace(/\\/g, '\\\\')
}

/**
 * The whole entry, for a target from launchTarget.
 *
 * No OnlyShowIn or NotShowIn, on purpose: Raspberry Pi OS calls its own
 * desktop by more than one name (LXDE-wayland to the program that reads this
 * folder, rpd-wayland in its own entries), and a list that names the wrong one
 * is an entry that never runs. Terminal=false so no terminal window is opened
 * for it, and the GNOME key so GNOME treats it as switched on.
 */
export function entryText(target) {
  if (!carriable(target)) return null
  return [
    '[Desktop Entry]',
    'Type=Application',
    `Name=${APP_NAME}`,
    'Comment=Starts Fractal Remote with no window when this computer turns on, so your phone can reach your unit.',
    `Exec=${execArg(target)} ${HIDDEN_FLAG}`,
    'Terminal=false',
    'X-GNOME-Autostart-enabled=true',
    ''
  ].join('\n')
}

/** A string value as the file stores it, read back: \s \n \t \r and \\. */
function unescapeValue(value) {
  return value.replace(/\\([sntr\\])/g, (_m, c) => ({ s: ' ', n: '\n', t: '\t', r: '\r', '\\': '\\' })[c])
}

/** An Exec line split into its arguments, quotes and %% undone, field codes dropped. */
export function execArgs(line) {
  const args = []
  let current = ''
  let started = false
  let quoted = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (quoted) {
      if (c === '\\' && i + 1 < line.length && '"`$\\'.includes(line[i + 1])) current += line[++i]
      else if (c === '"') quoted = false
      else current += c
    } else if (c === '"') {
      quoted = true
      started = true
    } else if (c === ' ' || c === '\t') {
      if (started) args.push(current)
      current = ''
      started = false
    } else {
      current += c
      started = true
    }
  }
  if (started) args.push(current)
  return args
    .filter((a) => !/^%[a-zA-Z]$/.test(a))
    .map((a) => a.replace(/%%/g, '%'))
}

/**
 * What an entry already on disk says.
 *
 *   { ours, on, target }
 *
 * `ours` is an entry called Fractal Remote that starts something with
 * --hidden — which is what this app writes, and not a menu entry somebody
 * copied in by hand. `on` is ours and not switched off by the desktop's own
 * settings (Hidden=true, or GNOME's enabled key set to false). `target` is the
 * program it starts, so a launch can tell whether it still points here.
 */
export function readEntry(text) {
  const keys = {}
  let inEntry = false
  for (const raw of String(text || '').split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    if (line.startsWith('[')) {
      inEntry = line === '[Desktop Entry]'
      continue
    }
    if (!inEntry) continue
    const at = line.indexOf('=')
    if (at === -1) continue
    const key = line.slice(0, at).trim()
    if (!(key in keys)) keys[key] = unescapeValue(line.slice(at + 1).trim())
  }
  const args = keys.Exec ? execArgs(keys.Exec) : []
  const ours = keys.Name === APP_NAME && (keys.Type || 'Application') === 'Application' && args.includes(HIDDEN_FLAG)
  const off = keys.Hidden === 'true' || keys['X-GNOME-Autostart-enabled'] === 'false'
  return { ours, on: ours && !off, target: ours ? args[0] || null : null }
}

// ------------------------------------------------------------ with nobody there
//
// The rest is how a start with no window behaves, as numbers and rules main.js
// asks for. A box with no screen cannot answer a dialog, so nothing it does may
// wait on one: it says what is wrong in the log and in its menu, and tries
// again on its own.

/** Something else holding the port is asked about again this often. */
export const PORT_RETRY_MS = 30 * 1000

/*
 * A device server that stopped is started again after these waits, then once
 * a minute. One that then runs for five minutes has settled, and its next stop
 * starts the count from the beginning — a crash a day is not a crash loop.
 */
const RESTART_STEPS_MS = [2000, 5000, 15000, 30000]
export const RESTART_EVERY_MS = 60 * 1000
export const SERVER_SETTLED_MS = 5 * 60 * 1000

/**
 * When to start the device server again, and the count to carry forward.
 *
 *   restartPlan({ failures, ranForMs }) → { wait, failures }
 */
export function restartPlan({ failures = 0, ranForMs = 0 } = {}) {
  const count = ranForMs >= SERVER_SETTLED_MS ? 0 : Math.max(0, failures)
  return { wait: RESTART_STEPS_MS[count] ?? RESTART_EVERY_MS, failures: count + 1 }
}

/*
 * The phone remote, asked again until it is on. A Pi that boots faster than
 * its wifi reads "signed out" from an account service it cannot reach yet,
 * and with no window there is nobody to open the app and try again.
 *
 * And since 1.87.19 a computer somebody opened by hand is asked again too. A
 * page open at the computer used to make the same attempt, which is why only
 * a start with no window did this — but the page only tries when it opens,
 * and a MacBook that found its wifi a few seconds after the app was left
 * with the remote off for the rest of the day.
 */
export const PHONE_RETRY_MS = 60 * 1000
export const PHONE_RETRY_FOR_MS = 30 * 60 * 1000
export const PHONE_RETRY_SLOW_MS = 5 * 60 * 1000

/**
 * How long to wait before asking again, or null for "don't".
 *
 * On is done. Turned off is somebody's decision, and asking again would undo
 * it. Stuck is an older device server whose own try at the link failed, and
 * asking it again makes every tap on the phone happen twice (see armHost in
 * lib/host.mjs). Retrying is a device server that is switched on and keeps
 * trying by itself, waiting longer each time; asking it again starts those
 * waits over, which every minute across every computer an outage reaches
 * would be the app hammering the account service while it is down. Anything
 * else — no network yet, the server still waking up — is asked again every
 * minute for half an hour, then every five minutes for as long as the app
 * runs.
 */
export function phoneRetryDelay(result, sinceMs = 0) {
  if (!result || result.on || ['turned-off', 'stuck', 'retrying'].includes(result.reason)) return null
  return sinceMs < PHONE_RETRY_FOR_MS ? PHONE_RETRY_MS : PHONE_RETRY_SLOW_MS
}

/*
 * AN UPDATE GOES IN BY ITSELF AT TWO MOMENTS, AND ONLY WITH NOBODY THERE.
 *
 * electron-updater installs at a clean quit, and a Pi on a pedalboard is never
 * quit: it is unplugged. So it would stay on the version it was first given,
 * for ever. Two moments are safe for the app to restart itself instead:
 *
 *   - POWER-ON. A download from an earlier run is still on disk, and the next
 *     start finds it ready within seconds, before anybody is playing. Since
 *     1.92.0 it is not put in on the first look but after three minutes of
 *     watched quiet (POWER_ON_QUIET_MS), so a phone that connects in the first
 *     minutes is seen first; and only in the first POWER_ON_WINDOW_MS.
 *   - IDLE, since 1.92.0. "I will update the pis but we need to figure out how
 *     to have them auto update" (Justin, 16 November 2026): a Pi left on
 *     never updated at all. Now a Raspberry Pi (or a box started with no
 *     window whose window nobody has opened) puts a waiting update in once
 *     nobody has used it for IDLE_INSTALL_MS, and only a release that has
 *     been out for RELEASE_SETTLE_MS, so a bad one can be pulled before a Pi
 *     left on takes it. Except a computer signed in to the owner's own
 *     account, which skips that day: his Pis are the first to meet a bad
 *     release, a day before anybody else's.
 *
 * "Used" is six things, each a way somebody can be playing (main.js watches
 * them): a phone's note, a phone's browser on the Wi-Fi, the window being
 * touched, the unit changing preset, scene, settings or tuner, another
 * program on this computer (Axiom) using the device server, and the computer
 * waking from sleep.
 *
 * A MAC AND A WINDOWS PC KEEP THE RULE THEY HAD BEFORE ALL THIS (1.91.6): a
 * start with no window puts a waiting update in the moment it turns ready,
 * in the first three minutes (INSTALL_WINDOW_MS), before anybody is there;
 * never once a phone has used it or anybody has opened its window that run.
 * Later than that it waits for a quit. Nothing above is asked of them: they
 * cannot see another program, and nothing there reads the unit's events.
 * (An independent read, 17 November 2026: run through the new watched quiet,
 * a Mac started at login restarted itself four to six minutes in, under
 * somebody who had just opened its window.)
 *
 * And before any of these goes in, the release is asked about once more
 * (heldGoes in lib/updates.mjs): one pulled after it was downloaded is not
 * put in by itself.
 */
/** A Mac's or a Windows PC's start with no window: how soon after launch a waiting update may still go in by itself. */
export const INSTALL_WINDOW_MS = 3 * 60 * 1000
/** Equal to AWAKE_FOR_MS (awake.mjs): one meaning of "nobody is here", and about ten times the look's blind spot. */
export const IDLE_INSTALL_MS = 30 * 60 * 1000
/** Longer than a phone's two-minute note (TELL_COMPUTER_MS) plus one minute's look. */
export const POWER_ON_QUIET_MS = 3 * 60 * 1000
/** On Linux: the first look (about a minute), three minutes of proof, and room for wifi that came up late. It was 3 minutes (INSTALL_WINDOW_MS, which a Mac and a PC keep) until 1.92.0. */
export const POWER_ON_WINDOW_MS = 6 * 60 * 1000
/** The idle install only: time to pull a bad release before a Pi left on takes it. */
export const RELEASE_SETTLE_MS = 24 * 60 * 60 * 1000
/*
 * And a windowless app, left on for weeks, still looks for one — every six
 * hours now, like every other start (RECHECK_MS in lib/updates.mjs, since
 * 1.87.23; it was twice a day, and for a start with no window only).
 */

/**
 * A RASPBERRY PI (OR ANOTHER ARM BOARD ON LINUX) IS A PEDALBOARD BOX, WINDOW
 * OR NO WINDOW.
 *
 * "I thought the pi apps auto update?" and "You're telling me I need to
 * update it myself?" (Justin, 16 November 2026, his Pi 5 still on 1.90.63
 * with 1.90.82 out). It had the update downloaded and was waiting for a
 * quit: his Pi opens the app WITH its window, the guide's way, and is
 * switched off at the wall, which is no quit. The power-on install was only
 * for a start with no window. On an ARM board on Linux the window is on a
 * screen on the pedalboard that nobody sits at, so at power-on it is
 * treated as nobody there: a waiting update goes in then, before anybody is
 * playing, window or not, and never once anybody has used it that run. A
 * Mac, a Windows PC and a Linux PC with a window open still wait for a quit
 * (somebody is in front of them). An ARM computer somebody sits at (a Pi 400
 * at a desk) can restart itself in its first minutes, before anybody has
 * used it: the price of a pedalboard Pi that otherwise never updates.
 *
 * It decides the power-on install and the retries only. The idle install
 * asks selfUpdatingBox, which is narrower.
 */
export const pedalboardBox = ({ platform = '', arch = '' } = {}) => platform === 'linux' && /^arm/.test(String(arch))

/**
 * WHETHER THIS COMPUTER PUTS IN ITS OWN UPDATES WHEN NOBODY HAS USED IT FOR A
 * WHILE (and whether a phone may ask it to, later).
 *
 * Only the Linux AppImage, and then:
 *
 *   - ANY Raspberry Pi, by its board's own name (/proc/device-tree/model
 *     starts "Raspberry Pi"), window or not. That includes a Pi 400 or 500
 *     somebody sits at as a desk computer: it puts its own in once nobody
 *     has touched the Fractal Remote window, the unit or the rest for half
 *     an hour, even if they are busy in another program on it. The price of
 *     a pedalboard Pi that otherwise never updates.
 *   - any other Linux box running the AppImage that was started with no
 *     window (start at login on any Linux, x64 or ARM, passes --hidden) and
 *     whose window nobody has opened this run. Once it is opened, somebody
 *     is at it, and it stops.
 *
 * Never a Mac or a Windows PC, even after an unattended restart marks it
 * hidden, and never the .deb, whose install asks for a password. An ARM
 * laptop or a Linux PC with its window open is not one.
 */
export function selfUpdatingBox({ platform = '', env = {}, model = '', startedHidden = false, windowShown = false } = {}) {
  return platform === 'linux' && Boolean(env?.APPIMAGE) && (/^Raspberry Pi/.test(String(model || '')) || (startedHidden && !windowShown))
}

/**
 * How long nobody has used this computer: from the latest of the first
 * complete look and every use, or 0 before the first complete look. All on
 * main.js's uptime(), a clock that only goes forward.
 */
export function quietFor({ now = 0, firstLookAt = null, uses = [] } = {}) {
  if (firstLookAt === null || firstLookAt === undefined) return 0
  const last = Math.max(firstLookAt, ...uses.filter((t) => typeof t === 'number' && Number.isFinite(t)))
  return Math.max(0, now - last)
}

/**
 * Whether to install a ready update now, with nobody there.
 *
 *   { install: true, how: 'power-on' | 'idle' }
 *   { install: false, why }
 *
 * Never for the .deb, on any route: its update runs through pkexec or sudo,
 * which asks for a password nobody is there to type — and electron-updater
 * waits on it without a deadline, with the device server already stopped. On
 * a Linux box that is the case exactly when there is no AppImage. And never
 * on a look that could not see everything: it waits for the next one.
 *
 *   hidden          started with no window (main.js startHidden)
 *   selfUpdating    selfUpdatingBox, above
 *   sinceLaunchMs   how long this run has been going
 *   quietMs         quietFor, above
 *   everUsed        anybody has used it this run (the phone, the window, the
 *                   unit or another program; a wake is not a person)
 *   lookComplete    the last look could read every sign
 *   releaseSettled  the update has been out for a day (releaseSettled in
 *                   lib/updates.mjs)
 *   ownerBox        signed in to the owner's own account: his Pis skip the
 *                   day's wait, so they meet a bad release first
 *   windowShown     the window has been opened this run: somebody is at it
 *   restartedByItself  this copy was started by an install nobody pressed
 *                   for (the idle or power-on route of the copy before it)
 *
 * A MAC AND A WINDOWS PC have their own, older rule (startupInstall below),
 * asked before anything else here.
 *
 * THE COPY AN UNATTENDED INSTALL RESTARTED is not a power-on for a release
 * that has not had its day. It comes back hidden, and would otherwise be a
 * fresh power-on box: it looks at once, can find a release minutes old (its
 * files land before its Linux build has been started on CI), and would put
 * it in after three quiet minutes, on a Pi nobody is at (an independent
 * read, 17 November 2026). So on a box that puts in its own, that copy takes
 * a newer release by the power-on route only once it has been out a day, or
 * on the owner's own; otherwise it waits for the idle route like any Pi left
 * on. A real power-on, somebody switching it on, is unchanged.
 */
export function unattendedInstall({
  hidden = false,
  platform = '',
  arch = '',
  env = {},
  selfUpdating = false,
  sinceLaunchMs = 0,
  quietMs = 0,
  everUsed = false,
  lookComplete = false,
  releaseSettled = false,
  ownerBox = false,
  windowShown = false,
  restartedByItself = false
} = {}) {
  if (platform === 'darwin' || platform === 'win32') return startupInstall({ hidden, sinceLaunchMs, everUsed, windowShown })
  if (platform === 'linux' && !env.APPIMAGE) {
    return { install: false, why: 'the .deb asks for a password to install, so it waits for a quit' }
  }
  if (!lookComplete) return { install: false, why: 'the last look could not see everything, so it waits for the next one' }
  /* A box started with no window stops being one nobody is at once its window is opened; a Pi's window is its touch screen, and it stays one. */
  const powerOnBox = (hidden && !windowShown) || pedalboardBox({ platform, arch })
  const heldForTheDay = restartedByItself && selfUpdating && !releaseSettled && !ownerBox
  if (powerOnBox && !everUsed && sinceLaunchMs <= POWER_ON_WINDOW_MS && !heldForTheDay) {
    return quietMs >= POWER_ON_QUIET_MS
      ? { install: true, how: 'power-on' }
      : { install: false, why: 'just switched on; watching a few minutes before it goes in' }
  }
  if (!selfUpdating) {
    return { install: false, why: powerOnBox ? 'it installs at the next power-on, or when the app quits' : 'somebody is here to choose' }
  }
  if (!releaseSettled && !ownerBox) return { install: false, why: 'it waits a day after a new version comes out' }
  if (quietMs >= IDLE_INSTALL_MS) return { install: true, how: 'idle' }
  return { install: false, why: 'somebody used it in the last half hour, so it waits' }
}

/**
 * A Mac's or a Windows PC's own rule, as it was before 1.92.0, with one
 * thing added: a window opened this run is somebody there.
 *
 * A start with no window (start at login) puts a waiting update in at once,
 * in its first INSTALL_WINDOW_MS, decided the moment the update turns ready
 * and at each look for phones; never once anybody has used it, and never
 * once its window has been opened. Later than that, and on a start with a
 * window, it waits for a quit.
 */
export function startupInstall({ hidden = false, sinceLaunchMs = 0, everUsed = false, windowShown = false } = {}) {
  if (!hidden) return { install: false, why: 'somebody is here to choose' }
  if (windowShown) return { install: false, why: 'somebody opened the window, so it waits for a quit' }
  if (everUsed) return { install: false, why: 'a phone is already using it, so it waits for the next start or a quit' }
  if (sinceLaunchMs > INSTALL_WINDOW_MS) return { install: false, why: 'it installs when the app quits' }
  return { install: true, how: 'power-on' }
}

/**
 * Which file the safety restart after an install starts.
 *
 * The AppImage updater deletes the running file and moves the new one in
 * beside it under the new version's name (main.js hears where:
 * 'appimage-filename-updated'). A restart of the old path then starts
 * nothing, and a Pi on a pedalboard has no remote until it is unplugged. So:
 * the old file while it is there, the new one when the old has gone, and the
 * old path when neither can be found (nothing better is known).
 */
export function relaunchPath({ appimage = null, movedTo = null, exists = () => false } = {}) {
  const there = (path) => {
    try {
      return Boolean(path) && Boolean(exists(path))
    } catch {
      return false
    }
  }
  if (there(appimage)) return appimage
  if (there(movedTo)) return movedTo
  return appimage
}

/*
 * A look for updates that failed just after a windowless start is taken
 * again this often. A Pi often boots before its wifi, and its one look at
 * power-on lands in exactly that gap: no answer means no download, and no
 * download means nothing to install at this power-on or any later one.
 */
export const UPDATE_RETRY_MS = 30 * 1000

/**
 * How long to wait before looking for updates again, or null for "don't".
 *
 * Only with nobody there, only after a look that failed ('trouble'), and only
 * while an update it found could still be installed straight away — after
 * the install window the look every few hours takes over again (nextLookMs
 * in lib/updates.mjs).
 */
export function updateRetryDelay({ hidden = false, kind = null, sinceLaunchMs = 0, platform = '', arch = '' } = {}) {
  if ((!hidden && !pedalboardBox({ platform, arch })) || kind !== 'trouble') return null
  return sinceLaunchMs < POWER_ON_WINDOW_MS ? UPDATE_RETRY_MS : null
}

/**
 * How the copy an update starts should come back, as the note main.js leaves
 * for it (FRACTAL_REMOTE_AFTER_UPDATE).
 *
 *   'window'            — an ordinary copy, somebody in front of it
 *   'window-unattended' — a box set up for nobody, with a window for the
 *                         person who is looking at it right now
 *   'hidden'            — a box set up for nobody, and nobody looking
 *
 * Two facts rather than one, because they part company: somebody plugs a
 * screen into the pedalboard Pi, opens the window and presses Restart to
 * update. They want the window back — and the box must still behave as one
 * nobody is watching, once they unplug the screen and go.
 */
export function comeBackAs({ unattended = false, looking = false } = {}) {
  if (!unattended) return 'window'
  return looking ? 'window-unattended' : 'hidden'
}

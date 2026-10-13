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
 * An update is installed at once only this soon after a windowless start.
 *
 * electron-updater installs at a clean quit, and a Pi on a pedalboard is never
 * quit: it is unplugged. So it would stay on the version it was first given,
 * for ever. A download from an earlier run is still on disk, and the next
 * start finds it ready within seconds — that moment, just after power-on and
 * before anybody is playing, is the one safe time for the app to restart
 * itself. After it, a ready update waits for a quit, as everywhere else:
 * never restart mid-set.
 */
export const INSTALL_WINDOW_MS = 3 * 60 * 1000
/*
 * And a windowless app, left on for weeks, still looks for one — every six
 * hours now, like every other start (RECHECK_MS in lib/updates.mjs, since
 * 1.87.23; it was twice a day, and for a start with no window only).
 */

/**
 * Whether to install a ready update now, with nobody there.
 *
 *   { install: true }
 *   { install: false, why }
 *
 * Never for the .deb: its update runs through pkexec or sudo, which asks for a
 * password nobody is there to type — and electron-updater waits on it without
 * a deadline, with the device server already stopped. On a Linux box that is
 * the case exactly when there is no AppImage. The AppImage, a Mac and Windows
 * all install without asking anybody anything.
 */
export function unattendedInstall({ hidden = false, sinceLaunchMs = 0, platform = '', env = {} } = {}) {
  if (!hidden) return { install: false, why: 'somebody is here to choose' }
  if (sinceLaunchMs > INSTALL_WINDOW_MS) return { install: false, why: 'it installs when the app quits' }
  if (platform === 'linux' && !env.APPIMAGE) {
    return { install: false, why: 'the .deb asks for a password to install, so it waits for a quit' }
  }
  return { install: true }
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
export function updateRetryDelay({ hidden = false, kind = null, sinceLaunchMs = 0 } = {}) {
  if (!hidden || kind !== 'trouble') return null
  return sinceLaunchMs < INSTALL_WINDOW_MS ? UPDATE_RETRY_MS : null
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

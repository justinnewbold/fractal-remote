/**
 * The Mac app: open it, and your phone can reach the unit.
 *
 * Deliberately thin. Everything worth getting right — where ForgeFX is, which
 * port, what the phone should scan — lives in lib/host.mjs, shared with
 * `npm run serve` and tested without a Mac. What is left here is the part that
 * genuinely needs Electron: a window, a menu-bar item, and a child process.
 *
 * It lives in the menu bar as well as the dock because it is a service with a
 * status. Closing its window quits it — "the app does not close out all the
 * way when you click the close button" was the report, and an app that looks
 * closed while still holding the unit is worse than one you have to reopen.
 * The one exception is a computer that runs it with nobody in front of it: a
 * Raspberry Pi on a pedalboard, started when it turns on, with no window. That
 * one stays running in the tray when its window is closed; see the
 * window-all-closed handler and lib/autostart.mjs.
 *
 * ForgeFX runs as a child process rather than in-process. Importing it is the
 * path it documents, and Axis takes it — but it opens a serial port through
 * native modules, and a native module that crashes in-process takes the whole
 * app with it. A child can die and be reported. Worth revisiting once this has
 * run on real hardware for a while; not worth guessing at from a container.
 */
const { app, BrowserWindow, Tray, Menu, shell, nativeImage, dialog, ipcMain, powerMonitor, powerSaveBlocker } = require('electron')
const { spawn, execFile, execFileSync } = require('node:child_process')
const { join, sep, dirname } = require('node:path')
const { existsSync, readFileSync, writeFileSync, unlinkSync, mkdirSync, renameSync } = require('node:fs')
const { homedir, networkInterfaces } = require('node:os')
const { performance } = require('node:perf_hooks')
const net = require('node:net')

/** Where the new version can always be fetched by hand. */
/* Held to shared/ways-in.mjs REPO by a test — this cannot be the repository
   the code lives in and the download link be a different one. */
const RELEASES_URL = 'https://github.com/justinnewbold/fractal-remote/releases/latest'

/*
 * WHOSE APP THIS IS NOT, in the tray, for anybody who opens it. Fractal
 * Audio's letter of 18 October 2026 asks for its sentence at startup; the
 * window is the web app and shows the startup card itself, but a computer
 * started with no window (a Raspberry Pi on a pedalboard) has only this
 * menu, and must never put up a box nobody can click. So one greyed line,
 * and nothing that waits for anyone. Typed here because the packaged app
 * carries main.js and lib/ only, not shared/; held to NOT_AFFILIATED_SHORT
 * in shared/affiliation.mjs by a test.
 */
const NOT_AFFILIATED_SHORT = 'Not affiliated with, endorsed by, or supported by Fractal Audio Systems, LLC.'
const LATEST_API_URL = 'https://api.github.com/repos/justinnewbold/fractal-remote/releases/latest'

let tray = null
let win = null
let server = null
let advert = { stop: async () => {} }
let where = null
/* The port and name `where` was built from, so the wifi address can be asked
   again when the page wants it — see host:wifi. */
let hostAt = null
/** What armHost found: null until it answers, then { on, email, reason }. */
let phone = null
/**
 * What the device server last said about the phone remote's link, after
 * armHost answered: { enabled, connected, sure }, or null for "what armHost
 * found". See lookAtLink.
 */
let relay = null
/* What the phones were last told, and what they hear when they read it back. */
let told = null
/** Whether macOS is likely stopping a phone from reaching us. Best effort. */
let firewall = { known: false }
/** How the update is going: null until anything has happened. See lib/updates.mjs. */
let update = null
/** `check` from wireUpdates, so the menu item can ask again by hand. */
let updates = null
/**
 * Whether the app is on its way out. See the quit handler at the foot of this
 * file — it lives up here because three other things have to know: the dock
 * must not be touched, a dying server is not news, and a second quit must not
 * be cancelled by the handler that asked for it.
 */
let quitting = false

/** The shared logic is ESM; this shell is CommonJS, so it is imported lazily. */
const host = () => import('./lib/host.mjs')

/*
 * STARTED WITH NO WINDOW, BECAUSE NOBODY IS THERE TO SEE ONE.
 *
 * "Make the computer app start by itself when the Pi turns on, and run with
 * no window." A Raspberry Pi on a pedalboard has no screen, and still runs a
 * desktop on the screen that is not there — so the app starts in it, and a
 * window would be drawn for nobody. `--hidden` is what the entry that starts
 * it at power-on passes (see lib/autostart.mjs). With it there is no window
 * at launch, and nothing ever waits on a dialog: a box with no screen cannot
 * click OK, and an app stopped at a dialog is a pedalboard with no remote.
 * The tray's Open, and opening the app a second time, still show the window.
 *
 * TWO FACTS, KEPT APART. `startHidden` is "nobody is there": no dialog ever,
 * a server that stops is started again, the phone remote and updates are
 * asked about again. `windowAtLaunch` is only whether a window opens. They
 * agree at power-on and part company once: somebody who plugs a screen in to
 * the pedalboard, opens the window and presses Restart to update is there,
 * and wants the window back, on a box that is still set up for nobody.
 *
 * The environment variable is a note the app leaves itself just before an
 * update restarts it: that this copy is the update's, and how to come back —
 * "hidden" (nobody there, no window), "window-unattended" (a window for the
 * person who pressed the button, on a box set up for nobody) or "window" (an
 * ordinary copy). An environment variable because the AppImage updater
 * starts the new file with no arguments at all, so an argument could not
 * carry it — and the .deb's updater restarts the app with the arguments it
 * had, --hidden included, which is why "window-unattended" has to win over
 * that. It is read once and taken out of the environment, so the device
 * server and anything after it do not inherit it.
 */
const AFTER_UPDATE = 'FRACTAL_REMOTE_AFTER_UPDATE'
const afterUpdate = process.env[AFTER_UPDATE] || ''
delete process.env[AFTER_UPDATE]
const relaunched = ['hidden', 'window', 'window-unattended'].includes(afterUpdate)
const startHidden = process.argv.includes('--hidden') || afterUpdate === 'hidden' || afterUpdate === 'window-unattended'
const windowAtLaunch = !startHidden || afterUpdate === 'window' || afterUpdate === 'window-unattended'

/*
 * How long since this copy started, on a clock that only goes forward.
 *
 * Not the time of day. A Raspberry Pi has no clock that runs while it is
 * off: it comes up on the time it last saved and jumps forward, by however
 * long it was unplugged, the moment the network tells it the real time —
 * often a few seconds into this app's start. Every "how long ago" measured
 * with the time of day jumps with it, and an update ready ten seconds after
 * power-on looked fifteen hours late.
 */
const uptime = () => performance.now()
const launchedAt = uptime()

/*
 * And nothing that goes wrong inside the app later puts a box up either.
 * Electron's own answer to an error nobody caught is a dialog that waits for
 * OK, on a screen that is not there, with everything else in the app
 * stopped behind it. With nobody there it is said in the log instead, and
 * the app carries on serving.
 */
if (startHidden) {
  process.on('uncaughtException', (err) => {
    console.error('[unattended] something went wrong inside the app; carrying on:', err?.stack || err)
  })
}

/*
 * ONE COPY AT A TIME, on every computer.
 *
 * There was no such rule, and on Linux a second launch found the first copy's
 * device server on the port, took it for one left behind by a Force Quit and
 * stopped it (or, where lsof is missing, put up a box and waited). With the
 * app starting itself at power-on, a second launch is simply somebody
 * clicking the menu icon — so now the second copy steps aside at once, and
 * the first one is told and opens its window instead. macOS already kept to
 * one copy itself; this makes it true everywhere.
 *
 * The copy an update restarts is the one exception that waits. The AppImage
 * updater starts the new file while the old one is still on its way out, and
 * a new copy that quit on finding the old one's lock would leave nothing
 * running at all — after Restart to update as much as after an install with
 * nobody there. See lockAfterUpdate.
 */
/* What the copy that steps aside tells this one: whether it wanted a window. */
const knock = { hidden: !windowAtLaunch }
let primary = app.requestSingleInstanceLock(knock)
if (!primary && !relaunched) app.quit()

/** The start-at-power-on rules and the entry's text; loaded at launch. See lib/autostart.mjs. */
let boot = null
/** Whether the entry that starts the app at power-on is there and ours. Linux only. */
let bootOn = false
/** A line for the menu when something is wrong and nobody saw a box about it. */
let notice = null
/* The device server's restarts, for the waits between them. See restartPlan. */
let serverSince = 0
let serverFailures = 0
/** Ask about the phone remote again now — set by start(), used after a restart. */
let rearm = () => {}
/*
 * armHost, or a look at its link, under way: one at a time, because two
 * device-server enables at once are two links. And whether one was asked for
 * meanwhile — after a server restart, say, when the run under way may have
 * read the server that has since stopped.
 */
let arming = false
let armAgain = false
/** Said in the log, as everything about the phone remote is. */
const phoneLog = (line) => console.error('[phone]', line)
/** Whether this run has already installed an update with nobody there. */
let installedUnattended = false
/** A look for updates waiting to be tried again, after one that failed. See retryUpdateCheck. */
let updateRetry = null
/**
 * Somebody opened the app again before there was anything to show — the
 * server still waiting for its port, say. Remembered, and the window opens
 * as soon as there is a page to put in it. See 'second-instance'.
 */
let wantWindow = false

/*
 * Timers that end with the app.
 *
 * Everything the app does again later — a port to ask about, a server to
 * restart, the phone remote, the look for updates every few hours, the look
 * for phones that keeps the computer awake — goes through this, so none of
 * it can hold a quit up or run after the server has been stopped.
 * stopServing clears the lot.
 */
const timers = new Set()
function later(fn, ms) {
  const timer = setTimeout(() => {
    timers.delete(timer)
    if (!quitting) fn()
  }, ms)
  timer.unref?.()
  timers.add(timer)
  return timer
}
function cancel(timer) {
  if (!timer) return
  clearTimeout(timer)
  timers.delete(timer)
}
const pause = (ms) => new Promise((resolve) => later(resolve, ms))

/**
 * Said where a person can find it later, never in a box that waits for them.
 *
 * The log, for anybody who looks, and one line at the top of the tray's
 * menu, for anybody who plugs a screen in to find out why the phone cannot
 * reach the unit.
 */
function unattended(line, detail = '') {
  console.error(`[unattended] ${line}${detail ? `\n${detail}` : ''}`)
  notice = line
  drawTray()
}
function settled() {
  if (!notice) return
  notice = null
  if (tray) drawTray()
}

/*
 * Draw the menu, and never take down whatever asked for it.
 *
 * The menu is drawn again from everywhere something in it changes — an
 * update's progress, the phone remote's answer, the start-at-power-on switch
 * — and those callers have work of their own to finish afterwards: an update
 * to install, a switch to report back to the page. A menu that failed to draw
 * once cancelled all of that, silently (see phonesHearLine below). So a
 * failure to draw is said in the log, and everything else carries on.
 */
function drawTray() {
  try {
    buildTray()
  } catch (err) {
    console.error('[tray] could not draw the menu:', err?.stack || err)
  }
}

/**
 * The update wording, needed synchronously while building the menu.
 *
 * Filled in by beginUpdates once the ESM module has loaded; until then there
 * is nothing to say anyway, which is exactly what the null it returns means.
 */
let updateLine = () => null
/**
 * And what the phones hear, the same way: filled in by start() once
 * lib/host.mjs has loaded. It used to be a name only start() could see, and
 * the menu — drawn from outside start() — threw on it the moment the phone
 * remote was on and the phones had been told, every time it was drawn after
 * that.
 */
let phonesHearLine = () => null

/*
 * LOOKING AGAIN AT THE PHONE REMOTE'S LINK.
 *
 * "No answer" on the phone, on 12 October 2026, from a MacBook whose
 * Fractal Remote app was open and signed in — and quitting and reopening the
 * app fixed it. A phone away from home reaches the computer through the
 * account service, and the account service had closed this computer's link
 * to it, most likely around the Mac's sleep that evening. Nothing on the
 * computer looked again after launch, so nothing made the link again, and
 * the menu said "on" the whole time.
 *
 * So it looks: twice after the computer wakes or its screen is unlocked —
 * five seconds after and half a minute after, because a Mac's wifi comes
 * back a little after the Mac does — and once a minute for as long as it
 * runs. A link found down is made again (checkRelay in lib/host.mjs says
 * when), the menu says "reconnecting…" meanwhile, and a computer that moved
 * to another network has its same-wifi addresses in the menu brought up to
 * date. All of it through later(), so none of it outlives the server or
 * holds up a quit.
 */
const WAKE_LOOKS_MS = [5 * 1000, 30 * 1000]
const LOOK_EVERY_MS = 60 * 1000
/** checkRelay, addresses and lanAddress, handed over by start() once lib/host.mjs has loaded. */
let linkTools = null
/** Whether this outage has had its push already. See checkRelay. */
let linkNudged = false
/*
 * An older device server's "connected" cannot be believed after a sleep or
 * a move to another network, so either leaves it owed one fresh link, until
 * one is made. One that reports its state is believed. See checkRelay.
 */
let rebuildOwed = false
let wakeLooks = []
let minuteLook = null

/**
 * The computer woke, or its screen was unlocked: look twice. A second wake
 * starts the pair again, and each wake may push a link that is down once —
 * a device server that has been retrying through a long outage may be
 * waiting up to a minute between tries by then, and the wifi a wake brings
 * back is the moment to try now. See checkRelay.
 */
function afterWake() {
  if (quitting) return
  rebuildOwed = true
  linkNudged = false
  for (const timer of wakeLooks) cancel(timer)
  wakeLooks = WAKE_LOOKS_MS.map((ms) => later(() => lookAtLink({ wake: true }), ms))
}

/* Electron says so only once the app is ready, which start() always is. */
function watchForWake() {
  powerMonitor.on('resume', afterWake)
  powerMonitor.on('unlock-screen', afterWake)
}

/**
 * One look at the link, and what it says to do. Taken in turn with armHost,
 * never alongside it — see `arming` — and not at all before armHost has
 * answered, while the device server is being started again, or once an
 * older device server is stuck (see armHost), which only a quit clears.
 */
async function lookAtLink({ wake = false } = {}) {
  if (quitting || arming || !phone || !linkTools || !hostAt || phone.reason === 'stuck') return
  arming = true
  try {
    const out = await linkTools.checkRelay({
      port: hostAt.port,
      nudged: linkNudged,
      wake,
      rebuild: rebuildOwed,
      log: phoneLog
    })
    linkNudged = out.nudged
    relay = out.seen
    // Still owed only while the device server could not be reached, or could not make it yet.
    if (out.seen && out.rebuilt !== 'not yet') rebuildOwed = false
    if (out.rebuilt === 'stuck') phone = { on: false, reason: 'stuck', email: phone.email, error: out.error }
    // Switched on and trying by itself when armHost asked, and on the account service now: that is on.
    if (phone.reason === 'retrying' && out.seen?.connected) {
      phone = { on: true, email: phone.email }
      networkIsUp()
    }
    /*
     * And a remote that was never on — no network when the app opened, say —
     * is asked for again straight after a wake, not at its next minute.
     */
    const retry = !phone.on && boot?.phoneRetryDelay(phone, 0)
    if (out.rearm || (wake && retry)) armAgain = true
    if (tray) drawTray()
  } catch (err) {
    console.error('[phone] could not look at the link:', err?.message || err)
  } finally {
    arming = false
    if (armAgain) {
      armAgain = false
      rearm()
    }
  }
}

/**
 * What armHost found, for the menu — which says it until the next look at
 * the link.
 *
 * Except an answer that never reached the switch, which says nothing about
 * it. Straight after a wake or a move to another network — just when a look
 * finds the link down and asks for it again — the account service is often
 * not reachable yet, and the device server reads that as nobody signed in.
 * One the last look found switched on is still switched on, and still
 * trying: the menu goes on saying "reconnecting…", with the account it last
 * named, rather than telling somebody who is signed in to sign in. (Signing
 * out in the app switches the remote off first, so the next look puts that
 * one right.)
 */
function armAnswered(result) {
  const unseen = (result?.reason === 'signed-out' || result?.reason === 'failed') && Boolean(relay?.enabled)
  phone = unseen ? { ...result, email: result.email || phone?.email || null } : result
  if (!unseen) relay = null
}

/*
 * Once a minute. A laptop that moved to another network has a new wifi
 * address, so the menu's same-wifi addresses are made again with it — they
 * were made once, at launch — and its link is looked at as after a wake.
 */
function lookEveryMinute() {
  if (quitting) return
  cancel(minuteLook)
  minuteLook = later(async () => {
    try {
      const now = linkTools.addresses({ ...hostAt, ip: linkTools.lanAddress() })
      const moved = now.lan !== where?.lan
      if (moved) {
        where = now
        rebuildOwed = true
        if (tray) drawTray()
      }
      await lookAtLink({ wake: moved })
    } catch (err) {
      console.error('[phone] the minute look failed:', err?.message || err)
    } finally {
      lookEveryMinute()
    }
  }, LOOK_EVERY_MS)
}

/*
 * STAYING AWAKE WHILE A PHONE IS USING THE COMPUTER.
 *
 * Laptops idle-sleep at gigs: nobody touches the laptop, because the playing
 * happens on the phone, and a laptop asleep is a phone with no unit in the
 * middle of a song. So once a minute the app looks for a phone using the
 * device server, two ways (lib/awake.mjs says why it takes both):
 *
 *   - the note a connected phone app leaves in the device server's store
 *     every couple of minutes (readPhoneNote and phoneNoteChange) — the only
 *     way to see the phone app, which reaches this computer through the
 *     relay and never connects to it;
 *   - a connection to the device server's port from another machine
 *     (phonesUsing) — a phone's web browser on the same wifi.
 *
 * While either has seen one in the last half hour it asks the computer not
 * to idle-sleep — 'prevent-app-suspension', which keeps the computer running
 * and still lets the screen go dark. Never 'prevent-display-sleep'. Half an
 * hour after the last use it lets go, and the computer sleeps on its own
 * settings again. A closed lid still sleeps most laptops: that is the
 * computer's own setting, and nothing an app asks for changes it.
 */
/** lib/awake.mjs, once start() has loaded it. */
let awakeRules = null
/** The powerSaveBlocker id while the computer is being kept awake, else null. */
let awakeHold = null
/** When a phone was last seen using this computer, on uptime()'s clock; null for never. */
let phoneSeenAt = null
let phoneLook = null
/** The phone's note as last read, to tell a new one from it (phoneNoteChange); undefined before the first look. */
let phoneNoteMark

/*
 * What the computer's own tools print, for phonesUsing. Hidden on Windows,
 * or netstat would flash a console window up every minute.
 */
const askComputer = (cmd, args) =>
  new Promise((resolve, reject) => {
    execFile(cmd, args, { encoding: 'utf8', timeout: 4000, windowsHide: true, maxBuffer: 8 * 1024 * 1024 }, (err, out) =>
      err ? reject(err) : resolve(out)
    )
  })

/** Start or stop keeping the computer awake, as awakeChange says. Never throws. */
function stayAwakeWhileUsed() {
  if (!awakeRules || !powerSaveBlocker) return
  // On the way out, let go whatever the last phone said: nothing is serving it any more.
  const holding = awakeHold !== null
  const change = quitting
    ? holding
      ? 'stop'
      : null
    : awakeRules.awakeChange({ holding, lastPhoneAt: phoneSeenAt, now: uptime() })
  try {
    if (change === 'start') {
      awakeHold = powerSaveBlocker.start('prevent-app-suspension')
      console.error('[awake] a phone is using this computer; keeping it from going to sleep')
    } else if (change === 'stop') {
      const id = awakeHold
      awakeHold = null
      powerSaveBlocker.stop(id)
      console.error(quitting ? '[awake] quitting; the computer may sleep again' : '[awake] no phone for half an hour; the computer may sleep again')
    }
  } catch (err) {
    console.error('[awake] could not change it:', err?.message || err)
  }
  if (change && tray && !quitting) drawTray()
}

/* Once a minute, through later(), so it ends with the app. */
function watchForPhones() {
  if (quitting || !awakeRules) return
  cancel(phoneLook)
  phoneLook = later(async () => {
    try {
      let own = []
      try {
        own = awakeRules.ownAddresses(networkInterfaces())
      } catch {
        // Without its own addresses the app may take its own browser for a phone; it only stays awake longer.
      }
      const [seen, note] = await Promise.all([
        awakeRules.phonesUsing({
          platform: process.platform,
          port: hostAt?.port,
          run: askComputer,
          read: (path) => readFileSync(path, 'utf8'),
          own
        }),
        awakeRules.readPhoneNote({ port: hostAt?.port, fetch: (url, init) => fetch(url, init) })
      ])
      const told = awakeRules.phoneNoteChange(phoneNoteMark, note)
      phoneNoteMark = told.mark
      if (seen?.size || told.used) phoneSeenAt = uptime()
      stayAwakeWhileUsed()
    } catch (err) {
      console.error('[awake] the look for phones failed:', err?.message || err)
    } finally {
      watchForPhones()
    }
  }, awakeRules.PHONE_LOOK_MS)
}

/**
 * The watchdog the server runs inside, as a real file on disk.
 *
 * This shell is packed into app.asar; a script the Electron binary is asked to
 * run as Node has to be readable as a plain path, so electron-builder leaves
 * lib/child.cjs unpacked beside the archive and this points there.
 */
const wrapperPath = () => join(__dirname, 'lib', 'child.cjs').replace(`app.asar${sep}`, `app.asar.unpacked${sep}`)

/** The built web app, bundled beside this file by electron-builder. */
const distPath = () =>
  app.isPackaged ? join(process.resourcesPath, 'dist') : join(__dirname, '..', 'dist')

/*
 * The device server the app carries.
 *
 * `vendor` holds ForgeFX and its codec as siblings, because the server depends
 * on the codec by relative path. Offered to findForgeFX ahead of the developer
 * locations so an installed app uses what it shipped with, while FORGEFX_PATH
 * still wins for anyone deliberately pointing it at a checkout.
 */
const vendored = () =>
  app.isPackaged
    ? join(process.resourcesPath, 'vendor', 'forgefx')
    : join(__dirname, 'vendor', 'forgefx')

async function start() {
  const {
    advertisedName,
    DEFAULT_PORT,
    MISSING_FORGEFX,
    addresses,
    armHost,
    checkRelay,
    findForgeFX,
    lanAddress,
    publish,
    readFirewall,
    serverEnv,
    tellPhonesChecked,
    thisComputer,
    phonesHearLine: hearLine,
    TELL_PHONES_MS,
    waitForServer,
    whoHasPort,
    PORT_TAKEN
  } = await host()
  // For the menu, which is drawn from outside this function. See phonesHearLine.
  phonesHearLine = hearLine

  const port = Number(process.env.PORT || DEFAULT_PORT)
  // Per machine, not a constant: two Macs both asking for `fractal.local`
  // means one of them silently has no name while still offering it. And an
  // override in FRACTAL_MDNS_NAME is made into a name the device server
  // answers to. See mdnsName and advertisedName in lib/host.mjs.
  const name = advertisedName()

  /*
   * Nothing else may already be on the port. ForgeFX moves itself when the port
   * is taken — quietly, by design — and an app that then opens a window on the
   * port it asked for is showing whatever else is there. Better to say so.
   *
   * WITH NOBODY THERE, IT WAITS INSTEAD. A box with no screen cannot answer
   * the dialog, and quitting would leave a pedalboard with no remote until
   * somebody pulled the plug. Whatever holds the port is far likelier to let
   * go of it than to be closed by a person, so a windowless start says so in
   * the log and the menu and asks again every 30 seconds.
   */
  for (;;) {
    const held = await whoHasPort({
      port,
      connect: (p, done) => {
        const socket = net.connect({ port: p, host: '127.0.0.1' })
        const settle = (answer) => {
          socket.destroy()
          done(answer)
        }
        socket.once('connect', () => settle(true))
        socket.once('error', () => settle(false))
        socket.setTimeout(1000, () => settle(false))
      }
    })
    let busy = null
    if (held.forgefx) {
      /*
       * Ours, left behind by a Force Quit? Then it is nobody's, and it goes.
       * Force Quit is SIGKILL: no quit handler, no chance to stop the server we
       * started, and the next launch used to find it holding the port, say so,
       * and quit — "the only way to get around it was to restart the Mac."
       * Somebody's own ForgeFX in a Terminal still gets the message below.
       */
      const { reclaimPort } = await host()
      const took = await reclaimPort({
        port,
        run: (cmd, args) => execFileSync(cmd, args, { encoding: 'utf8', timeout: 4000 })
      })
      if (took !== 'reclaimed') {
        if (!startHidden) {
          dialog.showErrorBox('ForgeFX is already running', PORT_TAKEN(port))
          app.quit()
          return
        }
        busy = { line: 'Another copy of the part that talks to your unit is already running', detail: PORT_TAKEN(port) }
      }
    } else if (!held.free) {
      if (!startHidden) {
        dialog.showErrorBox(
          'Something else is using this port',
          `Port ${port} is in use by another program, so the app cannot serve from it.\n\n` +
            'Quit whatever is using it and open this again.'
        )
        app.quit()
        return
      }
      busy = {
        line: 'Another program on this computer is using what Fractal Remote needs',
        detail: `port ${port} is in use by another program`
      }
    }
    if (!busy) break
    unattended(`${busy.line} — trying again every 30 seconds`, busy.detail)
    await pause(boot.PORT_RETRY_MS)
  }
  settled()

  const forgefx = findForgeFX({ extra: [vendored()] })
  if (!forgefx) {
    /*
     * Said in a dialog rather than a log, because the whole point of this app
     * is that nobody is looking at a terminal. Still the same text the script
     * prints — one explanation, not two that drift. With no window, the log is
     * all there is, and an installed app never gets here: it carries its own.
     */
    if (startHidden) console.error('[unattended] ForgeFX is not installed.', MISSING_FORGEFX)
    else dialog.showErrorBox('ForgeFX is not installed', MISSING_FORGEFX)
    app.quit()
    return
  }

  where = addresses({ port, name, ip: lanAddress() })
  hostAt = { port, name }

  let Bonjour = null
  try {
    ;({ Bonjour } = require('bonjour-service'))
  } catch {
    // Without mDNS the IP still works; only the .local name is lost.
  }
  advert = publish(Bonjour, {
    port,
    name,
    onError: (err) => console.error('[mdns]', err?.message || err)
  })

  /*
   * Through lib/child.cjs rather than directly, so the server leaves when this
   * process does — however this process goes. See that file.
   */
  const runServer = () => {
    serverSince = uptime()
    const child = spawn(process.execPath, [wrapperPath(), join(forgefx, 'server', 'dist', 'index.js')], {
      env: serverEnv({ port, dist: distPath(), asNode: true }),
      stdio: 'inherit'
    })
    server = child
    /*
     * A server that could not be started at all — out of memory on a 1 GB
     * Pi, say, or the AppImage's folder gone from under it — never sends
     * 'exit', only this. With nobody listening it would be an error nobody
     * caught, which is a box on a screen that is not there; so with nobody
     * there, it is one more stop, and the server is started again like any
     * other. Elsewhere it is what it always was.
     */
    if (startHidden) {
      child.on('error', (err) => {
        if (server !== child || quitting) return
        if (!String(err?.syscall || '').startsWith('spawn')) {
          console.error('[server]', err?.message || err)
          return
        }
        restartServer(`could not be started (${err?.code || err?.message || err})`)
      })
    }
    child.on('exit', (code, signal) => {
      // A server this app has already replaced or put down is not news.
      if (server !== child) return
      /*
       * With nobody there, a server that stops is started again, after a
       * wait that grows if it keeps stopping. Nobody would ever see the box,
       * and without a server the unit is gone until somebody pulls the plug.
       */
      if (startHidden && !quitting) {
        restartServer(code === null ? signal : `code ${code}`)
        return
      }
      /*
       * Not while quitting. Stopping the server is the first thing the quit does,
       * and a ForgeFX that exits non-zero on SIGINT would then put a modal box on
       * screen mid-quit — one belonging to an app whose window has gone and whose
       * dock icon is on its way out, so it can land behind everything with no
       * obvious way to reach it. The app looks like it is refusing to close, and
       * the only way out is the one nobody should need.
       */
      if (code && !quitting) {
        dialog.showErrorBox('The device server stopped', `ForgeFX exited with code ${code}.`)
      }
    })
  }
  const restartServer = (how) => {
    server = null
    // ForgeFX forgets the phone remote's switch every time it starts.
    phone = null
    relay = null
    linkNudged = false
    const plan = boot.restartPlan({ failures: serverFailures, ranForMs: uptime() - serverSince })
    serverFailures = plan.failures
    unattended(
      `The part that talks to your unit stopped — starting it again in ${Math.round(plan.wait / 1000)} seconds`,
      `the device server: ${how}`
    )
    later(async () => {
      // One that cannot even be started is one more stop, not the last one.
      try {
        runServer()
      } catch (err) {
        restartServer(`could not be started (${err?.code || err?.message || err})`)
        return
      }
      if ((await waitForServer({ port })) && !quitting) {
        settled()
        rearm()
      }
    }, plan.wait)
  }
  runServer()

  /*
   * Turn the phone remote on once the server is up, and say so in the menu.
   * Not awaited: the window and tray should not wait on the account service,
   * and the line in the menu updates when the answer lands.
   */
  /*
   * Which app this is, for the phones — written, then read back the way a
   * phone reads it, so the menu can say what they hear. See tellPhonesChecked.
   */
  /* And what kind of computer this is ("macOS 15.3", "Raspberry Pi 5"), read once: it does not change while the app runs. */
  const computerOs = thisComputer()
  const tell = async () => {
    if (quitting) return
    told = await tellPhonesChecked({ port, version: app.getVersion(), os: computerOs, log: phoneLog })
    if (tray) drawTray()
  }
  /*
   * AND AGAIN, until it is on. armHost asks the account service, and a Pi
   * that boots faster than its wifi hears "signed out" from a service it
   * simply cannot reach yet — as does a MacBook opened a few seconds before
   * its wifi came back. The page at the computer makes the same attempt, but
   * only when it opens. So the app asks again every minute for half an hour,
   * then every five minutes — never when the answer was on, never when
   * somebody turned it off, and never at an older device server that is
   * stuck. See phoneRetryDelay. (Until 1.87.19 only a start with no window
   * did this.)
   */
  const phoneSince = uptime()
  let phoneTimer = null
  const arm = () => {
    if (quitting) return
    if (arming) {
      armAgain = true
      return
    }
    arming = true
    cancel(phoneTimer)
    armHost({ port, version: app.getVersion(), os: computerOs, log: phoneLog })
      .then((result) => {
        const cameOn = Boolean(result?.on) && !phone?.on
        armAnswered(result)
        const again = boot.phoneRetryDelay(result, uptime() - phoneSince)
        if (again) phoneTimer = later(arm, again)
        if (cameOn) networkIsUp()
        if (tray) drawTray()
        return tell()
      })
      .catch(() => {})
      .finally(() => {
        arming = false
        if (armAgain) {
          armAgain = false
          arm()
        }
      })
  }
  rearm = arm
  arm()
  /*
   * And again every few minutes, for the phone's "which app is on the
   * computer" line: a write that failed once at launch used to leave an older
   * launcher's answer standing for good. See tellPhones.
   */
  setInterval(tell, TELL_PHONES_MS)

  /*
   * And the link itself, looked at again after the computer wakes and once a
   * minute — see lookAtLink. Nothing did, after launch, and a link closed
   * while the Mac slept stayed closed until somebody quit the app.
   */
  linkTools = { checkRelay, addresses, lanAddress }
  watchForWake()
  lookEveryMinute()

  /*
   * And the computer kept awake while a phone is using it, so a laptop at a
   * gig does not idle-sleep under the song. See stayAwakeWhileUsed.
   */
  try {
    awakeRules = await import('./lib/awake.mjs')
    watchForPhones()
  } catch (err) {
    console.error('[awake] not available:', err?.message || err)
  }

  /*
   * The address in the menu works here and fails from a phone when macOS has
   * not been told to accept connections from other machines. Asked once, and
   * quietly: it only adds a line to a menu.
   */
  firewall = readFirewall({
    appPath: app.getPath('exe'),
    run: (cmd, args) => execFileSync(cmd, args, { encoding: 'utf8', timeout: 4000 })
  })

  /*
   * Spawning the server is not starting it. Fastify is listening a second or
   * two after the process exists, and a window opened into that gap gets a
   * refused connection and shows nothing — for ever, because a page that
   * failed to load is not retried. Wait for it to answer before opening
   * anything.
   */
  return waitForServer({ port })
}

/*
 * Whether this app appears in the dock, the app switcher, and Force Quit.
 *
 * Hiding the dock icon is what makes this a menu-bar service rather than a
 * document app, and that part is right. What it also does — and this is not
 * obvious — is take the app out of Force Quit Applications entirely, because
 * macOS leaves accessory apps out of that list. "The Fractal AI Builder isn't
 * showing up in the active programs running, so no option to force close if
 * it's having issues."
 *
 * Which is worst exactly when it matters: a window that has stopped
 * responding, and no way to reach for the one tool everybody knows.
 *
 * So the icon follows the window. Open a window and the app becomes an
 * ordinary one — in the dock, in cmd-tab, in Force Quit. Close it and it goes
 * back to being a menu-bar service. The state that can hang is the state you
 * can force quit, and the quiet state stays quiet.
 */
function showInDock(yes) {
  // On the way out, the dock icon is the operating system's business.
  if (quitting || !app.dock) return
  try {
    if (yes) app.dock.show()
    else app.dock.hide()
  } catch {
    // Not fatal: the app still runs, it is only listed differently.
  }
}

/*
 * `hidden`: THE PAGE WITH NOBODY LOOKING AT IT. "Having some issues, saving
 * preset" (Justin, 27 October 2026, an FM3 on a Raspberry Pi 5 started at
 * power-on): the phone parked the save, the computer took it in, and nothing
 * ever answered, because what carries a parked save out is this page
 * (src/App.jsx, the pending-save look), and a start with --hidden had no
 * page at all. So a start with nobody there loads the page in a window that
 * is never shown: the work the window does goes on, and nothing appears on
 * a screen nobody has. The tray's Open shows that same window, so the page
 * is never loaded twice, and two pages never carry out one save twice.
 */
function openWindow({ hidden = false } = {}) {
  if (!hidden) showInDock(true)
  if (win) {
    if (!hidden) {
      win.show()
      win.focus()
    }
    return
  }
  win = new BrowserWindow({
    show: !hidden,
    width: 1100,
    height: 800,
    minWidth: 380,
    backgroundColor: '#0d0f12',
    title: 'Fractal Remote',
    /*
     * The preload is the page's only channel to the app, and it carries one
     * subject: updates. Context isolation stays on and node stays out — the
     * bridge exposes three functions and nothing else. See preload.js.
     */
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: join(__dirname, 'preload.js')
    }
  })
  win.loadURL(where?.local || 'about:blank')
  /*
   * Belt and braces for the same failure: if the page does not load, retry it
   * rather than sitting on an empty window. Once, after a second — enough for
   * a server that was a moment slower than the wait above allowed for.
   */
  win.webContents.on('did-fail-load', (_e, code, description) => {
    console.error(`the page did not load (${code} ${description}); retrying once`)
    setTimeout(() => {
      if (win && where?.local) win.loadURL(where.local)
    }, 1000)
  })
  /* With nobody there, closing it only hides it: the page keeps carrying out the phone's saves. */
  win.on('close', (e) => {
    if (!startHidden || quitting) return
    e.preventDefault()
    win.hide()
    showInDock(false)
  })
  win.on('closed', () => {
    win = null
    showInDock(false)
  })
}

/*
 * Clicking the app when it is already running.
 *
 * A menu-bar app has no dock icon, so closing its window leaves nothing on
 * screen at all. macOS does not start a second copy when you click the app
 * again — it activates the one that is running and sends this — and with
 * nothing listening for it, the click did nothing, the app looked dead, and
 * the only way out was Force Quit. Reported exactly that way.
 */
app.on('activate', () => {
  if (where) openWindow()
})

/*
 * And opening it again on any computer, now that there is only ever one copy:
 * the copy that steps aside tells this one, which opens its window — the same
 * as the tray's Open. Not while quitting (an update's new copy, waiting for
 * the old one to go, knocks too), and not for a launch that itself asked for
 * no window. Asked before there is a page to show — a Pi still waiting for
 * whatever holds its port — it is remembered rather than dropped, and the
 * window opens the moment there is one.
 */
app.on('second-instance', (_event, argv, _cwd, asked) => {
  if (quitting || asked?.hidden || argv.includes('--hidden')) return
  if (where) openWindow()
  else wantWindow = true
})

/*
 * Draw the menu, and make the icon the first time only.
 *
 * This runs twice — once at launch and again when armHost answers, because the
 * phone line is the whole point of drawing it again — and it used to construct
 * a second Tray on that second call. Two icons in the menu bar, one of them
 * permanently stale, and no way to tell them apart.
 */
function buildTray() {
  if (!tray) {
    /*
     * TWO ICONS, BECAUSE THE TWO SYSTEMS WANT OPPOSITE THINGS.
     *
     * macOS takes a TEMPLATE image — black on transparent — and inverts it
     * itself for a light or a dark menu bar. Windows does not. Handing it the
     * same file paints a black shape onto a taskbar that is black by default,
     * and the icon is simply not there: the app looks like it failed to start
     * and there is nothing to click to find out otherwise.
     *
     * So Windows gets the artwork, rendered at tray size from the same
     * drawing — see scripts/icon.mjs, which makes both from public/icon.svg.
     */
    const mac = process.platform === 'darwin'
    const icon = nativeImage.createFromPath(join(__dirname, mac ? 'trayTemplate.png' : 'trayWin.png'))
    if (mac) icon.setTemplateImage(true)
    tray = new Tray(icon)
    tray.setToolTip('Fractal Remote')
    // The menu is where everything is, but the obvious thing to do with an
    // icon is click it, and the obvious thing to want is the window.
    tray.on('click', openWindow)
    tray.on('double-click', openWindow)
  }

  /*
   * One line about the phone remote, in words a person would use. "On for
   * you@example.com" is the whole status; when it is off, the line says the
   * one thing to do about it.
   *
   * From what the device server last said as well as from what armHost
   * found: switched on with its link down is not on, and a menu that said
   * "on" through exactly that was the 12 October report. See lookAtLink.
   */
  const hear = told ? phonesHearLine(told, app.getVersion()) : null
  // armHost's "retrying" is switched on with its link down, from before there was a look.
  const linkDown = relay ? Boolean(relay.enabled && !relay.connected) : phone?.reason === 'retrying'
  const remoteOn = relay ? relay.connected : Boolean(phone?.on)
  const phoneLine = !phone
    ? 'Phone remote: starting…'
    : phone.reason === 'stuck'
      ? 'Phone remote: stuck — quit Fractal Remote and open it again'
      : linkDown
        ? 'Phone remote: reconnecting…'
        : remoteOn
          ? `Phone remote: on${phone.email ? ` — ${phone.email}` : ''} · this app is v${app.getVersion()}${
              hear ? ` · ${hear}` : ''
            }`
          : phone.reason === 'signed-out'
            ? 'Phone remote: off — open the app and sign in once'
            : phone.reason === 'turned-off' || phone.reason === 'retrying' || phone.on
              ? 'Phone remote: off — turn it on in the app'
              : 'Phone remote: off'

  const menu = Menu.buildFromTemplate([
    { label: 'Open', click: openWindow },
    { type: 'separator' },
    /*
     * What went wrong while nobody was looking — a port somebody else has, a
     * server being started again — said here because a windowless start has
     * nowhere else to say it. See unattended().
     */
    ...(notice ? [{ label: notice, enabled: false }, { type: 'separator' }] : []),
    { label: phoneLine, enabled: false },
    // While a phone is using it, so nobody wonders why the laptop has not gone to sleep. See stayAwakeWhileUsed.
    ...(awakeHold !== null ? [{ label: 'Staying awake while your phone uses it', enabled: false }] : []),
    { type: 'separator' },
    { label: 'On your phone — same wifi, nothing to sign into:', enabled: false },
    ...(where?.all || []).map((u) => ({
      label: u,
      click: () => shell.openExternal(u)
    })),
    /*
     * Said only when there is something to say. A phone that cannot reach this
     * Mac over wifi is nearly always this, and nearly nobody thinks of it —
     * the address plainly works when you try it here.
     */
    ...(firewall.known && firewall.on && firewall.blocked !== false
      ? [
          {
            label: "…not working? macOS's firewall has to allow this app",
            click: () =>
              shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Firewall')
          }
        ]
      : []),
    /*
     * The other way in, offered only once it actually works. It needs an
     * account on both ends, and in exchange it does not care which network the
     * phone is on.
     */
    ...(remoteOn
      ? [
          { type: 'separator' },
          { label: 'Or from anywhere, signed in on both:', enabled: false },
          {
            label: 'fractal.newbold.cloud',
            click: () => shell.openExternal('https://fractal.newbold.cloud')
          }
        ]
      : []),
    /*
     * How the update is going, said in one line and only once there is
     * something to say. Never a dialog: a failed check means the network was
     * down, and the app works regardless.
     */
    { type: 'separator' },
    ...(updateLine(update) ? [{ label: updateLine(update), enabled: false }] : []),
    {
      label: 'Check for updates…',
      enabled: Boolean(updates) && update?.kind !== 'checking',
      // Through lookNow, so what it finds sets when the next look by itself is.
      click: () => lookNow()
    },
    /*
     * The same switch as the one in the app's Settings, and the same function
     * behind it. On Linux only, where the app makes the entry itself; see
     * setStartAtBoot.
     */
    ...(startAtBootState({ read: false }).supported
      ? [
          { type: 'separator' },
          {
            label: 'Start when this computer turns on',
            type: 'checkbox',
            checked: bootOn,
            click: (item) => setStartAtBoot(item.checked)
          }
        ]
      : []),
    { type: 'separator' },
    { label: NOT_AFFILIATED_SHORT, enabled: false },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() }
  ])
  tray.setContextMenu(menu)
}

/*
 * Start looking for a new version, quietly.
 *
 * Only in a packaged app: electron-updater has nothing to compare against in a
 * checkout, and would report an error on every launch during development for
 * no reason. Everything else — downloading in the background, installing on
 * quit, never restarting on its own — lives in lib/updates.mjs, where it can
 * be tested without a Mac.
 *
 * Failure here is not fatal and not reported: an app that cannot reach GitHub
 * still serves the unit, which is the whole job.
 */
/*
 * WHO MAY ASK: the window's own page, and nothing else.
 *
 * The bridge in preload.js is given to whatever the window, or a window it
 * opens, has loaded, and a link with target=_blank opens one: a privacy page,
 * a store page, a photo. None of those is this app, so none of them may read
 * the Wi-Fi address, switch the start at power-on, or install an update. The
 * question is the frame that asked, as Electron saw it (event.senderFrame),
 * against the address the window loads (`where.local`, the device server's
 * own page at http://localhost:<port>); before that address is known nobody
 * is answered, and a frame that has gone or navigated away (no senderFrame)
 * is not either.
 *
 * Invisible to anybody using the app: the window's own page is always that
 * address. The page treats a refusal as nothing to say (src/lib/desktop.js).
 */
function askedByOwnPage(event) {
  const local = where?.local
  if (!local) return false
  const frame = event?.senderFrame
  if (!frame) return false
  let own
  try {
    own = new URL(local).origin
  } catch {
    return false
  }
  return frame.origin === own
}

const refusedAsks = new Set()
/* ipcMain.handle, for the window's own page only. A refusal is said once a channel and page. */
function answerOwnPage(channel, fn) {
  ipcMain.handle(channel, (event, ...args) => {
    if (askedByOwnPage(event)) return fn(event, ...args)
    const who = event?.senderFrame?.origin || 'a page that has gone'
    if (!refusedAsks.has(`${channel} ${who}`)) {
      if (refusedAsks.size < 50) refusedAsks.add(`${channel} ${who}`)
      console.error(`[window] refused ${channel}: asked by ${who}, not this app's own page`)
    }
    throw new Error('Only the Fractal Remote window on this computer can ask that.')
  })
}

/*
 * What the page may ask, and the only two things it may ask for.
 *
 * Registered once, whether or not the updater ever loads — a page asking in a
 * development build should get "nothing to say" rather than an error nobody
 * can act on.
 */
function wireUpdateChannel() {
  /*
   * AND THE WIFI ADDRESS, for the QR code on the Phone & computer page.
   *
   * "Yes add the QR code to the computer." A phone's own camera reads a QR
   * code and opens it in the browser, which is the whole of the no-internet
   * route — so the computer shows its address as one. Asked afresh each time
   * rather than read off `where`, because a laptop that moved networks since
   * launch has a different address and the old one would be a code that
   * opens nothing.
   */
  answerOwnPage('host:wifi', async () => {
    if (!hostAt) return { lan: null, mdns: null }
    const { addresses, lanAddress } = await host()
    const now = addresses({ ...hostAt, ip: lanAddress() })
    return { lan: now.lan, mdns: now.mdns }
  })
  answerOwnPage('updates:state', () =>
    update ? { ...update, line: updateLine(update) } : { kind: 'idle', line: null }
  )
  answerOwnPage('updates:check', async () => {
    if (!updates) return { ok: false, reason: 'no-updater' }
    await lookNow()
    return { ok: true }
  })

  /*
   * Install it now, because somebody asked.
   *
   * Installing on quit is the right default and it stays the default — nothing
   * restarts itself on a machine with a guitar plugged into it. But it is only
   * a good default while quitting works, and when it did not it took the update
   * down with it: the update installs on quit, the quit never finished, so the
   * only way out was Force Quit, which is a hard kill and installs nothing. The
   * same version was offered again at every launch, for ever, and the fix for
   * it was inside the version that could not be installed.
   *
   * A loop like that cannot be allowed to depend on one path working. So there
   * is a second one, and it is a button a person presses: not the app deciding
   * to interrupt anybody, which is the thing the whole design is against.
   *
   * The teardown runs here rather than being left to the quit handler, so that
   * by the time electron-updater asks the app to quit there is nothing left to
   * wait for and the quit is a formality.
   */
  answerOwnPage('updates:releases', async () => {
    await shell.openExternal(RELEASES_URL)
    return { ok: true }
  })
  answerOwnPage('updates:move', async () => ({ ok: moveToApplications() }))

  answerOwnPage('updates:install', async () => installNow())

  /*
   * "Start when this computer turns on", for the switch in Settings. The
   * page asks whether this computer can do it at all — only the Linux app
   * can, see startAtBootState — and draws nothing when it cannot.
   */
  answerOwnPage('login:get', () => startAtBootState())
  answerOwnPage('login:set', (_event, on) => setStartAtBoot(on === true))
}

/*
 * Install what is downloaded, now, and come back on it.
 *
 * Two callers and one path, so they cannot drift: a person pressing Restart
 * to update, and a windowless start that finds an update ready just after
 * power-on (see installIfUnattended). The marker, the teardown and the
 * backstop are the same for both.
 */
async function installNow() {
  if (!updates?.install) return { ok: false, reason: 'no-updater' }
  if (update?.kind !== 'ready') return { ok: false, reason: 'nothing-ready' }
  /*
   * Written before anything else, so that whatever happens next the next
   * launch can tell whether it worked. See installOutcome in lib/updates.mjs.
   * It is also what stops an install that does not take from being tried
   * again and again: the copy that comes back on the same version reads
   * 'stuck' and does not look for the update again by itself.
   */
  writeMarker({ version: update.version || null, from: app.getVersion(), at: Date.now() })
  /*
   * How to come back, decided now: the teardown hides the window first
   * thing, and after it nobody would appear to be looking.
   */
  const comeBack = boot.comeBackAs({
    unattended: startHidden,
    looking: Boolean(win && !win.isDestroyed() && win.isVisible())
  })
  await stopServing()
  /*
   * If the install has not taken the process by now it is not going to, and
   * an app with no window and no server is worse than a closed one. The
   * download is staged either way, so reopening tries again.
   *
   * On a box set up for nobody, closed is not good enough either — whether
   * the install was started by the box itself or by somebody who plugged a
   * screen in, pressed the button and then left: nobody would reopen it, and
   * the pedalboard would have no remote until it was unplugged. So that copy
   * starts itself again, on the version it has, and the note above makes it
   * say "didn't install" rather than try the same install again. The
   * AppImage is restarted from its file, because the program it runs lives
   * in a folder that goes when this process does.
   */
  setTimeout(() => {
    if (startHidden) app.relaunch({ execPath: process.env.APPIMAGE || process.execPath, args: process.argv.slice(1) })
    app.exit(0)
  }, INSTALL_DEADLINE_MS)
  /*
   * Come back the way it is now. electron-updater restarts the AppImage by
   * starting the new file with no arguments and this process's environment,
   * and the .deb with app.relaunch(), which keeps both — so the environment
   * is what tells the new copy it is the update's, to wait for this one to
   * go, and how to come back: still set up for nobody or not, and with a
   * window if somebody is looking at one. See startHidden.
   */
  process.env[AFTER_UPDATE] = comeBack
  updates.install()
  return { ok: true }
}

/*
 * "START WHEN THIS COMPUTER TURNS ON", on Linux.
 *
 * The setting IS the file: the entry in ~/.config/autostart is there and ours,
 * or it is not. Nothing else stores it, so nothing else can disagree with it —
 * and somebody who deletes the file by hand has turned it off. The text and
 * the rules are in lib/autostart.mjs; this is the reading and the writing.
 *
 * Linux only, and only the installed app. macOS and Windows have their own
 * login items, and this change does not touch them; a checkout has nothing
 * worth starting.
 */
const bootPath = () => boot.entryPath({ env: process.env, home: homedir() })
const bootTarget = () =>
  boot && process.platform === 'linux'
    ? boot.launchTarget({ env: process.env, execPath: process.execPath, packaged: app.isPackaged })
    : null

/** What the entry on disk says, or null when there is none. */
function bootEntry() {
  try {
    return boot.readEntry(readFileSync(bootPath(), 'utf8'))
  } catch {
    return null
  }
}

/**
 * Write the entry for `target`, unless it already says exactly that.
 *
 * Synchronous, because one caller is electron-updater's rename event, which
 * fires in the middle of the quit. Written beside the real file and renamed
 * over it, so a Pi unplugged mid-write keeps the old entry rather than half
 * of a new one.
 */
function writeBootEntry(target) {
  const text = boot.entryText(target)
  if (!text) throw new Error(`this app's location cannot go in a start-up entry: ${target}`)
  const path = bootPath()
  try {
    if (readFileSync(path, 'utf8') === text) return
  } catch {
    // Not there yet, which is the ordinary case.
  }
  mkdirSync(dirname(path), { recursive: true })
  const next = `${path}.new`
  writeFileSync(next, text)
  renameSync(next, path)
}

/** { supported, on } — `read: false` for the menu, which uses the copy kept in bootOn. */
function startAtBootState({ read = true } = {}) {
  if (!bootTarget()) return { supported: false, on: false }
  if (read) bootOn = Boolean(bootEntry()?.on)
  return { supported: true, on: bootOn }
}

/** Turn it on or off — for the switch in Settings and the tray's checkbox alike. */
function setStartAtBoot(on) {
  const target = bootTarget()
  if (!target) return { supported: false, on: false }
  let error = null
  try {
    if (on) writeBootEntry(target)
    else if (bootEntry()?.ours) unlinkSync(bootPath())
  } catch (err) {
    error = err?.message || String(err)
    console.error('[start at power-on] could not change it:', error)
  }
  const state = startAtBootState()
  if (tray) drawTray()
  return error ? { ...state, error } : state
}

/*
 * Kept pointing at this app. At every launch while it is on, the entry is
 * written again with where this app is now — so an AppImage that was moved,
 * or a .deb that replaced it, is what starts next time.
 */
function healStartAtBoot() {
  const target = bootTarget()
  if (!target || !startAtBootState().on) return
  try {
    writeBootEntry(target)
  } catch (err) {
    console.error('[start at power-on] could not bring the entry up to date:', err?.message || err)
  }
}

/*
 * AND THE APPIMAGE MOVES WHEN IT UPDATES. The updater deletes the running
 * file and puts the new one beside it under the new version's name, so an
 * entry naming the old file starts nothing after the first update — and the
 * next launch, which would have mended it, is the launch that never happens.
 * So it is mended here, the moment the updater says where the new one went.
 */
function followTheAppImage(path) {
  if (!bootEntry()?.on) return
  try {
    writeBootEntry(path)
    console.error('[start at power-on] now starts', path)
  } catch (err) {
    console.error('[start at power-on] could not follow the update:', err?.message || err)
  }
}

/*
 * The note the app leaves itself before an install: which version it expected
 * to be on when it came back. See installOutcome in lib/updates.mjs.
 */
const markerPath = () => join(app.getPath('userData'), 'pending-update.json')
function writeMarker(marker) {
  try {
    writeFileSync(markerPath(), JSON.stringify(marker))
  } catch (err) {
    console.error('[updates] could not note the pending install', err?.message || err)
  }
}
function readMarker() {
  try {
    return existsSync(markerPath()) ? JSON.parse(readFileSync(markerPath(), 'utf8')) : null
  } catch {
    return null
  }
}
function clearMarker() {
  try {
    if (existsSync(markerPath())) unlinkSync(markerPath())
  } catch {
    // A note that will not go is read again next launch and found stale then.
  }
}

/**
 * What macOS's installer wrote while it tried. The only record of WHY an
 * install did not take, and until now there was no way to see it from the app.
 * Best effort with a deadline; an empty answer is an answer.
 */
function shipItLog() {
  if (process.platform !== 'darwin') return Promise.resolve('')
  return new Promise((resolve) => {
    execFile(
      'log',
      [
        'show',
        '--style',
        'compact',
        '--last',
        '30m',
        '--predicate',
        'process == "ShipIt" OR (process == "Fractal Remote" AND (eventMessage CONTAINS "Squirrel" OR eventMessage CONTAINS "update"))'
      ],
      { encoding: 'utf8', timeout: 15000, maxBuffer: 8 * 1024 * 1024 },
      (err, out) => {
        if (err || !out) return resolve('')
        const lines = out.split('\n').filter((l) => l.trim() && !/^Filtering|^Timestamp/.test(l))
        resolve(lines.slice(-40).join('\n'))
      }
    )
  })
}

function publish(state) {
  update = state
  if (tray) drawTray()
  if (win && !win.isDestroyed()) {
    win.webContents.send('updates:state', { ...state, line: updateLine(state) })
  }
}

async function beginUpdates() {
  if (!app.isPackaged) return
  try {
    const { autoUpdater } = require('electron-updater')
    /*
     * Electron's own updater, on the Mac only, because it is a Mac updater.
     * It was handed in everywhere, and on Linux and Windows it never says a
     * word — so a download stayed "Preparing…" for ever there, and Restart to
     * update never appeared. Without it the library's own "downloaded" is
     * the ready signal, which on those two is the true one. See wireUpdates.
     */
    const native = process.platform === 'darwin' ? require('electron').autoUpdater : null
    const mod = await import('./lib/updates.mjs')
    const { wireUpdates, installOutcome } = mod
    updateLine = mod.updateLine

    /*
     * Where the app is decides whether there is any point. An app macOS will
     * not replace in place gets one line saying what to do, and no download
     * that would only come back as the same offer.
     */
    if (misplaced) {
      publish({ kind: 'misplaced' })
      return
    }

    /*
     * Did the last install take? A note left before it says what was expected;
     * the version running says what happened. When they disagree the app says
     * so, with whatever macOS wrote about it, instead of offering the same
     * update again as if nothing had been tried.
     */
    const marker = readMarker()
    const outcome = installOutcome({ marker, version: app.getVersion() })
    if (marker) clearMarker()

    if (typeof autoUpdater.on === 'function') {
      autoUpdater.on('appimage-filename-updated', (path) => followTheAppImage(path))
    }

    updates = wireUpdates({
      updater: autoUpdater,
      native,
      onState: (state) => {
        update = state
        /*
         * What to do about it first, and only then the drawing: a menu that
         * failed to draw once took the install-at-power-on down with it.
         */
        if (state.kind === 'ready' && outcome !== 'stuck') installIfUnattended()
        if (state.kind === 'trouble' && outcome !== 'stuck') retryUpdateCheck()
        if (tray) drawTray()
        /*
         * And the window, which until now was never told anything. The line is
         * built here rather than in the page so the menu and the window cannot
         * drift into saying different things about the same download.
         */
        if (win && !win.isDestroyed()) {
          win.webContents.send('updates:state', { ...state, line: updateLine(state) })
        }
      },
      log: (err) => console.error('[updates]', err?.message || err),
      // What is on GitHub now, from its API rather than its web pages: see
      // releaseVerdict in lib/updates.mjs.
      running: app.getVersion(),
      lookup: async () => {
        const { net: web } = require('electron')
        const res = await web.fetch(LATEST_API_URL, {
          headers: { Accept: 'application/vnd.github+json' },
          cache: 'no-store'
        })
        if (!res.ok) throw new Error(`GitHub said ${res.status}`)
        return res.json()
      },
      /*
       * Which files this computer's updater needs from a release, so it waits
       * for its own and nobody else's. Until 1.87.23 every computer waited
       * for the Mac's, and a Mac build that failed left every PC and Pi
       * saying "still being built". See updateFiles in lib/updates.mjs.
       */
      target: { platform: process.platform, arch: process.arch, appImage: Boolean(process.env.APPIMAGE) }
    })
    updateRules = mod
    if (outcome === 'stuck') {
      // Said at once; the reason follows when macOS's log has been read, which
      // can take a few seconds and must not hold the window up.
      publish({ kind: 'stuck', version: marker.version, detail: '' })
      shipItLog().then((detail) => {
        if (update?.kind === 'stuck') publish({ ...update, detail })
      })
      // Not checked again on its own this launch: a fresh download would only
      // paper over the reason. Check for updates still works by hand.
      return
    }
    await updates.check()
    /*
     * And again, by itself, on every computer — not only one started with no
     * window, as until 1.87.23. Six hours after the last look, sooner after
     * one that found the new version still being built or could not reach
     * GitHub, and half a minute after the computer wakes. What it finds
     * downloads, and goes in at a quit or a press of Restart to update; it
     * never restarts the app. See nextLookMs in lib/updates.mjs.
     */
    lookingForUpdates = true
    lookForUpdatesIn(mod.nextLookMs(update))
    powerMonitor.on('resume', updatesAfterWake)
  } catch (err) {
    console.error('[updates] not available', err?.message || err)
  }
}

/*
 * THE LOOK FOR UPDATES, AGAIN AND AGAIN.
 *
 * "A computer that stays open for days falls behind", the phone's own steps
 * for updating it said — because an ordinary start looked once, at launch.
 * One look waits at a time: a wake replaces the look that was waiting with
 * one half a minute on, and every look, however it was started, schedules
 * the next from what it found — the loop's own here, and every other one
 * through lookNow below. All through later(), so none of it outlives
 * the app or holds up a quit. Not at all on a copy whose last install did not
 * take, or one macOS will not update where it sits: beginUpdates returns
 * before it starts this.
 */
/** lib/updates.mjs, once beginUpdates has loaded it. */
let updateRules = null
/** Whether this run looks for updates by itself at all. */
let lookingForUpdates = false
let updateLook = null

function lookForUpdatesIn(ms) {
  if (quitting || !lookingForUpdates || !updates || !Number.isFinite(ms)) return
  cancel(updateLook)
  updateLook = later(lookForUpdates, ms)
}

async function lookForUpdates() {
  updateLook = null
  // Not over a download in progress: see downloading in lib/updates.mjs.
  if (!updateRules.downloading(update)) {
    try {
      // Never rejects (see wireUpdates); a look that went wrong is a line in the menu.
      await updates.check()
    } catch (err) {
      console.error('[updates] the look for updates failed:', err?.message || err)
    }
  }
  lookForUpdatesIn(updateRules.nextLookMs(update))
}

/*
 * A look taken out of turn: Check for updates, in the menu or the window, a
 * look tried again after one that failed, and the network turning out to be
 * there. Afterwards the waiting look is set again from what this one found,
 * exactly as after one the loop took itself. Without that, a press of Check
 * for updates that found the new version "still being built" left the next
 * look by itself up to six hours away, rather than a quarter of an hour, and
 * the download landed hours after it could have.
 *
 * Unlike the loop, this goes ahead over a download in progress, as Check for
 * updates always has: somebody asked.
 */
async function lookNow() {
  if (!updates) return
  try {
    // Never rejects (see wireUpdates); a look that went wrong is a line in the menu.
    await updates.check()
  } catch (err) {
    console.error('[updates] the look for updates failed:', err?.message || err)
  }
  if (updateRules) lookForUpdatesIn(updateRules.nextLookMs(update))
}

/* The computer woke: look half a minute on, once its wifi is back. */
function updatesAfterWake() {
  if (updateRules) lookForUpdatesIn(updateRules.WAKE_LOOK_MS)
}

/*
 * An update ready just after a windowless start is installed there and then.
 *
 * electron-updater installs at a clean quit, and a Pi on a pedalboard never
 * has one: it is unplugged. So the update would wait for a quit that never
 * comes, and the box would stay on its first version for ever. The download
 * from an earlier run is still on disk, though, and makes the update ready
 * within seconds of the next power-on — before anybody is playing, which is
 * the one moment an app restarting itself interrupts nothing. Later than that
 * it waits for a quit, like everywhere else. The rules are in
 * unattendedInstall, lib/autostart.mjs.
 */
function installIfUnattended() {
  if (installedUnattended || !boot) return
  const verdict = boot.unattendedInstall({
    hidden: startHidden,
    sinceLaunchMs: uptime() - launchedAt,
    platform: process.platform,
    env: process.env
  })
  if (!verdict.install) {
    if (startHidden) console.error(`[updates] ${update?.version || 'An update'} is ready; ${verdict.why}.`)
    return
  }
  installedUnattended = true
  console.error(`[updates] installing ${update?.version || 'the update'} now, while nobody is playing`)
  installNow().catch((err) => console.error('[updates] could not install', err?.message || err))
}

/*
 * A look for updates that failed just after a windowless start is tried
 * again, half a minute later, for as long as an install could still follow
 * it. A Pi often boots before its wifi — the reason the phone remote is
 * asked for again, too — and the one look it takes at power-on lands in
 * exactly that gap. With no answer there is no download, and with no
 * download nothing installs, at this power-on or any later one. The rules
 * are updateRetryDelay in lib/autostart.mjs.
 */
function retryUpdateCheck() {
  if (updateRetry || !updates || !boot) return
  const wait = boot.updateRetryDelay({ hidden: startHidden, kind: update?.kind, sinceLaunchMs: uptime() - launchedAt })
  if (!wait) return
  updateRetry = later(() => {
    updateRetry = null
    lookNow()
  }, wait)
}

/*
 * And once more when the network turns out to be there after all. The phone
 * remote coming on means the account service answered, so a look for updates
 * that failed for want of a network is worth taking again — later than the
 * retries above, which stop with the install window. What it finds downloads,
 * and installs at the next power-on.
 */
function networkIsUp() {
  if (startHidden && update?.kind === 'trouble' && updates) lookNow()
}

/**
 * Whether the app sits where macOS will let it be replaced.
 *
 * An app opened from Downloads is run from a hidden read-only copy, and an
 * update installed there is thrown away with the copy — the app relaunches, on
 * the old version, and offers the same update again. Reported as "it closes
 * the app and restarts and then it still says the same update is available".
 * Moving it into Applications is the only cure, so the app offers to, once,
 * on the way in. Declining is remembered for this launch only.
 */
let misplaced = false
async function settleInPlace() {
  if (!app.isPackaged || process.platform !== 'darwin') return true
  const { installPlace } = await import('./lib/updates.mjs')
  let inApplications = true
  try {
    inApplications = app.isInApplicationsFolder()
  } catch {
    return true
  }
  const place = installPlace({ exePath: app.getPath('exe'), inApplications })
  if (place.ok) return true
  /*
   * Nobody there to answer, and this box waits until somebody does. The menu
   * and the Updates page still say what to do about it.
   */
  if (startHidden) {
    misplaced = true
    return true
  }
  const choice = dialog.showMessageBoxSync({
    type: 'question',
    buttons: ['Move to Applications', 'Not now'],
    defaultId: 0,
    cancelId: 1,
    message: 'Move Fractal Remote to your Applications folder?',
    detail:
      'It is running from somewhere macOS will not update it in place, so new versions would download and never install. ' +
      'Moving it takes a moment and the app reopens on its own.'
  })
  if (choice === 0 && moveToApplications()) return false
  misplaced = true
  return true
}

/** Move the app and reopen it from Applications. True when that is under way. */
function moveToApplications() {
  try {
    // Replaces an older copy already there; that copy is what we are updating.
    return app.moveToApplicationsFolder({ conflictHandler: () => true })
  } catch (err) {
    console.error('[place] could not move to Applications', err?.message || err)
    return false
  }
}

/*
 * The copy an update has just started, waiting for the one it replaces.
 *
 * The AppImage updater starts the new file a moment BEFORE the old copy has
 * finished quitting, and the old one still holds the lock — so the new one,
 * finding it, would quit too, and the box would be left with nothing running
 * at all. It asks again for ten seconds instead, which is far longer than an
 * old copy with its server already stopped takes to go.
 */
async function lockAfterUpdate() {
  for (let i = 0; i < 40; i++) {
    await new Promise((resolve) => setTimeout(resolve, 250))
    if (app.requestSingleInstanceLock(knock)) return true
  }
  return false
}

app.whenReady().then(async () => {
  // Another copy is running: it has been told, and opens its window.
  if (!primary) primary = relaunched && (await lockAfterUpdate())
  if (!primary) {
    app.quit()
    return
  }
  // A service, not a document: no dock icon, no window until asked.
  showInDock(false)
  boot = await import('./lib/autostart.mjs')
  healStartAtBoot()
  if (!(await settleInPlace())) return // reopening from Applications
  const answering = await start()
  if (!where) return
  drawTray()
  wireUpdateChannel()
  await beginUpdates()
  if (!answering) {
    if (startHidden) {
      /*
       * Nobody to tell in a box, so it says so in the menu and keeps waiting:
       * a slow first start on a Pi 3 is still a start, and a server that dies
       * instead is started again by its exit handler.
       */
      unattended("The part that talks to your unit hasn't started yet — still waiting for it")
      const { waitForServer } = await host()
      while (!(await waitForServer({ port: hostAt.port }))) {
        if (quitting) return
      }
      settled()
    } else {
      /*
       * A minute is long enough that this is not slowness. Said out loud,
       * because the alternative is a window showing nothing and a person with no
       * idea whether the app is broken or their unit is.
       */
      dialog.showErrorBox(
        'The device server did not start',
        'It was started but never answered, so there is nothing to show yet.\n\n' +
          'Quit and open the app again. If it keeps happening, the log is in\n' +
          'Console.app under "Fractal Remote".'
      )
      return
    }
  }
  // A window somebody opened from the tray before there was a server to show.
  const blank = win && !win.isDestroyed() && !win.webContents.getURL().startsWith(where.local)
  if (windowAtLaunch || wantWindow) openWindow()
  else if (startHidden) openWindow({ hidden: true })
  if (blank) win.loadURL(where.local)
  wantWindow = false
  // For whoever reads the log, and for the check in CI that no window is shown.
  console.error(`[launch] done, ${win?.isVisible() ? 'with a window' : win ? 'with the page in a window nobody sees' : 'no window'}`)
})

/*
 * Closing the window closes the app.
 *
 * It did not, by design: the app was a menu-bar service, still serving the
 * phone with its window gone. What that felt like was an app that would not
 * close — no window, no dock icon, still running, and "the only way to close
 * it out all the way is Force Quit". Force Quit is the one thing that must not
 * happen to this app, because it skips the quit that installs updates and
 * leaves the device server holding the port. So the close button quits, the
 * ordinary way, through the same shutdown as ⌘Q.
 *
 * EXCEPT ON A COMPUTER SET UP TO RUN IT WITH NOBODY THERE — started with no
 * window, or with "Start when this computer turns on" switched on. That
 * computer is a pedalboard or a rack, the window was opened to check on it,
 * and closing it must not take the phone remote down with it. The app stays
 * in the tray, and the tray's Quit still quits. Everywhere else, closing
 * still quits exactly as it did.
 */
/*
 * The switch read afresh, not remembered: somebody who turned it off in their
 * desktop's own Startup Applications, or deleted the file, has turned it off,
 * and closing the window should then quit like anywhere else.
 */
const stayInTray = () => startHidden || startAtBootState().on
app.on('window-all-closed', () => {
  if (quitting) return
  if (stayInTray()) return
  app.quit()
})

/*
 * Quitting, in a way that always finishes.
 *
 * This cancelled the quit, awaited the mDNS teardown and then asked to quit
 * again — so anything thrown in between left the app refusing to close. And the
 * server was sent SIGINT and abandoned, which on a child that ignores it means
 * a process still holding port 5056 after the app is gone: the next launch
 * finds a ForgeFX it did not start, says so, and quits. Between them that is
 * "it won't let you reopen it, you have to force close then restart".
 *
 * The work itself lives in host.mjs, where it can be tested, and it now has a
 * deadline on every step of it. What is left here is the promise that outranks
 * all of them: however that goes, this app closes.
 *
 * Because the cost of it not closing is no longer just an annoyance. An update
 * is installed when the app quits — that is the whole design, so that nothing
 * ever restarts itself mid-set — and an app that can only be force quit is an
 * app that can never finish an update. Force Quit is SIGKILL: no quit event, no
 * install, and the same "an update is ready" line waiting the next time.
 */
const QUIT_DEADLINE_MS = 6000
/*
 * Longer than the quit's, because this one waits on Squirrel handing the app
 * over to its installer rather than on anything in this file.
 */
const INSTALL_DEADLINE_MS = 20000

app.on('before-quit', (e) => {
  // A second copy stepping aside started nothing, so it has nothing to stop.
  if (quitting || !primary) return
  e.preventDefault()

  /*
   * The backstop, and it is deliberately never cleared.
   *
   * Everything below has a deadline of its own, so in the ordinary case this
   * timer is still counting when the process is already gone and it simply
   * never runs. It exists for the case nobody predicted — the next thing that
   * turns out to wait forever — because the one outcome that must not be
   * possible is an app a person cannot close.
   */
  setTimeout(() => app.exit(0), QUIT_DEADLINE_MS)

  const done = () => app.quit()
  stopServing().then(done, done)
})

/**
 * Stop being a server, and stop being one only once.
 *
 * Shared by the two ways this app stops: somebody quitting it, and somebody
 * asking for an update to be installed now. Both have to put the device server
 * down before the process goes, or a ForgeFX left holding port 5056 stops the
 * next launch dead.
 *
 * `quitting` is set first and never cleared. It is what stops the quit handler
 * cancelling the very quit it asked for, and it is why installing an update can
 * simply call app.quit() afterwards and be let through.
 */
async function stopServing() {
  if (quitting) return
  quitting = true
  // Nothing that was waiting to try again does, from here on.
  for (const timer of timers) clearTimeout(timer)
  timers.clear()
  // And the computer may sleep again: nothing is serving a phone any more.
  stayAwakeWhileUsed()

  /*
   * Say so on screen straight away. Tearing down can take a couple of seconds
   * in the worst case, and a window still sitting there after ⌘Q reads as an
   * app that ignored you — which is exactly when a person reaches for Force
   * Quit and loses the update that was about to install.
   */
  if (win && !win.isDestroyed()) win.hide()

  try {
    const { shutdown } = await host()
    await shutdown({ server, advert })
  } catch {
    // Nothing here is a reason to stay open. See QUIT_DEADLINE_MS.
  }
  server = null
  advert = null
}

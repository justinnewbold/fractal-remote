/**
 * The mechanics of serving this app from the machine with the cable.
 *
 * Two things do this now — `npm run serve` for a terminal, and the desktop app
 * for everyone else — and they must not drift, because the ways they could
 * disagree are all invisible until a phone is in someone's hand: a different
 * port, a different mDNS name, a different idea of where ForgeFX lives.
 *
 * So the decisions live here, in a module that imports neither Electron nor
 * mDNS. Both are handed in, the same way `deviceState` takes its driver — which
 * is also what makes any of this testable without a Mac, a unit, or a network.
 */
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { networkInterfaces, hostname as osHostname } from 'node:os'
import { DEFAULT_PROJECT, HOSTED_ORIGIN } from './project.mjs'

export const DEFAULT_PORT = 5056
export const DEFAULT_NAME = 'fractal'

/**
 * The name this Mac advertises itself under on the network.
 *
 * A constant would be wrong the moment there are two Macs, and it was a
 * constant. Both would ask for `fractal.local`; bonjour-service probes first
 * and, finding the name taken, quietly stops advertising and writes a line to a
 * console nobody is reading. So the second Mac has no name at all — while its
 * own menu goes on offering `http://fractal.local:5056`, built from the name it
 * asked for rather than the one it got. Tap it and you land on the other Mac.
 * Every other address in that menu is per-machine and correct; this is the only
 * one that can lie.
 *
 * So the machine's own name goes in it — the same name armHost already writes
 * into the store for the phone to show, so the two agree. `fractal` stays the
 * prefix, because the point of the name is to say what it is, and stays the
 * whole name on a Mac whose hostname tells us nothing.
 */
export function mdnsName(machine = osHostname()) {
  const slug = String(machine || '')
    .replace(/\.local$/i, '')
    .toLowerCase()
    // Anything a DNS label may not carry becomes the one separator it may.
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/, '')
  return slug ? `${DEFAULT_NAME}-${slug}` : DEFAULT_NAME
}

/**
 * Where ForgeFX is.
 *
 * It is a separate project — we do not own it and cannot vendor it — so its
 * location is configuration with sensible guesses. A path only counts if it
 * actually holds the server, because a half-finished clone that answers
 * `existsSync` is worse than no match: it fails later, further from the cause.
 */
export function findForgeFX({ env = process.env, exists = existsSync, extra = [] } = {}) {
  const home = env.HOME || env.USERPROFILE || ''
  const candidates = [env.FORGEFX_PATH, ...extra, join(home, 'src/forgefx'), join(home, 'src/ForgeFX')]
  for (const path of candidates) {
    if (path && exists(join(path, 'server', 'package.json'))) return path
  }
  return null
}

/**
 * The address a phone on the same wifi can actually reach.
 *
 * Loopback is useless here by definition: the whole point is a second device.
 * Returns null rather than falling back to 127.0.0.1, so a caller shows "no
 * network" instead of printing an address that cannot work.
 */
export function lanAddress(interfaces = networkInterfaces) {
  for (const addrs of Object.values(interfaces() || {})) {
    for (const a of addrs || []) {
      if (a.family === 'IPv4' && !a.internal) return a.address
    }
  }
  return null
}

/**
 * Every way in, most useful first.
 *
 * The QR code carries the IP rather than the .local name on purpose. iOS
 * resolves .local natively — it is the same mechanism that answers for a
 * HeadRush — but Android's support is patchy enough that a scanned code
 * failing would be the worst possible first impression. The name is still
 * offered for typing, where a human can retry.
 */
export function addresses({ port = DEFAULT_PORT, name = DEFAULT_NAME, ip } = {}) {
  const local = `http://localhost:${port}`
  const mdns = `http://${name}.local:${port}`
  const lan = ip ? `http://${ip}:${port}` : null
  return {
    local,
    mdns,
    lan,
    /** What to put in front of a camera. Null when there is no network at all. */
    forPhone: lan || null,
    all: [local, lan, mdns].filter(Boolean)
  }
}

/**
 * The environment ForgeFX is started with.
 *
 * `FORGEFX_STATIC` is the whole of local mode in one variable: it makes the
 * device server serve this app, so the page and the device API are the same
 * origin and a phone needs no account to bridge them.
 *
 * The three account variables are the whole of phone-remote mode. ForgeFX
 * will only host a phone when they are set, and until now that meant a person
 * opening its `.env` in an editor — the single step that stopped anyone who
 * was not already a developer. Set here, every launch, they are simply true.
 * An operator's own values still win, for a second project or a rotated key;
 * and ForgeFX's own `.env` cannot override these, because Node's loader does
 * not replace a variable that is already in the environment.
 *
 * FORGEFX_ALLOWED_ORIGINS is who else may use the device server from a web
 * page. Its guard (ForgeFX server/src/guard.ts) answers the computer's own
 * window and the Wi-Fi page it served by itself, and a page from any other
 * address only when this names it exactly. The public site, opened in a
 * browser on the computer from the tray, is the one: it is the computer's own
 * page there, and signs it in. A developer's own page (Vite, at
 * http://localhost:5173) is added by setting the variable, comma-separated;
 * set to an empty string, nothing else is let in. A device server older than
 * the guard reads nothing from it.
 */
export function serverEnv({
  env = process.env,
  port = DEFAULT_PORT,
  dist,
  project = DEFAULT_PROJECT,
  hosted = HOSTED_ORIGIN,
  asNode = false
}) {
  /* Not passed on: see PYTHON, below. */
  const { PYTHONPATH: _path, PYTHONHOME: _home, ...rest } = env
  return {
    ...rest,
    /*
     * PYTHON, KEPT TO ITS OWN MODULES. On Linux ForgeFX reads the unit's
     * replies through a small `python3 -c` reader (computer app 1.87.47 on),
     * started from the server's working folder, which is wherever the app
     * was opened from: the home folder, for the start-up entry and the
     * menu. A `signal.py` or `ctypes.py` left there would be run in place
     * of Python's own every time the unit's port opened, and so would
     * anything PYTHONPATH or the person's own site-packages pointed at.
     * Every way that goes wrong falls back to RtMidi's input, but one of
     * them quietly leaves readers running after the server has stopped.
     *
     * So the server's children leave the working folder off the module path
     * (PYTHONSAFEPATH, Python 3.11 on: Raspberry Pi OS from Bookworm) and the
     * person's own site-packages out, and are told no PYTHONPATH or
     * PYTHONHOME. It is ForgeFX's one Python; the full fix is its own `-I`
     * on that command, in a later ForgeFX.
     */
    PYTHONSAFEPATH: '1',
    PYTHONNOUSERSITE: '1',
    /*
     * Electron, told to be Node.
     *
     * The desktop app starts the server with `process.execPath`, which in a
     * packaged app is the Electron binary — so without this it launches a
     * second copy of the app rather than running the server, and the unit is
     * never reachable. It reads as "run this script with the binary I am", and
     * that is only true of a binary that is already Node. The terminal
     * launcher is already Node and passes nothing.
     */
    ...(asNode ? { ELECTRON_RUN_AS_NODE: '1' } : {}),
    PORT: String(port),
    FORGEFX_STATIC: dist,
    AXIS_CLOUD: env.AXIS_CLOUD ?? '1',
    SUPABASE_URL: env.SUPABASE_URL ?? project.url,
    SUPABASE_ANON_KEY: env.SUPABASE_ANON_KEY ?? project.anonKey,
    FORGEFX_ALLOWED_ORIGINS: env.FORGEFX_ALLOWED_ORIGINS ?? hosted
  }
}

/**
 * "Justins-MacBook-Pro.local" as a person would say it.
 *
 * The phone shows this — "Connected to Justins MacBook Pro" — so it is worth
 * the two lines. The `.local` is the network's business, and the hyphens are
 * a rule about hostnames, not about the machine's name.
 */
export function prettyHostname(name = osHostname()) {
  return String(name || '')
    .replace(/\.local$/i, '')
    .replace(/[-_]+/g, ' ')
    .trim() || 'your computer'
}

/**
 * What the device server says about the phone remote's link, read the same
 * way whichever ForgeFX answers.
 *
 *   relayState(body) → { enabled, connected, sure, state }
 *
 * `enabled` is the switch. `connected` is the link to the account service
 * that a phone away from home talks through — and what it means depends on
 * the device server's age, which is what `sure` says.
 *
 * A device server that reports a `state` says how its link really is, from
 * moment to moment: `connected` is true only while the link is up. One that
 * does not is older, and its `connected` only ever meant "a link was made
 * once". On 12 October 2026 a phone got no answer from a MacBook whose
 * Fractal Remote app was open and signed in: the account service had closed
 * the link, the device server never noticed, and it went on saying
 * connected for as long as it ran. Quitting and reopening the app fixed it.
 * So on an older one, a `connected` is believed only so far — see
 * checkRelay — and its absence while switched on means the last attempt to
 * make the link failed.
 */
export function relayState(body) {
  const s = body && typeof body === 'object' ? body : {}
  const sure = typeof s.state === 'string'
  return {
    enabled: s.enabled === true,
    connected: s.enabled === true && s.connected === true,
    sure,
    state: sure ? s.state : null
  }
}

/**
 * Turn the phone remote on, every launch, with nobody touching anything.
 *
 * ForgeFX remembers being signed in across restarts — that lives in its own
 * store — but it forgets the host switch every time, and nothing in it turns
 * the switch back on at startup. Until now the only thing that did was a
 * browser tab at the Mac, and only if someone opened the settings there. So
 * the phone found a Mac that was signed in, listening for nothing.
 *
 * This runs after the launchers start ForgeFX. Its rules, in order:
 *
 *   - Wait for ForgeFX to answer at all. `npm run dev` compiles first.
 *   - Write this Mac's name where the phone can read it, always. The launcher
 *     is the one thing that reliably knows it.
 *   - No account support in this ForgeFX → nothing to do, say so.
 *   - Not signed in → nothing to do, say so. Signing in happens once, in the
 *     app; it is the only step a person ever takes.
 *   - Already on, AND its link up → done. Switched on is not the same as
 *     on: a device server whose link the account service closed stays
 *     switched on, and a phone gets no answer from it. That one is turned on
 *     again below, which makes the link afresh.
 *   - Someone turned it off on purpose → respect that. "Off" is a decision
 *     the app records; the absence of a record means on.
 *   - Otherwise turn it on, and try a few times: the first call after boot
 *     has to reach the account service, and a Mac waking up is sometimes a
 *     few seconds ahead of its wifi. Except on an older device server whose
 *     try at the link itself failed — see 'stuck' below — and on one that
 *     reports its state, which keeps trying by itself once it is switched
 *     on — see 'retrying'.
 *   - Turned off while it was being turned on → that was somebody's
 *     decision too, and it is not undone.
 *
 * Never throws. A launcher must not fall over because a network was slow —
 * the unit still works at the Mac either way, and the browser at the Mac
 * makes the same attempt when it opens.
 *
 * Everything with a side effect is injected, which is what lets the sequence
 * be tested without a Mac, a ForgeFX, or a network.
 */
export async function armHost({
  port = DEFAULT_PORT,
  fetch = globalThis.fetch,
  hostname = prettyHostname(),
  /*
   * Which Mac app this is, for the phone's debug report. A phone on today's
   * web build against a Mac still running last week's app is the shape of
   * every "the fix didn't work" — and the report said only the Mac's name,
   * so there was no telling. Written beside the name, where the phone
   * already looks.
   */
  version = null,
  sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
  attempts = 90,
  log = () => {}
} = {}) {
  const base = `http://localhost:${port}`
  const call = async (path, init) => {
    const res = await fetch(base + path, init)
    let body = null
    try {
      body = await res.json()
    } catch {
      // Not every reply is JSON, and a body we cannot read is not the point.
    }
    return { ok: res.ok, status: res.status, body }
  }
  const json = (method, path, data) =>
    call(path, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: data === undefined ? undefined : JSON.stringify(data)
    })

  try {
    // 1. Wait for it to be there.
    let up = false
    for (let i = 0; i < attempts && !up; i++) {
      try {
        up = (await call('/healthz')).ok
      } catch {
        up = false
      }
      if (!up) await sleep(1000)
    }
    if (!up) {
      log('Phone remote: the device server never answered, so it was left alone.')
      return { on: false, reason: 'no-server' }
    }

    // 2. The name the phone will show, and which app this is.
    await tellPhones({ port, fetch, hostname, version, log })

    // 3. Can this ForgeFX host at all, and is anyone signed in?
    const cloud = (await call('/cloud/status')).body || {}
    if (!cloud.enabled) {
      log('Phone remote: this device server has no account support, so it stays off.')
      return { on: false, reason: 'no-cloud' }
    }
    if (!cloud.user) {
      log('Phone remote: sign in once in the app to turn it on.')
      return { on: false, reason: 'signed-out' }
    }
    const email = cloud.user.email || null

    // 4. Already on — switched on, and its link up.
    const link = relayState((await call('/remote/status')).body)
    if (link.enabled && link.connected) {
      log(`Phone remote: on for ${email || 'this account'}.`)
      return { on: true, email }
    }

    // 5. Turned off on purpose.
    const wanted = (await call('/store/config/remote.host')).body?.data
    if (wanted && wanted.wanted === false) {
      log('Phone remote: off — it was turned off in the app.')
      return { on: false, reason: 'turned-off', email }
    }

    /*
     * A device server that says yes and is still making its link: asked
     * how it is going, a second at a time, rather than asked to start
     * again — which would undo the link it is making. One that waits for
     * its link before it answers never gets here. Says what it last read.
     */
    const joined = async () => {
      let now = null
      for (let i = 0; i < 15; i++) {
        now = relayState((await call('/remote/status')).body)
        if (now.connected || !now.enabled) return now
        await sleep(1000)
      }
      return now
    }
    /*
     * TURNED OFF while this was turning it on: somebody pressed Turn off in
     * the app, or signed out there, while the device server was still
     * making the link this asked for. It answers yes with its switch off,
     * and asking again would turn the remote back on against them — the
     * page writes down "off" a moment after, which is too late for a retry
     * that is already on its way.
     */
    const turnedOff = () => {
      log('Phone remote: off — it was turned off in the app while it was being turned on.')
      return { on: false, reason: 'turned-off', email }
    }
    /*
     * RETRYING: a device server that reports its state, switched on and not
     * on the account service yet. It keeps trying by itself, waiting a
     * little longer each time (ForgeFX's relay host: 1, 2 and 5 seconds, then
     * every 10 — or on to every minute when the account service itself put
     * it out) — and every "turn it on" starts that over from one second, so
     * asking again here, or every minute from the app's retry, would only
     * hammer an account service that is already struggling. Left to it; the
     * app's looks at the link see it come up.
     */
    const retrying = (why) => {
      log(`Phone remote: switched on, not on the account service yet (${why}); the device server keeps trying by itself.`)
      return { on: false, reason: 'retrying', email, error: why }
    }

    // 6. Turn it on.
    let last = null
    for (let i = 0; i < 3; i++) {
      try {
        const res = await json('POST', '/remote/enable', { on: true })
        const said = res.body && typeof res.body === 'object' ? res.body : {}
        const sure = link.sure || relayState(said).sure
        if (res.ok && !said.error) {
          if (said.enabled === false) return turnedOff()
          const now = said.connected === false ? await joined() : null
          if (!now || now.connected) {
            log(`Phone remote: on for ${email || 'this account'}.`)
            return { on: true, email }
          }
          if (!now.enabled) return turnedOff()
          last = said.lastError || 'its link never came up'
          if (sure) return retrying(last)
        } else {
          last = said.error || `HTTP ${res.status}`
          if (res.ok && sure && said.enabled === true) return retrying(last)
          /*
           * STUCK: an older device server that tried to make the link and
           * failed. It leaves the half-made link behind, and the library
           * underneath may yet finish it by itself — so asking again does
           * not replace it, it adds a second one, and every tap on the
           * phone is then carried out twice. (Its "no answer from the
           * account service" is a plain yes-with-an-error, which leaves
           * nothing behind and is asked again as before.) One that reports
           * its state cleans up after itself: a link it could not make is a
           * yes with its reason, left to its own retry (RETRYING above), and
           * anything worse is asked again here, three times at most.
           * Quitting and reopening the app clears it either way.
           */
          if (!res.ok && !link.sure) {
            log(`Phone remote: couldn't turn it on (${last}), and this device server can't be asked twice. Quit Fractal Remote and open it again.`)
            return { on: false, reason: 'stuck', email, error: last }
          }
        }
      } catch (err) {
        last = err.message
      }
      if (i < 2) await sleep(5000)
    }
    log(`Phone remote: couldn't turn it on (${last}). Open the app on this computer to try again.`)
    return { on: false, reason: 'failed', email, error: last }
  } catch (err) {
    log(`Phone remote: left alone (${err.message}).`)
    return { on: false, reason: 'failed', error: err.message }
  }
}

/**
 * Look at the phone remote's link again, and say whether it needs making
 * again.
 *
 * armHost runs at launch and after a restart, and until 1.87.19 nothing
 * looked again after that — so a link the account service closed while the
 * Mac slept stayed closed until the app was quit, with the menu saying on
 * the whole time. This is the look the app takes between: twice after the
 * computer wakes, and once a minute (see lookAtLink in main.js).
 *
 *   checkRelay({ port, fetch, nudged, wake, rebuild, log })
 *     → { seen, nudged, rearm, rebuilt?, error? }
 *
 *   seen    — relayState of what the device server said, or null when it
 *             did not answer (it is starting or stopped, and the app's own
 *             restart asks for the remote again).
 *   rearm   — run armHost now, which turns the remote on afresh. Only for a
 *             device server that reports its state, switched on with its
 *             link down, on a look just after a wake or a move to another
 *             network (`wake`), and once per outage (`nudged`). That one
 *             keeps trying by itself, waiting longer each time — up to ten
 *             seconds, or a minute when the account service itself closed
 *             the link; a push straight after a wake saves waiting that out,
 *             and any more pushes only start its waits over, at an account
 *             service that may be refusing everybody. Never when it
 *             is switched off: somebody did that, or it was never on, and
 *             armHost's own retry deals with the second. And never for an
 *             older device server switched on with no link: that is what a
 *             failed try leaves, and when the try was a refused link — the
 *             page's, say — turning it on again adds a second handler to the
 *             half-made link, and every tap on the phone happens twice.
 *             armHost's own retry, which knows how its own tries failed,
 *             covers those.
 *   nudged  — whether this outage has had its push: true from the look
 *             that asked for one until a look finds the link up, or the
 *             remote switched off. main.js lets each real wake have one more.
 *   rebuild — the link is to be made again even though it says it is up.
 *             Only an older device server is asked, once: its `connected`
 *             says a link was made, not that it is still there. One that
 *             reports its state is believed.
 *   rebuilt — 'done'; 'not yet' (the account service did not answer, which
 *             changes nothing — ask again later); or 'stuck' (the device
 *             server tried and failed, and see armHost on why that one is
 *             not asked twice).
 *
 * Never throws.
 */
export async function checkRelay({
  port = DEFAULT_PORT,
  fetch = globalThis.fetch,
  nudged = false,
  wake = false,
  rebuild = false,
  log = () => {}
} = {}) {
  const base = `http://localhost:${port}`
  const read = async (res) => {
    try {
      return await res.json()
    } catch {
      return null
    }
  }
  let seen = null
  try {
    const res = await fetch(`${base}/remote/status`)
    if (res.ok) seen = relayState(await read(res))
  } catch {
    // Not answering. See `seen` above.
  }
  if (!seen) return { seen: null, nudged, rearm: false }
  if (!seen.enabled) return { seen, nudged: false, rearm: false }

  if (seen.connected) {
    if (!rebuild || seen.sure) return { seen, nudged: false, rearm: false }
    try {
      const res = await fetch(`${base}/remote/enable`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ on: true })
      })
      const body = await read(res)
      if (res.ok && !body?.error) {
        log('Phone remote: made its link again, in case it closed while the computer slept or changed network.')
        return { seen: relayState(body), nudged: false, rearm: false, rebuilt: 'done' }
      }
      const error = body?.error || `HTTP ${res.status}`
      if (!res.ok) {
        log(`Phone remote: couldn't make its link again (${error}). Quit Fractal Remote and open it again.`)
        return { seen: { ...seen, connected: false }, nudged: false, rearm: false, rebuilt: 'stuck', error }
      }
      return { seen, nudged: false, rearm: false, rebuilt: 'not yet', error }
    } catch (err) {
      return { seen, nudged: false, rearm: false, rebuilt: 'not yet', error: err?.message || String(err) }
    }
  }

  // Switched on, and its link down.
  const rearm = seen.sure && wake && !nudged
  return { seen, nudged: nudged || rearm, rearm }
}

/**
 * Tell the phones what this computer is called and which app this is.
 *
 * Written into the device server's own store, where every phone looks first.
 * Once at launch was not enough: "The app on the computer is running the
 * latest version, so I'm not sure why it's saying this" — the phone said the
 * computer was older than the version that started writing this, on a Mac
 * that was not. A write that failed once, quietly, left whatever an older
 * launcher had written, for good. So it is written again every few minutes,
 * and a failure is said in words rather than swallowed. Never throws: a name
 * is a nicety, and the phone says "your computer" without one.
 */
export async function tellPhones({
  port = DEFAULT_PORT,
  fetch = globalThis.fetch,
  hostname = prettyHostname(),
  version = null,
  log = () => {}
} = {}) {
  const said = version ? `${hostname}, v${version}` : hostname
  try {
    const res = await fetch(`http://localhost:${port}/store/config/host.name`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        data: version ? { name: hostname, version: String(version) } : { name: hostname },
        origin: 'fractal'
      })
    })
    if (!res.ok) {
      log(`Phone remote: couldn't tell the phones this is ${said} (HTTP ${res.status}).`)
      return false
    }
    return true
  } catch (err) {
    log(`Phone remote: couldn't tell the phones this is ${said} (${err?.message || err}).`)
    return false
  }
}

/** How often the name and version are written again. */
export const TELL_PHONES_MS = 5 * 60 * 1000

/**
 * Tell the phones, then read back what they will actually hear.
 *
 * "My Mac is on the correct version 7.281" — and the phone's report still
 * said the computer app did not say. The write was being made, and nothing
 * on the Mac could show whether it landed: the menu said which version this
 * app is, which is not the same as which version the phones are told. So
 * after every write the document is read back the way a phone reads it, and
 * the menu says what a phone would hear — this version, an older one, a name
 * with no version, or that the write was refused. That names the fault
 * instead of the symptom, from the one machine that can see it.
 *
 * Never throws. `why` carries the sentence tellPhones logged when the write
 * failed, or what went wrong with the read-back.
 */
export async function tellPhonesChecked({
  port = DEFAULT_PORT,
  fetch = globalThis.fetch,
  hostname = prettyHostname(),
  version = null,
  log = () => {},
  now = Date.now
} = {}) {
  const said = []
  const wrote = await tellPhones({
    port,
    fetch,
    hostname,
    version,
    log: (line) => {
      said.push(line)
      log(line)
    }
  })
  let heard = null
  let why = wrote ? null : said[0]?.replace(/^Phone remote: /, '') || 'the write failed'
  try {
    const res = await fetch(`http://localhost:${port}/store/config/host.name`)
    if (!res.ok) {
      why = why || `HTTP ${res.status}`
    } else {
      const doc = await res.json()
      const data = doc && typeof doc === 'object' && doc.data && typeof doc.data === 'object' ? doc.data : doc
      heard = {
        name: data?.name ? String(data.name) : null,
        version: data?.version ? String(data.version) : null
      }
    }
  } catch (err) {
    why = why || err?.message || String(err)
  }
  return { at: now(), wrote, heard, why }
}

/** The menu's words for what the phones hear, or null before the first write. */
export function phonesHearLine(told, version = null) {
  if (!told) return null
  const mine = version ? String(version) : null
  if (!told.wrote) return `the phones can’t be told which app this is — ${told.why}`
  if (!told.heard) return `phones told, but reading it back failed${told.why ? ` (${told.why})` : ''}`
  if (mine && told.heard.version === mine) return `phones hear v${mine}`
  if (told.heard.version) {
    return `phones hear v${told.heard.version}, not v${mine} — the device server is serving an older copy`
  }
  return `phones hear ${told.heard.name || 'a name'} with no version — the device server is not keeping what this app writes`
}

/**
 * Whether macOS is likely to be stopping a phone from reaching this Mac.
 *
 * The address in the menu works from the Mac and fails from a phone, and
 * nothing says why. macOS asks separately about connections that arrive from
 * other machines, and until that is allowed the server is listening to a door
 * nobody can knock on. It is the first thing to check and the last thing
 * anyone thinks of.
 *
 * Best effort by design: the answer is used to add a line to a menu, so
 * anything unclear returns `known: false` and the menu says nothing rather
 * than guessing. An app that cries wolf about a firewall is worse than one
 * that stays quiet.
 */
export function readFirewall({ run, appPath } = {}) {
  const tool = '/usr/libexec/ApplicationFirewall/socketfilterfw'
  if (!run) return { known: false }

  let on
  try {
    const state = run(tool, ['--getglobalstate'])
    if (/disabled|State\s*=\s*0/i.test(state)) on = false
    else if (/enabled|State\s*=\s*[12]/i.test(state)) on = true
    else return { known: false }
  } catch {
    return { known: false }
  }
  if (!on) return { known: true, on: false, blocked: false }

  // On, so the question is whether this app in particular is let through.
  let blocked = null
  if (appPath) {
    try {
      const app = run(tool, ['--getappblocked', appPath])
      if (/allow incoming/i.test(app)) blocked = false
      else if (/block/i.test(app)) blocked = true
    } catch {
      // Unknown. The firewall is on, which is worth mentioning on its own.
    }
  }
  return { known: true, on: true, blocked }
}

/**
 * Wait until the device server is actually answering.
 *
 * Spawning it is not starting it: the process exists long before Fastify is
 * listening, and a window opened in that gap gets a refused connection and
 * shows nothing at all, for ever, because nothing retries a page that failed.
 *
 * That is what the first working install did — a blank window, no error, and
 * an app that had in fact started correctly. It only looked fine before
 * because another ForgeFX was already listening and answered instantly.
 *
 * Half a second between tries, a minute in total: a cold start compiling on a
 * slow morning is still a start, and the alternative is telling someone their
 * unit is missing when the server simply had not finished waking up.
 */
export async function waitForServer({
  port = DEFAULT_PORT,
  fetch = globalThis.fetch,
  sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
  attempts = 120
} = {}) {
  for (let i = 0; i < attempts; i++) {
    try {
      if ((await fetch(`http://localhost:${port}/healthz`)).ok) return true
    } catch {
      // Not up yet. That is the normal case for the first second or two.
    }
    await sleep(500)
  }
  return false
}

/**
 * Who, if anyone, already has the port.
 *
 * ForgeFX allocates its own port when the one it is given is taken: it catches
 * EADDRINUSE and re-listens on 0, letting the OS choose. That is sensible for a
 * server started by hand and quietly wrong for one started by an app, because
 * the app goes on believing the port it asked for is the port it got — it opens
 * a window on 5056, and whatever was already there answers.
 *
 * That is not hypothetical: it is what the first person to run this app saw. A
 * ForgeFX they already had running answered, knew nothing about serving the
 * page, and returned a bare 404 into the app's own window.
 *
 * So the launcher asks first, and asks specifically: is anything there, and is
 * it a ForgeFX? Two instances must not both open the same serial port, so the
 * answer decides between carrying on, standing aside, and moving.
 */
export async function whoHasPort({ port = DEFAULT_PORT, fetch = globalThis.fetch, connect } = {}) {
  const listening = await new Promise((done) => {
    // Injected so this is testable without binding anything.
    if (!connect) return done(null)
    connect(port, done)
  })
  if (!listening) return { free: true }
  try {
    const res = await fetch(`http://localhost:${port}/healthz`)
    if (res.ok) return { free: false, forgefx: true }
  } catch {
    // Something is there and it is not answering as ForgeFX does.
  }
  return { free: false, forgefx: false }
}

/**
 * Whether a process listening on the port is a device server THIS APP started.
 *
 * Force Quit leaves one behind: the app dies with SIGKILL, no quit handler
 * runs, and the server it spawned keeps the port. The next launch found it,
 * said "ForgeFX is already running", and quit — so the app could not be opened
 * again until the Mac was restarted. Reported in exactly those words.
 *
 * A stray of ours is safe to stop: nobody else is using it, by construction —
 * it is a child whose parent is gone. Somebody's own ForgeFX in a Terminal is
 * not ours to touch, so the command line has to say it came out of this app:
 * the server path inside a Fractal Remote bundle, or the wrapper this app
 * starts it through. Pure, so it can be tested with strings.
 */
export function isOurServer(command) {
  const c = String(command || '')
  if (!/forgefx\/server\/dist\/index\.js/.test(c)) return false
  return /Fractal Remote\.app\//.test(c) || /\/lib\/child\.cjs/.test(c)
}

/**
 * The processes listening on the port, with their command lines.
 *
 * `run` executes a command and returns its stdout; injected so this is
 * testable without lsof. lsof exits non-zero when nothing listens, which is an
 * answer rather than a failure. Never throws: a sweep that cannot look simply
 * finds nothing, and the caller falls back to the message it always showed.
 */
export function listeners({ port = DEFAULT_PORT, run }) {
  let out = ''
  try {
    out = run('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN', '-t']) || ''
  } catch {
    return []
  }
  const pids = [...new Set(out.split(/\s+/).map((x) => Number(x)).filter((n) => Number.isInteger(n) && n > 0))]
  return pids.map((pid) => {
    let command = ''
    try {
      command = (run('ps', ['-o', 'command=', '-p', String(pid)]) || '').trim()
    } catch {
      // A process that vanished between the two calls. Nothing to stop.
    }
    return { pid, command }
  })
}

/**
 * Take the port back from a device server this app left behind.
 *
 *   'none'      — nothing of ours is holding it
 *   'reclaimed' — it was, and it is gone now
 *   'failed'    — it was, and it would not go
 *
 * SIGTERM first and a moment to let it close the serial port cleanly, then
 * SIGKILL, then a moment more. Every wait has a deadline; the caller is the
 * app's startup and it must not hang there.
 */
export async function reclaimPort({
  port = DEFAULT_PORT,
  run,
  kill = (pid, signal) => process.kill(pid, signal),
  alive = (pid) => {
    try {
      process.kill(pid, 0)
      return true
    } catch {
      return false
    }
  },
  sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
  grace = 3000,
  step = 100
} = {}) {
  const ours = listeners({ port, run }).filter((p) => isOurServer(p.command))
  if (!ours.length) return 'none'
  const wait = async (pid) => {
    let waited = 0
    while (waited < grace && alive(pid)) {
      await sleep(step)
      waited += step
    }
    return !alive(pid)
  }
  let all = true
  for (const { pid } of ours) {
    try {
      kill(pid, 'SIGTERM')
      if (await wait(pid)) continue
      kill(pid, 'SIGKILL')
      if (!(await wait(pid))) all = false
    } catch {
      // Already gone between the look and the kill — that is the outcome we want.
      if (alive(pid)) all = false
    }
  }
  return all ? 'reclaimed' : 'failed'
}

/** What to say when the port is held by a ForgeFX we did not start. */
export const PORT_TAKEN = (port = DEFAULT_PORT) =>
  `ForgeFX is already running on this computer, on port ${port}.\n\n` +
  'This app carries its own copy and cannot share the unit with another one — two of\n' +
  'them cannot both hold the serial port. Quit the ForgeFX you have running (a Terminal\n' +
  'window, a Docker container, or another copy of this app) and open this again.'

/**
 * Publish the name, and hand back the way to stop.
 *
 * `Bonjour` is injected because this module has to stay importable without it
 * — the tests run in a container with no network worth advertising on, and the
 * two callers install it in different places.
 */
export function publish(
  Bonjour,
  { port = DEFAULT_PORT, name = DEFAULT_NAME, onError = () => {} } = {}
) {
  if (!Bonjour) return { stop: async () => {} }
  /*
   * The second argument is what bonjour-service does with a socket error, and
   * its default is `function (err) { throw err }` — thrown from inside a UDP
   * event handler, where nothing is waiting to catch it, so a network that goes
   * away underneath the advert takes the whole app down with it. Advertising a
   * name is the least important thing this app does; it may not be the thing
   * that decides whether it keeps running.
   */
  const bonjour = new Bonjour({}, onError)
  /*
   * The advert answers for its OWN name on the network, never for the Mac's.
   *
   * bonjour-service is a complete mDNS responder of its own, and without a
   * `host` it publishes the service at the machine's hostname — an A record
   * saying "Justins-MacBook-Pro.local is at this address", answered by this
   * app. macOS has a responder of its own for exactly that name, and it
   * checks, at every boot and wake, that nobody else on the network answers
   * for it. This app did. So the Mac concluded its name was taken, gave
   * itself a new one, and put a dialog on screen: "This computer's local
   * hostname is already in use on this network. The name has been changed to
   * Justins-MacBook-Pro-1019.local." Reported after every restart, and only
   * once this app had been running — 910, 958, 1019, counting up.
   *
   * Under its own name the advert answers for fractal-justins-macbook-pro
   * .local and nothing else, which is also the address the menu and the QR
   * code have been offering all along: until now nothing on the network
   * actually resolved it.
   */
  const ad = bonjour.publish({ name, type: 'http', port, host: `${name}.local` })
  return {
    ad,
    stop: () =>
      new Promise((done) => {
        try {
          ad.stop(() => {
            bonjour.destroy()
            done()
          })
        } catch {
          try {
            bonjour.destroy()
          } catch {
            // Nothing left to clean up.
          }
          done()
        }
      })
  }
}

/**
 * Running npm, on the one operating system where npm is not a program.
 *
 * On Windows `npm` is `npm.cmd`, a batch file — and Node will not spawn a batch
 * file directly. It used to. The fix for a command-injection flaw
 * (CVE-2024-27980) made it refuse instead, so `spawn('npm', …)` now fails with
 * EINVAL on every supported Node on Windows, and nowhere else. `npm run serve`
 * therefore died on its first line on a Windows machine and worked everywhere
 * it was ever tried.
 *
 * `shell: true` is the documented way through, and it is safe HERE because
 * every argument at these call sites is a literal in our own source — 'run',
 * 'build', 'dev'. It would not be safe for anything a person typed, so this is
 * deliberately a helper for spawning npm rather than a general one.
 *
 * A path with a space in it — `C:\Users\Justin Newbold\src` — stays safe
 * because the working directory travels in the spawn options, not on the
 * command line the shell parses.
 */
export function npmSpawn({ platform = process.platform } = {}) {
  return platform === 'win32' ? { shell: true } : {}
}

/** What to tell someone when ForgeFX cannot be found. One place, both callers. */
export const MISSING_FORGEFX =
  'Cannot find ForgeFX.\n\n' +
  'It is a separate project — the device server this app talks to — and it has to be\n' +
  'checked out somewhere. Clone it next to this one, or set FORGEFX_PATH:\n\n' +
  '  git clone https://github.com/sKuhLight/forgefx ~/src/forgefx\n' +
  '  git clone https://github.com/sKuhLight/forgefx-midi ~/src/forgefx-midi\n' +
  '  cd ~/src/forgefx-midi && npm install && npm run build\n' +
  '  cd ~/src/forgefx/server && npm install\n\n' +
  'Or run `npm run vendor:forgefx` from the repository root, which is what the\n' +
  'packaged apps are built with.\n'

/**
 * Stop serving, and actually stop.
 *
 * Quitting used to be able to fail in a way that left the app unquittable and
 * the Mac unable to open it again — which is what one person hit: close the
 * window, click the app, nothing; Force Quit and start over.
 *
 * Three things went wrong and they compound.
 *
 * The quit handler cancelled the quit, awaited the mDNS teardown and then asked
 * to quit again. If that await threw — and stopping an advert on a network that
 * has changed underneath you is exactly where it would — the second quit was
 * never asked for, so the app sat there refusing to close.
 *
 * The server was sent SIGINT and then abandoned. A child that ignores SIGINT
 * outlives the app holding port 5056, and the next launch finds a ForgeFX it
 * did not start, says so, and quits — so the app really cannot be opened again
 * until the stray process is killed. So: SIGINT, wait, and SIGKILL what is
 * still there.
 *
 * And the third, which is the one that came back: stopping the advert was
 * awaited with no deadline. Underneath `advert.stop()` is bonjour-service
 * sending a goodbye packet over multicast UDP and calling back when it has gone
 * out — so the app's ability to close depended on a network write completing.
 * On a Mac whose wifi has changed, or slept, or whose socket errored, that
 * callback simply never arrives, the promise never settles, `app.quit()` is
 * never reached, and there is no way out but Force Quit. Reported exactly that
 * way: "closing the app doesn't close it all the way."
 *
 * So nothing here waits on anything indefinitely. Every step has a deadline and
 * every deadline ends in the app closing.
 *
 * Every side effect is injected, which is the only reason this can be tested
 * from a machine with no Electron and no serial port.
 */
export async function shutdown({
  server = null,
  advert = null,
  kill = (proc, signal) => proc.kill(signal),
  alive = (proc) => proc.exitCode === null && proc.signalCode === null,
  sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
  grace = 2000,
  step = 100,
  adGrace = 1500
} = {}) {
  const report = { advert: 'none', server: 'none' }

  if (advert?.stop) {
    try {
      report.advert = await Promise.race([
        Promise.resolve(advert.stop()).then(() => 'stopped'),
        sleep(adGrace).then(() => 'gave up')
      ])
    } catch {
      // Never a reason to stay open. The advert dies with the process anyway.
      report.advert = 'failed'
    }
  }

  if (server) {
    try {
      if (!alive(server)) {
        report.server = 'already gone'
      } else {
        kill(server, 'SIGINT')
        let waited = 0
        while (waited < grace && alive(server)) {
          await sleep(step)
          waited += step
        }
        if (alive(server)) {
          // It had its chance. A server left holding the port is the thing that
          // stops the app opening next time.
          kill(server, 'SIGKILL')
          report.server = 'killed'
        } else {
          report.server = 'stopped'
        }
      }
    } catch {
      report.server = 'failed'
    }
  }

  return report
}

/**
 * Keeping the computer awake while a phone is using it.
 *
 * Laptops go to sleep by themselves when nobody touches them, and at a gig
 * nobody touches the laptop: the playing happens on the phone. A sleeping
 * laptop is a phone with no unit on the end of it, in the middle of a song.
 * So while a phone has used this computer in the last half hour, the app asks
 * the computer not to idle-sleep — Electron's
 * powerSaveBlocker.start('prevent-app-suspension') — and lets go half an hour
 * after the last use. Never 'prevent-display-sleep': the screen may go dark,
 * and on a laptop at a gig it should.
 *
 * A closed lid still sleeps on most laptops, and nothing an app asks for
 * changes that: it is the computer's own setting.
 *
 * HOW THE APP KNOWS A PHONE IS USING IT. The desktop shell never sees a
 * phone's requests: they go to the device server (ForgeFX, a separate
 * process), and nothing the shell can ask the device server says when it
 * last served one. So it looks two ways, once a minute:
 *
 *   - THE PHONE'S NOTE (readPhoneNote, phoneNoteChange). The phone app — what
 *     every customer plays from — never connects to this computer at all,
 *     wifi or not: everything it asks goes through the relay on the internet,
 *     and the relay's requests reach the device server from inside its own
 *     process, where nothing here can see them. So while its link is up, the
 *     phone writes a small note into the device server's store every couple
 *     of minutes (shared/phone-note.mjs), and the website does the same when a
 *     phone uses it through the account. A note that changed since the last
 *     look is a phone using the computer.
 *   - CONNECTIONS TO THE PORT (phonesUsing). A phone's web browser on the
 *     same wifi, on the computer's own page — the way to play with no
 *     internet — talks straight to the device server's port, and writes no
 *     note. So a connection to that port from another machine counts too.
 *     Connections from this machine (its own window, its own browser) do not.
 *
 * Neither sees a phone app older than 1.87.23, which writes no note; it only
 * takes that phone's next update.
 *
 * Everything here is a decision with its inputs handed in — the same trade
 * host.mjs makes — so it is tested from any machine. main.js does the asking
 * and the holding.
 */

/** How long after the last use a phone keeps the computer awake. */
export const AWAKE_FOR_MS = 30 * 60 * 1000
/** How often the app looks for phones. */
export const PHONE_LOOK_MS = 60 * 1000

/**
 * One address in one comparable spelling: lower case, no zone (%en0), an
 * IPv4 address carried inside IPv6 (::ffff:192.168.1.5) as the plain IPv4
 * one, and any other IPv6 address written out in full.
 */
export function plainAddress(host) {
  let h = String(host || '').trim().toLowerCase()
  if (h.startsWith('[') && h.endsWith(']')) h = h.slice(1, -1)
  h = h.replace(/%.*$/, '')
  if (!h.includes(':')) return h
  const full = fullV6(h)
  if (!full) return h
  if (full.slice(0, 5).every((g) => g === '0000') && full[5] === 'ffff') {
    return [full[6], full[7]].flatMap((g) => [parseInt(g.slice(0, 2), 16), parseInt(g.slice(2), 16)]).join('.')
  }
  return full.join(':')
}

/* An IPv6 address as its eight groups of four hex digits, or null when it is not one. */
function fullV6(h) {
  const halves = h.split('::')
  if (halves.length > 2) return null
  const groups = (part) => (part ? part.split(':') : [])
  const v4ToGroups = (list) => {
    const last = list.at(-1) || ''
    if (!/^\d+\.\d+\.\d+\.\d+$/.test(last)) return list
    const [a, b, c, d] = last.split('.').map(Number)
    return [...list.slice(0, -1), ((a << 8) | b).toString(16), ((c << 8) | d).toString(16)]
  }
  const left = halves.length === 2 ? groups(halves[0]) : v4ToGroups(groups(halves[0]))
  const right = halves.length === 2 ? v4ToGroups(groups(halves[1])) : []
  const fill = halves.length === 2 ? 8 - left.length - right.length : 0
  if (fill < 0 || left.length + right.length + fill !== 8) return null
  const all = [...left, ...Array(fill).fill('0'), ...right]
  if (!all.every((g) => /^[0-9a-f]{1,4}$/.test(g))) return null
  return all.map((g) => g.padStart(4, '0'))
}

/** Whether an address can only be this machine talking to itself, or nobody at all. */
export function isLoopback(host) {
  const h = plainAddress(host)
  return (
    h === '' ||
    h === '*' ||
    h === 'localhost' ||
    /^127\./.test(h) ||
    h === '0.0.0.0' ||
    h === '0000:0000:0000:0000:0000:0000:0000:0001' ||
    h === '0000:0000:0000:0000:0000:0000:0000:0000'
  )
}

/* "host.port" on a Mac, "host:port" or "[v6]:port" on Windows. */
function splitEndpoint(text, separator) {
  const at = text.lastIndexOf(separator)
  if (at <= 0) return null
  const port = Number(text.slice(at + 1))
  if (!Number.isInteger(port) || port <= 0) return null
  return { host: plainAddress(text.slice(0, at)), port }
}

/* /proc/net/tcp writes an IPv4 address as one little-endian word, and IPv6 as four. */
function procAddress(hex) {
  const word = (w) => [w.slice(6, 8), w.slice(4, 6), w.slice(2, 4), w.slice(0, 2)].map((b) => parseInt(b, 16))
  if (hex.length === 8) return word(hex).join('.')
  if (hex.length !== 32) return null
  const bytes = [0, 8, 16, 24].flatMap((i) => word(hex.slice(i, i + 8)))
  const groups = []
  for (let i = 0; i < 16; i += 2) groups.push(((bytes[i] << 8) | bytes[i + 1]).toString(16))
  return plainAddress(groups.join(':'))
}

/**
 * The computer's TCP connections, from what its own tools print:
 *
 *   linux   the text of /proc/net/tcp and /proc/net/tcp6 (no tool needed)
 *   darwin  `netstat -an -p tcp`
 *   win32   `netstat -an`
 *
 * → [{ local: { host, port }, remote: { host, port } }]. A listening socket
 * has no remote end and is left out. Never throws; text it cannot read is
 * no connections.
 *
 * The state column is not read: Windows prints it in the computer's own
 * language, and every state but listening — open, or closed in the last
 * minute or two — means a phone was there.
 */
export function readConnections({ platform, text = '' } = {}) {
  const out = []
  for (const raw of String(text).split('\n')) {
    const cols = raw.trim().split(/\s+/)
    let local = null
    let remote = null
    if (platform === 'linux') {
      if (!/^\d+:$/.test(cols[0] || '')) continue
      const [la, lp] = String(cols[1] || '').split(':')
      const [ra, rp] = String(cols[2] || '').split(':')
      if (!la || !lp || !ra || !rp) continue
      local = { host: procAddress(la), port: parseInt(lp, 16) }
      remote = { host: procAddress(ra), port: parseInt(rp, 16) }
    } else if (platform === 'darwin') {
      if (!/^tcp/i.test(cols[0] || '')) continue
      local = splitEndpoint(cols[3] || '', '.')
      remote = splitEndpoint(cols[4] || '', '.')
    } else if (platform === 'win32') {
      if (!/^tcp/i.test(cols[0] || '')) continue
      local = splitEndpoint(cols[1] || '', ':')
      remote = splitEndpoint(cols[2] || '', ':')
    } else {
      continue
    }
    if (!local?.host || !remote?.host || !remote.port) continue
    out.push({ local, remote })
  }
  return out
}

/**
 * The machines talking to the device server's port that are not this one:
 * a Set of their addresses. `own` is every address this computer has (from
 * os.networkInterfaces()), so a browser on this computer opening its own
 * wifi address is not taken for a phone.
 */
export function phonesOn({ connections = [], port, own = [] } = {}) {
  const mine = new Set(own.map(plainAddress))
  const seen = new Set()
  for (const { local, remote } of connections) {
    if (local.port !== port) continue
    if (isLoopback(remote.host) || mine.has(remote.host)) continue
    seen.add(remote.host)
  }
  return seen
}

/** Every address this computer has, from os.networkInterfaces()'s answer. */
export function ownAddresses(interfaces = {}) {
  return Object.values(interfaces || {})
    .flat()
    .map((i) => i?.address)
    .filter((a) => typeof a === 'string' && a)
}

/**
 * Look once: the phones using the device server's port right now, or null
 * when the computer would not say. Never throws.
 *
 * `run(cmd, args)` resolves to what the command printed; `read(path)` returns
 * a file's text. Both injected, so this is tested without a network.
 */
export async function phonesUsing({ platform, port, run, read, own = [] } = {}) {
  try {
    let text = ''
    if (platform === 'linux') {
      for (const path of ['/proc/net/tcp', '/proc/net/tcp6']) {
        try {
          text += `${read(path)}\n`
        } catch {
          // A computer with no IPv6 has no tcp6.
        }
      }
      if (!text.trim()) return null
    } else if (platform === 'darwin') {
      text = await run('netstat', ['-an', '-p', 'tcp'])
    } else if (platform === 'win32') {
      text = await run('netstat', ['-an'])
    } else {
      return null
    }
    return phonesOn({ connections: readConnections({ platform, text }), port, own })
  } catch {
    return null
  }
}

/**
 * The note a connected phone leaves in the device server's store: its name
 * there. The phone and the website take it from shared/phone-note.mjs, which
 * this app does not carry, so it is written out here and a test holds the two
 * together.
 */
export const PHONE_NOTE_ID = 'phone.seen'

/**
 * Read one document of the device server's store on this computer (its
 * `config` collection), by name.
 *
 *   the document   — { data, rev, updatedAt, … }, as the store keeps it
 *   null           — there is none
 *   undefined      — the device server could not be asked (not up yet,
 *                    restarting, too slow); nothing is known either way
 *
 * Never throws. `fetch` is handed in, so this is tested without a server.
 */
export async function readConfigDoc({ port, id, fetch, timeoutMs = 4000 } = {}) {
  if (!port || !id || typeof fetch !== 'function') return undefined
  try {
    const res = await fetch(`http://localhost:${port}/store/config/${encodeURIComponent(id)}`, {
      signal: AbortSignal.timeout(timeoutMs)
    })
    if (res?.status === 404) return null
    if (!res?.ok) return undefined
    const doc = await res.json()
    return doc && typeof doc === 'object' ? doc : undefined
  } catch {
    return undefined
  }
}

/** Read the phone's note from the device server on this computer: readConfigDoc, for PHONE_NOTE_ID. */
export const readPhoneNote = ({ port, fetch, timeoutMs = 4000 } = {}) => readConfigDoc({ port, id: PHONE_NOTE_ID, fetch, timeoutMs })

/**
 * Whether the note changed since the last look, which is a phone saying it is
 * using this computer: { used, mark }, where `mark` is what to hand in next
 * time.
 *
 * Values compared, never clocks. The store counts every write (`rev`) and
 * stamps it with this computer's time (`updatedAt`), and the note itself
 * carries the phone's: any of them moving is a new write, and none of them is
 * ever read as a time. So a phone whose clock is wrong, or a computer whose
 * clock jumps, changes nothing.
 *
 * The first look only learns the mark (`mark` undefined): a note already
 * there could have been written days ago. The phone writes again within a
 * couple of minutes, and that one counts. A look that could not ask
 * (`doc` undefined) keeps the mark it had.
 */
export function phoneNoteChange(mark, doc) {
  if (doc === undefined) return { used: false, mark }
  const next = doc === null ? null : JSON.stringify([doc.rev ?? null, doc.updatedAt ?? null, doc.data ?? null])
  return { used: mark !== undefined && next !== null && next !== mark, mark: next }
}

/**
 * What to do about staying awake now:
 *
 *   'start' — a phone used the computer in the last AWAKE_FOR_MS, and the
 *             computer is not yet being kept awake
 *   'stop'  — it is being kept awake, and no phone has used it for that long
 *   null    — nothing to change
 *
 * `lastPhoneAt` and `now` are on a clock that only goes forward (main.js's
 * uptime), so a time of day that jumps cannot keep a computer awake or let
 * it sleep early.
 */
export function awakeChange({ holding = false, lastPhoneAt = null, now = 0, forMs = AWAKE_FOR_MS } = {}) {
  const recent = lastPhoneAt !== null && now - lastPhoneAt >= 0 && now - lastPhoneAt < forMs
  if (recent && !holding) return 'start'
  if (!recent && holding) return 'stop'
  return null
}

/*
 * ANOTHER PROGRAM ON THIS COMPUTER USING THE DEVICE SERVER — Axiom, say.
 *
 * Axiom runs in a browser on the same Pi, against http://localhost:<port>
 * (lib/axiom.mjs), so it is this machine talking to itself and phonesUsing
 * leaves it out on purpose. For the update that goes in by itself
 * (unattendedInstall in lib/autostart.mjs) it counts: somebody is driving
 * the unit from it. Read from /proc/net/tcp and tcp6 (Linux only, which is
 * the only place that update runs): an open connection (state 01) from this
 * machine (a loopback address, or one of its own) TO the device server's
 * port, whose socket is not one of this app's own processes'. The window's
 * page is the app's own (Electron's processes), and so are main.js's own
 * calls; the device server's side of every connection is on the port, not
 * to it.
 *
 *   a number — how many such connections there are now
 *   null     — the text could not be read
 */
export function otherLocalClients({ tcpText = '', port, ownInodes = new Set(), own = [] } = {}) {
  if (typeof tcpText !== 'string' || !tcpText.trim() || !port) return null
  const mine = new Set(own.map(plainAddress))
  let count = 0
  for (const raw of tcpText.split('\n')) {
    const cols = raw.trim().split(/\s+/)
    if (!/^\d+:$/.test(cols[0] || '')) continue
    if (cols[3] !== '01') continue
    const [la] = String(cols[1] || '').split(':')
    const [ra, rp] = String(cols[2] || '').split(':')
    if (!la || !ra || !rp) continue
    if (parseInt(rp, 16) !== port) continue
    const local = procAddress(la)
    if (!local || !(isLoopback(local) || mine.has(local))) continue
    const inode = String(cols[9] || '')
    if (!/^\d+$/.test(inode) || inode === '0' || ownInodes.has(inode)) continue
    count++
  }
  return count
}

/**
 * The sockets this app's own processes hold: every N of a socket:[N] link
 * under /proc/<pid>/fd, as strings, for the pids given (the app itself, its
 * device server, and Electron's other processes, the window's among them).
 *
 * null when a process's list cannot be read: nothing is known, so the look
 * is not complete. A single link that has gone between the list and the read
 * is skipped: that file is closed, and a closed socket is no connection.
 */
export function ownSocketInodes({ pids = [], readdir, readlink } = {}) {
  try {
    const seen = new Set()
    for (const pid of pids) {
      const dir = `/proc/${pid}/fd`
      for (const fd of readdir(dir)) {
        let target
        try {
          target = String(readlink(`${dir}/${fd}`))
        } catch {
          continue
        }
        const m = /^socket:\[(\d+)\]$/.exec(target)
        if (m) seen.add(m[1])
      }
    }
    return seen
  } catch {
    return null
  }
}

/**
 * Whether something the device server says is somebody using the unit.
 *
 * A scene picked (from the phone or the unit's own footswitches), a preset or
 * its grid changed, a knob moved, the tuner: true. What a unit says with
 * nobody touching it (its meters, its tempo, its processor load, the cable's
 * traffic, a setting of the server's own, a broadcast) is not: counted, a
 * unit left on would never be quiet, and nothing would ever go in.
 */
export function unitUse(event) {
  const type = event?.type
  if (type === 'scene' || type === 'param' || type === 'tuner') return true
  if (type === 'changed') return event.scope === 'preset' || event.scope === 'grid'
  return false
}

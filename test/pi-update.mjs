/**
 * A RASPBERRY PI PUTS IN ITS OWN UPDATES (computer app 1.92.0).
 *
 * "I will update the pis but we need to figure out how to have them auto
 * update" (Justin, 16 November 2026). Until this, a Pi took a waiting update
 * only in the first three minutes after it was switched on, and a Pi left on
 * never updated at all. Now a Pi puts one in once nobody has used it for half
 * an hour (six signs: a phone's note, a phone's browser on the Wi-Fi, the
 * window touched, the unit changed, another program on the Pi, a wake), and
 * only a release that has been out a day, except on a computer signed in to
 * the owner's own account, which goes first.
 *
 * Every case says the mistake it would catch. The rules are pure
 * (desktop/lib/autostart.mjs, awake.mjs, updates.mjs, host.mjs), and
 * desktop/main.js, which only wires them, is run for real with Electron, the
 * disk, the clock and the timers stood in (loadDesktopMain in test/run.mjs).
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { posix as posixPath } from 'node:path'

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
/*
 * The stood-in disk is keyed the Linux way ('/userdata/pending-update.json'),
 * so the app is handed Linux path rules whatever computer runs the tests. On
 * GitHub's Windows job main.js joined that note's path with backslashes, the
 * stood-in disk never had it, and the two tests that read the note off the
 * disk failed there and nowhere else.
 */
const LINUX_PATHS = { 'node:path': posixPath }
const MIN = 60 * 1000
const HOUR = 60 * MIN

export function run(test, { loadDesktopMain, ticks }) {
  /* ------------------------------------------------------------ the rules */

  test('a Pi puts a waiting update in at power-on only after three watched minutes of quiet', async () => {
    const autostart = await import('../desktop/lib/autostart.mjs')
    const pi = { platform: 'linux', arch: 'arm64', env: { APPIMAGE: '/home/pi/Fractal-Remote-1.92.0-arm64.AppImage' }, lookComplete: true }
    assert.equal(autostart.POWER_ON_QUIET_MS, 3 * MIN)
    assert.equal(autostart.POWER_ON_WINDOW_MS, 6 * MIN)
    const soon = autostart.unattendedInstall({ ...pi, sinceLaunchMs: 2 * MIN, quietMs: 2 * MIN })
    assert.equal(soon.install, false, 'a Pi restarts itself before a phone that joins in its first minutes has been seen')
    assert.match(soon.why, /watching a few minutes/)
    assert.deepEqual(autostart.unattendedInstall({ ...pi, sinceLaunchMs: 4 * MIN, quietMs: 3 * MIN }), { install: true, how: 'power-on' }, 'a Pi switched on with an update waiting never puts it in')
    assert.equal(autostart.unattendedInstall({ ...pi, sinceLaunchMs: 4 * MIN, quietMs: 3 * MIN - 1 }).install, false)
    /* Used this run: not at power-on, whatever the quiet. */
    assert.equal(autostart.unattendedInstall({ ...pi, sinceLaunchMs: 4 * MIN, quietMs: 3 * MIN, everUsed: true }).install, false, 'a Pi restarts itself at power-on with somebody playing through it')
    /*
     * After the window, a box that does not put its own updates in (an ARM
     * laptop: pedalboardBox, not selfUpdatingBox) waits for the next
     * power-on or a quit.
     */
    const late = autostart.unattendedInstall({ ...pi, sinceLaunchMs: 6 * MIN + 1, quietMs: 3 * MIN, selfUpdating: false })
    assert.equal(late.install, false, 'an ARM laptop restarts itself long after power-on')
    assert.match(late.why, /next power-on, or when the app quits/)
    assert.equal(autostart.unattendedInstall({ ...pi, sinceLaunchMs: 6 * MIN, quietMs: 3 * MIN }).install, true, 'the window after power-on is shorter than six minutes')
  })

  test('a Pi left on puts an update in once nobody has used it for half an hour, a day after the release', async () => {
    const autostart = await import('../desktop/lib/autostart.mjs')
    const awake = await import('../desktop/lib/awake.mjs')
    const pi = { platform: 'linux', arch: 'arm64', env: { APPIMAGE: '/home/pi/x-arm64.AppImage' }, selfUpdating: true, lookComplete: true, sinceLaunchMs: 5 * HOUR, releaseSettled: true }
    /* One meaning of "nobody is here": the computer's own half hour before it may sleep. */
    assert.equal(autostart.IDLE_INSTALL_MS, awake.AWAKE_FOR_MS, 'nobody-is-here means two different things on one computer')
    assert.equal(autostart.IDLE_INSTALL_MS, 30 * MIN)
    assert.equal(autostart.unattendedInstall({ ...pi, quietMs: 30 * MIN - 1000 }).install, false, 'a Pi restarts itself under somebody who played 29 minutes and 59 seconds ago')
    assert.match(autostart.unattendedInstall({ ...pi, quietMs: 30 * MIN - 1000 }).why, /last half hour/)
    assert.deepEqual(autostart.unattendedInstall({ ...pi, quietMs: 30 * MIN }), { install: true, how: 'idle' }, 'a Pi left on never puts its update in')
    /* Used earlier in the run is not used now: half an hour of quiet is the whole test. */
    assert.deepEqual(autostart.unattendedInstall({ ...pi, quietMs: 30 * MIN, everUsed: true }), { install: true, how: 'idle' }, 'a Pi that was played once this run never puts its update in')
    const fresh = autostart.unattendedInstall({ ...pi, quietMs: 10 * HOUR, releaseSettled: false })
    assert.equal(fresh.install, false, 'a Pi takes a release before there was time to pull a bad one')
    assert.match(fresh.why, /waits a day/)
    assert.equal(autostart.RELEASE_SETTLE_MS, 24 * HOUR)
  })

  test('the day a release is held is counted from when GitHub published it, and a clock behind it holds', async () => {
    const updates = await import('../desktop/lib/updates.mjs')
    const at = Date.parse('2026-11-17T12:00:00Z')
    const published = '2026-11-17T12:00:00Z'
    assert.equal(updates.releaseSettled({ published, now: at + 25 * HOUR }), true, 'a release out 25 hours is still held')
    assert.equal(updates.releaseSettled({ published, now: at + 23 * HOUR }), false, 'a release out 23 hours is let in')
    assert.equal(updates.releaseSettled({ published, now: at + 24 * HOUR }), true)
    /* A Pi whose clock is behind (no network yet to set it) reads a release from its future: held, never let in. */
    assert.equal(updates.releaseSettled({ published, now: at - 7 * 24 * HOUR }), false, 'a Pi with its clock a week behind takes a release the moment it comes out')
    for (const bad of [undefined, null, '', 'yesterday', 12]) assert.equal(updates.releaseSettled({ published: bad, now: at + 100 * HOUR }), false, `an unknown release time (${bad}) is let in`)
    assert.equal(updates.releaseSettled({ published, now: NaN }), false)
    /* And the API answer carries it. */
    const release = { tag_name: 'v1.92.2', html_url: 'https://github.com/justinnewbold/fractal-remote/releases/tag/v1.92.2', published_at: published, assets: [{ name: 'latest-linux-arm64.yml' }, { name: 'Fractal-Remote-1.92.2-arm64.AppImage' }] }
    assert.deepEqual(updates.releaseVerdict(release, '1.92.1', { platform: 'linux', arch: 'arm64', appImage: true }), {
      kind: 'newer',
      version: '1.92.2',
      feed: 'https://github.com/justinnewbold/fractal-remote/releases/download/v1.92.2',
      published
    })
    assert.equal(updates.releaseVerdict({ ...release, prerelease: true }, '1.92.1', { platform: 'linux', arch: 'arm64', appImage: true }), null, 'a release held back as a pre-release is taken')
  })

  test('nothing is decided on a look that could not see everything, on any route', async () => {
    const autostart = await import('../desktop/lib/autostart.mjs')
    const env = { APPIMAGE: '/home/pi/x-arm64.AppImage' }
    /*
     * Changed on purpose, 17 November 2026: a Mac started hidden was a route
     * here. It is not any more: a Mac and a Windows PC keep the rule they had
     * before 1.92.0 (startupInstall), which never needed a look, since an
     * independent read found the watched quiet restarting a Mac four to six
     * minutes after login. Their rule has its own test below.
     */
    const routes = [
      { platform: 'linux', arch: 'arm64', env, sinceLaunchMs: 4 * MIN, quietMs: 3 * MIN },
      { platform: 'linux', arch: 'arm64', env, selfUpdating: true, sinceLaunchMs: 5 * HOUR, quietMs: 10 * HOUR, releaseSettled: true },
      { platform: 'linux', arch: 'x64', hidden: true, env, sinceLaunchMs: 4 * MIN, quietMs: 3 * MIN },
      { platform: 'linux', arch: 'arm64', env, selfUpdating: true, ownerBox: true, sinceLaunchMs: 5 * HOUR, quietMs: 10 * HOUR }
    ]
    for (const route of routes) {
      assert.equal(autostart.unattendedInstall({ ...route, lookComplete: true }).install, true, 'the case itself does not install')
      const blind = autostart.unattendedInstall({ ...route, lookComplete: false })
      assert.equal(blind.install, false, `an install is decided on a look that could not see everything (${route.platform}${route.selfUpdating ? ', idle' : ', power-on'})`)
      assert.match(blind.why, /could not see everything/)
    }
  })

  test('the quiet is counted from the latest of the first full look and every sign of use', async () => {
    const { quietFor } = await import('../desktop/lib/autostart.mjs')
    const now = 100 * MIN
    assert.equal(quietFor({ now, firstLookAt: null, uses: [] }), 0, 'quiet is counted before anything has been seen')
    assert.equal(quietFor({ now, firstLookAt: 1 * MIN, uses: [null, null] }), 99 * MIN)
    assert.equal(quietFor({ now, firstLookAt: 1 * MIN, uses: [now - 45 * MIN, now - 5 * MIN, null] }), 5 * MIN, 'an older use counts over a newer one')
    // Each of the signs, alone.
    for (let i = 0; i < 6; i++) {
      const uses = [null, null, null, null, null, null]
      uses[i] = now - 7 * MIN
      assert.equal(quietFor({ now, firstLookAt: 1 * MIN, uses }), 7 * MIN, `sign ${i} is not counted`)
    }
    assert.equal(quietFor({ now, firstLookAt: now - 2 * MIN, uses: [now - 50 * MIN] }), 2 * MIN, 'the quiet runs from before anything was looked at')
  })

  test('a Mac, a Windows PC, an ARM laptop and the .deb never put an update in by themselves', async () => {
    const autostart = await import('../desktop/lib/autostart.mjs')
    const updates = await import('../desktop/lib/updates.mjs')
    const ready = { kind: 'ready', version: '1.92.2' }
    // A Mac or a PC started hidden (or brought back hidden after an install), nothing used for ten hours.
    for (const [platform, arch] of [['darwin', 'arm64'], ['win32', 'x64']]) {
      const selfUpdating = autostart.selfUpdatingBox({ platform, env: { APPIMAGE: '/x.AppImage' }, model: 'Raspberry Pi 5', startedHidden: true, windowShown: false })
      assert.equal(selfUpdating, false, `a ${platform} computer puts its own updates in`)
      const verdict = autostart.unattendedInstall({ hidden: true, platform, arch, env: {}, selfUpdating, sinceLaunchMs: 10 * HOUR, quietMs: 10 * HOUR, lookComplete: true, releaseSettled: true })
      assert.equal(verdict.install, false, `a ${platform} computer restarts itself after the power-on window`)
      assert.equal(updates.updateNote(ready, { selfUpdating }).canNow, false, `a phone is offered Update now on a ${platform} computer`)
      const asked = updates.updateAsk({ doc: { rev: 2, data: { host: 'Studio', version: '1.92.2', account: 'a', at: 5 } }, mark: 'x', ownName: 'Studio', accountId: 'a', update: ready, selfUpdating })
      assert.deepEqual([asked.act, asked.why], ['refuse', 'attended'], `a phone can restart a ${platform} computer somebody may be sitting at`)
    }
    // A Linux ARM laptop, its window open: not a Pi by its board's name.
    assert.equal(autostart.selfUpdatingBox({ platform: 'linux', env: { APPIMAGE: '/x-arm64.AppImage' }, model: 'ASUS Chromebook Flip C101PA', startedHidden: false, windowShown: true }), false, 'an ARM laptop with somebody at it puts its own updates in')
    assert.equal(autostart.selfUpdatingBox({ platform: 'linux', env: { APPIMAGE: '/x-arm64.AppImage' }, model: '', startedHidden: false, windowShown: false }), false, 'any ARM board with no name is taken for a Pi')
    assert.equal(autostart.selfUpdatingBox({ platform: 'linux', env: { APPIMAGE: '/x-arm64.AppImage' }, model: 'Raspberry Pi 5 Model B Rev 1.0\u0000', windowShown: true }), true, 'a Pi with its window open (the guide’s way) never puts its own updates in')
    // A PC started with no window, until somebody opens it.
    const hiddenPc = { platform: 'linux', env: { APPIMAGE: '/x.AppImage' }, model: '', startedHidden: true }
    assert.equal(autostart.selfUpdatingBox({ ...hiddenPc, windowShown: false }), true, 'a box started with no window, nobody at it, never puts its own updates in')
    assert.equal(autostart.selfUpdatingBox({ ...hiddenPc, windowShown: true }), false, 'a PC whose window was opened from the tray restarts itself under the person who opened it')
    // The .deb: never, early or late, by any route.
    for (const [sinceLaunchMs, quietMs] of [[1 * MIN, 0], [4 * MIN, 3 * MIN], [5 * HOUR, 60 * MIN]]) {
      for (const hidden of [true, false]) {
        const deb = autostart.unattendedInstall({ hidden, platform: 'linux', arch: 'arm64', env: {}, selfUpdating: true, ownerBox: true, sinceLaunchMs, quietMs, lookComplete: true, releaseSettled: true })
        assert.equal(deb.install, false, 'a .deb update is started where nobody can type its password')
        assert.match(deb.why, /password/)
      }
    }
    assert.equal(autostart.selfUpdatingBox({ platform: 'linux', env: {}, model: 'Raspberry Pi 5', startedHidden: true }), false, 'the .deb puts its own updates in')
  })

  test('the owner’s own computers skip the day’s wait, so his Pis meet a new release first', async () => {
    const autostart = await import('../desktop/lib/autostart.mjs')
    const updates = await import('../desktop/lib/updates.mjs')
    const { ADMINS, isAdmin } = await import('../shared/admin.mjs')
    assert.deepEqual(updates.OWNER_ACCOUNTS, ADMINS, 'the computer app’s copy of the owner’s account is not shared/admin.mjs’s')
    for (const id of [ADMINS[0], ADMINS[0].toUpperCase(), ` ${ADMINS[0]} `, 'someone-else', '', null, undefined, '00000000-0000-0000-0000-000000000000']) {
      assert.equal(updates.isOwnerAccount(id), isAdmin(id), `the computer app reads ${id} differently from the phone`)
    }
    const at = Date.parse('2026-11-17T12:00:00Z')
    const settled = updates.releaseSettled({ published: '2026-11-17T11:00:00Z', now: at })
    assert.equal(settled, false, 'a release out one hour is settled')
    const pi = { platform: 'linux', arch: 'arm64', env: { APPIMAGE: '/x-arm64.AppImage' }, selfUpdating: true, lookComplete: true, sinceLaunchMs: 5 * HOUR, quietMs: 30 * MIN, releaseSettled: settled }
    assert.deepEqual(autostart.unattendedInstall({ ...pi, ownerBox: updates.isOwnerAccount(ADMINS[0]) }), { install: true, how: 'idle' }, 'the owner’s Pi waits the day like everybody else’s')
    const other = autostart.unattendedInstall({ ...pi, ownerBox: updates.isOwnerAccount('5a1c2c4e-0000-4000-8000-000000000001') })
    assert.equal(other.install, false, 'somebody else’s Pi skips the day’s wait')
    assert.match(other.why, /waits a day/)
    // Still half an hour of quiet, still never a Mac, still never the .deb.
    assert.equal(autostart.unattendedInstall({ ...pi, ownerBox: true, quietMs: 29 * MIN }).install, false, 'the owner’s Pi restarts itself mid-song')
    assert.equal(autostart.unattendedInstall({ ...pi, ownerBox: true, selfUpdating: false, arch: 'x64' }).install, false)
  })

  test('the safety restart after an install starts the AppImage’s new file once the old one has gone', async () => {
    const { relaunchPath } = await import('../desktop/lib/autostart.mjs')
    const old = '/home/pi/Fractal-Remote-1.92.1-arm64.AppImage'
    const fresh = '/home/pi/Fractal-Remote-1.92.2-arm64.AppImage'
    const on = (...paths) => (p) => paths.includes(p)
    assert.equal(relaunchPath({ appimage: old, movedTo: fresh, exists: on(old, fresh) }), old, 'the old file, still there, is passed over')
    assert.equal(relaunchPath({ appimage: old, movedTo: fresh, exists: on(fresh) }), fresh, 'the old file, gone, is restarted, and the Pi starts nothing')
    assert.equal(relaunchPath({ appimage: old, movedTo: null, exists: on() }), old)
    assert.equal(relaunchPath({ appimage: old, movedTo: fresh, exists: () => { throw new Error('EACCES') } }), old)
  })

  test('another program on the Pi using the device server is seen, and the app’s own window is not', async () => {
    const awake = await import('../desktop/lib/awake.mjs')
    const row = (n, local, remote, st, inode) => `  ${n}: ${local} ${remote} ${st} 00000000:00000000 00:00000000 00000000  1000        0 ${inode} 1 0000000000000000 20 4 30 10 -1`
    const tcp = [
      '  sl  local_address rem_address   st tx_queue rx_queue tr tm->when retrnsmt   uid  timeout inode',
      row(0, '00000000:13C0', '00000000:0000', '0A', 100), // the device server listening
      row(1, '0100007F:E000', '0100007F:13C0', '01', 111), // the app's own window, to the server
      row(2, '0100007F:13C0', '0100007F:E000', '01', 112), // the server's side of it
      row(3, '0100007F:E100', '0100007F:13C0', '01', 222), // Axiom's browser, to the server
      row(4, '0100007F:E200', '0100007F:13C0', '06', 0), // a closed one, waiting out its time
      row(5, '0100007F:E300', '0100007F:13C0', '08', 444), // a closing one, held by another program
      row(6, '0A01A8C0:13C0', '1701A8C0:D2F2', '01', 333) // a phone's browser on the Wi-Fi (the server's side)
    ].join('\n')
    const ownInodes = new Set(['111'])
    const own = ['192.168.1.10']
    assert.equal(awake.otherLocalClients({ tcpText: tcp, port: 5056, ownInodes, own }), 1, 'Axiom is missed, or the window, the phone or a closed connection is taken for another program')
    // From its own Wi-Fi address too, and over IPv6.
    const v6 = [
      '  sl  local_address                         remote_address                        st',
      `   0: 00000000000000000000000001000000:E400 00000000000000000000000001000000:13C0 01 00000000:00000000 00:00000000 00000000  1000 0 555 1`,
      `   1: 0000000000000000FFFF00000A01A8C0:E500 0000000000000000FFFF00000A01A8C0:13C0 01 00000000:00000000 00:00000000 00000000  1000 0 556 1`
    ].join('\n')
    assert.equal(awake.otherLocalClients({ tcpText: v6, port: 5056, ownInodes, own }), 2)
    assert.equal(awake.otherLocalClients({ tcpText: v6, port: 5057, ownInodes, own }), 0, 'a connection to another port is counted')
    assert.equal(awake.otherLocalClients({ tcpText: '', port: 5056, ownInodes, own }), null, 'nothing read is taken for nobody')
    assert.equal(awake.otherLocalClients({ tcpText: undefined, port: 5056, ownInodes, own }), null)
    // The app's own sockets, from /proc/<pid>/fd.
    const fds = { '/proc/1/fd': { 0: '/dev/null', 3: 'socket:[111]', 4: 'pipe:[9]', 9: 'gone' }, '/proc/2/fd': { 5: 'socket:[777]' } }
    const readdir = (p) => {
      if (!fds[p]) throw new Error('ENOENT')
      return Object.keys(fds[p])
    }
    const readlink = (p) => {
      const [, pid, fd] = /^\/proc\/(\d+)\/fd\/(\d+)$/.exec(p)
      if (fd === '9') throw new Error('ENOENT') // closed between the list and the read
      return fds[`/proc/${pid}/fd`][fd]
    }
    assert.deepEqual([...awake.ownSocketInodes({ pids: [1, 2], readdir, readlink })].sort(), ['111', '777'])
    assert.equal(awake.ownSocketInodes({ pids: [1, 3], readdir, readlink }), null, 'a process that cannot be read is taken for one with no sockets')
  })

  test('only the unit being played counts, never what it says by itself', async () => {
    const { unitUse } = await import('../desktop/lib/awake.mjs')
    for (const event of [{ type: 'scene', scene: 2 }, { type: 'changed', scope: 'preset' }, { type: 'changed', scope: 'grid' }, { type: 'param', id: 1 }, { type: 'tuner', note: 'E' }]) {
      assert.equal(unitUse(event), true, `${JSON.stringify(event)} is not somebody playing`)
    }
    for (const event of [{ type: 'meters' }, { type: 'tempo', bpm: 120 }, { type: 'cpu' }, { type: 'traffic' }, { type: 'config' }, { type: 'broadcast' }, { type: 'changed', scope: 'names' }, {}, null, undefined, 'scene']) {
      assert.equal(unitUse(event), false, `${JSON.stringify(event)} is taken for somebody playing, and a unit left on is never quiet`)
    }
  })

  test('a phone’s request is answered once, only by the computer it names, only from its own account', async () => {
    const updates = await import('../desktop/lib/updates.mjs')
    assert.equal(updates.HOST_UPDATE_ID, 'host.update')
    const ready = { kind: 'ready', version: '1.92.2' }
    const doc = (data, rev = 2) => ({ id: 'host.update', rev, updatedAt: 1000 + rev, data })
    const ask = { host: 'pedalboard', version: '1.92.2', account: 'acct-1', at: 77 }
    const base = { ownName: 'pedalboard', accountId: 'acct-1', update: ready, selfUpdating: true }
    // The first read of a run only learns what is there.
    const first = updates.updateAsk({ ...base, doc: doc(ask), mark: undefined })
    assert.equal(first.act, null, 'a request left in the store days ago restarts the Pi at its next start')
    assert.ok(first.mark)
    // A new one after it is acted on, once.
    const second = updates.updateAsk({ ...base, doc: doc(ask, 3), mark: first.mark })
    assert.deepEqual(second, { act: 'install', why: null, mark: second.mark, at: 77 })
    assert.equal(updates.updateAsk({ ...base, doc: doc(ask, 3), mark: second.mark }).act, null, 'the same request read twice installs twice')
    // Nothing could be read: nothing done, and the mark kept.
    assert.deepEqual(updates.updateAsk({ ...base, doc: undefined, mark: second.mark }), { act: null, mark: second.mark })
    // Not for this computer, or not from its account: no answer at all.
    for (const [data, why] of [
      [{ ...ask, host: undefined }, 'with no computer named'],
      [{ ...ask, host: '' }, 'with an empty computer name'],
      [{ ...ask, host: 'other-pi' }, 'for the other Pi'],
      [{ ...ask, account: undefined }, 'with no account'],
      [{ ...ask, account: 'acct-2' }, 'from another account'],
      [{ done: 77 }, 'that is the computer’s own clearing']
    ]) {
      assert.equal(updates.updateAsk({ ...base, doc: doc(data, 9), mark: 'before' }).act, null, `a request ${why} is answered`)
    }
    assert.equal(updates.updateAsk({ ...base, accountId: null, doc: doc(ask, 9), mark: 'before' }).act, null, 'a computer whose account is not known answers anybody')
    // Refused, in order, each for its own reason.
    const refused = (over, data = ask) => {
      const said = updates.updateAsk({ ...base, ...over, doc: doc(data, 9), mark: 'before' })
      return said.act === 'refuse' ? said.why : said.act
    }
    assert.equal(refused({}, { ...ask, version: '1.92.3' }), 'not-ready', 'a request for another version restarts the Pi')
    assert.equal(refused({ update: { kind: 'current', version: '1.92.2' } }), 'not-ready', 'a request that already worked fires again')
    assert.equal(refused({ update: null }), 'not-ready')
    assert.equal(refused({ stuck: true }), 'stuck', 'an install that did not take is tried again at a phone’s word')
    assert.equal(refused({ deb: true }), 'password', 'the .deb’s install is started where nobody can type its password')
    assert.equal(refused({ selfUpdating: false }), 'attended', 'a phone restarts a computer somebody may be sitting at')
    assert.equal(refused({ busy: 'screen' }), 'screen', 'a phone restarts the Pi under somebody at its screen')
    assert.equal(refused({ busy: 'busy' }), 'busy', 'a phone restarts the Pi while it is being played')
    assert.equal(refused({}), 'install')
    // Who is busy: the screen two minutes, the unit or another program two, a phone's browser five; never the phone's own note.
    const now = 100 * MIN
    assert.equal(updates.askBusy({ now }), null)
    assert.equal(updates.askBusy({ now, windowTouchedAt: now - 1 * MIN }), 'screen', 'somebody touched the screen a minute ago')
    assert.equal(updates.askBusy({ now, windowTouchedAt: now - 3 * MIN }), null)
    assert.equal(updates.askBusy({ now, unitActiveAt: now - 1 * MIN }), 'busy', 'the unit changed scene a minute ago')
    assert.equal(updates.askBusy({ now, unitActiveAt: now - 3 * MIN }), null)
    assert.equal(updates.askBusy({ now, otherLocalAt: now - 1 * MIN }), 'busy', 'Axiom used it a minute ago')
    assert.equal(updates.askBusy({ now, lanSeenAt: now - 4 * MIN }), 'busy', 'a phone’s browser on the Wi-Fi used it four minutes ago')
    assert.equal(updates.askBusy({ now, lanSeenAt: now - 6 * MIN }), null)
  })

  test('the phones are told how the update is going in exactly these words and no others', async () => {
    const updates = await import('../desktop/lib/updates.mjs')
    assert.equal(updates.updateNote(null), null)
    assert.equal(updates.updateNote({ kind: 'idle' }), null)
    const ready = { kind: 'ready', version: '1.92.2', published: '2026-11-17T12:00:00Z', line: 'x', error: 'y', detail: 'z' }
    assert.deepEqual(updates.updateNote(ready, { selfUpdating: true }), { kind: 'ready', version: '1.92.2', goesIn: 'idle', canNow: true }, 'a Pi’s ready update is not offered, or carries more than it should')
    assert.deepEqual(updates.updateNote(ready, {}), { kind: 'ready', version: '1.92.2', goesIn: 'quit', canNow: false }, 'a Mac is offered Update now')
    assert.deepEqual(updates.updateNote(ready, { deb: true }), { kind: 'ready', version: '1.92.2', goesIn: 'password', canNow: false })
    assert.deepEqual(updates.updateNote(ready, { selfUpdating: true, stuck: true }), { kind: 'ready', version: '1.92.2', goesIn: 'idle', canNow: false }, 'an install that did not take is offered again')
    for (const kind of ['found', 'downloading', 'staging']) assert.equal(updates.updateNote({ kind, version: '1.92.2', percent: 41.6 }).kind, 'downloading')
    assert.equal(updates.updateNote({ kind: 'downloading', percent: 41.6 }).percent, 42)
    for (const kind of ['checking', 'current', 'building', 'trouble', 'stuck', 'misplaced']) assert.equal(updates.updateNote({ kind, message: 'getaddrinfo ENOTFOUND api.github.com' }).kind, kind)
    // The answer to a request, carried and cut.
    const asked = updates.updateNote(ready, { selfUpdating: true, asked: { at: 77, result: 'busy' } })
    assert.deepEqual(asked.asked, { at: 77, result: 'busy' })
    assert.equal(updates.updateNote(ready, { asked: { at: 'soon', result: 'busy' } }).asked, undefined, 'an answer with no time is carried')
    assert.equal(updates.updateNote(ready, { asked: { at: 1, result: 'whatever the store said' } }).asked, undefined, 'an answer the phone does not know is carried')
    assert.equal(updates.updateNote({ kind: 'ready', version: '1.92.2-a-very-long-version-name' }).version.length, 20)
    // No key outside the list, whatever the state carries.
    const keys = new Set(['kind', 'version', 'percent', 'goesIn', 'canNow', 'asked'])
    for (const state of [ready, { kind: 'trouble', message: 'm', error: 'e', line: 'l' }, { kind: 'stuck', version: '1', detail: 'macOS said…' }, { kind: 'downloading', percent: 5, total: 9 }]) {
      for (const key of Object.keys(updates.updateNote(state, { selfUpdating: true, asked: { at: 1, result: 'installing' } }))) {
        assert.ok(keys.has(key), `the phones are told ${key}, which nobody decided they should be`)
      }
    }
  })

  test('the menu’s words are as they were, except a Pi’s ready line', async () => {
    const updates = await import('../desktop/lib/updates.mjs')
    const states = [
      { kind: 'checking' },
      { kind: 'found', version: '1.92.2' },
      { kind: 'found' },
      { kind: 'downloading', percent: 40 },
      { kind: 'staging', version: '1.92.2' },
      { kind: 'staging' },
      { kind: 'ready', version: '1.92.2' },
      { kind: 'ready' },
      { kind: 'current' },
      { kind: 'building', version: '1.92.2' },
      { kind: 'building' },
      { kind: 'trouble', message: 'offline' },
      { kind: 'trouble' },
      { kind: 'stuck', version: '1.92.2' },
      { kind: 'stuck' },
      { kind: 'misplaced' },
      null
    ]
    const before = [
      'Checking for updates…',
      'Downloading 1.92.2…',
      'Downloading an update…',
      'Downloading an update… 40%',
      'Preparing 1.92.2…',
      'Preparing the update…',
      'Update 1.92.2 installs when you quit',
      'Update installs when you quit',
      'Up to date',
      'Version 1.92.2 is still being built',
      'A new version is still being built',
      'Update problem: offline',
      "Couldn't check for updates",
      'Update 1.92.2 didn’t install',
      'The update didn’t install',
      'Move Fractal Remote to Applications to get updates',
      null
    ]
    assert.deepEqual(states.map((s) => updates.updateLine(s)), before, 'a line every computer said has changed')
    assert.deepEqual(states.map((s) => updates.updateLine(s, { selfUpdating: false, deb: true })), before)
    const pi = states.map((s) => updates.updateLine(s, { selfUpdating: true }))
    assert.equal(pi[6], 'Update 1.92.2 goes in when nobody is using it')
    assert.equal(pi[7], 'Update goes in when nobody is using it')
    assert.deepEqual(pi.filter((_, i) => i !== 6 && i !== 7), before.filter((_, i) => i !== 6 && i !== 7), 'a Pi’s other lines changed')
  })

  test('the phones read how the update is going beside the name, and the account’s id is kept', async () => {
    const host = await import('../desktop/lib/host.mjs')
    const calls = []
    const fetch = async (url, init = {}) => {
      calls.push(`${init.method || 'GET'} ${new URL(url).pathname} ${init.body || ''}`)
      return { ok: true, status: 200, json: async () => ({}) }
    }
    const note = { kind: 'ready', version: '1.92.2', goesIn: 'idle', canNow: true }
    assert.equal(await host.tellPhones({ port: 5056, fetch, hostname: 'pedalboard', version: '1.92.1', os: 'Raspberry Pi 5', update: note }), true)
    assert.equal(await host.tellPhones({ port: 5056, fetch, hostname: 'pedalboard', version: '1.92.1', os: 'Raspberry Pi 5' }), true)
    assert.deepEqual(calls, [
      `PUT /store/config/host.name {"data":{"name":"pedalboard","version":"1.92.1","os":"Raspberry Pi 5","update":${JSON.stringify(note)}},"origin":"fractal"}`,
      'PUT /store/config/host.name {"data":{"name":"pedalboard","version":"1.92.1","os":"Raspberry Pi 5"},"origin":"fractal"}'
    ], 'the update is written somewhere a phone does not read, or with nothing to say is written anyway, or the name moved')
    calls.length = 0
    await host.tellPhonesChecked({ port: 5056, fetch, hostname: 'pedalboard', version: '1.92.1', update: note })
    assert.match(calls[0], /"update":\{"kind":"ready"/, 'the checked write drops the update')
    // armHost keeps the account's id beside its address, when the device server says it.
    const unit = (user) => async (url, init = {}) => {
      const path = new URL(url).pathname
      const reply = (status, body) => ({ ok: status < 300, status, json: async () => body })
      if (path === '/healthz') return reply(200, { ok: true })
      if (path === '/cloud/status') return reply(200, { enabled: true, user })
      if (path === '/remote/status') return reply(200, { enabled: true, connected: true, state: 'joined' })
      return reply(200, {})
    }
    assert.deepEqual(await host.armHost({ port: 5056, fetch: unit({ id: 'acct-1', email: 'j@x.com' }), hostname: 'pedalboard', sleep: async () => {} }), { on: true, email: 'j@x.com', accountId: 'acct-1' }, 'the account’s id is thrown away')
    assert.deepEqual(await host.armHost({ port: 5056, fetch: unit({ email: 'j@x.com' }), hostname: 'pedalboard', sleep: async () => {} }), { on: true, email: 'j@x.com' })
    assert.equal(typeof host.deviceModel(), 'string')
  })

  /* ------------------------------------------------------ main.js, run */

  const PI_IMAGE = '/home/pi/Fractal-Remote-1.92.1-arm64.AppImage'
  const NEW_IMAGE = '/home/pi/Fractal-Remote-1.92.2-arm64.AppImage'
  const row = (n, local, remote, st, inode) => `  ${n}: ${local} ${remote} ${st} 00000000:00000000 00:00000000 00000000  1000        0 ${inode} 1`
  const HEAD = '  sl  local_address rem_address   st tx_queue rx_queue tr tm->when retrnsmt   uid  timeout inode'
  const LISTEN = row(0, '00000000:13C0', '00000000:0000', '0A', 100)
  const WINDOW = row(1, '0100007F:E000', '0100007F:13C0', '01', 111)
  const AXIOM = row(2, '0100007F:E100', '0100007F:13C0', '01', 222)
  const QUIET_TCP = [HEAD, LISTEN, WINDOW].join('\n')

  /**
   * A Pi's computer app, run: an update ready, its looks driven a minute at a
   * time on a stood-in clock. `outFor` is how long the release has been out.
   */
  async function piMain({ outFor = 25 * HOUR, account = '5a1c2c4e-0000-4000-8000-000000000001', model = 'Raspberry Pi 5 Model B Rev 1.0\u0000', arch = 'arm64', upFor = 2 * HOUR, argv = [], env = { APPIMAGE: PI_IMAGE }, files = {}, platform = 'linux', release = undefined, awakeOver = {}, links = { '/proc/4242/fd': { 0: 'pipe:[1]', 7: 'socket:[111]' } } } = {}) {
    const autostart = await import('../desktop/lib/autostart.mjs')
    const updates = await import('../desktop/lib/updates.mjs')
    const awake = await import('../desktop/lib/awake.mjs')
    const clock = { now: 1000 }
    const main = loadDesktopMain({ platform, arch, argv, env, clock, files: { '/proc/net/tcp': QUIET_TCP, ...files }, links, modules: LINUX_PATHS })
    /*
     * GitHub, as the app asks it (askGitHub): `github` is what it answers
     * about the held version's own release, { status, release } or 'offline';
     * every address asked is kept.
     */
    const state = { note: null, ask: null, installs: [], writes: [], streams: [], asked: [], github: release ?? { status: 200, release: { tag_name: 'v1.92.2', draft: false, prerelease: false } } }
    main.run('askGitHub = __given', async (url) => {
      state.asked.push({ url, at: clock.now })
      const answer = state.github
      if (answer === 'offline') throw new Error('getaddrinfo ENOTFOUND api.github.com')
      return { ok: answer.status < 300, status: answer.status, json: async () => answer.release }
    })
    main.run('boot = __given', autostart)
    main.run('updateRules = __given', updates)
    main.run('awakeRules = __given', {
      ...awake,
      readPhoneNote: async () => state.note,
      readConfigDoc: async ({ id }) => (id === updates.HOST_UPDATE_ID ? state.ask : undefined),
      ...awakeOver
    })
    main.run('hostAt = { port: 5056, name: "pedalboard" }; phoneName = "pedalboard"')
    main.run('computerModel = __given', model)
    main.run('accountId = __given', account)
    main.run('updates = __given', { check: async () => {}, install: () => state.installs.push(clock.now) })
    main.run('update = __given', { kind: 'ready', version: '1.92.2', published: new Date(Date.now() - outFor).toISOString() })
    main.run('askLocal = __given', async (url, init = {}) => {
      const path = new URL(url).pathname
      if (path === '/events') {
        let control
        const body = new ReadableStream({ start: (c) => void (control = c) })
        state.streams.push(control)
        return { ok: true, status: 200, body }
      }
      state.writes.push(`${init.method || 'GET'} ${path} ${init.body || ''}`)
      return { ok: true, status: 200, json: async () => ({}) }
    })
    clock.now += upFor
    /* The looks as start() starts them. */
    main.run('startWatching()')
    await ticks()
    const at = () => clock.now
    /* One look, a minute on. */
    const look = async (n = 1) => {
      for (let i = 0; i < n; i++) {
        clock.now += MIN
        main.run('phoneLook').fn()
        await ticks()
        await ticks()
      }
    }
    /* Looks until it installs, or `max` of them; the minute it went in, counted from the first look. */
    const start = clock.now
    const until = async (max = 90) => {
      for (let i = 0; i < max && state.installs.length === 0; i++) await look()
      await ticks()
      return state.installs.length ? Math.round((state.installs[0] - start) / MIN) : null
    }
    const event = (e) => state.streams.at(-1).enqueue(new TextEncoder().encode(`data: ${JSON.stringify(e)}\n\n`))
    return { main, clock, state, look, until, at, event, start }
  }

  test('a Pi left on puts its update in after half an hour of looks that saw nobody, exactly once', async () => {
    const pi = await piMain()
    assert.equal(pi.main.run('selfUpdating()'), true, 'a Pi is not taken for a computer that puts in its own updates')
    assert.equal(await pi.until(), 31, 'a Pi left on never puts its update in, or not after half an hour of quiet from its first full look')
    await pi.look(5)
    assert.equal(pi.state.installs.length, 1, 'the update was put in more than once')
    assert.ok(pi.main.logs.some((l) => l === '[updates] installing 1.92.2 now, nobody has used this computer for half an hour'))
    // The backstop is armed, and the copy comes back from the AppImage's file.
    const backstop = pi.main.timers.find((t) => t.ms === 20000)
    assert.ok(backstop, 'nothing starts the Pi again when the install does not take')
    backstop.fn()
    assert.deepEqual(pi.main.exits.slice(-2), [{ relaunch: { execPath: PI_IMAGE, args: [] } }, 'exit 0'])
  })

  test('the AppImage swap that took the old file away leaves the safety restart starting the new one', async () => {
    const pi = await piMain()
    pi.main.disk.set(NEW_IMAGE, 'new')
    pi.main.run('followTheAppImage(__given)', NEW_IMAGE)
    await pi.until()
    pi.main.timers.find((t) => t.ms === 20000).fn()
    assert.deepEqual(pi.main.exits.slice(-2), [{ relaunch: { execPath: NEW_IMAGE, args: [] } }, 'exit 0'], 'the safety restart starts a file the update deleted, and the Pi has no remote')
  })

  test('every sign of somebody playing starts the half hour again', async () => {
    const minute20 = async (what) => {
      const pi = await piMain()
      await pi.look(19)
      await what(pi)
      return pi.until()
    }
    const changed = (note) => ({ rev: note, updatedAt: note, data: { at: note } })
    // The phone app's note.
    assert.equal(
      await minute20(async (pi) => {
        pi.state.note = changed(1)
        await pi.look()
        pi.state.note = changed(2)
      }),
      51,
      'a phone that wrote its note at minute 20 is not counted'
    )
    // A scene changed on the unit.
    assert.equal(await minute20(async (pi) => pi.event({ type: 'scene', scene: 3 })), 49, 'a scene changed on the unit at minute 20 is not counted')
    // Tempo and meters are not anybody.
    assert.equal(await minute20(async (pi) => pi.event({ type: 'tempo', bpm: 120 })), 31, 'the unit’s own tempo is taken for somebody playing')
    // Another program on the Pi (Axiom) using the device server.
    assert.equal(
      await minute20(async (pi) => {
        pi.main.disk.set('/proc/net/tcp', [HEAD, LISTEN, WINDOW, AXIOM].join('\n'))
        await pi.look()
        pi.main.disk.set('/proc/net/tcp', QUIET_TCP)
      }),
      50,
      'Axiom using the unit at minute 20 is not counted'
    )
    // The window touched, from its own page.
    assert.equal(
      await minute20(async (pi) => {
        pi.main.run('where = { local: "http://localhost:5056", all: [] }; listenForTouches()')
        pi.main.heard['window:touched']({ senderFrame: { origin: 'http://localhost:5056' } })
      }),
      49,
      'somebody tapping the Pi’s screen at minute 20 is not counted'
    )
    // A wake.
    assert.equal(
      await minute20(async (pi) => {
        pi.main.run('noteWakes()')
        pi.main.power.resume.at(-1)()
      }),
      49,
      'a computer that woke at minute 20 is not counted'
    )
    // The unit's events dropped and joined again: nothing was heard in between.
    assert.equal(
      await minute20(async (pi) => {
        pi.state.streams.at(-1).close()
        await ticks()
        pi.main.run('unitRetry').fn()
        await ticks()
      }),
      49,
      'the time the unit’s events were not heard is counted as quiet'
    )
  })

  test('a touch from a page that is not the window’s own is not somebody at the screen', async () => {
    const pi = await piMain()
    pi.main.run('where = { local: "http://localhost:5056", all: [] }; listenForTouches()')
    await pi.look(19)
    for (const frame of [{ origin: 'https://evil.example' }, { origin: 'http://192.168.1.20:5056' }, null]) pi.main.heard['window:touched']({ senderFrame: frame })
    pi.main.heard['window:touched']({})
    assert.equal(pi.main.run('windowTouchedAt'), null, 'a page the window opened can hold a Pi’s updates off for ever')
    assert.equal(await pi.until(), 31)
  })

  test('a look that could not see everything holds the install, and so does a phone answering nothing', async () => {
    const pi = await piMain()
    pi.state.streams.at(-1).close()
    await ticks()
    assert.equal(pi.main.run('unitHeard'), false)
    assert.equal(await pi.until(40), null, 'a Pi restarts itself while it cannot hear the unit')
    const blind = await piMain()
    blind.state.note = undefined
    assert.equal(await blind.until(40), null, 'a Pi restarts itself while its device server does not answer')
  })

  test('the owner’s Pi takes a release out an hour, and nobody else’s does', async () => {
    const { ADMINS } = await import('../shared/admin.mjs')
    const his = await piMain({ outFor: 1 * HOUR, account: ADMINS[0] })
    assert.equal(await his.until(), 31, 'the owner’s Pi waits the day like everybody else’s')
    const theirs = await piMain({ outFor: 1 * HOUR })
    assert.equal(await theirs.until(60), null, 'somebody else’s Pi takes a release out an hour')
    assert.ok(theirs.main.logs.some((l) => /is ready; it waits a day after a new version comes out\./.test(l)))
    const signedOut = await piMain({ outFor: 1 * HOUR, account: null })
    assert.equal(await signedOut.until(60), null, 'a Pi nobody is signed in on skips the day')
  })

  test('a Pi just switched on puts a waiting update in after three watched minutes, and not once a phone has joined', async () => {
    const pi = await piMain({ upFor: 0 })
    assert.equal(await pi.until(10), 4, 'the update goes in before a phone that joins in the first minutes is seen, or not at power-on at all')
    assert.ok(pi.main.logs.some((l) => l === '[updates] installing 1.92.2 now, while nobody is playing'))
    const played = await piMain({ upFor: 0, outFor: 1 * HOUR })
    await played.look()
    played.event({ type: 'scene', scene: 2 })
    assert.equal(await played.until(40), null, 'a Pi restarts itself at power-on after somebody played, before the day is out')
  })

  test('on Linux the update turning ready is never the moment it goes in: only the end of a look', async () => {
    const pi = await piMain({ upFor: 0 })
    pi.main.run('update = null')
    await pi.look(10)
    pi.clock.now += 20 * MIN
    /* What the updater says, through the app's own handler for it (wireUpdates' onState). */
    pi.main.run('heardUpdate(__given)', { kind: 'ready', version: '1.92.2', published: new Date(Date.now() - 25 * HOUR).toISOString() })
    await ticks()
    assert.equal(pi.state.installs.length, 0, 'the update went in when it turned ready, on what the last look saw up to a minute ago')
    /*
     * Changed on purpose, 17 November 2026: this held that nothing but the
     * end of a look ever asks. A Mac and a Windows PC are asked again the
     * moment the update turns ready, as they were before 1.92.0 (their own
     * test is below); Linux still only at the end of a look.
     */
    const src = read('desktop/main.js')
    assert.match(src, /onState: heardUpdate,/, 'the updater is heard somewhere this test does not run')
    const heard = src.slice(src.indexOf('function heardUpdate(state) {'), src.indexOf('async function beginUpdates() {'))
    assert.match(heard, /if \(state\.kind === 'ready' && updateOutcome !== 'stuck' && \(process\.platform === 'darwin' \|\| process\.platform === 'win32'\)\) installIfUnattended\(\)/, 'a Pi decides its install when the update turns ready')
    assert.equal((src.match(/(?<!function )installIfUnattended\(\)/g) || []).length, 2, 'the install is decided somewhere other than the end of a look, or a Mac’s turning ready')
  })

  test('the reason it waits is said once, and again only when it changes', async () => {
    const pi = await piMain()
    await pi.look(10)
    const said = () => pi.main.logs.filter((l) => l.startsWith('[updates] 1.92.2 is ready;'))
    assert.deepEqual(said(), ['[updates] 1.92.2 is ready; somebody used it in the last half hour, so it waits.'], 'the same reason is written to the SD card every minute')
    pi.state.note = undefined
    await pi.look(3)
    pi.state.note = null
    await pi.look(3)
    assert.equal(said().length, 3, 'a change of reason is not said, or said every look')
  })

  test('an install that did not take is never tried again in that run, from a look or a phone', async () => {
    // Run N: it goes in, and the safety restart brings it back on the same version.
    const n = await piMain()
    assert.equal(await n.until(), 31)
    const marker = JSON.parse(n.main.disk.get('/userdata/pending-update.json'))
    assert.equal(marker.version, '1.92.2', 'nothing is left for the next start to tell whether the install took')
    // Run N+1: the marker says newer than it is running, so it reads stuck (installOutcome), says so, and does nothing by itself.
    const updates = await import('../desktop/lib/updates.mjs')
    assert.equal(updates.installOutcome({ marker, version: '1.92.1' }), 'stuck')
    const again = await piMain()
    again.main.run('updateOutcome = "stuck"')
    assert.equal(await again.until(120), null, 'an install that did not take is tried again and again')
    assert.equal(again.main.run('updateNoteNow()').canNow, false, 'a phone is offered an install that did not take')
    again.main.run('watchAsks()')
    again.state.ask = { rev: 1, data: { host: 'pedalboard', version: '1.92.2', account: '5a1c2c4e-0000-4000-8000-000000000001', at: 5 } }
    again.clock.now += MIN
    again.main.run('askLook').fn()
    await ticks()
    again.state.ask = { rev: 2, data: { host: 'pedalboard', version: '1.92.2', account: '5a1c2c4e-0000-4000-8000-000000000001', at: 6 } }
    again.clock.now += MIN
    again.main.run('askLook').fn()
    await ticks()
    assert.equal(again.state.installs.length, 0, 'a phone’s request restarts a Pi whose install did not take')
    assert.equal(again.main.run('asked').result, 'stuck')
    // Run N+2: no marker any more, so it tries again.
    const third = await piMain()
    assert.equal(await third.until(), 31)
    assert.match(read('desktop/main.js'), /const outcome = installOutcome\(\{ marker, version: app\.getVersion\(\) \}\)\s*\n\s*updateOutcome = outcome/, 'the looks do not know the last install did not take')
  })

  test('a phone’s Update now installs once, with the safety restart armed, and clears the request', async () => {
    const pi = await piMain({ outFor: 1 * HOUR })
    pi.main.run('watchAsks()')
    const askTick = async () => {
      const t = pi.main.run('askLook')
      assert.equal(t.ms, 10000, 'a request on a Pi with an update ready waits a minute to be read')
      pi.clock.now += 10000
      t.fn()
      await ticks()
      await ticks()
    }
    const from = (at, rev, over = {}) => ({ rev, updatedAt: rev, data: { host: 'pedalboard', version: '1.92.2', account: '5a1c2c4e-0000-4000-8000-000000000001', at, ...over } })
    // Already there when the app started: only learned.
    pi.state.ask = from(1, 1)
    await askTick()
    assert.equal(pi.state.installs.length, 0, 'a request left in the store restarts the Pi as soon as it starts')
    // Two new ones in a row: one install.
    pi.state.ask = from(2, 2)
    await askTick()
    pi.state.ask = from(3, 3)
    await askTick().catch(() => {})
    await ticks()
    assert.equal(pi.state.installs.length, 1, 'two requests installed twice')
    assert.deepEqual(pi.main.run('asked').result, 'installing')
    assert.ok(pi.state.writes.includes('PUT /store/config/host.update {"data":{"done":2},"origin":"fractal"}'), 'the request sits in the store, readable on the Wi-Fi, after it was acted on')
    assert.ok(pi.main.logs.includes('[updates] a phone asked; installing 1.92.2 now'))
    assert.ok(pi.main.timers.find((t) => t.ms === 20000), 'a phone’s install leaves a Pi with nothing running when it does not take')
    assert.equal(pi.main.run('installedUnattended'), true)
  })

  test('a phone’s Update now is refused while somebody is at the Pi, and the answer reaches the phones', async () => {
    const pi = await piMain()
    pi.main.run('watchAsks(); where = { local: "http://localhost:5056", all: [] }; listenForTouches()')
    const from = (at, rev) => ({ rev, updatedAt: rev, data: { host: 'pedalboard', version: '1.92.2', account: '5a1c2c4e-0000-4000-8000-000000000001', at } })
    const tick = async () => {
      pi.clock.now += 10000
      pi.main.run('askLook').fn()
      await ticks()
      await ticks()
    }
    pi.state.ask = from(1, 1)
    await tick()
    pi.main.heard['window:touched']({ senderFrame: { origin: 'http://localhost:5056' } })
    pi.state.ask = from(2, 2)
    await tick()
    assert.equal(pi.state.installs.length, 0, 'a phone restarts the Pi under somebody tapping its screen')
    assert.deepEqual(pi.main.run('updateNoteNow()').asked, { at: 2, result: 'screen' }, 'the phone is not told why')
    assert.ok(pi.state.writes.includes('PUT /store/config/host.update {"data":{"done":2},"origin":"fractal"}'))
    // The answer stays ten minutes, then goes from the phones' note.
    pi.clock.now += 10 * MIN
    assert.equal(pi.main.run('updateNoteNow()').asked, undefined, 'an old answer is told to the phones for ever')
    // Three minutes after the touch, it goes in.
    pi.state.ask = from(3, 3)
    await tick()
    assert.equal(pi.state.installs.length, 1, 'a phone’s request is refused long after the screen was touched')
  })

  test('the window’s Restart to update pressed twice installs once', async () => {
    const pi = await piMain()
    pi.main.run('where = { local: "http://localhost:5056", all: [] }; wireUpdateChannel()')
    const press = () => pi.main.handlers['updates:install']({ senderFrame: { origin: 'http://localhost:5056' } })
    const [a, b] = await Promise.all([press(), press()])
    await ticks()
    assert.equal(pi.state.installs.length, 1, 'the button pressed twice installed twice')
    assert.deepEqual([a.ok, b.ok].sort(), [false, true])
    assert.ok([a.reason, b.reason].includes('already'))
  })

  test('a Mac never puts an update in by itself, and a phone’s request is answered that it waits for a quit', async () => {
    const autostart = await import('../desktop/lib/autostart.mjs')
    const updates = await import('../desktop/lib/updates.mjs')
    const awake = await import('../desktop/lib/awake.mjs')
    const clock = { now: 1000 }
    const mac = loadDesktopMain({ platform: 'darwin', arch: 'arm64', argv: ['--hidden'], clock, modules: LINUX_PATHS })
    const installs = []
    mac.run('boot = __given', autostart)
    mac.run('updateRules = __given', updates)
    mac.run('awakeRules = __given', { ...awake, readPhoneNote: async () => null, phonesUsing: async () => new Set() })
    mac.run('hostAt = { port: 5056, name: "studio" }; phoneName = "studio"; accountId = "acct"; unitHeard = true')
    mac.run('updates = __given', { check: async () => {}, install: () => installs.push(1) })
    mac.run('update = __given', { kind: 'ready', version: '1.92.2', published: '2020-01-01T00:00:00Z' })
    clock.now += 10 * HOUR
    mac.run('watchForPhones()')
    for (let i = 0; i < 60; i++) {
      clock.now += MIN
      mac.run('phoneLook').fn()
      await ticks()
    }
    assert.equal(installs.length, 0, 'a Mac started hidden restarts itself ten hours on')
    assert.equal(mac.run('selfUpdating()'), false)
    assert.deepEqual(mac.run('updateNoteNow()'), { kind: 'ready', version: '1.92.2', goesIn: 'quit', canNow: false })
  })

  /* ------------------------------------- after an independent read (17 November 2026) */

  /** A phone's Update now, as the store would hand it in: written after the first read, and read. */
  const OWNER_OF_PI = '5a1c2c4e-0000-4000-8000-000000000001'
  async function phoneAsks(pi, at = 2) {
    const tick = async () => {
      pi.clock.now += 10000
      pi.main.run('askLook').fn()
      for (let i = 0; i < 4; i++) await ticks()
    }
    if (pi.main.run('askMark') === undefined) {
      pi.state.ask = { rev: 1, updatedAt: 1, data: { host: 'pedalboard', version: '1.92.2', account: OWNER_OF_PI, at: 1 } }
      await tick()
    }
    pi.state.ask = { rev: at, updatedAt: at, data: { host: 'pedalboard', version: '1.92.2', account: OWNER_OF_PI, at } }
    await tick()
    return pi.main.run('asked')
  }
  const tagOf = (url) => /\/releases\/tags\/v1\.92\.2$/.test(url)

  test('GitHub’s answer about the held release reads as there, pulled or unknown, and only the idle route waits on no answer', async () => {
    const updates = await import('../desktop/lib/updates.mjs')
    const v = '1.92.2'
    const out = { tag_name: 'v1.92.2', draft: false, prerelease: false }
    assert.equal(updates.heldStanding({ status: 200, release: out, version: v }), 'there')
    assert.equal(updates.heldStanding({ status: 200, release: { ...out, prerelease: true }, version: v }), 'pulled', 'a release marked a pre-release after the download still goes in')
    assert.equal(updates.heldStanding({ status: 200, release: { ...out, draft: true }, version: v }), 'pulled', 'a release put back to a draft still goes in')
    assert.equal(updates.heldStanding({ status: 404, release: null, version: v }), 'pulled', 'a deleted release still goes in')
    for (const status of [403, 429, 500, 502, undefined, 0]) assert.equal(updates.heldStanding({ status, release: null, version: v }), 'unknown', `GitHub saying ${status} is taken for an answer`)
    assert.equal(updates.heldStanding({ status: 200, release: { ...out, tag_name: 'v1.92.3' }, version: v }), 'unknown', 'another release’s answer is taken for the held one’s')
    assert.equal(updates.heldStanding({ status: 200, release: null, version: v }), 'unknown')
    // What goes ahead on each answer.
    for (const how of ['idle', 'power-on', 'phone']) {
      assert.equal(updates.heldGoes({ standing: 'there', how }), true)
      assert.equal(updates.heldGoes({ standing: 'pulled', how }), false, `a pulled release goes in by the ${how} route`)
    }
    assert.equal(updates.heldGoes({ standing: 'unknown', how: 'idle' }), false, 'a Pi left on puts a release in with GitHub unreachable')
    assert.equal(updates.heldGoes({ standing: 'unknown', how: 'power-on' }), true, 'a Pi switched on at a gig with no internet never takes its waiting update')
    assert.equal(updates.heldGoes({ standing: 'unknown', how: 'phone' }), true, 'a person’s request is refused for GitHub being down')
    // Once in ten minutes, whatever the answer.
    assert.equal(updates.HELD_LOOK_MS, 10 * MIN)
    assert.equal(updates.heldAskDue({ last: null, now: 5 }), true)
    assert.equal(updates.heldAskDue({ last: { at: 0 }, now: 10 * MIN - 1 }), false, 'GitHub is asked more than once in ten minutes')
    assert.equal(updates.heldAskDue({ last: { at: 0 }, now: 10 * MIN }), true)
    // The phones are not offered a pulled release, and are told it goes in at the computer.
    const ready = { kind: 'ready', version: '1.92.2' }
    assert.deepEqual(updates.updateNote(ready, { selfUpdating: true, pulled: true }), { kind: 'ready', version: '1.92.2', goesIn: 'quit', canNow: false }, 'a phone is offered a pulled release')
    const refused = updates.updateAsk({ doc: { rev: 2, data: { host: 'p', version: '1.92.2', account: 'a', at: 3 } }, mark: 'x', ownName: 'p', accountId: 'a', update: ready, selfUpdating: true, pulled: true })
    assert.deepEqual([refused.act, refused.why], ['refuse', 'pulled'])
    assert.deepEqual(updates.updateNote(ready, { selfUpdating: true, asked: { at: 3, result: 'pulled' } }).asked, { at: 3, result: 'pulled' }, 'the phones are not told why a request was refused')
  })

  test('a release pulled after a Pi downloaded it is never put in by itself, by any route, for the rest of the run', async () => {
    // Left on: GitHub says it is a pre-release now. The release's own tag is what is asked, and only once an install would go.
    const pi = await piMain()
    pi.state.github = { status: 200, release: { tag_name: 'v1.92.2', draft: false, prerelease: true } }
    /* What a person sees: the menu, an open window (recorded), and the phones (each tell counted). */
    const sent = []
    pi.main.run('win = __given', { isDestroyed: () => false, webContents: { send: (channel, payload) => sent.push({ channel, payload }) } })
    let tells = 0
    pi.main.run('tellNow = __given', async () => void tells++)
    pi.main.run('updateLine = __given', (await import('../desktop/lib/updates.mjs')).updateLine)
    pi.main.run('buildTray()')
    const menuLine = () => (pi.main.menus.at(-1) || []).find((item) => typeof item.label === 'string' && item.label.startsWith('Update 1.92.2'))?.label
    assert.equal(menuLine(), 'Update 1.92.2 goes in when nobody is using it', 'the case itself: a Pi’s menu does not say its update goes in by itself')
    pi.main.run('publish(update)')
    assert.equal(sent.at(-1).payload.goesIn, 'idle', 'the case itself: the window is not told a Pi’s update goes in by itself')
    await pi.look(30)
    assert.equal(pi.state.asked.length, 0, 'GitHub is asked before an install would go')
    const toldBefore = tells
    assert.equal(await pi.until(90), null, 'a release pulled after the download goes in on a Pi left on')
    assert.ok(pi.state.asked.length >= 1 && pi.state.asked.every((a) => tagOf(a.url)), `the held release is not what is asked: ${pi.state.asked.map((a) => a.url)}`)
    assert.equal(pi.main.logs.filter((l) => /1\.92\.2 has been pulled from GitHub/.test(l)).length, 1, 'finding it pulled is not said, or said more than once')
    assert.deepEqual(pi.main.run('updateNoteNow()'), { kind: 'ready', version: '1.92.2', goesIn: 'quit', canNow: false }, 'the phones are still offered a pulled release')
    assert.equal(pi.main.run('goesIn()'), 'quit', 'the window still says a pulled release goes in by itself')
    // And told, at once: the menu, the open window and the phones.
    assert.equal(menuLine(), 'Update 1.92.2 installs when you quit', 'the menu still says a pulled release goes in by itself')
    const told = sent.filter((m) => m.channel === 'updates:state').at(-1)?.payload
    assert.equal(told?.goesIn, 'quit', 'the open window is not told again that a pulled release no longer goes in by itself')
    assert.doesNotMatch(told.line, /nobody is using it/, 'the open window is told a pulled release goes in by itself')
    assert.equal(tells - toldBefore, 1, 'the phones are not told at once that the release was pulled')
    pi.main.run('win = null')
    // Remembered: GitHub says it is out again, and it is still not put in by itself, nor at a phone's word.
    pi.state.github = { status: 200, release: { tag_name: 'v1.92.2', draft: false, prerelease: false } }
    const asks = pi.state.asked.length
    assert.equal(await pi.until(60), null, 'a release found pulled goes in once GitHub answers otherwise')
    assert.equal(pi.state.asked.length, asks, 'a release found pulled is asked about again')
    pi.main.run('watchAsks()')
    assert.equal((await phoneAsks(pi)).result, 'pulled', 'a phone’s request puts a pulled release in')
    assert.equal(pi.state.installs.length, 0)
    // Gone altogether (404), at power-on.
    const gone = await piMain({ upFor: 0, release: { status: 404, release: null } })
    assert.equal(await gone.until(10), null, 'a deleted release goes in at power-on')
    // Put back to a draft, at a phone's word.
    const draft = await piMain({ outFor: 1 * HOUR, release: { status: 200, release: { tag_name: 'v1.92.2', draft: true, prerelease: false } } })
    draft.main.run('watchAsks()')
    assert.equal((await phoneAsks(draft)).result, 'pulled', 'a phone’s request puts a release in that went back to a draft')
    assert.equal(draft.state.installs.length, 0)
    assert.ok(draft.state.asked.every((a) => tagOf(a.url)))
    // Pressing Restart to update at the computer is a person's own choice, and still goes.
    pi.main.run('where = { local: "http://localhost:5056", all: [] }; wireUpdateChannel()')
    const pressed = await pi.main.handlers['updates:install']({ senderFrame: { origin: 'http://localhost:5056' } })
    assert.equal(pressed.ok, true, 'the person at the computer cannot put a pulled release in')
    assert.equal(pi.state.installs.length, 1)
  })

  test('a Pi holding the release before the newest still puts it in: its own release is asked about, never the latest', async () => {
    const pi = await piMain()
    // GitHub as it is on a busy day: 1.92.3 is the latest, and 1.92.2, held here, is still out.
    pi.main.run('askGitHub = __given', async (url) => {
      pi.state.asked.push({ url, at: pi.clock.now })
      const release = tagOf(url) ? { tag_name: 'v1.92.2', draft: false, prerelease: false } : { tag_name: 'v1.92.3', draft: false, prerelease: false }
      return { ok: true, status: 200, json: async () => release }
    })
    assert.equal(await pi.until(), 31, 'a Pi holding the release before the newest is stranded on it')
    assert.deepEqual(pi.state.asked.map((a) => tagOf(a.url)), [true], 'something other than the held release’s own is asked, or asked more than once')
    assert.match(pi.state.asked[0].url, /^https:\/\/api\.github\.com\/repos\/justinnewbold\/fractal-remote\/releases\/tags\/v1\.92\.2$/)
    const src = read('desktop/main.js')
    assert.match(src, /const releaseTagUrl = \(version\) => \([^\n]*LATEST_API_URL\.replace\(/, 'the held release is asked of another repository than the look for updates')
    assert.match(src, /const res = await askGitHub\(LATEST_API_URL\)/, 'the look for updates and the held release go two different ways to GitHub')
  })

  test('with no answer from GitHub a Pi left on waits, a Pi switched on and a phone’s request go on, and GitHub is asked at most every ten minutes', async () => {
    const pi = await piMain()
    pi.state.github = 'offline'
    assert.equal(await pi.until(60), null, 'a Pi left on puts a release in with GitHub unreachable')
    assert.ok(pi.main.logs.some((l) => /1\.92\.2 is ready; GitHub could not be asked whether it is still out, so it waits for a later look\./.test(l)))
    const at = pi.state.asked.map((a) => a.at)
    assert.ok(at.length >= 3 && at.length <= 4, `GitHub was asked ${at.length} times in 30 minutes`)
    for (let i = 1; i < at.length; i++) assert.ok(at[i] - at[i - 1] >= 10 * MIN, 'GitHub is asked more often than every ten minutes')
    // Back online: the next ask finds it out, within ten minutes, and it goes in.
    pi.state.github = { status: 200, release: { tag_name: 'v1.92.2', draft: false, prerelease: false } }
    const back = pi.clock.now
    await pi.until(12)
    assert.equal(pi.state.installs.length, 1, 'a Pi stays off the release for good after GitHub was down once')
    assert.ok(pi.state.installs[0] - back <= 10 * MIN)
    // Switched on at a gig with no internet: in at minute 4, as before.
    const gig = await piMain({ upFor: 0, release: 'offline' })
    assert.equal(await gig.until(10), 4, 'a Pi switched on with no internet never puts its waiting update in')
    // A phone's request, GitHub down: it goes in.
    const asked = await piMain({ outFor: 1 * HOUR, release: 'offline' })
    asked.main.run('watchAsks()')
    assert.equal((await phoneAsks(asked)).result, 'installing', 'a person’s request is refused because GitHub is down')
    await ticks()
    assert.equal(asked.state.installs.length, 1)
  })

  /* ------------------------------------- after a second independent read (17 November 2026) */

  /**
   * GitHub held: every ask about the held release waits until `answer` is
   * called (or, with `stall`, answers 200 and never sends its body), until
   * `free()` lets GitHub answer at once again with what state.github says.
   */
  function holdGitHub(pi, { stall = false } = {}) {
    const held = { waiting: [], on: true }
    pi.main.run('askGitHub = __given', async (url) => {
      pi.state.asked.push({ url, at: pi.clock.now })
      const now = () => {
        const answer = pi.state.github
        if (answer === 'offline') throw new Error('getaddrinfo ENOTFOUND api.github.com')
        return { ok: answer.status < 300, status: answer.status, json: async () => answer.release }
      }
      if (!held.on) return now()
      if (stall) return { ok: true, status: 200, json: () => new Promise(() => {}) }
      return new Promise((resolve) => held.waiting.push(() => resolve(now())))
    })
    held.answer = async () => {
      for (const go of held.waiting.splice(0)) go()
      for (let i = 0; i < 3; i++) await ticks()
    }
    held.free = () => void (held.on = false)
    /* The 15 seconds the ask may take, run out. */
    held.timeOut = async () => {
      const limit = pi.main.timers.filter((t) => t.ms === 15 * 1000).at(-1)
      assert.ok(limit, 'the ask about the held release has no time limit')
      limit.fn()
      for (let i = 0; i < 3; i++) await ticks()
    }
    return held
  }
  /** Looks until the ask about the held release is out and the install waits on it. */
  async function untilAsking(pi, max = 40) {
    for (let i = 0; i < max && !pi.main.run('heldWaiting'); i++) await pi.look()
    assert.equal(pi.main.run('heldWaiting'), true, 'no install ever waited on GitHub')
    return Math.round((pi.clock.now - pi.start) / MIN)
  }
  const OUT = { status: 200, release: { tag_name: 'v1.92.2', draft: false, prerelease: false } }

  /* Each arrival, on a Pi left on, at the half hour, while the ask is out: a test of its own. */
  const changedNote = (note) => ({ rev: note, updatedAt: note, data: { at: note } })
  const ARRIVALS = {
    'nobody (the case itself)': null,
    'a scene changed on the unit': async (pi) => {
      pi.event({ type: 'scene', scene: 3 })
      await ticks()
      assert.notEqual(pi.main.run('unitActiveAt'), null)
    },
    'the window touched': async (pi) => {
      pi.main.heard['window:touched']({ senderFrame: { origin: 'http://localhost:5056' } })
      assert.notEqual(pi.main.run('windowTouchedAt'), null)
    },
    'a phone seen': async (pi) => {
      pi.state.note = changedNote(1)
      await pi.look()
      pi.state.note = changedNote(2)
      await pi.look()
      assert.notEqual(pi.main.run('phoneSeenAt'), null)
    }
  }
  for (const [who, arrive] of Object.entries(ARRIVALS)) {
    test(`a Pi left on is never restarted under somebody who arrives while GitHub is asked: ${who}`, async () => {
      const pi = await piMain()
      pi.main.run('where = { local: "http://localhost:5056", all: [] }; listenForTouches()')
      const held = holdGitHub(pi)
      assert.equal(await untilAsking(pi), 31)
      if (!arrive) {
        await held.answer()
        assert.equal(pi.state.installs.length, 1, 'with nobody arriving, a release GitHub says is out does not go in')
        return
      }
      await arrive(pi)
      await held.answer()
      assert.equal(pi.state.installs.length, 0, `a Pi left on restarts under ${who} while GitHub was asked`)
      assert.equal(pi.main.run('heldWaiting'), false)
      assert.ok(pi.main.logs.some((l) => l === '[updates] 1.92.2 is ready; somebody used it in the last half hour, so it waits.'), `why it waits after ${who} is not said`)
      /* That line was logged in the first half hour too, so the reason kept AFTER the answer is asked as well (a third read, 17 November 2026). */
      assert.equal(pi.main.run('lastInstallWhy'), 'somebody used it in the last half hour, so it waits', `the reason kept after ${who} arrived is not the true one`)
      // And it goes in at the next quiet half hour, by the same route.
      held.free()
      assert.ok((await pi.until(40)) > 31, `after ${who} the update never goes in`)
      assert.equal(pi.state.installs.length, 1)
    })
  }

  test('a Pi just switched on is never restarted under somebody who touched its screen while GitHub was asked', async () => {
    const on = await piMain({ upFor: 0 })
    on.main.run('where = { local: "http://localhost:5056", all: [] }; listenForTouches()')
    const held = holdGitHub(on)
    assert.equal(await untilAsking(on, 10), 4)
    on.clock.now += 5000
    on.main.heard['window:touched']({ senderFrame: { origin: 'http://localhost:5056' } })
    await held.answer()
    assert.equal(on.state.installs.length, 0, 'a Pi just switched on restarts under the person who touched its screen while GitHub was asked')
  })

  test('an install goes on the answer only by the route it was decided on', async () => {
    /*
     * Decided at power-on (minute 4), and the answer back with the clock
     * forty minutes on and nobody seen: by then it would go by the idle
     * route, which is a different decision with its own wait. It waits for
     * the next look instead, and that look decides afresh.
     */
    const pi = await piMain({ upFor: 0 })
    const held = holdGitHub(pi)
    assert.equal(await untilAsking(pi, 10), 4)
    pi.clock.now += 40 * MIN
    assert.deepEqual(pi.main.run('unattendedVerdict()'), { install: true, how: 'idle' }, 'the case itself is not a change of route')
    await held.answer()
    assert.equal(pi.state.installs.length, 0, 'an install decided by one route goes by another on GitHub’s answer')
    assert.ok(pi.main.logs.some((l) => /1\.92\.2 is ready; how it would go in changed while GitHub was asked, so it waits for the next look\./.test(l)))
    // The next look decides afresh, by the idle route, and asks GitHub again for it.
    held.free()
    await pi.look()
    assert.equal(pi.state.installs.length, 1)
  })

  /** A Mac or a Windows PC started at login, its update turned ready half a minute on, and GitHub's answer held. */
  async function loginAsking(platform) {
    const ready = { kind: 'ready', version: '1.92.2', published: new Date(Date.now() - 1 * HOUR).toISOString() }
    const pc = await piMain({ platform, arch: platform === 'darwin' ? 'arm64' : 'x64', argv: ['--hidden'], env: {}, model: '', upFor: 30 * 1000 })
    pc.main.run('update = null')
    const held = holdGitHub(pc)
    pc.main.run('heardUpdate(__given)', ready)
    await ticks()
    assert.equal(pc.main.run('heldWaiting'), true, `a ${platform} computer does not ask GitHub before it installs`)
    return { pc, held }
  }

  test('a Mac or a Windows PC whose window is opened while GitHub is asked does not install under it', async () => {
    for (const platform of ['darwin', 'win32']) {
      // Nothing happens: in it goes, as before.
      const quiet = await loginAsking(platform)
      await quiet.held.answer()
      assert.equal(quiet.pc.state.installs.length, 1, `a ${platform} computer started at login no longer puts its update in`)
      const opened = await loginAsking(platform)
      opened.pc.main.run('openWindow()')
      assert.equal(opened.pc.main.run('windowShown'), true)
      await opened.held.answer()
      assert.equal(opened.pc.state.installs.length, 0, `a ${platform} computer restarts under the window just opened while GitHub was asked`)
    }
  })

  test('a Mac or a Windows PC whose answer from GitHub comes after its three minutes does not install at that login', async () => {
    for (const platform of ['darwin', 'win32']) {
      const late = await loginAsking(platform)
      late.pc.clock.now += 3 * MIN
      await late.held.answer()
      assert.equal(late.pc.state.installs.length, 0, `a ${platform} computer restarts itself after its first three minutes because GitHub was slow`)
      assert.equal(late.pc.main.run('heldWaiting'), false)
    }
  })

  test('a phone’s Update now is refused when somebody arrives at the Pi while GitHub is asked', async () => {
    const OWNER = '5a1c2c4e-0000-4000-8000-000000000001'
    const request = async (pi, arrive) => {
      pi.main.run('watchAsks(); where = { local: "http://localhost:5056", all: [] }; listenForTouches()')
      const held = holdGitHub(pi)
      const tick = async () => {
        pi.clock.now += 10000
        pi.main.run('askLook').fn()
        for (let i = 0; i < 4; i++) await ticks()
      }
      pi.state.ask = { rev: 1, updatedAt: 1, data: { host: 'pedalboard', version: '1.92.2', account: OWNER, at: 1 } }
      await tick()
      pi.state.ask = { rev: 2, updatedAt: 2, data: { host: 'pedalboard', version: '1.92.2', account: OWNER, at: 2 } }
      await tick()
      assert.equal(pi.state.asked.length, 1, 'a phone’s request does not ask GitHub')
      assert.equal(pi.main.run('asked'), null, 'the request was answered before GitHub was')
      await arrive(pi)
      await held.answer()
      return pi.main.run('asked')
    }
    const nobody = await piMain({ outFor: 1 * HOUR })
    assert.equal((await request(nobody, async () => {})).result, 'installing', 'the case itself does not install')
    await ticks()
    assert.equal(nobody.state.installs.length, 1)
    const touched = await piMain({ outFor: 1 * HOUR })
    const toldTouched = await request(touched, async (pi) => pi.main.heard['window:touched']({ senderFrame: { origin: 'http://localhost:5056' } }))
    assert.equal(toldTouched.result, 'screen', 'a phone restarts the Pi under somebody who touched its screen while GitHub was asked')
    const played = await piMain({ outFor: 1 * HOUR })
    const toldPlayed = await request(played, async (pi) => {
      pi.event({ type: 'scene', scene: 2 })
      await ticks()
    })
    assert.equal(toldPlayed.result, 'busy', 'a phone restarts the Pi under somebody who changed a scene while GitHub was asked')
    await ticks()
    assert.equal(touched.state.installs.length + played.state.installs.length, 0)
    assert.ok(touched.state.writes.includes('PUT /store/config/host.update {"data":{"done":2},"origin":"fractal"}'), 'the refused request sits in the store')

    /*
     * The other two signs the second look reads (a third read, 17 November
     * 2026: left out of it, every test passed): a phone's browser on the
     * Wi-Fi, and another program on the Pi, each first seen by a look while
     * the ask is out.
     */
    const awake = await import('../desktop/lib/awake.mjs')
    const onWifi = { seen: false }
    const lan = await piMain({ outFor: 1 * HOUR, awakeOver: { phonesUsing: async () => (onWifi.seen ? new Set(['192.168.1.30']) : new Set()) } })
    const toldLan = await request(lan, async (pi) => {
      assert.equal(pi.main.run('lanSeenAt'), null, 'this case needs nobody on the Wi-Fi before the ask')
      onWifi.seen = true
      await pi.look()
      assert.notEqual(pi.main.run('lanSeenAt'), null, 'this case needs the browser seen while the ask is out')
    })
    assert.equal(toldLan.result, 'busy', 'a phone restarts the Pi under a browser on the Wi-Fi that turned up while GitHub was asked')
    const axiomOn = { seen: false }
    const axiom = await piMain({ outFor: 1 * HOUR, awakeOver: { otherLocalClients: (given) => (axiomOn.seen ? 1 : awake.otherLocalClients(given)) } })
    const toldAxiom = await request(axiom, async (pi) => {
      assert.equal(pi.main.run('otherLocalAt'), null, 'this case needs no other program on the Pi before the ask')
      axiomOn.seen = true
      await pi.look()
      assert.notEqual(pi.main.run('otherLocalAt'), null, 'this case needs the other program seen while the ask is out')
    })
    assert.equal(toldAxiom.result, 'busy', 'a phone restarts the Pi under another program that started using the unit while GitHub was asked')
    await ticks()
    assert.equal(lan.state.installs.length + axiom.state.installs.length, 0)

    /* A release found pulled is said as pulled even with somebody at the screen: "busy" would have the player try again later for nothing. */
    const gone = await piMain({ outFor: 1 * HOUR })
    gone.state.github = { status: 200, release: { tag_name: 'v1.92.2', draft: false, prerelease: true } }
    const toldGone = await request(gone, async (pi) => pi.main.heard['window:touched']({ senderFrame: { origin: 'http://localhost:5056' } }))
    assert.equal(toldGone.result, 'pulled', 'a pulled release is answered as somebody being at the Pi')
    await ticks()
    assert.equal(gone.state.installs.length, 0)
  })

  test('a newer version turning ready while GitHub is asked about the held one is not put in on that answer', async () => {
    const pi = await piMain()
    const held = holdGitHub(pi)
    assert.equal(await untilAsking(pi), 31)
    assert.ok(pi.state.asked.every((a) => tagOf(a.url)), 'this case needs 1.92.2’s own release asked about')
    /* The updater says another version is ready before GitHub answers about 1.92.2. */
    pi.main.run('heardUpdate(__given)', { kind: 'ready', version: '1.92.3', published: new Date(Date.now() - 25 * HOUR).toISOString() })
    await ticks()
    await held.answer()
    assert.equal(pi.state.installs.length, 0, '1.92.3 went in on GitHub’s answer about 1.92.2')
    assert.equal(pi.main.run('heldWaiting'), false)
    /* And 1.92.3 is asked about by its own release before it goes in. */
    held.free()
    pi.state.github = { status: 200, release: { tag_name: 'v1.92.3', draft: false, prerelease: false } }
    assert.notEqual(await pi.until(60), null, 'the newer version never goes in')
    assert.ok(pi.state.asked.some((a) => /\/releases\/tags\/v1\.92\.3$/.test(a.url)), `1.92.3 went in without its own release being asked about: ${pi.state.asked.map((a) => a.url)}`)
  })

  test('an answer whose body never comes is no answer after 15 seconds, and updating goes on', async () => {
    // A Pi left on: the header comes, the body never does.
    const pi = await piMain()
    const held = holdGitHub(pi, { stall: true })
    assert.equal(await untilAsking(pi), 31)
    await held.timeOut()
    assert.equal(pi.main.run('heldWaiting'), false, 'a stalled answer holds every install for the rest of the run')
    assert.equal(pi.main.run('heldAsking'), null, 'a stalled answer is handed to every later ask')
    assert.ok(pi.main.logs.some((l) => /1\.92\.2 is ready; GitHub could not be asked whether it is still out, so it waits for a later look\./.test(l)))
    assert.equal(pi.state.installs.length, 0, 'a Pi left on puts a release in on no answer')
    // Ten minutes on, the next ask goes out, is answered, and it goes in.
    held.free()
    const asks = pi.state.asked.length
    await pi.until(12)
    assert.equal(pi.state.asked.length, asks + 1, 'GitHub is never asked again after a stalled answer')
    assert.ok(pi.state.asked.at(-1).at - pi.state.asked.at(-2).at >= 10 * MIN)
    assert.equal(pi.state.installs.length, 1, 'a Pi stays off its update for good after one stalled answer')
  })

  test('a phone’s Update now made while an answer from GitHub has stalled is answered once the 15 seconds pass', async () => {
    const phoned = await piMain()
    phoned.main.run('watchAsks()')
    const stalled = holdGitHub(phoned, { stall: true })
    await untilAsking(phoned)
    const tick = async () => {
      phoned.clock.now += 10000
      phoned.main.run('askLook').fn()
      for (let i = 0; i < 4; i++) await ticks()
    }
    phoned.state.ask = { rev: 1, updatedAt: 1, data: { host: 'pedalboard', version: '1.92.2', account: OWNER_OF_PI, at: 1 } }
    await tick()
    phoned.state.ask = { rev: 2, updatedAt: 2, data: { host: 'pedalboard', version: '1.92.2', account: OWNER_OF_PI, at: 2 } }
    await tick()
    assert.equal(phoned.main.run('asked'), null)
    await stalled.timeOut()
    assert.equal(phoned.main.run('asked')?.result, 'installing', 'a phone’s request is never answered while an answer from GitHub has stalled')
    await ticks()
    assert.equal(phoned.state.installs.length, 1)
  })

  test('an answer from GitHub whose body is not JSON is no answer, and lets the next ask go', async () => {
    const garbled = await piMain()
    garbled.main.run('askGitHub = __given', async (url) => {
      garbled.state.asked.push({ url, at: garbled.clock.now })
      return { ok: true, status: 200, json: async () => JSON.parse('<html>') }
    })
    assert.equal(await garbled.until(45), null)
    assert.equal(garbled.main.run('heldWaiting'), false)
    assert.equal(garbled.main.run('heldAsking'), null)
    assert.ok(garbled.state.asked.length >= 2, 'a body that is not JSON stops GitHub being asked again')
  })

  test('the copy an install nobody pressed for restarted waits a day for a newer release, and a real power-on does not', async () => {
    const updates = await import('../desktop/lib/updates.mjs')
    const autostart = await import('../desktop/lib/autostart.mjs')
    // Run N: a Pi left on puts 1.92.2 in by itself, and says so in the note it leaves.
    const n = await piMain()
    assert.equal(await n.until(), 31)
    const left = JSON.parse(n.main.disk.get('/userdata/pending-update.json'))
    assert.equal(left.byItself, true, 'the copy an install started cannot tell nobody pressed for it')
    // A phone's install leaves no such word: a person asked.
    const phoned = await piMain({ outFor: 1 * HOUR })
    phoned.main.run('watchAsks()')
    await phoneAsks(phoned)
    assert.equal(JSON.parse(phoned.main.disk.get('/userdata/pending-update.json')).byItself, undefined, 'a phone’s Update now is taken for an install nobody pressed for')
    /* Run N+1: started by that install (the updater's note in the environment), on what it put in, and finds a release out twenty minutes. */
    const marker = JSON.stringify({ ...left, version: '1.87.16' })
    const nPlus1 = async (over) => {
      const pi = await piMain({ upFor: 0, outFor: 20 * MIN, env: { APPIMAGE: NEW_IMAGE, FRACTAL_REMOTE_AFTER_UPDATE: 'hidden' }, files: { '/userdata/pending-update.json': marker }, ...over })
      pi.main.run('readLastInstall(__given)', updates.installOutcome)
      return pi
    }
    const fresh = await nPlus1()
    assert.equal(fresh.main.run('restartedByItself'), true)
    assert.equal(await fresh.until(40), null, 'the copy an unattended install restarted takes a release out twenty minutes by the power-on route')
    assert.ok(fresh.main.logs.some((l) => /is ready; it waits a day after a new version comes out\./.test(l)))
    // Out a day, or the owner's own: the power-on route as ever.
    assert.equal(await (await nPlus1({ outFor: 25 * HOUR })).until(10), 4, 'the restarted copy never takes a release that has had its day')
    const { ADMINS } = await import('../shared/admin.mjs')
    assert.equal(await (await nPlus1({ account: ADMINS[0] })).until(10), 4, 'the owner’s restarted Pi waits the day')
    // A real power-on (somebody switched it on: no note from the updater), with that note on disk: D5, unchanged.
    const switchedOn = await piMain({ upFor: 0, outFor: 20 * MIN, files: { '/userdata/pending-update.json': marker } })
    switchedOn.main.run('readLastInstall(__given)', updates.installOutcome)
    assert.equal(switchedOn.main.run('restartedByItself'), false)
    assert.equal(await switchedOn.until(10), 4, 'a Pi switched on waits a day for a release, which it never did')
    // The copy a person's install restarted is no different from a power-on.
    const byHand = await piMain({ upFor: 0, outFor: 20 * MIN, env: { APPIMAGE: NEW_IMAGE, FRACTAL_REMOTE_AFTER_UPDATE: 'hidden' }, files: { '/userdata/pending-update.json': JSON.stringify({ version: '1.87.16' }) } })
    byHand.main.run('readLastInstall(__given)', updates.installOutcome)
    assert.equal(await byHand.until(10), 4)
    // The rule, alone.
    const pi = { platform: 'linux', arch: 'arm64', env: { APPIMAGE: '/x' }, selfUpdating: true, lookComplete: true, sinceLaunchMs: 4 * MIN, quietMs: 3 * MIN }
    assert.equal(autostart.unattendedInstall({ ...pi, restartedByItself: true }).install, false)
    assert.deepEqual(autostart.unattendedInstall({ ...pi, restartedByItself: true, releaseSettled: true }), { install: true, how: 'power-on' })
    assert.deepEqual(autostart.unattendedInstall({ ...pi, restartedByItself: true, ownerBox: true }), { install: true, how: 'power-on' })
    assert.deepEqual(autostart.unattendedInstall({ ...pi, restartedByItself: false }), { install: true, how: 'power-on' }, 'a real power-on waits the day')
    assert.deepEqual(autostart.unattendedInstall({ ...pi, selfUpdating: false, restartedByItself: true }), { install: true, how: 'power-on' }, 'a box that does not put its own in, restarted, never takes its update at power-on')
  })

  test('a Mac or a Windows PC started hidden puts a waiting update in the moment it turns ready, in its first three minutes, as before 1.92.0, and never under an opened window', async () => {
    const autostart = await import('../desktop/lib/autostart.mjs')
    const ready = { kind: 'ready', version: '1.92.2', published: new Date(Date.now() - 1 * HOUR).toISOString() }
    const computer = async (platform, { argv = ['--hidden'], upFor = 30 * 1000 } = {}) => {
      const pc = await piMain({ platform, arch: platform === 'darwin' ? 'arm64' : 'x64', argv, env: {}, model: '', upFor })
      pc.main.run('update = null')
      return pc
    }
    for (const platform of ['darwin', 'win32']) {
      // Ready half a minute after login: in at once, with no look and nothing heard from the unit.
      const pc = await computer(platform)
      assert.equal(pc.state.streams.length, 0, `the unit's events are read on ${platform}, where nothing uses them`)
      assert.equal(pc.main.run('watchesUnit()'), false)
      pc.main.run('heardUpdate(__given)', ready)
      for (let i = 0; i < 3; i++) await ticks()
      assert.equal(pc.state.installs.length, 1, `a ${platform} computer started at login no longer puts its waiting update in when it turns ready`)
      assert.equal(pc.state.installs[0], pc.start, 'it waits for something first')
      // Its window opened first: somebody is there.
      const opened = await computer(platform)
      opened.main.run('openWindow()')
      opened.main.run('heardUpdate(__given)', ready)
      await opened.look(10)
      assert.equal(opened.state.installs.length, 0, `a ${platform} computer restarts itself under the person who just opened its window`)
      // Ready after the first three minutes, or on a start with its window: a quit.
      const late = await computer(platform, { upFor: 3 * MIN + 1000 })
      late.main.run('heardUpdate(__given)', ready)
      await late.look(10)
      assert.equal(late.state.installs.length, 0, `a ${platform} computer restarts itself after its first three minutes`)
      const windowed = await computer(platform, { argv: [] })
      windowed.main.run('heardUpdate(__given)', ready)
      await windowed.look(10)
      assert.equal(windowed.state.installs.length, 0)
      // A phone seen first: a quit.
      const used = await computer(platform)
      used.main.run('phoneSeenAt = uptime()')
      used.main.run('heardUpdate(__given)', ready)
      await used.look(5)
      assert.equal(used.state.installs.length, 0, `a ${platform} computer restarts itself under a phone`)
    }
    // The rule, alone: a look that saw little is no reason to wait on a Mac.
    assert.equal(autostart.INSTALL_WINDOW_MS, 3 * MIN)
    assert.deepEqual(autostart.unattendedInstall({ platform: 'darwin', hidden: true, sinceLaunchMs: 3 * MIN, lookComplete: false }), { install: true, how: 'power-on' })
    assert.equal(autostart.unattendedInstall({ platform: 'win32', hidden: true, sinceLaunchMs: 3 * MIN + 1 }).install, false)
    assert.equal(autostart.unattendedInstall({ platform: 'darwin', hidden: true, sinceLaunchMs: 1000, windowShown: true }).install, false)
  })

  test('a Linux box started hidden is no power-on box once its window is opened, and a Pi still is', async () => {
    const pc = await piMain({ upFor: 0, model: '', arch: 'x64', argv: ['--hidden'] })
    assert.equal(pc.main.run('selfUpdating()'), true)
    await pc.look()
    pc.main.run('openWindow()')
    assert.equal(pc.main.run('selfUpdating()'), false, 'a PC whose window was opened from the tray still puts its own updates in')
    assert.equal(await pc.until(40), null, 'a Linux PC restarts itself at power-on under the person who opened its window')
    // A Pi's window is its touch screen: opened, the Pi still takes its update at power-on.
    const pi = await piMain({ upFor: 0, argv: ['--hidden'] })
    await pi.look()
    pi.main.run('openWindow()')
    assert.equal(await pi.until(10), 4)
  })

  test('start() starts the look for phones, the unit’s events and the phone’s requests', async () => {
    const src = read('desktop/main.js')
    assert.match(src, /awakeRules = await import\('\.\/lib\/awake\.mjs'\)\s*\n\s*startWatching\(\)/, 'start() does not start the looks')
    assert.match(src, /computerModel = deviceModel\(\)/, 'the board’s name is not read')
    const pi = await piMain()
    assert.equal(pi.state.streams.length, 1, 'start() never listens to the unit, so a Pi never goes quiet')
    assert.ok(pi.main.run('phoneLook'), 'start() never looks for phones')
    assert.ok(pi.main.run('askLook'), 'start() never looks for a phone’s request')
    assert.equal(await pi.until(), 31)
  })

  test('a look whose phone note, Wi-Fi connections or other programs could not be read installs nothing', async () => {
    assert.equal(await (await piMain()).until(40), 31, 'the case itself does not install')
    const note = await piMain({ awakeOver: { readPhoneNote: async () => undefined } })
    assert.equal(await note.until(40), null, 'a Pi restarts itself while its phone note cannot be read')
    const lan = await piMain({ awakeOver: { phonesUsing: async () => null } })
    assert.equal(await lan.until(40), null, 'a Pi restarts itself while it cannot see who is on its Wi-Fi')
    const others = await piMain({ links: {} })
    assert.equal(others.main.run('otherProgramsNow([])'), null)
    assert.equal(await others.until(40), null, 'a Pi restarts itself while it cannot tell its own connections from Axiom’s')
  })

  test('a Linux x64 AppImage that is not a Pi and was not started hidden never puts an update in by itself', async () => {
    const pc = await piMain({ model: '', arch: 'x64' })
    assert.equal(pc.main.run('selfUpdating()'), false, 'a Linux PC with its window open puts in its own updates')
    assert.equal(await pc.until(90), null, 'a Linux PC restarts itself after half an hour')
    assert.equal(pc.main.run('updateNoteNow()').canNow, false)
  })

  test('the look for updates carries when the release came out to the ready state', async () => {
    const { wireUpdates } = await import('../desktop/lib/updates.mjs')
    const published = '2026-11-16T12:00:00Z'
    const heard = {}
    const states = []
    const updater = {
      on: (event, fn) => void (heard[event] = fn),
      setFeedURL() {},
      checkForUpdates: async () => heard['update-downloaded']({ version: '1.92.2' })
    }
    const release = { tag_name: 'v1.92.2', html_url: 'https://github.com/justinnewbold/fractal-remote/releases/tag/v1.92.2', published_at: published, assets: [{ name: 'latest-linux-arm64.yml' }, { name: 'Fractal-Remote-1.92.2-arm64.AppImage' }] }
    const wired = wireUpdates({ updater, onState: (s) => states.push(s), lookup: async () => release, running: '1.92.1', target: { platform: 'linux', arch: 'arm64', appImage: true } })
    await wired.check()
    assert.deepEqual(states.at(-1), { kind: 'ready', version: '1.92.2', published }, 'a ready update does not carry when it came out, so only the owner’s Pis ever put one in by themselves')
    await wired.check()
    assert.deepEqual(states.at(-1), { kind: 'ready', version: '1.92.2', published }, 'the held update forgets when it came out')
  })

  test('a phone’s Update now is refused while a phone’s browser on the Wi-Fi or another program on the Pi was seen lately', async () => {
    const lan = await piMain({ awakeOver: { phonesUsing: async () => new Set(['192.168.1.30']) } })
    lan.main.run('watchAsks()')
    await lan.look()
    assert.equal((await phoneAsks(lan)).result, 'busy', 'a phone restarts the Pi while a browser on the Wi-Fi is driving it')
    const axiom = await piMain({ files: { '/proc/net/tcp': [HEAD, LISTEN, WINDOW, AXIOM].join('\n') } })
    axiom.main.run('watchAsks()')
    await axiom.look()
    assert.equal((await phoneAsks(axiom)).result, 'busy', 'a phone restarts the Pi while Axiom is driving it')
    assert.equal(lan.state.installs.length + axiom.state.installs.length, 0)
  })

  test('an install that failed before it could start can be tried again', async () => {
    const pi = await piMain()
    let fail = true
    const real = pi.main.run('stopServing')
    pi.main.run('stopServing = __given', async () => {
      if (fail) throw new Error('the device server would not stop')
      return real()
    })
    await assert.rejects(pi.main.run('installNow()'), /would not stop/)
    assert.equal(pi.state.installs.length, 0)
    fail = false
    const again = await pi.main.run('installNow()')
    assert.equal(again.ok, true, 'one install that failed early leaves Restart to update answering "already" until the Pi is switched off')
    assert.equal(pi.state.installs.length, 1)
  })

  /* ------------------------------------------------------ the shell's parts */

  test('the window says when somebody touches it, at most every ten seconds, and the bridge gains nothing', () => {
    const preload = read('desktop/preload.js')
    const code = preload.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
    for (const type of ['pointerdown', 'touchstart', 'keydown', 'wheel']) assert.ok(code.includes(`'${type}'`), `a ${type} on the window is not counted`)
    assert.match(code, /window\.addEventListener\(type, touched, \{ passive: true, capture: true \}\)/, 'the listener can be hidden by the page, or slows it down')
    assert.match(code, /ipcRenderer\.send\('window:touched'\)/)
    const every = Number(/const TOUCH_EVERY_MS = (\d+) \* 1000/.exec(code)?.[1])
    assert.ok(every >= 10, 'the window says it is touched more often than every ten seconds')
    assert.match(code, /if \(now - touchedAt < TOUCH_EVERY_MS\) return/)
    assert.match(code, /performance\.now\(\)/, 'the throttle is on the time of day, which a Pi gets wrong until its network sets it')
    const bridge = code.slice(code.indexOf("exposeInMainWorld('fractalDesktop'"))
    assert.ok(!/touch/i.test(bridge), 'the page is handed something new on the bridge')
    const main = read('desktop/main.js')
    assert.match(main, /ipcMain\.on\('window:touched', \(event\) => \{\s*\n\s*if \(askedByOwnPage\(event\)\) windowTouchedAt = uptime\(\)/, 'a touch from any page counts')
    assert.match(main, /listenForTouches\(\)\s*\n\s*await beginUpdates\(\)/, 'nothing listens for the window being touched')
  })

  test('a Linux build that does not start is held back as a pre-release, which no computer that gets an answer from GitHub puts in by itself', () => {
    const yml = read('.github/workflows/desktop.yml')
    const at = yml.indexOf('- name: A Linux build that does not start is held back')
    assert.ok(at !== -1, 'a release whose Linux build does not start goes to every Pi left on')
    assert.ok(at > yml.indexOf('- name: The app starts with no window, once, and stops when told'), 'it is decided before the start is tried')
    assert.ok(at < yml.indexOf('  complete:'), 'it is not in the Linux job')
    const step = yml.slice(at, yml.indexOf('\n      - ', at + 10))
    assert.match(step, /if: \$\{\{ failure\(\) && github\.event_name != 'pull_request' && \(github\.event_name == 'push' \|\| inputs\.publish\)/, 'it runs on a green build, or on a pull request')
    assert.match(step, /gh release edit "v\$VERSION" --prerelease/)
    assert.match(step, /GH_TOKEN: \$\{\{ secrets\.GITHUB_TOKEN \}\}/)
  })

  test('the window and the menu say a Pi’s update goes in by itself, and every other computer keeps its words', async () => {
    const { updateAdvice, goesInByItself, idleReadyWords } = await import('../src/lib/desktop.js')
    const words = 'Version 1.92.2 is ready. Restart to update, or leave it: it goes in by itself once it has been out for a day and nobody has used this computer for half an hour.'
    assert.equal(idleReadyWords({ kind: 'ready', version: '1.92.2', goesIn: 'idle' }), words)
    assert.equal(updateAdvice({ kind: 'ready', version: '1.92.2', goesIn: 'idle' }), words)
    for (const goesIn of ['quit', 'password', undefined]) {
      assert.equal(goesInByItself({ kind: 'ready', goesIn }), false)
      assert.match(updateAdvice({ kind: 'ready', version: '1.92.2', goesIn }), /it installs the next time you quit/, 'a Mac is told its update goes in by itself')
    }
    assert.equal(goesInByItself({ kind: 'current', goesIn: 'idle' }), false)
    const ui = read('src/components/Updates.jsx')
    const notice = ui.slice(ui.indexOf('export function UpdateReadyNotice'))
    assert.match(notice, /goesInByItself\(state\) \? \(\s*\n\s*<p>\{idleReadyWords\(state\)\}<\/p>/, 'the notice tells a Pi it installs when it quits')
    const main = read('desktop/main.js')
    assert.match(main, /answerOwnPage\('updates:state', \(\) =>\s*\n\s*update \? \{ \.\.\.update, line: updateLine\(update, lineOptions\(\)\), goesIn: goesIn\(\) \}/, 'the window is not told how the update goes in here')
    assert.match(main, /\.\.\.\(updateLine\(update, lineOptions\(\)\) \? \[\{ label: updateLine\(update, lineOptions\(\)\), enabled: false \}\] : \[\]\)/, 'the menu says a Pi installs when it quits')
    // The page's words name the computer, never the device in hand, and promise nothing about the sound.
    for (const line of [words, read('public/raspberry-pi.html').match(/<h2 id="updates">Updates<\/h2>[\s\S]*?<p>([\s\S]*?)<\/p>/)[1]]) {
      assert.doesNotMatch(line, /this phone|beta|official|soon|tried|sound|seconds/i, `"${line}" says something it may not`)
    }
  })

  test('COMPUTER_NEEDED does not move for a Pi that puts in its own updates', async () => {
    const { COMPUTER_NEEDED } = await import('../shared/versions.mjs')
    assert.equal(COMPUTER_NEEDED, '1.87.23', 'the phone tells every computer to update for this, and nothing on the phone needs it')
  })
}

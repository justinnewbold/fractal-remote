/**
 * Backups on the phone (mobile/src/lib/backups.js), and the computer's half
 * of the one new ask, "keep a copy of this slot now"
 * (src/lib/restoreViaComputer.js keepNow, carryOutRestore).
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')
const flat = (s) => s.replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ').replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\s+/g, ' ')

export function run(test) {
  test('backups: the phone leaves its asks in the documents the computer reads, and waits as long as the browser does', async () => {
    const phone = await import('../mobile/src/lib/backups.js')
    const computer = await import('../src/lib/restoreViaComputer.js')
    for (const slug of ['fm3', 'axefxiii']) {
      assert.equal(phone.pendingRestoreDoc(slug), computer.pendingRestoreDoc(slug))
      assert.equal(phone.restoreResultDoc(slug), computer.restoreResultDoc(slug))
      assert.equal(phone.restoreProgressDoc(slug), computer.restoreProgressDoc(slug))
    }
    assert.equal(phone.RESTORE_WAIT_MS, computer.RESTORE_WAIT_MS)
    assert.equal(phone.RESTORE_WORKING_MS, computer.RESTORE_WORKING_MS)
    assert.equal(phone.RESTORE_FRESH_MS, computer.RESTORE_FRESH_MS)
    assert.deepEqual(phone.MODES, [...computer.MODES, computer.KEEP])
    /* A put or a play is the browser's own request, field for field. */
    const v = { id: 'v1', location: 12, model: 'FM3', name: 'Lead' }
    const row = phone.backupRows([v])[0]
    const mine = phone.restoreRequest(row, 'put', { id: 'x' })
    const theirs = computer.restoreRequest(v, 'put', { id: 'x' })
    assert.deepEqual(mine, theirs)
    /* A keep has no version in it, so a computer app from before it passes it over. */
    const keep = phone.keepRequest(12, { id: 'k', name: 'Lead' })
    assert.deepEqual(keep, { id: 'k', mode: 'keep', slot: 12, name: 'Lead' })
    assert.equal('versionId' in keep, false)
    /* The device's own calls use the same names. */
    const dev = flat(read('mobile/src/lib/device.js'))
    assert.ok(dev.includes('`fractal.pendingRestore.${slug}`') && dev.includes('`fractal.restoreResult.${slug}`') && dev.includes('`fractal.restoreProgress.${slug}`'))
    assert.match(dev, /export async function listSnapshots\(slot\) \{ if \(demoDevice\(\) \|\| bluetoothWire\(\)\) return \[\]/, 'the list is asked for with no computer there')
    assert.match(dev, /export function parkBackupAsk\(slug, request\) \{ if \(!slug \|\| demoDevice\(\) \|\| bluetoothWire\(\)\) throw/, 'an ask is left with no computer to read it')
  })

  test('backups: the rows are newest first, the slot’s alone when asked, and say when in plain words', async () => {
    const b = await import('../mobile/src/lib/backups.js')
    const now = new Date(2026, 10, 22, 15, 0).getTime()
    const list = [
      { id: 'a', location: 5, name: 'Clean', at: new Date(2026, 10, 22, 9, 5).getTime() },
      { id: 'b', location: 7, name: ' ', capturedAt: new Date(2026, 10, 21, 21, 30).getTime(), label: 'before the gig' },
      { id: 'c', location: 5, name: 'Clean', at: new Date(2026, 10, 14, 12, 0).getTime() },
      null,
      { location: 5 }
    ]
    const all = b.backupRows(list)
    assert.deepEqual(all.map((r) => r.id), ['a', 'b', 'c'])
    assert.equal(all[1].name, 'Slot 7')
    assert.deepEqual(b.backupRows(list, { slot: 5 }).map((r) => r.id), ['a', 'c'])
    assert.equal(b.rowLine(all[0], now), 'slot 5 · today 9:05 AM')
    assert.equal(b.rowLine(all[1], now), 'slot 7 · yesterday 9:30 PM · before the gig')
    assert.equal(b.rowLine(all[2], now), 'slot 5 · 14 Nov 12:00 PM')
    assert.equal(b.whenWords(NaN, now), '')
  })

  test('backups: only through a computer, never a VP4, and his account’s until the switch', async () => {
    const b = await import('../mobile/src/lib/backups.js')
    assert.equal(b.backupsHere({ way: 'computer' }).ok, true)
    for (const way of ['bluetooth', 'cable', 'demo', undefined]) {
      const here = b.backupsHere({ way })
      assert.equal(here.ok, false)
      assert.equal(here.why, b.BACKUPS_NEED_COMPUTER)
    }
    assert.equal(b.backupsHere({ way: 'computer', vp4: true }).why, b.BACKUPS_NOT_VP4)
    assert.equal(b.backupsOn({ admin: false, everyone: false }), false)
    assert.equal(b.backupsOn({ admin: true, everyone: false }), true)
    assert.equal(b.backupsOn({ admin: false, everyone: true }), true)
    const f = await import('../mobile/src/lib/features.js')
    assert.equal(f.BACKUPS_FOR_EVERYONE, false, 'Backups opened to every account: that is Justin’s word, with a What’s new line')
    const settings = flat(read('mobile/src/screens/Settings.js'))
    assert.ok(settings.includes("{backupsOpen ? <SetupRow title={BACKUPS_TITLE} status={BACKUPS_ROW_STATUS} onPress={() => setPage('backups')} /> : null}"))
    assert.ok(settings.includes("{page === 'backups' && backupsOpen ? ("), 'the page is drawn for an account the row is not')
    /* No sentence says a backup is on the phone or on a server, or names what was tried. */
    for (const w of [b.BACKUPS_WHERE, b.BACKUPS_NEED_COMPUTER, b.KEEP_NOTE, b.TIMED_OUT]) assert.doesNotMatch(w, /this phone|cloud|server|not tried/i)
    /* A Put back always asks first, and says the slot is written over. */
    const ask = b.putAsk({ slot: 9 }, { unsaved: true })
    assert.match(ask.body, /writes over what is saved in slot 9/)
    assert.match(ask.body, /unsaved changes/)
    assert.doesNotMatch(b.putAsk({ slot: 9 }).body, /unsaved/)
    const page = flat(read('mobile/src/components/Backups.js'))
    assert.ok(page.includes("const put = (row) => confirm(putAsk(row, { unsaved: !!unsaved }), () => ask(restoreRequest(row, 'put'), row.slot))"), 'a Put back goes with no question')
    assert.ok(page.includes('if (job.current) return'), 'a second ask can go out while one is waiting')
  })

  test('backups: an ask is parked, waited for, and its answer handed back; a cancel is written over the request', async () => {
    const b = await import('../mobile/src/lib/backups.js')
    const store = {}
    const parked = []
    const make = (answer) =>
      b.startBackupAsk({
        request: b.keepRequest(4, { id: 'k1' }),
        slug: 'fm3',
        park: async (req) => {
          parked.push(req)
          store[b.pendingRestoreDoc('fm3')] = req
          if (answer) store[b.restoreResultDoc('fm3')] = { id: 'k1', ...answer }
        },
        readResult: async () => store[b.restoreResultDoc('fm3')] || null,
        readProgress: async () => null,
        listen: () => () => {},
        sleep: () => new Promise((r) => setTimeout(r, 1)),
        pollMs: 1
      })
    const ok = await make({ ok: true, mode: 'keep', slot: 4, said: 'Backed up slot 4 as it is saved on the unit.' }).done
    assert.equal(ok.ok, true)
    assert.equal(ok.said, 'Backed up slot 4 as it is saved on the unit.')
    assert.equal(parked[0].mode, 'keep')
    assert.ok(Number.isFinite(parked[0].at), 'the request has no time on it, so the computer cannot tell a stale one')
    /* Not parked at all: said as not reached, and nothing waited for. */
    const none = await b.startBackupAsk({ request: b.keepRequest(4, { id: 'k2' }), slug: 'fm3', park: async () => { throw new Error('offline') }, readResult: async () => null, readProgress: async () => null, listen: () => () => {} }).done
    assert.deepEqual(none, { ok: false, error: b.UNREACHED })
    /* The computer's own no comes back in its words. */
    delete store[b.restoreResultDoc('fm3')]
    const no = await make({ ok: false, error: 'Slot 4 is empty, so there’s nothing to back up.' }).done
    assert.equal(no.ok, false)
    assert.match(no.error, /empty/)
  })

  test('backups, at the computer: a keep takes a copy of the slot, says an empty slot is empty, and never touches what is loaded', async () => {
    const c = await import('../src/lib/restoreViaComputer.js')
    const calls = []
    const api = (over = {}) => ({
      snapshotSlot: async (n) => {
        calls.push(`snapshot ${n}`)
        return { version: { id: 'new' } }
      },
      slotName: async () => 'Lead',
      loadPresetBytes: async () => calls.push('LOAD'),
      storePreset: async () => calls.push('STORE'),
      listVersions: async () => ({ versions: [] }),
      versionBytes: async () => new Uint8Array([1]),
      ...over
    })
    const done = await c.keepNow({ id: 'k', mode: 'keep', slot: 3 }, api())
    assert.deepEqual(done, { ok: true, mode: 'keep', slot: 3, kept: true, said: 'Backed up slot 3 as it is saved on the unit.' })
    assert.deepEqual(calls, ['snapshot 3'], 'a keep loaded or stored something')
    await assert.rejects(() => c.keepNow({ mode: 'keep', slot: null }, api()), new RegExp(c.KEEP_NO_SLOT))
    await assert.rejects(() => c.keepNow({ mode: 'keep', slot: 600 }, api({ slotOutside: () => true })), /isn’t on this unit/)
    const e422 = Object.assign(new Error('x'), { status: 422 })
    await assert.rejects(() => c.keepNow({ mode: 'keep', slot: 3 }, api({ snapshotSlot: async () => { throw e422 }, slotName: async () => '<EMPTY>' })), /Slot 3 is empty/)
    /* A 422 over a slot the unit names is a damaged dump: asked once more, and kept if it comes. */
    let n = 0
    const again = await c.keepNow({ mode: 'keep', slot: 3 }, api({ snapshotSlot: async () => { n += 1; if (n === 1) throw e422; return { version: { id: 'v' } } } }))
    assert.equal(again.ok, true)
    assert.equal(n, 2)
    await assert.rejects(() => c.keepNow({ mode: 'keep', slot: 3 }, api({ snapshotSlot: async () => { throw new Error('cable') } })), /Couldn’t back up slot 3/)

    /* carryOutRestore: a keep is carried out and reported; a put or play with no version is still passed over; a stale keep is refused. */
    const reports = []
    const store = { take: async () => null, clear: async () => {}, picked: async () => {}, report: async (r) => reports.push(r) }
    calls.length = 0
    const out = await c.carryOutRestore({ id: 'k9', mode: 'keep', slot: 3, at: Date.now() }, { ...api(), ...store }, { handled: new Set() })
    assert.equal(out.ok, true)
    assert.equal(out.mode, 'keep')
    assert.deepEqual(calls, ['snapshot 3'])
    assert.equal(reports.at(-1).id, 'k9')
    assert.equal(await c.carryOutRestore({ id: 'p1', mode: 'put', at: Date.now() }, { ...api(), ...store }, { handled: new Set() }), null)
    assert.equal(await c.carryOutRestore({ id: 'k8', cancelled: true }, { ...api(), ...store }, { handled: new Set() }), null)
    const stale = await c.carryOutRestore({ id: 'k7', mode: 'keep', slot: 3, at: Date.now() - c.RESTORE_FRESH_MS - 1 }, { ...api(), ...store }, { handled: new Set() })
    assert.equal(stale.ok, false)
    assert.equal(stale.error, c.RESTORE_STALE)
    /* restoreNow itself still refuses a keep: only carryOutRestore's own branch runs one. */
    await assert.rejects(() => c.restoreNow({ mode: 'keep', slot: 3 }, api()), new RegExp(c.RESTORE_REFUSED))

    /* The computer's window: it looks at a keep though it has no version, and a keep done never clears the unsaved mark or reads the preset again. */
    const app = flat(read('src/App.jsx'))
    assert.ok(app.includes('if (stop || !req?.id || req.cancelled || (!req.versionId && req.mode !== KEEP)) return'))
    assert.ok(app.includes("if (out.ok && out.mode === KEEP) { recordLater.current('version', `${out.said} Asked for from the phone.`) } else if (out.ok) { afterRestoreLater.current(out.mode)"), 'a keep from the phone clears the unsaved mark, or reads the preset again')
  })
  test('backups: another unit’s backups are left out, an AM4 is told, and a save asks for a copy first only where it is asked to', async () => {
    const b = await import('../mobile/src/lib/backups.js')
    const c = await import('../src/lib/restoreViaComputer.js')
    /* Justin's AM4, 26 November 2026: the computer's list had an FM3's backups in it, and a tap on one could only be refused. */
    const list = [
      { id: 'a', location: 5, model: 'FM3', at: 3 },
      { id: 'b', location: 5, model: 'AM4', at: 2 },
      { id: 'c', location: 5, model: 'model_0x15', at: 1 },
      { id: 'd', location: 5, at: 0 }
    ]
    assert.deepEqual(b.backupRows(list, { unit: 'am4' }).map((r) => r.id), ['b', 'c', 'd'])
    assert.deepEqual(b.backupRows(list, { unit: 'fm3' }).map((r) => r.id), ['a', 'c', 'd'])
    /* With no unit known, or the fallback drawer, nothing is left out. */
    assert.equal(b.backupRows(list).length, 4)
    assert.equal(b.backupRows(list, { unit: 'device' }).length, 4)
    assert.equal(b.otherUnits('Axe-Fx III', 'axefxiii'), false)
    /* An AM4 is told there are none yet, in place of a button that fails. */
    assert.equal(b.backupsHere({ way: 'computer', am4: true }).why, b.BACKUPS_NOT_AM4)
    assert.equal(b.backupsHere({ way: 'computer' }).ok, true)
    const page = flat(read('mobile/src/components/Backups.js'))
    assert.ok(page.includes("am4: !isDemo() && slug === 'am4'"))
    assert.ok(page.includes("unit: slug }))"))

    /* The save's words name Restore preset only where the computer said it kept a copy. */
    assert.equal(b.savedWords(92), 'Saved to slot 92.')
    assert.equal(b.savedWords(92, false), 'Saved to slot 92.')
    assert.ok(b.savedWords(92, true).includes(b.RESTORE_BUTTON))
    assert.equal(b.restoreSub(1), '1 earlier version kept on the computer')

    /* The computer: asked, a copy is taken; not asked, nothing is; a failure or a slow one never throws. */
    const calls = []
    const api = { snapshotSlot: async (n) => { calls.push(n); return { version: { id: 'v' } } } }
    assert.deepEqual(await c.keepBeforeSave({ slot: 7 }, api), { asked: false, kept: false })
    assert.deepEqual(await c.keepBeforeSave({ slot: 7, keepFirst: 'yes' }, api), { asked: false, kept: false })
    assert.deepEqual(calls, [])
    assert.deepEqual(await c.keepBeforeSave({ slot: 7, keepFirst: true }, api), { asked: true, kept: true })
    assert.deepEqual(calls, [7])
    const refused = await c.keepBeforeSave({ slot: 7, keepFirst: true }, { snapshotSlot: async () => { throw new Error('unsupported') } })
    assert.equal(refused.kept, false)
    assert.equal(refused.why, 'unsupported')
    assert.equal((await c.keepBeforeSave({ slot: 7, keepFirst: true }, { snapshotSlot: async () => ({}) })).kept, false)
    const slow = await c.keepBeforeSave({ slot: 7, keepFirst: true }, { snapshotSlot: () => new Promise(() => {}) }, { limitMs: 5 })
    assert.deepEqual(slow, { asked: true, kept: false, why: 'took too long' })

    /* The window takes the copy BEFORE the store, and tells the phone whether it did. */
    const app = flat(read('src/App.jsx'))
    const at = app.indexOf('const before = await keepBeforeSave(req, { snapshotSlot })')
    assert.ok(at > 0 && at < app.indexOf('await storePreset(req.slot)', at), 'the copy is taken after the store, or not at all')
    assert.ok(app.includes('...(before.asked ? { kept: before.kept } : {})'))

    /* The phone: the request says keepFirst only where it is handed, and the answer's `kept` comes through. */
    const save = await import('../mobile/src/lib/saveViaComputer.js')
    for (const [keepFirst, kept] of [[true, true], [false, undefined]]) {
      let parked = null
      const run = save.startComputerSave({
        park: async (req) => { parked = req },
        readResult: async () => ({ id: parked.id, ok: true, slot: 4, at: Date.now(), ...(kept ? { kept } : {}) }),
        readProgress: async () => null,
        slot: 4,
        keepFirst,
        pollMs: 1,
        sleep: () => new Promise((r) => setTimeout(r, 1))
      })
      const res = await run.done
      assert.equal(res.ok, true)
      assert.equal(parked.keepFirst, keepFirst ? true : undefined)
      assert.equal(res.kept, kept)
    }
    const slotSave = flat(read('mobile/src/components/SaveToSlot.js'))
    assert.ok(slotSave.includes('keepFirst: autoBackup,'))
    assert.ok(slotSave.includes('const autoBackup = useAutoBackup()'))

    /* His account until the switch; and Restore preset is at the foot of Edit, drawn only where there is a backup. */
    const features = await import('../mobile/src/lib/features.js')
    assert.equal(features.AUTO_BACKUP_FOR_EVERYONE, false)
    assert.ok(flat(read('mobile/src/lib/useBackups.js')).includes('export const useAutoBackup = () => backupsOn({ admin: useBluetoothAdmin(), everyone: AUTO_BACKUP_FOR_EVERYONE })'))
    const button = flat(read('mobile/src/components/RestorePreset.js'))
    assert.ok(button.includes('if (!here || (!count && !open)) return null'))
    assert.ok(button.includes('const allowed = useAutoBackup()'))
    const edit = read('mobile/src/screens/Edit.js')
    assert.ok(edit.indexOf('<RestorePreset />') > edit.indexOf('Tap a block to open its controls.'), 'Restore preset is above the knobs')
  })
}

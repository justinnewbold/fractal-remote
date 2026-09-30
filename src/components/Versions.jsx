import { useEffect, useRef, useState } from 'react'
import { listVersions, backupDevice } from '../lib/forgefx'
import { formatWhen } from '../lib/when'
import { RESTORE_LATE_WORDS } from '../lib/restoreViaComputer'

/**
 * Undo, for the hardware.
 *
 * Distinct from the saved presets in this app, and the distinction matters.
 * Those store a generated spec — an intent, replayable against any preset. A
 * version is a raw .syx snapshot of one slot at one moment. You want the first
 * when the question is "do that again", and the second when it's "put it back
 * how it was". Only the second can answer that, because only the second knows
 * what "it was" actually contained.
 *
 * The two buttons do not reach the unit from here. `onRestore` does — at the
 * Mac straight away, and from a phone by asking the Mac, which is the only
 * place a snapshot may be written from. `waiting` is that ask, while it is
 * out. See lib/restoreViaComputer.js.
 */
export function Versions({ preset, onError, onRestore, busy, dirty, remote, waiting, onCancelWait, deviceSlots }) {
  const [versions, setVersions] = useState(null)
  const [scope, setScope] = useState('slot')
  /* `{ id, mode }`: which button is asking "are you sure". */
  const [confirming, setConfirming] = useState(null)
  const [working, setWorking] = useState(null)
  const live = useRef(true)
  useEffect(
    () => () => {
      live.current = false
    },
    []
  )

  const load = async () => {
    try {
      const res = await listVersions(scope === 'slot' ? preset?.number : undefined)
      if (live.current) setVersions(res?.versions || [])
    } catch (err) {
      if (!live.current) return
      setVersions([])
      onError(err.message)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, preset?.number])

  const run = async (version, mode) => {
    setConfirming(null)
    setWorking({ id: version.id, mode })
    try {
      const said = await onRestore(version, mode)
      /* A Put back keeps what it replaced as a snapshot, so the list has grown. */
      if (said?.ok && live.current) load()
    } catch (err) {
      onError(err.message)
    } finally {
      if (live.current) setWorking(null)
    }
  }

  /*
   * "Play it" replaces the sound that is loaded, and so does "Put back" — it
   * goes through the edit buffer on its way to the slot. With unsaved edits
   * on the unit that is ten minutes of work gone, so it is said here, before
   * anything is asked of the computer rather than after.
   */
  const play = (version) => (dirty ? setConfirming({ id: version.id, mode: 'play' }) : run(version, 'play'))

  if (!versions) return null

  const out = waiting || working
  const lost = dirty ? ' Your unsaved changes to the sound you’re on will be lost.' : ''

  return (
    <section className="versions">
      <div className="history-head">
        <p className="silk-label">Snapshots {versions.length ? `· ${versions.length}` : ''}</p>
        <div className="history-actions">
          <button
            className={`chip ${scope === 'slot' ? 'active' : ''}`}
            onClick={() => setScope('slot')}
          >
            This slot
          </button>
          <button
            className={`chip ${scope === 'all' ? 'active' : ''}`}
            onClick={() => setScope('all')}
          >
            All
          </button>
        </div>
      </div>

      {versions.length === 0 ? (
        /*
         * It used to say one is taken before a slot is overwritten. Nothing
         * took one, so a Put back could not be undone. Put back does now; a
         * save still does not, and this does not claim it.
         *
         * And not "below" on a phone: backing up every slot is one of the
         * things the relay refuses from away ("back up the device"), so the
         * button there only says no.
         */
        <p className="hint">
          {remote
            ? 'No snapshots yet. Back up all slots at the computer to take one of each, and Put back keeps a copy of whatever it replaces.'
            : 'No snapshots yet. Back up every slot below to take one of each, and Put back keeps a copy of whatever it replaces.'}
        </p>
      ) : (
        <div className="history-list">
          {versions.map((version) => {
            const mine = out?.id === version.id || out?.versionId === version.id
            return (
              <div className="history-entry" key={version.id}>
                <div className="history-row">
                  <div className="version-info">
                    <span className="history-name">{version.name || `Slot ${version.location}`}</span>
                    <span className="history-when mono">
                      slot {version.location} · {formatWhen(version.at ?? version.capturedAt)}
                      {version.label ? ` · ${version.label}` : ''}
                    </span>
                  </div>
                  <div className="history-actions">
                    <button className="chip" onClick={() => play(version)} disabled={busy || !!out}>
                      Play it
                    </button>
                    <button
                      className="chip"
                      onClick={() => setConfirming({ id: version.id, mode: 'put' })}
                      disabled={busy || !!out}
                    >
                      Put back
                    </button>
                  </div>
                </div>

                {mine ? (
                  <div className="notice" role="status">
                    <p>
                      {waiting?.late
                        ? RESTORE_LATE_WORDS
                        : (waiting || working)?.mode === 'play'
                          ? 'Loading the snapshot…'
                          : `Putting it back in slot ${version.location}…`}
                    </p>
                    {waiting && onCancelWait ? (
                      <div className="history-actions">
                        <button onClick={onCancelWait}>Cancel</button>
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {confirming?.id === version.id && confirming.mode === 'put' ? (
                  <div className="notice" data-kind="fault">
                    <p>
                      This writes the snapshot over slot {version.location}. What’s there now is kept
                      as a snapshot first, so you can put it back.{lost}
                    </p>
                    <div className="history-actions">
                      <button className="primary" onClick={() => run(version, 'put')}>
                        Put back in slot {version.location}
                      </button>
                      <button onClick={() => setConfirming(null)}>Cancel</button>
                    </div>
                  </div>
                ) : null}

                {confirming?.id === version.id && confirming.mode === 'play' ? (
                  <div className="notice" data-kind="fault">
                    <p>This loads the snapshot in place of the sound you’re on.{lost}</p>
                    <div className="history-actions">
                      <button className="primary" onClick={() => run(version, 'play')}>
                        Play it
                      </button>
                      <button onClick={() => setConfirming(null)}>Cancel</button>
                    </div>
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>
      )}

      <p className="hint history-note">
        <strong>Play it</strong> loads a snapshot so you can hear it without saving it to a slot.{' '}
        <strong>Put back</strong> writes it to the slot it came from, and keeps what was there.
      </p>
    </section>
  )
}

/**
 * Back up every slot at once.
 *
 * The per-preset .syx covers the preset you're working on. This covers the case
 * where something went wrong and you don't yet know which slot it touched —
 * which, on a project that has silently written wrong values more than once, is
 * not a hypothetical.
 */
/*
 * `deviceSlots` is a PROP, and was being read as if it were one without ever
 * being declared or passed — so this panel threw a ReferenceError the moment
 * it rendered, and the Backups section of the Presets sheet was an error
 * boundary's apology instead of a backup button. Found while chasing why
 * reloading a saved preset showed nothing: the same sheet, one panel down.
 */
export function DeviceBackup({ onError, onChanged, busy, deviceSlots }) {
  const [running, setRunning] = useState(false)
  const [label, setLabel] = useState('')

  const run = async () => {
    setRunning(true)
    try {
      const name = label.trim() || `Backup ${new Date().toLocaleDateString()}`
      await backupDevice(name)
      onChanged(`Backed up all slots as "${name}"`)
      setLabel('')
    } catch (err) {
      onError(err.message)
    } finally {
      setRunning(false)
    }
  }

  return (
    <section className="device-backup">
      <p className="silk-label">Back up everything</p>
      <div className="refine-row">
        <input
          type="text"
          className="refine-input"
          value={label}
          placeholder="Label this backup"
          onChange={(e) => setLabel(e.target.value)}
          aria-label="Backup label"
        />
        <button onClick={run} disabled={busy || running}>
          {running ? 'Reading all slots…' : 'Back up all slots'}
        </button>
      </div>
      {/*
        The unit's own count, not 512. That number is the gen-3 one — an AM4
        holds 104 and an Axe-Fx II 384 — and a sentence that states it as a
        fact is the app telling a player something about their hardware that
        is not true. A unit that has never said falls back to "every slot",
        which is accurate whatever the number turns out to be.
      */}
      <p className="hint">
        Reads {deviceSlots ? `all ${deviceSlots} slots` : 'every slot'} down one serial port, so it
        takes a while. Worth doing once before you let anything write in bulk.
      </p>
    </section>
  )
}

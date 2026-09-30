import { useEffect, useState } from 'react'
import { PresetList } from './Console'
import { slotProblem } from '../lib/slots'
import { overwriteAsk } from '../lib/overwrite'

/**
 * Where a preset goes, chosen rather than typed.
 *
 * The slot used to be a numeric field, which asks you to know that the tone
 * you want to keep belongs in 287 — and to remember what is already in 287.
 * Nobody knows that. The list here is the same `PresetList` the preset menu
 * uses, so picking a destination shows you what you would be writing over,
 * which is the question actually being asked.
 *
 * The field stays. Someone who knows the number should not have to scroll to
 * it, and a 512-slot list on a phone is a scroll.
 */
/**
 * The button, in the sheet's footer rather than its body.
 *
 * It sat above the slot list, and the slot list is five hundred rows. On a
 * phone, picking a slot meant scrolling into the list — and the button was
 * gone off the top by the time a row was tapped. "Clicking on a preset does
 * absolutely nothing and nothing saves." Tapping a row was working exactly as
 * designed, choosing the destination, and the thing that saves was two screens
 * up. The footer does not scroll, so the button is under your thumb wherever
 * the list is, and it names the slot you just picked.
 */
/**
 * What the slot holds, in the words the footer and the sheet both use.
 *
 * Unknown is not empty. A slot whose name was never read used to be called
 * "an empty slot", which over the relay was most of them — and the one word
 * that makes an overwrite a decision was a guess.
 */
export const holdsWords = (check, target) =>
  check.need === 'checking'
    ? `whatever is in slot ${target} (checking…)`
    : check.need === 'unknown'
      ? `whatever is in slot ${target} — it couldn’t be read`
      : check.name || 'an empty slot'

export function SaveFooter({ preset, slot, onSave, onCancel, busy, saving, remote, queued, slots, deviceSlots, check }) {
  const problem = slotProblem(slot, deviceSlots)
  const target = problem ? NaN : slot === '' ? preset?.number : Number(slot)
  const targetLabel = Number.isInteger(target) ? target : '--'
  const elsewhere = Number.isInteger(target) && target !== preset?.number
  const guard = check || { need: 'none', name: '' }
  /* Said whenever it is somebody else's slot, and on the loaded slot when the
     save would put another name over the one it was loaded under. */
  const tell = Number.isInteger(target) && (elsewhere || guard.need !== 'none')

  /*
   * THE SECOND TAP.
   *
   * Asked for whenever the slot holds a preset under another name, or holds
   * something that could not be read. The first tap turns the button into the
   * question, naming what goes; the second answers it. Picking another slot
   * or typing another name puts the question away, because it was about the
   * last one.
   */
  const [armed, setArmed] = useState(false)
  useEffect(() => {
    setArmed(false)
  }, [target, guard.need, guard.name])
  const press = () => {
    if (guard.need !== 'none' && !armed) {
      setArmed(true)
      return
    }
    setArmed(false)
    onSave()
  }

  return (
    <div className="save-foot">
      {queued ? (
        <div className="save-queued">
          <p className="hint">
            Slot {queued.slot} is queued &mdash; the computer writes it and this says so the moment it lands.
          </p>
          {onCancel ? (
            <button className="chip" onClick={onCancel}>
              Cancel
            </button>
          ) : null}
        </div>
      ) : tell ? (
        <p className={armed ? 'hint save-target-warn' : 'hint'}>
          Replaces <strong>{holdsWords(guard, targetLabel)}</strong>.
        </p>
      ) : null}
      {/* The same words from a phone as from the Mac. "Ask the Mac to save to
          slot 478" said who holds the pen, which is this app's business and
          not the player's; the queued line above says so once it is in
          flight. */}
      <button className="primary save-confirm" onClick={press} disabled={busy || !!queued || !!problem}>
        {saving ? 'Saving…' : armed ? overwriteAsk(guard, targetLabel) : `Save to slot ${targetLabel}`}
      </button>
    </div>
  )
}

export default function SaveSheet({
  preset,
  saveName,
  onName,
  slot,
  onSlot,
  onSave,
  onRevert,
  safety,
  onRestoreSafety,
  busy,
  saving,
  dirty,
  remote,
  queued,
  error,
  onDismissError,
  slots,
  deviceSlots,
  addressing,
  scanning,
  progress,
  onScan,
  onStopScan,
  check,
  late
}) {
  const problem = slotProblem(slot, deviceSlots)
  const target = problem ? NaN : slot === '' ? preset?.number : Number(slot)
  const targetLabel = Number.isInteger(target) ? target : '--'
  const elsewhere = Number.isInteger(target) && target !== preset?.number
  const guard = check || { need: 'none', name: '' }

  return (
    <div className="save-sheet">
      {queued ? (
        <p className="hint">
          {late ? (
            <>
              Slot {queued.slot} isn&rsquo;t saved yet. The computer hasn&rsquo;t answered &mdash; check
              Fractal Remote is open on it, or cancel.
            </>
          ) : (
            <>
              Slot {queued.slot} is queued. The page at your computer writes it &mdash; open there if it
              isn&rsquo;t, and this says so the moment it lands.
            </>
          )}
        </p>
      ) : null}

      {error ? (
        <div className="save-error" role="alert">
          <span>{error}</span>
          <button className="chip" onClick={onDismissError}>
            Dismiss
          </button>
        </div>
      ) : null}

      <label className="save-field">
        <span className="silk-label">Name</span>
        <input
          type="text"
          value={saveName}
          maxLength={31}
          onChange={(e) => onName(e.target.value)}
          placeholder={preset?.name || 'Preset name'}
          aria-label="Name to save the preset under"
        />
      </label>

      <label className="save-field save-field-slot">
        <span className="silk-label">Slot</span>
        <input
          type="text"
          inputMode="numeric"
          value={slot === '' ? String(preset?.number ?? '') : slot}
          onChange={(e) => onSlot(e.target.value.trim())}
          placeholder="Slot"
          aria-label="Preset slot to save into"
          aria-invalid={problem ? 'true' : undefined}
          aria-describedby={problem ? 'save-slot-problem' : undefined}
        />
      </label>
      {problem ? (
        <p className="problem save-slot-problem" id="save-slot-problem" role="alert">
          {problem}
        </p>
      ) : null}

      {/*
        The one sentence that makes an overwrite a decision rather than an
        accident: what is in the slot you are about to write. Only when it is
        not the slot already loaded — saying "this will replace the preset you
        are editing" about the preset you are editing is noise.
      */}
      {Number.isInteger(target) && (elsewhere || guard.need !== 'none') ? (
        <p className="hint save-target-warn">
          {guard.need === 'checking' ? (
            <>Checking what is in slot {targetLabel}&hellip;</>
          ) : guard.need === 'unknown' ? (
            <>
              Couldn&rsquo;t read what is in slot {targetLabel}. Saving replaces <strong>whatever is there</strong>.
            </>
          ) : (
            <>
              Slot {targetLabel} currently holds <strong>{holdsWords(guard, targetLabel)}</strong>. Saving replaces it.
            </>
          )}
        </p>
      ) : null}

      {!dirty ? <p className="hint">Nothing has changed since this was last saved.</p> : null}

      <div className="save-sheet-actions">
        <button className="chip" onClick={onRevert} disabled={busy}>
          Revert to saved
        </button>
        {safety ? (
          <button className="chip" onClick={onRestoreSafety} disabled={busy}>
            Load pre-edit copy
          </button>
        ) : null}
      </div>

      <p className="silk-label save-pick-label">Or pick a slot</p>
      <PresetList
        slots={slots}
        current={target}
        deviceSlots={deviceSlots}
        addressing={addressing}
        scanning={scanning}
        progress={progress}
        onStop={onStopScan}
        onScan={onScan}
        /* Picking here chooses a destination. It must not load the preset —
           that would throw away the edit you are trying to keep. */
        onSelect={(n) => onSlot(String(n))}
      />
    </div>
  )
}

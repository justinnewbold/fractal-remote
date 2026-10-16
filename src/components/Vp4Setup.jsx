import { useState } from 'react'
import { VP4_SETUP, clearVp4Setup, readVp4Setup, saveVp4Setup, vp4ComputerCan, vp4OldFirmware } from '../../shared/vp4-safety.mjs'

/* This browser's own storage, or none: a browser that refuses it keeps nothing, and the VP4 is not set up. */
const kept = () => {
  try {
    return globalThis.localStorage ?? null
  } catch {
    return null
  }
}

/**
 * THE VP4'S SCENE SELECT NUMBER AND MIDI CHANNEL, in this browser — the
 * phone's card (mobile/src/components/Vp4Setup.js), word for word: every
 * sentence is VP4_SETUP's in shared/vp4-safety.mjs.
 *
 * Presets need nothing on the VP4's own channel 1: a VP4 takes a Program
 * Change for A1 to Z4 as it comes, and a VP4 moved to another channel saves
 * that channel alone, with the number left empty. Scenes need one number the player sets on the VP4, because it has
 * no factory Scene Select and a guessed one could be the volume or the
 * tuner. Saving here sends nothing; the next scene tap carries it.
 */
export default function Vp4Setup({ caps, firmware }) {
  const start = readVp4Setup(kept())
  const [number, setNumber] = useState(start.sceneCc === null ? '' : String(start.sceneCc))
  const [channel, setChannel] = useState(String(start.midiChannel))
  const [said, setSaid] = useState(null)
  const [wrong, setWrong] = useState(null)
  /* Read again on every render, so a hold set by a scene tap shows when the page is next drawn. */
  const now = readVp4Setup(kept())
  const can = vp4ComputerCan(caps)
  const old = vp4OldFirmware(firmware)

  const save = () => {
    const r = saveVp4Setup(kept(), undefined, { sceneCc: number, midiChannel: channel })
    if (!r.ok) {
      setWrong(r.error)
      setSaid(null)
      return
    }
    setWrong(null)
    /* The number left empty saves the channel alone, for the presets (saveVp4Setup). */
    setSaid(r.setup.sceneCc === null ? VP4_SETUP.savedChannel : VP4_SETUP.saved)
  }
  const forget = () => {
    clearVp4Setup(kept())
    /* The channel stays: the presets go on it (clearVp4Setup). */
    setNumber('')
    setWrong(null)
    setSaid(VP4_SETUP.cleared)
  }

  return (
    <div className="access-tool">
      {can ? null : (
        <p className="save-error" role="status">
          {VP4_SETUP.update}
        </p>
      )}
      {old ? (
        <p className="save-error" role="status">
          {old}
        </p>
      ) : null}
      <p>{VP4_SETUP.intro}</p>
      <p className="hint">{VP4_SETUP.presets}</p>
      <p className="hint">{VP4_SETUP.reload}</p>
      <p className="silk-label setup-open-title">{VP4_SETUP.scenesHead}</p>
      <ol>
        {VP4_SETUP.steps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
      <p className="hint">
        <strong>{VP4_SETUP.freeNumber}</strong>
      </p>
      <label className="hint" htmlFor="vp4-scene-cc">
        {VP4_SETUP.numberLabel}
      </label>
      <input
        id="vp4-scene-cc"
        type="text"
        inputMode="numeric"
        className="access-email"
        maxLength={3}
        value={number}
        placeholder="1–119"
        onChange={(e) => setNumber(e.target.value)}
      />
      <label className="hint" htmlFor="vp4-midi-channel">
        {VP4_SETUP.channelLabel}
      </label>
      <input
        id="vp4-midi-channel"
        type="text"
        inputMode="numeric"
        className="access-email"
        maxLength={2}
        value={channel}
        placeholder="1"
        onChange={(e) => setChannel(e.target.value)}
      />
      <p className="hint">{VP4_SETUP.channelNote}</p>
      {now.held ? (
        <p className="save-error" role="status">
          {VP4_SETUP.heldNote(now.sceneCc)}
        </p>
      ) : null}
      {wrong ? (
        <p className="save-error" role="status">
          {wrong}
        </p>
      ) : null}
      {said ? (
        <p className="hint access-said" role="status">
          {said}
        </p>
      ) : null}
      <div className="history-actions">
        <button type="button" className="primary" onClick={save}>
          {VP4_SETUP.save}
        </button>
        {now.sceneCc !== null ? (
          <button type="button" className="chip" onClick={forget}>
            {VP4_SETUP.clear}
          </button>
        ) : null}
      </div>
    </div>
  )
}

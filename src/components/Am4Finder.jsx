import { useRef, useState } from 'react'
import { rawSysex, setEnum } from '../lib/forgefx'
import { SWEEP, activeDump, describe, differences, dumpFrom, getAllParams, valuesFrom } from '../../shared/am4-finder.mjs'

/**
 * THE AM4 FINDER — Justin's page, in the Mac app's own window only.
 *
 * "I thought we could do it ourselves without all that other stuff." Take a
 * snapshot, change ONE thing on the AM4 (its tempo, the metronome, a cab),
 * take another, and the page lists what moved. Copy that here and the
 * setting's address is known. Then Try a write puts a value at an address, to
 * prove it: if the AM4's screen follows, that is the setting.
 *
 * Reads only, until Try a write is pressed. The rules are shared/am4-finder.mjs.
 */
export default function Am4Finder() {
  const [first, setFirst] = useState(null)
  const [result, setResult] = useState('')
  const [busy, setBusy] = useState(null)
  const [copied, setCopied] = useState(false)
  const answering = useRef(null)
  const [write, setWrite] = useState({ eid: '', index: '', value: '' })
  const [wrote, setWrote] = useState('')

  /* Every id on the first snapshot; only the ones that answered after that. */
  const snapshot = async () => {
    const ids = answering.current || SWEEP
    const blocks = {}
    for (let i = 0; i < ids.length; i++) {
      setBusy(`Reading ${i + 1} of ${ids.length}…`)
      try {
        const values = valuesFrom(ids[i], await rawSysex(getAllParams(ids[i])))
        if (values) blocks[ids[i]] = values
      } catch {
        /* Nothing at this id, or the port was busy for a moment: skipped. */
      }
    }
    if (!answering.current) answering.current = Object.keys(blocks).map(Number)
    setBusy('Reading the edit buffer…')
    let dump = []
    try {
      dump = dumpFrom(await rawSysex(activeDump()))
    } catch {
      /* The block values are the main thing; a dump that did not come is said below. */
    }
    setBusy(null)
    return { at: Date.now(), blocks, dump }
  }

  const takeFirst = async () => {
    setResult('')
    setCopied(false)
    const a = await snapshot()
    setFirst(a)
    setResult(`Snapshot 1 taken: ${Object.keys(a.blocks).length} blocks answered, edit buffer ${a.dump.length ? `${a.dump.length} bytes` : 'did not come'}. Now change ONE thing on the AM4, then take snapshot 2.`)
  }

  const takeSecond = async () => {
    const b = await snapshot()
    setResult(describe(differences(first, b)))
    setFirst(b)
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(result)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  const tryWrite = async () => {
    const eid = Number(write.eid)
    const index = Number(write.index)
    const value = Number(write.value)
    if (![eid, index, value].every(Number.isFinite)) return setWrote('Fill in all three numbers first.')
    setWrote('Writing…')
    try {
      const res = await setEnum(eid, index, value)
      setWrote(res?.ok === false ? `The AM4 did not confirm it (${JSON.stringify(res)}). Look at its screen anyway.` : 'Sent. Did the AM4’s screen change?')
    } catch (err) {
      setWrote(`Didn’t send: ${err?.message || err}`)
    }
  }

  return (
    <div className="access-tool">
      <p className="footnote">
        1. Take snapshot 1. 2. Change one thing on the AM4 — its tempo, the metronome, a cab. 3. Take snapshot 2, then copy
        what changed and paste it into the chat. The first snapshot reads every address, so it takes about a minute; later
        ones are quicker.
      </p>
      <div className="history-actions">
        <button type="button" className="chip" disabled={!!busy} onClick={takeFirst}>
          {first ? 'Start again' : 'Take snapshot 1'}
        </button>
        <button type="button" className="chip" disabled={!!busy || !first} onClick={takeSecond}>
          Take snapshot 2
        </button>
        <button type="button" className="chip" disabled={!!busy || !result} onClick={copy}>
          {copied ? 'Copied' : 'Copy what changed'}
        </button>
      </div>
      {busy ? (
        <p className="footnote" role="status">
          {busy}
        </p>
      ) : null}
      {result ? <pre className="finder-result">{result}</pre> : null}

      <p className="silk-label setup-group">Try a write</p>
      <p className="footnote">Only when asked: puts one value at one address, to prove what it is.</p>
      <div className="history-actions">
        <input aria-label="Block" placeholder="Block" inputMode="numeric" value={write.eid} onChange={(e) => setWrite({ ...write, eid: e.target.value })} />
        <input aria-label="Value number" placeholder="Param" inputMode="numeric" value={write.index} onChange={(e) => setWrite({ ...write, index: e.target.value })} />
        <input aria-label="Set to" placeholder="Set to" inputMode="decimal" value={write.value} onChange={(e) => setWrite({ ...write, value: e.target.value })} />
        <button type="button" className="chip" disabled={!!busy} onClick={tryWrite}>
          Write it
        </button>
      </div>
      {wrote ? (
        <p className="footnote" role="status">
          {wrote}
        </p>
      ) : null}
    </div>
  )
}

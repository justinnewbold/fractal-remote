import { useEffect, useRef, useState } from 'react'
import { SHOTS_MAX, SHOT_WORDS, thumbSize, withShot } from '../../shared/report-rules.mjs'
import { forget, shrinkShot } from '../lib/shots'

/**
 * Screenshots for a report: Add a screenshot (a file picker for pictures),
 * what has been added as small pictures, each with its own Remove, and how
 * many more there is room for.
 *
 * "Where's the space to enter a message and upload photos?" Up to SHOTS_MAX,
 * each made smaller before it goes (lib/shots shrinkShot). `shots` is the
 * list and `onChange` takes a function of it, so two pictures picked at once
 * both land. Nothing here sends: the panel's own button hands the list to
 * lib/reports. `adding` hands files in from elsewhere (a picture pasted into
 * the note box), through the same door.
 */
export default function Shots({ shots = [], onChange, disabled = false, adding = null }) {
  const pick = useRef(null)
  const [said, setSaid] = useState('')
  const [busy, setBusy] = useState(false)
  const full = shots.length >= SHOTS_MAX

  const add = async (files) => {
    const list = [...(files || [])].filter(Boolean)
    if (!list.length) return
    setSaid('')
    setBusy(true)
    try {
      let room = SHOTS_MAX - shots.length
      for (const file of list) {
        if (room <= 0) {
          setSaid(SHOT_WORDS.full)
          break
        }
        const { shot, why } = await shrinkShot(file)
        if (shot) {
          room -= 1
          onChange((now) => {
            const next = withShot(now, shot)
            if (next === now) forget(shot)
            return next
          })
        } else setSaid(SHOT_WORDS[why] || SHOT_WORDS.unreadable)
      }
    } finally {
      setBusy(false)
    }
  }

  /* A picture pasted into the note box comes in here. */
  useEffect(() => {
    if (adding?.files?.length) add(adding.files)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adding])

  return (
    <div className="report-shots">
      {shots.length ? (
        <ul className="report-shots-list" aria-label="Screenshots to send">
          {shots.map((shot, i) => (
            <li key={shot.uri}>
              {/* The whole picture in its own shape, as the phone draws it: a wide window is not a strip from its middle. */}
              <img src={shot.uri} alt={`Screenshot ${i + 1}`} style={thumbSize(shot.width, shot.height, 72)} />
              <button
                type="button"
                className="chip"
                disabled={disabled}
                aria-label={`Remove screenshot ${i + 1}`}
                onClick={() => {
                  forget(shot)
                  onChange((now) => now.filter((s) => s !== shot))
                }}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="report-shots-add">
        <button type="button" className="chip" disabled={disabled || busy || full} onClick={() => pick.current?.click()}>
          {busy ? 'Adding…' : 'Add a screenshot'}
        </button>
        <span className="hint">{shots.length ? `${shots.length} of ${SHOTS_MAX} added` : SHOT_WORDS.limit}</span>
        <input
          ref={pick}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => {
            add(e.target.files)
            /* The same file picked twice is still a change. */
            e.target.value = ''
          }}
        />
      </div>
      {said ? <p className="hint problem">{said}</p> : null}
    </div>
  )
}

import { useState } from 'react'
import { useDevice } from '../lib/deviceState'
import { SCENES, SONG_BPM, songIn, songsWith, songWords, updateList } from '../lib/setlists'
import { slotLabel } from '../lib/slots'

/**
 * WHAT EACH SONG SETS UP — the setlist's songs, each with its scene and tempo.
 *
 * "Make each song set itself up when you pick it." Next and Previous land on a
 * song's preset and then put this scene and this tempo on the unit, so one tap
 * is the whole change between songs. Either half may be left as the preset
 * has it. The rules are in lib/setlists.js (songsWith, applySong).
 */
export default function SongSetup({ deviceKey, list, nameOf, addressing }) {
  const bpmNow = useDevice((s) => s.bpm)
  const [typing, setTyping] = useState({})
  if (!list || !list.presets.length) return null

  const save = (slot, patch) => updateList(deviceKey, list.id, { songs: songsWith(list, slot, patch) })
  const now = Number.isFinite(bpmNow) && bpmNow >= SONG_BPM.min && bpmNow <= SONG_BPM.max ? Math.round(bpmNow) : null

  return (
    <div className="setlist-find">
      <p className="hint">
        What each song sets up when Next or Previous lands on it. Leave a box empty and the song plays as its preset
        is saved.
      </p>
      <ol className="setlist-songs" aria-label={`Song setup for ${list.name}`}>
        {list.presets.map((n, i) => {
          const song = songIn(list, n) || {}
          const typed = typing[n] ?? (Number.isFinite(song.bpm) ? String(song.bpm) : '')
          const commit = () => {
            const raw = String(typed).trim()
            const bpm = raw === '' ? null : Math.round(Number(raw))
            setTyping((t) => ({ ...t, [n]: undefined }))
            if (bpm === null || (bpm >= SONG_BPM.min && bpm <= SONG_BPM.max)) save(n, { bpm })
          }
          return (
            <li key={n} className="setlist-song">
              <span className="setlist-song-pos mono">{i + 1}</span>
              <span className="setlist-song-name">
                <span className="mono setlist-song-slot">{slotLabel(n, addressing)}</span>
                <span>{nameOf(n) || 'Unnamed'}</span>
                {songWords(song) ? <span className="hint">{songWords(song)}</span> : null}
              </span>
              <span className="history-actions">
                <select
                  aria-label={`Scene for ${nameOf(n) || `preset ${n}`}`}
                  value={Number.isInteger(song.scene) ? String(song.scene) : ''}
                  onChange={(e) => save(n, { scene: e.target.value === '' ? null : Number(e.target.value) })}
                >
                  <option value="">Scene as saved</option>
                  {Array.from({ length: SCENES }, (_, k) => (
                    <option key={k} value={String(k)}>{`Scene ${k + 1}`}</option>
                  ))}
                </select>
                <input
                  type="number"
                  inputMode="numeric"
                  min={SONG_BPM.min}
                  max={SONG_BPM.max}
                  placeholder="BPM"
                  aria-label={`Tempo for ${nameOf(n) || `preset ${n}`}`}
                  value={typed}
                  onChange={(e) => setTyping((t) => ({ ...t, [n]: e.target.value }))}
                  onBlur={commit}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') e.currentTarget.blur()
                  }}
                />
                {now !== null ? (
                  <button type="button" className="chip" onClick={() => save(n, { bpm: now })}>
                    {`Use ${now}`}
                  </button>
                ) : null}
              </span>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

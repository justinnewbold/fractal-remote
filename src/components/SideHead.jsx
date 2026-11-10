/*
 * THE PRESET'S NAME AND SETLISTS, ON A PHONE HELD ON ITS SIDE.
 *
 * Upright they are a tile over the scenes and a button between Previous
 * and Next. On its side Play is two halves (lib/sidewaysPlay), and these
 * two are one short row: the preset over the scenes, Setlists over the
 * chain. Where that row is what holds the squares down, Play draws this
 * same row up in the top bar instead (`up`: TopBar's slot, beside the
 * version), smaller, and the squares get its height.
 *
 * It only draws. What a tap opens is Play's: the preset opens every
 * preset, Setlists opens the setlists, as their upright buttons do. The
 * words are theirs too (shared/play-words ALL_PRESETS; "Setlists" and the
 * list's name from Play).
 */
import { ALL_PRESETS } from '../../shared/play-words.mjs'
import chevronIcon from '../../mobile/assets/icons/chevron.png'
import Picture from './Picture'

export default function SideHead({ up = false, name, slot = null, count = 0, tag = null, said, onPickPreset, setlist, setlistOn = false, setlistWhere = '', setlistSaid, onSetlists }) {
  /* "047 of 512 · Tap for all presets" in the page; in the bar, where the room is the version's, the slot alone. */
  const where = slot ? `${slot}${count && !up ? ` of ${count}` : ''} · ${ALL_PRESETS}` : ALL_PRESETS
  return (
    <div className="side-head" data-up={up ? 'yes' : undefined}>
      <button type="button" className="side-chip side-preset" onClick={onPickPreset} disabled={!onPickPreset} aria-label={said}>
        {tag ? <span className="gig-name-tag side-chip-tag" aria-hidden="true" style={{ '--tag': tag }} /> : null}
        <span className="side-chip-words">
          <span className="side-chip-name">{name}</span>
          <span className="side-chip-sub">{where}</span>
        </span>
        <Picture src={chevronIcon} className="side-chip-chevron" />
      </button>
      <button type="button" className={`side-chip side-setlists ${setlistOn ? 'on' : ''}`} onClick={onSetlists} aria-label={setlistSaid}>
        <span className="side-chip-words">
          <span className="side-chip-kind">Setlists</span>
          <span className="side-chip-name">
            {setlist}
            {setlistWhere ? <span className="side-chip-pos mono"> {setlistWhere}</span> : null}
          </span>
        </span>
        {up ? null : <Picture src={chevronIcon} className="side-chip-chevron" />}
      </button>
    </div>
  )
}

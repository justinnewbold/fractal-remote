import { useEffect, useRef, useState } from 'react'
import { useDismiss } from '../lib/dismiss'
import { IR_HINT, USER_IRS_NOTE, findIrs } from '../../shared/cab-pick.mjs'

/*
 * How many rows the list draws. A bank holds up to 1024 IRs and all of them
 * at once is a panel that stutters while it opens; the rest are counted under
 * the list and found by typing.
 */
const SHOWN = 200

/**
 * Choosing a cab block's IR by name.
 *
 * "Pick a cab IR by name." The block's IR number and bank are off the knobs —
 * a knob turned across a thousand IRs is not a way to choose one — and until
 * this nothing had taken their place, so neither app could put an IR on a cab
 * at all. The banks come from the cab state and the names from the unit's IR
 * list (see irBanks in shared/cab-pick.mjs); the pick itself is the block
 * editor's, which writes it and offers the Undo.
 *
 * Laid out like the model picker above it, and for the same reasons: a list
 * that takes its own space rather than floating (a sheet clips floating
 * things), a search box, and one tall row per choice.
 */
export default function IrPicker({ banks, now, onPick, disabled }) {
  const [open, setOpen] = useState(false)
  const [bank, setBank] = useState(null)
  const [hunt, setHunt] = useState('')
  const box = useRef(null)
  const listRef = useRef(null)
  useDismiss(box, () => setOpen(false), { open })

  // Opened on the bank the block is on, at the IR it is on.
  useEffect(() => {
    if (!open) return
    listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'center' })
  }, [open, bank])

  const onBank = bank ?? now?.bank ?? banks[0]?.value ?? null
  const chosen = banks.find((b) => b.value === onBank)
  // Only worked out while the list is open: the panel redraws on every knob turn.
  const { rows, more } = open ? findIrs(banks, hunt, onBank, SHOWN) : { rows: [], more: 0 }
  const here = (r) => !!now?.playing && r.bank === now.bank && r.ir === now.ir

  return (
    <div className="type-pick ir-pick" ref={box}>
      <button
        type="button"
        className="type-open ir-open"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => {
          if (!open) {
            setHunt('')
            setBank(null)
          }
          setOpen(!open)
        }}
        disabled={disabled}
      >
        <span className="type-open-name">
          {now?.playing ? `IR · ${now.name}` : 'Pick an IR'}
        </span>
        {now?.playing && now.bankName ? <span className="ir-open-bank">{now.bankName}</span> : null}
        <span className="type-open-caret" aria-hidden="true">
          ⌄
        </span>
      </button>
      {now && !now.playing ? <p className="hint model-hint">{IR_HINT}</p> : null}

      {open ? (
        <>
          <div className="ir-banks" role="group" aria-label="IR bank">
            {banks.map((b) => (
              <button
                type="button"
                key={b.value}
                className={`chip ${b.value === onBank && !hunt.trim() ? 'active' : ''}`}
                aria-pressed={b.value === onBank}
                onClick={() => {
                  setBank(b.value)
                  setHunt('')
                  if (listRef.current) listRef.current.scrollTop = 0
                }}
              >
                {b.name}
              </button>
            ))}
          </div>
          <input
            type="text"
            className="type-search"
            value={hunt}
            placeholder="Search IRs by name or number"
            aria-label="Search IRs"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="none"
            spellCheck={false}
            onChange={(e) => {
              setHunt(e.target.value)
              if (listRef.current) listRef.current.scrollTop = 0
            }}
            onKeyDown={(e) => {
              // A pick is a sound change: it is a row you press, not Enter.
              if (e.key === 'Enter') e.preventDefault()
            }}
          />
          {chosen?.user && !hunt.trim() ? <p className="hint type-none">{USER_IRS_NOTE}</p> : null}
          {!rows.length ? <p className="hint type-none">Nothing named like that.</p> : null}
          {rows.length ? (
            <div className="type-list" role="listbox" aria-label="IR" ref={listRef}>
              {rows.map((r) => (
                <button
                  type="button"
                  key={r.key}
                  role="option"
                  aria-selected={here(r)}
                  className={`type-row ${here(r) ? 'current' : ''}`}
                  onClick={() => {
                    setOpen(false)
                    onPick({ bank: r.bank, ir: r.ir, name: r.name })
                  }}
                >
                  <span className="type-row-name">{r.name}</span>
                  {/* Which bank, when a search reaches across all of them. */}
                  {hunt.trim() ? <span className="type-row-gear">{r.bankName}</span> : null}
                </button>
              ))}
            </div>
          ) : null}
          {more > 0 ? <p className="hint type-none">{`${more} more — type a name or a number to narrow it down.`}</p> : null}
        </>
      ) : null}
    </div>
  )
}

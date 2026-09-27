/**
 * A few labelled facts, one to a line — the answers on Justin's own tools
 * (Customer lookup, Sales at a glance). The words come from shared/admin.mjs;
 * this only lays them out. The browser's copy of the phone's
 * mobile/src/components/Facts.js.
 *
 * A row that names somebody (`row.email`) can be clicked when `onRow` is
 * given, and `detail(row)` draws whatever belongs under the row that is open —
 * on Everyone with an account, the person's Copy / Give access / Take it back.
 * The phone opens a sheet for the same thing; a page of settings in a browser
 * has room to open it in place.
 */
export default function Facts({ title, rows, onRow, detail }) {
  if (!rows?.length) return null
  return (
    <div>
      {title ? <p className="facts-title">{title}</p> : null}
      <dl className="facts">
        {rows.map((row, i) => (
          <div className="facts-row" key={`${row.label}-${i}`}>
            {row.label ? <dt>{row.label}</dt> : null}
            <dd>
              {onRow && row.email ? (
                <button type="button" className="facts-pick" onClick={() => onRow(row)}>
                  {row.value}
                </button>
              ) : (
                row.value
              )}
              {detail ? detail(row) : null}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

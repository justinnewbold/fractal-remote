import { useId, useState } from 'react'

/**
 * A heading and the rows under it: one section of Settings, shut until it is
 * clicked. The phone's Group (mobile/src/screens/Settings.js), at this end.
 *
 * "Make it so each section under the settings menu is collapsible and
 * collapse by default. For example My rigs, Help, About, Play screen"
 * (Justin, 29 October 2026). The phone took it up that day; the browser's
 * Settings stayed one long scroll of small capital headings until 3
 * November 2026 ("Is there anything else we need to do to match the apps?
 * Settings menus?"). So the front of Settings is the account card and a short
 * list of headings, each saying in a green line what matters inside it
 * (`hint`, from shared/settings-words.mjs): My rig how the unit is connected,
 * About the version. Nothing that wants seeing is folded away unseen.
 *
 * Clicking a heading opens it; clicking it again shuts it. A screen reader
 * hears the heading as a button that is expanded or not, with the hint in
 * its name while it is shut, and the rows are not drawn at all while it is.
 *
 * `whileShut` is what stays in sight under the heading while the section is
 * shut, for a switch that must never be folded out of sight while it is on.
 */
export default function SetupGroup({ title, hint = null, whileShut = null, children }) {
  const [open, setOpen] = useState(() => OPEN.has(title))
  const body = useId()
  const toggle = () => {
    if (open) OPEN.delete(title)
    else OPEN.add(title)
    setOpen(!open)
  }
  return (
    <section className="setup-section" data-open={open ? 'yes' : 'no'}>
      <h3 className="setup-section-heading">
        <button
          type="button"
          className="setup-section-head"
          aria-expanded={open}
          aria-controls={open ? body : undefined}
          aria-label={open || !hint ? title : `${title}, ${hint}`}
          onClick={toggle}
        >
          <span className="setup-section-text">
            <span className="setup-section-title">{title}</span>
            {hint && !open ? <span className="setup-section-hint">{hint}</span> : null}
          </span>
          {/* The row's own chevron, turned down while the section is open. */}
          <span className="setup-section-chevron" aria-hidden="true">
            ›
          </span>
        </button>
      </h3>
      {open ? (
        <div className="setup-section-body" id={body}>
          {children}
        </div>
      ) : (
        whileShut
      )}
    </section>
  )
}

/*
 * Which sections are open, for as long as the page is: back in Settings, a
 * section opened a minute ago is still open. Every load starts them shut, as
 * every launch does on the phone.
 */
const OPEN = new Set()

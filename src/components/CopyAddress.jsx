import { useState } from 'react'

import { DOWNLOADS_URL } from '../../mobile/src/lib/downloadLink'
import { P6 } from '../../shared/onboarding.mjs'
import copyIcon from '../../mobile/assets/icons/copy.png'
import checkIcon from '../../mobile/assets/icons/check.png'

/**
 * THE DOWNLOADS ADDRESS ON A LINE OF ITS OWN, AND A TAP COPIES IT.
 *
 * The browser's half of mobile/src/components/CopyAddress.js (its `row
 * split` version), for Updating the computer app. Step 3 there sends
 * somebody to this address, and in the step card's narrow column it ran
 * past the card's edge at phone widths. Split anywhere but the slash it can
 * be typed as "/download", which the site answers with the web app rather
 * than the downloads page. Here it is two lines broken after the slash, in
 * type that shrinks only once the first line no longer fits
 * (`.updating-address` in styles.css), in the Connect a computer page's box
 * (`cc-address`). On one line it shrank to 10.8px on a 320-wide phone and
 * 13.7px on a 375-wide one, under the page's 15px.
 *
 * Copied, never opened, as on the phone: the page holds installers for a
 * computer, and this is most often a phone's browser.
 */
/* Just after the address's slash: "fractal.newbold.cloud/" and "downloads". */
const CUT = DOWNLOADS_URL.indexOf('/') + 1

/*
 * THE ADDRESS IN A SENTENCE, given one place to break: after its slash.
 * A browser keeps "fractal.newbold.cloud/downloads" whole, so in step 3's
 * card it ran up to 47px past the card's padding at 320 wide and out of the
 * screen. <wbr> is a place to break that adds nothing to the text, so a
 * person who copies the sentence copies the address as it is.
 */
export function withAddressBreak(text) {
  const at = text.indexOf(DOWNLOADS_URL)
  if (at < 0) return text
  return (
    <>
      {text.slice(0, at + CUT)}
      <wbr />
      {text.slice(at + CUT)}
    </>
  )
}

export default function CopyAddress() {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`https://${DOWNLOADS_URL}`)
      setCopied(true)
    } catch {
      /* No clipboard here (an old browser, or no permission): the address is on screen to read. */
    }
  }
  return (
    <div className="updating-address">
      <button type="button" className="cc-address" onClick={copy} data-copied={copied || undefined} aria-label={`${DOWNLOADS_URL}. ${P6.copyHint}`}>
        <span className="mono">
          <span className="updating-address-line">{DOWNLOADS_URL.slice(0, CUT)}</span>
          <span className="updating-address-line">{DOWNLOADS_URL.slice(CUT)}</span>
        </span>
        <span className="cc-copy">
          <span
            className="cc-pic"
            aria-hidden="true"
            style={{ WebkitMaskImage: `url(${copied ? checkIcon : copyIcon})`, maskImage: `url(${copied ? checkIcon : copyIcon})` }}
          />
        </span>
      </button>
      {copied ? <p className="cc-copied">{P6.copied}</p> : null}
    </div>
  )
}

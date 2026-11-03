/**
 * One of the phone's own white pictures (mobile/assets/icons), drawn in the
 * colour of the words beside it: a mask over currentColor, as the pedal
 * pictures are (Gig BlockTile). Silent: the button or heading it sits in says
 * what it is. The size is the caller's class (.cc-pic on Connect, the bar's
 * .gig-bar-icon on Play).
 */
export default function Picture({ src, className = '' }) {
  return (
    <span
      className={`picture ${className}`.trim()}
      aria-hidden="true"
      style={{ WebkitMaskImage: `url(${src})`, maskImage: `url(${src})` }}
    />
  )
}

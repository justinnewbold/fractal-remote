/**
 * The top of every page inside Settings: the way back on the left, Done on
 * the right, and the page's name under them. The phone's page head
 * (mobile/src/screens/Settings.js `head(title, 'back')`), at this end.
 *
 * TWO WAYS OUT, and they go to different places on purpose.
 *
 * "Add the done button to all submenus, and if they click done, it takes
 * them directly back to the play screen, no matter how deep they are in the
 * submenus" (Justin, of the phone). So Done leaves Settings from any depth.
 * The way back is one step: "‹ Settings", or the name of the page this one
 * sits under ("‹ Phone & computer"). The sheet's × and a swipe down go back
 * to the Settings list, as he asked of this end: "When you go deeper into the
 * settings menu have swiping down or clicking the X take you back to the
 * settings menu instead of the home screen." From a page under Phone &
 * computer (Demo Unit, the update steps) that is two steps, not one.
 *
 * Two rows rather than three things across one, as on the phone: the page's
 * name gets the width to itself, so "Rename presets and scenes" never has to
 * share a line with two buttons on a phone.
 */
export default function SetupHead({ back, onBack, onDone, title }) {
  return (
    <div className="setup-head">
      <div className="setup-head-row">
        <button type="button" className="setup-head-back" onClick={onBack}>
          {back}
        </button>
        <button type="button" className="setup-head-done" onClick={onDone}>
          Done
        </button>
      </div>
      <h2 className="setup-page-title">{title}</h2>
    </div>
  )
}

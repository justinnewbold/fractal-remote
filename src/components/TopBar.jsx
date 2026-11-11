import { useEffect, useState } from 'react'
import { isDemo, demoUnit } from '../lib/forgefx'
import { demoSentence, unitByKey } from '../lib/demoUnits'
import { describePill } from '../lib/link'
import { presetLabel } from '../lib/presetName'
import { FULL, VERSION } from '../lib/version'
import { useAsks } from '../lib/asks'
import LinkChip from './LinkChip'

/**
 * One line, above everything, in every state: the phone's bar, in a browser.
 *
 * What it replaced: a wordmark, a sentence explaining the app to someone
 * already using it, a version badge, a collapsible device bar, a status line,
 * and a save cluster — six stacked elements, about 290px, before the first
 * thing anyone came here to do.
 *
 * THE PHONE'S BAR SINCE 3 NOVEMBER 2026. "Looks like we need to update the
 * web version top tab bar to match the apps." It had the lamp and the unit at
 * one end and the link's word, CONNECTED, at the other, while the phone's had
 * been one pill since 24 October. So, left to right, as on the phone
 * (mobile/src/components/TopBar.js): the version; the pill (the state in a
 * word, the lamp, the unit, and the computer under them); Unlock or Exit demo
 * in the demo; Save while there is something to save; the speaker; and the
 * gear. The computer app's own window keeps two things of its own: the
 * preset on a wide Edit, and the switch for phones, which is the computer's
 * and has nothing like it on the phone.
 *
 * Sticky rather than fixed. A fixed bar is pinned to the layout viewport, which
 * on iOS means the keyboard slides underneath it and the page scrolls behind
 * it; sticky moves with the document and needs none of the compensation the
 * assistant already carries for its own input.
 *
 * It renders at every status, including none. The gear is how you reach the
 * host address and the sign-in when nothing is connected, which is exactly when
 * you need them — and the one place the browser's bar shows where the phone's
 * does not, since the phone draws none until somebody is signed in.
 */
export default function TopBar({
  status,
  device,
  /* In the demo, for somebody who has not paid: the unlock, and what it
     costs. Null when there is nothing to sell them. */
  onUnlock = null,
  unlockPrice = null,
  /* "7 Day Free Trial", over Unlock, where the free trial is offered; null elsewhere. */
  unlockTrial = null,
  /* In the demo, for somebody who HAS paid: the way back to their own rig. */
  onExitDemo = null,
  /* Which kind of fault this is, so the pill says Not answering or No unit
     about the thing that is actually missing. See unitStateOf. */
  faultReason = null,
  preset,
  onOpenPresets,
  onOpenSettings,
  /*
   * The pill, pressed, and where App says that goes (`unitGoes`): the five
   * demo units in the demo, Which unit with two computers and the link up,
   * and Phone & computer otherwise. The phone's three, decided once in App
   * so the tap and what a screen reader is told cannot disagree.
   */
  onOpenUnit,
  unitGoes = 'link',
  /* Given only when there is an output level to move — see the speaker below. */
  onOpenVolume,
  /* The link as the bar says it: held through a stretch of looking (useHeldLink). */
  link,
  onLinkAction,
  presetsOpen,
  menu,
  /*
   * Whether the bar carries the preset at all. On Play the preset is a tile
   * the width of the screen, right under this bar — "remove the preset name
   * from the header, it's already a button on the screen" — and the bar
   * gains the room. Edit and Create have no tile, so there it stays.
   */
  showPreset = true,
  /* Save, Saving… or ✓ Saved is in the bar: on a phone the version gives it the room, as the phone's does. */
  saveUp = false,
  /*
   * A phone's browser on its side, with Play on show (App `sideUp`,
   * lib/sidewaysPlay): the bar is slimmer, and `headSlot` (a ref) is the
   * place Play may draw the preset's name and Setlists into, beside the
   * version, when that buys it bigger squares (components/SideHead).
   */
  sideways = false,
  headSlot = null,
  children
}) {
  const demo = isDemo()
  const narrow = useAsks('(max-width: 620px)')

  /*
   * The pill's words and its lamp, in link.js where they can be tested
   * (describePill): the phone's words from shared/pill-words.mjs, the
   * phone's lamp rule, and the computer by the name it gives itself.
   */
  const pill = describePill({
    demo,
    role: link?.role,
    link: link?.link,
    status,
    device,
    reason: faultReason,
    macName: link?.macName,
    demoName: demo ? unitByKey(demoUnit()).name : ''
  })
  const lampState = pill.lamp
  /* Where the pill goes, in words, for a screen reader: the phone's words (TopBar.js pillGoes). */
  const goes = demo ? 'Change the demo unit' : unitGoes === 'which' ? 'Which unit' : 'Phone and computer'
  const said = [pill.status, pill.unit, pill.where].filter(Boolean).join(', ')
  /*
   * What the polite region says, and only while it is news: the words go in
   * when the pill changes and come out a few seconds later. Left in, they
   * were a second copy of the pill's own label, read out again by anybody
   * swiping through the bar. The phone's bar is the live region itself and
   * has no copy; a button's label cannot be one here, so this is the nearest.
   */
  const heard = useNews(said)

  /*
   * UNLOCK for anybody in the demo who has not paid — the phone's rule, and
   * his: "when someone's on the demo, it should always say unlock, and then
   * the price at the top". Somebody who owns it gets Exit demo instead,
   * because offering an unlock to a person who has paid sends them to a page
   * with nothing on it for them. App decides both (onUnlock, onExitDemo).
   */
  const canBuy = demo && Boolean(onUnlock)
  const canLeave = demo && !canBuy && Boolean(onExitDemo)

  /*
   * Whether the preset is actually in this row, which is not the same question
   * as whether there is a preset. On Play the preset is the tile below rather
   * than anything in this bar, and the bar keeps its room for the pill.
   */
  const presetInBar = status === 'live' && showPreset

  /*
   * The computer's switch for phones (below), in its own window. It steps
   * aside on a narrow window while Save, Saving… or ✓ Saved is up, as the
   * version does: at the window's narrowest (380px) the switch and Save
   * together cut the unit's name to "Axe-F…". It is one more thing than the
   * phone's bar ever has, the pill already says "on this computer", and
   * Phone & computer still has the switch; it is back when the save is done.
   */
  const showSwitch = link?.role === 'mac' && !demo && !(narrow && saveUp)

  return (
    <div className="topbar"
      data-status={demo ? 'demo' : lampState}
      data-preset={presetInBar ? 'yes' : 'no'}
      data-sideways={sideways ? 'yes' : undefined}
    >
      <div className="topbar-row">
        {/*
          The version, first, where it can be read without opening anything.

          "The app version number is listed only in settings. I like to always
          know easily what version we are working on." On the left, as on the
          phone, taking the slack: it is the one thing in the row that can
          give, and it gives first. On a phone it steps aside while Save,
          Saving… or ✓ Saved needs the room (it is in Settings too), swapped
          here rather than hidden with a style, which a test forbids. Swapped
          for nothing, not for an empty spacer as the phone's is: a spacer is
          one more thing in the row, and the 12px gap beside it was 12px the
          unit's name went short of ("Axe-Fx I…" beside Unlock and Save on a
          390-wide phone). The pill holds the right without it (margin-left:
          auto). It carries the same title as Setup's line, so a hover still
          gives the commit.
        */}
        {narrow && saveUp ? null : (
          <span className="topbar-version mono" title={FULL}>
            v{VERSION}
          </span>
        )}
        {/* Empty until Play puts its preset row here; nothing at all anywhere but a phone on its side. */}
        {sideways ? <span className="topbar-sidehead" ref={headSlot} /> : null}

        {/*
          THE PILL: WHICH UNIT, ON WHICH COMPUTER, AND THE WAY TO ANOTHER.

          It takes the place of three things: the bare lamp, the unit's name,
          and the word CONNECTED at the other end of the bar. A frozen FM3
          under a green lamp is what the two ends were split for, and they
          still do not share a verdict inside one pill: Live only while the
          unit answers, Not answering or No unit in red when it does not, and
          the lamp red too while the computer is out of reach.

          A transparent 44px box around a face the phone's size, so it is a
          target under a thumb without being a badge across the bar.
        */}
        <button className="topbar-unit" onClick={onOpenUnit} aria-label={`${said}. ${goes}`}>
          <span className="topbar-unit-face">
            <span className="topbar-unit-line">
              <span className="topbar-unit-state" data-mark={pill.mark}>
                {pill.status}
              </span>
              {/* Not in the demo: its lamp says nothing there, and on a narrow phone its room is the unit's name. */}
              {demo ? null : <span className="lamp" data-state={lampState} />}
              {pill.unit ? <span className="topbar-unit-name">{pill.unit}</span> : null}
            </span>
            {/*
              The computer, on a line of its own. The face is two lines tall
              whatever is said (styles.css), so the bar is one height; where
              there is nothing to say (No computer, on the sign-in screen) the
              one line sits in the middle of it rather than over an empty one.
            */}
            {pill.where ? <span className="topbar-unit-where">{pill.where}</span> : null}
          </span>
        </button>
        {/* Said again when it changes, politely, from the held link, so a screen reader is not read every retry; empty again once it has been said (useNews). */}
        <span className="topbar-said" aria-live="polite">
          {heard}
        </span>

        {/*
          THE WAY INTO THE PAID APP, OR OUT OF THE DEMO, beside the pill that
          says Demo. Filled amber: in this bar it is the one thing anybody is
          being asked to DO, and an outline would read as one more label.

          Unlock with the price under it, as on the phone: "Unlock $9.99" in
          one line took the demo unit's name off a 360-wide phone, and before
          the price is known, Unlock alone is still the way in. In the browser
          it takes a card (lib/webPurchase.js), asking for the sign-in first.
        */}
        {canBuy ? (
          <button className="topbar-pill is-unlock" onClick={onUnlock} aria-label="Unlock the full version" title={demoSentence(demoUnit())}>
            <span className="topbar-pill-face">
              {unlockTrial ? <span className="topbar-pill-trial">{unlockTrial}</span> : null}
              <span>Unlock</span>
              {unlockPrice ? <span className="topbar-pill-price">{unlockPrice}</span> : null}
            </span>
          </button>
        ) : canLeave ? (
          /* His words: "have it just clearly say exit demo if they're in the demo and they've already paid." */
          <button className="topbar-pill is-exit" onClick={onExitDemo} aria-label="Exit demo">
            <span className="topbar-pill-face">Exit demo</span>
          </button>
        ) : null}

        {/* The preset is a button because it's the thing you change most, and
            because a slot number nobody can act on is trivia. A wide Edit
            only: on Play the tile under the bar is the same button. */}
        {presetInBar ? (
          <button
            className={`topbar-preset ${presetsOpen ? 'open' : ''}`}
            onClick={onOpenPresets}
            aria-label="Choose a preset"
            aria-expanded={!!presetsOpen}
          >
            {/* One line inside the button, so the slot and the name share a
                baseline while the line itself sits in the middle of a button
                that the touch floor makes 44px tall. Baseline-aligned children
                of the button sat at its top edge — the name rode high beside
                Save and the gear on every phone. */}
            <span className="topbar-preset-line">
              <span className="topbar-slot mono">
                <span className="sr-only">Preset </span>
                {preset?.number ?? '--'}
              </span>
              <span className="topbar-name">{presetLabel(preset)}</span>
              <span className="topbar-caret" aria-hidden="true" />
            </span>
          </button>
        ) : null}

        {/* The Save button says whether there is anything to save; there is
            no separate word for it any more. */}
        {children}

        {/*
          The switch for phones, at the computer only: CONNECTED or NO REMOTE,
          and Turn on, Turn off or Set up under it. It is the computer's own,
          about whether a phone can reach it, and the phone has nothing like
          it. Never over the relay, where the pill says the link and Phone &
          computer has Disconnect, Try now and Connect; and never in the
          demo, where no computer is really there to switch.
        */}
        {showSwitch ? <LinkChip compact link={link} onAction={onLinkAction} /> : null}

        {/*
          The volume, behind a speaker rather than across the top of Play.

          "Can we set that to be a slide-up menu? Put a sound button that looks
          like a speaker in the header, and when it's tapped you can slide the
          volume left or right or do the plus minus thing."

          Absent, not disabled, on a preset whose output block the app cannot
          reach: a speaker that opens an empty sheet is worse than no speaker.
        */}
        {onOpenVolume ? (
          <button className="topbar-volume" onClick={onOpenVolume} aria-label="Volume">
            {/* Drawn rather than an emoji: a colour emoji at this size is a
                smudge. currentColor, so it takes the bar's ink in both themes. */}
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path
                d="M4 9.5h3.5L12 5.5v13L7.5 14.5H4z"
                fill="currentColor"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinejoin="round"
              />
              <path
                d="M15.5 9.2a4 4 0 0 1 0 5.6"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
              <path
                d="M18.2 6.6a7.7 7.7 0 0 1 0 10.8"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
          </button>
        ) : null}

        {/*
          Setup is a sheet, not a fold under the bar: it carries the host
          address, the sign-in, the ports and the diagnostics.

          THE GEAR IS THE PHONE'S PICTURE, not the ⚙ character. The character
          is drawn by whatever font the device has, and on an iPhone that is
          Apple's own gear, so his two screenshots showed two different gears.
          This is mobile/assets/icons/setup.png, the gear cut out of his
          mockup of the play screen, traced: eight teeth, a ring, and the dot
          in the middle, with the ring cut out (evenodd) rather than painted,
          so it is the bar's ink on any ground.
        */}
        <button
          className="topbar-gear"
          onClick={onOpenSettings}
          aria-label="Connection and setup"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path
              fill="currentColor"
              fillRule="evenodd"
              d="M19.34 10.45L21.5 10.65Q22.1 10.65 22.1 11.25L22.1 12.75Q22.1 13.35 21.5 13.35L19.34 13.55A7.5 7.5 0 0 1 18.28 16.09L19.67 17.76Q20.1 18.19 19.67 18.61L18.61 19.67Q18.19 20.1 17.76 19.67L16.09 18.28A7.5 7.5 0 0 1 13.55 19.34L13.35 21.5Q13.35 22.1 12.75 22.1L11.25 22.1Q10.65 22.1 10.65 21.5L10.45 19.34A7.5 7.5 0 0 1 7.91 18.28L6.24 19.67Q5.81 20.1 5.39 19.67L4.33 18.61Q3.9 18.19 4.33 17.76L5.72 16.09A7.5 7.5 0 0 1 4.66 13.55L2.5 13.35Q1.9 13.35 1.9 12.75L1.9 11.25Q1.9 10.65 2.5 10.65L4.66 10.45A7.5 7.5 0 0 1 5.72 7.91L4.33 6.24Q3.9 5.81 4.33 5.39L5.39 4.33Q5.81 3.9 6.24 4.33L7.91 5.72A7.5 7.5 0 0 1 10.45 4.66L10.65 2.5Q10.65 1.9 11.25 1.9L12.75 1.9Q13.35 1.9 13.35 2.5L13.55 4.66A7.5 7.5 0 0 1 16.09 5.72L17.76 4.33Q18.19 3.9 18.61 4.33L19.67 5.39Q20.1 5.81 19.67 6.24L18.28 7.91A7.5 7.5 0 0 1 19.34 10.45ZM6.6 12a5.4 5.4 0 1 0 10.8 0a5.4 5.4 0 1 0 -10.8 0ZM9.2 12a2.8 2.8 0 1 0 5.6 0a2.8 2.8 0 1 0 -5.6 0Z"
            />
          </svg>
        </button>
      </div>

      {/*
        The preset menu hangs off the bar rather than off the button, for the
        same reason the save popover does: the button sits mid-row, and a menu
        anchored to it runs off the edge of a phone. The bar spans the screen.
      */}
      {menu}
    </div>
  )
}

/**
 * The words a polite live region should say: `said` once it has changed, and
 * nothing again a few seconds later, so the region is news rather than a
 * second copy of what is already on the screen. Nothing on the first draw:
 * a region is heard when it changes, and the first words are the pill's own
 * label, which a screen reader reaches anyway.
 */
const NEWS_MS = 3000
function useNews(said) {
  const [news, setNews] = useState({ said, heard: '' })
  useEffect(() => {
    if (news.said !== said) setNews({ said, heard: said })
  }, [said, news.said])
  useEffect(() => {
    if (!news.heard) return undefined
    const id = setTimeout(() => setNews((n) => ({ ...n, heard: '' })), NEWS_MS)
    return () => clearTimeout(id)
  }, [news])
  return news.heard
}

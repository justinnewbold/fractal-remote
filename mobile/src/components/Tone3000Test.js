/*
 * TONE3000 IN THE APP: Developer → TONE3000, his account only.
 *
 * THE LIST IS THE APP'S OWN, since 14 November 2026: "It to look like that
 * and function like that. Not just going off a built-in web browser in our
 * app but actually native in our app using the API" (Justin, with a
 * picture of the Tones tab of his HeadRush app). So signed in, this opens
 * on components/Tone3000Browser: a search box, chips for the order and the
 * kind of gear, and a row for each tone, asked of TONE3000's search by the
 * phone. A tap on a tone shows it here with its captures, laid out as that
 * tab lays a tone out ("And then, after clicking on one, it has a preview
 * and a get button", with its picture, the same day): the title with Back
 * beside it, the picture with who made it, the gear and the description,
 * and each capture on a line with PREVIEW and GET.
 *
 * WHAT THE TWO BUTTONS DO HERE IS NOT WHAT THEY DO ON A HEADRUSH, and the
 * steps say so. That board is on the internet and plays a capture without
 * keeping it. An Axe-Fx III plays only what is in one of its capture
 * slots, so here BOTH put the capture in the unit's first empty slot:
 * Preview then points NAM 1 at it, so it is heard through the rig at once;
 * Get leaves what is playing alone (Play it in NAM 1 / NAM 2 are offered
 * under it). A capture the app has put on the unit since it was opened
 * says where it is and is not sent a second time, on this view or after
 * Back and the same tone again. TONE3000's own
 * page (Browse TONE3000) is still one tap away on every view, which is its
 * rule for an app that lists its tones itself: "Always provide a clear,
 * persistent path to browse the full TONE3000 catalog via the Select flow."
 *
 * WHAT TONE3000 ASKS OF A LIST LIKE THIS (its Design Requirements,
 * tone3000.com/api), and where each is kept: before a sign-in, a card
 * saying what this is, and Continue (PARTNER, below); the sign-in is
 * TONE3000's own page (email, then a code it sends); the list shows each
 * tone's picture, title, kind of gear, format and maker, with TONE3000's
 * name on the view and whose sign-in it is (the name and picture across
 * the top); a tone's own view shows its picture, title, kind, format,
 * maker and description, and its captures to choose between.
 * NOT YET, and wanted before TONE3000 signs off anything a customer sees:
 * its Favorites, Created and Downloaded lists; its logo in place of its
 * name in type; the way in from where a capture is chosen (Edit's NAM
 * block) rather than a Developer page; its mark on a block that plays one.
 *
 * AS IT BEGAN, 13 November 2026:
 *
 * "Next I want to add TONE3000 so users can search, preview and download
 * tones for the NAM block directly in the app." (Justin, 13 November 2026.)
 * This is the part that needs nothing from a unit: sign in, browse and
 * audition on TONE3000's own page, and the tone picked shows with its
 * creator, its licence and its captures. The page comes up inside the app
 * on a copy built with the web view (components/Tone3000Page, lib/
 * tone3000Parts), and in the device's browser, coming back here by the
 * app's own link, on every copy built before it. A capture can be fetched
 * and checked: what kind it is, how many numbers are in it, and about what
 * sending it to a unit would take.
 *
 * AND A CAPTURE CAN BE SENT TO AN AXE-FX III (lib/nam-install: Axe-Edit
 * III's own messages, from a recording of it, 13 November 2026), over
 * Bluetooth or the unit's USB cable into this device, or, since 14 November
 * 2026, through the computer or the Raspberry Pi, whichever the device is
 * connected by (lib/device decides; this card asks the same three calls).
 * It goes into the first empty slot, the app never writes over a capture
 * unless that slot was left half-sent by this card over the device's own
 * wire (the computer never writes over one at all), and NAM 1 or NAM 2 can
 * then be pointed at it. Nothing is saved on the unit: the preset is saved
 * the usual way.
 *
 * ONE BUTTON DOES THE WHOLE OF IT, since 14 November 2026: "How do we
 * preview the file live? ... this whole screen is confusing to me. What am
 * I supposed to be doing?" (Justin, after his first send.) So the card says
 * its steps in order, each capture has one button that fetches it, sends it
 * and points NAM 1 at it, and what the unit said of the slot and of the
 * block each keep a line of their own. A slot the unit still calls
 * "<EMPTY>" after a send is said as not kept, with no Play button: his
 * first send ended "NAM 1 is playing “<EMPTY>” now", which told him
 * nothing (lib/nam-install has what was wrong with that send).
 *
 * On a page only his account has, so it is his alone without a switch of
 * its own; it gets one (lib/features) when it moves to where a player meets
 * it. TONE3000's terms: everything browsed is its own page under its own
 * name, the creator and licence are always shown, and a capture is fetched
 * only when it is asked for.
 */
import { useEffect, useRef, useState } from 'react'
import { Image, Pressable, Text, View } from 'react-native'
import { color, font, radius, space, TAP } from '../lib/theme'
import { tick } from '../lib/feedback'
import { deviceNoun } from '../lib/device-word'
import { logDebug } from '../lib/debugLog'
import { gearSaid, readCallback, T3K_POWERED, toneCredit } from '../lib/tone3000'
import { creatorImage, creatorOf, makesOf, toneBrowser, toneImage } from '../lib/tone3000Browse'
import { hostPage, onTone3000Return, pageInApp, startOutside, t3k } from '../lib/tone3000Here'
import { namSaid, readNam } from '../lib/nam-file'
import { NAM_BLOCKS, NAM_EMPTY, namRecord, namSlotSaid } from '../lib/nam-install'
import { sendCapture } from '../lib/captureSend'
import { namEmptySlotHere, namInstallHere, namPickHere } from '../lib/device'
import Avatar from './Avatar'
import Note from './Note'
import Press from './Press'
import Tone3000Browser from './Tone3000Browser'
import Tone3000Page from './Tone3000Page'
import playIcon from '../../assets/icons/play.png'
import saveIcon from '../../assets/icons/save.png'

/** A capture's name, as TONE3000 gives it. */
export const captureLabel = (m) => (m?.name ? String(m.name) : `Capture ${m?.id}`)

/** What to do here, in order: the card's first lines. */
export const STEPS = Object.freeze([
  'Search here, or pick an order and a kind of gear. Only tones the Axe-Fx III’s NAM block can play are listed. Tap one to see its captures.',
  'Each capture has two buttons. Preview puts it on the Axe-Fx III and plays it in NAM 1, so you hear it through your own rig. Get puts it on the unit and leaves what you are playing alone.',
  'Either way it goes into the unit’s first empty capture slot and stays there: the Axe-Fx III can only play a capture that is in a slot. It takes about half a minute over Bluetooth, a second or two through the computer or by USB.',
  'Browse TONE3000 opens TONE3000’s own page, which has play buttons: what you hear there is its own demo recording, not your rig.'
])
export const STEPS_FOOT = 'For Preview, the preset you are on needs NAM 1 in it (with only NAM 2 there, Play it in NAM 2 is under the capture once it is on the unit). Which NAM block plays a capture is not saved until you save the preset, and a capture already on the unit is never written over.'
/**
 * Before a sign-in: what this is, in the words TONE3000 gives an app for it
 * (its Design Requirements, "Partnership splash"), with the app's name in
 * and the impulse responses out, since only captures are listed here.
 */
export const PARTNER = 'Fractal Remote has partnered with TONE3000 to give you access to a massive library of Neural Amp Modeler (NAM) captures of real analog gear, created by a global community of musicians.'
/** Read when it is shown: it names the device in hand. */
export const partnerMore = () => `Continue opens TONE3000’s own sign-in: your email, then a code it sends you. After that it stays signed in on this ${deviceNoun()}.`
export const CONTINUE = 'Continue'
export const BACK_TO_LIST = '‹ Back'
/** The two buttons on a capture's line, as on the HeadRush app's tone view. */
export const PREVIEW = 'Preview'
export const GET = 'Get'
/** Over a tone's captures: the kind listed, and why only that kind. */
export const CAPTURES_HEAD = 'A2 captures (the kind the NAM block plays)'
/** Under it, on the view itself and not only behind the ⓘ: on this unit a preview is kept. Five previews are five slots. */
export const CAPTURES_NOTE = 'Preview and Get both put the capture in an empty slot on the unit, and it stays there. Preview also plays it in NAM 1.'
/** TONE3000 no longer takes the sign-in kept here. */
export const SIGN_IN_AGAIN = 'Your TONE3000 sign-in has run out. Tap Continue to sign in again.'
export const HOW_IT_WORKS = 'How it works'
/** Only where the page comes up inside the app: the way round a sign-in that will not work there. */
export const BROWSE_OUTSIDE = 'Open TONE3000 in the browser instead'
export const BROWSE_OUTSIDE_SUB = 'If its page will not work inside the app'
/** While the return is being finished with TONE3000, which the page inside the app has already closed for. */
export const COMING_BACK = 'Coming back from TONE3000…'

/*
 * ONE SEND AT A TIME, WHOEVER DRAWS THE CARD. A send goes on after the card
 * is left (half a minute over Bluetooth), and a card opened again starts
 * with nothing busy: its buttons would be live over a send still going. The
 * wire refuses a second one, the computer does not. So the fact is kept
 * here, outside any one drawing of the card.
 */
let atWork = 0
/*
 * When the send in hand began, or 0. Not a plain yes: a request that never
 * came back (nothing here is known to do that, but a relay can) would close
 * the card until the app was restarted. A send takes under a minute over
 * Bluetooth, so after five it is taken to be over. Each run clears only its
 * own mark, so an old one ending late cannot open the card under a new one.
 */
const STILL_GOING_MS = 5 * 60 * 1000
const goingNow = () => atWork !== 0 && Date.now() - atWork < STILL_GOING_MS
export const STILL_GOING = 'A capture is still going to the unit. Tap again when it has finished.'
/** A tone picked on TONE3000's page while a capture is going: opening it would put its view, and its buttons, over the send's. */
export const PICK_AFTER_SEND = 'A capture is still going to the unit, so that tone wasn’t opened. Pick it again when it has finished.'

/*
 * EVERY RETURN OF TONE3000'S THAT HAS BEEN TAKEN UP, for as long as the app
 * runs, not for one drawing of the card. The phone hands the link that
 * STARTED the app back every time it is asked (lib/tone3000Here asks at each
 * drawing), so a card opened again was handed an old return again; finishing
 * it throws away whatever sign-in is under way at that moment (lib/tone3000
 * forgets the one-time word before it looks at the return), and the real
 * return, minutes later, found nothing waiting. The page inside the app and
 * the phone's own link can also each hand over the same one.
 */
const taken = new Set()

/*
 * THE CAPTURES THIS APP HAS PUT ON THE UNIT, AND WHERE, for as long as the
 * app runs: TONE3000's capture id to { slot, sure }. Not one drawing of a
 * tone's view: Back and the same tone again would offer Preview and Get on
 * a capture that is already there, and a second copy takes a second slot,
 * which nothing in the app can give back. `sure` is whether the unit said,
 * after the send, that the slot holds it; where it did not say, the line
 * reads "Sent to slot", never "On the unit". One is forgotten only when the
 * unit names its slot <EMPTY>.
 */
const placed = new Map()
const placedNow = () => Object.fromEntries(placed)

/**
 * One of the two buttons on a capture's line: a small picture and a word,
 * Get lit as the HeadRush view's is. `says` is what a screen reader reads,
 * which is what the button does and to which capture.
 */
function LineButton({ icon, label, says, lit = false, disabled, onPress }) {
  const ink = lit ? color.chassis : color.silk
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={says}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={() => {
        tick()
        onPress()
      }}
      style={({ pressed }) => ({
        minHeight: TAP,
        paddingHorizontal: space.md,
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.xs + 2,
        borderWidth: 1,
        borderRadius: radius.md,
        borderColor: lit ? color.silk : color.rule,
        backgroundColor: lit ? color.silk : pressed ? color.panelHi : color.panel,
        opacity: disabled ? 0.5 : pressed ? 0.8 : 1
      })}
    >
      <Image source={icon} accessible={false} style={{ width: 16, height: 16, tintColor: ink }} />
      <Text maxFontSizeMultiplier={1.4} style={{ color: ink, fontSize: font.body, fontWeight: '700' }}>
        {label}
      </Text>
    </Pressable>
  )
}

export default function Tone3000Test() {
  /* null until the device has said whether a sign-in is kept: neither the list nor the sign-in card is drawn on a guess. */
  const [signedIn, setSignedIn] = useState(null)
  /* Whose sign-in it is, as TONE3000 has them: shown across the top (its rule for a list of its tones). */
  const [me, setMe] = useState(null)
  /* The steps, behind the ⓘ. */
  const [info, setInfo] = useState(false)
  const alive = useRef(true)
  /* Which fetch of a tone is the one wanted: a tone left (Back) while it was being fetched does not come back up when its answer lands. */
  const wanted = useRef(0)
  /*
   * TONE3000 says the sign-in is gone (it ran out and could not be renewed,
   * or was taken back on its site): the card goes back to its sign-in view
   * and says why, in place of a list that can only fail. The error still
   * goes to whoever asked.
   */
  const whenSignedOut = (err) => {
    if (err?.status === 401 && alive.current) {
      list.current = newList()
      /* A tone being fetched is dropped, and its "busy" with it: the fetch's own ending no longer clears it (it is not the one wanted), and Continue would stay greyed for good. */
      wanted.current += 1
      setBusy((was) => (was === 'tone' ? null : was))
      setSignedIn(false)
      setTone(null)
      setModels(null)
      setFault('')
      setSaid(SIGN_IN_AGAIN)
    }
    throw err
  }
  const newList = () => toneBrowser({ search: (what) => t3k.search(what).catch(whenSignedOut), feed: (which, gear) => t3k.feed(which, gear).catch(whenSignedOut) })
  /* The list, for as long as this card is up: opening a tone and coming back does not ask TONE3000 for it again. */
  const list = useRef(null)
  if (!list.current) list.current = newList()
  const [busy, setBusy] = useState(null)
  const [fault, setFault] = useState('')
  const [said, setSaid] = useState('')
  const [tone, setTone] = useState(null)
  const [models, setModels] = useState(null)
  /* What each capture fetched turned out to be, by its id. */
  const [checked, setChecked] = useState({})
  /* A fetched capture's text, by its id, for as long as this card is up and no longer: it is what gets sent. Never written down. */
  const texts = useRef({})
  /* The send in hand: { id, line, slot, done, again, played, play }. `line` is what became of the send, `played` what the NAM block said, `play` whether it was Preview's. */
  const [send, setSend] = useState(null)
  /* What the app has put on the unit (`placed`, above), as this drawing sees it: { id: { slot, sure } }. */
  const [onUnit, setOnUnit] = useState(placedNow)
  const place = (id, slot, sure) => {
    placed.set(String(id), { slot, sure })
    if (alive.current) setOnUnit(placedNow())
  }
  const unplace = (id) => {
    placed.delete(String(id))
    if (alive.current) setOnUnit(placedNow())
  }
  /* A send that stopped part-way, by capture: { again, fill, play, line }. Kept apart from the send in hand, which a Play under another capture takes over. */
  const [stopped, setStopped] = useState({})
  /* Which of a capture's two buttons was tapped, for the word on it while it works: 'play' or 'keep'. */
  const [tapped, setTapped] = useState(null)
  /* TONE3000's page, while it is up inside the app: its address, or null. */
  const [page, setPage] = useState(null)
  /* Asked again at each sign-in that finishes: a pick on TONE3000's page can come back under another account. */
  const [meAsk, setMeAsk] = useState(0)

  const load = async (toneId) => {
    const mine = ++wanted.current
    setBusy('tone')
    setFault('')
    try {
      const [got, captures] = await Promise.all([t3k.tone(toneId).catch(whenSignedOut), t3k.models(toneId).catch(whenSignedOut)])
      if (!alive.current || mine !== wanted.current) return
      setTone(got)
      setModels(captures)
      setChecked({})
      setStopped({})
      texts.current = {}
      setSend(null)
      logDebug('tone3000', `picked tone ${toneId}: ${got?.title || 'untitled'}, ${captures.length} A2 capture${captures.length === 1 ? '' : 's'}`)
    } catch (err) {
      if (alive.current && mine === wanted.current) setFault(err?.message || 'TONE3000 couldn’t be reached.')
    } finally {
      if (alive.current && mine === wanted.current) setBusy((was) => (was === 'tone' ? null : was))
    }
  }

  /* A tone tapped in the list: up at once with what the list has of it, its captures and the rest fetched behind it. */
  const openTone = (picked) => {
    if (busy || picked?.id == null) return
    setSaid('')
    setTone(picked)
    setModels(null)
    setChecked({})
    setStopped({})
    texts.current = {}
    setSend(null)
    load(picked.id)
  }

  /* Back to the list, which is as it was left. Not while a capture is being fetched or sent: its lines are on this view. */
  const toList = () => {
    if (busy && busy !== 'tone') return
    wanted.current += 1
    setBusy((was) => (was === 'tone' ? null : was))
    setTone(null)
    setModels(null)
    setChecked({})
    setStopped({})
    texts.current = {}
    setSend(null)
    setFault('')
    setSaid('')
  }

  /*
   * TONE3000 sent the player back, by the page inside the app or by the
   * app's own link. A link that is not TONE3000's (Siri's are the same
   * scheme) is no business of this card's, and the same return handed over
   * twice is finished once.
   */
  const returned = async (url) => {
    if (!readCallback(url) || taken.has(url)) return
    taken.add(url)
    if (!alive.current) return
    setPage(null)
    /* Only over nothing, or over the opening of the page: a send that is going keeps its own word. */
    setBusy((was) => (was === null || was === 'open' ? 'back' : was))
    let done = null
    try {
      done = await t3k.finish(url)
    } catch (err) {
      /* The device would not read or let go of what it kept for the sign-in (lib/tone3000 says everything else in words of its own). */
      logDebug('tone3000', `the return was not finished: ${err?.message || err}`)
      /* Not taken up after all: the same return may be handed over again. */
      taken.delete(url)
      if (alive.current) setFault(`The sign-in to TONE3000 couldn’t be finished on this ${deviceNoun()}. Try again.`)
      return
    } finally {
      if (alive.current) setBusy((was) => (was === 'back' ? null : was))
    }
    /* A return with no sign-in waiting for it (a launch link handed over again). */
    if (!done || !alive.current) return
    if (!done.ok) {
      logDebug('tone3000', `sign-in not finished: ${done.why}`)
      if (done.canceled) setSaid(done.why)
      else setFault(done.why)
      return
    }
    setSignedIn(true)
    setMeAsk((n) => n + 1)
    setFault('')
    setSaid('')
    /* A sign-in alone lands on the list. */
    if (!done.toneId) return
    /* A pick on TONE3000's own page opens that tone, but never over a capture that is going: its lines and its buttons are on the view the tone would replace. */
    if (goingNow()) setSaid(PICK_AFTER_SEND)
    else load(done.toneId)
  }

  useEffect(() => {
    alive.current = true
    t3k
      .signedIn()
      .then((yes) => alive.current && setSignedIn(yes === true))
      /* A device that will not say is taken as not signed in: the sign-in view, never an empty card. */
      .catch(() => alive.current && setSignedIn(false))
    const stop = onTone3000Return(returned)
    /* While this card is up it is where TONE3000's page is drawn, on a copy that can draw it. */
    const unhost = hostPage((url) => alive.current && setPage(url))
    return () => {
      alive.current = false
      stop()
      unhost()
    }
  }, [])

  /* Whose sign-in it is, asked once for each sign-in. Not knowing is no fault: the top says "Signed in". An answer that lands after a sign-out, or after a newer sign-in, is nobody's. */
  useEffect(() => {
    if (signedIn !== true) {
      setMe(null)
      return undefined
    }
    let live = true
    t3k
      .me()
      .then((who) => live && alive.current && setMe(who || null))
      .catch((err) => (live ? whenSignedOut(err) : null))
      .catch((err) => logDebug('tone3000', `whose sign-in it is was not read: ${err?.message || err}`))
    return () => {
      live = false
    }
  }, [signedIn, meAsk])

  /*
   * TONE3000's own page: the one to pick a tone on (Browse TONE3000), or
   * with `pick` false its sign-in alone, which comes straight back to the
   * list here (Continue, before a sign-in).
   */
  const browse = async (outside = false, pick = true) => {
    if (busy) return
    setBusy('open')
    setFault('')
    setSaid('')
    try {
      const how = { pick: pick !== false }
      await (outside === true ? startOutside(how) : t3k.start(how))
      logDebug('tone3000', `opened TONE3000’s page ${outside !== true && pageInApp() ? 'inside the app' : 'in the browser'} to ${how.pick ? 'pick a tone' : 'sign in'}`)
    } catch (err) {
      setFault(`TONE3000’s page didn’t open: ${err?.message || err}`)
    } finally {
      /* The page is in front from here; the button comes back for when it is not. */
      if (alive.current) setBusy((was) => (was === 'open' ? null : was))
    }
  }

  const check = async (m) => {
    if (busy) return
    setBusy(m.id)
    setFault('')
    try {
      const text = await t3k.modelText(m).catch(whenSignedOut)
      const read = readNam(text)
      /* The packer's own word too, with the names the send gives it: a file that reads as A2 and that it refuses is not kept, and its one line says why. */
      const rec = read.ok && read.a2 ? namRecord(text, { name: captureLabel(m), fallback: `Capture ${m.id}` }) : null
      const line = rec && !rec.ok ? rec.why : namSaid(read)
      logDebug('tone3000', `capture ${m.id} (${captureLabel(m)}): ${text.length} characters. ${line}`)
      if (rec?.ok) texts.current[m.id] = text
      if (alive.current) setChecked((was) => ({ ...was, [m.id]: line }))
    } catch (err) {
      /* A sign-in that has run out is said once, by the sign-in view. */
      if (alive.current && err?.status !== 401) setFault(err?.message || 'That capture couldn’t be fetched.')
    } finally {
      if (alive.current) setBusy(null)
    }
  }

  /*
   * A fetched capture into the unit's first empty slot (or, `again`, back
   * into the slot a send of this card's stopped part-way in). `play` is
   * Preview's: NAM 1 is pointed at it once it is there. Get's (`play`
   * false) leaves what is playing alone.
   */
  const sendToUnit = async (m, again = null, fill = false, play = true) => {
    if (busy) return
    /* On the unit already, put there by the app since it was opened: never a second copy in another slot. */
    if (again === null && placed.has(String(m.id))) return
    setTapped(play ? 'play' : 'keep')
    if (goingNow()) {
      setSend({ id: m.id, line: STILL_GOING })
      return
    }
    /*
     * The mark goes up BEFORE the fetch, not after it: a tone picked on
     * TONE3000's page while the file was still coming used to open over
     * this one, and the capture then went to the unit, and into NAM 1, with
     * no line on the screen to say so.
     */
    const mine = (atWork = Date.now())
    try {
      /* Not fetched yet: this tap asks for it (the one place a capture is fetched, `check`). What is not an A2 capture says so there and goes no further. */
      if (!texts.current[m.id]) await check(m)
      if (!alive.current || !texts.current[m.id]) return
      /* Named by the file's own word, else TONE3000's name for it, else its number there: a name in another script keeps none of its letters on the unit. */
      const named = { name: captureLabel(m), fallback: `Capture ${m.id}`, by: tone?.user?.username }
      /* Only to know it is a capture and what it is called, before the unit is asked anything; lib/captureSend packs what is sent. */
      const rec = namRecord(texts.current[m.id], named)
      if (!rec.ok) {
        setSend({ id: m.id, line: rec.why })
        return
      }
      setBusy(`send ${m.id}`)
      setFault('')
      /* Being sent again: its offer comes down, and goes back up only if this one stops too. */
      setStopped((was) => Object.fromEntries(Object.entries(was).filter(([key]) => key !== String(m.id))))
      let slot = again
      if (slot === null) {
        setSend({ id: m.id, line: 'Looking for an empty slot on the unit…' })
        const found = await namEmptySlotHere()
        if (!alive.current) return
        if (found.slot === null) {
          setSend({ id: m.id, line: `The unit’s first ${found.heads.length} capture slots are all taken. Clear one on the unit, then send again.` })
          return
        }
        slot = found.slot
      }
      const said = namSlotSaid(slot)
      setSend({ id: m.id, slot, line: `Sending “${rec.name}” to slot ${said}…` })
      logDebug('tone3000', `sending capture ${m.id} (“${rec.name}”) to slot ${said}${again !== null ? ', over what a stopped send left there' : ''}`)
      /*
       * The send, and the second try for a short name the unit took and did
       * not keep (lib/captureSend, which says why and is run whole in a
       * test). The card's part is the lines on the screen.
       */
      const went = await sendCapture({
        text: texts.current[m.id],
        named,
        slot,
        replace: again !== null,
        fill,
        install: (to, words, how) =>
          namInstallHere(to, words, {
            replace: how.replace,
            filled: how.filled,
            onProgress: (sent, of) => {
              /* Every tenth message and the last: 130 redraws are no use to anybody. */
              if (alive.current && (sent % 10 === 0 || sent === of)) setSend({ id: m.id, slot, line: `Sending “${rec.name}” to slot ${said}${how.second ? ' once more' : ''}: ${sent} of ${of}` })
            }
          }),
        log: (line) => logDebug('tone3000', `capture ${m.id}, slot ${said}: ${line}`),
        onSecond: () => {
          if (alive.current) setSend({ id: m.id, slot, line: 'The Axe-Fx III took it and didn’t keep it. Sending it once more, a little differently…' })
        }
      })
      if (!alive.current) return
      if (!went.ok) {
        setSend({ id: m.id, line: went.why })
        return
      }
      const { got, twice } = went
      /* Every message was taken and the slot still reads empty: the unit did not keep it. Never "done", and nothing to play. */
      if (got.name === NAM_EMPTY) {
        setSend({
          id: m.id,
          slot,
          line: twice
            ? `The Axe-Fx III took the capture twice and still shows slot ${said} as empty, so it did not keep it. The app’s log has what the unit answered both times.`
            : `The Axe-Fx III took the capture and then still shows slot ${said} as empty, so it did not keep it. Send it once more; if it says this again, the app’s log has what the unit answered.`
        })
        return
      }
      /* A slot that never said what it holds (asked twice) is not said to hold the capture: the send went, and pointing NAM 1 at it is what finds out. */
      setSend({ id: m.id, slot, done: true, line: got.name ? `In slot ${said} as “${got.name}”, in ${Math.round(got.seconds)} seconds${twice ? ', on the second try' : ''}.` : `Sent to slot ${said} in ${Math.round(got.seconds)} seconds, but the unit didn’t say what the slot holds now.` })
      /* There for good as far as the app goes; `sure` only where the unit said so. */
      place(m.id, slot, !!got.name)
      /* Get stops here: it is on the unit, and what is playing is left alone. */
      if (!play) return
      /* Preview goes straight into NAM 1, which is what makes it heard. */
      setBusy(`pick ${NAM_BLOCKS[0]}`)
      await point(NAM_BLOCKS[0], slot, m.id)
    } catch (err) {
      logDebug('tone3000', `capture ${m.id} was not sent: ${err?.message || err}`)
      if (!alive.current) return
      const line = err?.message || 'The capture was not sent.'
      setSend({ id: m.id, line })
      /* A send that stopped part-way is offered again into the same slot, with its name as it was going (a second try that stopped is not started over from the first) and as the button it was. */
      if (err?.partial === true && Number.isInteger(err?.slot)) setStopped((was) => ({ ...was, [m.id]: { again: err.slot, fill: err?.filled === true, play, line } }))
    } finally {
      if (atWork === mine) atWork = 0
      if (alive.current) setBusy(null)
    }
  }

  /*
   * NAM 1 or NAM 2 pointed at a slot, and what the unit said of it, on a
   * line of its own under the send's. Never throws. A unit that names the
   * slot <EMPTY> here has nothing in it, whatever the read after the send
   * said (or did not say): the send is no longer "done", so its button comes
   * back and the two Play buttons, which could only point at the same empty
   * slot again, go.
   */
  const point = async (block, slot, id) => {
    const which = `NAM ${NAM_BLOCKS.indexOf(block) + 1}`
    const played = (line, more = null) => alive.current && setSend((was) => (was ? { ...was, played: line, ...more } : was))
    try {
      const got = await namPickHere(block, slot)
      logDebug('tone3000', `${which} is on slot ${namSlotSaid(slot)} now: the unit names it “${got.name}”`)
      if (got.name === NAM_EMPTY) {
        played(`${which} is on slot ${namSlotSaid(slot)}, and it is empty, so there is nothing to hear.`, { done: false, line: `The Axe-Fx III shows slot ${namSlotSaid(slot)} as empty now, so the capture did not stay there. Send it once more.` })
        /* Not on the unit after all: its two buttons come back. */
        unplace(id)
      } else {
        played(`${which} is playing “${got.name}” now, through your own rig. Save the preset to keep it there.`)
        /* The unit has named what the slot holds: it is on the unit, whatever the read after the send did not say. */
        if (placed.has(String(id))) place(id, slot, true)
      }
    } catch (err) {
      logDebug('tone3000', `${which} was not pointed at slot ${namSlotSaid(slot)}: ${err?.message || err}`)
      played(err?.message || `${which} was not changed.`)
    }
  }

  const useIn = async (block, slot, id) => {
    if (busy) return
    /* The lines under a capture are the send in hand's: a Play tapped on another capture's line makes that one the one in hand, so what the block says lands under it. */
    setSend((was) => (was?.id === id ? was : { id, slot, done: true, line: `In slot ${namSlotSaid(slot)}.` }))
    if (goingNow()) {
      setSend((was) => (was ? { ...was, played: STILL_GOING } : was))
      return
    }
    const mine = (atWork = Date.now())
    setBusy(`pick ${block}`)
    try {
      await point(block, slot, id)
    } finally {
      if (atWork === mine) atWork = 0
      if (alive.current) setBusy(null)
    }
  }

  const signOut = async () => {
    try {
      await t3k.signOut()
    } catch (err) {
      /* Never "signed out" over a pass the device would not let go of. */
      logDebug('tone3000', `not signed out: ${err?.message || err}`)
      if (alive.current) setFault('TONE3000 couldn’t be signed out of on this device just now. Try again.')
      return
    }
    if (!alive.current) return
    texts.current = {}
    setSend(null)
    wanted.current += 1
    setSignedIn(false)
    /* The list was one account's (its own tones are in it): the next sign-in starts a new one. */
    list.current = newList()
    setTone(null)
    setModels(null)
    setChecked({})
    setStopped({})
    setSaid('Signed out of TONE3000 on this device.')
  }

  const whoSaid = me?.username ? `@${me.username}` : 'Signed in'
  const picture = tone ? toneImage(tone) : null
  const madeBy = tone ? creatorOf(tone) : ''
  const gearNamed = tone ? makesOf(tone) : ''

  return (
    <View style={{ gap: space.md }}>
      {/* TONE3000's name on every view, whose sign-in it is, and the steps behind the ⓘ. */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
        <Text accessibilityRole="header" style={{ flex: 1, color: color.silk, fontSize: font.lead, fontWeight: '800', letterSpacing: 1 }}>
          TONE3000
        </Text>
        {signedIn ? (
          <View accessible accessibilityLabel={`Signed in to TONE3000${me?.username ? ` as ${me.username}` : ''}`} style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs, flexShrink: 1 }}>
            <Avatar uri={typeof me?.avatar_url === 'string' && /^https:\/\//.test(me.avatar_url) ? me.avatar_url : null} size={22} />
            <Text numberOfLines={1} style={{ flexShrink: 1, color: color.silkDim, fontSize: font.small }}>
              {whoSaid}
            </Text>
          </View>
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={HOW_IT_WORKS}
          accessibilityState={{ expanded: info }}
          hitSlop={8}
          onPress={() => {
            tick()
            setInfo((was) => !was)
          }}
          style={({ pressed }) => ({ minWidth: TAP, minHeight: TAP, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, backgroundColor: pressed || info ? color.panelHi : 'transparent' })}
        >
          <Text style={{ color: info ? color.silk : color.silkDim, fontSize: font.lead }}>ⓘ</Text>
        </Pressable>
      </View>
      {info ? (
        <View style={{ gap: space.sm }}>
          {STEPS.map((step, i) => (
            <Text key={step} style={{ color: color.silkDim, fontSize: font.small, lineHeight: 19 }}>
              {`${i + 1}. ${step}`}
            </Text>
          ))}
          <Text style={{ color: color.silkFaint, fontSize: font.small, lineHeight: 19 }}>{STEPS_FOOT}</Text>
        </View>
      ) : null}

      {busy === 'back' ? <Note>{COMING_BACK}</Note> : null}
      {busy === 'tone' && !tone ? <Note>Fetching the tone you picked…</Note> : null}
      {said ? <Note>{said}</Note> : null}
      {fault ? <Note tone="warn">{fault}</Note> : null}

      {/* Before a sign-in: what this is, and Continue to TONE3000's own sign-in. */}
      {signedIn === false ? (
        <View style={{ gap: space.md }}>
          <Text style={{ color: color.silk, fontSize: font.body, lineHeight: 22 }}>{PARTNER}</Text>
          <Text style={{ color: color.silkDim, fontSize: font.small, lineHeight: 19 }}>{partnerMore()}</Text>
          <Press label={busy === 'open' ? 'Opening…' : CONTINUE} tone="live" disabled={!!busy} onPress={() => browse(false, false)} />
          {pageInApp() ? <Press label={BROWSE_OUTSIDE} sub={BROWSE_OUTSIDE_SUB} height={40} disabled={!!busy} onPress={() => browse(true, false)} /> : null}
        </View>
      ) : null}

      {/* Signed in, no tone open: the list. */}
      {signedIn && !tone ? <Tone3000Browser list={list.current} disabled={!!busy} onOpen={openTone} /> : null}

      {/* A tone, laid out as the HeadRush app's tone view is: the title with Back beside it, its picture with who made it, the gear and the description, then a line a capture with Preview and Get. */}
      {signedIn && tone ? (
        <View style={{ gap: space.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
            <Text accessibilityRole="header" numberOfLines={2} style={{ flex: 1, color: color.silk, fontSize: font.lead, fontWeight: '700' }}>
              {tone.title || 'Untitled tone'}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Back to the list"
              disabled={!!busy && busy !== 'tone'}
              onPress={() => {
                tick()
                toList()
              }}
              style={({ pressed }) => ({
                minHeight: TAP,
                paddingHorizontal: space.lg,
                justifyContent: 'center',
                borderWidth: 1,
                borderColor: color.rule,
                borderRadius: radius.md,
                backgroundColor: pressed ? color.panelHi : color.panel,
                opacity: busy && busy !== 'tone' ? 0.5 : 1
              })}
            >
              <Text style={{ color: color.silk, fontSize: font.body, fontWeight: '600' }}>{BACK_TO_LIST}</Text>
            </Pressable>
          </View>
          <View style={{ flexDirection: 'row', gap: space.md, alignItems: 'flex-start' }}>
            {picture ? <Image source={{ uri: picture }} accessible={false} resizeMode="cover" style={{ width: 72, height: 72, borderRadius: radius.md, backgroundColor: color.panelHi }} /> : <View accessible={false} style={{ width: 72, height: 72, borderRadius: radius.md, backgroundColor: color.panelHi }} />}
            <View style={{ flex: 1, gap: 2 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
                {madeBy ? <Avatar uri={creatorImage(tone)} size={16} /> : null}
                <Text numberOfLines={1} style={{ flex: 1, color: color.silkDim, fontSize: font.small }}>
                  {[madeBy, gearSaid(tone.gear), 'NAM'].filter(Boolean).join(' · ')}
                </Text>
              </View>
              {gearNamed ? (
                <Text numberOfLines={1} style={{ color: color.silkDim, fontSize: font.small }}>
                  {gearNamed}
                </Text>
              ) : null}
              {tone.description ? (
                <Text numberOfLines={3} style={{ color: color.silk, fontSize: font.small, lineHeight: 19 }}>
                  {String(tone.description)}
                </Text>
              ) : null}
              {/* The creator and the licence, always (TONE3000's terms). The licence comes with the tone's own read, so the line waits for it. */}
              {busy === 'tone' && tone.license == null ? null : <Text style={{ color: color.silkFaint, fontSize: font.small }}>{toneCredit(tone)}</Text>}
            </View>
          </View>
          {busy === 'tone' ? <Note>Fetching its captures…</Note> : null}
          {models && !models.length ? <Note>This tone has no A2 captures, which is the kind the Axe-Fx III’s NAM block plays.</Note> : null}
          {models && models.length ? (
            <View style={{ gap: 2 }}>
              <Text style={{ color: color.silkDim, fontSize: font.small }}>{CAPTURES_HEAD}</Text>
              <Text style={{ color: color.silkFaint, fontSize: font.small, lineHeight: 19 }}>{CAPTURES_NOTE}</Text>
            </View>
          ) : null}
          {(models || []).map((m) => {
            const named = captureLabel(m)
            const mine = send?.id === m.id
            const at = onUnit[m.id] || null
            const there = !!at
            const halted = stopped[m.id] || null
            /* Fetched, and not a capture the unit can take: the line under it says what it is, and there is nothing to send. */
            const noUse = !!checked[m.id] && !texts.current[m.id]
            const working = busy === m.id || busy === `send ${m.id}`
            const word = (which, said) => (working && tapped === which ? (busy === m.id ? 'Fetching…' : 'Sending…') : said)
            return (
              <View key={m.id} style={{ gap: space.xs }}>
                {/* The name keeps room of its own; at the largest text sizes the two buttons drop under it rather than run off the screen. */}
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.sm }}>
                  <Text numberOfLines={2} style={{ flex: 1, minWidth: 96, color: color.silk, fontSize: font.body, fontWeight: '600' }}>
                    {`${named}${m.size ? ` · ${m.size}` : ''}`}
                  </Text>
                  {there ? (
                    /* "On the unit" only where the unit has said the slot holds it; a send it took and said nothing of is "Sent to". */
                    <Text style={{ color: color.silkDim, fontSize: font.small }}>{at.sure ? `On the unit · slot ${namSlotSaid(at.slot)}` : `Sent to slot ${namSlotSaid(at.slot)}`}</Text>
                  ) : noUse ? null : (
                    <>
                      <LineButton icon={playIcon} label={word('play', PREVIEW)} says={`${PREVIEW} ${named}: puts it on the Axe-Fx III and plays it in NAM 1`} disabled={!!busy} onPress={() => sendToUnit(m, null, false, true)} />
                      <LineButton icon={saveIcon} label={word('keep', GET)} says={`${GET} ${named}: puts it on the Axe-Fx III`} lit disabled={!!busy} onPress={() => sendToUnit(m, null, false, false)} />
                    </>
                  )}
                </View>
                {mine ? <Note>{send.line}</Note> : null}
                {mine && send.played ? <Note>{send.played}</Note> : null}
                {/* Why it stopped stays under its own capture when the send in hand is another's. */}
                {halted && !mine ? <Note>{halted.line}</Note> : null}
                {halted ? <Press label={`Send it again to slot ${namSlotSaid(halted.again)}`} sub="Over what the stopped send left there" disabled={!!busy} onPress={() => sendToUnit(m, halted.again, halted.fill, halted.play)} /> : null}
                {/* On the unit: which NAM block plays it is one tap, for a capture got without a preview and for trying it in the other block. */}
                {there
                  ? NAM_BLOCKS.map((block, i) => (
                      <Press key={block} label={busy === `pick ${block}` && mine ? 'Changing…' : `Play it in NAM ${i + 1}`} sub="In the preset the unit is on" height={48} disabled={!!busy} onPress={() => useIn(block, at.slot, m.id)} />
                    ))
                  : null}
                {checked[m.id] && (noUse || mine) ? (
                  <Text selectable style={{ color: color.silkFaint, fontSize: font.small, lineHeight: 19 }}>
                    {checked[m.id]}
                  </Text>
                ) : null}
              </View>
            )
          })}
        </View>
      ) : null}

      {/* Always one tap from everything TONE3000 has, on its own page (its rule for an app that lists its tones itself). */}
      {signedIn ? <Press label={busy === 'open' ? 'Opening…' : 'Browse TONE3000'} sub="Every capture the NAM block can play, on its own page, with play buttons" disabled={!!busy} onPress={() => browse()} /> : null}
      {signedIn && pageInApp() ? <Press label={BROWSE_OUTSIDE} sub={BROWSE_OUTSIDE_SUB} height={40} disabled={!!busy} onPress={() => browse(true)} /> : null}
      {signedIn ? <Press label="Sign out of TONE3000" height={40} disabled={!!busy} onPress={signOut} /> : null}
      <Text style={{ color: color.silkFaint, fontSize: font.micro }}>{T3K_POWERED}</Text>
      {/* TONE3000's page inside the app; nothing at all on a copy built without the web view. */}
      <Tone3000Page
        url={page}
        onReturn={returned}
        onClosed={() => alive.current && setPage(null)}
        onFault={(why, status) => {
          logDebug('tone3000', `TONE3000’s page was closed: ${why}${status ? ` It answered ${status}.` : ''}`)
          if (!alive.current) return
          setPage(null)
          setFault(why)
        }}
      />
    </View>
  )
}

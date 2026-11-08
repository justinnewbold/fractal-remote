import { useEffect, useState } from 'react'
import { Alert, ScrollView, Text, View } from 'react-native'

import { color, font, radius, space } from '../lib/theme'
import { glassCard } from '../lib/glass'
import Note from '../components/Note'
import Press from '../components/Press'
import RestoreAsk from '../components/RestoreAsk'
import Sheet from '../components/Sheet'
import { buyUnlock, restorePurchase, startTrial, trialOnOffer, usePurchase } from '../lib/purchases'
import { trialRunning } from '../lib/unlock-rule'
import { TRIAL_BUTTON, TRIAL_OVER, TRIAL_STARTING, trialRefusal, trialRunning as trialRunningWords, trialStartedWords, trialTerms } from '../lib/trial-words'
import { UNITS } from '../lib/demoUnits'
import { ALREADY_UNLOCKED } from '../lib/onboarding'
import { currentAccount, deleteAccount, signedInOnPhone } from '../lib/relay'
import { isPairAccount } from '../lib/pairing'
import { VP4_SO_FAR } from '../lib/vp4-safety'
import { bluetoothSupported, openForCustomersHere } from '../lib/bluetooth'
import { BLUETOOTH_PARTS, BLUETOOTH_PARTS_SHOW, BLUETOOTH_PAYWALL } from '../lib/bluetooth-gear'
import { askHowToConnect } from '../lib/howConnect'

/*
 * The units named on the offer, read off the list the app actually carries.
 *
 * Typed out by hand this is five chances to be wrong about somebody's gear,
 * and it would go stale the day a sixth is added — on the ONE screen where
 * being wrong is a person paying for a unit we do not drive.
 */
const SUPPORTED = UNITS.map((u) => u.name)
const supportedWords =
  SUPPORTED.slice(0, -1).join(', ') + ' and ' + SUPPORTED[SUPPORTED.length - 1]

/**
 * The one screen that asks for money.
 *
 * It is shown at exactly one moment: somebody has a code or an account and is
 * about to point this app at a real unit for the first time. The demo never
 * reaches here, which is the whole design — a person can install this, play
 * with a simulated FM9 for an hour and never be asked for anything.
 *
 * WHAT IT DOES NOT DO is oversell. There is no countdown, no crossed-out price,
 * no list of forty features with ticks against them. Somebody who has got this
 * far owns a Fractal unit, has a pairing code on a screen in front of them and
 * knows exactly what they are buying. The honest version of this screen is
 * short, and a short one respects the person holding a guitar.
 *
 * RESTORE IS AS PROMINENT AS BUY, which Apple requires and which is right
 * anyway: the person tapping it has already paid, and hiding their way back in
 * behind the thing that charges them again would be a poor way to treat them.
 */
export default function Paywall({ onUnlocked, onDemo, onBack, onSignIn, onMakeAccount, onDeleted, asked = false }) {
  const purchase = usePurchase()
  const { price, unlocked, available, why, detail, held } = purchase
  const [busy, setBusy] = useState(false)
  const [said, setSaid] = useState(null)
  /*
   * WHAT A VP4 GETS, AND WHICH BLUETOOTH ADAPTER, ONE TAP AWAY EACH. "Way too
   * much text, should not have to scroll" (Justin, 7 November 2026): the two
   * paragraphs were about 270 words above the trial button, which a tablet
   * held upright could not show without scrolling. Their words are as they
   * were (shared/vp4-safety.mjs VP4_SO_FAR, held to the store Description;
   * shared/bluetooth-gear.mjs BLUETOOTH_PARTS), shown under the line that
   * opens them.
   */
  const [vp4Open, setVp4Open] = useState(false)
  const [partsOpen, setPartsOpen] = useState(false)
  /* Restore tapped with nobody signed in: RestoreAsk is up under it. */
  const [asking, setAsking] = useState(false)
  /*
   * NOBODY SIGNED IN, AND THE FREE WAY FIRST.
   *
   * Somebody who bought on the website or another phone is still on
   * nobody's account here, so this phone cannot know they paid, and Buy
   * would charge them again. Signing in costs nothing and unlocks it. So for
   * them the sign-in comes ABOVE Buy, with a line saying why. Read from the
   * phone's own sign-in, not the account server, the door's way (relay.js
   * signedInOnPhone: a sign-in that ran out with no signal to renew it is
   * still somebody), and asked only on a page opened from the demo or the
   * walkthrough: the imposed one is always signed in.
   *
   * The line names no other place to pay (Apple 3.1.3, Google Play's
   * payments policy) and calls nothing free: "Sign in instead. It's free."
   * sat over the price on App Review's own path, and read as if the full
   * version cost nothing. "You won't be charged again." did the same thing
   * from the line above Buy, to somebody who bought it in another store,
   * which would charge them. So what costs nothing is the signing in, said
   * of the signing in.
   *
   * AND NOT RESTORE, which with nobody signed in moves the purchase to this
   * phone's nameless id — off the account it is on, and off every other
   * phone and computer signed in to it. Its button stays below, as Apple
   * requires, and since the 2 November 2026 audit it says so before it
   * moves anything (RestoreAsk). Signing in moves nothing off anybody. For
   * the buyer this was written for — paid on a phone before he had any
   * account — there is no account to sign in with yet, so it says to make
   * one there first.
   */
  const [nobody, setNobody] = useState(false)
  useEffect(() => {
    if (!asked) return undefined
    let alive = true
    signedInOnPhone().then((id) => alive && setNobody(!id))
    return () => {
      alive = false
    }
  }, [asked])
  const freeFirst = nobody && Boolean(onSignIn)
  /*
   * DELETE ACCOUNT, FOR SOMEBODY WHO MADE ONE AND HAS NOT PAID.
   *
   * Apple's 5.1.1(v): an account made in the app can be deleted in the app.
   * Settings has had it since 1.86.9, but anybody can make an account on the
   * phone now, before paying, and an account that has not been unlocked
   * signs in to THIS page, imposed, with no way through to Settings. So the
   * same sheet is here, for the imposed page only: the one asked for from
   * the demo is not signed in to anything.
   */
  const [account, setAccount] = useState(null)
  const [deleting, setDeleting] = useState(false)
  /* On whether it can be offered, not on the callback: App hands a new
     function every render, and each run here is a call to the account
     server. */
  const canDelete = !asked && Boolean(onDeleted)
  useEffect(() => {
    if (!canDelete) return undefined
    let alive = true
    currentAccount().then((who) => alive && setAccount(who))
    return () => {
      alive = false
    }
  }, [canDelete])
  const signedInAs = account?.email && !isPairAccount(account.email) ? account.email : null

  /* Not while a purchase or restore is under way: its own answer closes the
     page a moment later, once it has said how it went (purchases.js sets
     boughtAlone for the sign-in screen behind). */
  if (unlocked && !busy) onUnlocked?.()
  /*
   * THE FREE TRIAL (7 November 2026). Offered beside Unlock wherever this
   * copy may offer it (purchases trialOnOffer: on an iPhone only once the
   * App Store's free 7-Day Trial item is there), with what it is and what
   * happens after said under the button, before anybody taps it (Apple's
   * 3.1.1). A trial running closes the page put in front of the app, as a
   * purchase does; the page asked for from Play's "Trial: 3 days left ·
   * Unlock" stays, to buy.
   */
  const trialOn = trialRunning(purchase.trialEndsAt)
  if (trialOn && !asked && !busy) onUnlocked?.()
  /* And only with the price to say under it: 3.1.1 wants any later charge named before a trial starts, and the terms leave it out without one. */
  const offerTrial = trialOnOffer(purchase)
  const tryIt = async () => {
    setBusy(true)
    setSaid({ tone: 'info', text: TRIAL_STARTING })
    const out = await startTrial()
    setBusy(false)
    if (out.ok) {
      /* Its own days, not always seven: on an iPhone the trial began when the App Store's item was bought. */
      const said = trialStartedWords(out.trial)
      if (said.over) return setSaid({ tone: 'warn', text: said.text })
      Alert.alert('Free trial', said.text)
      /* A trial started just now: "How do you connect to your unit?" comes next, in Play's place, where Bluetooth is offered (lib/howConnect). */
      askHowToConnect()
      return onUnlocked?.()
    }
    if (out.cancelled) return setSaid(null)
    /* The Apple ID had bought it already: unlocked, and said why there is no trial. Not a purchase made here, so nothing is asked. */
    if (out.why === 'apple-id-owns') {
      Alert.alert('Already unlocked', trialRefusal(out.why))
      return onUnlocked?.()
    }
    /*
     * Nobody signed in: an account first, which the sign-in screen makes, on
     * its Create account side (App.js toTrialAccount): somebody starting a
     * trial is new, and was sent to Sign in.
     */
    const makeOne = onMakeAccount || onSignIn
    if (out.why === 'signed-out' && makeOne) {
      setSaid(null)
      return makeOne()
    }
    setSaid({ tone: 'warn', text: out.message || trialRefusal(out.why) })
  }

  const buy = async () => {
    setBusy(true)
    setSaid(null)
    const out = await buyUnlock()
    setBusy(false)
    /* Found already bought: the page closes, so the "nothing was charged"
       goes with it as an alert, or somebody who just pressed the price
       thinks they paid twice. */
    if (out.ok && out.message) Alert.alert('Already unlocked', out.message)
    /* A purchase made here, not one found already made: "How do you connect to your unit?" next (lib/howConnect). */
    if (out.ok && !out.message) askHowToConnect()
    if (out.ok) return onUnlocked?.()
    /* A cancel is not a fault and is not worth a sentence. A payment still
       waiting is not one either: it is said calmly, and Buy stays off. */
    if (!out.cancelled) setSaid({ tone: out.held ? 'warn' : 'fault', text: out.message })
  }

  /*
   * `here`: the second of RestoreAsk's two ways, with nobody signed in.
   * Without it, nobody signed in is asked first (purchases.js RESTORE_WHOSE)
   * and nothing is sent to the store.
   */
  const restore = async (here = false) => {
    setBusy(true)
    setSaid(null)
    setAsking(false)
    const out = await restorePurchase({ here })
    setBusy(false)
    if (out.ok) return onUnlocked?.()
    if (out.ask) return setAsking(true)
    setSaid({ tone: 'warn', text: out.message })
  }

  /* What it is and what it costs, in words: first on the page put in front of the app, under the buttons in the sheet (below). */
  const intro = (
    <View style={{ gap: space.sm }}>
      <Text style={{ color: color.silk, fontSize: font.title, fontWeight: '700' }}>
        Phone Remote
      </Text>
      <Text style={{ color: color.silkDim, fontSize: font.body, lineHeight: font.body * 1.45 }}>
        {`One-time payment, with every future update, on the ${supportedWords}. It unlocks on every phone or tablet you sign in on.`}
      </Text>
    </View>
  )

  /*
   * EVERYTHING ON ONE SCREEN, ASKED FOR (8 November 2026): "it should show
   * everything on the screen instead of having to scroll up". In the sheet
   * the sheet itself scrolls and pads (components/Sheet), so the page is a
   * plain column there: a second padded scroll inside it took a gutter off
   * each side and pushed Unlock and Restore under the fold on a 667-point
   * iPhone. And there the heading goes under the buttons, since the sheet's
   * own title already says Unlock and One payment, once.
   */
  const Column = asked ? View : ScrollView
  const columnProps = asked
    ? { style: { gap: space.lg } }
    : { contentContainerStyle: { padding: space.lg, gap: space.lg }, keyboardShouldPersistTaps: 'handled' }
  const body = (
    <Column {...columnProps}>
      {asked ? null : intro}

      {trialOn ? <Note tone="info">{trialRunningWords(purchase.trialEndsAt)}</Note> : null}
      {!trialOn && purchase.trialEnded && !unlocked ? <Note tone="warn">{TRIAL_OVER}</Note> : null}

      {said ? <Note tone={said.tone}>{said.text}</Note> : null}

      {/* A dead Unlock button is worse than an explained one. Restore still
          shows, because a purchase made elsewhere is worth trying for. */}
      {!available ? <Note tone="warn">{why || 'Purchases are not available here.'}</Note> : null}
      {/*
        And underneath it, the store's own account, when there is one.
        "The store has nothing to sell yet" is true and unactionable — it does
        not say whether the gap is in RevenueCat or in the Play Console, and
        those are fixed in different places. See purchases.detail: facts only,
        and null for anybody who can actually buy the thing, which is every
        customer who ever reaches this screen.
      */}
      {!available && detail ? (
        <Text style={{ color: color.silkFaint, fontSize: font.small, lineHeight: 18 }}>{detail}</Text>
      ) : null}

      {/* A payment the store is still waiting on, one it has not confirmed,
          or a purchase here that has not reached the account: said for as
          long as Buy is held behind it. */}
      {held && !said ? <Note tone="warn">{held}</Note> : null}

      {/*
        THE BUTTONS FIRST, then what it unlocks (8 November 2026): "it should
        show everything on the screen instead of having to scroll up". The
        list of features and the Bluetooth line used to come first and pushed
        the free trial and Unlock under the bottom of the sheet; they are
        under the buttons now, for whoever wants to read on.
      */}
      <View style={{ gap: space.md }}>
        {freeFirst ? (
          <>
            <Text style={{ color: color.silk, fontSize: font.body, lineHeight: font.body * 1.45 }}>
              Bought it on another device? Sign in with that account instead of buying again. Signing in never
              charges you.
            </Text>
            <Press
              label={ALREADY_UNLOCKED}
              disabled={busy}
              onPress={onSignIn}
              style={{ borderColor: color.signal }}
            />
          </>
        ) : null}
        {offerTrial ? (
          <>
            <Press label={TRIAL_BUTTON} tone="signal" on disabled={busy} onPress={tryIt} />
            <Text style={{ color: color.silkDim, fontSize: font.small, lineHeight: font.small * 1.5 }}>{trialTerms(price)}</Text>
          </>
        ) : null}
        <Press
          label={price ? `Unlock Full Version — ${price}` : 'Unlock Full Version'}
          tone="signal"
          disabled={busy || !available || Boolean(held)}
          onPress={buy}
        />
        <Press label="Restore a purchase" disabled={busy} onPress={() => restore()} />
        {/* With nobody signed in: whose the purchase is, and the two ways on. */}
        {asking ? <RestoreAsk onSignIn={onSignIn} onHere={() => restore(true)} busy={busy} /> : null}
        {/*
          Restore asks the STORE whether this Apple or Google account has
          bought it. That is a different question from "am I signed in as
          somebody who already has this", and only one of them had an answer
          here — which left somebody looking at a locked app, holding an
          account that unlocks it, with nothing on screen to say so.
        */}
        {onSignIn && !freeFirst ? (
          <Press
            /* "I'm already unlocked, sign in" — his words, and the browser's
               unlock page says the same (shared/onboarding.mjs). */
            label={ALREADY_UNLOCKED}
            disabled={busy}
            onPress={onSignIn}
          />
        ) : null}
      </View>

      {asked ? intro : null}

      {/*
        A card of frosted glass (lib/glass), its rim drawn inside it. Asked
        for, the page is a sheet, and a card in a sheet is flat: the light
        and the rim, no drop.
      */}
      <View
        style={{
          ...glassCard({ flat: asked, classicCorner: radius.lg }),
          padding: space.lg,
          gap: space.md
        }}
      >
        <Text style={{ color: color.silk, fontSize: font.body, lineHeight: font.body * 1.45 }}>
          Presets, scenes, amp &amp; effect blocks, the tuner, tap tempo, setlists and more.
        </Text>
        {/*
          AND WHAT A VP4 GETS OF THAT, right under the list it is an exception
          to, one tap away. "I didn't know that those settings didn't work on
          the VP4. I thought that they did, so yeah, if they don't, we need to
          put that in there for now." The VP4 is named above among the units
          this unlocks, and this is the one screen where somebody pays on the
          strength of what it says, so the line that opens it says it is
          there. Worded once in shared/vp4-safety.mjs, so the browser's unlock
          page says it word for word, behind the same line.
        */}
        <Text
          accessibilityRole="button"
          accessibilityState={{ expanded: vp4Open }}
          onPress={() => setVp4Open((open) => !open)}
          style={{ color: color.signal, fontSize: font.small, fontWeight: '600', textDecorationLine: 'underline' }}
        >
          On a VP4? See what works
        </Text>
        {vp4Open ? (
          <Text style={{ color: color.silkDim, fontSize: font.small, lineHeight: font.small * 1.5 }}>
            {VP4_SO_FAR}
          </Text>
        ) : null}
      </View>

      {/*
        AND BLUETOOTH, which the full version unlocks too, said where it is
        sold, in one short line: the two ways, Bluetooth first, and what a
        computer adds (BLUETOOTH_PAYWALL, shared/bluetooth-gear.mjs). Every
        part each unit takes, and the two never for an FM3, one tap under it
        (BLUETOOTH_PARTS): names to look up, nothing to buy here. Only on a
        copy that opens it to customers (lib/ble-rule.js, by the version
        built into the copy) and on a device that can do it: a line on any
        other copy would sell what it cannot open, which Apple's 2.3.1(a)
        forbids. Under the panel, not in it: the panel is the browser's
        unlock page word for word (test/both-ends.mjs), and the browser has
        no Bluetooth to offer.
      */}
      {openForCustomersHere() && bluetoothSupported() ? (
        <View style={{ gap: space.sm }}>
          <Text style={{ color: color.silkDim, fontSize: font.small, lineHeight: font.small * 1.5 }}>
            {BLUETOOTH_PAYWALL}
          </Text>
          <Text
            accessibilityRole="button"
            accessibilityState={{ expanded: partsOpen }}
            onPress={() => setPartsOpen((open) => !open)}
            style={{ color: color.signal, fontSize: font.small, fontWeight: '600', textDecorationLine: 'underline' }}
          >
            {BLUETOOTH_PARTS_SHOW}
          </Text>
          {partsOpen ? (
            <Text style={{ color: color.silkDim, fontSize: font.small, lineHeight: font.small * 1.5 }}>
              {BLUETOOTH_PARTS}
            </Text>
          ) : null}
        </View>
      ) : null}

      <View style={{ gap: space.md }}>
        {/* Somebody STOPPED on the way in needs a way past this; somebody who
            came looking is already in the demo and only needs out. */}
        {asked ? null : (
          <Press label="Keep using the demo" disabled={busy} onPress={() => onDemo?.()} />
        )}
        <Press label={asked ? 'Not now' : 'Back'} disabled={busy} onPress={() => onBack?.()} />
      </View>

      <Text style={{ color: color.silkDim, fontSize: font.small, lineHeight: font.small * 1.5 }}>
        The demo stays free, for as long as you like.
      </Text>

      {signedInAs ? (
        <Press
          label="Delete account"
          sub={`Remove ${signedInAs} and everything saved under it`}
          disabled={busy}
          onPress={() => {
            setSaid(null)
            setDeleting(true)
          }}
        />
      ) : null}

      {signedInAs ? (
        <Sheet open={deleting} onClose={() => (busy ? null : setDeleting(false))} title="Delete account" note={signedInAs}>
          <Text style={{ color: color.silk, fontSize: font.small, lineHeight: 21 }}>
            This deletes your account and everything saved in it, straight away. It can’t be undone, and any
            computer signed in to it is signed out.
          </Text>
          <Press
            label={busy ? 'Deleting…' : 'Delete my account'}
            tone="live"
            disabled={busy}
            onPress={async () => {
              setBusy(true)
              try {
                await deleteAccount()
                setDeleting(false)
                Alert.alert('Account deleted', `${signedInAs} has been deleted, and you are signed out.`)
                onDeleted?.()
              } catch (err) {
                setDeleting(false)
                setSaid({ tone: 'fault', text: err.message })
              } finally {
                setBusy(false)
              }
            }}
          />
          <Press label="Keep my account" disabled={busy} onPress={() => setDeleting(false)} />
        </Sheet>
      ) : null}
    </Column>
  )

  /* Imposed, it IS the screen. Asked for, it lies over the one they were on. */
  return asked ? (
    <Sheet open tall onClose={() => onBack?.()} title="Unlock" note="One payment, once">
      {body}
    </Sheet>
  ) : (
    body
  )
}

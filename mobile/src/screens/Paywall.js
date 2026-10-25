import { useEffect, useState } from 'react'
import { Alert, ScrollView, Text, View } from 'react-native'

import { color, font, radius, space } from '../lib/theme'
import Note from '../components/Note'
import Press from '../components/Press'
import Sheet from '../components/Sheet'
import { buyUnlock, restorePurchase, usePurchase } from '../lib/purchases'
import { UNITS } from '../lib/demoUnits'
import { ALREADY_UNLOCKED } from '../lib/onboarding'
import { currentAccount, deleteAccount, restoreSession } from '../lib/relay'
import { isPairAccount } from '../lib/pairing'
import { VP4_SO_FAR } from '../lib/vp4-safety'
import { bluetoothSupported, openForCustomersHere } from '../lib/bluetooth'
import { BLUETOOTH_PAYWALL } from '../lib/bluetooth-gear'

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
export default function Paywall({ onUnlocked, onDemo, onBack, onSignIn, onDeleted, asked = false }) {
  const { price, unlocked, available, why, detail, held } = usePurchase()
  const [busy, setBusy] = useState(false)
  const [said, setSaid] = useState(null)
  /*
   * NOBODY SIGNED IN, AND THE FREE WAY FIRST.
   *
   * Somebody who bought on the website or another phone is still on
   * nobody's account here, so this phone cannot know they paid, and Buy
   * would charge them again. Signing in costs nothing and unlocks it. So for
   * them the sign-in comes ABOVE Buy, with a line saying why. Read from the
   * phone's own sign-in, not the account server, and asked only on a page
   * opened from the demo or the walkthrough: the imposed one is always
   * signed in.
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
   * requires. Signing in moves nothing off anybody. For the buyer this was
   * written for — paid on a phone before he had any account — there is no
   * account to sign in with yet, so it says to make one there first.
   */
  const [nobody, setNobody] = useState(false)
  useEffect(() => {
    if (!asked) return undefined
    let alive = true
    restoreSession().then((id) => alive && setNobody(!id))
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

  const buy = async () => {
    setBusy(true)
    setSaid(null)
    const out = await buyUnlock()
    setBusy(false)
    /* Found already bought: the page closes, so the "nothing was charged"
       goes with it as an alert, or somebody who just pressed the price
       thinks they paid twice. */
    if (out.ok && out.message) Alert.alert('Already unlocked', out.message)
    if (out.ok) return onUnlocked?.()
    /* A cancel is not a fault and is not worth a sentence. A payment still
       waiting is not one either: it is said calmly, and Buy stays off. */
    if (!out.cancelled) setSaid({ tone: out.held ? 'warn' : 'fault', text: out.message })
  }

  const restore = async () => {
    setBusy(true)
    setSaid(null)
    const out = await restorePurchase()
    setBusy(false)
    if (out.ok) return onUnlocked?.()
    setSaid({ tone: 'warn', text: out.message })
  }

  const body = (
    <ScrollView
      contentContainerStyle={{ padding: space.lg, gap: space.lg }}
      keyboardShouldPersistTaps="handled"
    >
      <View style={{ gap: space.sm }}>
        <Text style={{ color: color.silk, fontSize: font.title, fontWeight: '700' }}>
          Phone Remote
        </Text>
        <Text style={{ color: color.silkDim, fontSize: font.body, lineHeight: font.body * 1.45 }}>
          {`One-time payment unlocks the full version of this app, forever, including all future updates, on all supported Fractal devices: ${supportedWords}. Sign in with the same account on another phone or tablet and it is unlocked there too.`}
        </Text>
      </View>

      <View
        style={{
          backgroundColor: color.panel,
          borderRadius: radius.lg,
          padding: space.lg,
          gap: space.md
        }}
      >
        <Text style={{ color: color.silk, fontSize: font.body, lineHeight: font.body * 1.45 }}>
          You&rsquo;ll be able to control and switch presets, scenes, amp &amp; effects blocks,
          tuner, tap tempo, setlists, and so much more.
        </Text>
        {/*
          AND WHAT A VP4 GETS OF THAT, right under the list it is an exception
          to. "I didn't know that those settings didn't work on the VP4. I
          thought that they did, so yeah, if they don't, we need to put that
          in there for now." The VP4 is named above among the units this
          unlocks, and this is the one screen where somebody pays on the
          strength of what it says. Worded once in shared/vp4-safety.mjs, so
          the browser's unlock page says it word for word.
        */}
        <Text style={{ color: color.silkDim, fontSize: font.small, lineHeight: font.small * 1.5 }}>
          {VP4_SO_FAR}
        </Text>
      </View>

      {/*
        AND BLUETOOTH (BETA), which the full version unlocks too, said where
        it is sold: the two ways to connect, the computer the best one, and
        the AM4 alone, with every part it needs bought separately (the
        adapter, its cable, the two plug adapters and a charger:
        BLUETOOTH_PAYWALL, shared/bluetooth-gear.mjs). Only on a copy that
        opens it to customers (lib/ble-rule.js, by the version built into
        the copy) and on a device that can do it: a line on any other copy
        would sell what it cannot open, which Apple's 2.3.1(a) forbids. No
        copy today draws it. Under the panel, not in it: the panel is the
        browser's unlock page word for word (test/both-ends.mjs), and the
        browser has no Bluetooth to offer.
      */}
      {openForCustomersHere() && bluetoothSupported() ? (
        <Text style={{ color: color.silkDim, fontSize: font.small, lineHeight: font.small * 1.5 }}>
          {BLUETOOTH_PAYWALL}
        </Text>
      ) : null}

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

      <View style={{ gap: space.md }}>
        {freeFirst ? (
          <>
            <Text style={{ color: color.silk, fontSize: font.body, lineHeight: font.body * 1.45 }}>
              Already bought it on another device? Don&rsquo;t buy it again here: sign in with the account you
              used there. Signing in never charges you. If that device has no account yet, make one on it first,
              then sign in here with it.
            </Text>
            <Press
              label={ALREADY_UNLOCKED}
              disabled={busy}
              onPress={onSignIn}
              style={{ borderColor: color.signal }}
            />
          </>
        ) : null}
        <Press
          label={price ? `Unlock Full Version — ${price}` : 'Unlock Full Version'}
          tone="signal"
          disabled={busy || !available || Boolean(held)}
          onPress={buy}
        />
        <Press label="Restore a purchase" disabled={busy} onPress={restore} />
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

      <View style={{ gap: space.md }}>
        {/* Somebody STOPPED on the way in needs a way past this; somebody who
            came looking is already in the demo and only needs out. */}
        {asked ? null : (
          <Press label="Keep using the demo" disabled={busy} onPress={() => onDemo?.()} />
        )}
        <Press label={asked ? 'Not now' : 'Back'} disabled={busy} onPress={() => onBack?.()} />
      </View>

      <Text style={{ color: color.silkDim, fontSize: font.small, lineHeight: font.small * 1.5 }}>
        The demo stays free for as long as you want it. It is the whole app
        against a simulated unit — nothing in it is cut short.
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
            This deletes your account for good: your sign-in, your set lists, bug reports you sent from it and
            everything else stored under it. It happens straight away and cannot be undone. Any computer signed in
            to this account is signed out.
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
    </ScrollView>
  )

  /* Imposed, it IS the screen. Asked for, it lies over the one they were on. */
  return asked ? (
    <Sheet open onClose={() => onBack?.()} title="Unlock" note="One payment, once">
      {body}
    </Sheet>
  ) : (
    body
  )
}

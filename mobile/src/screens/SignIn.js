import { useRef, useState } from 'react'
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  View
} from 'react-native'

import { color, font, radius, space, TAP } from '../lib/theme'
import { glassCard, glassField } from '../lib/glass'
import { NOT_IN_INBOX, confirmWithCode, resendConfirmation, sendPasswordReset, sentAgain, signIn, signUp } from '../lib/relay'
import Note from '../components/Note'
import Press from '../components/Press'
import Connect from './Connect'
import { setDemo } from '../lib/demo'
import { SETUP } from '../lib/onboarding'
import { bluetoothSupported, openForCustomersHere } from '../lib/bluetooth'
import { WALKTHROUGH_TWO_WAYS } from '../lib/bluetooth-gear'
import { MADE_HERE, ONLY_HERE } from '../lib/purchases'
import { trialRefusal } from '../lib/trial-words'
import { askHowToConnect } from '../lib/howConnect'
import mailIcon from '../../assets/icons/mail.png'
import lockIcon from '../../assets/icons/lock.png'
import checkIcon from '../../assets/icons/check.png'
import externalIcon from '../../assets/icons/external.png'
import { deviceNoun } from '../lib/device-word'
import { NAME_LABELS, NAME_MAX, nameProblem } from '../lib/account-name'

/**
 * One account, two ends.
 *
 * AND ONLY ONE WAY IN, WHICH IS THE CHANGE.
 *
 * "I want the QR code gone and the scanner gone. It has never worked once…
 * to use this app and connect it to your computer, you have to sign up.
 * That's the way we're doing it."
 *
 * There used to be a second route: the computer made an eight-character code
 * standing for a hidden account, the phone scanned it off a QR code or typed
 * it, and nobody made an account at all. It was the first thing this screen
 * offered. It is gone — camera, code box and all — because across every
 * attempt it never once worked end to end, and two routes meant two sets of
 * instructions, two failure modes and a different answer every time.
 *
 * What is left is the account. The demo is still free and still needs none;
 * the computer app is still free and still needs none. Joining a phone to a
 * computer is the one thing that does, and both ends sign into the same one.
 *
 * Nothing here mentions a channel, a relay, or the name of the account
 * service — that part has not changed.
 */
export default function SignIn({ onSignedIn, onDemo, start = 'in', paidHere = false, madeHere = false, onAccountMade, onBackToRig = null }) {
  /* 'trial' is Create account too, for the free trial tapped with nobody signed in (App.js toTrialAccount). */
  const [mode, setMode] = useState(start === 'up' || start === 'trial' ? 'up' : 'in') // 'in' | 'up'
  /* Whether Get connected says both ways, Bluetooth first, in one line: see the card. */
  const twoWays = openForCustomersHere() && bluetoothSupported()
  /*
   * The instructions, from the one screen that needs them most.
   *
   * Somebody here has to get a computer running and signed into the same
   * account, and there was no way from this screen to find out which computer
   * or how. There is now.
   */
  /*
   * AN ACCOUNT CAN BE MADE HERE BY ANYBODY, BEFORE PAYING, as in the browser.
   *
   * It used to wait for the unlock: "On the phones, only show the create
   * account window after the phone has been unlocked", on the reasoning that
   * an account only joins a phone to a computer, which is the paid half. Then
   * Give access arrived, and an account became the way a tester is let in:
   * "I tried to set my daughter up with a free account on iPhone, but in the
   * app it doesn't let you set up an account until you've purchased... I
   * still wanna recruit some testers sometimes and give them access, and I
   * don't wanna make it difficult for them."
   *
   * So Create account opens the form for everybody. Nothing is given away by
   * it: an account that has not been unlocked signs in to the purchase page
   * (App.js, shouldAskToPay), and one Justin has given access to, or put on
   * the waiting list, is unlocked the moment it signs in (the entitlement
   * function claims the waiting list). Buying without an account is still
   * the demo's Unlock.
   *
   * Which is also why this screen no longer reads the purchase at all. It
   * once turned itself into Create account the moment an unlock landed here;
   * with nothing on this screen able to unlock, that only ever fired late, on
   * a restore finishing behind it, and told a person who already HAS an
   * account to make one.
   *
   * It is TOLD two things now, by App.js, and neither moves the form by
   * itself. `start` is which side it opens on, read once as it appears:
   * Create account straight after somebody bought with nobody signed in —
   * the order that cost a customer a second payment on 8 October, when this
   * screen met him on Sign in and he went off to the website to make the
   * account instead. `paidHere` is whether the phone holds a purchase no
   * account anybody signed in to has yet (purchases.js: onlyHere, madeHere,
   * stuck), and it only changes the words — and keeps saying so after a
   * first account made here, so a second one, made because the first
   * email was mistyped or its confirmation never came, is still told to
   * come back to this phone and sign in.
   *
   * And `madeHere` is which of those it is when the purchase is on an
   * account made here: then it is NOT only on this phone, and "only on this
   * phone so far" was not true of it. Its own line says that account has
   * it, to sign in here with it, and that an account made again, for an
   * email that never came, takes it with it (purchases.js, linkNewAccount).
   */
  const paid = start === 'up' || paidHere
  /* Sign in failed on the details, on a phone that paid before any account
     existed: most likely there is no account with that email yet. */
  const [noAccount, setNoAccount] = useState(false)
  const [helping, setHelping] = useState(false)
  /*
   * THE NAME, on Create account only. "When they create an account have them
   * put in their first name and last name and email address." (Justin, 5
   * November 2026.) Both needed, 50 characters each, before the email and in
   * that order; Sign in never asks, and nor is an account made before this.
   * The rule and its words are shared with the website (shared/account-name.mjs).
   */
  const [first, setFirst] = useState('')
  const [last, setLast] = useState('')
  const lastBox = useRef(null)
  const emailBox = useRef(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [note, setNote] = useState(null)
  /*
   * An account waiting on its confirmation email: { why: 'made', email } just
   * now, with the note saying so, or { why: 'refused', email } when Sign in
   * was turned away for it, which offers to send the email again — and
   * { why: 'again', email } once it has been, which keeps waiting on the new
   * one. To that address, not the box: the box may say another by the time
   * the button is tapped, and the account service can answer "sent" for an
   * address with no account, so the "look in Spam" line would follow an
   * email that never went. Every new try, and every switch of side, starts
   * it again.
   *
   * AND WHILE IT WAITS, THE CODE. About one new customer in seven never
   * tapped the email's link — it opens a browser, the browser opens the
   * website, and then they have to find their way back here to sign in. The
   * same email carries a code, and the box for it shows in every one of
   * those states, so the link is no longer the only way past it.
   */
  const [unconfirmed, setUnconfirmed] = useState(null)
  const [code, setCode] = useState('')
  const [confirming, setConfirming] = useState(false)

  const nameFault = mode === 'up' ? nameProblem({ first, last }) : null
  const ready = !nameFault && email.includes('@') && password.length >= 6

  const go = async () => {
    setUnconfirmed(null)
    if (!ready) {
      setError(
        nameFault ||
          (email.includes('@')
            ? 'Your password is at least 6 characters.'
            : 'Type your email address and password.')
      )
      return
    }
    setBusy(true)
    setError(null)
    setNote(null)
    setNoAccount(false)
    try {
      if (mode === 'up') {
        const { needsConfirmation, userId } = await signUp({ email: email.trim(), password, firstName: first, lastName: last })
        /* And, once it is in, "How do you connect to your unit?" (lib/howConnect), where Bluetooth is offered. */
        askHowToConnect()
        if (needsConfirmation) {
          /* And the purchase goes onto it now, before the email is opened
             anywhere (purchases.js, linkNewAccount). */
          if (paid && userId) onAccountMade?.(userId)
          /* Paid on this phone: said that this phone is where to sign in.
             Not "before you open the website": the confirmation link itself
             opens the website, so that could not be followed. The code is
             typed here, on this phone, so only the link needs saying so. */
          setNote(
            paid
              ? `Account made — type the code from the email we just sent in the box below. Or tap the link in that email, then come back to this ${deviceNoun()} and sign in, so your purchase goes with your account.`
              : 'Account made. Type the code from the email we just sent in the box below, or tap the link in that email and then sign in.'
          )
          setUnconfirmed({ why: 'made', email: email.trim() })
          setMode('in')
          return
        }
      } else {
        await signIn({ email: email.trim(), password })
      }
      onSignedIn()
    } catch (err) {
      if (mode === 'in' && err?.notConfirmed) setUnconfirmed({ why: 'refused', email: email.trim() })
      if (mode === 'in' && paid && err?.noMatch) setNoAccount(true)
      else setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const reset = async () => {
    setUnconfirmed(null)
    if (!email.includes('@')) {
      setError('Type your email address first.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await sendPasswordReset(email.trim())
      setNote('Check your email for a link to set a new password.')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  /* "Email not confirmed" said to look for the email, and gave no way to get another. */
  const sendAgain = async () => {
    const address = unconfirmed?.email
    if (!address) return
    setBusy(true)
    setError(null)
    /* Still waiting once it has gone, on a new email with a new code: the
       box for it stays, and the old code goes out of it. */
    try {
      await resendConfirmation(address)
      setUnconfirmed({ why: 'again', email: address })
      setCode('')
      setNote(sentAgain(address))
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  /*
   * THE CODE FROM THE EMAIL, the other way past it. A good code signs the
   * account in as well as confirming it, so from here it is the way a
   * successful Sign in goes: onSignedIn, and nothing else. A purchase made
   * on this phone went onto the account when it was made (onAccountMade
   * above), so it is not handed over a second time.
   */
  const confirm = async () => {
    const address = unconfirmed?.email
    if (!address) return
    setBusy(true)
    setConfirming(true)
    setError(null)
    try {
      await confirmWithCode({ email: address, code })
      onSignedIn()
    } catch (err) {
      setError(err.message)
    } finally {
      setConfirming(false)
      setBusy(false)
    }
  }

  /* The email stays as typed either way. */
  const switchTo = (next) => {
    setMode(next)
    setError(null)
    setNote(null)
    setNoAccount(false)
    setUnconfirmed(null)
  }

  const fieldText = {
    flex: 1,
    minHeight: TAP,
    color: color.silk,
    fontSize: font.lead,
    paddingHorizontal: space.md
  }

  if (helping) return <Connect onBack={() => setHelping(false)} />

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1 }}
    >
      <ScrollView
        /*
         * NOT CENTRED ANY MORE, and that is the whole of the bug.
         *
         * "What is the button on the bottom that can't be seen and can't be
         * scrolled to??"
         *
         * `flexGrow: 1` with `justifyContent: 'center'` centres the content
         * inside a box the height of the screen. While the content is SHORTER
         * than the screen that is exactly what it is for, and this screen was
         * short once. It has grown: a title, a paragraph, two fields, four
         * buttons, a note. Once the content is TALLER than that box, centring
         * pushes the overflow out through BOTH ends — and a scroll view can
         * only scroll within its content size, so what hangs out the bottom
         * is not reachable by scrolling. It is drawn, and it cannot be got to.
         *
         * Starting at the top costs the short-screen case a little symmetry
         * and gives every screen back its last element. paddingBottom clears
         * the home indicator, which was the other thing in the way.
         */
        contentContainerStyle={{
          padding: space.lg,
          paddingBottom: space.xxl,
          gap: space.lg,
          flexGrow: 1
        }}
        keyboardShouldPersistTaps="handled"
      >
        {/*
          HIS MOCKUP, TOP TO BOTTOM. "Redo this screen to match this photo in
          both the web app and the mobile apps." The mark, the name and the
          line under it; a card that says how the three pieces fit; the form
          with a picture in each field; Sign in, then Create account and
          Forgot password side by side; the way to the computer app, outlined
          in amber; and the demo last, quietest.

          The words are shared with the browser's version of this screen
          (shared/onboarding.mjs, SETUP), so the two cannot drift again.
        */}
        {/*
          BACK TO YOUR OWN RIG, first, for somebody who came here only to
          look: a paid account that replayed the walkthrough and took its
          Sign in or Unlock, or his account viewing as a new customer.
          App.js hands it over only while a sign-in is on the phone
          (backToRig), so somebody new, with none, never sees it.
        */}
        {onBackToRig ? <Press label="Back to your own rig" tone="signal" on height={TAP} onPress={onBackToRig} /> : null}
        <View style={{ alignItems: 'center', gap: space.sm, paddingTop: space.lg }}>
          <Mark />
          <Text style={{ color: color.silk, fontSize: font.hero + 6, fontWeight: '800', textAlign: 'center' }}>
            Fractal Remote
          </Text>
          <Text style={{ color: color.silkDim, fontSize: font.lead, textAlign: 'center' }}>{SETUP.tagline}</Text>
        </View>

        {/*
          A card of frosted glass (lib/glass), rimmed, with the light along its
          top: his mockup's Get connected, the computer's three steps.

          ONE LINE ON A COPY THAT OPENS BLUETOOTH, since 7 November 2026:
          "Signup was difficult, no tutorial. No mention of bluetooth" and
          "we don't need to put it all upfront that kind of stuff can come
          into troubleshooting guides" (Justin). The three steps and a small
          grey Bluetooth line under them were 57 words before the form, the
          computer first; on such a copy the card is the one line, Bluetooth
          first (WALKTHROUGH_TWO_WAYS.setup), and once the account is in, How
          do you connect to your unit? asks (components/HowConnect). Setting
          up the computer is on Connect a computer (How to connect my
          computer, below: the desktop app, the same account on both, the
          link by email), and the three steps themselves are in
          Troubleshooting → It will not connect at all, the one place they
          are drawn on such a copy. The purchase page's own gate
          (Paywall.js), because somebody here may not have paid yet;
          everywhere else, and in the browser, which does need the
          computer, the steps are as he drew them (shared/onboarding.mjs
          SETUP).
        */}
        <View
          style={{
            ...glassCard({ bordered: true, classicCorner: radius.lg }),
            borderWidth: 1,
            padding: space.lg,
            gap: space.md
          }}
        >
          <Text style={{ color: color.silk, fontSize: font.title, fontWeight: '800' }}>{SETUP.title}</Text>
          {twoWays ? (
            <Text style={{ color: color.silk, fontSize: font.body + 1, lineHeight: 22 }}>
              {WALKTHROUGH_TWO_WAYS.setup}
            </Text>
          ) : (
            SETUP.steps.map((line, i) => (
              <View key={line} style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
                <View
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 15,
                    backgroundColor: color.signal,
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <Text style={{ color: color.onSignal, fontSize: font.body, fontWeight: '800' }}>{i + 1}</Text>
                </View>
                <Text style={{ color: color.silk, fontSize: font.body + 1, lineHeight: 22, flexShrink: 1 }}>
                  {line}
                </Text>
              </View>
            ))
          )}
        </View>

        {/* The free trial tapped with nobody signed in (App.js toTrialAccount): why an account comes first, in the trial's own words. */}
        {start === 'trial' && mode === 'up' && !note ? <Note>{trialRefusal('signed-out')}</Note> : null}

        {/* Paid on this phone, with no account yet: said where the form is.
            Making the account is what carries the purchase to the computer.
            On an account made here already, that one has it, on either side
            of the form. Out of the way of a note, which says what to do next
            itself. */}
        {paid && !note ? (
          <Note strong={mode === 'up'}>
            {madeHere
              ? MADE_HERE
              : mode === 'up'
                ? 'You’ve paid — thank you. Now make your account, so the full version goes with you to your computer and any other phone or tablet. Use this same email there.'
                : ONLY_HERE}
          </Note>
        ) : null}

        <View style={{ gap: space.md }}>
          {/* First name, then Last name, over the email: Create account's alone (see THE NAME above). */}
          {mode === 'up' ? (
            <>
              <Field glyph={<Person />}>
                <TextInput
                  style={fieldText}
                  value={first}
                  onChangeText={setFirst}
                  placeholder={NAME_LABELS.first}
                  placeholderTextColor={color.silkFaint}
                  accessibilityLabel={NAME_LABELS.first}
                  autoCapitalize="words"
                  autoCorrect={false}
                  autoComplete="given-name"
                  textContentType="givenName"
                  maxLength={NAME_MAX}
                  returnKeyType="next"
                  submitBehavior="submit"
                  onSubmitEditing={() => lastBox.current?.focus()}
                />
              </Field>
              <Field glyph={<Person />}>
                <TextInput
                  ref={lastBox}
                  style={fieldText}
                  value={last}
                  onChangeText={setLast}
                  placeholder={NAME_LABELS.last}
                  placeholderTextColor={color.silkFaint}
                  accessibilityLabel={NAME_LABELS.last}
                  autoCapitalize="words"
                  autoCorrect={false}
                  autoComplete="family-name"
                  textContentType="familyName"
                  maxLength={NAME_MAX}
                  returnKeyType="next"
                  submitBehavior="submit"
                  onSubmitEditing={() => emailBox.current?.focus()}
                />
              </Field>
            </>
          ) : null}
          <Field icon={mailIcon}>
            <TextInput
              ref={emailBox}
              style={fieldText}
              value={email}
              onChangeText={setEmail}
              placeholder="Email"
              placeholderTextColor={color.silkFaint}
              accessibilityLabel="Email"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              inputMode="email"
              keyboardType="email-address"
              returnKeyType="next"
            />
          </Field>
          <Field icon={lockIcon}>
            <TextInput
              style={fieldText}
              value={password}
              onChangeText={setPassword}
              placeholder="Password"
              placeholderTextColor={color.silkFaint}
              accessibilityLabel="Password"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete={mode === 'up' ? 'new-password' : 'current-password'}
              secureTextEntry
              returnKeyType="go"
              onSubmitEditing={() => !busy && go()}
            />
          </Field>
        </View>

        {error ? <Note tone="fault">{error}</Note> : null}
        {noAccount ? (
          <View style={{ gap: space.md }}>
            <Note tone="warn">
              Email or password didn’t match. There may not be an account for this email yet — you can make one now.
            </Note>
            <Press label="Create account with this email" disabled={busy} onPress={() => switchTo('up')} />
          </View>
        ) : null}
        {/* Under any refusal while an account waits: Sign in turned away for
            it, or a code that did not work — whose words say to send a new
            one, from Account made as much as from a refusal. */}
        {mode === 'in' && unconfirmed?.email && error ? (
          <Press label="Send the confirmation email again" disabled={busy} onPress={sendAgain} />
        ) : null}
        {/* Where else to look, under the note that says to confirm. */}
        {note ? <Note>{unconfirmed?.why === 'made' ? `${note} ${NOT_IN_INBOX}` : note}</Note> : null}
        {mode === 'in' && unconfirmed?.email ? (
          <View style={{ gap: space.md }}>
            <Field icon={checkIcon}>
              <TextInput
                style={{ ...fieldText, letterSpacing: 2 }}
                value={code}
                onChangeText={setCode}
                placeholder="Code from the email"
                placeholderTextColor={color.silkFaint}
                accessibilityLabel="Code from the email"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="one-time-code"
                textContentType="oneTimeCode"
                inputMode="numeric"
                keyboardType="number-pad"
                returnKeyType="done"
                onSubmitEditing={() => !busy && confirm()}
              />
            </Field>
            <Press label={confirming ? 'Confirming…' : 'Confirm account'} disabled={busy} onPress={confirm} />
          </View>
        ) : null}

        {/* Amber whether or not the fields are filled in, as drawn: a pale
            button reads as switched off, and the form says what is missing
            when it is pressed early. */}
        <Press
          label={busy ? 'Working…' : mode === 'up' ? 'Create account' : 'Sign in'}
          tone="signal"
          on
          disabled={busy}
          onPress={go}
        />

        {/*
          CREATE ACCOUNT FOR EVERYBODY, AS DRAWN, and now it makes one for
          everybody too: see "AN ACCOUNT CAN BE MADE HERE BY ANYBODY" above.
        */}
        <View style={{ flexDirection: 'row', gap: space.md }}>
          <Press
            grow
            label={mode === 'up' ? 'I already have one' : 'Create account'}
            disabled={busy}
            onPress={() =>
              switchTo(mode === 'up' ? 'in' : 'up')
            }
          />
          {mode === 'in' ? (
            <Press grow label="Forgot password?" disabled={busy} onPress={reset} />
          ) : null}
        </View>

        {/* "Instead of saying connect my computer on the android app, have it
            say how to connect my computer." Outlined in amber, with the
            picture that says it opens something, as drawn. */}
        <Press
          label={SETUP.howTo}
          icon={externalIcon}
          disabled={busy}
          onPress={() => setHelping(true)}
          style={{ borderColor: color.signal }}
        />

        {/*
          The demo, offered here because here is where somebody with no
          computer is standing. It is a simulated unit — every screen works,
          nothing reaches hardware — and it is also the only way to tell this
          app being slow from the line to the computer being slow, because
          there is no line in it.

          THREE WORDS AND NO SUBTITLE. "Change just looking to just Try the
          Demo - no text underneath." It read "Just looking? Try the demo"
          over "A simulated FM3 — no computer needed", which asked a question
          nobody needed answering and then named one unit out of the five the
          demo can be.
        */}
        <Press
          label="Try the Demo"
          disabled={busy}
          onPress={() => {
            setDemo(true)
            onDemo?.()
          }}
        />

        {/*
          THE LINE THAT USED TO CLOSE THIS SCREEN IS GONE, AND IT WAS WRONG.

          "All changes made on the phone can be saved, and should be able to
          be saved to the unit. Remove this text."

          It read: "Saving to a slot, backups and firmware stay at the
          computer. Your computer refuses them from a distance, and it is
          right to." True when it was written — the computer did refuse a slot
          write from a handset, deliberately.

          It has not been true since the save flow was built. A phone asks
          the computer to write the slot, the computer does the writing, and
          the phone is told the moment it lands (see lib/saveViaComputer and
          components/SaveToSlot). So the sentence described a limit the app no
          longer has, on the first screen somebody reads.
        */}
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

/**
 * The mark over the name: five amber bars, tallest in the middle, as drawn.
 * Views rather than a picture, so it is sharp at every size and takes the
 * theme's amber in light mode too.
 */
function Mark() {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ flexDirection: 'row', alignItems: 'center', gap: 5, height: 48 }}
    >
      {[14, 30, 46, 30, 14].map((h, i) => (
        <View key={i} style={{ width: 7, height: h, borderRadius: 4, backgroundColor: color.signal }} />
      ))}
    </View>
  )
}

/**
 * A field with its picture on the left and a hairline between them, as drawn.
 * `glyph` stands in for the picture where there is none to draw (the name).
 */
function Field({ icon, glyph = null, children }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        minHeight: TAP + 8,
        borderWidth: 1,
        /* A frosted glass field (lib/glass): rounded like a card, rimmed, no shadow. */
        ...glassField()
      }}
    >
      {glyph || <Image source={icon} style={{ width: 22, height: 22, marginHorizontal: space.md, tintColor: color.silkDim }} />}
      <View style={{ width: 1, alignSelf: 'stretch', marginVertical: space.sm, backgroundColor: color.glassRim }} />
      {children}
    </View>
  )
}

/**
 * The picture in the two name fields: a head over a pair of shoulders, drawn
 * in Views in the field pictures' own ink and size, as the mark over the name
 * is, so the name needed no new picture file.
 */
function Person() {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width: 22, height: 22, marginHorizontal: space.md, alignItems: 'center', justifyContent: 'flex-end', gap: 2 }}
    >
      <View style={{ width: 9, height: 9, borderRadius: 5, borderWidth: 1.8, borderColor: color.silkDim }} />
      <View
        style={{
          width: 16,
          height: 8,
          borderTopLeftRadius: 8,
          borderTopRightRadius: 8,
          borderWidth: 1.8,
          borderBottomWidth: 0,
          borderColor: color.silkDim
        }}
      />
    </View>
  )
}

import { useEffect, useState } from 'react'
import { Image, Linking, ScrollView, Text, TextInput, View } from 'react-native'

import { color, font, radius, space, TAP } from '../lib/theme'
import { glassCard, glassField } from '../lib/glass'
import { CONNECT, P6 } from '../lib/onboarding'
import mailIcon from '../../assets/icons/mail.png'
import sendIcon from '../../assets/icons/send.png'
import CopyAddress from '../components/CopyAddress'
import Note from '../components/Note'
import Press from '../components/Press'
import { sendDownloadLink } from '../lib/downloadLink'
import { keptAccount } from '../lib/relay'
import { isPairAccount } from '../lib/pairing'
import { bluetoothSupported, openForCustomersHere } from '../lib/bluetooth'
import { GUIDE_URL, HOW_CONNECT } from '../lib/bluetooth-gear'
import bluetoothIcon from '../../assets/icons/bluetooth.png'

/**
 * How to get a computer on the other end of this — asked from a phone.
 *
 * WHAT THIS SCREEN USED TO BE, and why that was wrong.
 *
 * "This screen should not show up on the phone. A phone can't download
 * desktop software, it also isn't suppose to go to GitHub directly."
 *
 * It drew all of shared/ways-in.mjs: three routes, each with its own install
 * steps — take the newest .dmg, drag it to Applications, click More info then
 * Run anyway — and under each one a button that opened the GitHub releases
 * page. On a phone every line of that is advice about a machine the reader is
 * not holding, ending in a download the handset cannot use, on a page nobody
 * should be sent to.
 *
 * WHAT IT IS NOW. The same question, answered with the two things a phone can
 * actually do about it: an address to type on the computer, and a link sent
 * somewhere the computer can open it. Both were already here in the
 * walkthrough's version of this step; this is that screen agreeing with it.
 *
 * The install steps are not lost — they are on the downloads page, which is
 * where somebody sitting at the computer will read them.
 *
 * THE ROUTES LIST STAYS IN shared/ways-in.mjs for the browser, which IS
 * running on the computer in question and can sort them by what it is.
 *
 * AND THEN THE PROSE WENT TOO, for the same reason the routes did.
 *
 * "On the connect a computer page remove all text except what's in the
 * screen shot and make the stuff that's visible in the screenshot larger on
 * the screen. The [same thing] is on the download page that they go to, so we
 * don't need it here."
 *
 * Three paragraphs were still here: what a USB cable is for, what to do once
 * the app is installed, and the warning that only one program can hold the
 * port. Every one of them is on the page this screen is sending somebody to,
 * and every one of them is about the machine they are not holding — which is
 * the same fault as the routes, in sentences instead of buttons. Read on a
 * phone they pushed the two things you CAN act on down the screen.
 *
 * What is left is the address and the email box, at sizes you can read at
 * arm's length. The subtitle went with them: it promised "what it is", and
 * what it is has moved to the page that explains it.
 *
 * AND NOW IT IS THREE NUMBERED STEPS. "The screen seems slightly confusing.
 * Any ideas on how to improve it?" (Justin, 9 November 2026, holding this
 * page.) It was a row of things with no order: a Bluetooth button bigger than
 * anything about the computer, a green pill saying SAME ACCOUNT ON BOTH with
 * nothing to say both of what, the card, the email box, and the three
 * computers named a second time at the foot. Shown a mockup of the same
 * things as steps, he said "Yes, build the connect to computer screen".
 *
 *   1  Get the free desktop app: the address to type or copy, or the link
 *      by email. Both ways are this step, so "or" no longer splits the page.
 *   2  Plug your unit into the computer. One line. It is not the USB
 *      paragraph that went: it is the step nobody was told came next.
 *   3  Sign in to the desktop app, with the same account. The pill is here
 *      now, and where this device knows whose sign-in it holds it names the
 *      account (lib/relay keptAccount, read off the device, never asked of
 *      the account service), so "the same account" is one to read off the
 *      screen. From the sign-in screen nobody is signed in yet, and the pill
 *      keeps its words.
 *
 * Bluetooth stays first, as the 7 November rule has it, but as the question
 * it answers ("Got a Bluetooth adapter?"), so the page under it reads as the
 * other way and not as a second thing to do. The foot's "Free • Mac,
 * Windows, Linux" and its three pictures went: step 1 says free and names
 * the three, and the pictures opened the page whose address is in that step.
 *
 * The browser's page (src/components/ConnectScreen.jsx) is not changed: its
 * sign-in screen already has the three numbered steps over it (SETUP.steps).
 * So these words are the phone's, kept here and not in shared/onboarding.mjs,
 * which the computer app carries: a word changed there is a new computer
 * release, for a page no computer shows.
 */
const STEPS = {
  sub: 'Three steps, done once.',
  bluetooth: 'Got a Bluetooth adapter?',
  bluetoothGo: 'Connect over Bluetooth instead',
  rule: 'WITH A COMPUTER',
  get: 'Get the free desktop app',
  getBody: 'On your Mac, Windows or Linux computer, go to:',
  orEmail: 'Or email yourself the link:',
  plug: 'Plug your unit into the computer',
  plugBody: 'With its USB cable.',
  signIn: 'Sign in to the desktop app',
  signInAs: 'With the same account as this app:',
  signInSame: 'With the same account you use in this app.',
  then: 'Then the app finds your computer by itself, over the internet, from anywhere.'
}

/* A step's own line: built when drawn, never at load, so it follows the look chosen in Settings. */
const body = () => ({ color: color.silkDim, fontSize: font.body, lineHeight: 21 })

/** One step: its number in the app's amber, its name beside it, and under them whatever the step needs. */
function Step({ n, title, children }) {
  return (
    <View style={{ gap: space.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
        <View
          accessible={false}
          importantForAccessibility="no-hide-descendants"
          style={{ width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: color.signal }}
        >
          <Text style={{ color: color.onSignal, fontSize: font.body, fontWeight: '800' }}>{n}</Text>
        </View>
        <Text
          accessibilityRole="header"
          accessibilityLabel={`Step ${n}. ${title}`}
          style={{ flex: 1, color: color.silk, fontSize: font.lead, fontWeight: '700' }}
        >
          {title}
        </Text>
      </View>
      {children}
    </View>
  )
}

export default function Connect({ onBack, onBluetooth = null }) {
  const [email, setEmail] = useState('')
  const [said, setSaid] = useState(null)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  /* Whose sign-in this device holds, read off the device: null from the sign-in screen and in the demo, and never a pairing code's account, which is not somebody's email. */
  const [account, setAccount] = useState(null)
  useEffect(() => {
    let alive = true
    keptAccount()
      .then((kept) => alive && setAccount(kept?.email && !isPairAccount(kept.email) ? kept.email : null))
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [])
  const bluetoothHere = Boolean(onBluetooth) || (openForCustomersHere() && bluetoothSupported())

  const mail = async () => {
    setBusy(true)
    setError(null)
    setSaid(null)
    const out = await sendDownloadLink(email)
    setBusy(false)
    if (out.ok) setSaid(P6.sent(email.trim()))
    else setError(out.message)
  }

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ padding: space.lg, gap: space.lg, paddingBottom: space.xxl }}
      keyboardShouldPersistTaps="handled"
    >
      {/*
        HIS MOCKUP, IN THE APP'S OWN COLOURS, and since 9 November 2026 in
        three steps (the note over this screen). The pill, the card and the
        email box are frosted glass (lib/glass), the pill still green.
      */}
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space.md }}>
        <View style={{ flex: 1, gap: space.sm }}>
          <Text accessibilityRole="header" style={{ color: color.silk, fontSize: font.title + 6, fontWeight: '800' }}>
            {CONNECT.title}
          </Text>
          <Text style={{ color: color.silkDim, fontSize: font.lead, lineHeight: 24 }}>{STEPS.sub}</Text>
        </View>
        <Press label="Done" height={40} onPress={onBack} />
      </View>

      {/*
        BLUETOOTH FIRST, ON THE PAGE ABOUT THE COMPUTER. "Everything that
        mentions how to connect to a computer also mentions how to connect to
        Bluetooth and putting Bluetooth first on everything" (Justin, 7
        November 2026, of this page). From Settings, App hands the way to the
        Bluetooth page (`onBluetooth`, the Settings row's own gate). From the
        sign-in screen nobody has paid, and the page waits for the purchase,
        so on a copy that opens Bluetooth to customers (the purchase page's
        gate) the same button opens the website's setup guide instead, which
        anybody may read. Anywhere else, nothing: the page is as it was.
        Asked as a question since 9 November 2026, so what is under it reads
        as the other way; its second line says what the tap does.
      */}
      {onBluetooth || (openForCustomersHere() && bluetoothSupported()) ? (
        <Press
          label={STEPS.bluetooth}
          sub={onBluetooth ? `${STEPS.bluetoothGo} · ${HOW_CONNECT.bluetoothSub}` : `${HOW_CONNECT.bluetoothSub} · setup guide`}
          icon={bluetoothIcon}
          inkColor={color.ble}
          labelSize={font.lead}
          height={64}
          tone="live"
          onPress={onBluetooth || (() => Linking.openURL(GUIDE_URL).catch(() => {}))}
        />
      ) : null}

      {/* Under the Bluetooth question, and only there: with no question over it the page has one way and needs no name for it. */}
      {bluetoothHere ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
          <View style={{ flex: 1, height: 1, backgroundColor: color.glassRim }} />
          <Text style={{ color: color.silkDim, fontSize: font.small, letterSpacing: 1.2 }}>{STEPS.rule}</Text>
          <View style={{ flex: 1, height: 1, backgroundColor: color.glassRim }} />
        </View>
      ) : null}

      <View
        style={{
          padding: space.lg,
          gap: space.lg,
          borderWidth: 1,
          ...glassCard({ bordered: true, classicCorner: radius.lg })
        }}
      >
        <Step n={1} title={STEPS.get}>
          <Text style={body()}>{STEPS.getBody}</Text>
          <CopyAddress row size={font.lead} />
          <Text style={body()}>{STEPS.orEmail}</Text>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              minHeight: TAP + 8,
              borderWidth: 1,
              ...glassField()
            }}
          >
            <Image source={mailIcon} style={{ width: 22, height: 22, marginHorizontal: space.md, tintColor: color.silkDim }} />
            <View style={{ width: 1, alignSelf: 'stretch', marginVertical: space.sm, backgroundColor: color.glassRim }} />
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor={color.silkFaint}
              accessibilityLabel="Where to send the download link"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              inputMode="email"
              keyboardType="email-address"
              returnKeyType="send"
              onSubmitEditing={() => !busy && email.includes('@') && mail()}
              style={{ flex: 1, minHeight: TAP, paddingHorizontal: space.md, color: color.silk, fontSize: font.lead }}
            />
          </View>
          <Press
            label="Send link"
            icon={sendIcon}
            tone="signal"
            on
            disabled={busy || !email.includes('@')}
            height={TAP + 8}
            onPress={mail}
          />
          {said ? <Note strong size={font.body}>{said}</Note> : null}
          {error ? <Note tone="fault">{error}</Note> : null}
        </Step>

        <Step n={2} title={STEPS.plug}>
          <Text style={body()}>{STEPS.plugBody}</Text>
        </Step>

        <Step n={3} title={STEPS.signIn}>
          <Text style={body()}>{account ? STEPS.signInAs : STEPS.signInSame}</Text>
          {/* The green pill: the account by name where this device holds one, its own words where it does not. */}
          <View
            style={{
              alignSelf: 'flex-start',
              flexDirection: 'row',
              alignItems: 'center',
              gap: space.sm,
              paddingHorizontal: space.md,
              paddingVertical: space.sm,
              borderRadius: radius.pill,
              borderWidth: 1,
              borderColor: color.ok,
              backgroundColor: color.glassFill,
              boxShadow: color.glassLift
            }}
          >
            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: color.ok }} />
            {account ? (
              <Text numberOfLines={1} style={{ flexShrink: 1, color: color.ok, fontSize: font.small, fontWeight: '700' }}>
                {account}
              </Text>
            ) : (
              <Text style={{ color: color.ok, fontSize: font.small, fontWeight: '700', letterSpacing: 1 }}>
                {CONNECT.pill}
              </Text>
            )}
          </View>
        </Step>

        <Text style={body()}>{STEPS.then}</Text>
      </View>
    </ScrollView>
  )
}

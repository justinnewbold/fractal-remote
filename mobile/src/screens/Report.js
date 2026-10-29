import { useEffect, useState } from 'react'
import { Alert, KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, View } from 'react-native'

import { color, font, mono, radius, space } from '../lib/theme'
import { MAX_MESSAGE, SENT_WORDS, context, logPreview, sendReport, shotsLostWords, videoLostWords } from '../lib/reports'
import { formMessage, headLines } from '../lib/report-rules'
import { logHeader, runsBefore } from '../lib/logHead'
import { pastRuns } from '../lib/logKeep'
import { keptAccount } from '../lib/relay'
import { isPairAccount } from '../lib/pairing'
import { useRig } from '../lib/rig'
import Attach from '../components/Attach'
import Note from '../components/Note'
import Press from '../components/Press'
import TickBox from '../components/TickBox'
import { deviceNoun } from '../lib/device-word'

const face = Platform.select(mono)

/* Read off the rig here rather than handed down, the way the log screen does
   it: which unit is attached is a live fact, not something a caller should be
   trusted to have passed the current value of. */
const ofDeviceName = (s) => s.deviceName
const ofPreset = (s) => s.preset

/* Every report from here is one kind: it carries the log when the box says so (shared/report-rules carriesLog). */
const KIND = 'bug'

/** The screen's title, and the name it goes by wherever it is pointed at. */
export const REPORT_TITLE = 'Leave feedback or report a problem'

/**
 * LEAVE FEEDBACK OR REPORT A PROBLEM: one screen for both, from the phone.
 *
 * "What's clean this up? It should basically be Leave feedback or report a
 * problem. Then a box to type out a message, upload a photo or video, and
 * have the log sent with what devices they're using. For their email since
 * they already have an account, they should be able to just click a checkbox
 * that says include email instead of having to type it out. Have that check
 * box checked by default. It would be nice to know what user it's coming
 * from unless they want it anonymous." (Justin, 29 October 2026, holding
 * Report a Bluetooth problem, which was seven buttons that each sent a report
 * in one tap, and a Feedback form with Problem and Idea.)
 *
 * So, from top to bottom: Back and Send; the title; the box; Add a photo or
 * video (components/Attach); and two tick boxes, both ticked to start:
 *
 *   - INCLUDE MY EMAIL, with the address the phone is signed in with
 *     (lib/relay keptAccount, read off the phone, never asking the server).
 *     Ticked, the report goes from the account, with its address to reply
 *     to. Unticked, it goes anonymously: no account and no address, on a
 *     client with no sign-in at all (lib/reports `anonymous`). Signed out
 *     there is no account to include, so the old box for an address is
 *     there instead, and the report is anonymous as it always was.
 *   - INCLUDE THE LOG AND WHAT I'M USING: the log of what the app just did,
 *     and with it the unit, the phone's model and system, and the versions
 *     (lib/reports context). It can be read first (See what is sent, by the
 *     function that sends it) and unticked, as the log always could.
 *
 * Every Report a problem, Report this and Report a Bluetooth problem in the
 * app opens this one screen. One opened from Bluetooth's own places carries
 * the Bluetooth lines in its log's head (`bluetooth`, lib/logHead) and what
 * the app was saying when it was opened (`said`, a fault line), shown above
 * the box and sent under what was written.
 *
 * Nothing is gathered while somebody types. The log is read when Send is
 * pressed and at no other moment, so a report half-written and abandoned
 * leaves no copy of anything anywhere.
 */
export default function Report({ onBack, bluetooth = false, said = null }) {
  const deviceName = useRig(ofDeviceName)
  const preset = useRig(ofPreset)
  const [message, setMessage] = useState('')
  const [contact, setContact] = useState('')
  const [includeMe, setIncludeMe] = useState(true)
  const [withLog, setWithLog] = useState(true)
  const [preview, setPreview] = useState(null)
  const [shots, setShots] = useState([])
  const [video, setVideo] = useState(null)
  const [busy, setBusy] = useState(false)
  const [moved, setMoved] = useState(null)
  const [sent, setSent] = useState(null)
  const [error, setError] = useState(null)

  /*
   * WHO IS SIGNED IN ON THE PHONE, read off the phone: undefined until it
   * answers, then { id, email } or null. An account made by the old pairing
   * has a made-up address nobody reads, so it is offered as the account and
   * not as an email.
   */
  const [account, setAccount] = useState(undefined)
  useEffect(() => {
    let alive = true
    keptAccount().then((a) => alive && setAccount(a || null))
    return () => {
      alive = false
    }
  }, [])
  const email = account?.email && !isPairAccount(account.email) ? account.email : ''

  /* The runs before this one, as the log screen has them: a report's log carries them (lib/logHead runsBefore). */
  const [before, setBefore] = useState([])
  useEffect(() => {
    let alive = true
    pastRuns().then((runs) => alive && setBefore(runs))
    return () => {
      alive = false
    }
  }, [])

  /* What the log carries besides its lines: the same head and runs before as the log screen's send. */
  const extra = () => ({ head: headLines(logHeader({ deviceName, preset, bluetooth })), before: runsBefore(before) })

  const somethingToSend = !!message.trim() || shots.length > 0 || !!video
  const anonymous = !!account && !includeMe

  const send = async () => {
    if (busy || !somethingToSend) return
    setBusy(true)
    setError(null)
    setMoved(null)
    try {
      const done = await sendReport({
        kind: KIND,
        /* What they wrote, with a line under it when Bluetooth or a fault opened this (shared/report-rules formMessage). */
        message: formMessage({ typed: message, bluetooth, said }),
        contact: account ? (includeMe ? email : '') : contact,
        anonymous,
        context: context({ deviceName }),
        withLog,
        ...extra(),
        shots,
        video,
        onVideoProgress: (part) => setMoved(part)
      })
      // The text goes only once it is actually gone.
      setSent({ lost: [shotsLostWords(done?.shotsLost), videoLostWords(done?.videoLost)].filter(Boolean).join(' ') })
      setMessage('')
      setContact('')
      setPreview(null)
      setShots([])
      setVideo(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
      setMoved(null)
    }
  }

  /*
   * BACK, NOT DONE, AND NEVER A LOST REPORT. "Instead of saying done it should
   * say back instead of done because done sounds like it's ready to send", and
   * "we need to make sure that clicking the done button doesn't get rid of
   * whatever they type ... Send should be up at the top right and then there
   * should be a back button that also warns them that whatever they typed has
   * not been sent yet" (Justin, 27 October 2026). So the head is Back on the
   * left and Send on the right; Back with something written, or a picture or
   * video added, and not yet sent asks first. Straight back when there is
   * nothing to lose (nothing typed, or it has gone).
   */
  const unsent = !sent && (!!message.trim() || !!contact.trim() || shots.length > 0 || !!video)
  const back = () => {
    if (!unsent || busy) return onBack?.()
    Alert.alert('Not sent yet', 'What you wrote has not been sent. Leave without sending it?', [
      { text: 'Keep writing', style: 'cancel' },
      { text: 'Leave', style: 'destructive', onPress: () => onBack?.() }
    ])
  }

  const box = {
    color: color.silk,
    fontSize: font.body,
    backgroundColor: color.panel,
    borderWidth: 1,
    borderColor: color.rule,
    borderRadius: radius.md,
    padding: space.md
  }

  /* While a video goes, how much of it has: a minute of video on a phone's connection is not a moment. */
  const sending = moved === null ? 'Sending…' : `Sending… ${Math.round(moved * 100)}%`

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      /* The message box sits low on the screen and the keyboard covers it on
         iOS. Android resizes the window itself, so asking twice there pushes
         the whole screen up and leaves a gap under it. */
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={{ flex: 1 }}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: space.lg, gap: space.lg, paddingBottom: space.xxl }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md }}>
          <Press label="Back" height={40} onPress={back} />
          {sent ? null : (
            <Press label={busy ? sending : 'Send'} tone="signal" height={40} on={!busy && somethingToSend} disabled={busy || !somethingToSend} onPress={send} />
          )}
        </View>

        <Text accessibilityRole="header" style={{ color: color.silk, fontSize: font.title, fontWeight: '700' }}>
          {REPORT_TITLE}
        </Text>

        {sent ? (
          <View style={{ gap: space.md }}>
            <Note tone="hint" strong size={font.body}>{`${SENT_WORDS}${sent.lost ? ` ${sent.lost}` : ''}`}</Note>
            <Press label="Send another" onPress={() => setSent(null)} />
          </View>
        ) : (
          <>
            {/* The fault it was opened from, said so they know it goes too. */}
            {said ? <Note>{`This goes with it: ${said}`}</Note> : null}

            <TextInput
              value={message}
              onChangeText={setMessage}
              editable={!busy}
              multiline
              maxLength={MAX_MESSAGE}
              textAlignVertical="top"
              placeholder="What happened, or what would you like it to do?"
              placeholderTextColor={color.silkFaint}
              accessibilityLabel="Your message"
              style={{ ...box, minHeight: 140, lineHeight: 22 }}
            />

            <Attach shots={shots} onShots={setShots} video={video} onVideo={setVideo} disabled={busy} />

            <View style={{ gap: space.xs, padding: space.md, borderWidth: 1, borderColor: color.rule, borderRadius: radius.md, backgroundColor: color.panel }}>
              {account ? (
                <TickBox
                  on={includeMe}
                  label={email ? 'Include my email' : 'Include my account'}
                  sub={
                    includeMe
                      ? email
                        ? `${email}, so the answer comes back to you.`
                        : 'So the developer knows whose report it is.'
                      : 'Sent anonymously: no name, no email, no account.'
                  }
                  disabled={busy}
                  onPress={() => setIncludeMe(!includeMe)}
                />
              ) : account === null ? (
                <TextInput
                  value={contact}
                  onChangeText={setContact}
                  editable={!busy}
                  placeholder="Email, if you want an answer (optional)"
                  placeholderTextColor={color.silkFaint}
                  accessibilityLabel="Your email, if you want an answer"
                  autoCapitalize="none"
                  autoCorrect={false}
                  inputMode="email"
                  style={box}
                />
              ) : null}

              <TickBox
                on={withLog}
                label="Include the log and what I’m using"
                sub={
                  withLog
                    ? `The log of what the app just did, your unit, and your ${deviceNoun()}’s model and system.`
                    : 'Only what you wrote, and any picture or video, goes.'
                }
                disabled={busy}
                onPress={() => {
                  setWithLog(!withLog)
                  /* A preview belongs to a report that sends the log: left up with it unticked, it would show a log that is not going. */
                  setPreview(null)
                }}
              />
              <Press
                label={preview === null ? 'See what is sent' : 'Hide it'}
                height={44}
                disabled={busy || !withLog}
                onPress={() => setPreview(preview === null ? logPreview(KIND, extra()) : null)}
              />
              {preview !== null ? (
                /* Its own scroller, capped: the log is long by design and a
                   screen that grew by two hundred lines would put the rest
                   off the bottom of the phone. */
                <ScrollView nestedScrollEnabled style={{ maxHeight: 220, backgroundColor: color.chassis, borderRadius: radius.sm }} contentContainerStyle={{ padding: space.sm }}>
                  <Text selectable style={{ color: color.silkDim, fontSize: font.micro, fontFamily: face, lineHeight: 16 }}>
                    {preview || '(nothing has been logged yet this session)'}
                  </Text>
                </ScrollView>
              ) : null}
            </View>

            {error ? <Note tone="fault">{error}</Note> : null}

            <Text style={{ color: color.silkFaint, fontSize: font.micro, lineHeight: 18 }}>
              Your version, your {deviceNoun()}&rsquo;s model and OS, and which unit you&rsquo;re on are sent too, so it
              can be looked into.
              {withLog ? ' The log goes as well — you can read it above first.' : ''}
              {shots.length ? ' The pictures you added go too.' : ''}
              {video ? ' The video goes too, and is deleted after 7 days.' : ''} Nothing you&rsquo;ve built goes with it.
              {anonymous
                ? ' Sent anonymously, it is linked to nobody.'
                : account
                  ? ' It is linked to your account, so deleting the account deletes it too.'
                  : ''}
            </Text>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

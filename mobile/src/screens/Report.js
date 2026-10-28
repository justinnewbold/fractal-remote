import { useEffect, useState } from 'react'
import { Alert, KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, View } from 'react-native'

import { color, font, mono, radius, space } from '../lib/theme'
import { KINDS, MAX_MESSAGE, carriesLog, context, logPreview, sendReport, shotsLostWords } from '../lib/reports'
import { headLines } from '../lib/report-rules'
import { logHeader, runsBefore } from '../lib/logHead'
import { pastRuns } from '../lib/logKeep'
import { useRig } from '../lib/rig'
import Note from '../components/Note'
import Press from '../components/Press'
import Shots from '../components/Shots'
import { deviceNoun } from '../lib/device-word'

const face = Platform.select(mono)

/* Read off the rig here rather than handed down, the way the log screen does
   it: which unit is attached is a live fact, not something a caller should be
   trusted to have passed the current value of. */
const ofDeviceName = (s) => s.deviceName
const ofPreset = (s) => s.preset

/**
 * Telling us something is broken, or asking for something — from the phone.
 *
 * THE PHONE HAD NOWHERE TO SAY SO, which is the gap this fills. The browser
 * has had a box like this for a while, and a handset — the surface where the
 * bad evenings actually happen — could copy its log and nothing else. The
 * report only ever arrived if somebody remembered to paste it into a message
 * later, from another device, after the gig.
 *
 * TWO KINDS AND ONLY ONE CARRIES THE LOG. Somebody asking for a bigger tuner
 * has not offered a transcript of their evening, and this screen does not
 * quietly take one: the switch is not drawn at all on that side. On the bug
 * side it is drawn, it is on, and it can be turned off — and what it would
 * send can be read in full first, by the same function that sends it, so the
 * preview cannot drift from the thing being previewed.
 *
 * Nothing is gathered while somebody types. The log is read when Send is
 * pressed and at no other moment, so a report half-written and abandoned
 * leaves no copy of anything anywhere.
 *
 * EVERY CUSTOMER'S FORM IS THE DEFAULTS. `prefill` and `bluetooth` are handed
 * only by "Write it out, or add a screenshot" on Report a Bluetooth problem
 * (App.js `writingOut`, behind the Bluetooth page's own gate): the box
 * starts with what that screen said goes with it, and the log's head says
 * how Bluetooth stood (lib/logHead, `bluetooth`), which it does only for an
 * account Bluetooth is open to. Left out, as everywhere else, the box starts
 * empty and the head is what it always was.
 */
export default function Report({ onBack, start = 'bug', prefill = '', bluetooth = false }) {
  const deviceName = useRig(ofDeviceName)
  const preset = useRig(ofPreset)
  const [kind, setKind] = useState(KINDS.includes(start) ? start : 'bug')
  const [message, setMessage] = useState(() => String(prefill || '').slice(0, MAX_MESSAGE))
  const [contact, setContact] = useState('')
  const [withLog, setWithLog] = useState(true)
  const [preview, setPreview] = useState(null)
  const [shots, setShots] = useState([])
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(null)
  const [error, setError] = useState(null)

  /* The runs before this one, as the log screen has them: a bug's log carries them (lib/logHead runsBefore). */
  const [before, setBefore] = useState([])
  useEffect(() => {
    let alive = true
    pastRuns().then((runs) => alive && setBefore(runs))
    return () => {
      alive = false
    }
  }, [])

  const bug = carriesLog(kind)
  /* What the log carries besides its lines: the same head and runs before as the log screen's send. */
  const extra = () => ({ head: headLines(logHeader({ deviceName, preset, bluetooth })), before: runsBefore(before) })

  const send = async () => {
    setBusy(true)
    setError(null)
    try {
      const done = await sendReport({ kind, message, contact, context: context({ deviceName }), withLog, ...extra(), shots })
      // The text goes only once it is actually gone.
      setSent({ lost: shotsLostWords(done?.shotsLost) })
      setMessage('')
      setContact('')
      setPreview(null)
      setShots([])
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  /*
   * BACK, NOT DONE, AND NEVER A LOST REPORT. "Instead of saying done it should
   * say back instead of done because done sounds like it's ready to send", and
   * "we need to make sure that clicking the done button doesn't get rid of
   * whatever they type ... Send should be up at the top right and then there
   * should be a back button that also warns them that whatever they typed has
   * not been sent yet" (Justin, 27 October 2026). So the head is Back on the
   * left and Send on the right; Back with something written, or a screenshot
   * added, and not yet sent asks first. Straight back when there is nothing
   * to lose (nothing typed, or it has gone).
   */
  const unsent = !sent && (!!message.trim() || !!contact.trim() || shots.length > 0)
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
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: space.md
          }}
        >
          <View style={{ flexShrink: 1 }}>
            <Text
              accessibilityRole="header"
              style={{ color: color.silk, fontSize: font.title, fontWeight: '700' }}
            >
              Feedback
            </Text>
            <Text style={{ color: color.silkDim, fontSize: font.small }}>
              Something broken, or something you want
            </Text>
          </View>
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <Press label="Back" height={40} onPress={back} />
            {sent ? null : (
              <Press
                label={busy ? 'Sending…' : 'Send'}
                tone="signal"
                height={40}
                on={!busy && !!message.trim()}
                disabled={busy || !message.trim()}
                onPress={send}
              />
            )}
          </View>
        </View>

        {sent ? (
          <View style={{ gap: space.md }}>
            <Note tone="hint">{`Sent to the developer — thank you.${sent.lost ? ` ${sent.lost}` : ''}`}</Note>
            <Press label="Send another" onPress={() => setSent(null)} />
          </View>
        ) : (
          <>
            <View style={{ flexDirection: 'row', gap: space.sm }}>
              {KINDS.map((k) => (
                <Press
                  key={k}
                  grow
                  height={48}
                  /* Short enough for a 375-wide phone: "Something is broken" was cut to "Something is bro…" (27 October 2026). */
                  label={k === 'bug' ? 'Problem' : 'Idea'}
                  on={kind === k}
                  disabled={busy}
                  onPress={() => {
                    setKind(k)
                    /* A preview belongs to the kind it was made for. Left up
                       while switching to the side that sends no log, it would
                       show a log beside a form not sending one. */
                    setPreview(null)
                  }}
                />
              ))}
            </View>

            <TextInput
              value={message}
              onChangeText={setMessage}
              editable={!busy}
              multiline
              maxLength={MAX_MESSAGE}
              textAlignVertical="top"
              placeholder={
                bug
                  ? 'What happened, and what did you expect instead?'
                  : 'What would you like it to do?'
              }
              placeholderTextColor={color.silkFaint}
              accessibilityLabel={bug ? 'What went wrong' : 'What you want'}
              style={{ ...box, minHeight: 120, lineHeight: 22 }}
            />

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

            {bug ? (
              <View
                style={{
                  gap: space.md,
                  padding: space.md,
                  borderWidth: 1,
                  borderColor: color.rule,
                  borderRadius: radius.md,
                  backgroundColor: color.panel
                }}
              >
                {/*
                  A SWITCH THAT SAYS IT IS ONE. "The button that says 'send
                  what the app just did' when you click it, it just highlights
                  the button and doesn't say anything else. I don't even know if
                  you got the report or not" (Justin, 25 October 2026, on
                  Android, after tapping it twelve times before Send). It read
                  as a button that sends, and all a tap did was light it or
                  dim it. So it says on or off, as the metronome's does, and
                  the line under it says what that means for Send.
                */}
                <View style={{ gap: space.xs }}>
                  <Press
                    label={withLog ? 'Include the log: on' : 'Include the log: off'}
                    tone="live"
                    on={withLog}
                    disabled={busy}
                    onPress={() => setWithLog(!withLog)}
                  />
                  <Text style={{ color: color.silkDim, fontSize: font.small, paddingHorizontal: space.sm }}>
                    {withLog
                      ? 'The log of what the app just did goes with your report when you tap Send.'
                      : 'Only what you wrote goes when you tap Send.'}
                  </Text>
                </View>
                <Press
                  label={preview === null ? 'See what that is' : 'Hide it'}
                  height={44}
                  disabled={busy || !withLog}
                  onPress={() => setPreview(preview === null ? logPreview(kind, extra()) : null)}
                />
                {preview !== null ? (
                  /* Its own scroller, capped: the log is long by design and a
                     screen that grew by two hundred lines would put Send off
                     the bottom of the phone. */
                  <ScrollView
                    nestedScrollEnabled
                    style={{
                      maxHeight: 220,
                      backgroundColor: color.chassis,
                      borderRadius: radius.sm
                    }}
                    contentContainerStyle={{ padding: space.sm }}
                  >
                    <Text
                      selectable
                      style={{ color: color.silkDim, fontSize: font.micro, fontFamily: face, lineHeight: 16 }}
                    >
                      {preview || '(nothing has been logged yet this session)'}
                    </Text>
                  </ScrollView>
                ) : null}
              </View>
            ) : (
              <Note tone="hint">No log goes with this one — just what you wrote.</Note>
            )}

            {/* A picture of what went wrong, or of what they want: either kind can carry them. */}
            <Shots shots={shots} onChange={setShots} disabled={busy} />

            {error ? <Note tone="fault">{error}</Note> : null}

            <Text style={{ color: color.silkFaint, fontSize: font.micro, lineHeight: 18 }}>
              Your version, your {deviceNoun()}&rsquo;s OS and which unit you&rsquo;re on are sent too, so it
              can be looked into.
              {bug && withLog ? ' The log goes as well — you can read it above first.' : ''}
              {shots.length ? ' The screenshots you added go too.' : ''} Nothing
              you&rsquo;ve built goes with it. If you&rsquo;re signed in, the report is linked to your account,
              so deleting the account deletes it too.
            </Text>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

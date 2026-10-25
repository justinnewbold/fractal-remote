import { useEffect, useRef, useState } from 'react'
import { AccessibilityInfo, Platform, ScrollView, Text, View } from 'react-native'

import { color, font, space } from '../lib/theme'
import { REASONS, reportNote } from '../lib/bleReport'
import { REPORT_BUTTON } from '../lib/bluetooth-gear'
import { logHeader, runsBefore } from '../lib/logHead'
import { pastRuns } from '../lib/logKeep'
import { headLines } from '../lib/report-rules'
import { SENT_WORDS, sendLogs } from '../lib/reports'
import { useRig } from '../lib/rig'
import { deviceNoun } from '../lib/device-word'
import Note from '../components/Note'
import Press from '../components/Press'

const ofDeviceName = (s) => s.deviceName
const ofPreset = (s) => s.preset

/**
 * Report a Bluetooth problem: a row of answers, and a tap on one sends it.
 *
 * "Super easy for all users to submit bugs and feedback." (Justin, 25 October
 * 2026, deciding that Bluetooth (beta) goes to every customer with the full
 * version, marked beta.) The Feedback form is every customer's, and sends
 * nothing until something is typed; a player whose adapter will not connect,
 * on a stage, will not type. So this is the answers (lib/bleReport REASONS),
 * and a tap on one sends a bug report there and then, through the one-tap
 * send the log screen uses (lib/reports sendLogs): the answer as the
 * message's first line, what the app was saying when this was opened (a
 * fault line, when it came from one) under it, the log, and the log's head,
 * which on this report says how Bluetooth stood (lib/logHead, `bluetooth`).
 * Nothing is typed, so nothing typed can be lost.
 *
 * NOT THE FEEDBACK FORM, AND IT LEAVES THE FORM AS IT WAS. The form is
 * reached from every customer's Settings and its words are on the privacy
 * page; this is a screen of its own, reached only from Bluetooth's own
 * places (the Bluetooth page, the note under Play's pill, a fault on Play
 * while over Bluetooth, the waiting screen while it looks for the adapter),
 * which are drawn for an account Bluetooth is open to and nobody else. To
 * write more or add a screenshot, the last button opens the form itself.
 *
 * HELP IS JUSTIN'S OWN CHANNEL. It goes to him, as every report does, and to
 * nobody else: nothing here sends a player anywhere else for help with the app.
 *
 * Done goes back where it was opened from (App.js reportFrom).
 */
export default function BluetoothReport({ onBack, said = null, onWriteMore }) {
  const deviceName = useRig(ofDeviceName)
  const preset = useRig(ofPreset)

  /* The runs before this one, as the log screen has them: a report carries them (lib/logHead runsBefore). */
  const [before, setBefore] = useState([])
  useEffect(() => {
    let alive = true
    pastRuns().then((runs) => alive && setBefore(runs))
    return () => {
      alive = false
    }
  }, [])

  /*
   * ONE AT A TIME, AND SAID SO IT IS SEEN AND HEARD, as the log screen's
   * send is: the ref is set before the first await, so a second tap that
   * lands before the screen has redrawn is turned away; what it said is the
   * bright, bold note under the answers, spoken on the iPhone (a fault note
   * is a live region on Android already). Every answer stays pressable once
   * one has gone: "It won't connect" and then "It works on my unit" is two
   * true reports.
   */
  const [sending, setSending] = useState(null)
  const [answer, setAnswer] = useState(null)
  const inFlight = useRef(false)
  const send = async (key) => {
    if (inFlight.current) return
    inFlight.current = true
    setSending(key)
    setAnswer(null)
    try {
      await sendLogs({
        deviceName,
        note: reportNote(key, said),
        head: headLines(logHeader({ deviceName, preset, bluetooth: true })),
        before: runsBefore(before)
      })
      setAnswer({ ok: true, words: SENT_WORDS })
      AccessibilityInfo.announceForAccessibility?.(SENT_WORDS)
    } catch (err) {
      const words = err?.message || String(err)
      setAnswer({ ok: false, words })
      if (Platform.OS === 'ios') AccessibilityInfo.announceForAccessibility?.(words)
    } finally {
      inFlight.current = false
      setSending(null)
    }
  }

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: space.lg, gap: space.lg, paddingBottom: space.xxl }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md }}>
        <View style={{ flexShrink: 1 }}>
          <Text accessibilityRole="header" style={{ color: color.silk, fontSize: font.title, fontWeight: '700' }}>
            {REPORT_BUTTON}
          </Text>
          <Text style={{ color: color.silkDim, fontSize: font.small }}>Or tell us it works</Text>
        </View>
        <Press label="Done" height={40} onPress={onBack} />
      </View>

      <Text style={{ color: color.silk, fontSize: font.body, lineHeight: 22 }}>
        Tap what happened. It is sent straight away, with the log of what the app just did, so the problem can be found.
        Nothing to type.
      </Text>
      {/* The fault it was opened from, said so they know it goes too. */}
      {said ? <Note>{`This goes with it: ${said}`}</Note> : null}

      <View style={{ gap: space.sm }}>
        {REASONS.map((r) => (
          <Press
            key={r.key}
            label={sending === r.key ? 'Sending…' : r.label}
            tone={r.key === 'works' ? 'live' : 'plain'}
            disabled={!!sending}
            onPress={() => send(r.key)}
          />
        ))}
      </View>
      {answer ? (
        <Note tone={answer.ok ? 'hint' : 'fault'} strong size={font.body}>
          {answer.words}
        </Note>
      ) : null}

      {onWriteMore ? <Press label="Write it out, or add a screenshot" height={44} disabled={!!sending} onPress={onWriteMore} /> : null}

      <Text style={{ color: color.silkFaint, fontSize: font.micro, lineHeight: 18 }}>
        {`Your version, your ${deviceNoun()}’s OS and which unit you’re on are sent too, and the log of what the app just did, which says how Bluetooth was set up: the unit you picked, and the adapter by its name, never its Bluetooth address. When the app is connected to a computer, the computer’s own log goes as well. Nothing you’ve built goes with it. If you’re signed in, the report is linked to your account, so deleting the account deletes it too.`}
      </Text>
    </ScrollView>
  )
}

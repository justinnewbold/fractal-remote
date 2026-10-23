import { useEffect, useRef, useState } from 'react'
import { AccessibilityInfo, FlatList, KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, View } from 'react-native'
import * as Clipboard from 'expo-clipboard'

import { color, font, mono, radius, space } from '../lib/theme'
import { clearDebugLog, formatDebugLog, formatLine, getDebugLog, onDebugLog } from '../lib/debugLog'
import { pastRuns } from '../lib/logKeep'
import { ended, logHeader, runsBefore } from '../lib/logHead'
import { MAX_MESSAGE, NOTE_PLACEHOLDER, headLines } from '../lib/report-rules'
import { SENT_WORDS, sendLogs, shotsLostWords } from '../lib/reports'
import { useRig } from '../lib/rig'
import Note from '../components/Note'
import Press from '../components/Press'
import Shots from '../components/Shots'

const face = Platform.select(mono)

const ofDeviceName = (s) => s.deviceName
const ofPreset = (s) => s.preset

/** One line of the log, this run's or a kept one's. Red when it is the bad kind. */
function Line({ text, hot }) {
  return (
    <Text
      selectable
      style={{
        color: hot ? color.fault : color.silkDim,
        fontSize: font.micro,
        fontFamily: face,
        lineHeight: 16,
        paddingVertical: 2,
        paddingHorizontal: space.sm,
        borderRadius: radius.sm,
        backgroundColor: color.panel
      }}
    >
      {text}
    </Text>
  )
}

/**
 * What happened, in the order it happened, and a button that copies it.
 *
 * "I need a debug log with a copy log button so I can paste the log for you to
 * debug."
 *
 * THIS MATTERS MORE ON A PHONE THAN ANYWHERE ELSE and the phone had none. A
 * browser has a console somebody can open; a phone on a dark stage has nowhere
 * at all for a failure to go, so every bad evening was unreconstructable — the
 * screen showed the latest state and nothing about the sequence that produced
 * it. "It kept dropping" cannot be answered from a screen that says
 * "Connected".
 *
 * WHAT GOES IN IT is written at the two choke points every trip passes through:
 * lib/relay logs the shape of each request that failed or took a noticeable
 * moment, and lib/link logs every change of mind about the Mac. Bodies are
 * deliberately not kept — this is written to be pasted into a chat, and a
 * preset dump is neither readable nor anybody else's business.
 *
 * THE COPY CARRIES A HEADER, because the first three questions about any report
 * are which build, which unit and which end of the link — and none of them can
 * be read off the lines themselves.
 */
export default function Log({ onBack }) {
  const [lines, setLines] = useState(() => getDebugLog())
  const [said, setSaid] = useState(null)
  const deviceName = useRig(ofDeviceName)
  const preset = useRig(ofPreset)

  /*
   * SEND LOGS TO DEVELOPER SENDS, HERE, IN ONE TAP.
   *
   * "Check if the log was sent. There was no confirmation." It had not been:
   * the button opened the Feedback form, whose Send waits for something to
   * be typed, and Done there went back having sent nothing. Now it sends the
   * log there and then (lib/reports sendLogs: the app's own one-line
   * message, the log, and the computer's own log when there is a computer),
   * and says under itself that it went, or why not. The form is still in
   * Settings → Troubleshooting → Feedback for anybody with something to say.
   *
   * Never twice at once: the ref is set before the first await, so a second
   * tap that lands before the screen has redrawn is turned away as surely as
   * one on the grayed-out button. What it said stays until the screen is left.
   *
   * SAID SO IT IS SEEN, AND HEARD. The answer is the bright, bold, body-sized
   * note every tool here gives the button just pressed, never the gray hint
   * a sent line was at first (quieter than a failure beside it). And it is
   * said out loud: a 'hint' note is no live region, so a screen reader heard
   * a failure and nothing at all when it went. A failure's red note is a
   * live region on Android, so that one is spoken here on the iPhone only.
   */
  /*
   * A NOTE AND SCREENSHOTS, BEFORE THE ONE TAP. "Where's the space to enter
   * a message and upload photos?" Both optional: the button sends with the
   * box empty, as it always has, and a typed note is the message instead of
   * the app's sentence. They go once the report has, and stay when it has
   * not, so nothing typed is lost to a dropped connection.
   */
  const [note, setNote] = useState('')
  const [shots, setShots] = useState([])
  const [sending, setSending] = useState(false)
  /* What Send said, or what a paste said (`paste`): one line in the foot, the latest. */
  const [sentSaid, setSentSaid] = useState(null)
  const sayPaste = (words) => setSentSaid(words ? { ok: false, words, paste: true } : null)
  const inFlight = useRef(false)
  const send = async () => {
    if (inFlight.current) return
    inFlight.current = true
    setSending(true)
    setSentSaid(null)
    try {
      const sent = await sendLogs({ deviceName, note, shots, head: headLines(logHeader({ deviceName, preset })), before: runsBefore(before) })
      /* A picture that could not go is said in the same line: the report went without it. */
      const words = [SENT_WORDS, shotsLostWords(sent?.shotsLost)].filter(Boolean).join(' ')
      setSentSaid({ ok: true, words })
      AccessibilityInfo.announceForAccessibility?.(words)
      setNote('')
      setShots([])
    } catch (err) {
      const words = err?.message || String(err)
      setSentSaid({ ok: false, words })
      if (Platform.OS === 'ios') AccessibilityInfo.announceForAccessibility?.(words)
    } finally {
      inFlight.current = false
      setSending(false)
    }
  }

  useEffect(() => onDebugLog(() => setLines(getDebugLog())), [])

  /*
   * And what the run before this one had to say.
   *
   * The whole reason this exists: the run that needs reading is the one that
   * ended, and until now it took its log with it.
   */
  const [before, setBefore] = useState([])
  useEffect(() => {
    let alive = true
    pastRuns().then((runs) => alive && setBefore(runs))
    return () => {
      alive = false
    }
  }, [])

  /*
   * The note, the pictures and Send stay while there is anything to send:
   * this run's lines, the runs before (a report carries them, and after a
   * crash they are the report), or a note or a picture already added. Clear
   * Logs used to take the note box, the pictures and Send away with the lines
   * (second review, 23 October 2026).
   */
  const sendable = Boolean(lines.length || before.length || note || shots.length)

  useEffect(() => {
    if (!said) return undefined
    const t = setTimeout(() => setSaid(null), 3000)
    return () => clearTimeout(t)
  }, [said])

  const copy = async () => {
    /*
     * The head (lib/logHead logHeader: which build, unit, computer and link),
     * and the previous runs' tails in the same paste, each under its own
     * heading. If this launch is the one AFTER a crash, that block is the
     * crash — and it is the half somebody actually needs. A report sent from
     * here carries the same two, from the same place.
     */
    const text = formatDebugLog(logHeader({ deviceName, preset }), runsBefore(before).join('\n\n'))
    try {
      await Clipboard.setStringAsync(text)
      setSaid(`Copied ${lines.length} line${lines.length === 1 ? '' : 's'}. Paste it into the chat.`)
    } catch (err) {
      setSaid(`Couldn’t copy: ${err.message}`)
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      /* The note box sits at the foot of the screen and the keyboard covers it
         on iOS. Android resizes the window itself (as the Feedback form says). */
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: space.lg,
          gap: space.md
        }}
      >
        <View style={{ flexShrink: 1 }}>
          <Text accessibilityRole="header" style={{ color: color.silk, fontSize: font.title, fontWeight: '700' }}>
            Help & fixes
          </Text>
          <Text style={{ color: color.silkDim, fontSize: font.small }}>
            {`${lines.length} line${lines.length === 1 ? '' : 's'} in the log${
              before.length ? ` · ${before[0].lines.length} kept from the run before` : ''
            }`}
          </Text>
        </View>
        <Press label="Done" height={40} onPress={onBack} />
      </View>

      <View style={{ paddingHorizontal: space.lg, gap: space.sm, paddingBottom: space.sm }}>
        {/*
          Copy and Clear side by side, as the browser's Debug log has them,
          and far from Send. Clear came up here from the foot of the screen so
          that the foot holds only Send and what it said, which then always
          fit on the smallest phone (review, 23 October 2026).
        */}
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <Press
            label="Copy Logs"
            grow
            /*
              Named on the button, because it is the reason to press it after a
              crash: the copy carries the end of the previous run as well as this
              one, and after a crash that block is the crash.
            */
            sub={before.length ? `This run and the ${before.length === 1 ? 'one' : before.length} before it` : 'Then paste it into the chat'}
            tone="signal"
            onPress={copy}
            disabled={!lines.length}
          />
          {/* Not while a send is on its way: it reads the log after the computer has answered. */}
          {lines.length ? <Press label="Clear Logs" disabled={sending} onPress={() => { clearDebugLog(); setLines([]) }} /> : null}
        </View>
        {said ? <Note>{said}</Note> : null}
        {!lines.length ? (
          <Note>
            Nothing has gone wrong yet this session. The log fills up on its own — leave the app
            open, do the thing that misbehaves, then come back and copy it.
          </Note>
        ) : null}
      </View>

      <FlatList
        /*
          Its height is only what the rest leaves (flex 1 from nothing), so it
          is the first to give up room: the note and the pictures shrink only
          once it has none left, and Send never. So while the foot holds a
          line, the scroller's cap comes down (below), or a tall line under
          Send took the whole of it on a small phone.
        */
        style={{ flex: 1 }}
        data={[...lines].reverse()}
        keyExtractor={(entry, i) => `${entry.at}-${i}`}
        contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: space.xxl, gap: space.xs }}
        initialNumToRender={30}
        windowSize={7}
        renderItem={({ item }) => <Line text={formatLine(item)} hot={item.source === 'crash' || /fail|gave up|refused/i.test(item.message)} />}
        /*
          THE RUNS BEFORE THIS ONE, ON THE SCREEN. They were in the copy and
          nowhere else, so a person who opened this after a crash saw this
          run's handful of lines and nothing from the run that died — "it
          looks like the debug log is not persisting through crashes". It was;
          it was not being shown. Under this run's lines, each run under its
          own heading, oldest line first because that half reads as a story.
        */
        ListFooterComponent={
          before.length ? (
            <View style={{ gap: space.xs, paddingTop: space.lg }}>
              {before.map((run, i) => (
                <View key={`${run.at}-${i}`} style={{ gap: space.xs }}>
                  <Text style={{ color: color.signal, fontSize: font.micro, fontWeight: '700', letterSpacing: 1.5, paddingTop: space.sm }}>
                    {`${i === 0 ? 'THE RUN BEFORE THIS ONE' : `${i + 1} RUNS AGO`} · ${run.lines.length} lines · last written ${ended(run.at)}`}
                  </Text>
                  <Text style={{ color: color.silkFaint, fontSize: font.micro }}>
                    If the app crashed or was killed, this is what it said on the way. Oldest line first.
                  </Text>
                  {run.lines.map((text, j) => (
                    <Line key={j} text={text} hot={/\[crash\]|fail|gave up|refused/i.test(text)} />
                  ))}
                </View>
              ))}
            </View>
          ) : null
        }
      />

      {sendable ? (
        <>
          {/*
            THE NOTE AND THE PICTURES, in a scroller of their own: no more than
            a third of the screen, and smaller still when the log list has no
            room left to give (a small phone, the keyboard up). Never Send.
            A fifth while the foot says something: on a 320 by 568 screen a
            four-line answer under Send left the log list two points tall,
            with the scroller still at its full third (second review).

            A React Native ScrollView shrinks of its own accord, so Send under
            it inside the same scroller was pushed below the screen on a small
            phone, or by one screenshot, or by a long log, and what it said
            after a send with it: the one tap became a scroll and a tap, and
            "Sent" could be out of sight, which is the "there was no
            confirmation" this button was made to answer (review, 23 October
            2026).
          */}
          <ScrollView
            style={{ flexGrow: 0, flexShrink: 1, maxHeight: sentSaid ? '20%' : '35%' }}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingHorizontal: space.lg, paddingTop: space.md, gap: space.sm }}
          >
            {/*
              Newest first on screen, oldest first in the copy. Reading on a phone
              you want the thing that just happened; reading a paste you want the
              story in order.
            */}
            <TextInput
              value={note}
              onChangeText={setNote}
              editable={!sending}
              multiline
              maxLength={MAX_MESSAGE}
              textAlignVertical="top"
              placeholder={NOTE_PLACEHOLDER}
              placeholderTextColor={color.silkFaint}
              accessibilityLabel="What happened, if you want to say"
              style={{
                color: color.silk,
                fontSize: font.body,
                backgroundColor: color.panel,
                borderWidth: 1,
                borderColor: color.rule,
                borderRadius: radius.md,
                padding: space.md,
                minHeight: 64,
                lineHeight: 22
              }}
            />
            <Shots shots={shots} onChange={setShots} disabled={sending} say={sayPaste} />
          </ScrollView>
          {/* Sending beats copying, and until now copying was all there was:
              the log went into the clipboard and then had to survive being
              pasted somewhere, from a phone, after the thing that went wrong.
              Copy stays — a log pasted into a message to a bandmate is a real
              use — but this is the one that reaches the person who can fix it.
              Fixed at the foot, never in the scroller: always on screen, and
              what it said always under it, bright, bold and body-sized. What a
              paste said goes there too, the latest of the two, in a fault
              note's own size as under its button. */}
          <View style={{ flexShrink: 0, paddingHorizontal: space.lg, paddingTop: space.sm, paddingBottom: space.lg, gap: space.sm }}>
            <Press
              label={sending ? 'Sending…' : 'Send logs to developer'}
              tone="signal"
              disabled={sending}
              onPress={send}
            />
            {sentSaid ? (
              <Note tone={sentSaid.ok ? 'hint' : 'fault'} strong={!sentSaid.paste} size={sentSaid.paste ? undefined : font.body}>
                {sentSaid.words}
              </Note>
            ) : null}
          </View>
        </>
      ) : null}
    </KeyboardAvoidingView>
  )
}

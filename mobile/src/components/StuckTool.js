import { useCallback, useEffect, useState } from 'react'
import { Alert, Text, View } from 'react-native'
import * as Clipboard from 'expo-clipboard'

import { color, font, space, TAP } from '../lib/theme'
import { DEFAULT_PROJECT } from '../lib/project'
import { supabaseClient } from '../lib/relay'
import { accessAction, stuckChoices, stuckProblem, stuckRow, stuckSections, stuckTurnOnWords, withLeftOut, withRefusalCleared } from '../lib/admin'
import Facts from './Facts'
import Note from './Note'
import Press from './Press'
import Sheet from './Sheet'

/**
 * PAID BUT NO COMPUTER YET — Justin's page, and nobody else's.
 *
 * "About 12 of your first 40 paying customers never got the computer app
 * signed in. ... a 'paid but stuck' list on your Developer page." Everybody
 * with the full version that no computer app has ever been seen signed in
 * on, with what the setup emails have done for them, and the switch that
 * turns those emails on. The same server as Give someone access
 * (supabase/functions/grant-access), which decides who may ask.
 *
 * TURNING THEM ON IS ASKED TWICE, because it emails real customers within
 * the hour. Send me a sample first puts both emails in his own inbox; tap
 * somebody to leave them out (the store review's demo account, his own test
 * accounts).
 *
 * Against a server that has not had this part put live, the page says so in
 * those words rather than "Unknown action." (stuckProblem in admin).
 *
 * A REFUSED EMAIL CAN BE TRIED AGAIN from their sheet. The mail service
 * refusing somebody's address stops their emails for good, and before this
 * only SQL typed by hand could undo it.
 *
 * THE SHEET READS THE PERSON FROM THE LIST, every time it is drawn
 * (stuckRow), not from the row as it was when tapped: after Leave them out
 * it once said the email was still coming, right above "is left out". The
 * list itself takes the server's answer at once (withLeftOut), then is read
 * again.
 */
export default function StuckTool() {
  const [busy, setBusy] = useState(false)
  const [said, setSaid] = useState(null)
  const [told, setTold] = useState(null)
  const [open, setOpen] = useState(null)
  const [doing, setDoing] = useState(null)
  const [sheetSaid, setSheetSaid] = useState(null)

  const ask = useCallback(async (action, email, extra) => {
    const { data } = await supabaseClient().auth.getSession()
    return accessAction({
      url: DEFAULT_PROJECT.url,
      anonKey: DEFAULT_PROJECT.anonKey,
      token: data?.session?.access_token,
      action,
      email,
      extra
    })
  }, [])

  const load = useCallback(async () => {
    setBusy(true)
    try {
      setSaid(await ask('stuck'))
    } finally {
      setBusy(false)
    }
  }, [ask])

  useEffect(() => {
    load()
  }, [load])

  const run = async (what, action, extra) => {
    setDoing(what)
    setTold(null)
    try {
      const res = await ask(action, undefined, extra)
      setTold(res.ok ? res : { ...res, message: stuckProblem(res) })
      if (res.ok && action === 'reminders') load()
    } finally {
      setDoing(null)
    }
  }

  const turn = (on) => {
    if (!on) return run('switch', 'reminders', { on: false })
    Alert.alert(
      'Turn the setup emails on?',
      stuckTurnOnWords(said),
      [
        { text: 'Not yet', style: 'cancel' },
        { text: 'Turn them on', onPress: () => run('switch', 'reminders', { on: true }) }
      ]
    )
  }

  const pick = (row) => {
    setSheetSaid(null)
    setOpen(row)
  }

  const copy = async () => {
    try {
      await Clipboard.setStringAsync(open.email)
      setSheetSaid({ ok: true, message: `Copied ${open.email}.` })
    } catch (err) {
      setSheetSaid({ ok: false, message: `Couldn’t copy it (${err?.message || err}). Hold the email down to select it instead.` })
    }
  }

  const leave = async (out) => {
    setDoing(out ? 'leave' : 'back')
    setSheetSaid(null)
    try {
      const res = await ask('leave-out', open.email, { out })
      setSheetSaid(res.ok ? res : { ...res, message: stuckProblem(res) })
      if (res.ok) {
        setSaid((was) => withLeftOut(was, open.email, res.leftOut === true))
        load()
      }
    } finally {
      setDoing(null)
    }
  }

  const again = async () => {
    setDoing('again')
    setSheetSaid(null)
    try {
      const res = await ask('try-again', open.email)
      setSheetSaid(res.ok ? res : { ...res, message: stuckProblem(res) })
      if (res.ok) {
        setSaid((was) => withRefusalCleared(was, open.email))
        load()
      }
    } finally {
      setDoing(null)
    }
  }

  const problem = stuckProblem(said)
  /* The person as the list has them now; `open` only says who. */
  const person = stuckRow(said, open?.email, open)
  const choices = stuckChoices(person)
  const sending = said?.ok && said.sending === true

  return (
    <View style={{ gap: space.lg }}>
      {problem ? <Note tone="fault">{problem}</Note> : null}
      {said?.ok ? stuckSections(said).map((s) => <Facts key={s.title} title={s.title} rows={s.rows} onRow={pick} />) : null}
      {told ? (
        <Note tone={told.ok ? 'hint' : 'fault'} strong size={font.body}>
          {told.message}
        </Note>
      ) : null}
      {said?.ok ? (
        <Press
          label={doing === 'switch' ? 'Changing…' : sending ? 'Turn the setup emails off' : 'Turn the setup emails on'}
          tone={sending ? 'plain' : 'signal'}
          height={TAP}
          disabled={!!doing}
          onPress={() => turn(!sending)}
        />
      ) : null}
      {said?.ok ? (
        <Press
          label={doing === 'sample' ? 'Sending…' : 'Send me a sample of both emails'}
          height={TAP}
          disabled={!!doing}
          onPress={() => run('sample', 'reminder-sample')}
        />
      ) : null}
      <Press label={busy ? 'Loading…' : 'Refresh'} height={TAP} disabled={busy} onPress={load} />

      <Sheet open={!!person} onClose={() => setOpen(null)} title={person?.email || ''}>
        <View style={{ gap: space.md }}>
          <Text selectable style={{ color: color.silk, fontSize: font.body, fontWeight: '700' }}>
            {person?.email}
          </Text>
          <Text selectable style={{ color: color.silkDim, fontSize: font.small, lineHeight: font.small * 1.5 }}>
            {person?.line}
          </Text>
          {sheetSaid ? (
            <Note tone={sheetSaid.ok ? 'hint' : 'fault'} strong size={font.body}>
              {sheetSaid.message}
            </Note>
          ) : null}
          <Press label="Copy email" height={TAP} disabled={!!doing} onPress={copy} />
          {choices.tryAgain ? (
            <Press
              label={doing === 'again' ? 'Trying again…' : 'Try the email again'}
              height={TAP}
              disabled={!!doing}
              onPress={again}
            />
          ) : null}
          {choices.leaveOut ? (
            <Press
              label={doing === 'leave' ? 'Leaving them out…' : 'Leave them out'}
              height={TAP}
              disabled={!!doing}
              onPress={() => leave(true)}
            />
          ) : null}
          {choices.putBack ? (
            <Press
              label={doing === 'back' ? 'Putting them back…' : 'Put them back'}
              height={TAP}
              disabled={!!doing}
              onPress={() => leave(false)}
            />
          ) : null}
        </View>
      </Sheet>
    </View>
  )
}

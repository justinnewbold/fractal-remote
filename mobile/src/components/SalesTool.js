import { useCallback, useEffect, useRef, useState } from 'react'
import { Alert, View } from 'react-native'

import { TAP, font, space } from '../lib/theme'
import { DEFAULT_PROJECT } from '../lib/project'
import { supabaseClient } from '../lib/relay'
import { accessAction, handledAsk, handledProblem, salesSections, withHandled } from '../lib/admin'
import Facts from './Facts'
import Note from './Note'
import Press from './Press'

/**
 * SALES AT A GLANCE — Justin's page, and nobody else's.
 *
 * "Purchases today, this week and all time, with a count per platform." Asked
 * for as the page opens and again on Refresh; the same server as Give someone
 * access (supabase/functions/grant-access), which decides who may ask.
 *
 * HANDLED. "I've already handled this paid twice thing ... I wanna [be able
 * to] mark as completed or so that it doesn't appear anymore after it's been
 * handled." (15 October 2026.) Every Paid twice row, and every Paid, account
 * never confirmed row, has a Handled button under it. One short question
 * first, then the server keeps the mark and the row is gone: from this page
 * at once, and from every later count until that person pays again. The
 * words, the question and what is left out are all shared/admin.mjs's, so the
 * browser's copy (src/components/SalesTool.jsx) says exactly the same.
 */
export default function SalesTool() {
  const [busy, setBusy] = useState(false)
  const [said, setSaid] = useState(null)
  const [doing, setDoing] = useState(null)
  const [told, setTold] = useState(null)
  /* What was marked on this page, so a count already on its way when it was
     marked does not put the row back. */
  const marked = useRef([])

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
      const answer = await ask('sales')
      setSaid(marked.current.reduce((was, row) => withHandled(was, row), answer))
    } finally {
      setBusy(false)
    }
  }, [ask])

  useEffect(() => {
    load()
  }, [load])

  const handle = async (row) => {
    setDoing(`${row.kind}:${row.email}`)
    setTold(null)
    try {
      const res = await ask('handled', row.email, { kind: row.kind, until: row.until, count: row.count, nearCount: row.nearCount })
      if (res.ok) {
        marked.current.push(row)
        setSaid((was) => withHandled(was, row))
        setTold(res)
      } else {
        /* The row stays, so a refusal is said where the tap was, not in the
           line at the foot of the page, which is a screen or two below it. */
        setTold({ ...res, message: handledProblem(res) })
        Alert.alert(handledProblem(res))
      }
    } finally {
      setDoing(null)
    }
  }

  const confirm = (row) => {
    const q = handledAsk(row)
    if (!q) return
    Alert.alert(q.title, q.message, [
      { text: q.cancel, style: 'cancel' },
      { text: q.confirm, onPress: () => handle(row) }
    ])
  }

  /* Under each row Handled is for, and nothing under any other. */
  const detail = (row) =>
    handledAsk(row) ? (
      <Press
        label={doing === `${row.kind}:${row.email}` ? 'Marking…' : 'Handled'}
        height={TAP}
        disabled={!!doing}
        accessibilityLabel={`Mark ${row.email} as handled`}
        onPress={() => confirm(row)}
      />
    ) : null

  return (
    <View style={{ gap: space.lg }}>
      {said && !said.ok ? <Note tone="fault">{said.message}</Note> : null}
      {said?.ok ? salesSections(said).map((s) => <Facts key={s.title} title={s.title} rows={s.rows} detail={detail} />) : null}
      {told ? (
        <Note tone={told.ok ? 'hint' : 'fault'} strong size={font.body}>
          {told.message}
        </Note>
      ) : null}
      <Press label={busy ? 'Counting…' : 'Refresh'} height={TAP} disabled={busy} onPress={load} />
    </View>
  )
}

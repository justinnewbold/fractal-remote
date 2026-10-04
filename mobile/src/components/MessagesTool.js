import { useCallback, useEffect, useState } from 'react'
import { Platform, ScrollView, Text, View } from 'react-native'
import * as Clipboard from 'expo-clipboard'

import { color, font, mono, radius, space, TAP } from '../lib/theme'
import { DEFAULT_PROJECT } from '../lib/project'
import { supabaseClient } from '../lib/relay'
import { messageDetail, messageSections, messagesAction } from '../lib/admin'
import Facts from './Facts'
import Note from './Note'
import Press from './Press'
import Sheet from './Sheet'

const face = Platform.select(mono)

/**
 * MESSAGES FROM USERS — Justin's page, and nobody else's.
 *
 * "Everything people send through Troubleshooting → 'tell us', readable
 * inside the app with the log they attached, instead of only arriving by
 * email." Newest first. A tap opens the report: what they wrote, where it came
 * from, and the log, all of it selectable, with Copy for the lot. The server
 * (supabase/functions/owner-messages) decides who may read them.
 */
export default function MessagesTool() {
  const [busy, setBusy] = useState(false)
  const [said, setSaid] = useState(null)
  const [open, setOpen] = useState(null)
  const [told, setTold] = useState(null)

  const token = async () => (await supabaseClient().auth.getSession())?.data?.session?.access_token

  const load = useCallback(async () => {
    setBusy(true)
    try {
      setSaid(await messagesAction({ url: DEFAULT_PROJECT.url, anonKey: DEFAULT_PROJECT.anonKey, token: await token() }))
    } finally {
      setBusy(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const pick = async (row) => {
    setTold(null)
    setOpen({ loading: true })
    const res = await messagesAction({
      url: DEFAULT_PROJECT.url,
      anonKey: DEFAULT_PROJECT.anonKey,
      token: await token(),
      action: 'message',
      id: row.id
    })
    setOpen(res.ok ? messageDetail(res.message) : { failed: res.message })
  }

  const copy = async () => {
    const text = [open.message, '', ...open.facts.map((f) => `${f.label}: ${f.value}`), ...(open.log ? ['', 'Log:', open.log] : [])].join('\n')
    try {
      await Clipboard.setStringAsync(text)
      setTold({ ok: true, message: 'Copied.' })
    } catch (err) {
      setTold({ ok: false, message: `Couldn’t copy it (${err?.message || err}). Hold the words down to select them instead.` })
    }
  }

  return (
    <View style={{ gap: space.lg }}>
      {said && !said.ok ? <Note tone="fault">{said.message}</Note> : null}
      {said?.ok ? messageSections(said).map((s) => <Facts key={s.title} title={s.title} rows={s.rows} onRow={pick} />) : null}
      <Press label={busy ? 'Loading…' : 'Refresh'} height={TAP} disabled={busy} onPress={load} />

      <Sheet open={!!open} onClose={() => setOpen(null)} title="Message">
        {open?.loading ? <Text style={{ color: color.silkDim, fontSize: font.body }}>Loading…</Text> : null}
        {open?.failed ? <Note tone="fault">{open.failed}</Note> : null}
        {open?.facts ? (
          <View style={{ gap: space.md }}>
            <Text selectable style={{ color: color.silk, fontSize: font.body, lineHeight: font.body * 1.45 }}>
              {open.message}
            </Text>
            <Facts rows={open.facts} />
            {open.log ? (
              <ScrollView
                style={{ maxHeight: 260, borderRadius: radius.md, backgroundColor: color.panel }}
                contentContainerStyle={{ padding: space.md }}
              >
                <Text selectable style={{ color: color.silkDim, fontSize: font.micro, fontFamily: face, lineHeight: font.micro * 1.5 }}>
                  {open.log}
                </Text>
              </ScrollView>
            ) : (
              <Text style={{ color: color.silkFaint, fontSize: font.small }}>No log came with this one.</Text>
            )}
            {told ? (
              <Note tone={told.ok ? 'hint' : 'fault'} strong size={font.body}>
                {told.message}
              </Note>
            ) : null}
            <Press label="Copy all of it" height={TAP} onPress={copy} />
          </View>
        ) : null}
      </Sheet>
    </View>
  )
}

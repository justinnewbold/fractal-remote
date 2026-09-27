import { useCallback, useEffect, useState } from 'react'
import { Text, TextInput, View } from 'react-native'
import * as Clipboard from 'expo-clipboard'

import { color, font, radius, space, TAP } from '../lib/theme'
import { DEFAULT_PROJECT } from '../lib/project'
import { supabaseClient } from '../lib/relay'
import { accessAction, accountChoices, accountSections } from '../lib/admin'
import Facts from './Facts'
import Note from './Note'
import Press from './Press'
import Sheet from './Sheet'

/**
 * EVERYONE WITH AN ACCOUNT — Justin's page, and nobody else's.
 *
 * "How do I see a list of who has set up an account? Need to check
 * L4adaptive@gmail.com." Every account, newest first, with a box to find one
 * address, and the waiting list under it. The same server as Give someone
 * access (supabase/functions/grant-access), which decides who may ask.
 *
 * TAP SOMEBODY TO ACT ON THEM. "Can you make it so I can copy and paste off
 * of this page? Or that I can click on it to give them access from that
 * screen?" A tap opens them in a sheet: their email to copy (or hold down to
 * select), and Give access or Take it back — see accountChoices in admin.
 */
export default function AccountsTool() {
  const [busy, setBusy] = useState(false)
  const [said, setSaid] = useState(null)
  const [find, setFind] = useState('')
  const [open, setOpen] = useState(null)
  const [doing, setDoing] = useState(null)
  const [told, setTold] = useState(null)

  const load = useCallback(async () => {
    setBusy(true)
    try {
      const { data } = await supabaseClient().auth.getSession()
      setSaid(
        await accessAction({
          url: DEFAULT_PROJECT.url,
          anonKey: DEFAULT_PROJECT.anonKey,
          token: data?.session?.access_token,
          action: 'accounts'
        })
      )
    } finally {
      setBusy(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const pick = (row) => {
    setTold(null)
    setOpen(row)
  }

  const copy = async () => {
    try {
      await Clipboard.setStringAsync(open.email)
      setTold({ ok: true, message: `Copied ${open.email}.` })
    } catch (err) {
      setTold({ ok: false, message: `Couldn’t copy it (${err?.message || err}). Hold the email down to select it instead.` })
    }
  }

  const act = async (action) => {
    setDoing(action)
    setTold(null)
    try {
      const { data } = await supabaseClient().auth.getSession()
      const res = await accessAction({
        url: DEFAULT_PROJECT.url,
        anonKey: DEFAULT_PROJECT.anonKey,
        token: data?.session?.access_token,
        action,
        email: open.email
      })
      setTold(res)
      /* The list under the sheet says Unlocked or Not unlocked; read it again
         so it says what just happened. */
      if (res.ok) {
        setOpen((was) => (was ? { ...was, unlocked: action === 'grant', waiting: false } : was))
        load()
      }
    } finally {
      setDoing(null)
    }
  }

  const choices = accountChoices(open)

  return (
    <View style={{ gap: space.lg }}>
      <TextInput
        value={find}
        onChangeText={setFind}
        placeholder="Find an email"
        placeholderTextColor={color.silkFaint}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        style={{
          minHeight: TAP,
          paddingHorizontal: space.md,
          borderRadius: radius.md,
          borderWidth: 1,
          borderColor: color.rule,
          backgroundColor: color.panel,
          color: color.silk,
          fontSize: font.body
        }}
      />
      {said && !said.ok ? <Note tone="fault">{said.message}</Note> : null}
      {said?.ok
        ? accountSections(said, find).map((s) => <Facts key={s.title} title={s.title} rows={s.rows} onRow={pick} />)
        : null}
      <Press label={busy ? 'Loading…' : 'Refresh'} height={TAP} disabled={busy} onPress={load} />

      <Sheet open={!!open} onClose={() => setOpen(null)} title={open?.email || ''}>
        <View style={{ gap: space.md }}>
          <Text selectable style={{ color: color.silk, fontSize: font.body, fontWeight: '700' }}>
            {open?.email}
          </Text>
          <Text selectable style={{ color: color.silkDim, fontSize: font.small, lineHeight: font.small * 1.5 }}>
            {open?.line}
          </Text>
          {told ? (
            <Note tone={told.ok ? 'hint' : 'fault'} strong size={font.body}>
              {told.message}
            </Note>
          ) : null}
          <Press label="Copy email" height={TAP} disabled={!!doing} onPress={copy} />
          {choices.give ? (
            <Press
              label={doing === 'grant' ? 'Giving access…' : 'Give access'}
              tone="signal"
              on
              height={TAP}
              disabled={!!doing}
              onPress={() => act('grant')}
            />
          ) : null}
          {choices.takeBack ? (
            <Press
              label={doing === 'revoke' ? 'Taking it back…' : 'Take it back'}
              height={TAP}
              disabled={!!doing}
              onPress={() => act('revoke')}
            />
          ) : null}
        </View>
      </Sheet>
    </View>
  )
}

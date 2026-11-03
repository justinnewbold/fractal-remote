import { useCallback, useEffect, useRef, useState } from 'react'
import { Text, TextInput, View } from 'react-native'
import * as Clipboard from 'expo-clipboard'

import { color, font, radius, space, TAP } from '../lib/theme'
import { DEFAULT_PROJECT } from '../lib/project'
import { supabaseClient } from '../lib/relay'
import {
  accessAction,
  accountChoices,
  accountConfirmHint,
  accountDeleteAsk,
  accountFilterButtons,
  accountRow,
  accountSections,
  samePerson,
  signInHelpWords
} from '../lib/admin'
import Facts from './Facts'
import Note from './Note'
import Press from './Press'
import Sheet from './Sheet'

/**
 * EVERYONE WITH AN ACCOUNT — Justin's page, and nobody else's.
 *
 * "How do I see a list of who has set up an account? Need to check
 * [a customer's address]." Every account, newest first, with a box to find one
 * address, and the waiting list under it. The same server as Give someone
 * access (supabase/functions/grant-access), which decides who may ask.
 *
 * TAP SOMEBODY TO ACT ON THEM. "Can you make it so I can copy and paste off
 * of this page? Or that I can click on it to give them access from that
 * screen?" A tap opens them in a sheet: their email to copy (or hold down to
 * select), and Give access or Take it back — see accountChoices in admin.
 * And, under those, Confirm their account now for somebody who never
 * confirmed their email ("Add the option to the accounts page under the
 * section where I can give access", 2 November 2026).
 *
 * AND BUTTONS TO NARROW IT, under the find box: Confirmed, Not confirmed,
 * Unlocked, Last on today and the rest (ACCOUNT_FILTERS in admin), each with
 * how many it holds, one picked at a time. They wrap rather than scroll
 * sideways, so none of them is out of sight.
 *
 * AND DELETE THIS ACCOUNT, last in the sheet. "How do I remove accounts
 * altogether like the irecon one that's misspelled?" (2 November 2026.) A
 * tap asks the server to look first, which deletes nothing; then the sheet
 * asks in plain words what goes with it (accountDeleteAsk in admin), and only
 * Delete for good deletes. Never offered on Apple's review login, which its
 * row says to keep, or on his own account (accountChoices); the server
 * refuses both anyway. Once it is gone the sheet says what the server said,
 * with nothing left to do but close it, and the list under it is read again
 * without them; the same words stay at the top of the page.
 */
export default function AccountsTool() {
  const [busy, setBusy] = useState(false)
  const [said, setSaid] = useState(null)
  const [find, setFind] = useState('')
  const [show, setShow] = useState('all')
  const [open, setOpen] = useState(null)
  const [doing, setDoing] = useState(null)
  const [told, setTold] = useState(null)
  /* Delete this account: the server's look ({ who, said }) while the question is up, and what the last delete said. */
  const [asking, setAsking] = useState(null)
  const [gone, setGone] = useState(null)
  const openNow = useRef(open)
  openNow.current = open

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

  /* The open sheet redrawn from the list just read, so its line under the email says what just happened. */
  useEffect(() => {
    if (said?.ok) setOpen((was) => (was ? accountRow(said, was) || was : was))
  }, [said])

  const pick = (row) => {
    setTold(null)
    setAsking(null)
    setGone(null)
    setOpen(row)
  }

  const close = () => {
    if (doing === 'delete') return
    setAsking(null)
    setOpen(null)
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
    /* Who this is for, kept: another person can be opened while it runs, and the answer is this one's alone. */
    const who = open
    setDoing(action)
    setTold(null)
    try {
      const { data } = await supabaseClient().auth.getSession()
      const res = await accessAction({
        url: DEFAULT_PROJECT.url,
        anonKey: DEFAULT_PROJECT.anonKey,
        token: data?.session?.access_token,
        action,
        email: who.email
      })
      if (samePerson(openNow.current, who)) {
        /* Confirming emails nobody, so its line says to tell them (signInHelpWords, as on Give access). */
        setTold(action === 'confirm' ? signInHelpWords('confirmNow', who.email, res.ok ? null : res.message) : res)
        /* The list under the sheet says Unlocked or Not unlocked, and whether they
           confirmed; read it again so it says what just happened. */
        if (res.ok) {
          setOpen((was) =>
            samePerson(was, who) ? (action === 'confirm' ? { ...was, confirmed: true } : { ...was, unlocked: action === 'grant', waiting: false }) : was
          )
        }
      }
      if (res.ok) load()
    } finally {
      setDoing(null)
    }
  }

  /* The server looks first and deletes nothing: who the account is now (its id) and what it holds, for the question. */
  const lookToDelete = async () => {
    const who = open
    setDoing('look')
    setTold(null)
    setAsking(null)
    try {
      const { data } = await supabaseClient().auth.getSession()
      const res = await accessAction({
        url: DEFAULT_PROJECT.url,
        anonKey: DEFAULT_PROJECT.anonKey,
        token: data?.session?.access_token,
        action: 'delete',
        email: who.email
      })
      if (samePerson(openNow.current, who)) {
        if (res.ok && res.ask && res.id) setAsking({ who, said: res })
        else setTold(res)
      }
      /* Gone already: the list is read again without them. */
      if (res.found === false) load()
    } finally {
      setDoing(null)
    }
  }

  /* Delete for good: the id the look gave goes back with the confirm, and the server checks both again. */
  const deleteNow = async () => {
    const { who, said } = asking
    setDoing('delete')
    setTold(null)
    try {
      const { data } = await supabaseClient().auth.getSession()
      const res = await accessAction({
        url: DEFAULT_PROJECT.url,
        anonKey: DEFAULT_PROJECT.anonKey,
        token: data?.session?.access_token,
        action: 'delete',
        email: who.email,
        extra: { id: said.id, confirm: 'delete' }
      })
      setAsking(null)
      if (res.ok && res.deleted) {
        /*
         * The sheet stays on what the server said, with nothing left to do
         * (accountChoices offers nothing on a deleted row), because the list
         * can be long and the line at its top out of sight; the list is read
         * again without them underneath.
         */
        if (samePerson(openNow.current, who)) {
          setOpen((was) => (samePerson(was, who) ? { ...was, deleted: true, line: 'Deleted just now.' } : was))
          setTold(res)
        }
        setGone(res)
        load()
      } else {
        if (samePerson(openNow.current, who)) setTold(res)
        if (res.found === false) load()
      }
    } finally {
      setDoing(null)
    }
  }

  const choices = accountChoices(open)
  const askingNow = asking && samePerson(asking.who, open) ? asking : null

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
      {said?.ok ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
          {accountFilterButtons(said, find).map((f) => (
            <Press
              key={f.key}
              label={f.label}
              tone="signal"
              on={f.key === show}
              height={40}
              style={{ paddingHorizontal: space.md }}
              onPress={() => setShow(f.key)}
            />
          ))}
        </View>
      ) : null}
      {gone ? (
        <Note tone={gone.ok ? 'hint' : 'fault'} strong size={font.body}>
          {gone.message}
        </Note>
      ) : null}
      {said && !said.ok ? <Note tone="fault">{said.message}</Note> : null}
      {said?.ok
        ? accountSections(said, find, Date.now(), show, open).map((s) => <Facts key={s.title} title={s.title} rows={s.rows} onRow={pick} />)
        : null}
      <Press label={busy ? 'Loading…' : 'Refresh'} height={TAP} disabled={busy} onPress={load} />

      <Sheet open={!!open} onClose={close} title={open?.email || ''}>
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
          {choices.confirmNow ? (
            <>
              <Press
                label={doing === 'confirm' ? 'Confirming…' : 'Confirm their account now'}
                height={TAP}
                disabled={!!doing}
                onPress={() => act('confirm')}
              />
              <Text style={{ color: color.silkDim, fontSize: font.small, lineHeight: font.small * 1.5 }}>{accountConfirmHint(open)}</Text>
            </>
          ) : null}
          {choices.remove ? (
            askingNow ? (
              <>
                <Text style={{ color: color.silk, fontSize: font.small, lineHeight: font.small * 1.5 }}>{accountDeleteAsk(open, askingNow.said)}</Text>
                <Press
                  label={doing === 'delete' ? 'Deleting…' : 'Delete for good'}
                  tone="live"
                  height={TAP}
                  disabled={!!doing}
                  onPress={deleteNow}
                />
                <Press label="Keep it" height={TAP} disabled={!!doing} onPress={() => setAsking(null)} />
              </>
            ) : (
              <Press label={doing === 'look' ? 'Looking…' : 'Delete this account'} height={TAP} disabled={!!doing} onPress={lookToDelete} />
            )
          ) : null}
        </View>
      </Sheet>
    </View>
  )
}

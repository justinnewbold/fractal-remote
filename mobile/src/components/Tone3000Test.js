/*
 * TONE3000, FIRST PIECE: Developer → Testing, his account only.
 *
 * "Next I want to add TONE3000 so users can search, preview and download
 * tones for the NAM block directly in the app." (Justin, 13 November 2026.)
 * This is the part that needs nothing from a unit: sign in, browse and
 * audition on TONE3000's own page (it opens in the browser and comes back
 * here), and the tone picked shows with its creator, its licence and its
 * captures. A capture can be fetched and checked: what kind it is, how many
 * numbers are in it, and about what sending it to a unit would take.
 *
 * NOTHING IS SENT TO A UNIT. How Axe-Edit packs a capture for an Axe-Fx III
 * is not known yet (it waits on a recording of Axe-Edit doing it), so
 * installing is the next piece, and this says so.
 *
 * On a page only his account has, so it is his alone without a switch of
 * its own; it gets one (lib/features) when it moves to where a player meets
 * it. TONE3000's terms: everything browsed is its own page under its own
 * name, the creator and licence are always shown, and a capture is fetched
 * only when it is asked for.
 */
import { useEffect, useRef, useState } from 'react'
import { Text, View } from 'react-native'
import { color, font, space } from '../lib/theme'
import { logDebug } from '../lib/debugLog'
import { T3K_POWERED, toneCredit } from '../lib/tone3000'
import { onTone3000Return, t3k } from '../lib/tone3000Here'
import { namSaid, readNam } from '../lib/nam-file'
import Note from './Note'
import Press from './Press'

/** A capture's button: its name, and its size where TONE3000 says one. */
export const captureLabel = (m) => (m?.name ? String(m.name) : `Capture ${m?.id}`)

export default function Tone3000Test() {
  const [signedIn, setSignedIn] = useState(false)
  const [busy, setBusy] = useState(null)
  const [fault, setFault] = useState('')
  const [said, setSaid] = useState('')
  const [tone, setTone] = useState(null)
  const [models, setModels] = useState(null)
  /* What each capture fetched turned out to be, by its id. */
  const [checked, setChecked] = useState({})
  const alive = useRef(true)

  const load = async (toneId) => {
    setBusy('tone')
    setFault('')
    try {
      const [got, list] = await Promise.all([t3k.tone(toneId), t3k.models(toneId)])
      if (!alive.current) return
      setTone(got)
      setModels(list)
      setChecked({})
      logDebug('tone3000', `picked tone ${toneId}: ${got?.title || 'untitled'}, ${list.length} A2 capture${list.length === 1 ? '' : 's'}`)
    } catch (err) {
      if (alive.current) setFault(err?.message || 'TONE3000 couldn’t be reached.')
    } finally {
      if (alive.current) setBusy(null)
    }
  }

  useEffect(() => {
    alive.current = true
    t3k.signedIn().then((yes) => alive.current && setSignedIn(yes))
    const stop = onTone3000Return(async (url) => {
      const done = await t3k.finish(url)
      /* Not TONE3000's link, or one with no sign-in waiting for it (a launch link handed over again). */
      if (!done || !alive.current) return
      setBusy(null)
      if (!done.ok) {
        logDebug('tone3000', `sign-in not finished: ${done.why}`)
        if (done.canceled) setSaid(done.why)
        else setFault(done.why)
        return
      }
      setSignedIn(true)
      setFault('')
      if (done.toneId) {
        setSaid('')
        load(done.toneId)
      } else {
        setSaid('Signed in. No tone was picked.')
      }
    })
    return () => {
      alive.current = false
      stop()
    }
  }, [])

  const browse = async () => {
    if (busy) return
    setBusy('open')
    setFault('')
    setSaid('')
    try {
      await t3k.start()
      logDebug('tone3000', 'opened TONE3000’s page to pick a tone')
    } catch (err) {
      setFault(`TONE3000’s page didn’t open: ${err?.message || err}`)
    } finally {
      /* The browser is in front from here; the button comes back for when it is not. */
      if (alive.current) setBusy(null)
    }
  }

  const check = async (m) => {
    if (busy) return
    setBusy(m.id)
    setFault('')
    try {
      const text = await t3k.modelText(m)
      const read = readNam(text)
      const line = namSaid(read)
      logDebug('tone3000', `capture ${m.id} (${captureLabel(m)}): ${text.length} characters. ${line}`)
      if (alive.current) setChecked((was) => ({ ...was, [m.id]: line }))
    } catch (err) {
      if (alive.current) setFault(err?.message || 'That capture couldn’t be fetched.')
    } finally {
      if (alive.current) setBusy(null)
    }
  }

  const signOut = async () => {
    await t3k.signOut()
    if (!alive.current) return
    setSignedIn(false)
    setTone(null)
    setModels(null)
    setChecked({})
    setSaid('Signed out of TONE3000 on this device.')
  }

  return (
    <View style={{ gap: space.md }}>
      <Text accessibilityRole="header" style={{ color: color.silkFaint, fontSize: font.micro, letterSpacing: 1.5, textTransform: 'uppercase' }}>
        TONE3000
      </Text>
      <Text style={{ color: color.silkDim, fontSize: font.small, lineHeight: 19 }}>
        Browse opens TONE3000’s own page in the browser: sign in there, search, listen with its preview players, and pick a
        tone. It comes back here with the tone and its captures. Nothing is sent to a unit yet: installing a capture is the
        next piece.
      </Text>
      <Press label={busy === 'open' ? 'Opening…' : tone ? 'Browse TONE3000 again' : 'Browse TONE3000'} tone="live" disabled={!!busy} onPress={browse} />
      {busy === 'tone' ? <Note>Fetching the tone you picked…</Note> : null}
      {said ? <Note>{said}</Note> : null}
      {fault ? <Note tone="warn">{fault}</Note> : null}
      {tone ? (
        <View style={{ gap: space.sm }}>
          <Text style={{ color: color.silk, fontSize: font.lead, fontWeight: '700' }}>{tone.title || 'Untitled tone'}</Text>
          {/* The creator and the licence, always (TONE3000's terms). */}
          <Text style={{ color: color.silkDim, fontSize: font.small }}>{toneCredit(tone)}</Text>
          {models && !models.length ? <Note>This tone has no A2 captures, which is the kind the Axe-Fx III’s NAM block plays.</Note> : null}
          {(models || []).map((m) => (
            <View key={m.id} style={{ gap: space.xs }}>
              <Press
                label={busy === m.id ? `Fetching ${captureLabel(m)}…` : captureLabel(m)}
                sub={checked[m.id] ? 'Fetched and checked' : `Fetch and check${m.size ? ` · ${m.size}` : ''}`}
                disabled={!!busy}
                onPress={() => check(m)}
              />
              {checked[m.id] ? (
                <Text selectable style={{ color: color.silkDim, fontSize: font.small, lineHeight: 19 }}>
                  {checked[m.id]}
                </Text>
              ) : null}
            </View>
          ))}
        </View>
      ) : null}
      {signedIn ? <Press label="Sign out of TONE3000" disabled={!!busy} onPress={signOut} /> : null}
      <Text style={{ color: color.silkFaint, fontSize: font.micro }}>{T3K_POWERED}</Text>
    </View>
  )
}

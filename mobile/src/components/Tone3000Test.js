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
 * AND A CAPTURE CAN BE SENT TO AN AXE-FX III (lib/nam-install: Axe-Edit
 * III's own messages, from a recording of it, 13 November 2026), over
 * Bluetooth or the unit's USB cable into this device. It goes into the
 * first empty slot, the app never writes over a capture unless that slot was
 * left half-sent by this card, and NAM 1 or NAM 2 can then be pointed at
 * it. Nothing is saved on the unit: the preset is saved the usual way.
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
import { NAM_BLOCKS, namRecord, namSlotSaid } from '../lib/nam-install'
import { namEmptySlotHere, namInstallHere, namPickHere } from '../lib/device'
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
  /* A fetched capture's text, by its id, for as long as this card is up and no longer: it is what gets sent. Never written down. */
  const texts = useRef({})
  /* The send in hand: { id, line, slot, done, again }. */
  const [send, setSend] = useState(null)

  const load = async (toneId) => {
    setBusy('tone')
    setFault('')
    try {
      const [got, list] = await Promise.all([t3k.tone(toneId), t3k.models(toneId)])
      if (!alive.current) return
      setTone(got)
      setModels(list)
      setChecked({})
      texts.current = {}
      setSend(null)
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
      if (read.ok && read.a2) texts.current[m.id] = text
      if (alive.current) setChecked((was) => ({ ...was, [m.id]: line }))
    } catch (err) {
      if (alive.current) setFault(err?.message || 'That capture couldn’t be fetched.')
    } finally {
      if (alive.current) setBusy(null)
    }
  }

  /*
   * A fetched capture into the unit's first empty slot (or, `again`, back
   * into the slot a send of this card's stopped part-way in).
   */
  const sendToUnit = async (m, again = null) => {
    if (busy) return
    const rec = namRecord(texts.current[m.id], { name: captureLabel(m), by: tone?.user?.username })
    if (!rec.ok) {
      setSend({ id: m.id, line: rec.why })
      return
    }
    setBusy(`send ${m.id}`)
    setFault('')
    try {
      let slot = again
      if (slot === null) {
        setSend({ id: m.id, line: 'Looking for an empty slot on the unit…' })
        const found = await namEmptySlotHere()
        if (!alive.current) return
        if (found.slot === null) {
          setSend({ id: m.id, line: `The unit’s first ${found.heads.length} capture slots are all taken.` })
          return
        }
        slot = found.slot
      }
      const said = namSlotSaid(slot)
      setSend({ id: m.id, slot, line: `Sending “${rec.name}” to slot ${said}…` })
      logDebug('tone3000', `sending capture ${m.id} (“${rec.name}”) to slot ${said}${again !== null ? ', over what a stopped send left there' : ''}`)
      const got = await namInstallHere(slot, rec.words, {
        replace: again !== null,
        onProgress: (sent, of) => {
          /* Every tenth message and the last: 130 redraws are no use to anybody. */
          if (alive.current && (sent % 10 === 0 || sent === of)) setSend({ id: m.id, slot, line: `Sending “${rec.name}” to slot ${said}: ${sent} of ${of}` })
        }
      })
      logDebug('tone3000', `capture ${m.id} is in slot ${said} after ${got.seconds.toFixed(1)} s; the unit reads the slot as “${got.name ?? 'nothing it would say'}”`)
      if (alive.current) setSend({ id: m.id, slot, done: true, line: `In slot ${said}${got.name ? ` as “${got.name}”` : ''}, in ${Math.round(got.seconds)} seconds.` })
    } catch (err) {
      logDebug('tone3000', `capture ${m.id} was not sent: ${err?.message || err}`)
      if (alive.current) setSend({ id: m.id, line: err?.message || 'The capture was not sent.', again: err?.partial === true && Number.isInteger(err?.slot) ? err.slot : null })
    } finally {
      if (alive.current) setBusy(null)
    }
  }

  const useIn = async (block, slot) => {
    if (busy) return
    setBusy(`pick ${block}`)
    const which = `NAM ${NAM_BLOCKS.indexOf(block) + 1}`
    try {
      const got = await namPickHere(block, slot)
      logDebug('tone3000', `${which} is on slot ${namSlotSaid(slot)} now: “${got.name}”`)
      if (alive.current) setSend((was) => (was ? { ...was, line: `${which} is playing “${got.name}” now. Save the preset to keep it there.` } : was))
    } catch (err) {
      logDebug('tone3000', `${which} was not pointed at slot ${namSlotSaid(slot)}: ${err?.message || err}`)
      if (alive.current) setSend((was) => (was ? { ...was, line: err?.message || `${which} was not changed.` } : was))
    } finally {
      if (alive.current) setBusy(null)
    }
  }

  const signOut = async () => {
    await t3k.signOut()
    if (!alive.current) return
    texts.current = {}
    setSend(null)
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
        tone. It comes back here with the tone and its captures. A fetched capture can be sent to an Axe-Fx III, over
        Bluetooth or its USB cable into this device: into the first empty slot, never over one that is in use.
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
              {texts.current[m.id] ? (
                <Press
                  label={busy === `send ${m.id}` ? 'Sending…' : send?.id === m.id && send.done ? 'Send it to another slot' : 'Send to the Axe-Fx III'}
                  sub="Into the first empty capture slot"
                  tone="live"
                  disabled={!!busy}
                  onPress={() => sendToUnit(m)}
                />
              ) : null}
              {send?.id === m.id ? <Note>{send.line}</Note> : null}
              {send?.id === m.id && Number.isInteger(send.again) ? (
                <Press label={`Send it again to slot ${namSlotSaid(send.again)}`} sub="Over what the stopped send left there" disabled={!!busy} onPress={() => sendToUnit(m, send.again)} />
              ) : null}
              {send?.id === m.id && send.done
                ? NAM_BLOCKS.map((block, i) => (
                    <Press key={block} label={busy === `pick ${block}` ? 'Changing…' : `Play it in NAM ${i + 1}`} sub="In the preset the unit is on" disabled={!!busy} onPress={() => useIn(block, send.slot)} />
                  ))
                : null}
            </View>
          ))}
        </View>
      ) : null}
      {signedIn ? <Press label="Sign out of TONE3000" disabled={!!busy} onPress={signOut} /> : null}
      <Text style={{ color: color.silkFaint, fontSize: font.micro }}>{T3K_POWERED}</Text>
    </View>
  )
}

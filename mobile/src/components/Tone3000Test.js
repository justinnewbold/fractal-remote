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
 * Bluetooth or the unit's USB cable into this device, or, since 14 November
 * 2026, through the computer or the Raspberry Pi, whichever the device is
 * connected by (lib/device decides; this card asks the same three calls).
 * It goes into the first empty slot, the app never writes over a capture
 * unless that slot was left half-sent by this card over the device's own
 * wire (the computer never writes over one at all), and NAM 1 or NAM 2 can
 * then be pointed at it. Nothing is saved on the unit: the preset is saved
 * the usual way.
 *
 * ONE BUTTON DOES THE WHOLE OF IT, since 14 November 2026: "How do we
 * preview the file live? ... this whole screen is confusing to me. What am
 * I supposed to be doing?" (Justin, after his first send.) So the card says
 * its steps in order, each capture has one button that fetches it, sends it
 * and points NAM 1 at it, and what the unit said of the slot and of the
 * block each keep a line of their own. A slot the unit still calls
 * "<EMPTY>" after a send is said as not kept, with no Play button: his
 * first send ended "NAM 1 is playing “<EMPTY>” now", which told him
 * nothing (lib/nam-install has what was wrong with that send).
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
import { NAM_BLOCKS, NAM_EMPTY, namRecord, namSlotSaid } from '../lib/nam-install'
import { namEmptySlotHere, namInstallHere, namPickHere } from '../lib/device'
import Note from './Note'
import Press from './Press'

/** A capture's name, as TONE3000 gives it. */
export const captureLabel = (m) => (m?.name ? String(m.name) : `Capture ${m?.id}`)

/** What to do here, in order: the card's first lines. */
export const STEPS = Object.freeze([
  'Browse TONE3000 opens its own page. Sign in, search, and pick a tone. What you hear on that page is TONE3000’s own demo recording, not your rig.',
  'Back here, each capture of that tone has a Send it and play it button.',
  'That button puts the capture in the Axe-Fx III’s first empty capture slot and points NAM 1 at it, so you hear it through your own rig. It takes about half a minute over Bluetooth, a second or two through the computer or by USB.'
])
export const STEPS_FOOT = 'The preset you are on needs NAM 1 in it (with only NAM 2 there, Play it in NAM 2 comes up after the send). Nothing is saved until you save the preset, and a capture already on the unit is never written over.'
export const SEND_AND_PLAY = 'Send it and play it in NAM 1'
export const SEND_AND_PLAY_SUB = 'Into the first empty capture slot on the Axe-Fx III'

/*
 * ONE SEND AT A TIME, WHOEVER DRAWS THE CARD. A send goes on after the card
 * is left (half a minute over Bluetooth), and a card opened again starts
 * with nothing busy: its buttons would be live over a send still going. The
 * wire refuses a second one, the computer does not. So the fact is kept
 * here, outside any one drawing of the card.
 */
let atWork = 0
/*
 * When the send in hand began, or 0. Not a plain yes: a request that never
 * came back (nothing here is known to do that, but a relay can) would close
 * the card until the app was restarted. A send takes under a minute over
 * Bluetooth, so after five it is taken to be over. Each run clears only its
 * own mark, so an old one ending late cannot open the card under a new one.
 */
const STILL_GOING_MS = 5 * 60 * 1000
const goingNow = () => atWork !== 0 && Date.now() - atWork < STILL_GOING_MS
export const STILL_GOING = 'A capture is still going to the unit. Wait for it to finish.'

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
  /* The send in hand: { id, line, slot, done, again, played }. `line` is what became of the send, `played` what the NAM block said. */
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
    if (goingNow()) {
      setSend({ id: m.id, line: STILL_GOING })
      return
    }
    /* Not fetched yet: this tap asks for it (the one place a capture is fetched, `check`). What is not an A2 capture says so there and goes no further. */
    if (!texts.current[m.id]) await check(m)
    if (!alive.current || !texts.current[m.id] || goingNow()) return
    /* Named by the file's own word, else TONE3000's name for it, else its number there: a name in another script keeps none of its letters on the unit. */
    const rec = namRecord(texts.current[m.id], { name: captureLabel(m), fallback: `Capture ${m.id}`, by: tone?.user?.username })
    if (!rec.ok) {
      setSend({ id: m.id, line: rec.why })
      return
    }
    const mine = (atWork = Date.now())
    setBusy(`send ${m.id}`)
    setFault('')
    try {
      let slot = again
      if (slot === null) {
        setSend({ id: m.id, line: 'Looking for an empty slot on the unit…' })
        const found = await namEmptySlotHere()
        if (!alive.current) return
        if (found.slot === null) {
          setSend({ id: m.id, line: `The unit’s first ${found.heads.length} capture slots are all taken. Clear one on the unit, then send again.` })
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
      logDebug('tone3000', `capture ${m.id} went to slot ${said} in ${got.seconds.toFixed(1)} s; the unit reads the slot as “${got.name ?? 'nothing it would say'}”`)
      if (!alive.current) return
      /* Every message was taken and the slot still reads empty: the unit did not keep it. Never "done", and nothing to play. */
      if (got.name === NAM_EMPTY) {
        logDebug('tone3000', `capture ${m.id} was NOT KEPT: slot ${said} still reads ${NAM_EMPTY} after every message was taken`)
        setSend({ id: m.id, slot, line: `The Axe-Fx III took the capture and then still shows slot ${said} as empty, so it did not keep it. Send it once more; if it says this again, the app’s log has what the unit answered.` })
        return
      }
      setSend({ id: m.id, slot, done: true, line: `In slot ${said}${got.name ? ` as “${got.name}”` : ''}, in ${Math.round(got.seconds)} seconds.` })
      /* And straight into NAM 1, which is what makes it heard. */
      setBusy(`pick ${NAM_BLOCKS[0]}`)
      await point(NAM_BLOCKS[0], slot)
    } catch (err) {
      logDebug('tone3000', `capture ${m.id} was not sent: ${err?.message || err}`)
      if (alive.current) setSend({ id: m.id, line: err?.message || 'The capture was not sent.', again: err?.partial === true && Number.isInteger(err?.slot) ? err.slot : null })
    } finally {
      if (atWork === mine) atWork = 0
      if (alive.current) setBusy(null)
    }
  }

  /*
   * NAM 1 or NAM 2 pointed at a slot, and what the unit said of it, on a
   * line of its own under the send's. Never throws. A unit that names the
   * slot <EMPTY> here has nothing in it, whatever the read after the send
   * said (or did not say): the send is no longer "done", so its button comes
   * back and the two Play buttons, which could only point at the same empty
   * slot again, go.
   */
  const point = async (block, slot) => {
    const which = `NAM ${NAM_BLOCKS.indexOf(block) + 1}`
    const played = (line, more = null) => alive.current && setSend((was) => (was ? { ...was, played: line, ...more } : was))
    try {
      const got = await namPickHere(block, slot)
      logDebug('tone3000', `${which} is on slot ${namSlotSaid(slot)} now: the unit names it “${got.name}”`)
      if (got.name === NAM_EMPTY) played(`${which} is on slot ${namSlotSaid(slot)}, and the Axe-Fx III says that slot is empty, so there is nothing to hear. Send it once more.`, { done: false })
      else played(`${which} is playing “${got.name}” now, through your own rig. Save the preset to keep it there.`)
    } catch (err) {
      logDebug('tone3000', `${which} was not pointed at slot ${namSlotSaid(slot)}: ${err?.message || err}`)
      played(err?.message || `${which} was not changed.`)
    }
  }

  const useIn = async (block, slot) => {
    if (busy) return
    if (goingNow()) {
      setSend((was) => (was ? { ...was, played: STILL_GOING } : was))
      return
    }
    const mine = (atWork = Date.now())
    setBusy(`pick ${block}`)
    try {
      await point(block, slot)
    } finally {
      if (atWork === mine) atWork = 0
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
      {STEPS.map((step, i) => (
        <Text key={step} style={{ color: color.silkDim, fontSize: font.small, lineHeight: 19 }}>
          {`${i + 1}. ${step}`}
        </Text>
      ))}
      <Text style={{ color: color.silkFaint, fontSize: font.small, lineHeight: 19 }}>{STEPS_FOOT}</Text>
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
              <Text style={{ color: color.silk, fontSize: font.body, fontWeight: '600' }}>{`${captureLabel(m)}${m.size ? ` · ${m.size}` : ''}`}</Text>
              {/* The one button: fetch it, send it, play it. Gone once the unit has it, when the two below take over. */}
              {(send?.id === m.id && send.done) || (checked[m.id] && !texts.current[m.id]) ? null : (
                <Press
                  label={busy === m.id ? 'Fetching…' : busy === `send ${m.id}` ? 'Sending…' : SEND_AND_PLAY}
                  sub={SEND_AND_PLAY_SUB}
                  tone="live"
                  disabled={!!busy}
                  onPress={() => sendToUnit(m)}
                />
              )}
              {send?.id === m.id ? <Note>{send.line}</Note> : null}
              {send?.id === m.id && send.played ? <Note>{send.played}</Note> : null}
              {send?.id === m.id && Number.isInteger(send.again) ? (
                <Press label={`Send it again to slot ${namSlotSaid(send.again)}`} sub="Over what the stopped send left there" disabled={!!busy} onPress={() => sendToUnit(m, send.again)} />
              ) : null}
              {send?.id === m.id && send.done
                ? NAM_BLOCKS.map((block, i) => (
                    <Press key={block} label={busy === `pick ${block}` ? 'Changing…' : `Play it in NAM ${i + 1}`} sub="In the preset the unit is on" disabled={!!busy} onPress={() => useIn(block, send.slot)} />
                  ))
                : null}
              {checked[m.id] ? (
                <Text selectable style={{ color: color.silkFaint, fontSize: font.small, lineHeight: 19 }}>
                  {checked[m.id]}
                </Text>
              ) : (
                <Press label="Check the file only" sub="Fetches it and says what kind it is: nothing goes to the unit" height={40} disabled={!!busy} onPress={() => check(m)} />
              )}
            </View>
          ))}
        </View>
      ) : null}
      {signedIn ? <Press label="Sign out of TONE3000" disabled={!!busy} onPress={signOut} /> : null}
      <Text style={{ color: color.silkFaint, fontSize: font.micro }}>{T3K_POWERED}</Text>
    </View>
  )
}

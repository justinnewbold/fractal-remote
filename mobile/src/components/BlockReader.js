/*
 * THE BLOCK READER: Developer → Testing, his account only.
 *
 * "Yes build the NAM reader now." (Justin, 12 November 2026.) The Axe-Fx
 * III's NAM block came with firmware 33 and no catalog the app carries
 * names what is inside it. This asks the unit itself (lib/gen3-describe):
 * a block of the preset it is on, read whole and then asked about each of
 * its settings, their lowest and highest, their value as the unit writes
 * it, and the names in its lists. Only questions. What comes back is text
 * to copy and paste to the developer, and it is written to the log too.
 *
 * Over the phone's own wire only (Bluetooth, or the unit's USB cable into
 * this device), on an FM3, FM9 or Axe-Fx III. The wire answers it for his
 * account and nobody else's (bleWire readerOn), so this is drawn on a page
 * only his account has, and would get a refusal anywhere else.
 */
import { useState } from 'react'
import { Platform, Text, View } from 'react-native'
import * as Clipboard from 'expo-clipboard'
import { color, font, space } from '../lib/theme'
import { APP_VERSION } from '../lib/version'
import { describeBlockHere, readerBlocks } from '../lib/device'
import { describeText } from '../lib/gen3-describe'
import { logDebug } from '../lib/debugLog'
import { useBluetooth } from '../lib/bluetooth'
import Note from './Note'
import Press from './Press'

/** The units it is for: the three whose blocks answer this question. Never an AM4 (another protocol) or a VP4 (never asked anything). */
export const READER_UNITS = Object.freeze(['fm3', 'fm9', 'axefx3'])

/** What a block is called on its button: the catalog's name, or its number alone when nothing names it. */
export const readerLabel = (b) => (b.name ? `${b.name} (${b.effectId})` : `Block ${b.effectId}`)

/** The head of what is copied: which copy of the app read it, from what, and when. */
export const readerHead = ({ version, unit, platform, at }) => `Fractal Remote ${version} · block reader · ${unit} · ${platform} · ${at}`

const face = Platform.OS === 'ios' ? 'Menlo' : 'monospace'

export default function BlockReader() {
  const link = useBluetooth()
  const unit = link.unit
  /* The adapter, or the unit's own USB cable, which is the same wire. */
  const connected = link.on && link.phase === 'connected'
  /* What the unit said is in its preset; null until it has been asked. */
  const [blocks, setBlocks] = useState(null)
  const [busy, setBusy] = useState(null)
  const [fault, setFault] = useState('')
  /* What has been read, newest last, as text. */
  const [read, setRead] = useState([])
  const [copied, setCopied] = useState(false)

  if (!READER_UNITS.includes(unit)) return null

  const list = async () => {
    if (busy) return
    setBusy('list')
    setFault('')
    try {
      const got = await readerBlocks()
      setBlocks(Array.isArray(got) ? got : [])
    } catch (err) {
      setFault(err?.message || 'The unit didn’t answer.')
    } finally {
      setBusy(null)
    }
  }

  const readOne = async (b) => {
    if (busy) return
    setBusy(b.effectId)
    setFault('')
    setCopied(false)
    try {
      const got = await describeBlockHere(b.effectId)
      const text = describeText({ ...got, name: b.name ? `${b.name}, channel ${'ABCD'[got.channel] ?? got.channel} of ${got.channels || '?'}${got.bypassed ? ', off' : ', on'}` : `Unnamed block, channel ${'ABCD'[got.channel] ?? got.channel}` })
      logDebug('ble', `the block reader:\n${text}`)
      setRead((was) => [...was, text])
    } catch (err) {
      setFault(err?.message || 'The unit didn’t answer.')
    } finally {
      setBusy(null)
    }
  }

  const copyAll = async () => {
    const head = readerHead({ version: APP_VERSION, unit, platform: Platform.OS, at: new Date().toISOString() })
    try {
      await Clipboard.setStringAsync([head, ...read].join('\n\n'))
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  const fresh = (blocks || []).filter((b) => !b.known)
  const check = (blocks || []).find((b) => b.known && /amp/i.test(b.name || '')) || (blocks || []).find((b) => b.known)

  return (
    <View style={{ gap: space.md }}>
      <Text accessibilityRole="header" style={{ color: color.silkFaint, fontSize: font.micro, letterSpacing: 1.5, textTransform: 'uppercase' }}>
        Block reader
      </Text>
      <Text style={{ color: color.silkDim, fontSize: font.small, lineHeight: 19 }}>
        For a block the app has no knobs for yet. Load a preset that has the block, then read it. It only asks the unit
        questions and changes nothing. A block takes up to a minute. Leave Play alone while it reads.
      </Text>
      <Press label={busy === 'list' ? 'Asking…' : blocks ? 'Ask again what’s in this preset' : 'What’s in this preset?'} disabled={!connected || !!busy} onPress={list} />
      {blocks && !fresh.length ? <Note>Every block in this preset already has its knobs in the app.</Note> : null}
      {fresh.map((b) => (
        <Press key={b.effectId} label={busy === b.effectId ? `Reading ${readerLabel(b)}…` : `Read ${readerLabel(b)}`} disabled={!connected || !!busy} onPress={() => readOne(b)} />
      ))}
      {check ? (
        <>
          <Text style={{ color: color.silkDim, fontSize: font.small, lineHeight: 19 }}>
            And one the app already knows, to check the reader against:
          </Text>
          <Press label={busy === check.effectId ? `Reading ${readerLabel(check)}…` : `Read ${readerLabel(check)}`} disabled={!connected || !!busy} onPress={() => readOne(check)} />
        </>
      ) : null}
      {fault ? <Note tone="warn">{fault}</Note> : null}
      {read.length ? (
        <View style={{ gap: space.sm }}>
          <Press label={copied ? 'Copied' : 'Copy what it read'} tone="signal" onPress={copyAll} />
          {read.map((text, i) => (
            <Text key={i} selectable style={{ color: color.silkDim, fontSize: font.micro, fontFamily: face }}>
              {text}
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  )
}

import { useCallback, useEffect, useRef, useState } from 'react'
import { Alert, Text, View } from 'react-native'

import { color, font, radius, space } from '../lib/theme'
import { logDebug } from '../lib/debugLog'
import { presetDumpOnWire, presetLoadOnWire } from '../lib/device'
import { deviceNoun } from '../lib/device-word'
import { useCableNow } from '../lib/bluetooth'
import { noteEdited, refreshAll, useRig } from '../lib/rig'
import { ALL_PRESETS, KEEP_BUTTON, PLAY_BUTTON, THIS_PRESET, rowLine } from '../lib/backups'
import {
  GONE,
  KEPT,
  NOT_KEPT_HERE,
  PHONE_KEEP_NOTE_SLOW,
  PHONE_NONE,
  PHONE_NONE_SLOT,
  PHONE_PLAY_NOTE,
  PHONE_REMOVE,
  PHONE_WHERE,
  PLAYED,
  keepingWords,
  paceFor,
  phonePlayAsk,
  phoneRemoveAsk,
  phoneRows,
  playingWords
} from '../lib/presetDump'
import { keepPhoneBackup, listPhoneBackups, readPhoneBackup, removePhoneBackup } from '../lib/phoneBackups'
import Note from './Note'
import Press from './Press'

const ofPreset = (s) => s.preset
const ofSlug = (s) => s.deviceSlug
const ofCaps = (s) => s.capabilities
const ofUnsaved = (s) => s.unsaved

/**
 * Settings → My rig → Backups, over Bluetooth or the unit's USB cable
 * (lib/presetDump has what it is and every word): the backups kept on this
 * device. Back up this preset reads the loaded preset whole; Play it sends
 * one back into the unit's edit buffer and saves nothing; Remove deletes one
 * from this device. One job at a time.
 */
export default function PhoneBackups() {
  const preset = useRig(ofPreset)
  const unit = useRig(ofSlug)
  const caps = useRig(ofCaps)
  const unsaved = useRig(ofUnsaved)
  const onCable = useCableNow()
  const slot = Number.isInteger(preset?.number) ? preset.number : null
  const device = deviceNoun()
  const [scope, setScope] = useState('slot')
  const [index, setIndex] = useState(null)
  /* `{ kind: 'keep' | 'play', id, progress }`: the one job going. */
  const [job, setJob] = useState(null)
  const [said, setSaid] = useState(null)
  const going = useRef(false)
  const live = useRef(true)
  useEffect(
    () => () => {
      live.current = false
    },
    []
  )
  const load = useCallback(async () => {
    const list = await listPhoneBackups()
    if (live.current) setIndex(list)
  }, [])
  useEffect(() => {
    load()
  }, [load])

  const keep = async () => {
    if (going.current) return
    going.current = true
    setSaid(null)
    setJob({ kind: 'keep', id: null, progress: null })
    logDebug('backup', 'reading the loaded preset to keep on this device')
    try {
      const got = await presetDumpOnWire((progress) => live.current && setJob((j) => (j ? { ...j, progress } : j)))
      if (!got) throw new Error('Backups aren’t available on this connection.')
      const name = got.name || preset?.name || ''
      try {
        const { index: next } = await keepPhoneBackup({ unit, slot: Number.isInteger(got.number) ? got.number : slot, name, frames: got.frames })
        logDebug('backup', 'kept on this device', `preset ${got.number} “${name}”, ${got.frames.length} frames`)
        if (live.current) {
          setIndex(next)
          setSaid({ tone: 'hint', text: KEPT(name) })
        }
      } catch (err) {
        logDebug('backup', 'read, and not kept on this device', err?.message || String(err))
        if (live.current) setSaid({ tone: 'warn', text: NOT_KEPT_HERE })
      }
    } catch (err) {
      logDebug('backup', 'the preset could not be read for a backup', err?.message || String(err))
      if (live.current) setSaid({ tone: 'warn', text: err?.message || 'The preset couldn’t be read.' })
    } finally {
      going.current = false
      if (live.current) setJob(null)
    }
  }

  const play = async (row) => {
    if (going.current) return
    going.current = true
    setSaid(null)
    setJob({ kind: 'play', id: row.id, progress: null })
    logDebug('backup', 'sending a backup from this device to the unit', `“${row.name}”, from preset ${row.slot}`)
    try {
      const frames = await readPhoneBackup(row.id)
      if (!frames) throw new Error(GONE)
      const res = await presetLoadOnWire(frames, {
        onProgress: (progress) => live.current && setJob((j) => (j ? { ...j, progress } : j)),
        paceMs: (bytes) => paceFor(bytes, onCable)
      })
      if (!res) throw new Error('Backups aren’t available on this connection.')
      logDebug('backup', 'the backup was sent', `${res.frames} frames, ${res.bytes} bytes`)
      noteEdited()
      refreshAll().catch(() => {})
      if (live.current) setSaid({ tone: 'hint', text: PLAYED(row.name, caps?.supportsSave === true) })
    } catch (err) {
      logDebug('backup', 'the backup was not sent whole', err?.message || String(err))
      /* Part of it may have gone: what the unit holds is read again either way. */
      if (err?.partial) refreshAll().catch(() => {})
      if (live.current) setSaid({ tone: 'warn', text: err?.message || 'The backup couldn’t be sent.' })
    } finally {
      going.current = false
      if (live.current) setJob(null)
    }
  }

  const confirm = (words, go) =>
    Alert.alert(words.title, words.body, [
      { text: 'Cancel', style: 'cancel' },
      { text: words.yes, style: 'destructive', onPress: go }
    ])
  const remove = (row) =>
    confirm(phoneRemoveAsk(row), async () => {
      const next = await removePhoneBackup(row.id).catch(() => null)
      if (next && live.current) setIndex(next)
    })

  const busy = !!job
  const rows = index ? phoneRows(index, { unit, slot: scope === 'slot' ? slot : null }) : null
  return (
    <View style={{ gap: space.md }}>
      <Text style={{ color: color.silkDim, fontSize: font.small }}>{PHONE_WHERE(device)}</Text>
      <Press label={KEEP_BUTTON} sub={slot != null ? `Preset ${slot}${preset?.name ? ` · ${preset.name}` : ''}` : undefined} tone="signal" on disabled={busy || slot == null} onPress={keep} />
      {!onCable ? <Text style={{ color: color.silkDim, fontSize: font.small }}>{PHONE_KEEP_NOTE_SLOW}</Text> : null}
      {job?.kind === 'keep' ? <Note tone="hint">{keepingWords(job.progress)}</Note> : null}
      {said ? <Note tone={said.tone}>{said.text}</Note> : null}
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <Press grow height={44} label={THIS_PRESET} on={scope === 'slot'} onPress={() => setScope('slot')} />
        <Press grow height={44} label={ALL_PRESETS} on={scope === 'all'} onPress={() => setScope('all')} />
      </View>
      {rows && rows.length ? <Text style={{ color: color.silkDim, fontSize: font.small }}>{PHONE_PLAY_NOTE}</Text> : null}
      {rows && !rows.length ? <Text style={{ color: color.silkDim, fontSize: font.small }}>{scope === 'slot' ? PHONE_NONE_SLOT(device) : PHONE_NONE(device)}</Text> : null}
      {(rows || []).map((row) => (
        <View key={row.id} style={{ borderWidth: 1, borderColor: color.rule, borderRadius: radius.md, padding: space.md, gap: space.sm }}>
          <Text style={{ color: color.silk, fontSize: font.body }} numberOfLines={1}>
            {row.name || `Preset ${row.slot ?? ''}`}
          </Text>
          <Text style={{ color: color.silkDim, fontSize: font.small }}>{rowLine(row)}</Text>
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <Press grow height={44} label={PLAY_BUTTON} accessibilityLabel={`${PLAY_BUTTON}: ${row.name}`} disabled={busy} onPress={() => confirm(phonePlayAsk(row, { on: slot, unsaved: !!unsaved }), () => play(row))} />
            <Press grow height={44} label={PHONE_REMOVE} accessibilityLabel={`${PHONE_REMOVE}: ${row.name}`} disabled={busy} onPress={() => remove(row)} />
          </View>
          {job?.kind === 'play' && job.id === row.id ? <Note tone="hint">{playingWords(job.progress)}</Note> : null}
        </View>
      ))}
    </View>
  )
}

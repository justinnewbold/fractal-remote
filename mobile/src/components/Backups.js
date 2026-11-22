import { useCallback, useEffect, useRef, useState } from 'react'
import { Alert, Text, View } from 'react-native'

import { color, font, radius, space } from '../lib/theme'
import { logDebug } from '../lib/debugLog'
import { isDemo } from '../lib/demo'
import { listSnapshots, parkBackupAsk, readBackupProgress, readBackupResult } from '../lib/device'
import { isVp4 } from '../lib/vp4-safety'
import { onConfigDoc, refreshAll, useRig } from '../lib/rig'
import {
  ALL_PRESETS,
  BACKUPS_NONE,
  BACKUPS_NONE_SLOT,
  BACKUPS_NO_LIST,
  BACKUPS_WHERE,
  KEEP_BUTTON,
  KEEP_NOTE,
  PLAY_BUTTON,
  PUT_BUTTON,
  THIS_PRESET,
  backupRows,
  backupsHere,
  keepRequest,
  playAsk,
  putAsk,
  restoreRequest,
  rowLine,
  startBackupAsk,
  waitingWords
} from '../lib/backups'
import { PHONE_ONLY_GEN3 } from '../lib/presetDump'
import { usePhoneBackups } from '../lib/useBackups'
import Note from './Note'
import PhoneBackups from './PhoneBackups'
import Press from './Press'

const ofPreset = (s) => s.preset
const ofSlug = (s) => s.deviceSlug
const ofCaps = (s) => s.capabilities
const ofUnsaved = (s) => s.unsaved

/**
 * Settings → My rig → Backups (lib/backups has what it is and every word).
 *
 * The computer's snapshots of the preset the unit is on (or of every slot),
 * newest first; Back up this preset, Play it and Put back are each asked of
 * the computer and waited for here, one at a time. Nothing is written from
 * this device: the computer app does it, and says how it went.
 */
export default function Backups() {
  const preset = useRig(ofPreset)
  const slug = useRig(ofSlug)
  const caps = useRig(ofCaps)
  const unsaved = useRig(ofUnsaved)
  const slot = Number.isInteger(preset?.number) ? preset.number : null
  const way = isDemo() ? 'demo' : caps?.via === 'bluetooth' ? 'bluetooth' : 'computer'
  const here = backupsHere({ way, vp4: !isDemo() && isVp4(slug) })
  const phoneOpen = usePhoneBackups()
  const [scope, setScope] = useState('slot')
  const [rows, setRows] = useState(null)
  const [fault, setFault] = useState(null)
  /* `{ mode, id, slot, late, picked }`: the one ask that is out. */
  const [out, setOut] = useState(null)
  const [said, setSaid] = useState(null)
  const job = useRef(null)
  const live = useRef(true)
  useEffect(
    () => () => {
      live.current = false
      /* The ask goes on at the computer; only the listening stops. */
      job.current?.stop()
    },
    []
  )

  const load = useCallback(async () => {
    if (!here.ok) return
    try {
      const list = await listSnapshots(scope === 'slot' && slot != null ? slot : undefined)
      if (!live.current) return
      setRows(backupRows(list, { slot: scope === 'slot' ? slot : null }))
      setFault(null)
    } catch (err) {
      if (!live.current) return
      setRows([])
      setFault(`${BACKUPS_NO_LIST} ${err?.message || ''}`.trim())
    }
  }, [here.ok, scope, slot])
  useEffect(() => {
    setRows(null)
    load()
  }, [load])

  const ask = async (request, forSlot) => {
    if (job.current) return
    setSaid(null)
    setOut({ mode: request.mode, id: request.versionId ?? null, slot: forSlot, late: false, picked: false })
    logDebug('backup', `asked the computer to ${request.mode}`, `slot ${forSlot}`)
    const run = startBackupAsk({
      request,
      slug,
      park: (req) => parkBackupAsk(slug, req),
      readResult: () => readBackupResult(slug),
      readProgress: () => readBackupProgress(slug),
      listen: onConfigDoc,
      onState: (now) => live.current && setOut((o) => (o ? { ...o, late: !!now.late, picked: !!now.picked } : o))
    })
    job.current = run
    const res = await run.done
    if (job.current === run) job.current = null
    logDebug('backup', `the computer’s answer to ${request.mode}`, res.ok ? res.said || 'done' : res.stopped ? 'not waited for' : res.error)
    if (!live.current || res.stopped) return
    setOut(null)
    setSaid(res.ok ? { tone: 'hint', text: res.said || 'Done.' } : { tone: res.cancelled ? 'hint' : 'warn', text: res.error })
    if (res.ok) {
      /* A Play it or a Put back changed what the unit holds: read it again. The list has grown either way. */
      if (request.mode !== 'keep') refreshAll().catch(() => {})
      load()
    }
  }

  const keep = () => slot != null && ask(keepRequest(slot, { name: preset?.name || '' }), slot)
  const confirm = (words, go) =>
    Alert.alert(words.title, words.body, [
      { text: 'Cancel', style: 'cancel' },
      { text: words.yes, style: 'destructive', onPress: go }
    ])
  const play = (row) => (unsaved ? confirm(playAsk(), () => ask(restoreRequest(row, 'play'), row.slot)) : ask(restoreRequest(row, 'play'), row.slot))
  const put = (row) => confirm(putAsk(row, { unsaved: !!unsaved }), () => ask(restoreRequest(row, 'put'), row.slot))

  /* Over Bluetooth or the unit's USB cable there is no computer to keep them: they are kept on this device (lib/presetDump), on the three units the phone can read a whole preset from. */
  if (way === 'bluetooth' && phoneOpen && !isVp4(slug)) return caps?.slotModel === 'grid' ? <PhoneBackups /> : <Note tone="hint">{PHONE_ONLY_GEN3}</Note>
  if (!here.ok) return <Note tone="hint">{here.why}</Note>

  const busy = !!out
  return (
    <View style={{ gap: space.md }}>
      <Text style={{ color: color.silkDim, fontSize: font.small }}>{BACKUPS_WHERE}</Text>
      <Press label={KEEP_BUTTON} sub={slot != null ? `Slot ${slot}${preset?.name ? ` · ${preset.name}` : ''}` : undefined} tone="signal" on disabled={busy || slot == null} onPress={keep} />
      <Text style={{ color: color.silkDim, fontSize: font.small }}>{KEEP_NOTE}</Text>
      {out?.mode === 'keep' ? <Waiting out={out} onCancel={() => job.current?.cancel()} /> : null}
      {said ? <Note tone={said.tone}>{said.text}</Note> : null}
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <Press grow height={44} label={THIS_PRESET} on={scope === 'slot'} onPress={() => setScope('slot')} />
        <Press grow height={44} label={ALL_PRESETS} on={scope === 'all'} onPress={() => setScope('all')} />
      </View>
      {fault ? <Note tone="warn">{fault}</Note> : null}
      {rows === null ? <Text style={{ color: color.silkDim, fontSize: font.small }}>Reading the backups on the computer…</Text> : null}
      {rows && !rows.length && !fault ? <Text style={{ color: color.silkDim, fontSize: font.small }}>{scope === 'slot' ? BACKUPS_NONE_SLOT : BACKUPS_NONE}</Text> : null}
      {(rows || []).map((row) => (
        <View key={String(row.id)} style={{ borderWidth: 1, borderColor: color.rule, borderRadius: radius.md, padding: space.md, gap: space.sm }}>
          <Text style={{ color: color.silk, fontSize: font.body }} numberOfLines={1}>
            {row.name}
          </Text>
          <Text style={{ color: color.silkDim, fontSize: font.small }}>{rowLine(row)}</Text>
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <Press grow height={44} label={PLAY_BUTTON} accessibilityLabel={`${PLAY_BUTTON}: ${row.name}`} disabled={busy} onPress={() => play(row)} />
            <Press grow height={44} label={PUT_BUTTON} accessibilityLabel={`${PUT_BUTTON}: ${row.name}`} disabled={busy || row.slot == null} onPress={() => put(row)} />
          </View>
          {out && out.mode !== 'keep' && out.id === row.id ? <Waiting out={out} onCancel={() => job.current?.cancel()} /> : null}
        </View>
      ))}
    </View>
  )
}

function Waiting({ out, onCancel }) {
  return (
    <View style={{ gap: space.sm }}>
      <Note tone="hint">{waitingWords(out.mode, out.slot, out)}</Note>
      <Press height={44} label="Cancel" onPress={onCancel} />
    </View>
  )
}

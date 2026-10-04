import { useCallback, useEffect, useState } from 'react'
import { View } from 'react-native'

import { space, TAP } from '../lib/theme'
import { APP_VERSION } from '../lib/version'
import { useUpdates } from '../lib/updates'
import { fetchLive, liveRows } from '../lib/whats-live'
import Facts from './Facts'
import Press from './Press'

/**
 * WHAT'S LIVE — Justin's page. Which version the website, the newest update,
 * the computer app and the two store builds are on, and whether this phone
 * has caught up. The words are shared/whats-live.mjs's; this only asks and
 * lays them out.
 */
export default function LiveTool() {
  const updates = useUpdates()
  const [live, setLive] = useState(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setBusy(true)
    try {
      setLive(await fetchLive())
    } finally {
      setBusy(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const rows = live ? liveRows(live, { kind: 'phone', version: APP_VERSION, updateWaiting: updates.phase === 'ready' }) : []
  return (
    <View style={{ gap: space.lg }}>
      <Facts rows={rows} />
      <Press label={busy ? 'Checking…' : 'Check again'} height={TAP} disabled={busy} onPress={load} />
    </View>
  )
}

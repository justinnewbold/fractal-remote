import { useCallback, useEffect, useState } from 'react'
import { View } from 'react-native'

import { TAP, space } from '../lib/theme'
import { DEFAULT_PROJECT } from '../lib/project'
import { supabaseClient } from '../lib/relay'
import { accessAction, usageSections } from '../lib/admin'
import Facts from './Facts'
import Note from './Note'
import Press from './Press'

/**
 * HOW MANY PEOPLE — Justin's page, and nobody else's.
 *
 * "Is there a way for me to see how many users are actively using the app?"
 * Today, this week and this month, where, and on which version, counted from
 * what the server already knows (usageSections in shared/admin.mjs). The same
 * server as Give someone access, which decides who may ask.
 */
export default function UsageTool() {
  const [busy, setBusy] = useState(false)
  const [said, setSaid] = useState(null)

  const load = useCallback(async () => {
    setBusy(true)
    try {
      const { data } = await supabaseClient().auth.getSession()
      setSaid(
        await accessAction({
          url: DEFAULT_PROJECT.url,
          anonKey: DEFAULT_PROJECT.anonKey,
          token: data?.session?.access_token,
          action: 'usage'
        })
      )
    } finally {
      setBusy(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  return (
    <View style={{ gap: space.lg }}>
      {said && !said.ok ? <Note tone="fault">{said.message}</Note> : null}
      {said?.ok ? usageSections(said).map((s) => <Facts key={s.title} title={s.title} rows={s.rows} />) : null}
      <Press label={busy ? 'Counting…' : 'Refresh'} height={TAP} disabled={busy} onPress={load} />
    </View>
  )
}

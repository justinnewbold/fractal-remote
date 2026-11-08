import { useCallback, useEffect, useState } from 'react'
import { View } from 'react-native'

import { TAP, space } from '../lib/theme'
import { DEFAULT_PROJECT } from '../lib/project'
import { supabaseClient } from '../lib/relay'
import { accessAction, trialsAnswer, trialsPageSections, trialsProblem } from '../lib/admin'
import Facts from './Facts'
import Note from './Note'
import Press from './Press'

/**
 * FREE TRIALS — Justin's page, and nobody else's.
 *
 * "Can we add people that are on trials currently into the developer section
 * of the app? And how many people have signed up for trials in the last day
 * or seven days or whatever, just like all the other stuff?" (8 November
 * 2026.) How many started today, in the last 7 and 30 days and all time,
 * everyone on a trial now with the days they have left, and the latest that
 * finished, bought or not. The words are trialsPageSections' in
 * shared/admin.mjs, so the browser's copy (src/components/TrialsTool.jsx)
 * says exactly the same. The same server as Give someone access, which
 * decides who may ask; its 'trials' answer is one query, so this opens at once.
 */
export default function TrialsTool() {
  const [busy, setBusy] = useState(false)
  const [said, setSaid] = useState(null)

  const load = useCallback(async () => {
    setBusy(true)
    try {
      const { data } = await supabaseClient().auth.getSession()
      const ask = (action) => accessAction({ url: DEFAULT_PROJECT.url, anonKey: DEFAULT_PROJECT.anonKey, token: data?.session?.access_token, action })
      /* 'trials', or Sales' answer from a server without it yet (trialsAnswer). */
      setSaid(await trialsAnswer(ask))
    } finally {
      setBusy(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  return (
    <View style={{ gap: space.lg }}>
      {said && !said.ok ? <Note tone="fault">{trialsProblem(said)}</Note> : null}
      {said?.ok ? trialsPageSections(said).map((s) => <Facts key={s.title} title={s.title} rows={s.rows} />) : null}
      <Press label={busy ? 'Counting…' : 'Refresh'} height={TAP} disabled={busy} onPress={load} />
    </View>
  )
}

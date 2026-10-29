import { useCallback, useEffect, useState } from 'react'
import { View } from 'react-native'

import { space, TAP } from '../lib/theme'
import { DEFAULT_PROJECT } from '../lib/project'
import { supabaseClient } from '../lib/relay'
import { gearAction, gearSections } from '../lib/gear-share-rules'
import Facts from './Facts'
import Note from './Note'
import Press from './Press'

/**
 * WHAT WORKS — Justin's page, and nobody else's.
 *
 * The notes from everybody who said Yes to "Help make Fractal Remote
 * better?", added up: one group per unit, newest first, and a row for each
 * way it came in (the computer's system, or the Bluetooth adapter's name),
 * with how many said it worked and how many said the unit didn't answer.
 * The server (supabase/functions/gear-reports) decides who may read them.
 */
export default function WhatWorksTool() {
  const [busy, setBusy] = useState(false)
  const [said, setSaid] = useState(null)

  const load = useCallback(async () => {
    setBusy(true)
    try {
      const token = (await supabaseClient().auth.getSession())?.data?.session?.access_token
      setSaid(await gearAction({ url: DEFAULT_PROJECT.url, anonKey: DEFAULT_PROJECT.anonKey, token }))
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
      {said?.ok ? gearSections(said).map((s, i) => <Facts key={`${s.title}-${i}`} title={s.title} rows={s.rows} />) : null}
      <Press label={busy ? 'Loading…' : 'Refresh'} height={TAP} disabled={busy} onPress={load} />
    </View>
  )
}

import { useCallback, useEffect, useState } from 'react'
import { Alert, View } from 'react-native'

import { TAP, font, space } from '../lib/theme'
import { DEFAULT_PROJECT } from '../lib/project'
import { supabaseClient } from '../lib/relay'
import {
  TRIAL_EXTEND_LABEL,
  TRIAL_NUDGE_TURN_ON,
  accessAction,
  trialExtendAsk,
  trialExtendSaid,
  trialNudgeCard,
  trialNudgeProblem,
  trialsAnswer,
  trialsPageSections,
  trialsProblem
} from '../lib/admin'
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
 *
 * MORE TIME, AND THE TRIAL EMAIL (25 November 2026). Each trial says whether
 * the account ever connected a unit, when the trial email went and what it
 * was extended by, and one that has not got the full version has Give 7 more
 * days under it, asked once before it goes. At the top: the trial email's
 * switch (off until he turns it on, and asked first, because it emails real
 * people within the hour) and Send me a sample, which puts both emails in
 * his own inbox. A server or database from before any of it says so in
 * plain words (trialNudgeProblem).
 */
export default function TrialsTool() {
  const [busy, setBusy] = useState(false)
  const [said, setSaid] = useState(null)
  const [nudge, setNudge] = useState(null)
  const [doing, setDoing] = useState(null)
  const [told, setTold] = useState(null)
  const [given, setGiven] = useState(null)

  const ask = useCallback(async (action, email, extra) => {
    const { data } = await supabaseClient().auth.getSession()
    return accessAction({ url: DEFAULT_PROJECT.url, anonKey: DEFAULT_PROJECT.anonKey, token: data?.session?.access_token, action, email, extra })
  }, [])

  const load = useCallback(async () => {
    setBusy(true)
    try {
      /* 'trials', or Sales' answer from a server without it yet (trialsAnswer). */
      setSaid(await trialsAnswer(ask))
      /* The trial email's switch, only read. */
      setNudge(await ask('trial-nudge-switch'))
    } finally {
      setBusy(false)
    }
  }, [ask])

  useEffect(() => {
    load()
  }, [load])

  const run = async (what, action, extra) => {
    setDoing(what)
    setTold(null)
    try {
      const res = await ask(action, undefined, extra)
      setTold({ ok: res.ok, words: res.ok ? res.message : trialNudgeProblem(res) })
      if (res.ok && action === 'trial-nudge-switch') setNudge(res)
    } finally {
      setDoing(null)
    }
  }

  const turn = (on) => {
    if (!on) return run('switch', 'trial-nudge-switch', { enabled: false })
    Alert.alert('Turn the trial email on?', TRIAL_NUDGE_TURN_ON, [
      { text: 'Not yet', style: 'cancel' },
      { text: 'Turn it on', onPress: () => run('switch', 'trial-nudge-switch', { enabled: true }) }
    ])
  }

  const extend = async (email) => {
    setDoing(email)
    setGiven(null)
    try {
      const res = await ask('extend-trial', email)
      setGiven({ email, ok: res.ok, words: trialExtendSaid(res) })
      if (res.ok) load()
    } finally {
      setDoing(null)
    }
  }

  const give = (email) =>
    Alert.alert(`${TRIAL_EXTEND_LABEL}?`, trialExtendAsk(email), [
      { text: 'Not now', style: 'cancel' },
      { text: TRIAL_EXTEND_LABEL, onPress: () => extend(email) }
    ])

  /* Under each trial that has not got the full version: the button, and what the last press of it said. */
  const under = (row) =>
    row.extend ? (
      <View style={{ gap: space.sm }}>
        {given?.email === row.email ? (
          <Note tone={given.ok ? 'hint' : 'fault'} strong size={font.body}>
            {given.words}
          </Note>
        ) : null}
        <Press label={doing === row.email ? 'Giving more time…' : TRIAL_EXTEND_LABEL} height={TAP} disabled={!!doing} onPress={() => give(row.email)} />
      </View>
    ) : null

  const card = trialNudgeCard(nudge)
  const cardProblem = trialNudgeProblem(nudge)

  return (
    <View style={{ gap: space.lg }}>
      {said && !said.ok ? <Note tone="fault">{trialsProblem(said)}</Note> : null}
      {card ? <Facts title={card.title} rows={[{ label: '', value: card.line }]} /> : null}
      {!card && cardProblem && said?.ok ? <Note tone="hint">{`Trial email: ${cardProblem}`}</Note> : null}
      {told ? (
        <Note tone={told.ok ? 'hint' : 'fault'} strong size={font.body}>
          {told.words}
        </Note>
      ) : null}
      {card ? (
        <Press
          label={doing === 'switch' ? 'Changing…' : card.on ? 'Turn the trial email off' : 'Turn the trial email on'}
          tone={card.on ? 'plain' : 'signal'}
          height={TAP}
          disabled={!!doing}
          onPress={() => turn(!card.on)}
        />
      ) : null}
      {card ? (
        <Press label={doing === 'sample' ? 'Sending…' : 'Send me a sample'} height={TAP} disabled={!!doing} onPress={() => run('sample', 'trial-nudge-sample')} />
      ) : null}
      {said?.ok ? trialsPageSections(said).map((s) => <Facts key={s.title} title={s.title} rows={s.rows} detail={under} />) : null}
      <Press label={busy ? 'Counting…' : 'Refresh'} height={TAP} disabled={busy} onPress={load} />
    </View>
  )
}

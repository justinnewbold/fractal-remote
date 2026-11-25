import { useCallback, useEffect, useState } from 'react'
import { DEFAULT_PROJECT, supabaseClient } from '../lib/remote'
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
} from '../../shared/admin.mjs'
import Facts from './Facts'

/**
 * FREE TRIALS — Justin's page, and nobody else's. The browser's copy of the
 * phone's (mobile/src/components/TrialsTool.js), same words, same server:
 * the counts and the people, Give 7 more days under each trial that has not
 * got the full version (asked once first), and at the top the trial email's
 * switch and Send me a sample (25 November 2026).
 */
export default function TrialsTool() {
  const [busy, setBusy] = useState(false)
  const [said, setSaid] = useState(null)
  const [nudge, setNudge] = useState(null)
  const [doing, setDoing] = useState(null)
  const [told, setTold] = useState(null)
  const [given, setGiven] = useState(null)

  const ask = useCallback(async (action, email, extra) => {
    const client = supabaseClient()
    const { data } = client ? await client.auth.getSession() : { data: null }
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

  /* Turning it on emails real people within the hour, so it is asked first. Off is at once. */
  const turn = (on) => {
    if (on && !window.confirm(`Turn the trial email on? ${TRIAL_NUDGE_TURN_ON}`)) return
    run('switch', 'trial-nudge-switch', { enabled: on })
  }

  const give = async (email) => {
    if (!window.confirm(`${TRIAL_EXTEND_LABEL}? ${trialExtendAsk(email)}`)) return
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

  /* Under each trial that has not got the full version: the button, and what the last press of it said. */
  const under = (row) =>
    row.extend ? (
      <div className="history-actions">
        <button type="button" className="chip" disabled={!!doing} aria-label={`${TRIAL_EXTEND_LABEL} to ${row.email}`} onClick={() => give(row.email)}>
          {doing === row.email ? 'Giving more time…' : TRIAL_EXTEND_LABEL}
        </button>
        {given?.email === row.email ? (
          <span className={given.ok ? 'access-said' : 'access-said save-error'} role="status">
            {given.words}
          </span>
        ) : null}
      </div>
    ) : null

  const card = trialNudgeCard(nudge)
  const cardProblem = trialNudgeProblem(nudge)

  return (
    <div className="access-tool">
      {said && !said.ok ? (
        <p className="save-error" role="status">
          {trialsProblem(said)}
        </p>
      ) : null}
      {card ? <Facts title={card.title} rows={[{ label: '', value: card.line }]} /> : null}
      {!card && cardProblem && said?.ok ? <p className="access-said">{`Trial email: ${cardProblem}`}</p> : null}
      {card ? (
        <div className="history-actions">
          <button type="button" className="chip" role="switch" aria-checked={card.on} disabled={!!doing} onClick={() => turn(!card.on)}>
            {doing === 'switch' ? 'Changing…' : card.on ? 'Turn the trial email off' : 'Turn the trial email on'}
          </button>
          <button type="button" className="chip" disabled={!!doing} onClick={() => run('sample', 'trial-nudge-sample')}>
            {doing === 'sample' ? 'Sending…' : 'Send me a sample'}
          </button>
        </div>
      ) : null}
      {told ? (
        <p className={told.ok ? 'access-said' : 'access-said save-error'} role="status">
          {told.words}
        </p>
      ) : null}
      {said?.ok ? trialsPageSections(said).map((s) => <Facts key={s.title} title={s.title} rows={s.rows} detail={under} />) : null}
      <div className="history-actions">
        <button type="button" className="chip" disabled={busy} onClick={load}>
          {busy ? 'Counting…' : 'Refresh'}
        </button>
      </div>
    </div>
  )
}

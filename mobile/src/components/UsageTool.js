import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { Pressable, Text, View } from 'react-native'

import { TAP, color, font, radius, space } from '../lib/theme'
import { DEFAULT_PROJECT } from '../lib/project'
import { supabaseClient } from '../lib/relay'
import {
  CHART_HEIGHT,
  DAY_BY_DAY,
  accessAction,
  axisLabels,
  barAt,
  barLabel,
  barPoints,
  dayBars,
  dayLine,
  daysProblem,
  offsetHere,
  scaleLine,
  usageSections,
  utcNote
} from '../lib/admin'
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
 *
 * And Day by day under the first of them (4 November 2026): the totals the
 * server keeps once a day, which come back in the same answer (DayBars).
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
      {said?.ok
        ? usageSections(said).map((s, i) => (
            <Fragment key={s.title}>
              <Facts title={s.title} rows={s.rows} />
              {i === 0 ? <DayBars answer={said} /> : null}
            </Fragment>
          ))
        : null}
      <Press label={busy ? 'Counting…' : 'Refresh'} height={TAP} disabled={busy} onPress={load} />
    </View>
  )
}

/**
 * DAY BY DAY — how many people used the app each day, the last 30 days,
 * today on the right. Justin's page, and nobody else's (it is drawn only
 * inside UsageTool, behind the Developer page's lock).
 *
 * Plain views, no drawing library: one column per day, as tall as the day's
 * count against the busiest day shown. The whole chart is one thing to tap,
 * at least a thumb tall, rather than thirty slivers too thin to hit: a tap
 * picks the day under it, and the lines above say that day's numbers. A
 * screen reader steps through the days with a swipe up or down. Every rule
 * (which day is which, the heights, the words) is in shared/admin.mjs.
 *
 * A day with no number, before counting began, a night the count missed
 * or a moment the days could not be read, is a short hollow outline, never
 * a bar: it must not read as a zero. A real zero is a thin line on the
 * floor, and a day with anybody at all is at least twice that.
 */
function DayBars({ answer }) {
  /* One moment for the whole drawing, taken again only when the answer is. */
  const now = useMemo(() => Date.now(), [answer])
  const offset = offsetHere(now)
  const { bars, most, first } = useMemo(() => dayBars(answer, now), [answer, now])
  const [picked, setPicked] = useState(null)
  const [width, setWidth] = useState(0)

  /* A fresh count starts on the newest day again. */
  useEffect(() => {
    setPicked(null)
  }, [answer])

  if (!bars.length) return null
  const at = picked === null || picked >= bars.length ? bars.length - 1 : picked
  const bar = bars[at]
  const problem = daysProblem(answer, now, offset)
  const step = (by) => setPicked(Math.min(bars.length - 1, Math.max(0, at + by)))

  return (
    <View style={{ gap: space.xs }}>
      <Text style={{ color: color.silkDim, fontSize: font.micro, letterSpacing: 1, textTransform: 'uppercase' }}>{DAY_BY_DAY}</Text>
      <View style={{ borderRadius: radius.md, backgroundColor: color.panel, padding: space.md, gap: space.sm }}>
        {dayLine(bar, { first, offset }).map((line, i) => (
          <Text key={i} selectable style={{ color: i ? color.silkDim : color.silk, fontSize: font.small, lineHeight: font.small * 1.4 }}>
            {line}
          </Text>
        ))}
        <Text style={{ color: color.silkDim, fontSize: font.micro }}>{scaleLine(most)}</Text>
        <Pressable
          onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
          onPress={(e) => setPicked(barAt(e.nativeEvent.locationX, width, bars.length))}
          accessibilityRole="adjustable"
          accessibilityLabel={DAY_BY_DAY}
          accessibilityValue={{ text: barLabel(bar) }}
          accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
          onAccessibilityAction={(e) => step(e.nativeEvent.actionName === 'increment' ? 1 : -1)}
          style={{ height: CHART_HEIGHT, borderBottomWidth: 1, borderBottomColor: color.rule }}
        >
          {/* Not touchable itself, so a tap's place is measured across the whole chart, not inside one bar. */}
          <View pointerEvents="none" style={{ flex: 1, flexDirection: 'row', alignItems: 'flex-end' }}>
            {bars.map((b, i) => {
              const chosen = i === at
              const empty = b.value === null
              return (
                <View key={b.day} style={{ flex: 1, paddingHorizontal: 1, justifyContent: 'flex-end' }}>
                  <View
                    style={
                      empty
                        ? {
                            /* The dim text colour, not the rule's, which all but vanishes on the dark panel. */
                            height: barPoints(b),
                            borderWidth: 1,
                            borderColor: color.silkDim,
                            borderRadius: 2,
                            opacity: chosen ? 1 : 0.5
                          }
                        : {
                            height: barPoints(b),
                            borderRadius: 2,
                            backgroundColor: chosen ? color.silk : color.silkDim,
                            opacity: b.kind === 'so-far' && !chosen ? 0.55 : 1
                          }
                    }
                  />
                </View>
              )
            })}
          </View>
        </Pressable>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          {axisLabels(bars).map((label, i) => (
            <Text key={`${label}-${i}`} style={{ color: color.silkDim, fontSize: font.micro }}>
              {label}
            </Text>
          ))}
        </View>
        {problem ? (
          <Text selectable style={{ color: color.silk, fontSize: font.small, lineHeight: font.small * 1.4 }}>
            {problem}
          </Text>
        ) : null}
        <Text selectable style={{ color: color.silkDim, fontSize: font.small, lineHeight: font.small * 1.4 }}>
          {utcNote(now, offset)}
        </Text>
      </View>
    </View>
  )
}

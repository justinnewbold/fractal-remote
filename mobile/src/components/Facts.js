import { Pressable, Text, View } from 'react-native'

import { color, font, radius, space } from '../lib/theme'

/**
 * A few labelled facts, one to a line — the answers on Justin's own tools
 * (Customer lookup, Sales at a glance). The words come from lib/admin.js; this
 * only lays them out. `title` heads the group when there is one.
 *
 * The words can be held down and copied, like any text a person might need to
 * paste somewhere else. A row that names somebody (`row.email`) can also be
 * tapped, when `onRow` is given: Everyone with an account uses it to open
 * that person.
 *
 * `detail(row)` draws whatever belongs under a row, as the browser's
 * src/components/Facts.jsx does: on Sales at a glance, the Handled button
 * under each Paid twice row. A row it gives nothing for is drawn as before.
 */
const look = (i, pressed) => ({
  flexDirection: 'row',
  alignItems: 'center',
  gap: space.md,
  paddingVertical: space.sm,
  borderTopWidth: i ? 1 : 0,
  borderTopColor: color.rule,
  opacity: pressed ? 0.6 : 1
})

export default function Facts({ title, rows, onRow, detail }) {
  if (!rows?.length) return null
  return (
    <View style={{ gap: space.xs }}>
      {title ? (
        <Text style={{ color: color.silkDim, fontSize: font.micro, letterSpacing: 1, textTransform: 'uppercase' }}>{title}</Text>
      ) : null}
      <View style={{ borderRadius: radius.md, backgroundColor: color.panel, paddingHorizontal: space.md }}>
        {rows.map((row, i) => {
          const tappable = !!(onRow && (row.email || row.id))
          const Row = tappable ? Pressable : View
          const below = detail ? detail(row) : null
          /* With something under it, the line between rows goes above both. */
          const at = below ? 0 : i
          const line = (
            <Row
              key={`${row.label}-${i}`}
              {...(tappable
                ? { onPress: () => onRow(row), accessibilityRole: 'button', accessibilityHint: row.id ? 'Opens this message' : 'Opens this person' }
                : {})}
              style={tappable ? ({ pressed }) => look(at, pressed) : look(at, false)}
            >
              {row.label ? (
                <Text selectable style={{ width: 120, color: color.silkDim, fontSize: font.small, lineHeight: font.small * 1.4 }}>
                  {row.label}
                </Text>
              ) : null}
              {/* Not selectable when the row is a button: holding it down would
                  start a selection instead of opening the person. The sheet it
                  opens has the email to copy. */}
              <Text selectable={!tappable} style={{ flex: 1, color: color.silk, fontSize: font.small, lineHeight: font.small * 1.4 }}>
                {row.value}
              </Text>
              {tappable ? <Text style={{ color: color.silkDim, fontSize: font.body }}>›</Text> : null}
            </Row>
          )
          if (!below) return line
          return (
            <View key={`${row.label}-${i}`} style={{ borderTopWidth: i ? 1 : 0, borderTopColor: color.rule, paddingBottom: space.md }}>
              {line}
              {below}
            </View>
          )
        })}
      </View>
    </View>
  )
}

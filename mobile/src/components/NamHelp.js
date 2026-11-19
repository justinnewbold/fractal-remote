import { useState } from 'react'
import { Text, View } from 'react-native'

import { NAM_HELP_INTRO, NAM_HELP_UNITS, namHelpPage, namHelpTab } from '../lib/namHelp'
import { am4AddsHere } from '../lib/namHelpHere'
import { color, font, space } from '../lib/theme'
import Tabs from './Tabs'

/**
 * SETTINGS → NAM & TONE3000, DRAWN: lib/namHelp's sections, in the
 * Siri page's own materials (a heading in Settings' small capitals, lines of
 * plain text), under a tab for each unit that has a NAM block.
 *
 * The tab that opens is the linked unit's own (`deviceName`, the rig's name
 * for it), and a tab is looking only: it never changes which unit the app
 * connects to. Nothing is asked of the unit and nothing is sent.
 */
export default function NamHelp({ deviceName = '' }) {
  const [unit, setUnit] = useState(() => namHelpTab(deviceName))
  /* The AM4's first step follows what the app can do for this account: add the block itself, or not yet. */
  const am4Adds = am4AddsHere()
  return (
    <View style={{ gap: space.xl }}>
      <Text style={{ color: color.silk, fontSize: font.body, lineHeight: 24 }}>{NAM_HELP_INTRO}</Text>
      <Tabs items={NAM_HELP_UNITS} picked={unit} onPick={setUnit} name="Your unit" />
      {namHelpPage(unit, { am4Adds }).map((section) => (
        <View key={section.title} style={{ gap: space.md }}>
          <Heading>{section.title}</Heading>
          {section.lines.map((line) => (
            <Text key={line} style={{ color: color.silk, fontSize: font.body, lineHeight: 24 }}>
              {line}
            </Text>
          ))}
        </View>
      ))}
    </View>
  )
}

/* Settings' Section, the small capitals over each part of a page. */
function Heading({ children }) {
  return (
    <Text
      accessibilityRole="header"
      style={{
        color: color.silkFaint,
        fontSize: font.micro,
        letterSpacing: 1.5,
        textTransform: 'uppercase'
      }}
    >
      {children}
    </Text>
  )
}

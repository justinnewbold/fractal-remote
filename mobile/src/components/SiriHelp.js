import { Platform, Text, View } from 'react-native'

import { color, font, mono, space } from '../lib/theme'
import { siriPage } from '../lib/siri-help'
import Note from './Note'

const face = Platform.select(mono)

/**
 * SETTINGS → SIRI, DRAWN: lib/siri-help's sections, in the Apple Watch
 * page's own materials. A heading in Settings' small capitals, a note where
 * the section opens with one, the phrases in the words that are said with
 * what each does under it, the links in the typewriter face they are typed
 * in, and lines of plain text.
 *
 * Which page, and whether there is one at all, is Settings' to say (lib/siri
 * useSiriLinksOpen, and lib/siriPipe siriPresent for the phrases): this only
 * draws what it is handed.
 */
export default function SiriHelp({ os = Platform.OS, kind = 'phone', native = false, noun = 'phone' }) {
  return (
    <View style={{ gap: space.xl }}>
      {siriPage({ os, kind, native, noun }).map((section) => (
        <View key={section.title} style={{ gap: space.md }}>
          <Heading>{section.title}</Heading>
          {section.note ? <Note>{section.note}</Note> : null}
          {(section.phrases || []).map((p) => (
            <View key={p.say[0]} style={{ gap: 2 }}>
              {p.say.map((words) => (
                <Text key={words} style={{ color: color.silk, fontSize: font.body, fontWeight: '700', lineHeight: 22 }}>
                  {`“${words}”`}
                </Text>
              ))}
              <Text style={{ color: color.silkDim, fontSize: font.small, lineHeight: 20 }}>{p.does}</Text>
            </View>
          ))}
          {(section.links || []).map((l) => (
            <View key={l.url} style={{ gap: 2 }}>
              <Text selectable style={{ color: color.silk, fontSize: font.small, fontFamily: face }}>
                {l.url}
              </Text>
              <Text style={{ color: color.silkDim, fontSize: font.small, lineHeight: 20 }}>{l.does}</Text>
            </View>
          ))}
          {(section.lines || []).map((line) => (
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

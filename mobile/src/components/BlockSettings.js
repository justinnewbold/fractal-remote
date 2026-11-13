import { useState } from 'react'
import { Text, TextInput, View } from 'react-native'

import { color, font, radius, space, TAP } from '../lib/theme'
import { FIND_FROM, SETTINGS_HEAD, choiceSaid, choicesFound, settingKind, settingValue } from '../lib/editSettings'
import Note from './Note'
import Press from './Press'
import Sheet from './Sheet'

/**
 * A BLOCK'S LIST SETTINGS, UNDER ITS KNOBS (lib/editSettings, which says
 * which settings and why): two or three choices are buttons, all on show,
 * one tap; more is a row saying the choice it is on, which opens the list.
 * "Menu style B" (Justin, 13 November 2026).
 *
 * It draws and asks; it writes nothing. `onPick(setting, value)` is Edit's
 * own write (BlockPanel), and `choosing` is what was just tapped while that
 * write is out, so the button lights under the thumb and not a read later.
 * Every choice is in the unit's own words.
 */
export default function BlockSettings({ settings, choosing = null, disabled = false, onPick }) {
  /* The list that is open, by its setting's id, and what is typed in its find box. */
  const [open, setOpen] = useState(null)
  const [find, setFind] = useState('')
  if (!settings?.length) return null
  const shown = open === null ? null : settings.find((s) => s.id === open) || null
  const close = () => {
    setOpen(null)
    setFind('')
  }
  const pick = (setting, value) => {
    if (disabled || value === settingValue(setting, choosing)) return
    onPick(setting, value)
  }

  return (
    <View style={{ gap: space.sm }}>
      <Text accessibilityRole="header" style={{ color: color.silkFaint, fontSize: font.micro, letterSpacing: 1.5 }}>
        {SETTINGS_HEAD}
      </Text>
      {settings.map((s) => {
        const at = settingValue(s, choosing)
        if (settingKind(s) === 'buttons') {
          return (
            <View key={s.id} style={{ gap: space.xs }} accessibilityRole="radiogroup" accessibilityLabel={s.name}>
              <Text style={{ color: color.silkDim, fontSize: font.micro }}>{s.name}</Text>
              <View style={{ flexDirection: 'row', gap: space.xs }}>
                {s.options.map((o) => (
                  <View key={o.value} style={{ flex: 1 }}>
                    <Press
                      label={o.label}
                      height={TAP}
                      tone="signal"
                      on={o.value === at}
                      disabled={disabled}
                      accessibilityLabel={`${s.name}: ${o.label}`}
                      onPress={() => pick(s, o.value)}
                    />
                  </View>
                ))}
              </View>
            </View>
          )
        }
        /* A long list: one button, its name over the choice it is on, which opens the list. */
        return (
          <Press
            key={s.id}
            label={s.name}
            sub={`${choiceSaid(s, at)} ▾`}
            disabled={disabled}
            accessibilityLabel={`${s.name}: ${choiceSaid(s, at)}. Opens a list.`}
            onPress={() => {
              setFind('')
              setOpen(s.id)
            }}
          />
        )
      })}

      <Sheet open={!!shown} onClose={close} title={shown?.name || ''}>
        {shown ? (
          <View style={{ gap: space.sm }}>
            {shown.options.length >= FIND_FROM ? (
              <TextInput
                value={find}
                onChangeText={setFind}
                placeholder="Find one"
                placeholderTextColor={color.silkFaint}
                autoCorrect={false}
                autoCapitalize="none"
                accessibilityLabel={`Find a choice for ${shown.name}`}
                style={{ minHeight: TAP, paddingHorizontal: space.md, borderWidth: 1, borderColor: color.live, borderRadius: radius.md, backgroundColor: color.chassis, color: color.silk, fontSize: font.body }}
              />
            ) : null}
            {choicesFound(shown, find).map((o) => (
              <Press
                key={o.value}
                label={o.label}
                tone="signal"
                on={o.value === settingValue(shown, choosing)}
                onPress={() => {
                  pick(shown, o.value)
                  close()
                }}
              />
            ))}
            {!choicesFound(shown, find).length ? <Note>Nothing named like that.</Note> : null}
          </View>
        ) : null}
      </Sheet>
    </View>
  )
}

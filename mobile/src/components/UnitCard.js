import { useState } from 'react'
import { Image, Pressable, Text, View } from 'react-native'

import { NOT_USING_ONE, SWITCHING, notUsingOneHow } from '../lib/relay-rules'
import { color, font, space } from '../lib/theme'
import { cardCorner, classic } from '../lib/glass'
import { tick } from '../lib/feedback'
import { fire, said } from '../lib/tapped'
import bluetoothIcon from '../../assets/icons/bluetooth.png'

/* The dot before the unit's name, and how far the lines under it sit in, so they line up with the name. */
const DOT = 8
const INDENT = DOT + space.sm
/* "Preset" and "Scene" in one column, so the two values start level. */
const LABEL_WIDTH = 52

/** A theme colour ('#rrggbb') at so much of itself: the green of the card in use, in either palette. */
export function tint(hex, alpha) {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(String(hex || ''))
  if (!m) return hex
  return `rgba(${parseInt(m[1], 16)}, ${parseInt(m[2], 16)}, ${parseInt(m[3], 16)}, ${alpha})`
}

/**
 * ONE COMPUTER UNDER WHICH UNIT, AS A CARD, and the whole card one button
 * (Justin's mockup, 6 November 2026): a dot, the unit's name with the
 * computer it is on beside it, a tag on the right (CONNECTED for the one in
 * use, ONLINE for the others that answered), and under a unit the preset and
 * the scene it is on, when they are known. The words are shared relay-rules
 * unitCards, from unitChoices' own, so Settings, this sheet and the website
 * name a unit the same way.
 *
 * The one in use has no outline of its own: a card a little greener than
 * the rest, a faint green ring, and a soft green glow. The glow is a
 * box-shadow, which Android 9 and older skip without a word (lib/glass), and
 * Classic draws neither the glow nor the green wash (no shadow and no sheen
 * there): the ring, the dot and the tag say it. `busy` is the
 * card tapped while it is switched to: Switching… in place of its tag.
 */
export default function UnitCard({ card, busy = false, disabled = false, onPress }) {
  const lit = card.on
  const glow = lit && !classic()
  const dot = lit ? color.ok : card.plugged ? tint(color.ok, 0.55) : color.silkFaint
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={busy ? `${card.said}, ${SWITCHING}` : card.said}
      accessibilityState={{ selected: lit, disabled, busy }}
      disabled={disabled}
      onPress={() => {
        tick()
        fire(`press ${said(card.label, card.where)}`, onPress)
      }}
      style={({ pressed }) => ({
        borderRadius: cardCorner(),
        borderWidth: 1,
        borderColor: lit ? tint(color.ok, 0.25) : color.rule,
        backgroundColor: color.panel,
        experimental_backgroundImage: glow ? `linear-gradient(180deg, ${tint(color.ok, 0.09)} 0%, ${tint(color.ok, 0.03)} 100%)` : undefined,
        boxShadow: glow ? `0 0 12px ${tint(color.ok, 0.35)}` : undefined,
        paddingHorizontal: space.md,
        paddingVertical: space.md,
        gap: space.xs,
        opacity: disabled && !busy ? 0.45 : pressed ? 0.7 : 1
      })}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
        <View style={{ width: DOT, height: DOT, borderRadius: DOT / 2, backgroundColor: dot }} />
        <Text numberOfLines={2} style={{ flex: 1 }}>
          <Text style={{ color: color.silk, fontSize: 19, fontWeight: '700' }}>{card.label}</Text>
          {card.where ? <Text style={{ color: color.silkDim, fontSize: font.body, fontWeight: '400' }}>{`  ${card.where}`}</Text> : null}
        </Text>
        {busy ? <Text style={{ color: color.silkDim, fontSize: font.micro, fontWeight: '600' }}>{SWITCHING}</Text> : card.tag ? <Tag word={card.tag} lit={lit} /> : null}
      </View>
      {card.note ? <Text style={{ color: color.silkDim, fontSize: font.small, paddingLeft: INDENT }}>{card.note}</Text> : null}
      {card.lines.map((line) => (
        <View key={line.label} style={{ flexDirection: 'row', paddingLeft: INDENT }}>
          <Text style={{ width: LABEL_WIDTH, color: color.silkDim, fontSize: font.small }}>{line.label}</Text>
          <Text numberOfLines={1} style={{ flex: 1, color: color.silk, fontSize: font.small, fontWeight: '600' }}>
            {line.value}
          </Text>
        </View>
      ))}
    </Pressable>
  )
}

/** CONNECTED, ink on the green; ONLINE, green words in a thin green ring. */
function Tag({ word, lit }) {
  return (
    <View
      style={{
        paddingHorizontal: space.sm,
        paddingVertical: 2,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: lit ? color.ok : tint(color.ok, 0.4),
        backgroundColor: lit ? color.ok : 'transparent'
      }}
    >
      <Text style={{ color: lit ? color.onSignal : color.ok, fontSize: font.micro, fontWeight: '700', letterSpacing: 0.8 }}>{word}</Text>
    </View>
  )
}

/**
 * The other way, under the cards: Bluetooth, for whoever is offered its
 * page. A dashed edge, since it is not a computer on this list, and the
 * Bluetooth symbol (icons/bluetooth.png) in Bluetooth's blue (TopBar
 * BluetoothMark says why it is allowed).
 */
export function BluetoothCard({ label, sub, onPress }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[label, sub].filter(Boolean).join(', ')}
      onPress={() => {
        tick()
        fire(`press ${said(label)}`, onPress)
      }}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.md,
        borderRadius: cardCorner(),
        borderWidth: 1,
        borderStyle: 'dashed',
        borderColor: color.rule,
        paddingHorizontal: space.md,
        paddingVertical: space.md,
        opacity: pressed ? 0.7 : 1
      })}
    >
      <Image source={bluetoothIcon} accessible={false} resizeMode="contain" style={{ width: 18, height: 18, tintColor: color.ble }} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ color: color.silk, fontSize: font.body, fontWeight: '600' }}>{label}</Text>
        {sub ? <Text style={{ color: color.silkDim, fontSize: font.small }}>{sub}</Text> : null}
      </View>
    </Pressable>
  )
}

/**
 * How a computer you don't use comes off the list (relay-rules notUsingOne),
 * as a small link: the question, and the rest only when it is tapped. The
 * caller shows it only with two or more computers listed.
 */
export function NotUsingOne() {
  const [shown, setShown] = useState(false)
  return (
    <View style={{ gap: space.xs, paddingHorizontal: space.sm }}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: shown }}
        hitSlop={12}
        onPress={() => fire(`press ${NOT_USING_ONE}`, () => setShown((was) => !was))}
      >
        <Text style={{ color: color.live, fontSize: font.small, fontWeight: '600' }}>{NOT_USING_ONE}</Text>
      </Pressable>
      {shown ? <Text style={{ color: color.silkDim, fontSize: font.small }}>{notUsingOneHow('app')}</Text> : null}
    </View>
  )
}

import { Image, Pressable, Text, View } from 'react-native'

import { color, font, radius, space } from '../lib/theme'
import { at as tint } from '../lib/vivid'
import { tick } from '../lib/feedback'
import Lamp from './Lamp'
import chevronIcon from '../../assets/icons/chevron.png'
import ampIcon from '../../assets/icons/amp.png'
import laptopIcon from '../../assets/icons/laptop.png'
import phoneIcon from '../../assets/icons/phone.png'
/* The adapter's picture is a plain aerial, never the Bluetooth symbol (TopBar.js, BluetoothMark, says why). */
import wirelessIcon from '../../assets/icons/wireless.png'

/*
 * THE CARDS FROM HIS "HERE'S THE APP" MOCKUP, for any screen that wants them.
 *
 * They started inside the walkthrough (screens/Onboarding.js). Phone &
 * computer in Settings uses them too now, so they live here, and the
 * browser draws the same shapes from src/components/Walk.jsx.
 */

/** The amber picture tile a card leads with. */
export function Tile({ icon, size = 64 }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: tint(color.signal, 0.35),
        backgroundColor: tint(color.signal, 0.14),
        alignItems: 'center',
        justifyContent: 'center'
      }}
    >
      <Image source={icon} style={{ width: size * 0.5, height: size * 0.5, tintColor: color.signal }} />
    </View>
  )
}

/**
 * A card: the tile, an amber label, a line under it, and on the right a
 * chevron when it goes somewhere (or whatever `right` is, such as a lamp).
 * `warn` is a short line in red under that, for the one thing to do about it.
 *
 * `onWarn` makes that red line a link. "Change red text about updating
 * computer to a link that shows instructions when tapped on how to update
 * it." The WHOLE card takes the tap, because the line on its own is 20 points
 * tall and a thumb misses it; the line is underlined so it reads as the
 * thing to press. Only while there is a red line: a card without one is not
 * pressable at all, exactly as before. `hint` is what VoiceOver and TalkBack
 * say it does.
 */
export function TipCard({ icon, label, body, warn, onWarn, hint, onPress, right, tile = 64 }) {
  const warnLink = Boolean(warn && onWarn)
  const press = onPress || (warnLink ? onWarn : null)
  return (
    <Pressable
      accessibilityRole={press ? 'button' : undefined}
      accessibilityHint={warnLink ? hint : undefined}
      disabled={!press}
      onPress={
        press
          ? () => {
              tick()
              press()
            }
          : undefined
      }
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.lg,
        padding: space.lg,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: color.rule,
        backgroundColor: pressed ? color.panelHi : color.panel
      })}
    >
      <Tile icon={icon} size={tile} />
      <View style={{ flex: 1, gap: space.xs }}>
        <Text style={{ color: color.signal, fontSize: font.lead, fontWeight: '800', letterSpacing: 1 }}>{label}</Text>
        {body ? <Text style={{ color: color.silkDim, fontSize: font.body + 1, lineHeight: 22 }}>{body}</Text> : null}
        {warn ? <Text style={{ color: color.fault, fontSize: font.body, fontWeight: '700', lineHeight: 20, textDecorationLine: warnLink ? 'underline' : 'none' }}>{warn}</Text> : null}
      </View>
      {right || (onPress ? <Image source={chevronIcon} style={{ width: 16, height: 16, tintColor: color.silkDim }} /> : null)}
    </Pressable>
  )
}

const CHAIN_ICONS = { unit: ampIcon, computer: laptopIcon, adapter: wirelessIcon, phone: phoneIcon }
const LAMP = { good: 'good', busy: 'idle', bad: 'fault', dim: 'idle' }

/**
 * The unit, the computer and the phone — or, over Bluetooth (beta), the
 * adapter in the computer's place — joined by their two wires, each with
 * a lamp. The words come from lib/link-chain (shared/link-chain.mjs), the
 * same ones the browser draws.
 *
 * `onWarn` is what tapping a card's red line does: on Phone & computer it
 * opens the steps for updating the computer app (lib/computer-update). The
 * lamp stays on the right, with no chevron beside it.
 */
export function ChainCards({ cards, onWarn }) {
  return (
    <View>
      {cards.map((card) => (
        <View key={card.key}>
          <TipCard
            icon={CHAIN_ICONS[card.key]}
            tile={52}
            label={card.label}
            body={card.body}
            warn={card.warn}
            onWarn={onWarn}
            hint="Shows how to update the computer app"
            right={<Lamp state={LAMP[card.tone] || 'idle'} size={12} />}
          />
          {card.wire ? <ChainWire label={card.wire} lit={card.lit} /> : null}
        </View>
      ))}
    </View>
  )
}

/** The cable between two cards: lit amber when both ends answer. */
function ChainWire({ label, lit }) {
  const ink = lit ? color.signal : color.rule
  return (
    <View style={{ alignItems: 'center' }}>
      <View style={{ width: 2, height: 10, backgroundColor: ink }} />
      <View
        style={{
          paddingHorizontal: space.md,
          paddingVertical: 3,
          borderRadius: radius.pill,
          borderWidth: 1,
          borderColor: ink,
          backgroundColor: color.chassis
        }}
      >
        <Text style={{ color: lit ? color.signal : color.silkFaint, fontSize: font.micro, letterSpacing: 1.2 }}>{label}</Text>
      </View>
      <View style={{ width: 2, height: 10, backgroundColor: ink }} />
    </View>
  )
}

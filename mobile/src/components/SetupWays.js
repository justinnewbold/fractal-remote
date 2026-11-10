import { Linking, Text, View } from 'react-native'

import { color, font, space } from '../lib/theme'
import { deviceNoun } from '../lib/device-word'
import {
  CONNECT_ASK,
  PI_BUY,
  PI_BUY_URL,
  PI_GUIDE,
  PI_GUIDE_URL,
  PI_TRADEMARK,
  PI_TROUBLE_TITLE,
  connectWays,
  piLead,
  piSteps,
  piTrouble
} from '../lib/setupWays'
import { TipCard } from './Walk'
import Press from './Press'
import { Step } from '../screens/Connect'
import bluetoothIcon from '../../assets/icons/bluetooth.png'
import usbIcon from '../../assets/icons/usb.png'
import laptopIcon from '../../assets/icons/laptop.png'
import boardIcon from '../../assets/icons/board.png'

/*
 * Settings → My rig → Connect your unit, and the Raspberry Pi page it opens
 * (the words, and why, are lib/setupWays). Settings draws each page's head;
 * these draw what is under it.
 */

/* Plain drawings, never a maker's logo: the Bluetooth symbol (allowed, CLAUDE.md), a USB plug, a laptop, a bare board. */
const ICONS = { adapter: bluetoothIcon, cable: usbIcon, computer: laptopIcon, pi: boardIcon }

/* Built when drawn, never at load, so it follows the look chosen in Settings. */
const lead = () => ({ color: color.silkDim, fontSize: font.body, lineHeight: 21 })

/**
 * The four ways, Bluetooth first. `open` is what each card does, by its key;
 * a way with nothing to open is not drawn (the adapter and the cable where
 * this copy does not offer Bluetooth).
 */
export function ConnectWays({ open = {} }) {
  const ways = connectWays(deviceNoun()).filter((w) => typeof open[w.key] === 'function')
  return (
    <View style={{ gap: space.md }}>
      <Text style={{ color: color.silk, fontSize: font.lead, fontWeight: '600' }}>{CONNECT_ASK}</Text>
      {ways.map((w) => (
        <TipCard key={w.key} icon={ICONS[w.key]} tile={52} label={w.title} body={w.sub} onPress={open[w.key]} />
      ))}
    </View>
  )
}

/** The Raspberry Pi: four steps, the guide, and the three things that go wrong most. */
export function PiSetup() {
  const noun = deviceNoun()
  return (
    <View style={{ gap: space.xl }}>
      <Text style={lead()}>{piLead(noun)}</Text>
      {piSteps(noun).map((step, i) => (
        <Step key={step.title} n={i + 1} title={step.title}>
          <Text style={lead()}>{step.body}</Text>
          {i === 0 ? <Press label={PI_BUY} onPress={() => Linking.openURL(PI_BUY_URL)} /> : null}
        </Step>
      ))}
      <Press label={PI_GUIDE} tone="signal" onPress={() => Linking.openURL(PI_GUIDE_URL)} />
      <View style={{ gap: space.md }}>
        <Text accessibilityRole="header" style={{ color: color.silk, fontSize: font.lead, fontWeight: '700' }}>
          {PI_TROUBLE_TITLE}
        </Text>
        {piTrouble(noun).map((t) => (
          <View key={t.problem} style={{ gap: 2 }}>
            <Text style={{ color: color.silk, fontSize: font.body, fontWeight: '600' }}>{t.problem}</Text>
            <Text style={lead()}>{t.fix}</Text>
          </View>
        ))}
      </View>
      <Text style={{ color: color.silkFaint, fontSize: font.micro, lineHeight: 18 }}>{PI_TRADEMARK}</Text>
    </View>
  )
}

import { ScrollView, Text, View } from 'react-native'

import { HOW_CONNECT } from '../lib/bluetooth-gear'
import { color, font, radius, space, TAP } from '../lib/theme'
import Press from './Press'
import bluetoothIcon from '../../assets/icons/bluetooth.png'

/**
 * "HOW DO YOU CONNECT TO YOUR UNIT?", once, in Play's place, straight after
 * an account is made, a trial started or the full version bought on a copy
 * that offers Bluetooth (App.js askHow, lib/howConnect).
 *
 * "Make sure that it's simple, quick and easy for people to sign up, and it's
 * crystal clear how to get started quickly using Bluetooth or a computer. I
 * think most people are gonna opt for Bluetooth, probably 90%. So we need to
 * make that the most prominent thing ... It says no Bluetooth connects
 * through a computer instead." (Justin, 7 November 2026.)
 *
 * So: the question, a big blue Bluetooth adapter, the one the Bluetooth
 * page's own Connect wears (its symbol, its blue, its height), and under it
 * his words for the other way. Nothing to read: what to buy, the FM3's
 * warning and what each way does are on the Bluetooth page, where the
 * adapter is chosen. Neither button touches the phone's Bluetooth: the first
 * opens the Bluetooth page (App's own gate, bluetoothOffered), whose Connect
 * is the first thing that asks, and the second goes on to Finding your
 * computer…, as the app did before this card.
 */
export default function HowConnect({ onBluetooth, onComputer }) {
  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1, padding: space.xl }}>
      {/* Centred by a view that grows with the card, as the sharing card is, so a tall card scrolls rather than being cut. */}
      <View style={{ flexGrow: 1, justifyContent: 'center' }}>
        {/* The sharing card's own panel as Classic draws it, in both looks: a card new since the glass has no Classic of its own to be held to (test/glass-classic.mjs). */}
        <View
          accessibilityViewIsModal
          style={{
            gap: space.lg,
            padding: space.xl,
            borderRadius: radius.lg,
            borderWidth: 1,
            borderColor: color.rule,
            backgroundColor: color.panel
          }}
        >
          <Text accessibilityRole="header" style={{ color: color.silk, fontSize: font.title, fontWeight: '800' }}>
            {HOW_CONNECT.head}
          </Text>
          <Press
            label={HOW_CONNECT.bluetooth}
            sub={HOW_CONNECT.bluetoothSub}
            icon={bluetoothIcon}
            inkColor={color.ble}
            labelSize={font.lead}
            height={88}
            tone="live"
            onPress={onBluetooth}
          />
          <Press label={HOW_CONNECT.computer} sub={HOW_CONNECT.computerSub} height={TAP + 8} onPress={onComputer} />
        </View>
      </View>
    </ScrollView>
  )
}

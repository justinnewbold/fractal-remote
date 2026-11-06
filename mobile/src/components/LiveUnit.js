import { useEffect, useState } from 'react'
import { View } from 'react-native'

import { readOthersPlaying, unitCards } from '../lib/relay'
import { askUnknownUnits, chooseHost, forgetMissing } from '../lib/link'
import { playingOf } from '../lib/relay-rules'
import { useRig } from '../lib/rig'
import { space } from '../lib/theme'
import Sheet from './Sheet'
import MissingPick from './MissingPick'
import UnitCard, { BluetoothCard, NotUsingOne } from './UnitCard'

const ofPreset = (s) => s.preset
const ofScene = (s) => s.sceneIndex
const ofSceneNames = (s) => s.sceneNames
const ofUnit = (s) => s.unit

/**
 * Which unit, one tap from the name in the corner, when more than one is on.
 *
 * "Can we make it a quick switch by making it so if they are live they can
 * click the unit name in the top left to pull up the switch like it does on
 * the demo version?" The demo's five units have been a sheet off that name
 * for a while (DemoUnit); this is the same thing for real ones — an AM4 on one
 * computer and an FM3 on another, both on this account.
 *
 * One card per computer since 6 November 2026 (UnitCard, Justin's mockup):
 * the unit and the computer it is on, CONNECTED or ONLINE, and the preset and
 * scene each unit is on. The one in use is what Play shows; the others are
 * asked once, when the sheet opens, with two reads (relay.js
 * readOthersPlaying), never a write. The same words as Settings → Phone &
 * computer → Which unit (unitCards over unitChoices), so the two can never
 * name a unit differently. Closed once the new unit has been read: the
 * screen behind it is now a different rig, which is the thing worth looking
 * at.
 */
export default function LiveUnit({ open, onClose, hosts = [], units = {}, chosen = null, missing = null, asking = false, onBluetooth = null }) {
  const [busy, setBusy] = useState(null)
  const [others, setOthers] = useState({})
  const preset = useRig(ofPreset)
  const sceneIndex = useRig(ofScene)
  const sceneNames = useRig(ofSceneNames)
  const unit = useRig(ofUnit)
  /* Opened: a computer that has not said its unit is asked again, with longer (link.js askUnknownUnits). */
  useEffect(() => {
    if (open) askUnknownUnits()
  }, [open])
  /* And what the other computers' units are on, once per opening: reads only. */
  useEffect(() => {
    if (!open) return undefined
    let gone = false
    setOthers({})
    readOthersPlaying()
      .then((found) => {
        if (!gone) setOthers(found || {})
      })
      .catch(() => {})
    return () => {
      gone = true
    }
  }, [open])
  /* What the one in use is on: Play's own reads, and only while its unit answers. */
  const here = unit === 'present' ? playingOf(preset, sceneIndex, sceneNames) : null

  return (
    <Sheet open={open} onClose={onClose} title="Which unit" note="Tap one to switch">
      <View style={{ gap: space.md }}>
        {unitCards(hosts, units, chosen, asking, { here, others }).map((card) => (
          <UnitCard
            key={card.key}
            card={card}
            busy={busy === card.name}
            disabled={busy !== null}
            onPress={async () => {
              setBusy(card.name)
              try {
                await chooseHost(card.name)
              } finally {
                setBusy(null)
              }
              onClose()
            }}
          />
        ))}
        {/* The other way, from the Live pill too (Justin, 26 October 2026): for whoever is offered the Bluetooth page. */}
        {onBluetooth ? <BluetoothCard label="Connect over Bluetooth" sub="No computer needed. More lag, fewer features." onPress={onBluetooth} /> : null}
        {/* The pick that does not answer, grayed, with Forget. */}
        <MissingPick name={missing} onForget={() => forgetMissing()} />
        {/* How one you don't use comes off this list: at that computer (relay-rules notUsingOne), a link that opens to the words. Only with two or more listed, as in Settings. */}
        {hosts.length > 1 ? <NotUsingOne /> : null}
      </View>
    </Sheet>
  )
}

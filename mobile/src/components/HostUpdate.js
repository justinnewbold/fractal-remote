import { useState, useSyncExternalStore } from 'react'
import { Alert, View } from 'react-native'

import { computerUpdateWords, confirmWords, factsAt, hostCardLine, notAskedWords, runSays, sameNameTwice, stillSo } from '../lib/hostUpdate'
import { updateNow, useComputerUpdate, useHostFacts, useUpdateRun, whyNotNow } from '../lib/hostUpdateHere'
import { linkState, subscribeLink } from '../lib/link'
import { remoteHosts } from '../lib/relay'
import { space } from '../lib/theme'
import Note from './Note'
import Press from './Press'

/**
 * THE COMPUTER APP'S OWN UPDATE, under the computer's card on Phone &
 * computer: how it is going, as the computer says it (lib/hostUpdate
 * computerUpdateWords), and Update now when a Raspberry Pi has one ready.
 *
 * His account only until features COMPUTER_UPDATE_FOR_EVERYONE: for every
 * other account this draws nothing at all. Never over Bluetooth or in the
 * demo, where there is no computer to update. The tap asks the rules again
 * (two computers by this name, something still being sent), then asks the
 * person, then writes (lib/hostUpdateHere updateNow).
 */
export default function HostUpdate({ demo = false, throughAdapter = false, onOpenUpdating = null }) {
  const on = useComputerUpdate()
  const s = useSyncExternalStore(subscribeLink, linkState, linkState)
  const run = useUpdateRun()
  /* Why the last tap was not asked ({ text, at }), said only while the computer it was about is still as it was (hostUpdate stillSo). */
  const [notAsked, setNotAsked] = useState(null)
  if (!on || demo || throughAdapter || s.link !== 'connected' || !s.macName) return null
  const name = s.macName
  const words = computerUpdateWords({ name, version: s.hostVersion, os: s.hostOs, update: s.hostUpdate, ...runSays(run, s) })
  const said = notAsked && stillSo(notAsked.at, s) ? notAsked.text : null
  const twice = words.button && sameNameTwice(remoteHosts(), name)
  /* One Update now at a time, for any computer: no button while one is out. */
  const offer = words.button && !twice && !run.phase
  const tap = async () => {
    setNotAsked(null)
    const why = await whyNotNow(name)
    if (why) {
      setNotAsked({ text: notAskedWords(why, name), at: factsAt(linkState()) })
      return
    }
    const ask = confirmWords(name)
    Alert.alert(ask.title, ask.body, [
      { text: ask.no, style: 'cancel' },
      { text: ask.yes, onPress: () => updateNow(name) }
    ])
  }
  if (!words.line && !said) return null
  return (
    <View style={{ gap: space.sm }}>
      {words.line ? <Note tone={words.tone}>{words.line}</Note> : null}
      {words.link === 'updating' && onOpenUpdating ? <Press label="How to update it" height={44} onPress={onOpenUpdating} /> : null}
      {twice ? <Note tone="warn">{notAskedWords('clash', name)}</Note> : null}
      {offer ? <Press label="Update now" tone="live" height={48} onPress={tap} /> : null}
      {said ? <Note tone="warn">{said}</Note> : null}
    </View>
  )
}

/**
 * Under a computer's card in Which unit, read only: its version and how its
 * update is going (lib/hostUpdate hostCardLine), from what it said in the
 * roll call, or from the fresher read for the one driven. A phone writes only
 * to the computer it drives, so a card not driven that has Update now on
 * offer adds "Pick it to update it." His account only, like the rest.
 */
export function HostCardLine({ name, driven = false }) {
  const on = useComputerUpdate()
  const s = useSyncExternalStore(subscribeLink, linkState, linkState)
  const facts = useHostFacts(on)
  if (!on || !name) return null
  const fresh = driven && s.macName === name && s.link === 'connected'
  const fact = fresh ? { name, version: s.hostVersion, os: s.hostOs, update: s.hostUpdate } : facts.find((f) => f.name === name)
  const line = hostCardLine(fact, { driven, twice: sameNameTwice(remoteHosts(), name) })
  return line ? <Note>{line}</Note> : null
}

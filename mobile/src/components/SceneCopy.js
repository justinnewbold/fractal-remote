import { useState } from 'react'
import { Alert, Text, View } from 'react-native'
import { color, font, space } from '../lib/theme'
import { refreshSceneState, useRig, writeBypass, writeChannel, writeScene } from '../lib/rig'
import { sceneState } from '../lib/device'
import { copyScene } from '../lib/copy-tools'
import Note from './Note'
import Press from './Press'

/**
 * COPY A SCENE ONTO ANOTHER — the browser's SceneCopy, on the phone. Every
 * block's on/off and channel go across (lib/copy-tools, the same copy the
 * browser runs); the name does not. The unit is left on the scene copied to.
 * Asked first, because the other scene's switches go.
 */
export default function SceneCopy({ count = 8 }) {
  const scene = useRig((st) => st.sceneIndex)
  const names = useRig((st) => st.sceneNames) || []
  const here = Number.isInteger(scene) ? scene : 0
  const [from, setFrom] = useState(null)
  const [working, setWorking] = useState(false)
  const [said, setSaid] = useState(null)
  const source = from ?? here
  const label = (i) => `${i + 1}${names[i] ? ` ${names[i]}` : ''}`

  const run = async (to) => {
    setWorking(true)
    setSaid(null)
    try {
      const res = await copyScene({ from: source, to, wire: { setScene: writeScene, sceneState, setBypass: writeBypass, setChannel: writeChannel } })
      await refreshSceneState()
      setSaid(
        res.ok
          ? { bad: false, text: `Scene ${source + 1} copied onto scene ${to + 1} — ${res.changed} change${res.changed === 1 ? '' : 's'}. Tap Save to keep it.` }
          : { bad: true, text: `Copying stopped: ${res.error}` }
      )
    } catch (err) {
      setSaid({ bad: true, text: err?.message || String(err) })
    } finally {
      setWorking(false)
    }
  }
  const ask = (to) =>
    Alert.alert(
      `Copy scene ${source + 1} onto scene ${to + 1}?`,
      `Every block in scene ${to + 1} takes scene ${source + 1}’s on/off and channel. Its name stays.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Copy it', onPress: () => run(to) }
      ]
    )

  return (
    <View style={{ gap: space.sm }}>
      <Text style={{ color: color.silkDim, fontSize: font.micro, letterSpacing: 1.5, fontWeight: '700' }}>COPY A SCENE</Text>
      <Text style={{ color: color.silkDim, fontSize: font.small }}>Copy from</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
        {Array.from({ length: count }, (_, i) => (
          <Press key={i} label={label(i)} height={44} tone="signal" on={i === source} disabled={working} onPress={() => setFrom(i)} />
        ))}
      </View>
      <Text style={{ color: color.silkDim, fontSize: font.small }}>Onto</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
        {Array.from({ length: count }, (_, i) =>
          i === source ? null : <Press key={i} label={label(i)} height={44} disabled={working} onPress={() => ask(i)} />
        )}
      </View>
      {working ? <Note>Copying…</Note> : null}
      {said ? <Note tone={said.bad ? 'warn' : undefined}>{said.text}</Note> : null}
    </View>
  )
}

import { useState } from 'react'
import { Alert, Text, View } from 'react-native'

import { color, font, radius, space } from '../lib/theme'
import { useRig } from '../lib/rig'
import {
  addStarterHere,
  defaultStarterHere,
  moveStarterHere,
  paletteKeptHere,
  removeStarterHere,
  renameStarterHere,
  replaceStarterHere,
  roomForStarterHere,
  useStarterChains
} from '../lib/starterChainsHere'
import {
  CANCEL_BUTTON,
  COMES_WITH_APP,
  DEFAULT_BADGE,
  EDIT_STARTER,
  KEEP_BUTTON,
  MAKE_DEFAULT,
  MOVE_DOWN,
  MOVE_UP,
  NAME_NEEDED,
  NEW_STARTER,
  NO_PICKS,
  REMOVE_ASK_SUB,
  REMOVE_STARTER,
  STARTERS_FULL,
  STARTER_BLOCKS_MAX,
  BLOCKS_CAP_LINE,
  builtInPalette,
  cleanStarterName,
  removeAsk,
  startersLine
} from '../lib/starter-chains'
import { Badge, ChainPicker, ChainStrip, NameRow } from './QuickBuild'
import Press from './Press'
import Sheet from './Sheet'

/*
 * SETTINGS → STARTER CHAINS (mock-up 4; shared/starter-chains.mjs has the
 * rules). Every chain this unit offers on an empty preset: the default
 * first with its badge, the one that comes with the app ("Classic rig",
 * which can stop being the default but is never changed or taken out), and
 * the player's own, each with Edit and Remove as two labelled buttons, Make
 * this the default, and Move up and Move down (buttons, never a drag, as
 * the watch's pages are ordered: components/WatchPageOrder).
 *
 * NEW AND EDIT OPEN QUICK BUILD'S PICKER with a name box and Keep in place
 * of Build: nothing is sent to a unit from here. With no unit linked, the
 * picker offers the unit's own blocks as last read on this device, or a
 * plain list of every family (builtInPalette), so a chain can be written
 * down on the couch.
 */

const ofDeviceName = (s) => s.deviceName

export default function StarterChains() {
  const list = useStarterChains()
  const unit = useRig(ofDeviceName)
  /* The chain being made or changed: { id (null for a new one), name, blocks }. */
  const [making, setMaking] = useState(null)
  const [problem, setProblem] = useState(null)
  const palette = paletteKeptHere() || builtInPalette()
  const room = roomForStarterHere()
  /* The chains under the default, which are the ones that move. */
  const movable = list.filter((c) => !c.isDefault)

  const start = (chain) => {
    setProblem(null)
    setMaking(chain ? { id: chain.id, name: chain.name, blocks: [...chain.blocks] } : { id: null, name: '', blocks: [] })
  }

  const keep = () => {
    if (!making) return
    if (!cleanStarterName(making.name)) return setProblem(NAME_NEEDED)
    if (!making.blocks.length) return setProblem(NO_PICKS)
    const r = making.id
      ? (() => {
          const a = renameStarterHere(making.id, making.name)
          return a.ok ? replaceStarterHere(making.id, making.blocks) : a
        })()
      : addStarterHere({ name: making.name, blocks: making.blocks })
    if (!r.ok) return setProblem(r.why || NAME_NEEDED)
    setMaking(null)
  }

  const remove = (chain) =>
    Alert.alert(removeAsk(chain.name), REMOVE_ASK_SUB, [
      { text: CANCEL_BUTTON, style: 'cancel' },
      { text: REMOVE_STARTER, style: 'destructive', onPress: () => removeStarterHere(chain.id) }
    ])

  return (
    <View style={{ gap: space.md }}>
      <Text style={{ color: color.silkDim, fontSize: font.body }}>{startersLine(unit)}</Text>
      {list.map((c) => {
        const at = movable.indexOf(c)
        return (
          <View key={c.id} style={{ gap: space.sm, padding: space.md, borderRadius: radius.md, borderWidth: 1, borderColor: color.rule, backgroundColor: color.panel }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm }}>
              <Text style={{ color: color.silk, fontSize: font.lead, fontWeight: '700', flexShrink: 1 }}>{c.name}</Text>
              {c.isDefault ? <Badge>{DEFAULT_BADGE}</Badge> : null}
            </View>
            <ChainStrip blocks={c.blocks} />
            {c.builtIn ? <Text style={{ color: color.silkDim, fontSize: font.small }}>{COMES_WITH_APP}</Text> : null}
            {c.builtIn ? null : (
              <View style={{ flexDirection: 'row', gap: space.sm }}>
                <Press grow height={44} label={EDIT_STARTER} accessibilityLabel={`${EDIT_STARTER} ${c.name}`} onPress={() => start(c)} />
                <Press grow height={44} label={REMOVE_STARTER} accessibilityLabel={`${REMOVE_STARTER} ${c.name}`} onPress={() => remove(c)} />
              </View>
            )}
            {c.isDefault ? null : <Press height={44} label={MAKE_DEFAULT} accessibilityLabel={`Make ${c.name} the default`} onPress={() => defaultStarterHere(c.id)} />}
            {c.isDefault || movable.length < 2 ? null : (
              <View style={{ flexDirection: 'row', gap: space.sm }}>
                <Press grow height={44} label={MOVE_UP} accessibilityLabel={`Move ${c.name} up`} disabled={at <= 0} onPress={() => moveStarterHere(c.id, -1)} />
                <Press grow height={44} label={MOVE_DOWN} accessibilityLabel={`Move ${c.name} down`} disabled={at >= movable.length - 1} onPress={() => moveStarterHere(c.id, 1)} />
              </View>
            )}
          </View>
        )
      })}
      {room ? <Press label={NEW_STARTER} tone="signal" on onPress={() => start(null)} /> : <Text style={{ color: color.silkDim, fontSize: font.small }}>{STARTERS_FULL}</Text>}

      <Sheet
        open={!!making}
        onClose={() => setMaking(null)}
        title={making?.id ? making.name || EDIT_STARTER : NEW_STARTER}
        tall
        foot={
          making ? (
            <NameRow
              name={making.name}
              onName={(name) => setMaking((m) => (m ? { ...m, name } : m))}
              onKeep={keep}
              onCancel={() => setMaking(null)}
              keepLabel={KEEP_BUTTON}
              problem={problem}
            />
          ) : null
        }
      >
        {making ? <ChainPicker palette={palette} picks={making.blocks} room={STARTER_BLOCKS_MAX} fullLine={BLOCKS_CAP_LINE} onPicks={(blocks) => setMaking((m) => (m ? { ...m, blocks } : m))} /> : null}
      </Sheet>
    </View>
  )
}

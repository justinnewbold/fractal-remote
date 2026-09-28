import { useCallback, useRef, useState } from 'react'
import { FlatList, Modal, Pressable, Text, TextInput, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { color, font, radius, space, TAP } from '../lib/theme'
import { slotCount, slotLabel } from '../lib/device'
import { jumpsFor } from '../lib/presetJumps'
import { knownCount, nameOf, useNames, wantOnly } from '../lib/presetNames'
import { pickMatches, togglePick } from '../lib/lists'
import { useRig } from '../lib/rig'
import { tick } from '../lib/feedback'
import Note from './Note'
import Press from './Press'

const ofCaps = (s) => s.capabilities

/* Fixed rows, for the same reason as the Presets list: a list of five hundred
   slots is jumped around by arithmetic, not by measuring. */
const ROW = TAP
const GAP = 8
const STRIDE = ROW + GAP

/**
 * ADD SONGS: EVERY PRESET, TICK AS MANY AS YOU LIKE, ONE BUTTON TO ADD THEM.
 *
 * "Can we make it easier to add songs to a setlist, kind of like how they go
 * through and hit favorites where it pulls up all of the presets and they can
 * just go through and select a bunch and then select done to create their
 * setlist? Right now it looks like the only way is to search for them."
 *
 * The same list as Presets — every slot, the jumps along the top, names
 * filling in as you scroll — with a tick where the star is. Tapping a row
 * ticks it rather than loading it: building a setlist between songs must not
 * change what comes out of the amp. The tick shows the order it will go in,
 * and Add puts them all at the end of the setlist in that order.
 *
 * Songs already in the setlist say so and cannot be ticked again; a setlist
 * holds a preset once.
 */
export default function SongPicker({ open, listName, already = [], onAdd, onClose }) {
  const caps = useRig(ofCaps)
  const slots = slotCount(caps)
  const addressing = caps?.presets?.addressing

  useNames()

  const [picked, setPicked] = useState([])
  const [query, setQuery] = useState('')

  const close = () => {
    setPicked([])
    setQuery('')
    onClose?.()
  }

  const add = () => {
    onAdd?.(picked)
    close()
  }

  const rows = Array.from({ length: slots || 0 }, (_, i) => i)
  const hunting = query.trim().length > 0
  const shown = hunting ? rows.filter((n) => pickMatches(query, n, nameOf(n), slotLabel(n, addressing))) : rows

  const seen = useCallback(({ viewableItems }) => {
    wantOnly(viewableItems.map((v) => v.item).filter((n) => typeof n === 'number'))
  }, [])
  const viewability = useRef({ itemVisiblePercentThreshold: 10 }).current

  const list = useRef(null)
  const jumps = jumpsFor(slots)
  const jumpTo = (n) => {
    try {
      list.current?.scrollToIndex({ index: Math.min(n, (slots || 1) - 1), viewPosition: 0, animated: true })
    } catch {
      /* Only while the list is still measuring; the next tap works. */
    }
  }

  const count = picked.length

  return (
    <Modal visible={!!open} animationType="slide" onRequestClose={close} presentationStyle="fullScreen">
      <SafeAreaView style={{ flex: 1, backgroundColor: color.chassis }} edges={['top', 'bottom']}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg, paddingBottom: space.sm }}>
          <View style={{ flex: 1 }}>
            <Text accessibilityRole="header" style={{ color: color.silk, fontSize: font.title, fontWeight: '700' }}>
              Add songs
            </Text>
            {listName ? (
              <Text numberOfLines={1} style={{ color: color.silkDim, fontSize: font.small }}>
                {`to ${listName}`}
              </Text>
            ) : null}
          </View>
          <Press label="Cancel" height={40} onPress={close} />
        </View>

        <View style={{ paddingHorizontal: space.lg, paddingBottom: space.sm, gap: space.sm }}>
          <Text style={{ color: color.silkDim, fontSize: font.small }}>
            Tap each preset you want. They go in the order you tap them.
          </Text>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Find by name or number"
            placeholderTextColor={color.silkFaint}
            autoCorrect={false}
            autoCapitalize="none"
            style={{
              minHeight: TAP,
              paddingHorizontal: space.md,
              borderRadius: radius.md,
              borderWidth: 1,
              borderColor: color.rule,
              backgroundColor: color.panel,
              color: color.silk,
              fontSize: font.body
            }}
          />
          {jumps.length && !hunting ? (
            <View accessibilityRole="toolbar" accessibilityLabel="Jump to a range" style={{ flexDirection: 'row', gap: space.sm }}>
              {jumps.map((n) => (
                <Press key={n} grow label={String(n)} height={44} onPress={() => jumpTo(n)} />
              ))}
            </View>
          ) : null}
          {slots && knownCount() < slots ? (
            <Text style={{ color: color.silkFaint, fontSize: font.micro }}>
              {`${knownCount()} of ${slots} names known · the rest fill in as you scroll`}
            </Text>
          ) : null}
        </View>

        <FlatList
          ref={list}
          data={shown}
          keyExtractor={(n) => String(n)}
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: space.lg }}
          keyboardShouldPersistTaps="handled"
          initialNumToRender={20}
          windowSize={5}
          onViewableItemsChanged={seen}
          viewabilityConfig={viewability}
          getItemLayout={(_, i) => ({ length: STRIDE, offset: STRIDE * i, index: i })}
          onScrollToIndexFailed={() => {}}
          renderItem={({ item: n }) => {
            const name = nameOf(n)
            const inList = already.includes(n)
            const at = picked.indexOf(n)
            return (
              <Row
                name={typeof name === 'string' ? name || 'Empty' : `Slot ${slotLabel(n, addressing)}`}
                slot={slotLabel(n, addressing)}
                inList={inList}
                order={at >= 0 ? at + 1 : 0}
                onPress={() => {
                  tick()
                  setPicked((was) => togglePick(was, n))
                }}
              />
            )
          }}
          ListEmptyComponent={
            <Note>
              {slots
                ? 'Nothing matches that.'
                : 'The list of presets appears once the app has reached your unit, or in the demo.'}
            </Note>
          }
        />

        <View style={{ padding: space.lg, paddingTop: space.sm, borderTopWidth: 1, borderTopColor: color.rule }}>
          <Press
            label={count ? `Add ${count} song${count === 1 ? '' : 's'}` : 'Tap presets to pick them'}
            tone="signal"
            on={count > 0}
            height={TAP}
            disabled={!count}
            onPress={add}
          />
        </View>
      </SafeAreaView>
    </Modal>
  )
}

/**
 * One slot: its name and number, and on the right the tick — the order it
 * will go in, or "In it" for one already in the setlist.
 */
function Row({ name, slot, inList, order, onPress }) {
  const on = order > 0
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: on, disabled: inList }}
      accessibilityLabel={inList ? `${name}, already in this setlist` : name}
      disabled={inList}
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.md,
        height: ROW,
        marginBottom: GAP,
        paddingHorizontal: space.md,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: on ? color.signal : color.rule,
        backgroundColor: color.panel,
        opacity: inList ? 0.5 : pressed ? 0.7 : 1
      })}
    >
      <View style={{ flex: 1 }}>
        <Text numberOfLines={1} style={{ color: color.silk, fontSize: font.body, fontWeight: '600' }}>
          {name}
        </Text>
        <Text numberOfLines={1} style={{ color: color.silkDim, fontSize: font.micro }}>
          {inList ? `${slot} · already in this setlist` : slot}
        </Text>
      </View>
      <View
        style={{
          minWidth: 32,
          height: 32,
          paddingHorizontal: space.xs,
          borderRadius: 16,
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: 1,
          borderColor: on ? color.signal : color.rule,
          backgroundColor: on ? color.signal : 'transparent'
        }}
      >
        <Text style={{ color: on ? color.chassis : color.silkFaint, fontSize: font.small, fontWeight: '700' }}>
          {inList ? '✓' : on ? String(order) : ''}
        </Text>
      </View>
    </Pressable>
  )
}

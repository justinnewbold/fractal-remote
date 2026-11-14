/*
 * TONE3000'S LIST, DRAWN IN THE APP.
 *
 * "It to look like that and function like that. Not just going off a
 * built-in web browser in our app but actually native in our app using the
 * API." (Justin, 14 November 2026, with a picture of the Tones tab of his
 * HeadRush app.) So this is that tab's own layout (headrush
 * mobile/src/t3k.tsx): a search box and a Search button, one row of chips
 * that slides sideways (the order first, then the kind of gear), and a row
 * for each tone with its picture, its name, a small line under it and a
 * chevron; More under the last of them. A tap on a tone hands it to
 * whoever drew this (`onOpen`), which shows its captures.
 *
 * What it asks, and when, is lib/tone3000Browse's, which a test runs: never
 * on a keystroke, only when it opens, on Search, on a chip, and for More.
 *
 * WHAT EACH ROW SHOWS IS TONE3000'S OWN RULE for a list of its tones in
 * somebody else's app (its Design Requirements, tone3000.com/api, "Tone
 * list views"): the tone's picture, its title, the kind of gear, the format
 * (NAM), and who made it, by name and picture. The HeadRush tab's line is
 * the same with the downloads on the end, which is kept.
 *
 * The list is handed in by whoever draws this (`list`, lib/tone3000Browse's),
 * so opening a tone and coming back shows it as it was left, without asking
 * TONE3000's search again. It lives while that card is up and no longer
 * (their terms: nothing kept). The pictures are TONE3000's own addresses,
 * asked for by the phone when a row is drawn.
 */
import { useEffect, useState, useSyncExternalStore } from 'react'
import { Image, Pressable, Text, TextInput, View } from 'react-native'

import { color, font, radius, space, TAP } from '../lib/theme'
import { tick } from '../lib/feedback'
import { T3K_GEARS, T3K_SORTS } from '../lib/tone3000'
import { ASKING, creatorImage, creatorOf, NO_TONES, nothingFound, toneImage, toneLine } from '../lib/tone3000Browse'
import Avatar from './Avatar'
import Note from './Note'
import Press from './Press'
import SideScroll from './SideScroll'

export const SEARCH_BOX = 'Search TONE3000'
export const SEARCH_BUTTON = 'Search'
export const MORE = 'More'

/**
 * A chip: lit the app's amber when it is the one chosen, as a chosen song is
 * in the setlist picker. Plain colours, the same in both looks, as the
 * capture picker's box and rows are.
 */
function Chip({ label, on, disabled, onPress }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: on, disabled }}
      accessibilityLabel={label}
      disabled={disabled}
      hitSlop={6}
      onPress={() => {
        tick()
        onPress()
      }}
      style={({ pressed }) => ({
        height: 40,
        paddingHorizontal: space.lg,
        borderRadius: 20,
        borderWidth: 1,
        justifyContent: 'center',
        backgroundColor: on ? color.signal : pressed ? color.panelHi : color.panel,
        borderColor: on ? color.signal : color.rule,
        opacity: disabled ? 0.6 : 1
      })}
    >
      <Text style={{ color: on ? color.onSignal : color.silk, fontSize: font.small, fontWeight: '700' }}>{label}</Text>
    </Pressable>
  )
}

/** A tone's picture, or a plain square where it has none or it will not load. */
function Picture({ uri, size }) {
  const [broken, setBroken] = useState(false)
  const box = { width: size, height: size, borderRadius: radius.sm + 2, backgroundColor: color.panelHi }
  if (!uri || broken) return <View accessible={false} style={box} />
  return <Image source={{ uri }} accessible={false} resizeMode="cover" onError={() => setBroken(true)} style={box} />
}

/** One tone in the list. */
export function ToneRow({ tone, disabled, onPress }) {
  const title = tone?.title || 'Untitled tone'
  const line = toneLine(tone)
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${line}`}
      disabled={disabled}
      onPress={() => {
        tick()
        onPress()
      }}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.md,
        minHeight: TAP + 4,
        paddingVertical: space.xs + 2,
        paddingHorizontal: space.xs,
        borderRadius: radius.md,
        backgroundColor: pressed ? color.panelHi : 'transparent',
        opacity: disabled ? 0.6 : 1
      })}
    >
      <Picture uri={toneImage(tone)} size={44} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text numberOfLines={1} style={{ color: color.silk, fontSize: font.body + 1, fontWeight: '700' }}>
          {title}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
          {creatorOf(tone) ? <Avatar uri={creatorImage(tone)} size={14} /> : null}
          <Text numberOfLines={1} style={{ flex: 1, color: color.silkDim, fontSize: font.small - 1 }}>
            {line}
          </Text>
        </View>
      </View>
      <Text style={{ color: color.silkFaint, fontSize: font.lead }}>›</Text>
    </Pressable>
  )
}

/**
 * `list` is lib/tone3000Browse's `toneBrowser`; `onOpen(tone)` when a tone
 * is tapped; `disabled` while whoever drew this is busy with something of
 * its own (TONE3000's page opening).
 */
export default function Tone3000Browser({ list, onOpen, disabled = false }) {
  const now = useSyncExternalStore(list.subscribe, list.get, list.get)
  /* The box opens on what the list was last asked for: back from a tone, it says what the rows under it are. */
  const [typed, setTyped] = useState(() => list.get().query)

  /* The first list, once, when it opens. */
  useEffect(() => {
    list.start()
  }, [list])

  const find = () => list.find(typed)
  const asking = now.busy === 'list'

  return (
    <View style={{ gap: space.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'stretch', gap: space.sm }}>
        <TextInput
          value={typed}
          /* Typing only fills the box: TONE3000 is asked when Search is tapped (or the keyboard's own search key), never on a keystroke. */
          onChangeText={setTyped}
          onSubmitEditing={find}
          returnKeyType="search"
          placeholder={SEARCH_BOX}
          placeholderTextColor={color.silkFaint}
          autoCorrect={false}
          autoCapitalize="none"
          accessibilityLabel={SEARCH_BOX}
          style={{ flex: 1, minHeight: TAP, paddingHorizontal: space.md, borderWidth: 1, borderColor: color.rule, borderRadius: radius.md, backgroundColor: color.chassis, color: color.silk, fontSize: font.body }}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={SEARCH_BUTTON}
          disabled={disabled}
          onPress={() => {
            tick()
            find()
          }}
          style={({ pressed }) => ({
            minHeight: TAP,
            paddingHorizontal: space.lg + 2,
            borderRadius: radius.md,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: color.silk,
            opacity: disabled ? 0.6 : pressed ? 0.8 : 1
          })}
        >
          <Text style={{ color: color.chassis, fontSize: font.body, fontWeight: '700' }}>{SEARCH_BUTTON}</Text>
        </Pressable>
      </View>

      {/* The order, a gap, then the kind of gear: one row that slides sideways, as the HeadRush tab's does. */}
      <SideScroll showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={{ flexGrow: 0 }} contentContainerStyle={{ gap: space.sm - 2, alignItems: 'center', paddingVertical: 2 }}>
        {T3K_SORTS.map((s) => (
          <Chip key={s.key} label={s.label} on={now.sort === s.key} disabled={disabled} onPress={() => list.sort(s.key, typed)} />
        ))}
        <View style={{ width: space.sm }} />
        {T3K_GEARS.map((g) => (
          <Chip key={g.key || 'all'} label={g.label} on={now.gear === g.key} disabled={disabled} onPress={() => list.gear(g.key, typed)} />
        ))}
      </SideScroll>

      {now.note ? <Note>{now.note}</Note> : null}
      {now.fault ? <Note tone="warn">{now.fault}</Note> : null}
      {now.tones === null || asking ? <Note>{ASKING}</Note> : null}
      {nothingFound(now) ? <Note>{NO_TONES}</Note> : null}

      {now.tones && !asking ? (
        <View>
          {now.tones.map((tone) => (
            <ToneRow key={tone.id} tone={tone} disabled={disabled} onPress={() => onOpen(tone)} />
          ))}
        </View>
      ) : null}
      {now.tones && !asking && list.hasMore() ? <Press label={now.busy === 'more' ? 'Loading…' : MORE} height={48} disabled={disabled || now.busy === 'more'} onPress={() => list.more()} /> : null}
    </View>
  )
}

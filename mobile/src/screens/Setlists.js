import { useEffect, useRef, useState } from 'react'
import { KeyboardAvoidingView, Pressable, ScrollView, Text, TextInput, View } from 'react-native'

import { color, font, mono, radius, space, TAP } from '../lib/theme'
import { Platform } from 'react-native'
import { presetLabel, slotLabel } from '../lib/device'
import {
  ALL,
  STARRED,
  addAll,
  addTo,
  createList,
  deleteList,
  listsFor,
  marksFor,
  moveIn,
  removeFrom,
  setSource,
  sourceFor,
  toggleFavourite,
  updateList
} from '../lib/lists'
import { nameOf, useNames } from '../lib/presetNames'
import { useStored } from '../lib/store'
import { loadPreset, useRig } from '../lib/rig'
import { tick } from '../lib/feedback'
import Note from '../components/Note'
import Grip from '../components/Grip'
import SwipeAway from '../components/SwipeAway'
import { markSwipeHint, swipeHintSeen } from '../lib/coach'
import { SWIPE_HINT, showSwipeHint } from '../lib/swipe-hint'
import Press from '../components/Press'
import { landingIndex } from '../lib/laneOrder'
import SongPicker from '../components/SongPicker'
import SongSetup from '../components/SongSetup'

const face = Platform.select(mono)

const ofPreset = (s) => s.preset
const ofCaps = (s) => s.capabilities
const ofSlug = (s) => s.deviceSlug

/**
 * What Previous and Next step through, and the setlist they step through.
 *
 * The browser's Setlist sheet, as a screen. Two jobs, top to bottom: choose the
 * source, and build the list. They are one screen because they are one
 * decision — you pick a setlist and the songs in it are right there under it,
 * in order, to be fixed on the spot when the running order changes at the
 * venue.
 *
 * THE NAME IS EDITED IN THE CARD, and that is the shape of the whole screen.
 * "When creating a new list it should only show one text entry box, have it
 * already highlight the setlist created, to rename just by typing." It had
 * two: the chosen card at the top, in amber, saying the name, and a Name box
 * a screen further down — behind the keyboard, on Android, the moment it
 * opened. So the chosen card IS the box now. Press + New setlist and the new
 * card appears chosen, its name selected, the keyboard up: type, and that is
 * its name. Tap the name on any chosen card to rename it.
 *
 * Everything here writes straight to storage and says nothing back: lib/store
 * announces every write and the stage screen re-reads. So this screen never
 * holds a copy of the lists that could drift from the one the buttons use.
 *
 * WHAT IT SHARES WITH THE MAC, which is the part worth being plain about. The
 * deciding is the browser's own `setlists.js` and `presetMarks.js`, copied here
 * by `npm run sync:rules` rather than rewritten — a setlist that played in a
 * different order on the phone than at the Mac would be worse than no setlist.
 * They are filed under the same per-unit key, derived by the same shared rule,
 * so the two ends have something to match on when the account syncs them.
 */
export default function Setlists({ onBack }) {
  const preset = useRig(ofPreset)
  const caps = useRig(ofCaps)
  const device = useRig(ofSlug)
  const addressing = caps?.presets?.addressing

  /* Every write, here or on the picker, lands as a re-render. */
  useStored()
  /* Names for the songs already in the list, read a few at a time. */
  useNames()

  const lists = listsFor(device)
  const source = sourceFor(device)
  const favourites = marksFor(device).favourites
  const chosen = lists.find((l) => l.id === source) || null

  const current = preset?.number
  const here = Number.isInteger(current)
  const starred = here && favourites.includes(current)
  const inList = here && !!chosen && chosen.presets.includes(current)

  /*
   * Adding songs opens every preset, to tick as many as wanted — see
   * SongPicker. It used to be a search box over the names already read and
   * one song per tap: "right now it looks like the only way is to search for
   * them."
   */
  const [adding, setAdding] = useState(false)
  const [settingUp, setSettingUp] = useState(false)
  /* Whether this phone has confirmed "Swipe left to remove a song". Null
     until read, so the hint never flashes up for somebody who has seen it. */
  const [swipeSeen, setSwipeSeen] = useState(null)
  useEffect(() => {
    let live = true
    swipeHintSeen().then((seen) => live && setSwipeSeen(seen))
    return () => {
      live = false
    }
  }, [])
  /* Delete asks twice. One tap on a screen you are scrolling is one tap. */
  const [armed, setArmed] = useState(false)
  /*
   * The name as it is being typed, and NOTHING ELSE TOUCHED UNTIL IT IS TYPED.
   *
   * "When deleting the name to rename it won't let the entire name delete, it
   * stops at the first letter." And: "when adding a set list it adds the names
   * twice." One bug, wearing two hats.
   *
   * It saved on every keystroke. Each save writes storage, which announces,
   * which re-renders this whole screen — every setlist row, every candidate
   * song — between one letter and the next. A React text box is told what it
   * contains by its `value`, and a `value` that arrives a frame late is a box
   * that puts back the letter you just deleted. Deleting faster than the screen
   * could redraw deleted nothing; typing faster than it could redraw is how a
   * name ends up carrying pieces of itself twice.
   *
   * So the box is the only thing that knows the name while you are typing it,
   * and storage is told once, when you are done — on blur, on the keyboard's
   * Done, or on leaving the screen. Nothing re-renders in between.
   *
   * An empty box is allowed while typing, which it has to be: you cannot type a
   * new name without first clearing the old one. It is simply not what is
   * saved.
   */
  const [draft, setDraft] = useState(null)
  /*
   * The setlist just made, whose card opens with its name selected and the
   * keyboard up. Only ever the one just pressed into being: a card that
   * grabbed the keyboard every time it was chosen would be a card you cannot
   * choose without typing.
   */
  const [justMade, setJustMade] = useState(null)

  useEffect(() => {
    setArmed(false)
    setAdding(false)
    setDraft(null)
  }, [source])

  const nameOfSlot = (n) => {
    const read = nameOf(n)
    if (typeof read === 'string' && read) return read
    return n === current ? presetLabel(preset) : ''
  }

  const setPresets = (presets) => {
    if (!chosen) return
    updateList(device, chosen.id, { presets })
  }

  /** Save what was typed, if it is a name and it is a different one. */
  const commitName = () => {
    setJustMade(null)
    const name = (draft ?? '').trim()
    setDraft(null)
    if (!chosen || !name || name === chosen.name) return
    updateList(device, chosen.id, { name })
  }

  /*
   * Choosing another card takes the box away with the card it was in, and a
   * box that goes away is not blurred — so a name typed and then chosen away
   * from is saved here, before the card changes.
   */
  const choose = (src) => {
    commitName()
    setSource(device, src)
  }

  /*
   * And once more on the way out, because tapping Done at the top of this
   * screen unmounts it without the box ever being blurred — a rename typed and
   * then left would simply not have happened.
   */
  const live = useRef({ draft: null, chosen: null, device: null })
  useEffect(() => {
    live.current = { draft, chosen, device }
  })
  useEffect(
    () => () => {
      const { draft: d, chosen: c, device: unit } = live.current
      const name = (d ?? '').trim()
      if (c && name && name !== c.name) updateList(unit, c.id, { name })
    },
    []
  )

  const fresh = () => {
    commitName()
    // A new setlist is the one you are about to build, so it is the one the
    // buttons follow — and the one whose card opens ready to be named.
    const list = createList(device)
    setSource(device, list.id)
    setJustMade(list.id)
  }

  const remove = () => {
    if (!chosen) return
    if (!armed) {
      setArmed(true)
      return
    }
    deleteList(device, chosen.id)
    setArmed(false)
  }

  /*
   * A song being dragged: which row, how far the finger has gone, and where
   * that lands it. Row heights are measured, and the page is locked against
   * scrolling for as long as the grip is held — the chain editor's rules.
   */
  const [drag, setDrag] = useState(null)
  const [held, setHeld] = useState(false)
  const rowHeights = useRef([])
  const dragStart = (i) => {
    setHeld(true)
    setDrag({ index: i, dy: 0, to: i })
  }
  const dragMove = (i, dy) => {
    /* Only the rows that exist: a removed song leaves its height behind. */
    const heights = rowHeights.current.slice(0, chosen?.presets?.length || 0)
    setDrag({ index: i, dy, to: landingIndex(heights, i, dy, space.sm) })
  }
  const dragEnd = (i) => {
    setHeld(false)
    const to = drag?.to ?? i
    setDrag(null)
    if (to !== i) setPresets(moveIn(chosen.presets, i, to))
  }
  /* Where each row is drawn mid-drag: the lifted one under the finger, the
     ones it has passed stepped out of its way. */
  const shiftFor = (i) => {
    if (!drag) return 0
    if (i === drag.index) return drag.dy
    const h = (rowHeights.current[drag.index] || 0) + space.sm
    if (drag.to > drag.index && i > drag.index && i <= drag.to) return -h
    if (drag.to < drag.index && i >= drag.to && i < drag.index) return h
    return 0
  }



  return (
    /*
     * The page moves out from under the keyboard, the way the sign-in screen
     * does. The name box is in the top half of the page, so on most phones the
     * keyboard never reaches it; this is for the search box further down.
     */
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: space.lg, gap: space.lg, paddingBottom: space.xxl }}
        keyboardShouldPersistTaps="handled"
        scrollEnabled={!held}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md }}>
          <View style={{ flexShrink: 1 }}>
            <Text accessibilityRole="header" style={{ color: color.silk, fontSize: font.title, fontWeight: '700' }}>
              Setlist
            </Text>
            <Text style={{ color: color.silkDim, fontSize: font.small }}>
              What Previous and Next step through
            </Text>
          </View>
          <Press label="Done" height={40} onPress={onBack} />
        </View>

        {/* --------------------------------------------------------- source */}
        <View style={{ gap: space.sm }} accessibilityRole="radiogroup">
          <SourceRow
            on={source === ALL}
            onPress={() => choose(ALL)}
            name="All presets"
            note="Slot by slot, in order"
          />
          <SourceRow
            on={source === STARRED}
            onPress={() => choose(STARRED)}
            name="★ Starred"
            note={
              favourites.length
                ? `${favourites.length} preset${favourites.length === 1 ? '' : 's'}, in slot order`
                : 'Nothing starred yet — star one below'
            }
          />
          {lists.map((l) => (
            <SourceRow
              key={l.id}
              on={source === l.id}
              onPress={() => choose(l.id)}
              name={l.name}
              note={
                source === l.id
                  ? `${songs(l)} · tap the name to rename`
                  : songs(l)
              }
              /* The chosen card is the name box. See the note at the top. */
              editing={
                source === l.id
                  ? {
                      value: draft ?? l.name,
                      setDraft,
                      commitName,
                      selectAll: justMade === l.id
                    }
                  : null
              }
            />
          ))}
          <Press label="+ New setlist" onPress={fresh} />
        </View>

        {/* --------------------------------------------------------- songs */}
        {chosen ? (
          <View style={{ gap: space.md }}>
            <Label>{`Songs in ${chosen.name}`}</Label>

            {/*
              The preset you are on, first: this is the screen you have open
              when you decide it belongs in tonight's order, and the button that
              puts it there sits right above the order it goes into.
            */}
            {here ? (
              <Press
                label={inList ? `${presetLabel(preset)} is in this setlist` : `+ Add ${presetLabel(preset)}`}
                sub={`${slotLabel(current, addressing)} · the preset you are on`}
                tone="signal"
                disabled={inList}
                onPress={() => setPresets(addTo(chosen.presets, current))}
              />
            ) : null}

            {showSwipeHint(swipeSeen, chosen.presets.length) ? (
              <SwipeHint
                onOk={() => {
                  markSwipeHint()
                  setSwipeSeen(true)
                }}
              />
            ) : null}

            {chosen.presets.length ? (
              chosen.presets.map((n, i) => (
                <View
                  key={n}
                  onLayout={(e) => {
                    rowHeights.current[i] = e.nativeEvent.layout.height
                  }}
                  style={{
                    transform: [{ translateY: shiftFor(i) }],
                    zIndex: drag && i === drag.index ? 2 : 0,
                    opacity: drag && i === drag.index ? 0.92 : 1
                  }}
                >
                  <Song
                    position={i + 1}
                    slot={slotLabel(n, addressing)}
                    name={nameOfSlot(n) || 'Unnamed'}
                    playing={n === current}
                    lifted={!!drag && i === drag.index}
                    alone={chosen.presets.length === 1}
                    onPlay={() => loadPreset(n)}
                    onDragStart={() => dragStart(i)}
                    onDragMove={(dy) => dragMove(i, dy)}
                    onDragEnd={() => dragEnd(i)}
                    onRemove={() => setPresets(removeFrom(chosen.presets, n))}
                    demo={i === 0 && showSwipeHint(swipeSeen, chosen.presets.length)}
                  />
                </View>
              ))
            ) : (
              <Note>No songs yet. Next goes to the first song, and after the last one it starts over.</Note>
            )}

            <Press label="Add songs…" sub="Pick from every preset, as many as you like" onPress={() => setAdding(true)} />
            {/* Each song's own scene and tempo, set when Next lands on it. */}
            {chosen.presets.length ? (
              <Press
                label={settingUp ? 'Done setting up songs' : 'Set up each song…'}
                sub="The scene and tempo each song switches to"
                on={settingUp}
                onPress={() => setSettingUp((v) => !v)}
              />
            ) : null}
            {settingUp ? <SongSetup device={device} list={chosen} nameOf={nameOfSlot} addressing={addressing} /> : null}
            <SongPicker
              open={adding}
              listName={chosen.name}
              already={chosen.presets}
              onAdd={(picked) => setPresets(addAll(chosen.presets, picked))}
              onClose={() => setAdding(false)}
            />

            <Press
              label={armed ? 'Tap again to delete this setlist' : 'Delete this setlist'}
              on={armed}
              tone={armed ? 'signal' : 'plain'}
              onPress={remove}
            />
          </View>
        ) : null}

        {/* ---------------------------------------------------------- star */}
        {here ? (
          <View style={{ gap: space.sm }}>
            <Label>This preset</Label>
            <Press
              label={starred ? `★ ${presetLabel(preset)} is starred` : `☆ Star ${presetLabel(preset)}`}
              sub={`${slotLabel(current, addressing)} · starred presets are what ★ Starred walks`}
              tone="signal"
              on={starred}
              onPress={() => toggleFavourite(device, current)}
            />
          </View>
        ) : null}

        {/*
          Where they live. The phone is signed in by definition — it cannot
          reach the Mac otherwise — so this is not the browser's two answers, it
          is the one that is always true here.
        */}
        <Note>Setlists and stars are kept with your account, so one built here is on the computer too.</Note>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

/** "3 songs", "1 song", "Empty". */
const songs = (l) => (l.presets.length ? `${l.presets.length} song${l.presets.length === 1 ? '' : 's'}` : 'Empty')

/**
 * One choice of what Previous and Next walk.
 *
 * With `editing`, the name is a text box in the card — the chosen setlist's
 * card, which is where the name is read and so where it is changed. It is
 * still the card: a tap outside the name chooses it, as ever.
 */
function SourceRow({ on, onPress, name, note, editing = null }) {
  const { setDraft, commitName, selectAll } = editing || {}
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected: on, checked: on }}
      accessibilityLabel={`${name}, ${note}`}
      onPress={() => {
        tick()
        onPress()
      }}
      style={({ pressed }) => ({
        minHeight: TAP,
        justifyContent: 'center',
        paddingHorizontal: space.md,
        paddingVertical: space.sm,
        borderRadius: radius.md,
        borderWidth: on ? 2 : 1,
        borderColor: on ? color.signal : color.rule,
        backgroundColor: on ? color.signalWash : color.panel,
        opacity: pressed ? 0.7 : 1
      })}
    >
      {editing ? (
        <TextInput
          value={editing.value}
          onChangeText={setDraft}
          onBlur={commitName}
          onSubmitEditing={commitName}
          returnKeyType="done"
          blurOnSubmit
          /*
           * A new setlist opens with its name selected and the keyboard up, so
           * typing replaces "Setlist 1" rather than appending to it.
           */
          autoFocus={selectAll}
          selectTextOnFocus
          accessibilityLabel="Setlist name"
          placeholder="Name this setlist"
          placeholderTextColor={color.silkFaint}
          style={{
            color: color.silk,
            fontSize: font.body,
            fontWeight: '600',
            paddingVertical: 0,
            paddingHorizontal: 0,
            marginVertical: -2,
            minHeight: 28
          }}
        />
      ) : (
        <Text numberOfLines={1} style={{ color: color.silk, fontSize: font.body, fontWeight: '600' }}>
          {name}
        </Text>
      )}
      <Text numberOfLines={1} style={{ color: color.silkDim, fontSize: font.micro, marginTop: 2 }}>
        {note}
      </Text>
    </Pressable>
  )
}

/**
 * One song in the running order.
 *
 * Dragged by a grip, the way a block is in the chain editor: "Let's make the
 * set lists drag to rearrange as well, like it is on the chain editor,
 * instead of the up-down arrows." The grip claims the touch and the page
 * stops scrolling while it is held, so a thumb between songs moves the song
 * and nothing else.
 *
 * REMOVED BY SWIPING IT AWAY, and the ✕ is gone from the row: "Make the
 * setlist songs swipe to delete instead of the x. Make a full swipe delete it
 * and a partial swipe show the x that can be tapped." Two gestures out of one
 * movement — see SwipeAway — and a row that is mostly read now carries a name
 * and a grip rather than a name, a grip and a standing offer to delete it.
 */
function Song({ position, slot, name, playing, alone, lifted, onPlay, onDragStart, onDragMove, onDragEnd, onRemove, demo }) {
  return (
    <SwipeAway onRemove={onRemove} label={`Remove ${name}`} demo={demo}>
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.sm,
        paddingHorizontal: space.sm,
        paddingVertical: space.sm,
        borderRadius: radius.md,
        borderWidth: playing || lifted ? 2 : 1,
        borderColor: lifted ? color.silk : playing ? color.signal : color.rule,
        backgroundColor: lifted ? color.panelHi : color.panel
      }}
    >
      {/*
        THE NAME IS A BUTTON: tap a song and the unit goes to it, the way a row
        in the preset list does. "Clicking on the actual preset name doesn't
        work." It was a label; a running order you cannot jump around in is a
        list to read, not a setlist. Not awaited, like every preset load from a
        phone: the rig shows the new slot on the press and confirms it behind.
      */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={playing ? `${name}, playing` : `Play ${name}`}
        onPress={() => {
          tick()
          onPlay()
        }}
        style={({ pressed }) => ({ flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.sm, opacity: pressed ? 0.7 : 1 })}
      >
        <Text style={{ color: color.silkDim, fontSize: font.small, fontFamily: face, minWidth: 18 }}>
          {position}
        </Text>
        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} style={{ color: color.silk, fontSize: font.body }}>
            {name}
          </Text>
          <Text style={{ color: color.silkFaint, fontSize: font.micro, fontFamily: face }}>
            {playing ? `${slot} · playing` : `${slot} · tap to play`}
          </Text>
        </View>
      </Pressable>
      {/* One song has nowhere to move: no grip, rather than one that does
          nothing. "The little arrows to go up and down don't work." */}
      {alone ? null : (
        <Grip
          label={`Drag ${name}`}
          hint="Hold and drag up or down to move it in the running order"
          onStart={onDragStart}
          onMove={onDragMove}
          onEnd={onDragEnd}
        />
      )}
    </View>
    </SwipeAway>
  )
}

/**
 * "Swipe left to remove a song", the first time a setlist with a song in it
 * is open on this phone. The first song slides to show it while this is up;
 * Got it puts both away for good. The words are shared/swipe-hint.mjs's.
 */
function SwipeHint({ onOk }) {
  return (
    <View
      accessibilityLiveRegion="polite"
      style={{
        gap: space.sm,
        padding: space.md,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: color.signal,
        backgroundColor: color.signalWash
      }}
    >
      <Text style={{ color: color.silk, fontSize: font.lead, fontWeight: '700' }}>← {SWIPE_HINT.head}</Text>
      <Text style={{ color: color.silkDim, fontSize: font.small, lineHeight: 20 }}>{SWIPE_HINT.body}</Text>
      <Press label={SWIPE_HINT.ok} tone="signal" on height={44} onPress={onOk} />
    </View>
  )
}

function Label({ children }) {
  return (
    <Text
      accessibilityRole="header"
      style={{
        color: color.silkFaint,
        fontSize: font.micro,
        letterSpacing: 1.5,
        textTransform: 'uppercase'
      }}
    >
      {children}
    </Text>
  )
}

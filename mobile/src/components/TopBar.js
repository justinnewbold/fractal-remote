import { useEffect, useState } from 'react'
import { Alert, Image, Platform, Pressable, Text, View } from 'react-native'
import { BlurView } from 'expo-blur'

import { color, font, mono, radius, space, isDark } from '../lib/theme'
import { at } from '../lib/vivid'
import { tick } from '../lib/feedback'
import { toneOfRemote, unitWord } from '../lib/link-word'
import { pillWords } from '../lib/pill-words'
import { APP_VERSION } from '../lib/version'
import { useRig } from '../lib/rig'
import { setDemo, useDemo } from '../lib/demo'
import { shouldOffer, usePurchase } from '../lib/purchases'
import setupIcon from '../../assets/icons/setup.png'
import volumeIcon from '../../assets/icons/volume.png'
import bluetoothIcon from '../../assets/icons/bluetooth.png'
import { setBluetooth, useBluetoothOn } from '../lib/bluetooth'
import { idOf } from '../lib/device'
import Lamp from './Lamp'
import Volume from './Volume'
import { fire } from '../lib/tapped'
import { useSaveToSlot } from './SaveToSlot'
import { SAVE_LATE_WORDS, SAVE_WORKING_WORDS } from '../lib/save-wait'

const face = Platform.select(mono)

/**
 * One line, above everything, in every state — the browser's bar, on a phone.
 *
 * "Make sure the iOS app shows this exact header." It was a different bar
 * saying a different thing: a sentence, "Connected to MacBook Pro SG 566",
 * which named the Mac and nothing else. The unit was not on it, the version was
 * two sheets away under Setup, and the speaker and the gear were down in the
 * slot row competing with Edit for a corner of the stage screen.
 *
 * Left to right: the version, the pill (the state in a word, the lamp, the
 * unit, and the computer under them), the volume, and setup. Every one of them
 * is a fact somebody checks BEFORE playing — what am I plugged into, through
 * what, what am I running, is it live — and none of them belongs on a screen
 * you have to go and find.
 *
 * AND WHICH COMPUTER AGAIN, since 24 October 2026. The bar had left the
 * computer out ("there is normally one Mac"), until Justin asked for his
 * other app's pill: "Live ● AM4" over "on Raspberry Pi", and for it to be the
 * way to switch units. With two computers on one account the computer is half
 * of which unit you are driving, so it is on the bar again, under the unit.
 *
 * The words come from shared/link-word.mjs rather than from here, so the two
 * apps cannot drift into saying different things about the same link.
 */
export default function TopBar({ link, onOpenSettings, onOpenUnit, onUnlock, saveHere: saveWanted = true }) {
  const unit = useRig(ofDeviceName)
  const unitState = useRig(ofUnitState)
  const blocks = useRig(ofAllBlocks)
  const [volume, setVolume] = useState(false)
  const [failed, setFailed] = useState(null)
  /* Whether the note under the pill is open: over Bluetooth only, with Turn off Bluetooth in it. */
  const [saying, setSaying] = useState(false)
  /*
   * SAVE, HERE, AS SOON AS THERE IS SOMETHING TO SAVE.
   *
   * "If you could hit the save button after you have turned the block on or
   * off or switch the scene, that way it doesn't revert… add a save to the top
   * menu bar anytime that changes are made, kind of like we already have with
   * the edit screen." A block turned on or off, or a channel changed, on Play
   * is in the unit's edit buffer and gone at the next preset change; the only
   * Save was two screens away in Edit. The browser has had one in its bar all
   * along. It shows only while the preset has unsaved changes, asks before it
   * overwrites, and stays out of the way on Edit, which has its own.
   */
  const saveTo = useSaveToSlot()
  /* Never on a VP4, which the app cannot save on: a lit Save that only says so after a tap is a promise (lib/vp4-safety VP4_NO_SAVE). */
  const saveHere = saveWanted && !saveTo.notHere
  const preset = useRig(ofPreset)
  const unsaved = useRig(ofUnsaved)
  /* Up while it saves, too: its "Saving…" is the only sign one is running. */
  const canSave = saveHere && (saveTo.saving || (!!unsaved && unsaved.number === preset?.number && saveTo.can))
  const askSave = () =>
    Alert.alert('Save preset?', 'This will overwrite the current preset.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Save', onPress: () => saveTo.write() }
    ])
  const purchase = usePurchase()
  /*
   * The demo says Demo, and "simulated" where a computer would be.
   *
   * It reads as a connected link everywhere else on purpose — the questions do
   * get answered — but the bar is the one place somebody looks to know what
   * they are driving, and a simulated FM3 wearing the same green Live as a
   * real one is the app telling a lie in the one spot that exists to prevent
   * that. "It does sound connected, even in demo."
   */
  const demo = useDemo()
  /*
   * OVER BLUETOOTH, THE BAR SAYS SO. "Can we change the connected thing to be
   * blue when it's on a Bluetooth connection instead of green? And instead of
   * a green dot next to the unit name have a Bluetooth icon when it's
   * connected via Bluetooth." So the word goes blue and the lamp becomes the
   * Bluetooth mark: what an eye lands on before a song now says which way the
   * phone is reaching the unit, not only that it is. Never in the demo, which
   * is reaching nothing.
   */
  const bluetooth = useBluetoothOn() && !demo
  /* The note under the pill is Bluetooth's alone: put away when Bluetooth goes, so it is not open on its own when Bluetooth next comes on. */
  useEffect(() => {
    if (!bluetooth) setSaying(false)
  }, [bluetooth])

  /*
   * Named once, for the unlock pill below.
   *
   * BELOW `demo`, and that is not tidiness. It sat ABOVE it and read `demo`
   * from the line under itself — a const, so the read lands in the temporal
   * dead zone. Depending on how the bundler lowers block scoping that is
   * either a ReferenceError on every render of this bar or, quietly, a
   * `demo` of undefined: shouldOffer({ demo: undefined }) is always false,
   * so the unlock NEVER appeared in the demo. Which is the exact fault the
   * offer was added to fix — "where is the unlock button? I don't see it
   * anywhere" — reintroduced one line above the fix.
   *
   * NOT gated on `purchase.available`, which was the first version of that
   * same bug. The store not being ready made the whole offer vanish rather
   * than explain itself — see shouldOffer in lib/purchases. The paywall is
   * where "we cannot take your money this second" belongs; the bar's job is
   * to be findable.
   */
  const canBuy = Boolean(onUnlock) && shouldOffer({ demo })
  /*
   * THE WAY OUT, FOR SOMEBODY WHO HAS ALREADY PAID.
   *
   * "There needs to be a more clear way to exit the demo if it's registering
   * the purchase... instead of it saying unlock 999 at the top have it just
   * clearly say exit demo if they're in the demo and they've already paid."
   *
   * The demo does not stop being useful the moment somebody buys the app —
   * "it would be a good idea for somebody that wants to maybe view what it
   * looks like having an AxeFX 3 or another model they don't have yet" — so
   * it stays reachable. What it needed was a door on the same wall as the
   * one they came in by.
   *
   * Until now the only way out was Settings, two screens away, because the
   * pill beside DEMO is the unlock and an unlock is exactly what this person
   * does not need. The pill is not gone for them, it changes job.
   *
   * `unlocked` rather than `!canBuy`, and the difference matters: canBuy is
   * also false on a screen that was handed no onUnlock, and on a phone where
   * the store is having a bad minute. Neither of those is somebody who has
   * paid, and neither should be told the demo is all they have left.
   */
  const canLeave = demo && purchase.unlocked
  const connected = link?.link === 'connected'
  const tone = toneOfRemote(link?.link)
  /*
   * THE UNLOCK SAYS ITS OWN NAME NOW. "Change this word demo to Unlock and
   * bring up the unlock page when it's tapped." The word in the demo said
   * UNLOCK and the pill beside it carried the price, reading UNLOCK $9.99
   * across the two. The word became the pill that switches units, so the
   * unlock pill says the whole of it, Unlock $9.99, and is there even before
   * the store has said the price. Only while there is something to buy:
   * somebody who has paid gets Exit demo instead.
   */

  /*
   * TWO TRUTHS, ONE PILL. The computer and the unit used to be two spots,
   * CONNECTED on the right and the lamp and the name on the left; a frozen
   * FM3 under a green lamp is what that split was for. They share the pill
   * now, and still do not share a verdict: the lamp is green only while the
   * unit answers, red with No unit or Not answering when the computer has
   * none or one gone quiet (unitWord), and red too when the computer itself
   * is out of reach.
   */
  const unitSaid = demo ? null : unitWord(tone, unitState)
  /* Green when connected to the unit, red when not — including when the
     computer itself is out of reach, since the unit is then out of reach
     too. Unlit only while nobody has been asked yet, and in the demo. */
  const unitLamp = demo ? 'idle' : connected && unitState === 'present' ? 'good' : !connected || unitSaid ? 'fault' : 'idle'

  /*
   * The pill's words: the state, the unit, the computer (shared/pill-words.mjs
   * pillWords). A dash or "Looking…" used to stand in for a unit not yet
   * heard; the pill says Looking and leaves the name out until the unit has
   * said it, since 'FM3' comes back from the unit itself.
   */
  const pill = pillWords({ tone, unitState, unit, computer: link?.macName, demo, bluetooth })
  /* Blue rather than green over Bluetooth, as the word was. */
  const pillHue =
    pill.mark === 'ok' ? (bluetooth ? color.ble : color.ok) : pill.mark === 'no' ? color.fault : pill.mark === 'wait' ? color.signal : color.silkFaint

  /*
   * Only where there is an output block to move, the same rule the browser
   * uses: a speaker that opens an empty sheet is worse than no speaker.
   *
   * AND ONLY WHERE IT CAN BE WRITTEN TO, which is not the same thing and cost
   * an evening to tell apart. This asked whether a block called "output" was
   * in the chain; the slider asks whether that block has an id to address. A
   * unit that reports the block without one satisfies the first and fails the
   * second, so the speaker appeared and every press of it answered "the chain
   * has not been read" about a chain that had:
   *
   *   01:24:41 [set] volume: no Output block known yet — the chain has not been read
   *   01:25:04 [set] volume: no Output block known yet — the chain has not been read
   *
   * — twenty seconds apart, on a preset whose chain had just been edited block
   * by block. One question now, asked in one place, so the button and the
   * write can no longer disagree about whether there is a volume to move.
   */
  const hasOutput = connected && Number.isInteger(idOf((blocks || []).find((b) => b?.slug === 'output')))

  return (
    /*
     * GLASS, AND IT COSTS NOTHING TO ADD.
     *
     * "I want this to look more like the liquid glass type stuff that Apple
     * does." expo-blur is already a dependency — the sheets, the tuner and the
     * password box have used it for a long time — so this bar can sit on real
     * translucency rather than a flat panel without moving the native
     * fingerprint. A blur is the one part of that look that cannot be faked
     * with a colour, and it was already paid for.
     *
     * `experimentalBlurMethod` is what makes it work on Android at all: the
     * same incantation the sheets use.
     */
    <BlurView
      accessibilityLiveRegion="polite"
      intensity={40}
      tint={isDark() ? 'dark' : 'light'}
      experimentalBlurMethod="dimezisBlurView"
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.md,
        paddingHorizontal: space.lg,
        paddingVertical: space.sm,
        borderBottomWidth: 1,
        borderBottomColor: color.rule,
        /* Translucent, or the blur has nothing to do: a solid panel in front
           of it hides the very thing it is blurring. */
        backgroundColor: at(color.panel, 0.55),
        /*
         * ABOVE THE SCREEN UNDER IT. The bar's notes (Saved, a volume that
         * would not take, a save running late) hang below it, over the top of
         * the screen, by design. Drawn before that screen, they were drawn
         * UNDER it: "The app can't save…" came out with PRESET 004 B1 OF 104
         * printed through the middle of it. So the whole bar is lifted, notes
         * and all, over the screens drawn after it — and only over those: the
         * metronome's flash, which is over everything, sits higher still
         * (MetronomeBeat's zIndex), and a sheet is a Modal of its own.
         */
        zIndex: 3
      }}
    >
      {/*
        The version, where it can be read without opening anything.

        "The app version number is listed only in settings. I like to always
        know easily what version we are working on." It is the first thing
        either of us needs when something looks wrong, and on the phone it was
        behind Setup — which is the screen you cannot reach when the thing that
        looks wrong is the link.

        On the left now, where Axiom has its own: the unit's name went into
        the pill. `flex: 1` so it takes the slack: it is the one thing in the
        row that can give.
      */}
      {/* Out of the way while Save needs the room; it is in Settings too. */}
      {canSave ? (
        <View style={{ flex: 1 }} />
      ) : (
        <Text
          numberOfLines={1}
          style={{
            flex: 1,
            color: color.silkFaint,
            fontSize: font.micro,
            fontFamily: face,
            letterSpacing: 1
          }}
        >
          {`v${APP_VERSION}`}
        </Text>
      )}

      {/*
        THE PILL: WHICH UNIT, ON WHICH COMPUTER, AND THE WAY TO ANOTHER.

        "This is from my other app axiom. Can we list the computer and device
        it's connected to like this instead of the word connected? Also have
        that be the button that can switch what unit it's connected to?"
        Axiom's bar says "Live ● AM4" over "on Raspberry Pi". This is the
        same: the state in a word, the lamp, the unit, and under them the
        computer, by the name it gives itself. It takes the place of two
        things that were at either end of the bar, the unit's name and the
        word CONNECTED, and does what the name did: in the demo it opens the
        five demo units, with two or more computers Which unit, and with one
        Phone & computer (App.js onOpenUnit). Over Bluetooth there is one
        adapter and nothing to switch to, so it opens the note with Turn off
        Bluetooth, as the word did.

        The words come from shared/pill-words.mjs pillWords, so the lamp and
        the word cannot drift apart: NO UNIT and NOT ANSWERING in red, a frozen
        unit never Live. `flexShrink` so that on a narrow phone it gives way,
        a line at a time, after the version has.
      */}
      <Pressable
        onPress={() => {
          tick()
          if (bluetooth) {
            setSaying((open) => !open)
            return
          }
          ;(onOpenUnit || onOpenSettings)?.()
        }}
        accessibilityRole="button"
        accessibilityLabel={`${[pill.status, pill.unit, pill.where].filter(Boolean).join(', ')}. ${
          demo ? 'Change the demo unit' : bluetooth ? 'Bluetooth' : 'Switch unit'
        }`}
        hitSlop={6}
        style={({ pressed }) => ({
          flexShrink: 1,
          minWidth: 0,
          alignItems: 'center',
          paddingHorizontal: space.md,
          paddingVertical: 3,
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: color.rule,
          backgroundColor: pressed ? color.panel : at(color.panelHi, 0.6)
        })}
      >
        {/* Held inside the pill on a narrow phone: the unit's name gives way (an ellipsis), never the edge of the pill. */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, minWidth: 0, maxWidth: '100%', flexShrink: 1 }}>
          <Text numberOfLines={1} style={{ flexShrink: 0, color: pillHue, fontSize: font.small, fontFamily: face, fontWeight: '700' }}>
            {pill.status}
          </Text>
          {bluetooth ? <BluetoothMark state={unitLamp} /> : <Lamp state={unitLamp} size={8} />}
          {pill.unit ? (
            <Text numberOfLines={1} style={{ flexShrink: 1, color: color.silk, fontSize: font.small, fontFamily: face, fontWeight: '700' }}>
              {pill.unit}
            </Text>
          ) : null}
        </View>
        {pill.where ? (
          <Text numberOfLines={1} style={{ maxWidth: '100%', color: color.silkDim, fontSize: font.micro }}>
            {pill.where}
          </Text>
        ) : null}
      </Pressable>

      {/*
       * THE WAY OUT OF THE DEMO AND INTO THE PAID APP, and until now there
       * was not one.
       *
       * The paywall was shown at one moment only: somebody with a pairing
       * code who had not paid. Which meant the demo — the entire shop window,
       * the thing a person spends an hour in before deciding — had no way to
       * buy anything at all. "Where is the unlock button to unlock to the
       * full version? I don't see it anywhere in the app."
       *
       * It was not buried. It was not there.
       *
       * So it sits next to the pill that says Demo, the one part of this bar
       * that is already saying "this is not your real rig". Amber, because
       * every other amber thing in this app is the signal path and this is
       * the one exception worth making: it has to be findable by somebody who
       * is not looking for it.
       *
       * Only in the demo, only when there is something to buy, and never once
       * it is bought — a button that charges a person twice, or that cannot
       * take money at all, is worse than no button.
       */}
      {canLeave ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Exit demo"
          onPress={() => {
            tick()
            setDemo(false)
          }}
          hitSlop={8}
          /* The same pill as the unlock, in the same place, doing the job
             that person actually has. Amber for the same reason it is amber
             there: in this bar it is the one thing anybody is being asked to
             do, and a quieter treatment would read as another label in a row
             that is already mostly labels. It cannot be mistaken for buying,
             because it says what it does. */
          style={({ pressed }) => ({
            paddingHorizontal: space.md,
            paddingVertical: 4,
            borderRadius: radius.pill,
            backgroundColor: pressed ? color.signalWash : color.signal
          })}
        >
          <Text
            style={{
              color: color.onSignal,
              fontSize: font.micro,
              fontWeight: '700',
              letterSpacing: 0.6
            }}
          >
            {/* His words, not a tidied-up version of them. */}
            Exit demo
          </Text>
        </Pressable>
      ) : null}

      {canBuy ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Unlock the full version"
          onPress={() => {
            tick()
            onUnlock()
          }}
          hitSlop={8}
          /* FILLED, not outlined. An outline reads as one more piece of
             chrome in a bar that is mostly lamps and labels; this is the only
             thing on the screen anybody is being asked to DO. */
          style={({ pressed }) => ({
            paddingHorizontal: space.md,
            paddingVertical: 4,
            borderRadius: radius.pill,
            backgroundColor: pressed ? color.signalWash : color.signal
          })}
        >
          <Text
            style={{
              color: color.onSignal,
              fontSize: font.micro,
              fontWeight: '700',
              letterSpacing: 0.6
            }}
          >
            {/* The price belongs on the button. "Unlock" alone asks somebody
                to tap to find out what it costs, which is the tap most people
                will not make; but before the store has said the price,
                "Unlock" alone is still the way in.

                The verb is back on it: it had moved onto the word beside it,
                UNLOCK $9.99 reading across the two, and that word is the
                pill now. */}
            {purchase.price ? `Unlock ${purchase.price}` : 'Unlock'}
          </Text>
        </Pressable>
      ) : null}

      {canSave ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Save the preset"
          onPress={() => {
            tick()
            askSave()
          }}
          hitSlop={8}
          disabled={saveTo.saving}
          style={({ pressed }) => ({
            paddingHorizontal: space.md,
            paddingVertical: 4,
            borderRadius: radius.pill,
            backgroundColor: pressed ? color.signalWash : color.signal,
            opacity: saveTo.saving ? 0.6 : 1
          })}
        >
          <Text style={{ color: color.onSignal, fontSize: font.micro, fontWeight: '700', letterSpacing: 0.6 }}>
            {saveTo.saving ? 'Saving…' : 'Save'}
          </Text>
        </Pressable>
      ) : null}

      {hasOutput ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Volume"
          hitSlop={10}
          onPress={() => setVolume(true)}
        >
          {/* The browser's speaker, drawn the same: "make the mobile app
              volume icon look like the web icon". A colour emoji at this size
              was a smudge that no theme could tint; this takes the bar's grey,
              the way the browser's takes its ink. */}
          <Image
            source={volumeIcon}
            accessible={false}
            resizeMode="contain"
            style={{ width: 24, height: 24, tintColor: color.silkDim }}
          />
        </Pressable>
      ) : null}

      {/*
        The gear is a picture now, and it is his own.

        It was the character ⚙, and that cost a bug: "The settings icon is too
        dark to even see, but if I click where it's supposed to be" — on
        Android. The character is drawn from the phone's text font in the text
        colour, which nobody had set, so it took the default: black, on a bar
        that is nearly black. Giving it a colour fixed the invisibility and
        left the real problem, which is that the two platforms were drawing
        two different gears: Apple swaps that character for its own picture,
        Android draws the outline from its font.

        The one in the file is cut out of Justin's mockup of the play screen,
        so both phones now show the gear he drew. Tinted rather than coloured
        in, for the same reason every other picture here is — see
        mobile/assets/icons. The speaker beside it is one too now, the browser's shape.
      */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Connection and setup"
        hitSlop={10}
        onPress={onOpenSettings}
      >
        <Image
          source={setupIcon}
          accessible={false}
          resizeMode="contain"
          style={{ width: 22, height: 22, tintColor: color.silk }}
        />
      </Pressable>

      {/*
        The volume opens from here now rather than from the stage screen, which
        is what moving the speaker up means: the sheet belongs to the button.
        It is a modal, so it does not care which screen is behind it.
      */}
      <Volume blocks={blocks} open={volume} onClose={() => setVolume(false)} onError={setFailed} />
      {failed ? <Reported said={failed} onClear={() => setFailed(null)} /> : null}
      {saying && bluetooth ? <Which link={link} onClose={() => setSaying(false)} /> : null}
      {saveTo.said && saveHere ? <Saved said={saveTo.said} onClear={saveTo.dismiss} /> : null}
      {/*
        A save from Play runs late the same as one from Edit, and Play has no
        notes under a button to say so. The same strip, with its Cancel.
      */}
      {saveHere && saveTo.saving && saveTo.late ? <Late onCancel={saveTo.cancel} picked={saveTo.picked} /> : null}
    </BlurView>
  )
}

/**
 * The lamp, over Bluetooth: the Bluetooth mark in the lamp's place, lit the
 * way the lamp would be. Blue, not green, while the unit answers, to match
 * the blue CONNECTED beside it; red while it does not, as the lamp is; dim
 * while it has not been asked yet. A Bluetooth mark that stayed blue over a
 * unit that had stopped answering would be the bar saying all is well in the
 * one place that exists to say when it is not.
 */
function BluetoothMark({ state }) {
  const tint = state === 'good' ? color.ble : state === 'fault' ? color.fault : color.silkFaint
  return (
    <Image
      source={bluetoothIcon}
      accessible={false}
      resizeMode="contain"
      /* 14 high to read as the mark, and in the dot's 10 of width (the mark itself is
         about 8 wide), so the unit's name does not jump sideways when Bluetooth comes on. */
      style={{ width: 14, height: 14, marginHorizontal: -2, tintColor: tint }}
    />
  )
}

const ofDeviceName = (s) => s.deviceName
const ofPreset = (s) => s.preset
const ofUnsaved = (s) => s.unsaved
const ofUnitState = (s) => s.unit
const ofAllBlocks = (s) => s.allBlocks

/**
 * Over Bluetooth, under the pill: which adapter, and Turn off Bluetooth. A tap
 * on it puts it away.
 *
 * It used to say which computer too, from the word CONNECTED ("Connected to
 * MacBook Pro", with Try now when it had stopped answering). The pill says the
 * computer on its second line now and opens Which unit or Phone & computer
 * instead, where Look for the computer again is. Over Bluetooth there is one
 * adapter and nothing to switch to, so this note, and the switch back to the
 * computer, stay one tap from the bar.
 */
function Which({ link, onClose }) {
  const adapter = link?.macName || 'the adapter'
  const said =
    link?.link === 'connected'
      ? `Connected over Bluetooth, through ${adapter}.`
      : link?.link === 'joining'
        ? `Finding ${adapter}…`
        : 'Not connected to the Bluetooth adapter.'
  return (
    <Pressable
      /* Not one element to a screen reader, or VoiceOver reads the note as
         a single button and never reaches Turn off Bluetooth inside it. The
         pill above closes it again. */
      accessible={false}
      onPress={onClose}
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        top: '100%',
        zIndex: 3,
        gap: space.md,
        padding: space.lg,
        borderBottomWidth: 1,
        borderBottomColor: color.rule,
        backgroundColor: color.panelHi
      }}
    >
      <Text style={{ color: color.silk, fontSize: font.body }}>{said}</Text>
      {/*
        TURN OFF BLUETOOTH, from the pill that says it is on. "Make it so you
        can click the connected button at the top of the screen and have a
        button that pop up that says turn off Bluetooth." The same switch as
        the page's Stop and the waiting screen's Use the computer instead,
        in every state of the link: the phone goes looking for the computer
        the moment it is off (App.js).
      */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Turn off Bluetooth"
        accessibilityHint="The phone goes back to using the computer"
        onPress={() => {
          tick()
          fire('press Turn off Bluetooth', () => setBluetooth(false))
          onClose()
        }}
        style={({ pressed }) => ({
          alignSelf: 'flex-start',
          minHeight: 44,
          justifyContent: 'center',
          paddingHorizontal: space.lg,
          borderRadius: radius.md,
          borderWidth: 1,
          borderColor: color.rule,
          backgroundColor: pressed ? color.panel : color.chassis
        })}
      >
        <Text style={{ color: color.silk, fontSize: font.body }}>Turn off Bluetooth</Text>
      </Pressable>
    </Pressable>
  )

}

/** What a save from the bar came to, under the bar; a tap puts it away. */
function Saved({ said, onClear }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${said.text} Dismiss`}
      onPress={onClear}
      style={{
        position: 'absolute',
        left: space.lg,
        right: space.lg,
        top: '100%',
        zIndex: 2,
        borderLeftWidth: 3,
        borderLeftColor: said.tone === 'warn' ? color.fault : color.ok,
        backgroundColor: color.panelHi,
        paddingVertical: space.sm,
        paddingHorizontal: space.md
      }}
    >
      <Text style={{ color: color.silk, fontSize: font.small }}>{`${said.text}  ✕`}</Text>
    </Pressable>
  )
}

/** A save from the bar that the computer has not answered yet, and a way out. */
function Late({ onCancel, picked = false }) {
  return (
    <View
      style={{
        position: 'absolute',
        left: space.lg,
        right: space.lg,
        top: '100%',
        zIndex: 2,
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.md,
        borderLeftWidth: 3,
        borderLeftColor: color.ok,
        backgroundColor: color.panelHi,
        paddingVertical: space.sm,
        paddingHorizontal: space.md
      }}
    >
      <Text style={{ flex: 1, color: color.silk, fontSize: font.small }}>{picked ? SAVE_WORKING_WORDS : SAVE_LATE_WORDS}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Cancel the save"
        hitSlop={8}
        onPress={() => {
          tick()
          onCancel()
        }}
        style={({ pressed }) => ({
          minHeight: 36,
          justifyContent: 'center',
          paddingHorizontal: space.md,
          borderRadius: radius.md,
          borderWidth: 1,
          borderColor: color.rule,
          backgroundColor: pressed ? color.panel : color.chassis
        })}
      >
        <Text style={{ color: color.silk, fontSize: font.small }}>Cancel</Text>
      </Pressable>
    </View>
  )
}

/**
 * A volume that would not take, said on the bar that owns the speaker.
 *
 * Small and absolutely positioned under the bar rather than in it: the bar is
 * one line and has to stay one line, and a failure here is rare enough that it
 * can afford to sit over the top of the screen for as long as it takes to read.
 */
function Reported({ said, onClear }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Dismiss"
      onPress={onClear}
      style={{
        position: 'absolute',
        left: space.lg,
        right: space.lg,
        top: '100%',
        zIndex: 2,
        borderLeftWidth: 3,
        borderLeftColor: color.fault,
        backgroundColor: color.panelHi,
        paddingVertical: space.sm,
        paddingHorizontal: space.md
      }}
    >
      <Text style={{ color: color.silk, fontSize: font.small }}>{`${said}  ✕`}</Text>
    </Pressable>
  )
}

import { useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { color, font, radius, space } from '../lib/theme'
import { NOT_CONNECTED } from '../lib/relay-rules'
import { sceneColor } from '../lib/sceneColors'
import { thud } from '../lib/feedback'
import { STAGE_GAP, STAGE_TOP, STAGE_TUNER, STAGE_VIEW_DONE, STAGE_VIEW_NAME, bigType, stageNext, stagePlan, stageShares, stageTempo } from '../lib/stageView'
import { NOTES_NAME } from '../lib/songNotes'
import Press from './Press'
import Tile from './Tile'
import { TunerStrip } from './Tuner'
import { NotesPage } from './SongNotes'

/*
 * STAGE VIEW, DRAWN (lib/stageView says what it is for and does the sums).
 *
 * Laid over Play's own page by screens/Stage.js, which hands it everything:
 * what the unit is on, and Play's own Previous, Next, scene and tuner
 * calls. So nothing in this file reads the rig or sends to it, and a press
 * here is a press on Play: same guards, same words when the link is down,
 * same song set up after a Next.
 *
 * WHAT IS ON IT, top to bottom:
 *   a short row    Done (back to Play), the tempo, Notes where the setlist's
 *                  songs have them, and Tuner where this unit has one;
 *   the tuner      as a strip, only while the tuner is on;
 *   the words      the slot, the preset's name as big as the room takes on
 *                  at most two lines, the scene, and what comes next, with
 *                  Previous and Next down the two edges on a wide screen
 *                  (lib/stageView STAGE_EDGES_AT) or as two wide buttons
 *                  under the words on a narrow one;
 *   the scenes     one row of big buttons in their own colours (two rows
 *                  where one would make them thinner than a thumb).
 *
 * THE SIZES COME FROM THE ROOM, measured here, never from the kind of
 * device: the same view is right on a phone on a mic clip and a tablet on
 * a stand. The native side is told to shrink a line that still runs over
 * and to end it in an ellipsis past that, so a name is never cut bare.
 *
 * WITH THE LINK DOWN it says NOT CONNECTED in the top row, in Play's own
 * word, and its buttons dim as Play's do; a press is still answered by
 * Play ("Not sent"), since it is Play's press.
 */
export default function StageView({
  presetName = '',
  presetSlot = '',
  presetNumber = null,
  /* The scene the unit is on (0-based), its names, and how many it has (0: a unit with no scenes). */
  scene = null,
  sceneNames = [],
  sceneCount = 0,
  onScene,
  /* Play's own step: -1 or 1. `canPrevious` and `canNext` are whether it has anywhere to go. */
  onStep,
  canPrevious = false,
  canNext = false,
  /* lib/setlists previousWords and nextWords, as under Play's own buttons. */
  behind = null,
  ahead = null,
  /* Whether Previous and Next are stepping through a setlist's songs. */
  setlist = false,
  bpm = null,
  /* The tuner: offered where the unit has one, on, the reading, and Play's own toggle. */
  tunerOffered = false,
  tunerOn = false,
  tuning = null,
  onTuner,
  /* The link to the rig is down, and how far Play dims for it. */
  down = false,
  dim = 0.35,
  /* Whether this account has song notes and a setlist is on (lib/songNotes notesOffered). */
  notes = false,
  onDone
}) {
  const insets = useSafeAreaInsets()
  const [room, setRoom] = useState({ width: 0, height: 0 })
  const [notesUp, setNotesUp] = useState(false)
  const showNotes = notes && notesUp
  const pad = space.lg
  const plan = stagePlan({ width: room.width, height: room.height, scenes: sceneCount, tuner: tunerOn, gap: STAGE_GAP, pad })
  const next = stageNext({ setlist, canStep: canNext, ahead })
  const sceneSays = Number.isInteger(scene) && sceneCount > 0 ? [String(scene + 1), String(sceneNames[scene] || '').trim() || null].filter(Boolean).join(' · ') : ''
  /* With the notes up they take the lower part of the words' room, and the words fit themselves into what is left. */
  const wordsTall = showNotes ? Math.round(plan.words.height * 0.42) : plan.words.height
  const share = stageShares({ height: wordsTall, scene: !!sceneSays, next: !!next, slot: !!presetSlot, gap: space.sm })
  const wide = plan.words.width
  const nameSize = bigType({ text: presetName, width: wide, height: share.name, lines: 2, min: 24, max: 160 })
  const sceneSize = bigType({ text: sceneSays, width: wide, height: share.scene, lines: 1, min: 18, max: Math.max(18, Math.min(96, Math.round(nameSize * 0.7))) })
  const nextSays = next ? `${next.label}: ${next.name}` : ''
  const nextSize = bigType({ text: nextSays, width: wide, height: share.next, lines: 1, min: 14, max: 44 })
  const faded = down ? { opacity: dim } : null
  const hue = Number.isInteger(scene) ? sceneColor(scene, presetNumber) : null
  const tempo = stageTempo(bpm)

  /* Previous or Next: down an edge (`tall`), or one of two wide buttons in a row. Dim, never dead, with nowhere to go: the press is Play's, and Play says why. */
  const stepButton = (by, can, words, edge) => (
    <Pressable
      onPress={() => {
        thud()
        onStep?.(by)
      }}
      accessibilityRole="button"
      accessibilityLabel={words?.said || (by < 0 ? 'Previous' : 'Next')}
      accessibilityState={{ disabled: !can }}
      style={({ pressed }) => [
        {
          alignItems: 'center',
          justifyContent: 'center',
          gap: space.xs,
          paddingHorizontal: space.sm,
          /* The plain panel, not the glass: drawn the same in both looks, and solid enough to find from a stand. */
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: color.rule,
          backgroundColor: pressed ? color.panelHi : color.panel,
          opacity: !can ? 0.35 : pressed ? 0.7 : 1
        },
        edge ? { flex: 1 } : { flex: 1, height: plan.steps }
      ]}
    >
      <Text style={{ color: color.silk, fontSize: edge ? 56 : 30, fontWeight: '700', lineHeight: edge ? 60 : 34 }}>{by < 0 ? '‹' : '›'}</Text>
      <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} style={{ color: color.silk, fontSize: font.lead, fontWeight: '700' }}>
        {by < 0 ? 'Previous' : 'Next'}
      </Text>
      {edge && words?.shown ? (
        <Text numberOfLines={2} style={{ color: color.silkDim, fontSize: font.small, textAlign: 'center' }}>
          {words.shown}
        </Text>
      ) : null}
    </Pressable>
  )

  const words = (
    <View style={{ flex: 1, minWidth: 0, gap: space.sm }}>
      <View style={{ height: wordsTall, alignItems: 'center', justifyContent: 'center', gap: space.sm }}>
        {presetSlot ? (
          <Text numberOfLines={1} style={{ color: color.silkDim, fontSize: Math.max(font.small, Math.min(28, Math.round(share.slot * 0.7))), letterSpacing: 2, fontWeight: '600' }}>
            {presetSlot}
          </Text>
        ) : null}
        <Text
          accessibilityRole="header"
          numberOfLines={2}
          adjustsFontSizeToFit
          minimumFontScale={0.5}
          ellipsizeMode="tail"
          style={{ color: color.silk, fontSize: nameSize, lineHeight: Math.round(nameSize * 1.12), fontWeight: '800', textAlign: 'center' }}
        >
          {presetName || '…'}
        </Text>
        {sceneSays ? (
          <View style={{ alignItems: 'center', gap: space.xs }}>
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.5}
              ellipsizeMode="tail"
              accessibilityLabel={`Scene ${sceneSays.replace(' · ', ', ')}`}
              style={{ color: color.silk, fontSize: sceneSize, lineHeight: Math.round(sceneSize * 1.12), fontWeight: '700', textAlign: 'center' }}
            >
              {sceneSays}
            </Text>
            {/* The scene's own colour, as a rule under its name: the tile's colour would be dark letters on a dark screen. */}
            {hue ? <View style={{ width: Math.max(48, Math.round(sceneSize * 2)), height: 6, borderRadius: 3, backgroundColor: hue.fill }} /> : null}
          </View>
        ) : null}
        {next ? (
          <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} ellipsizeMode="tail" style={{ color: color.silkDim, fontSize: nextSize, fontWeight: '600', textAlign: 'center' }}>
            {nextSays}
          </Text>
        ) : null}
      </View>
      {showNotes ? (
        <View style={{ flex: 1, padding: space.md, borderRadius: radius.lg, borderWidth: 1, borderColor: color.rule, backgroundColor: color.panel }}>
          <NotesPage />
        </View>
      ) : null}
    </View>
  )

  return (
    <View
      accessibilityViewIsModal
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
        /* Over Play's page and its NOT CONNECTED word (1, drawn before this), and under Play's own notices (components/Toast, 2): a tap that could not be sent, or a preset the unit refused, is still said over this view, by the screen whose press it was. */
        zIndex: 1,
        backgroundColor: color.chassis,
        paddingLeft: insets.left,
        paddingRight: insets.right,
        paddingBottom: insets.bottom
      }}
    >
      <View style={{ flex: 1, padding: pad, gap: STAGE_GAP }} onLayout={(e) => setRoom({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}>
        {/* ------------------------------------------------------ the short row */}
        <View style={{ height: STAGE_TOP, flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
          <Press label={STAGE_VIEW_DONE} height={STAGE_TOP} onPress={onDone} accessibilityLabel={`${STAGE_VIEW_DONE}, back to Play from ${STAGE_VIEW_NAME}`} />
          <View style={{ flex: 1, alignItems: 'center' }}>
            {down ? (
              <Text accessibilityLiveRegion="polite" numberOfLines={1} style={{ color: color.fault, fontSize: font.lead, fontWeight: '700', letterSpacing: 2 }}>
                {NOT_CONNECTED}
              </Text>
            ) : tempo ? (
              <Text numberOfLines={1} style={{ color: color.silkDim, fontSize: font.lead, fontWeight: '600' }}>
                {tempo}
              </Text>
            ) : null}
          </View>
          {notes ? <Press label={NOTES_NAME} height={STAGE_TOP} tone="signal" on={notesUp} onPress={() => setNotesUp((up) => !up)} /> : null}
          {tunerOffered ? <Press label={tunerOn ? 'Stop tuner' : 'Tuner'} height={STAGE_TOP} tone="live" on={tunerOn} onPress={onTuner} style={tunerOn ? undefined : faded} /> : null}
        </View>

        {/* ------------------------------------------------------ the tuner, as a strip */}
        {tunerOn ? <TunerStrip reading={tuning} down={down} tall={STAGE_TUNER} /> : null}

        {/* ------------------------------------------------------ the words, with Previous and Next */}
        {room.width > 0 ? (
          plan.edges ? (
            <View style={{ flex: 1, flexDirection: 'row', gap: STAGE_GAP }}>
              <View style={[{ width: plan.edge }, faded]}>{stepButton(-1, canPrevious, behind, true)}</View>
              {words}
              <View style={[{ width: plan.edge }, faded]}>{stepButton(1, canNext, ahead, true)}</View>
            </View>
          ) : (
            <>
              <View style={{ flex: 1 }}>{words}</View>
              <View style={[{ flexDirection: 'row', gap: STAGE_GAP }, faded]}>
                {stepButton(-1, canPrevious, behind, false)}
                {stepButton(1, canNext, ahead, false)}
              </View>
            </>
          )
        ) : (
          <View style={{ flex: 1 }} />
        )}

        {/* ------------------------------------------------------ the scenes */}
        {sceneCount > 0 && plan.scenes.cols > 0 ? (
          <View style={[{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }, faded]}>
            {Array.from({ length: sceneCount }, (_, i) => {
              const tint = sceneColor(i, presetNumber)
              return (
                <Tile
                  key={i}
                  caption={String(i + 1)}
                  label={sceneNames[i] || ''}
                  bar
                  fill={tint.fill}
                  ink={tint.ink}
                  picked={tint.picked}
                  on={i === scene}
                  height={plan.sceneTall}
                  haptic={thud}
                  onPress={() => onScene?.(i)}
                  ring
                  wrap
                  fit
                  fitCap={30}
                  style={{ width: plan.scenes.wide }}
                />
              )
            })}
          </View>
        ) : null}
      </View>
    </View>
  )
}

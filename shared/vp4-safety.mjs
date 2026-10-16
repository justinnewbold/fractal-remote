/**
 * WHAT THE APP KEEPS AWAY FROM A VP4, at both ends.
 *
 * "I didn't know that those settings didn't work on the VP4. I thought that
 * they did, so yeah, if they don't, we need to put that in there for now."
 *
 * Nobody on the project has a VP4, and the computer app that talks to one has
 * been sending it things that are dangerous for a unit nobody is watching:
 *
 *   - THE CHAIN AND THE KNOBS. On the computer apps out there now (1.87.4 and
 *     every one since, until the one that carries the fixed VP4 driver), GET
 *     /preset/blocks and GET /preset/blocks/:n/params on a VP4 run the gen-3
 *     preset read. It sends the Axe-Fx III's grid request and then polls every
 *     one of up to 46 blocks with a request nobody has seen a VP4 answer — the
 *     shape of the sweep that froze an AM4 until it was switched off and on.
 *     A phone asks for the chain after every scene change. GET /preset/grid
 *     reads the VP4 by the one record VP4-Edit itself polls, and carries the
 *     same chain, so on a VP4 the chain is asked for there, and a block's knobs
 *     are not asked for at all: there is no safe way to read them. On those
 *     same old computer apps a grid read whose record does not come still falls
 *     back to the sweep (their VP4 driver's grid() goes on to the gen-3 read),
 *     so it is fewer sweeps, not none: GET /preset/blocks swept every time. On
 *     the computer app with the fixed driver it never falls back.
 *
 *   - SAVE. The only save a VP4 has ever been seen to accept saves to Y1,
 *     whatever slot was picked, and the computer apps out there send exactly
 *     that. So neither end saves on a VP4, and both say why.
 *
 * The computer app that carries the fixed driver answers the same requests
 * the same safe way (the chain from that one record, knobs and save refused in
 * these words), so a phone on an old computer and a phone on a new one see the
 * same thing. The demo is not a VP4 and is never stopped by any of this.
 *
 * Zero imports, so both ends carry it: the browser imports it, the phone gets
 * a generated copy (npm run sync:rules).
 */

/** The VP4's model byte, as /device/detect reports it in `modelId`. */
export const VP4_MODEL_ID = 0x14

/**
 * Whether a unit is a VP4: a /device/detect answer (by its model byte, or by
 * its short name the way lib/device-slug files it), or a slug already worked
 * out (`'vp4'`).
 */
export function isVp4(unit) {
  if (unit == null) return false
  if (typeof unit === 'string') return unit.toLowerCase().replace(/[^a-z0-9]/g, '') === 'vp4'
  if (unit.modelId === VP4_MODEL_ID) return true
  const label = unit.short || unit.name
  return typeof label === 'string' && label.toLowerCase().replace(/[^a-z0-9]/g, '') === 'vp4'
}

/* The words. "Yet", never "coming": nothing here is promised. */
export const VP4_NO_SAVE = 'The app can’t save on a VP4 yet. Save on the VP4 itself for now. Nothing was saved.'
export const VP4_NO_KNOBS = 'The app can’t show a VP4’s knobs yet. Turn them on the VP4 itself for now.'

/**
 * The chain a VP4's GET /preset/grid lists, in the shape GET /preset/blocks
 * answers for a four-slot chain: one row, columns 1 to 4 in slot order. Bypass
 * and channel are not in that record, so both are null — unknown, never
 * guessed; a tile keeps what it already shows for a null.
 */
export function vp4BlocksFromGrid(grid) {
  const cells = Array.isArray(grid?.cells) ? grid.cells : []
  return cells
    .filter((c) => c && !c.isShunt && Number.isInteger(c.effectId) && Number.isInteger(c.col) && typeof c.slug === 'string' && c.slug)
    .map((c) => ({
      slug: c.slug,
      name: typeof c.name === 'string' && c.name ? c.name : c.slug,
      effectId: c.effectId,
      row: 1,
      col: c.col + 1,
      fromRows: [],
      bypassed: null,
      channel: null
    }))
}

/** A VP4 preset's own name for its place, A1 to Z4 (ForgeFX vp4PresetLabel), or null outside 0..103. */
export function vp4PresetCode(n) {
  if (!Number.isInteger(n) || n < 0 || n > 103) return null
  return `${String.fromCharCode(65 + Math.floor(n / 4))}${(n % 4) + 1}`
}

/**
 * The preset's own name off that same grid answer: the one name a VP4 can be
 * read for, the preset it is on. null when the answer carries none.
 */
export function vp4NameFromGrid(grid) {
  const name = typeof grid?.name === 'string' ? grid.name.trim() : ''
  return name ? name : null
}

/**
 * And the preset's four scene names, off the same answer. The record carries
 * them beside the preset's name, and both apps threw them away: the names
 * were asked for again by the routes a gen-3 answers them on, which a VP4
 * does not have (a 501, nothing sent), so a VP4's scene buttons said 1 to 4
 * over scenes the player had named. Trimmed, four at most, blank where a
 * scene has no name — a preset whose scenes are unnamed replaces the last
 * one's names with blanks rather than keeping them. null when the answer
 * carries no list at all.
 */
export function vp4SceneNamesFromGrid(grid) {
  if (!Array.isArray(grid?.scenes)) return null
  return grid.scenes.slice(0, 4).map((n) => (typeof n === 'string' ? n.trim() : ''))
}

/*
 * WHAT A VP4'S RECORD MAY DO TO THE PRESET ON SCREEN, the same at both ends
 * (mobile/src/lib/rig.js vp4NameFor, src/lib/deviceState.js takeVp4Name).
 * The record names the preset the VP4 is on and never its place, so the name
 * goes onto the place on screen only when nothing else can have moved the
 * VP4 in between: on the first read after this app's own Program Change
 * landed there (`owed` is that place), or while the name up is only a stand-in
 * (blank, still coming, or the place's own A1 to Z4). Any later read that
 * names another preset means the VP4 changed preset by itself (its own
 * footswitch, or VP4-Edit), and that read leaves the place unknown, as an
 * unseen Program Change does: "PRESET — OF 104" over the new name, and no row
 * in the list playing. Kept on the place, it was "PRESET 004 B1 / Fuzz Wall"
 * with Fuzz Wall nowhere near B1, and the list said B1 was Fuzz Wall too.
 *
 * `p` is the preset on screen, `number` the place the read was for (the one
 * on screen when it was asked), `name` the record's (vp4NameFromGrid). null
 * when nothing changes; otherwise the name to put up, and `place`: the
 * place to put it on, or null for unknown.
 */
export function vp4RecordNames(p, number, name, owed = null) {
  if (!name) return null
  const at = p?.number ?? null
  if (p && at !== (number ?? null)) return null
  if (p && p.name === name && !p.pending && !p.empty) return null
  if (!Number.isInteger(at)) return { name, place: null }
  const standIn = !p.name || Boolean(p.pending) || Boolean(p.empty) || p.name === vp4PresetCode(at)
  return { name, place: at === owed || standIn ? at : null }
}

/**
 * Whether an error (or its words) is one of a VP4's refusals: marked at this
 * end (vp4Refusal, vp4Said), or the computer's own sentence about a VP4. Play
 * says these over the screen rather than in the page (Gig), and the fault's
 * help link leaves them alone (troubleshooting fixFor).
 */
export const aboutVp4 = (err) =>
  Boolean(err && typeof err === 'object' && (err.vp4 || err.cause?.vp4)) || /\bVP4\b/.test(String(typeof err === 'string' ? err : err?.message ?? ''))

/** A refusal in words. No status, so nothing remembers it as "unsupported". */
export function vp4Refusal(words) {
  const err = new Error(words)
  err.vp4 = true
  return err
}

/**
 * What happens to one request when the unit is a VP4:
 *   { refuse: words } — not sent; refused in these words;
 *   { path, answer }  — `path` is asked instead, and `answer` turns its reply
 *                       into what the request would have answered;
 *   { local }         — not sent; `local` is the answer;
 *   null              — sent as it is.
 *
 * A STORED PRESET'S NAME is `local`, and unknown. No computer app can read a
 * VP4's preset names, and they all answer "" for one — which every list in
 * both apps draws as "Empty", 104 times, over presets that are not. Asked
 * for by number as each row scrolls in, too. So it is not asked, and the
 * answer is null: no name known, so the row shows its slot (A1 … Z4).
 */
export function vp4Route(method, path) {
  const m = String(method || 'GET').toUpperCase()
  const p = String(path || '').split('?')[0].replace(/\/+$/, '')
  const named = m === 'GET' ? /^\/presets\/(\d+)$/.exec(p) : null
  if (named) return { local: { number: Number(named[1]), name: null } }
  if (m === 'GET' && p === '/preset/blocks') return { path: '/preset/grid', answer: vp4BlocksFromGrid }
  if (m === 'GET' && /^\/preset\/blocks\/\d+\/params$/.test(p)) return { refuse: VP4_NO_KNOBS }
  if (m === 'POST' && p === '/preset/store') return { refuse: VP4_NO_SAVE }
  return null
}

/* ================================================== presets and scenes, by MIDI == */

/*
 * PRESETS AND SCENES ON A VP4, THE WAY A FOOT CONTROLLER DOES THEM.
 *
 * "Wouldn't they just use the same type of commands as the AM4 ... I'm not
 * sure why it wouldn't be possible to have the scenes go forward and
 * backwards that work immediately out of the box ... without having to test
 * it."
 *
 * Underneath, a VP4 does speak the AM4's language, but the AM4's scene and
 * preset switches are messages a VP4 has been seen to take once (one scene,
 * written down, the bytes lost), and nobody here has a VP4 to try them on.
 * A message that looked right is what froze an AM4 until it was switched off
 * and on. So the computer app that knows how sends the VP4 what Fractal's own
 * VP4 manual documents, the two messages every MIDI foot controller sends:
 *
 *   - PRESETS: a Program Change, A1 to Z4, on MIDI channel 1 unless the
 *     player set another. Nothing to set up. The computer reads the preset
 *     before and after, and says it landed only when the name, the scene
 *     names or the effects changed; otherwise it says it could not confirm.
 *   - SCENES: Scene Select, a number with no factory setting. The player picks
 *     one on the VP4 (SETUP > MIDI/Remote > Scene Select) and types the same
 *     one into the app, which sends it with every scene tap. Until then a
 *     scene tap sends nothing and says how to set it up. A scene the VP4 did
 *     not show is "sent, not confirmed", and the app stops using that number
 *     until the player saves it again.
 *
 * The number and the channel are kept on the phone or in the browser the
 * player sets them on, per unit, and travel as extra fields in the scene and
 * preset requests: every computer app since 1.87.4 lets those requests
 * through and ignores fields it does not know. A computer app too old to do
 * any of this is told apart by its unit's capabilities (plainMidi), and a VP4
 * tap on one says to update it rather than the bare "unsupported".
 *
 * These are the computer's sentences too (ForgeFX src/drivers/vp4.ts): both
 * test suites check the same literal strings, since no test can hold two
 * repositories to each other.
 */

/** Where the player sets the numbers, as both ends name it. */
export const VP4_SETUP_TITLE = 'VP4 scenes & presets'
/* The same, under the name the Settings rows use: the tests that hold the two front lists together read a row's title as a quoted string or a capitals-only name. */
export const MIDI_SETUP_TITLE = VP4_SETUP_TITLE
export const VP4_SETUP_PLACE = `Settings > ${VP4_SETUP_TITLE}`

export const VP4_SCENES_NOT_SET_UP = `To change a VP4’s scenes from the app, set one number on the VP4 first: SETUP > MIDI/Remote > Scene Select. Then type the same number in the app, in ${VP4_SETUP_PLACE}.`
export const VP4_NEEDS_USB = 'The app can change a VP4’s scenes and presets only through the VP4’s USB cable to the computer.'
/*
 * A Program Change the VP4's record did not move after. Two setlist songs on
 * one preset send the same one twice, and the second loads it again: nothing
 * moves, and nothing is wrong. Said first, so a player is not sent into the
 * VP4's menus mid-set over nothing.
 */
export const vp4PresetUnconfirmed = (channel) =>
  `Sent, but the app couldn’t confirm the VP4 changed preset. If it was already on that preset, it loaded it again. If not, on the VP4: SETUP > MIDI/Remote, Receive MIDI PC ON, MIDI Channel ${channel} or OMNI.`
/*
 * And the case the computer can tell (`again` in its answer): the VP4 looked,
 * before, just as it did when the same preset last landed. Not raised as a
 * fault at either end — it is what was asked for — and a setlist song's scene
 * still goes onto it (vp4PresetOn).
 */
export const VP4_PRESET_AGAIN = 'The VP4 was already on that preset, so it loaded it again.'
/* A Program Change or a scene the computer could only have sent late (behind a read the VP4 had not answered): nothing was sent. */
export const VP4_LATE = 'The computer was still waiting for the VP4 to answer, so it didn’t send this: it would have landed late. Nothing changed on the VP4. Tap it again.'
/* A knob or an on/off the computer refused because the VP4's preset does not list that effect. */
export const VP4_NOT_IN_CHAIN = 'That isn’t one of the effects in the preset the VP4 is on, so the app didn’t send anything to it.'

/**
 * Whether a VP4 preset answer means the VP4 is on the preset asked for, so a
 * setlist song's scene may go onto it: the computer saw it land, or saw that
 * it was on it already and loaded it again. Not when overtaken by a newer
 * press, and not when it could not tell (`landed: false` alone).
 */
export const vp4PresetOn = (answer) => Boolean(answer) && !answer.overtaken && (answer.landed === true || answer.again === true)
export const vp4SceneUnconfirmed = (scene, cc, channel) =>
  `Sent, but the VP4 didn’t show scene ${scene + 1}. On the VP4, check SETUP > MIDI/Remote: Scene Select is ${cc}, and MIDI Channel is ${channel} or OMNI. The app won’t send scenes on ${cc} again until you save it again in ${VP4_SETUP_PLACE}.`
export const vp4SceneHeld = (cc) =>
  `The app has stopped sending scenes on ${cc}, because the last scene it sent didn’t show on the VP4. Check SETUP > MIDI/Remote on the VP4, then save the number again in ${VP4_SETUP_PLACE}.`

/*
 * What a VP4 cannot do from the app, said in place of "unsupported". The
 * first is for a computer app from before this; the rest are true on any.
 * "Yet", never "coming".
 */
export const VP4_UPDATE_COMPUTER = 'Update the Fractal Remote app on your computer to change a VP4’s scenes and presets.'
/*
 * And the other way round: the computer app that changes a VP4's presets
 * refuses one from an app that sends no MIDI channel with it, which is an app
 * from before these rules (a phone that has not taken its update, a page left
 * open), since this one always sends it (vp4PresetFields). Such an app steps
 * slot by slot from the last preset it picked, and its relay can send a
 * preset twice. Said by the computer, so this end never shows it; kept here
 * so both suites check the same literal (ForgeFX VP4_UPDATE_APP).
 */
export const VP4_UPDATE_APP = 'Update the Fractal Remote app on your phone, or reload the page in your browser, to change a VP4’s presets.'
/*
 * And a scene from one of those apps, which sends neither the number nor the
 * channel (this one always sends the channel: vp4SceneFields). The words for
 * "no number yet" send the player to Settings > VP4 scenes & presets, a page
 * an old app does not have, so the computer says this instead. Said by the
 * computer too; the same literal in both suites (ForgeFX VP4_UPDATE_APP_SCENES).
 */
export const VP4_UPDATE_APP_SCENES = 'Update the Fractal Remote app on your phone, or reload the page in your browser, to change a VP4’s scenes.'
export const VP4_NO_TUNER = 'The app can’t open a VP4’s tuner yet. Use the tuner on the VP4 itself for now.'
/*
 * The looper. No computer app can work a VP4's looper (its driver has no
 * looper control, so each button is a 501), and both ends offered Rec, Play,
 * Stop and the rest under a pedal drawn lit. On a real VP4 the looper's pedal
 * opens this sentence and nothing else, and Settings has no "Stop the looper".
 * Not one of VP4_NOT_YET: nothing a buyer reads promises a looper.
 */
export const VP4_NO_LOOPER = 'The app can’t work a VP4’s looper yet. Use the looper on the VP4 itself for now.'
export const VP4_NO_TEMPO = 'The app can’t set a VP4’s tempo yet. Tap tempo on the VP4 itself for now.'
export const VP4_NO_CHANNELS = 'The app can’t change a VP4’s channels yet. Change them on the VP4 itself for now.'
export const VP4_NO_RENAME = 'The app can’t rename on a VP4 yet. Rename on the VP4 itself for now.'
export const VP4_NO_WHICH_PRESET = 'The app can’t tell which preset a VP4 is on yet.'
export const VP4_CANT_YET = 'The app can’t do that on a VP4 yet. Do it on the VP4 itself for now.'
/** Previous and Next with no setlist: a VP4 cannot say where it is, so there is no "next slot" to go to. */
export const VP4_NO_STEP = 'On a VP4, Previous and Next work in a setlist or your starred presets: the app can’t tell which preset the VP4 is on, so it can’t step slot by slot. Tap a preset in the list instead.'
/** The cost of tapping the preset already loaded, said where presets are picked. */
export const VP4_RELOAD = 'Tapping the preset the VP4 is already on loads it again, and changes you haven’t saved on the VP4 are lost.'
/*
 * Where the preset lists would promise names. No computer app can read a
 * VP4's stored names (vp4Route answers them here, as unknown), so the lists'
 * "the rest fill in as you scroll" and "press ⟳ to read them" were promises
 * nothing keeps: the rows stay A1 to Z4, and Refresh reads nothing. Said once
 * instead, the same at both ends, and their Refresh is not offered.
 *
 * It said "The one the VP4 is on shows its name once the app has read it",
 * which was untrue both ways. At the start the app has read it (Play says
 * "Big Room") but cannot tell which slot that is, so no row has it; and a
 * preset picked from the app keeps its name on its row (the browser writes
 * it down, and phones take that list in) after the VP4 has moved on. What
 * is true at both ends is the second sentence now: a name comes with a
 * preset picked from the app, once the VP4 has loaded it.
 */
export const VP4_NO_NAMES = 'The app can’t read the names of a VP4’s presets yet, so the list shows them as A1 to Z4. A preset you pick from the app shows its name once the VP4 has loaded it.'
/*
 * The pedals' on/off. The one record a VP4 is read by carries no on/off, and
 * every computer app answers `bypassed: null` for each of its effects — which
 * every tile at both ends drew as "On". On an effect that was really off, the
 * first tap then sent "off", nothing changed on the pedal, and the tile said
 * Off. So on a VP4 a pedal says nothing (the outline's blank, unlit) until a
 * tap of the player's own sets it, and a scene change, which moves the VP4's
 * on/offs, makes them unknown again. The tap is still allowed; it turns the
 * effect off first, and the tile then says what was sent. Said once, under
 * the pedals.
 */
export const VP4_ON_OFF_UNKNOWN = 'The app can’t see whether a VP4’s effects are on or off. A pedal shows On or Off once you’ve tapped it.'
/*
 * What the edit screens offer that a VP4 can't do from the app: moving and
 * adding effects, the modifiers, and renaming. Said once where those rows were.
 */
export const VP4_NO_EDITS = 'The app can’t add, move or remove a VP4’s effects, set its modifiers, or rename its presets and scenes yet. Do those on the VP4 itself for now.'

/**
 * A VP4's capabilities as the screens see them: no channels. A computer app
 * reports a VP4's channels A to D (they are in the codec's description of
 * it), so Play said "Hold to switch channels", a hold opened A to D with
 * "the scene remembers which one this block plays", and only the choice was
 * refused. Nothing can switch a VP4's channel from the app, so nothing offers
 * it. Everything else, and what the computer can do (plainMidi), as it was.
 */
export function vp4ScreenCaps(caps) {
  if (!caps || typeof caps !== 'object') return caps
  return { ...caps, hasChannels: false, channelNames: [] }
}

/** A unit as /device/detect answers it, with vp4ScreenCaps on its capabilities. */
export const vp4ScreenUnit = (unit) => (unit && typeof unit === 'object' && unit.capabilities ? { ...unit, capabilities: vp4ScreenCaps(unit.capabilities) } : unit)

/*
 * THE SETUP CARD, every word of it, so the phone and the browser cannot word
 * it differently.
 */
export const VP4_SETUP = {
  title: VP4_SETUP_TITLE,
  status: {
    off: 'Scenes: not set up yet',
    /* No Scene Select number, but a MIDI channel other than the VP4's own 1, saved for the presets. */
    offChannel: (channel) => `Scenes: not set up yet · MIDI channel ${channel}`,
    on: (cc, channel) => `Scene Select ${cc} · MIDI channel ${channel}`,
    held: (cc) => `Stopped: ${cc} didn’t work last time`,
    update: 'Update the computer app first'
  },
  intro:
    'The app changes a VP4’s presets and scenes with the same MIDI messages a foot controller sends. This is new, and nobody on our side has tried it on a VP4 yet.',
  /*
   * It said "Presets need nothing set up", above a channel box that could not
   * be saved without a Scene Select number: a VP4 moved off channel 1 could
   * not get its presets from the app at all. The channel saves on its own now
   * (saveVp4Setup), and this says when it is needed.
   */
  presets:
    'Presets: tap A1 to Z4 in the preset list. On the VP4, SETUP > MIDI/Remote: Receive MIDI PC must be ON. If you changed the VP4’s MIDI channel from 1, type it below and save. The Scene Select number can stay empty.',
  scenesHead: 'Scenes',
  steps: [
    'On the VP4, open SETUP > MIDI/Remote > Scene Select.',
    'Set it to a number from 1 to 119 (not 32).',
    'Type the same number below, and save.'
  ],
  freeNumber:
    'Pick a number nothing else on your VP4 uses: not the volume, the tuner, an effect’s on/off or channel, or the footswitch mode. Each scene change sends 0 to 3 on that number, and anything else set to it moves too.',
  numberLabel: 'Scene Select number',
  channelLabel: 'MIDI channel',
  channelNote: 'The VP4’s MIDI channel is 1 unless you changed it (SETUP > MIDI/Remote > MIDI Channel). If it is set to OMNI, leave this at 1.',
  save: 'Save',
  clear: 'Forget the number',
  saved: 'Saved. Scene taps now send Scene Select on this number.',
  /* A save with the number left empty: the channel only. */
  savedChannel: 'Saved. Presets now go on this MIDI channel. Scene taps send nothing until a Scene Select number is saved.',
  cleared: 'Forgotten. Scene taps send nothing until a number is saved.',
  badNumber: 'Scene Select is a number from 1 to 119, and not 32.',
  badChannel: 'The MIDI channel is a number from 1 to 16.',
  reload: VP4_RELOAD,
  update: VP4_UPDATE_COMPUTER,
  heldNote: (cc) => vp4SceneHeld(cc)
}

/** Below 3.00 a VP4 could drop MIDI messages sent close together (fixed in 3.00 beta 2). */
export function vp4OldFirmware(version) {
  const m = /^\s*(\d+)\.(\d+)/.exec(String(version ?? ''))
  if (!m) return null
  if (Number(m[1]) >= 3) return null
  return `This VP4 is on firmware ${m[1]}.${m[2]}. Before 3.00 a VP4 could miss MIDI messages sent close together, so update it with Fractal-Bot first.`
}

/** A MIDI channel as a player counts them: 1..16. */
export const vp4ChannelOk = (ch) => Number.isInteger(ch) && ch >= 1 && ch <= 16
/** A Scene Select number that may go out: 1..119, and not 32 (0 and 32 choose a bank; 120 up are MIDI's own). */
export const vp4SceneCcOk = (n) => Number.isInteger(n) && n >= 1 && n <= 119 && n !== 32

/** What was typed, as a whole number, or null: "34" is 34, "34.5", "3x" and "" are nothing. */
export function vp4Typed(text) {
  const s = String(text ?? '').trim()
  return /^\d{1,3}$/.test(s) ? Number(s) : null
}

/* ------------------------------------------------------------- kept per unit -- */

const SETUP_KEY = (slug) => `fractal.vp4-midi.${String(slug || 'vp4')}`
const NONE = Object.freeze({ sceneCc: null, midiChannel: 1, savedAt: 0, held: false })

/**
 * The player's VP4 numbers, from `storage` (localStorage in the browser, the
 * phone's sync store): the Scene Select number or null, the channel (1 when
 * none was saved), when they were saved, and whether the number is held after
 * a scene that did not show. Anything unreadable is "not set up".
 */
export function readVp4Setup(storage, slug) {
  let raw = null
  try {
    raw = JSON.parse(storage?.getItem?.(SETUP_KEY(slug)) || 'null')
  } catch {
    raw = null
  }
  if (!raw || typeof raw !== 'object') return { ...NONE }
  const sceneCc = vp4SceneCcOk(raw.sceneCc) ? raw.sceneCc : null
  const midiChannel = vp4ChannelOk(raw.midiChannel) ? raw.midiChannel : 1
  const savedAt = Number.isFinite(raw.savedAt) ? raw.savedAt : 0
  return { sceneCc, midiChannel, savedAt, held: sceneCc !== null && raw.held === true }
}

/** Nothing typed in a box: empty, blank, or never there. */
const leftEmpty = (typed) => typed === undefined || typed === null || String(typed).trim() === ''

/**
 * Save what the player typed. `{ ok, setup }`, or `{ ok: false, error }` in the
 * card's words, with nothing written. Saving again is what lets a held number
 * be used again: it is a new save.
 *
 * THE NUMBER LEFT EMPTY SAVES THE CHANNEL ALONE. It was refused ("Scene Select
 * is a number from 1 to 119"), so a VP4 on channel 2 that only wanted presets
 * could not have them: every Program Change went on channel 1, under a card
 * saying presets need nothing set up. Scenes stay exactly as gated as before —
 * no number, no scene (vp4SceneGate) — and a number typed wrong is still
 * refused rather than taken for empty.
 */
export function saveVp4Setup(storage, slug, { sceneCc, midiChannel } = {}, now = Date.now()) {
  const cc = leftEmpty(sceneCc) ? null : typeof sceneCc === 'number' ? sceneCc : vp4Typed(sceneCc)
  const ch = leftEmpty(midiChannel) ? 1 : typeof midiChannel === 'number' ? midiChannel : vp4Typed(midiChannel)
  if (cc !== null && !vp4SceneCcOk(cc)) return { ok: false, error: VP4_SETUP.badNumber }
  if (cc === null && !leftEmpty(sceneCc)) return { ok: false, error: VP4_SETUP.badNumber }
  if (!vp4ChannelOk(ch)) return { ok: false, error: VP4_SETUP.badChannel }
  const setup = { sceneCc: cc, midiChannel: ch, savedAt: now, held: false }
  try {
    storage?.setItem?.(SETUP_KEY(slug), JSON.stringify(setup))
  } catch {
    /* A browser that refuses storage keeps it for this page only. */
  }
  return { ok: true, setup }
}

/**
 * Forget the number. The channel stays: it is what the presets go on now
 * that it can be saved without a number, and forgetting the scenes' number
 * must not move a VP4 on channel 2 back onto 1. Nothing kept, or channel 1,
 * and the whole record goes.
 */
export function clearVp4Setup(storage, slug, now = Date.now()) {
  const was = readVp4Setup(storage, slug)
  try {
    if (was.midiChannel !== 1) storage?.setItem?.(SETUP_KEY(slug), JSON.stringify({ sceneCc: null, midiChannel: was.midiChannel, savedAt: now, held: false }))
    else storage?.removeItem?.(SETUP_KEY(slug))
  } catch {
    /* nothing kept to forget */
  }
}

/**
 * The number did not show: hold it, but only the save that was sent. A save
 * made since is a new one, and is not held by an answer to the old one.
 */
export function holdVp4Setup(storage, slug, savedAt) {
  const now = readVp4Setup(storage, slug)
  if (now.sceneCc === null || now.savedAt !== savedAt || now.held) return now
  const held = { ...now, held: true }
  try {
    storage?.setItem?.(SETUP_KEY(slug), JSON.stringify(held))
  } catch {
    /* held for this page only */
  }
  return held
}

/** What the card's row says. */
export function vp4SetupStatus(setup, caps) {
  if (!vp4ComputerCan(caps)) return VP4_SETUP.status.update
  if (!setup?.sceneCc) return vp4ChannelOk(setup?.midiChannel) && setup.midiChannel !== 1 ? VP4_SETUP.status.offChannel(setup.midiChannel) : VP4_SETUP.status.off
  if (setup.held) return VP4_SETUP.status.held(setup.sceneCc)
  return VP4_SETUP.status.on(setup.sceneCc, setup.midiChannel)
}

/* ------------------------------------------------------------ on the wire -- */

/** Whether the computer's app can change a VP4's scenes and presets: its unit says plainMidi. */
export const vp4ComputerCan = (caps) => caps?.plainMidi?.programChange === true && caps?.plainMidi?.sceneSelect === true

/*
 * WHAT PREVIOUS AND NEXT SAY on a VP4 with no setlist and no stars, at both
 * ends (mobile/src/screens/Stage.js, src/components/Gig.jsx). VP4_NO_STEP
 * sends the player to a setlist, the stars or the list. On a computer app
 * that can't change a VP4's presets at all (every one from before plainMidi,
 * where most VP4 owners are until theirs restarts into the new one) all
 * three end in "update the computer app": a setlist Next says it, and the
 * list shows only it. So there it says only that.
 */
export const vp4StepWords = (caps) => (vp4ComputerCan(caps) ? VP4_NO_STEP : VP4_UPDATE_COMPUTER)

/*
 * AND WHAT THE RED LINE IS TOLD ABOUT IT. "The red line only shows when the
 * phone really needs something the computer doesn't have yet." A VP4 on a
 * computer app that does not say plainMidi is exactly that, for this one
 * unit: a scene or preset tap says to update the computer app, and the red
 * line on YOUR COMPUTER and the version check on the help page it links to
 * said "That is fine", because a computer from 1.87.23 on is new enough for
 * everything else. So both hear it from here (link-chain.mjs computer.lacks,
 * troubleshooting.mjs versionsInSync), decided by what the computer says it
 * can do for the VP4 on it. Not by raising COMPUTER_NEEDED: that would send
 * every FM3, AM4, FM9 and Axe-Fx III owner looking for an update their unit
 * does not need. `onRealVp4` is false in the demo and over Bluetooth, so
 * neither ever hears it.
 */
export const VP4_COMPUTER_FOR = 'a VP4’s scenes and presets'
export const vp4ComputerLacks = (onRealVp4, caps) => (onRealVp4 && !vp4ComputerCan(caps) ? VP4_COMPUTER_FOR : null)

/** The extra fields a VP4 preset request carries: its channel, always — 1 with nothing set up. A
 *  computer that changes a VP4's presets sends nothing for a preset without one (VP4_UPDATE_APP). */
export const vp4PresetFields = (setup) => ({ midiChannel: vp4ChannelOk(setup?.midiChannel) ? setup.midiChannel : 1 })

/** And a scene request: the number, the channel, and which save of them this is. */
export const vp4SceneFields = (setup) => ({
  sceneCc: setup.sceneCc,
  midiChannel: vp4ChannelOk(setup.midiChannel) ? setup.midiChannel : 1,
  sceneCcSet: setup.savedAt
})

/**
 * Whether a VP4 scene tap may go, before anything is sent: null when it may,
 * or the words. A computer too old to do it, no number yet, or a number held
 * after a miss: nothing is sent.
 */
export function vp4SceneGate(setup, caps) {
  if (!vp4ComputerCan(caps)) return VP4_UPDATE_COMPUTER
  if (!setup || !vp4SceneCcOk(setup.sceneCc)) return VP4_SCENES_NOT_SET_UP
  if (setup.held) return vp4SceneHeld(setup.sceneCc)
  return null
}

/** And a preset: only the computer's app has to be able to. */
export const vp4PresetGate = (caps) => (vp4ComputerCan(caps) ? null : VP4_UPDATE_COMPUTER)

/**
 * What a VP4 scene answer means for the number: true when it is to be held —
 * the computer sent it and the VP4 did not show it, or the computer has held
 * it already (a 428 for a number this end has set). An answer overtaken by a
 * newer tap says nothing about the number.
 */
export function vp4SceneMissed(answer, err, setup) {
  if (err) return err.status === 428 && vp4SceneCcOk(setup?.sceneCc)
  return Boolean(answer && answer.confirmed === false && !answer.overtaken)
}

/* ------------------------------------------- "unsupported", said in words -- */

/** Whether a failure is the computer saying "unsupported" (shared/unsupported.mjs's rule, here without an import). */
const said501 = (err) => err?.status === 501 || String(err?.message || '').trim().toLowerCase() === 'unsupported'

/** What a VP4 says in place of "unsupported", for each request that can meet one. */
export function vp4Words(method, path) {
  const m = String(method || 'GET').toUpperCase()
  const p = String(path || '').split('?')[0].replace(/\/+$/, '')
  if (m === 'POST' && (p === '/scene' || p === '/preset/select' || p === '/am4/scene' || p === '/am4/preset')) return VP4_UPDATE_COMPUTER
  if (p === '/tuner') return VP4_NO_TUNER
  if (p === '/preset/looper' || p.startsWith('/preset/looper/')) return VP4_NO_LOOPER
  if (p === '/tempo' || p.startsWith('/tempo/')) return VP4_NO_TEMPO
  if (/^\/preset\/blocks\/\d+\/channel$/.test(p) || p === '/am4/channel') return VP4_NO_CHANNELS
  if (m === 'POST' && (p === '/scene/name' || p === '/preset/name')) return VP4_NO_RENAME
  if (m === 'GET' && p === '/preset') return VP4_NO_WHICH_PRESET
  return VP4_CANT_YET
}

/**
 * A VP4's "unsupported", in words. The same refusal — status 501, so it is
 * still remembered and still recognised as "this unit cannot" — with a
 * sentence in place of the bare word, fresh or from memory. `quiet` on the
 * one a screen asks by itself on a timer (which preset it is on), so it is
 * not raised as a fault every time. Anything else comes back as it was.
 */
export function vp4Said(method, path, err) {
  if (!said501(err)) return err
  const words = vp4Words(method, path)
  const out = new Error(words)
  out.status = 501
  out.unsupported = true
  out.vp4 = true
  if (err?.remembered) out.remembered = true
  if (err?.kind) out.kind = err.kind
  if (words === VP4_NO_WHICH_PRESET) out.quiet = true
  return out
}

/* ================================================= what a buyer is told == */

/*
 * WHAT THE APP DOES ON A VP4, said wherever somebody decides whether to pay:
 * the purchase page at both ends, the demo's VP4, the download page and the
 * Description both stores show.
 *
 * "I didn't know that those settings didn't work on the VP4. I thought that
 * they did, so yeah, if they don't, we need to put that in there for now."
 *
 * Every one of those places named the VP4 among the units the app drives and
 * then promised it presets, scenes, the tuner and tap tempo, and the demo's VP4
 * did all of them. A VP4 owner could try the demo, see it all work, and pay
 * for a unit the app could only switch effects on. On the one screen where
 * money changes hands, that is the confident wrong fact about gear this
 * project refuses everywhere else, and Apple's 2.3.1(a) names it outright:
 * "promoting content or services that it does not actually offer".
 *
 * So it says what is true with the computer app that carries the VP4's
 * presets and scenes: effects on and off, presets, and scenes once the
 * player has set the one number. Presets and scenes are new and nobody here
 * has tried them on a VP4, so it says that too. And it names what does not
 * work, in "yet", never "coming": "coming" is a promise to somebody deciding
 * whether to pay, with no date and no tried way to keep it.
 *
 * The list of what does not work is the list the request rules above refuse
 * (vp4Route, vp4Words), and test/vp4-safety.mjs holds the words to them: the
 * day one of those starts working, these sentences move with it, or the
 * suite fails.
 */

/** What the app can't do on a VP4 yet, as every sentence below names it. */
export const VP4_NOT_YET = ['knobs', 'the tuner', 'tap tempo', 'channels', 'saving']

/*
 * AND WHAT IT CAN'T SHOW. Not refused like the five above — nothing is sent
 * and nothing fails — but a VP4 owner meets all three on the first screen:
 * the preset list says A1 to Z4 and no names (VP4_NO_NAMES), the pedals say
 * neither On nor Off until tapped (VP4_ON_OFF_UNKNOWN), and Previous and Next
 * do not step slot by slot (VP4_NO_STEP), because the app cannot tell which
 * preset a VP4 is on. The Description's WHAT IT DOES promises every unit
 * presets "by name, in slot order", so the VP4 line, just above it, says
 * which of that a VP4 does not get. The preset it is on is named, and so are
 * its scenes: both ride on the one record it is read by.
 */
export const VP4_CANT_SHOW = ['preset names', 'on or off']

/** The purchase page's line, at both ends, and the Description's and the download page's, word for word. */
export const VP4_SO_FAR =
  'On a VP4, the app turns effects on and off, changes presets, and changes scenes once you set one number on the VP4 itself. Changing presets and scenes is new on a VP4, and nobody on our side has tried it on one yet. Knobs, the tuner, tap tempo, channels and saving don’t work on a VP4 from the app yet. The app can’t show the names of a VP4’s presets, except the one it is on, or whether its effects are on or off, yet. On a VP4, Previous and Next go through a setlist or your starred presets, not slot by slot.'

/**
 * The demo's sentence when it is a VP4. The demo's VP4 does everything an FM3
 * does, so it says which of those a real one does not do from the app yet,
 * and what it shows that a real one does not (VP4_CANT_SHOW). And the two
 * things it does with nothing set up that a real one does not: its scenes
 * switch with no number set on the pedal, and its Previous and Next step slot
 * by slot (VP4_NO_STEP). It
 * leaves out the other units' "the models, knobs and ranges are the real
 * ones": a real VP4's knobs have no known ranges anywhere in this stack.
 */
export const VP4_DEMO =
  'This is a practice VP4. Nothing you do here touches a real unit. Knobs, the tuner, tap tempo, channels and saving work in this demo, but don’t work on a real VP4 from the app yet. The demo also shows preset names and whether effects are on or off, which the app can’t show on a real VP4 yet. On a real VP4, scenes need one number set on the VP4 first, and Previous and Next go through a setlist or your starred presets. Changing presets and scenes is new on a real VP4, and nobody on our side has tried it on one yet.'

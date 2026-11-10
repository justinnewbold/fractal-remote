/*
 * STAGE VIEW: Play, read from a distance.
 *
 * "Stage view: the preset name, scene and next song big enough to read from
 * a mic stand, with the tuner as a strip." (One of the ideas Justin said yes
 * to on 10 November 2026: "yes to all your other non build suggestions as
 * well".) A tablet on a stand or a phone on a mic clip is read from a metre
 * or two away and pressed without looking, so this view has three things
 * only: what you are on, in type as big as the screen takes; what comes
 * next; and Previous, Next and the scenes as buttons nobody can miss.
 *
 * IT IS PLAY'S OWN SCREEN, NOT A SECOND ONE. screens/Stage.js draws it over
 * its own page (components/StageView) and hands it its own Previous, Next,
 * scene and tuner calls, so every press goes exactly where Play's goes, with
 * every guard Play has (a VP4's rules, the demo, a link that is down, the
 * newest of two quick Nexts). Nothing here sends anything, and nothing new
 * is asked of the unit.
 *
 * WHO SEES IT is App.js's to say (his account until features
 * STAGE_VIEW_FOR_EVERYONE): `stageViewOn` is that one answer.
 *
 * What follows is the arithmetic, kept apart so it can be tested: how big
 * the type may be in the room it has, how the scenes sit in a row, and what
 * the line about what comes next says. Nothing here imports anything.
 */

/** Whether an account is shown Stage view at all: his, or everyone once the switch is on. */
export const stageViewOn = ({ admin = false, everyone = false } = {}) => admin === true || everyone === true

/** App.js's word for the screen. */
export const STAGE_VIEW = 'stageview'
/** Its name, on the button that opens it and in Settings. */
export const STAGE_VIEW_NAME = 'Stage view'
/** Under that name in Settings. */
export const STAGE_VIEW_SUB = 'Your preset, scene and what’s next, big enough to read from a stand'
/** The way back. */
export const STAGE_VIEW_DONE = 'Done'

/** From this width (points) Previous and Next are the two edges of the screen; under it they are two wide buttons in a row. */
export const STAGE_EDGES_AT = 600
/** The least a scene's button may be across: a thumb, or the ball of a foot on a floor tablet. */
export const STAGE_SCENE_LEAST = 72
/** How tall the row of small things at the top is (Done, tempo, Tuner): the app's own 56-point tap. */
export const STAGE_TOP = 56
/** How tall the tuner's strip is while the tuner is on. */
export const STAGE_TUNER = 72
/** The gap between the parts. */
export const STAGE_GAP = 12

const pts = (n) => Math.max(0, Number(n) || 0)
const whole = (n) => Math.max(0, Math.floor(Number(n)) || 0)

/*
 * HOW WIDE A LETTER IS, AS A SHARE OF ITS SIZE. The system's bold face runs
 * about 0.56 of its size a letter over ordinary names (capitals and digits
 * are wider, i and l narrower); 0.6 errs wide, so a name fitted by it has a
 * little room to spare and is never drawn larger than it fits. The native
 * side shrinks the type further if a face is wider still (StageView draws
 * with adjustsFontSizeToFit), and cuts with an ellipsis only past that.
 */
export const LETTER = 0.6
/** A line's height as a share of its size. */
export const LINE = 1.12

/** How many lines `text` takes at `size` in `width`, broken at spaces; Infinity when one word is wider than the line. */
export function linesFor(text, size, width, letter = LETTER) {
  const words = String(text ?? '').trim().split(/\s+/).filter(Boolean)
  if (!words.length) return 0
  const room = pts(width) / (size * letter)
  let lines = 1
  let used = 0
  for (const word of words) {
    if (word.length > room) return Infinity
    if (!used) used = word.length
    else if (used + 1 + word.length <= room) used += 1 + word.length
    else {
      lines += 1
      used = word.length
    }
  }
  return lines
}

/**
 * The biggest whole size `text` can be drawn at in `width` by `height`, on at
 * most `lines` lines: between `min` and `max`. Nothing to draw, or no room
 * measured yet, is `min`. A word too long for a line even at `min` is still
 * `min`: the screen shrinks it to fit and, past that, ends it in an ellipsis.
 */
export function bigType({ text = '', width = 0, height = 0, lines = 2, min = 20, max = 160, letter = LETTER, line = LINE } = {}) {
  const w = pts(width)
  const h = pts(height)
  const least = Math.max(1, whole(min))
  const most = Math.max(least, whole(max))
  if (!String(text ?? '').trim() || !w || !h) return least
  for (let size = most; size > least; size--) {
    const n = linesFor(text, size, w, letter)
    if (n <= lines && n * size * line <= h) return size
  }
  return least
}

/**
 * How `count` scenes sit along the bottom: `cols` to a row and `rows` of
 * them, one row wherever each button is at least STAGE_SCENE_LEAST across,
 * and otherwise the fewest rows that give every button that much (eight
 * scenes on a phone held upright are two rows of four).
 */
export function stageScenes({ count = 0, width = 0, gap = 8, least = STAGE_SCENE_LEAST } = {}) {
  const n = whole(count)
  const w = pts(width)
  if (!n) return { cols: 0, rows: 0, wide: 0 }
  for (let rows = 1; rows <= n; rows++) {
    const cols = Math.ceil(n / rows)
    const wide = Math.floor((w - (cols - 1) * gap) / cols)
    if (wide >= least || cols === 1) return { cols, rows, wide: Math.max(0, wide) }
  }
  return { cols: 1, rows: n, wide: w }
}

/**
 * Where everything goes in a view `width` by `height`:
 *
 *   edges      Previous and Next down the two sides (from STAGE_EDGES_AT)
 *   edge       how wide each of them is then
 *   scenes     stageScenes' answer, and `sceneTall` each button's height
 *   steps      how tall the row of Previous and Next is when they are not
 *              the edges (0 when they are)
 *   words      the room left in the middle for the preset, the scene and
 *              what comes next: { width, height }
 *
 * `tuner` is whether the tuner's strip is up; `notes` whether the song's
 * notes are over the lower part, which then takes the scenes' and the
 * steps' room and a share of the words'.
 */
export function stagePlan({ width = 0, height = 0, scenes = 0, tuner = false, gap = STAGE_GAP, pad = 16 } = {}) {
  const w = pts(width)
  const h = pts(height)
  const inner = Math.max(0, w - 2 * pad)
  const edges = w >= STAGE_EDGES_AT
  /* An edge is a fifth of the screen, never under two thumbs and never over 220. */
  const edge = edges ? Math.round(Math.min(220, Math.max(112, w * 0.18))) : 0
  const row = stageScenes({ count: scenes, width: inner })
  /* A scene's button: a fifth of the height, between a thumb and 132. */
  const sceneTall = row.rows ? Math.round(Math.min(132, Math.max(64, (h * 0.2) / Math.max(1, row.rows * 0.75)))) : 0
  const scenesTall = row.rows ? row.rows * sceneTall + (row.rows - 1) * 8 : 0
  const steps = edges ? 0 : Math.round(Math.min(96, Math.max(64, h * 0.12)))
  const taken = pad + STAGE_TOP + gap + (tuner ? STAGE_TUNER + gap : 0) + (scenesTall ? scenesTall + gap : 0) + (steps ? steps + gap : 0) + pad
  return {
    edges,
    edge,
    scenes: row,
    sceneTall,
    steps,
    words: { width: Math.max(0, inner - (edges ? 2 * (edge + gap) : 0)), height: Math.max(0, h - taken) }
  }
}

/**
 * How the words' room is shared out: the preset's name gets most of it, the
 * scene next, and one line each for the slot and for what comes next. Each
 * answer is a height in points; a part with nothing to say gives its share
 * to the name.
 */
export function stageShares({ height = 0, scene = true, next = true, slot = true, gap = STAGE_GAP } = {}) {
  const h = pts(height)
  const parts = [scene, next, slot].filter(Boolean).length
  const free = Math.max(0, h - parts * gap)
  const slotTall = slot ? Math.min(40, free * 0.08) : 0
  const nextTall = next ? Math.min(72, free * 0.16) : 0
  const sceneTall = scene ? free * 0.26 : 0
  return { slot: slotTall, next: nextTall, scene: sceneTall, name: Math.max(0, free - slotTall - nextTall - sceneTall) }
}

/**
 * The line about what comes next: its label and the name. A setlist steps
 * through songs, so there it is the next song; the stars and the slots step
 * through presets. `ahead` is lib/setlists nextWords' own answer, the one
 * under Play's Next (the name the preset list shows for the slot Next loads,
 * or "Starts over" at the end of a setlist), so this view can never name a
 * different slot from the one its Next loads. Nowhere to go, or a name not
 * known yet: no line.
 */
export function stageNext({ setlist = false, canStep = false, ahead = null } = {}) {
  const name = canStep === true ? String(ahead?.shown ?? '').trim() : ''
  return name ? { label: setlist === true ? 'Next song' : 'Next', name } : null
}

/** A tempo as the view says it, or '' for none worth saying. */
export const stageTempo = (bpm) => (Number.isFinite(Number(bpm)) && Number(bpm) > 0 ? `${Math.round(Number(bpm))} BPM` : '')

/**
 * BLUETOOTH (BETA): THE UNIT, ANSWERED BY THE PHONE ITSELF.
 *
 * Over the relay, every request the app makes — GET /preset, POST /scene —
 * goes to the computer, and ForgeFX there turns it into MIDI. With Bluetooth
 * on there is no computer, so this file does ForgeFX's part: it takes the
 * same requests at the same door (device.js's remoteRequest, the seam the demo
 * already uses), turns each into the frames in fractal-sysex.mjs, sends them
 * through the adapter, and answers in the shapes the screens already know.
 *
 * Nothing above device.js can tell which of the three it is talking to, which
 * is the property worth having: the Play screen is the same Play screen.
 *
 * HANDED ITS TRANSPORT RATHER THAN FETCHING IT, for the reason demoWire is
 * handed the mock: the native module and React Native do not exist in the
 * test runner, and the request-to-bytes mapping is the whole risk. `send` is
 * the adapter, `catalog` the block names, `clock` the timers. So Node can
 * drive this against a pretend FM3 and a pretend AM4, byte by byte.
 *
 * WHAT NOBODY HERE CAN DO is try it on every unit: so far only an AM4 has
 * been on the other end. (This file was written for a test build that took
 * no updates over the air; in the store builds it is JavaScript like the
 * rest and takes them, but a fix still needs somebody with the unit to find
 * it.) So where the FM3 is known to ignore a published command, both ways
 * are in here, the "auto" setting tries one and checks, and whichever worked
 * is remembered on the phone (`remember`). The check panel can force either.
 */
import {
  AM4,
  FN,
  MODELS,
  am4Allowed,
  am4Block,
  am4LocationCode,
  am4Note,
  buildAm4Bypass,
  buildAm4BypassRead,
  buildAm4Channel,
  buildAm4ChannelRead,
  buildAm4Preset,
  buildAm4Scene,
  buildAm4StoredName,
  buildAm4Structure,
  buildAm4Tempo,
  buildAm4TempoRead,
  buildAm4TunerPoll,
  buildGetPreset,
  buildGetPresetName,
  buildGetScene,
  buildGetSceneName,
  buildGetTempo,
  buildProgramChange,
  buildSetBypass,
  buildSetChannel,
  buildSetChannelEdit,
  buildSetScene,
  buildSetSceneEdit,
  buildSetTempo,
  buildSetTempoEdit,
  buildStatusDump,
  buildSwitchPreset,
  buildTap,
  buildTuner,
  buildTunerPage,
  buildTunerPoll,
  channelIndex,
  channelLetter,
  hzToNote,
  isBeatPush,
  isFractal,
  parseAm4Bypass,
  parseAm4Channel,
  parseAm4StoredName,
  parseAm4Structure,
  parseAm4Tempo,
  parseAm4TunerPoll,
  parsePresetName,
  parseRejected,
  parseScene,
  parseSceneName,
  parseStatusDump,
  parseTempo,
  parseTunerPoll,
  parseTunerPush,
  rejectedWords,
  sameBytes,
  toHex
} from './fractal-sysex.mjs'
import { outlineChain } from './chain-outline.js'

/* ------------------------------------------------------------------ */
/* The units, and how long each question is given                      */
/* ------------------------------------------------------------------ */

/** The units the Bluetooth page offers, in the order it offers them. */
export const BLE_UNITS = [
  { key: 'am4', name: 'AM4' },
  { key: 'fm3', name: 'FM3' },
  { key: 'fm9', name: 'FM9' },
  { key: 'axefx3', name: 'Axe-Fx III' }
]

/*
 * `bankIn` is where Program Change's bank goes (see buildProgramChange): the
 * FM3 on 12.00 ignores CC32, the III wants it. `maxPreset` is the last slot
 * the unit holds; a III Mark II has 1024.
 */
const SPEC = {
  fm3: { name: 'FM3', short: 'FM3', bankIn: 'cc0', maxPreset: 511 },
  fm9: { name: 'FM9', short: 'FM9', bankIn: 'cc0', maxPreset: 511 },
  axefx3: { name: 'Axe-Fx III', short: 'Axe-Fx III', bankIn: 'cc32', maxPreset: 1023 },
  am4: { name: 'AM4', short: 'AM4', maxPreset: AM4.LOCATIONS - 1 }
}

const MODEL_NAMES = { 0x10: 'an Axe-Fx III', 0x11: 'an FM3', 0x12: 'an FM9', 0x14: 'a VP4', 0x15: 'an AM4' }

/*
 * How long each question waits, in milliseconds. ForgeFX's own numbers where
 * it has them, and the "slow link" ones for the AM4, because a Bluetooth
 * adapter on 5-pin MIDI is exactly what ForgeFX calls slow: 31,250 baud.
 */
export const WAIT = {
  detect: 1200,
  scene: 700,
  tempo: 700,
  preset: 1500,
  sceneName: 1000,
  status: 1500,
  tunerPoll: 300,
  /* A write that worked gets no answer; one that did not gets a refusal within this. */
  watch: 120,
  sceneEcho: 500,
  /* How long after a preset switch the unit is asked where it landed. */
  landed: 300,
  /* How long the published tuner is given to start sending before the phone asks instead. */
  push: 1200,
  am4Structure: 1500,
  am4Name: 1200,
  am4Bypass: 600,
  am4Channel: 1200,
  am4Tempo: 800,
  am4Tuner: 400,
  /* An AM4 write is not answered; the line is held this long so its echo passes first. */
  am4Settle: 40
}

/** A frame identical to one just sent, arriving within this, is the phone hearing itself. */
export const ECHO_MS = 250
/** The AM4 is asked one stored name at a time, at least this far apart. */
export const NAME_GAP_MS = 600
/** An answer this late is not taken as an answer to the next question. */
export const LATE_MS = 2000
/** The AM4's preset answer is reused for this long, so one screen load is one read. */
export const STRUCTURE_FRESH_MS = 400

/*
 * THE FOOTSWITCH WATCH. A unit says nothing when its own footswitch changes
 * scene or preset (ForgeFX found none over USB), so the phone asks: scene
 * every second, preset every two, tempo every four — about 2% of what 5-pin
 * MIDI carries. The AM4's one preset answer carries both, every two.
 */
export const POLL_MS = { scene: 1000, preset: 2000, tempo: 4000, am4: 2000 }
export const TUNER_MS = 150

/* ------------------------------------------------------------------ */
/* How each command is sent                                            */
/* ------------------------------------------------------------------ */

/*
 * 'published' is Fractal's third-party command, 'edit' the frame FM3-Edit
 * itself sends, 'auto' tries the first and checks, then the second. The
 * preset has no published SysEx switch, so its two are the unpublished 0x27
 * frame and Program Change; the tuner's are asking for the frequency, or
 * listening for what the unit sends with "Send Realtime Sysex" on.
 */
export const WAYS = {
  scene: ['auto', 'published', 'edit'],
  channel: ['auto', 'published', 'edit'],
  tempo: ['auto', 'published', 'edit'],
  preset: ['auto', 'sysex', 'pc'],
  tuner: ['auto', 'poll', 'push']
}

export const DEFAULT_METHODS = { scene: 'auto', channel: 'auto', tempo: 'auto', preset: 'auto', tuner: 'auto', pcChannel: 1, learned: {} }

/** A stored set of choices, with anything unknown dropped: storage can hold an older shape. */
export function settleMethods(m) {
  const out = { ...DEFAULT_METHODS, learned: {} }
  for (const key of Object.keys(WAYS)) {
    if (WAYS[key].includes(m?.[key])) out[key] = m[key]
    const learned = m?.learned?.[key]
    if (learned !== 'auto' && WAYS[key].includes(learned)) out.learned[key] = learned
  }
  const ch = Number(m?.pcChannel)
  if (Number.isInteger(ch) && ch >= 1 && ch <= 16) out.pcChannel = ch
  return out
}

/* ------------------------------------------------------------------ */
/* The check panel's steps                                             */
/* ------------------------------------------------------------------ */

/*
 * Each says what it does before it does it. The reads change nothing; each
 * write puts things back the way they were.
 */
export const CHECK_STEPS = {
  gen3: {
    reads: [
      { step: 'model', label: 'Does the unit answer?' },
      { step: 'preset', label: 'Preset number and name' },
      { step: 'scene', label: 'Scene' },
      { step: 'scene-names', label: 'Scene names 1 to 8' },
      { step: 'tempo', label: 'Tempo' },
      { step: 'blocks', label: 'Blocks' },
      { step: 'stored-name', label: 'Another preset’s name' },
      { step: 'echo', label: 'Echo test (MIDI Thru)' }
    ],
    writes: [
      { step: 'write-scene', label: 'Scene: go to 2 and back', does: 'Changes to scene 2, then back to the scene you were on.' },
      { step: 'write-channel', label: 'Channel: Amp to B and back', does: 'Puts the amp on B, then back where it was.' },
      { step: 'write-tempo', label: 'Tempo: up 1 and back', does: 'Raises the tempo by one, then puts it back.' },
      { step: 'write-preset', label: 'Preset: next and back', does: 'Loads the next preset, then the one you were on.' },
      { step: 'write-tuner', label: 'Tuner: 3 seconds', does: 'Opens the tuner for three seconds and counts the readings.' }
    ]
  },
  am4: {
    reads: [
      { step: 'structure', label: 'Preset, name, scene and blocks' },
      { step: 'tempo', label: 'Tempo' },
      { step: 'blocks', label: 'Each block on or off, and its channel' },
      { step: 'stored-name', label: 'The next preset’s name' },
      { step: 'echo', label: 'Echo test (MIDI Thru)' }
    ],
    writes: [
      { step: 'write-scene', label: 'Scene: go to 2 and back', does: 'Changes to scene 2, then back to the scene you were on.' },
      { step: 'write-tempo', label: 'Tempo: up 1 BPM and back', does: 'Raises the tempo by one, then puts it back.' },
      { step: 'write-bypass', label: 'Effect: turn the first block off and back on', does: 'Switches the first block, then switches it back.' },
      {
        step: 'write-preset',
        label: 'Preset: next and back',
        does: 'Loads the next preset, then the one you were on.',
        warn: 'Changing preset on the AM4 drops any unsaved changes on the unit.'
      }
    ]
  }
}

/* ------------------------------------------------------------------ */
/* Errors, in the shapes the app already reads                         */
/* ------------------------------------------------------------------ */

const failure = (message, status, extra = {}) => Object.assign(new Error(message), { status, bluetooth: true, ...extra })
/* The shape shared/unsupported.mjs's isUnsupported reads. */
const unsupported = () => failure('unsupported', 501, { unsupported: true })
const notHere = () => failure('Not over Bluetooth.', 404)
const timedOut = () => failure('The unit did not answer in time.', 504)
const badInput = (what) => failure(what, 400)
const notConnected = () => failure('The Bluetooth adapter is not connected.', 503)
const refusedBy = (code) => failure(`The unit refused it: ${rejectedWords(code)}.`, 502, { code })

/* A poll that found the line busy, told apart from one the unit did not answer. */
const SKIPPED = Symbol('skipped')

const realClock = {
  now: () => Date.now(),
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (t) => clearTimeout(t)
}

/* What the stage never shows over Bluetooth: no volume, no looper, no input. */
const OFF_STAGE = ['input', 'output', 'looper']

const silentTuner = () => ({ type: 'tuner', note: '', octave: undefined, cents: null })

/**
 * THE AM4'S ONE WAY OUT. Every frame for the AM4 passes through this, and a
 * frame that is not on AM4_ALLOWED is not sent: it is logged and dropped.
 * 'sent', 'refused' or 'failed' (the adapter would not take it).
 */
export function am4Sender(send, log = () => {}) {
  return (bytes) => {
    if (!am4Allowed(bytes)) {
      log(`refused to send the AM4 ${toHex(bytes)}: it is not one of the messages the AM4 is ever sent`)
      return 'refused'
    }
    return send(bytes) === false ? 'failed' : 'sent'
  }
}

/* ------------------------------------------------------------------ */
/* The wire                                                            */
/* ------------------------------------------------------------------ */

/**
 * @param {object} o
 * @param {(bytes:number[]) => boolean} o.send  one message to the adapter; false when it would not take it
 * @param {'am4'|'fm3'|'fm9'|'axefx3'} o.unit   the unit the player picked
 * @param {Array} [o.catalog]   block names by effect id (data/blocks.json)
 * @param {object} [o.methods]  how each command is sent, and what auto has learned
 * @param {{now, setTimeout, clearTimeout}} [o.clock]
 * @param {(line:string) => void} [o.log]
 * @param {(methods:object) => void} [o.remember]  called when auto learns a way, to keep it on the phone
 * @param {(name:string) => void} [o.onForeign]  called once when an AM4 answers a connection made for another unit, so the page can say so
 */
export function createBleWire({ send, unit, catalog = [], methods, clock, log, remember, onForeign } = {}) {
  const spec = SPEC[unit]
  if (!spec) throw new Error(`Bluetooth does not know a unit called ${unit}.`)
  if (typeof send !== 'function') throw new Error('Bluetooth needs a way to send.')
  const model = MODELS[unit]
  const am4 = unit === 'am4'
  const time = clock || realClock
  const blocks = Array.isArray(catalog) ? catalog : []
  let ways = settleMethods(methods)

  const say = (line) => {
    try {
      if (log) log(line)
    } catch {
      // The log is for reading afterwards; it can never stop a request.
    }
  }
  const sendFrame = am4 ? am4Sender(send, say) : (bytes) => (send(bytes) === false ? 'failed' : 'sent')

  const handlers = new Set()
  const emit = (event) => {
    for (const fn of [...handlers]) {
      try {
        fn(event)
      } catch {
        // One listener cannot stop the others hearing it.
      }
    }
  }

  /* What the phone was last told, so the footswitch watch knows a change when it sees one. */
  const last = { scene: null, preset: null, name: '', bpm: null }

  /* ---------------- sending, one question at a time ---------------- */

  /*
   * ONE EXCHANGE AT A TIME, and in this order: the player's writes, then the
   * player's reads, then the watch. 5-pin MIDI is slow and a unit answers one
   * thing at a time; two questions in flight is two answers nobody can tell
   * apart. A watch poll that finds anything waiting is simply not asked.
   */
  const PRI = { write: 0, read: 1, poll: 2 }
  const waiting = []
  let current = null
  let closed = false
  let tracing = null

  /*
   * What was sent last, for the echo guard: the last frame ONLY, not
   * everything lately. The published scene change and the answer to the
   * "which scene?" asked straight after it are the same bytes (0C 02 both
   * ways), so a guard with a longer memory throws away the answer.
   */
  let lastSent = { messages: [], at: -Infinity }
  let echoes = 0
  let thruTold = false
  let foreign = null
  let pushes = 0
  /* Whether the unit has answered anything on this connection: the footswitch watch waits for it. */
  let answered = false
  /* An AM4 answered a connection made for another unit: nothing more is sent. See heardAnAm4. */
  let wrongUnit = false

  /*
   * A QUESTION THAT WENT UNANSWERED MAY STILL BE ANSWERED, late, and that
   * answer must not be taken for the next one of the same kind. Each kind
   * (the function byte) that timed out is remembered here until when its
   * answer would be too late to arrive.
   */
  const lateUntil = new Map()
  let holdTimer = null
  const lateFor = (fn) => (lateUntil.get(fn) ?? -Infinity) - time.now()

  /*
   * How long a gen-3 question must wait for a late answer to its kind to pass.
   * A current-preset answer that arrived late was being taken for a stored
   * name, which turned stored names off for the whole connection; a stored
   * name that arrived late was taken for the loaded preset. Not the tuner's
   * frequency question: a reading that comes late is still a reading, and
   * holding it would put a two-second gap in the needle. Not the AM4, whose
   * every answer is told apart by the address it carries (and whose one that
   * is not, the stored name, waits on its own: see am4NameOf).
   */
  const heldFor = (job) => (am4 || !job.opts.match || job.opts.fn === undefined || job.opts.fn === FN.PARAM ? 0 : lateFor(job.opts.fn))

  const isEcho = (bytes, now) => now - lastSent.at <= ECHO_MS && lastSent.messages.some((m) => sameBytes(m, bytes))

  const wrongUnitError = () => failure(`An AM4 answered, not the ${spec.name}. Pick AM4 on the Bluetooth (beta) page in Settings.`, 409)

  /*
   * NOTHING BUT "ARE YOU THERE?" GOES TO A UNIT THAT HAS NEVER ANSWERED.
   *
   * The wrong-unit guard above only trips when an AM4 SAYS something. One
   * picked as an FM3 might say nothing to an FM3's messages instead, and
   * then the guard never trips: the full read on connecting and every check
   * after it went on sending it FM3 messages, and both freezes on record
   * came from messages an AM4 did not expect. So until this connection has
   * had an answer of any kind, only the unit's own probe goes out (the
   * detect question, `probe: true`). A read held here comes back as nothing
   * came, so every screen shows what it shows for a unit that is not
   * answering; a write is refused, so nothing is learned from it and the
   * player is told why. The first answer opens the line for everything.
   *
   * Not for the AM4's own connection: what it protects is the AM4, and the
   * gen-3 units have no freezes on record.
   */
  const unheard = () =>
    failure(`The ${spec.name} has not answered yet, so nothing is sent to it. Check the unit picked on the Bluetooth (beta) page, and the adapter's plugs.`, 504)

  function ex(out, opts = {}) {
    if (closed) return Promise.reject(notConnected())
    if (wrongUnit) return Promise.reject(wrongUnitError())
    if (!am4 && !answered && !opts.probe) {
      if (opts.priority !== 'poll') say(`held until the ${spec.name} answers: ${opts.what || 'a message'}`)
      return opts.priority === 'write' ? Promise.reject(unheard()) : Promise.resolve(null)
    }
    const priority = PRI[opts.priority] ?? PRI.read
    if (priority === PRI.poll && (current || waiting.length)) return Promise.resolve(SKIPPED)
    return new Promise((resolve, reject) => {
      const job = { out, opts, priority, resolve, reject, back: null }
      const at = waiting.findIndex((j) => j.priority > priority)
      waiting.splice(at < 0 ? waiting.length : at, 0, job)
      pump()
    })
  }

  function pump() {
    if (current || closed || wrongUnit || !waiting.length) return
    const hold = heldFor(waiting[0])
    if (hold > 0) {
      /* A watch poll is not worth waiting for: the next one asks. Anything else waits it out, and a write still goes ahead of it. */
      if (waiting[0].priority === PRI.poll) {
        waiting.shift().resolve(SKIPPED)
        return pump()
      }
      if (holdTimer === null) {
        holdTimer = time.setTimeout(() => {
          holdTimer = null
          pump()
        }, hold)
      }
      return
    }
    const job = waiting.shift()
    current = job
    job.started = time.now()
    const messages = job.opts.messages ? job.out : [job.out]
    lastSent = { messages: [], at: job.started }
    for (const m of messages) {
      const result = sendFrame(m)
      if (result !== 'sent') {
        return end(job, null, result === 'refused' ? failure('That message is never sent to the AM4.', 500, { refused: true }) : notConnected())
      }
      lastSent.messages.push(m)
    }
    if (job.priority === PRI.write) say(`sent ${job.opts.what || 'a write'}: ${messages.map(toHex).join(' | ')}`)
    job.timer = time.setTimeout(() => {
      if (current !== job) return
      if (job.opts.match) {
        if (job.opts.fn !== undefined) lateUntil.set(job.opts.fn, time.now() + LATE_MS)
        if (job.priority !== PRI.poll) say(`no answer to ${job.opts.what || toHex(messages[0])} in ${job.opts.ms} ms`)
      }
      end(job, null)
    }, job.opts.ms ?? 0)
  }

  function end(job, value, err) {
    if (current !== job) return
    if (job.timer !== undefined) time.clearTimeout(job.timer)
    current = null
    if (tracing) {
      const messages = job.opts.messages ? job.out : [job.out]
      tracing.push({ out: messages.map(toHex).join(' | '), back: job.back ? toHex(job.back) : '', ms: time.now() - job.started })
    }
    if (err) job.reject(err)
    else job.resolve(value)
    pump()
  }

  const pause = (ms) => new Promise((resolve) => time.setTimeout(resolve, ms))

  /** A read: the answer `match` makes of a frame, {rejected: code}, or null when nothing came. */
  const ask = (out, match, ms, what, extra = {}) => ex(out, { match, ms, fn: out[5], what, priority: 'read', ...extra })

  /**
   * A write, sent and watched: null when nothing came back (a gen-3 unit
   * answers an accepted write with nothing), {rejected: code} for a refusal.
   */
  const fire = (out, what, extra = {}) => ex(out, { fn: out[5], ms: am4 ? WAIT.am4Settle : WAIT.watch, what, priority: 'write', ...extra })

  const rejected = (r) => r !== null && typeof r === 'object' && r.rejected !== undefined

  /* ---------------- hearing ---------------- */

  /** A whole SysEx frame from the joiner. */
  function heard(f) {
    if (closed || !isFractal(f)) return
    const now = time.now()
    if (f[4] !== model) {
      if (f[4] !== 0x7f) foreign = { model: f[4], at: now }
      if (!am4 && f[4] === MODELS.am4) heardAnAm4()
      return
    }
    const job = current
    /*
     * THE ECHO GUARD. With MIDI Thru on, the unit hands the phone its own
     * message straight back, and an echoed "which scene?" (0C 7F) reads as
     * scene 8. A frame identical to the one just sent is dropped — except
     * while a write is waiting for the one answer that IS identical: the
     * published scene change, which the unit answers with the same bytes.
     */
    if (isEcho(f, now) && !(job && job.opts.allowEcho)) {
      echoes++
      if (echoes >= 3 && !thruTold) {
        thruTold = true
        say('the unit is echoing what it receives: MIDI Thru is on')
      }
      return
    }
    if (job && job.opts.match) {
      const got = job.opts.match(f)
      if (got !== null && got !== undefined) {
        job.back = f
        answered = true
        return end(job, got)
      }
    }
    if (job && job.opts.fn !== undefined) {
      const no = parseRejected(f, model)
      if (no && no.fn === job.opts.fn) {
        job.back = f
        answered = true
        say(`the unit refused ${job.opts.what || 'it'}: ${rejectedWords(no.code)}`)
        return end(job, { rejected: no.code })
      }
    }
    unasked(f, now)
  }

  /*
   * AN AM4 ON THE OTHER END OF A CONNECTION MADE FOR ANOTHER UNIT: the wrong
   * unit was picked. The AM4 has frozen on messages it did not expect, and
   * how it takes another unit's is not known, so from here nothing more goes
   * out on this connection — the watch stops, everything waiting is refused
   * unsent, and every request after it is refused with the reason. Picking
   * AM4 makes a new connection, and that one is the AM4's own.
   */
  function heardAnAm4() {
    if (wrongUnit) return
    wrongUnit = true
    stopPolls()
    say(`an AM4 answered, not the ${spec.name}: nothing more is sent on this connection`)
    while (waiting.length) waiting.shift().reject(wrongUnitError())
    try {
      if (onForeign) onForeign('AM4')
    } catch {
      // Telling the page is a courtesy; the wire has already stopped.
    }
  }

  /** What the unit said that nobody was waiting for. */
  function unasked(f, now) {
    if (lateFor(f[5]) >= 0) return
    if (am4) return
    const push = parseTunerPush(f, model)
    if (push) {
      pushes++
      if (tuner.on && tuner.way === 'push') tunerPushed(push)
      return
    }
    if (isBeatPush(f, model)) return
    const scene = parseScene(f, model)
    if (scene !== null) return noteScene(scene, true)
    const preset = parsePresetName(f, model)
    if (preset) notePreset(preset, true)
  }

  /** A short message: only Program Change means anything here. */
  function heardShort(msg) {
    if (closed || !Array.isArray(msg) || !msg.length) return
    if (isEcho(msg, time.now())) return
    if ((msg[0] & 0xf0) === 0xc0) {
      say(`the unit sent Program Change ${msg[1]}: its preset changed`)
      sceneCache = null
      structure = null
      emit({ type: 'changed', scope: 'preset' })
    }
  }

  function noteScene(s, tell) {
    if (tell && last.scene !== null && s !== last.scene) {
      say(`scene ${s + 1}, changed on the unit`)
      last.scene = s
      return emit({ type: 'scene', index: s })
    }
    last.scene = s
  }

  function notePreset(p, tell) {
    const changed = last.preset !== null && p.number !== last.preset
    if (p.number !== last.preset) {
      sceneCache = null
      /* A new preset whose name is not known yet has no name, not the last one's. */
      last.name = ''
    }
    last.preset = p.number
    if (typeof p.name === 'string') last.name = p.name
    if (tell && changed) {
      say(`preset ${p.number}, changed on the unit`)
      emit({ type: 'changed', scope: 'preset' })
    }
  }

  function noteTempo(bpm, tell) {
    if (tell && last.bpm !== null && bpm !== last.bpm) {
      last.bpm = bpm
      say(`tempo ${bpm}, changed on the unit`)
      return emit({ type: 'tempo', bpm })
    }
    last.bpm = bpm
  }

  const foreignWords = () =>
    foreign && time.now() - foreign.at < 5000
      ? `a different unit answered: ${MODEL_NAMES[foreign.model] || `model ${toHex([foreign.model])}`}, not ${am4 ? 'an AM4' : `the ${spec.name}`}`
      : ''

  /* ---------------- learning which way works ---------------- */

  const methodsCopy = () => ({ ...ways, learned: { ...ways.learned } })
  const keep = () => {
    try {
      if (remember) remember(methodsCopy())
    } catch {
      // Not remembered is asked again next time: slower, never wrong.
    }
  }
  function learn(key, way) {
    if (ways.learned[key] === way) return
    ways.learned[key] = way
    say(`${key}: ${way === 'edit' ? 'FM3-Edit’s way' : way} works on this ${spec.name}; remembered`)
    keep()
  }
  function forget(key) {
    if (!ways.learned[key]) return
    say(`${key}: ${ways.learned[key]} stopped working; trying again`)
    delete ways.learned[key]
    keep()
  }
  /* The way to use now: the one the player chose, or the one auto found, or null to find out. */
  const wayFor = (key) => (ways[key] !== 'auto' ? ways[key] : ways.learned[key] || null)

  /* ---------------- the answers both families give ---------------- */

  const CH = ['A', 'B', 'C', 'D']
  function capabilities() {
    /*
     * The shapes the demo's mock gives for the same units, plus `via`, which
     * is how Edit, Save and the looper know to stay out of the way. No
     * `meters`, so the app never asks for the computer's copy of the grid.
     * `addressing` is ForgeFX's own: it is what letters the AM4's slots.
     */
    const common = {
      via: 'bluetooth',
      hasScenes: true,
      hasChannels: true,
      channelNames: [...CH],
      cabIrs: false,
      fc: { model: false, liveState: false },
      tuner: true,
      supportsSave: false
    }
    if (am4) {
      return { ...common, slotModel: 'linear', sceneCount: AM4.SCENES, presets: { count: AM4.LOCATIONS, addressing: 'bankLetter', canScanNames: false } }
    }
    return { ...common, slotModel: 'grid', grid: { rows: 4, cols: 12 }, sceneCount: 8, presets: { count: 512, addressing: 'numeric', canScanNames: false } }
  }

  const detectAnswer = (connected) => ({
    connected,
    name: spec.name,
    short: spec.short,
    gen: 3,
    supported: true,
    simulated: false,
    port: 'bluetooth',
    capabilities: capabilities()
  })

  const presetNumber = (n) => {
    if (!Number.isInteger(n) || n < 0 || n > spec.maxPreset) throw badInput(`There is no preset ${n} on the ${spec.name}.`)
    return n
  }
  const tempoNumber = (bpm) => {
    const n = Math.round(Number(bpm))
    if (!Number.isFinite(Number(bpm)) || n < AM4.TEMPO_MIN || n > AM4.TEMPO_MAX) throw badInput(`A tempo of ${bpm} is outside 24 to 250.`)
    return n
  }
  const blockNumber = (eid) => {
    if (!Number.isInteger(eid) || eid < 1 || eid > 0x3fff || (am4 && !am4Block(eid))) throw badInput(`There is no block ${eid} here.`)
    return eid
  }

  /* ================================================================ */
  /* Gen 3: FM3, FM9, Axe-Fx III                                      */
  /* ================================================================ */

  let numberedOff = false
  let sceneNamesOff = false
  let sceneCache = null

  const sceneNow = (priority = 'read') => ask(buildGetScene(model), (f) => parseScene(f, model), WAIT.scene, 'the scene', { priority })
  const presetNow = (priority = 'read') => ask(buildGetPreset(model), (f) => parsePresetName(f, model), WAIT.preset, 'the preset', { priority })
  const tempoNow = (priority = 'read') => ask(buildGetTempo(model), (f) => parseTempo(f, model), WAIT.tempo, 'the tempo', { priority })
  const statusNow = () => ask(buildStatusDump(model), (f) => parseStatusDump(f, model), WAIT.status, 'the blocks')

  async function channelNow(eid) {
    const list = await statusNow()
    if (!Array.isArray(list)) return null
    const b = list.find((x) => x.effectId === eid)
    return b ? b.channel : null
  }

  async function gen3Detect() {
    const got = await ask(buildGetScene(model), (f) => parseScene(f, model), WAIT.detect, 'the scene, to see whether the unit answers', { probe: true })
    const answered = Number.isInteger(got) || rejected(got)
    if (Number.isInteger(got)) last.scene = got
    say(answered ? `the ${spec.name} answers` : foreignWords() || `the ${spec.name} did not answer`)
    return detectAnswer(answered)
  }

  async function gen3Preset() {
    const got = await presetNow()
    if (!got || rejected(got)) return { number: -1, name: '' }
    notePreset(got, false)
    return { number: got.number, name: got.name }
  }

  async function gen3Scene() {
    const got = await sceneNow()
    if (!Number.isInteger(got)) return { index: -1 }
    noteScene(got, false)
    return { index: got }
  }

  async function gen3Tempo() {
    const got = await tempoNow()
    if (!Number.isInteger(got)) return { bpm: 0 }
    noteTempo(got, false)
    return { bpm: got }
  }

  async function gen3Blocks() {
    const list = await statusNow()
    if (rejected(list)) throw refusedBy(list.rejected)
    if (!Array.isArray(list)) throw timedOut()
    /* outlineChain names by effect id and wants the channel as a letter. */
    const states = list.map((b) => ({ effectId: b.effectId, bypassed: b.bypassed, channel: channelLetter(b.channel) }))
    return (outlineChain(states, blocks) || []).filter((b) => !OFF_STAGE.includes(b.slug))
  }

  async function gen3SceneState() {
    const list = await statusNow()
    if (!Array.isArray(list)) return []
    return list.map((b) => ({ effectId: b.effectId, bypassed: b.bypassed, channel: channelLetter(b.channel) }))
  }

  /*
   * A STORED SLOT'S NAME, OR NOTHING — NEVER A BLANK.
   *
   * The phone files whatever this answers under the unit's name, on disk. A
   * blank for a slot that has a name would wipe one learned over the relay.
   * So the answer has to be for the slot asked about; one for another slot
   * means this unit cannot say, and it is not asked again on this connection.
   * (After any preset question goes unanswered, this one waits for the late
   * answer to pass rather than take it: see heldFor.)
   */
  async function gen3StoredName(n) {
    presetNumber(n)
    if (numberedOff) throw unsupported()
    const got = await ask(buildGetPresetName(model, n), (f) => parsePresetName(f, model), WAIT.preset, `preset ${n}’s name`)
    if (got === null) throw timedOut()
    if (rejected(got) || got.number !== n) {
      numberedOff = true
      say(`the ${spec.name} answered for another preset when asked for ${n}’s name: stored names are not read on this connection`)
      throw unsupported()
    }
    return { number: n, name: got.name }
  }

  /*
   * The loaded preset's scene names, eight small questions, kept until the
   * preset changes. Only for the preset that is loaded: a gen-3 unit can only
   * name the scenes it is playing.
   */
  async function gen3SceneNames(n) {
    if (sceneNamesOff || !Number.isInteger(n) || n < 0 || n !== last.preset) throw unsupported()
    if (sceneCache && sceneCache.number === n) return sceneCache.names
    const names = []
    let missing = 0
    for (let i = 0; i < 8; i++) {
      const got = await ask(
        buildGetSceneName(model, i),
        (f) => {
          const s = parseSceneName(f, model)
          return s && s.index === i ? s : null
        },
        WAIT.sceneName,
        `scene ${i + 1}’s name`
      )
      if (rejected(got)) {
        sceneNamesOff = true
        throw unsupported()
      }
      /* The first one unanswered: a busy unit, not one to wait eight seconds on. */
      if (!got && i === 0) throw timedOut()
      if (!got) missing++
      names.push(got ? got.name : '')
    }
    if (n !== last.preset) throw unsupported()
    if (!missing) sceneCache = { number: n, names }
    return names
  }

  /* ---- scene ---- */

  /* The published scene change is answered with the scene: the same bytes as the change itself. */
  const sendPublishedScene = (i) =>
    fire(buildSetScene(model, i), `scene ${i + 1}`, { ms: WAIT.sceneEcho, allowEcho: true, match: (f) => parseScene(f, model) })
  const sendEditScene = (i) => fire(buildSetSceneEdit(model, i), `scene ${i + 1} (FM3-Edit’s way)`)

  /*
   * WHAT A TRIAL CAN LEARN FROM. Each trial below sends one way, reads the
   * unit back, and tries the other way if it did not land. But a write to
   * where the unit already is lands whether it worked or not — the first
   * scene of a setlist song, a tempo it is already at — and a way learned
   * from that is remembered on the phone and sent from then on unchecked,
   * so every later write would fail without a word. So the unit is asked
   * where it is first (or the caller says, having just asked), and a way is
   * only learned from a write that moved it. The writes still go out either
   * way: the player asked for them.
   */
  const movedFrom = (from, to) => Number.isInteger(from) && from !== to

  /**
   * Try the published scene change, and FM3-Edit's if that did not land.
   * Which one worked, or null when the unit would not say where it ended up
   * or was already there.
   */
  async function trialScene(i, before) {
    const from = before === undefined ? await sceneNow() : before
    let moved = movedFrom(from, i)
    const r = await sendPublishedScene(i)
    if (!rejected(r)) {
      /*
       * Checked, because an echo from MIDI Thru looks exactly like the unit's
       * answer, and because a unit can take it and say nothing.
       */
      const now = await sceneNow()
      if (now === i) return moved ? 'published' : null
      if (now === null) return null
      moved = true
    }
    const e = await sendEditScene(i)
    if (rejected(e)) throw refusedBy(e.rejected)
    const now = await sceneNow()
    if (now === i) return moved ? 'edit' : null
    if (now === null) return null
    throw failure(`The unit stayed on scene ${now + 1}.`, 502)
  }

  /* One way, sent: null when nothing came back, {rejected} for a refusal. */
  const sceneBy = (way, i) => (way === 'published' ? sendPublishedScene(i) : sendEditScene(i))

  async function changeScene(i) {
    const way = wayFor('scene')
    if (way) {
      const r = await sceneBy(way, i)
      if (!rejected(r)) return
      if (ways.scene !== 'auto') throw refusedBy(r.rejected)
      forget('scene')
    }
    const found = await trialScene(i)
    if (found) learn('scene', found)
  }

  async function gen3WriteScene(index) {
    if (!Number.isInteger(index) || index < 0 || index > 7) throw badInput(`There is no scene ${index}.`)
    await changeScene(index)
    last.scene = index
    emit({ type: 'scene', index })
    return { ok: true }
  }

  /* ---- channel ---- */

  /* A refusal about the block itself is not a reason to try the other way. */
  const aboutTheBlock = (code) => code === 0x05 || code === 0x07

  /* As trialScene: only a write that moved the block teaches anything. */
  async function trialChannel(eid, c, before) {
    const from = before === undefined ? await channelNow(eid) : before
    let moved = movedFrom(from, c)
    const p = await fire(buildSetChannel(model, eid, c), `block ${eid} to ${CH[c]}`)
    if (rejected(p) && aboutTheBlock(p.rejected)) throw refusedBy(p.rejected)
    if (!rejected(p)) {
      const now = await channelNow(eid)
      if (now === c) return moved ? 'published' : null
      if (now === null) return null
      moved = true
    }
    const e = await fire(buildSetChannelEdit(model, eid, c), `block ${eid} to ${CH[c]} (FM3-Edit’s way)`)
    if (rejected(e)) throw refusedBy(e.rejected)
    const now = await channelNow(eid)
    if (now === c) return moved ? 'edit' : null
    if (now === null) return null
    throw failure(`The block stayed on ${CH[now] || now}.`, 502)
  }

  async function changeChannel(eid, c) {
    const way = wayFor('channel')
    if (way) {
      const r = await fire(way === 'published' ? buildSetChannel(model, eid, c) : buildSetChannelEdit(model, eid, c), `block ${eid} to ${CH[c]}`)
      if (!rejected(r)) return
      if (ways.channel !== 'auto' || aboutTheBlock(r.rejected)) throw refusedBy(r.rejected)
      forget('channel')
    }
    const found = await trialChannel(eid, c)
    if (found) learn('channel', found)
  }

  async function gen3WriteChannel(eid, channel) {
    blockNumber(eid)
    const c = channelIndex(channel)
    if (c === null) throw badInput(`${channel} is not A, B, C or D.`)
    await changeChannel(eid, c)
    /* No announcement: the app's channel write expects none. */
    return { ok: true }
  }

  /* ---- tempo ---- */

  async function trialTempo(bpm, before) {
    /*
     * EXACTLY, not within one: a gen-3 unit answers a whole BPM, and the
     * check panel moves the tempo by one — within one of the target is also
     * within one of where it started, which would call a write that did
     * nothing a success. And as trialScene, only from a tempo it was not
     * already at.
     */
    const from = before === undefined ? await tempoNow() : before
    let moved = movedFrom(from, bpm)
    const p = await fire(buildSetTempo(model, bpm), `tempo ${bpm}`)
    if (!rejected(p)) {
      const now = await tempoNow()
      if (now === bpm) return moved ? 'published' : null
      if (!Number.isInteger(now)) return null
      moved = true
    }
    const e = await fire(buildSetTempoEdit(model, bpm), `tempo ${bpm} (FM3-Edit’s way)`)
    if (rejected(e)) throw refusedBy(e.rejected)
    const now = await tempoNow()
    if (now === bpm) return moved ? 'edit' : null
    if (!Number.isInteger(now)) return null
    throw failure(`The tempo stayed at ${now}.`, 502)
  }

  async function changeTempo(bpm) {
    /* The published tempo SET does not take on an FM3; FM3-Edit's way is the FM3's default. */
    const way = ways.tempo !== 'auto' ? ways.tempo : unit === 'fm3' ? 'edit' : ways.learned.tempo || null
    if (way) {
      const r = await fire(way === 'published' ? buildSetTempo(model, bpm) : buildSetTempoEdit(model, bpm), `tempo ${bpm}`)
      if (!rejected(r)) return
      if (ways.tempo !== 'auto' || unit === 'fm3') throw refusedBy(r.rejected)
      forget('tempo')
    }
    const found = await trialTempo(bpm)
    if (found) learn('tempo', found)
  }

  async function gen3WriteTempo(value) {
    const bpm = tempoNumber(value)
    await changeTempo(bpm)
    last.bpm = bpm
    emit({ type: 'tempo', bpm })
    return { ok: true }
  }

  /* ---- preset ---- */

  const sendPc = (n) =>
    ex(buildProgramChange(n, { channel: ways.pcChannel, bankIn: spec.bankIn }), {
      messages: true,
      ms: WAIT.watch,
      what: `preset ${n} by Program Change`,
      priority: 'write'
    })
  const sendSysexPreset = (n) => fire(buildSwitchPreset(model, n), `preset ${n}`)

  /* Where the unit is, asked a moment after the switch. */
  async function landedOn() {
    await pause(WAIT.landed)
    const got = await presetNow()
    return got && !rejected(got) ? got.number : null
  }

  /* As trialScene: choosing the preset that is already loaded teaches nothing. */
  async function trialPreset(n, before) {
    let from = before
    if (from === undefined) {
      const got = await presetNow()
      from = got && !rejected(got) ? got.number : null
    }
    let moved = movedFrom(from, n)
    const s = await sendSysexPreset(n)
    if (!rejected(s)) {
      const at = await landedOn()
      if (at === n) return moved ? 'sysex' : null
      if (at === null) return null
      moved = true
    }
    await sendPc(n)
    const at = await landedOn()
    if (at === n) return moved ? 'pc' : null
    if (at === null) return null
    throw failure(`The unit stayed on preset ${at}.`, 502)
  }

  /* One way, sent: Program Change is never answered, so only the SysEx switch can be refused. */
  const presetBy = (way, n) => (way === 'pc' ? sendPc(n) : sendSysexPreset(n))

  async function changePreset(n) {
    const way = wayFor('preset')
    if (way) {
      const r = await presetBy(way, n)
      if (!rejected(r)) return
      if (ways.preset !== 'auto') throw refusedBy(r.rejected)
      forget('preset')
    }
    const found = await trialPreset(n)
    if (found) learn('preset', found)
  }

  async function gen3SelectPreset(number) {
    const n = presetNumber(number)
    await changePreset(n)
    notePreset({ number: n }, false)
    emit({ type: 'changed', scope: 'preset' })
    return { ok: true }
  }

  /* ---- bypass and tap ---- */

  async function gen3WriteBypass(eid, bypassed) {
    blockNumber(eid)
    const r = await fire(buildSetBypass(model, eid, bypassed === true), `block ${eid} ${bypassed === true ? 'off' : 'on'}`)
    if (rejected(r)) throw refusedBy(r.rejected)
    emit({ type: 'changed', scope: 'grid' })
    return { ok: true }
  }

  async function gen3Tap() {
    const r = await fire(buildTap(model), 'a tap')
    if (rejected(r)) throw refusedBy(r.rejected)
    return { ok: true }
  }

  /* ---- tuner ---- */

  const tuner = { on: false, way: null, run: 0, timer: null, pushSent: false, pageOpen: false, lastNote: null, polled: 0 }

  function reading(event) {
    const word = event.note ? `${event.note}${event.octave ?? ''}` : ''
    if (word !== tuner.lastNote) {
      tuner.lastNote = word
      say(word ? `tuner: ${word} ${event.cents > 0 ? '+' : ''}${event.cents}` : 'tuner: no note')
    }
    emit(event)
  }

  const fromHz = (hz) => {
    const n = hzToNote(hz)
    return n ? { type: 'tuner', freq: Math.round(hz * 100) / 100, note: n.note, octave: n.octave, cents: n.cents } : silentTuner()
  }

  /*
   * WHAT A PUSHED TUNER READING IS BELIEVED TO MEAN, not confirmed: the spec
   * text is not on file. Note 0..11 counting from A, the string, and the
   * fine tuning 0..127 with 63 in tune. The raw bytes go to the log the first
   * time, so the check panel shows what the unit really sent.
   */
  const FROM_A = ['A', 'A#', 'B', 'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#']
  let pushTold = false
  function tunerPushed(p) {
    if (!pushTold) {
      pushTold = true
      say(`tuner data from the unit: ${toHex([p.note, p.string, p.fine])}`)
    }
    if (p.note > 11) return reading(silentTuner())
    reading({ type: 'tuner', note: FROM_A[p.note], octave: undefined, cents: Math.round(((p.fine - 63) * 50) / 63) })
  }

  function tunerLater(run, ms, fn) {
    if (!tuner.on || tuner.run !== run) return
    tuner.timer = time.setTimeout(() => {
      tuner.timer = null
      if (tuner.on && tuner.run === run) fn()
    }, ms)
  }

  /* The tuner's ticks run on their own, so a tick that fails (the adapter went) ends quietly. */
  async function gen3TunerTick(run) {
    try {
      const hz = await ex(buildTunerPoll(model), { match: (f) => parseTunerPoll(f, model), ms: WAIT.tunerPoll, fn: FN.PARAM, priority: 'poll' })
      if (tuner.on && tuner.run === run && typeof hz === 'number') {
        tuner.polled++
        reading(fromHz(hz))
      }
    } catch {
      return
    }
    tunerLater(run, TUNER_MS, () => gen3TunerTick(run))
  }

  async function startAsking(run) {
    tuner.way = 'poll'
    if (!tuner.pageOpen) {
      tuner.pageOpen = true
      await fire(buildTunerPage(model, true), 'the tuner page')
    }
    if (tuner.on && tuner.run === run) gen3TunerTick(run)
  }

  async function gen3TunerOn() {
    const run = tuner.run
    const way = wayFor('tuner') || 'poll'
    if (way === 'push') {
      tuner.way = 'push'
      tuner.pushSent = true
      await fire(buildTuner(model, true), 'the tuner')
      const seen = pushes
      tunerLater(run, WAIT.push, () => {
        if (pushes !== seen) return
        say('no tuner data from the unit in 1.2 s; asking for the frequency instead')
        startAsking(run).catch(() => {})
      })
      return
    }
    await startAsking(run)
  }

  async function gen3TunerOff() {
    if (tuner.pushSent) await fire(buildTuner(model, false), 'the tuner off')
    if (tuner.pageOpen) await fire(buildTunerPage(model, false), 'the tuner page closed')
    tuner.pushSent = false
    tuner.pageOpen = false
  }

  /* ================================================================ */
  /* AM4                                                               */
  /* ================================================================ */

  /*
   * THE PRESET ANSWER, reused for a moment: a screen load asks for the
   * preset, the scene and the blocks one after the other, and on an AM4 all
   * three are this one read. Any write throws it away.
   */
  let structure = null
  let structureTold = false
  let slotsHeard = null

  /*
   * THE SLOT CODES, ONLY FROM AN ANSWER THAT HELD TOGETHER. They are not just
   * shown: they are the blocks the AM4 is asked about and the ones the
   * player's taps switch, so a damaged answer must not choose them. One with
   * a bad checksum keeps its preset, scene and name (each held to its range
   * in the codec, so the page is not left blind), but its slots are only
   * believed when the answer before it said the same — which is also what
   * keeps a unit whose checksum turns out always to be off working. Until
   * then they are null, and whoever needs them asks again.
   */
  function believeSlots(got) {
    const agrees = slotsHeard !== null && sameBytes(slotsHeard, got.slots)
    slotsHeard = got.slots
    return got.checksumOk || agrees ? got : { ...got, slots: null }
  }

  async function readStructure({ priority = 'read', fresh = false } = {}) {
    if (!fresh && structure && time.now() - structure.at < STRUCTURE_FRESH_MS) return structure.value
    const got = await ask(buildAm4Structure(), parseAm4Structure, WAIT.am4Structure, 'the preset', { priority })
    if (got === SKIPPED) return SKIPPED
    if (!got || rejected(got)) return null
    if (!structureTold) {
      structureTold = true
      /* Nobody has checked this answer's checksum on a real AM4: say what it was, once. */
      say(got.checksumOk ? 'the AM4’s preset answer carries a good checksum' : 'the AM4’s preset answer did not carry a good checksum; its numbers were in range, so it is used')
    }
    const value = believeSlots(got)
    structure = { value, at: time.now() }
    return value
  }

  async function am4Detect() {
    const got = await readStructure({ fresh: true })
    const answered = !!got
    if (got) {
      last.preset = got.location
      last.name = got.name
      last.scene = got.scene
    }
    say(answered ? 'the AM4 answers' : foreignWords() || 'the AM4 did not answer')
    return detectAnswer(answered)
  }

  async function am4Preset() {
    const s = await readStructure()
    if (!s) return { number: -1, name: '' }
    notePreset({ number: s.location, name: s.name }, false)
    return { number: s.location, name: s.name }
  }

  async function am4Scene() {
    const s = await readStructure()
    if (!s) return { index: -1 }
    noteScene(s.scene, false)
    return { index: s.scene }
  }

  const am4TempoNow = (priority = 'read') => ask(buildAm4TempoRead(), parseAm4Tempo, WAIT.am4Tempo, 'the tempo', { priority })

  async function am4Tempo() {
    const got = await am4TempoNow()
    if (!Number.isInteger(got)) return { bpm: 0 }
    noteTempo(got, false)
    return { bpm: got }
  }

  const am4BypassNow = (code) => ask(buildAm4BypassRead(code), (f) => parseAm4Bypass(f, code), WAIT.am4Bypass, `block ${toHex([code])} on or off`)
  const am4ChannelNow = (code) => ask(buildAm4ChannelRead(code), (f) => parseAm4Channel(f, code), WAIT.am4Channel, `block ${toHex([code])}’s channel`)

  /*
   * The four slots, each with its on/off and channel. A code nobody has seen
   * is listed under its own number and asked nothing: the AM4 is never sent a
   * question about a block that is not on the list.
   */
  async function am4Placed() {
    let s = await readStructure()
    /* Slots not believed yet (see believeSlots): asked once more, and believed if the two agree. */
    if (s && !s.slots) s = await readStructure({ fresh: true })
    if (!s || !s.slots) return null
    const out = []
    for (let i = 0; i < s.slots.length; i++) {
      const code = s.slots[i]
      if (!code) continue
      const block = am4Block(code)
      if (!block) {
        const name = `0x${code.toString(16)}`
        out.push({ slug: name, name, effectId: code, row: 1, col: i + 1, fromRows: [], bypassed: null, channel: null })
        continue
      }
      const off = await am4BypassNow(code)
      const ch = await am4ChannelNow(code)
      out.push({
        slug: block.slug,
        name: block.slug,
        effectId: code,
        row: 1,
        col: i + 1,
        fromRows: [],
        bypassed: typeof off === 'boolean' ? off : null,
        channel: Number.isInteger(ch) ? channelLetter(ch) : null
      })
    }
    return out
  }

  async function am4Blocks() {
    const list = await am4Placed()
    if (!list) throw timedOut()
    return list
  }

  async function am4SceneState() {
    const list = await am4Placed()
    return (list || []).map((b) => ({ effectId: b.effectId, bypassed: b.bypassed, channel: b.channel }))
  }

  /*
   * A STORED NAME, one at a time and never closer than NAME_GAP_MS. The
   * answer does not say which location it is for — only its order does — so
   * after one goes unanswered the next waits out LATE_MS, or a late answer
   * could be filed under the wrong slot.
   */
  let nameAt = -Infinity
  let quietUntil = 0
  let nameChain = Promise.resolve()
  function am4NameOf(n) {
    const run = nameChain.then(async () => {
      const wait = Math.max(nameAt + NAME_GAP_MS, quietUntil) - time.now()
      if (wait > 0) await pause(wait)
      try {
        const got = await ask(buildAm4StoredName(n), parseAm4StoredName, WAIT.am4Name, `${am4LocationCode(n)}’s name`)
        if (got === null) quietUntil = time.now() + LATE_MS
        return got
      } finally {
        nameAt = time.now()
      }
    })
    nameChain = run.catch(() => {})
    return run
  }

  async function am4StoredName(n) {
    presetNumber(n)
    const got = await am4NameOf(n)
    if (rejected(got)) throw refusedBy(got.rejected)
    if (!got) throw timedOut()
    /* '<EMPTY>' is a slot the unit says is empty: that blank is the truth. */
    return { number: n, name: got.name }
  }

  async function am4SelectPreset(number) {
    const n = presetNumber(number)
    const r = await fire(buildAm4Preset(n), `preset ${am4LocationCode(n)}`)
    if (rejected(r)) throw refusedBy(r.rejected)
    structure = null
    notePreset({ number: n }, false)
    emit({ type: 'changed', scope: 'preset' })
    /* Checked a moment later, for the log: the AM4 answers a switch with nothing. */
    pause(WAIT.landed)
      .then(() => readStructure({ fresh: true }))
      .then((s) => {
        if (s && s !== SKIPPED) say(s.location === n ? `the AM4 is on ${am4LocationCode(n)}` : `the AM4 is on ${am4LocationCode(s.location)}, not ${am4LocationCode(n)}`)
      })
      .catch(() => {})
    return { ok: true }
  }

  async function am4WriteScene(index) {
    if (!Number.isInteger(index) || index < 0 || index >= AM4.SCENES) throw badInput(`There is no scene ${index} on the AM4.`)
    const r = await fire(buildAm4Scene(index), `scene ${index + 1}`)
    if (rejected(r)) throw refusedBy(r.rejected)
    structure = null
    last.scene = index
    emit({ type: 'scene', index })
    return { ok: true }
  }

  async function am4WriteBypass(eid, bypassed) {
    blockNumber(eid)
    const r = await fire(buildAm4Bypass(eid, bypassed === true), `block ${toHex([eid])} ${bypassed === true ? 'off' : 'on'}`)
    if (rejected(r)) throw refusedBy(r.rejected)
    emit({ type: 'changed', scope: 'grid' })
    return { ok: true }
  }

  async function am4WriteChannel(eid, channel) {
    blockNumber(eid)
    const c = channelIndex(channel)
    if (c === null) throw badInput(`${channel} is not A, B, C or D.`)
    const r = await fire(buildAm4Channel(eid, c), `block ${toHex([eid])} to ${CH[c]}`)
    if (rejected(r)) throw refusedBy(r.rejected)
    return { ok: true }
  }

  async function am4WriteTempo(value) {
    const bpm = tempoNumber(value)
    const r = await fire(buildAm4Tempo(bpm), `tempo ${bpm}`)
    if (rejected(r)) throw refusedBy(r.rejected)
    /* Read back, as ForgeFX does: within one BPM is taken. */
    const now = await am4TempoNow()
    if (Number.isInteger(now) && Math.abs(now - bpm) > 1) throw failure(`The AM4 stayed at ${now} BPM.`, 502)
    last.bpm = bpm
    emit({ type: 'tempo', bpm })
    return { ok: true }
  }

  async function am4TunerTick(run) {
    const values = []
    try {
      for (const which of [1, 2, 3, 4]) {
        const v = await ex(buildAm4TunerPoll(which), { match: (f) => parseAm4TunerPoll(f, which), ms: WAIT.am4Tuner, fn: FN.PARAM, priority: 'poll' })
        if (v === SKIPPED || !tuner.on || tuner.run !== run) break
        values.push(typeof v === 'number' ? v : null)
      }
    } catch {
      return
    }
    if (values.length === 4 && tuner.on && tuner.run === run) {
      const [index, hz, cents] = values
      /* A set with a reading missing is skipped, not drawn half-known. */
      if (index !== null && hz !== null && cents !== null) {
        tuner.polled++
        if (!(hz > 0)) reading(silentTuner())
        else {
          const n = am4Note(index)
          reading({ type: 'tuner', freq: Math.round(hz * 100) / 100, note: n.note, octave: n.octave, cents: Math.round(cents) })
        }
      }
    }
    tunerLater(run, TUNER_MS, () => am4TunerTick(run))
  }

  /* ================================================================ */
  /* The routes                                                        */
  /* ================================================================ */

  async function writeTuner(on) {
    if (on === true) {
      if (tuner.on) return { ok: true }
      tuner.on = true
      tuner.run++
      tuner.lastNote = null
      if (am4) {
        am4TunerTick(tuner.run)
        return { ok: true }
      }
      try {
        await gen3TunerOn()
      } catch (err) {
        tuner.on = false
        tuner.run++
        throw err
      }
      return { ok: true }
    }
    if (!tuner.on) return { ok: true }
    tuner.on = false
    tuner.run++
    if (tuner.timer !== null) time.clearTimeout(tuner.timer)
    tuner.timer = null
    if (!am4) await gen3TunerOff()
    return { ok: true }
  }

  const isNum = (s) => /^\d+$/.test(String(s ?? ''))

  /** The handler for a request, or null when Bluetooth does not answer it. */
  function routeFor(method, path, part, body) {
    if (method === 'GET') {
      if (path === '/device/detect') return am4 ? am4Detect : gen3Detect
      if (path === '/preset') return am4 ? am4Preset : gen3Preset
      if (path === '/scene') return am4 ? am4Scene : gen3Scene
      if (path === '/tempo') return am4 ? am4Tempo : gen3Tempo
      if (path === '/preset/blocks') return am4 ? am4Blocks : gen3Blocks
      if (path === '/preset/scene-state') return am4 ? am4SceneState : gen3SceneState
      if (part[0] === 'presets' && isNum(part[1])) {
        const n = Number(part[1])
        if (part.length === 2) return () => (am4 ? am4StoredName(n) : gen3StoredName(n))
        /* The AM4 keeps scene names only in a 12 KB dump, which is never asked for over Bluetooth. */
        if (am4) return null
        if (part.length === 3 && part[2] === 'summary') {
          return async () => ({ number: n, name: last.name, scenes: await gen3SceneNames(n) })
        }
        if (part.length === 3 && part[2] === 'scenes') return async () => ({ number: n, names: await gen3SceneNames(n) })
      }
      return null
    }
    if (method === 'POST') {
      if (path === '/preset/select') return () => (am4 ? am4SelectPreset(body?.number) : gen3SelectPreset(body?.number))
      if (path === '/scene') return () => (am4 ? am4WriteScene(body?.index) : gen3WriteScene(body?.index))
      if (path === '/tempo') return () => (am4 ? am4WriteTempo(body?.bpm) : gen3WriteTempo(body?.bpm))
      /* The AM4 has no tap message; the phone works the BPM out and sends that. */
      if (path === '/tempo/tap') return am4 ? null : gen3Tap
      if (path === '/tuner') return () => writeTuner(body?.on === true)
      if (part[0] === 'preset' && part[1] === 'blocks' && isNum(part[2]) && part.length === 4) {
        const eid = Number(part[2])
        if (part[3] === 'bypass') return () => (am4 ? am4WriteBypass(eid, body?.bypassed) : gen3WriteBypass(eid, body?.bypassed))
        if (part[3] === 'channel') return () => (am4 ? am4WriteChannel(eid, body?.channel) : gen3WriteChannel(eid, body?.channel))
      }
    }
    return null
  }

  /**
   * One request, as device.js makes it: answered from the unit, or refused
   * here with nothing sent. A refusal never falls through to the computer —
   * with Bluetooth on, there is no computer to fall through to.
   */
  async function request(path, options = {}) {
    if (closed) throw notConnected()
    const method = String(options?.method || 'GET').toUpperCase()
    const clean = String(path || '').split('?')[0]
    const part = clean.split('/').filter(Boolean)
    let body = null
    try {
      body = typeof options?.body === 'string' ? JSON.parse(options.body) : options?.body ?? null
    } catch {
      body = null
    }
    const route = method === 'GET' || method === 'POST' ? routeFor(method, clean, part, body) : null
    if (!route) {
      say(`not over Bluetooth: ${method} ${clean}`)
      /* The computer's own documents simply do not exist here, which the app already handles. */
      throw method === 'GET' && (clean === '/device' || clean.startsWith('/store/')) ? notHere() : unsupported()
    }
    return route()
  }

  /* ================================================================ */
  /* The footswitch watch                                              */
  /* ================================================================ */

  const polls = { on: false, timer: null, tick: 0, run: 0 }
  let checking = false

  async function gen3Poll(n) {
    const s = await sceneNow('poll')
    if (s === SKIPPED) return
    if (Number.isInteger(s)) noteScene(s, true)
    if (n % (POLL_MS.preset / POLL_MS.scene) === 0) {
      const p = await presetNow('poll')
      if (p === SKIPPED) return
      if (p && !rejected(p)) notePreset(p, true)
    }
    if (n % (POLL_MS.tempo / POLL_MS.scene) === 0) {
      const t = await tempoNow('poll')
      if (Number.isInteger(t)) noteTempo(t, true)
    }
  }

  async function am4Poll() {
    const s = await readStructure({ priority: 'poll', fresh: true })
    if (!s || s === SKIPPED) return
    if (last.preset !== null && s.location !== last.preset) {
      notePreset({ number: s.location, name: s.name }, true)
      last.scene = s.scene
      return
    }
    notePreset({ number: s.location, name: s.name }, false)
    noteScene(s.scene, true)
  }

  /*
   * EACH START IS ITS OWN RUN, the way rig's watchUnit has watchRun. The
   * screen goes off and on in a blink — Control Center, a notification, Face
   * ID, every Android unlock — and a tick still waiting for its answer when
   * that happens would otherwise wake up, see the watch on again, and start a
   * second loop beside the new one: one more for every blink, each a 238-byte
   * answer on a 31,250-baud line, for as long as the adapter stayed connected.
   * A tick from an older run ends where it is.
   *
   * And nothing is asked until the unit has answered something on this
   * connection. A unit that never has may be the wrong one (an AM4 picked as
   * an FM3), and the rig's own ten-second check is enough for a silent one.
   */
  async function pollTick(run) {
    if (run !== polls.run) return
    polls.timer = null
    if (!polls.on || closed) return
    const n = polls.tick++
    try {
      if (!tuner.on && !checking && answered) await (am4 ? am4Poll() : gen3Poll(n))
    } catch {
      // A missed poll is the next poll's job.
    }
    if (polls.on && !closed && run === polls.run) polls.timer = time.setTimeout(() => pollTick(run), am4 ? POLL_MS.am4 : POLL_MS.scene)
  }

  /** Start watching for footswitch changes, with a poll straight away. The link layer calls this when the screen comes on. */
  function startPolls() {
    if (polls.on || closed || wrongUnit) return
    polls.on = true
    const run = ++polls.run
    polls.timer = time.setTimeout(() => pollTick(run), 0)
  }

  /** Stop watching: the screen went off, or the adapter went away. */
  function stopPolls() {
    polls.on = false
    polls.run++
    if (polls.timer !== null) time.clearTimeout(polls.timer)
    polls.timer = null
  }

  /* ================================================================ */
  /* The check panel                                                   */
  /* ================================================================ */

  const nameOf = (eid) => blocks.find((b) => b?.page === eid)?.name || `block ${eid}`
  /* A write's row: sent, or what the unit said about it. */
  const sentWords = (v) => (rejected(v) ? `refused: ${rejectedWords(v.rejected)}` : 'sent')
  const said = (v, words) => (v === null || v === undefined ? 'no answer' : rejected(v) ? `refused: ${rejectedWords(v.rejected)}` : words(v))

  /* Gen 3, step by step. Each `row` is one question as the panel shows it. */
  const GEN3_CHECKS = {
    model: (row) =>
      row(`The scene, asked as the ${spec.name}`, () => ask(buildGetScene(model), (f) => parseScene(f, model), WAIT.detect, 'the scene'), (v) =>
        v === null ? foreignWords() || 'no answer' : said(v, (s) => `it answers: scene ${s + 1}`)
      ),
    preset: (row) => row('Preset number and name', () => presetNow(), (v) => said(v, (p) => `preset ${p.number}, ${p.name || '(no name)'}`)),
    scene: (row) => row('Scene', () => sceneNow(), (v) => said(v, (s) => `scene ${s + 1}`)),
    'scene-names': async (row) => {
      for (let i = 0; i < 8; i++) {
        await row(`Scene ${i + 1}’s name`, () => ask(buildGetSceneName(model, i), (f) => parseSceneName(f, model), WAIT.sceneName, `scene ${i + 1}’s name`), (v) =>
          said(v, (s) => (s.index === i ? s.name || '(no name)' : `answered for scene ${s.index + 1} instead`))
        )
      }
    },
    tempo: (row) => row('Tempo', () => tempoNow(), (v) => said(v, (b) => `${b} BPM`)),
    blocks: (row) =>
      row('Blocks', () => statusNow(), (v) =>
        said(v, (list) => list.map((b) => `${nameOf(b.effectId)} · ${CH[b.channel] || b.channel} · ${b.bypassed ? 'off' : 'on'}`).join(', ') || 'none')
      ),
    'stored-name': async (row) => {
      const now = await row('Preset number and name', () => presetNow(), (v) => said(v, (p) => `preset ${p.number}`))
      if (!now || rejected(now)) return
      const n = now.number >= spec.maxPreset ? now.number - 1 : now.number + 1
      await row(`Preset ${n}’s name`, () => ask(buildGetPresetName(model, n), (f) => parsePresetName(f, model), WAIT.preset, `preset ${n}’s name`), (v) => {
        if (v === null) return 'nothing came back'
        if (rejected(v)) return `refused: ${rejectedWords(v.rejected)}`
        if (v.number !== n) {
          numberedOff = true
          return `answered for preset ${v.number} instead: this unit cannot say another preset’s name`
        }
        return `answered for that preset: ${v.name || '(no name)'}`
      })
    },
    echo: (row) => echoRow(row, () => sceneNow()),
    'write-scene': async (row) => {
      const from = await row('Scene', () => sceneNow(), (v) => said(v, (s) => `scene ${s + 1}`))
      if (!Number.isInteger(from)) throw failure('The unit did not say which scene it is on.', 504)
      const to = from === 1 ? 0 : 1
      const way = await row(`Scene ${to + 1}`, () => trialScene(to, from), (w) => wayWords(w))
      if (way) learn('scene', way)
      await row(`Back to scene ${from + 1}`, () => (way ? sceneBy(way, from) : trialScene(from)), sentWords)
      last.scene = from
      return { way }
    },
    'write-channel': async (row) => {
      const list = await row('Blocks', () => statusNow(), (v) => said(v, (l) => `${l.length} blocks`))
      if (!Array.isArray(list)) throw failure('The unit did not list its blocks.', 504)
      const amp = list.find((b) => b.effectId === 58) || list.find((b) => b.channels > 1)
      if (!amp) throw failure('There is no block with channels in this preset.', 409)
      const to = amp.channel === 1 ? 0 : 1
      const way = await row(`${nameOf(amp.effectId)} to ${CH[to]}`, () => trialChannel(amp.effectId, to, amp.channel), (w) => wayWords(w))
      if (way) learn('channel', way)
      await row(`${nameOf(amp.effectId)} back to ${CH[amp.channel]}`, () => (way ? changeChannelBy(way, amp.effectId, amp.channel) : trialChannel(amp.effectId, amp.channel)), sentWords)
      return { way }
    },
    'write-tempo': async (row) => {
      const from = await row('Tempo', () => tempoNow(), (v) => said(v, (b) => `${b} BPM`))
      if (!Number.isInteger(from)) throw failure('The unit did not say its tempo.', 504)
      const to = from >= AM4.TEMPO_MAX ? from - 1 : from + 1
      const way = await row(`Tempo ${to}`, () => trialTempo(to, from), (w) => wayWords(w))
      if (way) learn('tempo', way)
      await row(`Tempo back to ${from}`, () => (way ? tempoBy(way, from) : trialTempo(from)), sentWords)
      last.bpm = from
      return { way }
    },
    'write-preset': async (row) => {
      const now = await row('Preset', () => presetNow(), (v) => said(v, (p) => `preset ${p.number}, ${p.name || '(no name)'}`))
      if (!now || rejected(now)) throw failure('The unit did not say which preset it is on.', 504)
      const scene = await row('Scene', () => sceneNow(), (v) => said(v, (s) => `scene ${s + 1}`))
      const from = now.number
      const to = from >= spec.maxPreset ? from - 1 : from + 1
      const way = await row(`Preset ${to}`, () => trialPreset(to, from), (w) => (w === 'sysex' ? 'the SysEx switch worked' : w === 'pc' ? 'Program Change worked' : 'sent; the unit did not say where it landed'))
      if (way) learn('preset', way)
      await row(`Back to preset ${from}`, () => (way ? presetBy(way, from) : trialPreset(from)), sentWords)
      /* Loading a preset puts it on its own first scene; "back" means the scene too. */
      if (Number.isInteger(scene)) {
        await pause(WAIT.landed)
        await row(`Back to scene ${scene + 1}`, () => changeScene(scene), sentWords)
        last.scene = scene
      }
      notePreset({ number: from }, false)
      emit({ type: 'changed', scope: 'preset' })
      return { way }
    },
    'write-tuner': async (row) => {
      const before = { polled: tuner.polled, pushes }
      await row('Tuner on', () => fire(buildTunerPage(model, true), 'the tuner page'), () => 'tuner page open')
      await row('Tuner data, asked for', () => fire(buildTuner(model, true), 'the tuner'), sentWords)
      let polled = 0
      const until = time.now() + 3000
      while (time.now() < until) {
        const hz = await ex(buildTunerPoll(model), { match: (f) => parseTunerPoll(f, model), ms: WAIT.tunerPoll, fn: FN.PARAM, priority: 'read' })
        if (typeof hz === 'number') polled++
        await pause(TUNER_MS)
      }
      const pushed = pushes - before.pushes
      await row('Tuner off', () => fire(buildTuner(model, false), 'the tuner off').then(() => fire(buildTunerPage(model, false), 'the tuner page closed')), () =>
        `${polled} readings asked for, ${pushed} sent by the unit`
      )
      const way = polled ? 'poll' : pushed ? 'push' : null
      if (way) learn('tuner', way)
      return { way, polled, pushed }
    }
  }

  const wayWords = (w) => (w === 'published' ? 'the published way worked' : w === 'edit' ? 'FM3-Edit’s way worked' : 'sent; the unit did not say whether it took')

  async function changeChannelBy(way, eid, c) {
    const r = await fire(way === 'published' ? buildSetChannel(model, eid, c) : buildSetChannelEdit(model, eid, c), `block ${eid} to ${CH[c]}`)
    if (rejected(r)) throw refusedBy(r.rejected)
  }
  async function tempoBy(way, bpm) {
    const r = await fire(way === 'published' ? buildSetTempo(model, bpm) : buildSetTempoEdit(model, bpm), `tempo ${bpm}`)
    if (rejected(r)) throw refusedBy(r.rejected)
  }

  /* Ask something harmless and listen for our own bytes coming back. */
  async function echoRow(row, askIt) {
    const before = echoes
    await row('Echo test', async () => {
      await askIt()
      await pause(ECHO_MS)
      return echoes - before
    }, (n) => (n > 0 ? 'the unit sent the phone’s own message back: MIDI Thru is on. Turn it off on the unit.' : 'no echo'))
  }

  /* The AM4, step by step: reads from the list, and four writes that each put things back. */
  const slotWords = (codes) =>
    codes ? codes.map((c) => (c ? am4Block(c)?.slug || `0x${c.toString(16)}` : 'empty')).join(', ') : 'not taken from an answer that did not hold together'
  const AM4_CHECKS = {
    structure: (row) =>
      row('Preset, name, scene and blocks', () => readStructure({ fresh: true }), (s) =>
        s
          ? `${am4LocationCode(s.location)} ${s.name || '(no name)'}, scene ${s.scene + 1}, slots ${slotWords(s.slots)}${s.checksumOk ? '' : ' (its checksum did not hold)'}`
          : foreignWords() || 'no answer'
      ),
    tempo: (row) => row('Tempo', () => am4TempoNow(), (v) => said(v, (b) => `${b} BPM`)),
    blocks: async (row) => {
      const s = await row('Preset', () => readStructure({ fresh: true }), (v) => (v ? `slots ${slotWords(v.slots)}` : 'no answer'))
      if (!s) return
      for (const code of s.slots || []) {
        const block = am4Block(code)
        if (!block) continue
        await row(`${block.slug} on or off`, () => am4BypassNow(code), (v) => said(v, (off) => (off ? 'off' : 'on')))
        await row(`${block.slug} channel`, () => am4ChannelNow(code), (v) => said(v, (c) => CH[c]))
      }
    },
    'stored-name': async (row) => {
      const s = await row('Preset', () => readStructure({ fresh: true }), (v) => (v ? am4LocationCode(v.location) : 'no answer'))
      if (!s) return
      const n = s.location >= AM4.LOCATIONS - 1 ? s.location - 1 : s.location + 1
      await row(`${am4LocationCode(n)}’s name`, () => am4NameOf(n), (v) => said(v, (got) => (got.empty ? 'an empty slot' : got.name || '(no name)')))
    },
    echo: (row) => echoRow(row, () => am4TempoNow()),
    'write-scene': async (row) => {
      const s = await row('Scene', () => readStructure({ fresh: true }), (v) => (v ? `scene ${v.scene + 1}` : 'no answer'))
      if (!s) throw failure('The AM4 did not say which scene it is on.', 504)
      const to = s.scene === 1 ? 0 : 1
      await row(`Scene ${to + 1}`, () => fire(buildAm4Scene(to), `scene ${to + 1}`), sentWords)
      await row('Where it landed', () => readStructure({ fresh: true }), (v) => (v ? (v.scene === to ? `scene ${to + 1}: it worked` : `still scene ${v.scene + 1}`) : 'no answer'))
      await row(`Back to scene ${s.scene + 1}`, () => fire(buildAm4Scene(s.scene), `scene ${s.scene + 1}`), sentWords)
      structure = null
      last.scene = s.scene
    },
    'write-tempo': async (row) => {
      const from = await row('Tempo', () => am4TempoNow(), (v) => said(v, (b) => `${b} BPM`))
      if (!Number.isInteger(from)) throw failure('The AM4 did not say its tempo.', 504)
      const to = from >= AM4.TEMPO_MAX ? from - 1 : from + 1
      await row(`Tempo ${to}`, () => fire(buildAm4Tempo(to), `tempo ${to}`), sentWords)
      /* Exactly: the check moves it by one, so "within one" would pass a write that did nothing. */
      await row('Tempo now', () => am4TempoNow(), (v) => said(v, (b) => (b === to ? `${b} BPM: it worked` : `${b} BPM: it did not take`)))
      await row(`Tempo back to ${from}`, () => fire(buildAm4Tempo(from), `tempo ${from}`), sentWords)
      last.bpm = from
    },
    'write-bypass': async (row) => {
      const s = await row('Preset', () => readStructure({ fresh: true }), (v) => (v ? `slots ${slotWords(v.slots)}` : 'no answer'))
      if (s && !s.slots) throw failure('The AM4’s answer came through damaged, so no block was switched. Run it again.', 502)
      const code = s ? s.slots.find((c) => am4Block(c)) : undefined
      if (!code) throw failure('There is no block to switch in this preset.', 409)
      const slug = am4Block(code).slug
      const was = await row(`${slug} on or off`, () => am4BypassNow(code), (v) => said(v, (off) => (off ? 'off' : 'on')))
      if (typeof was !== 'boolean') throw failure(`The AM4 did not say whether the ${slug} is on.`, 504)
      await row(`${slug} ${was ? 'on' : 'off'}`, () => fire(buildAm4Bypass(code, !was), `the ${slug}`), sentWords)
      await row(`${slug} now`, () => am4BypassNow(code), (v) => said(v, (off) => (off !== was ? `${off ? 'off' : 'on'}: it worked` : 'it did not change')))
      await row(`${slug} back ${was ? 'off' : 'on'}`, () => fire(buildAm4Bypass(code, was), `the ${slug}`), sentWords)
    },
    'write-preset': async (row) => {
      const s = await row('Preset', () => readStructure({ fresh: true }), (v) => (v ? `${am4LocationCode(v.location)} ${v.name}` : 'no answer'))
      if (!s) throw failure('The AM4 did not say which preset it is on.', 504)
      const from = s.location
      const to = from >= AM4.LOCATIONS - 1 ? from - 1 : from + 1
      await row(`Preset ${am4LocationCode(to)}`, () => fire(buildAm4Preset(to), `preset ${am4LocationCode(to)}`), sentWords)
      await pause(WAIT.landed)
      await row('Where it landed', () => readStructure({ fresh: true }), (v) =>
        v ? (v.location === to ? `${am4LocationCode(to)}: it worked` : `still ${am4LocationCode(v.location)}`) : 'no answer'
      )
      await row(`Back to ${am4LocationCode(from)}`, () => fire(buildAm4Preset(from), `preset ${am4LocationCode(from)}`), sentWords)
      /* Loading a preset puts it on its own first scene; "back" means the scene too. */
      await pause(WAIT.landed)
      await row(`Back to scene ${s.scene + 1}`, () => fire(buildAm4Scene(s.scene), `scene ${s.scene + 1}`), sentWords)
      structure = null
      last.scene = s.scene
      notePreset({ number: from }, false)
      /* The unsaved changes are gone: the app reads the preset afresh. */
      emit({ type: 'changed', scope: 'preset' })
    }
  }

  /**
   * One step of the check panel, by its key from CHECK_STEPS (or 'all' for
   * every read). Answers {step, ok, rows, …}: each row is what was asked, the
   * bytes out and back in hex, what it means, and how long it took. The
   * footswitch watch waits while a check runs, so the rows are the check's own.
   */
  async function check(step) {
    const table = am4 ? AM4_CHECKS : GEN3_CHECKS
    const reads = CHECK_STEPS[am4 ? 'am4' : 'gen3'].reads.map((s) => s.step)
    const steps = step === 'all' ? reads : [step]
    if (!steps.every((s) => typeof table[s] === 'function')) throw badInput(`There is no check called ${step}.`)
    if (checking) throw failure('A check is already running.', 409)
    if (closed) throw notConnected()
    checking = true
    tracing = []
    const rows = []
    const row = async (asked, go, meaning) => {
      const mark = tracing.length
      const started = time.now()
      let value
      let error = null
      try {
        value = await go()
      } catch (err) {
        error = err
      }
      const seen = tracing.slice(mark)
      rows.push({
        asked,
        out: seen.map((e) => e.out).join(' | '),
        back: seen.map((e) => e.back).filter(Boolean).join(' | '),
        meaning: error ? `failed: ${error.message}` : meaning(value),
        ms: time.now() - started
      })
      if (error) throw error
      return value
    }
    try {
      let extra = {}
      for (const s of steps) extra = { ...extra, ...((await table[s](row)) || {}) }
      return { step, ok: true, rows, ...extra }
    } catch (err) {
      return { step, ok: false, rows, error: err.message }
    } finally {
      checking = false
      tracing = null
    }
  }

  /* ================================================================ */
  /* Lifetime                                                          */
  /* ================================================================ */

  /** Stop everything and answer anything waiting with "not connected": the adapter has gone. */
  function close() {
    if (closed) return
    closed = true
    stopPolls()
    if (holdTimer !== null) time.clearTimeout(holdTimer)
    holdTimer = null
    tuner.on = false
    tuner.run++
    if (tuner.timer !== null) time.clearTimeout(tuner.timer)
    tuner.timer = null
    const err = notConnected()
    if (current) {
      const job = current
      current = null
      if (job.timer !== undefined) time.clearTimeout(job.timer)
      job.reject(err)
    }
    while (waiting.length) waiting.shift().reject(err)
    handlers.clear()
  }

  return {
    unit,
    model,
    request,
    /** Events the unit sends unasked, and the echoes of this phone's own writes, in rig.handleEvent's shapes. */
    subscribe(fn) {
      if (typeof fn !== 'function') return () => {}
      handlers.add(fn)
      return () => handlers.delete(fn)
    },
    heard,
    heardShort,
    startPolls,
    stopPolls,
    check,
    /** How each command is sent now, and what auto has learned. */
    methods: methodsCopy,
    /** Change how commands are sent (the check panel's choices). */
    setMethods(next) {
      ways = settleMethods({ ...methodsCopy(), ...next, learned: { ...ways.learned, ...(next?.learned || {}) } })
      keep()
      return methodsCopy()
    },
    /** For the log and the panel: how many of our own messages came back, and how many tuner pushes arrived. */
    counts: () => ({ echoes, pushes }),
    /*
     * Refresh names asked: the next read of the scene names goes to the unit.
     * Kept until the preset changes otherwise, so a scene renamed on the
     * unit's own screen never showed, under a button promising a fresh read.
     */
    forgetSceneNames() {
      sceneCache = null
    },
    close
  }
}

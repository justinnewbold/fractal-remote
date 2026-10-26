/**
 * BLUETOOTH (BETA) ON A VP4: PRESETS AND SCENES, THE WAY A FOOT CONTROLLER
 * DOES THEM, AND NOTHING ELSE.
 *
 * "I'm curious why the VP4 is not listed? ... it uses the same architecture
 * as the AM4." (Justin, 25 October 2026.) Underneath it does speak the
 * AM4's SysEx, but nobody on this project has a VP4, and a message that
 * looked right is what froze an AM4 until it was switched off and on. So
 * over Bluetooth a VP4 is sent exactly what the computer app sends it for
 * presets and scenes (ForgeFX drivers/vp4.ts, at the pin in
 * desktop/forgefx.lock.json), the two messages Fractal's own VP4 manual
 * documents and every MIDI foot controller sends:
 *
 *   - PRESETS: one Program Change, PC 0..103 = A1..Z4, on the MIDI channel
 *     the player saved in Settings → VP4 scenes & presets (1 when none was).
 *     No Bank Select (the VP4 neither sends nor receives one), never sent
 *     twice by itself. vp4ProgramChange, the computer's own two bytes.
 *   - SCENES: the Scene Select Control Change, value 0..3 = scenes 1..4, on
 *     the number the player set on the VP4 and saved in the same place. No
 *     number, nothing sent (device.js vp4SceneGate, before it reaches here).
 *     Never Scene +1/-1: a doubled tap would step twice. vp4SceneSelect.
 *
 * NOT ONE BYTE OF SYSEX. The computer reads a VP4 by the one record VP4-Edit
 * itself polls, and switches its effects with frames recorded from VP4-Edit;
 * over a 5-pin MIDI cable nobody has ever sent either to a VP4, so neither
 * goes. Every message passes through vp4BleAllowed, which lets through a
 * Program Change for A1..Z4 and a Scene Select on a number the player may
 * use with a scene 0..3, and nothing else at all: no SysEx, no other
 * controller, no note, no clock. Anything else is logged and dropped.
 *
 * SO THE PHONE CANNOT HEAR A VP4, and says so. It reads nothing from it:
 * not which preset or scene it is on, not its names, not its effects, not
 * its tuner. The white plug is not needed, and the steps leave it out
 * (shared/bluetooth-gear hookupFor). What the phone knows is what it sent:
 *
 *   - the link: the adapter connected is all there is to know, so the
 *     unit's check (GET /device/detect) answers connected while the adapter
 *     is, and the Bluetooth page says "sending to the VP4", never "VP4
 *     answering" (screens/Bluetooth status);
 *   - the scene: the last one this connection sent, scene 1 until then, so
 *     the unit watch (unit-watch probeUnit, which asks a VP4 its scene) has
 *     an answer, and Play lights the scene that was tapped;
 *   - a preset or scene sent is answered as sent, the way a foot controller
 *     knows it: `landed: true` for a preset, so its place (B1) goes up and a
 *     setlist song's scene follows it, and never `confirmed: false` for a
 *     scene, so a number that cannot be checked is never held. Both carry
 *     `sentOnly: true`, and the page and the store texts say it cannot be
 *     checked.
 *
 * Everything else is refused here with nothing sent: a 501, which device.js
 * says in the VP4's own words (lib/vp4-safety vp4Said, the same as over the
 * computer). The chain is answered empty, and Play says why
 * (VP4_OVER_BLUETOOTH, shared/bluetooth-gear). Knobs, a save and a stored
 * preset's name never get this far: device.js answers them first
 * (vp4Instead), as it does over the computer.
 *
 * ON TIME OR NOT AT ALL, as the computer: a tap past its deadline is not
 * sent. And a scene asked for straight after a Program Change waits until
 * PRESET_SETTLE_MS after it, the computer's own first-read delay (ForgeFX
 * PRESET_FIRST_READ_MS), so it does not reach a VP4 still loading the
 * preset; past its deadline by then, it is not sent either.
 *
 * Handed its transport, as bleWire is, so Node can drive it against a
 * pretend VP4 byte by byte (test/bluetooth.mjs). No imports from bleWire,
 * which hands units to this file: the two would import each other.
 */
import { isFractal, toHex } from './fractal-sysex.mjs'
import { vp4ChannelOk, vp4PresetCode, vp4SceneCcOk } from './vp4-safety.js'

/** How many presets a VP4 holds: A1..Z4 (the VP4 manual's MIDI PC table, ForgeFX VP4_PRESETS). */
export const VP4_PRESETS = 104
/** And scenes. */
export const VP4_SCENES = 4
/** A VP4's model byte, for the messages it might send unasked. */
export const VP4_MODEL = 0x14
/** How long after a Program Change a scene waits, so it does not reach a VP4 still loading (ForgeFX PRESET_FIRST_READ_MS). */
export const PRESET_SETTLE_MS = 250

/**
 * THE VP4'S ONE WAY OUT. Whether these bytes may go to a VP4 over Bluetooth:
 * a Program Change for A1..Z4 on any channel, or a Scene Select Control
 * Change on a number a player may use (vp4SceneCcOk: 1..119, never 32) with
 * a scene 0..3. Nothing else, ever: no SysEx, no other message.
 */
export function vp4BleAllowed(bytes) {
  if (!Array.isArray(bytes) || !bytes.every((b) => Number.isInteger(b) && b >= 0 && b <= 0xff)) return false
  if (bytes.length === 2 && (bytes[0] & 0xf0) === 0xc0) return bytes[1] < VP4_PRESETS
  if (bytes.length === 3 && (bytes[0] & 0xf0) === 0xb0) return vp4SceneCcOk(bytes[1]) && bytes[2] < VP4_SCENES
  return false
}

/** One Program Change: [0xC0 | channel-1, n]. Throws for anything it may not send rather than sending something near it. */
export function vp4ProgramChange(n, channel = 1) {
  if (!Number.isInteger(n) || n < 0 || n >= VP4_PRESETS) throw new Error('A VP4 has presets A1 to Z4 (0..103).')
  if (!vp4ChannelOk(channel)) throw new Error('The VP4’s MIDI channel is a number from 1 to 16.')
  return [0xc0 | (channel - 1), n]
}

/** The Scene Select Control Change: [0xB0 | channel-1, the player's number, scene 0..3]. Throws for anything it may not send. */
export function vp4SceneSelect(cc, channel, scene) {
  if (!vp4SceneCcOk(cc)) throw new Error('Scene Select is a number from 1 to 119, and not 32.')
  if (!vp4ChannelOk(channel)) throw new Error('The VP4’s MIDI channel is a number from 1 to 16.')
  if (!Number.isInteger(scene) || scene < 0 || scene >= VP4_SCENES) throw new Error('A VP4 has scenes 1 to 4.')
  return [0xb0 | (channel - 1), cc, scene]
}

/*
 * A VP4's capabilities over Bluetooth, in the shapes the screens read: the
 * computer's VP4 (ForgeFX Vp4Driver capabilities) with `via`, which keeps
 * Edit, Save and the looper out of the way, and no tuner, no channels and
 * nothing to read. `plainMidi` says presets and scenes go, which is what
 * device.js's VP4 gates ask (vp4ComputerCan).
 */
export const VP4_BLE_CAPABILITIES = Object.freeze({
  via: 'bluetooth',
  slotModel: 'linear',
  slotCount: 4,
  hasScenes: true,
  sceneCount: VP4_SCENES,
  hasChannels: false,
  channelNames: [],
  cabIrs: false,
  fc: { model: false, liveState: false },
  tuner: false,
  supportsSave: false,
  presets: { count: VP4_PRESETS, addressing: 'bankLetterShort', canScanNames: false },
  plainMidi: { programChange: true, sceneSelect: true },
  sendOnly: true
})

const failure = (message, status, extra = {}) => Object.assign(new Error(message), { status, bluetooth: true, ...extra })
const unsupported = () => failure('unsupported', 501, { unsupported: true })
const notHere = () => failure('Not over Bluetooth.', 404)
const notConnected = () => failure('The Bluetooth adapter is not connected.', 503)
const tooLate = () => failure('Not sent in time.', 504, { late: true })
const badInput = (what) => failure(what, 400)

const realClock = {
  now: () => Date.now(),
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (t) => clearTimeout(t)
}

/**
 * @param {object} o
 * @param {(bytes:number[]) => boolean} o.send  one message to the adapter; false when it would not take it
 * @param {{now, setTimeout, clearTimeout}} [o.clock]
 * @param {(line:string) => void} [o.log]
 * @param {(name:string|null) => void} [o.onForeign]  called once, with its bare name, when another unit's message arrives
 * @param {(byte:number) => string|null} [o.nameOf]  a model byte's bare name (bleWire modelName)
 */
export function createVp4Wire({ send, clock, log, onForeign, nameOf = () => null } = {}) {
  if (typeof send !== 'function') throw new Error('Bluetooth needs a way to send.')
  const time = clock || realClock
  let closed = false
  /* The last scene this connection sent: what GET /scene answers (see the head of this file). */
  let scene = 0
  /* When the last Program Change went, for the scene that follows it. */
  let presetAt = -Infinity
  let foreignTold = false
  let heardTold = false
  const handlers = new Set()
  const timers = new Set()

  const say = (line) => {
    try {
      if (log) log(line)
    } catch {
      // The log is for reading afterwards; it can never stop a request.
    }
  }

  /* Every message for the VP4 passes through this, and only what vp4BleAllowed lets through goes. */
  function out(bytes, what) {
    if (closed) throw notConnected()
    if (!vp4BleAllowed(bytes)) {
      say(`refused to send the VP4 ${toHex(bytes)}: it is not one of the messages a VP4 is ever sent over Bluetooth`)
      throw failure('That message is never sent to a VP4.', 500, { refused: true })
    }
    if (send(bytes) === false) throw notConnected()
    say(`sent ${what}: ${toHex(bytes)}`)
  }

  const wait = (ms) =>
    new Promise((resolve) => {
      const t = time.setTimeout(() => {
        timers.delete(t)
        resolve()
      }, ms)
      timers.add(t)
    })

  const detectAnswer = () => ({
    connected: !closed,
    name: 'VP4',
    short: 'VP4',
    modelId: VP4_MODEL,
    gen: 3,
    supported: true,
    simulated: false,
    port: 'bluetooth',
    sendOnly: true,
    capabilities: { ...VP4_BLE_CAPABILITIES, presets: { ...VP4_BLE_CAPABILITIES.presets }, plainMidi: { ...VP4_BLE_CAPABILITIES.plainMidi } }
  })

  async function selectPreset(body, deadline) {
    const n = Number(body?.number)
    const channel = body?.midiChannel === undefined ? 1 : Number(body.midiChannel)
    if (!Number.isInteger(n) || n < 0 || n >= VP4_PRESETS) throw badInput(`There is no preset ${body?.number} on a VP4.`)
    if (!vp4ChannelOk(channel)) throw badInput('The VP4’s MIDI channel is a number from 1 to 16.')
    if (deadline !== null && time.now() >= deadline) {
      say(`not sent, past its deadline: Program Change ${n}`)
      throw tooLate()
    }
    out(vp4ProgramChange(n, channel), `Program Change ${n} (${vp4PresetCode(n)}) on channel ${channel}`)
    presetAt = time.now()
    /* The VP4 is given the moment the computer gives it before anything follows (PRESET_SETTLE_MS). */
    await wait(PRESET_SETTLE_MS)
    if (closed) throw notConnected()
    return { ok: true, number: n, code: vp4PresetCode(n), landed: true, sentOnly: true }
  }

  async function writeScene(body, deadline) {
    const index = Number(body?.index)
    const cc = Number(body?.sceneCc)
    const channel = body?.midiChannel === undefined ? 1 : Number(body.midiChannel)
    if (!Number.isInteger(index) || index < 0 || index >= VP4_SCENES) throw badInput('A VP4 has scenes 1 to 4.')
    if (!vp4SceneCcOk(cc)) throw badInput('Scene Select is a number from 1 to 119, and not 32.')
    if (!vp4ChannelOk(channel)) throw badInput('The VP4’s MIDI channel is a number from 1 to 16.')
    const settle = presetAt + PRESET_SETTLE_MS - time.now()
    if (settle > 0) {
      if (deadline !== null && time.now() + settle >= deadline) {
        say(`not sent, the VP4 still loading a preset at its deadline: Scene Select ${cc} = ${index}`)
        throw tooLate()
      }
      await wait(settle)
      if (closed) throw notConnected()
    }
    if (deadline !== null && time.now() >= deadline) {
      say(`not sent, past its deadline: Scene Select ${cc} = ${index}`)
      throw tooLate()
    }
    out(vp4SceneSelect(cc, channel, index), `Scene Select ${cc} = ${index} (scene ${index + 1}) on channel ${channel}`)
    scene = index
    emit({ type: 'scene', index })
    return { ok: true, index, sentOnly: true }
  }

  const emit = (event) => {
    for (const fn of [...handlers]) {
      try {
        fn(event)
      } catch {
        // One listener cannot stop the others hearing it.
      }
    }
  }

  /** The handler for a request, or null when Bluetooth does not answer it on a VP4. */
  function routeFor(method, path, body, deadline) {
    if (method === 'GET') {
      if (path === '/device/detect') return () => detectAnswer()
      if (path === '/scene') return () => ({ index: scene, sentOnly: true })
      /* The chain, its names and its on/offs cannot be read without SysEx: empty, and Play says why (VP4_OVER_BLUETOOTH). */
      if (path === '/preset/grid') return () => ({ cells: [], name: null, scenes: null, sentOnly: true })
      if (path === '/preset/blocks' || path === '/preset/scene-state') return () => []
      return null
    }
    if (method === 'POST') {
      if (path === '/preset/select') return () => selectPreset(body, deadline)
      if (path === '/scene') return () => writeScene(body, deadline)
    }
    return null
  }

  const toldNot = new Set()
  async function request(path, options = {}) {
    if (closed) throw notConnected()
    const deadline = Number.isFinite(options?.deadline) ? options.deadline : null
    const method = String(options?.method || 'GET').toUpperCase()
    const clean = String(path || '').split('?')[0]
    let body = null
    try {
      body = typeof options?.body === 'string' ? JSON.parse(options.body) : options?.body ?? null
    } catch {
      body = null
    }
    const route = routeFor(method, clean, body, deadline)
    if (!route) {
      const kind = `${method} ${clean.replace(/(\/|%3A|:)\d+(?=\/|$)/gi, '$1n')}`
      if (!toldNot.has(kind)) {
        toldNot.add(kind)
        say(`not over Bluetooth on a VP4: ${method} ${clean}`)
      }
      throw method === 'GET' && (clean === '/device' || clean.startsWith('/store/')) ? notHere() : unsupported()
    }
    return route()
  }

  /*
   * WHAT COMES BACK, which on a VP4 should be nothing: the steps leave the
   * white plug out. A Fractal message from another unit means the adapter
   * is on another unit, and the page is told which (onForeign, once); a
   * VP4's own, or anything else, is written down once and read no further.
   */
  function heard(f) {
    if (closed || !isFractal(f)) return
    const model = f[4]
    if (model === 0x7f) return
    if (model !== VP4_MODEL) {
      const name = nameOf(model)
      say(`a message from ${name ? `a unit that says it is ${name}` : `model 0x${model.toString(16)}`}, not a VP4`)
      if (!foreignTold && name) {
        foreignTold = true
        try {
          onForeign?.(name)
        } catch {
          // The page's note is for reading; it can never stop the wire.
        }
      }
      return
    }
    if (!heardTold) {
      heardTold = true
      say('the VP4 sent a message; over Bluetooth the app reads nothing from a VP4')
    }
  }

  function heardShort() {
    /* Nothing a VP4 sends is read over Bluetooth (see the head of this file). */
  }

  function close() {
    if (closed) return { unitTunerOwed: false }
    closed = true
    for (const t of timers) time.clearTimeout(t)
    timers.clear()
    handlers.clear()
    return { unitTunerOwed: false }
  }

  const fixedMethods = () => ({ scene: 'auto', channel: 'auto', tempo: 'auto', preset: 'auto', tuner: 'auto', pcChannel: 1, learned: {} })

  return {
    unit: 'vp4',
    model: VP4_MODEL,
    request,
    subscribe(fn) {
      if (typeof fn !== 'function') return () => {}
      handlers.add(fn)
      return () => handlers.delete(fn)
    },
    heard,
    heardShort,
    heardBytes() {},
    unitTunerOwed: () => false,
    unitTunerOpen: () => false,
    oweGen3Tuner() {},
    gen3TunerOwes: () => false,
    gen3TunerLeftOn: () => false,
    gen3TunerOwed: () => null,
    /* No footswitch watch: a VP4 is never asked anything. */
    startPolls() {},
    stopPolls() {},
    screenOff() {},
    screenOn() {},
    async check(step) {
      return { step, ok: false, rows: [], error: 'Nothing to check on a VP4 over Bluetooth: the app only sends to it, and reads nothing back.' }
    },
    methods: fixedMethods,
    setMethods: fixedMethods,
    counts: () => ({ echoes: 0, pushes: 0 }),
    forgetSceneNames() {},
    close
  }
}

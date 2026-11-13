/*
 * WHAT IS INSIDE A .nam FILE, AS FAR AS SENDING ONE TO A UNIT GOES.
 *
 * A Neural Amp Modeler capture is a text file (JSON): which kind of network
 * it is, and the network's numbers. The format is open. An "A2" capture, the
 * kind the Axe-Fx III's NAM block plays (its firmware refuses the older
 * A1), is two networks in one file, a full one and a lite one
 * ("SlimmableContainer" with `submodels`), each with its own list of
 * numbers.
 *
 * Measured on the open NAM engine's own example (NeuralAmpModelerCore
 * example_models/A2.nam, 13 November 2026): 665,758 characters of text
 * holding 14,017 numbers, 1,871 in the lite network and 12,146 in the full
 * one. The text is ten times the size of what it says: four bytes a number
 * is 56,068 bytes, about 64 KB once written as MIDI's seven-bit bytes.
 *
 * This reads the file and counts. How Axe-Edit packs those numbers for the
 * unit is in lib/nam-install.js, from a recording of it (13 November 2026):
 * one record of 16,384 words whatever the capture, about 83 KB as MIDI. The
 * sizes below are still the estimate from four bytes a number that the test
 * card shows, and say so (`sendEstimate`).
 *
 * Imports nothing.
 */

/** A DIN MIDI jack carries 31,250 bits a second, ten to a byte: what a Bluetooth adapter on a unit's MIDI jacks can pass. */
export const DIN_BYTES_A_SECOND = 3125

/** Every list called `weights` under `node`, in file order, as { numbers, max, weights } (a submodel's `max_value` when it has one). */
function weightLists(node, found = [], max = null) {
  if (Array.isArray(node)) {
    for (const v of node) weightLists(v, found, max)
    return found
  }
  if (!node || typeof node !== 'object') return found
  const here = typeof node.max_value === 'number' ? node.max_value : max
  for (const [key, v] of Object.entries(node)) {
    if (key === 'weights' && Array.isArray(v) && v.every((x) => typeof x === 'number')) {
      /* An empty list is no network: an A2 file carries one at the top, beside the two that hold its numbers. */
      if (v.length) found.push({ numbers: v.length, max: here, weights: v })
    }
    else weightLists(v, found, here)
  }
  return found
}

/**
 * The numbers themselves, for the one place that packs a capture for a unit
 * (lib/nam-install): each network's list in file order, with the file's own
 * notes about the capture. `{ ok: true, networks: [{ weights, share }],
 * metadata }` or `{ ok: false, why }`.
 */
export function namNetworks(text) {
  let file
  try {
    file = JSON.parse(String(text))
  } catch {
    return { ok: false, why: 'This isn’t a NAM capture: the file isn’t the text a .nam file is.' }
  }
  if (!file || typeof file !== 'object' || Array.isArray(file) || typeof file.architecture !== 'string') {
    return { ok: false, why: 'This isn’t a NAM capture: the file doesn’t say what kind of network it is.' }
  }
  const lists = weightLists(file)
  if (!lists.length) return { ok: false, why: 'This NAM capture has no numbers in it.' }
  const a2 = file.architecture === 'SlimmableContainer' && Array.isArray(file.config?.submodels) && file.config.submodels.length > 0
  return {
    ok: true,
    a2,
    architecture: file.architecture,
    networks: lists.map((l) => ({ weights: l.weights, share: l.max })),
    metadata: file.metadata && typeof file.metadata === 'object' && !Array.isArray(file.metadata) ? file.metadata : {}
  }
}

/**
 * Read a .nam file's text. `{ ok: true, architecture, version, a2, numbers,
 * networks, sampleRate, name }` or `{ ok: false, why }` in plain words.
 * `networks` is each network's count of numbers, in file order, with the
 * share of the full size it runs at when the file says (0.5 and 1 in the
 * example).
 */
export function readNam(text) {
  let file
  try {
    file = JSON.parse(String(text))
  } catch {
    return { ok: false, why: 'This isn’t a NAM capture: the file isn’t the text a .nam file is.' }
  }
  if (!file || typeof file !== 'object' || Array.isArray(file) || typeof file.architecture !== 'string') {
    return { ok: false, why: 'This isn’t a NAM capture: the file doesn’t say what kind of network it is.' }
  }
  const lists = weightLists(file)
  const numbers = lists.reduce((n, l) => n + l.numbers, 0)
  if (!numbers) return { ok: false, why: 'This NAM capture has no numbers in it.' }
  const a2 = file.architecture === 'SlimmableContainer' && Array.isArray(file.config?.submodels) && file.config.submodels.length > 0
  const meta = file.metadata && typeof file.metadata === 'object' ? file.metadata : {}
  return {
    ok: true,
    architecture: file.architecture,
    version: typeof file.version === 'string' ? file.version : null,
    a2,
    numbers,
    networks: lists.map((l) => ({ numbers: l.numbers, share: l.max })),
    sampleRate: typeof file.sample_rate === 'number' ? file.sample_rate : null,
    name: typeof meta.name === 'string' && meta.name.trim() ? meta.name.trim() : null
  }
}

/**
 * About how much there is to send for a capture of `numbers` numbers, and
 * how long that is over a Bluetooth adapter on the MIDI jacks: four bytes a
 * number, eight sevenths of that as MIDI bytes, at a MIDI jack's speed. An
 * estimate until the real packing is known, and without the messages'
 * own wrapping or any waits between them.
 */
export function sendEstimate(numbers) {
  const n = Math.max(0, Math.floor(Number(numbers) || 0))
  const bytes = n * 4
  const midiBytes = Math.ceil((bytes * 8) / 7)
  return { bytes, midiBytes, dinSeconds: Math.ceil(midiBytes / DIN_BYTES_A_SECOND) }
}

/** The line the test card shows for a capture that was read: what is in it, and what sending it would take. */
export function namSaid(read) {
  if (!read?.ok) return read?.why || 'This capture could not be read.'
  if (!read.a2) return `This is an older kind of capture (${read.architecture}). The Axe-Fx III’s NAM block plays A2 captures only.`
  const est = sendEstimate(read.numbers)
  const parts = read.networks.length > 1 ? ` (${read.networks.map((x) => x.numbers.toLocaleString('en-US')).join(' and ')})` : ''
  return `An A2 capture: ${read.numbers.toLocaleString('en-US')} numbers${parts}. About ${Math.round(est.midiBytes / 1024)} KB to send: about ${est.dinSeconds} seconds over a Bluetooth adapter, a second or two by USB. An estimate until installing is built.`
}

/**
 * WHICH PICTURE EACH KIND OF EFFECT WEARS, worded once for both ends.
 *
 * "It looks like chain glyphs/icons that we made are only rendering on the
 * AM4 and VP4. Looks like we still need to add those to all the other ones."
 * Nine were cut from his mockup — amp, cab, compressor, delay, drive, flanger,
 * phaser, reverb, wah — and every other kind of block drew its letters alone.
 * The rest were drawn to match (white line drawings, 96 pixels square, the
 * same weight), and this is the one list that says which file a block gets,
 * so the phone and the browser cannot disagree.
 *
 * Several kinds are the same family and share a picture: the four other
 * delays wear the delay, the multiband compressor the compressor, the input
 * gate the gate. Send and Return have files of their own names because
 * `send.png` is already the app's send-a-link button.
 *
 * Returns a file name without its extension, or null for a block that has no
 * picture (input and output are never drawn as tiles).
 */
export const BLOCK_ICON = {
  amp: 'amp',
  cab: 'cab',
  comp: 'comp',
  compressor: 'comp',
  multicomp: 'comp',
  delay: 'delay',
  multitap: 'delay',
  megatap: 'delay',
  tentap: 'delay',
  plex: 'delay',
  drive: 'drive',
  flanger: 'flanger',
  phaser: 'phaser',
  reverb: 'reverb',
  wah: 'wah',
  chorus: 'chorus',
  enhancer: 'enhancer',
  filter: 'filter',
  formant: 'formant',
  gate: 'gate',
  ingate: 'gate',
  geq: 'geq',
  peq: 'peq',
  looper: 'looper',
  mixer: 'mixer',
  multiplexer: 'multiplexer',
  pitch: 'pitch',
  resonator: 'resonator',
  ringmod: 'ringmod',
  rotary: 'rotary',
  synth: 'synth',
  tremolo: 'tremolo',
  volume: 'volpan',
  volpan: 'volpan',
  send: 'sendfx',
  return: 'returnfx'
}

export function blockIconName(slug) {
  if (!slug) return null
  const key = String(slug).toLowerCase()
  if (BLOCK_ICON[key]) return BLOCK_ICON[key]
  /* Slugs sometimes carry an instance suffix — delay2, drive1. */
  const bare = key.replace(/\d+$/, '')
  if (BLOCK_ICON[bare]) return BLOCK_ICON[bare]
  /* Display names arrive with spaces, hyphens and slashes. */
  return BLOCK_ICON[bare.replace(/[^a-z]/g, '')] || null
}

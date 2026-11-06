/**
 * Three letters for a block, for the places a whole name will not fit.
 *
 * The chain strip has used these since it existed. The stage screen now needs
 * them too — four effects to a row on a phone leaves about ninety pixels a
 * tile, and "MULTITAP DELAY 2" in ninety pixels is an ellipsis with a number
 * after it. Three letters and a colour is what a player reads on a dark stage
 * anyway; the full name is on the tile's own page.
 *
 * Unknown slugs take their own first three letters rather than a placeholder,
 * because a block this table has not heard of is still better identified by
 * the start of its name than by "???".
 */
import { NEW_BLOCK_SHORT } from '../../shared/new-block.mjs'

const SHORT = {
  wah: 'WAH',
  drive: 'DRV',
  amp: 'AMP',
  cab: 'CAB',
  comp: 'CMP',
  compressor: 'CMP',
  multicomp: 'MCP',
  geq: 'GEQ',
  peq: 'PEQ',
  delay: 'DLY',
  multitap: 'MTD',
  megatap: 'MGT',
  tentap: 'TTD',
  reverb: 'REV',
  plex: 'PLX',
  chorus: 'CHO',
  flanger: 'FLG',
  phaser: 'PHA',
  tremolo: 'TRM',
  pitch: 'PIT',
  synth: 'SYN',
  gate: 'GTE',
  ingate: 'IGT',
  filter: 'FLT',
  formant: 'FRM',
  resonator: 'RES',
  volume: 'VOL',
  volpan: 'VOL',
  looper: 'LPR',
  enhancer: 'ENH',
  rotary: 'ROT',
  mixer: 'MIX',
  multiplexer: 'MUX',
  send: 'SND',
  return: 'RTN',
  input: 'IN',
  output: 'OUT'
}

/* No slug at all is a block newer than the app (shared/new-block.mjs): "New", never "??". */
export const shortName = (slug) => SHORT[slug] || (slug ? slug.slice(0, 3).toUpperCase() : NEW_BLOCK_SHORT)

/**
 * The same, with the instance number kept when there is one.
 *
 * "Delay 1" and "Delay 2" are two different blocks in the same preset and a
 * player switching one of them has to be able to tell which. The number is the
 * only part of the long name that carries that, so it is the only part kept.
 *
 * Taken from the NAME rather than counted here: the unit decides what its
 * second delay is called, and a preset can hold Delay 2 without holding
 * Delay 1 at all.
 */
export const shortBlock = (block) => {
  /* A block newer than the app: "New", never "New 201" off the computer's eid_201. */
  if (!block?.slug) return NEW_BLOCK_SHORT
  const abbr = shortName(block?.slug)
  const n = /(\d+)\s*$/.exec(block?.name || '')
  return n && n[1] !== '1' ? `${abbr} ${n[1]}` : abbr
}

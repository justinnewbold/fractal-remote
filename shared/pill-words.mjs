/**
 * Play's pill on the phone, in words: the state, the unit, and the computer.
 *
 * Its own file rather than a few more lines in link-word.mjs, which the web
 * app imports: every byte of a file the computer app serves counts toward the
 * computer's fingerprint (scripts/computer-fingerprint.mjs), and a change to
 * one makes a new computer app at the merge whether or not the computer uses
 * it. Only the phone draws the pill, so only the phone carries this. The day
 * the browser's bar wears it too, it can import it from here.
 */
import { unitWord } from './link-word.mjs'

/**
 * PLAY'S PILL: WHICH UNIT, ON WHICH COMPUTER, in the place of CONNECTED.
 *
 * "This is from my other app axiom. Can we list the computer and device it's
 * connected to like this instead of the word connected? Also have that be the
 * button that can switch what unit it's connected to?" (24 October 2026,
 * with a picture of Axiom's bar: "Live ● AM4" over "on Raspberry Pi".) The
 * unit's name and the link's word were two spots at either end of the bar;
 * they are one pill now, and the pill is the way to another unit.
 *
 * The same truths as before, in the pill's words: `unitWord` still decides
 * NO UNIT and NOT ANSWERING, and only a good link says Live, so a frozen
 * unit can no more read Live here than it could read green before. The
 * second line names the computer as it names itself (its own name, such as
 * "MacBook Pro" or "raspberry pi 3": a computer does not say whether it is a
 * Mac or a Pi), "over Bluetooth" when the phone goes through an adapter, and
 * "simulated" in the demo. `mark` is linkTone's vocabulary, so the colours
 * are the ones the word had: ok, wait, no, off.
 *
 * `unit` is the unit's short name ('AM4'), `unitState` the rig's 'present',
 * 'missing', 'silent' or 'unknown', and `computer` the name of the computer
 * being driven.
 */
export function pillWords({ tone, unitState = 'unknown', unit = '', computer = null, demo = false, bluetooth = false } = {}) {
  const name = typeof unit === 'string' ? unit.trim() : ''
  if (demo) return { status: 'Demo', mark: 'wait', unit: name, where: 'simulated' }
  const host = typeof computer === 'string' ? computer.trim() : ''
  /*
   * "on your computer" until the computer has said its name: the second line
   * is always there, so the bar is one height and Play does not move down
   * under a thumb when a late name read lands (a slow Pi 3, a computer that
   * has not written its name yet).
   */
  const where = bluetooth ? 'over Bluetooth' : host ? `on ${host}` : 'on your computer'
  if (tone === 'good') {
    const said = unitWord(tone, unitState)
    if (said === 'no unit') return { status: 'No unit', mark: 'no', unit: '', where }
    if (said === 'not answering') return { status: 'Not answering', mark: 'no', unit: name, where }
    if (unitState === 'present' && name) return { status: 'Live', mark: 'ok', unit: name, where }
    return { status: 'Looking', mark: 'off', unit: name, where }
  }
  if (tone === 'busy') return { status: 'Connecting', mark: 'wait', unit: name, where }
  if (tone === 'bad') return { status: 'Disconnected', mark: 'no', unit: name, where }
  /* Nothing turned on yet: no unit to name, and no computer to say it is on (the bar keeps the empty line). */
  return { status: bluetooth ? 'Not connected' : 'No computer', mark: 'off', unit: '', where: bluetooth ? where : null }
}

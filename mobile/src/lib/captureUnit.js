/*
 * WHICH UNIT A NAM BLOCK IS ON, for the capture screens. Pure: a test runs it.
 *
 * The capture tools (TONE3000's page, the card a sent capture gets) were
 * written when only an Axe-Fx III had a NAM block, so its two block ids and
 * its name are in their words. Since AM4 firmware 3.00 an AM4 has a NAM
 * Player too ("Fractal just announced NAM support for AM4", Justin, 18
 * November 2026), with ids of its own (lib/am4-nam: 0xD1 and 0xD2, off his
 * unit's log and his recording of AM4-Edit). The two sets share no number,
 * so a block's id says which unit it is on, and nothing else has to be
 * asked.
 *
 * THE WORDS ARE THE AXE-FX III'S, WITH THE UNIT'S NAME PUT IN (`forUnit`):
 * one set of sentences, held by the tests that hold them, and never a
 * second copy to drift. On an Axe-Fx III every sentence is word for word
 * what it was.
 */
import { AM4_NAM_BLOCKS } from './am4-nam.js'
import { NAM_BLOCKS } from './nam-install.js'

export const III = 'Axe-Fx III'
export const AM4 = 'AM4'

/** The NAM blocks of the unit `id` is a NAM block of: its own pair, or null for a block that is no NAM. */
export const namBlocksOf = (id) => (NAM_BLOCKS.includes(id) ? NAM_BLOCKS : AM4_NAM_BLOCKS.includes(id) ? AM4_NAM_BLOCKS : null)

/** The unit's name, by the block. An Axe-Fx III's for anything that is not an AM4's. */
export const unitOfNam = (id) => (AM4_NAM_BLOCKS.includes(id) ? AM4 : III)

/** Whether `id` is an AM4's NAM block. */
export const onAm4 = (id) => AM4_NAM_BLOCKS.includes(id)

/** The first NAM block of the unit linked, by the name the rig has for it: where the Developer page's Preview plays. */
export const firstNamOf = (deviceName) => (String(deviceName || '').trim() === AM4 ? AM4_NAM_BLOCKS[0] : NAM_BLOCKS[0])

/** A sentence written for an Axe-Fx III, said of `unit`. Anything that is not text is handed back as it came. */
export const forUnit = (text, unit = III) => (typeof text !== 'string' || unit === III ? text : text.replaceAll('an Axe-Fx III', `an ${unit}`).replaceAll('An Axe-Fx III', `An ${unit}`).replaceAll(III, unit))

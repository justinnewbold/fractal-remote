/*
 * SETTINGS → NAM & TONE3000: HOW TO USE THEM, IN ORDER. Pure: a test
 * runs it.
 *
 * "Can we put something in the app that explains people how to use tone
 * 3000 and NAM? Some people might not know how to add a block for NAM. or
 * to access the tone 3000 section to add a NAM block" (Justin, 19 November
 * 2026). TONE3000 has two ways in, and both are behind a NAM block that is
 * already in the preset: a hold on its pedal on Play, and the Capture button
 * in Edit. Somebody with no NAM block in the preset sees neither, and
 * nothing said why.
 *
 * So the page is the steps in the order they are met: put a NAM block in,
 * open TONE3000 from it, Preview and Get, and where the captures already on
 * the unit are. BY UNIT, in tabs (components/Tabs), because the first step
 * is not the same: on an Axe-Fx III the app's chain editor and Quick build
 * add the block; on an AM4 the app has no message that puts a NAM block in a
 * slot (lib/fractal-sysex keeps it out of the blocks a slot is given), so it
 * is added on the unit or in AM4-Edit, and it needs firmware 3.00.
 *
 * EVERY SENTENCE SAYS WHAT THE APP DOES, AND NO MORE. Never that a preview
 * is not kept: on these units a capture is heard only from a slot, and every
 * Preview and every Get fills one (lib/tone3000Words has the same rule).
 * Nothing here is asked of the unit and nothing is sent.
 */
import { AM4, III } from './captureUnit.js'

/** The row under Help, and the page's title. */
export const NAM_HELP_TITLE = 'NAM & TONE3000'
export const NAM_HELP_LINE = 'Add a NAM block, then browse and get captures'

/** The tabs: the two units that have a NAM block. */
export const NAM_HELP_UNITS = Object.freeze([
  Object.freeze({ key: 'axefx3', label: III }),
  Object.freeze({ key: 'am4', label: AM4 })
])

/** Which tab opens: the linked unit's own where it is one of the two, else the Axe-Fx III's. By the rig's name for the unit. */
export const namHelpTab = (deviceName) => (String(deviceName || '').trim() === AM4 ? 'am4' : 'axefx3')

/** Over the tabs: what the two words mean, and which units this is for. */
export const NAM_HELP_INTRO =
  'A NAM block plays a capture: a model of a real amp, pedal or whole rig. TONE3000 is a library of captures you can search and send to your unit from the app. The Axe-Fx III and the AM4 are the units with a NAM block.'

const add = (unit) =>
  unit === 'am4'
    ? Object.freeze([
        'The AM4 needs firmware 3.00 or later. Older firmware has no NAM block.',
        'Add the block on the AM4 itself or in AM4-Edit: put NAM in one of the preset’s four slots. The app can’t put a NAM block in a slot on an AM4.',
        'Once it is in the preset, it shows on Play as a pedal called NAM.'
      ])
    : Object.freeze([
        'Open Edit, tap More (the three dots beside Done) and choose Edit chain.',
        'Tap Add on the block you want it to come after, or Put a block in an empty space, and pick NAM from the list.',
        'On an empty preset, Quick build is quicker: tap Quick build, pick your blocks in order with NAM among them, and the app joins them up.',
        'A NAM block added on the unit itself or in Axe-Edit III works the same. Either way it shows on Play as a pedal called NAM.'
      ])

const open = () =>
  Object.freeze([
    'On Play, hold the NAM pedal. Its quick edit opens, with a TONE3000 button at the top.',
    'Or in Edit, tap the NAM block, tap Capture, then TONE3000.',
    'The first time, TONE3000 asks you to sign in to your TONE3000 account. After that the app remembers it. To sign out: Settings → My rig → TONE3000.'
  ])

const get = (unit) => {
  const u = unit === 'am4' ? AM4 : III
  return Object.freeze([
    'Search, or pick an order and a kind of gear, then tap a tone to see its captures.',
    `Preview sends the capture to the ${u} and plays it in that NAM block, so you hear it through your own rig. Get does the same and takes you back.`,
    `Every capture you preview or get goes into an empty capture slot on the ${u} and stays there. It takes about half a minute over Bluetooth, and a second or two through a computer or a USB cable.`,
    'If the NAM block is switched off in the scene you are on, the app switches it on so you hear the capture.',
    'Save the preset to keep that capture in the block.'
  ])
}

const onUnit = (unit) =>
  Object.freeze([
    `In Edit, tap the NAM block, then Capture. That lists the captures already on the ${unit === 'am4' ? AM4 : III}.`,
    'Tap one to play it in that block. Nothing is sent again, so it is quick.'
  ])

const missing = (unit) =>
  Object.freeze([
    unit === 'am4'
      ? 'No NAM pedal on Play: the preset has no NAM block, or the AM4 is on firmware older than 3.00.'
      : 'No NAM pedal on Play: the preset has no NAM block yet. Add one first.',
    'No TONE3000 button when you hold the pedal: through a computer, update the computer app to the newest version.',
    'If a capture stops part-way, tap Preview or Get again.'
  ])

/**
 * The page for one unit: its sections in order, each a title and its lines.
 * @param {'axefx3'|'am4'} unit
 */
export function namHelpPage(unit) {
  const key = unit === 'am4' ? 'am4' : 'axefx3'
  return Object.freeze([
    Object.freeze({ title: '1. Put a NAM block in your preset', lines: add(key) }),
    Object.freeze({ title: '2. Open TONE3000', lines: open() }),
    Object.freeze({ title: '3. Preview and Get', lines: get(key) }),
    Object.freeze({ title: 'Captures already on the unit', lines: onUnit(key) }),
    Object.freeze({ title: 'If something is missing', lines: missing(key) })
  ])
}

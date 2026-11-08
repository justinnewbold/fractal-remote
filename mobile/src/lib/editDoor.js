/**
 * PLAY'S EDIT BUTTON, AND WHETHER EDIT STAYS OPEN: one rule, in one place,
 * that App.js asks at every render and test/bluetooth.mjs runs.
 *
 * `opens`: the bench, behind the switch in lib/features (`bench`), and only
 * once the unit is answering (the demo is its own far end): every control
 * on that screen is read off the unit, so with nothing on the other end it
 * is a screen of empty knobs. And over Bluetooth, or a unit's own USB cable
 * (the same wire), only where the phone reads and turns the unit's knobs
 * itself for this account on this copy (`editOpen`: lib/bluetooth
 * editOverBluetooth, ble-rule.js editOffered).
 *
 * `explained`: where it is not open over Bluetooth or a cable, on a unit
 * whose Edit is built (`built`: the AM4, FM3, FM9 and Axe-Fx III), Play's
 * button stays in its place and a tap says why (lib/editWords,
 * components/EditWhy). "Why isn't the edit buttons working on iPad?"
 * (Justin, 8 November 2026): it was not drawn at all there, and nothing
 * said why. Never on a VP4 (`vp4`), which has no knob editing anywhere: its
 * Play stays as it was, with no button.
 *
 * `shuts`: Edit, open, goes back to Play when its door has shut: the link
 * dropped, or the wire moved to Bluetooth on a unit or account with no Edit
 * there. It stayed up, every read failing. Not on a blink of a rejoin: the
 * link has to be down long enough to mean it (`down`, link.js's own word,
 * LINK_DOWN_HOLD_MS, the moment Play says NOT CONNECTED), so a phone that
 * rejoins in a second keeps the block it had open.
 *
 * Pure: no imports.
 */
export function editDoor({ bench = false, demo = false, link = 'off', down = false, overBluetooth = false, editOpen = false, built = false, vp4 = false } = {}) {
  const reachable = bench === true && (demo === true || link === 'connected')
  const opens = reachable && (overBluetooth !== true || editOpen === true)
  const explained = reachable && !opens && overBluetooth === true && built === true && vp4 !== true
  const blink = demo !== true && link !== 'connected' && down !== true
  return { opens, explained, shuts: !opens && !blink }
}

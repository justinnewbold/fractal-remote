/**
 * HAS THIS ACCOUNT GOT GOING OVER BLUETOOTH? The rule, with nothing of the
 * phone's in it, so test/server.mjs can run it.
 *
 * "Is there a way to do that now only if they haven't connected a computer
 * or Bluetooth? Because now that we have Bluetooth support, some people
 * might use that" (Justin, 1 November 2026, of the setup emails). The
 * account server can see a computer sign in; it cannot see a phone talk to
 * a unit over Bluetooth. So the phone says so, once per account: the first
 * time the unit answers over Bluetooth (bluetoothSeen.js), a call to
 * note_bluetooth_connected() writes the date beside the account
 * (supabase/migrations/20261015_setup_reminders.sql, bluetooth_seen), and
 * the setup emails leave that account alone.
 *
 * What counts: Bluetooth connected and the unit picked answering, or, on a
 * VP4, which answers nothing over Bluetooth (lib/bleVp4.js), the adapter
 * connected. Never a different unit answering than the one picked (a
 * mix-up, which the page tells them how to fix), never the demo.
 */
export function bluetoothSetUp({ via, phase, unit, rigUnit, answeredAs, simulated } = {}) {
  if (via !== 'bluetooth' || simulated) return false
  if (phase !== 'connected' || answeredAs) return false
  if (unit === 'vp4') return true
  return rigUnit === 'present'
}

/** What the phone keeps, per account, once the server has the date: never asked twice. */
export const toldKey = (accountId) => `bluetooth-seen-told:${accountId}`

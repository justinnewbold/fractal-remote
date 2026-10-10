/**
 * WHICH OF THE PORTS IS THE ADAPTER. Pure, so it is tested without a phone;
 * lib/bluetooth uses it on the list the native module gives.
 */

/*
 * NOT AN ADAPTER: Apple's own Wi-Fi MIDI. Every iPhone lists "Network Session
 * 1" as a two-way port, and on the first AM4 test it was offered first,
 * picked, took every message and answered none — "Adapter connected, but the
 * AM4 isn't answering", with the real adapter sitting just below it. Told by
 * its driver, Apple's network (RTP) one, and by its name in case the driver
 * ever reads differently.
 */
export const isNetworkSession = (d) => /RTP/i.test(String(d?.driver || '')) || /^network session\b/i.test(String(d?.name || ''))

/** Something the page may offer as the adapter. */
export const isAdapter = (d) => !!d && typeof d.id === 'string' && !isNetworkSession(d)

/**
 * THE ONE TO USE, when there is no question about it, or null.
 *
 * "Setting up the Bluetooth is kind of weird. A lot of different buttons to
 * press." So the phone picks the adapter itself when only one could be meant:
 * the one just connected in Apple's screen, or else the only one there is.
 * Two or more, and nothing new among them, is a real question, and the page
 * asks it with a list.
 */
export function pickAdapter(list, fresh = new Set()) {
  const here = (Array.isArray(list) ? list : []).filter((d) => isAdapter(d) && !d.offline)
  const just = here.filter((d) => fresh.has(d.id))
  if (just.length === 1) return just[0]
  if (!just.length && here.length === 1) return here[0]
  return null
}

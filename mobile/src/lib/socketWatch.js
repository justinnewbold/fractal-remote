/**
 * WHAT THE LOG SAYS OF A RELAY SOCKET THAT FAILED.
 *
 * When the socket under the relay fails on a phone or tablet, the system
 * says so twice: an error with no words in it, and straight after a close
 * (code 1006) whose reason is the system's own sentence ("Connection
 * reset", "Unable to resolve host …", "Expected HTTP 101 response but was
 * '403 Forbidden'"), where it has one. The relay's library tells the channel
 * about the first and, the channel being errored by then, never about the
 * second. So the log said "channel error: transport failure", the library's
 * one sentence for any error of the socket, and the reason was lost.
 *
 * A report from Google's own test machines (16 November 2026, the 2.0.0
 * test build on Android: every join failed a fraction of a second after the
 * connection was made, for six minutes) could not say why, and neither
 * could a customer's.
 *
 * The library offers its socket's own log to whoever asks (`logger`), and
 * that is where the close is said. This listens to it for that one thing
 * and nothing else: a close that follows an error, one line for each
 * connection that errors and then closes. A close with no error before it
 * is left alone. The library hands that one to the channel, where the
 * channel has not errored already, and lib/relay.js writes the channel's
 * code and reason during a join and when a joined channel drops, so the
 * same close is not said twice. (One that comes while the channel is
 * errored already, or while the library is rejoining by itself in the
 * seconds before the app's next join, is said by nobody, as before.)
 *
 * It sends nothing itself. Its line goes to the app's log, which Settings →
 * Troubleshooting → Log shows and a report sent with its log carries, and
 * nothing else a player sees changes. The reason is the system's own words.
 * They can name the server and its address, and what a server or a network
 * in between answered; nothing in them comes from the player's sign-in (the
 * socket's address carries the app's public key and nothing of the
 * account). It is put on one line (a certificate failure is several) with
 * no control or direction characters, the device's own address is left out
 * where Android writes it ("from /… (port n)"), and it is cut, with a mark,
 * so one failure cannot fill a log. Where the system gave no reason (on
 * Android a connection that simply ends, OkHttp's end of stream, has none)
 * the line says that, "1006 (no reason given)", which is an answer too. It
 * never throws: the library calls it in the middle of its own work.
 *
 * Handing the library a logger changes one thing more: its warning that a
 * send fell back to its REST route comes here, and is dropped, in place of
 * the console, which nothing in the app read.
 */

const MOST = 200
const NO_REASON = 'no reason given'

/** The system's reason as the log takes it: one line with no control or direction characters, the device's own address out, cut with a mark. */
function tidy(reason) {
  const flat = reason
    .replace(/[\s\u0000-\u001f\u007f-\u009f\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]+/g, ' ')
    .replace(/ from \/\S+ \(port \d+\)/g, '')
    .trim()
  /* Cut by the 200, and never through the middle of one character (an emoji is two of the 200). */
  return flat.length > MOST ? `${flat.slice(0, MOST).replace(/[\ud800-\udbff]$/, '')}…` : flat
}

/** A close as the log says it: "1006 (Connection reset)", "1006 (no reason given)", or null where it says nothing. */
export function closeWords(event) {
  try {
    const code = typeof event?.code === 'number' && Number.isFinite(event.code) ? event.code : null
    const reason = typeof event?.reason === 'string' ? tidy(event.reason) : ''
    if (code === null) return reason || null
    return `${code} (${reason || NO_REASON})`
  } catch {
    return null
  }
}

/**
 * The function the library is handed as its logger. `say(words)` is called
 * once for each close that follows an error on the same connection.
 */
export function socketWatch(say) {
  let errored = false
  return (kind, msg, data) => {
    try {
      if (kind !== 'transport' || typeof msg !== 'string') return
      /* A new connection: whatever went wrong on the last one is over. */
      if (msg.startsWith('connected')) {
        errored = false
        return
      }
      if (msg === 'error') {
        errored = true
        return
      }
      if (msg !== 'close') return
      const after = errored
      errored = false
      if (!after) return
      const words = closeWords(data)
      if (words) say(words)
    } catch {
      /* A log line is never worth the relay's own work. */
    }
  }
}

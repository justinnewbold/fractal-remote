/**
 * WHAT THE LOG SAYS OF A RELAY SOCKET THAT FAILED
 * (mobile/src/lib/socketWatch.js, handed to the relay's library as its
 * logger by lib/relay.js).
 *
 * A report from Google's own test machines (16 November 2026, the 2.0.0
 * test build on Android): every join of the relay failed a fraction of a
 * second after the connection was made, and the log said only "channel
 * error: transport failure". On a phone the system's reason comes in the
 * CLOSE that follows the error (React Native's WebSocket: an error event
 * with no words, then a close, code 1006, whose reason is the system's
 * sentence), and the library tells the channel about the first only. A
 * first cut of this change read the channel's error for the reason, and an
 * independent read showed no phone ever puts it there.
 *
 * So the real library is driven here, with the events in the order a phone
 * sends them: the reason reaches the log through the socket's own log, once,
 * and a close the channel does hear is not said twice.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const read = (p) => readFileSync(fileURLToPath(new URL(`../${p}`, import.meta.url)), 'utf8')
const flat = (s) => s.replace(/\s+/g, ' ')
const code = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ')
const rule = () => import('../mobile/src/lib/socketWatch.js')
/* The relay's library as it is installed for the tests: the phone's copy has the same socket under it. */
const { RealtimeClient } = createRequire(import.meta.url)('@supabase/realtime-js')
const wait = (ms) => new Promise((go) => setTimeout(go, ms))

const REASON = "Expected HTTP 101 response but was '403 Forbidden'"

/**
 * The library on a socket that opens and then does as it is told. `stale`
 * calls the watcher by hand before anything connects, as if an error had
 * been left over from a connection before.
 */
async function onASocket({ stale = false } = {}) {
  const { socketWatch } = await rule()
  const said = []
  const heard = []
  let sock = null
  class Socket {
    static CONNECTING = 0
    static OPEN = 1
    static CLOSING = 2
    static CLOSED = 3
    constructor() {
      this.readyState = 0
      sock = this
      setTimeout(() => {
        this.readyState = 1
        this.onopen?.({ type: 'open' })
      }, 5)
    }
    send() {}
    close() {
      this.readyState = 3
    }
  }
  const watch = socketWatch((words) => said.push(words))
  if (stale) watch('transport', 'error', { type: 'error' })
  const client = new RealtimeClient('ws://relay.test/realtime/v1', { transport: Socket, params: { apikey: 'k' }, logger: watch })
  client.channel('remote:u1', { config: { private: true } }).subscribe((status, err) => heard.push([status, err?.message]))
  await wait(40)
  assert.equal(sock?.readyState, 1, 'the stood-in socket never opened')
  return {
    said,
    heard,
    /* React Native's 'websocketFailed': an error with no words, then the close that has them. */
    async fails(reason) {
      sock.readyState = 3
      sock.onerror?.({ type: 'error' })
      sock.onclose?.({ type: 'close', code: 1006, reason })
      await wait(20)
    },
    /* React Native's 'websocketClosed': the close alone. */
    async closes(closeCode, reason) {
      sock.readyState = 3
      sock.onclose?.({ type: 'close', code: closeCode, reason })
      await wait(20)
    },
    done: () => client.disconnect()
  }
}

export function run(test) {
  test('a relay socket that fails on a phone says why in the log, once, through the library’s own socket log', async () => {
    const t = await onASocket()
    try {
      await t.fails(REASON)
      /* What the channel is told is the library's one sentence: the reason is not in it, which is why the socket is watched. */
      assert.deepEqual(t.heard.filter(([status]) => status === 'CHANNEL_ERROR'), [['CHANNEL_ERROR', 'channel error: transport failure']], 'the library tells the channel something else now: look again at where the reason is')
      assert.deepEqual(t.said, [`1006 (${REASON})`], 'the system’s reason did not reach the log')
    } finally {
      t.done()
    }
    /* Android has no words for a connection dropped with no close: the line says that, which is an answer too. */
    const wordless = await onASocket()
    try {
      await wordless.fails('')
      assert.deepEqual(wordless.said, ['1006 (no reason given)'], 'a failure the system gave no reason for was not said as one')
    } finally {
      wordless.done()
    }
  })

  test('a close with no error before it is the channel’s to say, and is not said twice', async () => {
    const t = await onASocket()
    try {
      await t.closes(1006, 'the server went away')
      assert.deepEqual(t.said, [], 'a close the channel hears was said by the socket’s watcher too')
      assert.deepEqual(t.heard.filter(([status]) => status === 'CHANNEL_ERROR'), [['CHANNEL_ERROR', 'socket closed: 1006 (the server went away)']])
    } finally {
      t.done()
    }
    /* An error left over from a connection before is over once the library says it has connected again. */
    const again = await onASocket({ stale: true })
    try {
      await again.closes(1000, '')
      assert.deepEqual(again.said, [], 'an old error was laid on a new connection’s close')
    } finally {
      again.done()
    }
  })

  test('the watcher’s own rules: a close after an error, said once, in the system’s words, and never a throw', async () => {
    const { closeWords, socketWatch } = await rule()

    assert.equal(closeWords({ code: 1006, reason: 'Connection reset' }), '1006 (Connection reset)')
    assert.equal(closeWords({ code: 1006, reason: '  Connection reset \n' }), '1006 (Connection reset)')
    assert.equal(closeWords({ code: 1006, reason: '' }), '1006 (no reason given)')
    assert.equal(closeWords({ code: 1000 }), '1000 (no reason given)')
    assert.equal(closeWords({ reason: 'gone' }), 'gone')
    assert.equal(closeWords({ code: '1006', reason: 'gone' }), 'gone', 'a code that is not a number was written')
    assert.equal(closeWords({ code: NaN, reason: 'gone' }), 'gone')
    assert.equal(closeWords({ code: 1006, reason: 42 }), '1006 (no reason given)', 'a reason that is not words was written')
    for (const nothing of [undefined, null, {}, { reason: '   ' }, { type: 'close' }, 'closed']) assert.equal(closeWords(nothing), null, JSON.stringify(nothing))
    /* A long reason is cut, with a mark, so one failure cannot fill a log; one that fits is whole. */
    assert.equal(closeWords({ code: 1006, reason: 'x'.repeat(5000) }), `1006 (${'x'.repeat(200)}…)`)
    assert.equal(closeWords({ code: 1006, reason: 'x'.repeat(200) }), `1006 (${'x'.repeat(200)})`)
    /* The cut never goes through the middle of one character: an emoji is two of the 200, and half of one is no character at all. */
    for (const two of ['\u{10000}', '\u{1f600}', '\u{10ffff}']) assert.equal(closeWords({ code: 1006, reason: `${'y'.repeat(199)}${two}z` }), `1006 (${'y'.repeat(199)}…)`, two.codePointAt(0).toString(16))
    assert.equal(closeWords({ code: 1006, reason: `${'y'.repeat(198)}\u{1f600}z` }), `1006 (${'y'.repeat(198)}\u{1f600}…)`)
    /* It is one line: a certificate failure is several, and nothing a server answered may carry a control character, or one that turns the reading order round, into a log. */
    assert.equal(
      closeWords({ code: 1006, reason: 'Hostname relay.test not verified:\n    certificate: sha256/abc=\r\n\tDN: CN=other.test' }),
      '1006 (Hostname relay.test not verified: certificate: sha256/abc= DN: CN=other.test)'
    )
    assert.equal(closeWords({ code: 1006, reason: 'Expected HTTP 101 response but was \'403 \u001b[31mNo\u0007\u007f\'' }), "1006 (Expected HTTP 101 response but was '403 [31mNo ')")
    /* Every one of them, by the ends of each run and one from inside it: the control characters past DEL, and the eleven marks, overrides and isolates that say which way text runs. */
    assert.equal(
      closeWords({ code: 1006, reason: 'a\u0080b\u0085c\u009b31md\u009fe\u061cf\u200eg\u200fh\u202ai\u202cj\u202ek\u2066l\u2067m\u2069n' }),
      '1006 (a b c 31md e f g h i j k l m n)'
    )
    /* And what is left when they are gone is what is said: nothing but them is no reason, and one at either end leaves no space there. */
    assert.equal(closeWords({ code: 1006, reason: '\u0000\u0001' }), '1006 (no reason given)')
    assert.equal(closeWords({ code: 1006, reason: '\u0000Connection reset\u0001' }), '1006 (Connection reset)')
    assert.equal(closeWords({ reason: '\u0001' }), null)
    /* The device's own address, where Android writes it, is no use to anybody reading a report, and is left out; the server's stays. */
    assert.equal(
      closeWords({ code: 1006, reason: 'failed to connect to relay.test/203.0.113.7 (port 443) from /10.0.0.5 (port 51234) after 10000ms' }),
      '1006 (failed to connect to relay.test/203.0.113.7 (port 443) after 10000ms)'
    )
    assert.equal(
      closeWords({ code: 1006, reason: 'failed to connect to relay.test/2001:db8::7 (port 443) from /fe80::1c2d%wlan0 (port 4) after 10000ms' }),
      '1006 (failed to connect to relay.test/2001:db8::7 (port 443) after 10000ms)'
    )
    /* An event that will not be read is nothing, never a throw. */
    const hostile = { get code() { throw new Error('no') }, get reason() { throw new Error('no') } }
    assert.equal(closeWords(hostile), null)

    const run = (...calls) => {
      const said = []
      const watch = socketWatch((words) => said.push(words))
      for (const call of calls) watch(...call)
      return said
    }
    const error = ['transport', 'error', { type: 'error' }]
    const close = (closeCode = 1006, reason = 'Connection reset') => ['transport', 'close', { code: closeCode, reason }]
    assert.deepEqual(run(error, close()), ['1006 (Connection reset)'])
    assert.deepEqual(run(error, close(1006, '')), ['1006 (no reason given)'])
    assert.deepEqual(run(close()), [], 'a close with no error before it was said')
    assert.deepEqual(run(error, close(), close(1000, '')), ['1006 (Connection reset)'], 'a second close was laid on the same error')
    assert.deepEqual(run(error, error, close()), ['1006 (Connection reset)'])
    assert.deepEqual(run(error, ['transport', 'connected to wss://relay.test/realtime/v1/websocket?vsn=2.0.0'], close()), [], 'a new connection did not end the old error')
    /* A close that says nothing is not a line. */
    assert.deepEqual(run(error, ['transport', 'close', {}]), [])
    assert.deepEqual(run(error, ['transport', 'close', {}], close()), [], 'the error outlived its own close')
    /* Only the socket's own lines: a channel's error, a push, a message are not it. */
    assert.deepEqual(run(['channel', 'error', {}], close()), [])
    assert.deepEqual(run(['push', 'error', {}], ['receive', 'close', { code: 1006, reason: 'x' }]), [])
    assert.deepEqual(run(error, ['receive', 'close', { code: 1006, reason: 'x' }]), [])
    assert.deepEqual(run(['transport', undefined, {}], ['transport', 7, {}], error, close()), ['1006 (Connection reset)'])
    /* The close is the library's own word for it, whole: another line of the socket's that happens to have the word in it is not one. */
    assert.deepEqual(run(error, ['transport', 'closed by the heartbeat', { code: 1006, reason: 'x' }]), [], 'a line that only has the word close in it was taken for the close')
    assert.deepEqual(run(error, ['transport', 'closed by the heartbeat', { code: 1006, reason: 'x' }], close()), ['1006 (Connection reset)'], 'a line that is not the close ended the error')
    /* The library's own lines, as it writes them: a heartbeat that timed out is not an error of the socket (the channel is told of the timeout itself), and a line about leaving does not end one. */
    assert.deepEqual(run(['transport', 'heartbeat timeout. Attempting to re-establish connection'], close(1000, 'heartbeat timeout')), [], 'a heartbeat’s own close was said as a failure')
    assert.deepEqual(run(error, ['transport', 'no channels remaining, scheduling disconnect'], close()), ['1006 (Connection reset)'], 'a line that is not a new connection ended the error')

    /* It is called in the middle of the library's own work: nothing it is handed, and nothing the log does, may throw out of it. */
    const loud = socketWatch(() => { throw new Error('the log is full') })
    assert.doesNotThrow(() => { loud(...error); loud(...close()) })
    const quiet = socketWatch(() => {})
    assert.doesNotThrow(() => { quiet(...error); quiet('transport', 'close', hostile); quiet('transport', 'close', null); quiet(null, null, null); quiet() })
  })

  test('the relay hands the watcher to its library, and logs its words as the socket’s, with everything else as it was', () => {
    const relay = flat(code(read('mobile/src/lib/relay.js')))
    assert.match(relay, /import \{ socketWatch \} from '\.\/socketWatch'/)
    assert.match(
      relay,
      /realtime: \{ heartbeatIntervalMs: HEARTBEAT_MS, logger: socketWatch\(\(words\) => logDebug\('relay', 'socket closed after an error', words\)\) \},/,
      'the relay’s socket is not watched'
    )
    assert.equal((relay.match(/socketWatch\(/g) || []).length, 1, 'the watcher is handed to the library more than once, or to something else')
    /* The channel's own line, what a player reads and what is thrown are as they were. */
    assert.match(relay, /if \(channel === chan \|\| !settled\) logDebug\('relay', `channel \$\{status\.toLowerCase\(\)\.replace\('_', ' '\)\}`, err\?\.message\)/)
    assert.match(relay, /reject\(new Error\(`Couldn’t connect \(\$\{status\.toLowerCase\(\)\.replace\('_', ' '\)\}\)\.`\)\)/)
    /* The watcher is words only: it imports nothing and sends nothing. */
    const helper = code(read('mobile/src/lib/socketWatch.js'))
    assert.ok(!/\bimport\b|\brequire\(|fetch\(|logDebug/.test(helper), 'the watcher does more than make a sentence')
  })
}

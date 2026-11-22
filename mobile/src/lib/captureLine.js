/*
 * WHAT A CAPTURE'S OWN LINE SAYS, at every moment from the tap on.
 *
 * "Need better confirmation that a tone was sent. It doesn't do much after
 * a tone does send successfully." And, with a picture of a tone's view
 * with nothing on it to say a tap had been taken: "This is the screen that
 * shows up after hitting send.." (Justin, 14 November 2026.)
 *
 * So under a capture's name there is always, from the tap, a card that says
 * what is becoming of it (components/SentCard draws them):
 *
 *   busy   being got from TONE3000, then being sent, with how far it is
 *   ok     on the unit: the unit named the slot as holding it
 *   plain  sent, and the unit said nothing of the slot (never drawn as ok)
 *   warn   not on the unit, with the reason
 *
 * and, under a card, a plain note for what the card does not carry: a send
 * the unit did not name, a NAM block that could not be pointed, a send that
 * stopped part-way while another capture's is in hand.
 *
 * A TAP TAKEN WHILE ANOTHER SEND IS GOING (`send.wait`, the sentence
 * itself) is none of those: nothing has become of this capture, so "tap
 * again when it has finished" is a plain note under whatever card the
 * capture has, never the "Not on your Axe-Fx III" card and never the
 * block's own line.
 *
 * PURE, so a test runs every state of it: the page hands in what it knows
 * and draws what comes back, in order. Nothing is said twice, and nothing a
 * player needs is left unsaid.
 *
 * @param {object} s
 * @param {boolean} s.working   this capture is being fetched or sent
 * @param {boolean} s.fetching  ...and it is the fetch
 * @param {boolean} s.mine      the send in hand is this capture's
 * @param {object|null} s.send  the send in hand: { line, done, played, playing, wait }
 * @param {{slot:number, sure:boolean}|null} s.at  where it is on the unit, if it is
 * @param {string} s.slotSaid   that slot as a player reads it ("035")
 * @param {string} s.name       the capture's name
 * @param {{line:string}|null} s.halted  a send of this capture that stopped part-way
 * @returns {Array<{card:'busy'|'ok'|'plain'|'warn', head:string, line:string, more:string}|{note:string}>}
 */
import { GETTING_CAPTURE, NOT_ON_UNIT, ON_UNIT, onUnitLine, SENDING_TO_UNIT, SENT_TO_UNIT } from './tone3000Words.js'

export function captureLine({ working = false, fetching = false, mine = false, send = null, at = null, slotSaid = '', name = '', halted = null }) {
  const out = []
  const there = !!at
  const own = mine && send ? send : null
  const line = own?.line || ''
  const playing = !!own && own.playing === true && !!own.played
  /* How far a send has got, where the page was told (`send.sent` of `send.of`): the card draws a bar and a count from them, and how long is left. Never while the file is still being fetched, and never from a send that has no count. */
  const far = !fetching && own && Number.isInteger(own.of) && own.of > 0 && Number.isInteger(own.sent) ? { sent: Math.max(0, Math.min(own.sent, own.of)), of: own.of, left: Number.isFinite(own.left) && own.left > 0 ? own.left : null } : null
  if (working) out.push({ card: 'busy', head: fetching ? GETTING_CAPTURE : SENDING_TO_UNIT, line, more: '', ...(far || {}) })
  if (there && !working) out.push({ card: at.sure ? 'ok' : 'plain', head: at.sure ? ON_UNIT : SENT_TO_UNIT, line: onUnitLine(slotSaid, name), more: playing ? own.played : '' })
  /* Not on the unit: said as plainly as one that is. */
  if (own && !working && !there && line) out.push({ card: 'warn', head: NOT_ON_UNIT, line, more: '' })
  /* The send's own line under a card that does not say all of it: one the unit took and did not name. Where the unit named it, the card has said it. */
  if (own && !working && there && !(own.done && at.sure) && line) out.push({ note: line })
  /* What the block said, where it is not the card's last line: a pick that failed, or a slot it found empty. */
  if (own?.played && !(there && playing)) out.push({ note: own.played })
  /* Why a send stopped stays under its own capture when the send in hand is another's, or is this one's with no line of its own (a tap taken while another send was going). */
  if (halted?.line && (!mine || !line)) out.push({ note: halted.line })
  /* A tap taken while another send was going: said last, plainly. */
  if (own?.wait && !working) out.push({ note: own.wait })
  return out
}

/*
 * HOW FAR A SEND HAS GOT, SAID SO THAT IT CANNOT BE MISSED.
 *
 * "Let's make it more clear when it's sending the NAM file what's happening.
 * Right now it does send it 10 things at a time or something, but it needs
 * to be more prominent on the screen." (Justin, 22 November 2026, with a
 * picture of the card half a minute into a send over an adapter: one small
 * grey line, "50 of 130", that had last moved three seconds before.)
 *
 * So the busy card has a bar, the count in large figures and how long is
 * left (components/SentCard), from the three numbers below. PURE, so a test
 * runs them.
 */

/** How many whole seconds a send has left, by how fast it has gone so far: null until three messages have gone (one is no speed at all), and null once it is done. */
export function secondsLeft({ sent = 0, of = 0, ms = 0 } = {}) {
  if (!Number.isInteger(sent) || !Number.isInteger(of) || !Number.isFinite(ms)) return null
  if (sent < 3 || of <= sent || ms <= 0) return null
  return Math.max(1, Math.round(((ms / sent) * (of - sent)) / 1000))
}

/** How much of the send has gone, as a whole number of hundredths: never 100 before the last message, so a bar is not full while something is still to go. */
export function percentSent(sent = 0, of = 0) {
  if (!Number.isInteger(sent) || !Number.isInteger(of) || of <= 0 || sent <= 0) return 0
  if (sent >= of) return 100
  return Math.min(99, Math.floor((sent / of) * 100))
}

/** The card's words for it: the count, and how long is left where that is known. */
export const sentWords = (sent, of) => `${sent} of ${of} parts sent`
export const leftWords = (left) => (Number.isFinite(left) && left > 0 ? (left === 1 ? 'About 1 second left' : `About ${left} seconds left`) : 'Working out how long is left…')

/**
 * The send in hand once nothing is going any more: its "still going" line
 * comes down. A send that was NOTHING BUT that line (a Preview or Get
 * tapped while another send was going) is no send at all and is let go of:
 * kept as an empty shell it stayed "the one in hand", which hid why an
 * earlier send of that capture had stopped and showed its file's notes (a
 * third independent read found it). One with anything of its own, a line,
 * what the block said, or a capture on the unit (`done`), stays as it was
 * without the wait.
 */
export function waitOver(send) {
  if (!send?.wait) return send
  return send.line || send.played || send.done ? { ...send, wait: '' } : null
}

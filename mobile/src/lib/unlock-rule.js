/**
 * Who may drive a real unit, as two pure functions and nothing else.
 *
 * This is separated from purchases.js for one reason: that file imports React
 * Native, expo-constants and AsyncStorage, so node cannot load it and the rule
 * inside it could only ever be checked by reading the source as text. The rule
 * is the part that matters — get it backwards and either nobody can use what
 * they paid for, or everybody can use what they didn't — so it lives here,
 * where a test can call it with every combination and check the answer.
 *
 * Nothing in this file imports anything. That is the point of it.
 *
 * THE RULE, once, in one place: a person is stopped ONLY when the app is
 * certain they should be. Certainty means all of — purchasing works here, the
 * check has finished, and the answer was no. Anything less is not a "no", and
 * an app that treats "don't know" as "no" locks people out of something they
 * paid for on the day their signal is bad, which for this app is a stage.
 */

/**
 * May this person point the app at real hardware?
 *
 * Note what counts as yes, and why:
 *
 *   unlocked   — they paid
 *   !available — purchasing is impossible here: no native module, no API key,
 *                or the store could not be reached. A paywall that cannot take
 *                money must never be a paywall that blocks the app.
 */
export const mayDrive = ({ unlocked = false, available = false } = {}) =>
  Boolean(unlocked) || !available

/**
 * May this person use Bluetooth (beta)? Stricter than mayDrive, on purpose.
 *
 * mayDrive's `!available` lets in somebody who never paid whenever the store
 * cannot be reached, and over the computer that gives nothing away: with no
 * signal there is no relay, so nothing is driven anyway. Bluetooth needs no
 * signal at all, and a sign-in that ran out with none still opens the app
 * (relay.js keptSession), so with mayDrive's yes any free account in
 * airplane mode would have a rig over Bluetooth on every launch, for good.
 *
 * So for anybody but Justin's account it is `unlocked` alone. That already
 * counts the purchase the phone remembers (purchases.js startPurchases reads
 * it off the phone before the store is asked anything, and an owner's
 * account the same), so somebody who has paid keeps Bluetooth at a gig with
 * no signal. His account (`admin`, lib/bluetooth bluetoothAdmin: the sign-in
 * kept on the phone, never the account server) keeps mayDrive's answer, as
 * it always has had.
 *
 * That read is first in the queue on the phone's storage today (App.js
 * starts the purchases before the sign-in check the Bluetooth link waits
 * for), but nothing here leans on the order: a purchase that lands after the
 * link was asked, from a slow read, a Restore or a Buy, starts the link as
 * it lands (lib/bleLink waitForPurchase), where it used to sit on "not
 * unlocked" until somebody tapped Connect.
 */
export const mayDriveBluetooth = ({ unlocked = false, available = false } = {}, admin = false) =>
  admin === true ? mayDrive({ unlocked, available }) : Boolean(unlocked)

/**
 * Should the app interrupt this person and ask them to pay?
 *
 * Every false below is a reason not to charge, and three of the four are
 * reasons not to be SURE:
 *
 *   demo      — free for ever; the demo is the whole free half of the app
 *   checking  — no answer from the store yet, and an unanswered question is
 *               not a no
 *   !available— see mayDrive
 *   unlocked  — they paid
 *
 * `inApp` is whether they are past the door at all; a paywall in front of the
 * sign-in screen would charge people before they know what they are buying,
 * and would meet Apple's reviewer before the demo does.
 */
export const shouldAskToPay = ({
  inApp = false,
  demo = false,
  checking = true,
  available = false,
  unlocked = false
} = {}) => Boolean(inApp) && !demo && !checking && Boolean(available) && !unlocked

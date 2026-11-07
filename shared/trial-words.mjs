/**
 * THE FREE TRIAL'S WORDS, the same on the phone, the website and the
 * computer app. The rule (how long, when it ends) is shared/trial-rule.mjs;
 * this file only says it. The phone reads its copy,
 * mobile/src/lib/trial-words.js, made by `npm run sync:rules`.
 *
 * Apple's guideline 3.1.1 asks a trial to say, BEFORE it starts, how long it
 * is, what stops when it ends, and what it costs after. TRIAL_TERMS says all
 * three, under every Start button.
 */
import { deviceNoun } from './device-word.mjs'
import { TRIAL_DAYS, trialDaysLeft } from './trial-rule.mjs'

/** The button on the purchase page. */
export const TRIAL_BUTTON = `Start ${TRIAL_DAYS}-day free trial`

/** Under it, before anybody taps it: how long, what stops, what it costs after. `price` is the store's, or null. */
export const trialTerms = (price = null) =>
  `Free for ${TRIAL_DAYS} days with your own rig: everything the full version does. ` +
  `After ${TRIAL_DAYS} days, connecting to your rig stops until you unlock the full version` +
  `${price ? ` for ${price}` : ''}, a one-time payment. Nothing is charged automatically, ` +
  'and your setlists and settings are kept. One free trial per account.'

/** While it starts. */
export const TRIAL_STARTING = 'Starting your trial…'

/** Said once it has started. */
export const TRIAL_STARTED = `Your ${TRIAL_DAYS}-day free trial has started. Plug in your unit and play.`

/**
 * The line on Play while a trial runs, tappable to the purchase page:
 * "Trial: 3 days left · Unlock", and on its last day "Trial ends today ·
 * Unlock". Null when no trial is running.
 */
export function trialLine(endsAt, now = Date.now()) {
  const left = trialDaysLeft(endsAt, now)
  if (left === null) return null
  if (left <= 0) return 'Trial ends today · Unlock'
  return `Trial: ${left} ${left === 1 ? 'day' : 'days'} left · Unlock`
}

/** The account card's second line during a trial. */
export function trialAccountWord(endsAt, now = Date.now()) {
  const left = trialDaysLeft(endsAt, now)
  if (left === null) return null
  return left <= 0 ? 'Free trial, ends today' : `Free trial, ${left} ${left === 1 ? 'day' : 'days'} left`
}

/** On the purchase page once a trial has ended. */
export const TRIAL_OVER = 'Your free trial has ended. Everything you set up is kept: unlock the full version to carry on with your rig.'

/** Over the purchase page while a trial runs. */
export const trialRunning = (endsAt, now = Date.now()) => {
  const left = trialDaysLeft(endsAt, now)
  if (left === null) return null
  const when = left <= 0 ? 'ends today' : `has ${left} ${left === 1 ? 'day' : 'days'} left`
  return `Your free trial ${when}. Unlock now and it carries on for good.`
}

/**
 * Why a trial could not start, in plain words. Read when shown: it names the
 * device in hand.
 */
export function trialRefusal(why) {
  switch (why) {
    case 'used':
      return 'This account has had its free trial already.'
    case 'device':
      return `This ${deviceNoun()} has had a free trial already, on another account.`
    case 'bought':
      return 'You have the full version already.'
    case 'apple-id-owns':
      return 'This Apple ID bought the full version already, so this account is unlocked: no trial needed.'
    case 'other-account':
      return 'This Apple ID bought the full version already, for another Fractal Remote account. Sign in with that account to use it: one purchase is for one account.'
    case 'signed-out':
      return 'Sign in or make an account first, so the trial has an account to belong to.'
    case 'no-store-trial':
      return 'The App Store didn’t confirm the free trial. Try again in a moment.'
    default:
      return 'Couldn’t start the trial just now. Check your connection and try again.'
  }
}

/*
 * THE DEMO'S WORDS. The demo stays free and unlimited, with no account; these
 * only point at the trial.
 */

/** The demo's top-bar button: this over "Unlock". */
export const DEMO_TRIAL_PILL = `Try it on your rig free for ${TRIAL_DAYS} days`

/** The one card after a few minutes in the demo, put away with its ×. */
export const DEMO_TRIAL_NUDGE = `Like it? Plug in your unit and try everything free for ${TRIAL_DAYS} days.`

/** How long in the demo before that card. */
export const DEMO_NUDGE_AFTER_MS = 3 * 60 * 1000

/** Its button. */
export const DEMO_NUDGE_GO = 'Try it free'

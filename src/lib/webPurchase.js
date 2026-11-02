import { DEFAULT_PROJECT, supabaseClient } from './remote'

/**
 * Buying the unlock from a browser, or from the computer app.
 *
 * "We already decided that we ARE gonna offer the purchases on the desktop apps
 * and the web app." The phone buys through Apple or Google; this buys through
 * RevenueCat Web Billing, which takes the card through his own Stripe account.
 * The Mac, Windows and Linux apps load this same build, so this is their way
 * to pay as well.
 *
 * THE SAME UNLOCK, NOT A SECOND ONE. It is filed under the signed-in account's
 * id — exactly the id the phone gives RevenueCat's logIn — and it grants the
 * same `full` entitlement. So a card taken here unlocks the phone the moment
 * that phone signs in, and the relay's table learns of it from the webhook.
 *
 * WHICH KEY: the live one. Web Billing has two public keys. The sandbox key
 * takes Stripe's test cards and moves no money; the production key takes
 * real ones. It shipped on sandbox until somebody had walked the checkout
 * end to end — he did, a new account made on the website and paid for:
 * "Payment on web working. You can go ahead and set it live instead of the
 * sandbox." Going back is one line: WEB_KEY to SANDBOX_KEY. Both are public
 * by design, like the phone's appl_ and goog_ keys.
 */
const SANDBOX_KEY = 'rcb_sb_KdoKqKIDAheHEcOurZYnqRBHO'
const PRODUCTION_KEY = 'rcb_sRfyHdzVZSYYipRdOgggitGqahKr'
export const WEB_KEY = PRODUCTION_KEY
export const WEB_LIVE = WEB_KEY === PRODUCTION_KEY

/** The product the phones sell too, so the package is picked by name, not by position. */
export const PRODUCT_ID = 'cloud.newbold.fractalremote.full'
export const ENTITLEMENT = 'full'

/*
 * Loaded only when the unlock page is on screen for a signed-in account, to
 * ask the price, or when Buy is pressed there — never as part of the main
 * bundle, and never just because the demo or Settings opened (App.jsx, THE
 * PRICE). The library brings Stripe's checkout with it, and the main bundle
 * is already past the size Vite warns about; somebody driving a rig they own
 * should not download a payment form. And loading it is itself a message to
 * RevenueCat, with the browser's details, which the privacy page says the
 * demo and the computer app on their own never send.
 */
let sdk = null
let instance = null
let instanceFor = null
const load = async () => {
  if (!sdk) sdk = await import('@revenuecat/purchases-js')
  return sdk
}

async function purchasesFor(accountId) {
  const { Purchases } = await load()
  /* Configured for one account at a time; a different person signing in on
     the same browser gets a fresh instance rather than the last one's. */
  if (!instance || instanceFor !== accountId) {
    instance = Purchases.configure({ apiKey: WEB_KEY, appUserId: accountId })
    instanceFor = accountId
  }
  return instance
}

/** The package that sells the unlock — by product id, with first-wins only as a fallback, as on the phone. */
function theUnlockIn(offerings) {
  const every = [
    ...(offerings?.current?.availablePackages || []),
    ...Object.values(offerings?.all || {}).flatMap((o) => o?.availablePackages || [])
  ]
  return every.find((p) => p?.webBillingProduct?.identifier === PRODUCT_ID) || every[0] || null
}

/**
 * Has this account paid? Asked of the server, not of this page.
 *
 * The same `entitlement` function the phone calls: it reads who is asking
 * out of the signed-in session, asks RevenueCat, and writes the answer where
 * the relay can read it. A purchase made on a phone therefore shows as paid
 * here without this page knowing anything about Apple or Google.
 *
 * Never throws. `unknown` means the question could not be put, and the page
 * treats that the way the phone does — as not a no.
 *
 * A FAULT IS NOT A NO, whatever shape it comes in. Only the request throwing
 * used to count: an error page from the server, or a reply that was not JSON,
 * came out as a definite "not paid", and the browser on a phone puts the
 * $9.99 page in front of a definite no. So only a good reply that says yes
 * or no in so many words is an answer. Nobody signed in is still a plain no:
 * there is no account for a purchase to be on.
 */
export async function checkUnlocked() {
  try {
    const { data } = await supabaseClient()?.auth.getSession() || {}
    const token = data?.session?.access_token
    if (!token) return { unlocked: false, unknown: false }
    const res = await fetch(`${DEFAULT_PROJECT.url}/functions/v1/entitlement`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: DEFAULT_PROJECT.anonKey, Authorization: `Bearer ${token}` },
      body: '{}'
    })
    const body = res.ok ? await res.json().catch(() => null) : null
    if (typeof body?.unlocked !== 'boolean') return { unlocked: false, unknown: true }
    return { unlocked: body.unlocked, unknown: Boolean(body.unknown) }
  } catch {
    return { unlocked: false, unknown: true }
  }
}

/*
 * HOW OFTEN THE UNLOCK PAGE ASKS AGAIN. Often at first, because the person
 * reading it has just been told to go and sign in on their phone, and that
 * takes a minute; less often after, for a page left open on a computer.
 */
const ASK_FAST_MS = 5000
const ASK_SLOW_MS = 30000
const FAST_FOR_MS = 2 * 60 * 1000

/**
 * Ask checkUnlocked again and again, and call `onYes` once it says yes —
 * for the unlock page, which waits on a phone to sign in (App's unlockBody).
 *
 * Every five seconds for two minutes, then every thirty, and at once when the
 * window comes back to the front. Nothing while the page is hidden: nobody is
 * looking, and coming back asks straight away. Only a definite yes counts —
 * the server's "could not ask RevenueCat" is not a purchase to act on.
 *
 * Returns the function that stops it, for the effect that started it.
 */
export function askUntilUnlocked(onYes, ask = checkUnlocked) {
  let live = true
  let asking = false
  let timer = null
  const began = Date.now()
  const hidden = () => document.visibilityState === 'hidden'
  const later = () => {
    clearTimeout(timer)
    if (live && !hidden()) timer = setTimeout(now, Date.now() - began < FAST_FOR_MS ? ASK_FAST_MS : ASK_SLOW_MS)
  }
  async function now() {
    clearTimeout(timer)
    if (!live || asking || hidden()) return
    asking = true
    const out = await ask()
    asking = false
    if (!live) return
    if (out?.unlocked === true && !out.unknown) {
      stop()
      onYes()
    } else later()
  }
  const back = () => {
    if (!hidden()) now()
  }
  function stop() {
    live = false
    clearTimeout(timer)
    window.removeEventListener('focus', back)
    document.removeEventListener('visibilitychange', back)
  }
  window.addEventListener('focus', back)
  document.addEventListener('visibilitychange', back)
  later()
  return stop
}

/**
 * What it costs here, as Stripe will charge it — or null when there is
 * nothing to sell, or nobody to ask for.
 *
 * ONLY FOR A SIGNED-IN ACCOUNT, and only from the unlock page (App.jsx, THE
 * PRICE). It used to ask for somebody signed out too, under a made-up visitor
 * number kept in the browser, so the demo's bar and Settings could show the
 * price the moment they opened: "When someone's on the demo, it should always
 * say unlock, and then the price at the top." That meant RevenueCat heard
 * from everybody who opened the demo, on the website and in the computer
 * app, which the privacy page says never happens (audit RUN-3, approved 2
 * November 2026). The demo still says UNLOCK; the price is on the unlock
 * page, which is only reached signed in, and the purchase always needed the
 * account anyway. So no account, no ask: nothing is loaded and nothing is
 * sent.
 */
export async function webPrice(accountId) {
  if (!accountId) return null
  try {
    const p = await purchasesFor(accountId)
    const pkg = theUnlockIn(await p.getOfferings())
    return pkg?.webBillingProduct?.currentPrice?.formattedPrice || null
  } catch {
    return null
  }
}

/* Said when Buy finds the account has it already. The page unlocks and goes
   either way, and unlocking without a word, straight after somebody pressed
   "$9.99", reads as having been charged again. */
export const ALREADY_HAD = 'You already have the full version, so nothing was charged.'

/**
 * Buy it. Opens RevenueCat's own checkout over the page and resolves when the
 * card has been taken, declined, or the window closed.
 *
 * Resolves, never rejects, with `{ ok, cancelled, message }` — the same shape
 * the phone's buyUnlock returns, so the two screens can say the same things.
 *
 * NEVER TO SOMEBODY WHO HAS IT. An owner can still get here through a page
 * drawn on an old answer, or on one the server could not give. So RevenueCat
 * is asked once more, itself, the moment before the card: it holds what this
 * account bought in every store, so it answers even when the server in front
 * of it cannot. Owned — or the checkout saying it is already bought — takes
 * no money, and the server is told so its table catches up. Not being able
 * to ask takes no money either. What it cannot see is a phone's purchase
 * made before that phone signed in; the unlock page's words are for that.
 */
export async function buyOnWeb({ accountId, email }) {
  if (!accountId) return { ok: false, cancelled: false, message: 'Sign in first, so the unlock has an account to belong to.' }
  const hasIt = () => {
    checkUnlocked()
    return { ok: true, cancelled: false, message: ALREADY_HAD }
  }
  try {
    const p = await purchasesFor(accountId)
    const pkg = theUnlockIn(await p.getOfferings())
    if (!pkg) return { ok: false, cancelled: false, message: 'Couldn’t get the price just now. Check your connection and try again.' }
    const already = await p.getCustomerInfo().then(
      (info) => Boolean(info?.entitlements?.active?.[ENTITLEMENT]),
      () => null
    )
    if (already === null) return { ok: false, cancelled: false, message: 'Couldn’t check your purchase just now. Try again in a moment.' }
    if (already) return hasIt()
    const { customerInfo } = await p.purchase({ rcPackage: pkg, customerEmail: email || undefined })
    const yes = Boolean(customerInfo?.entitlements?.active?.[ENTITLEMENT])
    /* Tell the relay now, rather than waiting for the webhook to land. */
    if (yes) checkUnlocked()
    return yes
      ? { ok: true, cancelled: false, message: null }
      : { ok: false, cancelled: false, message: 'The store did not confirm the purchase.' }
  } catch (err) {
    const { ErrorCode } = await load().catch(() => ({ ErrorCode: {} }))
    /* No code is no match: a library that would not load leaves ErrorCode empty. */
    const code = err?.errorCode
    if (code !== undefined && code === ErrorCode?.UserCancelledError) return { ok: false, cancelled: true, message: null }
    if (code !== undefined && code === ErrorCode?.ProductAlreadyPurchasedError) return hasIt()
    return { ok: false, cancelled: false, message: err?.message || 'The purchase did not go through.' }
  }
}

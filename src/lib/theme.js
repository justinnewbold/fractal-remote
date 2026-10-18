/**
 * Light, dark, or follow the system.
 *
 * DARK UNTIL SOMEBODY CHOOSES. "Can we make the default dark mode on the
 * app?" Justin, 18 October 2026. Auto was the default, and it was kept by
 * writing nothing down, so a browser that chose Auto before this looks the
 * same as one that never chose and starts dark once; Auto is written down
 * from now on, so choosing it again sticks. Storage that refuses is Dark too.
 */
const KEY = 'fab.theme'
const MODES = ['auto', 'light', 'dark']
const DEFAULT = 'dark'

export function getMode() {
  try {
    const stored = localStorage.getItem(KEY)
    return MODES.includes(stored) ? stored : DEFAULT
  } catch {
    return DEFAULT
  }
}

export function resolve(mode) {
  if (mode === 'light' || mode === 'dark') return mode
  return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
}

export function apply(mode) {
  const theme = resolve(mode)
  document.documentElement.dataset.theme = theme

  // The browser chrome should match, or a light page sits under a black status
  // bar and the phone looks broken.
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', theme === 'light' ? '#f2efe9' : '#0d0f12')
  return theme
}

export function setMode(mode) {
  try {
    localStorage.setItem(KEY, MODES.includes(mode) ? mode : DEFAULT)
  } catch {
    /* Costs the next visit, not this press. */
  }
  return apply(mode)
}

/** Follow the system while on auto, so it changes at sunset without a reload. */
export function watchSystem(onChange) {
  const query = window.matchMedia?.('(prefers-color-scheme: light)')
  if (!query) return () => {}
  const handler = () => getMode() === 'auto' && onChange(apply('auto'))
  query.addEventListener('change', handler)
  return () => query.removeEventListener('change', handler)
}

export { MODES }

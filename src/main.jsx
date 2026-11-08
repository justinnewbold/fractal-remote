/*
 * FIRST, BEFORE ANYTHING ELSE IS IMPORTED: a password-reset link's landing,
 * read out of the address and wiped from it (lib/recoveryLanding.js). It has
 * no imports and runs before the app's modules, so nothing that reads the
 * address (supabase-js, through the website's own sign-in) ever sees the
 * sign-in the link brings. Never move it down this list.
 */
import { landing } from './lib/recoveryLanding'
import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import Boundary from './components/Boundary'
import ResetPassword from './components/ResetPassword'
/* The fonts, from the app's own files rather than Google's (src/fonts.css
   says why): before styles.css, which names them. */
import './fonts.css'
import './styles.css'
import { apply, getMode } from './lib/theme'
import { startLooks } from './lib/useLooks'

// Before first paint, so a dark-preferring browser never flashes a light page.
apply(getMode())
// And the colours, for the same reason: the first frame is in the look you chose.
startLooks()

/*
 * A reset link's visit is the Choose a new password page and nothing else:
 * the app is not started under it, so its sign-in, its startup card, its
 * walkthrough and its update check's reload cannot take the link's sign-in,
 * cover the page or lose it (components/ResetPassword says each). Every
 * other visit is the app, as it always was.
 */
const resetVisit = Boolean(landing)

/*
 * The last resort. A throw outside every panel boundary still unmounts the app,
 * and a white page tells nobody anything — least of all which build it was or
 * what it objected to.
 */
createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Boundary label="The app">{resetVisit ? <ResetPassword landing={landing} /> : <App />}</Boundary>
  </React.StrictMode>
)

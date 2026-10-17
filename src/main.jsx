import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import Boundary from './components/Boundary'
import './styles.css'
import { apply, getMode } from './lib/theme'
import { startLooks } from './lib/useLooks'

// Before first paint, so a dark-preferring browser never flashes a light page.
apply(getMode())
// And the colours, for the same reason: the first frame is in the look you chose.
startLooks()

/*
 * The last resort. A throw outside every panel boundary still unmounts the app,
 * and a white page tells nobody anything — least of all which build it was or
 * what it objected to.
 */
createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Boundary label="The app">
      <App />
    </Boundary>
  </React.StrictMode>
)

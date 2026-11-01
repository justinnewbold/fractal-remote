/**
 * WHAT'S NEW, RENDERED TWICE FROM ONE LIST.
 *
 * "Under the about menu can we make a change log that shows what each
 * update change was made? Needs to be user friendly. How many previous
 * update notes should we keep so it doesn't get too long?" (Justin,
 * 1 November 2026.)
 *
 * shared/whats-new.json is the list. scripts/sync-relay-rules.mjs renders it
 * with the two functions here into the phone's copy
 * (mobile/src/lib/whatsNew.js, which Settings → About → What's new draws,
 * the newest `shownInApp` days) and the website's page
 * (public/whats-new.html, every day there is, which the phone's All updates
 * and the browser's What's new row open). npm test renders both again and
 * fails on any difference, as it does for every copy.
 *
 * The browser and the computer window never import the list, only the
 * page's address (shared/affiliation.mjs WHATS_NEW_URL): the computer app's
 * fingerprint follows what the web app imports, and a list that grows with
 * every update would make a computer release of every one.
 */

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

/** "2026-10-31" as a person says it: "31 October 2026". */
export function dayWords(iso) {
  const [y, m, d] = String(iso).split('-').map(Number)
  return `${d} ${MONTHS[m - 1]} ${y}`
}

/** Every line as { text, only }, where only is null for both phones. */
export function readList(text) {
  const list = JSON.parse(text)
  return {
    shownInApp: list.shownInApp,
    days: list.days.map((d) => ({
      date: d.date,
      day: dayWords(d.date),
      version: d.version,
      lines: d.lines.map((l) => (typeof l === 'string' ? { text: l, only: null } : { text: l.text, only: l.only || null }))
    }))
  }
}

/** The phone's copy: the list, already in words, and the one rule for which lines a phone shows. */
export function phoneModule(text) {
  const { shownInApp, days } = readList(text)
  return `/**
 * What each update changed, for Settings → About → What's new.
 *
 * Generated from shared/whats-new.json by \`npm run sync:rules\`
 * (scripts/whats-new.mjs). Do not edit: change the list and run it.
 */

/** How many days the app shows; the website page has them all. */
export const SHOWN_IN_APP = ${shownInApp}

export const WHATS_NEW = ${JSON.stringify(days, null, 2)}

/** The days as this phone shows them: a line for the other phone left out, and a day left with none left out too. */
export const daysFor = (os) =>
  WHATS_NEW.map((d) => ({ ...d, lines: d.lines.filter((l) => !l.only || l.only === os).map((l) => l.text) })).filter((d) => d.lines.length)
`
}

const escape = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const ONLY_WORDS = { ios: 'iPhone and iPad', android: 'Android' }

/** The website's page, every day there is, in the support page's dress. */
export function websitePage(text) {
  const { days } = readList(text)
  const body = days
    .map(
      (d) => `      <h2>${escape(d.day)}</h2>
      <p class="when">Version ${escape(d.version)}</p>
      <ul>
${d.lines.map((l) => `        <li>${escape(l.text)}${l.only ? ` <span class="only">(${ONLY_WORDS[l.only]})</span>` : ''}</li>`).join('\n')}
      </ul>`
    )
    .join('\n\n')
  return `<!doctype html>
<!--
  Generated from shared/whats-new.json by npm run sync:rules
  (scripts/whats-new.mjs). Do not edit: change the list and run it.
-->
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>What’s new — Fractal Remote</title>
    <meta name="description" content="What each update to Fractal Remote changed, newest first." />
    <style>
      :root {
        --chassis: #0d0f12;
        --panel: #15181d;
        --rule: #262b33;
        --silk: #e6e3dc;
        --silk-dim: #878d97;
        --signal: #f0a73c;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        padding: 48px 20px 96px;
        background: var(--chassis);
        color: var(--silk);
        font: 16px/1.6 system-ui, -apple-system, "Segoe UI", sans-serif;
      }
      main { max-width: 720px; margin: 0 auto; }
      h1 { font-size: 30px; line-height: 1.2; margin: 0 0 4px; }
      h2 { font-size: 20px; margin: 40px 0 0; }
      .when { color: var(--silk-dim); margin: 0 0 8px; font-size: 14px; }
      .lead { color: var(--silk-dim); margin: 0 0 8px; }
      .only { color: var(--silk-dim); font-size: 14px; }
      a { color: var(--signal); }
      ul { padding-left: 22px; margin: 0; }
      li { margin: 6px 0; }
      footer { margin-top: 56px; padding-top: 20px; border-top: 1px solid var(--rule); color: var(--silk-dim); font-size: 14px; }
    </style>
  </head>
  <body>
    <main>
      <h1>What’s new</h1>
      <p class="when">Fractal Remote</p>
      <p class="lead">What each update changed, newest first. Updates reach the app on their own; Settings → About → Updates says which one you are running.</p>

${body}

      <footer>
        <!-- These words are shared/affiliation.mjs, Fractal Audio's own sentence
             (their letter, 18 October 2026), copied because a static page
             cannot import. A test holds the two to each other. -->
        <p>
          Fractal Remote is independently developed and is not affiliated with, endorsed by, or
          supported by Fractal Audio Systems, LLC.
        </p>
        <p>
          &ldquo;Fractal Audio&rdquo;, &ldquo;Axe-Fx&rdquo;, &ldquo;FM3&rdquo;, &ldquo;FM9&rdquo;,
          &ldquo;AM4&rdquo; and &ldquo;VP4&rdquo; are trademarks of Fractal Audio Systems, LLC,
          used here only to say which hardware this app works with.
        </p>
        <p>
          <a href="/support">Support</a> ·
          <a href="https://apps.apple.com/app/id6812916461">Get the iPhone app</a> ·
          <a href="/android">Get the Android app</a> ·
          <a href="/privacy">Privacy</a> ·
          <a href="/notices">Third-party licenses</a>
        </p>
      </footer>
    </main>
  </body>
</html>
`
}

/**
 * HOW TO UPDATE THE COMPUTER APP, worded once for both ends.
 *
 * "Change red text about updating computer to a link that shows instructions
 * when tapped on how to update it." The red line on the YOUR COMPUTER card
 * (UPDATE_COMPUTER in link-chain.mjs) told somebody to update and never said
 * how. Tapping that card now opens a page of these steps, on the phone
 * (Settings, page 'updating') and in a phone's browser (setup page
 * 'updating'). The phone gets a generated copy (npm run sync:rules), so the
 * two cannot word the same steps two ways.
 *
 * WHY QUIT-AND-OPEN COMES FIRST. The computer app looks for a new version
 * when it opens and when somebody asks it to, and it puts a downloaded one in
 * when it is quit (autoInstallOnAppQuit in desktop/lib/updates.mjs). An
 * ordinary start never looks again by itself (the twice-a-day look in
 * desktop/main.js is only for a start with no window), so a computer left open
 * for days falls behind every phone update. And a quit does not reopen it,
 * which is why every step says to open it again: a guitarist who only quits
 * has no phone remote until he does.
 *
 * WHY "IT CAN TAKE TWO ROUNDS". A copy that is already holding one update
 * does not look for a newer one until it is opened again, so a computer
 * several versions behind installs the one it has, opens, finds the newest,
 * and needs one more quit for that.
 *
 * Every name a person is told to look for is the computer app's own word for
 * it. If one of these moves there, it moves here too, and a test in
 * test/both-ends.mjs holds them to each other:
 *   - the menu-bar / tray icon, its "Check for updates…" and "Quit": buildTray
 *     in desktop/main.js. A click opens the menu on a Mac; on Windows a click
 *     opens the window and a right-click the menu (tray.on('click')), so steps
 *     1 and 2 both say right-click there. And Windows 10 and 11 put a new
 *     app's icon in the hidden icons behind the ^ arrow by the clock, which
 *     the app cannot change (a plain Tray in buildTray), so step 1 says to
 *     look there.
 *   - "Update … installs when you quit", "Version … is still being built" and
 *     "Move Fractal Remote to Applications to get updates": updateLine in
 *     desktop/lib/updates.mjs, the line shown in that menu.
 *   - "Move to Applications" when it asks: settleInPlace in desktop/main.js;
 *     and on the window's ⚙ → About → Updates page: src/components/Updates.jsx.
 *   - the .deb asking for a password and the AppImage never asking:
 *     desktop/electron-builder.yml, the note above `linux:`.
 *   - the downloads page: public/downloads.html, the same address the phone's
 *     Connect a computer page opens (mobile/src/lib/downloadLink.js).
 *   - settings and sign-in staying through a reinstall: they live outside the
 *     app (Electron's user data, and ForgeFX's own sign-in), and the Windows
 *     installer keeps them (deleteAppDataOnUninstall: false).
 *
 * The phone cannot tell a Mac from a Windows PC from a Linux box (the
 * computer sends only its name and version), so the steps name each where
 * they differ rather than guessing from the name.
 */
export const UPDATE_STEPS = {
  title: 'Updating the computer app',
  intro:
    'The computer app downloads new versions by itself, but it only puts one in when you quit it and open it again. A computer that stays open for days falls behind.',
  steps: [
    {
      label: '1  QUIT, THEN OPEN IT AGAIN',
      body: 'On the computer, click the Fractal Remote icon — in the menu bar at the top of a Mac’s screen, or by the clock on Windows (it may be behind the ^ arrow; right-click it) — and choose Quit. Then open Fractal Remote again. Any update it has already downloaded goes in.'
    },
    {
      label: '2  CHECK FOR UPDATES',
      body: 'Click the icon again (right-click on Windows) and choose Check for updates…. When it says “Update … installs when you quit”, quit and open it once more. It can take two rounds.'
    },
    {
      label: '3  STILL BEHIND? DOWNLOAD IT',
      /* Quit first and open it after. Finder will not replace an app that is
         open, and nothing reopens it on a Mac afterwards: the .dmg has no
         settings of its own in desktop/electron-builder.yml, where only the
         Windows installer starts the app when it finishes (runAfterFinish).
         On Windows the opening again is harmless: a second start only brings
         up the window of the first (requestSingleInstanceLock in main.js). */
      body: 'On the computer, quit Fractal Remote as in step 1, then go to fractal.newbold.cloud/downloads and install the newest version over the old one. On a Mac, drag it into Applications and choose Replace. Then open Fractal Remote again. Your settings and sign-in stay.'
    }
  ],
  /* The phone asks the computer what it is running every two minutes
     (NAME_AGAIN in mobile/src/lib/link.js), and the computer says it when it
     opens, so the line clears without anybody touching the phone. */
  after: 'The red line under YOUR COMPUTER goes away by itself a couple of minutes after the computer is up to date.',
  /* What the computer's menu can say instead of getting on with it, and the
     one thing to do about each. */
  ifItSays: [
    {
      says: '“Move Fractal Remote to Applications to get updates”',
      body: 'A Mac only updates an app in its Applications folder. Open Fractal Remote and choose Move to Applications when it asks, or in its window go to ⚙ → About → Updates → Move to Applications.'
    },
    {
      /* For about ten minutes after a release the Mac files are still being
         made, and every computer's check says so until they land. */
      says: '“Version … is still being built”',
      body: 'A new version is a few minutes from ready. Choose Check for updates… again in ten minutes.'
    },
    {
      says: 'A password box, on Linux',
      body: 'The .deb package asks for your computer’s password when it installs. Type it to finish. The AppImage never asks.'
    }
  ]
}

# The desktop apps

Mac, Windows and Linux, one codebase. Each one opens, serves the app from that
machine, and puts a name on the network. A phone on the same wifi opens that
address and reaches the unit — no account, no relay, nothing to install on the
phone.

## What it actually is

A menu-bar item (a tray icon on Windows) and a child process. ForgeFX — the
device server — is started with `FORGEFX_STATIC` pointed at the built web app,
so the page and the device API are the same origin. That one variable is the
whole of local mode: a browser lets an HTTPS page call `http://localhost` but
not `http://10.0.0.x`, which is why the hosted app could never reach the unit
from a phone, and why serving it from here removes the problem rather than
working around it.

Everything worth getting right — where ForgeFX is, which port, what the phone
should scan — is in [`lib/host.mjs`](lib/host.mjs), shared with
`npm run serve` at the repository root and covered by the main test suite.
`main.js` is only the parts that genuinely need Electron.

**The one place the two platforms differ on purpose** is the tray icon.
macOS wants a template image — a black-and-transparent silhouette it recolours
for light and dark menu bars — and drawing that same file on a Windows tray
gives you a black square on a black taskbar. So there are two: `trayTemplate.png`
and `trayWin.png`, both generated from `public/icon.svg` by `npm run icon` at
the repository root, and `main.js` picks by `process.platform`.

## Keeping the phone remote's link up

A phone away from home reaches the computer through the account service,
and the app keeps the computer's link to it up by itself:

- **At launch it turns the phone remote on** (`armHost` in
  [`lib/host.mjs`](lib/host.mjs)) and, until it is on, asks again every
  minute for half an hour and then every five — on every start since 1.87.19,
  not only one with no window, because a laptop's wifi often comes back a few
  seconds after the app does. Never against somebody turning it off, even
  when they press Turn off while it is still being turned on.
- **On means the link is up, not only switched on.** The account service can
  close the link — a sign-in that ran out while the Mac slept, say — and the
  device server stays switched on with nothing listening. That is what a
  phone found on 12 October 2026, from a MacBook whose menu said on.
- **So it looks again:** 5 and 30 seconds after the computer wakes or its
  screen is unlocked, and once a minute (`checkRelay`, and `lookAtLink` in
  `main.js`), and the menu says "Phone remote: reconnecting…" while the link
  is down — not "sign in", when straight after a wake the account service
  just cannot be reached yet. A computer that moved to another network gets
  its new same-wifi address in the menu as well.
- **A device server that reports its state mends its own link.** Switched
  on, it keeps trying by itself, waiting a little longer each time — up to
  ten seconds between tries, or a minute when the account service itself
  closed the link — and the app leaves it to that: it pushes once, straight
  after a wake or a move to another network, to save waiting that out, and
  not again until the link has been up. Every push starts
  those waits over, so pushing every minute, from every computer an outage
  reaches, would be the app hammering the account service while it is down.
- **An older device server** (one whose `/remote/status` has no `state`)
  cannot say whether its link is really up, so after a wake or a network move
  it is asked once for a fresh link. One whose link was refused is never asked
  twice — that makes every tap on the phone happen twice — and the menu says
  "Phone remote: stuck — quit Fractal Remote and open it again". Nor is one
  found switched on with no link, which is what a refused link leaves behind;
  the app's own retry asks again only after the failures it can tell are
  safe.

## Looking for updates, and staying awake

**A new version is made only when the computer app's own part changed.**
Every merge to main runs the desktop workflow, and its `decide` job compares
a fingerprint of what is inside this app — these files, the device server's
pin, and the web app it serves, import by import, with the version number
taken out ([`scripts/computer-fingerprint.mjs`](../scripts/computer-fingerprint.mjs))
— with the record on the newest release. The same, and no release is made, so
this app is usually a few numbers behind the phone, and that is normal. The
red "Update the computer app" line on a phone comes on only below the oldest
version the phone needs (`COMPUTER_NEEDED` in
[`shared/versions.mjs`](../shared/versions.mjs)). The Publish box on a
hand-started run, or a `desktop-v` tag, makes a release whatever it says,
under a version number that has no computer release yet (a computer only
takes a higher one): merge a change first, then publish that.

**And an update downloads only what changed**, about 21 MB of a Mac's 140 MB
and a few MB of the Windows installer, by the real lists of pieces
(blockmaps) of two releases. That needs both: the new release's list, which
is now uploaded under the name the updater asks for
([`blockmapNames.js`](blockmapNames.js)), and the one for the version the
computer is running. And it needs the updater to ask GitHub for one piece per
request, which GitHub's download servers insist on
(`useMultipleRangeRequest: false` in [`lib/updates.mjs`](lib/updates.mjs)). A
computer older than the release that brought this asks the old way, so its
next update is still the whole file; the ones after are small. A computer
with no earlier download kept (a fresh install from the disk image) also
fetches the whole file once.

**Every start looks for a new version by itself** (since 1.87.23 — before
that, an ordinary start looked only at launch): six hours after its last
look, a quarter of an hour after one that found the new version still being
built, an hour after one that could not reach GitHub, and half a minute after
the computer wakes. What it finds downloads quietly and goes in when the app
quits, or when somebody presses Restart to update — never by the app
restarting itself. Each computer waits only for its own files on a release
(`updateFiles` in [`lib/updates.mjs`](lib/updates.mjs)), so a Mac build that
failed no longer leaves every PC and Pi saying "still being built".

One update per run, still: once one is downloaded and waiting, a later look
does not fetch a newer one. On a Mac, macOS's updater takes one per run; on
Linux, electron-updater deletes the waiting download as soon as it starts a
newer one, and a quit in that gap would delete the AppImage itself. The next
launch looks again and finds the newest.

**The computer stays awake while a phone is using it**, so a laptop at a gig
does not idle-sleep under the song. While one has in the last half hour, the
app holds Electron's `powerSaveBlocker` with `prevent-app-suspension`: the
computer keeps running, and the screen may still go dark. Half an hour after
the last use it lets go. Once a minute it looks two ways, because the
computer cannot see a phone any one way:

- **The phone app** never connects to the computer at all, on the same wifi
  or not: everything it asks goes through the relay, and arrives inside the
  device server where this app cannot see it. So while its link is up, the
  phone app (and the website, when a phone uses it through the account)
  writes a small note, `phone.seen`, into the device server's own store
  every couple of minutes ([`shared/phone-note.mjs`](../shared/phone-note.mjs)),
  and a note that changed since the last look is a phone using it. A phone
  app older than 1.87.23 writes none, until its next update.
- **A phone's web browser on the same wifi**, on the computer's own page,
  talks straight to the device server's port and writes no note, so a
  connection to that port from another machine counts too.

The rules are in [`lib/awake.mjs`](lib/awake.mjs). One limit, said plainly:
**a closed lid still sleeps most laptops.** That is the computer's own
setting, and nothing an app asks for changes it. Leave the lid open at a gig.

## Starting when the computer turns on (Linux)

For a computer that lives on a pedalboard or in a rack — a Raspberry Pi with
no screen, most of all. Settings → About → **Start when this computer turns
on**, or the same item in the tray's menu. Switched on, the app starts by
itself whenever the computer does, with no window: it serves the phone and
talks to the unit, and its tray icon is there for anybody who plugs a screen
in. Clicking the icon, or opening the app again, shows the window; closing
the window leaves it running; the tray's Quit quits.

What it does underneath, for whoever has to look:

- **The switch is one file**, `~/.config/autostart/fractal-remote.desktop`
  (or under `$XDG_CONFIG_HOME`). On means the file is there and is ours; off
  deletes it. Raspberry Pi OS starts what is in that folder when its desktop
  logs in, and so do GNOME, KDE and XFCE. The text and the rules are in
  [`lib/autostart.mjs`](lib/autostart.mjs). Electron's own login-item switch
  does nothing on Linux, which is why the app writes the file itself.
- **It starts the app with `--hidden`.** No window at launch, and no dialog
  ever: a problem is a line in the log and at the top of the tray's menu.
  Something else on port 5056 is asked about again every 30 seconds, a device
  server that stops is started again (after 2, 5, 15 and 30 seconds, then
  once a minute), and the phone remote is asked for again every minute for
  half an hour and then every five, because a Pi often boots before its wifi.
- **It follows the app.** Every launch writes the entry again with where the
  app is now, and an AppImage update — which moves the file to a new name —
  rewrites it the moment the new file is in place.
- **Updates install just after power-on.** A pedalboard is unplugged, never
  quit, and an update that waits for a quit would wait for ever. So with no
  window, an update that is ready within three minutes of starting (one
  downloaded on an earlier run is ready in seconds) installs there and then,
  and the app comes back on the new version, still with no window. Later than
  that it waits for a quit, as everywhere else. A look that fails just after
  power-on (a Pi often boots before its wifi) is taken again every 30 seconds
  while an install could still follow it, and once more when the phone
  remote comes on; after that it looks every six hours, as every start does
  (see below). Not the .deb: its
  update asks for a password, which nobody is there to type, so on a .deb it
  waits for a quit.
- **Somebody looking is not the same as somebody there.** Plug a screen in,
  open the window and press Restart to update, and the new version comes
  back with its window for you — and still behaves as a box nobody is
  watching once you unplug the screen.

Only one copy of the app runs at a time, on every computer: opening it again
shows the running one's window instead.

### A Raspberry Pi on a pedalboard

The customers' version, every step for somebody who has never used a Pi, is
[`public/raspberry-pi.html`](../public/raspberry-pi.html), at
fractal.newbold.cloud/raspberry-pi. It asks how they are setting the Pi up
(from a Mac, a Windows PC, a Linux computer, or a screen and keyboard on the
Pi) and shows only that way's steps. What follows is the short form.

1. Put **Raspberry Pi OS (64-bit)** on it, the version with the desktop (not
   Lite). Leave **Desktop Autologin** on — it is on unless you changed it.
   That is what makes the desktop, and so the app, start with nobody there.
   (To check: Control Centre → System → Desktop Auto Login, or
   `sudo raspi-config` → 1 System Options → S6 Auto Login on the current
   Trixie release; Boot / Auto Login on the older Bookworm one.)
2. Once, with a screen plugged in (or over Raspberry Pi Connect or VNC),
   download the **Raspberry Pi AppImage** (not the `.deb`), make it
   executable, open it, and sign in to the phone remote. The AppImage,
   because a pedalboard is switched off at the wall: the AppImage installs
   its updates just after power-on with nobody there, and the `.deb` only
   updates when somebody quits the app and types a password.
3. In the app, go to Settings → About and switch on **Start when this
   computer turns on**.

From then on, plug the Pi in and the phone finds the unit. Leave the
AppImage file where it is — it is the app itself, and the start-up entry
names it. If you move it, open it once from its new place and the entry
follows it.

## Building it

**Each one on its own kind of machine.** The native serial and MIDI modules
compile per platform and per processor. `.github/workflows/desktop.yml` has a
job for each — and two for Linux, a PC one and an arm64 one for the Pi; run
the workflow and take the `.dmg`, the `.exe` or the AppImage and `.deb` from
the artifacts. The Linux jobs also start the packaged app with no window on
a virtual screen and check that it serves, stays one copy, and stops when
told.

Locally, on the matching machine:

```sh
cd ../ && npm run build      # the web app this bundles
npm run vendor:forgefx       # the device server, into desktop/vendor
cd desktop && npm install
npm start                    # run it unpackaged
npm run dist                 # a .dmg   (on a Mac)
npm run dist:win             # an .exe  (on Windows)
```

`dist:win` produces two files and needs both: the NSIS installer people
download, and a `.zip` beside it that `electron-updater` is the only consumer
of. Without the zip the app finds a release it can never install, so the
workflow fails the build rather than publishing half of one.

## Signing

Different answers on the two platforms, for a reason worth keeping straight.

**macOS.** The workflow signs and notarises when four secrets exist, and
produces a working unsigned build when they don't:

| Secret | What it is |
|---|---|
| `MAC_CERT_P12` | Developer ID Application certificate, base64 |
| `MAC_CERT_PASSWORD` | its password |
| `APPLE_ID` / `APPLE_APP_PASSWORD` / `APPLE_TEAM_ID` | for notarisation |

Unsigned, macOS says "unidentified developer" and the first launch needs
right-click → Open. That is why a Mac release only ever publishes signed: an
unsigned `.dmg` on the download page is a support ticket, not a download.

**Apple's approval stops a release; Apple's stamp never does.** Every app and
disk image is sent to Apple to be notarised ([`notarise.js`](notarise.js),
electron-builder's `afterSign` hook for the app, with its own notarising
switched off), and anything but Accepted fails the build before it is
published. The stamp — Apple's ticket stapled onto the file, so it opens with
no internet — is then asked for five times over two and a half minutes, and
if Apple's ticket service cannot be reached the release goes out without it,
with a warning on the run. From 1.87.14 to 1.87.22 that service kept dropping
the line to GitHub's Mac machines, and on 1.87.21 it took the Mac files off
the release. Without the stamp, macOS looks the approval up with Apple the
first time the app is opened and shows the same single prompt, so opening it
is unchanged for anybody with internet. The check after the build follows
suit: a file with a stamp has to pass Gatekeeper (`spctl`) on the build
machine; one without has to pass Gatekeeper or, when Gatekeeper's own lookup
cannot get through either, Apple's notary record of that very submission
(`node notarise.js --confirm`). Either way something from Apple has to say
yes, and a stamp that could not be fetched no longer turns the run red after
the release has gone out.

**Windows.** `WIN_CERT_P12` and `WIN_CERT_PASSWORD` sign it if they exist, and
**the unsigned build publishes anyway**. SmartScreen shows a blue "Windows
protected your PC" box with *More info → Run anyway* underneath, and the
installer then works exactly as a signed one would. Holding the Windows
release back for a certificate would mean no Windows app at all, over a
warning the connect screen already tells people to expect. A certificate
(around $100–400/year from a CA, and an EV one clears SmartScreen from day
one) is still worth buying — it is the difference between "Run anyway" and no
box — but it is not what stands between a PC and this app.

## Known unknowns

The workflow vendors ForgeFX, builds it, and loads both native modules under
Electron-as-Node on every run, so the old worry about ABI mismatch now fails
in CI rather than on a desk. What CI still cannot answer:

- **Whether the app finds the unit.** That needs the hardware plugged in.
  Everything up to "the serial port opens" is checked; the port itself is not.
- **Windows USB in particular.** A Fractal unit is class-compliant, so it
  should need no driver, but `serialport` naming differs (`COM3` rather than
  `/dev/tty.usbmodem…`) and that path has never had a unit on the end of it.

## Without installing anything

From a checkout of this repository, `npm run vendor:forgefx && npm run serve`
runs the same server these apps wrap, with a QR code instead of a window.

There used to be two one-paste setup scripts in `public/` offering this to
people who were not developers. They were removed, and the reason is worth
keeping: they cloned private repositories, so the first `git fetch` failed for
everybody without a token, and the instructions had to say "ask Justin for
one". The three apps carry the same server inside them and need nothing. A
route that begins by asking a stranger to email the author is not a route.

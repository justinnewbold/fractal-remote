# Bluetooth MIDI: could the phone reach a Fractal without the computer?

Researched 8 October 2026, after Justin asked: "What would it take to add MIDI
Bluetooth capabilities if we had a Bluetooth dongle? ... is it even possible
with the ForgeFX software?" He already owns a CME WIDI Master, which he uses
with a mini controller.

Way B below is now built: Bluetooth (beta), in the phone app under Settings →
Bluetooth (beta), with a setup guide for customers at
public/bluetooth.html. Everything else on this page is what was found on 8
October, before any of it was built or tried, kept so the next person starts
from it instead of from nothing.

## The short answer

Yes, it is possible, as a **remote**: change presets and scenes, read the
names, turn blocks on and off, switch channels, set the tempo and use the
tuner. It is **not** a way to edit. Fractal's own editors time out or crawl
over these dongles. Fractal says backups and dumps are not supported over
5-pin MIDI. On gen-3 units ForgeFX reads the block list by dumping the
preset, so even the block list may not appear over 5-pin.

None of it has been tried on Justin's hardware yet. That test comes first,
before any code or any build.

## What is true today

- **The FM3's USB is not MIDI.** It is a serial link (forgefx
  `server/src/transport/serial.ts`, FM3 manual). So a USB-host Bluetooth
  bridge (CME WIDI Uhost) can never reach an FM3. The FM3, FM9 and Axe-Fx III
  have 5-pin MIDI In and Out/Thru. The AM4 and VP4 have 3.5 mm TRS MIDI
  (Type A).
- **ForgeFX can already use any MIDI port the computer shows.** Its MIDI
  transport lists every port (`GET /ports`, flagged `fractal:false`). It can
  be pointed at one by hand with a forced model
  (`POST /ports/select {transport:'midi', inId, outId, model}`). The code
  calls this case a "MIDI-DIN to USB adapter" (`registryCore.ts` 609-640), and
  treats any port without a Fractal name as a slow link (`midi.ts` 122). On
  a slow link it switches off meters, CPU, and the watch that notices
  footswitch scene changes. The website's Ports panel deliberately does not
  offer MIDI ports (`src/components/Ports.jsx` 99-105).
- **Fractal's published third-party commands** (scene, preset and scene
  names, bypass, channel, tempo, tuner, looper, status) are what Morningstar
  controllers use over 5-pin. They are already built, as pure code, in
  forgefx-midi `src/gen3/axe-fx-iii/setParam.ts`, with reply parsers. They
  default to the Axe-Fx III model byte, so the FM3 (0x11) and FM9 (0x12) must
  be passed. Fractal has published no such commands for the AM4 or VP4.
- **The phone has one seam** where a different wire could answer the screens'
  requests: `mobile/src/lib/device.js` (`remoteRequest`). The demo already
  uses that seam (`demoWire.js`).

## The ways it could be done

**A. Keep the computer; Bluetooth replaces the USB cable to the unit.**
- How it works: the dongle sits on the unit's MIDI jacks, and the Mac pairs
  it in Audio MIDI Setup. ForgeFX is pointed at it by hand. The phone keeps
  going through the relay.
- What it costs: no code and no Expo build to try. A "use this MIDI port"
  picker on the website/desktop would make it a real feature, still without a
  phone build.
- What it buys: only the short cable, because the computer still has to be on.
- Windows may not see Bluetooth MIDI at all (ForgeFX's MIDI layer is WinMM).

**B. The phone talks to the unit directly: a remote using the published
commands.**
- How it works: a small Expo module, shaped like the watch module. On
  iPhone it uses CoreMIDI and Apple's pairing screen
  (`CABTMIDICentralViewController`). On Android it uses
  `MidiManager.openBluetoothDevice`. It plugs in at the `device.js` seam.
- What it buys: no computer and no internet, for preset, scene, names,
  blocks on/off, channel, tempo, tuner and looper. FM3, FM9 and Axe-Fx III
  only. The AM4 and VP4 would get Program Change and CC switching, one way,
  with no names.
- What it costs, in builds: new native code, so the fingerprint moves.
  Bluetooth cannot be tested in a simulator, so budget **two to three** iOS
  build slots rather than one. Android can be iterated free with `apk.yml`.
- Permissions on iOS: `NSBluetoothAlwaysUsageDescription`, CoreMIDI and
  CoreAudioKit. CoreAudioKit may break the simulator-only `iphone` CI job
  unless guarded.
- Permissions on Android: `BLUETOOTH_SCAN` (neverForLocation) and
  `BLUETOOTH_CONNECT`, plus the older permissions capped at SDK 30.
  `android.software.midi` must be declared `required=false`.
- Things it changes beyond the wire:
  - **The store listing says REQUIRES A COMPUTER.** The listing, the review
    notes and the hardware video would all change. That is Justin's call.
  - **The $9.99 unlock is enforced by the relay on the server**
    (`relayPass.js`). A direct link skips the relay, so the unlock would rest
    on the phone's own check and RevenueCat's cached answer. That is a
    business decision.
  - **The locked-phone watch case.** iOS drops an idle Bluetooth MIDI link
    after a few minutes (QA1831), and a phone in a pocket between songs is
    exactly that. It may need the Bluetooth background mode.
  - **Following footswitch changes made on the unit** needs a small poll
    loop, because the published commands push only the tempo and the tuner.
  - **Screens that cannot work over this link** (editing, grid, saving) have
    to hide in Bluetooth mode. MIDI channel and bank settings are needed for
    presets above 127.
  - **Android phones differ** in how they split long SysEx over Bluetooth, so
    the app has to reassemble replies itself.

**B2. The whole ForgeFX editor on the phone.** Not recommended.
- The runtime bundles to about 10 MB, most of it editor tables.
- Fractal's own editors are unusable over these dongles.
- It would be several weeks of work for slow editing that may not work.

**C. A USB-host bridge (WIDI Uhost) on the unit's USB.**
- Never for the FM3, because its USB is not MIDI.
- It might reach an AM4, FM9, Axe-Fx III or VP4 over USB-MIDI. Nobody has
  reported that working.
- While it is plugged in, the unit's USB audio is lost.

**D. The website through Web MIDI.** Ruled out: no iPhone or iPad browser
has Web MIDI or Web Bluetooth. On Android it needs a helper app kept running.

## Dongles

- **CME WIDI Master** (Justin's).
  - It comes in two parts: the main plug goes in MIDI Out, and a small
    second plug on a short lead goes in MIDI In (CME's manual). With both in,
    it carries MIDI both ways, which a remote needs. With only the main plug
    in, it carries one way.
  - It takes power only from a MIDI Out jack.
  - **On an FM3 it runs hot.** The FM3's MIDI Out supplies 5 V with no
    current-limiting resistor. Users fix it with a 220-ohm resistor; Fractal
    has said nothing.
  - Some CME firmware versions mishandled SysEx, so update it with CME's app
    first.
- **CME WIDI Jack** (about $60): plugs into both In and Out, can run from
  USB-C, and has cable bundles for TRS (AM4/VP4). The likeliest test dongle.
- **Yamaha MD-BT01** (about $55): the best record with Fractal editing,
  through FracPad. It also runs hot on an FM3, and may be discontinued.
- **BOSS WM-1 and Quicco mi.1:** no SysEx documented. A Windows tool for the
  mi.1 II warns that large SysEx is dropped.
- Dongles typically take one Bluetooth connection at a time. A Mac that has
  paired one reconnects on its own, so the phone may not see it until the Mac
  lets go.

## The first test (no code, no build)

1. Use a two-plug dongle (a WIDI Jack), or a second WIDI Master alongside
   Justin's. Update the firmware first, and do not rename it: a name
   containing "FM3" makes ForgeFX treat it as a fast USB link.
2. Plug it into the FM3's MIDI In and Out/Thru, with Thru off, and take the
   FM3's USB cable out of the Mac.
3. Mac: Audio MIDI Setup → MIDI Studio → Bluetooth → connect.
4. Point ForgeFX at it: `GET /ports`, then `POST /ports/select` with
   `transport: 'midi'`, the dongle's input and output names, and
   `model: 'fm3'`. This is on `http://localhost:5056` on the Mac, because
   `/ports` changes are refused from the phone. Its log should say
   `detect: FORCED profile`.
5. On the phone, as now:
   - change a preset and a scene, and check the names;
   - turn a block on and off, set the tempo, open the tuner;
   - time how long the block list takes. If it never appears, wait: a refused
     dump holds the link for over a minute, and everything queues behind it.
6. Put it back with `POST /ports/select` and `model: 'auto'`. The choice is
   saved in `~/.forgefx-conn` and survives restarts, so skipping this leaves
   ForgeFX looking at the dongle.

A small hidden MIDI-port picker on the website/desktop would turn steps 4
and 6 into a few clicks. That needs no phone build.

## Sources

- ForgeFX, all under `server/src/`:
  - `transport/midi.ts`, `serial.ts`, `connection.ts`
  - `drivers/registryCore.ts`, `gen3.ts`, `am4.ts`
  - commits 78f5640, 58328aa and 2469aa6
- forgefx-midi: `src/gen3/axe-fx-iii/setParam.ts`,
  `docs/DEVICE-TELEMETRY.md`.
- Fractal owner's manuals (https://www.fractalaudio.com/downloads/manuals/)
  and "Axe-Fx III MIDI for Third-Party Devices".
- Morningstar's Fractal integration:
  https://help.morningstar.io/en/article/fractal-audio-j6dhwl
- FracPad III: https://apps.apple.com/us/app/fracpad-iii/id1436855580
- Fractal forum threads:
  - Bluetooth editing:
    https://forum.fractalaudio.com/threads/bluetooth-connectivity-from-fm9-turbo-to-mac-pro.207737
  - FM3 MIDI Out at 5 V:
    https://forum.fractalaudio.com/threads/midi-output-voltage-widi-master-is-getting-hot.171579/page-4
- CME: https://www.cme-pro.com/widi-master/, https://www.cme-pro.com/widi-jack/
  and https://www.cme-pro.com/widi-uhost/
- Bluetooth MIDI measured latency (NIME 2019):
  https://nime.org/proceedings/2019/nime2019_paper006.pdf
- Apple: CoreMIDI Bluetooth, `CABTMIDICentralViewController`, QA1831.
  Android: `android.media.midi`, Bluetooth permissions.
- Expo's guest post on a MIDI-over-Bluetooth module:
  https://expo.dev/blog/building-a-midi-over-bluetooth-app-using-expo-modules

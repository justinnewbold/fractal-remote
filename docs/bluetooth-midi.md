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

## The FM3: the C2MIDI Pro got very hot (October 2026)

> "I tried to use the exact same WIDI host setup on the FM3 as I did on the
> AM4 and the CME C2MIDI Pro got extremely hot on the FM3 and the connection
> didn't work. I unplugged it."

The chain that works on his AM4 (WIDI Uhost on a 5 V charger, C2MIDI Pro,
Type-A 3.5 mm adapters) was plugged straight into the FM3's 5-pin MIDI In and
MIDI Out/Thru, with the Uhost powered from USB as on the AM4.

**Why, as far as the sources go:**
- The C2MIDI Pro's white plug [TO MIDI OUT] can power itself from the MIDI
  Out it goes into. CME's manual: it "can be powered from the MIDI OUT port of
  most MIDI devices (compatible with 5V or 3.3V MIDI, the MIDI device must
  comply with the MIDI standard)".
- The MIDI 1.0 electrical spec (CA-033, 2014) requires a series resistor on
  each MIDI Out pin (220 ohms at 5 V) to limit current, and lists devices that
  draw power from pin 4 as "possibly incompatible".
- FM3 owners measured in 2021 that its MIDI Out is 5 V with no such resistor
  ("through a 220ohm resistor I get 22mA"). CME's engineer: without it "the IC
  [gets] hot and could end in a destroyed IC". Reported still the same on the
  FM3 Turbo (April 2025, April and May 2026). The Axe-Fx III measures 3.3 V,
  and the FM9 and Axe-Fx III are reported fine. Fractal has published nothing.
- USB power does not stop it: a WIDI Jack owner reported it hot on USB-C power
  on an FM3 (February 2022), which matches his result.
- It is not the extra pins: Fractal says "Only three pins are used", and the
  AM4's Type-A adapters carry the same pins 2, 4 and 5. What sits behind pin 4
  is the difference. Nobody has published a measurement of the AM4's.
- Why it did not connect is not established; an overloaded cable is the
  likeliest reading.

**What it means:**
- Every adapter that feeds from MIDI Out runs hot on an FM3: CME's WIDI Master
  and WIDI Jack, Yamaha's MD-BT01 (its only power is MIDI Out; FM3 owners
  report it hot about as often as not), and the C2MIDI Pro.
- The fix owners report, 2021 to 2026, including on an FM3 Turbo: a short
  adapter with a 220-ohm resistor in series on pin 4, between the FM3's MIDI
  Out/Thru and the adapter. Not tried with the app yet.
- Untried alternative with no soldering: CME's U2MIDI Pro (USB-A), which its
  manual says runs only on USB power, through a USB-A to USB-C adapter into the
  Uhost. Inference only; feel it in the first minute.
- The WIDI Uhost cannot use the FM3's USB socket ("The FM3 is NOT a USB MIDI
  Device").
- No FM3 has been reported damaged in five years of these reports. A
  C2MIDI Pro that got hot may be: check it on USB power with both MIDI plugs
  touching nothing before it goes back on the AM4.

The website's guide and the app's Bluetooth page now warn FM3 owners instead
of listing parts for it (shared/bluetooth-gear.mjs FM3_WARNING), and the FM3
stays pickable for anyone who fits the resistor adapter.

Sources: CME C2MIDI Pro manual v03
(https://www.cme-pro.com/wp-content/uploads/2025/02/C2MIDI-Pro-user-manual_English_v03.pdf),
U2MIDI Pro manual v06, WIDI Uhost manual v08b; MIDI CA-033
(https://midi.org/wp-content/uploads/wpforo/default_attachments/1709416667-ca33-MIDI-10-Electrical-Specification-Update.pdf);
Yamaha MD-BT01 manual
(https://usa.yamaha.com/files/download/other_assets/7/722997/mdbt01_en_om_b0.pdf);
the Fractal forum thread "MIDI output voltage: WIDI Master is getting hot",
pages 1–8 (https://forum.fractalaudio.com/threads/midi-output-voltage-widi-master-is-getting-hot.171579/)
and "Does FM3 use all 5 pins of MIDI"
(https://forum.fractalaudio.com/threads/does-fm3-use-all-5-pins-of-midi.185278/).

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
  USB-C, and has cable bundles for TRS (AM4/VP4). On an FM3 it runs hot even
  on USB power, unless a 220-ohm adapter is fitted (see above).
- **Yamaha MD-BT01** (about $55): the best record with Fractal editing,
  through FracPad. It also runs hot on an FM3, and may be discontinued.
- **BOSS WM-1 and Quicco mi.1:** no SysEx documented. A Windows tool for the
  mi.1 II warns that large SysEx is dropped.
- Dongles typically take one Bluetooth connection at a time. A Mac that has
  paired one reconnects on its own, so the phone may not see it until the Mac
  lets go.

## The first test (no code, no build)

Not on an FM3 without a 220-ohm adapter on its MIDI Out: see above.

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

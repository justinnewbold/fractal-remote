#!/usr/bin/env bash
# FOR .github/workflows/turn-check.yml ONLY: does the next store version's
# iPhone app turn on its side in a real iOS simulator?
#
# Run from anywhere after the Release simulator build. Takes VARIANT from the
# environment. Writes everything to mobile/turn-check/out (screenshots, logs,
# the Info.plist keys) and ends with ONE line:
#   TURNED: yes  or  TURNED: no
# for this variant, in the log, in the run's summary and as an annotation.
#
# No `set -e` on purpose: a failure in one step must not hide the evidence
# the later steps collect. Every wait is bounded; the job itself is held to
# 45 minutes by the workflow.
set -uo pipefail
cd "$(dirname "$0")/../.." || exit 1
ROOT=$(pwd)
VARIANT=${VARIANT:-default}
OUT="$ROOT/mobile/turn-check/out"
mkdir -p "$OUT"
BUNDLE_ID=cloud.newbold.fractalremote
METHOD="none"
STEPS="$OUT/steps.txt"
: > "$STEPS"

note() { echo "$*"; echo "$*" >> "$STEPS"; }
summary() {
  echo "$*"
  if [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then echo "$*" >> "$GITHUB_STEP_SUMMARY"; fi
}
now() { date '+%Y-%m-%d %H:%M:%S'; }
# Run a command with a time limit (macOS has no `timeout`).
bounded() {
  local secs=$1; shift
  "$@" & local pid=$!
  # The guard's own output goes nowhere, so a $(bounded …) does not wait for its sleep.
  ( sleep "$secs"; kill -9 "$pid" 2>/dev/null ) >/dev/null 2>&1 & local guard=$!
  wait "$pid"; local rc=$?
  kill "$guard" 2>/dev/null; wait "$guard" 2>/dev/null
  return $rc
}

# ---------------------------------------------------------------- the app built
APP=$(find "$ROOT/mobile/ios/build/Build/Products" -maxdepth 2 -type d -name '*.app' -path '*Release-iphonesimulator*' 2>/dev/null | head -n 1)
if [ -z "$APP" ]; then
  summary "TURNED: no ($VARIANT: no simulator app was built, so nothing was tried)"
  echo "::error title=turn-check $VARIANT::no app was built"
  exit 1
fi
note "app: $APP"
EXE=$(/usr/libexec/PlistBuddy -c 'Print :CFBundleExecutable' "$APP/Info.plist" 2>/dev/null || echo FractalRemote)

{
  echo "== The built app's Info.plist, orientation keys"
  for k in UISupportedInterfaceOrientations 'UISupportedInterfaceOrientations~ipad' EXDefaultScreenOrientationMask 'EXDefaultScreenOrientationMask~ipad' UIRequiresFullScreen UIApplicationSceneManifest; do
    printf '%s: ' "$k"
    plutil -extract "$k" json -o - "$APP/Info.plist" 2>/dev/null || echo '(absent)'
    echo
  done
  echo "== plutil -p Info.plist (lines naming orientation)"
  plutil -p "$APP/Info.plist" | grep -i -A5 'orientation' || true
  echo "== Expo.plist (updates must be off, so the embedded JavaScript runs)"
  plutil -p "$APP/Expo.plist" 2>/dev/null || echo '(no Expo.plist)'
  echo "== Is ExpoScreenOrientation in the app?"
  ls "$APP/Frameworks" 2>/dev/null | sed 's/^/  framework: /' || true
  echo "  frameworks naming ScreenOrientation: $(ls "$APP/Frameworks" 2>/dev/null | grep -ci screenorientation)"
  echo "  'ScreenOrientationModule' strings in the main binary: $(strings -a "$APP/$EXE" 2>/dev/null | grep -c ScreenOrientationModule)"
  echo "  'ScreenOrientationViewController' strings in the main binary: $(strings -a "$APP/$EXE" 2>/dev/null | grep -c ScreenOrientationViewController)"
  echo "  'ExpoScreenOrientation' strings in the main binary: $(strings -a "$APP/$EXE" 2>/dev/null | grep -c ExpoScreenOrientation)"
  for f in "$APP"/*.debug.dylib; do [ -e "$f" ] && echo "  debug dylib $(basename "$f"): $(strings -a "$f" | grep -c ScreenOrientationModule)"; done
  echo "  main.jsbundle present: $(ls -la "$APP/main.jsbundle" 2>/dev/null || echo no)"
  echo "  TURNEXP in main.jsbundle: $(strings -a "$APP/main.jsbundle" 2>/dev/null | grep -c TURNEXP)"
  echo "== Generated ExpoModulesProvider (which modules the app registers)"
  find "$ROOT/mobile/ios" -name 'ExpoModulesProvider.swift' -not -path '*/build/*' 2>/dev/null | while read -r p; do echo "  $p"; grep -n -i 'ScreenOrientation' "$p" | sed 's/^/    /'; done
} 2>&1 | tee "$OUT/built-app.txt"

# ---------------------------------------------------------------- a simulator
xcrun simctl list devices available > "$OUT/devices.txt" 2>&1
cat "$OUT/devices.txt"
pick_device() {
  xcrun simctl list devices available -j | python3 -c '
import json, re, sys
d = json.load(sys.stdin)["devices"]
def ver(k):
    m = re.search(r"iOS-(\d+)-(\d+)(?:-(\d+))?", k)
    return tuple(int(x or 0) for x in m.groups()) if m else (0, 0, 0)
phones = []
for k, v in d.items():
    if ".iOS-" not in k: continue
    for x in v:
        if x.get("isAvailable", True) and x["name"].startswith("iPhone"):
            phones.append((ver(k), x["name"], x["udid"]))
def best(f):
    c = [p for p in phones if f(p[1])]
    return max(c)[2] if c else None
print(best(lambda n: n == "iPhone 17 Pro Max") or best(lambda n: "Pro Max" in n) or best(lambda n: "Plus" in n or "Air" in n) or best(lambda n: True) or "")
'
}
UDID=$(pick_device)
if [ -z "$UDID" ]; then
  RT=$(xcrun simctl list runtimes -j | python3 -c '
import json, sys
r = [x for x in json.load(sys.stdin)["runtimes"] if x.get("isAvailable") and x.get("platform", "iOS") == "iOS" and "iOS" in x["name"]]
print(r[-1]["identifier"] if r else "")')
  note "no iPhone simulator listed; creating an iPhone 17 Pro Max on $RT"
  UDID=$(xcrun simctl create turn-check "iPhone 17 Pro Max" "$RT" 2>/dev/null || xcrun simctl create turn-check "com.apple.CoreSimulator.SimDeviceType.iPhone-17-Pro-Max" "$RT" 2>/dev/null || true)
fi
if [ -z "$UDID" ]; then
  summary "TURNED: no ($VARIANT: no iPhone simulator could be found or made, so nothing was tried)"
  exit 1
fi
DEVNAME=$(xcrun simctl list devices -j | python3 -c '
import json, sys
for k, v in json.load(sys.stdin)["devices"].items():
    for x in v:
        if x["udid"] == sys.argv[1]: print(x["name"], "on", k.split(".")[-1])' "$UDID")
note "simulator: $DEVNAME ($UDID)"
echo "::notice title=turn-check $VARIANT::simulator $DEVNAME"

xcrun simctl boot "$UDID" 2>/dev/null || true
bounded 300 xcrun simctl bootstatus "$UDID" -b || note "bootstatus did not finish in 300 s"
# The Simulator app's own window, for rotating by its menu. By its path in the
# Xcode that is selected: an image with several Xcodes has no application
# "Simulator" to find by name (the xcode-27 image, 17 November 2026).
SIMAPP="$(xcode-select -p)/Applications/Simulator.app"
note "Simulator app: $SIMAPP ($( [ -d "$SIMAPP" ] && echo there || echo NOT THERE ))"
open "$SIMAPP" --args -CurrentDeviceUDID "$UDID" || open -a Simulator --args -CurrentDeviceUDID "$UDID" || note "could not open the Simulator app"
sleep 20

# ---------------------------------------------------------------- what can rotate
xcrun simctl help > "$OUT/simctl-help.txt" 2>&1
note "== simctl subcommands that mention orientation or rotation:"
grep -iE 'orient|rotat' "$OUT/simctl-help.txt" | tee -a "$STEPS" || note "(none)"
SIMCTL_ROT=$(grep -iE '^ *[a-z_-]+ +.*(orient|rotat)' "$OUT/simctl-help.txt" | awk '{print $1}' | head -n 3 | tr '\n' ' ')
note "simctl candidates: ${SIMCTL_ROT:-none}"
for c in $SIMCTL_ROT; do xcrun simctl help "$c" >> "$OUT/simctl-help.txt" 2>&1; done

win_size() {
  bounded 20 osascript -e 'tell application "System Events" to tell process "Simulator" to get size of front window' 2>&1 | tr -d ' '
}
note "System Events can see the Simulator: $(bounded 20 osascript -e 'tell application "System Events" to get name of every process whose name is "Simulator"' 2>&1)"
note "Simulator window size at start: $(win_size)"

# Rotate the simulated device. $1 is Left or Right. Sets METHOD to what worked.
rotate() {
  local dir=$1 before after rc
  before=$(win_size)
  # 1. simctl, if this Xcode's simctl has anything for it (tried, logged, never trusted alone).
  for c in $SIMCTL_ROT; do
    for arg in "landscape-$(echo "$dir" | tr 'LR' 'lr')" "landscape$dir" "$(echo "$dir" | tr 'LR' 'lr')"; do
      bounded 20 xcrun simctl "$c" "$UDID" "$arg" >> "$STEPS" 2>&1; rc=$?
      note "simctl $c $arg -> exit $rc"
      if [ $rc -eq 0 ]; then sleep 3; after=$(win_size); note "window $before -> $after"; METHOD="simctl $c $arg"; return 0; fi
    done
  done
  # 2. The Simulator app's Device menu.
  bounded 20 osascript -e 'tell application "Simulator" to activate' >> "$STEPS" 2>&1
  sleep 1
  bounded 30 osascript -e "tell application \"System Events\" to tell process \"Simulator\" to click menu item \"Rotate $dir\" of menu \"Device\" of menu bar 1" >> "$STEPS" 2>&1; rc=$?
  note "AppleScript menu Device > Rotate $dir -> exit $rc"
  if [ $rc -eq 0 ]; then sleep 3; after=$(win_size); note "window $before -> $after"; METHOD="Simulator menu Device > Rotate $dir"; return 0; fi
  # 3. No window to click: tell the simulated phone itself which way up it is
  #    held (backboardd's raw orientation: 1 upright, 3 and 4 the two sides).
  #    The Simulator's window does not change with this, so whether the phone
  #    took it is judged from Safari's own screenshots (the control, below),
  #    never from the window.
  #    This script only ever turns Left (onto its side) and then Right (back).
  local raw=4; [ "$dir" = Right ] && raw=1
  bounded 20 xcrun simctl spawn "$UDID" notifyutil -s com.apple.backboardd.rawOrientation "$raw" >> "$STEPS" 2>&1; rc=$?
  bounded 20 xcrun simctl spawn "$UDID" notifyutil -p com.apple.backboardd.rawOrientation >> "$STEPS" 2>&1; rc=$(( rc + $? ))
  note "notifyutil rawOrientation $raw -> exit $rc (now: $(bounded 10 xcrun simctl spawn "$UDID" notifyutil -g com.apple.backboardd.rawOrientation 2>&1 | tr '\n' ' '))"
  if [ $rc -eq 0 ]; then sleep 3; METHOD="notifyutil rawOrientation $raw"; return 0; fi
  return 1
}
# Did the Simulator's window turn (wider than tall, or back)? Answers yes, no or unknown.
window_is_wide() {
  local s; s=$(win_size)
  python3 -c '
import sys
try:
    w, h = [int(float(x)) for x in sys.argv[1].split(",")[:2]]
    print("yes" if w > h else "no")
except Exception:
    print("unknown")' "$s"
}

# ---------------------------------------------------------------- the app's log
STREAM="$OUT/turnexp-stream.log"
xcrun simctl spawn "$UDID" log stream --level debug --style compact --predicate 'eventMessage CONTAINS "TURNEXP"' > "$STREAM" 2>&1 &
STREAM_PID=$!
xcrun simctl spawn "$UDID" log stream --level info --style compact --predicate "process == \"$EXE\"" > "$OUT/app-process.log" 2>&1 &
APPLOG_PID=$!
sleep 3

xcrun simctl install "$UDID" "$APP" || { summary "TURNED: no ($VARIANT: the app would not install)"; kill $STREAM_PID $APPLOG_PID 2>/dev/null; exit 1; }
launch() {
  for try in 1 2 3; do
    xcrun simctl launch --terminate-running-process "$UDID" "$BUNDLE_ID" && return 0
    note "the simulator refused the launch, try $try of 3"
    xcrun simctl terminate "$UDID" "$BUNDLE_ID" 2>/dev/null || true
    sleep 4
  done
  return 1
}
shot() {
  xcrun simctl io "$UDID" screenshot "$OUT/$1.png" >/dev/null 2>&1 || note "screenshot $1 failed"
  local w h
  w=$(sips -g pixelWidth "$OUT/$1.png" 2>/dev/null | awk '/pixelWidth/{print $2}')
  h=$(sips -g pixelHeight "$OUT/$1.png" 2>/dev/null | awk '/pixelHeight/{print $2}')
  note "screenshot $1: ${w:-?}x${h:-?} pixels, Simulator window $(win_size), at $(now)"
}

LAUNCHED=$(now)
launch || note "the app did not launch after three tries"
note "launched at $LAUNCHED"
# The reload variants restart themselves 4 s in, and the second run asks again: give it time to be there.
case "$VARIANT" in reload-*) sleep 28 ;; *) sleep 14 ;; esac
shot 1-upright
T_UPRIGHT_SHOT=$(now)

ROTATED_DEVICE="not tried"
T_ROT=""; T_BACK=""
if [ "$VARIANT" = force-landscape ]; then
  # The JavaScript locks LANDSCAPE_RIGHT 15 s after it starts: no device rotation.
  sleep 14
  shot 2-forced
  sleep 4
  shot 3-forced-later
else
  T_ROT=$(now)
  if rotate Left; then ROTATED_DEVICE=$(window_is_wide); else ROTATED_DEVICE="no (nothing could rotate it)"; fi
  note "after rotating left, the Simulator window is wide: $ROTATED_DEVICE (method: $METHOD)"
  sleep 8
  shot 2-turned
  sleep 4
  shot 2b-turned-later
  T_BACK=$(now)
  rotate Right || note "could not rotate back"
  sleep 8
  shot 3-back
fi
sleep 3

# Leave the app and come back, as a phone that slept or was on another app
# does, and turn it again. The package lets go of what it was asked when the
# app leaves the screen and is meant to ask again by itself when it is back;
# the earlier rounds never left the app.
T_AWAY=""; T_AWAY_ROT=""; T_AWAY_BACK=""
if [ "$VARIANT" != force-landscape ] && [ "$METHOD" != none ]; then
  T_AWAY=$(now)
  xcrun simctl openurl "$UDID" "https://example.com" 2>/dev/null || note "leaving the app: openurl failed"
  sleep 7
  shot 3b-away
  # Launching an app that is already running brings it back to the front; it is not started again.
  xcrun simctl launch "$UDID" "$BUNDLE_ID" || note "coming back: the launch was refused"
  sleep 7
  shot 3c-back-in-the-app
  T_AWAY_ROT=$(now)
  rotate Left || note "could not rotate after coming back"
  sleep 8
  shot 3d-turned-after-away
  T_AWAY_BACK=$(now)
  rotate Right || note "could not rotate back after coming back"
  sleep 6
fi
T_END=$(now)

# A control: Safari, which turns on any iPhone, through the same rotation, so
# the pictures show what a turned app looks like on this simulator.
if [ "$VARIANT" != force-landscape ] && [ "$METHOD" != none ]; then
  xcrun simctl terminate "$UDID" "$BUNDLE_ID" 2>/dev/null || true
  xcrun simctl openurl "$UDID" "https://example.com" 2>/dev/null || note "Safari control: openurl failed"
  sleep 8
  shot 4-safari-upright
  rotate Left >/dev/null 2>&1
  sleep 6
  shot 5-safari-turned
  rotate Right >/dev/null 2>&1
fi

kill $STREAM_PID $APPLOG_PID 2>/dev/null
sleep 1
xcrun simctl spawn "$UDID" log show --last 15m --info --debug --style compact --predicate 'eventMessage CONTAINS "TURNEXP"' > "$OUT/turnexp-show.log" 2>&1 || true
xcrun simctl spawn "$UDID" log show --last 15m --info --debug --style compact --predicate 'eventMessage CONTAINS[c] "orientation" OR eventMessage CONTAINS[c] "geometry"' > "$OUT/orientation-words.log" 2>&1 || true

# ---------------------------------------------------------------- decide
VERDICT=$(python3 - "$VARIANT" "$OUT" "$T_ROT" "$T_BACK" "$T_END" "$ROTATED_DEVICE" "$METHOD" "$T_AWAY" "$T_AWAY_ROT" "$T_AWAY_BACK" <<'PY'
import json, os, re, sys
variant, out, t_rot, t_back, t_end, rotated, method, t_away, t_away_rot, t_away_back = sys.argv[1:11]
rows = []
for name in ("turnexp-stream.log", "turnexp-show.log"):
    p = os.path.join(out, name)
    got = []
    if os.path.exists(p):
        for line in open(p, errors="replace"):
            m = re.search(r"TURNEXP (\{.*\})\s*$", line)
            if not m:
                continue
            try:
                j = json.loads(m.group(1))
            except Exception:
                continue
            j["_at"] = line[:19]
            got.append(j)
    if len(got) > len(rows):
        rows = got
def pix(n):
    try:
        import subprocess
        o = subprocess.run(["sips", "-g", "pixelWidth", "-g", "pixelHeight", os.path.join(out, n + ".png")], capture_output=True, text=True).stdout
        w = int(re.search(r"pixelWidth: (\d+)", o).group(1)); h = int(re.search(r"pixelHeight: (\d+)", o).group(1))
        return w > h
    except Exception:
        return None
lines = []
lines.append(f"log lines from the app: {len(rows)}")
for r in rows:
    if r.get("event") in ("start", "at start", "asked", "forced", "ask threw", "props", "native event", "dims", "before reload", "reloading", "reload refused", "no storage", "appstate"):
        lines.append("  " + json.dumps({k: v for k, v in r.items() if k != "variant"}))
if not rows:
    shot_wide = pix("2-forced" if variant == "force-landscape" else "2-turned")
    first_wide = pix("1-upright")
    turned = bool(shot_wide) and not first_wide
    why = f"no TURNEXP line reached the log, so this is from the screenshots' pixel size alone (upright shot wide: {first_wide}, later shot wide: {shot_wide})"
elif variant == "force-landscape":
    wide = [r for r in rows if r.get("landscape")]
    turned = bool(wide)
    forced = [r for r in rows if r.get("event") == "forced"]
    why = f"lockAsync(LANDSCAPE_RIGHT) answered {forced[-1].get('took') if forced else 'never'}; window after it: {rows[-1].get('win')} (lock {rows[-1].get('lock')})"
else:
    during = [r for r in rows if t_rot and r["_at"] >= t_rot and (not t_back or r["_at"] < t_back)]
    runs = sorted(set(r.get("run", 1) for r in rows))
    runs_during = sorted(set(r.get("run", 1) for r in during))
    before = [r for r in rows if t_rot and r["_at"] < t_rot]
    after = [r for r in rows if t_back and r["_at"] >= t_back]
    turned = any(r.get("landscape") for r in during)
    last = during[-1] if during else (rows[-1] if rows else {})
    why = (f"simulated device rotated: {rotated} by {method}; window while turned: {sorted(set(r.get('win') for r in during)) or 'no lines'}; "
           f"before: {sorted(set(r.get('win') for r in before)) or 'no lines'}; after turning back: {sorted(set(r.get('win') for r in after)) or 'no lines'}; "
           f"native lock while turned: {last.get('lock')}, orientation {last.get('orientation')}")
    if variant.startswith("reload-"):
        asked2 = [r for r in rows if r.get("run") == 2 and r.get("event") == "asked"]
        why += f"; runs seen: {runs}, while turned: {runs_during}; run 2 asked: {[(r.get('step'), r.get('took'), r.get('lock'), r.get('platformLock')) for r in asked2]}"
        if runs_during != [2]:
            why += " -- THE APP WAS NOT IN ITS SECOND RUN WHILE THE PHONE WAS TURNED, so this says nothing about a restart"
    if not turned and not str(rotated).startswith("yes"):
        why += " -- THE SIMULATOR ITSELF WAS NOT SEEN TO TURN, so a no here proves nothing about the app"
print("\n".join(lines))
if rows and t_away_rot:
    away = [r for r in rows if r["_at"] >= t_away_rot and (not t_away_back or r["_at"] < t_away_back)]
    states = [r.get("state") for r in rows if r.get("event") == "appstate" and t_away and r["_at"] >= t_away]
    turned2 = any(r.get("landscape") for r in away)
    last2 = away[-1] if away else {}
    print(f"AFTER LEAVING THE APP AND COMING BACK: {'turned' if turned2 else 'DID NOT TURN'} (app states seen since leaving: {states or 'none'}; window while turned: {sorted(set(r.get('win') for r in away)) or 'no lines'}; lock while turned: {last2.get('lock')}, ways {last2.get('platformLock')})")
print(f"TURNED: {'yes' if turned else 'no'} ({variant}: {why})")
PY
)
echo "$VERDICT" > "$OUT/verdict.txt"
echo "$VERDICT"
FINAL=$(echo "$VERDICT" | grep '^TURNED:' | tail -n 1)
[ -z "$FINAL" ] && FINAL="TURNED: no ($VARIANT: the decision script printed nothing)"
summary "### turn-check: $VARIANT"
summary ""
summary "\`$FINAL\`"
summary ""
summary "\`$(echo "$VERDICT" | grep '^AFTER LEAVING' | tail -n 1)\`"
summary ""
summary "simulator: $DEVNAME; rotation method: $METHOD; window turned: $ROTATED_DEVICE"
summary ""
summary '```'
summary "$(grep -E '^(UISupportedInterfaceOrientations|EXDefaultScreenOrientationMask|UIRequiresFullScreen)|ScreenOrientation|TURNEXP in main' "$OUT/built-app.txt")"
summary "$(echo "$VERDICT" | grep -v -E '^(TURNED:|AFTER LEAVING)' | head -n 60)"
summary '```'
echo "::notice title=turn-check $VARIANT::$FINAL"
AWAYLINE=$(echo "$VERDICT" | grep '^AFTER LEAVING' | tail -n 1)
[ -n "$AWAYLINE" ] && echo "::notice title=turn-check $VARIANT, after leaving::$AWAYLINE"
echo "$FINAL"
exit 0

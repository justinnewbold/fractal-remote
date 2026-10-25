#!/usr/bin/env bash
# Start the minified app on an emulator, leave it a minute, read what happened.
# Called by .github/workflows/android-minified.yml: android-smoke.sh <phone|tablet>
#
# What counts as broken is what R8 breaks: a crash of this app, or one of the
# lookups by name that R8 can take away (a constructor, a class, a field)
# failing in this app's code or a library's. And, since R8 may shrink
# pictures and layouts too (docs/pending/shrink-resources.patch), a picture,
# sound or file looked up by name and not there: expo-updates copies every
# picture and sound built into the app at the first launch, by name, and says
# so when one is missing. The minute must show none of it.
#
# Then, on the phone, the check is turned on itself: the app is crashed on
# purpose, and a line like Expo's own R8 crash and a line like a missing
# picture are written to the log, and all three have to be seen, or a clean
# minute means nothing. This used to be a second build without the
# expo-updates database keep rule, meant to crash at launch; it did not,
# because that build's code came out byte for byte the same as this one's (16
# October 2026), so it could never show the check was looking.
#
# The way the screen is held (docs/pending/tablet-turns.patch). The phone is
# held sideways the whole time, and the app must be drawn upright on it. First
# Settings, which turns freely, is opened and must be drawn sideways, or an
# upright app proves nothing. The tablet is an Android 15 Pixel Tablet, whose
# natural way up is landscape: so it starts sideways for an upright app, is
# turned upright, and back. With the tablet change in (TURNS=yes, from the
# workflow), the app's window must fill the screen every way up; without it,
# the pictures show the upright strip a 1.88.0 tablet shows, and that is
# reported, not failed. Before the first look, the check is shown a strip it
# must call a strip.
#
# Every way, the app is taken past the "An independent app" card by its OK
# button and through the walkthrough into the demo's Play, so the pictures
# show Play. Each button is found by its words, in the screen's own
# description of itself (uiautomator), never by where it was last time.
set -uo pipefail

where="$1"
pkg=cloud.newbold.fractalremote
apk=mobile/android/app/build/outputs/apk/release/app-release.apk
out="smoke/$where"
turns="${TURNS:-no}"
mkdir -p "$out"

# The R8 failures, in lines about this app or the libraries it carries.
R8_FAILURE='NoSuchMethodException|ClassNotFoundException|NoSuchFieldError|NoSuchFieldException|NoClassDefFoundError|AbstractMethodError|Introspectable data is missing'
OURS='expo|facebook|react|revenuecat|androidx\.room|cloud\.newbold|fractal|UpdatesDatabase'

# The small readings this needs, in one place: a picture's size, a button's
# middle, the app window's frame, and the log's missing names.
read -r -d '' HELPER <<'PY'
import re, struct, sys
what, args = sys.argv[1], sys.argv[2:]

def nodes(xml):
    text = open(xml, encoding='utf-8', errors='replace').read()
    for m in re.finditer(r'<node\b[^>]*>', text):
        a = dict(re.findall(r'([\w-]+)="([^"]*)"', m.group(0)))
        b = re.match(r'\[(-?\d+),(-?\d+)\]\[(-?\d+),(-?\d+)\]', a.get('bounds', ''))
        if b:
            yield a, [int(v) for v in b.groups()]

def says(a, words):
    # The words on the button, or its spoken label, which may go on after a comma ("Next, Schism").
    pattern = re.compile(r'(?:%s)(?:,.*)?' % words, re.I | re.S)
    return any(pattern.fullmatch(a.get(k, '').strip()) for k in ('text', 'content-desc'))

if what == 'size':
    with open(args[0], 'rb') as f:
        head = f.read(24)
    if head[:8] != b'\x89PNG\r\n\x1a\n':
        sys.exit('not a picture: %s' % args[0])
    print('%d %d' % struct.unpack('>II', head[16:24]))
elif what in ('find', 'has'):
    xml, words = args
    hits = [(a, b) for a, b in nodes(xml) if says(a, words) and b[2] > b[0] and b[3] > b[1]]
    hits.sort(key=lambda h: h[0].get('clickable') != 'true')
    if not hits:
        sys.exit(1)
    if what == 'find':
        x1, y1, x2, y2 = hits[0][1]
        print('%d %d' % ((x1 + x2) // 2, (y1 + y2) // 2))
elif what == 'frame':
    dump, pkg = args
    text = open(dump, encoding='utf-8', errors='replace').read()
    head = re.compile(r'^\s*Window #\d+ Window\{[0-9a-f]+ u\d+ %s/[\w.]*MainActivity\}:' % re.escape(pkg), re.M)
    m = head.search(text)
    if not m:
        sys.exit(1)
    block = text[m.end():]
    nxt = re.search(r'^\s*Window #\d+ Window\{', block, re.M)
    block = block[:nxt.start()] if nxt else block
    f = re.search(r'(?:^|\s)m?[Ff]rame=\[(-?\d+),(-?\d+)\]\[(-?\d+),(-?\d+)\]', block)
    if not f:
        sys.exit(1)
    print(' '.join(f.groups()))
elif what == 'root':
    xml, pkg = args
    for a, b in nodes(xml):
        if a.get('package') == pkg:
            print(' '.join(map(str, b)))
            break
    else:
        sys.exit(1)
elif what == 'missing':
    log, ours = args
    lines = open(log, encoding='utf-8', errors='replace').read().splitlines()
    pid = lambda l: l.split()[2] if len(l.split()) > 2 else None
    for i, l in enumerate(lines):
        if re.search(r'Failed to copy (resource )?asset|error copying embedded update', l):
            print(l)
        elif re.search(r'Resources\$NotFoundException|Resource ID #0x', l):
            # The line, and its stack under it in the same process: whose code met it.
            near = [l]
            for x in lines[i + 1:i + 80]:
                if pid(x) != pid(l):
                    continue
                said = x.split(': ', 1)[1] if ': ' in x else ''
                if not re.match(r'\s*(at |Caused by|\.\.\. \d+ more)', said):
                    break
                near.append(x)
            if any(re.search(ours, x) for x in near):
                print(l)
PY
helper() { python3 -c "$HELPER" "$@"; }

# Read the log and the crash buffer into $out/<name>-*.txt and decide.
# Sets alive, crashed and broken.
judge() {
  local name="$1"
  alive="$(adb shell pidof "$pkg" | tr -d '\r')"
  adb logcat -d -v threadtime > "$out/$name-logcat.txt"
  adb logcat -d -b crash > "$out/$name-crash.txt" || true
  crashed=no
  if grep -q "Process: $pkg" "$out/$name-crash.txt" || [ -z "$alive" ]; then crashed=yes; fi
  grep -E "$R8_FAILURE" "$out/$name-logcat.txt" | grep -E "$OURS" > "$out/$name-r8-failures.txt" || true
  helper missing "$out/$name-logcat.txt" "$OURS" > "$out/$name-missing.txt" || true
  broken=no
  if [ "$crashed" = yes ] || [ -s "$out/$name-r8-failures.txt" ] || [ -s "$out/$name-missing.txt" ]; then broken=yes; fi
}

# Hold the emulator one way up, with auto-rotate off: 0 is its natural way,
# 1 a quarter turn. Said back, so the record shows it landed.
turn() {
  adb shell settings put system accelerometer_rotation 0
  adb shell cmd window user-rotation lock "$1" > /dev/null 2>&1 || adb shell settings put system user_rotation "$1"
  sleep 4
  echo "rotation now: $(adb shell cmd window user-rotation 2>/dev/null | tr -d '\r') (asked for $1)"
}

# A picture of the screen; sets w and h to its size.
shot() {
  adb exec-out screencap -p > "$out/$1.png"
  read -r w h < <(helper size "$out/$1.png" || echo "0 0")
  echo "$1.png: ${w}x${h}"
}

# What is on the screen, as the screen describes itself, into $out/<name>.xml.
ui() {
  local try
  for try in 1 2 3; do
    if adb shell uiautomator dump /sdcard/ui.xml > /dev/null 2>&1 && adb pull /sdcard/ui.xml "$out/$1.xml" > /dev/null 2>&1; then
      return 0
    fi
    sleep 2
  done
  return 1
}

# Press the button with these words. Waits for it, and from the third look
# scrolls a little, for a page taller than the screen.
press() {
  local words="$1" name="$2" try at
  for try in 1 2 3 4 5 6; do
    if ui "$name" && at="$(helper find "$out/$name.xml" "$words")"; then
      # shellcheck disable=SC2086
      adb shell input tap $at
      echo "pressed \"$words\" at $at"
      sleep 3
      return 0
    fi
    if [ "$try" -ge 3 ]; then
      shot "$name-looking"
      adb shell input swipe $((w / 2)) $((h * 3 / 4)) $((w / 2)) $((h * 2 / 5)) 400
    fi
    sleep 3
  done
  echo "::error::No button saying \"$words\" on the $where emulator. See $name.xml and $name-looking.png in the r8-run artifact."
  return 1
}

# From the startup card into the demo's Play, the way somebody opening the
# app for the first time goes: the card's OK, the walkthrough's first page,
# its demo, a unit, and Play. On Play, a tip may sit over it once.
walk() {
  press 'OK' card || return 1
  press 'Get started' walk-start || return 1
  press 'Try the demo' walk-how || return 1
  press 'Play with .+' walk-pick || return 1
  press 'Open Play' walk-ready || return 1
  local try at
  for try in 1 2 3 4 5; do
    if ui play; then
      if helper has "$out/play.xml" 'Previous|Next'; then return 0; fi
      # shellcheck disable=SC2086
      if at="$(helper find "$out/play.xml" 'Got it')"; then adb shell input tap $at; fi
    fi
    sleep 3
  done
  echo "::error::The demo's Play did not come up on the $where emulator. See play.xml in the r8-run artifact."
  return 1
}

# Does the app's window fill the screen, or sit in it as an upright strip?
# Read off the window manager's own frame for MainActivity's window, or, if
# that dump reads differently on this Android, off the outermost view the
# screen describes as the app's; against the picture just taken of the whole
# screen. Sets fill (yes, no or unknown) and frame.
fills() {
  local name="$1"
  adb shell dumpsys window windows > "$out/$name-windows.txt"
  adb shell dumpsys activity activities > "$out/$name-activities.txt"
  grep -iE 'letterbox|rientation' "$out/$name-activities.txt" | grep -v '^\s*$' > "$out/$name-letterbox.txt" || true
  judge_frame "$out/$name-windows.txt"
  if [ "$fill" = unknown ] && ui "$name-screen"; then
    frame="$(helper root "$out/$name-screen.xml" "$pkg")" || frame=""
    judge_bounds
  fi
}
judge_frame() {
  frame="$(helper frame "$1" "$pkg")" || frame=""
  judge_bounds
}
judge_bounds() {
  local x1 y1 x2 y2
  fill=unknown
  [ -n "$frame" ] && [ "$w" -gt 0 ] || return 0
  read -r x1 y1 x2 y2 <<< "$frame"
  if [ $(( (x2 - x1) * 10 )) -ge $(( w * 9 )) ] && [ $(( (y2 - y1) * 10 )) -ge $(( h * 9 )) ]; then fill=yes; else fill=no; fi
}

summary() { echo "$1" >> "${GITHUB_STEP_SUMMARY:-/dev/null}"; }
failed=()

adb wait-for-device
adb install -r "$apk" || { echo "::error::The minified APK would not install on the $where emulator."; exit 1; }
summary "### $where"
summary ""

if [ "$where" = phone ]; then
  # Sideways, and Settings to show it landed: it turns freely, so it must be drawn sideways.
  turn 1
  adb shell am start -a android.settings.SETTINGS > /dev/null
  sleep 4
  shot settings-sideways
  if [ "$w" -le "$h" ]; then
    echo "::error::The phone emulator did not turn sideways (Settings was drawn ${w}x${h}), so an upright app here would prove nothing."
    failed+=("the sideways turn did not land")
  fi
  summary "- held sideways: Settings drawn ${w}x${h}"
  adb shell input keyevent KEYCODE_HOME
  sleep 2
else
  # The parser first: a window a third of the screen wide must read as a strip.
  printf '%s\n' "  Window #9 Window{5ca1ab1e u0 $pkg/$pkg.MainActivity}:" \
    '    Frames: parent=[780,0][1780,1600] display=[780,0][1780,1600] frame=[780,0][1780,1600] last=[780,0][1780,1600] insetsChanged=false' \
    > "$out/self-test-windows.txt"
  w=2560 h=1600
  judge_frame "$out/self-test-windows.txt"
  if [ "$fill" != no ]; then
    echo "::error::This check is blind: a window in the middle of the screen, a third of its width, read as filling it ($fill)."
    failed+=("the fill check cannot tell a strip")
  fi
  echo "the check calls an upright strip a strip (window $frame on a ${w}x${h} screen: fills $fill)"
  # Sideways for an upright app: the Pixel Tablet's own way up.
  turn 0
  shot home-sideways
  if [ "$w" -le "$h" ]; then
    echo "::error::The tablet emulator is not sideways (its home screen was drawn ${w}x${h})."
    failed+=("the tablet was not sideways")
  fi
  change="not in"
  [ "$turns" = yes ] && change=in
  summary "- held sideways: home screen ${w}x${h}; the tablet change is $change"
fi

adb logcat -c
adb logcat -b crash -c || true
start=$(date +%s)
adb shell monkey -p "$pkg" -c android.intent.category.LAUNCHER 1 > /dev/null
sleep 10
shot card

# Each look at which way up the app is, said in the summary and judged.
look() {
  local name="$1"
  shot "$name"
  if [ "$where" = phone ]; then
    if [ "$h" -gt "$w" ]; then
      summary "- $name: drawn upright, ${w}x${h}"
    else
      echo "::error::The app was drawn sideways on the phone (${w}x${h} in $name.png): a phone must stay upright."
      summary "- $name: drawn SIDEWAYS, ${w}x${h}"
      failed+=("$name: the app turned sideways on a phone")
    fi
    return
  fi
  fills "$name"
  local held=sideways
  [ "$h" -gt "$w" ] && held=upright
  if [ "$fill" = yes ]; then
    summary "- $name: held $held, the app fills the screen (${w}x${h}, window $frame)"
  elif [ "$turns" = yes ]; then
    echo "::error::With the tablet change in, the app does not fill the tablet held $held (screen ${w}x${h}, window ${frame:-not found}). See $name.png."
    summary "- $name: held $held, the app does NOT fill the screen (${w}x${h}, window ${frame:-not found})"
    failed+=("$name, held $held: the app does not fill the screen ($fill)")
  else
    summary "- $name: held $held, window ${frame:-not found} on a ${w}x${h} screen ($fill), as 1.88.0 shows it"
  fi
}

look card
walked=yes
walk || walked=no
summary "- into the demo's Play: $walked"
[ "$walked" = yes ] || failed+=("could not get into the demo")
look play

if [ "$where" = tablet ]; then
  # Turned upright while Play is up, and back: the turn a tablet on a music stand takes.
  turn 1
  look play-upright
  turn 0
  look play-sideways-again
fi

left=$(( 60 - ($(date +%s) - start) ))
[ "$left" -gt 0 ] && sleep "$left"
shot after-60s

judge minute

# JavaScript errors are printed for reading, not judged: R8 does not touch the
# JavaScript, and a demo-mode warning is not a failure.
grep -E ' E ReactNativeJS' "$out/minute-logcat.txt" | head -40 > "$out/js-errors.txt" || true

summary "- still running after a minute: $([ -n "$alive" ] && echo yes || echo no)"
summary "- crashed: $crashed"
summary "- R8 lookups that failed: $(wc -l < "$out/minute-r8-failures.txt")"
summary "- pictures, sounds or files missing by name: $(wc -l < "$out/minute-missing.txt")"
summary "- JavaScript errors in the log: $(wc -l < "$out/js-errors.txt")"

echo "--- crash buffer"; cat "$out/minute-crash.txt"
echo "--- R8 lookups that failed"; cat "$out/minute-r8-failures.txt"
echo "--- missing by name"; cat "$out/minute-missing.txt"
echo "--- JavaScript errors"; cat "$out/js-errors.txt"

if [ "$broken" = yes ]; then
  echo "::error::The minified app broke on the $where emulator. See minute-r8-failures.txt, minute-missing.txt and minute-crash.txt in the r8-run artifact."
  exit 1
fi
echo "The minified app started on the $where emulator and was still running a minute later."

if [ "${#failed[@]}" -gt 0 ]; then
  for f in "${failed[@]}"; do echo "::error::On the $where emulator: $f"; done
  exit 1
fi

[ "$where" = phone ] || exit 0

# Can this check see a crash at all? `am crash` makes the app die the way an
# uncaught exception does, into the crash buffer under its own process name.
adb shell am crash "$pkg" > "$out/am-crash.txt" 2>&1 || true
# And can it see an R8 failure? Expo's own words for the one it fixed in
# expo-updates 58, written to the log the way the app would write them.
adb shell log -p e -t AndroidRuntime "'java.lang.NoSuchMethodException: expo.modules.updates.db.UpdatesDatabase_Impl.<init> []'"
# And a picture shrunk away: the exception a lookup by name meets, with the
# library that met it.
adb shell log -p e -t ReactNative "'android.content.res.Resources\$NotFoundException: Resource ID #0x7f0d0001 (planted by android-smoke.sh in expo.modules.asset)'"
sleep 5
judge self-test
cat "$out/am-crash.txt"
saw_crash=no
grep -q "Process: $pkg" "$out/self-test-crash.txt" && saw_crash=yes
saw_r8=no
[ -s "$out/self-test-r8-failures.txt" ] && saw_r8=yes
saw_missing=no
[ -s "$out/self-test-missing.txt" ] && saw_missing=yes
summary "- the check saw a crash made on purpose: $saw_crash; an R8 failure in the log: $saw_r8; a missing picture: $saw_missing"
if [ "$saw_crash" != yes ] || [ "$saw_r8" != yes ] || [ "$saw_missing" != yes ]; then
  echo "::error::This check is blind: it did not see the crash made on purpose ($saw_crash), the R8 failure written to the log ($saw_r8) or the missing picture ($saw_missing), so its clean minute proves nothing. Read self-test-crash.txt and am-crash.txt."
  exit 1
fi
echo "The check sees a crash, an R8 failure and a missing picture when there is one."

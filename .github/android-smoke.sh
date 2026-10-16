#!/usr/bin/env bash
# Start the minified app on an emulator, leave it a minute, read what happened.
# Called by .github/workflows/android-minified.yml: android-smoke.sh <phone|tablet> <all|control>
#
# What counts as broken is what R8 breaks: a crash of this app, or one of the
# lookups by name that R8 can take away (a constructor, a class, a field)
# failing in this app's code or a library's. "all" must show none of it.
# "control" is the same build without the database keep rule, and must show it,
# or this check is blind to the very failure it is here for.
set -uo pipefail

where="$1"
rules="$2"
pkg=cloud.newbold.fractalremote
apk=mobile/android/app/build/outputs/apk/release/app-release.apk
out="smoke/$where"
mkdir -p "$out"

adb wait-for-device
adb install -r "$apk" || { echo "::error::The minified APK would not install on the $where emulator."; exit 1; }

if [ "$where" = tablet ]; then
  # Sideways, by hand: auto-rotate off, then a quarter turn.
  adb shell settings put system accelerometer_rotation 0
  adb shell settings put system user_rotation 1
fi

adb logcat -c
adb shell monkey -p "$pkg" -c android.intent.category.LAUNCHER 1 > /dev/null
sleep 20
adb exec-out screencap -p > "$out/after-20s.png"
sleep 40
adb exec-out screencap -p > "$out/after-60s.png"

alive="$(adb shell pidof "$pkg" | tr -d '\r')"
adb logcat -d -v threadtime > "$out/logcat.txt"
adb logcat -d -b crash > "$out/crash.txt" || true

# A crash of this app, from the crash buffer, which names the process.
crashed=no
if grep -q "Process: $pkg" "$out/crash.txt" || [ -z "$alive" ]; then crashed=yes; fi

# R8's own failures, in lines about this app or the libraries it carries.
grep -E 'NoSuchMethodException|ClassNotFoundException|NoSuchFieldError|NoSuchFieldException|NoClassDefFoundError|AbstractMethodError|Introspectable data is missing' "$out/logcat.txt" \
  | grep -E 'expo|facebook|react|revenuecat|androidx\.room|cloud\.newbold|fractal|UpdatesDatabase' > "$out/r8-failures.txt" || true

# JavaScript errors are printed for reading, not judged: R8 does not touch the
# JavaScript, and a demo-mode warning is not a failure.
grep -E ' E ReactNativeJS' "$out/logcat.txt" | head -40 > "$out/js-errors.txt" || true

{
  echo "### $where, $rules"
  echo ""
  echo "- still running after a minute: $([ -n "$alive" ] && echo yes || echo no)"
  echo "- crashed: $crashed"
  echo "- R8 lookups that failed: $(wc -l < "$out/r8-failures.txt")"
  echo "- JavaScript errors in the log: $(wc -l < "$out/js-errors.txt")"
} >> "$GITHUB_STEP_SUMMARY"

echo "--- crash buffer"; cat "$out/crash.txt"
echo "--- R8 lookups that failed"; cat "$out/r8-failures.txt"
echo "--- JavaScript errors"; cat "$out/js-errors.txt"

broken=no
if [ "$crashed" = yes ] || [ -s "$out/r8-failures.txt" ]; then broken=yes; fi

if [ "$rules" = control ]; then
  if [ "$broken" = no ]; then
    echo "::error::The control build (no database keep rule) started cleanly. Either expo-updates no longer needs the rule, or this check cannot see the crash it is here for. Read logcat.txt before trusting the green on the real build."
    exit 1
  fi
  echo "The control broke, as it should: the check can see the failure."
  exit 0
fi

if [ "$broken" = yes ]; then
  echo "::error::The minified app broke on the $where emulator. See r8-failures.txt and crash.txt in the r8-all-run artifact."
  exit 1
fi
echo "The minified app started on the $where emulator and was still running a minute later."

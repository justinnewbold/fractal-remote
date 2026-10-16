#!/usr/bin/env bash
# Start the minified app on an emulator, leave it a minute, read what happened.
# Called by .github/workflows/android-minified.yml: android-smoke.sh <phone|tablet>
#
# What counts as broken is what R8 breaks: a crash of this app, or one of the
# lookups by name that R8 can take away (a constructor, a class, a field)
# failing in this app's code or a library's. The minute must show none of it.
#
# Then, on the phone, the check is turned on itself: the app is crashed on
# purpose and a line like Expo's own R8 crash is written to the log, and both
# have to be seen, or a clean minute means nothing. This used to be a second
# build without the expo-updates database keep rule, meant to crash at launch;
# it did not, because that build's code came out byte for byte the same as
# this one's (16 October 2026), so it could never show the check was looking.
set -uo pipefail

where="$1"
pkg=cloud.newbold.fractalremote
apk=mobile/android/app/build/outputs/apk/release/app-release.apk
out="smoke/$where"
mkdir -p "$out"

# The R8 failures, in lines about this app or the libraries it carries.
R8_FAILURE='NoSuchMethodException|ClassNotFoundException|NoSuchFieldError|NoSuchFieldException|NoClassDefFoundError|AbstractMethodError|Introspectable data is missing'
OURS='expo|facebook|react|revenuecat|androidx\.room|cloud\.newbold|fractal|UpdatesDatabase'

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
  broken=no
  if [ "$crashed" = yes ] || [ -s "$out/$name-r8-failures.txt" ]; then broken=yes; fi
}

adb wait-for-device
adb install -r "$apk" || { echo "::error::The minified APK would not install on the $where emulator."; exit 1; }

if [ "$where" = tablet ]; then
  # Sideways, by hand: auto-rotate off, then a quarter turn.
  adb shell settings put system accelerometer_rotation 0
  adb shell settings put system user_rotation 1
fi

adb logcat -c
adb logcat -b crash -c || true
adb shell monkey -p "$pkg" -c android.intent.category.LAUNCHER 1 > /dev/null
sleep 20
adb exec-out screencap -p > "$out/after-20s.png"
sleep 40
adb exec-out screencap -p > "$out/after-60s.png"

judge minute

# JavaScript errors are printed for reading, not judged: R8 does not touch the
# JavaScript, and a demo-mode warning is not a failure.
grep -E ' E ReactNativeJS' "$out/minute-logcat.txt" | head -40 > "$out/js-errors.txt" || true

{
  echo "### $where"
  echo ""
  echo "- still running after a minute: $([ -n "$alive" ] && echo yes || echo no)"
  echo "- crashed: $crashed"
  echo "- R8 lookups that failed: $(wc -l < "$out/minute-r8-failures.txt")"
  echo "- JavaScript errors in the log: $(wc -l < "$out/js-errors.txt")"
} >> "$GITHUB_STEP_SUMMARY"

echo "--- crash buffer"; cat "$out/minute-crash.txt"
echo "--- R8 lookups that failed"; cat "$out/minute-r8-failures.txt"
echo "--- JavaScript errors"; cat "$out/js-errors.txt"

if [ "$broken" = yes ]; then
  echo "::error::The minified app broke on the $where emulator. See minute-r8-failures.txt and minute-crash.txt in the r8-run artifact."
  exit 1
fi
echo "The minified app started on the $where emulator and was still running a minute later."

[ "$where" = phone ] || exit 0

# Can this check see a crash at all? `am crash` makes the app die the way an
# uncaught exception does, into the crash buffer under its own process name.
adb shell am crash "$pkg" > "$out/am-crash.txt" 2>&1 || true
# And can it see an R8 failure? Expo's own words for the one it fixed in
# expo-updates 58, written to the log the way the app would write them.
adb shell log -p e -t AndroidRuntime "'java.lang.NoSuchMethodException: expo.modules.updates.db.UpdatesDatabase_Impl.<init> []'"
sleep 5
judge self-test
cat "$out/am-crash.txt"
saw_crash=no
grep -q "Process: $pkg" "$out/self-test-crash.txt" && saw_crash=yes
saw_r8=no
[ -s "$out/self-test-r8-failures.txt" ] && saw_r8=yes
echo "- the check saw a crash made on purpose: $saw_crash; and an R8 failure in the log: $saw_r8" >> "$GITHUB_STEP_SUMMARY"
if [ "$saw_crash" != yes ] || [ "$saw_r8" != yes ]; then
  echo "::error::This check is blind: it did not see the crash made on purpose ($saw_crash) or the R8 failure written to the log ($saw_r8), so its clean minute proves nothing. Read self-test-crash.txt and am-crash.txt."
  exit 1
fi
echo "The check sees a crash and an R8 failure when there is one."

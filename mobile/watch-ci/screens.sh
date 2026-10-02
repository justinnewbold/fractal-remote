#!/usr/bin/env bash
# A picture of each watch page, from a simulated Apple Watch, in demo mode.
set -euo pipefail
cd "$(dirname "$0")"
APP=build/Build/Products/Debug-watchsimulator/FractalWatch.app
ID=cloud.newbold.fractalremote.watchkitapp
UDID=$(xcrun simctl list devices available -j | python3 -c '
import json, sys
d = json.load(sys.stdin)["devices"]
watches = [x for k, v in d.items() if "watchOS" in k for x in v if "Apple Watch" in x["name"]]
pref = [x for x in watches if "45mm" in x["name"] or "46mm" in x["name"]] or watches
print(pref[-1]["udid"])')
echo "watch simulator: $UDID"
xcrun simctl boot "$UDID" || true
xcrun simctl bootstatus "$UDID" -b
xcrun simctl install "$UDID" "$APP"
mkdir -p screens
shoot() {
  xcrun simctl launch --terminate-running-process "$UDID" "$ID" -demo YES "$@"
  sleep 5
}
for page in 0 1 2 3; do
  shoot -page "$page"
  xcrun simctl io "$UDID" screenshot "screens/page-$page.png"
done
shoot -page 3 -tunerDemo YES
xcrun simctl io "$UDID" screenshot "screens/tuner-on.png"
# And with no phone: what it says when the iPhone app is not open.
xcrun simctl launch --terminate-running-process "$UDID" "$ID" -demo NO
sleep 5
xcrun simctl io "$UDID" screenshot "screens/waiting.png"
ls -la screens
# The pictures, small, in the log as well: the artifact is not reachable from
# everywhere a reviewer reads this check. Between markers, one per line.
for f in screens/*.png; do
  sips -Z 220 "$f" --out "/tmp/small.png" >/dev/null
  echo "WATCHSHOT-BEGIN $(basename "$f")"
  base64 -i /tmp/small.png | tr -d '\n'
  echo
  echo "WATCHSHOT-END"
done

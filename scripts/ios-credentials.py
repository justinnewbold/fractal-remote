#!/usr/bin/env python3
"""
SET UP THE iOS SIGNING FOR EVERY TARGET, ONCE — answered by a script, not a person.

`eas build --non-interactive` will not attach the existing distribution
certificate to a target that has none (the Apple Watch app, added in 1.86.44):
"Credentials are not set up. Run this command again in interactive mode."
This is that interactive run — `eas credentials -p ios` → production → Build
Credentials → All — with each question answered here, and Apple reached through
the App Store Connect API key (EXPO_ASC_API_KEY_PATH / KEY_ID / ISSUER_ID), so
no Apple ID, password or phone code is asked for.

It only ever says yes to REUSING what exists (the certificate the phone app
already signs with) and to GENERATING the missing provisioning profile. Any
question it does not recognise stops it with the screen printed, rather than a
guess. Run by .github/workflows/ios-credentials.yml.
"""
import os
import re
import sys
import time

import pexpect

ANSI = re.compile(r"\x1b\[[0-9;?]*[A-Za-z]|\x1b[()][0-9A-B]|\r")
child = pexpect.spawn(
    "eas",
    ["credentials", "-p", "ios"],
    cwd=os.path.join(os.path.dirname(__file__), "..", "mobile"),
    encoding="utf-8",
    timeout=180,
    dimensions=(60, 180),
)
seen = ""


def read_for(seconds):
    global seen
    end = time.time() + seconds
    while time.time() < end:
        try:
            seen += child.read_nonblocking(65536, timeout=0.5)
        except pexpect.TIMEOUT:
            pass
        except pexpect.EOF:
            return False
    return True


def screen():
    return ANSI.sub("", seen)


def last_question(text):
    lines = [l for l in text.split("\n") if l.strip().startswith("?")]
    return lines[-1].strip() if lines else ""


def choose(pattern):
    """Move the highlight (❯) to the option matching `pattern`, then Enter."""
    lines = screen().split("\n")
    q = max(i for i, l in enumerate(lines) if l.strip().startswith("?"))
    opts = [l for l in lines[q + 1 :] if l.strip()]
    cur = next((i for i, l in enumerate(opts) if l.lstrip().startswith("❯")), 0)
    want = next((i for i, l in enumerate(opts) if re.search(pattern, l, re.I)), None)
    if want is None:
        die(f"no option matching {pattern!r}")
    key = "\x1b[B" if want > cur else "\x1b[A"
    for _ in range(abs(want - cur)):
        child.send(key)
        time.sleep(0.25)
    child.send("\r")


def die(why):
    print(screen()[-6000:])
    print(f"\nSTOPPED: {why}")
    child.terminate(force=True)
    sys.exit(1)


menu_done = False
for step in range(40):
    alive = read_for(3)
    text = screen()
    q = last_question(text)
    tail = text[-2500:]
    if not alive:
        break
    # Back at a menu after "All" ran: the setup is over, whatever it said.
    if menu_done and "What do you want to do" in q:
        break
    if not q or q.startswith("✔"):
        continue
    print("Q:", q[:150], flush=True)
    if re.search(r"Apple ID:|Password|6 digit|code", q, re.I):
        die("Apple asked for an Apple ID sign-in; the API key was not used")
    elif re.search(r"build profile", q, re.I):
        choose(r"production")
    elif re.search(r"log in to your Apple account", q, re.I):
        child.send("y\r")
    elif re.search(r"What do you want to do", q, re.I):
        if re.search(r"All: Set up all", tail):
            choose(r"All: Set up all")
            menu_done = True
        elif re.search(r"Build Credentials", tail):
            choose(r"Build Credentials")
        else:
            die("an unfamiliar menu")
    elif re.search(r"Reuse this distribution certificate|reuse the original profile", q, re.I):
        child.send("y\r")
    elif re.search(r"Generate a new Apple Provisioning Profile|Generate a new provisioning profile", q, re.I):
        child.send("y\r")
    elif re.search(r"Select the iOS Distribution Certificate", q, re.I):
        choose(r"fractal-remote")
    else:
        die("a question this script does not answer")
    time.sleep(1)

read_for(5)
out = screen()
print(out[-6000:])
# EAS's own line once every target is signed. The first run's per-target
# block search missed it (the profile was made, the job still went red).
if re.search(r"All credentials are ready to build[^\n]*watchkitapp", out):
    print("\nDONE: the watch app has its signing.")
    sys.exit(0)
print("\nNOT CONFIRMED: read the screen above.")
sys.exit(1)

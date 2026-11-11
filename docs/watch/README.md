# The Apple Watch app: what was chosen, and the pictures it was chosen from

The watch app's code is mobile/targets/watch (Swift) and its conversation
with the phone is shared/watch-link.mjs. Work on it that waits for a build
is in docs/pending. This folder keeps the pictures a choice was made from,
so the choice is on record.

## The tuner page: Start tuning and Stop tuning

![The tuner page, off and on](tuner-start-stop.png)

`tuner-start-stop.png` is the mockup Justin picked on 11 November 2026, of
three: "Go with option B for the watch I like that one."

Why it changed: the off screen was one button that said "Tuner on" while
the tuner was off, and he read it as the state: "where it says tuner on I
feel like that means it on."

So the screen says what the tuner IS, and the buttons say what a tap will
DO:

- **Off:** the small TUNER line, then the word "Off", big and grey, then one
  large green button with the tuning fork, "Start tuning" (the app's green,
  #5CD978, with near-black words, #06210E). No "Tap to tune." line, and
  nothing on the screen says "on".
- **On:** the note, the needle and the cents line as they were, then
  "Stop tuning", red (red words, #FF6961, on a red-tinted fill, 255, 69, 58
  at 28%), where "Tuner off" was.
- Never "Tuner on" or "Tuner off" as a button's words again.
- VoiceOver reads the buttons by their words, and "Off" as "Tuner is off".

Nothing about what the tuner does changed with the words: the same two
requests to the phone, nothing until it is tapped, and off when its page is
left or hidden (docs/pending/README.md has the rest, and the setting that
lets it stay on).

The picture is a drawing, not a screenshot: the real page is in
mobile/targets/watch/Pages.swift (`TunerPage`), its words in Model.swift
(`TunerWords`), and CI's own pictures of it are watch.yml's page-3.png and
tuner-on.png.

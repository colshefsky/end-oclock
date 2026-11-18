# Live smoke test (before every release)

About 10 minutes, on real youtube.com, with the release zip loaded unpacked. Signed in is best (real home feed).

- [ ] Opening youtube.com shows the start screen before anything plays; YouTube's keyboard shortcuts do nothing behind it.
- [ ] "For a while" 20 min → start. Pill says "Done by …", helper says everything fits, then slides out on "Got it".
- [ ] Home, search, subscriptions and a channel page: no tile longer than the time left; no Shorts shelf, tab, chip or sidebar entry.
- [ ] /shorts/<anything> lands on the home page.
- [ ] A watch page's sidebar only shows videos that fit. Autoplay toggle is off/hidden, no end-screen cards.
- [ ] A direct link to a long video shows "This one won't fit" (also during a pre-roll ad); "Find something shorter" goes home; "Copy link for later" copies the link.
- [ ] A video that fits plays. Pausing it stretches "Done by" (pause-stops-clock on); playing again stops stretching.
- [ ] Fullscreen hides the pill and helper.
- [ ] A live stream plays; helper says it wraps up at the end time.
- [ ] Two tabs: a video playing in one keeps the session open past the end time; it ends when that video ends, and both tabs show "That's a wrap!".
- [ ] "I'm done" → "That's a wrap!" with the Next up plan; the tab closes after 15 s (setting on).
- [ ] Reopen YouTube → cooldown screen with the right time.
- [ ] Close every YouTube tab during a session, wait past the end, reopen → "That's a wrap!" once, then cooldown.
- [ ] Toolbar popup shows the right state; Settings opens the hold screen; holding 60 s unlocks; letting go resets.
- [ ] Repeat the first three checks in Edge/Brave/Vivaldi/Ardia if available.

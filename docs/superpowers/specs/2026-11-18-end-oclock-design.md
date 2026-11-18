# End O'Clock: design

Date: 2026-11-18
Status: approved by owner 2026-11-18 (v1 ships on GitHub only; store publishing later)
Visual mockup (source of truth for look and motion): https://claude.ai/artifact/6GPwrm3MCXQrpAP5yAPuMe

## 1. Intent

End O'Clock is a free, open-source Chrome extension that gives adults a planned, satisfying ending to YouTube sessions.

It comes from Hank Green's Clockwise TV launch video (an app for kids where every session has a stop time, the app never shows a video that would run past it, and the ending is celebrated) and the hundreds of comments asking for an adult version, many from people with ADHD. Their complaints with existing tools: time limits cut you off mid-video, "5 more minutes" buttons loop forever, Shorts and autoplay never end, and nothing makes stopping feel good.

The core idea: **you pick when you're done before you start, and you never even see a video that would go past that.** So there's nothing to rush and nothing to cut off. The session just gracefully ends, with a little celebration and a nudge toward what you said you'd do next.

We are taking the stop-time ideas only, not Clockwise's curated educational content.

## 2. Goals, non-goals, anti-goals

**Goals**
- Every visit to YouTube starts with choosing an ending.
- Only videos that fit in the time left are visible anywhere on YouTube.
- Shorts are gone. Autoplay and end-screen suggestions are gone.
- The session ends at a natural stopping point and the ending feels good.
- A cooldown stops you from starting another session right away.
- Settings are deliberately annoying to reach (hold a button for 60 seconds), so the rules you set when calm hold when you're not.
- A friendly, cartoony, polished feel throughout.
- Works in every Chromium browser from one build: Chrome, Edge, Brave, Opera, Vivaldi, Arc.
- Installing is obvious for non-technical people (see §7.1).

**Non-goals**
- Curating or rating content.
- Accounts, servers, sync between devices, analytics.
- Mobile apps, YouTube Music, YouTube Kids, m.youtube.com, embedded players on other sites.
- Being tamper-proof. Anyone can disable the extension at chrome://extensions; we add friction, not locks.
- Firefox/Edge builds in v1 (the tooling should keep them easy later).

**Anti-goals** (failure even if it technically works)
- Cutting a video off mid-play, ever.
- Countdown pressure: no ticking "12 min left" timers, no "hurry" warnings.
- A flash of content that should be hidden (Shorts, too-long videos) before it disappears.
- Breaking YouTube itself when YouTube changes its markup.
- Collecting any data.
- Looking affiliated with Clockwise TV, or copying Vault Boy or Clippy.

## 3. Constraints

- Chrome, Manifest V3. Content scripts only on `https://www.youtube.com/*`.
- License: MIT, public repo on the owner's personal GitHub (`colshefsky`). Most similar open-source extensions are GPL: borrow patterns, never code. The MIT Shorts selector list from `gijsdev/ublock-hide-yt-shorts` may be reused with attribution.
- Minimal permissions: `storage`, `alarms` (if needed). No remote code, no network requests of our own.
- Project rules in `CLAUDE.md`: mockup first for anything visual (approved in the Artifact before it's built), character art comes from Codex, mascot must stay original, never use the name Clockwise.

## 4. Approaches considered

| | Approach | Trade-off |
|---|---|---|
| A | Plain JavaScript, no build step, video lengths read only from thumbnail badges | Easiest for anyone to read and edit; long videos can flash before hiding, breaks more easily, no automated tests |
| **B** | **TypeScript + WXT; CSS-first hiding; lengths from badges plus a passive listener on YouTube's own data; selectors in one module; unit and fixture-based e2e tests; CI** | More setup and contributors need Node; nothing flashes, survives YouTube changes better, testable |
| C | Rewrite YouTube's data responses before render (BlockTube-style) | Cleanest result, but monkey-patches YouTube internals; when it breaks, YouTube breaks |

**Chosen: B**, by the owner. Hiding things early is what makes the ending graceful instead of glitchy, and a public project people rely on has to survive YouTube's constant markup changes. C was ruled out as too fragile; A trades too much polish and robustness for simplicity.

## 5. Behavior

### 5.1 Starting a session (the gate)

- Whenever there is no active session and no cooldown, any youtube.com page is covered by the **Start screen** before it renders (CSS at `document_start` hides the page; nothing plays behind it, YouTube's keyboard shortcuts are blocked while it's up).
- Two ways to set the end, as tabs:
  - **For a while:** quick picks 15 / 30 / 45 min / 1 hr, or a custom number of minutes.
  - **Until a time:** a clock time (e.g. 10:00 PM). If the time has passed today, it means tomorrow.
- Optional field: **"After this, I'm going to…"** (free text). It's shown again on the end and cooldown screens.
- Shows "Ends at 9:30 PM" before starting. **Start watching** begins the session. A link closes the tab instead.
- A maximum session length (setting) caps both modes.

### 5.2 The clock

- **Until a time:** the end is fixed. Pausing never adds time.
- **For a while:** the end moves only if the setting **"Pausing a video pauses the clock"** is on. Then the clock stops while the session's video is paused on a watch page, and runs the rest of the time (including browsing). When the setting is off, it's real time from Start.
- **Pausing can never stretch a session past the "Longest session allowed"**, measured in real time from Start (owner's call). Only a deliberate pause of a playing video counts; buffering and ads don't.
- One session is shared by all YouTube tabs. `chrome.storage` is the single source of truth: store the session's mode, start, end timestamp, and accumulated paused time; tabs sync via `storage.onChanged`. No per-tab timers are trusted.

### 5.3 What you can see during a session

- **Only videos that fit.** A tile is visible only when its length is known and `length ≤ time left`. Tiles whose length is not yet known stay hidden until it is (no flash). This applies everywhere tiles appear: home, search, subscriptions, channel pages, watch-page sidebar, playlist panels.
- As time passes, tiles that no longer fit disappear quietly (no animation that draws attention to it).
- Always hidden: Shorts (shelves, tiles, sidebar entry, channel tab, chips).
- Mixes and playlists stay visible (owner's call). Playing them is fine; each next item must pass the fit check (below).
- Live streams stay visible (owner's call). See §5.5 for how a live stream ends.
- `/shorts/...` URLs redirect to the YouTube home page.
- Autoplay is turned off; end-screen cards/suggestions and the autoplay countdown are hidden.
- **Watch page check (backstop):** when a video page opens (e.g. a direct link), its real length is checked. If what's left of it doesn't fit, the **Doesn't fit screen** appears instead ("This one won't fit. It's 48 minutes long, and you're done by 9:30 PM.") with **Save to Watch Later** and **Find something shorter**. Ads are ignored when measuring.
- Once a video starts playing within the session, it is **committed**: it always gets to finish.
- When playing through a playlist, the next playlist item must pass the same check; if it doesn't fit, playback stops at the end of the current video.

### 5.4 The pill and the helper

- **Pill** (bottom-left): "Done by 9:30 PM" and an **I'm done** button that ends the session immediately. No countdown anywhere.
- **Helper** (bottom-right): the mascot swings in with a speech bubble at key moments, dismissable with "Got it", and slides back out the way it came. Moments in v1:
  - Session start: "Everything you see here fits. No rush. I'll let you know when we're wrapped up."
  - Time runs out while a committed video plays: a gentle "This one's the last one. Enjoy it." No pressure, no timer.
- Both are hidden completely while a video is fullscreen (mount them on `<body>` in a Shadow DOM host; fullscreen only renders the fullscreen element, so they vanish on their own).

### 5.5 Ending

- The session ends at the **first natural stopping point** once time is up:
  - the committed video finishes, or
  - you're not watching anything (browsing, or a video ended or was closed), or
  - you press **I'm done** (any time).
- If you're browsing with time left but nothing at all can fit (under 1 minute left), the session ends too.
- Edge cases (owner's calls):
  - **Pausing after time's up:** pausing the committed video for more than 2 minutes counts as a natural stopping point, and the session ends.
  - **Clicking to another video after time's up** (a card, link, or sidebar item) counts as a stopping point: nothing fits anymore.
  - **Several tabs:** the session ends when the **last** committed video in any tab finishes. Tabs that are only browsing meanwhile show nothing that fits, then all get the End screen together.
  - **Live streams:** allowed, but they have no natural end, so **the end time is their stopping point**. When one starts, the helper says once, "Live streams wrap up at 9:30 PM" (no countdown). At the end time the session ends. This is the only case where something stops mid-play.
  - **Closing every YouTube tab or the browser:** the session keeps running on its own clock and ends at its end time even with no tab open (background alarm). Cooldown counts from that moment. Coming back later shows "That's a wrap!" once, then the Cooldown screen. Closing tabs never ends a session early or skips the cooldown.
  - **Rewinding or looping** (builder's call): YouTube's loop option is turned off during a session, and as a safety ceiling a committed video gets at most its remaining length at time-up plus 10 minutes, so scrubbing back can't hold a session open forever.
- If the browser is in fullscreen at that moment, exit fullscreen first.
- The **End screen** shows in every YouTube tab of that session: confetti on spinning starburst rays, "That's a wrap!", "You stopped right when you said you would. Nice work.", the **Next up** plan if one was given, a **Close tab now** button, and "Closing on its own in 15s" (auto-close is a setting).
- No fun fact.

### 5.6 Cooldown

- After a session ends, a **cooldown** (setting) blocks new sessions. All settings, including the cooldown length, are copied into the session when it starts, so changing them mid-session or mid-cooldown can't shorten anything (builder's call, consistent with "changes apply to the next session").
- Any YouTube page during cooldown shows the **Cooldown screen**: "YouTube is napping", when the next session opens and how long until then, "You said you'd: …", and a **Close tab** button.

### 5.7 Settings (the hold)

- Opening settings (options page, or from the popup) shows the **Hold screen**: a big 3D arcade-style button. Hold it for **60 seconds** continuously. Letting go, moving the pointer off it, or switching tabs resets it to zero.
- While holding: the button stays pressed in and strains slightly, a ring fills, a countdown shows, and the skeptical mascot's bubble cycles nudges ("Is this about changing a setting, or about watching one more video?").
- **First run** (right after install) skips the hold so initial setup is easy.
- Settings, with defaults (defaults are the builder's calls, see §8):
  - Default session length: 30 min
  - Maximum session length: 2 hr
  - Cooldown between sessions: 60 min
  - Pausing a video pauses the clock (For-a-while mode): on
  - Close the tab automatically when a session ends: on
- **Changes apply to the next session**, never the current session or the current cooldown.
- Shorts blocking, autoplay off, and hiding end-screen suggestions are always on (not settings).
- Leaving the settings page relocks it.

### 5.8 Toolbar popup

- Shows status (no session / session until 9:30 PM / cooldown until 10:30 PM) and a **Settings** button that opens the Hold screen. It cannot start or extend sessions.

## 6. Look and feel

- Follow the mockup artifact exactly; it's the approved reference: https://claude.ai/artifact/6GPwrm3MCXQrpAP5yAPuMe
- **Palette:** cream `#F6EBD3`, tomato `#C8402A`, teal `#1F6F6B`, mustard `#E9B33B`, ink `#23201C`, plus off-white `#FFFDF6`.
- **Type:** Bowlby One for headlines, Fredoka for everything else. Bundle both (SIL OFL) inside the extension; no font requests to Google.
- **Shapes:** thick ink outlines, rounded corners, chunky offset shadows, a subtle dot texture on backgrounds.
- **Mascot:** an original anthropomorphized twin-bell alarm clock in a flat-color, 1950s-cartoon style (clock hands as eyebrows, rubber-hose limbs, white gloves, yellow shoes). One transparent PNG per screen, in `design/character/poses/`: `wave` (start), `peek` (helper), `bow` (end), `sleep` (cooldown), `skeptical` (settings), `shrug` (doesn't fit). New art comes from Codex.
- **Motion:** polished and bouncy throughout, but the **mascot only moves on entrances and exits** (no idle loops). Cards pop in, bubbles pop, the pill rises, the end screen has confetti and slowly spinning rays and a stamped title, buttons lift on hover and press in on click, the settings button depresses in 3D. Everything respects `prefers-reduced-motion`.
- Any new or changed screen gets mocked up in the artifact and approved first. The settings form after unlocking is now mocked up. Still to mock up before their build steps, each needing the owner's approval: the toolbar popup, first-run setup, the "this one's the last one" helper moment, and the extension icon. The build plan orders work so these come after the approved screens, with an approval stop before each.

## 7. Technical design (decided parts)

- **Stack:** TypeScript, WXT (MV3, Chrome build; keeps Firefox easy later), plain TS + CSS for UI (no framework needed for a handful of screens unless the builder finds one clearly helps).
- **Content scripts:**
  - ISOLATED world at `document_start`: page CSS, gate, tile filtering, watch-page checks, overlays, session logic.
  - MAIN world at `document_start`: a **passive** observer of `ytInitialData` and `/youtubei/v1/(browse|search|next|player)` responses that builds a `videoId → seconds` map and reports watch-page `videoDetails.lengthSeconds` / live flags. It never modifies YouTube's data. Communicates via `window.postMessage` with a source tag.
- **CSS-first:** toggle `data-eoc-*` attributes on `<html>` so Shorts, end screens, the autoplay toggle, unknown-length tiles, and the gate are hidden before JS runs.
- **Video lengths:** primary from DOM badges (`yt-thumbnail-badge-view-model .ytBadgeShapeText`, legacy `ytd-thumbnail-overlay-time-status-renderer`), supplemented by the MAIN-world map keyed by video ID. Watch page uses `lengthSeconds` from the player data, falling back to `video.duration`; skip while an ad is showing.
- **All selectors and JSON paths live in one module** (old and new names side by side, optional chaining everywhere).
- **Change detection:** one `MutationObserver` on `ytd-app`, throttled (~50–100 ms / rAF); `yt-navigate-finish` and `popstate`; a `WeakMap` of processed tiles re-checked when a tile's link changes (YouTube recycles nodes); re-filter when time left crosses a tile's length.
- **UI:** a Shadow DOM host on `<body>` with `position: fixed` and max z-index; gate and end screens call `exitFullscreen()`; capture-phase key handling blocks YouTube shortcuts only while a blocking screen is up.
- **Background service worker:** an alarm that ends the session at its end time when no YouTube tab is open, closing tabs on request, toolbar badge if useful.
- **Testing:** Vitest unit tests for duration parsing, the JSON walker, and session/clock math. Playwright e2e loading the unpacked build against saved YouTube HTML/JSON fixtures in CI, plus a manual or nightly smoke test on live youtube.com.
- **CI:** GitHub Actions for lint, typecheck, unit tests, build, e2e on every PR; on a version tag, build the Chrome zip and attach it to a GitHub release.
- **Repo:** MIT `LICENSE`, `README` with screenshots and "load unpacked" install steps, `PRIVACY.md` ("no data leaves your browser"), `CONTRIBUTING.md`, GitHub issue forms, `_locales/en` from day one, credit to Hank Green's video and the commenters as inspiration with a clear "not affiliated" line.

### 7.1 Installing (for non-technical people)

- The README opens with one big, obvious **Download End O'Clock** link pointing at the latest release's zip (a stable "latest" URL), before any developer content.
- Directly under it: numbered, illustrated steps (a screenshot or short GIF for each), with a tab or section per browser where steps differ (Chrome, Edge, Brave, Opera, Vivaldi, Arc): unzip, open the extensions page (the exact address to paste, e.g. `chrome://extensions`, `edge://extensions`), turn on Developer mode, Load unpacked, pick the folder, pin the clock icon.
- Plain language: no "manifest", "build", "clone" or "npm" anywhere in the install section. A short "Is this safe?" note: open source, no data collected, link to PRIVACY.md.
- Known rough edges stated plainly: unpacked extensions don't auto-update (how to update: download the new zip and replace the folder); some browsers show a "developer mode extensions" reminder.
- After install, first-run setup opens automatically so people know it worked.
- Developer setup (Node, WXT, tests) lives lower in the README or in CONTRIBUTING.md.

## 8. Left to the builder

- Exact selectors, JSON paths, throttle timings, and code structure.
- Animation timings and easing (match the mockup's feel).
- Small copy polish, as long as it stays warm and pressure-free.
- Default values in §7 settings (proposed above; owner can change).
- How "Save to Watch Later" is implemented; if it can't be done reliably, replace it with the closest reliable option and flag it.
- Whether to use a toolbar badge.
- Whether to publish to the Chrome Web Store (needs the owner's developer account) is a later decision; v1 ships as a GitHub release.

# End O'Clock Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build End O'Clock, an MIT-licensed Chromium (MV3) extension that makes every YouTube visit start by choosing an ending, shows only videos that fit, removes Shorts and autoplay, ends sessions gracefully with a celebration, enforces a cooldown, and gates settings behind a 60-second hold; publish it as a public GitHub repo with a release zip.

**Architecture:** WXT + TypeScript. Pure, unit-tested logic in `src/core/` (time, settings, session state machine, YouTube JSON walker). An ISOLATED-world content script at `document_start` owns CSS-first hiding, tile filtering, the watch-page monitor and all UI (Shadow DOM host on `<body>`). A passive MAIN-world content script observes YouTube's own data and posts `videoId → seconds` and watch-page details over `window.postMessage`. `chrome.storage.local` is the single source of truth; the background worker ends sessions by alarm when no tab is open and closes tabs on request.

**Tech Stack:** WXT (latest 0.x), TypeScript (strict), Vite `?inline` CSS imports, Vitest + happy-dom + `wxt/testing` fakeBrowser, Playwright (Chromium, persistent context with the unpacked build), ESLint (typescript-eslint flat config), GitHub Actions, `gh` CLI.

**Spec:** `docs/superpowers/specs/2026-11-18-end-oclock-design.md` (approved). Visual source of truth: https://claude.ai/artifact/6GPwrm3MCXQrpAP5yAPuMe. Project rules: `CLAUDE.md`.

## Global Constraints

- Manifest V3; content scripts match only `https://www.youtube.com/*`; permissions exactly `storage`, `alarms`. No remote code, no network requests of our own, no analytics.
- One build must load in Chrome, Edge, Brave, Opera, Vivaldi, Arc. No Chrome-only APIs beyond `storage`, `alarms`, `tabs.remove`, `runtime`.
- License MIT. Never copy GPL code (SponsorBlock, DeArrow, BlockTube, RYD, ImprovedTube). Selectors from `gijsdev/ublock-hide-yt-shorts` (MIT) may be reused with attribution in `src/youtube/selectors.ts` and README.
- Never use the word "Clockwise" in product name, UI copy, or branding. README credits Hank Green's video and commenters as inspiration with a "not affiliated" line.
- Mockup first: no screen, overlay, icon, or mascot pose gets built until it exists in the mockup artifact and the owner approved it. Approved so far: Start, Helper + pill, Session end, Cooldown, Hold-to-unlock, Settings form, Doesn't fit, style tile. New character art comes from Codex (`codex exec`), never hand-drawn.
- No countdown anywhere in the UI. Never cut off a video mid-play, except live streams at the end time (spec §5.5).
- Palette: cream `#F6EBD3`, tomato `#C8402A`, teal `#1F6F6B`, mustard `#E9B33B`, ink `#23201C`, off-white `#FFFDF6`. Fonts Bowlby One (headlines) and Fredoka (everything else), bundled under `public/fonts/` (SIL OFL, license files included).
- Mascot moves only on entrances and exits. All motion off under `prefers-reduced-motion: reduce`.
- Settings defaults: usual length 30 min, longest allowed 120 min, cooldown 60 min, pause-stops-clock on, close-tab-on-end on. Settings are copied into the session at Start.
- Constants: after-time-up pause stop = 2 min; "nothing fits" threshold = 60 s; safety ceiling = remaining length at time-up + 10 min; end-screen auto-close = 15 s; hold-to-unlock = 60 s; tab heartbeat every 2 s, stale after 6 s.
- All user-facing strings in `public/_locales/en/messages.json`, read through `t()`.

## Review Focus

1. **Laptop sleep / long gaps:** a tab wakes hours after the end time. Expect: no crash, session ends at once (End screen once, then cooldown counted from the real end). Test in Task 4 (`ends immediately when woken far past end`).
2. **Recycled tile nodes:** YouTube reuses a tile element for a different video. Expect it to be re-judged by its new length, not its cached one. Test in Task 6 (`re-judges a tile whose link changed`).
3. **Ads before a video:** the `<video>` length during a pre-roll ad is the ad's. Expect no commit or doesn't-fit decision while `.ad-showing` is present. Test in Task 11 (`ignores ad playback`).
4. **"Until" times across midnight:** at 11:00 PM choosing 12:30 AM. Expect tomorrow 12:30 AM (90 min), and rejection if over the longest allowed. Test in Task 10 (`until time after midnight`).
5. **Extension reloaded while YouTube is open:** `chrome.storage` calls throw "Extension context invalidated". Expect the old content script to stop quietly (no error loop) and leave the page usable. Test in Task 3 (`safeStorage stops after invalidation`).

---

## File structure

```
wxt.config.ts  package.json  tsconfig.json  vitest.config.ts  playwright.config.ts  eslint.config.js
LICENSE  README.md  PRIVACY.md  CONTRIBUTING.md  .gitignore
.github/workflows/ci.yml  .github/workflows/release.yml  .github/ISSUE_TEMPLATE/{bug.yml,feature.yml}
public/_locales/en/messages.json  public/fonts/*  public/mascot/*.png  public/icon/{16,32,48,128}.png
src/core/time.ts          parse/format durations and clock times
src/core/settings.ts      Settings type, DEFAULTS, clamp
src/core/session.ts       Session model + pure state machine
src/core/ytdata.ts        walk YouTube JSON → durations / watch details
src/shared/storage.ts     typed storage items, safeStorage, watchers
src/shared/i18n.ts        t()
src/youtube/selectors.ts  every selector / JSON path, old+new names
src/youtube/tiles.ts      find tiles, read length/kind, apply verdicts
src/youtube/page.css      CSS-first hiding keyed on html[data-eoc-*]
src/youtube/page-flags.ts set html data attributes; shorts redirect
src/youtube/bridge.ts     postMessage protocol (both worlds)
src/youtube/watch.ts      watch-page monitor (commit, pause, loop, ads)
src/ui/host.ts            Shadow DOM host, mount/unmount screens, key blocking
src/ui/theme.css          tokens, fonts, buttons, animations
src/ui/screens/{start,end,cooldown,doesnt-fit}.ts
src/ui/{pill,helper,confetti}.ts
src/entrypoints/youtube.content/index.ts   ISOLATED orchestrator
src/entrypoints/youtube-main.content.ts    MAIN-world observer
src/entrypoints/background.ts
src/entrypoints/options/{index.html,main.ts,options.css}
src/entrypoints/popup/{index.html,main.ts,popup.css}
tests/unit/*.test.ts   tests/e2e/*.spec.ts   tests/e2e/fixtures/*
docs/smoke-test.md
```

---

### Task 1: Repo scaffold, tooling, CI

**Files:**
- Create: `package.json`, `wxt.config.ts`, `tsconfig.json`, `vitest.config.ts`, `eslint.config.js`, `.gitignore`, `LICENSE`, `.github/workflows/ci.yml`, `public/_locales/en/messages.json`, `src/entrypoints/background.ts` (empty `defineBackground(() => {})`), `tests/unit/smoke.test.ts`

**Interfaces:**
- Produces: npm scripts `dev`, `build` (`wxt build`), `zip` (`wxt zip`), `test` (`vitest run`), `test:e2e` (`playwright test`), `lint` (`eslint .`), `typecheck` (`tsc --noEmit`, after `wxt prepare`).

- [ ] **Step 1:** `git init -b main` in the project root; keep existing `CLAUDE.md`, `docs/`, `design/`.
- [ ] **Step 2:** Scaffold with WXT (vanilla TS template), `srcDir: 'src'`. `wxt.config.ts` manifest: `name: '__MSG_extName__'`, `description: '__MSG_extDescription__'`, `default_locale: 'en'`, `permissions: ['storage','alarms']`, `web_accessible_resources: [{ resources: ['fonts/*','mascot/*'], matches: ['https://www.youtube.com/*'] }]`. Messages: `extName` = "End O'Clock", `extDescription` = "Pick an ending before you watch. Only see videos that fit. No Shorts, no autoplay, and a real stopping point."
- [ ] **Step 3:** Vitest with `WxtVitest()` plugin and `environment: 'happy-dom'`; strict TS; ESLint flat config with typescript-eslint recommended. `.gitignore`: `node_modules`, `.output`, `.wxt`, `test-results`, `playwright-report`.
- [ ] **Step 4:** `tests/unit/smoke.test.ts`: `expect(1 + 1).toBe(2)`.
- [ ] **Step 5:** Run `npm run lint && npm run typecheck && npm test && npm run build`. Expected: all pass; `.output/chrome-mv3/manifest.json` exists with only `storage` and `alarms` permissions.
- [ ] **Step 6:** `LICENSE` (MIT, year 2026, copyright holder: the repo owner's name as shown on their GitHub profile; ask if unsure). CI workflow on push/PR: Node 22, `npm ci`, lint, typecheck, test, build.
- [ ] **Step 7:** Commit `chore: scaffold WXT + TypeScript extension`.

### Task 2: Time utilities

**Files:** Create `src/core/time.ts`; Test `tests/unit/time.test.ts`

**Interfaces:**
- Produces: `parseLength(text: string): number | null` (seconds; accepts `m:ss`, `h:mm:ss`, surrounding whitespace incl. ` `; returns null for anything else such as "LIVE", "Mix", "12 videos"); `formatClock(ts: number, locale?: string): string` (e.g. "9:30 PM"); `formatLength(seconds: number): string` ("48 minutes", "1 hour 5 minutes"); `nextOccurrence(hhmm: string, now: number): number` (today if later than now, else tomorrow).

- [ ] **Step 1: Write failing tests:** `parseLength('3:15')===195`, `parseLength(' 1:02:03 ')===3723`, `parseLength('LIVE')===null`, `parseLength('12 videos')===null`, `parseLength('0:59')===59`; `nextOccurrence('00:30', <Nov 18 23:00 local>)` equals Nov 19 00:30 local; `nextOccurrence('23:30', <23:00>)` same day; `formatLength(2880)==='48 minutes'`.
- [ ] **Step 2:** `npm test -- time` → FAIL (module missing).
- [ ] **Step 3:** Implement in `src/core/time.ts` (regex `^(?:(\d+):)?([0-5]?\d):([0-5]\d)$` after trimming; `Intl.DateTimeFormat` with `hour:'numeric', minute:'2-digit'`).
- [ ] **Step 4:** `npm test -- time` → PASS.
- [ ] **Step 5:** Commit `feat(core): duration and clock helpers`.

### Task 3: Settings, storage, i18n

**Files:** Create `src/core/settings.ts`, `src/shared/storage.ts`, `src/shared/i18n.ts`; Test `tests/unit/storage.test.ts`

**Interfaces:**
- Produces:
  - `interface Settings { usualMinutes: number; maxMinutes: number; cooldownMinutes: number; pauseStopsClock: boolean; closeTabOnEnd: boolean }`, `DEFAULT_SETTINGS` (values from Global Constraints), `clampSettings(s: Settings): Settings` (usual 5–max step 5; max 15–240 step 15; cooldown 0–240 step 15).
  - `settingsItem`, `sessionItem` (`Session | null`, from Task 4), `firstRunDoneItem` (boolean) via WXT `storage.defineItem('local:…', { fallback })`.
  - `safeStorage<T>(fn: () => Promise<T>): Promise<T | undefined>` — on an error whose message includes "Extension context invalidated", sets an exported `contextAlive = false`, calls registered `onContextLost` callbacks once, and resolves undefined; other errors rethrow.
  - `t(key: string, ...subs: string[]): string` wrapping `browser.i18n.getMessage`.
- [ ] **Step 1: Failing tests** (fakeBrowser): settings round-trip; `clampSettings({...DEFAULT_SETTINGS, maxMinutes: 999}).maxMinutes===240`; `usualMinutes` clamped to ≤ `maxMinutes`; **`safeStorage stops after invalidation`**: a fn rejecting `new Error('Extension context invalidated.')` resolves undefined, `contextAlive===false`, the callback ran exactly once across two calls.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit `feat(core): settings, storage items, i18n helper`.

### Task 4: Session state machine

**Files:** Create `src/core/session.ts`; Test `tests/unit/session.test.ts`

**Interfaces:**
- Consumes: `Settings` (Task 3).
- Produces:
  ```ts
  type Mode = 'for' | 'until';
  interface Committed { videoId: string; live: boolean; playing: boolean; pausedSince: number | null;
                        remainingAtTimeUpMs: number | null; lastSeen: number }
  interface Session { id: string; mode: Mode; startedAt: number; budgetMs: number | null; untilAt: number | null;
    intention: string; rules: Settings; pausedMs: number; clockPausedSince: number | null;
    committed: Record<string, Committed>; // key = per-page tab key
    endedAt: number | null; endReason: EndReason | null; endSeen: boolean }
  type EndReason = 'done' | 'video-finished' | 'not-watching' | 'nothing-fits' | 'paused-after-time-up'
                 | 'moved-on' | 'live-end-time' | 'safety-ceiling' | 'no-tabs'
  type Phase = 'gate' | 'active' | 'end-screen' | 'cooldown'
  startSession(input: { mode: Mode; minutes?: number; untilAt?: number; intention: string }, settings: Settings, now: number): Session
  effectiveEnd(s: Session, now: number): number
  timeLeftMs(s: Session, now: number): number
  isTimeUp(s: Session, now: number): boolean
  liveCommitted(s: Session, now: number): Committed[]        // lastSeen within 6 s
  endCheck(s: Session, now: number): EndReason | null
  endSession(s: Session, reason: EndReason, now: number): Session   // idempotent: keeps first endedAt
  cooldownUntil(s: Session): number | null
  phaseOf(s: Session | null, now: number): Phase
  ```
- Rules to encode (spec §5.2, §5.5):
  - `effectiveEnd`: `until` → `untilAt`. `for` → `startedAt + budgetMs + pausedMs + (clockPausedSince ? now - clockPausedSince : 0)` only when `rules.pauseStopsClock`, else `startedAt + budgetMs`; always capped at `startedAt + rules.maxMinutes*60000`.
  - `endCheck` returns null before time is up unless `timeLeftMs < 60000` and no live committed video (→ `'nothing-fits'`). After time-up: no live committed → `'not-watching'`; any committed `live` → `'live-end-time'`; every live committed paused ≥ 120000 ms → `'paused-after-time-up'`; any committed past `endTime + remainingAtTimeUpMs + 600000` → `'safety-ceiling'`; otherwise null (wait for the last video).
  - `phaseOf`: null → gate; not ended → active; ended and `!endSeen` → end-screen; `now < cooldownUntil` → cooldown; else gate. `cooldownUntil = endedAt + rules.cooldownMinutes*60000`.
- [ ] **Step 1: Failing tests** (fixed `now`, `DEFAULT_SETTINGS`):
  - `for` 30 min: `timeLeftMs` at +10 min = 20 min; with `clockPausedSince` 5 min ago and pause-stops-clock on, end moves 5 min later; with it off, it doesn't.
  - pause can't pass max: budget 110 min + 30 min paused → `effectiveEnd === startedAt + 120 min`.
  - `until` ignores pauses.
  - `endCheck`: before time-up with 30 s left and nothing committed → `'nothing-fits'`; after time-up with one playing committed video → null; with two tabs, one finished (stale lastSeen) and one playing → null; committed paused 121 s after time-up → `'paused-after-time-up'`; live committed after time-up → `'live-end-time'`; past ceiling → `'safety-ceiling'`.
  - **`ends immediately when woken far past end`**: `now = untilAt + 5 h`, committed entry `lastSeen` 5 h old → `'not-watching'`; `endSession` then `phaseOf` → `end-screen` until `endSeen`, then `cooldown`, then `gate` after `endedAt + 60 min`.
  - `endSession` twice keeps the first `endedAt`; changing `settings` after start doesn't change `cooldownUntil` (rules copied).
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement as pure functions (no Date.now inside). **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit `feat(core): session state machine`.

### Task 5: YouTube JSON walker

**Files:** Create `src/core/ytdata.ts`; Test `tests/unit/ytdata.test.ts`, fixtures `tests/unit/fixtures/{browse-lockup.json,search-video-renderer.json,player.json}`

**Interfaces:**
- Produces: `collectLengths(json: unknown, into: Map<string, number>): void` — recursive walk; records `videoId → seconds` from `lockupViewModel` (`contentId` + thumbnail badge text), `videoRenderer`/`compactVideoRenderer` (`videoId` + `lengthText.simpleText` or `thumbnailOverlayTimeStatusRenderer.text`); skips ids with no parseable length. `readWatchDetails(json: unknown): { videoId: string; lengthSeconds: number | null; isLive: boolean } | null` from `videoDetails` (`isLive`/`isLiveContent && !lengthSeconds`).
- [ ] **Step 1:** Write small hand-made fixtures shaped like current responses (paths per research: `lockupViewModel.contentImage.thumbnailViewModel.overlays[].thumbnailBottomOverlayViewModel.badges[].thumbnailBadgeViewModel.text` and legacy `thumbnailOverlayTimeStatusRenderer.text.simpleText`). Failing tests: lockup id `abc` → 615 s; videoRenderer `def` → 3723 s; a Mix lockup (no time badge) absent; `readWatchDetails(player)` → `{ videoId:'xyz', lengthSeconds: 2880, isLive:false }`; live player → `isLive:true, lengthSeconds:null`; walker survives `null`, arrays, cycles-free deep nesting 50 levels.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement using `parseLength` (Task 2); every path via optional chaining; JSON paths constants live in `src/youtube/selectors.ts` (`YT_PATHS`) — create that file now with just `YT_PATHS`. **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit `feat(core): passive YouTube data walker`.

### Task 6: Tile detection and filtering

**Files:** Modify `src/youtube/selectors.ts` (add `SEL`); Create `src/youtube/tiles.ts`; Test `tests/unit/tiles.test.ts`

**Interfaces:**
- Consumes: `parseLength`, the `Map<string, number>` from Task 5/7.
- Produces:
  - `SEL.tile` (`ytd-rich-item-renderer, ytd-video-renderer, ytd-compact-video-renderer, ytd-grid-video-renderer, ytd-playlist-video-renderer, ytd-playlist-panel-video-renderer, yt-lockup-view-model, ytd-radio-renderer, ytd-playlist-renderer`), `SEL.badgeText` (`yt-thumbnail-badge-view-model .ytBadgeShapeText, .badge-shape-wiz__text, ytd-thumbnail-overlay-time-status-renderer #text, ytd-thumbnail-overlay-time-status-renderer`), `SEL.liveBadge`, `SEL.shortsLink` (`a[href^="/shorts/"]`).
  - `type TileKind = 'video' | 'live' | 'collection' | 'short'`; `readTile(el: Element, lengths: Map<string, number>): { videoId: string | null; kind: TileKind; seconds: number | null }` (badge first, then map by `v=` id from the tile's first `a[href*="watch?v="]`; collection = Mix/playlist markers or `list=` without a length).
  - `verdict(t, timeLeftMs): 'show' | 'hide'` — short → hide; live, collection → show; video with seconds → `seconds*1000 <= timeLeftMs`; unknown → hide.
  - `applyTiles(root: ParentNode, timeLeftMs: number, lengths: Map<string, number>): void` — outermost tiles only; sets `data-eoc-tile="show" | "hide"`; tracks each tile's last href in a `WeakMap` and re-reads when it changes.
- [ ] **Step 1: Failing tests** (happy-dom HTML snippets): a 3:15 tile shows with 10 min left, hides with 2 min left; a tile with no badge but id in map (615 s) hides with 5 min left; no badge and no map entry → hide; LIVE tile → show; Mix tile → show; shorts tile → hide; nested `yt-lockup-view-model` inside `ytd-rich-item-renderer` only marks the outer; **`re-judges a tile whose link changed`**: same element, href and badge swapped from 2:00 to 40:00 → flips to hide.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit `feat(youtube): tile length detection and fit filtering`.

### Task 7: MAIN-world observer and bridge

**Files:** Create `src/youtube/bridge.ts`, `src/entrypoints/youtube-main.content.ts`; Test `tests/unit/bridge.test.ts`

**Interfaces:**
- Consumes: `collectLengths`, `readWatchDetails` (Task 5).
- Produces:
  - `type BridgeMsg = { src: 'eoc'; kind: 'lengths'; entries: [string, number][] } | { src: 'eoc'; kind: 'watch'; details: WatchDetails }`
  - `postBridge(msg: BridgeMsg): void`, `onBridge(cb: (msg: BridgeMsg) => void): () => void` (accepts only `event.source === window` and `data.src === 'eoc'` with a valid `kind`).
  - MAIN script (`world: 'MAIN'`, `runAt: 'document_start'`): reads `window.ytInitialData` / `ytInitialPlayerResponse` when they appear (property setter trap that stores and returns the value unchanged), wraps `fetch` and `XMLHttpRequest` to `.clone()`/read responses for URLs matching `/youtubei/v1/(browse|search|next|player)` **without altering** them, listens for `yt-navigate-finish` (`detail.response.playerResponse`), and posts batches. Any exception inside our observer is caught and swallowed so YouTube is never affected.
- [ ] **Step 1: Failing tests:** `onBridge` ignores messages without `src:'eoc'`, with wrong `kind`, or from another source; delivers a valid `lengths` message; wrapped `fetch` returns a Response whose `.json()` equals the original (call the wrapper factory exported for test as `wrapFetch(orig, onJson)`).
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. **Step 4:** Run → PASS; `npm run build` → manifest lists a content script with `"world": "MAIN"`.
- [ ] **Step 5:** Commit `feat(youtube): passive MAIN-world data observer`.

### Task 8: CSS-first hiding and page flags

**Files:** Create `src/youtube/page.css`, `src/youtube/page-flags.ts`; Modify `src/youtube/selectors.ts`; Test `tests/unit/page-flags.test.ts`

**Interfaces:**
- Produces: `setFlags(flags: { gate: boolean; session: boolean }): void` (sets `html[data-eoc-gate]`, `html[data-eoc-session]`; `data-eoc-ext="1"` always); `shortsRedirect(url: string): string | null` (`/shorts/<id>` → `https://www.youtube.com/`, otherwise null).
- `page.css` (imported in the ISOLATED entry with `cssInjectionMode: 'manifest'`, so it applies before first paint):
  - `html[data-eoc-ext] …` always: Shorts selectors (from ublock-hide-yt-shorts, attributed in a comment: rich/reel shelves, `grid-shelf-view-model:has(ytm-shorts-lockup-view-model-v2)`, guide/mini-guide Shorts entries, `yt-tab-shape[tab-title="Shorts"]`, `ytm-shorts-lockup-view-model*`), end screens (`.html5-endscreen, .ytp-ce-element, .ytp-autonav-endscreen-countdown-overlay`), the autoplay toggle.
  - Default before JS: `html:not([data-eoc-session]) ytd-app { visibility: hidden }` (gate pre-hide; the gate overlay replaces it).
  - During a session: tiles hidden unless `[data-eoc-tile="show"]` (`html[data-eoc-session] :is(<tile list>):not([data-eoc-tile="show"]) { display: none !important }`).
- [ ] **Step 1: Failing tests:** `shortsRedirect('https://www.youtube.com/shorts/abc?x=1')` → home; `/watch?v=1` → null; `setFlags({gate:true,session:false})` sets/removes the right attributes.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. **Step 4:** Run → PASS. (Visual CSS behavior is verified in Task 17 e2e.)
- [ ] **Step 5:** Commit `feat(youtube): CSS-first hiding of Shorts, end screens and unchecked tiles`.

### Task 9: UI foundation (Shadow DOM, theme, assets)

**Files:** Create `src/ui/host.ts`, `src/ui/theme.css`; Add `public/fonts/` (Bowlby One, Fredoka woff2 + OFL.txt), `public/mascot/{wave,peek,bow,sleep,skeptical,shrug}.png` (copied from `design/character/poses/`, resized to 512×512 PNG); Test `tests/unit/host.test.ts`

**Interfaces:**
- Produces: `getHost(): ShadowRoot` (creates `<eoc-root>` on `document.body`, waits for body if needed, `position:fixed; inset:0; z-index:2147483647; pointer-events:none`, injects `theme.css?inline` with `@font-face` urls from `browser.runtime.getURL`); `showScreen(el: HTMLElement, opts: { blocking: boolean }): void` (one screen at a time; blocking screens exit fullscreen, block YouTube hotkeys via capture-phase `keydown` on `window` that `stopImmediatePropagation()` unless the target is inside our host, and pause all `<video>`); `clearScreen(): void`; `mascotUrl(pose: Pose): string`; `type Pose = 'wave'|'peek'|'bow'|'sleep'|'skeptical'|'shrug'`.
- `theme.css`: palette variables, `.eoc-card`, `.eoc-btn` (primary tomato / secondary off-white, ink 3px border, 4–5px offset shadow, hover lift, active press), `.eoc-bubble`, keyframes `eoc-pop`, `eoc-enter`, `eoc-bubble`, `eoc-rise`, `eoc-slidein`, dot texture, reduced-motion kill switch — values copied from the mockup artboards.
- [ ] **Step 1: Failing tests:** `getHost()` twice returns the same shadow root; `showScreen(a,{blocking:true})` then `showScreen(b,…)` leaves only `b`; a `keydown` 'k' dispatched on `document` while blocking is stopped (a document listener added by the test never fires), but a keydown inside the host reaches its input; `clearScreen()` restores key flow.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit `feat(ui): shadow DOM host, theme, fonts and mascot assets`.

### Task 10: Start screen (gate)

**Files:** Create `src/ui/screens/start.ts`; Test `tests/unit/start.test.ts`

**Interfaces:**
- Consumes: `getHost/showScreen/mascotUrl` (Task 9), `startSession`, `Settings`, `nextOccurrence`, `formatClock`.
- Produces: `computeEnd(choice: { mode:'for'; minutes:number } | { mode:'until'; hhmm:string }, settings: Settings, now: number): { ok: true; endAt: number } | { ok: false; reason: 'too-long' | 'too-short' }` (min 1 min; max `maxMinutes`); `renderStart(opts: { settings: Settings; onStart: (s: Session) => void; onClose: () => void }): HTMLElement` matching the Start artboard (wave pose, "When does this end?", tabs For a while / Until a time, chips 15/30/45/60 filtered to ≤ max, custom minutes, intention field, live "Ends at …", Start watching, "Never mind, close this tab").
- [ ] **Step 1: Failing tests:** **`until time after midnight`**: at 23:00, `{until,'00:30'}` → ok, end = next day 00:30; at 23:00, `{until,'02:00'}` with max 120 → `too-long`; `{for, 0}` → `too-short`; render: default chip equals `usualMinutes`; typing custom minutes deselects chips; clicking Start calls `onStart` with a Session whose `intention` is the field text.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement (copy from `t()`). **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit `feat(ui): start screen`.

### Task 11: Watch-page monitor

**Files:** Create `src/youtube/watch.ts`; Test `tests/unit/watch.test.ts`

**Interfaces:**
- Consumes: `WatchDetails` via bridge, `fits`-style check (`seconds*1000 <= timeLeftMs`), `SEL`.
- Produces: `createWatchMonitor(deps: { getTimeLeft(): number; isTimeUp(): boolean; onCommit(c: { videoId: string; live: boolean; remainingMs: number }): void; onDoesntFit(info: { videoId: string; seconds: number }): void; onMovedOn(): void; onPlayState(playing: boolean): void; onEnded(): void }): { handleDetails(d: WatchDetails): void; tick(): void; dispose(): void }`.
  - Decides once per `videoId` when not in an ad (`#movie_player.ad-showing` absent): already committed → nothing; time up → `onMovedOn()` + pause; live → commit live; remaining (`lengthSeconds` minus `currentTime`, fallback `video.duration`) fits → commit; else pause + `onDoesntFit`.
  - Each `tick`: forces `video.loop = false`, clicks `.ytp-autonav-toggle-button[aria-checked="true"]` once, reports play/pause changes (ignoring `waiting`/buffering), detects `ended`.
- [ ] **Step 1: Failing tests** (fake `<video>` + `#movie_player` in happy-dom): 10-min video with 30 min left → `onCommit`; 48-min video with 30 min left → `onDoesntFit` and video paused; **`ignores ad playback`**: with `.ad-showing`, a 15 s ad length never commits or rejects, decision happens after the class is removed using `lengthSeconds`; live → commit with `live:true`; time already up on a new video → `onMovedOn`; `loop` set true gets reset to false.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit `feat(youtube): watch-page monitor`.

### Task 12: End, cooldown, doesn't-fit screens, pill, helper

**Files:** Create `src/ui/screens/end.ts`, `src/ui/screens/cooldown.ts`, `src/ui/screens/doesnt-fit.ts`, `src/ui/pill.ts`, `src/ui/helper.ts`, `src/ui/confetti.ts`; Test `tests/unit/screens.test.ts`

**Interfaces:**
- Produces: `renderEnd(o: { intention: string; autoClose: boolean; onClose(): void }): HTMLElement` (bow pose, rays, confetti canvas, "That's a wrap!", optional Next up, Close tab now, "Closing on its own in 15s" when `autoClose`; calls `onClose` after 15 s); `renderCooldown(o: { until: number; intention: string; onClose(): void }): HTMLElement` (sleep pose; "opens at 10:30 PM, in 52 minutes", minutes-level only); `renderDoesntFit(o: { seconds: number; endAt: number; onSaveLater(): void; onShorter(): void })` (shrug pose); `mountPill(o: { endAt: number; onDone(): void }): void` / `unmountPill()` ("Done by 9:30 PM", no countdown); `showHelper(text: string): void` (peek pose, slide in, "Got it" slides it out); `startConfetti(canvas: HTMLCanvasElement): () => void` (no-op under reduced motion).
- Save to Watch Later (builder's call per spec §8): open YouTube's own save menu on the watch page if `SEL.saveButton` exists, else copy the video URL to the clipboard and say so; flag in the PR if neither is reliable.
- [ ] **Step 1: Failing tests:** end screen shows intention only when non-empty; auto-close fires `onClose` at 15 s (fake timers) and not when `autoClose:false`; cooldown text uses `formatClock`; pill text contains "Done by" and no digits-with-"left"; helper "Got it" removes it.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement to match the artboards. **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit `feat(ui): end, cooldown, doesn't-fit screens, pill and helper`.

### Task 13: Content-script orchestrator

**Files:** Create `src/entrypoints/youtube.content/index.ts`; Test `tests/unit/orchestrator.test.ts`

**Interfaces:**
- Consumes: everything above.
- Produces: `defineContentScript({ matches: ['https://www.youtube.com/*'], runAt: 'document_start', cssInjectionMode: 'manifest', main })`; exported `createOrchestrator(deps)` for tests.
- Behavior: per-page `tabKey = crypto.randomUUID()`; watches `sessionItem`/`settingsItem`; renders by `phaseOf`: gate → Start (on start: save session, show session-start helper once in this tab); active → `setFlags({session:true})`, pill, `applyTiles` on a throttled (100 ms, trailing) `MutationObserver` over `document` plus `yt-navigate-finish`/`popstate`, plus every 15 s; watch monitor callbacks write `committed[tabKey]` (heartbeat every 2 s while on a watch page with a committed video; removed on navigate away and `pagehide`); pause-stops-clock updates `clockPausedSince`/`pausedMs` when this tab's committed video pauses/plays; when time runs out while this tab's committed video plays, show helper "This one's the last one. Enjoy it."; live commit shows "Live streams wrap up at {time}"; every second (cheap) run `endCheck` and on a reason call `endSession` and save; end-screen → End (set `endSeen` true when shown; close tab via `browser.runtime.sendMessage({type:'closeTab'})` if `rules.closeTabOnEnd`); cooldown → Cooldown; "I'm done" → `endSession('done')`. `shortsRedirect` on every navigation. On `onContextLost` stop all observers and timers.
- [ ] **Step 1: Failing tests** with fakeBrowser + happy-dom: no session → Start shown and `data-eoc-gate` set; saving a session from another "tab" (direct storage write) hides Start and mounts the pill; `endedAt` written elsewhere → End shown, `endSeen` saved true, next render shows Cooldown; two orchestrators sharing storage: one with a playing committed video keeps the session open after time-up while the other browses.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. **Step 4:** Run → PASS; `npm run build` passes.
- [ ] **Step 5:** Commit `feat: YouTube content-script orchestrator`.

### Task 14: Background worker

**Files:** Modify `src/entrypoints/background.ts`; Test `tests/unit/background.test.ts`

**Interfaces:**
- Produces: on `runtime.onInstalled` (`reason==='install'`) open the options page; message `{type:'closeTab'}` → `tabs.remove(sender.tab.id)`; whenever the session changes, schedule alarm `eoc-end` at `effectiveEnd + 1000`; on alarm, if the session has no committed entry with `lastSeen` within 6 s and isn't ended, `endSession(s,'no-tabs', now)` — but use `endedAt = effectiveEnd` (not alarm time) so cooldown counts from the end time.
- [ ] **Step 1: Failing tests:** install opens options; alarm with no live tabs ends the session with `endedAt === effectiveEnd`; alarm with a fresh heartbeat does nothing; closeTab removes the sender tab.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit `feat: background alarm and tab closing`.

### Task 15: Options page — hold to unlock + settings form

**Files:** Create `src/entrypoints/options/{index.html,main.ts,options.css}`; Test `tests/unit/options.test.ts`

**Interfaces:**
- Consumes: `settingsItem`, `firstRunDoneItem`, `clampSettings`, `mascotUrl`.
- Produces: `createHold(button: HTMLButtonElement, opts: { ms: number; onUnlock(): void; onProgress(f: number): void }): () => void` (pointerdown starts; pointerup/leave/cancel, `visibilitychange` hidden, and `blur` reset to 0).
- Hold screen per the Hold artboard: 3D arcade button (rests on a darker-mustard side; pressed sinks and strains), filling ring, m:ss left until unlock plus "N of 60 seconds" as in the artboard (this is the unlock timer, not a session countdown), skeptical pose, nudges rotating at 0/10/25/40/55 s. Form per the Settings artboard: three steppers, two switches, "Always on" box, "Starts with your next session", Save and lock / Lock without saving. Leaving the page (`visibilitychange` hidden) relocks. If `firstRunDone` is false, show the form directly (first-run screen arrives in Task 16b) and set it true on save.
- [ ] **Step 1: Failing tests** (fake timers): holding 59.9 s doesn't unlock, 60 s does; releasing at 30 s resets progress to 0; `visibilitychange` hidden mid-hold resets; first run skips the hold; Save writes clamped settings.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit `feat: hold-to-unlock options page`.

### Task 16: Remaining mockups — STOP for owner approval

**Files:** Mockup artifact only (https://claude.ai/artifact/6GPwrm3MCXQrpAP5yAPuMe); `design/icon/` for Codex output.

- [ ] **Step 1:** Generate the toolbar icon with Codex from `design/character/mascot-a-flat-transparent.png`: the mascot's own face (owner's call), i.e. the same character's clock face with its eyes, hand-eyebrows, nose and grin, red bells and handle on top, no body; flat colors, bold outline, transparent background, simplified enough to read at 16 px → `design/icon/icon-1024.png`.
- [ ] **Step 2:** Add artboards: toolbar popup (three states: no session / "Done by 9:30 PM" / "Napping until 10:30 PM", Settings button), first-run welcome (wave pose, one-paragraph explanation, the settings form, "Pin End O'Clock to your toolbar" hint), "This one's the last one" helper, live-stream helper note, and the icon at 16/32/48/128.
- [ ] **Step 3:** **Stop. Ask the owner to approve these artboards. Do not start Task 16b or 17 until approved;** apply requested changes and re-ask.

### Task 16b: Popup, first-run, icons (after approval)

**Files:** Create `src/entrypoints/popup/{index.html,main.ts,popup.css}`; Modify options first-run branch; Add `public/icon/{16,32,48,128}.png`; Test `tests/unit/popup.test.ts`

- [ ] **Step 1: Failing tests:** popup shows the right line for each `phaseOf` state; Settings button calls `browser.runtime.openOptionsPage`; popup has no control that starts or extends a session.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement to the approved artboards; wire icons in `wxt.config.ts`. **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit `feat: popup, first-run welcome and icons`.

### Task 17: End-to-end tests with fixtures

**Files:** Create `playwright.config.ts`, `tests/e2e/fixtures/{home.html,watch.html,clip.mp4}`, `tests/e2e/extension.ts` (fixture: `chromium.launchPersistentContext('', { headless: false/new-headless, args: ['--disable-extensions-except=…','--load-extension=…'] })`), `tests/e2e/flows.spec.ts`; Modify `.github/workflows/ci.yml` (build, `npx playwright install --with-deps chromium`, `xvfb-run npm run test:e2e`).

- Fixtures: `context.route('https://www.youtube.com/**')` serves local HTML built from current YouTube tile markup (home with a Shorts shelf, tiles of 3:15, 15:00, 48:00, a LIVE tile, a Mix tile; watch page with `#movie_player` and a 10-second local `clip.mp4`, plus `ytInitialPlayerResponse` inline).
- [ ] **Step 1: Write specs:** gate visible on first load and `ytd-app` hidden; start 20 min → 3:15 and 15:00 tiles visible, 48:00 hidden, Shorts shelf hidden, LIVE and Mix visible; `/shorts/abc` lands on home; watch page with a 48-min `lengthSeconds` shows Doesn't fit; "I'm done" shows End then, after reload, Cooldown; reduced-motion emulation shows End without animation errors.
- [ ] **Step 2:** `npm run build && npm run test:e2e` → PASS locally.
- [ ] **Step 3:** Write `docs/smoke-test.md`: a 10-minute manual checklist on live youtube.com (home, search, sidebar, channel page, playlist, a live stream, fullscreen hides pill/helper, two tabs, closing the browser mid-session) to run before each release.
- [ ] **Step 4:** Commit `test: Playwright e2e with YouTube fixtures`.

### Task 18: Docs and install experience

**Files:** Create `README.md`, `PRIVACY.md`, `CONTRIBUTING.md`, `.github/ISSUE_TEMPLATE/{bug.yml,feature.yml}`, `docs/images/*` (screenshots captured by a Playwright script `tests/e2e/screenshots.spec.ts` against fixtures).

- README order (spec §7.1): name + one-line pitch + hero screenshot; big **Download End O'Clock** link to `https://github.com/olshefskyc/end-oclock/releases/latest/download/end-oclock.zip`; numbered illustrated install steps with a per-browser address table (`chrome://extensions`, `edge://extensions`, `brave://extensions`, `opera://extensions`, `vivaldi://extensions`, Arc: `arc://extensions`); "Is this safe?"; how to update; known rough edges; what it does (with screenshots); credit to Hank Green's video and commenters + "not affiliated with Clockwise TV" (the only place the name appears, as attribution); MIT; developer section last. No "manifest/build/clone/npm" wording above the developer section.
- PRIVACY.md: no data collected, nothing leaves the browser, storage is local only, permissions explained one line each.
- [ ] **Step 1:** Write docs; generate screenshots (`npx playwright test screenshots`).
- [ ] **Step 2:** Verify: `grep -n -i -E "manifest|npm|clone|build" README.md` hits only below the "For developers" heading.
- [ ] **Step 3:** Commit `docs: README with install guide, privacy, contributing`.

### Task 19: Release workflow and public repo

**Files:** Create `.github/workflows/release.yml`.

- Release workflow on tag `v*`: `npm ci`, test, `wxt zip`, rename the Chrome zip to `end-oclock.zip`, create a GitHub release with it attached (so the README's `latest/download/end-oclock.zip` link works).
- [ ] **Step 1:** Write the workflow; commit `ci: release workflow`.
- [ ] **Step 2:** Confirm with the owner, then `gh repo create olshefskyc/end-oclock --public --source . --push --description "Pick an ending before you watch YouTube. Only see videos that fit."`.
- [ ] **Step 3:** Confirm CI is green on GitHub (`gh run list --limit 1`).
- [ ] **Step 4:** Bump `package.json` to `1.0.0`, tag `v1.0.0`, push the tag; verify `gh release view v1.0.0` lists `end-oclock.zip` and the README download link returns HTTP 302 → 200.
- [ ] **Step 5:** Run `docs/smoke-test.md` against the downloaded zip in Chrome; report results to the owner.

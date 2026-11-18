import type { Settings } from '../core/settings';
import { DEFAULT_SETTINGS } from '../core/settings';
import {
  endCheck, endSession, effectiveEnd, isTimeUp, phaseOf, pauseClock, resumeClock, timeLeftMs, cooldownUntil,
  naturalEndAt, HEARTBEAT_STALE_MS, type Session, type EndReason, type Committed,
} from '../core/session';
import { formatClock } from '../core/time';
import { sessionItem, settingsItem, safeStorage, onContextLost } from '../shared/storage';
import { t } from '../shared/i18n';
import { applyTiles, hideShortsChips } from './tiles';
import { setFlags, markOff, shortsRedirect } from './page-flags';
import { onBridge } from './bridge';
import { createWatchMonitor } from './watch';
import { getHost, showScreen, clearScreen } from '../ui/host';
import { renderStart } from '../ui/screens/start';
import { renderEnd } from '../ui/screens/end';
import { renderCooldown } from '../ui/screens/cooldown';
import { renderDoesntFit, setDoesntFitNote } from '../ui/screens/doesnt-fit';
import { mountPill, unmountPill } from '../ui/pill';
import { showHelper, hideHelper } from '../ui/helper';

export interface OrchestratorDeps {
  now: () => number;
  /** Random per-page key that identifies this tab's committed video in shared storage. */
  tabKey: string;
  closeTab: () => void;
  navigate: (url: string) => void;
}

type ScreenKey = 'start' | 'end' | 'cooldown' | 'doesnt-fit' | null;

const HEARTBEAT_MS = 2_000;
const TILE_REFRESH_MS = 2_000;

export function createOrchestrator(deps: OrchestratorDeps) {
  const { now, tabKey } = deps;
  let session: Session | null = null;
  let settings: Settings = DEFAULT_SETTINGS;
  let screen: ScreenKey = null;
  /** Session ids this tab was part of while active: it shows their End screen even if another tab saw it first. */
  const activeHere = new Set<string>();
  const endDismissed = new Set<string>();
  const startHelperShown = new Set<string>();
  const lastOneShown = new Set<string>();
  let startedHere: string | null = null;
  let lastHeartbeat = 0;
  let lastTiles = 0;
  let lastTickAt = now();
  let tileTimer: ReturnType<typeof setTimeout> | undefined;
  /** This tab's own committed video, kept locally so the heartbeat can always (re)write it. */
  let myEntry: Committed | null = null;
  let stopped = false;
  const lengths = new Map<string, number>();
  const cleanups: Array<() => void> = [];

  /**
   * Read-modify-write the shared session; ignores writes for a session that was replaced meanwhile.
   * Writes from this tab are queued so two of them never interleave and overwrite each other.
   */
  let queue: Promise<void> = Promise.resolve();
  function mutate(fn: (s: Session) => Session): Promise<void> {
    const run = async () => {
      const latest = await safeStorage(() => sessionItem.getValue());
      if (!latest || !session || latest.id !== session.id) return;
      const next = fn(latest);
      if (next === latest) return;
      session = next;
      await safeStorage(() => sessionItem.setValue(next));
    };
    queue = queue.then(run, run);
    return queue;
  }

  const endNow = (reason: EndReason) => mutate((s) => endSession(s, reason, now()));

  const monitor = createWatchMonitor({
    getTimeLeft: () => (session ? timeLeftMs(session, now()) : 0),
    isTimeUp: () => (session ? isTimeUp(session, now()) : true),
    onCommit: ({ videoId, live }) => {
      const at = now();
      lastHeartbeat = at;
      const entry: Committed = { videoId, live, playing: true, pausedSince: null, remainingAtTimeUpMs: null, lastSeen: at };
      myEntry = entry;
      void mutate((s) => ({ ...s, committed: { ...s.committed, [tabKey]: entry } }));
      if (live && session) showHelper(t('helperLive', formatClock(effectiveEnd(session, at))));
    },
    onDoesntFit: ({ seconds }) => {
      if (!session) return;
      const el = renderDoesntFit({
        seconds,
        endAt: effectiveEnd(session, now()),
        onSaveLater: () => {
          void navigator.clipboard?.writeText(location.href).catch(() => {});
          setDoesntFitNote(el, t('saveLaterCopied'));
        },
        onShorter: () => deps.navigate('https://www.youtube.com/'),
      });
      screen = 'doesnt-fit';
      showScreen(el, { blocking: true });
    },
    onMovedOn: () => void endNow('moved-on'),
    onPlayState: (playing) => {
      const at = now();
      if (!myEntry) return;
      myEntry = { ...myEntry, playing, pausedSince: playing ? null : at, lastSeen: at };
      const entry = myEntry;
      void mutate((s) => {
        let next: Session = {
          ...s,
          committed: { ...s.committed, [tabKey]: { ...entry, remainingAtTimeUpMs: s.committed[tabKey]?.remainingAtTimeUpMs ?? null } },
        };
        if (s.mode === 'for' && s.rules.pauseStopsClock && !isTimeUp(s, at)) {
          next = playing ? resumeClock(next, at) : pauseClock(next, at, tabKey);
        }
        return next;
      });
    },
    onEnded: () => void releaseCommitted(),
    onLeave: () => void releaseCommitted(),
  });

  function releaseCommitted(): Promise<void> {
    const at = now();
    myEntry = null;
    return mutate((s) => {
      if (!s.committed[tabKey]) return s;
      const rest = { ...s.committed };
      delete rest[tabKey];
      return resumeClock({ ...s, committed: rest }, at);
    });
  }

  function showStartScreen(): void {
    if (screen === 'start') return;
    screen = 'start';
    showScreen(renderStart({
      settings,
      now,
      onStart: (s) => {
        startedHere = s.id;
        session = s;
        void safeStorage(() => sessionItem.setValue(s)).then(() => render());
      },
      onClose: () => deps.closeTab(),
    }), { blocking: true });
  }

  function render(): void {
    if (stopped) return;
    const at = now();
    const s = session;
    const phase = phaseOf(s, at);

    // A tab that took part in a session (or nobody has seen its ending yet) shows the End screen.
    const showEnd = s != null && s.endedAt != null && !endDismissed.has(s.id) && (!s.endSeen || activeHere.has(s.id) || screen === 'end');

    if (phase === 'active' && s) {
      activeHere.add(s.id);
      setFlags({ gate: false, session: true });
      if (screen !== 'doesnt-fit') {
        if (screen) clearScreen();
        screen = null;
      }
      mountPill({ endAt: effectiveEnd(s, at), onDone: () => void endNow('done') });
      if (startedHere === s.id && !startHelperShown.has(s.id)) {
        startHelperShown.add(s.id);
        showHelper(t('helperStart'));
      }
      refreshTiles(true);
      return;
    }

    unmountPill();
    hideHelper(true);
    setFlags({ gate: true, session: false });

    if (showEnd && s) {
      if (screen !== 'end') {
        screen = 'end';
        const dismiss = () => { endDismissed.add(s.id); screen = null; render(); };
        showScreen(renderEnd({
          intention: s.intention,
          autoClose: s.rules.closeTabOnEnd,
          onClose: () => { dismiss(); deps.closeTab(); },
          onDone: dismiss,
        }), { blocking: true });
        if (!s.endSeen) void mutate((x) => ({ ...x, endSeen: true }));
      }
      return;
    }

    if (phase === 'cooldown' && s) {
      if (screen !== 'cooldown') {
        screen = 'cooldown';
        showScreen(renderCooldown({ until: cooldownUntil(s)!, now, intention: s.intention, onClose: () => deps.closeTab() }), { blocking: true });
      }
      return;
    }

    showStartScreen();
  }

  function refreshTiles(force = false): void {
    if (!session || phaseOf(session, now()) !== 'active') return;
    const at = now();
    if (!force && at - lastTiles < 150) {
      // Throttled: make sure a trailing pass still runs so a changed tile never lingers.
      tileTimer ??= setTimeout(() => { tileTimer = undefined; refreshTiles(true); }, 150);
      return;
    }
    lastTiles = at;
    applyTiles(document, timeLeftMs(session, at), lengths);
    hideShortsChips(document);
  }

  async function tick(): Promise<void> {
    if (stopped) return;
    const redirect = shortsRedirect(location.href);
    if (redirect) { deps.navigate(redirect); return; }
    const s = session;
    const previousTick = lastTickAt;
    lastTickAt = now();
    if (!s || phaseOf(s, now()) !== 'active') return;
    const at = now();
    getHost();
    if (screen === 'doesnt-fit' && !location.pathname.startsWith('/watch')) { clearScreen(); screen = null; }
    monitor.tick();
    mountPill({ endAt: effectiveEnd(s, at), onDone: () => void endNow('done') });
    if (at - lastTiles >= TILE_REFRESH_MS) refreshTiles(true);

    const mine = myEntry;
    if (mine && monitor.committed()) {
      const timeUp = isTimeUp(s, at);
      const stored = s.committed[tabKey];
      const needsRemaining = timeUp && stored?.remainingAtTimeUpMs == null;
      if (!stored || needsRemaining || at - lastHeartbeat >= HEARTBEAT_MS) {
        lastHeartbeat = at;
        const remaining = timeUp ? monitor.remainingMs() : null; // null during ads: try again next tick
        await mutate((x) => {
          const c = x.committed[tabKey];
          // Upsert: if another tab's stale write dropped our entry, put it back.
          const entry: Committed = { ...(c ?? mine), playing: mine.playing, pausedSince: mine.pausedSince, lastSeen: at,
            remainingAtTimeUpMs: c?.remainingAtTimeUpMs ?? remaining };
          return { ...x, committed: { ...x.committed, [tabKey]: entry } };
        });
      }
      if (timeUp && mine.playing && !mine.live && !lastOneShown.has(s.id)) {
        lastOneShown.add(s.id);
        showHelper(t('helperLastOne'));
      }
    }

    const current = session;
    if (current) {
      const reason = endCheck(current, at);
      if (reason) await mutate((x) => endSession(x, reason, at, naturalEndAt(x, reason, at, previousTick)));
    }
  }

  function stop(): void {
    stopped = true;
    for (const c of cleanups.splice(0)) c();
    monitor.dispose();
  }

  async function start(): Promise<void> {
    // Listen right away: YouTube's inline page data arrives while we're still reading storage.
    cleanups.push(onBridge((msg) => {
      if (msg.kind === 'lengths') {
        for (const [id, secs] of msg.entries) lengths.set(id, secs);
        refreshTiles();
      } else monitor.handleDetails(msg.details);
    }));
    onContextLost(() => {
      stop();
      clearScreen();
      unmountPill();
      hideHelper(true);
      markOff();
    });
    settings = (await safeStorage(() => settingsItem.getValue())) ?? DEFAULT_SETTINGS;
    session = (await safeStorage(() => sessionItem.getValue())) ?? null;
    render();

    cleanups.push(sessionItem.watch((v) => {
      // An ending is final: if another tab's stale write would un-end this session, write the ending back.
      if (session?.endedAt != null && v && v.id === session.id && v.endedAt == null) {
        const kept: Session = { ...v, endedAt: session.endedAt, endReason: session.endReason, endSeen: v.endSeen || session.endSeen,
          committed: {}, clockPausedSince: null, clockPausedBy: null };
        session = kept;
        void safeStorage(() => sessionItem.setValue(kept));
        render();
        return;
      }
      session = v;
      render();
    }));
    cleanups.push(settingsItem.watch((v) => { settings = v ?? DEFAULT_SETTINGS; }));

    const observer = new MutationObserver(() => refreshTiles());
    observer.observe(document.documentElement, {
      childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['href'],
    });
    cleanups.push(() => clearTimeout(tileTimer));
    // A paused video only stops the clock while its tab is in front.
    const onVisibility = () => {
      const s = session;
      if (!s || !myEntry || myEntry.playing || s.mode !== 'for' || !s.rules.pauseStopsClock) return;
      const at = now();
      if (document.visibilityState === 'hidden') void mutate((x) => (x.clockPausedBy === tabKey ? resumeClock(x, at) : x));
      else if (!isTimeUp(s, at)) void mutate((x) => pauseClock(x, at, tabKey));
    };
    document.addEventListener('visibilitychange', onVisibility);
    cleanups.push(() => document.removeEventListener('visibilitychange', onVisibility));
    cleanups.push(() => observer.disconnect());

    const onNav = () => { refreshTiles(true); void tick(); };
    document.addEventListener('yt-navigate-finish', onNav);
    window.addEventListener('popstate', onNav);
    cleanups.push(() => document.removeEventListener('yt-navigate-finish', onNav));
    cleanups.push(() => window.removeEventListener('popstate', onNav));

    const onHide = () => {
      // Best effort: a closing tab stops holding the session open (stale heartbeats also cover this).
      if (session?.committed[tabKey]) void releaseCommitted();
    };
    window.addEventListener('pagehide', onHide);
    cleanups.push(() => window.removeEventListener('pagehide', onHide));

    // Re-render once a minute so cooldown/gate transitions happen without storage changes.
    let lastPhase = phaseOf(session, now());
    const timer = setInterval(() => {
      tick().catch((e: unknown) => console.error('[eoc] tick failed', e));
      const p = phaseOf(session, now());
      if (p !== lastPhase) { lastPhase = p; render(); }
    }, 1000);
    cleanups.push(() => clearInterval(timer));
  }

  return { start, stop, tick, render, mutate, refreshTiles, staleAfterMs: HEARTBEAT_STALE_MS };
}

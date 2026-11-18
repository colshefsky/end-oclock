import type { Settings } from '../core/settings';
import { DEFAULT_SETTINGS } from '../core/settings';
import {
  endCheck, endSession, effectiveEnd, isTimeUp, phaseOf, pauseClock, resumeClock, timeLeftMs, cooldownUntil,
  HEARTBEAT_STALE_MS, type Session, type EndReason,
} from '../core/session';
import { formatClock } from '../core/time';
import { sessionItem, settingsItem, safeStorage, onContextLost } from '../shared/storage';
import { t } from '../shared/i18n';
import { applyTiles } from './tiles';
import { setFlags, markOff, shortsRedirect } from './page-flags';
import { onBridge } from './bridge';
import { createWatchMonitor } from './watch';
import { SEL } from './selectors';
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
  let stopped = false;
  const lengths = new Map<string, number>();
  const cleanups: Array<() => void> = [];

  /** Read-modify-write the shared session; ignores writes for a session that was replaced meanwhile. */
  async function mutate(fn: (s: Session) => Session): Promise<void> {
    const latest = await safeStorage(() => sessionItem.getValue());
    if (!latest || !session || latest.id !== session.id) return;
    const next = fn(latest);
    if (next === latest) return;
    session = next;
    await safeStorage(() => sessionItem.setValue(next));
  }

  const endNow = (reason: EndReason) => mutate((s) => endSession(s, reason, now()));

  const monitor = createWatchMonitor({
    getTimeLeft: () => (session ? timeLeftMs(session, now()) : 0),
    isTimeUp: () => (session ? isTimeUp(session, now()) : true),
    onCommit: ({ videoId, live }) => {
      const at = now();
      lastHeartbeat = at;
      void mutate((s) => ({
        ...s,
        committed: { ...s.committed, [tabKey]: { videoId, live, playing: true, pausedSince: null, remainingAtTimeUpMs: null, lastSeen: at } },
      }));
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
      void mutate((s) => {
        const mine = s.committed[tabKey];
        if (!mine) return s;
        let next: Session = {
          ...s,
          committed: { ...s.committed, [tabKey]: { ...mine, playing, pausedSince: playing ? null : at, lastSeen: at } },
        };
        if (s.mode === 'for' && s.rules.pauseStopsClock && !isTimeUp(s, at)) {
          next = playing ? resumeClock(next, at) : pauseClock(next, at);
        }
        return next;
      });
    },
    onEnded: () => void releaseCommitted(),
    onLeave: () => void releaseCommitted(),
  });

  function releaseCommitted(): Promise<void> {
    const at = now();
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
    if (!force && at - lastTiles < 150) return;
    lastTiles = at;
    applyTiles(document, timeLeftMs(session, at), lengths);
  }

  async function tick(): Promise<void> {
    if (stopped) return;
    const redirect = shortsRedirect(location.href);
    if (redirect) { deps.navigate(redirect); return; }
    const s = session;
    if (!s || phaseOf(s, now()) !== 'active') return;
    const at = now();
    getHost();
    if (screen === 'doesnt-fit' && !location.pathname.startsWith('/watch')) { clearScreen(); screen = null; }
    monitor.tick();
    mountPill({ endAt: effectiveEnd(s, at), onDone: () => void endNow('done') });
    if (at - lastTiles >= TILE_REFRESH_MS) refreshTiles(true);

    const mine = s.committed[tabKey];
    if (mine && monitor.committed()) {
      const timeUp = isTimeUp(s, at);
      const needsRemaining = timeUp && mine.remainingAtTimeUpMs == null;
      if (needsRemaining || at - lastHeartbeat >= HEARTBEAT_MS) {
        lastHeartbeat = at;
        const v = document.querySelector<HTMLVideoElement>(SEL.mainVideo);
        const remaining = v && Number.isFinite(v.duration) ? Math.max(0, (v.duration - v.currentTime) * 1000) : 0;
        await mutate((x) => {
          const c = x.committed[tabKey];
          if (!c) return x;
          return {
            ...x,
            committed: { ...x.committed, [tabKey]: { ...c, lastSeen: at, remainingAtTimeUpMs: c.remainingAtTimeUpMs ?? (timeUp ? remaining : null) } },
          };
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
      if (reason) await endNow(reason);
    }
  }

  function stop(): void {
    stopped = true;
    for (const c of cleanups.splice(0)) c();
    monitor.dispose();
  }

  async function start(): Promise<void> {
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

    cleanups.push(sessionItem.watch((v) => { session = v; render(); }));
    cleanups.push(settingsItem.watch((v) => { settings = v ?? DEFAULT_SETTINGS; }));
    cleanups.push(onBridge((msg) => {
      if (msg.kind === 'lengths') {
        for (const [id, secs] of msg.entries) lengths.set(id, secs);
        refreshTiles();
      } else monitor.handleDetails(msg.details);
    }));

    const observer = new MutationObserver(() => refreshTiles());
    observer.observe(document.documentElement, { childList: true, subtree: true });
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
      void tick();
      const p = phaseOf(session, now());
      if (p !== lastPhase) { lastPhase = p; render(); }
    }, 1000);
    cleanups.push(() => clearInterval(timer));
  }

  return { start, stop, tick, render, staleAfterMs: HEARTBEAT_STALE_MS };
}

import type { Settings } from './settings';

export type Mode = 'for' | 'until';

/** A video a tab started inside the session. It always gets to finish (spec §5.3). */
export interface Committed {
  videoId: string;
  live: boolean;
  playing: boolean;
  pausedSince: number | null;
  /** How much of the video was left when time ran out; set by the tab at time-up. */
  remainingAtTimeUpMs: number | null;
  /** Heartbeat from the tab; entries older than HEARTBEAT_STALE_MS are ignored. */
  lastSeen: number;
}

export type EndReason =
  | 'done' | 'video-finished' | 'not-watching' | 'nothing-fits' | 'paused-after-time-up'
  | 'moved-on' | 'live-end-time' | 'safety-ceiling' | 'no-tabs';

export type Phase = 'gate' | 'active' | 'end-screen' | 'cooldown';

export interface Session {
  id: string;
  mode: Mode;
  startedAt: number;
  budgetMs: number | null;
  untilAt: number | null;
  intention: string;
  /** Settings copied at Start; later setting changes never touch a running session or its cooldown. */
  rules: Settings;
  pausedMs: number;
  clockPausedSince: number | null;
  committed: Record<string, Committed>;
  endedAt: number | null;
  endReason: EndReason | null;
  endSeen: boolean;
}

export type StartInput =
  | { mode: 'for'; minutes: number; intention: string }
  | { mode: 'until'; untilAt: number; intention: string };

export const HEARTBEAT_STALE_MS = 6_000;
export const PAUSE_STOP_MS = 120_000;
export const NOTHING_FITS_MS = 60_000;
export const CEILING_SLACK_MS = 600_000;

export function startSession(input: StartInput, settings: Settings, now: number): Session {
  return {
    id: `${now.toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    mode: input.mode,
    startedAt: now,
    budgetMs: input.mode === 'for' ? input.minutes * 60_000 : null,
    untilAt: input.mode === 'until' ? input.untilAt : null,
    intention: input.intention.trim(),
    rules: { ...settings },
    pausedMs: 0,
    clockPausedSince: null,
    committed: {},
    endedAt: null,
    endReason: null,
    endSeen: false,
  };
}

export function effectiveEnd(s: Session, now: number): number {
  const cap = s.startedAt + s.rules.maxMinutes * 60_000;
  if (s.mode === 'until') return Math.min(s.untilAt ?? s.startedAt, cap);
  let end = s.startedAt + (s.budgetMs ?? 0);
  if (s.rules.pauseStopsClock) {
    end += s.pausedMs + (s.clockPausedSince != null ? Math.max(0, now - s.clockPausedSince) : 0);
  }
  return Math.min(end, cap);
}

export const timeLeftMs = (s: Session, now: number) => Math.max(0, effectiveEnd(s, now) - now);
export const isTimeUp = (s: Session, now: number) => now >= effectiveEnd(s, now);

export const liveCommitted = (s: Session, now: number): Committed[] =>
  Object.values(s.committed).filter((c) => now - c.lastSeen <= HEARTBEAT_STALE_MS);

/** Stops the clock (only matters in "for a while" mode with pause-stops-clock on). */
export function pauseClock(s: Session, now: number): Session {
  return s.clockPausedSince != null ? s : { ...s, clockPausedSince: now };
}

export function resumeClock(s: Session, now: number): Session {
  if (s.clockPausedSince == null) return s;
  return { ...s, pausedMs: s.pausedMs + Math.max(0, now - s.clockPausedSince), clockPausedSince: null };
}

/** Why the session should end right now, or null to keep going (spec §5.5). */
export function endCheck(s: Session, now: number): EndReason | null {
  if (s.endedAt != null) return null;
  const live = liveCommitted(s, now);
  if (!isTimeUp(s, now)) {
    return timeLeftMs(s, now) < NOTHING_FITS_MS && live.length === 0 ? 'nothing-fits' : null;
  }
  if (live.length === 0) return 'not-watching';
  if (live.some((c) => c.live)) return 'live-end-time';
  const end = effectiveEnd(s, now);
  if (live.some((c) => c.remainingAtTimeUpMs != null && now > end + c.remainingAtTimeUpMs + CEILING_SLACK_MS)) {
    return 'safety-ceiling';
  }
  if (live.every((c) => !c.playing && c.pausedSince != null && now - c.pausedSince >= PAUSE_STOP_MS)) {
    return 'paused-after-time-up';
  }
  return null;
}

/** Idempotent: the first end wins. `at` lets the background date the end at the real end time. */
export function endSession(s: Session, reason: EndReason, now: number, at: number = now): Session {
  if (s.endedAt != null) return s;
  return { ...s, endedAt: at, endReason: reason, clockPausedSince: null, committed: {} };
}

export const cooldownUntil = (s: Session): number | null =>
  s.endedAt == null ? null : s.endedAt + s.rules.cooldownMinutes * 60_000;

export function phaseOf(s: Session | null, now: number): Phase {
  if (!s) return 'gate';
  if (s.endedAt == null) return 'active';
  if (!s.endSeen) return 'end-screen';
  const until = cooldownUntil(s);
  return until != null && now < until ? 'cooldown' : 'gate';
}

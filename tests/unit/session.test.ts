import { DEFAULT_SETTINGS } from '../../src/core/settings';
import {
  startSession, effectiveEnd, timeLeftMs, isTimeUp, endCheck, endSession, cooldownUntil, phaseOf,
  pauseClock, resumeClock, type Session, type Committed,
} from '../../src/core/session';

const MIN = 60_000;
const T0 = new Date(2026, 10, 18, 20, 0).getTime();

const forSession = (minutes = 30, settings = DEFAULT_SETTINGS) =>
  startSession({ mode: 'for', minutes, intention: 'make dinner' }, settings, T0);

const committed = (over: Partial<Committed> = {}): Committed => ({
  videoId: 'v1', live: false, playing: true, pausedSince: null, remainingAtTimeUpMs: null, lastSeen: 0, ...over,
});

const withCommitted = (s: Session, entries: Record<string, Committed>): Session => ({ ...s, committed: entries });

describe('clock', () => {
  test('for-mode time left counts down in real time', () => {
    expect(timeLeftMs(forSession(), T0 + 10 * MIN)).toBe(20 * MIN);
  });

  test('a paused clock moves the end later when pause-stops-clock is on', () => {
    const s = pauseClock(forSession(), T0 + 10 * MIN);
    expect(effectiveEnd(s, T0 + 15 * MIN)).toBe(T0 + 35 * MIN);
    const resumed = resumeClock(s, T0 + 15 * MIN);
    expect(resumed.pausedMs).toBe(5 * MIN);
    expect(effectiveEnd(resumed, T0 + 20 * MIN)).toBe(T0 + 35 * MIN);
  });

  test('pausing does nothing when pause-stops-clock is off', () => {
    const s = pauseClock(forSession(30, { ...DEFAULT_SETTINGS, pauseStopsClock: false }), T0 + 10 * MIN);
    expect(effectiveEnd(s, T0 + 15 * MIN)).toBe(T0 + 30 * MIN);
  });

  test('pausing can never pass the longest session allowed', () => {
    const s = { ...forSession(110), pausedMs: 30 * MIN };
    expect(effectiveEnd(s, T0 + 50 * MIN)).toBe(T0 + 120 * MIN);
  });

  test('until mode ignores pauses', () => {
    const s = pauseClock(startSession({ mode: 'until', untilAt: T0 + 45 * MIN, intention: '' }, DEFAULT_SETTINGS, T0), T0 + 5 * MIN);
    expect(effectiveEnd(s, T0 + 30 * MIN)).toBe(T0 + 45 * MIN);
  });

  test('time is up at the end, not before', () => {
    expect(isTimeUp(forSession(), T0 + 30 * MIN - 1)).toBe(false);
    expect(isTimeUp(forSession(), T0 + 30 * MIN)).toBe(true);
  });

  test('settings are copied at start', () => {
    const settings = { ...DEFAULT_SETTINGS };
    const s = forSession(30, settings);
    settings.cooldownMinutes = 0;
    const ended = endSession(s, 'done', T0 + MIN);
    expect(cooldownUntil(ended)).toBe(T0 + MIN + 60 * MIN);
  });
});

describe('endCheck', () => {
  test('nothing fits with under a minute left and nothing playing', () => {
    expect(endCheck(forSession(), T0 + 29.5 * MIN)).toBe('nothing-fits');
  });

  test('still running with time left', () => {
    expect(endCheck(forSession(), T0 + 10 * MIN)).toBeNull();
  });

  test('not watching when time is up', () => {
    expect(endCheck(forSession(), T0 + 31 * MIN)).toBe('not-watching');
  });

  test('a playing committed video keeps the session open after time-up', () => {
    const now = T0 + 31 * MIN;
    const s = withCommitted(forSession(), { a: committed({ lastSeen: now - 1000, remainingAtTimeUpMs: 5 * MIN }) });
    expect(endCheck(s, now)).toBeNull();
  });

  test('waits for the last playing tab; stale tabs do not count', () => {
    const now = T0 + 31 * MIN;
    const s = withCommitted(forSession(), {
      gone: committed({ lastSeen: now - 60_000 }),
      playing: committed({ videoId: 'v2', lastSeen: now - 1000, remainingAtTimeUpMs: 5 * MIN }),
    });
    expect(endCheck(s, now)).toBeNull();
    const onlyGone = withCommitted(forSession(), { gone: committed({ lastSeen: now - 60_000 }) });
    expect(endCheck(onlyGone, now)).toBe('not-watching');
  });

  test('a pause of over 2 minutes after time-up is a stopping point', () => {
    const now = T0 + 35 * MIN;
    const paused = (since: number) => withCommitted(forSession(), {
      a: committed({ playing: false, pausedSince: since, lastSeen: now - 1000, remainingAtTimeUpMs: 10 * MIN }),
    });
    expect(endCheck(paused(now - 119_000), now)).toBeNull();
    expect(endCheck(paused(now - 121_000), now)).toBe('paused-after-time-up');
  });

  test('a live stream ends at the end time', () => {
    const now = T0 + 30 * MIN;
    const s = withCommitted(forSession(), { a: committed({ live: true, lastSeen: now - 1000 }) });
    expect(endCheck(s, now)).toBe('live-end-time');
  });

  test('safety ceiling: remaining length at time-up plus 10 minutes', () => {
    const s = withCommitted(forSession(), { a: committed({ remainingAtTimeUpMs: 5 * MIN }) });
    const at = (t: number) => withCommitted(s, { a: { ...s.committed.a!, lastSeen: t - 1000 } });
    expect(endCheck(at(T0 + 44 * MIN), T0 + 44 * MIN)).toBeNull();
    expect(endCheck(at(T0 + 46 * MIN), T0 + 46 * MIN)).toBe('safety-ceiling');
  });

  test('an ended session is never re-ended', () => {
    expect(endCheck(endSession(forSession(), 'done', T0), T0 + 40 * MIN)).toBeNull();
  });
});

describe('phases', () => {
  test('no session is the gate', () => {
    expect(phaseOf(null, T0)).toBe('gate');
  });

  test('ends immediately when woken far past end', () => {
    const now = T0 + 5 * 60 * MIN;
    const s = withCommitted(forSession(), { a: committed({ lastSeen: T0 + 20 * MIN }) });
    expect(phaseOf(s, now)).toBe('active');
    const reason = endCheck(s, now);
    expect(reason).toBe('not-watching');
    const ended = endSession(s, reason!, now);
    expect(phaseOf(ended, now)).toBe('end-screen');
    const seen = { ...ended, endSeen: true };
    expect(phaseOf(seen, now + 59 * MIN)).toBe('cooldown');
    expect(phaseOf(seen, now + 60 * MIN)).toBe('gate');
  });

  test('endSession keeps the first end and accepts an explicit end time', () => {
    const once = endSession(forSession(), 'no-tabs', T0 + 40 * MIN, T0 + 30 * MIN);
    expect(once.endedAt).toBe(T0 + 30 * MIN);
    expect(endSession(once, 'done', T0 + 50 * MIN).endedAt).toBe(T0 + 30 * MIN);
    expect(once.endReason).toBe('no-tabs');
  });

  test('cooldown of zero goes straight back to the gate after the end screen', () => {
    const s = endSession(forSession(30, { ...DEFAULT_SETTINGS, cooldownMinutes: 0 }), 'done', T0 + MIN);
    expect(phaseOf({ ...s, endSeen: true }, T0 + MIN)).toBe('gate');
  });
});

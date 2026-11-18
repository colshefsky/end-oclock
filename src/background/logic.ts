import { effectiveEnd, endSession, isTimeUp, liveCommitted, type Session } from '../core/session';
import { sessionItem } from '../shared/storage';

export const END_ALARM = 'eoc-end';

/** Keeps one alarm just after the session's current end (it moves when pausing stretches the clock). */
export async function scheduleEnd(s: Session | null, now: number): Promise<void> {
  if (!s || s.endedAt != null) {
    await browser.alarms.clear(END_ALARM);
    return;
  }
  await browser.alarms.create(END_ALARM, { when: Math.max(now, effectiveEnd(s, now)) + 1000 });
}

/** Ends a session whose time is up when no tab is watching anything (e.g. every tab was closed). */
export async function handleEndAlarm(now: number): Promise<void> {
  const s = await sessionItem.getValue();
  if (!s || s.endedAt != null) return;
  if (!isTimeUp(s, now) || liveCommitted(s, now).length > 0) {
    await scheduleEnd(s, now);
    if (isTimeUp(s, now)) await browser.alarms.create(END_ALARM, { when: now + 30_000 });
    return;
  }
  await sessionItem.setValue(endSession(s, 'no-tabs', now, effectiveEnd(s, now)));
}

/**
 * Pages only get an extension's scripts when they load, so YouTube tabs that were already open when
 * End O'Clock was installed or updated would run without it. Reload them so they land on the start screen.
 */
export async function reloadYouTubeTabs(): Promise<void> {
  const tabs = await browser.tabs.query({ url: 'https://www.youtube.com/*' });
  await Promise.all(tabs.map((t) => (t.id != null ? browser.tabs.reload(t.id).catch(() => {}) : undefined)));
}

export async function onInstalledReason(reason: string): Promise<void> {
  if (reason === 'install') {
    try { await browser.runtime.openOptionsPage(); } catch { /* the welcome page is a nicety; never block the reload */ }
  }
  if (reason === 'install' || reason === 'update') await reloadYouTubeTabs();
}

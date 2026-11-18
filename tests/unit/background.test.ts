import { fakeBrowser } from 'wxt/testing/fake-browser';
import { handleEndAlarm, scheduleEnd, END_ALARM, onInstalledReason } from '../../src/background/logic';
import { sessionItem } from '../../src/shared/storage';
import { DEFAULT_SETTINGS } from '../../src/core/settings';
import { startSession } from '../../src/core/session';

const MIN = 60_000;
const T0 = new Date(2026, 10, 18, 20, 0).getTime();
const running = () => startSession({ mode: 'for', minutes: 30, intention: '' }, DEFAULT_SETTINGS, T0);

beforeEach(() => fakeBrowser.reset());

test('the alarm ends a session with no tabs, dated at the end time', async () => {
  await sessionItem.setValue(running());
  await handleEndAlarm(T0 + 45 * MIN);
  const s = await sessionItem.getValue();
  expect(s?.endReason).toBe('no-tabs');
  expect(s?.endedAt).toBe(T0 + 30 * MIN);
  expect(s?.endSeen).toBe(false);
});

test('the alarm leaves a session alone while a tab is still watching', async () => {
  const s = running();
  s.committed.t = { videoId: 'v', live: false, playing: true, pausedSince: null, remainingAtTimeUpMs: null, lastSeen: T0 + 31 * MIN - 1000 };
  await sessionItem.setValue(s);
  await handleEndAlarm(T0 + 31 * MIN);
  expect((await sessionItem.getValue())?.endedAt).toBeNull();
});

test('the alarm does nothing before the end', async () => {
  await sessionItem.setValue(running());
  await handleEndAlarm(T0 + 10 * MIN);
  expect((await sessionItem.getValue())?.endedAt).toBeNull();
});

test('scheduleEnd sets an alarm just after the end, and clears it when ended', async () => {
  const s = running();
  await scheduleEnd(s, T0);
  const alarm = await fakeBrowser.alarms.get(END_ALARM);
  expect(alarm?.scheduledTime).toBe(T0 + 30 * MIN + 1000);
  await scheduleEnd({ ...s, endedAt: T0 + MIN }, T0 + MIN);
  expect(await fakeBrowser.alarms.get(END_ALARM)).toBeUndefined();
});

describe('open YouTube tabs pick up the extension', () => {
  test('install and update reload every open youtube.com tab, and only those', async () => {
    const yt1 = await fakeBrowser.tabs.create({ url: 'https://www.youtube.com/watch?v=a' });
    const yt2 = await fakeBrowser.tabs.create({ url: 'https://www.youtube.com/' });
    await fakeBrowser.tabs.create({ url: 'https://mail.google.com/' });
    const reload = vi.spyOn(fakeBrowser.tabs, 'reload').mockResolvedValue(undefined as never);
    vi.spyOn(fakeBrowser.tabs, 'query').mockImplementation((async (q: { url?: string | string[] }) => {
      const all = [yt1, yt2, { id: 99, url: 'https://mail.google.com/' }];
      return all.filter((t) => String(q.url ?? '').includes('youtube.com') && t.url?.startsWith('https://www.youtube.com/'));
    }) as never);
    await onInstalledReason('update');
    expect(reload.mock.calls.map((c) => c[0]).sort()).toEqual([yt1.id, yt2.id].sort());
    reload.mockClear();
    await onInstalledReason('install');
    expect(reload).toHaveBeenCalledTimes(2);
  });

  test('a browser update does not reload tabs', async () => {
    const reload = vi.spyOn(fakeBrowser.tabs, 'reload').mockResolvedValue(undefined as never);
    await onInstalledReason('chrome_update');
    expect(reload).not.toHaveBeenCalled();
  });
});

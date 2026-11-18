import { fakeBrowser } from 'wxt/testing/fake-browser';
import { handleEndAlarm, scheduleEnd, END_ALARM } from '../../src/background/logic';
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

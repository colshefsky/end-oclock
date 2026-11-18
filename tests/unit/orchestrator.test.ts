import { fakeBrowser } from 'wxt/testing/fake-browser';
import { createOrchestrator } from '../../src/youtube/orchestrator';
import { sessionItem, settingsItem } from '../../src/shared/storage';
import { DEFAULT_SETTINGS } from '../../src/core/settings';
import { startSession, endSession, type Session } from '../../src/core/session';
import { getHost, clearScreen } from '../../src/ui/host';
import { unmountPill } from '../../src/ui/pill';

const MIN = 60_000;
let clock = new Date(2026, 10, 18, 20, 0).getTime();
const flush = () => new Promise((r) => setTimeout(r, 0));
const screenText = () => getHost().querySelector('.eoc-screen')!.textContent ?? '';
const html = document.documentElement;

function make(tabKey = 'tab-a') {
  const closeTab = vi.fn();
  const o = createOrchestrator({ now: () => clock, tabKey, closeTab, navigate: vi.fn() });
  return { o, closeTab };
}

beforeEach(async () => {
  fakeBrowser.reset();
  clock = new Date(2026, 10, 18, 20, 0).getTime();
  history.replaceState(null, '', '/');
  document.body.innerHTML = '';
  clearScreen();
  unmountPill();
  for (const a of ['data-eoc-gate', 'data-eoc-session', 'data-eoc-off']) html.removeAttribute(a);
  await settingsItem.setValue(DEFAULT_SETTINGS);
});

const running = (minutes = 30): Session =>
  startSession({ mode: 'for', minutes, intention: 'make dinner' }, DEFAULT_SETTINGS, clock);

test('no session shows the start screen and gates the page', async () => {
  const { o } = make();
  await o.start();
  expect(screenText()).toContain('When does this end?');
  expect(html.hasAttribute('data-eoc-gate')).toBe(true);
  expect(html.hasAttribute('data-eoc-session')).toBe(false);
  o.stop();
});

test('a session started in another tab opens this one up', async () => {
  const { o } = make();
  await o.start();
  await sessionItem.setValue(running());
  await flush();
  expect(screenText()).toBe('');
  expect(html.hasAttribute('data-eoc-session')).toBe(true);
  expect(getHost().querySelector('.eoc-pill')!.textContent).toContain('Done by');
  o.stop();
});

test('starting from the start screen saves a session and shows the start helper', async () => {
  const { o } = make();
  await o.start();
  getHost().querySelector<HTMLButtonElement>('.eoc-btn--primary')!.click();
  await flush();
  await flush();
  const s = await sessionItem.getValue();
  expect(s?.budgetMs).toBe(30 * MIN);
  expect(getHost().querySelector('.eoc-helper')!.textContent).toContain('Everything you see here fits');
  o.stop();
});

test('an ended session shows the end screen once, then the cooldown', async () => {
  await sessionItem.setValue(endSession(running(), 'done', clock));
  const first = make();
  await first.o.start();
  expect(screenText()).toContain("That's a wrap!");
  await flush();
  expect((await sessionItem.getValue())?.endSeen).toBe(true);
  expect(screenText()).toContain("That's a wrap!");
  first.o.stop();
  clearScreen();
  const second = make('tab-b');
  await second.o.start();
  expect(screenText()).toContain('YouTube is napping');
  second.o.stop();
});

test('I am done ends the session', async () => {
  await sessionItem.setValue(running());
  const { o } = make();
  await o.start();
  getHost().querySelector<HTMLButtonElement>('.eoc-pill button')!.click();
  await flush();
  await flush();
  expect((await sessionItem.getValue())?.endReason).toBe('done');
  expect(screenText()).toContain("That's a wrap!");
  o.stop();
});

test('a browsing tab waits while another tab finishes its video', async () => {
  const s = running();
  clock += 31 * MIN;
  s.committed['tab-a'] = { videoId: 'v', live: false, playing: true, pausedSince: null, remainingAtTimeUpMs: 5 * MIN, lastSeen: clock - 1000 };
  await sessionItem.setValue(s);
  const { o } = make('tab-b');
  await o.start();
  await o.tick();
  expect((await sessionItem.getValue())?.endedAt).toBeNull();
  clock += 10_000; // tab-a's heartbeat goes stale: its video ended or the tab closed
  await o.tick();
  expect((await sessionItem.getValue())?.endReason).toBe('not-watching');
  o.stop();
});

test('nothing fits with under a minute left ends the session', async () => {
  await sessionItem.setValue(running());
  const { o } = make();
  await o.start();
  clock += 29.5 * MIN;
  await o.tick();
  expect((await sessionItem.getValue())?.endReason).toBe('nothing-fits');
  o.stop();
});

test('shorts URLs are sent home', async () => {
  history.replaceState(null, '', '/shorts/abc');
  const navigate = vi.fn();
  const o = createOrchestrator({ now: () => clock, tabKey: 'x', closeTab: vi.fn(), navigate });
  await o.start();
  await o.tick();
  expect(navigate).toHaveBeenCalledWith('https://www.youtube.com/');
  o.stop();
});

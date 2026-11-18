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

test('concurrent writes from one tab never overwrite each other', async () => {
  await sessionItem.setValue(running());
  const { o } = make();
  await o.start();
  await Promise.all([
    o.mutate((s) => ({ ...s, intention: 'a' })),
    o.mutate((s) => ({ ...s, pausedMs: 5 })),
  ]);
  const s = await sessionItem.getValue();
  expect(s?.intention).toBe('a');
  expect(s?.pausedMs).toBe(5);
  o.stop();
});

test('data YouTube sends while we are still starting up is not lost', async () => {
  await sessionItem.setValue(running());
  document.body.innerHTML = '<ytd-rich-item-renderer id="t"><yt-lockup-view-model><a href="/watch?v=early">x</a></yt-lockup-view-model></ytd-rich-item-renderer>';
  const { o } = make();
  const starting = o.start();
  window.dispatchEvent(new MessageEvent('message', { data: { src: 'eoc', kind: 'lengths', entries: [['early', 120]] }, source: window }));
  await starting;
  await o.tick();
  expect(document.getElementById('t')!.getAttribute('data-eoc-tile')).toBe('show');
  o.stop();
});

describe('review fixes', () => {
  function watchPage(videoId: string) {
    history.replaceState(null, '', `/watch?v=${videoId}`);
    document.body.innerHTML = '<div id="movie_player"><video class="html5-main-video"></video></div>';
    const v = document.querySelector('video')!;
    const st = { duration: 600, currentTime: 0, paused: false, ended: false };
    for (const k of ['duration', 'paused', 'ended'] as const) Object.defineProperty(v, k, { configurable: true, get: () => st[k] });
    Object.defineProperty(v, 'currentTime', { configurable: true, get: () => st.currentTime });
    return { st, player: document.getElementById('movie_player')! };
  }
  const details = (videoId: string, lengthSeconds: number) =>
    window.dispatchEvent(new MessageEvent('message', { data: { src: 'eoc', kind: 'watch', details: { videoId, lengthSeconds, isLive: false } }, source: window }));

  test('a watch entry erased by another tab is written back by the next heartbeat', async () => {
    await sessionItem.setValue(running());
    watchPage('w1');
    const { o } = make('tab-a');
    await o.start();
    details('w1', 600);
    await o.tick();
    await flush();
    expect(Object.keys((await sessionItem.getValue())!.committed)).toEqual(['tab-a']);
    const s = (await sessionItem.getValue())!;
    await sessionItem.setValue({ ...s, committed: {} }); // another tab's stale write
    clock += 3000;
    await o.tick();
    await flush();
    expect((await sessionItem.getValue())!.committed['tab-a']?.videoId).toBe('w1');
    o.stop();
  });

  test("an ended session can't be undone by another tab's stale write", async () => {
    await sessionItem.setValue(running());
    const { o } = make('tab-a');
    await o.start();
    const stale = (await sessionItem.getValue())!;
    getHost().querySelector<HTMLButtonElement>('.eoc-pill button')!.click();
    await flush(); await flush();
    expect((await sessionItem.getValue())!.endedAt).not.toBeNull();
    await sessionItem.setValue({ ...stale, intention: 'other tab' });
    await flush(); await flush();
    expect((await sessionItem.getValue())!.endedAt).not.toBeNull();
    o.stop();
  });

  test('waking from sleep dates the end at the real end time', async () => {
    const s = running();
    await sessionItem.setValue(s);
    const { o } = make();
    await o.start();
    clock += 20 * MIN;
    await o.tick();
    clock += 5 * 60 * MIN;
    await o.tick();
    await flush();
    const after = (await sessionItem.getValue())!;
    expect(after.endReason).toBe('not-watching');
    expect(after.endedAt).toBe(s.startedAt + 30 * MIN);
    o.stop();
  });

  test('time running out during an ad records the real video, not the ad', async () => {
    await sessionItem.setValue(running(10));
    const { st, player } = watchPage('w2');
    const { o } = make('tab-a');
    await o.start();
    details('w2', 540);
    await o.tick();
    clock += 10 * MIN;            // time is up…
    player.classList.add('ad-showing');
    st.duration = 15;              // …during a 15 s mid-roll
    st.currentTime = 2;
    await o.tick();
    await flush();
    expect((await sessionItem.getValue())!.committed['tab-a']?.remainingAtTimeUpMs).toBeNull();
    player.classList.remove('ad-showing');
    st.duration = 540;
    st.currentTime = 300;
    clock += 1000;
    await o.tick();
    await flush();
    expect((await sessionItem.getValue())!.committed['tab-a']?.remainingAtTimeUpMs).toBe(240_000);
    o.stop();
  });

  test('a tile changed right after a pass is re-checked without waiting for the timer', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'setInterval', 'Date'] });
    await sessionItem.setValue(running(20));
    document.body.innerHTML = '<ytd-rich-item-renderer id="t"><yt-lockup-view-model><a href="/watch?v=a">a</a><yt-thumbnail-badge-view-model><div class="ytBadgeShapeText">2:00</div></yt-thumbnail-badge-view-model></yt-lockup-view-model></ytd-rich-item-renderer>';
    const { o } = make();
    const started = o.start();
    await vi.runOnlyPendingTimersAsync();
    await started;
    expect(document.getElementById('t')!.getAttribute('data-eoc-tile')).toBe('show');
    o.refreshTiles(true);
    document.querySelector('a')!.setAttribute('href', '/watch?v=b');
    document.querySelector('.ytBadgeShapeText')!.textContent = '40:00';
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(300);
    expect(document.getElementById('t')!.getAttribute('data-eoc-tile')).toBe('hide');
    o.stop();
    vi.useRealTimers();
  });
});

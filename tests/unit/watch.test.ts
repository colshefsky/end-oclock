import { createWatchMonitor } from '../../src/youtube/watch';

const MIN = 60_000;

function page(videoId: string) {
  history.replaceState(null, '', `/watch?v=${videoId}`);
  document.body.innerHTML = `
    <div id="movie_player"><video class="html5-main-video"></video>
      <div class="ytp-autonav-toggle-button" aria-checked="true"></div></div>`;
  const video = document.querySelector('video')!;
  const state = { duration: NaN, currentTime: 0, paused: false, ended: false };
  for (const k of ['duration', 'paused', 'ended'] as const) {
    Object.defineProperty(video, k, { configurable: true, get: () => state[k] });
  }
  Object.defineProperty(video, 'currentTime', { configurable: true, get: () => state.currentTime, set: (v) => { state.currentTime = v; } });
  video.pause = vi.fn(() => { state.paused = true; });
  return { video, state, player: document.getElementById('movie_player')! };
}

function monitor(timeLeft = 30 * MIN, timeUp = false) {
  const deps = {
    getTimeLeft: () => timeLeft,
    isTimeUp: () => timeUp,
    onCommit: vi.fn(),
    onDoesntFit: vi.fn(),
    onMovedOn: vi.fn(),
    onPlayState: vi.fn(),
    onEnded: vi.fn(),
    onLeave: vi.fn(),
  };
  return { m: createWatchMonitor(deps), deps };
}

test('a 10-minute video with 30 minutes left is committed', () => {
  page('a');
  const { m, deps } = monitor();
  m.handleDetails({ videoId: 'a', lengthSeconds: 600, isLive: false });
  m.tick();
  expect(deps.onCommit).toHaveBeenCalledWith({ videoId: 'a', live: false, remainingMs: 600_000 });
  m.tick();
  expect(deps.onCommit).toHaveBeenCalledTimes(1);
});

test('a 48-minute video with 30 minutes left does not fit and is paused', () => {
  const { video } = page('b');
  const { m, deps } = monitor();
  m.handleDetails({ videoId: 'b', lengthSeconds: 2880, isLive: false });
  m.tick();
  expect(deps.onDoesntFit).toHaveBeenCalledWith({ videoId: 'b', seconds: 2880 });
  expect(video.pause).toHaveBeenCalled();
  expect(deps.onCommit).not.toHaveBeenCalled();
});

test('resuming partway counts only what is left', () => {
  const { state } = page('c');
  state.currentTime = 2000;
  const { m, deps } = monitor();
  m.handleDetails({ videoId: 'c', lengthSeconds: 2880, isLive: false });
  m.tick();
  expect(deps.onCommit).toHaveBeenCalledWith({ videoId: 'c', live: false, remainingMs: 880_000 });
});

test('ignores ad playback', () => {
  vi.useFakeTimers();
  const { player, state } = page('d');
  player.classList.add('ad-showing');
  state.duration = 15;
  const { m, deps } = monitor();
  m.tick();
  vi.advanceTimersByTime(5000);
  m.tick();
  // The ad's own 15 s length is never used to decide.
  expect(deps.onCommit).not.toHaveBeenCalled();
  expect(deps.onDoesntFit).not.toHaveBeenCalled();
  // YouTube's data describes the real video, so we can decide during the ad.
  m.handleDetails({ videoId: 'd', lengthSeconds: 2880, isLive: false });
  m.tick();
  expect(deps.onDoesntFit).toHaveBeenCalledWith({ videoId: 'd', seconds: 2880 });
  vi.useRealTimers();
});

test('during an ad, remaining time ignores the ad position', () => {
  const { player, state } = page('d2');
  player.classList.add('ad-showing');
  state.currentTime = 12;
  const { m, deps } = monitor();
  m.handleDetails({ videoId: 'd2', lengthSeconds: 600, isLive: false });
  m.tick();
  expect(deps.onCommit).toHaveBeenCalledWith({ videoId: 'd2', live: false, remainingMs: 600_000 });
});

test('live streams are committed as live', () => {
  page('e');
  const { m, deps } = monitor();
  m.handleDetails({ videoId: 'e', lengthSeconds: null, isLive: true });
  m.tick();
  expect(deps.onCommit).toHaveBeenCalledWith({ videoId: 'e', live: true, remainingMs: 0 });
});

test('a new video after time is up is a stopping point', () => {
  const { video } = page('f');
  const { m, deps } = monitor(0, true);
  m.handleDetails({ videoId: 'f', lengthSeconds: 60, isLive: false });
  m.tick();
  expect(deps.onMovedOn).toHaveBeenCalled();
  expect(video.pause).toHaveBeenCalled();
});

test('loop and autoplay get switched off', () => {
  const { video } = page('g');
  video.loop = true;
  const toggle = document.querySelector<HTMLElement>('.ytp-autonav-toggle-button')!;
  const click = vi.fn(() => toggle.setAttribute('aria-checked', 'false'));
  toggle.addEventListener('click', click);
  const { m } = monitor();
  m.tick();
  expect(video.loop).toBe(false);
  m.tick();
  expect(click).toHaveBeenCalledTimes(1);
});

test('reports play state changes and the end of a committed video', () => {
  const { state } = page('h');
  const { m, deps } = monitor();
  m.handleDetails({ videoId: 'h', lengthSeconds: 60, isLive: false });
  m.tick();
  expect(deps.onPlayState).toHaveBeenLastCalledWith(true);
  state.paused = true;
  m.tick();
  expect(deps.onPlayState).toHaveBeenLastCalledWith(false);
  state.ended = true;
  m.tick();
  expect(deps.onEnded).toHaveBeenCalledTimes(1);
  m.tick();
  expect(deps.onEnded).toHaveBeenCalledTimes(1);
});

test('leaving the watch page reports it once', () => {
  page('i');
  const { m, deps } = monitor();
  m.handleDetails({ videoId: 'i', lengthSeconds: 60, isLive: false });
  m.tick();
  history.replaceState(null, '', '/');
  m.tick();
  m.tick();
  expect(deps.onLeave).toHaveBeenCalledTimes(1);
});

test('falls back to the video duration when no data arrives', () => {
  vi.useFakeTimers();
  const { state } = page('j');
  state.duration = 300;
  const { m, deps } = monitor();
  m.tick();
  expect(deps.onCommit).not.toHaveBeenCalled();
  vi.advanceTimersByTime(3000);
  m.tick();
  expect(deps.onCommit).toHaveBeenCalledWith({ videoId: 'j', live: false, remainingMs: 300_000 });
  vi.useRealTimers();
});

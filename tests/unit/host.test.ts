import { getHost, showScreen, clearScreen, mascotUrl, isBlocking } from '../../src/ui/host';

const div = (text: string) => {
  const d = document.createElement('div');
  d.textContent = text;
  return d;
};

afterEach(() => clearScreen());

test('getHost returns one shadow root on the body', () => {
  const a = getHost();
  const b = getHost();
  expect(a).toBe(b);
  expect(a.host.parentElement).toBe(document.body);
});

test('showScreen keeps only the latest screen', () => {
  showScreen(div('a'), { blocking: false });
  showScreen(div('b'), { blocking: false });
  const slot = getHost().querySelector('.eoc-screen')!;
  expect(slot.textContent).toBe('b');
});

test('blocking screens stop YouTube hotkeys but not our own inputs', () => {
  const docKeys = vi.fn();
  document.addEventListener('keydown', docKeys);
  const input = document.createElement('input');
  const screen = div('');
  screen.append(input);
  const ours = vi.fn();
  input.addEventListener('keydown', ours);
  showScreen(screen, { blocking: true });
  expect(isBlocking()).toBe(true);

  document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', bubbles: true }));
  expect(docKeys).not.toHaveBeenCalled();

  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', bubbles: true, composed: true }));
  expect(ours).toHaveBeenCalledTimes(1);
  expect(docKeys).not.toHaveBeenCalled();

  clearScreen();
  document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', bubbles: true }));
  expect(docKeys).toHaveBeenCalledTimes(1);
  document.removeEventListener('keydown', docKeys);
});

test('blocking screens pause videos and keep them paused', () => {
  const video = document.createElement('video');
  document.body.append(video);
  const pause = vi.spyOn(video, 'pause').mockImplementation(() => {});
  showScreen(div('x'), { blocking: true });
  expect(pause).toHaveBeenCalled();
  pause.mockClear();
  video.dispatchEvent(new Event('play'));
  expect(pause).toHaveBeenCalled();
  clearScreen();
  pause.mockClear();
  video.dispatchEvent(new Event('play'));
  expect(pause).not.toHaveBeenCalled();
  video.remove();
});

test('mascotUrl points into the extension', () => {
  expect(mascotUrl('wave')).toMatch(/mascot\/wave\.png$/);
});

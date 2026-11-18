import { fakeBrowser } from 'wxt/testing/fake-browser';
import { renderPopup } from '../../src/popup/render';
import { DEFAULT_SETTINGS } from '../../src/core/settings';
import { startSession, endSession } from '../../src/core/session';

const T0 = new Date(2026, 10, 18, 21, 0).getTime();
const running = () => startSession({ mode: 'for', minutes: 30, intention: '' }, DEFAULT_SETTINGS, T0);

beforeEach(() => fakeBrowser.reset());

test('no session', () => {
  const el = renderPopup(null, T0, vi.fn());
  expect(el.textContent).toContain('Ready when you are');
});

test('during a session it shows the end time, not a countdown', () => {
  const el = renderPopup(running(), T0 + 60_000, vi.fn());
  expect(el.textContent).toContain('Done by 9:30 PM');
  expect(el.textContent).not.toMatch(/left|remaining/i);
});

test('cooldown shows when YouTube opens again', () => {
  const ended = { ...endSession(running(), 'done', T0 + 30 * 60_000), endSeen: true };
  const el = renderPopup(ended, T0 + 31 * 60_000, vi.fn());
  expect(el.textContent).toContain('Napping until 10:30 PM');
});

test('the only button opens settings; nothing starts or extends a session', () => {
  const openSettings = vi.fn();
  const el = renderPopup(running(), T0, openSettings);
  const buttons = [...el.querySelectorAll('button')];
  expect(buttons).toHaveLength(1);
  buttons[0]!.click();
  expect(openSettings).toHaveBeenCalled();
});

test('the header icon is sharp on high-density screens', () => {
  const img = renderPopup(null, T0, vi.fn()).querySelector('img')!;
  expect(img.getAttribute('src')).toBe('/icon/128.png');
  expect(img.getAttribute('width')).toBe('32');
});

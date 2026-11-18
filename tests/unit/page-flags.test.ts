import { setFlags, shortsRedirect, markOff } from '../../src/youtube/page-flags';

const html = document.documentElement;

test('shorts URLs redirect home', () => {
  expect(shortsRedirect('https://www.youtube.com/shorts/abc?x=1')).toBe('https://www.youtube.com/');
  expect(shortsRedirect('https://www.youtube.com/watch?v=1')).toBeNull();
  expect(shortsRedirect('https://www.youtube.com/@chan/shorts')).toBeNull();
});

test('setFlags toggles the html attributes', () => {
  setFlags({ gate: true, session: false });
  expect(html.getAttribute('data-eoc-ext')).toBe('1');
  expect(html.hasAttribute('data-eoc-gate')).toBe(true);
  expect(html.hasAttribute('data-eoc-session')).toBe(false);
  setFlags({ gate: false, session: true });
  expect(html.hasAttribute('data-eoc-gate')).toBe(false);
  expect(html.hasAttribute('data-eoc-session')).toBe(true);
});

test('markOff un-hides YouTube when the extension goes away', () => {
  markOff();
  expect(html.hasAttribute('data-eoc-off')).toBe(true);
});

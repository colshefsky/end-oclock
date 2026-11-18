import { t } from '../shared/i18n';
import { h, mascotUrl, overlayLayer } from './host';

let current: HTMLElement | null = null;

/** The clock peeks in from the right with a speech bubble; "Got it" sends it back out. */
export function showHelper(text: string): void {
  hideHelper(true);
  const gotIt = h('button', { type: 'button', class: 'eoc-btn eoc-btn--small eoc-btn--mustard' }, t('helperGotIt'));
  const el = h('div', { class: 'eoc-helper', role: 'status' },
    h('div', { class: 'eoc-bubble' }, h('div', {}, text), h('div', {}, gotIt)),
    h('img', { src: mascotUrl('peek'), alt: '' }));
  gotIt.addEventListener('click', () => hideHelper());
  overlayLayer().append(el);
  current = el;
}

export function hideHelper(instant = false): void {
  const el = current;
  if (!el) return;
  current = null;
  if (instant) { el.remove(); return; }
  el.classList.add('is-leaving');
  setTimeout(() => el.remove(), 500);
}

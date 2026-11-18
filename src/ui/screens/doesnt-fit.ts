import { formatClock, formatLength } from '../../core/time';
import { t } from '../../shared/i18n';
import { h, mascotUrl } from '../host';

export function renderDoesntFit(o: { seconds: number; endAt: number; onSaveLater(): void; onShorter(): void }): HTMLElement {
  const save = h('button', { type: 'button', class: 'eoc-btn eoc-btn--primary', style: 'font-size:19px;padding:12px 22px' }, t('saveLater'));
  const shorter = h('button', { type: 'button', class: 'eoc-btn' }, t('findShorter'));
  const note = h('div', { class: 'eoc-small', role: 'status' });
  save.addEventListener('click', () => o.onSaveLater());
  shorter.addEventListener('click', () => o.onShorter());
  const root = h('div', { class: 'eoc-backdrop' },
    h('div', { class: 'eoc-card eoc-card--wide', role: 'dialog', 'aria-modal': 'true', style: '--card-shadow:#1F6F6B' },
      h('img', { class: 'eoc-mascot', src: mascotUrl('shrug'), alt: '', width: '220', height: '240' }),
      h('div', { class: 'eoc-stack' },
        h('h1', { class: 'eoc-h1' }, t('doesntFitTitle')),
        h('p', { class: 'eoc-text' }, t('doesntFitText', formatLength(o.seconds), formatClock(o.endAt))),
        h('div', { class: 'eoc-row' }, save, shorter),
        note)));
  return root;
}

/** Shows a short status line under the buttons (e.g. "Link copied"). */
export function setDoesntFitNote(root: HTMLElement, text: string): void {
  const n = root.querySelector('[role="status"]');
  if (n) n.textContent = text;
}

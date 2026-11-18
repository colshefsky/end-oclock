import { formatClock, formatLength } from '../../core/time';
import { t } from '../../shared/i18n';
import { h, mascotUrl } from '../host';

export function renderCooldown(o: { until: number; now: () => number; intention: string; onClose(): void }): HTMLElement {
  const text = h('p', { class: 'eoc-text' });
  const refresh = () => {
    const mins = Math.max(1, Math.ceil((o.until - o.now()) / 60_000));
    text.textContent = t('cooldownText', formatClock(o.until), formatLength(mins * 60));
  };
  refresh();
  const timer = setInterval(() => (root.isConnected ? refresh() : clearInterval(timer)), 30_000);
  const close = h('button', { type: 'button', class: 'eoc-btn eoc-btn--teal' }, t('closeTab'));
  close.addEventListener('click', () => o.onClose());
  const root = h('div', { class: 'eoc-backdrop eoc-backdrop--night' },
    h('div', { class: 'eoc-card', role: 'dialog', 'aria-modal': 'true', style: '--card-shadow:#E9B33B;align-items:center;text-align:center' },
      h('img', { class: 'eoc-mascot', src: mascotUrl('sleep'), alt: '', width: '210', height: '210' }),
      h('h1', { class: 'eoc-h1' }, t('cooldownTitle')),
      text,
      o.intention ? h('div', { class: 'eoc-note' }, t('cooldownSaid'), ' ', h('span', { class: 'eoc-strong' }, o.intention)) : null,
      close));
  return root;
}

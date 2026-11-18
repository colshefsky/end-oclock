import { t } from '../../shared/i18n';
import { h, mascotUrl } from '../host';
import { startConfetti } from '../confetti';

export const AUTO_CLOSE_S = 15;

export function renderEnd(o: { intention: string; autoClose: boolean; onClose(): void; onDone(): void }): HTMLElement {
  const canvas = h('canvas', { class: 'eoc-confetti', 'aria-hidden': 'true' });
  const status = h('div', { class: 'eoc-small' });
  const actions = h('div', { class: 'eoc-row' });
  if (o.autoClose) {
    const close = h('button', { type: 'button', class: 'eoc-btn eoc-btn--teal' }, t('endCloseNow'));
    close.addEventListener('click', () => o.onClose());
    actions.append(close, status);
  } else {
    const done = h('button', { type: 'button', class: 'eoc-btn eoc-btn--teal' }, t('endDone'));
    done.addEventListener('click', () => o.onDone());
    actions.append(done);
  }

  const root = h('div', { class: 'eoc-backdrop eoc-backdrop--rays' },
    h('div', { class: 'eoc-rays', 'aria-hidden': 'true' }),
    canvas,
    h('div', { class: 'eoc-card eoc-card--wide', role: 'dialog', 'aria-modal': 'true', style: '--card-shadow:#23201C' },
      h('img', { class: 'eoc-mascot', src: mascotUrl('bow'), alt: '', width: '220', height: '240' }),
      h('div', { class: 'eoc-stack' },
        h('h1', { class: 'eoc-h1 eoc-h1--stamp' }, t('endTitle')),
        h('p', { class: 'eoc-text' }, t('endText')),
        o.intention ? h('div', { class: 'eoc-note' }, h('span', { class: 'eoc-strong' }, t('endNextUp')), ' ', o.intention) : null,
        actions)));

  let left = AUTO_CLOSE_S;
  status.textContent = t('endAutoClose', String(left));
  let stopConfetti = () => {};
  let timer: ReturnType<typeof setInterval> | undefined;
  queueMicrotask(() => { stopConfetti = startConfetti(canvas); });
  if (o.autoClose) {
    timer = setInterval(() => {
      left -= 1;
      if (left <= 0) {
        clearInterval(timer);
        stopConfetti();
        o.onClose();
      } else status.textContent = t('endAutoClose', String(left));
    }, 1000);
  }
  // Stop work if the screen is removed early.
  let wasShown = false;
  const watch = setInterval(() => {
    if (root.isConnected) { wasShown = true; return; }
    if (wasShown) { clearInterval(watch); clearInterval(timer); stopConfetti(); }
  }, 1000);
  return root;
}

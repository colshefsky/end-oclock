import { formatClock } from '../core/time';
import { t } from '../shared/i18n';
import { h, overlayLayer } from './host';

let pill: HTMLElement | null = null;
let label: HTMLElement | null = null;

/** "Done by 9:30 PM" + I'm done. Never a countdown. */
export function mountPill(o: { endAt: number; onDone(): void }): void {
  if (!pill) {
    label = h('span', {});
    const done = h('button', { type: 'button', class: 'eoc-btn eoc-btn--small' }, t('pillDone'));
    done.addEventListener('click', () => o.onDone());
    pill = h('div', { class: 'eoc-pill', role: 'status' }, clockIcon(), label, done);
    overlayLayer().append(pill);
  }
  label!.textContent = t('pillDoneBy', formatClock(o.endAt));
}

export function unmountPill(): void {
  pill?.remove();
  pill = null;
  label = null;
}

function clockIcon(): SVGSVGElement {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('width', '24');
  svg.setAttribute('height', '24');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', '#23201C');
  svg.setAttribute('stroke-width', '2.4');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('aria-hidden', 'true');
  for (const [tag, attrs] of [
    ['circle', { cx: '12', cy: '13', r: '8' }],
    ['path', { d: 'M12 9v4l3 2' }],
    ['path', { d: 'M9 2h6' }],
  ] as const) {
    const el = document.createElementNS(ns, tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    svg.append(el);
  }
  return svg;
}

import type { Settings } from '../../core/settings';
import { startSession, type Session } from '../../core/session';
import { formatClock, formatLength, nextOccurrence } from '../../core/time';
import { t } from '../../shared/i18n';
import { h, mascotUrl } from '../host';

export type EndChoice = { mode: 'for'; minutes: number } | { mode: 'until'; hhmm: string };
export type EndResult = { ok: true; endAt: number } | { ok: false; reason: 'too-long' | 'too-short' };

export function computeEnd(choice: EndChoice, settings: Settings, now: number): EndResult {
  const endAt = choice.mode === 'for' ? now + choice.minutes * 60_000 : nextOccurrence(choice.hhmm, now);
  const minutes = (endAt - now) / 60_000;
  if (!(minutes >= 1)) return { ok: false, reason: 'too-short' };
  if (minutes > settings.maxMinutes) return { ok: false, reason: 'too-long' };
  return { ok: true, endAt };
}

const CHIPS = [15, 30, 45, 60];

export function renderStart(opts: {
  settings: Settings;
  now: () => number;
  onStart: (s: Session) => void;
  onClose: () => void;
}): HTMLElement {
  const { settings } = opts;
  let mode: 'for' | 'until' = 'for';
  let minutes = settings.usualMinutes;
  let hhmm = '';

  const tabFor = h('button', { type: 'button', role: 'tab', class: 'eoc-tab', 'aria-selected': 'true' }, t('tabFor'));
  const tabUntil = h('button', { type: 'button', role: 'tab', class: 'eoc-tab', 'aria-selected': 'false' }, t('tabUntil'));

  const chips = CHIPS.filter((m) => m <= settings.maxMinutes).map((m) =>
    h('button', { type: 'button', class: 'eoc-chip', 'data-minutes': String(m), 'aria-pressed': 'false' },
      m === 60 ? t('chipHour') : t('chipMinutes', String(m))));
  const custom = h('input', {
    type: 'number', class: 'eoc-input', min: '1', max: String(settings.maxMinutes), inputmode: 'numeric',
    placeholder: t('customMinutesPlaceholder'), 'aria-label': t('customMinutesLabel'), style: 'width:110px',
  });
  const forPanel = h('div', { class: 'eoc-row' }, ...chips,
    h('label', { class: 'eoc-row', style: 'gap:8px;font-size:18px;font-weight:500' }, t('customMinutesPrefix'), custom));

  const time = h('input', { type: 'time', class: 'eoc-input', 'aria-label': t('untilLabel') });
  const untilPanel = h('label', { class: 'eoc-row', style: 'gap:10px;font-size:18px;font-weight:600' }, t('untilLabel'), time);
  untilPanel.hidden = true;

  const intention = h('input', { type: 'text', class: 'eoc-input', maxlength: '80', placeholder: t('intentionPlaceholder') });
  const endsAt = h('div', { class: 'eoc-ends-at eoc-strong', style: 'font-size:18px' });
  const pauseNote = h('div', { class: 'eoc-small' }, t('pauseNote'));
  const error = h('div', { class: 'eoc-error', role: 'alert' });
  const start = h('button', { type: 'button', class: 'eoc-btn eoc-btn--primary' }, t('startButton'));
  const close = h('button', { type: 'button', class: 'eoc-link' }, t('closeTabLink'));

  const choice = (): EndChoice => (mode === 'for' ? { mode, minutes } : { mode, hhmm });

  const refresh = () => {
    for (const c of chips) c.setAttribute('aria-pressed', String(mode === 'for' && Number(c.dataset.minutes) === minutes && custom.value === ''));
    tabFor.setAttribute('aria-selected', String(mode === 'for'));
    tabUntil.setAttribute('aria-selected', String(mode === 'until'));
    forPanel.hidden = mode !== 'for';
    untilPanel.hidden = mode !== 'until';
    pauseNote.hidden = !(mode === 'for' && settings.pauseStopsClock);
    error.textContent = '';
    const r = mode === 'until' && !hhmm ? null : computeEnd(choice(), settings, opts.now());
    endsAt.textContent = r?.ok ? t('endsAt', formatClock(r.endAt)) : '';
  };

  for (const c of chips) {
    c.addEventListener('click', () => {
      minutes = Number(c.dataset.minutes);
      custom.value = '';
      refresh();
    });
  }
  custom.addEventListener('input', () => {
    const n = Math.round(Number(custom.value));
    minutes = Number.isFinite(n) ? n : 0;
    refresh();
  });
  time.addEventListener('input', () => { hhmm = time.value; refresh(); });
  tabFor.addEventListener('click', () => { mode = 'for'; refresh(); });
  tabUntil.addEventListener('click', () => { mode = 'until'; refresh(); time.focus(); });
  close.addEventListener('click', () => opts.onClose());
  start.addEventListener('click', () => {
    if (mode === 'until' && !hhmm) { error.textContent = t('errPickTime'); return; }
    const now = opts.now();
    const r = computeEnd(choice(), settings, now);
    if (!r.ok) {
      error.textContent = r.reason === 'too-long'
        ? t('errTooLong', formatLength(settings.maxMinutes * 60))
        : t('errTooShort');
      return;
    }
    const input = mode === 'for'
      ? { mode, minutes, intention: intention.value }
      : { mode, untilAt: r.endAt, intention: intention.value };
    opts.onStart(startSession(input, settings, now));
  });

  if (!CHIPS.includes(minutes) || minutes > settings.maxMinutes) custom.value = String(minutes);
  refresh();
  const ticker = setInterval(() => { if (!root.isConnected) clearInterval(ticker); else if (!error.textContent) refresh(); }, 15_000);

  const card = h('div', { class: 'eoc-card', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'eoc-start-title' },
    h('div', { class: 'eoc-stack', style: 'gap:4px' },
      h('div', { class: 'eoc-eyebrow' }, t('eyebrow')),
      h('h1', { class: 'eoc-h1', id: 'eoc-start-title' }, t('startTitle'))),
    h('div', { class: 'eoc-tabs', role: 'tablist' }, tabFor, tabUntil),
    forPanel, untilPanel,
    h('label', { class: 'eoc-label' }, t('intentionLabel'), intention),
    h('div', { class: 'eoc-row', style: 'justify-content:space-between' },
      h('div', { class: 'eoc-stack', style: 'gap:2px' }, endsAt, pauseNote), start),
    error, close);

  const root = h('div', { class: 'eoc-backdrop' },
    h('div', { class: 'eoc-side' },
      h('div', { class: 'eoc-bubble' }, t('startBubble')),
      h('img', { class: 'eoc-mascot', src: mascotUrl('wave'), alt: '', width: '260', height: '260' })),
    card);
  return root;
}

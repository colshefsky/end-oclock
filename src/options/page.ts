import { clampSettings, type Settings } from '../core/settings';
import { settingsItem, firstRunDoneItem } from '../shared/storage';
import { t } from '../shared/i18n';
import { h, mascotUrl } from '../ui/host';
import { createHold, HOLD_MS } from './hold';

const RING = 2 * Math.PI * 150;

function minutesLabel(m: number): string {
  if (m === 0) return t('none');
  if (m < 60) return t('unitMin', String(m));
  const hr = Math.floor(m / 60);
  const rest = m % 60;
  return rest ? t('unitHrMin', String(hr), String(rest)) : t('unitHr', String(hr));
}

function renderHold(onUnlock: () => void): { el: HTMLElement; dispose: () => void } {
  const nudges = [0, 10, 25, 40, 55];
  const bubble = h('div', { class: 'eoc-bubble' }, t('nudge0'));
  const big = h('span', { class: 'eoc-hold-time' }, '1:00');
  const small = h('span', { class: 'eoc-hold-label' }, t('holdIdle'));
  const count = h('div', { class: 'eoc-hold-count' }, t('holdCount', '0'));
  const button = h('button', { type: 'button', class: 'eoc-hold-button', 'aria-label': t('holdAria') }, big, small);
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 340 340');
  svg.setAttribute('class', 'eoc-hold-ring');
  svg.setAttribute('aria-hidden', 'true');
  const circle = (stroke: string, width: string) => {
    const c = document.createElementNS(ns, 'circle');
    for (const [k, v] of Object.entries({ cx: '170', cy: '170', r: '150', fill: 'none', stroke, 'stroke-width': width })) c.setAttribute(k, v);
    svg.append(c);
    return c;
  };
  circle('#23201C', '26');
  circle('#FFFDF6', '18');
  const fill = circle('#C8402A', '18');
  fill.setAttribute('stroke-linecap', 'round');
  fill.setAttribute('stroke-dasharray', String(RING));
  fill.setAttribute('stroke-dashoffset', String(RING));
  fill.setAttribute('transform', 'rotate(-90 170 170)');

  const dispose = createHold(button, {
    ms: HOLD_MS,
    onUnlock,
    onProgress: (f, held) => {
      const secs = Math.floor(held / 1000);
      const left = Math.ceil((HOLD_MS - held) / 1000);
      fill.setAttribute('stroke-dashoffset', String(RING * (1 - f)));
      big.textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
      small.textContent = f > 0 ? t('holdHolding') : t('holdIdle');
      count.textContent = t('holdCount', String(secs));
      const step = nudges.filter((n) => secs >= n).length - 1;
      const text = t(`nudge${Math.max(0, step)}`);
      if (bubble.textContent !== text) bubble.textContent = text;
    },
  });

  const el = h('main', { class: 'eoc-hold' },
    h('section', { class: 'eoc-stack eoc-hold-copy' },
      h('div', { class: 'eoc-eyebrow' }, t('settingsEyebrow')),
      h('h1', { class: 'eoc-h1' }, t('holdTitle')),
      h('p', { class: 'eoc-text' }, t('holdText')),
      h('div', { class: 'eoc-row', style: 'flex-wrap:nowrap;gap:12px' },
        h('img', { class: 'eoc-mascot', src: mascotUrl('skeptical'), alt: '', width: '150', height: '150' }),
        bubble),
      h('p', { class: 'eoc-small' }, t('holdNote'))),
    h('section', { class: 'eoc-stack', style: 'align-items:center' },
      h('div', { class: 'eoc-hold-wrap' }, svg, button),
      count));
  return { el, dispose };
}

function renderForm(initial: Settings, onSave: (s: Settings) => void, onLock: () => void): HTMLElement {
  let draft = { ...initial };
  const rows: HTMLElement[] = [];
  const steppers: Array<{ key: 'usualMinutes' | 'maxMinutes' | 'cooldownMinutes'; label: string; help: string; step: number }> = [
    { key: 'usualMinutes', label: t('setUsual'), help: t('setUsualHelp'), step: 5 },
    { key: 'maxMinutes', label: t('setMax'), help: t('setMaxHelp'), step: 15 },
    { key: 'cooldownMinutes', label: t('setCooldown'), help: t('setCooldownHelp'), step: 15 },
  ];
  const values = new Map<string, HTMLElement>();
  const switches = new Map<string, HTMLButtonElement>();
  const paint = () => {
    draft = clampSettings(draft);
    for (const s of steppers) values.get(s.key)!.textContent = minutesLabel(draft[s.key]);
    for (const [key, b] of switches) b.setAttribute('aria-checked', String(draft[key as 'pauseStopsClock' | 'closeTabOnEnd']));
  };
  for (const s of steppers) {
    const value = h('div', { class: 'eoc-stepper-value' });
    values.set(s.key, value);
    const btn = (dir: -1 | 1) => {
      const b = h('button', { type: 'button', class: 'eoc-step', 'data-step': String(dir), 'aria-label': `${dir < 0 ? t('less') : t('more')}: ${s.label}` }, dir < 0 ? '−' : '+');
      b.addEventListener('click', () => { draft = { ...draft, [s.key]: draft[s.key] + dir * s.step }; paint(); });
      return b;
    };
    rows.push(h('div', { class: 'eoc-setting', 'data-key': s.key },
      h('div', {}, h('div', { class: 'eoc-setting-label' }, s.label), h('div', { class: 'eoc-setting-help' }, s.help)),
      h('div', { class: 'eoc-row', style: 'gap:10px;flex-wrap:nowrap' }, btn(-1), value, btn(1))));
  }
  for (const [key, label, help] of [
    ['pauseStopsClock', t('setPause'), t('setPauseHelp')],
    ['closeTabOnEnd', t('setClose'), t('setCloseHelp')],
  ] as const) {
    const sw = h('button', { type: 'button', role: 'switch', class: 'eoc-switch', 'data-key': key, 'aria-label': label }, h('span', { class: 'eoc-knob' }));
    sw.addEventListener('click', () => { draft = { ...draft, [key]: !draft[key] }; paint(); });
    switches.set(key, sw);
    rows.push(h('div', { class: 'eoc-setting' },
      h('div', {}, h('div', { class: 'eoc-setting-label' }, label), h('div', { class: 'eoc-setting-help' }, help)), sw));
  }
  const lock = h('button', { type: 'button', class: 'eoc-btn', 'data-action': 'lock' }, t('lockNoSave'));
  const save = h('button', { type: 'button', class: 'eoc-btn eoc-btn--primary', 'data-action': 'save', style: 'font-size:18px;padding:12px 24px' }, t('saveLock'));
  lock.addEventListener('click', onLock);
  save.addEventListener('click', () => onSave(clampSettings(draft)));
  paint();
  return h('main', { class: 'eoc-settings' },
    h('aside', { class: 'eoc-side' },
      h('div', { class: 'eoc-bubble' }, t('settingsBubble')),
      h('img', { class: 'eoc-mascot', src: mascotUrl('skeptical'), alt: '', width: '220', height: '220' })),
    h('section', { class: 'eoc-card', style: '--card-shadow:#1F6F6B;background:#FFFDF6;width:min(760px,100%)' },
      h('div', { class: 'eoc-row', style: 'justify-content:space-between;align-items:flex-end' },
        h('div', { class: 'eoc-stack', style: 'gap:2px' },
          h('div', { class: 'eoc-eyebrow' }, t('settingsUnlocked')),
          h('h1', { class: 'eoc-h1', style: 'font-size:40px' }, t('settingsTitle'))),
        h('div', { class: 'eoc-badge' }, t('settingsBadge'))),
      ...rows,
      h('div', { class: 'eoc-always' }, h('div', { class: 'eoc-strong' }, t('alwaysOn')), h('div', {}, t('alwaysOnText'))),
      h('div', { class: 'eoc-row', style: 'justify-content:flex-end' }, lock, save)));
}

/** Mounts the settings page into `root`: the hold screen, or the form on first run / after unlocking. */
export async function initOptions(root: HTMLElement) {
  let disposeHold = () => {};
  const showHold = () => {
    const hold = renderHold(() => void showForm());
    disposeHold = hold.dispose;
    root.replaceChildren(hold.el);
  };
  const showForm = async () => {
    disposeHold();
    const current = await settingsItem.getValue();
    root.replaceChildren(renderForm(current, async (s) => {
      await settingsItem.setValue(s);
      await firstRunDoneItem.setValue(true);
      showHold();
    }, () => showHold()));
  };
  // Leaving the page relocks it.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && root.querySelector('.eoc-settings')) {
      void firstRunDoneItem.getValue().then((done) => { if (done) showHold(); });
    }
  });
  if (await firstRunDoneItem.getValue()) showHold();
  else await showForm();
  return { unlock: () => showForm(), lock: () => showHold() };
}

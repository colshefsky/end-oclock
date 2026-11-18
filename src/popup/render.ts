import { cooldownUntil, effectiveEnd, phaseOf, type Session } from '../core/session';
import { formatClock } from '../core/time';
import { t } from '../shared/i18n';
import { h, mascotUrl, type Pose } from '../ui/host';

/** The toolbar popup: status only, plus a way into settings. It can't start or extend a session. */
export function renderPopup(session: Session | null, now: number, openSettings: () => void): HTMLElement {
  const phase = phaseOf(session, now);
  let pose: Pose = 'wave';
  let title = t('popupIdleTitle');
  let text = t('popupIdleText');
  if (phase === 'active' && session) {
    pose = 'peek';
    title = t('pillDoneBy', formatClock(effectiveEnd(session, now)));
    text = t('popupActiveText');
  } else if ((phase === 'cooldown' || phase === 'end-screen') && session) {
    const until = cooldownUntil(session);
    pose = 'sleep';
    title = until != null && until > now ? t('popupCooldownTitle', formatClock(until)) : t('popupEndedTitle');
    text = until != null && until > now ? t('popupCooldownText') : t('popupEndedText');
  }
  const settings = h('button', { type: 'button', class: 'eoc-btn', style: 'font-size:16px;padding:10px 14px' }, t('popupSettings'));
  settings.addEventListener('click', openSettings);
  return h('main', { class: 'eoc-popup' },
    h('div', { class: 'eoc-row', style: 'gap:10px;flex-wrap:nowrap' },
      h('img', { src: '/icon/128.png', alt: '', width: '32', height: '32' }),
      h('div', { style: "font-family:var(--display);font-size:20px" }, t('extName'))),
    h('div', { class: 'eoc-popup-status' },
      h('img', { src: mascotUrl(pose), alt: '', width: '72', height: '72' }),
      h('div', { class: 'eoc-stack', style: 'gap:2px' },
        h('div', { style: 'font-size:19px;font-weight:700' }, title),
        h('div', { style: 'font-size:15px;color:var(--muted);line-height:1.35' }, text))),
    settings);
}

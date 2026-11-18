import { DEFAULT_SETTINGS } from '../../src/core/settings';
import { computeEnd, renderStart } from '../../src/ui/screens/start';
import type { Session } from '../../src/core/session';

const at = (d: number, h: number, m: number) => new Date(2026, 10, d, h, m).getTime();
const NOW = at(18, 23, 0);

describe('computeEnd', () => {
  test('until time after midnight', () => {
    expect(computeEnd({ mode: 'until', hhmm: '00:30' }, DEFAULT_SETTINGS, NOW)).toEqual({ ok: true, endAt: at(19, 0, 30) });
  });
  test('until time over the longest session is refused', () => {
    expect(computeEnd({ mode: 'until', hhmm: '02:00' }, DEFAULT_SETTINGS, NOW)).toEqual({ ok: false, reason: 'too-long' });
  });
  test('zero minutes is too short', () => {
    expect(computeEnd({ mode: 'for', minutes: 0 }, DEFAULT_SETTINGS, NOW)).toEqual({ ok: false, reason: 'too-short' });
  });
  test('minutes over the max are too long', () => {
    expect(computeEnd({ mode: 'for', minutes: 121 }, DEFAULT_SETTINGS, NOW)).toEqual({ ok: false, reason: 'too-long' });
  });
  test('minutes in range', () => {
    expect(computeEnd({ mode: 'for', minutes: 45 }, DEFAULT_SETTINGS, NOW)).toEqual({ ok: true, endAt: NOW + 45 * 60_000 });
  });
});

describe('renderStart', () => {
  const setup = (settings = DEFAULT_SETTINGS) => {
    const onStart = vi.fn<(s: Session) => void>();
    const onClose = vi.fn();
    const el = renderStart({ settings, now: () => NOW, onStart, onClose });
    document.body.replaceChildren(el);
    const chips = () => [...el.querySelectorAll<HTMLButtonElement>('.eoc-chip')];
    const pressed = () => chips().filter((c) => c.getAttribute('aria-pressed') === 'true').map((c) => c.dataset.minutes);
    return { el, onStart, onClose, chips, pressed };
  };

  test('the usual length chip is picked by default', () => {
    expect(setup().pressed()).toEqual(['30']);
  });

  test('chips over the longest session are not offered', () => {
    const { chips } = setup({ ...DEFAULT_SETTINGS, maxMinutes: 45, usualMinutes: 30 });
    expect(chips().map((c) => c.dataset.minutes)).toEqual(['15', '30', '45']);
  });

  test('typing custom minutes deselects the chips', () => {
    const { el, pressed } = setup();
    const input = el.querySelector<HTMLInputElement>('input[type="number"]')!;
    input.value = '20';
    input.dispatchEvent(new Event('input'));
    expect(pressed()).toEqual([]);
    expect(el.querySelector('.eoc-ends-at')!.textContent).toContain('11:20');
  });

  test('start creates a session with the intention', () => {
    const { el, onStart } = setup();
    const intent = el.querySelector<HTMLInputElement>('input[type="text"]')!;
    intent.value = '  make dinner ';
    el.querySelector<HTMLButtonElement>('.eoc-btn--primary')!.click();
    expect(onStart).toHaveBeenCalledTimes(1);
    const s = onStart.mock.calls[0]![0];
    expect(s.intention).toBe('make dinner');
    expect(s.mode).toBe('for');
    expect(s.budgetMs).toBe(30 * 60_000);
  });

  test('until mode starts an until session', () => {
    const { el, onStart } = setup();
    el.querySelectorAll<HTMLButtonElement>('.eoc-tab')[1]!.click();
    const time = el.querySelector<HTMLInputElement>('input[type="time"]')!;
    time.value = '23:45';
    time.dispatchEvent(new Event('input'));
    el.querySelector<HTMLButtonElement>('.eoc-btn--primary')!.click();
    expect(onStart.mock.calls[0]![0]).toMatchObject({ mode: 'until', untilAt: at(18, 23, 45) });
  });

  test('a too-long choice shows an error and does not start', () => {
    const { el, onStart } = setup();
    const input = el.querySelector<HTMLInputElement>('input[type="number"]')!;
    input.value = '500';
    input.dispatchEvent(new Event('input'));
    el.querySelector<HTMLButtonElement>('.eoc-btn--primary')!.click();
    expect(onStart).not.toHaveBeenCalled();
    expect(el.querySelector('.eoc-error')!.textContent).toContain('longest session');
  });

  test('close link calls onClose', () => {
    const { el, onClose } = setup();
    el.querySelector<HTMLButtonElement>('.eoc-link')!.click();
    expect(onClose).toHaveBeenCalled();
  });
});

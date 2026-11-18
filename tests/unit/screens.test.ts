import { renderEnd } from '../../src/ui/screens/end';
import { renderCooldown } from '../../src/ui/screens/cooldown';
import { renderDoesntFit } from '../../src/ui/screens/doesnt-fit';
import { mountPill, unmountPill } from '../../src/ui/pill';
import { showHelper } from '../../src/ui/helper';
import { getHost } from '../../src/ui/host';

const at = (h: number, m: number) => new Date(2026, 10, 18, h, m).getTime();

describe('end screen', () => {
  test('shows the next-up plan only when there is one', () => {
    const withPlan = renderEnd({ intention: 'make dinner', autoClose: true, onClose: vi.fn(), onDone: vi.fn() });
    expect(withPlan.textContent).toContain("That's a wrap!");
    expect(withPlan.textContent).toContain('make dinner');
    const without = renderEnd({ intention: '', autoClose: true, onClose: vi.fn(), onDone: vi.fn() });
    expect(without.textContent).not.toContain('Next up');
  });

  test('closes on its own after 15 seconds', () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    const el = renderEnd({ intention: '', autoClose: true, onClose, onDone: vi.fn() });
    document.body.append(el);
    vi.advanceTimersByTime(14_000);
    expect(onClose).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1_000);
    expect(onClose).toHaveBeenCalledTimes(1);
    el.remove();
    vi.useRealTimers();
  });

  test('without auto-close it offers Done instead', () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    const onDone = vi.fn();
    const el = renderEnd({ intention: '', autoClose: false, onClose, onDone });
    document.body.append(el);
    vi.advanceTimersByTime(20_000);
    expect(onClose).not.toHaveBeenCalled();
    [...el.querySelectorAll('button')].find((b) => b.textContent === 'Done')!.click();
    expect(onDone).toHaveBeenCalled();
    el.remove();
    vi.useRealTimers();
  });
});

test('cooldown says when the next session opens', () => {
  const el = renderCooldown({ until: at(22, 30), now: () => at(21, 38), intention: 'make dinner', onClose: vi.fn() });
  expect(el.textContent).toContain('10:30 PM');
  expect(el.textContent).toContain('52 minutes');
  expect(el.textContent).toContain('make dinner');
});

test("doesn't-fit explains length and end time", () => {
  const onShorter = vi.fn();
  const el = renderDoesntFit({ seconds: 2880, endAt: at(21, 30), onSaveLater: vi.fn(), onShorter });
  expect(el.textContent).toContain('48 minutes');
  expect(el.textContent).toContain('9:30 PM');
  [...el.querySelectorAll('button')].find((b) => b.textContent === 'Find something shorter')!.click();
  expect(onShorter).toHaveBeenCalled();
});

test('the pill shows the end time and no countdown', () => {
  const onDone = vi.fn();
  mountPill({ endAt: at(21, 30), onDone });
  const pill = getHost().querySelector('.eoc-pill')!;
  expect(pill.textContent).toContain('Done by 9:30 PM');
  expect(pill.textContent).not.toMatch(/left|remaining/i);
  pill.querySelector('button')!.click();
  expect(onDone).toHaveBeenCalled();
  unmountPill();
  expect(getHost().querySelector('.eoc-pill')).toBeNull();
});

test('the helper slides out after Got it', () => {
  vi.useFakeTimers();
  showHelper('hello there');
  const helper = getHost().querySelector('.eoc-helper')!;
  expect(helper.textContent).toContain('hello there');
  helper.querySelector('button')!.click();
  expect(helper.classList.contains('is-leaving')).toBe(true);
  vi.advanceTimersByTime(600);
  expect(getHost().querySelector('.eoc-helper')).toBeNull();
  vi.useRealTimers();
});

import { fakeBrowser } from 'wxt/testing/fake-browser';
import { createHold, HOLD_MS } from '../../src/options/hold';
import { initOptions } from '../../src/options/page';
import { settingsItem, firstRunDoneItem } from '../../src/shared/storage';
import { DEFAULT_SETTINGS } from '../../src/core/settings';

const flush = () => new Promise((r) => setTimeout(r, 10));

describe('createHold', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const setup = () => {
    const button = document.createElement('button');
    document.body.replaceChildren(button);
    const onUnlock = vi.fn();
    const progress: number[] = [];
    const dispose = createHold(button, { ms: HOLD_MS, onUnlock, onProgress: (f) => progress.push(f) });
    return { button, onUnlock, progress, dispose };
  };

  test('takes the full 60 seconds', () => {
    expect(HOLD_MS).toBe(60_000);
    const { button, onUnlock } = setup();
    button.dispatchEvent(new Event('pointerdown'));
    vi.advanceTimersByTime(59_800);
    expect(onUnlock).not.toHaveBeenCalled();
    vi.advanceTimersByTime(300);
    expect(onUnlock).toHaveBeenCalledTimes(1);
  });

  test('letting go starts over', () => {
    const { button, onUnlock, progress } = setup();
    button.dispatchEvent(new Event('pointerdown'));
    vi.advanceTimersByTime(30_000);
    button.dispatchEvent(new Event('pointerup'));
    expect(progress.at(-1)).toBe(0);
    button.dispatchEvent(new Event('pointerdown'));
    vi.advanceTimersByTime(40_000);
    expect(onUnlock).not.toHaveBeenCalled();
  });

  test('switching tabs mid-hold starts over', () => {
    const { button, onUnlock, progress } = setup();
    button.dispatchEvent(new Event('pointerdown'));
    vi.advanceTimersByTime(30_000);
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
    expect(progress.at(-1)).toBe(0);
    vi.advanceTimersByTime(40_000);
    expect(onUnlock).not.toHaveBeenCalled();
  });

  test('moving the pointer off the button starts over', () => {
    const { button, progress } = setup();
    button.dispatchEvent(new Event('pointerdown'));
    vi.advanceTimersByTime(5_000);
    button.dispatchEvent(new Event('pointerleave'));
    expect(progress.at(-1)).toBe(0);
  });
});

describe('options page', () => {
  beforeEach(() => fakeBrowser.reset());

  test('first run skips the hold and saving marks setup done', async () => {
    const root = document.createElement('div');
    await initOptions(root);
    expect(root.querySelector('.eoc-hold')).toBeNull();
    expect(root.querySelector('.eoc-settings')).not.toBeNull();
    root.querySelector<HTMLButtonElement>('[data-action="save"]')!.click();
    await flush();
    expect(await firstRunDoneItem.getValue()).toBe(true);
    expect(root.querySelector('.eoc-hold')).not.toBeNull();
  });

  test('after setup the hold screen comes first', async () => {
    await firstRunDoneItem.setValue(true);
    const root = document.createElement('div');
    await initOptions(root);
    expect(root.querySelector('.eoc-hold')).not.toBeNull();
    expect(root.querySelector('.eoc-settings')).toBeNull();
  });

  test('steppers save clamped values', async () => {
    const root = document.createElement('div');
    await initOptions(root);
    const cooldownMore = root.querySelector<HTMLButtonElement>('[data-key="cooldownMinutes"] [data-step="1"]')!;
    cooldownMore.click();
    root.querySelector<HTMLButtonElement>('[data-key="pauseStopsClock"]')!.click();
    root.querySelector<HTMLButtonElement>('[data-action="save"]')!.click();
    await flush();
    expect(await settingsItem.getValue()).toEqual({ ...DEFAULT_SETTINGS, cooldownMinutes: 75, pauseStopsClock: false });
  });

  test('lock without saving keeps the old settings', async () => {
    await firstRunDoneItem.setValue(true);
    const root = document.createElement('div');
    const page = await initOptions(root);
    await page.unlock();
    root.querySelector<HTMLButtonElement>('[data-key="cooldownMinutes"] [data-step="1"]')!.click();
    root.querySelector<HTMLButtonElement>('[data-action="lock"]')!.click();
    await flush();
    expect(await settingsItem.getValue()).toEqual(DEFAULT_SETTINGS);
    expect(root.querySelector('.eoc-hold')).not.toBeNull();
  });
});

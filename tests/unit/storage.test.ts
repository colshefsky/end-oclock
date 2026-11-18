import { fakeBrowser } from 'wxt/testing/fake-browser';
import { DEFAULT_SETTINGS, clampSettings } from '../../src/core/settings';
import { settingsItem, firstRunDoneItem, safeStorage, isContextAlive, onContextLost, resetContextForTests } from '../../src/shared/storage';

beforeEach(() => {
  fakeBrowser.reset();
  resetContextForTests();
});

test('defaults match the spec', () => {
  expect(DEFAULT_SETTINGS).toEqual({
    usualMinutes: 30,
    maxMinutes: 120,
    cooldownMinutes: 60,
    pauseStopsClock: true,
    closeTabOnEnd: true,
  });
});

test('settings round-trip through storage with defaults as fallback', async () => {
  expect(await settingsItem.getValue()).toEqual(DEFAULT_SETTINGS);
  await settingsItem.setValue({ ...DEFAULT_SETTINGS, cooldownMinutes: 15 });
  expect((await settingsItem.getValue()).cooldownMinutes).toBe(15);
  expect(await firstRunDoneItem.getValue()).toBe(false);
});

test('clampSettings keeps values in range and on steps', () => {
  expect(clampSettings({ ...DEFAULT_SETTINGS, maxMinutes: 999 }).maxMinutes).toBe(240);
  expect(clampSettings({ ...DEFAULT_SETTINGS, maxMinutes: 5 }).maxMinutes).toBe(15);
  expect(clampSettings({ ...DEFAULT_SETTINGS, usualMinutes: 200, maxMinutes: 60 }).usualMinutes).toBe(60);
  expect(clampSettings({ ...DEFAULT_SETTINGS, cooldownMinutes: -5 }).cooldownMinutes).toBe(0);
  expect(clampSettings({ ...DEFAULT_SETTINGS, usualMinutes: 33 }).usualMinutes).toBe(35);
});

test('safeStorage stops after invalidation', async () => {
  const lost = vi.fn();
  onContextLost(lost);
  const boom = () => Promise.reject(new Error('Extension context invalidated.'));
  expect(await safeStorage(boom)).toBeUndefined();
  expect(await safeStorage(boom)).toBeUndefined();
  expect(isContextAlive()).toBe(false);
  expect(lost).toHaveBeenCalledTimes(1);
});

test('safeStorage rethrows other errors', async () => {
  await expect(safeStorage(() => Promise.reject(new Error('nope')))).rejects.toThrow('nope');
  expect(isContextAlive()).toBe(true);
});

test('safeStorage returns values', async () => {
  expect(await safeStorage(() => Promise.resolve(7))).toBe(7);
});

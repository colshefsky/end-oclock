import { storage } from 'wxt/utils/storage';
import { DEFAULT_SETTINGS, type Settings } from '../core/settings';
import type { Session } from '../core/session';

export const settingsItem = storage.defineItem<Settings>('local:settings', {
  fallback: DEFAULT_SETTINGS,
});

export const sessionItem = storage.defineItem<Session | null>('local:session', {
  fallback: null,
});

export const firstRunDoneItem = storage.defineItem<boolean>('local:firstRunDone', {
  fallback: false,
});

let alive = true;
const lostCallbacks: Array<() => void> = [];

export const isContextAlive = () => alive;

export function onContextLost(cb: () => void): void {
  lostCallbacks.push(cb);
}

export function resetContextForTests(): void {
  alive = true;
  lostCallbacks.length = 0;
}

/**
 * Runs a storage call. When the extension was reloaded/removed while the page stayed open,
 * calls throw "Extension context invalidated": we stop quietly instead of erroring forever.
 */
export async function safeStorage<T>(fn: () => Promise<T>): Promise<T | undefined> {
  if (!alive) return undefined;
  try {
    return await fn();
  } catch (err) {
    if (err instanceof Error && err.message.includes('Extension context invalidated')) {
      alive = false;
      for (const cb of lostCallbacks) cb();
      return undefined;
    }
    throw err;
  }
}

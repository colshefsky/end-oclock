import type { WatchDetails } from '../core/ytdata';

/** Messages from the MAIN-world observer to the isolated content script. */
export type BridgeMsg =
  | { src: 'eoc'; kind: 'lengths'; entries: [string, number][] }
  | { src: 'eoc'; kind: 'watch'; details: WatchDetails };

const DATA_URL = /\/youtubei\/v1\/(browse|search|next|player|guide)(\?|$)/;
export const isDataUrl = (url: string) => DATA_URL.test(url);

export function postBridge(msg: BridgeMsg): void {
  window.postMessage(msg, window.location.origin);
}

function isBridgeMsg(d: unknown): d is BridgeMsg {
  if (typeof d !== 'object' || d === null) return false;
  const m = d as Record<string, unknown>;
  if (m.src !== 'eoc') return false;
  if (m.kind === 'lengths') return Array.isArray(m.entries);
  if (m.kind === 'watch') return typeof m.details === 'object' && m.details !== null;
  return false;
}

export function onBridge(cb: (msg: BridgeMsg) => void): () => void {
  const handler = (e: MessageEvent) => {
    if (e.source !== window || !isBridgeMsg(e.data)) return;
    cb(e.data);
  };
  window.addEventListener('message', handler);
  return () => window.removeEventListener('message', handler);
}

const urlOf = (input: RequestInfo | URL): string =>
  typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;

/**
 * Wraps fetch so we can read YouTube's data responses. The page always receives the original,
 * unmodified Response; we read a clone, and any error in our observer is swallowed.
 */
export function wrapFetch(orig: typeof fetch, onJson: (json: unknown, url: string) => void): typeof fetch {
  return async function eocFetch(input: RequestInfo | URL, init?: RequestInit) {
    const res = await orig(input, init);
    try {
      const url = res.url || urlOf(input);
      if (isDataUrl(url)) {
        res.clone().json().then((json) => {
          try { onJson(json, url); } catch { /* never affect YouTube */ }
        }, () => {});
      }
    } catch { /* never affect YouTube */ }
    return res;
  } as typeof fetch;
}

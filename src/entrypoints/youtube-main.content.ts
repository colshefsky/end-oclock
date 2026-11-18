import { collectLengths, readWatchDetails } from '../core/ytdata';
import { postBridge, wrapFetch, isDataUrl } from '../youtube/bridge';

/**
 * Runs in YouTube's own JS world. Passive: it reads YouTube's data and reports video lengths
 * to our isolated content script. It never modifies what YouTube receives.
 */
export default defineContentScript({
  matches: ['https://www.youtube.com/*'],
  runAt: 'document_start',
  world: 'MAIN',
  main() {
    const safe = (fn: () => void) => { try { fn(); } catch { /* never affect YouTube */ } };

    const handle = (json: unknown) => safe(() => {
      const found = new Map<string, number>();
      collectLengths(json, found);
      if (found.size) postBridge({ src: 'eoc', kind: 'lengths', entries: [...found] });
      const details = readWatchDetails(json);
      if (details) postBridge({ src: 'eoc', kind: 'watch', details });
    });

    // Initial page data: YouTube assigns these globals during load.
    for (const name of ['ytInitialData', 'ytInitialPlayerResponse'] as const) {
      safe(() => {
        const w = window as unknown as Record<string, unknown>;
        let value = w[name];
        if (value !== undefined) handle(value);
        Object.defineProperty(window, name, {
          configurable: true,
          enumerable: true,
          get: () => value,
          set: (v) => { value = v; handle(v); },
        });
      });
    }

    safe(() => { window.fetch = wrapFetch(window.fetch.bind(window), (json) => handle(json)); });

    safe(() => {
      const open = XMLHttpRequest.prototype.open;
      XMLHttpRequest.prototype.open = function (this: XMLHttpRequest, method: string, url: string | URL, ...rest: unknown[]) {
        safe(() => {
          if (isDataUrl(String(url))) {
            this.addEventListener('load', () => safe(() => {
              const body: unknown = this.responseType === 'json' ? this.response
                : this.responseType === '' || this.responseType === 'text' ? JSON.parse(this.responseText) : null;
              if (body) handle(body);
            }));
          }
        });
        return (open as (...a: unknown[]) => void).call(this, method, url, ...rest);
      } as typeof XMLHttpRequest.prototype.open;
    });

    document.addEventListener('yt-navigate-finish', (e) => safe(() => {
      const detail = (e as CustomEvent).detail as { response?: { playerResponse?: unknown; response?: unknown } } | undefined;
      if (detail?.response?.response) handle(detail.response.response);
      if (detail?.response?.playerResponse) handle(detail.response.playerResponse);
    }));
  },
});

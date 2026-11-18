import { fakeBrowser } from 'wxt/testing/fake-browser';
import messages from '../../public/_locales/en/messages.json';

type Messages = Record<string, { message: string }>;

/** fakeBrowser has no i18n; serve the real English strings so tests read like the product. */
export function installI18n(): void {
  (fakeBrowser.i18n as unknown as { getMessage: unknown }).getMessage = (key: string, subs?: string | string[]) => {
    const m = (messages as Messages)[key]?.message ?? '';
    const list = subs == null ? [] : Array.isArray(subs) ? subs : [subs];
    return m.replace(/\$(\d)/g, (_, n: string) => list[Number(n) - 1] ?? '');
  };
}

installI18n();
beforeEach(() => installI18n());

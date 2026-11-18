/** Looks up a string in public/_locales. Falls back to the key so missing strings are visible. */
export function t(key: string, ...subs: string[]): string {
  const msg = browser.i18n.getMessage(key as never, subs);
  return msg || key;
}

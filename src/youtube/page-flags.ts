const html = () => document.documentElement;

/** Sets the html[data-eoc-*] attributes that page.css keys off. */
export function setFlags(flags: { gate: boolean; session: boolean }): void {
  const el = html();
  el.setAttribute('data-eoc-ext', '1');
  el.toggleAttribute('data-eoc-gate', flags.gate);
  el.toggleAttribute('data-eoc-session', flags.session);
}

/** The extension was reloaded or removed: stop hiding YouTube. */
export function markOff(): void {
  html().setAttribute('data-eoc-off', '');
}

/** /shorts/<id> → YouTube home. Anything else → null. */
export function shortsRedirect(url: string): string | null {
  try {
    const u = new URL(url);
    return u.pathname.startsWith('/shorts/') ? 'https://www.youtube.com/' : null;
  } catch {
    return null;
  }
}

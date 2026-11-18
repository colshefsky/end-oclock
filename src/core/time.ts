const LENGTH_RE = /^(?:(\d+):)?([0-5]?\d):([0-5]\d)$/;

/** Parses YouTube length badges like "3:15" or "1:02:03" into seconds. */
export function parseLength(text: string): number | null {
  const m = LENGTH_RE.exec(text.replace(/[\s  ]+/g, ''));
  if (!m) return null;
  return Number(m[1] ?? 0) * 3600 + Number(m[2]) * 60 + Number(m[3]);
}

/** The next time the clock reads hh:mm, strictly after `now` (today or tomorrow). */
export function nextOccurrence(hhmm: string, now: number): number {
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date(now);
  d.setHours(h ?? 0, m ?? 0, 0, 0);
  if (d.getTime() <= now) d.setDate(d.getDate() + 1);
  return d.getTime();
}

export function formatClock(ts: number, locale?: string): string {
  return new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit' })
    .format(ts)
    .replace(/[  ]/g, ' ');
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** "48 minutes", "1 hour 5 minutes", "2 hours". */
export function formatLength(seconds: number): string {
  const total = Math.round(seconds / 60);
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return plural(m, 'minute');
  return m === 0 ? plural(h, 'hour') : `${plural(h, 'hour')} ${plural(m, 'minute')}`;
}

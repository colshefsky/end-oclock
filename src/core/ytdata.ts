import { parseLength } from './time';
import { YT_PATHS } from '../youtube/selectors';

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null;

export interface WatchDetails {
  videoId: string;
  lengthSeconds: number | null;
  isLive: boolean;
}

/** Text of a YouTube text object: { simpleText } or { runs: [{ text }] } or a plain string. */
function textOf(v: unknown): string | null {
  if (typeof v === 'string') return v;
  if (!isObj(v)) return null;
  if (typeof v.simpleText === 'string') return v.simpleText;
  if (Array.isArray(v.runs)) return v.runs.map((r) => (isObj(r) && typeof r.text === 'string' ? r.text : '')).join('');
  return null;
}

/** First parseable length found under `key` objects anywhere inside `root`. */
function findLength(root: unknown, key: string, read: (o: Obj) => unknown): number | null {
  const stack: unknown[] = [root];
  while (stack.length) {
    const v = stack.pop();
    if (Array.isArray(v)) { stack.push(...v); continue; }
    if (!isObj(v)) continue;
    const hit = v[key];
    if (isObj(hit)) {
      const t = textOf(read(hit));
      const secs = t == null ? null : parseLength(t);
      if (secs != null) return secs;
    }
    for (const child of Object.values(v)) stack.push(child);
  }
  return null;
}

function legacyLength(r: Obj): number | null {
  if (typeof r.lengthSeconds === 'string' && /^\d+$/.test(r.lengthSeconds)) return Number(r.lengthSeconds);
  const t = textOf(r.lengthText);
  const fromText = t == null ? null : parseLength(t);
  if (fromText != null) return fromText;
  return findLength(r.thumbnailOverlays, YT_PATHS.legacyTimeOverlay, (o) => o.text);
}

/** Walks any YouTube JSON and records videoId → seconds for every video with a known length. Read-only. */
export function collectLengths(json: unknown, into: Map<string, number>): void {
  const stack: unknown[] = [json];
  while (stack.length) {
    const v = stack.pop();
    if (Array.isArray(v)) { stack.push(...v); continue; }
    if (!isObj(v)) continue;
    const lockup = v[YT_PATHS.lockup];
    if (isObj(lockup) && typeof lockup[YT_PATHS.lockupId] === 'string') {
      const secs = findLength(lockup.contentImage, YT_PATHS.badgeViewModel, (o) => o.text);
      if (secs != null) into.set(lockup[YT_PATHS.lockupId] as string, secs);
    }
    for (const name of YT_PATHS.legacyVideoRenderers) {
      const r = v[name];
      if (isObj(r) && typeof r.videoId === 'string') {
        const secs = legacyLength(r);
        if (secs != null) into.set(r.videoId, secs);
      }
    }
    for (const child of Object.values(v)) stack.push(child);
  }
}

/** Reads the watch page's own video facts from a player response (or a response that nests one). */
export function readWatchDetails(json: unknown): WatchDetails | null {
  if (!isObj(json)) return null;
  const vd = isObj(json[YT_PATHS.videoDetails])
    ? (json[YT_PATHS.videoDetails] as Obj)
    : isObj(json.playerResponse) && isObj((json.playerResponse as Obj)[YT_PATHS.videoDetails])
      ? ((json.playerResponse as Obj)[YT_PATHS.videoDetails] as Obj)
      : null;
  if (!vd || typeof vd.videoId !== 'string') return null;
  const isLive = vd.isLive === true || (vd.isLiveContent === true && (vd.lengthSeconds ?? '0') === '0');
  const n = typeof vd.lengthSeconds === 'string' ? Number(vd.lengthSeconds) : NaN;
  return { videoId: vd.videoId, lengthSeconds: isLive || !(n > 0) ? null : n, isLive };
}

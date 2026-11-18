import { parseLength } from '../core/time';
import { SEL } from './selectors';

export type TileKind = 'video' | 'live' | 'collection' | 'short';

export interface TileInfo {
  videoId: string | null;
  kind: TileKind;
  seconds: number | null;
}

function videoIdOf(el: Element): string | null {
  const a = el.querySelector(SEL.watchLink);
  if (!a) return null;
  try {
    return new URL(a.getAttribute('href') ?? '', 'https://www.youtube.com').searchParams.get('v');
  } catch {
    return null;
  }
}

const COLLECTION_TEXT = /^(mix|playlist|\d[\d,.]*\s+videos?)$/i;

export function readTile(el: Element, lengths: Map<string, number>): TileInfo {
  if (el.matches(SEL.shortInside) || el.querySelector(SEL.shortInside)) {
    return { videoId: null, kind: 'short', seconds: null };
  }
  const videoId = videoIdOf(el);
  if (el.matches(SEL.collectionTile) || el.querySelector(SEL.collectionInside)) {
    return { videoId, kind: 'collection', seconds: null };
  }
  let live = el.querySelector(SEL.liveBadge) != null;
  let collection = false;
  for (const b of el.querySelectorAll(SEL.badgeText)) {
    const text = (b.textContent ?? '').trim();
    const secs = parseLength(text);
    if (secs != null) return { videoId, kind: 'video', seconds: secs };
    if (/^(live|upcoming|premiere)/i.test(text)) live = true;
    if (COLLECTION_TEXT.test(text)) collection = true;
  }
  if (live) return { videoId, kind: 'live', seconds: null };
  const link = el.querySelector(SEL.watchLink)?.getAttribute('href') ?? '';
  if (collection || /[?&]list=/.test(link)) {
    const known = videoId ? lengths.get(videoId) : undefined;
    if (!collection && known != null) return { videoId, kind: 'video', seconds: known };
    return { videoId, kind: 'collection', seconds: null };
  }
  return { videoId, kind: 'video', seconds: videoId ? lengths.get(videoId) ?? null : null };
}

export function verdict(t: TileInfo, timeLeftMs: number): 'show' | 'hide' {
  if (t.kind === 'short') return 'hide';
  if (t.kind === 'live' || t.kind === 'collection') return 'show';
  return t.seconds != null && t.seconds * 1000 <= timeLeftMs ? 'show' : 'hide';
}

/** Marks every outermost tile under `root` with data-eoc-tile="show" | "hide". Re-reads each pass. */
export function applyTiles(root: ParentNode, timeLeftMs: number, lengths: Map<string, number>): void {
  for (const el of root.querySelectorAll(SEL.tile)) {
    if (el.parentElement?.closest(SEL.tile)) continue;
    const v = verdict(readTile(el, lengths), timeLeftMs);
    if (el.getAttribute('data-eoc-tile') !== v) el.setAttribute('data-eoc-tile', v);
  }
}

/** Search/home filter chips can only be told apart by their text: hide the "Shorts" one. */
export function hideShortsChips(root: ParentNode): void {
  for (const chip of root.querySelectorAll<HTMLElement>(SEL.chip)) {
    if (!chip.hidden && chip.textContent?.trim() === 'Shorts') chip.hidden = true;
  }
}

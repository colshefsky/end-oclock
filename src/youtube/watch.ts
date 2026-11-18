import type { WatchDetails } from '../core/ytdata';
import { SEL } from './selectors';

export interface WatchDeps {
  getTimeLeft(): number;
  isTimeUp(): boolean;
  onCommit(c: { videoId: string; live: boolean; remainingMs: number }): void;
  onDoesntFit(info: { videoId: string; seconds: number }): void;
  onMovedOn(): void;
  onPlayState(playing: boolean): void;
  onEnded(): void;
  onLeave(): void;
}

/** Wait this long for YouTube's own data before trusting <video>.duration. */
const FALLBACK_AFTER_MS = 2500;

export const currentVideoId = (): string | null =>
  location.pathname === '/watch' ? new URLSearchParams(location.search).get('v') : null;

export function createWatchMonitor(deps: WatchDeps) {
  const details = new Map<string, WatchDetails>();
  let seenId: string | null = null;
  let seenAt = 0;
  let decidedId: string | null = null;
  let committedId: string | null = null;
  let playing: boolean | null = null;
  let endedReported = false;

  const video = () => document.querySelector<HTMLVideoElement>(SEL.mainVideo);

  function decide(id: string, v: HTMLVideoElement): void {
    const d = details.get(id);
    let live = d?.isLive ?? false;
    let seconds = d?.lengthSeconds ?? null;
    if (!d) {
      if (Date.now() - seenAt < FALLBACK_AFTER_MS) return;
      if (v.duration === Infinity) live = true;
      else if (Number.isFinite(v.duration) && v.duration > 0) seconds = v.duration;
      else return;
    }
    if (!live && seconds == null) return;
    decidedId = id;
    if (deps.isTimeUp()) {
      v.pause();
      deps.onMovedOn();
      return;
    }
    if (live) {
      commit(id, true, 0);
      return;
    }
    const remainingMs = Math.max(0, Math.round((seconds! - (v.currentTime || 0)) * 1000));
    if (remainingMs <= deps.getTimeLeft()) commit(id, false, remainingMs);
    else {
      v.pause();
      deps.onDoesntFit({ videoId: id, seconds: seconds! });
    }
  }

  function commit(id: string, live: boolean, remainingMs: number): void {
    committedId = id;
    playing = null;
    endedReported = false;
    deps.onCommit({ videoId: id, live, remainingMs });
  }

  return {
    handleDetails(d: WatchDetails): void {
      details.set(d.videoId, d);
    },
    tick(): void {
      const id = currentVideoId();
      if (id !== seenId) {
        if (committedId && committedId !== id) {
          committedId = null;
          deps.onLeave();
        }
        seenId = id;
        seenAt = Date.now();
        decidedId = null;
      }
      if (!id) return;
      const v = video();
      if (!v) return;
      if (v.loop) v.loop = false;
      document.querySelector<HTMLElement>(SEL.autoplayOn)?.click();
      if (document.querySelector(`${SEL.player}${SEL.adShowing}`)) return;
      if (decidedId !== id) decide(id, v);
      if (committedId !== id) return;
      const now = !v.paused && !v.ended;
      if (now !== playing) {
        playing = now;
        deps.onPlayState(now);
      }
      if (v.ended && !endedReported) {
        endedReported = true;
        deps.onEnded();
      }
    },
    /** The id of the video this tab committed to, if still on it. */
    committed: () => committedId,
    dispose(): void {
      details.clear();
    },
  };
}

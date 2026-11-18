export interface Settings {
  usualMinutes: number;
  maxMinutes: number;
  cooldownMinutes: number;
  pauseStopsClock: boolean;
  closeTabOnEnd: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  usualMinutes: 30,
  maxMinutes: 120,
  cooldownMinutes: 60,
  pauseStopsClock: true,
  closeTabOnEnd: true,
};

const step = (v: number, size: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, Math.round(v / size) * size));

export function clampSettings(s: Settings): Settings {
  const maxMinutes = step(s.maxMinutes, 15, 15, 240);
  return {
    maxMinutes,
    usualMinutes: step(s.usualMinutes, 5, 5, maxMinutes),
    cooldownMinutes: step(s.cooldownMinutes, 15, 0, 240),
    pauseStopsClock: Boolean(s.pauseStopsClock),
    closeTabOnEnd: Boolean(s.closeTabOnEnd),
  };
}

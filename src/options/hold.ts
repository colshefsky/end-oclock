export const HOLD_MS = 60_000;
const TICK_MS = 100;

/**
 * Press-and-hold for `ms`. Letting go, sliding off, switching tabs or losing window focus starts over.
 * Space/Enter held down works too (keyboard users). Returns a dispose function.
 */
export function createHold(
  button: HTMLElement,
  opts: { ms: number; onUnlock(): void; onProgress(fraction: number, heldMs: number): void },
): () => void {
  let startedAt: number | null = null;
  let timer: ReturnType<typeof setInterval> | undefined;

  const reset = () => {
    if (timer) clearInterval(timer);
    timer = undefined;
    startedAt = null;
    button.classList.remove('is-held');
    opts.onProgress(0, 0);
  };

  const begin = () => {
    if (startedAt != null) return;
    startedAt = Date.now();
    button.classList.add('is-held');
    timer = setInterval(() => {
      const held = Date.now() - (startedAt ?? Date.now());
      if (held >= opts.ms) {
        reset();
        opts.onUnlock();
      } else opts.onProgress(held / opts.ms, held);
    }, TICK_MS);
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); begin(); }
  };
  const onKeyUp = (e: KeyboardEvent) => {
    if (e.key === ' ' || e.key === 'Enter') reset();
  };
  const onVisibility = () => { if (document.visibilityState === 'hidden') reset(); };

  button.addEventListener('pointerdown', begin);
  for (const type of ['pointerup', 'pointerleave', 'pointercancel']) button.addEventListener(type, reset);
  button.addEventListener('keydown', onKeyDown);
  button.addEventListener('keyup', onKeyUp);
  button.addEventListener('blur', reset);
  button.addEventListener('contextmenu', (e) => e.preventDefault());
  window.addEventListener('blur', reset);
  document.addEventListener('visibilitychange', onVisibility);

  return () => {
    reset();
    button.removeEventListener('pointerdown', begin);
    for (const type of ['pointerup', 'pointerleave', 'pointercancel']) button.removeEventListener(type, reset);
    button.removeEventListener('keydown', onKeyDown);
    button.removeEventListener('keyup', onKeyUp);
    button.removeEventListener('blur', reset);
    window.removeEventListener('blur', reset);
    document.removeEventListener('visibilitychange', onVisibility);
  };
}

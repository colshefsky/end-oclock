import themeCss from './theme.css?inline';

export type Pose = 'wave' | 'peek' | 'bow' | 'sleep' | 'skeptical' | 'shrug';

let hostEl: HTMLElement | null = null;
let shadow: ShadowRoot | null = null;
let blocking = false;

export const mascotUrl = (pose: Pose) => browser.runtime.getURL(`/mascot/${pose}.png` as never);

/** Fonts must be declared in the document: @font-face inside a shadow root is ignored by Chrome. */
function ensureFonts(): void {
  if (document.getElementById('eoc-fonts')) return;
  const url = (f: string) => browser.runtime.getURL(`/fonts/${f}` as never);
  const style = document.createElement('style');
  style.id = 'eoc-fonts';
  style.textContent = [
    `@font-face{font-family:'EOC Bowlby';src:url(${url('bowlby-one-400.woff2')}) format('woff2');font-weight:400;font-display:swap}`,
    ...[400, 500, 600, 700].map((w) =>
      `@font-face{font-family:'EOC Fredoka';src:url(${url(`fredoka-${w}.woff2`)}) format('woff2');font-weight:${w};font-display:swap}`),
  ].join('\n');
  (document.head ?? document.documentElement).append(style);
}

/** Our UI lives in a shadow root on <body>, so YouTube's CSS can't touch it and fullscreen hides it. */
export function getHost(): ShadowRoot {
  if (!hostEl || !shadow) {
    hostEl = document.createElement('eoc-root');
    hostEl.setAttribute('style', 'all:initial;position:fixed;inset:0;z-index:2147483647;pointer-events:none;display:block');
    shadow = hostEl.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = themeCss;
    const screen = document.createElement('div');
    screen.className = 'eoc-screen';
    const overlay = document.createElement('div');
    overlay.className = 'eoc-overlay';
    shadow.append(style, screen, overlay);
    // Our own keystrokes (typing in the start screen) must not reach YouTube's hotkeys.
    for (const type of ['keydown', 'keyup', 'keypress']) hostEl.addEventListener(type, (e) => e.stopPropagation());
    ensureFonts();
  }
  const parent = document.body ?? document.documentElement;
  if (hostEl.parentNode !== parent) parent.append(hostEl);
  return shadow;
}

const fromUs = (e: Event) => hostEl != null && e.composedPath().includes(hostEl);

function blockKeys(e: KeyboardEvent): void {
  if (blocking && !fromUs(e)) e.stopImmediatePropagation();
}

function holdPaused(e: Event): void {
  if (blocking && e.target instanceof HTMLVideoElement) e.target.pause();
}

function setBlocking(on: boolean): void {
  if (on === blocking) return;
  blocking = on;
  const method = on ? 'addEventListener' : 'removeEventListener';
  for (const type of ['keydown', 'keyup', 'keypress'] as const) window[method](type, blockKeys as EventListener, true);
  document[method]('play', holdPaused, true);
  if (on) {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    for (const v of document.querySelectorAll('video')) v.pause();
  }
}

export const isBlocking = () => blocking;

/** Shows one full-page screen. Blocking screens pause video, exit fullscreen and swallow YouTube hotkeys. */
export function showScreen(el: HTMLElement, opts: { blocking: boolean }): void {
  const slot = getHost().querySelector('.eoc-screen')!;
  slot.replaceChildren(el);
  setBlocking(opts.blocking);
}

export function clearScreen(): void {
  shadow?.querySelector('.eoc-screen')?.replaceChildren();
  setBlocking(false);
}

/** Layer for the pill and helper (above YouTube, below nothing). */
export const overlayLayer = (): HTMLElement => getHost().querySelector('.eoc-overlay') as HTMLElement;

/** Tiny DOM helper for building screens. */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Partial<Record<string, string>> = {},
  ...children: Array<Node | string | null | false>
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) if (v != null) el.setAttribute(k, v);
  for (const c of children) if (c !== null && c !== false) el.append(c);
  return el;
}

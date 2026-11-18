// Live check: starts a real Chromium-family browser (throwaway profile), attaches over CDP and loads the
// unpacked build with Extensions.loadUnpacked (branded Chrome ignores --load-extension).
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const EXT = resolve('.output/chrome-mv3');
const browsers = {
  chrome: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  vivaldi: '/Applications/Vivaldi.app/Contents/MacOS/Vivaldi',
  arc: '/Applications/Arc.app/Contents/MacOS/Arc',
  ardia: '/Applications/Ardia.app/Contents/MacOS/Ardia',
};

export async function launch(name = 'chrome', port = 9333) {
  const profile = mkdtempSync(join(tmpdir(), 'eoc-live-'));
  const proc = spawn(browsers[name], [
    `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--enable-unsafe-extension-debugging',
    '--no-first-run', '--no-default-browser-check', '--window-size=1280,860', '--autoplay-policy=no-user-gesture-required', 'about:blank',
  ], { stdio: 'ignore' });
  let browser;
  for (let i = 0; i < 40 && !browser; i++) {
    await new Promise((r) => setTimeout(r, 250));
    browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`).catch(() => undefined);
  }
  if (!browser) throw new Error('could not connect');
  const cdp = await browser.newBrowserCDPSession();
  const { id: extId } = await cdp.send('Extensions.loadUnpacked', { path: EXT });
  const ctx = browser.contexts()[0];
  const close = async () => { await browser.close().catch(() => {}); proc.kill(); };
  const storage = async () => {
    const p = await ctx.newPage();
    await p.goto(`chrome-extension://${extId}/options.html`);
    const data = await p.evaluate(() => chrome.storage.local.get(null));
    await p.close();
    return data;
  };
  return { browser: { close }, ctx, extId, cdp, storage };
}

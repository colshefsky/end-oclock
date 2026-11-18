import { test as base, chromium, type BrowserContext } from '@playwright/test';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const EXT = resolve('.output/chrome-mv3');
const FIX = resolve('tests/e2e/fixtures');

/** Serves our saved YouTube-like pages for https://www.youtube.com/* so tests never hit the real site. */
async function routeYouTube(ctx: BrowserContext) {
  await ctx.route('https://www.youtube.com/**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/clip.webm') return route.fulfill({ path: join(FIX, 'clip.webm'), contentType: 'video/webm' });
    if (url.pathname.startsWith('/youtubei/')) return route.fulfill({ json: {} });
    const file = url.pathname === '/watch' ? 'watch.html' : 'home.html';
    let html = readFileSync(join(FIX, file), 'utf8');
    if (url.pathname === '/watch') {
      const v = url.searchParams.get('v') ?? 'short1';
      const lengths: Record<string, string> = { short1: '10', long1: '2880' };
      html = html.replaceAll('__ID__', v).replaceAll('__LEN__', lengths[v] ?? '10');
    }
    return route.fulfill({ body: html, contentType: 'text/html' });
  });
  await ctx.route(/^https:\/\/(?!www\.youtube\.com)/, (route) => route.abort());
}

export const test = base.extend<{ context: BrowserContext; extensionId: string }>({
  context: async ({}, use) => {
    const ctx = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), 'eoc-e2e-')), {
      channel: 'chromium',
      headless: true,
      args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`, '--autoplay-policy=no-user-gesture-required'],
    });
    await routeYouTube(ctx);
    // Installing opens the welcome page; let it open and close it so it can't take over a test tab.
    const welcome = await ctx.waitForEvent('page', { predicate: (p) => p.url().includes('options.html'), timeout: 5000 }).catch(() => null);
    await welcome?.close();
    await use(ctx);
    await ctx.close();
  },
  extensionId: async ({ context }, use) => {
    let [sw] = context.serviceWorkers();
    if (!sw) sw = await context.waitForEvent('serviceworker');
    await use(new URL(sw.url()).host);
  },
});
export const expect = test.expect;

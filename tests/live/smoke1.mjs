import { launch } from './launch.mjs';
const name = process.argv[2] ?? 'chrome';
const shots = process.argv[3];
const { browser, ctx, extId } = await launch(name, 9444);
console.log('extension loaded:', extId);
const page = ctx.pages()[0] ?? await ctx.newPage();
// Install opens the options page in a new tab; keep it.
await page.goto('https://www.youtube.com/', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(4000);
await page.screenshot({ path: `${shots}/1-gate.png` });
const gate = await page.evaluate(() => {
  const host = document.querySelector('eoc-root');
  return { host: !!host, text: host?.shadowRoot?.querySelector('.eoc-screen')?.textContent?.slice(0, 80), flags: document.documentElement.getAttributeNames().filter((a) => a.startsWith('data-eoc')) };
});
console.log('gate:', JSON.stringify(gate));
// Start a 20 minute session through the UI.
await page.evaluate(() => {
  const root = document.querySelector('eoc-root').shadowRoot;
  const custom = root.querySelector('input[type="number"]');
  custom.value = '20';
  custom.dispatchEvent(new Event('input'));
  root.querySelector('.eoc-btn--primary').click();
});
await page.waitForTimeout(6000);
await page.screenshot({ path: `${shots}/2-home-session.png` });
const tiles = await page.evaluate(() => {
  const all = [...document.querySelectorAll('[data-eoc-tile]')];
  const tags = {};
  for (const el of document.querySelectorAll('ytd-rich-item-renderer, yt-lockup-view-model, ytd-rich-shelf-renderer, ytd-reel-shelf-renderer, grid-shelf-view-model, ytm-shorts-lockup-view-model, ytm-shorts-lockup-view-model-v2')) tags[el.tagName.toLowerCase()] = (tags[el.tagName.toLowerCase()] ?? 0) + 1;
  const sample = all.slice(0, 12).map((e) => ({ v: e.getAttribute('data-eoc-tile'), badge: [...e.querySelectorAll('.ytBadgeShapeText, badge-shape, yt-thumbnail-badge-view-model')].map((b) => b.textContent.trim()).filter(Boolean).slice(0, 2).join('|'), href: e.querySelector('a[href]')?.getAttribute('href')?.slice(0, 40) }));
  const visibleShorts = [...document.querySelectorAll('a[href^="/shorts/"]')].filter((a) => a.offsetParent !== null).length;
  return { marked: all.length, show: all.filter((e) => e.getAttribute('data-eoc-tile') === 'show').length, tags, sample, visibleShorts };
});
console.log('tiles:', JSON.stringify(tiles, null, 1));
await browser.close();

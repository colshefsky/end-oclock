import { launch } from './launch.mjs';
const name = process.argv[2] ?? 'chrome';
const shots = process.argv[3];
const { browser, ctx } = await launch(name);
const page = await ctx.newPage();
const root = () => page.evaluate(() => document.querySelector('eoc-root')?.shadowRoot?.querySelector('.eoc-screen')?.textContent?.replace(/\s+/g, ' ').slice(0, 90) ?? null);
const tileStats = () => page.evaluate(() => {
  const parse = (t) => { const m = /^(?:(\d+):)?(\d{1,2}):(\d{2})$/.exec(t.trim()); return m ? (+(m[1] ?? 0)) * 3600 + +m[2] * 60 + +m[3] : null; };
  const out = { show: 0, hide: 0, visibleTooLong: [], visibleUnknown: 0, hiddenFits: 0, longHref: null, shortHref: null, unmarkedVisible: 0 };
  for (const el of document.querySelectorAll('[data-eoc-tile]')) {
    const v = el.getAttribute('data-eoc-tile');
    out[v]++;
    const badge = [...el.querySelectorAll('.ytBadgeShapeText, .yt-badge-shape__text, ytd-thumbnail-overlay-time-status-renderer #text, badge-shape')].map((b) => b.textContent.trim()).find((t) => parse(t) != null);
    const secs = badge ? parse(badge) : null;
    const href = el.querySelector('a[href*="watch?v="]')?.getAttribute('href');
    if (v === 'show' && secs != null && secs > 20 * 60) out.visibleTooLong.push(badge);
    if (secs != null && secs > 25 * 60 && href && !out.longHref) out.longHref = href;
    if (secs != null && secs < 8 * 60 && secs > 60 && v === 'show' && href && !out.shortHref) out.shortHref = href;
  }
  out.unmarkedVisible = [...document.querySelectorAll('ytd-video-renderer, yt-lockup-view-model, ytd-rich-item-renderer')].filter((e) => !e.parentElement.closest('[data-eoc-tile]') && !e.hasAttribute('data-eoc-tile') && e.offsetParent !== null).length;
  out.visibleShorts = [...document.querySelectorAll('a[href^="/shorts/"]')].filter((a) => a.offsetParent !== null).length;
  return out;
});
await page.goto('https://www.youtube.com/', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(3000);
await page.screenshot({ path: `${shots}/a1-gate.png` });
await page.evaluate(() => {
  const r = document.querySelector('eoc-root').shadowRoot;
  const c = r.querySelector('input[type="number"]'); c.value = '20'; c.dispatchEvent(new Event('input'));
  r.querySelector('input[type="text"]').value = 'make dinner';
  r.querySelector('.eoc-btn--primary').click();
});
await page.waitForTimeout(1500);
await page.goto('https://www.youtube.com/results?search_query=how+to+make+pasta', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(7000);
await page.mouse.wheel(0, 2500);
await page.waitForTimeout(3000);
await page.mouse.wheel(0, -2500);
await page.waitForTimeout(1000);
const s1 = await tileStats();
console.log('search:', JSON.stringify(s1));
await page.screenshot({ path: `${shots}/a2-search.png` });
if (s1.longHref) {
  await page.goto('https://www.youtube.com' + s1.longHref, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(9000);
  console.log('long video screen:', await root());
  await page.screenshot({ path: `${shots}/a3-doesnt-fit.png` });
}
if (s1.shortHref) {
  await page.goto('https://www.youtube.com' + s1.shortHref, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(12000);
  console.log('short video screen:', await root());
  const v = await page.evaluate(() => { const v = document.querySelector('#movie_player video'); return v && { paused: v.paused, t: v.currentTime.toFixed(1), d: v.duration, ad: document.querySelector('#movie_player')?.classList.contains('ad-showing'), loop: v.loop, autoplay: document.querySelector('.ytp-autonav-toggle-button')?.getAttribute('aria-checked') }; });
  console.log('video:', JSON.stringify(v));
  const side = await tileStats();
  console.log('sidebar:', JSON.stringify(side));
  await page.screenshot({ path: `${shots}/a4-watch.png` });
  const session = await page.evaluate(async () => null);
  await page.evaluate(() => document.querySelector('eoc-root').shadowRoot.querySelector('.eoc-pill button').click());
  await page.waitForTimeout(2500);
  console.log('after done:', await root());
  await page.screenshot({ path: `${shots}/a5-end.png` });
  await page.goto('https://www.youtube.com/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
  console.log('after reload:', await root());
  await page.screenshot({ path: `${shots}/a6-cooldown.png` });
}
await browser.close();

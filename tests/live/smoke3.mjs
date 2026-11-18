import { launch } from './launch.mjs';
const shots = process.argv[3];
const { browser, ctx, storage } = await launch(process.argv[2] ?? 'chrome');
const page = await ctx.newPage();
const screen = () => page.evaluate(() => document.querySelector('eoc-root')?.shadowRoot?.querySelector('.eoc-screen')?.textContent?.replace(/\s+/g, ' ').slice(0, 90) ?? '');
const videoState = () => page.evaluate(() => { const v = document.querySelector('#movie_player video'); return v && { paused: v.paused, t: +v.currentTime.toFixed(1), d: v.duration, ad: document.querySelector('#movie_player')?.classList.contains('ad-showing') }; });
await page.goto('https://www.youtube.com/', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);
await page.evaluate(() => {
  const r = document.querySelector('eoc-root').shadowRoot;
  const c = r.querySelector('input[type="number"]'); c.value = '20'; c.dispatchEvent(new Event('input'));
  r.querySelector('.eoc-btn--primary').click();
});
await page.waitForTimeout(1000);
// 1) A long video by direct link (Bon Appetit pasta shapes, ~25 min).
await page.goto('https://www.youtube.com/watch?v=Ew-3-8itpjc', { waitUntil: 'domcontentloaded' });
for (let i = 0; i < 20 && !(await screen()); i++) await page.waitForTimeout(2000);
console.log('LONG screen:', await screen(), JSON.stringify(await videoState()));
await page.screenshot({ path: `${shots}/b1-long.png` });
// 2) A short video (Epicurious? use a ~1.5 min one from earlier).
await page.goto('https://www.youtube.com/watch?v=UYhKDweME3A', { waitUntil: 'domcontentloaded' });
let committed = null;
for (let i = 0; i < 20 && !committed; i++) {
  await page.waitForTimeout(2000);
  const s = (await storage()).session;
  committed = s && Object.values(s.committed)[0];
}
console.log('SHORT committed:', JSON.stringify(committed), 'screen:', JSON.stringify(await screen()), JSON.stringify(await videoState()));
await page.screenshot({ path: `${shots}/b2-short.png` });
// pause → clock pauses
await page.evaluate(() => document.querySelector('#movie_player video').pause());
await page.waitForTimeout(2500);
const s2 = (await storage()).session;
console.log('after pause: clockPausedSince set:', s2.clockPausedSince != null, 'committed playing:', Object.values(s2.committed)[0]?.playing);
await page.evaluate(() => document.querySelector('#movie_player video').play());
await page.waitForTimeout(2500);
const s3 = (await storage()).session;
console.log('after play: clockPausedSince:', s3.clockPausedSince, 'pausedMs>0:', s3.pausedMs > 0);
// Fullscreen hides the pill
await page.evaluate(() => document.querySelector('#movie_player').requestFullscreen().catch((e) => String(e)));
await page.waitForTimeout(1500);
console.log('fullscreen element:', await page.evaluate(() => document.fullscreenElement?.id), 'pill visible:', await page.evaluate(() => { const p = document.querySelector('eoc-root').shadowRoot.querySelector('.eoc-pill'); const r = p?.getBoundingClientRect(); return !!document.fullscreenElement === false && !!r; }));
await page.screenshot({ path: `${shots}/b3-fullscreen.png` });
await page.evaluate(() => document.exitFullscreen().catch(() => {}));
await browser.close();

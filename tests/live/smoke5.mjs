// Natural ending: a 2-minute session; a ~1.5 min video plays to the end; the session should wrap up by itself.
import { launch } from './launch.mjs';
const { browser, ctx, storage } = await launch(process.argv[2] ?? 'chrome', Number(process.argv[3] ?? 9333));
const page = await ctx.newPage();
const screen = () => page.evaluate(() => document.querySelector('eoc-root')?.shadowRoot?.querySelector('.eoc-screen')?.textContent?.replace(/\s+/g, ' ').slice(0, 70) ?? '');
await page.goto('https://www.youtube.com/', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);
console.log('gate:', await screen());
await page.evaluate(() => {
  const r = document.querySelector('eoc-root').shadowRoot;
  const c = r.querySelector('input[type="number"]'); c.value = '2'; c.dispatchEvent(new Event('input'));
  r.querySelector('.eoc-btn--primary').click();
});
await page.waitForTimeout(1000);
await page.goto('https://www.youtube.com/watch?v=UYhKDweME3A', { waitUntil: 'domcontentloaded' });
const t0 = Date.now();
let ended = '';
while (Date.now() - t0 < 200_000) {
  await page.waitForTimeout(5000);
  const s = await screen();
  if (s.includes("wrap")) { ended = s; break; }
}
const sess = (await storage()).session;
console.log('ended screen:', ended, '| reason:', sess?.endReason, '| after start (s):', sess ? Math.round((sess.endedAt - sess.startedAt) / 1000) : null);
await browser.close();

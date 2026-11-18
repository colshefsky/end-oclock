// A YouTube tab opened BEFORE the extension is installed should reload onto the start screen.
import { launch } from './launch.mjs';
let early;
const { browser } = await launch('chrome', 9666, {
  before: async (ctx) => {
    early = await ctx.newPage();
    await early.goto('https://www.youtube.com/watch?v=Ew-3-8itpjc', { waitUntil: 'domcontentloaded' });
    await early.waitForTimeout(3000);
    console.log('before install, extension present:', await early.evaluate(() => !!document.querySelector('eoc-root')));
  },
});
await early.waitForTimeout(6000);
console.log('after install:', await early.evaluate(() => document.querySelector('eoc-root')?.shadowRoot?.querySelector('.eoc-screen')?.textContent?.slice(0, 40) ?? 'no extension'));
await browser.close();

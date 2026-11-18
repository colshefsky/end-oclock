// Generates README screenshots from fixture pages: SHOTS=1 npx playwright test screenshots
import { test, expect } from './extension';
import type { Page } from '@playwright/test';

test.skip(!process.env.SHOTS, 'only when generating screenshots');

const shot = (page: Page, name: string) => page.screenshot({ path: `docs/images/${name}.png` });
const screen = (page: Page) => page.evaluate(() => document.querySelector('eoc-root')?.shadowRoot?.querySelector('.eoc-screen')?.textContent ?? '');

test('readme screenshots', async ({ context, extensionId }) => {
  const page = await context.newPage();
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('https://www.youtube.com/');
  await expect.poll(() => screen(page)).toContain('When does this end?');
  await page.waitForTimeout(1500);
  await shot(page, 'start');
  await page.evaluate(() => {
    const r = document.querySelector('eoc-root')!.shadowRoot!;
    r.querySelector<HTMLInputElement>('input[type="text"]')!.value = 'make dinner';
    r.querySelector<HTMLButtonElement>('.eoc-btn--primary')!.click();
  });
  await page.goto('https://www.youtube.com/watch?v=long1');
  await expect.poll(() => screen(page), { timeout: 15000 }).toContain("won't fit");
  await page.waitForTimeout(1500);
  await shot(page, 'doesnt-fit');
  await page.goto('https://www.youtube.com/');
  await page.waitForTimeout(1500);
  await page.evaluate(() => document.querySelector('eoc-root')!.shadowRoot!.querySelector<HTMLButtonElement>('.eoc-pill button')!.click());
  await expect.poll(() => screen(page)).toContain("That's a wrap!");
  await page.waitForTimeout(2000);
  await shot(page, 'end');
  await page.reload();
  await expect.poll(() => screen(page)).toContain('napping');
  await page.waitForTimeout(1500);
  await shot(page, 'cooldown');
  const opts = await context.newPage();
  await opts.setViewportSize({ width: 1280, height: 860 });
  await opts.goto(`chrome-extension://${extensionId}/options.html`);
  await opts.waitForTimeout(1500);
  await shot(opts, 'welcome');
  await opts.getByRole('button', { name: 'Save and start' }).click();
  await opts.waitForTimeout(1200);
  await shot(opts, 'hold');
  const popup = await context.newPage();
  await popup.setViewportSize({ width: 340, height: 250 });
  await popup.goto(`chrome-extension://${extensionId}/popup.html`);
  await popup.waitForTimeout(1200);
  await shot(popup, 'popup');
  const ext = await context.newPage();
  await ext.setViewportSize({ width: 1280, height: 600 });
  await ext.goto('chrome://extensions');
  await ext.evaluate(() => {
    const mgr = document.querySelector('extensions-manager')!.shadowRoot!;
    const toggle = mgr.querySelector('extensions-toolbar')!.shadowRoot!.querySelector<HTMLElement>('#devMode')!;
    if (toggle.getAttribute('aria-pressed') !== 'true') toggle.click();
  });
  await ext.waitForTimeout(1000);
  await shot(ext, 'install-extensions-page');
});

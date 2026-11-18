import { test, expect } from './extension';
import type { Page } from '@playwright/test';

const screenText = (page: Page) =>
  page.evaluate(() => document.querySelector('eoc-root')?.shadowRoot?.querySelector('.eoc-screen')?.textContent ?? '');

async function startSession(page: Page, minutes: number) {
  await page.goto('https://www.youtube.com/');
  await expect.poll(() => screenText(page)).toContain('When does this end?');
  await page.evaluate((m) => {
    const r = document.querySelector('eoc-root')!.shadowRoot!;
    const c = r.querySelector<HTMLInputElement>('input[type="number"]')!;
    c.value = String(m);
    c.dispatchEvent(new Event('input'));
    r.querySelector<HTMLButtonElement>('.eoc-btn--primary')!.click();
  }, minutes);
  await expect.poll(() => screenText(page)).toBe('');
}

const visible = (page: Page, sel: string) => page.locator(sel).isVisible();

test('the start screen covers YouTube on first load', async ({ context, extensionId }) => {
  expect(extensionId).toBeTruthy();
  const page = await context.newPage();
  await page.goto('https://www.youtube.com/');
  await expect.poll(() => screenText(page)).toContain('When does this end?');
  expect(await page.evaluate(() => getComputedStyle(document.querySelector('ytd-app')!).visibility)).toBe('hidden');
});

test('a 20-minute session shows only what fits, keeps live and mixes, hides Shorts', async ({ context }) => {
  const page = await context.newPage();
  await startSession(page, 20);
  await expect.poll(() => visible(page, '#t-315')).toBe(true);
  expect(await visible(page, '#t-1500')).toBe(true);
  expect(await visible(page, '#t-4800')).toBe(false);
  expect(await visible(page, '#t-unknown')).toBe(false);
  expect(await visible(page, '#t-live')).toBe(true);
  expect(await visible(page, '#t-mix')).toBe(true);
  expect(await visible(page, 'ytd-rich-shelf-renderer')).toBe(false);
  expect(await visible(page, '#chip-shorts')).toBe(false);
});

test('shorts links go home', async ({ context }) => {
  const page = await context.newPage();
  await startSession(page, 20);
  await page.goto('https://www.youtube.com/shorts/abc');
  await expect.poll(() => page.url()).toBe('https://www.youtube.com/');
});

test("a video that doesn't fit is stopped with an explanation", async ({ context }) => {
  const page = await context.newPage();
  await startSession(page, 20);
  await page.goto('https://www.youtube.com/watch?v=long1');
  await expect.poll(() => screenText(page), { timeout: 15_000 }).toContain("This one won't fit");
  expect(await screenText(page)).toContain('48 minutes');
});

test('a video that fits plays, and the sidebar is filtered', async ({ context }) => {
  const page = await context.newPage();
  await startSession(page, 20);
  await page.goto('https://www.youtube.com/watch?v=short1');
  await expect.poll(() => visible(page, '#r-200')).toBe(true);
  expect(await visible(page, '#r-9000')).toBe(false);
  expect(await screenText(page)).toBe('');
});

test("I'm done shows the ending, then the cooldown after a reload", async ({ context }) => {
  const page = await context.newPage();
  await startSession(page, 20);
  await page.evaluate(() => document.querySelector('eoc-root')!.shadowRoot!.querySelector<HTMLButtonElement>('.eoc-pill button')!.click());
  await expect.poll(() => screenText(page)).toContain("That's a wrap!");
  await page.reload();
  await expect.poll(() => screenText(page)).toContain('YouTube is napping');
});

test('reduced motion still shows the ending cleanly', async ({ context }) => {
  const page = await context.newPage();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await startSession(page, 20);
  await page.evaluate(() => document.querySelector('eoc-root')!.shadowRoot!.querySelector<HTMLButtonElement>('.eoc-pill button')!.click());
  await expect.poll(() => screenText(page)).toContain("That's a wrap!");
  expect(errors).toEqual([]);
});

test('settings page: first run welcome, then the hold', async ({ context, extensionId }) => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/options.html`);
  await expect(page.getByText("Welcome to End O'Clock")).toBeVisible();
  await page.getByRole('button', { name: 'Save and start' }).click();
  await expect(page.getByText('Hold on a minute.')).toBeVisible();
});

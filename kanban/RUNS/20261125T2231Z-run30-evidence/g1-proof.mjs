// G1 real-browser proof (run 30): the sign-in mark renders WITHOUT a tile
// on the deployed staging preview, in light, dark and forced-RTL, phone
// viewport. Also re-measures time-to-visible so the D-046 change did not
// regress the L0 first-paint fix (D-070).
import { chromium } from 'playwright';

const URL = process.env.PROOF_URL || 'https://staging.social-momentum-8zq.pages.dev';
const SHOTS = process.env.PROOF_SHOTS || '/shots';
const out = { url: URL, checks: {} };

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  isMobile: true, hasTouch: true,
  deviceScaleFactor: 2,
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
});

async function shot(name, { theme, rtl }) {
  const page = await ctx.newPage();
  await page.addInitScript((t) => {
    if (t) localStorage.setItem('theme', t);
  }, theme);
  await page.goto(URL, { waitUntil: 'load', timeout: 45000 });
  const t0 = Date.now();
  await page.waitForSelector('img[src*="icon-transparent"]', { timeout: 30000, state: 'attached' });
  if (rtl) {
    await page.evaluate(() => {
      document.documentElement.dir = 'rtl';
      document.documentElement.lang = 'ar';
    });
    await page.waitForTimeout(400);
  }
  await page.waitForTimeout(2500); // entrance settle + ric SW window
  // tile-anatomy assertions on the LIVE page
  const logoLight = page.locator('img[src*="icon-transparent"]').first();
  await page.waitForFunction(() => {
    const imgs = [...document.querySelectorAll('img[src*="icon-transparent"]')];
    return imgs.some((i) => i.offsetParent !== null && i.getBoundingClientRect().width > 40);
  }, { timeout: 15000 });
  out.checks[name] = {
    transparentImgs: await page.locator('img[src*="icon-transparent"]').count(),
    oldPlateImgs: await page.locator('img[src*="icon-192x192"]').count(), // old plate asset must be gone from the auth screen
    visibleBox: (await logoLight.boundingBox()) || (await page.evaluate(() => {
      const i = [...document.querySelectorAll('img[src*="icon-transparent"]')]
        .find((x) => x.offsetParent !== null);
      return i ? i.getBoundingClientRect().toJSON() : null;
    })),
    htmlDir: await page.evaluate(() => document.documentElement.dir),
    themeClass: await page.evaluate(() => document.documentElement.className),
    timeToLogoMs: Date.now() - t0,
  };
  await page.screenshot({ path: `${SHOTS}/g1-${name}.png` });
  await page.close();
}

await shot('light', { theme: 'light', rtl: false });
await shot('dark', { theme: 'dark', rtl: false });
await shot('ar-rtl', { theme: 'light', rtl: true });
await browser.close();
console.log(JSON.stringify(out, null, 1));

// Visual QA for the /yul redesign. Expects a demo-mode server on QA_URL.
// Run: QA_URL=http://localhost:3000 node scripts/qa-yul-visual.mjs
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const out = fileURLToPath(new URL('../output/playwright/', import.meta.url));
await mkdir(out, { recursive: true });

const base = process.env.QA_URL || 'http://localhost:3000';
const browser = await chromium.launch({ headless: true });
const errors = [];

async function shoot(name, path, { width = 1920, height = 1080, theme = 'dark', act } = {}) {
  const context = await browser.newContext({ viewport: { width, height } });
  await context.route(/fr24api\.flightradar24\.com/, (route) => route.abort());
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(`${name}: ${e.message}`));
  await page.addInitScript((t) => localStorage.setItem('jazztow-theme', t), theme);
  await page.goto(`${base}${path}`, { waitUntil: 'networkidle' }).catch(() => {});
  await page.waitForTimeout(9000); // let Cesium + demo feed settle
  if (act) await act(page);
  await page.screenshot({ path: `${out}${name}.png` });
  console.log('SHOT', name);
  await context.close();
}

// Live map, dark, default state
await shoot('yul-01-map-dark-1920', '/yul');
// Select the first flight card to open the contextual panel
await shoot('yul-02-selected-dark-1920', '/yul', {
  act: async (page) => {
    const card = page.locator('button.yul-flight').first();
    if (await card.count()) {
      await card.click({ force: true });
      await page.waitForTimeout(1200);
    }
  },
});
// Light theme
await shoot('yul-03-map-light-1920', '/yul', { theme: 'light' });
// Collapsed rail (narrow viewport triggers icon strip)
await shoot('yul-04-map-dark-1440', '/yul', { width: 1440, height: 900 });
// Small viewport
await shoot('yul-05-map-dark-1100', '/yul', { width: 1100, height: 700 });
// Fleet page
await shoot('yul-06-fleet-dark-1920', '/yul/fleet');
await shoot('yul-07-fleet-light-1920', '/yul/fleet', { theme: 'light' });

await browser.close();
if (errors.length) {
  console.log('PAGEERRORS');
  for (const e of errors) console.log(' -', e);
  process.exitCode = 1;
} else {
  console.log('No browser runtime errors');
}

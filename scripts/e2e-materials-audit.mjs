import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('/home/jcarrasco21/.npm/_npx/e41f203b7505f1fb/node_modules/playwright');
import fs from 'node:fs';
import path from 'node:path';

const NOTEBOOK_ID = 'nma6kpacg5z1ksj50fii8o44';
const BASE_URL = `http://localhost:3000/notebooks/${NOTEBOOK_ID}`;
const OUTPUT_DIR = '/home/jcarrasco21/.gemini/antigravity/brain/2d56a605-cd44-4545-bdc6-57904edc8594/mobile-audit';

async function run() {
  const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });

  const page = await context.newPage();

  console.log('Navigating to', BASE_URL);
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // Switch to Studio Tab
  const studioTabBtn = page.locator('.lg\\:hidden').getByRole('tab', { name: /studio/i });
  await studioTabBtn.click();
  await page.waitForTimeout(1000);

  // Get visible rows in mobile tree
  const rows = page.locator('.lg\\:hidden [data-slot="study-materials-tree-row"]:visible');
  const count = await rows.count();
  console.log(`Found ${count} visible study material rows in mobile container.`);

  const auditReport = {};

  for (let i = 0; i < count; i++) {
    // Re-query rows after any navigation
    const currentRows = page.locator('.lg\\:hidden [data-slot="study-materials-tree-row"]:visible');
    const row = currentRows.nth(i);
    const rowText = (await row.textContent()).trim();
    console.log(`[${i + 1}/${count}] Opening "${rowText.slice(0, 35)}"`);
    await row.click();
    await page.waitForTimeout(1500);

    const safeName = `view-${i + 1}-${rowText.slice(0, 25).replace(/[^a-zA-Z0-9]/g, '_')}`;
    await page.screenshot({ path: path.join(OUTPUT_DIR, `${safeName}.png`) });

    // Extract text elements and font sizes in this viewer
    const textData = await page.evaluate(() => {
      const items = [];
      const els = document.querySelectorAll('h1, h2, h3, h4, h5, p, span, button, a, div, label, li');
      for (const el of els) {
        if (el.children.length === 0 && el.textContent.trim().length > 0) {
          const style = window.getComputedStyle(el);
          const rect = el.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
            items.push({
              tag: el.tagName.toLowerCase(),
              text: el.textContent.trim().slice(0, 50),
              fontSize: style.fontSize,
              lineHeight: style.lineHeight,
              fontWeight: style.fontWeight,
            });
          }
        }
      }
      return items;
    });

    auditReport[safeName] = textData;

    // Look for close/back button
    const closeBtn = page.locator('button[aria-label*="close" i], button[aria-label*="back" i], button:has([data-lucide="x"]), button:has([data-lucide="arrow-left"])').first();
    if (await closeBtn.isVisible()) {
      await closeBtn.click();
      await page.waitForTimeout(1000);
    } else {
      console.log('No close button found, refreshing back to studio...');
      await page.goto(BASE_URL, { waitUntil: 'networkidle' });
      await page.locator('.lg\\:hidden').getByRole('tab', { name: /studio/i }).click();
      await page.waitForTimeout(1000);
    }
  }

  fs.writeFileSync(path.join(OUTPUT_DIR, 'materials-font-audit.json'), JSON.stringify(auditReport, null, 2));

  await browser.close();
  console.log('Finished auditing all materials!');
}

run().catch(console.error);

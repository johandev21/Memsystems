import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('/home/jcarrasco21/.npm/_npx/e41f203b7505f1fb/node_modules/playwright');
import fs from 'node:fs';
import path from 'node:path';

const NOTEBOOK_ID = 'nma6kpacg5z1ksj50fii8o44';
const BASE_URL = `http://localhost:3000/notebooks/${NOTEBOOK_ID}`;
const OUTPUT_DIR = '/home/jcarrasco21/.gemini/antigravity/brain/2d56a605-cd44-4545-bdc6-57904edc8594/mobile-audit';

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

async function audit() {
  const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 }, // iPhone 13/14
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });

  const page = await context.newPage();

  console.log('Navigating to', BASE_URL);
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  // 1. Audit Chat Tab
  console.log('Auditing Chat tab...');
  await page.screenshot({ path: path.join(OUTPUT_DIR, '01-chat-tab.png') });

  const textAudit = await page.evaluate(() => {
    const results = [];
    const elements = document.querySelectorAll('h1, h2, h3, h4, h5, p, span, button, a, input, textarea, div');
    for (const el of elements) {
      if (el.children.length === 0 && el.textContent.trim().length > 0) {
        const style = window.getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          results.push({
            tag: el.tagName.toLowerCase(),
            text: el.textContent.trim().slice(0, 60),
            fontSize: style.fontSize,
            lineHeight: style.lineHeight,
            fontWeight: style.fontWeight,
            className: el.className ? String(el.className).slice(0, 80) : '',
          });
        }
      }
    }
    return results;
  });

  fs.writeFileSync(path.join(OUTPUT_DIR, 'chat-text-audit.json'), JSON.stringify(textAudit, null, 2));

  // 2. Audit Sources Tab
  console.log('Auditing Sources tab...');
  const sourcesTabBtn = page.getByRole('tab', { name: /sources|fuentes/i });
  if (await sourcesTabBtn.isVisible()) {
    await sourcesTabBtn.click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(OUTPUT_DIR, '02-sources-tab.png') });
  }

  // 3. Audit Studio Tab
  console.log('Auditing Studio tab...');
  const studioTabBtn = page.getByRole('tab', { name: /studio/i });
  if (await studioTabBtn.isVisible()) {
    await studioTabBtn.click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(OUTPUT_DIR, '03-studio-tab.png') });
  }

  // 4. Audit Study Material click in Studio tab
  console.log('Auditing Study Material viewer...');
  // Click on the first study material item in the tree/panel
  const materialItem = page.locator('[data-material-id], [role="treeitem"], button:has-text("Guía Completa"), button:has-text("Aristóteles:")').first();
  if (await materialItem.isVisible()) {
    console.log('Clicking material item...');
    await materialItem.click();
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(OUTPUT_DIR, '04-study-material-viewer.png') });
  }

  await browser.close();
  console.log('Audit complete! Output saved to', OUTPUT_DIR);
}

audit().catch(console.error);

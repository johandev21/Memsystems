import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('/home/jcarrasco21/.npm/_npx/e41f203b7505f1fb/node_modules/playwright');
import fs from 'node:fs';
import path from 'node:path';

const OUTPUT_DIR = '/home/jcarrasco21/.gemini/antigravity/brain/da83fb58-3f53-40ac-b38d-907cbe75ff69/toast-mobile-e2e';
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

async function run() {
  const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 }, // iPhone 13/14
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });

  const page = await context.newPage();

  console.log('--- 1. Navigating directly to Platón notebook ---');
  await page.goto('http://localhost:3000/notebooks/i960mpquidpsoxsynirjt70h', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  console.log('Current URL in notebook:', page.url());

  // 2. Open Notebook Menu Drawer
  console.log('--- 2. Testing Grounding Mode Toast Position ---');
  const menuBtn = page.locator('button[aria-label*="settings" i], button[aria-label*="configuración" i], button[aria-label*="menu" i], button:has([data-lucide="more-vertical"])').first();
  await menuBtn.waitFor({ state: 'visible', timeout: 5000 });
  await menuBtn.click();
  await page.waitForTimeout(500);

  // Click Grounding mode option
  const groundingOpt = page.locator('button:has-text("Grounding mode"), button:has-text("Modo de fundamentación"), button:has-text("Fundamentación")').first();
  await groundingOpt.waitFor({ state: 'visible', timeout: 5000 });
  await groundingOpt.click();
  await page.waitForTimeout(500);

  // Select an option in grounding drawer to trigger toast
  const modeOptions = page.locator('[role="radio"]');
  const count = await modeOptions.count();
  console.log(`Found ${count} grounding options in drawer`);

  // Click an option that is not currently selected to guarantee a state change and toast
  const unselectedOption = page.locator('[role="radio"][aria-checked="false"]').first();
  if (await unselectedOption.isVisible()) {
    await unselectedOption.click();
  } else if (count > 0) {
    await modeOptions.first().click();
  }

  // Wait for the toast to appear and finish its slide-up transition animation
  console.log('Waiting for toast to appear...');
  const toastLocator = page.locator('[data-sonner-toast]').first();
  await toastLocator.waitFor({ state: 'visible', timeout: 5000 });
  await page.waitForTimeout(600);

  // Get bounding box of toast
  const toastBox = await toastLocator.boundingBox();
  console.log('Toast bounding box:', toastBox);

  // Screenshot with toast visible
  const toastScreenshotPath = path.join(OUTPUT_DIR, '01-toast-bottom-mobile.png');
  await page.screenshot({ path: toastScreenshotPath });
  console.log(`Saved screenshot to ${toastScreenshotPath}`);

  // Assert toast is at the bottom (y > 400), not at the top (y < 200)
  if (toastBox) {
    if (toastBox.y > 400) {
      console.log('SUCCESS: Toast is positioned near the bottom of the screen (y = ' + toastBox.y + ')');
    } else {
      console.error('FAILURE: Toast is still at the top of the screen (y = ' + toastBox.y + ')');
      process.exitCode = 1;
    }
  }

  await page.waitForTimeout(1000);

  // 3. Test Mobile Model Selector Drawer
  console.log('--- 3. Testing Mobile Model Selector Drawer ---');
  // Dismiss any remaining open drawers
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);

  const modelTrigger = page.locator('button.group\\/model-trigger:visible').first();
  await modelTrigger.waitFor({ state: 'visible', timeout: 5000 });
  await modelTrigger.click();
  await page.waitForTimeout(600);

  const modelDrawerScreenshot = path.join(OUTPUT_DIR, '02-model-selector-drawer.png');
  await page.screenshot({ path: modelDrawerScreenshot });
  console.log(`Saved model drawer screenshot to ${modelDrawerScreenshot}`);

  // Check handle visibility
  const handle = page.locator('[data-slot="drawer-handle"]');
  const isHandleVisible = await handle.isVisible();
  console.log('Is drawer handle visible?', isHandleVisible);

  // Check search input has border and distinction
  const searchInput = page.locator('input[placeholder*="Search models" i]');
  const isSearchVisible = await searchInput.isVisible();
  console.log('Is search input visible?', isSearchVisible);

  await browser.close();

  // 4. Test Dark Mode Mobile Toast & Drawer
  console.log('--- 4. Testing Dark Mode Mobile Toast & Drawer ---');
  const darkBrowser = await chromium.launch({ executablePath: '/usr/bin/chromium', headless: true });
  const darkContext = await darkBrowser.newContext({
    viewport: { width: 390, height: 844 },
    colorScheme: 'dark',
    isMobile: true,
    hasTouch: true,
  });
  const darkPage = await darkContext.newPage();
  await darkPage.addInitScript(() => {
    localStorage.setItem('theme', 'dark');
    document.documentElement.classList.add('dark');
  });

  await darkPage.goto('http://localhost:3000/notebooks/i960mpquidpsoxsynirjt70h', { waitUntil: 'networkidle' });
  await darkPage.waitForTimeout(1000);

  // Trigger toast in dark mode
  const darkMenuBtn = darkPage.locator('button[aria-label*="settings" i], button[aria-label*="configuración" i], button[aria-label*="menu" i], button:has([data-lucide="more-vertical"])').first();
  await darkMenuBtn.waitFor({ state: 'visible', timeout: 5000 });
  await darkMenuBtn.click();
  await darkPage.waitForTimeout(500);

  const darkGroundingOpt = darkPage.locator('button:has-text("Grounding mode"), button:has-text("Modo de fundamentación"), button:has-text("Fundamentación")').first();
  await darkGroundingOpt.waitFor({ state: 'visible', timeout: 5000 });
  await darkGroundingOpt.click();
  await darkPage.waitForTimeout(500);

  const darkUnselectedOption = darkPage.locator('[role="radio"][aria-checked="false"]').first();
  if (await darkUnselectedOption.isVisible()) {
    await darkUnselectedOption.click();
  }

  const darkToast = darkPage.locator('[data-sonner-toast]').first();
  await darkToast.waitFor({ state: 'visible', timeout: 5000 });
  await darkPage.waitForTimeout(600);

  const darkToastScreenshotPath = path.join(OUTPUT_DIR, '04-toast-bottom-mobile-dark.png');
  await darkPage.screenshot({ path: darkToastScreenshotPath });
  console.log(`Saved dark mode toast screenshot to ${darkToastScreenshotPath}`);

  // Dismiss drawer and test dark model selector drawer
  await darkPage.keyboard.press('Escape');
  await darkPage.waitForTimeout(400);
  await darkPage.keyboard.press('Escape');
  await darkPage.waitForTimeout(500);

  const darkModelTrigger = darkPage.locator('button.group\\/model-trigger:visible').first();
  await darkModelTrigger.waitFor({ state: 'visible', timeout: 5000 });
  await darkModelTrigger.click();
  await darkPage.waitForTimeout(600);

  const darkModelDrawerScreenshotPath = path.join(OUTPUT_DIR, '03-model-selector-drawer-dark.png');
  await darkPage.screenshot({ path: darkModelDrawerScreenshotPath });
  console.log(`Saved dark mode drawer screenshot to ${darkModelDrawerScreenshotPath}`);

  await darkBrowser.close();
  console.log('--- E2E Tests Finished ---');
}

run().catch((err) => {
  console.error('E2E Test Failed:', err);
  process.exit(1);
});

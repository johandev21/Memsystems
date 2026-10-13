import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('/home/jcarrasco21/.npm/_npx/e41f203b7505f1fb/node_modules/playwright');
import fs from 'node:fs';
import path from 'node:path';

const OUTPUT_DIR = '/home/jcarrasco21/.gemini/antigravity/brain/e4dddb37-fbd2-47ef-9b68-ba1e4176152e/mobile-e2e-audit';
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

  console.log('--- 1. Navigating to Library (/) ---');
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(OUTPUT_DIR, '01-library-root.png') });

  // 1.1 Click create FAB on library to open Create Drawer
  console.log('--- 1.1 Testing Library Create Drawer (FAB) ---');
  const createFab = page.locator('button[aria-label*="Create" i], button[aria-label*="Crear" i]').last();
  if (await createFab.isVisible()) {
    await createFab.click();
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(OUTPUT_DIR, '02-library-create-drawer.png') });
    // Close drawer with Close button or backdrop
    const closeBtn = page.locator('[data-slot="drawer-close"]').first();
    if (await closeBtn.isVisible()) {
      await closeBtn.click();
      await page.waitForTimeout(400);
    }
  }

  // 1.2 Open folder action drawer
  console.log('--- 1.2 Testing Folder Action Drawer ---');
  const folderActionBtn = page.locator('button[aria-label*="Folder actions" i], button[aria-label*="Acciones de carpeta" i]').first();
  if (await folderActionBtn.isVisible()) {
    await folderActionBtn.click();
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(OUTPUT_DIR, '03-folder-action-drawer.png') });
    const closeBtn = page.locator('[data-slot="drawer-close"]').first();
    if (await closeBtn.isVisible()) {
      await closeBtn.click();
      await page.waitForTimeout(400);
    }
  }

  // 1.3 Drill down into folder
  console.log('--- 1.3 Testing Drill Down into Folder ---');
  const folderTile = page.locator('[data-slot="mobile-folder-tile"]').first();
  if (await folderTile.isVisible()) {
    await folderTile.click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(OUTPUT_DIR, '04-library-folder-drilled.png') });
  }

  // 1.4 Check if notebook tile exists inside folder or go back
  const notebookTile = page.locator('[data-slot="mobile-notebook-tile"]').first();
  if (await notebookTile.isVisible()) {
    // 1.5 Open notebook action drawer
    console.log('--- 1.5 Testing Notebook Action Drawer ---');
    const nbActionBtn = page.locator('button[aria-label*="Notebook actions" i], button[aria-label*="Acciones de cuaderno" i]').first();
    if (await nbActionBtn.isVisible()) {
      await nbActionBtn.click();
      await page.waitForTimeout(600);
      await page.screenshot({ path: path.join(OUTPUT_DIR, '05-notebook-action-drawer.png') });
      const closeBtn = page.locator('[data-slot="drawer-close"]').first();
      if (await closeBtn.isVisible()) {
        await closeBtn.click();
        await page.waitForTimeout(400);
      }
    }

    console.log('--- 1.6 Navigating into Notebook ---');
    await notebookTile.click();
    await page.waitForTimeout(1500);
  } else {
    // Find any notebook link
    console.log('Going back or finding notebook directly...');
    await page.goto('http://localhost:3000/notebooks/nma6kpacg5z1ksj50fii8o44', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
  }

  console.log('Current URL in notebook:', page.url());
  await page.screenshot({ path: path.join(OUTPUT_DIR, '06-notebook-chat.png') });

  // 2. Notebook Menu Drawer (top right "..." button)
  console.log('--- 2.1 Testing Notebook Header Menu Drawer ---');
  const menuBtn = page.locator('button[aria-label*="settings" i], button[aria-label*="configuración" i], button[aria-label*="menu" i], button:has([data-lucide="more-vertical"])').first();
  if (await menuBtn.isVisible()) {
    await menuBtn.click();
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(OUTPUT_DIR, '07-notebook-menu-drawer.png') });

    // 2.2 Test Grounding Drawer
    console.log('--- 2.2 Testing Grounding Mode Drawer ---');
    const groundingOpt = page.locator('button:has-text("Grounding mode"), button:has-text("Modo de fundamentación"), button:has-text("Fundamentación")').first();
    if (await groundingOpt.isVisible()) {
      await groundingOpt.click();
      await page.waitForTimeout(600);
      await page.screenshot({ path: path.join(OUTPUT_DIR, '08-notebook-grounding-drawer.png') });
      const closeBtn = page.locator('[data-slot="drawer-close"]').first();
      if (await closeBtn.isVisible()) {
        await closeBtn.click();
        await page.waitForTimeout(400);
      }
    } else {
      const closeBtn = page.locator('[data-slot="drawer-close"]').first();
      if (await closeBtn.isVisible()) {
        await closeBtn.click();
        await page.waitForTimeout(400);
      }
    }
  }

  // 3. Sources Tab
  console.log('--- 3. Testing Sources Tab ---');
  const sourcesTab = page.getByRole('tab', { name: /sources|fuentes/i });
  if (await sourcesTab.isVisible()) {
    await sourcesTab.click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(OUTPUT_DIR, '09-sources-tab.png') });

    // 3.1 Sources FAB / New source drawer
    const srcFab = page.locator('[data-slot="mobile-sources-add-fab"], button[aria-label*="Add source" i], button[aria-label*="Añadir" i]').first();
    if (await srcFab.isVisible()) {
      await srcFab.click();
      await page.waitForTimeout(600);
      await page.screenshot({ path: path.join(OUTPUT_DIR, '10-sources-create-drawer.png') });
      const closeBtn = page.locator('[data-slot="drawer-close"]').first();
      if (await closeBtn.isVisible()) {
        await closeBtn.click();
        await page.waitForTimeout(400);
      }
    }

    // 3.2 Sources Action drawer
    const srcActionBtn = page.locator('[data-slot="mobile-source-tile-actions"], [data-slot="mobile-folder-tile-actions"]').first();
    if (await srcActionBtn.isVisible()) {
      await srcActionBtn.click();
      await page.waitForTimeout(600);
      await page.screenshot({ path: path.join(OUTPUT_DIR, '11-sources-action-drawer.png') });
      const closeBtn = page.locator('[data-slot="drawer-close"]').first();
      if (await closeBtn.isVisible()) {
        await closeBtn.click();
        await page.waitForTimeout(400);
      }
    }
  }

  // 4. Studio Tab
  console.log('--- 4. Testing Studio Tab ---');
  const studioTab = page.getByRole('tab', { name: /studio/i });
  if (await studioTab.isVisible()) {
    await studioTab.click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(OUTPUT_DIR, '12-studio-tab.png') });

    // 4.1 Studio Action drawer
    const studioActionBtn = page.locator('[data-slot="mobile-material-tile-actions"], [data-slot="mobile-folder-tile-actions"]').first();
    if (await studioActionBtn.isVisible()) {
      await studioActionBtn.click();
      await page.waitForTimeout(600);
      await page.screenshot({ path: path.join(OUTPUT_DIR, '13-studio-action-drawer.png') });
      const closeBtn = page.locator('[data-slot="drawer-close"]').first();
      if (await closeBtn.isVisible()) {
        await closeBtn.click();
        await page.waitForTimeout(400);
      }
    }
  }

  // 5. Settings View
  console.log('--- 5. Testing Settings Page ---');
  await page.goto('http://localhost:3000/settings', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(OUTPUT_DIR, '14-settings-page.png') });

  await browser.close();
  console.log('All tests completed! Screenshots saved to', OUTPUT_DIR);
}

run().catch(console.error);

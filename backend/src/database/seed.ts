import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { ConfigService } from '@nestjs/config';
import { config } from 'dotenv';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { StorageService } from '../modules/storage/storage.service';
import { notebooks } from './schema';

interface SeedNotebook {
  title: string;
  description: string;
  icon: string;
  banner: string;
}

config({ path: '.env.local' });

const BANNER_CONTENT_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

// Responsive WebP variants generated from the seed JPGs with the same
// contract as client uploads: banners/<sha>-<width>w.webp, so the frontend
// srcset serves right-sized files instead of the full-size original.
const BANNER_VARIANT_WIDTHS = [480, 960, 1920] as const;

function resolveSeedDir(): string {
  const candidates = [
    path.resolve(process.cwd(), 'seed'),
    path.resolve(__dirname, '../../seed'),
  ];
  for (const dir of candidates) {
    if (fs.existsSync(path.join(dir, 'notebooks.json'))) {
      return dir;
    }
  }
  throw new Error('Seed directory not found (looked for seed/notebooks.json).');
}

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set. Cannot seed database.');
  }

  const seedDir = resolveSeedDir();
  console.log(
    `Seed storage target: ${process.env.DEV_STORAGE_DIR ?? '<cwd>/dev-storage (default)'}`,
  );
  const entries = JSON.parse(
    fs.readFileSync(path.join(seedDir, 'notebooks.json'), 'utf8'),
  ) as SeedNotebook[];

  const pool = new Pool({ connectionString });
  const db = drizzle(pool);
  const configAdapter = {
    get: (key: string) => process.env[key],
  } as unknown as ConfigService;
  const storage = new StorageService(configAdapter);

  let created = 0;
  let skipped = 0;
  let bannersBackfilled = 0;

  for (const entry of entries) {
    const title = entry.title.trim();

    // Idempotency: a notebook with the same title is never inserted twice.
    const [existing] = await db
      .select({
        id: notebooks.id,
        banner: notebooks.banner,
        bannerVariants: notebooks.bannerVariants,
      })
      .from(notebooks)
      .where(eq(notebooks.title, title))
      .limit(1);

    // Store the banner bytes. Same bytes always produce the same storage
    // key, so re-running the seed safely overwrites identical content.
    let bannerKey: string | null = null;
    let variantKeys: { w480: string; w960: string; w1920: string } | null =
      null;
    if (entry.banner) {
      const bannerPath = path.join(seedDir, 'banners', entry.banner);
      if (!fs.existsSync(bannerPath)) {
        console.warn(
          `Banner not found for "${title}": ${entry.banner} (skipping banner)`,
        );
      } else {
        const bytes = fs.readFileSync(bannerPath);
        const sha256 = crypto.createHash('sha256').update(bytes).digest('hex');
        const ext = path.extname(entry.banner).toLowerCase() || '.jpg';
        bannerKey = `banners/${sha256}${ext}`;
        await storage.putObject({
          key: bannerKey,
          body: bytes,
          contentType: BANNER_CONTENT_TYPES[ext] ?? 'application/octet-stream',
        });

        const baseName = entry.banner.replace(/\.[^.]+$/, '');
        const stored: Record<string, string> = {};
        for (const width of BANNER_VARIANT_WIDTHS) {
          const variantPath = path.join(
            seedDir,
            'banners',
            `${baseName}-${width}w.webp`,
          );
          if (!fs.existsSync(variantPath)) continue;
          const variantKey = `banners/${sha256}-${width}w.webp`;
          await storage.putObject({
            key: variantKey,
            body: fs.readFileSync(variantPath),
            contentType: 'image/webp',
          });
          stored[`w${width}`] = variantKey;
        }
        if (Object.keys(stored).length > 0) {
          variantKeys = stored as { w480: string; w960: string; w1920: string };
        }
      }
    }

    if (!existing) {
      await db.insert(notebooks).values({
        title: title.slice(0, 200),
        description: entry.description.trim().slice(0, 500),
        icon: entry.icon.trim().slice(0, 50) || 'notebook',
        banner: bannerKey,
        bannerVariants: variantKeys,
      });
      created++;
      console.log(`Seeded notebook "${title}"`);
    } else {
      if (bannerKey && (!existing.banner || !existing.bannerVariants)) {
        await db
          .update(notebooks)
          .set({ banner: bannerKey, bannerVariants: variantKeys })
          .where(eq(notebooks.id, existing.id));
        bannersBackfilled++;
      }
      skipped++;
    }
  }

  await pool.end();
  console.log(
    `Seed complete: ${created} created, ${skipped} already existed, ${bannersBackfilled} banners backfilled.`,
  );
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});

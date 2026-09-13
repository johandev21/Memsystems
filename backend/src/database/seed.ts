import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { createId } from '@paralleldrive/cuid2';
import type { ConfigService } from '@nestjs/config';
import { config } from 'dotenv';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { StorageService } from '../modules/storage/storage.service';
import * as appSchema from './schema';
import { notebookFolders, notebooks } from './schema';

interface SeedNotebook {
  title: string;
  description: string;
  icon: string;
  banner: string;
}

// Library folders created before notebooks. Paths are processed in order so
// parents always exist before their children. Mirrors the notebook library
// design: Classical Philosophy > Aristotle, Modern Philosophy, Empty folder.
const SEED_FOLDER_PATHS = [
  'Classical Philosophy',
  'Classical Philosophy/Aristotle',
  'Modern Philosophy',
  'Empty folder',
] as const;

// Notebooks are filed by seed title; anything not listed stays at the root.
const SEED_NOTEBOOK_FOLDERS: Record<string, string> = {
  Platón: 'Classical Philosophy',
  Sócrates: 'Classical Philosophy',
  Aristóteles: 'Classical Philosophy/Aristotle',
  'Immanuel Kant': 'Modern Philosophy',
  'René Descartes': 'Modern Philosophy',
  Confucio: 'Modern Philosophy',
  'Friedrich Nietzsche': 'Modern Philosophy',
  'John Locke': 'Modern Philosophy',
};

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
const BANNER_VARIANT_WIDTHS = [240, 480, 960, 1920] as const;

/**
 * Creates the seed folder tree idempotently and returns a Map of folder path
 * (`"Classical Philosophy/Aristotle"`) to folder id.
 */
async function ensureSeedFolders(
  db: NodePgDatabase<typeof appSchema>,
  paths: readonly string[],
): Promise<Map<string, string>> {
  const ids = new Map<string, string>();
  const existingFolders = await db
    .select({
      id: notebookFolders.id,
      name: notebookFolders.name,
      parentId: notebookFolders.parentId,
    })
    .from(notebookFolders);
  const byParentAndName = new Map<string, string>(
    existingFolders.map(
      (folder) =>
        [`${folder.parentId ?? ''}/${folder.name}`, folder.id] as const,
    ),
  );

  for (const folderPath of paths) {
    let parentId: string | null = null;
    let currentPath = '';
    for (const segment of folderPath.split('/')) {
      currentPath = currentPath ? `${currentPath}/${segment}` : segment;
      const key = `${parentId ?? ''}/${segment}`;
      let folderId = byParentAndName.get(key);
      if (!folderId) {
        folderId = createId();
        await db
          .insert(notebookFolders)
          .values({ id: folderId, name: segment, parentId });
        byParentAndName.set(key, folderId);
      }
      parentId = folderId;
      ids.set(currentPath, folderId);
    }
  }
  return ids;
}

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
  const db = drizzle(pool, { schema: appSchema });
  const configAdapter = {
    get: (key: string) => process.env[key],
  } as unknown as ConfigService;
  const storage = new StorageService(configAdapter);
  const folderIds = await ensureSeedFolders(db, SEED_FOLDER_PATHS);

  let created = 0;
  let skipped = 0;
  let bannersBackfilled = 0;
  let filed = 0;

  for (const entry of entries) {
    const title = entry.title.trim();
    const folderPath = SEED_NOTEBOOK_FOLDERS[title];
    const folderId = folderPath ? (folderIds.get(folderPath) ?? null) : null;
    if (folderPath && !folderId) {
      throw new Error(`Seed folder not found for "${title}": ${folderPath}`);
    }

    // Idempotency: a notebook with the same title is never inserted twice.
    const [existing] = await db
      .select({
        id: notebooks.id,
        folderId: notebooks.folderId,
        banner: notebooks.banner,
        bannerVariants: notebooks.bannerVariants,
      })
      .from(notebooks)
      .where(eq(notebooks.title, title))
      .limit(1);

    // Store the banner bytes. Same bytes always produce the same storage
    // key, so re-running the seed safely overwrites identical content.
    let bannerKey: string | null = null;
    let variantKeys: {
      w240?: string;
      w480?: string;
      w960?: string;
      w1920?: string;
    } | null = null;
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
          variantKeys = stored;
        }
      }
    }

    if (!existing) {
      await db.insert(notebooks).values({
        title: title.slice(0, 200),
        description: entry.description.trim().slice(0, 500),
        icon: entry.icon.trim().slice(0, 50) || 'notebook',
        folderId,
        banner: bannerKey,
        bannerVariants: variantKeys,
      });
      created++;
      console.log(`Seeded notebook "${title}"`);
    } else {
      const missingVariant = variantKeys
        ? Object.entries(variantKeys).some(
            ([key, value]) => value && !existing.bannerVariants?.[key],
          )
        : false;
      if (
        bannerKey &&
        (!existing.banner || !existing.bannerVariants || missingVariant)
      ) {
        await db
          .update(notebooks)
          .set({ banner: bannerKey, bannerVariants: variantKeys })
          .where(eq(notebooks.id, existing.id));
        bannersBackfilled++;
      }
      // File seeded notebooks that are still unfiled; never override a folder
      // the user chose later.
      if (folderId && existing.folderId === null) {
        await db
          .update(notebooks)
          .set({ folderId })
          .where(eq(notebooks.id, existing.id));
        filed++;
      }
      skipped++;
    }
  }

  await pool.end();
  console.log(
    `Seed complete: ${created} created, ${skipped} already existed, ${bannersBackfilled} banners backfilled, ${filed} notebooks filed into folders.`,
  );
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});

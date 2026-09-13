import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

// Generates the tiny cover variant used by notebook-folder artwork. The
// outputs are committed next to the seed sources, so the production seed
// script stays free of native image dependencies.
const SEED_VARIANT_WIDTHS = [240] as const;
const WEBP_QUALITY = 80;
const SOURCE_EXTENSIONS = /\.(jpe?g|png)$/i;

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
  const bannersDir = path.join(resolveSeedDir(), 'banners');
  const sources = fs.readdirSync(bannersDir).filter((file) => SOURCE_EXTENSIONS.test(file));

  let written = 0;
  let skipped = 0;
  for (const file of sources) {
    const baseName = file.replace(/\.[^.]+$/, '');
    for (const width of SEED_VARIANT_WIDTHS) {
      const target = path.join(bannersDir, `${baseName}-${width}w.webp`);
      if (fs.existsSync(target)) {
        skipped++;
        continue;
      }
      await sharp(path.join(bannersDir, file))
        .resize({ width, withoutEnlargement: true })
        .webp({ quality: WEBP_QUALITY })
        .toFile(target);
      console.log(`Generated ${path.basename(target)}`);
      written++;
    }
  }
  console.log(`Seed variants complete: ${written} written, ${skipped} already present.`);
}

main().catch((err) => {
  console.error('Seed variant generation failed:', err);
  process.exit(1);
});

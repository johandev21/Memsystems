import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const WIDTHS = [240, 480, 960, 1920] as const;
const INPUT_DIR = path.resolve(__dirname, '../seed/banners');
const OUTPUT_DIR = path.resolve(
  __dirname,
  '../../frontend/public/notebook-banners',
);
const PRESET_IDS = [
  'abstract-watercolor',
  'blurred-bokeh-lights',
  'calm-ocean-waves-aerial',
  'green-leaves',
  'minimal-marble-texture',
  'misty-mountains-landscape',
  'paper-texture',
  'sand-dunes',
  'stars',
] as const;

async function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  for (const id of PRESET_IDS) {
    for (const width of WIDTHS) {
      await sharp(path.join(INPUT_DIR, `${id}.jpg`))
        .resize({ width, withoutEnlargement: true })
        .grayscale()
        .webp({ quality: 80 })
        .toFile(path.join(OUTPUT_DIR, `${id}-${width}w.webp`));
    }
  }
  console.log(
    `Generated ${PRESET_IDS.length * WIDTHS.length} monochrome notebook banner variants.`,
  );
}

main().catch((error) => {
  console.error('Notebook banner generation failed:', error);
  process.exit(1);
});

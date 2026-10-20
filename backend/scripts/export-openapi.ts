import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { generateOpenApiDocument } from '../src/common/openapi/generate-openapi-document';

const OUTPUT_PATH = path.resolve(__dirname, '../../docs/openapi.json');

function serialize(document: unknown): string {
  return `${JSON.stringify(document, null, 2)}\n`;
}

async function main(): Promise<void> {
  const check = process.argv.includes('--check');
  const document = await generateOpenApiDocument();
  const serialized = serialize(document);

  if (check) {
    if (!existsSync(OUTPUT_PATH)) {
      console.error(
        `OpenAPI spec is missing at ${OUTPUT_PATH}. Run \`pnpm --filter backend run openapi:export\`.`,
      );
      process.exitCode = 1;
      return;
    }
    const committed = readFileSync(OUTPUT_PATH, 'utf8');
    if (committed !== serialized) {
      console.error(
        'Committed OpenAPI spec is stale. Run `pnpm --filter backend run openapi:export` and commit docs/openapi.json.',
      );
      process.exitCode = 1;
      return;
    }
    console.log('OpenAPI spec is up to date.');
    return;
  }

  mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  writeFileSync(OUTPUT_PATH, serialized, 'utf8');
  console.log(`Wrote OpenAPI spec to ${OUTPUT_PATH}`);
}

void main().catch((error: unknown) => {
  console.error('Failed to export the OpenAPI spec.', error);
  process.exitCode = 1;
});

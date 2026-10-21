import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { generateOpenApiDocument } from '../../src/common/openapi/generate-openapi-document';

const COMMITTED_SPEC_PATH = path.resolve(
  __dirname,
  '../../../docs/openapi.json',
);

function serialize(document: unknown): string {
  return `${JSON.stringify(document, null, 2)}\n`;
}

describe('OpenAPI spec', () => {
  it('matches the committed docs/openapi.json', async () => {
    const document = await generateOpenApiDocument();

    expect(document.openapi).toBe('3.1.0');
    expect(serialize(document)).toBe(readFileSync(COMMITTED_SPEC_PATH, 'utf8'));
  }, 30_000);
});

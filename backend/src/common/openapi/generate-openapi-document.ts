import { NestFactory } from '@nestjs/core';
import type { OpenAPIObject } from '@nestjs/swagger';
import { AppModule } from '../../app.module';
import { buildOpenApiDocument } from './configure-openapi';

/**
 * Boots the Nest application without listening, builds the OpenAPI document,
 * and closes the application again.
 *
 * No database is required: the pg pool is lazy and no controller is invoked.
 * The dummy connection string and empty provider keys keep the export
 * deterministic even when a developer has real values in `.env.local`.
 */
export async function generateOpenApiDocument(): Promise<OpenAPIObject> {
  process.env.DATABASE_URL ||=
    'postgresql://postgres:postgres@localhost:5499/memsystems_openapi';
  process.env.AI_GATEWAY_API_KEY = '';
  process.env.VOYAGE_API_KEY = '';

  const app = await NestFactory.create(AppModule, {
    bodyParser: false,
    logger: false,
  });

  try {
    app.setGlobalPrefix('api');
    return buildOpenApiDocument(app);
  } finally {
    await app.close();
  }
}

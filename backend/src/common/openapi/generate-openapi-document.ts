import { NestFactory } from '@nestjs/core';
import type { OpenAPIObject } from '@nestjs/swagger';
import { AppModule } from '../../app.module';
import { buildOpenApiDocument } from './configure-openapi';

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

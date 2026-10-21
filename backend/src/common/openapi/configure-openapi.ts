import type { INestApplication } from '@nestjs/common';
import {
  DocumentBuilder,
  SwaggerModule,
  type OpenAPIObject,
} from '@nestjs/swagger';
import { cleanupOpenApiDoc } from 'nestjs-zod';
import { openApiStreamSchemas } from './stream-schemas';

export const OPENAPI_JSON_PATH = 'api/openapi.json';
export const OPENAPI_DOCS_PATH = 'api/docs';

/**
 * Builds the OpenAPI 3.1 document for the API.
 *
 * Request schemas come from the `nestjs-zod` DTOs; `cleanupOpenApiDoc` flattens
 * their generated definitions and fixes shared schema references. Streaming
 * frame schemas are appended as reusable components because they are not
 * request bodies.
 */
export function buildOpenApiDocument(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle('Memsystems API')
    .setDescription(
      [
        'Memsystems is a single-user study workspace. A Notebook owns Sources, Chat, and Study Materials.',
        '',
        'Sources are text, URLs, or files ingested into a Notebook. Chat answers with Citations to the Evidence retrieved from those Sources. Study Material Generation streams a new Study Material from a Brief and the selected Sources.',
        '',
        'Direct API access is available for local automation and agents without authentication.',
      ].join('\n'),
    )
    .setVersion('1.0.0')
    .setOpenAPIVersion('3.1.0')
    .build();

  const document = SwaggerModule.createDocument(app, config, {
    deepScanRoutes: true,
  });

  const cleaned = cleanupOpenApiDoc(document, { version: '3.1' });
  cleaned.components = cleaned.components ?? {};
  cleaned.components.schemas = {
    ...cleaned.components.schemas,
    ...openApiStreamSchemas,
  };

  return cleaned;
}

/**
 * Serves the docs UI at `/api/docs` and the JSON document at
 * `/api/openapi.json`. Both paths live outside the controller router, so the
 * `api` global prefix is part of the path here.
 */
export function configureOpenApi(app: INestApplication): OpenAPIObject {
  const document = buildOpenApiDocument(app);

  SwaggerModule.setup(OPENAPI_DOCS_PATH, app, document, {
    customSiteTitle: 'Memsystems API',
    jsonDocumentUrl: OPENAPI_JSON_PATH,
    swaggerOptions: {
      displayRequestDuration: true,
    },
  });

  return document;
}

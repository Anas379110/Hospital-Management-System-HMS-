import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

/** Documentation-only layout. Keep complete model names and keyboard controls. */
export const swaggerModelWrapCss = `
@media (max-width: 600px) {
  .swagger-ui .models .model-box { min-width: 0; }
  .swagger-ui .models table.model,
  .swagger-ui .models table.model > tbody,
  .swagger-ui .models table.model > tbody > tr,
  .swagger-ui .models table.model > tbody > tr > td { display: block; width: 100%; min-width: 0; box-sizing: border-box; }
  .swagger-ui .models table.model > tbody > tr { margin-block: 0.6em; }
  .swagger-ui .models table.model > tbody > tr > td:first-of-type { width: 100%; padding: 0; }
  .swagger-ui .models table.model > tbody > tr > td + td { padding-inline-start: 1em; }
  .swagger-ui .models table.model td { overflow-wrap: anywhere; }
  .swagger-ui .models .model-box-control { max-width: 100%; white-space: normal; overflow-wrap: anywhere; }
  .swagger-ui .models .model-title__text { overflow-wrap: anywhere; }
}`;

/** Native Nest document shared by the live UI and contract tests. No DB reads. */
export function createApiDocument(app: INestApplication) {
  return SwaggerModule.createDocument(app, new DocumentBuilder()
    .setTitle('HMS fictional demo API')
    .setDescription('Fictional data only. Request DTOs and query parameters are annotated in source. Success result shapes remain service-defined unless explicitly described. Public demo workspace role switching is intentional, not a production identity feature. Public mode and deployment limits are described in docs/api/API.md.')
    .setVersion('0.3.0')
    .addBearerAuth()
    .build());
}

export function setupApiDocumentation(app: INestApplication) {
  const document = createApiDocument(app);
  SwaggerModule.setup('api/docs', app, document, { customCss: swaggerModelWrapCss });
  return document;
}

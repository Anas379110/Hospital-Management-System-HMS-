import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

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
  SwaggerModule.setup('api/docs', app, document);
  return document;
}

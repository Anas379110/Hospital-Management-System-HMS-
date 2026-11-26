import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { createApplication } from './app.factory';

async function bootstrap() {
  const app = await createApplication();

  const config = new DocumentBuilder()
    .setTitle('HMS API — نظام إدارة المشافي')
    .setVersion('1.0.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`HMS Backend running on port ${port}`);
}
bootstrap();

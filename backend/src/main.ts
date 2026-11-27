import { setupApiDocumentation } from './api-documentation';
import { createApplication } from './app.factory';

async function bootstrap() {
  const app = await createApplication();

  setupApiDocumentation(app);

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`HMS Backend running on port ${port}`);
}
bootstrap();

import { setupApiDocumentation } from './api-documentation';
import { createApplication } from './app.factory';

async function bootstrap() {
  const app = await createApplication();

  setupApiDocumentation(app);

  const port = process.env.PORT ?? 3000;
  if (process.env.HMS_LOCAL_DEMO_LOOPBACK === 'true') await app.listen(port, '127.0.0.1');
  else await app.listen(port);
  console.log(`HMS Backend running on port ${port}`);
}
bootstrap();

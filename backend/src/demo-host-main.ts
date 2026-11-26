import { NestFactory } from '@nestjs/core';
import { resolve } from 'path';
import { DemoModule } from './demo/demo.module';
import { demoAdmission } from './demo/admission.middleware';
import { createDemoStatic } from './demo/static.middleware';
import { createGlobalSessionAdmission } from './demo/global-admission.middleware';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';

/** Dedicated single-listener public showcase. Never imports operational AppModule/config. */
async function bootstrapDemoHost() {
  const app = await NestFactory.create(DemoModule, { bodyParser: false, logger: false });
  app.getHttpAdapter().getInstance().disable('x-powered-by');
  app.getHttpAdapter().getInstance().set('trust proxy', false);
  app.use(createDemoStatic(resolve(__dirname, '../public')));
  app.use(demoAdmission);
  app.use(createGlobalSessionAdmission());
  app.useGlobalFilters(new AllExceptionsFilter());
  app.enableShutdownHooks();
  // PORT is platform configuration; DEMO_LOOPBACK_ONLY restricts local qualification. No database, credentials or inherited env group.
  await app.listen(Number(process.env.PORT ?? 10000), process.env.DEMO_LOOPBACK_ONLY === '1' ? '127.0.0.1' : '0.0.0.0');
}
void bootstrapDemoHost();

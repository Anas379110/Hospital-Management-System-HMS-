import { DemoCapacityInterceptor } from './common/demo-capacity.interceptor';
import { trustedProxyAddresses } from './common/trusted-proxies';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import * as express from 'express';
import { workspaceContext } from './prisma/workspace-context';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';

/** Shared request contract for production and actual HTTP integration tests. */
export async function createApplication(options: { logger?: false } = {}) {
  const app = await NestFactory.create(AppModule, options);
  app.getHttpAdapter().getInstance().set('trust proxy', trustedProxyAddresses(process.env.HMS_TRUSTED_PROXY_ADDRESSES));
  app.use((_req: unknown, _res: unknown, next: () => void) => workspaceContext.run('', next));
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.useGlobalFilters(new AllExceptionsFilter());
  app.enableCors({ origin: process.env.FRONTEND_URL ?? 'http://localhost:5173', credentials: true });
  app.setGlobalPrefix('api/v1');
  if (process.env.HMS_PUBLIC_DEMO === 'true') {
    // Liveness is DB-independent and never competes with domain requests.
    app.use('/api/v1/health', (req: express.Request, res: express.Response, next: express.NextFunction) => {
      if (req.method === 'GET' && req.path === '/') return res.status(200).json({ok:true});
      next();
    });
    app.useGlobalInterceptors(new DemoCapacityInterceptor());
    const assets = resolve(process.cwd(), '../frontend/dist');
    if (existsSync(assets)) {
      app.use(express.static(assets));
      app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
        if (req.method !== 'GET' || req.path.startsWith('/api/')) return next();
        res.sendFile(resolve(assets, 'index.html'));
      });
    }
  }
  return app;
}

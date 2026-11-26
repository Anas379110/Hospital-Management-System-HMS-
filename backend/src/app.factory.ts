import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';

/** Shared request contract for production and actual HTTP integration tests. */
export async function createApplication(options: { logger?: false } = {}) {
  const app = await NestFactory.create(AppModule, options);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.useGlobalFilters(new AllExceptionsFilter());
  app.enableCors({ origin: process.env.FRONTEND_URL ?? 'http://localhost:5173', credentials: true });
  app.setGlobalPrefix('api/v1');
  return app;
}

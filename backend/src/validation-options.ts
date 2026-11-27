import { ValidationPipeOptions } from '@nestjs/common';

/** Shared by production and validation boundary regression tests. */
export const validationOptions: ValidationPipeOptions = Object.freeze({
  whitelist: true, forbidNonWhitelisted: true, transform: true,
});

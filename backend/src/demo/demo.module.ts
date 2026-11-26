import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { DemoController } from './demo.controller';
import { DemoService } from './demo.service';
import { DemoGuard } from './demo.guard';

/** Deliberately does not import AppModule, Prisma, auth, audit or business modules. */
@Module({
  imports: [ThrottlerModule.forRoot([{ ttl: 60_000, limit: 60 }])],
  controllers: [DemoController],
  providers: [DemoService, { provide: APP_GUARD, useClass: ThrottlerGuard }, { provide: APP_GUARD, useClass: DemoGuard }],
})
export class DemoModule {}

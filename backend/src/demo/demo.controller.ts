import { Controller, Get, Post, HttpCode } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { DemoService } from './demo.service';

@Controller('api/demo')
export class DemoController {
  constructor(private readonly demo: DemoService) {}

  @Get('status')
  status() {
    return { mode: 'fictional-read-only', database: false, clinicalUse: false };
  }

  @Post('session')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  session() {
    return this.demo.session();
  }

  @Get('catalog')
  catalog() {
    return this.demo.catalog();
  }
}

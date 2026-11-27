import { CallHandler, ExecutionContext, Injectable, NestInterceptor, ServiceUnavailableException } from '@nestjs/common';
import { from, lastValueFrom, Observable } from 'rxjs';

/** Per-instance bound. Client disconnect never frees work still running in DB. */
@Injectable()
export class DemoCapacityInterceptor implements NestInterceptor {
  private active = 0;
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (this.active >= 24) {
      context.switchToHttp().getResponse().setHeader('Retry-After', '5');
      throw new ServiceUnavailableException({error:{code:'DEMO_BUSY',message:'Demo is busy. Try again shortly.',details:[]}});
    }
    this.active++;
    // The promise owns the slot even if its observable consumer unsubscribes.
    return from((async () => {
      try { return await lastValueFrom(next.handle()); }
      finally { this.active--; }
    })());
  }
}

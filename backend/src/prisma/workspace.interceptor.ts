import { Injectable, NestInterceptor, ExecutionContext, CallHandler, UnauthorizedException } from '@nestjs/common';
import { Observable } from 'rxjs';
import { workspaceContext, demoMode } from './workspace-context';
@Injectable()
export class WorkspaceInterceptor implements NestInterceptor {
 intercept(context:ExecutionContext,next:CallHandler):Observable<unknown> {
  if (!demoMode()) return next.handle();
  const req=context.switchToHttp().getRequest<{user?:{workspace?:string};path:string}>();
  if (['/api/v1/demo/start','/api/v1/auth/login'].includes(req.path)) return next.handle();
  const id=req.user?.workspace;
  if (!id) throw new UnauthorizedException();
  return new Observable(subscriber=>workspaceContext.run(id,()=>next.handle().subscribe(subscriber)));
 }
}

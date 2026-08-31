import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * يتحقق من وجود وصلاحية JWT Token — يُطبَّق قبل RolesGuard دائماً.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}

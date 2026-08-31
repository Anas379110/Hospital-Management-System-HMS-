import { SetMetadata } from '@nestjs/common';
import { Role } from '@prisma/client';

export const ROLES_KEY = 'roles';
/**
 * يحدد الأدوار المسموح لها بالوصول لهذا الـ Endpoint.
 * مثال: @Roles(Role.admin, Role.receptionist)
 * راجع CLAUDE.md §10 — RBAC مركزي إلزامي على كل Endpoint محمي.
 */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

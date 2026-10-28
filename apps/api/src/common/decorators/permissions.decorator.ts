import { SetMetadata } from '@nestjs/common';
import type { Permission } from '@repo/shared';

export const PERMISSIONS_KEY = 'requiredPermissions';
export const RequirePermissions = (...permissions: (Permission | string)[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);

export const SYSTEM_ROLES_KEY = 'requiredSystemRoles';
export const RequireSystemRoles = (...roles: string[]) => SetMetadata(SYSTEM_ROLES_KEY, roles);

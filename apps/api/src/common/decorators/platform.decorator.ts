import { createParamDecorator, SetMetadata, type ExecutionContext } from '@nestjs/common';
import {
  PLATFORM_ROLES_KEY,
  type PlatformPrincipal,
} from '../../modules/admin/admin.constants.js';

export { PLATFORM_ROLES_KEY };

/** Restricts a route to the given platform roles (hierarchy-aware). */
export const RequirePlatformRoles = (...roles: string[]) =>
  SetMetadata(PLATFORM_ROLES_KEY, roles);

/** Injects the authenticated platform operator (or one of its fields). */
export const CurrentPlatform = createParamDecorator(
  (field: keyof PlatformPrincipal | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<{ platform?: PlatformPrincipal }>();
    const principal = request.platform;
    return field ? principal?.[field] : principal;
  },
);

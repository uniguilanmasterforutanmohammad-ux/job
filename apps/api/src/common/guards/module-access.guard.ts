import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AuthenticatedUser, ModuleKey } from '@repo/shared';
import {
  MODULE_OPTIONAL_KEY,
  REQUIRED_MODULES_KEY,
} from '../decorators/module.decorator.js';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js';
import { DomainException } from '../exceptions/domain.exception.js';
import { ModuleAccessService } from '../../modules/tenants/module-access.service.js';

/**
 * Enforces per-tenant module activation. Applied globally, it gates any handler
 * (or controller) annotated with `@RequireModule('FIN', ...)`. Routes without
 * the decorator, public routes and platform-admin routes are always allowed.
 */
@Injectable()
export class ModuleAccessGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly access: ModuleAccessService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const optional = this.reflector.getAllAndOverride<boolean>(MODULE_OPTIONAL_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (optional) return true;

    const required = this.reflector.getAllAndOverride<ModuleKey[]>(REQUIRED_MODULES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required?.length) return true;

    const request = context.switchToHttp().getRequest<{ user?: AuthenticatedUser }>();
    const user = request.user;
    // No tenant context (or unresolved auth) — let other guards handle it.
    if (!user?.tenantId) return true;

    const enabled = await this.access.enabledModules(user.tenantId);
    const missing = required.filter((key) => !enabled.has(key));
    if (missing.length > 0) {
      throw DomainException.moduleDisabled(
        'این ماژول برای کسب‌وکار شما فعال نیست. برای فعال‌سازی با پشتیبانی تماس بگیرید.',
      );
    }
    return true;
  }
}

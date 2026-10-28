import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { DomainException } from '../../../common/exceptions/domain.exception.js';
import { PLATFORM_ROLES_KEY } from '../../../common/decorators/platform.decorator.js';
import {
  PLATFORM_ROLE_RANK,
  type PlatformPrincipal,
  type PlatformRoleValue,
} from '../admin.constants.js';

/** Enforces the platform role hierarchy declared via @RequirePlatformRoles(). */
@Injectable()
export class PlatformRolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<PlatformRoleValue[]>(PLATFORM_ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required?.length) return true;

    const principal = context.switchToHttp().getRequest<{ platform?: PlatformPrincipal }>().platform;
    if (!principal) throw DomainException.forbidden('ورود به بنل مدیریت لازم است');

    const rank = PLATFORM_ROLE_RANK[principal.role] ?? 0;
    const allowed = required.some((role) => rank >= (PLATFORM_ROLE_RANK[role] ?? 99));
    if (!allowed) throw DomainException.forbidden('سطح دسترسی شما برای این عملیات کافی نیست');
    return true;
  }
}

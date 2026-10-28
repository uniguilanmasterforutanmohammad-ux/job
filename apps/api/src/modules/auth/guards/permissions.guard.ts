import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { hasPermission, type AuthenticatedUser } from '@repo/shared';
import {
  PERMISSIONS_KEY,
  SYSTEM_ROLES_KEY,
} from '../../../common/decorators/permissions.decorator.js';
import { DomainException } from '../../../common/exceptions/domain.exception.js';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(SYSTEM_ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredPermissions?.length && !requiredRoles?.length) return true;

    const request = context.switchToHttp().getRequest<{ user?: AuthenticatedUser }>();
    const user = request.user;
    if (!user) throw DomainException.forbidden('ورود لازم است');

    if (requiredRoles?.length && !requiredRoles.includes(user.systemRole)) {
      throw DomainException.forbidden('نقش کاربری شما اجازه این عملیات را ندارد');
    }

    if (requiredPermissions?.length) {
      const allowed = requiredPermissions.every((perm) =>
        hasPermission(user.permissions ?? [], perm),
      );
      if (!allowed) throw DomainException.forbidden('مجوز لازم برای این عملیات را ندارید');
    }

    return true;
  }
}

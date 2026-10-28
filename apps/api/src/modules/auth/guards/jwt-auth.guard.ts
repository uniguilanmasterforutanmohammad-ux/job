import { ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import type { AuthenticatedUser } from '@repo/shared';
import { IS_PUBLIC_KEY } from '../../../common/decorators/public.decorator.js';
import { JwtStrategies } from '../auth.constants.js';

@Injectable()
export class JwtAuthGuard extends AuthGuard(JwtStrategies.ACCESS) {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;
    return super.canActivate(context);
  }

  handleRequest<TUser = AuthenticatedUser>(err: unknown, user: TUser): TUser {
    if (err || !user) {
      throw err instanceof Error ? err : new UnauthorizedException('ورود لازم است');
    }
    return user;
  }
}

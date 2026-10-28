import { ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  PLATFORM_JWT_STRATEGY,
  type PlatformPrincipal,
} from '../admin.constants.js';

/**
 * Authenticates platform console operators. Deliberately separate from the
 * tenant `JwtAuthGuard`: different signing key, different scope claim and a
 * different request property (`request.platform`), so the two surfaces can
 * never authenticate each other's tokens.
 */
@Injectable()
export class PlatformAuthGuard extends AuthGuard(PLATFORM_JWT_STRATEGY) {
  override async canActivate(context: ExecutionContext): Promise<boolean> {
    const active = await super.canActivate(context);
    // Passport stores the validated principal on `request.user`; expose it on a
    // dedicated `request.platform` so tenant code paths can never confuse the two.
    const request = context.switchToHttp().getRequest<
      { user?: PlatformPrincipal; platform?: PlatformPrincipal }
    >();
    if (request.user) request.platform = request.user;
    return active as boolean;
  }

  handleRequest<T = PlatformPrincipal>(err: unknown, user: T): T {
    if (err || !user) {
      throw err instanceof Error ? err : new UnauthorizedException('ورود به بنل مدیریت لازم است');
    }
    return user;
  }
}

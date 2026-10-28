import { CanActivate, ExecutionContext, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { DomainException } from '../../../common/exceptions/domain.exception.js';
import type { AppConfig } from '../../../config/configuration.js';
import {
  TWO_FACTOR_SETUP_REQUIRED,
  type PlatformPrincipal,
} from '../admin.constants.js';

export const TWO_FACTOR_EXEMPT_KEY = 'twoFactorExempt';
/** Marks routes an operator may reach while their mandatory 2FA is pending. */
export const TwoFactorExempt = () => SetMetadata(TWO_FACTOR_EXEMPT_KEY, true);

/**
 * When `PLATFORM_2FA_REQUIRED` is on, blocks console mutations until the
 * operator has enrolled TOTP. Enrolment routes are exempt so they can comply.
 */
@Injectable()
export class TwoFactorEnforcementGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly config: ConfigService<AppConfig>,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.config.get('platformJwt', { infer: true })?.require2fa ?? false;
    if (!required) return true;

    const exempt = this.reflector.getAllAndOverride<boolean>(TWO_FACTOR_EXEMPT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (exempt) return true;

    const principal = context.switchToHttp().getRequest<{ platform?: PlatformPrincipal }>()
      .platform;
    if (principal && !principal.twoFactorEnabled) {
      throw new DomainException(
        'برای استفاده از بنل مدیریت، ابتدا ورود دو مرحله‌ای (2FA) را فعال کنید',
        403,
        TWO_FACTOR_SETUP_REQUIRED,
      );
    }
    return true;
  }
}

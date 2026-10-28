import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { Request } from 'express';
import type { AppConfig } from '../../../config/configuration.js';
import {
  PLATFORM_ACCESS_COOKIE,
  PLATFORM_JWT_STRATEGY,
  PLATFORM_SCOPE,
  type PlatformPrincipal,
  type PlatformRoleValue,
} from '../admin.constants.js';

export type PlatformAccessPayload = {
  sub: string;
  scope: string;
  typ?: string;
  role: PlatformRoleValue;
  phone: string;
  fullName: string;
  twoFactorEnabled?: boolean;
};

const cookieExtractor = (request: Request): string | null => {
  const cookies = (request as Request & { cookies?: Record<string, string> }).cookies;
  return cookies?.[PLATFORM_ACCESS_COOKIE] ?? null;
};

@Injectable()
export class PlatformJwtStrategy extends PassportStrategy(Strategy, PLATFORM_JWT_STRATEGY) {
  constructor(config: ConfigService<AppConfig>) {
    const jwt = config.get('platformJwt', { infer: true })!;
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        cookieExtractor,
      ]),
      ignoreExpiration: false,
      secretOrKey: jwt.secret,
    });
  }

  validate(payload: PlatformAccessPayload): PlatformPrincipal {
    // A tenant access token signed with the normal secret can never validate
    // here because we use a distinct key AND require the platform scope claim.
    if (payload.scope !== PLATFORM_SCOPE) {
      throw new UnauthorizedException('توکن نامعتبر است');
    }
    // A 2FA challenge token must never grant access to console routes.
    if (payload.typ === '2fa_challenge') {
      throw new UnauthorizedException('توکن ورود دو مرحله‌ای، توکن دسترسی نیست');
    }
    return {
      platformMemberId: payload.sub,
      phone: payload.phone,
      fullName: payload.fullName,
      role: payload.role,
      twoFactorEnabled: payload.twoFactorEnabled ?? false,
    };
  }
}

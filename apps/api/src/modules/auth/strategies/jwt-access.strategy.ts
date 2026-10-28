import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { Request } from 'express';
import type { AuthenticatedUser } from '@repo/shared';
import type { AppConfig } from '../../../config/configuration.js';
import { ACCESS_TOKEN_COOKIE, JwtStrategies } from '../auth.constants.js';

export type AccessTokenPayload = {
  sub: string;
  tid: string;
  bid: string | null;
  role: string;
  perms: string[];
};

const cookieExtractor = (request: Request): string | null => {
  const cookies = (request as Request & { cookies?: Record<string, string> }).cookies;
  return cookies?.[ACCESS_TOKEN_COOKIE] ?? null;
};

@Injectable()
export class JwtAccessStrategy extends PassportStrategy(Strategy, JwtStrategies.ACCESS) {
  constructor(config: ConfigService<AppConfig>) {
    const jwtCfg = config.get('jwt', { infer: true })!;
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        cookieExtractor,
      ]),
      ignoreExpiration: false,
      secretOrKey: jwtCfg.accessSecret,
    });
  }

  validate(payload: AccessTokenPayload): AuthenticatedUser {
    return {
      memberId: payload.sub,
      tenantId: payload.tid,
      branchId: payload.bid,
      systemRole: payload.role,
      permissions: payload.perms ?? [],
      fullName: '',
    };
  }
}

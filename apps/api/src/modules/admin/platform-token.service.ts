import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../../database/prisma.service.js';
import { parseTtlToSeconds } from '../auth/token.service.js';
import type { AppConfig } from '../../config/configuration.js';
import {
  PLATFORM_SCOPE,
  type PlatformPrincipal,
} from './admin.constants.js';

export type PlatformTokenPair = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
};

export type TwoFactorChallenge = {
  challengeToken: string;
  expiresIn: number;
};

/** Short-lived intermediate token proving "password/OTP passed, 2FA pending". */
export const PLATFORM_2FA_CHALLENGE_TTL_SECONDS = 300;

/**
 * Issues/signs platform-console tokens with a dedicated key and an explicit
 * `scope: 'platform'` claim. Refresh tokens are stored hashed, like tenant ones.
 */
@Injectable()
export class PlatformTokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService<AppConfig>,
    private readonly prisma: PrismaService,
  ) {}

  async issue(
    principal: PlatformPrincipal,
    context: { userAgent?: string; ip?: string } = {},
  ): Promise<PlatformTokenPair> {
    const cfg = this.config.get('platformJwt', { infer: true })!;

    const accessToken = await this.jwt.signAsync(
      {
        sub: principal.platformMemberId,
        scope: PLATFORM_SCOPE,
        role: principal.role,
        phone: principal.phone,
        fullName: principal.fullName,
        twoFactorEnabled: principal.twoFactorEnabled,
      },
      { secret: cfg.secret, expiresIn: cfg.accessTtl as never },
    );

    const refreshToken = randomBytes(48).toString('base64url');
    await this.prisma.client.platformSession.create({
      data: {
        platformMemberId: principal.platformMemberId,
        refreshHash: this.hashToken(refreshToken),
        userAgent: context.userAgent ?? null,
        ip: context.ip ?? null,
        expiresAt: new Date(Date.now() + parseTtlToSeconds(cfg.refreshTtl) * 1000),
      },
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: parseTtlToSeconds(cfg.accessTtl),
    };
  }

  /**
   * Signs a short-lived token that only proves the first factor passed. It is
   * deliberately NOT accepted by PlatformAuthGuard (different `typ` claim).
   */
  async issueTwoFactorChallenge(principal: PlatformPrincipal): Promise<TwoFactorChallenge> {
    const cfg = this.config.get('platformJwt', { infer: true })!;
    const challengeToken = await this.jwt.signAsync(
      {
        sub: principal.platformMemberId,
        scope: PLATFORM_SCOPE,
        typ: '2fa_challenge',
      },
      { secret: cfg.secret, expiresIn: PLATFORM_2FA_CHALLENGE_TTL_SECONDS },
    );
    return { challengeToken, expiresIn: PLATFORM_2FA_CHALLENGE_TTL_SECONDS };
  }

  /** Validates a 2FA challenge token and returns the operator id it belongs to. */
  async verifyTwoFactorChallenge(challengeToken: string): Promise<string | null> {
    const cfg = this.config.get('platformJwt', { infer: true })!;
    try {
      const payload = await this.jwt.verifyAsync<{
        sub: string;
        scope: string;
        typ: string;
      }>(challengeToken, { secret: cfg.secret });
      if (payload.scope !== PLATFORM_SCOPE || payload.typ !== '2fa_challenge') return null;
      return payload.sub;
    } catch {
      return null;
    }
  }

  /** Rotates a platform refresh token, revoking the previous session row. */
  async rotate(
    refreshToken: string,
    principal: PlatformPrincipal,
  ): Promise<PlatformTokenPair | null> {
    const refreshHash = this.hashToken(refreshToken);
    const session = await this.prisma.client.platformSession.findUnique({
      where: { refreshHash },
    });
    if (!session || session.revokedAt || session.expiresAt.getTime() < Date.now()) {
      if (session && !session.revokedAt) {
        await this.prisma.client.platformSession.update({
          where: { id: session.id },
          data: { revokedAt: new Date() },
        });
      }
      return null;
    }
    await this.prisma.client.platformSession.update({
      where: { id: session.id },
      data: { revokedAt: new Date() },
    });
    return this.issue(principal);
  }

  async revoke(refreshToken: string): Promise<void> {
    await this.prisma.client.platformSession.updateMany({
      where: { refreshHash: this.hashToken(refreshToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAllFor(platformMemberId: string): Promise<void> {
    await this.prisma.client.platformSession.updateMany({
      where: { platformMemberId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}

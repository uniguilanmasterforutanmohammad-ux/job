import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes } from 'node:crypto';
import type { AuthenticatedUser } from '@repo/shared';
import { PrismaService } from '../../database/prisma.service.js';
import type { AppConfig } from '../../config/configuration.js';

export type TokenPair = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
};

@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService<AppConfig>,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Issues a short-lived access JWT plus an opaque refresh token. Only the
   * refresh token hash is persisted, so a DB leak cannot mint sessions.
   */
  async issue(
    user: AuthenticatedUser,
    context: { userAgent?: string; ip?: string } = {},
  ): Promise<TokenPair> {
    const jwtCfg = this.config.get('jwt', { infer: true })!;

    const accessToken = await this.jwt.signAsync(
      {
        sub: user.memberId,
        tid: user.tenantId,
        bid: user.branchId ?? null,
        role: user.systemRole,
        perms: user.permissions,
      },
      {
        secret: jwtCfg.accessSecret,
        expiresIn: jwtCfg.accessTtl as never,
      },
    );

    const refreshToken = randomBytes(48).toString('base64url');
    const refreshHash = this.hashToken(refreshToken);
    const ttlMs = parseTtlToMs(jwtCfg.refreshTtl);

    await this.prisma.client.session.create({
      data: {
        memberId: user.memberId,
        tenantId: user.tenantId,
        refreshHash,
        userAgent: context.userAgent ?? null,
        ip: context.ip ?? null,
        expiresAt: new Date(Date.now() + ttlMs),
      },
    });

    return { accessToken, refreshToken, expiresIn: parseTtlToSeconds(jwtCfg.accessTtl) };
  }

  /** Rotates a refresh token, revoking the previous session row. */
  async rotate(refreshToken: string, user: AuthenticatedUser): Promise<TokenPair | null> {
    const refreshHash = this.hashToken(refreshToken);
    const session = await this.prisma.client.session.findUnique({ where: { refreshHash } });
    if (!session || session.revokedAt || session.expiresAt.getTime() < Date.now()) {
      if (session && !session.revokedAt) {
        await this.prisma.client.session.update({
          where: { id: session.id },
          data: { revokedAt: new Date() },
        });
      }
      return null;
    }

    await this.prisma.client.session.update({
      where: { id: session.id },
      data: { revokedAt: new Date() },
    });

    return this.issue(user);
  }

  async revoke(refreshToken: string): Promise<void> {
    const refreshHash = this.hashToken(refreshToken);
    await this.prisma.client.session.updateMany({
      where: { refreshHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAllForMember(memberId: string): Promise<void> {
    await this.prisma.client.session.updateMany({
      where: { memberId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}

function parseTtlToMs(ttl: string): number {
  return parseTtlToSeconds(ttl) * 1000;
}

export function parseTtlToSeconds(ttl: string): number {
  const match = /^(\d+)\s*([smhd])?$/.exec(ttl.trim());
  if (!match) return 900;
  const value = Number(match[1]);
  switch (match[2]) {
    case 'd':
      return value * 86400;
    case 'h':
      return value * 3600;
    case 'm':
      return value * 60;
    case 's':
    default:
      return value;
  }
}

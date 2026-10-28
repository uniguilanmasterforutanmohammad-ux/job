import { JwtService } from '@nestjs/jwt';
import type { ConfigService } from '@nestjs/config';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  PLATFORM_2FA_CHALLENGE_TTL_SECONDS,
  PlatformTokenService,
} from './platform-token.service.js';
import type { PrismaService } from '../../database/prisma.service.js';
import type { AppConfig } from '../../config/configuration.js';

const SECRET = 'test-platform-secret-min-32-chars-long!!';
const platformCfg = { secret: SECRET, accessTtl: '8h', refreshTtl: '7d' };

const principal = {
  platformMemberId: 'p1',
  phone: '09120000001',
  fullName: 'Admin',
  role: 'SUPER_ADMIN' as const,
  twoFactorEnabled: false,
};

function build() {
  const prisma = {
    client: {
      platformSession: {
        create: vi.fn().mockResolvedValue({ id: 's1' }),
        findUnique: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
      },
    },
  };
  const config = { get: vi.fn(() => platformCfg) };
  const service = new PlatformTokenService(
    new JwtService(),
    config as unknown as ConfigService<AppConfig>,
    prisma as unknown as PrismaService,
  );
  return { service, prisma, jwt: new JwtService() };
}

describe('PlatformTokenService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('issues an access token scoped to the platform with the 2FA claim', async () => {
    const { service, jwt } = build();
    const tokens = await service.issue(principal);
    const payload = await jwt.verifyAsync(tokens.accessToken, { secret: SECRET });
    expect(payload.scope).toBe('platform');
    expect(payload.sub).toBe('p1');
    expect(payload.twoFactorEnabled).toBe(false);
  });

  it('stores only a hash of the refresh token', async () => {
    const { service, prisma } = build();
    await service.issue(principal);
    const stored = prisma.client.platformSession.create.mock.calls[0][0].data;
    expect(stored.refreshHash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(stored)).not.toContain('refreshToken');
  });

  it('signs a 2FA challenge that is NOT a valid access token', async () => {
    const { service, jwt } = build();
    const { challengeToken, expiresIn } = await service.issueTwoFactorChallenge(principal);
    expect(expiresIn).toBe(PLATFORM_2FA_CHALLENGE_TTL_SECONDS);

    const payload = await jwt.verifyAsync(challengeToken, { secret: SECRET });
    expect(payload.typ).toBe('2fa_challenge');
    expect(payload.role).toBeUndefined();
  });

  it('round-trips a challenge token back to the operator id', async () => {
    const { service } = build();
    const { challengeToken } = await service.issueTwoFactorChallenge(principal);
    await expect(service.verifyTwoFactorChallenge(challengeToken)).resolves.toBe('p1');
  });

  it('rejects an access token used as a 2FA challenge', async () => {
    const { service } = build();
    const { accessToken } = await service.issue(principal);
    await expect(service.verifyTwoFactorChallenge(accessToken)).resolves.toBeNull();
  });

  it('rejects a token signed with the wrong key', async () => {
    const { service } = build();
    const foreign = new JwtService().sign(
      { sub: 'p1', scope: 'platform', typ: '2fa_challenge' },
      { secret: 'some-other-secret-that-is-long-enough!!' },
    );
    await expect(service.verifyTwoFactorChallenge(foreign)).resolves.toBeNull();
  });
});

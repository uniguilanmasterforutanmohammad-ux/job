import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { describe, expect, it, vi } from 'vitest';
import { TwoFactorEnforcementGuard } from './two-factor-enforcement.guard.js';

function contextFor(principal: { twoFactorEnabled: boolean } | undefined): ExecutionContext {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => ({ platform: principal }) }),
  } as unknown as ExecutionContext;
}

function build(opts: { require2fa: boolean; exempt?: boolean }) {
  const reflector = {
    getAllAndOverride: vi.fn(() => opts.exempt ?? false),
  } as unknown as Reflector;
  const config = {
    get: vi.fn(() => ({ require2fa: opts.require2fa })),
  } as unknown as ConfigService;
  return new TwoFactorEnforcementGuard(reflector, config);
}

const principal = (enabled: boolean) => ({
  platformMemberId: 'p1',
  phone: '09120000001',
  fullName: 'Admin',
  role: 'SUPER_ADMIN' as const,
  twoFactorEnabled: enabled,
});

describe('TwoFactorEnforcementGuard', () => {
  it('is a no-op when mandatory 2FA is disabled', () => {
    const guard = build({ require2fa: false });
    expect(guard.canActivate(contextFor(principal(false)))).toBe(true);
  });

  it('allows exempt routes even when 2FA is pending', () => {
    const guard = build({ require2fa: true, exempt: true });
    expect(guard.canActivate(contextFor(principal(false)))).toBe(true);
  });

  it('allows operators who already enrolled TOTP', () => {
    const guard = build({ require2fa: true });
    expect(guard.canActivate(contextFor(principal(true)))).toBe(true);
  });

  it('blocks operators without 2FA using TWO_FACTOR_SETUP_REQUIRED', () => {
    const guard = build({ require2fa: true });
    try {
      guard.canActivate(contextFor(principal(false)));
      throw new Error('should have thrown');
    } catch (error) {
      expect((error as { response: { code: string } }).response.code).toBe(
        'TWO_FACTOR_SETUP_REQUIRED',
      );
      expect((error as { status: number }).status).toBe(403);
    }
  });

  it('does not block unauthenticated requests (auth guard handles them)', () => {
    const guard = build({ require2fa: true });
    expect(guard.canActivate(contextFor(undefined))).toBe(true);
  });
});

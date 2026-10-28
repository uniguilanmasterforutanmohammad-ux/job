import { HttpException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { describe, expect, it, vi } from 'vitest';
import { ModuleAccessGuard } from './module-access.guard.js';
import type { ModuleAccessService } from '../../modules/tenants/module-access.service.js';

type RequestLike = { user?: { tenantId?: string } };

function contextFor(request: RequestLike): ExecutionContext {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

function build(options: {
  isPublic?: boolean;
  optional?: boolean;
  required?: string[] | undefined;
  enabled?: string[];
}) {
  const reflector = {
    getAllAndOverride: vi.fn((key: string) => {
      if (key === 'isPublic') return options.isPublic ?? false;
      if (key === 'moduleOptional') return options.optional ?? false;
      if (key === 'requiredModules') return options.required;
      return undefined;
    }),
  } as unknown as Reflector;
  const access = {
    enabledModules: vi.fn().mockResolvedValue(new Set(options.enabled ?? [])),
  } as unknown as ModuleAccessService;
  return { guard: new ModuleAccessGuard(reflector, access), access };
}

describe('ModuleAccessGuard', () => {
  it('allows public routes', async () => {
    const { guard } = build({ isPublic: true, required: ['FIN'] });
    await expect(guard.canActivate(contextFor({}))).resolves.toBe(true);
  });

  it('allows routes explicitly marked module-optional', async () => {
    const { guard } = build({ optional: true, required: ['FIN'] });
    await expect(guard.canActivate(contextFor({}))).resolves.toBe(true);
  });

  it('allows routes without a module requirement', async () => {
    const { guard } = build({ required: undefined });
    await expect(guard.canActivate(contextFor({ user: { tenantId: 't1' } }))).resolves.toBe(true);
  });

  it('allows unauthenticated requests so auth guards can render the error', async () => {
    const { guard } = build({ required: ['FIN'], enabled: [] });
    await expect(guard.canActivate(contextFor({}))).resolves.toBe(true);
  });

  it('passes when every required module is enabled', async () => {
    const { guard } = build({ required: ['FIN', 'CRM'], enabled: ['FIN', 'CRM', 'SCH'] });
    await expect(guard.canActivate(contextFor({ user: { tenantId: 't1' } }))).resolves.toBe(true);
  });

  it('blocks with MODULE_DISABLED when a required module is off', async () => {
    const { guard } = build({ required: ['FIN'], enabled: ['CRM'] });
    await expect(guard.canActivate(contextFor({ user: { tenantId: 't1' } }))).rejects.toMatchObject(
      {
        response: { code: 'MODULE_DISABLED' },
        status: 403,
      },
    );
  });

  it('blocks with an HttpException carrying status 403', async () => {
    const { guard } = build({ required: ['FIN'], enabled: [] });
    await expect(
      guard.canActivate(contextFor({ user: { tenantId: 't1' } })),
    ).rejects.toBeInstanceOf(HttpException);
    await expect(guard.canActivate(contextFor({ user: { tenantId: 't1' } }))).rejects.toMatchObject(
      { status: 403 },
    );
  });
});

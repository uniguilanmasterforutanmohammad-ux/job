import { describe, expect, it, vi, beforeEach } from 'vitest';
import { TenantsService } from './tenants.service.js';
import type { PrismaService } from '../../database/prisma.service.js';
import type { ModuleAccessService } from './module-access.service.js';

function build() {
  const prisma = {
    client: {
      tenant: { findUnique: vi.fn().mockResolvedValue({ id: 't1' }), update: vi.fn() },
      tenantModule: { upsert: vi.fn(), findMany: vi.fn() },
      $transaction: vi.fn((ops: unknown[]) => Promise.all(ops)),
      branch: { findMany: vi.fn(), create: vi.fn() },
    },
  };
  const access = { invalidate: vi.fn().mockResolvedValue(undefined) };
  const service = new TenantsService(
    prisma as unknown as PrismaService,
    access as unknown as ModuleAccessService,
  );
  return { service, prisma, access };
}

describe('TenantsService.enableModules', () => {
  beforeEach(() => vi.clearAllMocks());

  it('resolves dependencies before writing', async () => {
    const { service } = build();
    const result = await service.enableModules('t1', ['SUB']);
    expect(new Set(result.enabled)).toEqual(new Set(['CRM', 'FIN', 'SUB']));
  });

  it('upserts every resolved module in a single transaction', async () => {
    const { service, prisma } = build();
    await service.enableModules('t1', ['SCH']);
    expect(prisma.client.$transaction).toHaveBeenCalledOnce();
    const calls = prisma.client.tenantModule.upsert.mock.calls;
    expect(calls).toHaveLength(2);
    expect(calls[0][0].create).toMatchObject({ tenantId: 't1', isEnabled: true });
  });

  it('invalidates the module cache after enabling', async () => {
    const { service, access } = build();
    await service.enableModules('t1', ['CRM']);
    expect(access.invalidate).toHaveBeenCalledWith('t1');
  });

  it('throws for a missing tenant', async () => {
    const { service, prisma } = build();
    prisma.client.tenant.findUnique.mockResolvedValue(null);
    await expect(service.enableModules('missing', ['CRM'])).rejects.toMatchObject({
      response: { code: 'NOT_FOUND' },
    });
    expect(prisma.client.$transaction).not.toHaveBeenCalled();
  });
});

describe('TenantsService.disableModule', () => {
  beforeEach(() => vi.clearAllMocks());

  it('flips the module off and invalidates the cache', async () => {
    const { service, prisma, access } = build();
    const result = await service.disableModule('t1', 'FIN');
    expect(result).toEqual({ disabled: 'FIN' });
    expect(prisma.client.tenantModule.upsert).toHaveBeenCalledWith({
      where: { tenantId_key: { tenantId: 't1', key: 'FIN' } },
      update: { isEnabled: false, disabledAt: expect.any(Date) },
      create: { tenantId: 't1', key: 'FIN', isEnabled: false },
    });
    expect(access.invalidate).toHaveBeenCalledWith('t1');
  });
});

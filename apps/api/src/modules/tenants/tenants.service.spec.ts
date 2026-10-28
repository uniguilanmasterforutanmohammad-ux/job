// TaskForMyAgent — صنف زبان‌آموز و صنف‌های آموزشی باید «آموزشگاه» تعریف کنند (مدیریت شعبه‌ها)
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
      branch: {
        findMany: vi.fn(),
        create: vi.fn(),
        findFirst: vi.fn(),
        update: vi.fn(),
      },
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

// TaskForMyAgent — صنف زبان‌آموز و صنف‌های آموزشی باید «آموزشگاه» تعریف کنند (مدیریت شعبه‌ها)
describe('TenantsService branch management', () => {
  beforeEach(() => vi.clearAllMocks());

  it('lists only the tenant\'s live branches together with their people count', async () => {
    const { service, prisma } = build();
    prisma.client.branch.findMany.mockResolvedValue([]);

    await service.listBranches('t1');

    expect(prisma.client.branch.findMany).toHaveBeenCalledWith({
      where: { tenantId: 't1', deletedAt: null },
      orderBy: { createdAt: 'asc' },
      include: {
        _count: {
          select: {
            members: { where: { deletedAt: null } },
            customers: { where: { deletedAt: null } },
          },
        },
      },
    });
  });

  it('renames/addresses a branch and can (de)activate it', async () => {
    const { service, prisma } = build();
    prisma.client.branch.findFirst.mockResolvedValue({
      id: 'b1',
      _count: { members: 0, customers: 0 },
    });
    prisma.client.branch.update.mockResolvedValue({ id: 'b1', name: 'آموزشگاه دو' });

    await service.updateBranch('t1', 'b1', { name: 'آموزشگاه دو', isActive: false });

    expect(prisma.client.branch.findFirst).toHaveBeenCalledWith({
      where: { id: 'b1', tenantId: 't1', deletedAt: null },
      include: {
        _count: {
          select: {
            members: { where: { deletedAt: null } },
            customers: { where: { deletedAt: null } },
          },
        },
      },
    });
    expect(prisma.client.branch.update).toHaveBeenCalledWith({
      where: { id: 'b1' },
      data: { name: 'آموزشگاه دو', isActive: false },
    });
  });

  it('refuses to touch a branch of another tenant', async () => {
    const { service, prisma } = build();
    prisma.client.branch.findFirst.mockResolvedValue(null);

    await expect(service.updateBranch('t1', 'b-other', { name: 'x' })).rejects.toMatchObject({
      response: { code: 'NOT_FOUND' },
    });
    expect(prisma.client.branch.update).not.toHaveBeenCalled();
  });

  it('soft-deletes an empty branch', async () => {
    const { service, prisma } = build();
    prisma.client.branch.findFirst.mockResolvedValue({
      id: 'b1',
      _count: { members: 0, customers: 0 },
    });

    await expect(service.removeBranch('t1', 'b1')).resolves.toEqual({ message: 'شعبه حذف شد' });
    expect(prisma.client.branch.update).toHaveBeenCalledWith({
      where: { id: 'b1' },
      // `code` is released so the same code can be used by a new branch.
      data: { deletedAt: expect.any(Date), isActive: false, code: null },
    });
  });

  it('keeps a branch that still has زبان‌آموز/کارمند attached', async () => {
    const { service, prisma } = build();
    prisma.client.branch.findFirst.mockResolvedValue({
      id: 'b1',
      _count: { members: 3, customers: 20 },
    });

    await expect(service.removeBranch('t1', 'b1')).rejects.toMatchObject({
      response: { code: 'CONFLICT' },
    });
    expect(prisma.client.branch.update).not.toHaveBeenCalled();
  });
});

describe('TenantsService branch codes', () => {
  beforeEach(() => vi.clearAllMocks());

  it('rejects a code that a live branch already uses', async () => {
    const { service, prisma } = build();
    prisma.client.branch.findFirst.mockResolvedValue({ id: 'b-other' });

    await expect(
      service.createBranch('t1', { name: 'آموزشگاه سه', code: 'A1' }),
    ).rejects.toMatchObject({ response: { code: 'CONFLICT' } });
    expect(prisma.client.branch.create).not.toHaveBeenCalled();
  });

  it('lets a code be reused once its branch is deleted', async () => {
    const { service, prisma } = build();
    prisma.client.branch.findFirst.mockResolvedValue({
      id: 'b1',
      _count: { members: 0, customers: 0 },
    });
    prisma.client.branch.update.mockResolvedValue({ id: 'b1' });

    await service.removeBranch('t1', 'b1');

    const [{ data }] = prisma.client.branch.update.mock.calls[0] as [
      { data: Record<string, unknown> },
    ];
    expect(data.code).toBeNull();
  });
});

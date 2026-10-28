import { describe, expect, it, vi, beforeEach } from 'vitest';
import { AdminModuleService } from './admin-module.service.js';
import type { PrismaService } from '../../database/prisma.service.js';
import type { AdminAuditService } from './admin-audit.service.js';
import type { ModuleAccessService } from '../tenants/module-access.service.js';
import type { PlatformPrincipal } from './admin.constants.js';

const actor: PlatformPrincipal = {
  platformMemberId: 'p1',
  phone: '09120000001',
  fullName: 'Admin',
  role: 'SUPER_ADMIN',
  twoFactorEnabled: true,
};

function build(enabledKeys: string[] = []) {
  const prisma = {
    client: {
      tenant: { findUnique: vi.fn().mockResolvedValue({ id: 't1', deletedAt: null }) },
      tenantModule: {
        upsert: vi.fn(),
        findMany: vi.fn().mockResolvedValue(enabledKeys.map((key) => ({ key }))),
      },
      $transaction: vi.fn((ops: unknown[]) => Promise.all(ops)),
    },
  };
  const audit = { record: vi.fn().mockResolvedValue(undefined) };
  const access = { invalidate: vi.fn().mockResolvedValue(undefined) };
  const service = new AdminModuleService(
    prisma as unknown as PrismaService,
    audit as unknown as AdminAuditService,
    access as unknown as ModuleAccessService,
  );
  return { service, prisma, audit, access };
}

describe('AdminModuleService.grant', () => {
  beforeEach(() => vi.clearAllMocks());

  it('enables requested modules plus their dependencies', async () => {
    const { service } = build();
    const result = await service.grant(actor, 't1', { keys: ['SHOP'], withDependencies: true });
    expect(new Set(result.enabled)).toEqual(new Set(['INV', 'FIN', 'CRM', 'SHOP']));
  });

  it('enables only the requested modules when withDependencies is false', async () => {
    const { service } = build();
    const result = await service.grant(actor, 't1', { keys: ['SHOP'], withDependencies: false });
    expect(result.enabled).toEqual(['SHOP']);
  });

  it('audits the change and invalidates the cache', async () => {
    const { service, audit, access } = build();
    await service.grant(actor, 't1', { keys: ['CRM'], withDependencies: true });
    expect(audit.record).toHaveBeenCalledWith(
      actor,
      expect.objectContaining({ action: 'module.grant', tenantId: 't1' }),
      {},
    );
    expect(access.invalidate).toHaveBeenCalledWith('t1');
  });
});

describe('AdminModuleService.revoke', () => {
  beforeEach(() => vi.clearAllMocks());

  it('disables only the target module without cascade', async () => {
    const { service } = build(['CRM', 'FIN', 'SUB']);
    const result = await service.revoke(actor, 't1', { key: 'FIN', cascade: false });
    expect(result.disabled).toEqual(['FIN']);
  });

  it('cascades to dependents when cascade is on (FIN -> SUB, CAMP, SHOP)', async () => {
    const { service } = build(['CRM', 'FIN', 'SUB', 'CAMP', 'INV', 'SHOP']);
    const result = await service.revoke(actor, 't1', { key: 'FIN', cascade: true });
    expect(new Set(result.disabled)).toEqual(new Set(['FIN', 'SUB', 'CAMP', 'SHOP']));
    // CRM is a dependency of FIN (not a dependent) and must stay on.
    expect(result.disabled).not.toContain('CRM');
  });

  it('cascades recursively across multiple levels (CRM -> SCH -> ... )', async () => {
    const { service } = build(['CRM', 'SCH', 'FIN']);
    const result = await service.revoke(actor, 't1', { key: 'CRM', cascade: true });
    expect(new Set(result.disabled)).toEqual(new Set(['CRM', 'SCH', 'FIN']));
  });

  it('upserts every cascaded module to disabled', async () => {
    const { service, prisma } = build(['CRM', 'FIN', 'SUB']);
    await service.revoke(actor, 't1', { key: 'FIN', cascade: true });
    expect(prisma.client.tenantModule.upsert).toHaveBeenCalledTimes(2);
    for (const call of prisma.client.tenantModule.upsert.mock.calls) {
      expect(call[0].update.isEnabled).toBe(false);
    }
  });
});

describe('AdminModuleService.catalog', () => {
  it('computes dependents for each module', () => {
    const { service } = build();
    const catalog = service.catalog();
    const crm = catalog.find((entry) => entry.key === 'CRM')!;
    expect(crm.dependents).toContain('SCH');
    expect(crm.dependents).toContain('FIN');
    const inv = catalog.find((entry) => entry.key === 'INV')!;
    expect(inv.dependents).toContain('SHOP');
  });

  it('flags enabled modules that are missing dependencies', async () => {
    const { service, prisma } = build();
    // SUB enabled, but its CRM/FIN dependencies are absent.
    prisma.client.tenantModule.findMany.mockResolvedValue([{ key: 'SUB', isEnabled: true }]);
    const result = await service.catalogForTenant('t1');
    const sub = result.modules.find((m) => m.key === 'SUB')!;
    expect(sub.missingDependencies).toEqual(['CRM', 'FIN']);
  });
});

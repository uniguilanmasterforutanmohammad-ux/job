// TaskForMyAgent — پنل ادمین: ایجاد کسب‌وکار جدید + ماژول‌های انتخابی/پیش‌فرض
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { AdminTenantService } from './admin-tenant.service.js';
import type { PrismaService } from '../../database/prisma.service.js';
import type { AdminAuditService } from './admin-audit.service.js';
import type { ModuleAccessService } from '../tenants/module-access.service.js';
import type { PlatformPrincipal } from './admin.constants.js';
import type { AdminCreateTenantDto } from './dto/admin.schemas.js';
import type { IndustryRegistryService } from '../industries/industry-registry.service.js';
import { BRANCH_NOUNS, defaultModulesForIndustry } from '@repo/shared';

/** Registry stub: falls back to the static PRD defaults and shared nouns. */
function stubIndustries(): IndustryRegistryService {
  return {
    defaultModules: vi.fn(async (industry: string | null) => defaultModulesForIndustry(industry)),
    defaultsByIndustry: vi.fn(async () => new Map()),
    get: vi.fn(async (industry: string) => ({
      key: industry,
      branchNoun: BRANCH_NOUNS[industry as keyof typeof BRANCH_NOUNS] ?? null,
    })),
  } as unknown as IndustryRegistryService;
}

const actor: PlatformPrincipal = {
  platformMemberId: 'p1',
  phone: '09120000001',
  fullName: 'Admin',
  role: 'SUPER_ADMIN',
  twoFactorEnabled: true,
};

function build(existingSlugs: string[] = []) {
  const created: Array<{ model: string; data: Record<string, unknown> }> = [];

  const tx = {
    tenant: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        created.push({ model: 'tenant', data });
        return { id: 't-new', ...data };
      }),
    },
    role: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        created.push({ model: 'role', data });
        return { id: 'r-owner', ...data };
      }),
    },
    branch: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        created.push({ model: 'branch', data });
        return { id: 'b-main', ...data };
      }),
    },
    member: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        created.push({ model: 'member', data });
        return { id: 'm-owner', ...data };
      }),
    },
    tenantModule: {
      createMany: vi.fn(async ({ data }: { data: Array<Record<string, unknown>> }) => {
        created.push({ model: 'tenantModule', data: { rows: data } });
        return { count: data.length };
      }),
    },
    subscription: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        created.push({ model: 'subscription', data });
        return { id: 's-trial', ...data };
      }),
    },
  };

  const prisma = {
    client: {
      tenant: {
        findUnique: vi.fn(async ({ where }: { where: { slug?: string } }) =>
          where.slug && existingSlugs.includes(where.slug) ? { id: `existing-${where.slug}` } : null,
        ),
        findUniqueOrThrow: vi.fn(),
      },
      $transaction: vi.fn((arg: unknown) =>
        typeof arg === 'function'
          ? (arg as (t: typeof tx) => Promise<unknown>)(tx)
          : Promise.all(arg as unknown[]),
      ),
    },
  };
  // `create` returns `this.detail(...)`; stub it so the test stays focused.
  const audit = { record: vi.fn().mockResolvedValue(undefined) };
  const access = { invalidate: vi.fn().mockResolvedValue(undefined) };
  const service = new AdminTenantService(
    prisma as unknown as PrismaService,
    audit as unknown as AdminAuditService,
    access as unknown as ModuleAccessService,
    stubIndustries(),
  );
  const detail = vi
    .spyOn(service, 'detail')
    .mockImplementation(async () => ({ id: 't-new' }) as never);

  return { service, prisma, audit, access, created, detail, tx };
}

const baseDto: AdminCreateTenantDto = {
  name: 'باشگاه آریا',
  industry: 'SPORTS_COACHING',
  ownerFullName: 'علی رضایی',
  ownerPhone: '09121112233',
  withDependencies: true,
  status: 'ACTIVE',
};

describe('AdminTenantService.create', () => {
  beforeEach(() => vi.clearAllMocks());

  it('enables the industry defaults when no modules are chosen', async () => {
    const { service, created } = build();
    await service.create(actor, baseDto);

    const modules = created.find((row) => row.model === 'tenantModule')!.data.rows as Array<{
      key: string;
      isEnabled: boolean;
    }>;
    const keys = new Set(modules.map((module) => module.key));
    expect(keys).toEqual(
      new Set(['CRM', 'SCH', 'FIN', 'ATT', 'MSG', 'SUB', 'RPT', 'APP']),
    );
    expect(modules.every((module) => module.isEnabled)).toBe(true);
  });

  it('resolves dependencies of the chosen modules', async () => {
    const { service, created } = build();
    await service.create(actor, { ...baseDto, modules: ['SHOP'] });

    const modules = created.find((row) => row.model === 'tenantModule')!.data.rows as Array<{
      key: string;
    }>;
    expect(new Set(modules.map((module) => module.key))).toEqual(
      new Set(['INV', 'FIN', 'CRM', 'SHOP']),
    );
  });

  it('creates the owner role, main branch, owner member and a trial subscription', async () => {
    const { service, created } = build();
    await service.create(actor, baseDto);

    const owner = created.find((row) => row.model === 'member')!.data;
    expect(owner.systemRole).toBe('OWNER');
    expect(owner.phone).toBe('09121112233');
    expect(created.find((row) => row.model === 'role')!.data.key).toBe('owner');
    expect(created.find((row) => row.model === 'branch')!.data.code).toBe('MAIN');
    expect(created.find((row) => row.model === 'subscription')!.data.status).toBe('TRIAL');
  });

  it('names the default location after the industry (آموزشگاه/شعبه)', async () => {
    const school = build();
    await school.service.create(actor, { ...baseDto, industry: 'LANGUAGE_SCHOOL', modules: ['CRM'] });
    expect(school.created.find((row) => row.model === 'branch')!.data.name).toBe('آموزشگاه مرکزی');

    const shop = build();
    await shop.service.create(actor, { ...baseDto, industry: 'RETAIL', modules: ['CRM'] });
    expect(shop.created.find((row) => row.model === 'branch')!.data.name).toBe('شعبه مرکزی');
  });

  it('derives a unique biz- slug from the name', async () => {
    const { service, created } = build(['biz-باشگاه-آریا']);
    await service.create(actor, baseDto);

    const tenant = created.find((row) => row.model === 'tenant')!.data;
    expect(tenant.slug).toBe('باشگاه-آریا-2');
  });

  it('rejects a slug that is already taken', async () => {
    const { service } = build(['taken']);
    await expect(service.create(actor, { ...baseDto, slug: 'taken' })).rejects.toThrow(
      /اسلاگ/,
    );
  });

  it('audits the creation and invalidates the module cache', async () => {
    const { service, audit, access } = build();
    await service.create(actor, baseDto);

    expect(audit.record).toHaveBeenCalledWith(
      actor,
      expect.objectContaining({ action: 'tenant.create', entityId: 't-new' }),
      {},
    );
    expect(access.invalidate).toHaveBeenCalledWith('t-new');
  });
});

describe('AdminTenantService.list module summary', () => {
  it('surfaces enabled modules and the missing industry defaults', async () => {
    const rows = [
      {
        id: 't1',
        industry: 'SPORTS_COACHING',
        modules: [{ key: 'CRM' }, { key: 'SCH' }],
        subscription: null,
        _count: { members: 0, branches: 1, customers: 0 },
      },
    ];
    const prisma = {
      client: {
        $transaction: vi.fn((ops: unknown[]) => Promise.all(ops)),
        tenant: {
          findMany: vi.fn().mockResolvedValue(rows),
          count: vi.fn().mockResolvedValue(1),
        },
      },
    };
    const service = new AdminTenantService(
      prisma as unknown as PrismaService,
      { record: vi.fn() } as unknown as AdminAuditService,
      { invalidate: vi.fn() } as unknown as ModuleAccessService,
      stubIndustries(),
    );

    const result = await service.list({ page: 1, pageSize: 20, sortDir: 'desc' });
    const row = result.data[0];
    expect(row.enabledModuleKeys).toEqual(['CRM', 'SCH']);
    expect(row.defaultModules).toContain('ATT');
    expect(row.missingDefaultModules).not.toContain('CRM');
    expect(row.missingDefaultModules).toContain('ATT');
  });
});

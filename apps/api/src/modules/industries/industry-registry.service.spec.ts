// TaskForMyAgent — پنل ادمین: صنف جدید با عنوان دلخواه + ماژول‌های پیش‌فرض صنف
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { INDUSTRY_CATEGORIES, INDUSTRY_LABELS } from '@repo/shared';
import { IndustryRegistryService } from './industry-registry.service.js';
import type { PrismaService } from '../../database/prisma.service.js';

type Row = {
  key: string;
  label: string;
  description?: string | null;
  isSystem?: boolean;
  isRegistrationEnabled?: boolean;
  endUserNoun?: string | null;
  endUserNounPlural?: string | null;
  sortOrder?: number;
  modules?: Array<{ key: string }>;
  _count?: { tenants: number };
};

function row(overrides: Row): Row {
  return {
    description: null,
    isSystem: false,
    isRegistrationEnabled: true,
    endUserNoun: null,
    endUserNounPlural: null,
    sortOrder: 100,
    modules: [],
    _count: { tenants: 0 },
    ...overrides,
  };
}

const DEFAULT_ROWS: Row[] = [
  row({
    key: 'SPORTS_COACHING',
    label: 'ورزش و تندرستی',
    isSystem: true,
    endUserNoun: 'شاگرد',
    sortOrder: 1,
    modules: [{ key: 'CRM' }, { key: 'SCH' }, { key: 'ATT' }],
  }),
  row({
    key: 'BEAUTY',
    label: 'زیبایی و آرایش',
    isSystem: true,
    isRegistrationEnabled: false,
    sortOrder: 3,
    modules: [{ key: 'CRM' }],
    _count: { tenants: 2 },
  }),
  row({ key: 'custom_gold', label: 'طلا و جواهر', modules: [{ key: 'CRM' }] }),
];

/** All 17 PRD verticals, as the seeding migration would have created them. */
function seededSystemRows(): Row[] {
  return INDUSTRY_CATEGORIES.map((key, index) =>
    row({ key, label: INDUSTRY_LABELS[key], isSystem: true, sortOrder: index + 1 }),
  );
}

function build(rows: Row[] = DEFAULT_ROWS) {
  // Work on a copy so mutating tests never pollute the shared fixture.
  const state: Row[] = rows.map((item) => ({
    ...item,
    modules: item.modules?.map((m) => ({ ...m })),
  }));
  const created: Array<Record<string, unknown>> = [];
  const prisma = {
    client: {
      /** Rows are filtered here so `get()` reflects the fake state. */
      industry: {
        findMany: vi.fn(async () => state.map((item) => ({ ...item }))),
        findUnique: vi.fn(async ({ where }: { where: { key: string } }) => {
          const found = state.find((item) => item.key === where.key);
          return found ? { ...found } : null;
        }),
        create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
          created.push(data);
          const modules = (data.modules as { createMany: { data: Array<{ key: string }> } })
            ?.createMany.data;
          state.push(
            row({
              key: data.key as string,
              label: data.label as string,
              isSystem: Boolean(data.isSystem),
              isRegistrationEnabled: data.isRegistrationEnabled !== false,
              endUserNoun: (data.endUserNoun as string) ?? null,
              sortOrder: data.sortOrder as number,
              modules: modules ?? [],
            }),
          );
          return { key: data.key };
        }),
        update: vi.fn(async ({ where, data }: { where: { key: string }; data: Row }) => {
          const found = state.find((item) => item.key === where.key)!;
          Object.assign(found, data);
          return found;
        }),
        delete: vi.fn(async ({ where }: { where: { key: string } }) => {
          const index = state.findIndex((item) => item.key === where.key);
          const [removed] = state.splice(index, 1);
          return removed;
        }),
        aggregate: vi.fn(async () => ({ _max: { sortOrder: 100 } })),
      },
      industryModuleDefault: {
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
        createMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
      $transaction: vi.fn((ops: unknown[]) => Promise.all(ops)),
    },
  };
  const service = new IndustryRegistryService(prisma as unknown as PrismaService);
  return { service, prisma, created, rows: state };
}

describe('IndustryRegistryService.list', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns every industry with label, flag, defaults and tenant count', async () => {
    const { service } = build([
      ...seededSystemRows().map((item) =>
        item.key === 'BEAUTY'
          ? { ...item, isRegistrationEnabled: false, _count: { tenants: 2 } }
          : item,
      ),
      row({ key: 'custom_gold', label: 'طلا و جواهر', modules: [{ key: 'CRM' }] }),
      row({
        key: 'custom_music',
        label: 'آموزش موسیقی کودکان',
        endUserNoun: 'هنرجو',
        modules: [{ key: 'CRM' }, { key: 'SCH' }],
      }),
    ]);
    const result = await service.list();

    expect(result).toHaveLength(19);
    expect(result.find((item) => item.key === 'BEAUTY')).toMatchObject({
      label: 'زیبایی و آرایش',
      isSystem: true,
      isRegistrationEnabled: false,
      tenantCount: 2,
    });
    expect(result.find((item) => item.key === 'custom_gold')).toMatchObject({
      label: 'طلا و جواهر',
      isSystem: false,
      defaultModules: ['CRM'],
    });
    expect(result.find((item) => item.key === 'custom_music')).toMatchObject({
      endUserNoun: 'هنرجو',
      defaultModules: ['CRM', 'SCH'],
      tenantCount: 0,
    });
  });

  it('seeds missing PRD industries one by one', async () => {
    const { service, prisma } = build([]);
    await service.list();
    expect(prisma.client.industry.create).toHaveBeenCalledTimes(17);
    const first = prisma.client.industry.create.mock.calls[0][0] as {
      data: { key: string; isSystem: boolean; label: string };
    };
    expect(first.data).toMatchObject({
      key: 'SPORTS_COACHING',
      isSystem: true,
      label: 'ورزش و تندرستی',
    });
  });
});

describe('IndustryRegistryService registration gate', () => {
  it('allows an enabled industry', async () => {
    const { service } = build();
    await expect(service.assertRegistrationEnabled('SPORTS_COACHING')).resolves.toBeUndefined();
  });

  it('rejects a disabled industry with its title in the message', async () => {
    const { service } = build();
    await expect(service.assertRegistrationEnabled('BEAUTY')).rejects.toMatchObject({
      status: 403,
      response: { code: 'INDUSTRY_REGISTRATION_DISABLED' },
    });
  });

  it('rejects an unknown industry', async () => {
    const { service } = build();
    await expect(service.assertRegistrationEnabled('nope')).rejects.toMatchObject({
      status: 400,
      response: { code: 'INDUSTRY_NOT_FOUND' },
    });
  });
});

describe('IndustryRegistryService.create', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates a custom industry with the chosen modules', async () => {
    const { service, created } = build();
    const result = await service.create({
      label: 'آموزش موسیقی کودکان',
      modules: ['CRM', 'SCH'],
      endUserNoun: 'هنرجو',
    });

    expect(created[0]).toMatchObject({
      label: 'آموزش موسیقی کودکان',
      isSystem: false,
      isRegistrationEnabled: true,
      endUserNoun: 'هنرجو',
    });
    expect(String(created[0].key)).toMatch(/^custom_/);
    expect(result.defaultModules).toEqual(['CRM', 'SCH']);
  });

  it('accepts an explicit latin key and rejects duplicates', async () => {
    const { service } = build();
    const created = await service.create({ label: 'طلا و جواهر', key: 'gold_shop' });
    expect(created.key).toBe('gold_shop');

    await expect(service.create({ label: 'طلا و جواهر', key: 'gold_shop' })).rejects.toMatchObject({
      status: 409,
    });
  });

  it('normalizes a human-typed key', async () => {
    const { service } = build();
    const created = await service.create({ label: 'وکالت', key: 'Law-Office' });
    expect(created.key).toBe('law_office');
  });

  it('rejects an invalid key', async () => {
    const { service } = build();
    await expect(service.create({ label: 'تست', key: '1bad key!' })).rejects.toMatchObject({
      response: { code: 'INVALID_INDUSTRY_KEY' },
    });
  });
});

describe('IndustryRegistryService.update / remove', () => {
  it('renames an industry', async () => {
    const { service } = build();
    const updated = await service.update('custom_gold', { label: 'طلا، جواهر و ساعت' });
    expect(updated.label).toBe('طلا، جواهر و ساعت');
  });

  it('refuses to delete a system industry', async () => {
    const { service } = build();
    await expect(service.remove('SPORTS_COACHING')).rejects.toMatchObject({
      response: { code: 'INDUSTRY_IS_SYSTEM' },
    });
  });

  it('refuses to delete an industry that still has businesses', async () => {
    const { service } = build([row({ key: 'in_use', label: 'در استفاده', _count: { tenants: 3 } })]);
    await expect(service.remove('in_use')).rejects.toMatchObject({ status: 409 });
  });

  it('deletes an empty custom industry', async () => {
    const { service, prisma } = build();
    const removed = await service.remove('custom_gold');
    expect(removed.key).toBe('custom_gold');
    expect(prisma.client.industry.delete).toHaveBeenCalledWith({ where: { key: 'custom_gold' } });
  });
});

describe('IndustryRegistryService.setModules', () => {
  beforeEach(() => vi.clearAllMocks());

  it('deletes modules outside the new set and inserts the wanted ones', async () => {
    const { service, prisma } = build();
    await service.setModules('custom_gold', ['CRM', 'FIN']);

    const [delArgs] = prisma.client.industryModuleDefault.deleteMany.mock.calls[0] as [
      { where: { industry: string; key?: { notIn: string[] } } },
    ];
    expect(delArgs.where).toMatchObject({ industry: 'custom_gold', key: { notIn: ['CRM', 'FIN'] } });
    const [createArgs] = prisma.client.industryModuleDefault.createMany.mock.calls[0] as [
      { data: Array<{ industry: string; key: string }> },
    ];
    expect(createArgs.data).toEqual([
      { industry: 'custom_gold', key: 'CRM' },
      { industry: 'custom_gold', key: 'FIN' },
    ]);
  });

  it('can clear the whole default set', async () => {
    const { service, prisma } = build();
    await service.setModules('custom_gold', []);
    const [delArgs] = prisma.client.industryModuleDefault.deleteMany.mock.calls[0] as [
      { where: Record<string, unknown> },
    ];
    expect(delArgs.where).toEqual({ industry: 'custom_gold' });
    expect(prisma.client.industryModuleDefault.createMany).not.toHaveBeenCalled();
  });
});

describe('IndustryRegistryService.defaultModules', () => {
  it('reads the editable registry value instead of the static fallback', async () => {
    const { service } = build();
    expect(await service.defaultModules('BEAUTY')).toEqual(['CRM']);
  });

  it('returns an empty set when the industry has no defaults', async () => {
    const empty = build([row({ key: 'custom_x', label: 'بی‌ماژول' })]);
    expect(await empty.service.defaultModules('custom_x')).toEqual([]);
  });

  it('falls back to the PRD defaults for unknown keys', async () => {
    const { service } = build();
    expect(await service.defaultModules('RETAIL')).toEqual(
      expect.arrayContaining(['CRM', 'FIN', 'INV', 'SHOP', 'RPT']),
    );
  });
});

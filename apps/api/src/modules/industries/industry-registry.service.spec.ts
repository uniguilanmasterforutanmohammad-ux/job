// TaskForMyAgent — پنل ادمین: مدیریت صنف‌ها (غیرفعال‌سازی ثبت‌نام + ماژول‌های پیش‌فرض)
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { IndustryRegistryService } from './industry-registry.service.js';
import type { PrismaService } from '../../database/prisma.service.js';

type SettingRow = { industry: string; isRegistrationEnabled: boolean; updatedAt: Date };
type ModuleRow = { industry: string; key: string };

function build(settings: SettingRow[], modules: ModuleRow[]) {
  const prisma = {
    client: {
      industrySetting: {
        findMany: vi.fn().mockResolvedValue(settings),
        findUnique: vi.fn().mockResolvedValue({ id: 's1' }),
        create: vi.fn().mockResolvedValue({}),
        update: vi.fn().mockResolvedValue({}),
      },
      industryModuleDefault: {
        findMany: vi.fn().mockResolvedValue(modules),
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
        createMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
      $transaction: vi.fn((ops: unknown[]) => Promise.all(ops)),
    },
  };
  const service = new IndustryRegistryService(prisma as unknown as PrismaService);
  return { service, prisma };
}

const rows = (): { settings: SettingRow[]; modules: ModuleRow[] } => ({
  settings: [
    { industry: 'SPORTS_COACHING', isRegistrationEnabled: true, updatedAt: new Date() },
    { industry: 'BEAUTY', isRegistrationEnabled: false, updatedAt: new Date() },
  ],
  modules: [
    { industry: 'SPORTS_COACHING', key: 'CRM' },
    { industry: 'SPORTS_COACHING', key: 'SCH' },
    { industry: 'BEAUTY', key: 'FIN' },
  ],
});

describe('IndustryRegistryService.list', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns every industry with its label, flag and default modules', async () => {
    const { settings, modules } = rows();
    const { service } = build(settings, modules);

    const result = await service.list();
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      industry: 'SPORTS_COACHING',
      label: 'ورزش و تندرستی',
      isRegistrationEnabled: true,
      defaultModules: ['CRM', 'SCH'],
    });
    expect(result[1].isRegistrationEnabled).toBe(false);
  });

  it('seeds industries that have no setting row yet', async () => {
    const { service, prisma } = build([], []);
    prisma.client.industrySetting.findUnique.mockResolvedValue(null);

    await service.list();
    // 17 PRD industries are ensured, one by one.
    expect(prisma.client.industrySetting.create).toHaveBeenCalledTimes(17);
  });
});

describe('IndustryRegistryService.assertRegistrationEnabled', () => {
  it('passes for an enabled industry', async () => {
    const { settings, modules } = rows();
    const { service } = build(settings, modules);
    await expect(service.assertRegistrationEnabled('SPORTS_COACHING')).resolves.toBeUndefined();
  });

  it('rejects a disabled industry with a dedicated code', async () => {
    const { settings, modules } = rows();
    const { service } = build(settings, modules);
    await expect(service.assertRegistrationEnabled('BEAUTY')).rejects.toMatchObject({
      status: 403,
      response: { code: 'INDUSTRY_REGISTRATION_DISABLED' },
    });
  });

  it('rejects an unknown industry', async () => {
    const { settings, modules } = rows();
    const { service } = build(settings, modules);
    await expect(service.assertRegistrationEnabled('NOT_A_VERTICAL')).rejects.toMatchObject({
      status: 400,
      response: { code: 'INDUSTRY_NOT_FOUND' },
    });
  });
});

describe('IndustryRegistryService.setModules', () => {
  beforeEach(() => vi.clearAllMocks());

  it('deletes modules outside the new set and inserts the wanted ones', async () => {
    const { settings, modules } = rows();
    const { service, prisma } = build(settings, modules);

    await service.setModules('SPORTS_COACHING', ['CRM', 'FIN']);

    const [delArgs] = prisma.client.industryModuleDefault.deleteMany.mock.calls[0] as [
      { where: { industry: string; key?: { notIn: string[] } } },
    ];
    expect(delArgs.where).toMatchObject({
      industry: 'SPORTS_COACHING',
      key: { notIn: ['CRM', 'FIN'] },
    });
    const [createArgs] = prisma.client.industryModuleDefault.createMany.mock.calls[0] as [
      { data: Array<{ industry: string; key: string }> },
    ];
    expect(createArgs.data.map((row) => row.key)).toEqual(['CRM', 'FIN']);
  });

  it('can clear the whole default set of an industry', async () => {
    const { settings, modules } = rows();
    const { service, prisma } = build(settings, modules);

    await service.setModules('BEAUTY', []);

    const [delArgs] = prisma.client.industryModuleDefault.deleteMany.mock.calls[0] as [
      { where: Record<string, unknown> },
    ];
    expect(delArgs.where).toEqual({ industry: 'BEAUTY' });
    expect(prisma.client.industryModuleDefault.createMany).not.toHaveBeenCalled();
  });
});

describe('IndustryRegistryService.defaultModules', () => {
  it('prefers the editable registry value', async () => {
    const { settings, modules } = rows();
    const { service } = build(settings, modules);
    expect(await service.defaultModules('BEAUTY')).toEqual(['FIN']);
  });

  it('falls back to the PRD defaults for industries outside the registry', async () => {
    const { settings, modules } = rows();
    const { service } = build(settings, modules);
    expect(await service.defaultModules('RETAIL')).toEqual(
      expect.arrayContaining(['CRM', 'FIN', 'INV', 'SHOP', 'RPT']),
    );
  });
});

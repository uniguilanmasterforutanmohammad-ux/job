// TaskForMyAgent — پنل ادمین: مدیریت صنف‌ها (غیرفعال‌سازی ثبت‌نام + ماژول‌های پیش‌فرض)
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { AdminIndustryService } from './admin-industry.service.js';
import type { AdminAuditService } from './admin-audit.service.js';
import type { IndustryRegistryService } from '../industries/industry-registry.service.js';
import type { PlatformPrincipal } from './admin.constants.js';

const actor: PlatformPrincipal = {
  platformMemberId: 'p1',
  phone: '09120000001',
  fullName: 'Admin',
  role: 'SUPER_ADMIN',
  twoFactorEnabled: true,
};

const entry = (overrides: Record<string, unknown> = {}) => ({
  key: 'BEAUTY',
  label: 'آرایشگاه و سالن زیبایی',
  description: null,
  isSystem: true,
  isRegistrationEnabled: true,
  endUserNoun: 'مشتری',
  endUserNounPlural: 'مشتریان',
  sortOrder: 3,
  defaultModules: ['CRM', 'SCH'],
  tenantCount: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

function build() {
  const registry = {
    list: vi.fn().mockResolvedValue([entry()]),
    get: vi.fn().mockResolvedValue(entry()),
    create: vi.fn().mockResolvedValue(
      entry({ key: 'custom_music', label: 'آموزش موسیقی', isSystem: false, defaultModules: ['CRM'] }),
    ),
    update: vi.fn().mockResolvedValue(entry({ label: 'آرایشگاه، سالن زیبایی و پوست' })),
    remove: vi.fn().mockResolvedValue(entry({ key: 'custom_music', isSystem: false })),
    setRegistration: vi.fn().mockResolvedValue({
      before: entry(),
      after: entry({ isRegistrationEnabled: false }),
    }),
    setModules: vi.fn().mockResolvedValue({
      before: entry(),
      after: entry({ defaultModules: ['CRM'] }),
    }),
  };
  const audit = { record: vi.fn().mockResolvedValue(undefined) };
  const service = new AdminIndustryService(
    registry as unknown as IndustryRegistryService,
    audit as unknown as AdminAuditService,
  );
  return { service, registry, audit };
}

describe('AdminIndustryService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates an industry with an arbitrary title and audits it', async () => {
    const { service, registry, audit } = build();
    const result = await service.create(actor, {
      label: 'آموزش موسیقی',
      modules: ['CRM'],
      endUserNoun: 'هنرجو',
      isRegistrationEnabled: true,
    });

    expect(registry.create).toHaveBeenCalledWith({
      label: 'آموزش موسیقی',
      modules: ['CRM'],
      endUserNoun: 'هنرجو',
      isRegistrationEnabled: true,
    });
    expect(result.key).toBe('custom_music');
    expect(audit.record).toHaveBeenCalledWith(
      actor,
      expect.objectContaining({
        action: 'industry.create',
        entity: 'industry',
        entityId: 'custom_music',
      }),
      {},
    );
  });

  it('renames an industry and audits before/after', async () => {
    const { service, registry, audit } = build();
    const result = await service.update(actor, 'BEAUTY', { label: 'آرایشگاه، سالن زیبایی و پوست' });

    expect(registry.update).toHaveBeenCalledWith('BEAUTY', {
      label: 'آرایشگاه، سالن زیبایی و پوست',
    });
    expect(result.label).toBe('آرایشگاه، سالن زیبایی و پوست');
    expect(audit.record).toHaveBeenCalledWith(
      actor,
      expect.objectContaining({
        action: 'industry.update',
        entityId: 'BEAUTY',
        before: expect.objectContaining({ label: 'آرایشگاه و سالن زیبایی' }),
        after: expect.objectContaining({ label: 'آرایشگاه، سالن زیبایی و پوست' }),
      }),
      {},
    );
  });

  it('deletes a custom industry and audits it', async () => {
    const { service, registry, audit } = build();
    const result = await service.remove(actor, 'custom_music');

    expect(registry.remove).toHaveBeenCalledWith('custom_music');
    expect(result.key).toBe('custom_music');
    expect(audit.record).toHaveBeenCalledWith(
      actor,
      expect.objectContaining({
        action: 'industry.delete',
        entity: 'industry',
        entityId: 'custom_music',
      }),
      {},
    );
  });

  it('toggles registration and audits the change', async () => {
    const { service, registry, audit } = build();
    const result = await service.setRegistration(actor, 'BEAUTY', {
      isRegistrationEnabled: false,
      reason: 'کمبود ظرفیت',
    });

    expect(registry.setRegistration).toHaveBeenCalledWith('BEAUTY', false);
    expect(result.isRegistrationEnabled).toBe(false);
    expect(audit.record).toHaveBeenCalledWith(
      actor,
      expect.objectContaining({
        action: 'industry.registration_toggle',
        entity: 'industry',
        entityId: 'BEAUTY',
        after: { isRegistrationEnabled: false, reason: 'کمبود ظرفیت' },
      }),
      {},
    );
  });

  it('replaces the default module set and audits before/after', async () => {
    const { service, registry, audit } = build();
    const result = await service.setModules(actor, 'BEAUTY', { keys: ['CRM'] });

    expect(registry.setModules).toHaveBeenCalledWith('BEAUTY', ['CRM']);
    expect(result.defaultModules).toEqual(['CRM']);
    expect(audit.record).toHaveBeenCalledWith(
      actor,
      expect.objectContaining({
        action: 'industry.modules_update',
        before: { defaultModules: ['CRM', 'SCH'] },
        after: { defaultModules: ['CRM'] },
      }),
      {},
    );
  });
});

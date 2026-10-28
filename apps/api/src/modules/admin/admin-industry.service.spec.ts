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
  industry: 'BEAUTY',
  label: 'آرایشگاه و سالن زیبایی',
  isRegistrationEnabled: true,
  defaultModules: ['CRM', 'SCH'],
  updatedAt: new Date(),
  ...overrides,
});

function build() {
  const registry = {
    list: vi.fn().mockResolvedValue([entry()]),
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

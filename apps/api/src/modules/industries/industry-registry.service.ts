import { Injectable, Logger } from '@nestjs/common';
import {
  INDUSTRY_CATEGORIES,
  defaultModulesForIndustry,
  industryLabel,
  type ModuleKey,
} from '@repo/shared';
import { DomainException } from '../../common/exceptions/domain.exception.js';
import { PrismaService } from '../../database/prisma.service.js';
import type { IndustryCategory } from '@repo/db';

export type IndustryEntry = {
  industry: IndustryCategory;
  label: string;
  /** False => `/register` must not offer this industry. */
  isRegistrationEnabled: boolean;
  /** Editable default module set of this industry. */
  defaultModules: ModuleKey[];
  updatedAt: Date;
};

/**
 * Official registry of the PRD §17 industry verticals.
 *
 * Owns two platform-level facts about every industry: whether new businesses
 * may register in it, and which modules a new business of that industry starts
 * with. Both are editable from the admin console, so this service — not the
 * static `INDUSTRY_DEFAULT_MODULES` map — is the runtime source of truth.
 */
@Injectable()
export class IndustryRegistryService {
  private readonly logger = new Logger(IndustryRegistryService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Every PRD industry with its registration flag and default modules. */
  async list(): Promise<IndustryEntry[]> {
    await this.ensureSeeded();
    const [settings, modules] = await this.prisma.client.$transaction([
      this.prisma.client.industrySetting.findMany({ orderBy: { industry: 'asc' } }),
      this.prisma.client.industryModuleDefault.findMany({ orderBy: { key: 'asc' } }),
    ]);

    const modulesByIndustry = new Map<string, ModuleKey[]>();
    for (const row of modules) {
      const list = modulesByIndustry.get(row.industry) ?? [];
      list.push(row.key as ModuleKey);
      modulesByIndustry.set(row.industry, list);
    }

    return settings.map((setting) => ({
      industry: setting.industry,
      label: industryLabel(setting.industry),
      isRegistrationEnabled: setting.isRegistrationEnabled,
      defaultModules: modulesByIndustry.get(setting.industry) ?? [],
      updatedAt: setting.updatedAt,
    }));
  }

  async get(industry: string): Promise<IndustryEntry> {
    const all = await this.list();
    const found = all.find((entry) => entry.industry === industry);
    if (!found) throw DomainException.notFound('صنف');
    return found;
  }

  /** Default modules per industry, for bulk use in list endpoints. */
  async defaultsByIndustry(): Promise<Map<string, ModuleKey[]>> {
    const rows = await this.list();
    return new Map(rows.map((entry) => [entry.industry, entry.defaultModules]));
  }

  /** Default module set a new business of `industry` should start with. */
  async defaultModules(industry?: string | null): Promise<ModuleKey[]> {
    if (!industry) return defaultModulesForIndustry(industry);
    const all = await this.list();
    return all.find((entry) => entry.industry === industry)?.defaultModules ?? defaultModulesForIndustry(industry);
  }

  async isRegistrationEnabled(industry: string): Promise<boolean> {
    const all = await this.list();
    return all.find((entry) => entry.industry === industry)?.isRegistrationEnabled ?? false;
  }

  /** Throws when the platform admin has closed registration for `industry`. */
  async assertRegistrationEnabled(industry: string): Promise<void> {
    const all = await this.list();
    const entry = all.find((item) => item.industry === industry);
    if (!entry) {
      throw DomainException.badRequest('صنف انتخاب‌شده معتبر نیست', 'INDUSTRY_NOT_FOUND');
    }
    if (!entry.isRegistrationEnabled) {
      throw DomainException.forbidden(
        'ثبت‌نام در این صنف فعلاً غیرفعال است. برای اطلاع از زمان فعال‌سازی با پشتیبانی تماس بگیرید.',
        'INDUSTRY_REGISTRATION_DISABLED',
      );
    }
  }

  /** Enables/disables self-service registration for an industry. */
  async setRegistration(
    industry: string,
    isRegistrationEnabled: boolean,
  ): Promise<{ before: IndustryEntry; after: IndustryEntry }> {
    const before = await this.get(industry);
    await this.ensureSetting(industry);
    await this.prisma.client.industrySetting.update({
      where: { industry: industry as IndustryCategory },
      data: { isRegistrationEnabled },
    });
    return { before, after: await this.get(industry) };
  }

  /** Replaces the default module set of an industry. */
  async setModules(
    industry: string,
    keys: ModuleKey[],
  ): Promise<{ before: IndustryEntry; after: IndustryEntry }> {
    const before = await this.get(industry);
    await this.ensureSetting(industry);
    const wanted = [...new Set(keys)];

    const operations = [
      this.prisma.client.industryModuleDefault.deleteMany({
        where: {
          industry: industry as IndustryCategory,
          ...(wanted.length ? { key: { notIn: wanted } } : {}),
        },
      }),
    ];
    if (wanted.length) {
      operations.push(
        this.prisma.client.industryModuleDefault.createMany({
          data: wanted.map((key) => ({ industry: industry as IndustryCategory, key })),
          skipDuplicates: true,
        }) as never,
      );
    }
    await this.prisma.client.$transaction(operations);

    return { before, after: await this.get(industry) };
  }

  /**
   * Safety net for environments where the seeding migration did not run:
   * creates missing industry rows from the static PRD defaults. Existing rows
   * are never touched, so an intentionally emptied module set stays empty.
   */
  private async ensureSeeded(): Promise<void> {
    const existing = await this.prisma.client.industrySetting.findMany({
      select: { industry: true },
    });
    const known = new Set(existing.map((row) => row.industry as string));
    const missing = INDUSTRY_CATEGORIES.filter((industry) => !known.has(industry));
    if (missing.length === 0) return;

    this.logger.warn(`Seeding missing industry settings: ${missing.join(', ')}`);
    await this.ensureSetting(missing[0]);
    for (const industry of missing.slice(1)) {
      await this.ensureSetting(industry);
    }
  }

  private async ensureSetting(industry: string): Promise<void> {
    const category = industry as IndustryCategory;
    const existing = await this.prisma.client.industrySetting.findUnique({
      where: { industry: category },
      select: { id: true },
    });
    if (existing) return;

    await this.prisma.client.industrySetting.create({
      data: {
        industry: category,
        isRegistrationEnabled: true,
        modules: {
          createMany: {
            data: defaultModulesForIndustry(industry).map((key) => ({ key })),
          },
        },
      },
    });
  }
}

import { Injectable, Logger } from '@nestjs/common';
import {
  END_USER_NOUNS,
  END_USER_NOUNS_PLURAL,
  INDUSTRY_CATEGORIES,
  INDUSTRY_LABELS,
  defaultModulesForIndustry,
  type ModuleKey,
} from '@repo/shared';
import { DomainException } from '../../common/exceptions/domain.exception.js';
import { PrismaService } from '../../database/prisma.service.js';
import type { Prisma } from '@repo/db';

export type IndustryEntry = {
  key: string;
  label: string;
  description: string | null;
  /** PRD §17 verticals are system rows and cannot be deleted. */
  isSystem: boolean;
  isRegistrationEnabled: boolean;
  endUserNoun: string | null;
  endUserNounPlural: string | null;
  sortOrder: number;
  /** Editable default module set of this industry. */
  defaultModules: ModuleKey[];
  /** How many businesses currently belong to this industry. */
  tenantCount: number;
  createdAt: Date;
  updatedAt: Date;
};

export type CreateIndustryInput = {
  label: string;
  key?: string;
  description?: string;
  endUserNoun?: string;
  endUserNounPlural?: string;
  sortOrder?: number;
  isRegistrationEnabled?: boolean;
  modules?: ModuleKey[];
};

export type UpdateIndustryInput = {
  label?: string;
  description?: string | null;
  endUserNoun?: string | null;
  endUserNounPlural?: string | null;
  sortOrder?: number;
  isRegistrationEnabled?: boolean;
};

const KEY_PATTERN = /^[a-z][a-z0-9_]{2,39}$/;

/**
 * Registry of industries (حوزهٔ فعالیت), the platform's second axis next to
 * tenants. The 17 PRD verticals are system rows; the platform admin may add
 * custom industries with any title and manage, per industry, whether new
 * businesses may register and which modules they start with.
 *
 * This service is the only reader/writer of the `industries` and
 * `industry_default_modules` tables, so signup, tenant creation and the admin
 * console always agree.
 */
@Injectable()
export class IndustryRegistryService {
  private readonly logger = new Logger(IndustryRegistryService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Every industry with its registration flag, defaults and tenant count. */
  async list(): Promise<IndustryEntry[]> {
    await this.ensureSeeded();
    const rows = await this.prisma.client.industry.findMany({
      orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }],
      include: {
        modules: { select: { key: true } },
        _count: { select: { tenants: true } },
      },
    });

    return rows.map((row) => ({
      key: row.key,
      label: row.label,
      description: row.description,
      isSystem: row.isSystem,
      isRegistrationEnabled: row.isRegistrationEnabled,
      endUserNoun: row.endUserNoun,
      endUserNounPlural: row.endUserNounPlural,
      sortOrder: row.sortOrder,
      defaultModules: row.modules.map((module) => module.key as ModuleKey),
      tenantCount: row._count.tenants,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }));
  }

  async get(key: string): Promise<IndustryEntry> {
    const all = await this.list();
    const found = all.find((entry) => entry.key === key);
    if (!found) throw DomainException.notFound('صنف');
    return found;
  }

  /** Default modules per industry, for bulk use in list endpoints. */
  async defaultsByIndustry(): Promise<Map<string, ModuleKey[]>> {
    const rows = await this.list();
    return new Map(rows.map((entry) => [entry.key, entry.defaultModules]));
  }

  /** Default module set a new business of `industry` should start with. */
  async defaultModules(industry?: string | null): Promise<ModuleKey[]> {
    if (!industry) return defaultModulesForIndustry(industry);
    const found = await this.prisma.client.industry.findUnique({
      where: { key: industry },
      select: { modules: { select: { key: true } } },
    });
    if (!found) return defaultModulesForIndustry(industry);
    return found.modules.map((module) => module.key as ModuleKey);
  }

  /** Throws when the platform admin has closed registration for `industry`. */
  async assertRegistrationEnabled(industry: string): Promise<void> {
    const found = await this.prisma.client.industry.findUnique({
      where: { key: industry },
      select: { label: true, isRegistrationEnabled: true },
    });
    if (!found) {
      throw DomainException.badRequest('صنف انتخاب‌شده معتبر نیست', 'INDUSTRY_NOT_FOUND');
    }
    if (!found.isRegistrationEnabled) {
      throw DomainException.forbidden(
        `ثبت‌نام در صنف «${found.label}» فعلاً غیرفعال است. برای اطلاع از زمان فعال‌سازی با پشتیبانی تماس بگیرید.`,
        'INDUSTRY_REGISTRATION_DISABLED',
      );
    }
  }

  /** Creates a custom industry (any title) with its default module set. */
  async create(input: CreateIndustryInput): Promise<IndustryEntry> {
    const label = input.label.trim();
    const key = input.key ? this.normalizeKey(input.key) : await this.uniqueKey();

    const existing = await this.prisma.client.industry.findUnique({
      where: { key },
      select: { key: true },
    });
    if (existing) throw DomainException.conflict('این کلید صنف قبلاً استفاده شده است');

    const maxSort = await this.prisma.client.industry.aggregate({ _max: { sortOrder: true } });
    const modules = [...new Set(input.modules ?? [])];

    const created = await this.prisma.client.industry.create({
      data: {
        key,
        label,
        description: input.description?.trim() || null,
        isSystem: false,
        isRegistrationEnabled: input.isRegistrationEnabled ?? true,
        endUserNoun: input.endUserNoun?.trim() || null,
        endUserNounPlural: input.endUserNounPlural?.trim() || null,
        sortOrder: input.sortOrder ?? (maxSort._max.sortOrder ?? 0) + 10,
        modules: { createMany: { data: modules.map((moduleKey) => ({ key: moduleKey })) } },
      },
    });

    this.logger.log(`Industry created: ${created.key}`);
    return this.get(key);
  }

  /** Renames / re-labels an existing industry (system or custom). */
  async update(key: string, input: UpdateIndustryInput): Promise<IndustryEntry> {
    await this.get(key);
    await this.prisma.client.industry.update({
      where: { key },
      data: {
        ...(input.label !== undefined ? { label: input.label.trim() } : {}),
        ...(input.description !== undefined
          ? { description: input.description?.trim() || null }
          : {}),
        ...(input.endUserNoun !== undefined
          ? { endUserNoun: input.endUserNoun?.trim() || null }
          : {}),
        ...(input.endUserNounPlural !== undefined
          ? { endUserNounPlural: input.endUserNounPlural?.trim() || null }
          : {}),
        ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
        ...(input.isRegistrationEnabled !== undefined
          ? { isRegistrationEnabled: input.isRegistrationEnabled }
          : {}),
      },
    });
    return this.get(key);
  }

  /**
   * Deletes a custom industry. System verticals can never be removed, and an
   * industry that still has businesses must be migrated first.
   */
  async remove(key: string): Promise<IndustryEntry> {
    const before = await this.get(key);
    if (before.isSystem) {
      throw DomainException.badRequest(
        'صنف‌های پیش‌فرض پلتفرم قابل حذف نیستند؛ فقط می‌توانید ثبت‌نام آن‌ها را غیرفعال کنید',
        'INDUSTRY_IS_SYSTEM',
      );
    }
    if (before.tenantCount > 0) {
      throw DomainException.conflict(
        `این صنف ${before.tenantCount} کسب‌وکار دارد؛ ابتدا صنف آن‌ها را تغییر دهید`,
      );
    }

    await this.prisma.client.industry.delete({ where: { key } });
    return before;
  }

  /** Enables/disables self-service registration for an industry. */
  async setRegistration(
    key: string,
    isRegistrationEnabled: boolean,
  ): Promise<{ before: IndustryEntry; after: IndustryEntry }> {
    const before = await this.get(key);
    const after = await this.update(key, { isRegistrationEnabled });
    return { before, after };
  }

  /** Replaces the default module set of an industry. */
  async setModules(
    key: string,
    keys: ModuleKey[],
  ): Promise<{ before: IndustryEntry; after: IndustryEntry }> {
    const before = await this.get(key);
    const wanted = [...new Set(keys)];

    const operations: Prisma.PrismaPromise<unknown>[] = [
      this.prisma.client.industryModuleDefault.deleteMany({
        where: { industry: key, ...(wanted.length ? { key: { notIn: wanted } } : {}) },
      }),
    ];
    if (wanted.length) {
      operations.push(
        this.prisma.client.industryModuleDefault.createMany({
          data: wanted.map((moduleKey) => ({ industry: key, key: moduleKey })),
          skipDuplicates: true,
        }),
      );
    }
    await this.prisma.client.$transaction(operations);

    return { before, after: await this.get(key) };
  }

  private normalizeKey(raw: string): string {
    const key = raw
      .trim()
      .toLowerCase()
      .replace(/[\s-]+/g, '_')
      .replace(/[^a-z0-9_]/g, '')
      .slice(0, 40);
    if (!KEY_PATTERN.test(key)) {
      throw DomainException.badRequest(
        'کلید صنف باید با حرف انگلیسی شروع شود و فقط حروف کوچک، رقم و _ داشته باشد',
        'INVALID_INDUSTRY_KEY',
      );
    }
    return key;
  }

  private async uniqueKey(): Promise<string> {
    const base = `custom_${Math.random().toString(36).slice(2, 8)}`;
    const exists = await this.prisma.client.industry.findUnique({
      where: { key: base },
      select: { key: true },
    });
    if (exists) return this.uniqueKey();
    return base;
  }

  /**
   * Safety net for environments where the seeding migration did not run:
   * creates missing PRD industries from the shared reference data. Existing
   * rows (including intentionally emptied module sets) are never touched.
   */
  private async ensureSeeded(): Promise<void> {
    const existing = await this.prisma.client.industry.findMany({ select: { key: true } });
    const known = new Set(existing.map((row) => row.key));
    const missing = INDUSTRY_CATEGORIES.filter((industry) => !known.has(industry));
    if (missing.length === 0) return;

    this.logger.warn(`Seeding missing industries: ${missing.join(', ')}`);
    for (const industry of missing) {
      await this.prisma.client.industry.create({
        data: {
          key: industry,
          label: INDUSTRY_LABELS[industry],
          isSystem: true,
          sortOrder: INDUSTRY_CATEGORIES.indexOf(industry) + 1,
          endUserNoun: END_USER_NOUNS[industry] ?? null,
          endUserNounPlural: END_USER_NOUNS_PLURAL[industry] ?? null,
          modules: {
            createMany: {
              data: defaultModulesForIndustry(industry).map((key) => ({ key })),
            },
          },
        },
      });
    }
  }
}

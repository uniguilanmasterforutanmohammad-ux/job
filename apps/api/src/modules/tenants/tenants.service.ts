import { Injectable } from '@nestjs/common';
import { resolveModuleDependencies, type ModuleKey } from '@repo/shared';
import { DomainException } from '../../common/exceptions/domain.exception.js';
import { PrismaService } from '../../database/prisma.service.js';
import { ModuleAccessService } from './module-access.service.js';

@Injectable()
export class TenantsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: ModuleAccessService,
  ) {}

  async current(tenantId: string) {
    const tenant = await this.prisma.client.tenant.findUnique({
      where: { id: tenantId },
      include: {
        branches: { where: { deletedAt: null } },
        modules: true,
        subscription: { include: { plan: true } },
        _count: { select: { members: true, customers: true } },
      },
    });
    if (!tenant) throw DomainException.notFound('کسب‌وکار');
    return tenant;
  }

  async update(
    tenantId: string,
    data: Partial<{
      name: string;
      legalName: string;
      nationalId: string;
      economicCode: string;
      phone: string;
      email: string;
      address: string;
      logoUrl: string;
      timezone: string;
      currency: string;
      calendar: 'JALALI' | 'GREGORIAN';
      locale: string;
      invoicePrefix: string;
      taxRate: number;
      marketplaceEnabled: boolean;
      tagline: string;
      city: string;
      settings: Record<string, unknown>;
    }>,
  ) {
    await this.assertExists(tenantId);
    const { settings, taxRate, ...rest } = data;
    return this.prisma.client.tenant.update({
      where: { id: tenantId },
      data: {
        ...rest,
        ...(taxRate !== undefined ? { taxRate } : {}),
        ...(settings !== undefined ? { settings: settings as never } : {}),
      },
    });
  }

  listModules(tenantId: string) {
    return this.prisma.client.tenantModule.findMany({
      where: { tenantId },
      orderBy: { key: 'asc' },
    });
  }

  /** Enables modules, auto-resolving their dependencies (PRD §2). */
  async enableModules(tenantId: string, keys: ModuleKey[]) {
    await this.assertExists(tenantId);
    const resolved = resolveModuleDependencies(keys);

    await this.prisma.client.$transaction(
      resolved.map((key) =>
        this.prisma.client.tenantModule.upsert({
          where: { tenantId_key: { tenantId, key } },
          update: { isEnabled: true, enabledAt: new Date(), disabledAt: null },
          create: { tenantId, key, isEnabled: true },
        }),
      ),
    );

    await this.access.invalidate(tenantId);
    return { enabled: resolved };
  }

  async disableModule(tenantId: string, key: ModuleKey) {
    await this.prisma.client.tenantModule.upsert({
      where: { tenantId_key: { tenantId, key } },
      update: { isEnabled: false, disabledAt: new Date() },
      create: { tenantId, key, isEnabled: false },
    });
    await this.access.invalidate(tenantId);
    return { disabled: key };
  }

  async listBranches(tenantId: string) {
    return this.prisma.client.branch.findMany({
      where: { tenantId, deletedAt: null },
      orderBy: { createdAt: 'asc' },
      include: {
        // «آموزشگاه یک: ۲۰ زبان‌آموز» — how many live people belong to each
        // location (soft-deleted files must not keep a location occupied).
        _count: {
          select: {
            members: { where: { deletedAt: null } },
            customers: { where: { deletedAt: null } },
          },
        },
      },
    });
  }

  async createBranch(
    tenantId: string,
    data: { name: string; code?: string; city?: string; address?: string; phone?: string },
  ) {
    await this.assertExists(tenantId);
    await this.assertCodeFree(tenantId, data.code);
    return this.prisma.client.branch.create({ data: { tenantId, ...data } });
  }

  /** Renames/re-addresses a branch or (de)activates it. */
  async updateBranch(
    tenantId: string,
    id: string,
    data: {
      name?: string;
      code?: string;
      city?: string;
      address?: string;
      phone?: string;
      isActive?: boolean;
    },
  ) {
    await this.assertBranch(tenantId, id);
    await this.assertCodeFree(tenantId, data.code, id);
    return this.prisma.client.branch.update({ where: { id }, data });
  }

  /**
   * Soft-deletes a branch. Refuses while people are still attached to it, so a
   * school cannot lose the location that its زبان‌آموزها are filed under.
   */
  async removeBranch(tenantId: string, id: string) {
    const branch = await this.assertBranch(tenantId, id);
    if (branch._count.members > 0 || branch._count.customers > 0) {
      throw DomainException.conflict(
        `این شعبه ${branch._count.members + branch._count.customers} عضو/مراجعه‌کننده دارد؛ ابتدا آن‌ها را به شعبهٔ دیگری منتقل کنید`,
      );
    }
    await this.prisma.client.branch.update({
      where: { id },
      // `code` is unique per tenant, so it has to be released on delete —
      // otherwise the same code could never be used again (see the phone rule
      // for soft-deleted customers).
      data: { deletedAt: new Date(), isActive: false, code: null },
    });
    return { message: 'شعبه حذف شد' };
  }

  private async assertBranch(tenantId: string, id: string) {
    const branch = await this.prisma.client.branch.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: {
        _count: {
          select: {
            members: { where: { deletedAt: null } },
            customers: { where: { deletedAt: null } },
          },
        },
      },
    });
    if (!branch) throw DomainException.notFound('شعبه');
    return branch;
  }

  /** Branch codes are unique per tenant; only live branches occupy one. */
  private async assertCodeFree(tenantId: string, code?: string, exceptId?: string) {
    if (!code) return;
    const taken = await this.prisma.client.branch.findFirst({
      where: {
        tenantId,
        code,
        deletedAt: null,
        ...(exceptId ? { id: { not: exceptId } } : {}),
      },
      select: { id: true },
    });
    if (taken) {
      throw DomainException.conflict('این کد شعبه قبلاً استفاده شده است');
    }
  }

  private async assertExists(tenantId: string): Promise<void> {
    const found = await this.prisma.client.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true },
    });
    if (!found) throw DomainException.notFound('کسب‌وکار');
  }
}

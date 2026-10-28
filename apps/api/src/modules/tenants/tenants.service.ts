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
    });
  }

  async createBranch(
    tenantId: string,
    data: { name: string; code?: string; city?: string; address?: string; phone?: string },
  ) {
    await this.assertExists(tenantId);
    return this.prisma.client.branch.create({ data: { tenantId, ...data } });
  }

  private async assertExists(tenantId: string): Promise<void> {
    const found = await this.prisma.client.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true },
    });
    if (!found) throw DomainException.notFound('کسب‌وکار');
  }
}

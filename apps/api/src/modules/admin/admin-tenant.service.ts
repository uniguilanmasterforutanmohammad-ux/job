import { Injectable } from '@nestjs/common';
import { buildMeta, toSkipTake } from '../../common/dto/pagination.dto.js';
import { DomainException } from '../../common/exceptions/domain.exception.js';
import { PrismaService } from '../../database/prisma.service.js';
import type { IndustryCategory, TenantStatus } from '@repo/db';
import { AdminAuditService, type AuditContext } from './admin-audit.service.js';
import type { PlatformPrincipal } from './admin.constants.js';
import type {
  AdminListTenantsDto,
  AdminTenantStatusDto,
  AdminUpdateTenantDto,
} from './dto/admin.schemas.js';

const TENANT_SUMMARY_SELECT = {
  id: true,
  slug: true,
  name: true,
  industry: true,
  status: true,
  phone: true,
  email: true,
  currency: true,
  createdAt: true,
  deletedAt: true,
  subscription: { select: { status: true, plan: { select: { code: true, name: true } } } },
  _count: { select: { members: true, branches: true, customers: true } },
} as const;

@Injectable()
export class AdminTenantService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AdminAuditService,
  ) {}

  async list(dto: AdminListTenantsDto) {
    const where = {
      ...(dto.status ? { status: dto.status as TenantStatus } : {}),
      ...(dto.industry ? { industry: { equals: dto.industry as IndustryCategory } } : {}),
      ...(dto.search
        ? {
            OR: [
              { name: { contains: dto.search, mode: 'insensitive' as const } },
              { slug: { contains: dto.search, mode: 'insensitive' as const } },
              { phone: { contains: dto.search } },
              { email: { contains: dto.search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [rows, total] = await this.prisma.client.$transaction([
      this.prisma.client.tenant.findMany({
        where,
        ...toSkipTake(dto),
        orderBy: { createdAt: dto.sortDir },
        select: TENANT_SUMMARY_SELECT,
      }),
      this.prisma.client.tenant.count({ where }),
    ]);

    return { data: rows, meta: buildMeta(total, dto) };
  }

  /** Full 360° view used by the tenant detail screen. */
  async detail(tenantId: string) {
    const tenant = await this.prisma.client.tenant.findUnique({
      where: { id: tenantId },
      include: {
        branches: { where: { deletedAt: null }, orderBy: { createdAt: 'asc' } },
        modules: { orderBy: { key: 'asc' } },
        subscription: { include: { plan: true } },
        roles: { orderBy: { createdAt: 'asc' } },
        _count: {
          select: {
            members: true,
            customers: true,
            appointments: true,
            invoices: true,
            branches: true,
            orders: true,
          },
        },
      },
    });
    if (!tenant) throw DomainException.notFound('کسب‌وکار');
    return tenant;
  }

  async update(
    actor: PlatformPrincipal,
    tenantId: string,
    dto: AdminUpdateTenantDto,
    context: AuditContext = {},
  ) {
    const before = await this.prisma.client.tenant.findUnique({ where: { id: tenantId } });
    if (!before) throw DomainException.notFound('کسب‌وکار');

    const { taxRate, settings, industry, ...rest } = dto;
    const updated = await this.prisma.client.tenant.update({
      where: { id: tenantId },
      data: {
        ...rest,
        ...(industry ? { industry: industry as IndustryCategory } : {}),
        ...(taxRate !== undefined ? { taxRate } : {}),
        ...(settings !== undefined ? { settings: settings as never } : {}),
      },
    });

    await this.audit.record(
      actor,
      {
        action: 'tenant.update',
        entity: 'tenant',
        entityId: tenantId,
        tenantId,
        before,
        after: dto,
      },
      context,
    );
    return updated;
  }

  async changeStatus(
    actor: PlatformPrincipal,
    tenantId: string,
    dto: AdminTenantStatusDto,
    context: AuditContext = {},
  ) {
    const before = await this.prisma.client.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, status: true },
    });
    if (!before) throw DomainException.notFound('کسب‌وکار');

    const updated = await this.prisma.client.tenant.update({
      where: { id: tenantId },
      data: { status: dto.status as TenantStatus },
      select: { id: true, name: true, slug: true, status: true },
    });

    // Suspending a tenant cascades to its subscription so billing stops too.
    if (dto.status === 'SUSPENDED') {
      await this.prisma.client.subscription.updateMany({
        where: { tenantId },
        data: { status: 'SUSPENDED' },
      });
    }

    await this.audit.record(
      actor,
      {
        action: 'tenant.status_change',
        entity: 'tenant',
        entityId: tenantId,
        tenantId,
        before: { status: before.status },
        after: { status: dto.status, reason: dto.reason ?? null },
      },
      context,
    );
    return updated;
  }

  /** Soft-deletes a tenant (data is retained for recovery/compliance). */
  async softDelete(
    actor: PlatformPrincipal,
    tenantId: string,
    context: AuditContext = {},
  ) {
    const before = await this.prisma.client.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, name: true, slug: true, deletedAt: true },
    });
    if (!before) throw DomainException.notFound('کسب‌وکار');
    if (before.deletedAt) throw DomainException.conflict('این کسب‌وکار قبلاً حذف شده است');

    const updated = await this.prisma.client.$transaction(async (tx) => {
      const tenant = await tx.tenant.update({
        where: { id: tenantId },
        data: { deletedAt: new Date(), status: 'ARCHIVED' },
        select: { id: true, name: true, slug: true, deletedAt: true, status: true },
      });
      // Invalidate all member sessions so nobody can keep using a deleted tenant.
      await tx.session.updateMany({
        where: { tenantId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      return tenant;
    });

    await this.audit.record(
      actor,
      {
        action: 'tenant.soft_delete',
        entity: 'tenant',
        entityId: tenantId,
        tenantId,
        before,
        after: updated,
      },
      context,
    );
    return updated;
  }

  async restore(actor: PlatformPrincipal, tenantId: string, context: AuditContext = {}) {
    const before = await this.prisma.client.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, deletedAt: true, status: true },
    });
    if (!before) throw DomainException.notFound('کسب‌وکار');
    if (!before.deletedAt) throw DomainException.badRequest('این کسب‌وکار حذف نشده است');

    const updated = await this.prisma.client.tenant.update({
      where: { id: tenantId },
      data: { deletedAt: null, status: 'ACTIVE' },
      select: { id: true, name: true, slug: true, status: true },
    });

    await this.audit.record(
      actor,
      { action: 'tenant.restore', entity: 'tenant', entityId: tenantId, tenantId, before, after: updated },
      context,
    );
    return updated;
  }

  /** Aggregated platform-wide counters for the admin dashboard. */
  async stats() {
    const [tenants, activeTenants, suspended, members, customers, modulesEnabled] =
      await this.prisma.client.$transaction([
        this.prisma.client.tenant.count({ where: { deletedAt: null } }),
        this.prisma.client.tenant.count({ where: { status: 'ACTIVE', deletedAt: null } }),
        this.prisma.client.tenant.count({ where: { status: 'SUSPENDED', deletedAt: null } }),
        this.prisma.client.member.count({ where: { deletedAt: null } }),
        this.prisma.client.customer.count(),
        this.prisma.client.tenantModule.count({ where: { isEnabled: true } }),
      ]);

    const byIndustry = await this.prisma.client.tenant.groupBy({
      by: ['industry'],
      where: { deletedAt: null },
      _count: { _all: true },
    });

    const recentTenants = await this.prisma.client.tenant.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: TENANT_SUMMARY_SELECT,
    });

    return {
      tenants,
      activeTenants,
      suspended,
      members,
      customers,
      modulesEnabled,
      byIndustry: byIndustry.map((row) => ({ industry: row.industry, count: row._count._all })),
      recentTenants,
    };
  }
}

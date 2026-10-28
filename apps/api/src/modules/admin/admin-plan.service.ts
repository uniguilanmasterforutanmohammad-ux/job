import { Injectable } from '@nestjs/common';
import { DomainException } from '../../common/exceptions/domain.exception.js';
import { PrismaService } from '../../database/prisma.service.js';
import type { BillingCycle, ModuleKey, SubscriptionStatus } from '@repo/db';
import { AdminAuditService, type AuditContext } from './admin-audit.service.js';
import type { PlatformPrincipal } from './admin.constants.js';
import type { AdminAssignPlanDto, AdminUpsertPlanDto } from './dto/admin.schemas.js';

/** Platform plan catalogue (tenantId === null) CRUD + plan assignment. */
@Injectable()
export class AdminPlanService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AdminAuditService,
  ) {}

  async list() {
    return this.prisma.client.plan.findMany({
      where: { tenantId: null },
      orderBy: { price: 'asc' },
      include: { _count: { select: { subscriptions: true } } },
    });
  }

  async create(
    actor: PlatformPrincipal,
    dto: AdminUpsertPlanDto,
    context: AuditContext = {},
  ) {
    const clash = await this.prisma.client.plan.findFirst({
      where: { tenantId: null, code: dto.code },
      select: { id: true },
    });
    if (clash) throw DomainException.conflict('پلنی با این کد از قبل وجود دارد');

    const plan = await this.prisma.client.plan.create({
      data: {
        tenantId: null,
        code: dto.code,
        name: dto.name,
        description: dto.description ?? null,
        price: dto.price,
        currency: dto.currency,
        billingCycle: dto.billingCycle as BillingCycle,
        modules: dto.modules as ModuleKey[],
        limits: dto.limits as never,
        isActive: dto.isActive,
      },
    });

    await this.audit.record(
      actor,
      { action: 'plan.create', entity: 'plan', entityId: plan.id, after: dto },
      context,
    );
    return plan;
  }

  async update(
    actor: PlatformPrincipal,
    planId: string,
    dto: Partial<AdminUpsertPlanDto>,
    context: AuditContext = {},
  ) {
    const before = await this.prisma.client.plan.findFirst({
      where: { id: planId, tenantId: null },
    });
    if (!before) throw DomainException.notFound('پلن');

    const plan = await this.prisma.client.plan.update({
      where: { id: planId },
      data: {
        ...(dto.code !== undefined ? { code: dto.code } : {}),
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.price !== undefined ? { price: dto.price } : {}),
        ...(dto.currency !== undefined ? { currency: dto.currency } : {}),
        ...(dto.billingCycle !== undefined
          ? { billingCycle: dto.billingCycle as BillingCycle }
          : {}),
        ...(dto.modules !== undefined ? { modules: dto.modules as ModuleKey[] } : {}),
        ...(dto.limits !== undefined ? { limits: dto.limits as never } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });

    await this.audit.record(
      actor,
      {
        action: 'plan.update',
        entity: 'plan',
        entityId: planId,
        before,
        after: dto,
      },
      context,
    );
    return plan;
  }

  async remove(actor: PlatformPrincipal, planId: string, context: AuditContext = {}) {
    const plan = await this.prisma.client.plan.findFirst({
      where: { id: planId, tenantId: null },
      include: { _count: { select: { subscriptions: true } } },
    });
    if (!plan) throw DomainException.notFound('پلن');
    if (plan._count.subscriptions > 0) {
      throw DomainException.conflict(
        'این پلن به کسب‌وکارهایی تخصیص یافته است؛ ابتدا آن‌ها را به پلن دیگری منتقل کنید',
      );
    }
    // Deactivate rather than hard-delete to preserve audit integrity.
    const updated = await this.prisma.client.plan.update({
      where: { id: planId },
      data: { isActive: false },
    });
    await this.audit.record(
      actor,
      { action: 'plan.deactivate', entity: 'plan', entityId: planId, before: plan },
      context,
    );
    return updated;
  }

  /** Assigns (or clears) a plan on a tenant's subscription. */
  async assignToTenant(
    actor: PlatformPrincipal,
    tenantId: string,
    dto: AdminAssignPlanDto,
    context: AuditContext = {},
  ) {
    const tenant = await this.prisma.client.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true },
    });
    if (!tenant) throw DomainException.notFound('کسب‌وکار');

    if (dto.planId) {
      const plan = await this.prisma.client.plan.findFirst({
        where: { id: dto.planId, tenantId: null },
        select: { id: true, modules: true },
      });
      if (!plan) throw DomainException.notFound('پلن');
    }

    const before = await this.prisma.client.subscription.findUnique({ where: { tenantId } });

    const subscription = await this.prisma.client.subscription.upsert({
      where: { tenantId },
      update: {
        planId: dto.planId,
        ...(dto.status ? { status: dto.status as SubscriptionStatus } : {}),
        ...(dto.seats !== undefined ? { seats: dto.seats } : {}),
        ...(dto.currentPeriodEnd ? { currentPeriodEnd: dto.currentPeriodEnd } : {}),
      },
      create: {
        tenantId,
        planId: dto.planId,
        status: (dto.status as SubscriptionStatus) ?? 'ACTIVE',
        currentPeriodEnd: dto.currentPeriodEnd ?? new Date(Date.now() + 30 * 86400_000),
        seats: dto.seats ?? 1,
      },
      include: { plan: true },
    });

    await this.audit.record(
      actor,
      {
        action: 'subscription.assign_plan',
        entity: 'subscription',
        entityId: subscription.id,
        tenantId,
        before,
        after: dto,
      },
      context,
    );
    return subscription;
  }
}

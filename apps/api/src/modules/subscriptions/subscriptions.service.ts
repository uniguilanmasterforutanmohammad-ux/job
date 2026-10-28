import { Injectable, Logger } from '@nestjs/common';
import { buildMeta, toSkipTake } from '../../common/dto/pagination.dto.js';
import { DomainException } from '../../common/exceptions/domain.exception.js';
import { PrismaService } from '../../database/prisma.service.js';
import type {
  CreatePlanDto,
  CreateSessionPackageDto,
  CreateSubscriptionDto,
  FreezeSubscriptionDto,
  ListSubscriptionsDto,
  UpdatePlanDto,
  UpgradeSubscriptionDto,
  UseSessionsDto,
} from './dto/subscription.schemas.js';

const DAY_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class SubscriptionsService {
  private readonly logger = new Logger(SubscriptionsService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ----- Membership plans (SUB-01) -----

  createPlan(tenantId: string, dto: CreatePlanDto) {
    return this.prisma.client.membershipPlan.create({
      data: {
        tenantId,
        name: dto.name,
        kind: dto.kind,
        price: dto.price,
        sessionsCount: dto.sessionsCount ?? null,
        daysCount: dto.daysCount ?? null,
        description: dto.description ?? null,
        isActive: dto.isActive,
      },
    });
  }

  listPlans(tenantId: string) {
    return this.prisma.client.membershipPlan.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updatePlan(tenantId: string, id: string, dto: UpdatePlanDto) {
    await this.findPlan(tenantId, id);
    return this.prisma.client.membershipPlan.update({ where: { id }, data: dto });
  }

  async removePlan(tenantId: string, id: string) {
    await this.findPlan(tenantId, id);
    await this.prisma.client.membershipPlan.update({ where: { id }, data: { isActive: false } });
    return { message: 'طرح غیرفعال شد' };
  }

  private async findPlan(tenantId: string, id: string) {
    const plan = await this.prisma.client.membershipPlan.findFirst({ where: { id, tenantId } });
    if (!plan) throw DomainException.notFound('طرح عضویت');
    return plan;
  }

  // ----- Student subscriptions (SUB-01..05) -----

  async create(tenantId: string, dto: CreateSubscriptionDto) {
    const customer = await this.prisma.client.customer.findFirst({
      where: { id: dto.customerId, tenantId, deletedAt: null },
    });
    if (!customer) throw DomainException.notFound('مشتری');

    let planName = dto.planName;
    let kind = dto.kind;
    let price = dto.price;
    let sessionsTotal = dto.sessionsTotal;
    if (dto.planId) {
      const plan = await this.findPlan(tenantId, dto.planId);
      planName = planName ?? plan.name;
      kind = dto.kind === 'MONTHLY' ? plan.kind : kind;
      price = price || Number(plan.price);
      sessionsTotal = sessionsTotal ?? plan.sessionsCount ?? undefined;
    }
    if (!planName) throw DomainException.badRequest('نام طرح یا شناسه طرح لازم است');

    const startsAt = dto.startsAt ?? new Date();
    const endsAt = dto.endsAt ?? this.defaultEnd(startsAt, kind);

    return this.prisma.client.studentSubscription.create({
      data: {
        tenantId,
        customerId: dto.customerId,
        planName,
        kind,
        price,
        startsAt,
        endsAt,
        sessionsTotal: sessionsTotal ?? null,
        autoRenew: dto.autoRenew,
        status: 'ACTIVE',
      },
    });
  }

  private defaultEnd(startsAt: Date, kind: string): Date | null {
    const map: Record<string, number> = {
      MONTHLY: 30,
      QUARTERLY: 90,
      YEARLY: 365,
      VIP: 365,
    };
    const days = map[kind];
    return days ? new Date(startsAt.getTime() + days * DAY_MS) : null;
  }

  async list(tenantId: string, dto: ListSubscriptionsDto) {
    const where = {
      tenantId,
      ...(dto.customerId ? { customerId: dto.customerId } : {}),
      ...(dto.status ? { status: dto.status } : {}),
    };
    const [data, total] = await this.prisma.client.$transaction([
      this.prisma.client.studentSubscription.findMany({
        where,
        ...toSkipTake(dto),
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.client.studentSubscription.count({ where }),
    ]);
    return { data, meta: buildMeta(total, dto) };
  }

  private async findOne(tenantId: string, id: string) {
    const sub = await this.prisma.client.studentSubscription.findFirst({ where: { id, tenantId } });
    if (!sub) throw DomainException.notFound('اشتراک');
    return sub;
  }

  /** SUB-03 — consume sessions and warn on depletion. */
  async useSessions(tenantId: string, id: string, dto: UseSessionsDto) {
    const sub = await this.findOne(tenantId, id);
    if (sub.status !== 'ACTIVE') throw DomainException.badRequest('اشتراک فعال نیست');
    const total = sub.sessionsTotal;
    if (total != null && sub.sessionsUsed + dto.count > total) {
      throw DomainException.badRequest('جلسات کافی باقی نمانده است');
    }
    const updated = await this.prisma.client.studentSubscription.update({
      where: { id },
      data: { sessionsUsed: { increment: dto.count } },
    });
    const remaining = total != null ? total - updated.sessionsUsed : null;
    return { ...updated, remaining, lowBalance: remaining != null && remaining <= 2 };
  }

  /** SUB-04 — freeze / unfreeze. */
  async freeze(tenantId: string, id: string, dto: FreezeSubscriptionDto) {
    await this.findOne(tenantId, id);
    return this.prisma.client.studentSubscription.update({
      where: { id },
      data: {
        status: 'FROZEN',
        frozenAt: new Date(),
        frozenUntil: dto.frozenUntil ?? null,
        meta: { reason: dto.reason ?? null } as never,
      },
    });
  }

  async unfreeze(tenantId: string, id: string) {
    await this.findOne(tenantId, id);
    return this.prisma.client.studentSubscription.update({
      where: { id },
      data: { status: 'ACTIVE', frozenAt: null, frozenUntil: null },
    });
  }

  async cancel(tenantId: string, id: string) {
    await this.findOne(tenantId, id);
    return this.prisma.client.studentSubscription.update({
      where: { id },
      data: { status: 'CANCELED', canceledAt: new Date() },
    });
  }

  /** SUB-05 — upgrade / convert with pro-rated difference. */
  async upgrade(tenantId: string, id: string, dto: UpgradeSubscriptionDto) {
    const sub = await this.findOne(tenantId, id);
    const now = new Date();
    const totalMs = sub.endsAt ? sub.endsAt.getTime() - sub.startsAt.getTime() : 0;
    const remainingMs = sub.endsAt ? Math.max(0, sub.endsAt.getTime() - now.getTime()) : 0;
    const remainingRatio = totalMs > 0 ? remainingMs / totalMs : 0;
    const credit = Math.round(Number(sub.price) * remainingRatio);
    const payable = Math.max(0, dto.price - credit);

    const updated = await this.prisma.client.studentSubscription.update({
      where: { id },
      data: {
        kind: dto.kind,
        planName: dto.planName,
        price: dto.price,
        sessionsTotal: dto.sessionsTotal ?? sub.sessionsTotal,
        endsAt: dto.endsAt ?? null,
        status: 'ACTIVE',
      },
    });
    return { ...updated, upgrade: { credit, payable } };
  }

  /** SUB-02 — issue renewal invoices for subscriptions near expiry. */
  async processRenewals(tenantId: string) {
    const horizon = new Date(Date.now() + 3 * DAY_MS);
    const due = await this.prisma.client.studentSubscription.findMany({
      where: { tenantId, status: 'ACTIVE', autoRenew: true, endsAt: { lte: horizon } },
    });
    const renewed: string[] = [];
    for (const sub of due) {
      const days = { MONTHLY: 30, QUARTERLY: 90, YEARLY: 365, VIP: 365 }[sub.kind as string];
      const base = sub.endsAt ?? new Date();
      await this.prisma.client.studentSubscription.update({
        where: { id: sub.id },
        data: {
          endsAt: days ? new Date(base.getTime() + days * DAY_MS) : base,
          sessionsUsed: 0,
        },
      });
      renewed.push(sub.id);
    }
    this.logger.log(`Renewals processed tenant=${tenantId} count=${renewed.length}`);
    return { renewed: renewed.length, ids: renewed };
  }

  // ----- Session packages (SUB-03) -----

  createPackage(tenantId: string, dto: CreateSessionPackageDto) {
    return this.prisma.client.sessionPackage.create({
      data: {
        tenantId,
        customerId: dto.customerId,
        serviceId: dto.serviceId ?? null,
        title: dto.title,
        totalSessions: dto.totalSessions,
        expiresAt: dto.expiresAt ?? null,
      },
    });
  }

  listPackages(tenantId: string, customerId?: string) {
    return this.prisma.client.sessionPackage.findMany({
      where: { tenantId, ...(customerId ? { customerId } : {}) },
      orderBy: { createdAt: 'desc' },
    });
  }

  async usePackageSession(tenantId: string, id: string) {
    const pkg = await this.prisma.client.sessionPackage.findFirst({ where: { id, tenantId } });
    if (!pkg) throw DomainException.notFound('بسته جلسه');
    if (pkg.usedSessions >= pkg.totalSessions) {
      throw DomainException.badRequest('این بسته به پایان رسیده است');
    }
    if (pkg.expiresAt && pkg.expiresAt.getTime() < Date.now()) {
      throw DomainException.badRequest('این بسته منقضی شده است');
    }
    return this.prisma.client.sessionPackage.update({
      where: { id },
      data: { usedSessions: { increment: 1 } },
    });
  }
}

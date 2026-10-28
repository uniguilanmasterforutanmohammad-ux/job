import { Injectable } from '@nestjs/common';
import { DomainException } from '../../common/exceptions/domain.exception.js';
import { PrismaService } from '../../database/prisma.service.js';
import type { AddFamilyMemberDto, CreateFamilyGroupDto } from './dto/subscription-extra.schemas.js';

/** SUB-06 — family groups and family/referral discounts. */
@Injectable()
export class SubscriptionsExtraService {
  constructor(private readonly prisma: PrismaService) {}

  createFamilyGroup(tenantId: string, dto: CreateFamilyGroupDto) {
    return this.prisma.client.familyGroup.create({
      data: { tenantId, name: dto.name, discountPercent: dto.discountPercent },
    });
  }

  async listFamilyGroups(tenantId: string) {
    return this.prisma.client.familyGroup.findMany({
      where: { tenantId },
      include: { members: { include: { customer: { select: { id: true, fullName: true, phone: true } } } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async addFamilyMember(tenantId: string, groupId: string, dto: AddFamilyMemberDto) {
    const group = await this.prisma.client.familyGroup.findFirst({ where: { id: groupId, tenantId } });
    if (!group) throw DomainException.notFound('گروه خانوادگی');
    const customer = await this.prisma.client.customer.findFirst({
      where: { id: dto.customerId, tenantId, deletedAt: null },
      select: { id: true },
    });
    if (!customer) throw DomainException.notFound('مشتری');

    return this.prisma.client.familyMember.create({
      data: { familyGroupId: groupId, customerId: dto.customerId, relation: dto.relation ?? null },
    });
  }

  async removeFamilyMember(tenantId: string, groupId: string, customerId: string) {
    const group = await this.prisma.client.familyGroup.findFirst({ where: { id: groupId, tenantId } });
    if (!group) throw DomainException.notFound('گروه خانوادگی');
    await this.prisma.client.familyMember.deleteMany({ where: { familyGroupId: groupId, customerId } });
    return { message: 'عضو حذف شد' };
  }

  /**
   * SUB-06 — resolves the effective family discount for a customer (largest
   * group discount the customer belongs to). Used when pricing a subscription.
   */
  async effectiveDiscount(tenantId: string, customerId: string) {
    const memberships = await this.prisma.client.familyMember.findMany({
      where: { customerId, familyGroup: { tenantId } },
      include: { familyGroup: { select: { id: true, name: true, discountPercent: true } } },
    });
    if (!memberships.length) return { discountPercent: 0, group: null as string | null };
    const best = memberships.reduce((a, b) =>
      Number(b.familyGroup.discountPercent) > Number(a.familyGroup.discountPercent) ? b : a,
    );
    return { discountPercent: Number(best.familyGroup.discountPercent), group: best.familyGroup.name };
  }

  /** Applies the family discount to a subscription price (SUB-06). */
  async applyFamilyDiscount(tenantId: string, subscriptionId: string) {
    const sub = await this.prisma.client.studentSubscription.findFirst({
      where: { id: subscriptionId, tenantId },
    });
    if (!sub) throw DomainException.notFound('اشتراک');
    const { discountPercent, group } = await this.effectiveDiscount(tenantId, sub.customerId);
    if (discountPercent <= 0) return { subscriptionId, discountPercent: 0, newPrice: Number(sub.price) };

    const newPrice = Math.round(Number(sub.price) * (1 - discountPercent / 100));
    await this.prisma.client.studentSubscription.update({
      where: { id: subscriptionId },
      data: { price: newPrice, meta: { ...((sub.meta as Record<string, unknown>) ?? {}), familyDiscount: discountPercent, familyGroup: group } as never },
    });
    return { subscriptionId, discountPercent, newPrice, group };
  }
}

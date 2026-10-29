import { Injectable } from '@nestjs/common';
import { DomainException } from '../../common/exceptions/domain.exception.js';
import { PrismaService } from '../../database/prisma.service.js';
import { AdminAuditService } from './admin-audit.service.js';
import type { PlatformPrincipal } from './admin.constants.js';
import type {
  AdminMarketplaceBusinessUpdateDto,
  AdminMarketplaceBusinessesQueryDto,
  AdminMarketplaceReviewsQueryDto,
  AdminModerateReviewDto,
} from './dto/admin.schemas.js';

/** Platform-side trust & safety console for the public marketplace. */
@Injectable()
export class AdminMarketplaceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AdminAuditService,
  ) {}

  async overview() {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [businesses, products, services, orders, gmv, pendingReviews, publishedReviews] =
      await Promise.all([
        this.prisma.client.tenant.count({ where: { marketplaceEnabled: true, deletedAt: null } }),
        this.prisma.client.product.count({
          where: { isPublic: true, isActive: true, deletedAt: null },
        }),
        this.prisma.client.service.count({
          where: { isPublic: true, isActive: true, deletedAt: null },
        }),
        this.prisma.client.order.count({ where: { createdAt: { gte: since } } }),
        this.prisma.client.order.aggregate({
          where: { createdAt: { gte: since }, status: { not: 'CANCELED' } },
          _sum: { total: true },
        }),
        this.prisma.client.review.count({ where: { isPublic: false, approvedAt: null } }),
        this.prisma.client.review.count({ where: { isPublic: true } }),
      ]);

    return {
      businesses,
      products,
      services,
      ordersLast30Days: orders,
      gmvLast30Days: Number(gmv._sum.total ?? 0),
      pendingReviews,
      publishedReviews,
    };
  }

  async businesses(dto: AdminMarketplaceBusinessesQueryDto) {
    const rows = await this.prisma.client.tenant.findMany({
      where: {
        deletedAt: null,
        ...(dto.search
          ? {
              OR: [
                { name: { contains: dto.search, mode: 'insensitive' } },
                { slug: { contains: dto.search, mode: 'insensitive' } },
                { city: { contains: dto.search, mode: 'insensitive' } },
              ],
            }
          : {}),
        ...(dto.enabledOnly ? { marketplaceEnabled: true } : {}),
      },
      select: {
        id: true,
        slug: true,
        name: true,
        industry: true,
        city: true,
        status: true,
        marketplaceEnabled: true,
        createdAt: true,
        _count: {
          select: {
            products: { where: { isPublic: true, isActive: true, deletedAt: null } },
            services: { where: { isPublic: true, isActive: true, deletedAt: null } },
            orders: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return rows.map(({ _count, ...row }) => ({
      ...row,
      publishedProducts: _count.products,
      publishedServices: _count.services,
      orders: _count.orders,
    }));
  }

  /** Enable/disable the storefront or take the whole business offline. */
  async updateBusiness(
    actor: PlatformPrincipal,
    tenantId: string,
    dto: AdminMarketplaceBusinessUpdateDto,
    context: { ip?: string; userAgent?: string },
  ) {
    const tenant = await this.prisma.client.tenant.findFirst({
      where: { id: tenantId, deletedAt: null },
      select: { id: true, name: true, marketplaceEnabled: true, status: true },
    });
    if (!tenant) throw DomainException.notFound('کسب‌وکار');

    const updated = await this.prisma.client.tenant.update({
      where: { id: tenantId },
      data: {
        ...(dto.marketplaceEnabled !== undefined
          ? { marketplaceEnabled: dto.marketplaceEnabled }
          : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
      },
      select: { id: true, name: true, marketplaceEnabled: true, status: true },
    });

    await this.audit.record(
      actor,
      {
        action: 'marketplace.business.update',
        entity: 'tenant',
        entityId: tenantId,
        tenantId,
        before: { marketplaceEnabled: tenant.marketplaceEnabled, status: tenant.status },
        after: { ...dto },
      },
      context,
    );

    return updated;
  }

  async reviews(dto: AdminMarketplaceReviewsQueryDto) {
    const where =
      dto.status === 'pending'
        ? { isPublic: false, approvedAt: null }
        : dto.status === 'published'
          ? { isPublic: true }
          : {};

    const rows = await this.prisma.client.review.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        id: true,
        rating: true,
        comment: true,
        isPublic: true,
        isVerified: true,
        approvedAt: true,
        createdAt: true,
        tenant: { select: { id: true, name: true, slug: true } },
        customer: { select: { fullName: true, phone: true } },
        product: { select: { id: true, name: true } },
        service: { select: { id: true, name: true } },
      },
    });
    return rows;
  }

  async moderateReview(
    actor: PlatformPrincipal,
    id: string,
    dto: AdminModerateReviewDto,
    context: { ip?: string; userAgent?: string },
  ) {
    const review = await this.prisma.client.review.findUnique({ where: { id } });
    if (!review) throw DomainException.notFound('نظر');

    const updated = await this.prisma.client.review.update({
      where: { id },
      data: dto.approve
        ? { isPublic: true, approvedAt: new Date() }
        : { isPublic: false, approvedAt: null },
    });

    await this.audit.record(
      actor,
      {
        action: dto.approve ? 'marketplace.review.approve' : 'marketplace.review.reject',
        entity: 'review',
        entityId: id,
        tenantId: review.tenantId,
        before: { isPublic: review.isPublic, approvedAt: review.approvedAt },
        after: { isPublic: updated.isPublic, approvedAt: updated.approvedAt },
      },
      context,
    );

    return updated;
  }
}

// TaskForMyAgent — بازارگاه فاز ۲: کنسول مدیریت بازارگاه
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminMarketplaceService } from './admin-marketplace.service.js';
import type { PrismaService } from '../../database/prisma.service.js';
import type { AdminAuditService } from './admin-audit.service.js';
import type { PlatformPrincipal } from './admin.constants.js';

const actor: PlatformPrincipal = {
  platformMemberId: 'pm1',
  phone: '09120000001',
  fullName: 'مدیر پلتفرم',
  role: 'SUPER_ADMIN',
  twoFactorEnabled: true,
};

function build() {
  const prisma = {
    client: {
      tenant: {
        count: vi.fn().mockResolvedValue(2),
        findMany: vi.fn().mockResolvedValue([]),
        findFirst: vi.fn().mockResolvedValue({
          id: 't1',
          name: 'باشگاه',
          marketplaceEnabled: true,
          status: 'ACTIVE',
        }),
        update: vi.fn().mockResolvedValue({
          id: 't1',
          name: 'باشگاه',
          marketplaceEnabled: false,
          status: 'ACTIVE',
        }),
      },
      product: { count: vi.fn().mockResolvedValue(4) },
      service: { count: vi.fn().mockResolvedValue(3) },
      order: {
        count: vi.fn().mockResolvedValue(5),
        aggregate: vi.fn().mockResolvedValue({ _sum: { total: 1250000 } }),
      },
      review: {
        count: vi.fn().mockResolvedValueOnce(1).mockResolvedValueOnce(7),
        findMany: vi.fn().mockResolvedValue([]),
        findUnique: vi
          .fn()
          .mockResolvedValue({ id: 'r1', tenantId: 't1', isPublic: false, approvedAt: null }),
        update: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
          Promise.resolve({ id: 'r1', ...data }),
        ),
      },
    },
  };
  const audit = { record: vi.fn().mockResolvedValue(undefined) };
  const service = new AdminMarketplaceService(
    prisma as unknown as PrismaService,
    audit as unknown as AdminAuditService,
  );
  return { service, prisma, audit };
}

describe('AdminMarketplaceService', () => {
  let built: ReturnType<typeof build>;
  beforeEach(() => {
    built = build();
  });

  it('summarises marketplace numbers for the dashboard', async () => {
    const overview = await built.service.overview();
    expect(overview).toMatchObject({
      businesses: 2,
      products: 4,
      services: 3,
      ordersLast30Days: 5,
      gmvLast30Days: 1250000,
      pendingReviews: 1,
      publishedReviews: 7,
    });
  });

  it('toggles marketplace publication and writes an audit row', async () => {
    await built.service.updateBusiness(actor, 't1', { marketplaceEnabled: false }, {});

    expect(built.prisma.client.tenant.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 't1' },
        data: { marketplaceEnabled: false },
      }),
    );
    expect(built.audit.record).toHaveBeenCalledWith(
      actor,
      expect.objectContaining({ action: 'marketplace.business.update', tenantId: 't1' }),
      {},
    );
  });

  it('publishes a review on approval', async () => {
    const updated = await built.service.moderateReview(actor, 'r1', { approve: true }, {});

    expect(updated).toMatchObject({ isPublic: true, approvedAt: expect.any(Date) });
    expect(built.audit.record).toHaveBeenCalledWith(
      actor,
      expect.objectContaining({ action: 'marketplace.review.approve' }),
      {},
    );
  });

  it('filters the moderation queue to pending rows', async () => {
    await built.service.reviews({ status: 'pending' });
    expect(built.prisma.client.review.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { isPublic: false, approvedAt: null } }),
    );
  });
});

// TaskForMyAgent — بازارگاه فاز ۲: نظرات و امتیازهای تأییدشده
import { describe, expect, it, vi } from 'vitest';
import { AppService } from './app.service.js';
import type { PrismaService } from '../../database/prisma.service.js';
import type { OtpService } from '../auth/otp.service.js';
import type { TokenService } from '../auth/token.service.js';
import type { PaymentsService } from '../payments/payments.service.js';
import type { MessagingService } from '../messaging/messaging.service.js';
import type { AttendanceQrService } from '../attendance/attendance-qr.service.js';
import type { ShopService } from '../shop/shop.service.js';

const deliveredOrder = {
  id: 'o1',
  status: 'DELIVERED',
  items: [{ productId: 'p1', title: 'دستکش', quantity: 1, unitPrice: 100 }],
};

function build(order: unknown = deliveredOrder) {
  const prisma = {
    client: {
      customer: {
        findUnique: vi.fn().mockResolvedValue({ id: 'c1', tenantId: 't1', fullName: 'مریم احمدی' }),
      },
      order: { findFirst: vi.fn().mockResolvedValue(order) },
      review: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
          Promise.resolve({ id: 'r1', ...data }),
        ),
      },
      product: { findFirst: vi.fn().mockResolvedValue({ id: 'p1' }) },
      service: { findFirst: vi.fn().mockResolvedValue({ id: 's1' }) },
    },
  };
  const messaging = { send: vi.fn().mockResolvedValue({}) };
  const service = new AppService(
    prisma as unknown as PrismaService,
    {} as unknown as OtpService,
    {} as unknown as TokenService,
    {} as unknown as PaymentsService,
    messaging as unknown as MessagingService,
    {} as unknown as AttendanceQrService,
    {} as unknown as ShopService,
  );
  return { service, prisma, messaging };
}

describe('AppService.submitReview', () => {
  it('publishes a verified purchase review immediately', async () => {
    const { service, prisma } = build();

    const review = await service.submitReview('m1', {
      rating: 5,
      comment: 'عالی بود',
      orderId: 'o1',
    });

    expect(prisma.client.review.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          productId: 'p1',
          orderId: 'o1',
          isVerified: true,
          isPublic: true,
          approvedAt: expect.any(Date),
        }),
      }),
    );
    expect(review).toMatchObject({ isVerified: true, isPublic: true });
  });

  it('keeps unverified reviews unpublished until moderation', async () => {
    const { service, prisma } = build();

    await service.submitReview('m1', { rating: 4, productId: 'p1' });

    expect(prisma.client.review.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ isVerified: false, isPublic: false, approvedAt: null }),
      }),
    );
  });

  it('refuses to review an order that is not delivered yet', async () => {
    const { service } = build({ ...deliveredOrder, status: 'SHIPPED' });

    await expect(service.submitReview('m1', { rating: 5, orderId: 'o1' })).rejects.toThrow(
      /تحویل سفارش/,
    );
  });

  it('rejects a second review for the same product', async () => {
    const { service, prisma } = build();
    prisma.client.review.findFirst.mockResolvedValue({ id: 'old' });

    await expect(
      service.submitReview('m1', { rating: 5, productId: 'p1' }),
    ).rejects.toThrow(/قبلاً نظر/);
  });
});

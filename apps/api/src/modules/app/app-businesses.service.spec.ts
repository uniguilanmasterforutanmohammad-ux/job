// TaskForMyAgent — پنل ادمین: مخفی‌شدن کسب‌وکارهای غیرفعال در ثبت‌نام کاربر جدید
import { describe, expect, it, vi } from 'vitest';
import { AppService } from './app.service.js';
import type { PrismaService } from '../../database/prisma.service.js';
import type { OtpService } from '../auth/otp.service.js';
import type { TokenService } from '../auth/token.service.js';
import type { PaymentsService } from '../payments/payments.service.js';
import type { MessagingService } from '../messaging/messaging.service.js';
import type { AttendanceQrService } from '../attendance/attendance-qr.service.js';
import type { ShopService } from '../shop/shop.service.js';

function build() {
  const prisma = {
    client: {
      tenant: { findMany: vi.fn().mockResolvedValue([]) },
    },
  };
  const service = new AppService(
    prisma as unknown as PrismaService,
    {} as unknown as OtpService,
    {} as unknown as TokenService,
    {} as unknown as PaymentsService,
    {} as unknown as MessagingService,
    {} as unknown as AttendanceQrService,
    {} as unknown as ShopService,
  );
  return { service, prisma };
}

describe('AppService.listBusinesses', () => {
  it('only ever queries ACTIVE, non-deleted businesses', async () => {
    const { service, prisma } = build();
    await service.listBusinesses({});

    const [args] = prisma.client.tenant.findMany.mock.calls[0] as [{ where: unknown }];
    expect(args.where).toMatchObject({ status: 'ACTIVE', deletedAt: null });
  });

  it('filters by industry and search text when provided', async () => {
    const { service, prisma } = build();
    await service.listBusinesses({ industry: 'BEAUTY', search: 'آریا' });

    const [args] = prisma.client.tenant.findMany.mock.calls[0] as [{ where: unknown }];
    expect(args.where).toMatchObject({ status: 'ACTIVE', industry: 'BEAUTY' });
    expect(args.where).toHaveProperty('OR');
  });

  it('never selects sensitive tenant columns', async () => {
    const { service, prisma } = build();
    await service.listBusinesses({});

    const [args] = prisma.client.tenant.findMany.mock.calls[0] as [
      { select: Record<string, unknown> },
    ];
    expect(Object.keys(args.select).sort()).toEqual(
      ['id', 'industry', 'logoUrl', 'name', 'slug'].sort(),
    );
  });
});

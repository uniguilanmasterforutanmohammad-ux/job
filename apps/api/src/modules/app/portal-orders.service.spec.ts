// TaskForMyAgent — بازارگاه فاز ۲: «سفارش‌های من» در پنل کاربری
import { describe, expect, it, vi } from 'vitest';
import { AppService } from './app.service.js';
import type { PrismaService } from '../../database/prisma.service.js';
import type { OtpService } from '../auth/otp.service.js';
import type { TokenService } from '../auth/token.service.js';
import type { PaymentsService } from '../payments/payments.service.js';
import type { MessagingService } from '../messaging/messaging.service.js';
import type { AttendanceQrService } from '../attendance/attendance-qr.service.js';
import type { ShopService } from '../shop/shop.service.js';

function build(options: { customers?: Array<{ id: string }>; order?: unknown } = {}) {
  const prisma = {
    client: {
      customer: { findMany: vi.fn().mockResolvedValue(options.customers ?? [{ id: 'c1' }]) },
      order: {
        findMany: vi.fn().mockResolvedValue([]),
        findFirst: vi.fn().mockResolvedValue(options.order ?? null),
      },
    },
  };
  const payments = {
    createOnlinePayment: vi
      .fn()
      .mockResolvedValue({ paymentId: 'pay-1', redirectUrl: 'http://gw/pay-1', provider: 'mock' }),
  };
  const shop = { updateStatus: vi.fn().mockResolvedValue({ id: 'o1', status: 'CANCELED' }) };

  const service = new AppService(
    prisma as unknown as PrismaService,
    {} as unknown as OtpService,
    {} as unknown as TokenService,
    payments as unknown as PaymentsService,
    {} as unknown as MessagingService,
    {} as unknown as AttendanceQrService,
    shop as unknown as ShopService,
  );
  return { service, prisma, payments, shop };
}

const pendingOrder = {
  id: 'o1',
  tenantId: 't1',
  customerId: 'c1',
  number: 'ORD-00007',
  status: 'PENDING',
  total: 250000,
};

describe('AppService — portal orders', () => {
  it('only lists orders of customers linked to this member', async () => {
    const { service, prisma } = build({ customers: [{ id: 'c1' }, { id: 'c2' }] });

    await service.myOrders('m1');

    expect(prisma.client.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { customerId: { in: ['c1', 'c2'] } },
      }),
    );
  });

  it('returns nothing for a member without a customer file', async () => {
    const { service, prisma } = build({ customers: [] });
    await expect(service.myOrders('m1')).resolves.toEqual([]);
    expect(prisma.client.order.findMany).not.toHaveBeenCalled();
  });

  it('cancels a pending order through the shop state machine', async () => {
    const { service, shop } = build({ order: pendingOrder });

    await service.cancelMyOrder('m1', 'o1');

    expect(shop.updateStatus).toHaveBeenCalledWith('t1', 'o1', { status: 'CANCELED' });
  });

  it('refuses to cancel an order that is already confirmed', async () => {
    const { service, shop } = build({ order: { ...pendingOrder, status: 'CONFIRMED' } });

    await expect(service.cancelMyOrder('m1', 'o1')).rejects.toThrow(/در انتظار تأیید/);
    expect(shop.updateStatus).not.toHaveBeenCalled();
  });

  it('starts a payment for the order total on the order’s tenant', async () => {
    const { service, payments } = build({ order: pendingOrder });

    await service.payMyOrder('m1', 'o1');

    expect(payments.createOnlinePayment).toHaveBeenCalledWith('t1', {
      orderId: 'o1',
      customerId: 'c1',
      description: 'پرداخت سفارش ORD-00007',
    });
  });

  it('hides orders that belong to someone else', async () => {
    const { service } = build({ order: null });
    await expect(service.myOrder('m1', 'o1')).rejects.toThrow(/سفارش/);
  });
});

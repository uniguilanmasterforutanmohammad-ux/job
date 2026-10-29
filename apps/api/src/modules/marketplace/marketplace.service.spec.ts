// TaskForMyAgent — بازارگاه عمومی: محصولات و خدمات همهٔ اصناف + خرید مهمان
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MarketplaceService } from './marketplace.service.js';
import type { PrismaService } from '../../database/prisma.service.js';
import type { AppService } from '../app/app.service.js';
import type { OtpService } from '../auth/otp.service.js';
import type { PaymentsService } from '../payments/payments.service.js';
import type { ShopService } from '../shop/shop.service.js';

function build() {
  const prisma = {
    client: {
      product: {
        findMany: vi.fn().mockResolvedValue([]),
        count: vi.fn().mockResolvedValue(0),
        findFirst: vi.fn(),
      },
      service: {
        findMany: vi.fn().mockResolvedValue([]),
        count: vi.fn().mockResolvedValue(0),
        findFirst: vi.fn(),
      },
      tenant: {
        findMany: vi.fn().mockResolvedValue([]),
        findFirst: vi.fn(),
      },
      customer: { findMany: vi.fn().mockResolvedValue([]) },
      order: { findFirst: vi.fn() },
      $transaction: vi.fn().mockImplementation((ops: Promise<unknown>[]) => Promise.all(ops)),
    },
  };
  const app = {
    verifyOtp: vi.fn().mockResolvedValue({ user: { customerId: 'cust-1' }, tokens: {} }),
  };
  const otp = { request: vi.fn().mockResolvedValue({ expiresInSeconds: 120 }), verify: vi.fn() };
  const shop = {
    createOrder: vi.fn().mockResolvedValue({
      id: 'order-1',
      number: 'ORD-00009',
      status: 'PENDING',
      total: '500000',
    }),
  };
  const payments = {
    createOnlinePayment: vi
      .fn()
      .mockResolvedValue({ paymentId: 'pay-1', redirectUrl: 'http://gateway/pay-1', provider: 'mock' }),
  };

  const service = new MarketplaceService(
    prisma as unknown as PrismaService,
    app as unknown as AppService,
    otp as unknown as OtpService,
    shop as unknown as ShopService,
    payments as unknown as PaymentsService,
  );
  return { service, prisma, app, otp, shop, payments };
}

async function statusOf(promise: Promise<unknown>) {
  const error = await promise.then(
    () => null,
    (cause: { getStatus?: () => number; response?: { code?: string } }) => cause,
  );
  return { status: error?.getStatus?.(), code: error?.response?.code };
}

describe('MarketplaceService — کاتالوگ عمومی', () => {
  beforeEach(() => vi.clearAllMocks());

  it('فقط محصولات منتشرشدهٔ کسب‌وکارهای opt-in با ماژول SHOP را می‌خواند', async () => {
    const { service, prisma } = build();

    await service.products({ sort: 'newest', page: 2, pageSize: 12, search: 'کفش' });

    const call = prisma.client.product.findMany.mock.calls[0][0];
    expect(call.where).toMatchObject({
      isPublic: true,
      isActive: true,
      deletedAt: null,
      tenant: {
        status: 'ACTIVE',
        deletedAt: null,
        marketplaceEnabled: true,
        modules: { some: { key: 'SHOP', isEnabled: true } },
      },
    });
    expect(call.skip).toBe(12);
    expect(call.take).toBe(12);
  });

  it('خدمات را با گیت ماژول SCH و فقط موارد منتشرشده برمی‌گرداند', async () => {
    const { service, prisma } = build();

    await service.services({ sort: 'price_asc', page: 1, pageSize: 12 });

    const call = prisma.client.service.findMany.mock.calls[0][0];
    expect(call.where).toMatchObject({
      isPublic: true,
      isActive: true,
      tenant: {
        marketplaceEnabled: true,
        modules: { some: { key: 'SCH', isEnabled: true } },
      },
    });
    expect(call.orderBy?.[0]).toEqual({ price: 'asc' });
  });
});

describe('MarketplaceService — خرید مهمان', () => {
  beforeEach(() => vi.clearAllMocks());

  const dto = {
    tenantSlug: 'coach-demo',
    phone: '09122222222',
    code: '123456',
    fullName: 'خریدار تست',
    items: [{ productId: 'p1', quantity: 2 }],
    payOnline: true,
  };

  it('برای کسب‌وکار غیرفعال در بازارگاه سفارش نمی‌سازد', async () => {
    const { service, prisma, app } = build();
    prisma.client.tenant.findFirst.mockResolvedValue(null);

    const { status, code } = await statusOf(service.checkout(dto));

    expect(status).toBe(404);
    expect(code).toBe('NOT_FOUND');
    expect(app.verifyOtp).not.toHaveBeenCalled();
  });

  it('قیمت را از دیتابیس می‌گیرد و جمع را سرور-محور می‌سازد', async () => {
    const { service, prisma, shop, payments, app } = build();
    prisma.client.tenant.findFirst.mockResolvedValue({ id: 't1', slug: 'coach-demo', name: 'باشگاه' });
    prisma.client.product.findMany.mockResolvedValue([
      { id: 'p1', name: 'کفش ورزشی', salePrice: '1200000', stock: '10' },
    ]);

    const result = await service.checkout(dto);

    expect(app.verifyOtp).toHaveBeenCalledWith(
      { tenantSlug: 'coach-demo', phone: '09122222222', code: '123456', fullName: 'خریدار تست' },
      {},
    );
    expect(shop.createOrder).toHaveBeenCalledWith(
      't1',
      expect.objectContaining({
        customerId: 'cust-1',
        shippingCost: 0,
        items: [{ productId: 'p1', title: 'کفش ورزشی', quantity: 2, unitPrice: 1200000 }],
      }),
    );
    expect(payments.createOnlinePayment).toHaveBeenCalledWith(
      't1',
      expect.objectContaining({ customerId: 'cust-1', amount: 500000 }),
    );
    expect(result.order.number).toBe('ORD-00009');
  });

  it('اگر موجودی کافی نباشد پیش از تأیید OTP خطا می‌دهد', async () => {
    const { service, prisma, app } = build();
    prisma.client.tenant.findFirst.mockResolvedValue({ id: 't1', slug: 'coach-demo', name: 'باشگاه' });
    prisma.client.product.findMany.mockResolvedValue([
      { id: 'p1', name: 'دستکش تمرین', salePrice: '250000', stock: '1' },
    ]);

    const { status, code } = await statusOf(service.checkout(dto));

    expect(status).toBe(400);
    expect(code).toBe('BAD_REQUEST');
    expect(app.verifyOtp).not.toHaveBeenCalled();
  });

  it('اگر کالا منتشرنشده/حذف‌شده باشد سفارش نمی‌سازد', async () => {
    const { service, prisma } = build();
    prisma.client.tenant.findFirst.mockResolvedValue({ id: 't1', slug: 'coach-demo', name: 'باشگاه' });
    prisma.client.product.findMany.mockResolvedValue([]);

    const { status } = await statusOf(service.checkout(dto));

    expect(status).toBe(400);
  });
});

describe('MarketplaceService — پیگیری سفارش', () => {
  beforeEach(() => vi.clearAllMocks());

  it('با شمارهٔ نامرتبط سفارش را لو نمی‌دهد', async () => {
    const { service, prisma } = build();
    prisma.client.customer.findMany.mockResolvedValue([{ id: 'c1' }]);
    prisma.client.order.findFirst.mockResolvedValue(null);

    const { status } = await statusOf(service.track({ number: 'ORD-00001', phone: '09129999999' }));

    expect(status).toBe(404);
  });

  it('با شمارهٔ درست سفارش را برمی‌گرداند', async () => {
    const { service, prisma } = build();
    prisma.client.customer.findMany.mockResolvedValue([{ id: 'c1' }]);
    prisma.client.order.findFirst.mockResolvedValue({ id: 'o1', number: 'ORD-00001', status: 'PENDING' });

    const order = await service.track({ number: 'ORD-00001', phone: '09122222222' });

    expect(order.number).toBe('ORD-00001');
  });
});

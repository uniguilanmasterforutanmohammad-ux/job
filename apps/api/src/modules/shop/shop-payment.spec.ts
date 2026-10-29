// TaskForMyAgent — بازارگاه فاز ۲: اتصال پرداخت به سفارش، رزرو و بازگشت موجودی
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ShopService } from './shop.service.js';
import { PaymentsService } from '../payments/payments.service.js';
import type { PrismaService } from '../../database/prisma.service.js';
import type { NotificationService } from '../notifications/notification.service.js';
import type { ConfigService } from '@nestjs/config';
import type { AppConfig } from '../../config/configuration.js';
import type { PaymentProviderRegistry } from '../payments/providers/provider.registry.js';

function prismaMock() {
  const client = {
    order: {
      count: vi.fn().mockResolvedValue(0),
      create: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({ id: 'order-1', stockState: 'NONE', ...data }),
      ),
      update: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({ id: 'order-1', ...data }),
      ),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
    },
    member: {
      findFirst: vi.fn().mockResolvedValue({ id: 'owner-1' }),
    },
    customer: {
      findFirst: vi.fn().mockResolvedValue({ fullName: 'خریدار تست' }),
    },
    product: {
      findMany: vi.fn().mockResolvedValue([]),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      update: vi.fn().mockResolvedValue({}),
      findFirst: vi.fn().mockResolvedValue({ id: 'p1' }),
    },
    stockMovement: { create: vi.fn().mockResolvedValue({}) },
    shippingMethod: {
      findFirst: vi.fn().mockResolvedValue({
        id: 'ship-1',
        name: 'پیک موتوری',
        cost: 50000,
        freeAbove: 1000000,
      }),
    },
    payment: {
      create: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({ id: 'pay-1', ...data }),
      ),
      update: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({ id: 'pay-1', tenantId: 't1', orderId: 'order-1', invoiceId: null, ...data }),
      ),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
    },
    refund: { create: vi.fn().mockResolvedValue({ id: 'refund-1' }) },
    invoice: { findUnique: vi.fn(), update: vi.fn() },
  };
  const prisma = {
    client: {
      ...client,
      $transaction: vi.fn((arg: unknown) =>
        typeof arg === 'function'
          ? (arg as (tx: unknown) => Promise<unknown>)(client)
          : Promise.all(arg as Promise<unknown>[]),
      ),
    },
  };
  return { prisma, client };
}

const pendingOrder = {
  id: 'order-1',
  number: 'ORD-00001',
  status: 'PENDING',
  stockState: 'RESERVED',
  items: [{ productId: 'p1', title: 'توپ', quantity: 2, unitPrice: 100 }],
  total: 200,
};

describe('ShopService — stock ownership', () => {
  let shop: ShopService;
  let client: ReturnType<typeof prismaMock>['client'];
  let notifications: { notify: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    const mock = prismaMock();
    client = mock.client;
    notifications = { notify: vi.fn().mockResolvedValue({ delivered: ['IN_APP'], failed: [] }) };
    shop = new ShopService(
      mock.prisma as unknown as PrismaService,
      notifications as unknown as NotificationService,
    );
  });

  it('reserves stock atomically when checkout asks for it', async () => {
    const order = await shop.createOrder(
      't1',
      {
        items: [{ productId: 'p1', title: 'توپ', quantity: 2, unitPrice: 100 }],
        shippingCost: 0,
      },
      { reserveStock: true },
    );

    expect(client.product.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: 'p1', stock: { gte: 2 } }) }),
    );
    expect(client.stockMovement.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ type: 'RESERVATION', quantity: -2, reference: 'order-1' }),
      }),
    );
    expect(order.stockState).toBe('RESERVED');
  });

  it('rejects the order when any line is out of stock', async () => {
    client.product.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      shop.createOrder(
        't1',
        { items: [{ productId: 'p1', title: 'توپ', quantity: 2, unitPrice: 100 }], shippingCost: 0 },
        { reserveStock: true },
      ),
    ).rejects.toThrow(/موجودی/);
  });

  it('commits a reservation on payment without deducting twice', async () => {
    client.order.findFirst.mockResolvedValue(pendingOrder);

    const updated = await shop.confirmAfterPayment('t1', 'order-1');

    expect(client.product.updateMany).not.toHaveBeenCalled();
    expect(client.stockMovement.create).not.toHaveBeenCalled();
    expect(updated).toMatchObject({ status: 'CONFIRMED', stockState: 'COMMITTED' });
  });

  it('puts reserved quantities back when the order is canceled', async () => {
    client.order.findFirst.mockResolvedValue(pendingOrder);

    const updated = await shop.updateStatus('t1', 'order-1', { status: 'CANCELED' });

    expect(client.stockMovement.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ type: 'RELEASE', quantity: 2 }) }),
    );
    expect(client.product.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { stock: { increment: 2 } } }),
    );
    expect(updated).toMatchObject({ status: 'CANCELED', stockState: 'RELEASED' });
  });

  it('is idempotent when the gateway calls back twice', async () => {
    client.order.findFirst.mockResolvedValue({ ...pendingOrder, status: 'CONFIRMED', stockState: 'COMMITTED' });
    await shop.confirmAfterPayment('t1', 'order-1');
    expect(client.order.update).not.toHaveBeenCalled();
  });

  it('notifies the business owner and the buyer about a new order', async () => {
    await shop.createOrder('t1', {
      customerId: 'c1',
      items: [{ productId: 'p1', title: 'توپ', quantity: 1, unitPrice: 100 }],
      shippingCost: 0,
    });

    expect(notifications.notify).toHaveBeenCalledWith(
      expect.objectContaining({ memberId: 'owner-1', event: 'order.created' }),
    );
    expect(notifications.notify).toHaveBeenCalledWith(
      expect.objectContaining({ customerId: 'c1', event: 'order.created' }),
    );
  });

  it('notifies the buyer when the order status changes', async () => {
    client.order.findFirst.mockResolvedValue({ ...pendingOrder, customerId: 'c1', number: 'ORD-00001' });

    await shop.confirmAfterPayment('t1', 'order-1');

    expect(notifications.notify).toHaveBeenCalledWith(
      expect.objectContaining({
        customerId: 'c1',
        event: 'order.confirmed',
        body: expect.stringContaining('تأیید شد'),
      }),
    );
  });

  it('charges the delivery option and stores it on the order', async () => {
    const order = await shop.createOrder('t1', {
      items: [{ productId: 'p1', title: 'توپ', quantity: 1, unitPrice: 250000 }],
      shippingMethodId: 'ship-1',
      shippingCost: 0,
    });

    expect(client.order.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          shippingMethodId: 'ship-1',
          shippingMethod: 'پیک موتوری',
          shippingCost: 50000,
          total: 300000,
        }),
      }),
    );
    expect(order.total).toBe(300000);
  });

  it('waives delivery cost above the free-shipping threshold', () => {
    expect(shop.shippingCostFor({ cost: 50000, freeAbove: 1000000 }, 1200000)).toBe(0);
    expect(shop.shippingCostFor({ cost: 50000, freeAbove: 1000000 }, 900000)).toBe(50000);
    expect(shop.shippingCostFor({ cost: 80000, freeAbove: null }, 5000000)).toBe(80000);
  });
});

describe('PaymentsService — order linkage', () => {
  let payments: PaymentsService;
  let client: ReturnType<typeof prismaMock>['client'];
  let gateway: { createPayment: ReturnType<typeof vi.fn>; verifyPayment: ReturnType<typeof vi.fn> };
  let shop: { confirmAfterPayment: ReturnType<typeof vi.fn>; releaseAfterRefund: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    const mock = prismaMock();
    client = mock.client;
    gateway = {
      createPayment: vi.fn().mockResolvedValue({ providerRef: 'auth-1', redirectUrl: 'http://gw/auth-1' }),
      verifyPayment: vi.fn().mockResolvedValue({ success: true, trackingCode: 'TRK-1', raw: {} }),
    };
    const registry = { has: () => true, get: () => gateway } as unknown as PaymentProviderRegistry;
    const config = {
      get: () => ({ provider: 'mock', mockCallbackBase: 'http://api/payments/callback' }),
    } as unknown as ConfigService<AppConfig>;
    shop = {
      confirmAfterPayment: vi.fn().mockResolvedValue({ status: 'CONFIRMED' }),
      releaseAfterRefund: vi.fn().mockResolvedValue({ status: 'CANCELED' }),
    };
    payments = new PaymentsService(
      mock.prisma as unknown as PrismaService,
      config,
      registry,
      shop as never,
    );
  });

  it('derives the amount from the order, not from the client', async () => {
    client.order.findFirst.mockResolvedValue({
      id: 'order-1',
      number: 'ORD-00001',
      status: 'PENDING',
      total: 250000,
    });

    await payments.createOnlinePayment('t1', { orderId: 'order-1' } as never);

    expect(client.payment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ orderId: 'order-1', amount: 250000 }),
      }),
    );
  });

  it('refuses to pay an order that is no longer pending', async () => {
    client.order.findFirst.mockResolvedValue({
      id: 'order-1',
      number: 'ORD-00001',
      status: 'CANCELED',
      total: 250000,
    });

    await expect(
      payments.createOnlinePayment('t1', { orderId: 'order-1' } as never),
    ).rejects.toThrow(/قابل پرداخت نیست/);
  });

  it('confirms the order when the gateway verifies the payment', async () => {
    client.payment.findUnique.mockResolvedValue({
      id: 'pay-1',
      tenantId: 't1',
      orderId: 'order-1',
      invoiceId: null,
      amount: 250000,
      status: 'PENDING',
      provider: 'mock',
      providerRef: 'auth-1',
    });
    client.order.findUnique.mockResolvedValue({ id: 'order-1', number: 'ORD-00001' });

    const result = await payments.verifyCallback({ paymentId: 'pay-1' });

    expect(result).toMatchObject({ success: true, orderNumber: 'ORD-00001', trackingCode: 'TRK-1' });
    expect(shop.confirmAfterPayment).toHaveBeenCalledWith('t1', 'order-1');
  });

  it('restores stock and cancels the order on refund', async () => {
    client.payment.findFirst.mockResolvedValue({
      id: 'pay-1',
      tenantId: 't1',
      orderId: 'order-1',
      invoiceId: null,
      customerId: 'c1',
      amount: 250000,
      status: 'SUCCEEDED',
    });

    await payments.refundPayment('t1', 'pay-1', 'm1', 'انصراف مشتری');

    expect(shop.releaseAfterRefund).toHaveBeenCalledWith('t1', 'order-1');
    expect(client.payment.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'REFUNDED' } }),
    );
  });
});

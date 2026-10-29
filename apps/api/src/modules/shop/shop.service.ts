import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@repo/db';
import { buildMeta, toSkipTake } from '../../common/dto/pagination.dto.js';
import { DomainException } from '../../common/exceptions/domain.exception.js';
import { PrismaService } from '../../database/prisma.service.js';
import type {
  CatalogQueryDto,
  CreateOrderDto,
  ListOrdersDto,
  UpdateOrderStatusDto,
  UpdateShippingDto,
} from './dto/shop.schemas.js';

/** Allowed order state transitions (SHOP-03). */
const TRANSITIONS: Record<string, string[]> = {
  PENDING: ['CONFIRMED', 'CANCELED'],
  CONFIRMED: ['PREPARING', 'CANCELED'],
  PREPARING: ['SHIPPED', 'CANCELED'],
  SHIPPED: ['DELIVERED'],
  DELIVERED: [],
  CANCELED: [],
};

type OrderItem = { productId?: string; title?: string; quantity?: number; unitPrice?: number };

type CreateOrderOptions = {
  /**
   * Marketplace/checkout orders deduct stock the moment they are placed, so a
   * product can never be sold twice while a payment is in flight.
   */
  reserveStock?: boolean;
};

@Injectable()
export class ShopService {
  private readonly logger = new Logger(ShopService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** SHOP-01 — public catalog of sellable products. */
  async catalog(tenantId: string, dto: CatalogQueryDto) {
    return this.prisma.client.product.findMany({
      where: {
        tenantId,
        isActive: true,
        deletedAt: null,
        salePrice: { gt: 0 },
        ...(dto.category ? { category: dto.category } : {}),
        ...(dto.search ? { name: { contains: dto.search, mode: 'insensitive' as const } } : {}),
      },
      select: {
        id: true,
        name: true,
        category: true,
        unit: true,
        salePrice: true,
        imageUrl: true,
        stock: true,
      },
      orderBy: { name: 'asc' },
    });
  }

  /** SHOP-02/05 — create an order with server-computed totals. */
  async createOrder(tenantId: string, dto: CreateOrderDto, options: CreateOrderOptions = {}) {
    if (dto.customerId) {
      const customer = await this.prisma.client.customer.findFirst({
        where: { id: dto.customerId, tenantId, deletedAt: null },
      });
      if (!customer) throw DomainException.notFound('مشتری');
    }

    const subtotal = dto.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
    const total = subtotal + dto.shippingCost;

    // `number` is derived from a count, so two simultaneous checkouts can race
    // for the same value; the unique (tenantId, number) index rejects the loser
    // and we retry with a fresh number.
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await this.prisma.client.$transaction(async (tx) => {
          const number = await this.nextOrderNumber(tenantId, tx);
          const order = await tx.order.create({
            data: {
              tenantId,
              customerId: dto.customerId ?? null,
              number,
              items: dto.items as never,
              subtotal,
              shippingCost: dto.shippingCost,
              total,
              shippingMethod: dto.shippingMethod ?? null,
              address: dto.address ?? null,
              note: dto.note ?? null,
              status: 'PENDING',
            },
          });

          if (!options.reserveStock) return order;

          await this.reserveStock(tx, tenantId, order.id, dto.items);
          return tx.order.update({
            where: { id: order.id },
            data: { stockState: 'RESERVED' },
          });
        });
      } catch (error) {
        if (this.isUniqueViolation(error) && attempt < 2) continue;
        throw error;
      }
    }

    throw DomainException.conflict('ثبت سفارش با مشکل مواجه شد؛ دوباره تلاش کنید');
  }

  private isUniqueViolation(error: unknown): boolean {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
  }

  private async nextOrderNumber(
    tenantId: string,
    client: Prisma.TransactionClient = this.prisma.client,
  ): Promise<string> {
    const count = await client.order.count({ where: { tenantId } });
    return `ORD-${String(count + 1).padStart(5, '0')}`;
  }

  async list(tenantId: string, dto: ListOrdersDto) {
    const where = {
      tenantId,
      ...(dto.status ? { status: dto.status } : {}),
      ...(dto.customerId ? { customerId: dto.customerId } : {}),
    };
    const [data, total] = await this.prisma.client.$transaction([
      this.prisma.client.order.findMany({ where, ...toSkipTake(dto), orderBy: { createdAt: 'desc' } }),
      this.prisma.client.order.count({ where }),
    ]);
    return { data, meta: buildMeta(total, dto) };
  }

  private async findOne(tenantId: string, id: string) {
    const order = await this.prisma.client.order.findFirst({ where: { id, tenantId } });
    if (!order) throw DomainException.notFound('سفارش');
    return order;
  }

  async findOnePublic(tenantId: string, id: string) {
    return this.findOne(tenantId, id);
  }

  /** SHOP-03 — guarded status flow; owns stock via `stockState`. */
  async updateStatus(tenantId: string, id: string, dto: UpdateOrderStatusDto) {
    const order = await this.findOne(tenantId, id);
    return this.advance(tenantId, order, dto.status);
  }

  private async advance(
    tenantId: string,
    order: { id: string; status: string; stockState: string; items: unknown; total: unknown },
    next: string,
  ) {
    const allowed = TRANSITIONS[order.status] ?? [];
    if (!allowed.includes(next)) {
      throw DomainException.badRequest(`تغییر وضعیت از ${order.status} به ${next} مجاز نیست`);
    }

    let stockState = order.stockState;
    if (next === 'CONFIRMED') {
      if (order.stockState === 'NONE') {
        await this.deductStock(tenantId, order.id, order.items);
        stockState = 'COMMITTED';
      } else if (order.stockState === 'RESERVED') {
        stockState = 'COMMITTED';
      }
    }
    if (next === 'CANCELED' && (order.stockState === 'RESERVED' || order.stockState === 'COMMITTED')) {
      await this.releaseStock(tenantId, order.id, order.items);
      stockState = 'RELEASED';
    }

    this.logger.log(`Order ${order.id} ${order.status} → ${next} (stock ${stockState})`);
    return this.prisma.client.order.update({
      where: { id: order.id },
      data: { status: next as never, stockState: stockState as never },
    });
  }

  /**
   * Confirms an order once its payment is settled (gateway callback or a
   * manually recorded payment). Idempotent: a repeated callback is a no-op.
   */
  async confirmAfterPayment(tenantId: string, orderId: string) {
    const order = await this.findOne(tenantId, orderId);
    if (order.status !== 'PENDING') return order;
    return this.advance(tenantId, order, 'CONFIRMED');
  }

  /** Refund/cancel of a paid order: puts the reserved quantities back. */
  async releaseAfterRefund(tenantId: string, orderId: string) {
    const order = await this.findOne(tenantId, orderId);
    if (order.status === 'CANCELED' || order.status === 'DELIVERED') return order;
    if (order.status === 'SHIPPED') {
      // Goods came back: the normal state machine has no SHIPPED → CANCELED
      // edge, so a refund closes the order explicitly and restores stock.
      if (order.stockState === 'RESERVED' || order.stockState === 'COMMITTED') {
        await this.releaseStock(tenantId, order.id, order.items);
      }
      return this.prisma.client.order.update({
        where: { id: order.id },
        data: { status: 'CANCELED', stockState: 'RELEASED' },
      });
    }
    return this.advance(tenantId, order, 'CANCELED');
  }

  private async reserveStock(
    tx: Prisma.TransactionClient,
    tenantId: string,
    orderId: string,
    items: unknown,
  ) {
    for (const item of this.orderItems(items)) {
      const updated = await tx.product.updateMany({
        where: {
          id: item.productId,
          tenantId,
          deletedAt: null,
          stock: { gte: item.quantity },
        },
        data: { stock: { decrement: item.quantity } },
      });
      if (updated.count === 0) {
        throw DomainException.badRequest(`موجودی «${item.title ?? 'کالا'}» کافی نیست`);
      }
      await tx.stockMovement.create({
        data: {
          tenantId,
          productId: item.productId,
          type: 'RESERVATION',
          quantity: -Math.abs(item.quantity),
          reference: orderId,
        },
      });
    }
  }

  private orderItems(items: unknown): { productId: string; quantity: number; title?: string }[] {
    const list = Array.isArray(items) ? (items as OrderItem[]) : [];
    return list
      .filter((item): item is OrderItem & { productId: string; quantity: number } =>
        Boolean(item.productId && item.quantity),
      )
      .map((item) => ({ productId: item.productId, quantity: item.quantity, title: item.title }));
  }

  private async deductStock(tenantId: string, orderId: string, items: unknown) {
    const list = Array.isArray(items) ? (items as Array<{ productId?: string; quantity?: number }>) : [];
    for (const item of list) {
      if (!item.productId || !item.quantity) continue;
      const product = await this.prisma.client.product.findFirst({
        where: { id: item.productId, tenantId },
      });
      if (!product) continue;
      await this.prisma.client.$transaction([
        this.prisma.client.stockMovement.create({
          data: {
            tenantId,
            productId: item.productId,
            type: 'SALE',
            quantity: -Math.abs(item.quantity),
            reference: orderId,
          },
        }),
        this.prisma.client.product.update({
          where: { id: item.productId },
          data: { stock: { decrement: item.quantity } },
        }),
      ]);
    }
  }

  private async releaseStock(tenantId: string, orderId: string, items: unknown) {
    for (const item of this.orderItems(items)) {
      const product = await this.prisma.client.product.findFirst({
        where: { id: item.productId, tenantId },
        select: { id: true },
      });
      if (!product) continue;
      await this.prisma.client.$transaction([
        this.prisma.client.stockMovement.create({
          data: {
            tenantId,
            productId: item.productId,
            type: 'RELEASE',
            quantity: Math.abs(item.quantity),
            reference: orderId,
          },
        }),
        this.prisma.client.product.update({
          where: { id: item.productId },
          data: { stock: { increment: item.quantity } },
        }),
      ]);
    }
  }

  /** SHOP-04 — shipping details / tracking. */
  async updateShipping(tenantId: string, id: string, dto: UpdateShippingDto) {
    await this.findOne(tenantId, id);
    return this.prisma.client.order.update({
      where: { id },
      data: {
        ...(dto.shippingMethod !== undefined ? { shippingMethod: dto.shippingMethod } : {}),
        ...(dto.shippingCost !== undefined ? { shippingCost: dto.shippingCost } : {}),
        ...(dto.trackingCode !== undefined ? { trackingCode: dto.trackingCode } : {}),
        ...(dto.address !== undefined ? { address: dto.address } : {}),
      },
    });
  }

  /** SHOP-05 — kitchen/warehouse order slip. */
  async slip(tenantId: string, id: string) {
    const order = await this.findOne(tenantId, id);
    return {
      number: order.number,
      createdAt: order.createdAt,
      status: order.status,
      items: order.items,
      note: order.note,
      total: order.total,
    };
  }
}

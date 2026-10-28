import { Injectable, Logger } from '@nestjs/common';
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
  async createOrder(tenantId: string, dto: CreateOrderDto) {
    if (dto.customerId) {
      const customer = await this.prisma.client.customer.findFirst({
        where: { id: dto.customerId, tenantId, deletedAt: null },
      });
      if (!customer) throw DomainException.notFound('مشتری');
    }

    const subtotal = dto.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
    const total = subtotal + dto.shippingCost;
    const number = await this.nextOrderNumber(tenantId);

    return this.prisma.client.order.create({
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
  }

  private async nextOrderNumber(tenantId: string): Promise<string> {
    const count = await this.prisma.client.order.count({ where: { tenantId } });
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

  /** SHOP-03 — guarded status flow; deducts stock on confirmation. */
  async updateStatus(tenantId: string, id: string, dto: UpdateOrderStatusDto) {
    const order = await this.findOne(tenantId, id);
    const allowed = TRANSITIONS[order.status] ?? [];
    if (!allowed.includes(dto.status)) {
      throw DomainException.badRequest(`تغییر وضعیت از ${order.status} به ${dto.status} مجاز نیست`);
    }

    if (dto.status === 'CONFIRMED') await this.deductStock(tenantId, order.id, order.items as never);

    return this.prisma.client.order.update({ where: { id }, data: { status: dto.status } });
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

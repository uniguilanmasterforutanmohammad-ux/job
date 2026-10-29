import { Injectable, Logger } from '@nestjs/common';
import type { ModuleKey } from '@repo/shared';
import { Prisma } from '@repo/db';
import { buildMeta, toSkipTake } from '../../common/dto/pagination.dto.js';
import { DomainException } from '../../common/exceptions/domain.exception.js';
import { PrismaService } from '../../database/prisma.service.js';
import { AppService } from '../app/app.service.js';
import { OtpService } from '../auth/otp.service.js';
import { PaymentsService } from '../payments/payments.service.js';
import { ShopService } from '../shop/shop.service.js';
import type {
  MarketplaceBusinessesQueryDto,
  MarketplaceCheckoutDto,
  MarketplaceProductsQueryDto,
  MarketplaceServicesQueryDto,
  MarketplaceSort,
  MarketplaceTrackQueryDto,
} from './dto/marketplace.schemas.js';

const PUBLIC_TENANT_FIELDS = {
  slug: true,
  name: true,
  industry: true,
  logoUrl: true,
  tagline: true,
  city: true,
} satisfies Prisma.TenantSelect;

const PRODUCT_SELECT = {
  id: true,
  name: true,
  description: true,
  category: true,
  unit: true,
  salePrice: true,
  imageUrl: true,
  stock: true,
  createdAt: true,
  tenant: { select: PUBLIC_TENANT_FIELDS },
} satisfies Prisma.ProductSelect;

const SERVICE_SELECT = {
  id: true,
  name: true,
  description: true,
  category: true,
  imageUrl: true,
  durationMinutes: true,
  price: true,
  createdAt: true,
  tenant: { select: PUBLIC_TENANT_FIELDS },
} satisfies Prisma.ServiceSelect;

/**
 * Cross-tenant, read-only catalogue for the public marketplace.
 *
 * This is the *only* surface allowed to read across tenants. Every query is
 * restricted to opt-in businesses (`marketplaceEnabled`) with an enabled
 * module, and to items explicitly published (`isPublic`). Nothing here accepts
 * a `tenantId` from the client — the public identifier is the tenant slug.
 */
@Injectable()
export class MarketplaceService {
  private readonly logger = new Logger(MarketplaceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly app: AppService,
    private readonly otp: OtpService,
    private readonly shop: ShopService,
    private readonly payments: PaymentsService,
  ) {}

  private tenantScope(
    filters: { industry?: string; tenantSlug?: string; city?: string },
    moduleKey: ModuleKey,
  ): Prisma.TenantWhereInput {
    return {
      status: 'ACTIVE',
      deletedAt: null,
      marketplaceEnabled: true,
      ...(filters.industry ? { industry: filters.industry } : {}),
      ...(filters.tenantSlug ? { slug: filters.tenantSlug } : {}),
      ...(filters.city ? { city: { contains: filters.city, mode: 'insensitive' } } : {}),
      modules: { some: { key: moduleKey, isEnabled: true } },
    };
  }

  private productOrder(sort: MarketplaceSort): Prisma.ProductOrderByWithRelationInput[] {
    switch (sort) {
      case 'price_asc':
        return [{ salePrice: 'asc' }, { name: 'asc' }];
      case 'price_desc':
        return [{ salePrice: 'desc' }, { name: 'asc' }];
      case 'name':
        return [{ name: 'asc' }];
      default:
        return [{ createdAt: 'desc' }];
    }
  }

  private serviceOrder(sort: MarketplaceSort): Prisma.ServiceOrderByWithRelationInput[] {
    switch (sort) {
      case 'price_asc':
        return [{ price: 'asc' }, { name: 'asc' }];
      case 'price_desc':
        return [{ price: 'desc' }, { name: 'asc' }];
      case 'name':
        return [{ name: 'asc' }];
      default:
        return [{ createdAt: 'desc' }];
    }
  }

  /** SHOP-01 (public) — published products across all opted-in businesses. */
  async products(dto: MarketplaceProductsQueryDto) {
    const priceFilter: Prisma.DecimalFilter = { gt: 0 };
    if (dto.minPrice !== undefined) priceFilter.gte = dto.minPrice;
    if (dto.maxPrice !== undefined) priceFilter.lte = dto.maxPrice;

    const where: Prisma.ProductWhereInput = {
      isPublic: true,
      isActive: true,
      deletedAt: null,
      salePrice: priceFilter,
      ...(dto.inStock ? { stock: { gt: 0 } } : {}),
      ...(dto.category ? { category: dto.category } : {}),
      ...(dto.search
        ? {
            OR: [
              { name: { contains: dto.search, mode: 'insensitive' as const } },
              { description: { contains: dto.search, mode: 'insensitive' as const } },
              { category: { contains: dto.search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
      tenant: this.tenantScope(dto, 'SHOP'),
    };

    const [data, total] = await this.prisma.client.$transaction([
      this.prisma.client.product.findMany({
        where,
        select: PRODUCT_SELECT,
        orderBy: this.productOrder(dto.sort),
        ...toSkipTake(dto),
      }),
      this.prisma.client.product.count({ where }),
    ]);

    return { data, meta: buildMeta(total, dto) };
  }

  async product(id: string) {
    const product = await this.prisma.client.product.findFirst({
      where: {
        id,
        isPublic: true,
        isActive: true,
        deletedAt: null,
        salePrice: { gt: 0 },
        tenant: this.tenantScope({}, 'SHOP'),
      },
      select: PRODUCT_SELECT,
    });
    if (!product) throw DomainException.notFound('محصول');
    return product;
  }

  /** Services published by opted-in businesses (classes, sessions, treatments…). */
  async services(dto: MarketplaceServicesQueryDto) {
    const where: Prisma.ServiceWhereInput = {
      isPublic: true,
      isActive: true,
      deletedAt: null,
      ...(dto.category ? { category: dto.category } : {}),
      ...(dto.minPrice !== undefined ? { price: { gte: dto.minPrice } } : {}),
      ...(dto.maxPrice !== undefined
        ? {
            price: {
              ...(dto.minPrice !== undefined ? { gte: dto.minPrice } : {}),
              lte: dto.maxPrice,
            },
          }
        : {}),
      ...(dto.search
        ? {
            OR: [
              { name: { contains: dto.search, mode: 'insensitive' as const } },
              { description: { contains: dto.search, mode: 'insensitive' as const } },
              { category: { contains: dto.search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
      tenant: this.tenantScope(dto, 'SCH'),
    };

    const [data, total] = await this.prisma.client.$transaction([
      this.prisma.client.service.findMany({
        where,
        select: SERVICE_SELECT,
        orderBy: this.serviceOrder(dto.sort),
        ...toSkipTake(dto),
      }),
      this.prisma.client.service.count({ where }),
    ]);

    return { data, meta: buildMeta(total, dto) };
  }

  async service(id: string) {
    const service = await this.prisma.client.service.findFirst({
      where: {
        id,
        isPublic: true,
        isActive: true,
        deletedAt: null,
        tenant: this.tenantScope({}, 'SCH'),
      },
      select: SERVICE_SELECT,
    });
    if (!service) throw DomainException.notFound('خدمت');
    return service;
  }

  /** Business cards with live counts of published items. */
  async businesses(dto: MarketplaceBusinessesQueryDto) {
    const rows = await this.prisma.client.tenant.findMany({
      where: {
        status: 'ACTIVE',
        deletedAt: null,
        marketplaceEnabled: true,
        ...(dto.industry ? { industry: dto.industry } : {}),
        ...(dto.city ? { city: { contains: dto.city, mode: 'insensitive' } } : {}),
        ...(dto.search
          ? {
              OR: [
                { name: { contains: dto.search, mode: 'insensitive' } },
                { slug: { contains: dto.search, mode: 'insensitive' } },
                { tagline: { contains: dto.search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      select: {
        ...PUBLIC_TENANT_FIELDS,
        _count: {
          select: {
            products: { where: { isPublic: true, isActive: true, deletedAt: null } },
            services: { where: { isPublic: true, isActive: true, deletedAt: null } },
          },
        },
      },
      orderBy: { name: 'asc' },
      take: 100,
    });

    return rows.map(({ _count, ...row }) => ({
      ...row,
      productCount: _count.products,
      serviceCount: _count.services,
    }));
  }

  /** Public storefront of one business (profile + published items). */
  async business(slug: string) {
    const tenant = await this.prisma.client.tenant.findFirst({
      where: {
        slug,
        status: 'ACTIVE',
        deletedAt: null,
        marketplaceEnabled: true,
      },
      select: {
        ...PUBLIC_TENANT_FIELDS,
        address: true,
        phone: true,
      },
    });
    if (!tenant) throw DomainException.notFound('کسب‌وکار');

    const [products, services] = await Promise.all([
      this.prisma.client.product.findMany({
        where: {
          isPublic: true,
          isActive: true,
          deletedAt: null,
          salePrice: { gt: 0 },
          tenant: this.tenantScope({ tenantSlug: slug }, 'SHOP'),
        },
        select: PRODUCT_SELECT,
        orderBy: { createdAt: 'desc' },
        take: 48,
      }),
      this.prisma.client.service.findMany({
        where: {
          isPublic: true,
          isActive: true,
          deletedAt: null,
          tenant: this.tenantScope({ tenantSlug: slug }, 'SCH'),
        },
        select: SERVICE_SELECT,
        orderBy: { createdAt: 'desc' },
        take: 48,
      }),
    ]);

    return { tenant, products, services };
  }

  /** Filter chips for the catalogue pages. */
  async facets() {
    const base: Prisma.ProductWhereInput = {
      isPublic: true,
      isActive: true,
      deletedAt: null,
      tenant: this.tenantScope({}, 'SHOP'),
    };
    const [productCategories, serviceCategories, industries] = await Promise.all([
      this.prisma.client.product.findMany({
        where: base,
        distinct: ['category'],
        select: { category: true },
        orderBy: { category: 'asc' },
      }),
      this.prisma.client.service.findMany({
        where: {
          isPublic: true,
          isActive: true,
          deletedAt: null,
          tenant: this.tenantScope({}, 'SCH'),
        },
        distinct: ['category'],
        select: { category: true },
        orderBy: { category: 'asc' },
      }),
      this.prisma.client.tenant.findMany({
        where: { status: 'ACTIVE', deletedAt: null, marketplaceEnabled: true },
        distinct: ['industry'],
        select: { industry: true },
        orderBy: { industry: 'asc' },
      }),
    ]);

    return {
      productCategories: productCategories.map((row) => row.category).filter(Boolean),
      serviceCategories: serviceCategories.map((row) => row.category).filter(Boolean),
      industries: industries.map((row) => row.industry),
    };
  }

  async requestOtp(phone: string) {
    return this.otp.request(phone, 'LOGIN');
  }

  /**
   * Guest checkout. OTP verification also provisions/links the portal account
   * (member + customer) so the order shows up in the buyer's portal.
   *
   * Prices and availability are recomputed from the database — the client only
   * sends product ids and quantities. Shipping is arranged with the business;
   * the online payment covers the goods only.
   */
  async checkout(dto: MarketplaceCheckoutDto) {
    const tenant = await this.prisma.client.tenant.findFirst({
      where: {
        slug: dto.tenantSlug,
        status: 'ACTIVE',
        deletedAt: null,
        marketplaceEnabled: true,
      },
      select: { id: true, slug: true, name: true },
    });
    if (!tenant) throw DomainException.notFound('کسب‌وکار');

    const productIds = [...new Set(dto.items.map((item) => item.productId))];
    const products = await this.prisma.client.product.findMany({
      where: {
        tenantId: tenant.id,
        id: { in: productIds },
        isPublic: true,
        isActive: true,
        deletedAt: null,
      },
    });
    const productMap = new Map(products.map((product) => [product.id, product]));

    const lines = dto.items.map((item) => {
      const product = productMap.get(item.productId);
      if (!product) throw DomainException.badRequest('یکی از اقلام سبد دیگر در دسترس نیست');
      if (Number(product.stock) < item.quantity) {
        throw DomainException.badRequest(`موجودی «${product.name}» کافی نیست`);
      }
      const unitPrice = Number(product.salePrice);
      return {
        productId: product.id,
        title: product.name,
        quantity: item.quantity,
        unitPrice,
      };
    });

    const { user } = await this.app.verifyOtp(
      {
        tenantSlug: tenant.slug,
        phone: dto.phone,
        code: dto.code,
        fullName: dto.fullName,
      },
      {},
    );

    const order = await this.shop.createOrder(tenant.id, {
      customerId: user.customerId,
      items: lines,
      shippingMethod: dto.shippingMethod,
      shippingCost: 0,
      address: dto.address,
      note: dto.note,
    });

    const payment = dto.payOnline
      ? await this.payments.createOnlinePayment(tenant.id, {
          customerId: user.customerId,
          amount: Number(order.total),
          description: `پرداخت سفارش ${order.number}`,
        })
      : null;

    this.logger.log(
      `Marketplace checkout tenant=${tenant.slug} order=${order.number} payment=${payment?.paymentId ?? 'none'}`,
    );

    return {
      tenant: { slug: tenant.slug, name: tenant.name },
      order: {
        id: order.id,
        number: order.number,
        status: order.status,
        total: order.total,
      },
      payment,
    };
  }

  /** Order tracking for guests: order number + the phone used at checkout. */
  async track(dto: MarketplaceTrackQueryDto) {
    const customers = await this.prisma.client.customer.findMany({
      where: { phone: dto.phone, deletedAt: null },
      select: { id: true },
    });
    if (customers.length === 0) throw DomainException.notFound('سفارش');

    const order = await this.prisma.client.order.findFirst({
      where: {
        number: dto.number,
        customerId: { in: customers.map((customer) => customer.id) },
      },
      select: {
        id: true,
        number: true,
        status: true,
        items: true,
        subtotal: true,
        shippingCost: true,
        total: true,
        trackingCode: true,
        shippingMethod: true,
        createdAt: true,
        updatedAt: true,
        tenant: { select: { slug: true, name: true } },
      },
    });
    if (!order) throw DomainException.notFound('سفارش');
    return order;
  }
}

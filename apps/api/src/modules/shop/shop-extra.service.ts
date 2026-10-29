import { Injectable, Logger } from '@nestjs/common';
import { DomainException } from '../../common/exceptions/domain.exception.js';
import { PrismaService } from '../../database/prisma.service.js';
import { PaymentsService } from '../payments/payments.service.js';
import { ShopService } from './shop.service.js';
import type { CheckoutDto } from './dto/shop-extra.schemas.js';

/** SHOP-02 — cart validation and checkout (optionally via the payment gateway). */
@Injectable()
export class ShopExtraService {
  private readonly logger = new Logger(ShopExtraService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly shop: ShopService,
    private readonly payments: PaymentsService,
  ) {}

  /** Validates the cart against the live catalog and computes authoritative totals. */
  async quoteCart(tenantId: string, dto: CheckoutDto) {
    const productIds = dto.items.map((i) => i.productId);
    const products = await this.prisma.client.product.findMany({
      where: { tenantId, id: { in: productIds }, isActive: true, deletedAt: null },
    });
    const productMap = new Map(products.map((p) => [p.id, p]));

    const lines = dto.items.map((item) => {
      const product = productMap.get(item.productId);
      if (!product) throw DomainException.notFound('محصول');
      if (Number(product.stock) < item.quantity) {
        throw DomainException.badRequest(`موجودی «${product.name}» کافی نیست`);
      }
      const unitPrice = Number(product.salePrice);
      return {
        productId: product.id,
        title: product.name,
        quantity: item.quantity,
        unitPrice,
        lineTotal: unitPrice * item.quantity,
      };
    });

    const subtotal = lines.reduce((s, l) => s + l.lineTotal, 0);
    const total = subtotal + dto.shippingCost;
    return { lines, subtotal, shippingCost: dto.shippingCost, total };
  }

  /** SHOP-02 — places the order; optionally initiates an online payment. */
  async checkout(tenantId: string, dto: CheckoutDto) {
    const quote = await this.quoteCart(tenantId, dto);

    const order = await this.shop.createOrder(tenantId, {
      customerId: dto.customerId,
      items: quote.lines.map((l) => ({
        productId: l.productId,
        title: l.title,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
      })),
      shippingMethod: dto.shippingMethod,
      shippingCost: dto.shippingCost,
      address: dto.address,
      note: dto.note,
    }, { reserveStock: true });

    if (!dto.payOnline) {
      return { order, payment: null };
    }

    const payment = await this.payments.createOnlinePayment(tenantId, {
      orderId: order.id,
      customerId: dto.customerId,
      description: `پرداخت سفارش ${order.number}`,
      provider: dto.provider,
    });
    this.logger.log(`Checkout order=${order.id} payment=${payment.paymentId}`);
    return { order, payment };
  }
}

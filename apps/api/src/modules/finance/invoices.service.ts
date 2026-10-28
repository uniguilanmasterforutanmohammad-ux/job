import { Injectable } from '@nestjs/common';
import { buildMeta, toSkipTake } from '../../common/dto/pagination.dto.js';
import { DomainException } from '../../common/exceptions/domain.exception.js';
import { PrismaService } from '../../database/prisma.service.js';
import type { CreateInvoiceDto, ListInvoicesDto } from './dto/invoice.schemas.js';

@Injectable()
export class InvoicesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Creates an invoice with computed line totals, tax and grand total.
   * Numbering is per-tenant sequential using the tenant's invoice prefix.
   */
  async create(tenantId: string, dto: CreateInvoiceDto) {
    const customer = await this.prisma.client.customer.findFirst({
      where: { id: dto.customerId, tenantId, deletedAt: null },
      select: { id: true },
    });
    if (!customer) throw DomainException.notFound('مشتری');

    const tenant = await this.prisma.client.tenant.findUniqueOrThrow({ where: { id: tenantId } });

    const items = dto.items.map((item) => {
      const gross = item.quantity * item.unitPrice - item.discount;
      const tax = Math.round((gross * item.taxRate) / 100);
      return { ...item, total: gross + tax, tax };
    });

    const subtotal = items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);
    const discountTotal = items.reduce((sum, i) => sum + i.discount, 0);
    const taxTotal = items.reduce((sum, i) => sum + i.tax, 0);
    let total = subtotal - discountTotal + taxTotal;

    // FIN-08 — apply a promo/discount code if provided.
    const promo = dto.discountCode
      ? await this.resolveDiscount(tenantId, dto.discountCode, total)
      : null;
    if (promo) total = Math.max(0, total - promo.amount);

    return this.prisma.client.$transaction(async (tx) => {
      const count = await tx.invoice.count({ where: { tenantId } });
      const number = `${tenant.invoicePrefix}-${String(count + 1).padStart(5, '0')}`;

      const invoice = await tx.invoice.create({
        data: {
          tenantId,
          branchId: dto.branchId ?? null,
          customerId: dto.customerId,
          number,
          status: dto.isProforma ? 'DRAFT' : 'ISSUED',
          dueDate: dto.dueDate ?? null,
          notes: dto.notes ?? null,
          subtotal,
          discountTotal: discountTotal + (promo?.amount ?? 0),
          taxTotal,
          total,
          currency: tenant.currency,
          meta: {
            isProforma: dto.isProforma,
            discountCode: promo?.code ?? null,
            discountAmount: promo?.amount ?? 0,
          },
          items: {
            create: items.map((item) => ({
              description: item.description,
              serviceId: item.serviceId ?? null,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              discount: item.discount,
              taxRate: item.taxRate,
              total: item.total,
            })),
          },
        },
        include: { items: true },
      });

      if (promo) {
        await tx.discountCode.update({
          where: { id: promo.id },
          data: { usedCount: { increment: 1 } },
        });
        await tx.discountRedemption.create({
          data: {
            tenantId,
            discountCodeId: promo.id,
            invoiceId: invoice.id,
            customerId: dto.customerId,
            amount: promo.amount,
          },
        });
      }

      return invoice;
    });
  }

  /** Validates a discount code and returns the computed discount amount. */
  async resolveDiscount(tenantId: string, code: string, base: number) {
    const discount = await this.prisma.client.discountCode.findUnique({
      where: { tenantId_code: { tenantId, code: code.toUpperCase() } },
    });
    if (!discount || !discount.isActive) throw DomainException.badRequest('کد تخفیف نامعتبر است');

    const now = new Date();
    if (discount.startsAt && discount.startsAt > now) {
      throw DomainException.badRequest('کد تخفیف هنوز فعال نشده است');
    }
    if (discount.expiresAt && discount.expiresAt < now) {
      throw DomainException.badRequest('کد تخفیف منقضی شده است');
    }
    if (discount.maxUses != null && discount.usedCount >= discount.maxUses) {
      throw DomainException.badRequest('ظرفیت استفاده از کد تخفیف تکمیل شده است');
    }

    const amount = discount.percent
      ? Math.round((base * Number(discount.percent)) / 100)
      : Number(discount.amount ?? 0);
    return { id: discount.id, code: discount.code, amount: Math.min(amount, base) };
  }

  /** FIN-02 — converts a pre-invoice (proforma) into a real invoice. */
  async convertProforma(tenantId: string, id: string, dueDate?: Date) {
    const invoice = await this.findOne(tenantId, id);
    const meta = (invoice.meta ?? {}) as Record<string, unknown>;
    if (!meta.isProforma) throw DomainException.badRequest('این سند پیش‌فاکتور نیست');
    if (invoice.status !== 'DRAFT') throw DomainException.conflict('پیش‌فاکتور قبلاً نهایی شده است');

    return this.prisma.client.invoice.update({
      where: { id },
      data: {
        status: 'ISSUED',
        dueDate: dueDate ?? invoice.dueDate,
        meta: { ...meta, isProforma: false, convertedAt: new Date().toISOString() },
      },
      include: { items: true },
    });
  }

  async list(tenantId: string, dto: ListInvoicesDto) {
    const where = {
      tenantId,
      deletedAt: null,
      ...(dto.status ? { status: dto.status } : {}),
      ...(dto.customerId ? { customerId: dto.customerId } : {}),
    };
    const [data, total] = await this.prisma.client.$transaction([
      this.prisma.client.invoice.findMany({
        where,
        ...toSkipTake(dto),
        orderBy: { createdAt: 'desc' },
        include: {
          customer: { select: { id: true, fullName: true, phone: true } },
          _count: { select: { items: true } },
        },
      }),
      this.prisma.client.invoice.count({ where }),
    ]);
    return { data, meta: buildMeta(total, dto) };
  }

  async findOne(tenantId: string, id: string) {
    const invoice = await this.prisma.client.invoice.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: {
        items: true,
        payments: { orderBy: { createdAt: 'desc' } },
        customer: true,
      },
    });
    if (!invoice) throw DomainException.notFound('فاکتور');
    return invoice;
  }

  async cancel(tenantId: string, id: string) {
    const invoice = await this.findOne(tenantId, id);
    if (invoice.status === 'PAID') {
      throw DomainException.badRequest('فاکتور پرداخت‌شده قابل لغو نیست');
    }
    await this.prisma.client.invoice.update({
      where: { id },
      data: { status: 'CANCELED' },
    });
    return { message: 'فاکتور لغو شد' };
  }
}

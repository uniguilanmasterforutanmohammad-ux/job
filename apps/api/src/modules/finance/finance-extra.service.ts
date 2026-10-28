import { randomBytes } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { DomainException } from '../../common/exceptions/domain.exception.js';
import { PrismaService } from '../../database/prisma.service.js';
import type {
  CreateDiscountDto,
  CreatePaymentLinkDto,
  CreateRefundDto,
  DebtorReportDto,
  ListRefundsDto,
  TaxReportDto,
  ValidateDiscountDto,
  WalletAdjustDto,
} from './dto/finance-extra.schemas.js';
import { InvoicesService } from './invoices.service.js';

@Injectable()
export class FinanceExtraService {
  private readonly logger = new Logger(FinanceExtraService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly invoices: InvoicesService,
  ) {}

  // ----- FIN-06 wallet / credit -----

  async walletAdjust(tenantId: string, dto: WalletAdjustDto) {
    const customer = await this.prisma.client.customer.findFirst({
      where: { id: dto.customerId, tenantId, deletedAt: null },
      select: { id: true },
    });
    if (!customer) throw DomainException.notFound('مشتری');

    return this.prisma.client.$transaction(async (tx) => {
      const wallet = await tx.wallet.upsert({
        where: { customerId: dto.customerId },
        update: {},
        create: { tenantId, customerId: dto.customerId, balance: 0 },
      });

      const delta = dto.type === 'DEBIT' ? -dto.amount : dto.amount;
      const balanceAfter = Number(wallet.balance) + delta;
      if (balanceAfter < 0) throw DomainException.badRequest('موجودی کیف پول کافی نیست');

      await tx.wallet.update({
        where: { id: wallet.id },
        data: { balance: balanceAfter },
      });
      return tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type: dto.type,
          amount: dto.amount,
          balanceAfter,
          reason: dto.reason ?? null,
        },
      });
    });
  }

  async walletHistory(tenantId: string, customerId: string) {
    const wallet = await this.prisma.client.wallet.findFirst({
      where: { customerId, tenantId },
      include: {
        transactions: { orderBy: { createdAt: 'desc' }, take: 100 },
      },
    });
    if (!wallet) return { balance: 0, transactions: [] };
    return { balance: Number(wallet.balance), transactions: wallet.transactions };
  }

  // ----- FIN-07 refunds -----

  async createRefund(tenantId: string, memberId: string, dto: CreateRefundDto) {
    if (dto.invoiceId) {
      const invoice = await this.prisma.client.invoice.findFirst({
        where: { id: dto.invoiceId, tenantId },
      });
      if (!invoice) throw DomainException.notFound('فاکتور');
      if (Number(invoice.paidTotal) < dto.amount) {
        throw DomainException.badRequest('مبلغ استرداد بیشتر از مبلغ پرداخت‌شده است');
      }
    }
    return this.prisma.client.refund.create({
      data: {
        tenantId,
        invoiceId: dto.invoiceId ?? null,
        paymentId: dto.paymentId ?? null,
        customerId: dto.customerId ?? null,
        amount: dto.amount,
        reason: dto.reason,
        toWallet: dto.toWallet,
        requestedBy: memberId,
      },
    });
  }

  listRefunds(tenantId: string, dto: ListRefundsDto) {
    return this.prisma.client.refund.findMany({
      where: { tenantId, ...(dto.status ? { status: dto.status } : {}) },
      orderBy: { createdAt: 'desc' },
      include: { invoice: { select: { id: true, number: true } } },
    });
  }

  /** Manager approval + settlement. Optionally credits the customer wallet. */
  async approveRefund(tenantId: string, id: string, approverId: string) {
    const refund = await this.prisma.client.refund.findFirst({ where: { id, tenantId } });
    if (!refund) throw DomainException.notFound('درخواست استرداد');
    if (refund.status !== 'REQUESTED') throw DomainException.conflict('این درخواست قبلاً بررسی شده است');

    return this.prisma.client.$transaction(async (tx) => {
      if (refund.toWallet && refund.customerId) {
        const wallet = await tx.wallet.upsert({
          where: { customerId: refund.customerId },
          update: {},
          create: { tenantId, customerId: refund.customerId, balance: 0 },
        });
        const balanceAfter = Number(wallet.balance) + Number(refund.amount);
        await tx.wallet.update({ where: { id: wallet.id }, data: { balance: balanceAfter } });
        await tx.walletTransaction.create({
          data: {
            walletId: wallet.id,
            type: 'REFUND',
            amount: refund.amount,
            balanceAfter,
            reason: `استرداد ${refund.id}`,
          },
        });
      }

      if (refund.invoiceId) {
        await tx.invoice.update({
          where: { id: refund.invoiceId },
          data: { status: 'REFUNDED' },
        });
      }

      return tx.refund.update({
        where: { id },
        data: {
          status: 'COMPLETED',
          approvedBy: approverId,
          approvedAt: new Date(),
          completedAt: new Date(),
        },
      });
    });
  }

  async rejectRefund(tenantId: string, id: string, approverId: string, reason?: string) {
    const refund = await this.prisma.client.refund.findFirst({ where: { id, tenantId } });
    if (!refund) throw DomainException.notFound('درخواست استرداد');
    return this.prisma.client.refund.update({
      where: { id },
      data: {
        status: 'REJECTED',
        approvedBy: approverId,
        approvedAt: new Date(),
        reason: reason ?? refund.reason,
      },
    });
  }

  // ----- FIN-08 discount codes -----

  createDiscount(tenantId: string, dto: CreateDiscountDto) {
    return this.prisma.client.discountCode.create({
      data: {
        tenantId,
        code: dto.code,
        percent: dto.percent ?? null,
        amount: dto.amount ?? null,
        maxUses: dto.maxUses ?? null,
        startsAt: dto.startsAt ?? null,
        expiresAt: dto.expiresAt ?? null,
        isActive: dto.isActive,
      },
    });
  }

  listDiscounts(tenantId: string) {
    return this.prisma.client.discountCode.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async deactivateDiscount(tenantId: string, id: string) {
    const discount = await this.prisma.client.discountCode.findFirst({ where: { id, tenantId } });
    if (!discount) throw DomainException.notFound('کد تخفیف');
    return this.prisma.client.discountCode.update({ where: { id }, data: { isActive: false } });
  }

  /** Public validation used by the checkout/cart flow before issuing an invoice. */
  async validateDiscount(tenantId: string, dto: ValidateDiscountDto) {
    const resolved = await this.invoices.resolveDiscount(tenantId, dto.code, dto.amount ?? 0);
    return { valid: true, code: resolved.code, amount: resolved.amount };
  }

  // ----- FIN-13 payment links -----

  async createPaymentLink(tenantId: string, dto: CreatePaymentLinkDto) {
    const token = randomBytes(18).toString('base64url');
    const link = await this.prisma.client.paymentLink.create({
      data: {
        tenantId,
        invoiceId: dto.invoiceId ?? null,
        customerId: dto.customerId ?? null,
        token,
        amount: dto.amount,
        title: dto.title ?? null,
        expiresAt: dto.expiresAt ?? null,
      },
    });
    const base = process.env.APP_URL ?? 'http://localhost:3000';
    return {
      ...link,
      url: `${base}/pay/${token}`,
      qrData: `${base}/pay/${token}`,
    };
  }

  listPaymentLinks(tenantId: string) {
    return this.prisma.client.paymentLink.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** SMS-link endpoint (FIN-13) — queues the payment link to the customer. */
  async sendPaymentLink(tenantId: string, id: string) {
    const link = await this.prisma.client.paymentLink.findFirst({ where: { id, tenantId } });
    if (!link) throw DomainException.notFound('لینک پرداخت');
    if (link.status !== 'ACTIVE') throw DomainException.conflict('این لینک فعال نیست');

    const customer = link.customerId
      ? await this.prisma.client.customer.findFirst({ where: { id: link.customerId, tenantId } })
      : null;
    if (!customer?.phone) throw DomainException.badRequest('شماره موبایل مشتری ثبت نشده است');

    const base = process.env.APP_URL ?? 'http://localhost:3000';
    const url = `${base}/pay/${link.token}`;
    const message = await this.prisma.client.message.create({
      data: {
        tenantId,
        customerId: customer.id,
        channel: 'SMS',
        body: `لینک پرداخت${link.title ? ` ${link.title}` : ''}: ${url}`,
        toAddress: customer.phone,
        status: 'QUEUED',
        provider: process.env.SMS_PROVIDER ?? 'console',
        meta: { paymentLinkId: link.id },
      },
    });
    return { messageId: message.id, url };
  }

  /** Public lookup for the payment page (no auth). */
  async getPaymentLinkByToken(token: string) {
    const link = await this.prisma.client.paymentLink.findUnique({ where: { token } });
    if (!link) throw DomainException.notFound('لینک پرداخت');
    if (link.status === 'ACTIVE' && link.expiresAt && link.expiresAt < new Date()) {
      await this.prisma.client.paymentLink.update({ where: { id: link.id }, data: { status: 'EXPIRED' } });
      throw DomainException.badRequest('لینک پرداخت منقضی شده است');
    }
    await this.prisma.client.paymentLink.update({
      where: { id: link.id },
      data: { visitedCount: { increment: 1 } },
    });
    const tenant = await this.prisma.client.tenant.findUnique({
      where: { id: link.tenantId },
      select: { name: true, logoUrl: true },
    });
    return {
      token: link.token,
      amount: Number(link.amount),
      title: link.title,
      status: link.status,
      tenantName: tenant?.name ?? null,
    };
  }

  async markPaymentLinkPaid(tenantId: string, id: string) {
    return this.prisma.client.paymentLink.update({
      where: { id },
      data: { status: 'PAID', paidAt: new Date() },
    });
  }

  // ----- FIN-05 debtor / overdue account report -----

  async debtorReport(tenantId: string, dto: DebtorReportDto) {
    const invoices = await this.prisma.client.invoice.findMany({
      where: {
        tenantId,
        deletedAt: null,
        status: { in: ['ISSUED', 'PARTIALLY_PAID', 'OVERDUE'] },
        ...(dto.overdueOnly ? { dueDate: { lt: new Date() } } : {}),
      },
      include: { customer: { select: { id: true, fullName: true, phone: true } } },
    });

    const byCustomer = new Map<
      string,
      { customerId: string; fullName: string; phone: string | null; debt: number; invoices: number }
    >();
    for (const inv of invoices) {
      const debt = Number(inv.total) - Number(inv.paidTotal);
      if (debt < dto.minAmount) continue;
      const entry = byCustomer.get(inv.customerId) ?? {
        customerId: inv.customerId,
        fullName: inv.customer.fullName,
        phone: inv.customer.phone,
        debt: 0,
        invoices: 0,
      };
      entry.debt += debt;
      entry.invoices += 1;
      byCustomer.set(inv.customerId, entry);
    }
    const data = [...byCustomer.values()].sort((a, b) => b.debt - a.debt);
    return { data, totalDebt: data.reduce((s, d) => s + d.debt, 0), count: data.length };
  }

  // ----- FIN-09 tax report -----

  async taxReport(tenantId: string, dto: TaxReportDto) {
    const range = {
      ...(dto.from ? { gte: dto.from } : {}),
      ...(dto.to ? { lte: dto.to } : {}),
    };
    const invoices = await this.prisma.client.invoice.findMany({
      where: {
        tenantId,
        deletedAt: null,
        status: { notIn: ['DRAFT', 'CANCELED'] },
        ...(dto.from || dto.to ? { issueDate: range } : {}),
      },
      select: { number: true, issueDate: true, subtotal: true, taxTotal: true, total: true },
      orderBy: { issueDate: 'asc' },
    });
    return {
      invoices,
      totalTax: invoices.reduce((s, i) => s + Number(i.taxTotal), 0),
      totalNet: invoices.reduce((s, i) => s + Number(i.subtotal), 0),
      totalGross: invoices.reduce((s, i) => s + Number(i.total), 0),
      count: invoices.length,
      // FIN-09 — electronic submission to the tax authority is a stub until
      // the real "سامانه مودیان" credentials are provisioned.
      eInvoice: { enabled: false, message: 'ارسال الکترونیکی فاکتور در آینده فعال می‌شود' },
    };
  }
}

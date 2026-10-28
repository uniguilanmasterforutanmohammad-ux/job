import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DomainException } from '../../common/exceptions/domain.exception.js';
import { PrismaService } from '../../database/prisma.service.js';
import type { AppConfig } from '../../config/configuration.js';
import { PaymentProviderRegistry } from './providers/provider.registry.js';
import type { CreatePaymentDto, ManualPaymentDto } from './dto/payment.schemas.js';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<AppConfig>,
    private readonly registry: PaymentProviderRegistry,
  ) {}

  private get provider() {
    const payment = this.config.get('payment', { infer: true })!;
    return payment.provider;
  }

  /** Starts an online payment: creates a PENDING row then a gateway session. */
  async createOnlinePayment(tenantId: string, dto: CreatePaymentDto) {
    if (dto.invoiceId) await this.assertInvoiceBelongsToTenant(tenantId, dto.invoiceId);

    const providerKey = dto.provider ?? this.provider;
    if (!this.registry.has(providerKey)) {
      throw DomainException.badRequest(`درگاه پرداخت «${providerKey}» پشتیبانی نمی‌شود`);
    }
    const gateway = this.registry.get(providerKey);

    const payment = await this.prisma.client.payment.create({
      data: {
        tenantId,
        invoiceId: dto.invoiceId ?? null,
        customerId: dto.customerId ?? null,
        amount: dto.amount,
        method: 'ONLINE_GATEWAY',
        status: 'PENDING',
        provider: providerKey,
      },
    });

    const callbackBase = this.config.get('payment', { infer: true })!.mockCallbackBase;
    const callbackUrl = `${callbackBase}?paymentId=${payment.id}`;

    const session = await gateway.createPayment({
      amount: dto.amount,
      description: dto.description,
      callbackUrl,
      orderId: payment.id,
    });

    await this.prisma.client.payment.update({
      where: { id: payment.id },
      data: { providerRef: session.providerRef },
    });

    return {
      paymentId: payment.id,
      redirectUrl: session.redirectUrl,
      provider: providerKey,
    };
  }

  /** Gateway return handler. Verifies with the provider and settles locally. */
  async verifyCallback(params: {
    paymentId: string;
    authority?: string;
    status?: string;
  }): Promise<{ success: boolean; paymentId: string; trackingCode?: string; message?: string }> {
    const payment = await this.prisma.client.payment.findUnique({
      where: { id: params.paymentId },
    });
    if (!payment) throw DomainException.notFound('پرداخت');
    if (payment.status === 'SUCCEEDED') {
      return { success: true, paymentId: payment.id, trackingCode: payment.trackingCode ?? undefined };
    }

    const gateway = this.registry.get(payment.provider ?? 'mock');

    if (params.status && !['OK', 'ok', 'SUCCESS', 'success'].includes(params.status)) {
      await this.prisma.client.payment.update({
        where: { id: payment.id },
        data: { status: 'FAILED', gatewayPayload: { callback: params } },
      });
      throw DomainException.badRequest('پرداخت توسط کاربر لغو یا ناموفق شد');
    }

    const verification = await gateway.verifyPayment({
      providerRef: params.authority ?? payment.providerRef ?? '',
      amount: Number(payment.amount),
    });

    if (!verification.success) {
      await this.prisma.client.payment.update({
        where: { id: payment.id },
        data: {
          status: 'FAILED',
          gatewayPayload: (verification.raw ?? {}) as never,
        },
      });
      throw DomainException.badRequest(verification.message ?? 'تأیید پرداخت ناموفق بود');
    }

    await this.settlePayment(payment.id, verification.trackingCode, verification.raw);

    return {
      success: true,
      paymentId: payment.id,
      trackingCode: verification.trackingCode,
    };
  }

  /** Manually recorded payments (cash/POS/card-to-card/cheque). */
  async recordManualPayment(tenantId: string, dto: ManualPaymentDto, memberId: string) {
    if (dto.invoiceId) await this.assertInvoiceBelongsToTenant(tenantId, dto.invoiceId);

    const payment = await this.prisma.client.payment.create({
      data: {
        tenantId,
        invoiceId: dto.invoiceId ?? null,
        customerId: dto.customerId ?? null,
        amount: dto.amount,
        method: dto.method,
        status: 'SUCCEEDED',
        paidAt: new Date(),
        gatewayPayload: { recordedBy: memberId, note: dto.note },
      },
    });

    if (dto.invoiceId) await this.recalculateInvoicePaid(dto.invoiceId);
    return payment;
  }

  async listForTenant(tenantId: string, limit = 50) {
    return this.prisma.client.payment.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        invoice: { select: { id: true, number: true } },
      },
    });
  }

  availableProviders(): string[] {
    return this.registry.keys();
  }

  private async settlePayment(
    paymentId: string,
    trackingCode: string | undefined,
    raw: unknown,
  ): Promise<void> {
    const payment = await this.prisma.client.payment.update({
      where: { id: paymentId },
      data: {
        status: 'SUCCEEDED',
        trackingCode: trackingCode ?? null,
        paidAt: new Date(),
        gatewayPayload: (raw ?? {}) as never,
      },
    });

    if (payment.invoiceId) await this.recalculateInvoicePaid(payment.invoiceId);
    this.logger.log(`Payment settled: ${paymentId} tracking=${trackingCode ?? '-'}`);
  }

  private async recalculateInvoicePaid(invoiceId: string): Promise<void> {
    const aggregate = await this.prisma.client.payment.aggregate({
      where: { invoiceId, status: 'SUCCEEDED' },
      _sum: { amount: true },
    });
    const paidTotal = Number(aggregate._sum.amount ?? 0);

    const invoice = await this.prisma.client.invoice.findUnique({ where: { id: invoiceId } });
    if (!invoice) return;

    const total = Number(invoice.total);
    const status = paidTotal <= 0 ? 'ISSUED' : paidTotal >= total ? 'PAID' : 'PARTIALLY_PAID';

    await this.prisma.client.invoice.update({
      where: { id: invoiceId },
      data: { paidTotal, status },
    });
  }

  private async assertInvoiceBelongsToTenant(tenantId: string, invoiceId: string): Promise<void> {
    const invoice = await this.prisma.client.invoice.findFirst({
      where: { id: invoiceId, tenantId },
      select: { id: true },
    });
    if (!invoice) throw DomainException.notFound('فاکتور');
  }
}

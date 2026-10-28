import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  CreatePaymentInput,
  CreatePaymentResult,
  PaymentProvider,
  VerifyPaymentInput,
  VerifyPaymentResult,
} from './payment-provider.interface.js';
import type { AppConfig } from '../../../config/configuration.js';

/**
 * Production gateway scaffold (Zarinpal-style REST). Disabled until the real
 * merchant credentials are provisioned; enabling it is a config change only.
 * The "بنل" gateway follows the same shape.
 */
@Injectable()
export class ZarinpalPaymentProvider implements PaymentProvider {
  readonly key = 'zarinpal';
  private readonly logger = new Logger(ZarinpalPaymentProvider.name);
  private readonly merchantId?: string;
  private readonly sandbox: boolean;

  constructor(private readonly config: ConfigService<AppConfig>) {
    this.merchantId = process.env.ZARINPAL_MERCHANT_ID;
    this.sandbox = process.env.ZARINPAL_SANDBOX === 'true';
  }

  private get baseUrl(): string {
    return this.sandbox
      ? 'https://sandbox.zarinpal.com/pg/v4/payment'
      : 'https://payment.zarinpal.com/pg/v4/payment';
  }

  private get redirectBase(): string {
    return this.sandbox
      ? 'https://sandbox.zarinpal.com/pg/StartPay'
      : 'https://payment.zarinpal.com/pg/StartPay';
  }

  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    if (!this.merchantId) {
      throw new Error('ZARINPAL_MERCHANT_ID is not configured');
    }

    const response = await fetch(`${this.baseUrl}/request.json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        merchant_id: this.merchantId,
        amount: input.amount,
        description: input.description,
        callback_url: input.callbackUrl,
        metadata: input.metadata ?? {},
      }),
    });

    const payload = (await response.json()) as {
      data?: { authority?: string; code?: number };
      errors?: unknown;
    };
    const authority = payload.data?.authority;
    if (!authority) {
      this.logger.error(`Zarinpal request failed: ${JSON.stringify(payload.errors)}`);
      throw new Error('ایجاد پرداخت در درگاه ناموفق بود');
    }

    return {
      providerRef: authority,
      redirectUrl: `${this.redirectBase}/${authority}`,
    };
  }

  async verifyPayment(input: VerifyPaymentInput): Promise<VerifyPaymentResult> {
    if (!this.merchantId) throw new Error('ZARINPAL_MERCHANT_ID is not configured');

    const response = await fetch(`${this.baseUrl}/verify.json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        merchant_id: this.merchantId,
        amount: input.amount,
        authority: input.providerRef,
      }),
    });

    const payload = (await response.json()) as {
      data?: { code?: number; ref_id?: number };
      errors?: unknown;
    };
    const code = payload.data?.code;
    const ok = code === 100 || code === 101;

    return {
      success: ok,
      trackingCode: payload.data?.ref_id ? String(payload.data.ref_id) : undefined,
      raw: payload as unknown as Record<string, unknown>,
      message: ok ? undefined : 'تأیید پرداخت ناموفق بود',
    };
  }
}

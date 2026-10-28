import { Injectable } from '@nestjs/common';
import type {
  CreatePaymentInput,
  CreatePaymentResult,
  PaymentProvider,
  VerifyPaymentInput,
  VerifyPaymentResult,
} from './payment-provider.interface.js';

/**
 * Developer / sandbox gateway. Generates a deterministic local ref and a
 * redirect URL that immediately returns to the callback with a success flag,
 * so the full checkout → verify → settle flow can be tested end-to-end.
 */
@Injectable()
export class MockPaymentProvider implements PaymentProvider {
  readonly key = 'mock';

  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    const providerRef = `MOCK-${input.orderId}-${Date.now()}`;
    const url = new URL(input.callbackUrl);
    url.searchParams.set('authority', providerRef);
    url.searchParams.set('status', 'OK');
    return { providerRef, redirectUrl: url.toString() };
  }

  async verifyPayment(input: VerifyPaymentInput): Promise<VerifyPaymentResult> {
    if (!input.providerRef.startsWith('MOCK-')) {
      return { success: false, message: 'مرجع پرداخت نامعتبر است' };
    }
    return {
      success: true,
      trackingCode: `MOCKREF${Date.now()}`,
      raw: { simulated: true, providerRef: input.providerRef },
    };
  }
}

/**
 * Payment gateway abstraction (PRD FIN-13).
 *
 * Two modes are supported out of the box:
 *   - "mock"    : developer/simulator mode — lets the whole flow be exercised
 *                 locally without a real gateway.
 *   - real      : the production Iranian gateway (e.g. Zarinpal / IDPay / بنل),
 *                 dropped in by implementing this same interface.
 *
 * Adding "بنل" later = add a provider class + register it. No changes to
 * the payment service, controllers or the web client.
 */
export type CreatePaymentInput = {
  amount: number; // IRR
  description: string;
  callbackUrl: string;
  orderId: string; // internal payment id
  metadata?: Record<string, unknown>;
};

export type CreatePaymentResult = {
  providerRef: string; // authority / token
  redirectUrl: string; // where to send the user
};

export type VerifyPaymentInput = {
  providerRef: string;
  amount: number;
};

export type VerifyPaymentResult = {
  success: boolean;
  trackingCode?: string; // refId
  raw?: Record<string, unknown>;
  message?: string;
};

export interface PaymentProvider {
  readonly key: string;
  createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult>;
  verifyPayment(input: VerifyPaymentInput): Promise<VerifyPaymentResult>;
}

export const PAYMENT_PROVIDER = Symbol('PAYMENT_PROVIDER');
export const PAYMENT_PROVIDER_REGISTRY = Symbol('PAYMENT_PROVIDER_REGISTRY');

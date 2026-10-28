import { describe, expect, it } from 'vitest';
import { MockPaymentProvider } from './mock.provider.js';

const input = {
  amount: 500_000,
  description: 'تست پرداخت',
  callbackUrl: 'https://app.local/pay/callback',
  orderId: 'pay-123',
};

describe('MockPaymentProvider', () => {
  const provider = new MockPaymentProvider();

  it('creates a deterministic MOCK- ref and a success redirect', async () => {
    const result = await provider.createPayment(input);
    expect(result.providerRef.startsWith('MOCK-pay-123-')).toBe(true);
    const url = new URL(result.redirectUrl);
    expect(url.searchParams.get('authority')).toBe(result.providerRef);
    expect(url.searchParams.get('status')).toBe('OK');
    expect(url.origin).toBe('https://app.local');
  });

  it('verifies a MOCK- ref as successful', async () => {
    const result = await provider.verifyPayment({ providerRef: 'MOCK-pay-123-1', amount: 500_000 });
    expect(result.success).toBe(true);
    expect(result.trackingCode?.startsWith('MOCKREF')).toBe(true);
    expect(result.raw).toMatchObject({ simulated: true });
  });

  it('rejects a non-MOCK ref during verify', async () => {
    const result = await provider.verifyPayment({ providerRef: 'REAL-abc', amount: 1 });
    expect(result.success).toBe(false);
  });
});

import { Injectable } from '@nestjs/common';
import type { PaymentProvider } from './payment-provider.interface.js';
import { MockPaymentProvider } from './mock.provider.js';
import { ZarinpalPaymentProvider } from './zarinpal.provider.js';

/**
 * Central registry so the rest of the app never imports concrete gateways.
 * Registering "بنل" later = one line here.
 */
@Injectable()
export class PaymentProviderRegistry {
  private readonly providers: Map<string, PaymentProvider>;

  constructor(mock: MockPaymentProvider, zarinpal: ZarinpalPaymentProvider) {
    this.providers = new Map<string, PaymentProvider>([
      [mock.key, mock],
      [zarinpal.key, zarinpal],
    ]);
  }

  get(key: string): PaymentProvider {
    const provider = this.providers.get(key);
    if (!provider) throw new Error(`Payment provider "${key}" is not registered`);
    return provider;
  }

  has(key: string): boolean {
    return this.providers.has(key);
  }

  keys(): string[] {
    return [...this.providers.keys()];
  }
}

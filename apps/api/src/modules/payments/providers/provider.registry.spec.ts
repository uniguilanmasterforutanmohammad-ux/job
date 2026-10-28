import { describe, expect, it, vi } from 'vitest';
import { PaymentProviderRegistry } from './provider.registry.js';
import type { PaymentProvider } from './payment-provider.interface.js';

function provider(key: string): PaymentProvider {
  return {
    key,
    createPayment: vi.fn(),
    verifyPayment: vi.fn(),
  } as unknown as PaymentProvider;
}

describe('PaymentProviderRegistry', () => {
  it('resolves registered providers by key', () => {
    const mock = provider('mock');
    const zarinpal = provider('zarinpal');
    const registry = new PaymentProviderRegistry(mock as never, zarinpal as never);

    expect(registry.get('mock')).toBe(mock);
    expect(registry.get('zarinpal')).toBe(zarinpal);
  });

  it('reports membership and lists keys', () => {
    const registry = new PaymentProviderRegistry(
      provider('mock') as never,
      provider('zarinpal') as never,
    );
    expect(registry.has('mock')).toBe(true);
    expect(registry.has('missing')).toBe(false);
    expect(registry.keys().sort()).toEqual(['mock', 'zarinpal']);
  });

  it('throws for an unregistered provider key', () => {
    const registry = new PaymentProviderRegistry(
      provider('mock') as never,
      provider('zarinpal') as never,
    );
    expect(() => registry.get('بنل')).toThrow(/not registered/);
  });
});

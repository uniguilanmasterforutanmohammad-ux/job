/**
 * Live HTTP smoke tests. These exercise the running API (auth envelope, module
 * gating and the platform-admin 360 surface) end to end.
 *
 * They are skipped automatically when the API is not reachable, so `pnpm test`
 * stays green in CI without a database, while a developer running the stack
 * (`docker compose up` + `pnpm dev`) gets real coverage.
 */
import { describe, expect, it } from 'vitest';

const API = process.env.SMOKE_API_URL ?? 'http://localhost:4000';
const BASE = `${API}/api/v1`;

const TENANT_PHONE = '09121111111';
const OTP_BYPASS = '123456';
const ADMIN_PHONE = '09120000001';
const ADMIN_PASSWORD = 'Admin@12345';

async function detectApi(): Promise<boolean> {
  try {
    const res = await fetch(`${BASE}/health`, { signal: AbortSignal.timeout(1500) });
    return res.ok;
  } catch {
    return false;
  }
}

// Probe once at collection time so `skipIf` can hide the suite when offline.
const apiUp = await detectApi();
if (!apiUp) {
  // eslint-disable-next-line no-console
  console.info('[smoke] API not reachable — live smoke tests skipped.');
}

async function json<T>(path: string, init?: RequestInit): Promise<{ status: number; body: T }> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
  const body = (await res.json().catch(() => null)) as T;
  return { status: res.status, body };
}

describe.skipIf(!apiUp)('live API smoke', () => {
  it('health endpoint is up', async () => {
    const { status } = await json('/health');
    expect(status).toBe(200);
  });

  it('tenant OTP login returns the access/refresh envelope', async () => {
    const requested = await json<{ details?: { code?: string } }>('/auth/otp/request', {
      method: 'POST',
      body: JSON.stringify({ phone: TENANT_PHONE }),
    });
    // Repeated local runs can exhaust the OTP rate window; don't fail on that.
    if (requested.status === 429) return;

    const { status, body } = await json<{
      data: { tokens: { accessToken: string; refreshToken: string } };
    }>('/auth/otp/verify', {
      method: 'POST',
      body: JSON.stringify({ phone: TENANT_PHONE, code: OTP_BYPASS }),
    });
    if (status === 429) return;
    expect(status).toBe(201);
    expect(body.data.tokens.accessToken.split('.')).toHaveLength(3);
  });

  it('rejects a tenant route without a token', async () => {
    const { status } = await json('/customers');
    expect(status).toBe(401);
  });
});

describe.skipIf(!apiUp)('live platform admin smoke', () => {
  it('password login returns an operator profile', async () => {
    const { status, body } = await json<{
      data: { operator: { role: string } | null; twoFactorRequired?: boolean };
    }>('/admin/auth/login', {
      method: 'POST',
      body: JSON.stringify({ phone: ADMIN_PHONE, password: ADMIN_PASSWORD }),
    });
    expect([200, 201]).toContain(status);
    // In dev 2FA is optional, so we expect a full session.
    if (!body.data.twoFactorRequired) {
      expect(body.data.operator?.role).toBe('SUPER_ADMIN');
    }
  });
});

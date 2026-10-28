import { describe, expect, it } from 'vitest';
import { generateSync } from 'otplib';
import { TotpService } from './totp.service.js';

describe('TotpService', () => {
  const service = new TotpService();

  it('issues a Base32 secret and a compatible otpauth URL', () => {
    const { secret, otpauthUrl } = service.beginEnrollment('09120000001', 'Business Platform');
    expect(secret).toMatch(/^[A-Z2-7]+$/);
    expect(otpauthUrl.startsWith('otpauth://totp/')).toBe(true);
    const url = new URL(otpauthUrl);
    expect(url.searchParams.get('secret')).toBe(secret);
    expect(url.searchParams.get('issuer')).toBe('Business Platform');
  });

  it('produces a distinct secret on each enrollment', () => {
    const a = service.beginEnrollment('x').secret;
    const b = service.beginEnrollment('x').secret;
    expect(a).not.toBe(b);
  });

  it('verifies the current token and returns the accepted time step', () => {
    const { secret } = service.beginEnrollment('x');
    const token = generateSync({ secret });
    const result = service.verify(secret, token);
    expect(result.valid).toBe(true);
    expect(result.timeStep).toBeGreaterThan(0);
  });

  it('tolerates surrounding whitespace in the token', () => {
    const { secret } = service.beginEnrollment('x');
    const token = generateSync({ secret });
    expect(service.verify(secret, ` ${token} `).valid).toBe(true);
  });

  it('rejects malformed tokens without throwing', () => {
    const { secret } = service.beginEnrollment('x');
    expect(service.verify(secret, 'abc').valid).toBe(false);
    expect(service.verify(secret, '12345').valid).toBe(false);
  });

  it('rejects a token that was already consumed (replay protection)', () => {
    const { secret } = service.beginEnrollment('x');
    const token = generateSync({ secret });
    const first = service.verify(secret, token);
    expect(first.valid).toBe(true);

    const replayed = service.verify(secret, token, { afterTimeStep: first.timeStep });
    expect(replayed.valid).toBe(false);
  });

  it('currentToken matches generateSync for the secret', () => {
    const { secret } = service.beginEnrollment('x');
    expect(service.currentToken(secret)).toBe(generateSync({ secret }));
  });
});

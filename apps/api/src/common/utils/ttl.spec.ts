import { describe, expect, it } from 'vitest';
import { parseTtlToSeconds } from '../../modules/auth/token.service.js';

describe('parseTtlToSeconds', () => {
  it('parses minutes, hours, days and bare seconds', () => {
    expect(parseTtlToSeconds('15m')).toBe(900);
    expect(parseTtlToSeconds('2h')).toBe(7200);
    expect(parseTtlToSeconds('30d')).toBe(2592000);
    expect(parseTtlToSeconds('45s')).toBe(45);
    expect(parseTtlToSeconds('60')).toBe(60);
  });

  it('falls back to 900 for invalid input', () => {
    expect(parseTtlToSeconds('nonsense')).toBe(900);
  });
});

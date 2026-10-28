import { describe, expect, it } from 'vitest';
import { PERMISSIONS, SYSTEM_ROLE_LABELS, SYSTEM_ROLES, hasPermission } from './permissions.js';

describe('hasPermission', () => {
  it('grants everything to the wildcard permission', () => {
    expect(hasPermission([PERMISSIONS.ALL], PERMISSIONS.FIN_WRITE)).toBe(true);
  });

  it('grants an explicitly held permission', () => {
    expect(hasPermission([PERMISSIONS.CRM_READ], PERMISSIONS.CRM_READ)).toBe(true);
  });

  it('denies a permission that is not held', () => {
    expect(hasPermission([PERMISSIONS.CRM_READ], PERMISSIONS.FIN_WRITE)).toBe(false);
  });

  it('denies when nothing is granted', () => {
    expect(hasPermission([], PERMISSIONS.CRM_READ)).toBe(false);
  });
});

describe('system roles', () => {
  it('exposes a Persian label for every role', () => {
    for (const role of SYSTEM_ROLES) {
      expect(SYSTEM_ROLE_LABELS[role]).toBeTruthy();
    }
  });
});

// TaskForMyAgent — نقش سیستمی «مدیر» باید مجوز حذف مشتری را داشته باشد (حذف کاربر در /customers)
import { describe, expect, it } from 'vitest';
import {
  PERMISSIONS,
  SYSTEM_ROLE_DEFAULT_PERMISSIONS,
  SYSTEM_ROLE_KEYS,
  SYSTEM_ROLE_LABELS,
  SYSTEM_ROLES,
  hasPermission,
} from './permissions.js';

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

  it('exposes a unique tenant role key for every system role', () => {
    const keys = SYSTEM_ROLES.map((role) => SYSTEM_ROLE_KEYS[role]);
    for (const key of keys) expect(key).toMatch(/^[a-z_]+$/);
    expect(new Set(keys).size).toBe(SYSTEM_ROLES.length);
  });

  it('gives every system role a default permission set', () => {
    for (const role of SYSTEM_ROLES) {
      expect(SYSTEM_ROLE_DEFAULT_PERMISSIONS[role].length).toBeGreaterThan(0);
    }
  });

  it('lets a manager delete a customer and keeps the coach out of it', () => {
    expect(
      hasPermission(SYSTEM_ROLE_DEFAULT_PERMISSIONS.MANAGER, PERMISSIONS.CRM_WRITE),
    ).toBe(true);
    expect(hasPermission(SYSTEM_ROLE_DEFAULT_PERMISSIONS.STAFF, PERMISSIONS.CRM_WRITE)).toBe(false);
    expect(
      hasPermission(SYSTEM_ROLE_DEFAULT_PERMISSIONS.RECEPTION, PERMISSIONS.CRM_WRITE),
    ).toBe(true);
  });
});

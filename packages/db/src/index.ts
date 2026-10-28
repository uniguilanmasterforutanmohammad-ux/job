export * from '../generated/client/client.js';
export { createPrismaClient, getPrismaClient } from './client.js';
export { ensureRootEnv } from './env.js';
export type { PrismaClient } from './client.js';

/**
 * Tenant-scoped extension helpers.
 *
 * Every business query MUST be scoped by tenantId to preserve multi-tenant
 * isolation. These helpers make the intent explicit at call sites and are the
 * single place to evolve toward Postgres RLS later.
 */
export const TENANT_SCOPED_MODELS = [
  'Branch',
  'Member',
  'Role',
  'TenantModule',
  'Customer',
  'Service',
  'Appointment',
  'Invoice',
  'Payment',
  'Wallet',
  'DiscountCode',
  'Attendance',
  'Message',
  'Campaign',
  'Document',
  'AuditLog',
] as const;

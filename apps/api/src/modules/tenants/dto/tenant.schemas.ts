import { z } from 'zod';
import { MODULE_KEYS } from '@repo/shared';

export const updateTenantSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  legalName: z.string().trim().max(160).optional(),
  nationalId: z.string().trim().max(20).optional(),
  economicCode: z.string().trim().max(20).optional(),
  phone: z.string().trim().max(20).optional(),
  email: z.string().email().optional(),
  address: z.string().trim().max(500).optional(),
  logoUrl: z.string().url().optional(),
  timezone: z.string().trim().max(60).optional(),
  currency: z.string().trim().length(3).optional(),
  calendar: z.enum(['JALALI', 'GREGORIAN']).optional(),
  locale: z.string().trim().max(10).optional(),
  invoicePrefix: z.string().trim().max(10).optional(),
  taxRate: z.coerce.number().min(0).max(100).optional(),
  settings: z.record(z.string(), z.unknown()).optional(),
});
export type UpdateTenantDto = z.infer<typeof updateTenantSchema>;

export const moduleKeysSchema = z.object({
  modules: z.array(z.enum(MODULE_KEYS)).min(1),
});
export type ModuleKeysDto = z.infer<typeof moduleKeysSchema>;

export const createBranchSchema = z.object({
  name: z.string().trim().min(2).max(120),
  code: z.string().trim().max(20).optional(),
  city: z.string().trim().max(80).optional(),
  address: z.string().trim().max(500).optional(),
  phone: z.string().trim().max(20).optional(),
});
export type CreateBranchDto = z.infer<typeof createBranchSchema>;

/** Edits a branch (شعبه/آموزشگاه): rename, re-address or (de)activate it. */
export const updateBranchSchema = createBranchSchema.partial().extend({
  isActive: z.boolean().optional(),
});
export type UpdateBranchDto = z.infer<typeof updateBranchSchema>;

/** Route param validator for `/tenant/branches/:id`. */
export const branchIdParamSchema = z.string().uuid();
export type BranchIdParam = z.infer<typeof branchIdParamSchema>;

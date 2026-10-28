import { z } from 'zod';

const kindEnum = z.enum(['MONTHLY', 'QUARTERLY', 'YEARLY', 'SESSION_PACK', 'TIME_PACK', 'VIP']);

export const createPlanSchema = z.object({
  name: z.string().trim().min(2).max(120),
  kind: kindEnum.default('MONTHLY'),
  price: z.coerce.number().int().min(0).default(0),
  sessionsCount: z.coerce.number().int().min(1).max(1000).optional(),
  daysCount: z.coerce.number().int().min(1).max(3650).optional(),
  description: z.string().trim().max(1000).optional(),
  isActive: z.boolean().default(true),
});
export type CreatePlanDto = z.infer<typeof createPlanSchema>;

export const updatePlanSchema = createPlanSchema.partial();
export type UpdatePlanDto = z.infer<typeof updatePlanSchema>;

export const createSubscriptionSchema = z.object({
  customerId: z.string().uuid('شناسه مشتری نامعتبر است'),
  planId: z.string().uuid().optional(),
  planName: z.string().trim().min(2).max(120).optional(),
  kind: kindEnum.default('MONTHLY'),
  price: z.coerce.number().int().min(0).default(0),
  startsAt: z.coerce.date().optional(),
  endsAt: z.coerce.date().optional(),
  sessionsTotal: z.coerce.number().int().min(1).max(1000).optional(),
  autoRenew: z.boolean().default(false),
});
export type CreateSubscriptionDto = z.infer<typeof createSubscriptionSchema>;

export const listSubscriptionsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  customerId: z.string().uuid().optional(),
  status: z.enum(['ACTIVE', 'FROZEN', 'EXPIRED', 'CANCELED']).optional(),
});
export type ListSubscriptionsDto = z.infer<typeof listSubscriptionsSchema>;

export const freezeSubscriptionSchema = z.object({
  frozenUntil: z.coerce.date().optional(),
  reason: z.string().trim().max(300).optional(),
});
export type FreezeSubscriptionDto = z.infer<typeof freezeSubscriptionSchema>;

export const useSessionsSchema = z.object({
  count: z.coerce.number().int().min(1).max(100).default(1),
});
export type UseSessionsDto = z.infer<typeof useSessionsSchema>;

export const upgradeSubscriptionSchema = z.object({
  kind: kindEnum,
  planName: z.string().trim().min(2).max(120),
  price: z.coerce.number().int().min(0),
  sessionsTotal: z.coerce.number().int().min(1).max(1000).optional(),
  endsAt: z.coerce.date().optional(),
});
export type UpgradeSubscriptionDto = z.infer<typeof upgradeSubscriptionSchema>;

export const createSessionPackageSchema = z.object({
  customerId: z.string().uuid(),
  serviceId: z.string().uuid().optional(),
  title: z.string().trim().min(2).max(120),
  totalSessions: z.coerce.number().int().min(1).max(1000),
  expiresAt: z.coerce.date().optional(),
});
export type CreateSessionPackageDto = z.infer<typeof createSessionPackageSchema>;

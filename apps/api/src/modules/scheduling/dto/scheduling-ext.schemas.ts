import { z } from 'zod';

// ----- SCH-07 waitlist -----
export const createWaitlistSchema = z.object({
  customerId: z.string().uuid(),
  serviceId: z.string().uuid().optional(),
  preferredFrom: z.coerce.date().optional(),
  preferredTo: z.coerce.date().optional(),
  note: z.string().trim().max(500).optional(),
});
export type CreateWaitlistDto = z.infer<typeof createWaitlistSchema>;

export const updateWaitlistStatusSchema = z.object({
  status: z.enum(['WAITING', 'OFFERED', 'CONVERTED', 'CANCELED']),
});
export type UpdateWaitlistStatusDto = z.infer<typeof updateWaitlistStatusSchema>;

export const createRecurringSchema = z.object({
  customerId: z.string().uuid(),
  serviceId: z.string().uuid().optional(),
  staffId: z.string().uuid().optional(),
  frequency: z.enum(['WEEKLY', 'BIWEEKLY', 'MONTHLY']).default('WEEKLY'),
  weekday: z.coerce.number().int().min(0).max(6).optional(),
  timeOfDay: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'ساعت باید به شکل HH:mm باشد')
    .optional(),
  occurrences: z.coerce.number().int().min(1).max(52).default(4),
  startsFrom: z.coerce.date(),
  exceptions: z.array(z.coerce.date()).max(52).default([]),
});
export type CreateRecurringDto = z.infer<typeof createRecurringSchema>;

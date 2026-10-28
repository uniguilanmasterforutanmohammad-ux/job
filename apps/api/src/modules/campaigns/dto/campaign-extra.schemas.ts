import { z } from 'zod';

// CAMP-03 — share split among participants
export const setSplitsSchema = z.object({
  mode: z.enum(['EQUAL', 'PERCENT', 'FREE']).default('EQUAL'),
  participants: z
    .array(
      z.object({
        customerId: z.string().uuid().optional(),
        name: z.string().trim().max(120).optional(),
        share: z.coerce.number().min(0), // amount for FREE/EQUAL, percent for PERCENT
      }),
    )
    .min(1)
    .max(200),
});
export type SetSplitsDto = z.infer<typeof setSplitsSchema>;

// CAMP-04 — record a contribution paid online
export const contributeOnlineSchema = z.object({
  amount: z.coerce.number().int().positive(),
  isAnonymous: z.boolean().default(false),
  customerId: z.string().uuid().optional(),
  note: z.string().trim().max(500).optional(),
  provider: z.string().trim().min(2).max(40).optional(),
});
export type ContributeOnlineDto = z.infer<typeof contributeOnlineSchema>;

// CAMP-09 — send thank-you messages
export const thankYouSchema = z.object({
  message: z.string().trim().min(2).max(1000).optional(),
  channel: z.enum(['SMS', 'EMAIL', 'IN_APP']).default('SMS'),
});
export type ThankYouDto = z.infer<typeof thankYouSchema>;

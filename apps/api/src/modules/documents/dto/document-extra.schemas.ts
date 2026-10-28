import { z } from 'zod';

// DOC-05 consent forms
export const createConsentFormSchema = z.object({
  customerId: z.string().uuid().optional(),
  title: z.string().trim().min(2).max(160),
  body: z.string().trim().min(2).max(20000),
  expiresAt: z.coerce.date().optional(),
});
export type CreateConsentFormDto = z.infer<typeof createConsentFormSchema>;

export const signConsentFormSchema = z.object({
  signatureKey: z.string().trim().min(1).max(500),
});
export type SignConsentFormDto = z.infer<typeof signConsentFormSchema>;

export const listConsentFormsSchema = z.object({
  customerId: z.string().uuid().optional(),
  status: z.enum(['PENDING', 'SIGNED', 'REVOKED']).optional(),
});
export type ListConsentFormsDto = z.infer<typeof listConsentFormsSchema>;

// DOC-04 expiry reminder trigger
export const expiryReminderSchema = z.object({
  days: z.coerce.number().int().min(1).max(365).default(30),
});
export type ExpiryReminderDto = z.infer<typeof expiryReminderSchema>;

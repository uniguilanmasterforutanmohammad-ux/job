import { z } from 'zod';

// APP-01 — portal login (tenant slug + mobile + OTP)
export const appOtpRequestSchema = z.object({
  tenantSlug: z.string().trim().min(1).max(80),
  phone: z
    .string()
    .trim()
    .regex(/^09\d{9}$/, 'شماره موبایل نامعتبر است'),
});
export type AppOtpRequestDto = z.infer<typeof appOtpRequestSchema>;

export const appOtpVerifySchema = appOtpRequestSchema.extend({
  code: z.string().trim().min(4).max(8),
  fullName: z.string().trim().min(2).max(120).optional(),
});
export type AppOtpVerifyDto = z.infer<typeof appOtpVerifySchema>;

// APP-01 — global student login (no tenant slug): the phone is the cross-club
// identity, so a student sees every club they belong to in one dashboard.
export const appGlobalOtpRequestSchema = z.object({
  phone: z
    .string()
    .trim()
    .regex(/^09\d{9}$/, 'شماره موبایل نامعتبر است'),
});
export type AppGlobalOtpRequestDto = z.infer<typeof appGlobalOtpRequestSchema>;

export const appGlobalOtpVerifySchema = appGlobalOtpRequestSchema.extend({
  code: z.string().trim().min(4).max(8),
  fullName: z.string().trim().min(2).max(120).optional(),
});
export type AppGlobalOtpVerifyDto = z.infer<typeof appGlobalOtpVerifySchema>;

// APP-02 — booking
export const appBookSchema = z.object({
  serviceId: z.string().uuid().optional(),
  staffId: z.string().uuid().optional(),
  branchId: z.string().uuid().optional(),
  startsAt: z.coerce.date(),
  notes: z.string().trim().max(500).optional(),
});
export type AppBookDto = z.infer<typeof appBookSchema>;

export const appCancelSchema = z.object({
  reason: z.string().trim().max(300).optional(),
});
export type AppCancelDto = z.infer<typeof appCancelSchema>;

export const appAvailabilitySchema = z.object({
  serviceId: z.string().uuid().optional(),
  staffId: z.string().uuid().optional(),
  date: z.coerce.date(),
});
export type AppAvailabilityDto = z.infer<typeof appAvailabilitySchema>;

// APP-03 — pay an invoice
export const appPaySchema = z.object({
  invoiceId: z.string().uuid(),
  amount: z.coerce.number().int().positive().optional(),
  provider: z.string().trim().min(2).max(40).optional(),
});
export type AppPayDto = z.infer<typeof appPaySchema>;

// APP-07 — review after service
export const appReviewSchema = z.object({
  rating: z.coerce.number().int().min(1).max(5),
  comment: z.string().trim().max(1000).optional(),
  appointmentId: z.string().uuid().optional(),
});
export type AppReviewDto = z.infer<typeof appReviewSchema>;

// APP-05 — mark notifications read
export const appReadNotificationSchema = z.object({
  messageId: z.string().uuid(),
});
export type AppReadNotificationDto = z.infer<typeof appReadNotificationSchema>;

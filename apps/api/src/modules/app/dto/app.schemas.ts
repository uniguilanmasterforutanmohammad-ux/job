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

// APP-01 — public directory of selectable businesses (new-user signup).
// Only ACTIVE businesses are ever returned; suspended/archived ones must not be
// offered to a user who is registering.
export const appBusinessDirectorySchema = z.object({
  search: z.string().trim().max(80).optional(),
  industry: z.string().trim().max(40).optional(),
});
export type AppBusinessDirectoryDto = z.infer<typeof appBusinessDirectorySchema>;

// APP-01 — a mobile number can be a member of several businesses (e.g. a
// language school *and* a gym). The session is scoped to one club at a time, so
// the portal can re-issue the token for another club the phone already belongs
// to — no new OTP, nothing to re-enter.
export const appSwitchClubSchema = z.object({
  tenantId: z.string().trim().min(1).max(64),
});
export type AppSwitchClubDto = z.infer<typeof appSwitchClubSchema>;

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
  productId: z.string().uuid().optional(),
  serviceId: z.string().uuid().optional(),
  /** Purchase that proves the reviewer actually received the item. */
  orderId: z.string().uuid().optional(),
});
export type AppReviewDto = z.infer<typeof appReviewSchema>;

// APP-05 — mark notifications read
export const appReadNotificationSchema = z.object({
  messageId: z.string().uuid(),
});
export type AppReadNotificationDto = z.infer<typeof appReadNotificationSchema>;

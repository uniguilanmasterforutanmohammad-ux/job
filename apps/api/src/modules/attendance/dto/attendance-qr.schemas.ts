import { z } from 'zod';

/** Teacher/manager opens a rotating attendance QR session (ATT-01). */
export const openQrSessionSchema = z.object({
  branchId: z.string().uuid().optional(),
  serviceId: z.string().uuid().optional(),
  appointmentId: z.string().uuid().optional(),
  label: z.string().trim().max(120).optional(),
  rotateSeconds: z.coerce.number().int().min(15).max(300).default(45),
  radiusMeters: z.coerce.number().int().min(10).max(5000).default(150),
  requireOtp: z.boolean().default(true),
  ttlMinutes: z.coerce.number().int().min(1).max(480).default(120),
});
export type OpenQrSessionDto = z.infer<typeof openQrSessionSchema>;

export const listQrSessionsSchema = z.object({
  status: z.enum(['OPEN', 'CLOSED', 'EXPIRED']).optional(),
});
export type ListQrSessionsDto = z.infer<typeof listQrSessionsSchema>;

/** Student requests an OTP to confirm their identity before check-in. */
export const qrCheckInOtpRequestSchema = z.object({
  code: z.string().trim().min(4).max(24),
  phone: z
    .string()
    .trim()
    .regex(/^09\d{9}$/, 'شماره موبایل معتبر نیست'),
});
export type QrCheckInOtpRequestDto = z.infer<typeof qrCheckInOtpRequestSchema>;

/** Student confirms check-in after proving ownership of the phone via OTP. */
export const qrCheckInSchema = z
  .object({
    /** Rotating token embedded in the scanned QR (short-lived). */
    token: z.string().trim().min(6).max(200).optional(),
    /** Session code — used when the student opens a shared link (no scan). */
    code: z.string().trim().min(4).max(24).optional(),
    phone: z
      .string()
      .trim()
      .regex(/^09\d{9}$/, 'شماره موبایل معتبر نیست'),
    otp: z
      .string()
      .trim()
      .regex(/^\d{4,8}$/, 'کد تأیید معتبر نیست'),
    latitude: z.coerce.number().min(-90).max(90).optional(),
    longitude: z.coerce.number().min(-180).max(180).optional(),
    accuracyMeters: z.coerce.number().min(0).optional(),
  })
  .refine((data) => Boolean(data.token || data.code), {
    message: 'توکن QR یا کد جلسه لازم است',
    path: ['token'],
  });
export type QrCheckInDto = z.infer<typeof qrCheckInSchema>;

/**
 * Authenticated self check-in from the end-user panel (APP). The identity is
 * proven by the session JWT, so no OTP is required — the user just targets an
 * open attendance session of their active club.
 */
export const appCheckInSchema = z
  .object({
    sessionId: z.string().uuid().optional(),
    code: z.string().trim().min(4).max(24).optional(),
    latitude: z.coerce.number().min(-90).max(90).optional(),
    longitude: z.coerce.number().min(-180).max(180).optional(),
    accuracyMeters: z.coerce.number().min(0).optional(),
  })
  .refine((data) => Boolean(data.sessionId || data.code), {
    message: 'شناسه یا کد جلسه حاضری لازم است',
    path: ['sessionId'],
  });
export type AppCheckInDto = z.infer<typeof appCheckInSchema>;

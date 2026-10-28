import { z } from 'zod';

const iranianMobile = z
  .string()
  .trim()
  .regex(/^09\d{9}$/, 'شماره موبایل باید با ۰۹ شروع شود و ۱۱ رقم باشد');

export const requestOtpSchema = z.object({
  phone: iranianMobile,
  purpose: z.enum(['LOGIN', 'PHONE_VERIFY', 'PASSWORD_RESET', 'TWO_FACTOR']).default('LOGIN'),
  tenantSlug: z.string().trim().min(3).max(60).optional(),
});
export type RequestOtpDto = z.infer<typeof requestOtpSchema>;

export const verifyOtpSchema = z.object({
  phone: iranianMobile,
  code: z.string().trim().regex(/^\d{4,8}$/, 'کد یکبار مصرف نامعتبر است'),
  tenantSlug: z.string().trim().min(3).max(60).optional(),
  deviceName: z.string().trim().max(120).optional(),
});
export type VerifyOtpDto = z.infer<typeof verifyOtpSchema>;

export const passwordLoginSchema = z.object({
  phone: iranianMobile,
  password: z.string().min(8, 'رمز عبور باید حداقل ۸ کاراکتر باشد').max(128),
  tenantSlug: z.string().trim().min(3).max(60).optional(),
});
export type PasswordLoginDto = z.infer<typeof passwordLoginSchema>;

/**
 * Self-service password change for a signed-in member. End-users (شاگرد/
 * زبان‌آموز) start life without a password and log in with an OTP, so
 * `currentPassword` is only required once a password exists.
 */
export const changePasswordSchema = z
  .object({
    currentPassword: z.string().max(128).optional(),
    newPassword: z.string().min(8, 'رمز عبور باید حداقل ۸ کاراکتر باشد').max(128),
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    message: 'رمز عبور جدید باید با رمز فعلی متفاوت باشد',
    path: ['newPassword'],
  });
export type ChangePasswordDto = z.infer<typeof changePasswordSchema>;

export const registerTenantSchema = z.object({
  businessName: z.string().trim().min(2).max(120),
  industry: z.string().trim().min(2).max(40),
  ownerName: z.string().trim().min(2).max(120),
  phone: iranianMobile,
  email: z.string().email().optional(),
  password: z.string().min(8, 'رمز عبور باید حداقل ۸ کاراکتر باشد').max(128),
  otpCode: z.string().trim().regex(/^\d{4,8}$/),
});
export type RegisterTenantDto = z.infer<typeof registerTenantSchema>;

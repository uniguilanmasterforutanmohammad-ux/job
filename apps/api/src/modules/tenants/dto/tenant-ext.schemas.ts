import { z } from 'zod';

const eventKey = z.enum([
  'appointment_reminder',
  'payment_due',
  'payment_received',
  'birthday',
  'attendance_alert',
  'campaign_update',
  'marketing',
]);

const channelKey = z.enum(['IN_APP', 'PUSH', 'EMAIL', 'SMS', 'WHATSAPP']);

/** CORE-08 — per-event notification channel preferences. */
export const notificationPrefsSchema = z.object({
  events: z.record(eventKey, z.array(channelKey).max(5)),
});
export type NotificationPrefsDto = z.infer<typeof notificationPrefsSchema>;

/** CORE-01 — two-factor authentication. */
export const enableTwoFactorSchema = z.object({
  secret: z.string().trim().min(8).max(200).optional(),
});
export type EnableTwoFactorDto = z.infer<typeof enableTwoFactorSchema>;

export const disableTwoFactorSchema = z.object({
  code: z.string().trim().regex(/^\d{4,8}$/),
});
export type DisableTwoFactorDto = z.infer<typeof disableTwoFactorSchema>;

/** CORE-06 — backups. */
export const createBackupSchema = z.object({
  kind: z.enum(['manual', 'daily', 'point_in_time']).default('manual'),
  note: z.string().trim().max(300).optional(),
});
export type CreateBackupDto = z.infer<typeof createBackupSchema>;

/** CORE-03 — members & roles. */
export const createMemberSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  phone: z
    .string()
    .trim()
    .regex(/^09\d{9}$/, 'شماره موبایل نامعتبر است')
    .optional(),
  email: z.string().email().optional(),
  branchId: z.string().uuid().optional(),
  roleId: z.string().uuid().optional(),
  systemRole: z.enum(['OWNER', 'MANAGER', 'STAFF', 'ACCOUNTANT', 'RECEPTION', 'END_USER']).default('STAFF'),
});
export type CreateMemberDto = z.infer<typeof createMemberSchema>;

export const updateMemberSchema = createMemberSchema.partial().extend({
  isActive: z.boolean().optional(),
});
export type UpdateMemberDto = z.infer<typeof updateMemberSchema>;

export const createRoleSchema = z.object({
  key: z.string().trim().min(2).max(60).regex(/^[a-z0-9_]+$/),
  name: z.string().trim().min(2).max(120),
  permissions: z.array(z.string().trim().max(60)).min(1),
  branchScope: z.string().uuid().optional(),
});
export type CreateRoleDto = z.infer<typeof createRoleSchema>;

import { z } from 'zod';
import { MODULE_KEYS } from '@repo/shared';

/** Slug of an industry key: `SPORTS_COACHING` or a custom `custom_ab12cd`. */
const industryKey = z
  .string()
  .trim()
  .min(2)
  .max(40)
  .regex(/^[A-Za-z][A-Za-z0-9_]*$/, 'کلید صنف فقط حروف انگلیسی، رقم و _');

const iranianMobile = z
  .string()
  .trim()
  .regex(/^09\d{9}$/, 'شماره موبایل باید با ۰۹ شروع شود و ۱۱ رقم باشد');

// ----- auth -----
export const platformOtpRequestSchema = z.object({
  phone: iranianMobile,
});
export type PlatformOtpRequestDto = z.infer<typeof platformOtpRequestSchema>;

export const platformOtpVerifySchema = z.object({
  phone: iranianMobile,
  code: z.string().trim().regex(/^\d{4,8}$/, 'کد یکبار مصرف نامعتبر است'),
});
export type PlatformOtpVerifyDto = z.infer<typeof platformOtpVerifySchema>;

export const platformPasswordLoginSchema = z.object({
  phone: iranianMobile,
  password: z.string().min(8).max(128),
});
export type PlatformPasswordLoginDto = z.infer<typeof platformPasswordLoginSchema>;

// ----- two-factor (2FA) -----
export const platformTotpCodeSchema = z.object({
  code: z.string().trim().regex(/^\d{6,8}$/, 'کد ۲FA باید ۶ تا ۸ رقم باشد'),
});
export type PlatformTotpCodeDto = z.infer<typeof platformTotpCodeSchema>;

/** Completes a login that returned `twoFactorRequired: true`. */
export const platformTwoFactorVerifySchema = z.object({
  challengeToken: z.string().min(10),
  code: z.string().trim().regex(/^\d{6,8}$/, 'کد ۲FA باید ۶ تا ۸ رقم باشد'),
  trustDevice: z.boolean().default(false),
});
export type PlatformTwoFactorVerifyDto = z.infer<typeof platformTwoFactorVerifySchema>;

// ----- tenants -----
export const adminListTenantsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(120).optional(),
  status: z.enum(['ACTIVE', 'SUSPENDED', 'ARCHIVED']).optional(),
  industry: industryKey.optional(),
  sortDir: z.enum(['asc', 'desc']).default('desc'),
});
export type AdminListTenantsDto = z.infer<typeof adminListTenantsSchema>;

const optionalText = (max: number) => z.string().trim().max(max).optional();

const optionalPhone = z
  .string()
  .trim()
  .regex(/^0\d{9,10}$/, 'شماره تلفن نامعتبر است')
  .optional();

/**
 * Creating a business from the admin console. `modules` is optional: when it is
 * omitted the tenant starts from the industry's default module set.
 */
export const adminCreateTenantSchema = z.object({
  name: z.string().trim().min(2, 'نام کسب‌وکار باید حداقل ۲ کاراکتر باشد').max(120),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(40)
    .regex(/^[a-z0-9-]+$/, 'اسلاگ فقط حروف کوچک انگلیسی، رقم و خط تیره')
    .optional(),
  industry: industryKey.default('SPORTS_COACHING'),
  ownerFullName: z.string().trim().min(2, 'نام مالک باید حداقل ۲ کاراکتر باشد').max(120),
  ownerPhone: iranianMobile,
  ownerEmail: z.string().trim().email('ایمیل نامعتبر است').optional(),
  ownerPassword: z.string().min(8, 'رمز عبور باید حداقل ۸ کاراکتر باشد').max(128).optional(),
  phone: optionalPhone,
  email: z.string().trim().email('ایمیل نامعتبر است').optional(),
  modules: z.array(z.enum(MODULE_KEYS)).optional(),
  withDependencies: z.boolean().default(true),
  status: z.enum(['ACTIVE', 'SUSPENDED', 'ARCHIVED']).default('ACTIVE'),
});
export type AdminCreateTenantDto = z.infer<typeof adminCreateTenantSchema>;

export const adminUpdateTenantSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  legalName: optionalText(160),
  nationalId: optionalText(20),
  economicCode: optionalText(20),
  phone: optionalPhone,
  email: z.string().trim().email('ایمیل نامعتبر است').optional(),
  address: optionalText(400),
  logoUrl: optionalText(500),
  industry: industryKey.optional(),
  timezone: optionalText(60),
  currency: optionalText(8),
  calendar: z.enum(['JALALI', 'GREGORIAN']).optional(),
  locale: optionalText(10),
  invoicePrefix: z.string().trim().max(10).optional(),
  taxRate: z.coerce.number().min(0).max(100).optional(),
  status: z.enum(['ACTIVE', 'SUSPENDED', 'ARCHIVED']).optional(),
  settings: z.record(z.string(), z.unknown()).optional(),
});
export type AdminUpdateTenantDto = z.infer<typeof adminUpdateTenantSchema>;

export const adminTenantStatusSchema = z.object({
  status: z.enum(['ACTIVE', 'SUSPENDED', 'ARCHIVED']),
  reason: z.string().trim().max(400).optional(),
});
export type AdminTenantStatusDto = z.infer<typeof adminTenantStatusSchema>;

// ----- modules -----
/** Activates/deactivates self-service registration for one industry. */
export const adminIndustryRegistrationSchema = z.object({
  isRegistrationEnabled: z.boolean(),
  reason: z.string().trim().max(400).optional(),
});
export type AdminIndustryRegistrationDto = z.infer<typeof adminIndustryRegistrationSchema>;

/** Replaces the default module set of one industry. */
export const adminIndustryModulesSchema = z.object({
  keys: z.array(z.enum(MODULE_KEYS)),
});
export type AdminIndustryModulesDto = z.infer<typeof adminIndustryModulesSchema>;

/**
 * Creates a custom industry (شغل/حوزهٔ فعالیت جدید) with an arbitrary Persian
 * title and any subset of the existing modules as its defaults.
 */
export const adminIndustryCreateSchema = z.object({
  label: z.string().trim().min(2, 'عنوان صنف باید حداقل ۲ کاراکتر باشد').max(60),
  key: industryKey.optional(),
  description: z.string().trim().max(300).optional(),
  endUserNoun: z.string().trim().max(40).optional(),
  endUserNounPlural: z.string().trim().max(40).optional(),
  branchNoun: z.string().trim().max(40).optional(),
  branchNounPlural: z.string().trim().max(40).optional(),
  sortOrder: z.coerce.number().int().min(1).max(9999).optional(),
  isRegistrationEnabled: z.boolean().default(true),
  modules: z.array(z.enum(MODULE_KEYS)).optional(),
});
export type AdminIndustryCreateDto = z.infer<typeof adminIndustryCreateSchema>;

/** Edits the title/metadata of an industry (system or custom). */
export const adminIndustryUpdateSchema = adminIndustryCreateSchema
  .omit({ modules: true, key: true })
  .partial();
export type AdminIndustryUpdateDto = z.infer<typeof adminIndustryUpdateSchema>;

/** Route param validator for `/admin/industries/:industry`. */
export const adminIndustryParamSchema = industryKey;
export type AdminIndustryParam = z.infer<typeof adminIndustryParamSchema>;

export const adminModuleGrantSchema = z.object({
  keys: z.array(z.enum(MODULE_KEYS)).min(1, 'حداقل یک ماژول لازم است'),
  withDependencies: z.boolean().default(true),
});
export type AdminModuleGrantDto = z.infer<typeof adminModuleGrantSchema>;

export const adminModuleRevokeSchema = z.object({
  key: z.enum(MODULE_KEYS),
  cascade: z.boolean().default(false),
});
export type AdminModuleRevokeDto = z.infer<typeof adminModuleRevokeSchema>;

export const adminModuleToggleSchema = z.object({
  key: z.enum(MODULE_KEYS),
  isEnabled: z.boolean(),
});
export type AdminModuleToggleDto = z.infer<typeof adminModuleToggleSchema>;

// ----- members (business user panels) -----
export const adminListMembersSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(120).optional(),
  isActive: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
  systemRole: z
    .enum(['OWNER', 'MANAGER', 'STAFF', 'ACCOUNTANT', 'RECEPTION', 'END_USER'])
    .optional(),
});
export type AdminListMembersDto = z.infer<typeof adminListMembersSchema>;

export const adminUpdateMemberSchema = z.object({
  fullName: z.string().trim().min(2).max(120).optional(),
  email: z.string().trim().email('ایمیل نامعتبر است').optional(),
  phone: iranianMobile.optional(),
  systemRole: z
    .enum(['OWNER', 'MANAGER', 'STAFF', 'ACCOUNTANT', 'RECEPTION', 'END_USER'])
    .optional(),
  branchId: z.string().uuid().nullable().optional(),
  roleId: z.string().uuid().nullable().optional(),
  isActive: z.boolean().optional(),
  twoFactorEnabled: z.boolean().optional(),
});
export type AdminUpdateMemberDto = z.infer<typeof adminUpdateMemberSchema>;

export const adminResetPasswordSchema = z.object({
  password: z.string().min(8, 'رمز عبور باید حداقل ۸ کاراکتر باشد').max(128),
});
export type AdminResetPasswordDto = z.infer<typeof adminResetPasswordSchema>;

export const adminMemberStatusSchema = z.object({
  isActive: z.boolean(),
  reason: z.string().trim().max(400).optional(),
});
export type AdminMemberStatusDto = z.infer<typeof adminMemberStatusSchema>;

// ----- platform team -----
export const adminCreatePlatformMemberSchema = z.object({
  phone: iranianMobile,
  fullName: z.string().trim().min(2).max(120),
  email: z.string().trim().email('ایمیل نامعتبر است').optional(),
  role: z.enum(['SUPER_ADMIN', 'ADMIN', 'SUPPORT']).default('ADMIN'),
  password: z.string().min(8).max(128),
});
export type AdminCreatePlatformMemberDto = z.infer<typeof adminCreatePlatformMemberSchema>;

export const adminUpdatePlatformMemberSchema = z.object({
  fullName: z.string().trim().min(2).max(120).optional(),
  email: z.string().trim().email('ایمیل نامعتبر است').optional(),
  role: z.enum(['SUPER_ADMIN', 'ADMIN', 'SUPPORT']).optional(),
  status: z.enum(['ACTIVE', 'SUSPENDED']).optional(),
  twoFactorEnabled: z.boolean().optional(),
});
export type AdminUpdatePlatformMemberDto = z.infer<typeof adminUpdatePlatformMemberSchema>;

// ----- plans -----
export const adminUpsertPlanSchema = z.object({
  code: z
    .string()
    .trim()
    .min(2)
    .max(40)
    .regex(/^[a-z0-9-]+$/, 'کد پلن فقط حروف کوچک، رقم و خط تیره'),
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(400).optional(),
  price: z.coerce.number().min(0),
  currency: z.string().trim().max(8).default('IRR'),
  billingCycle: z.enum(['MONTHLY', 'QUARTERLY', 'YEARLY']).default('MONTHLY'),
  modules: z.array(z.enum(MODULE_KEYS)).default([]),
  limits: z.record(z.string(), z.unknown()).default({}),
  isActive: z.boolean().default(true),
});
export type AdminUpsertPlanDto = z.infer<typeof adminUpsertPlanSchema>;

export const adminAssignPlanSchema = z.object({
  planId: z.string().uuid().nullable(),
  status: z.enum(['TRIAL', 'ACTIVE', 'PAST_DUE', 'SUSPENDED', 'CANCELED']).optional(),
  seats: z.coerce.number().int().min(1).max(10000).optional(),
  currentPeriodEnd: z.coerce.date().optional(),
});
export type AdminAssignPlanDto = z.infer<typeof adminAssignPlanSchema>;

// ----- audit -----
export const adminAuditQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  tenantId: z.string().uuid().optional(),
  entity: z.string().trim().max(60).optional(),
  action: z.string().trim().max(120).optional(),
});
export type AdminAuditQueryDto = z.infer<typeof adminAuditQuerySchema>;

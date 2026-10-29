import { z } from 'zod';

/** Query flags arrive as strings from the URL; accept both shapes. */
const booleanFlag = z
  .union([z.boolean(), z.enum(['true', 'false', '1', '0'])])
  .transform((value) => value === true || value === 'true' || value === '1')
  .optional();

const price = z.coerce.number().min(0).optional();

export const marketplaceSortSchema = z.enum(['newest', 'price_asc', 'price_desc', 'name']);
export type MarketplaceSort = z.infer<typeof marketplaceSortSchema>;

export const marketplaceProductsQuerySchema = z.object({
  search: z.string().trim().max(120).optional(),
  industry: z.string().trim().max(60).optional(),
  tenantSlug: z.string().trim().max(80).optional(),
  category: z.string().trim().max(80).optional(),
  minPrice: price,
  maxPrice: price,
  inStock: booleanFlag,
  sort: marketplaceSortSchema.default('newest'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(48).default(12),
});
export type MarketplaceProductsQueryDto = z.infer<typeof marketplaceProductsQuerySchema>;

export const marketplaceServicesQuerySchema = z.object({
  search: z.string().trim().max(120).optional(),
  industry: z.string().trim().max(60).optional(),
  tenantSlug: z.string().trim().max(80).optional(),
  category: z.string().trim().max(80).optional(),
  minPrice: price,
  maxPrice: price,
  sort: marketplaceSortSchema.default('newest'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(48).default(12),
});
export type MarketplaceServicesQueryDto = z.infer<typeof marketplaceServicesQuerySchema>;

export const marketplaceBusinessesQuerySchema = z.object({
  search: z.string().trim().max(120).optional(),
  industry: z.string().trim().max(60).optional(),
  city: z.string().trim().max(80).optional(),
});
export type MarketplaceBusinessesQueryDto = z.infer<typeof marketplaceBusinessesQuerySchema>;

export const marketplaceIdParamSchema = z.string().uuid('شناسه معتبر نیست');

export const marketplaceSlugParamSchema = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .regex(/^[a-z0-9-]+$/, 'شناسهٔ کسب‌وکار معتبر نیست');

/** Guest checkout: the phone is verified with the same OTP used by the portal. */
export const marketplaceOtpRequestSchema = z.object({
  phone: z
    .string()
    .trim()
    .regex(/^09\d{9}$/, 'شماره موبایل نامعتبر است'),
});
export type MarketplaceOtpRequestDto = z.infer<typeof marketplaceOtpRequestSchema>;

export const marketplaceCheckoutSchema = z.object({
  tenantSlug: marketplaceSlugParamSchema,
  phone: z
    .string()
    .trim()
    .regex(/^09\d{9}$/, 'شماره موبایل نامعتبر است'),
  code: z.string().trim().regex(/^\d{4,8}$/, 'کد تأیید معتبر نیست'),
  fullName: z.string().trim().min(2).max(120).optional(),
  items: z
    .array(
      z.object({
        productId: z.string().uuid('شناسهٔ محصول نامعتبر است'),
        quantity: z.coerce.number().int().min(1).max(100),
      }),
    )
    .min(1, 'سبد خرید خالی است')
    .max(50),
  shippingMethod: z.string().trim().max(80).optional(),
  address: z.string().trim().max(500).optional(),
  note: z.string().trim().max(500).optional(),
  payOnline: z.boolean().default(true),
});
export type MarketplaceCheckoutDto = z.infer<typeof marketplaceCheckoutSchema>;

export const marketplaceTrackQuerySchema = z.object({
  number: z.string().trim().min(3).max(30),
  phone: z
    .string()
    .trim()
    .regex(/^09\d{9}$/, 'شماره موبایل نامعتبر است'),
});
export type MarketplaceTrackQueryDto = z.infer<typeof marketplaceTrackQuerySchema>;

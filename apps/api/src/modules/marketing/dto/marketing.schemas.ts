import { z } from 'zod';

// ----- MKT-01 loyalty club -----
export const earnPointsSchema = z.object({
  customerId: z.string().uuid(),
  points: z.coerce.number().int(),
  reason: z.string().trim().max(200).optional(),
});
export type EarnPointsDto = z.infer<typeof earnPointsSchema>;

export const redeemPointsSchema = z.object({
  customerId: z.string().uuid(),
  points: z.coerce.number().int().positive(),
  reason: z.string().trim().max(200).optional(),
});
export type RedeemPointsDto = z.infer<typeof redeemPointsSchema>;

// ----- MKT-03 gift cards -----
export const createGiftCardSchema = z.object({
  code: z.string().trim().min(4).max(40).optional(),
  balance: z.coerce.number().min(0).default(0),
  expiresAt: z.coerce.date().optional(),
});
export type CreateGiftCardDto = z.infer<typeof createGiftCardSchema>;

export const redeemGiftCardSchema = z.object({
  code: z.string().trim().min(4).max(40),
  amount: z.coerce.number().positive(),
});
export type RedeemGiftCardDto = z.infer<typeof redeemGiftCardSchema>;

// ----- MKT-02 referrals -----
export const createReferralSchema = z.object({
  referrerId: z.string().uuid(),
  refereePhone: z.string().trim().regex(/^09\d{9}$/, 'شماره موبایل نامعتبر است'),
  rewardAmount: z.coerce.number().min(0).default(0),
});
export type CreateReferralDto = z.infer<typeof createReferralSchema>;

export const convertReferralSchema = z.object({
  converted: z.boolean().default(true),
});
export type ConvertReferralDto = z.infer<typeof convertReferralSchema>;

// ----- MKT-05 surveys -----
export const createSurveySchema = z.object({
  title: z.string().trim().min(2).max(160),
  questions: z
    .array(
      z.object({
        id: z.string().trim().max(40),
        text: z.string().trim().max(300),
        type: z.enum(['rating', 'text', 'single', 'multi']).default('rating'),
        options: z.array(z.string().trim().max(120)).max(20).optional(),
      }),
    )
    .min(1)
    .max(50),
  isActive: z.boolean().default(true),
});
export type CreateSurveyDto = z.infer<typeof createSurveySchema>;

export const respondSurveySchema = z.object({
  customerId: z.string().uuid().optional(),
  score: z.coerce.number().int().min(1).max(10).optional(),
  answers: z.record(z.string(), z.unknown()).default({}),
});
export type RespondSurveyDto = z.infer<typeof respondSurveySchema>;

// ----- MKT-06 reviews -----
export const createReviewSchema = z.object({
  customerId: z.string().uuid().optional(),
  rating: z.coerce.number().int().min(1).max(5),
  comment: z.string().trim().max(1000).optional(),
});
export type CreateReviewDto = z.infer<typeof createReviewSchema>;

export const moderateReviewSchema = z.object({
  isPublic: z.boolean(),
});
export type ModerateReviewDto = z.infer<typeof moderateReviewSchema>;

export const listReviewsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  isPublic: z.coerce.boolean().optional(),
});
export type ListReviewsDto = z.infer<typeof listReviewsSchema>;

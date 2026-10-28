import { z } from 'zod';

export const createCampaignSchema = z.object({
  title: z.string().trim().min(2).max(160),
  description: z.string().trim().max(4000).optional(),
  imageUrl: z.string().trim().max(500).optional(),
  targetAmount: z.coerce.number().min(0).default(0),
  minAmount: z.coerce.number().min(0).default(0),
  maxAmount: z.coerce.number().min(0).optional(),
  deadline: z.coerce.date().optional(),
});
export type CreateCampaignDto = z.infer<typeof createCampaignSchema>;

export const updateCampaignSchema = createCampaignSchema.partial();
export type UpdateCampaignDto = z.infer<typeof updateCampaignSchema>;

export const contributeSchema = z.object({
  amount: z.coerce.number().positive(),
  isAnonymous: z.boolean().default(false),
  customerId: z.string().uuid().optional(),
  note: z.string().trim().max(500).optional(),
  paymentId: z.string().uuid().optional(),
});
export type ContributeDto = z.infer<typeof contributeSchema>;

export const listCampaignsSchema = z.object({
  status: z.enum(['DRAFT', 'ACTIVE', 'COMPLETED', 'CANCELED']).optional(),
});
export type ListCampaignsDto = z.infer<typeof listCampaignsSchema>;

export const recordExpenseSchema = z.object({
  title: z.string().trim().min(2).max(200),
  amount: z.coerce.number().positive(),
  receiptKey: z.string().trim().max(500).optional(),
  note: z.string().trim().max(500).optional(),
});
export type RecordCampaignExpenseDto = z.infer<typeof recordExpenseSchema>;

export const closeCampaignSchema = z.object({
  surplusAction: z.enum(['REFUND', 'TRANSFER']).default('REFUND'),
  transferToCampaignId: z.string().uuid().optional(),
});
export type CloseCampaignDto = z.infer<typeof closeCampaignSchema>;

export const issueReceiptSchema = z.object({
  contributionId: z.string().uuid(),
  receiptNumber: z.string().trim().min(2).max(60),
});
export type IssueReceiptDto = z.infer<typeof issueReceiptSchema>;

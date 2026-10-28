import { z } from 'zod';

// MKT-04 targeted SMS campaign
export const smsCampaignSegmentSchema = z.object({
  tags: z.array(z.string().trim().max(40)).max(20).optional(),
  city: z.string().trim().max(80).optional(),
  leadStage: z.enum(['LEAD', 'NEGOTIATION', 'WON', 'LOST']).optional(),
  minSpend: z.coerce.number().int().min(0).optional(),
  lastVisitBefore: z.coerce.date().optional(),
});
export type SmsCampaignSegmentDto = z.infer<typeof smsCampaignSegmentSchema>;

export const createSmsCampaignSchema = z.object({
  title: z.string().trim().min(2).max(160),
  body: z.string().trim().min(2).max(2000),
  segment: smsCampaignSegmentSchema.default({}),
  sendNow: z.boolean().default(false),
});
export type CreateSmsCampaignDto = z.infer<typeof createSmsCampaignSchema>;

export const previewSegmentSchema = z.object({
  segment: smsCampaignSegmentSchema.default({}),
});
export type PreviewSegmentDto = z.infer<typeof previewSegmentSchema>;

// MKT-08 social share card
export const shareCardSchema = z.object({
  title: z.string().trim().min(1).max(80),
  subtitle: z.string().trim().max(120).optional(),
  footer: z.string().trim().max(80).optional(),
  theme: z.enum(['brand', 'dark', 'light']).default('brand'),
});
export type ShareCardDto = z.infer<typeof shareCardSchema>;

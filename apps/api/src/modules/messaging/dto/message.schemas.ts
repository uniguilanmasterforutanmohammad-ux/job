import { z } from 'zod';

const channelEnum = z.enum(['SMS', 'WHATSAPP', 'EMAIL', 'PUSH', 'IN_APP']);

export const createTemplateSchema = z.object({
  key: z.string().trim().min(2).max(60).regex(/^[a-z0-9_]+$/, 'کلید باید انگلیسی و با _ باشد'),
  channel: channelEnum.default('SMS'),
  title: z.string().trim().min(2).max(120),
  body: z.string().trim().min(2).max(2000),
  isActive: z.boolean().default(true),
});
export type CreateTemplateDto = z.infer<typeof createTemplateSchema>;

export const sendMessageSchema = z.object({
  customerId: z.string().uuid().optional(),
  toAddress: z.string().trim().max(120).optional(),
  channel: channelEnum.default('SMS'),
  body: z.string().trim().min(1).max(2000).optional(),
  templateKey: z.string().trim().max(60).optional(),
  variables: z.record(z.string(), z.string()).optional(),
  scheduledAt: z.coerce.date().optional(),
});
export type SendMessageDto = z.infer<typeof sendMessageSchema>;

export const bulkSendSchema = z.object({
  customerIds: z.array(z.string().uuid()).min(1).max(500),
  channel: channelEnum.default('SMS'),
  body: z.string().trim().min(1).max(2000).optional(),
  templateKey: z.string().trim().max(60).optional(),
});
export type BulkSendDto = z.infer<typeof bulkSendSchema>;

export const setConsentSchema = z.object({
  customerId: z.string().uuid(),
  channel: channelEnum.default('SMS'),
  optedIn: z.boolean(),
  reason: z.string().trim().max(200).optional(),
});
export type SetConsentDto = z.infer<typeof setConsentSchema>;

export const listMessagesSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['QUEUED', 'SENT', 'DELIVERED', 'READ', 'FAILED']).optional(),
  channel: channelEnum.optional(),
  customerId: z.string().uuid().optional(),
});
export type ListMessagesDto = z.infer<typeof listMessagesSchema>;

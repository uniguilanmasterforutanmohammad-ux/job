import { z } from 'zod';

// MSG-05 — individual chat + file share
export const sendChatSchema = z.object({
  customerId: z.string().uuid(),
  body: z.string().trim().max(4000).optional(),
  fileKey: z.string().trim().max(500).optional(),
  direction: z.enum(['INBOUND', 'OUTBOUND']).default('OUTBOUND'),
});
export type SendChatDto = z.infer<typeof sendChatSchema>;

export const listChatSchema = z.object({
  customerId: z.string().uuid(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});
export type ListChatDto = z.infer<typeof listChatSchema>;

export const markChatReadSchema = z.object({
  customerId: z.string().uuid(),
});
export type MarkChatReadDto = z.infer<typeof markChatReadSchema>;

// MSG-07 — SMS package + usage report
export const createSmsPackageSchema = z.object({
  title: z.string().trim().min(2).max(120),
  credits: z.coerce.number().int().min(1),
  amount: z.coerce.number().int().min(0).default(0),
  expiresAt: z.coerce.date().optional(),
});
export type CreateSmsPackageDto = z.infer<typeof createSmsPackageSchema>;

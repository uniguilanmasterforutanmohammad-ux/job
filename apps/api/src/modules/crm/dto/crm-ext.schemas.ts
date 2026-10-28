import { z } from 'zod';

// ----- CRM-04 re-engagement reminders -----
export const reEngagementSchema = z.object({
  days: z.coerce.number().int().min(1).max(730).default(90),
  tag: z.string().trim().max(40).optional(),
});
export type ReEngagementDto = z.infer<typeof reEngagementSchema>;

// ----- CRM-06 bulk import -----
export const importRowSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  phone: z
    .string()
    .trim()
    .regex(/^09\d{9}$/, 'شماره موبایل نامعتبر است')
    .optional(),
  email: z.string().email().optional(),
  city: z.string().trim().max(80).optional(),
  tags: z.array(z.string().trim().max(40)).max(20).optional(),
  notes: z.string().trim().max(2000).optional(),
});

export const bulkImportSchema = z.object({
  rows: z.array(importRowSchema).min(1).max(2000),
  skipDuplicates: z.boolean().default(true),
});
export type BulkImportDto = z.infer<typeof bulkImportSchema>;

// ----- CRM-08 lead pipeline -----
export const moveLeadSchema = z.object({
  leadStage: z.enum(['LEAD', 'NEGOTIATION', 'WON', 'LOST']),
});
export type MoveLeadDto = z.infer<typeof moveLeadSchema>;

export const pipelineQuerySchema = z.object({
  city: z.string().trim().max(80).optional(),
  tag: z.string().trim().max(40).optional(),
  minSpend: z.coerce.number().min(0).optional(),
  lastVisitBefore: z.coerce.date().optional(),
});
export type PipelineQueryDto = z.infer<typeof pipelineQuerySchema>;

// ----- CRM-07 online form -----
export const onlineFormSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  phone: z.string().trim().regex(/^09\d{9}$/, 'شماره موبایل نامعتبر است'),
  email: z.string().email().optional(),
  message: z.string().trim().max(2000).optional(),
  source: z.string().trim().max(80).default('online_form'),
});
export type OnlineFormDto = z.infer<typeof onlineFormSchema>;

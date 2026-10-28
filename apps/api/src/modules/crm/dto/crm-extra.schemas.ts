import { z } from 'zod';

// CRM-02 full customer history
export const historyQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
});
export type HistoryQueryDto = z.infer<typeof historyQuerySchema>;

// CRM-06 CSV import (raw text payload)
export const csvImportSchema = z.object({
  csv: z.string().min(1).max(5_000_000),
  skipDuplicates: z.boolean().default(true),
  /** optional column mapping: header -> field (fullName|phone|email|city|tags|notes) */
  mapping: z.record(z.string(), z.string()).optional(),
});
export type CsvImportDto = z.infer<typeof csvImportSchema>;

// CRM-07 public lead/intake form
export const publicLeadFormSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  phone: z.string().trim().regex(/^09\d{9}$/, 'شماره موبایل نامعتبر است'),
  email: z.string().email().optional(),
  city: z.string().trim().max(80).optional(),
  message: z.string().trim().max(2000).optional(),
  source: z.string().trim().max(80).default('public_form'),
});
export type PublicLeadFormDto = z.infer<typeof publicLeadFormSchema>;

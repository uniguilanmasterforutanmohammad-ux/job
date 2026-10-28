import { z } from 'zod';

export const createPaymentSchema = z.object({
  invoiceId: z.string().uuid().optional(),
  customerId: z.string().uuid().optional(),
  amount: z.coerce.number().int().positive('مبلغ باید بزرگ‌تر از صفر باشد'),
  description: z.string().trim().max(255).default('پرداخت آنلاین'),
  provider: z.string().trim().min(2).max(40).optional(),
});
export type CreatePaymentDto = z.infer<typeof createPaymentSchema>;

export const callbackSchema = z.object({
  authority: z.string().trim().min(4).optional(),
  Authority: z.string().trim().min(4).optional(),
  status: z.string().trim().optional(),
  Status: z.string().trim().optional(),
});

export const manualPaymentSchema = z.object({
  invoiceId: z.string().uuid().optional(),
  customerId: z.string().uuid().optional(),
  amount: z.coerce.number().int().positive(),
  method: z.enum(['CASH', 'POS', 'CARD_TO_CARD', 'CHECK', 'CUSTOMER_CREDIT']),
  note: z.string().trim().max(255).optional(),
});
export type ManualPaymentDto = z.infer<typeof manualPaymentSchema>;

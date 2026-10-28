import { z } from 'zod';

// ----- FIN-06 wallet -----
export const walletAdjustSchema = z.object({
  customerId: z.string().uuid(),
  amount: z.coerce.number().int().min(1),
  type: z.enum(['CREDIT', 'DEBIT', 'GIFT', 'REFUND']).default('CREDIT'),
  reason: z.string().trim().max(255).optional(),
});
export type WalletAdjustDto = z.infer<typeof walletAdjustSchema>;

export const walletHistorySchema = z.object({
  customerId: z.string().uuid(),
});
export type WalletHistoryDto = z.infer<typeof walletHistorySchema>;

// ----- FIN-07 refunds -----
export const createRefundSchema = z.object({
  invoiceId: z.string().uuid().optional(),
  paymentId: z.string().uuid().optional(),
  customerId: z.string().uuid().optional(),
  amount: z.coerce.number().int().min(1),
  reason: z.string().trim().min(2).max(500),
  toWallet: z.boolean().default(false),
});
export type CreateRefundDto = z.infer<typeof createRefundSchema>;

export const listRefundsSchema = z.object({
  status: z.enum(['REQUESTED', 'APPROVED', 'REJECTED', 'COMPLETED']).optional(),
});
export type ListRefundsDto = z.infer<typeof listRefundsSchema>;

export const rejectRefundSchema = z.object({
  reason: z.string().trim().max(500).optional(),
});
export type RejectRefundDto = z.infer<typeof rejectRefundSchema>;

// ----- FIN-08 discount codes -----
export const createDiscountSchema = z
  .object({
    code: z
      .string()
      .trim()
      .min(3)
      .max(60)
      .transform((v) => v.toUpperCase()),
    percent: z.coerce.number().min(0).max(100).optional(),
    amount: z.coerce.number().int().min(0).optional(),
    maxUses: z.coerce.number().int().min(1).optional(),
    startsAt: z.coerce.date().optional(),
    expiresAt: z.coerce.date().optional(),
    isActive: z.boolean().default(true),
  })
  .refine((v) => (v.percent ?? 0) > 0 || (v.amount ?? 0) > 0, {
    message: 'یکی از درصد یا مبلغ تخفیف الزامی است',
  });
export type CreateDiscountDto = z.infer<typeof createDiscountSchema>;

export const validateDiscountSchema = z.object({
  code: z.string().trim().min(1),
  amount: z.coerce.number().int().min(0).optional(),
});
export type ValidateDiscountDto = z.infer<typeof validateDiscountSchema>;

// ----- FIN-13 payment links -----
export const createPaymentLinkSchema = z.object({
  invoiceId: z.string().uuid().optional(),
  customerId: z.string().uuid().optional(),
  amount: z.coerce.number().int().min(1),
  title: z.string().trim().max(160).optional(),
  expiresAt: z.coerce.date().optional(),
});
export type CreatePaymentLinkDto = z.infer<typeof createPaymentLinkSchema>;

// ----- FIN-05 debtor report -----
export const debtorReportSchema = z.object({
  minAmount: z.coerce.number().int().min(0).default(1),
  overdueOnly: z.coerce.boolean().default(false),
});
export type DebtorReportDto = z.infer<typeof debtorReportSchema>;

// ----- FIN-09 tax report -----
export const taxReportSchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});
export type TaxReportDto = z.infer<typeof taxReportSchema>;

// ----- FIN-02 convert pre-invoice -----
export const convertProformaSchema = z.object({
  dueDate: z.coerce.date().optional(),
});
export type ConvertProformaDto = z.infer<typeof convertProformaSchema>;

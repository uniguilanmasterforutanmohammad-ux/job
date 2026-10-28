import { z } from 'zod';

// ----- FIN-04 installments -----
export const createInstallmentPlanSchema = z.object({
  customerId: z.string().uuid(),
  invoiceId: z.string().uuid().optional(),
  totalAmount: z.coerce.number().int().min(1),
  count: z.coerce.number().int().min(1).max(60),
  firstDueDate: z.coerce.date(),
  intervalDays: z.coerce.number().int().min(1).max(365).default(30),
});
export type CreateInstallmentPlanDto = z.infer<typeof createInstallmentPlanSchema>;

export const payInstallmentSchema = z.object({
  lateFee: z.coerce.number().min(0).default(0),
});
export type PayInstallmentDto = z.infer<typeof payInstallmentSchema>;

export const listInstallmentsSchema = z.object({
  customerId: z.string().uuid().optional(),
  status: z.enum(['PENDING', 'PAID', 'OVERDUE', 'CANCELED']).optional(),
});
export type ListInstallmentsDto = z.infer<typeof listInstallmentsSchema>;

// ----- FIN-10 expenses -----
export const createExpenseSchema = z.object({
  branchId: z.string().uuid().optional(),
  category: z.string().trim().min(1).max(80),
  title: z.string().trim().min(2).max(200),
  amount: z.coerce.number().int().min(0),
  spentAt: z.coerce.date().optional(),
  note: z.string().trim().max(500).optional(),
  fileKey: z.string().trim().max(500).optional(),
});
export type CreateExpenseDto = z.infer<typeof createExpenseSchema>;

export const listExpensesSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  category: z.string().trim().max(80).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});
export type ListExpensesDto = z.infer<typeof listExpensesSchema>;

// ----- FIN-12 cash sessions -----
export const openCashSessionSchema = z.object({
  branchId: z.string().uuid().optional(),
  openingFloat: z.coerce.number().min(0).default(0),
});
export type OpenCashSessionDto = z.infer<typeof openCashSessionSchema>;

export const closeCashSessionSchema = z.object({
  countedCash: z.coerce.number().min(0),
  note: z.string().trim().max(500).optional(),
});
export type CloseCashSessionDto = z.infer<typeof closeCashSessionSchema>;

// ----- FIN-11 P&L -----
export const profitLossSchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  branchId: z.string().uuid().optional(),
});
export type ProfitLossDto = z.infer<typeof profitLossSchema>;

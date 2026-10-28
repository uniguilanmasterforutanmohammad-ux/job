import { z } from 'zod';

export const invoiceItemSchema = z.object({
  description: z.string().trim().min(1).max(255),
  serviceId: z.string().uuid().optional(),
  quantity: z.coerce.number().positive().default(1),
  unitPrice: z.coerce.number().int().min(0),
  discount: z.coerce.number().int().min(0).default(0),
  taxRate: z.coerce.number().min(0).max(100).default(9),
});

export const createInvoiceSchema = z.object({
  customerId: z.string().uuid('شناسه مشتری نامعتبر است'),
  branchId: z.string().uuid().optional(),
  dueDate: z.coerce.date().optional(),
  notes: z.string().trim().max(1000).optional(),
  discountCode: z.string().trim().max(60).optional(),
  items: z.array(invoiceItemSchema).min(1, 'حداقل یک قلم لازم است'),
  /** FIN-02 — when true this is a pre-invoice (پیش‌فاکتور) that can be converted. */
  isProforma: z.boolean().default(false),
});
export type CreateInvoiceDto = z.infer<typeof createInvoiceSchema>;

export const listInvoicesSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: z
    .enum(['DRAFT', 'ISSUED', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'CANCELED', 'REFUNDED'])
    .optional(),
  customerId: z.string().uuid().optional(),
});
export type ListInvoicesDto = z.infer<typeof listInvoicesSchema>;

import { z } from 'zod';

export const createCustomerSchema = z.object({
  fullName: z.string().trim().min(2, 'نام باید حداقل ۲ کاراکتر باشد').max(120),
  phone: z
    .string()
    .trim()
    .regex(/^09\d{9}$/, 'شماره موبایل نامعتبر است')
    .optional(),
  email: z.string().email('ایمیل نامعتبر است').optional(),
  type: z.enum(['INDIVIDUAL', 'COMPANY']).default('INDIVIDUAL'),
  nationalId: z.string().trim().max(20).optional(),
  birthDate: z.coerce.date().optional(),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER', 'UNKNOWN']).optional(),
  address: z.string().trim().max(500).optional(),
  city: z.string().trim().max(80).optional(),
  source: z.string().trim().max(80).optional(),
  tags: z.array(z.string().trim().max(40)).max(20).default([]),
  leadStage: z.enum(['LEAD', 'NEGOTIATION', 'WON', 'LOST']).default('LEAD'),
  /** Location the end-user belongs to («آموزشگاه A» / «شعبه»). */
  branchId: z.string().uuid().optional(),
  notes: z.string().trim().max(2000).optional(),
  meta: z.record(z.string(), z.unknown()).optional(),
});
export type CreateCustomerDto = z.infer<typeof createCustomerSchema>;

export const updateCustomerSchema = createCustomerSchema.partial().extend({
  /** `null` clears the assignment (moves the person out of any location). */
  branchId: z.string().uuid().nullable().optional(),
});
export type UpdateCustomerDto = z.infer<typeof updateCustomerSchema>;

export const listCustomersSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(120).optional(),
  tag: z.string().trim().max(40).optional(),
  leadStage: z.enum(['LEAD', 'NEGOTIATION', 'WON', 'LOST']).optional(),
  sortBy: z.enum(['createdAt', 'fullName', 'updatedAt']).default('createdAt'),
  sortDir: z.enum(['asc', 'desc']).default('desc'),
});
export type ListCustomersDto = z.infer<typeof listCustomersSchema>;

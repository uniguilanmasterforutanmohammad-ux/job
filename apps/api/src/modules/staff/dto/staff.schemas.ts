import { z } from 'zod';

export const createStaffSchema = z.object({
  memberId: z.string().uuid().optional(),
  fullName: z.string().trim().min(2).max(120),
  phone: z
    .string()
    .trim()
    .regex(/^09\d{9}$/, 'شماره موبایل نامعتبر است')
    .optional(),
  position: z.string().trim().max(120).optional(),
  contractType: z.enum(['FULL_TIME', 'PART_TIME', 'HOURLY', 'COMMISSION', 'CONTRACTOR']).optional(),
  baseSalary: z.coerce.number().min(0).default(0),
  commissionRate: z.coerce.number().min(0).max(100).default(0),
  hireDate: z.coerce.date().optional(),
  nationalId: z.string().trim().max(20).optional(),
  certifications: z
    .array(
      z.object({
        title: z.string().trim().max(120),
        issuedAt: z.coerce.date().optional(),
        expiresAt: z.coerce.date().optional(),
      }),
    )
    .max(30)
    .default([]),
  isActive: z.boolean().default(true),
});
export type CreateStaffDto = z.infer<typeof createStaffSchema>;

export const updateStaffSchema = createStaffSchema.partial();
export type UpdateStaffDto = z.infer<typeof updateStaffSchema>;

export const createLeaveSchema = z.object({
  staffId: z.string().uuid(),
  fromDate: z.coerce.date(),
  toDate: z.coerce.date(),
  reason: z.string().trim().max(300).optional(),
});
export type CreateLeaveDto = z.infer<typeof createLeaveSchema>;

export const reviewLeaveSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED']),
});
export type ReviewLeaveDto = z.infer<typeof reviewLeaveSchema>;

export const generatePayrollSchema = z.object({
  periodStart: z.coerce.date(),
  periodEnd: z.coerce.date(),
});
export type GeneratePayrollDto = z.infer<typeof generatePayrollSchema>;

export const updatePayrollSchema = z.object({
  bonus: z.coerce.number().min(0).optional(),
  deductions: z.coerce.number().min(0).optional(),
  status: z.enum(['DRAFT', 'FINALIZED', 'PAID']).optional(),
});
export type UpdatePayrollDto = z.infer<typeof updatePayrollSchema>;

export const listStaffSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(120).optional(),
  isActive: z.coerce.boolean().optional(),
});
export type ListStaffDto = z.infer<typeof listStaffSchema>;

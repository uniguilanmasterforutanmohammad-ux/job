import { z } from 'zod';

export const markAttendanceSchema = z.object({
  customerId: z.string().uuid().optional(),
  memberId: z.string().uuid().optional(),
  branchId: z.string().uuid().optional(),
  status: z.enum(['PRESENT', 'ABSENT', 'LATE', 'EXCUSED', 'CANCELED']).default('PRESENT'),
  method: z.enum(['MANUAL', 'QR', 'PERSONAL_CODE', 'NFC', 'GEO']).default('MANUAL'),
  date: z.coerce.date().optional(),
  note: z.string().trim().max(300).optional(),
});
export type MarkAttendanceDto = z.infer<typeof markAttendanceSchema>;

export const listAttendanceSchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  customerId: z.string().uuid().optional(),
  status: z.enum(['PRESENT', 'ABSENT', 'LATE', 'EXCUSED', 'CANCELED']).optional(),
});
export type ListAttendanceDto = z.infer<typeof listAttendanceSchema>;

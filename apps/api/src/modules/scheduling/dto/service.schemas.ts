import { z } from 'zod';

export const createServiceSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(1000).optional(),
  category: z.string().trim().max(80).optional(),
  imageUrl: z.string().trim().max(500).optional(),
  durationMinutes: z.coerce.number().int().min(5).max(1440).default(60),
  bufferMinutes: z.coerce.number().int().min(0).max(240).default(0),
  price: z.coerce.number().int().min(0).default(0),
  color: z.string().trim().max(20).optional(),
  isActive: z.boolean().default(true),
  isPublic: z.boolean().default(false),
});
export type CreateServiceDto = z.infer<typeof createServiceSchema>;

export const updateServiceSchema = createServiceSchema.partial();
export type UpdateServiceDto = z.infer<typeof updateServiceSchema>;

export const createAppointmentSchema = z.object({
  customerId: z.string().uuid('شناسه مشتری نامعتبر است'),
  serviceId: z.string().uuid().optional(),
  branchId: z.string().uuid().optional(),
  staffId: z.string().uuid().optional(),
  startsAt: z.coerce.date(),
  durationMinutes: z.coerce.number().int().min(5).max(1440).optional(),
  notes: z.string().trim().max(1000).optional(),
  source: z.enum(['staff', 'app', 'link']).default('staff'),
});
export type CreateAppointmentDto = z.infer<typeof createAppointmentSchema>;

export const updateAppointmentStatusSchema = z.object({
  status: z.enum(['SCHEDULED', 'CONFIRMED', 'COMPLETED', 'CANCELED', 'NO_SHOW', 'WAITLIST']),
  cancelReason: z.string().trim().max(300).optional(),
});
export type UpdateAppointmentStatusDto = z.infer<typeof updateAppointmentStatusSchema>;

export const listAppointmentsSchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  staffId: z.string().uuid().optional(),
  customerId: z.string().uuid().optional(),
  status: z
    .enum(['SCHEDULED', 'CONFIRMED', 'COMPLETED', 'CANCELED', 'NO_SHOW', 'WAITLIST'])
    .optional(),
});
export type ListAppointmentsDto = z.infer<typeof listAppointmentsSchema>;

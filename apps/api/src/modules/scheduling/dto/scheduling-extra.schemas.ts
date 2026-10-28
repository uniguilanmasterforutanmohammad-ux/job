import { z } from 'zod';

// SCH-06 group booking
export const createGroupBookingSchema = z.object({
  title: z.string().trim().min(2).max(160),
  serviceId: z.string().uuid().optional(),
  staffId: z.string().uuid().optional(),
  startsAt: z.coerce.date(),
  durationMinutes: z.coerce.number().int().min(5).max(1440).default(60),
  capacity: z.coerce.number().int().min(1).max(500).default(10),
});
export type CreateGroupBookingDto = z.infer<typeof createGroupBookingSchema>;

export const joinGroupBookingSchema = z.object({
  customerId: z.string().uuid(),
});
export type JoinGroupBookingDto = z.infer<typeof joinGroupBookingSchema>;

// SCH-04 cancellation policy
export const cancelAppointmentSchema = z.object({
  reason: z.string().trim().max(300).optional(),
  /** Whether the tenant applies a penalty (جریمه) for late cancellation. */
  chargePenalty: z.boolean().default(false),
  penaltyAmount: z.coerce.number().int().min(0).default(0),
});
export type CancelAppointmentDto = z.infer<typeof cancelAppointmentSchema>;

// SCH-03 availability
export const availabilityQuerySchema = z.object({
  serviceId: z.string().uuid().optional(),
  staffId: z.string().uuid().optional(),
  date: z.coerce.date(),
});
export type AvailabilityQueryDto = z.infer<typeof availabilityQuerySchema>;

// SCH-09 external calendar sync
export const connectCalendarSchema = z.object({
  provider: z.enum(['google', 'outlook']),
  memberId: z.string().uuid().optional(),
  externalId: z.string().trim().max(255).optional(),
});
export type ConnectCalendarDto = z.infer<typeof connectCalendarSchema>;

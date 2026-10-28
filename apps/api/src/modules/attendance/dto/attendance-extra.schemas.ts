import { z } from 'zod';

// ATT-04 makeup session
export const createMakeupSchema = z.object({
  customerId: z.string().uuid(),
  serviceId: z.string().uuid().optional(),
  sourceAttendanceId: z.string().uuid().optional(),
  expiresAt: z.coerce.date().optional(),
  note: z.string().trim().max(300).optional(),
});
export type CreateMakeupDto = z.infer<typeof createMakeupSchema>;

export const useMakeupSchema = z.object({
  appointmentId: z.string().uuid(),
});
export type UseMakeupDto = z.infer<typeof useMakeupSchema>;

export const listMakeupSchema = z.object({
  customerId: z.string().uuid().optional(),
  status: z.enum(['AVAILABLE', 'USED', 'EXPIRED', 'CANCELED']).optional(),
});
export type ListMakeupDto = z.infer<typeof listMakeupSchema>;

// ATT-05 attendance-drop alert
export const attendanceAlertSchema = z.object({
  thresholdPercent: z.coerce.number().int().min(1).max(100).default(60),
});
export type AttendanceAlertDto = z.infer<typeof attendanceAlertSchema>;

// ATT-07 geofence check-in
export const geofenceCheckInSchema = z.object({
  memberId: z.string().uuid(),
  branchId: z.string().uuid(),
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  accuracyMeters: z.coerce.number().min(0).optional(),
});
export type GeofenceCheckInDto = z.infer<typeof geofenceCheckInSchema>;

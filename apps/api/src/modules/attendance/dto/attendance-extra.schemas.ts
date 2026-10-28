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

// ----- ATT-03 absence/excuse requests (student self-service) -----

/** A student creates an excuse/absence request for a session date. */
export const createAbsenceRequestSchema = z.object({
  absenceDate: z.coerce.date(),
  reason: z.string().trim().min(2).max(200),
  note: z.string().trim().max(1000).optional(),
  appointmentId: z.string().uuid().optional(),
  serviceId: z.string().uuid().optional(),
});
export type CreateAbsenceRequestDto = z.infer<typeof createAbsenceRequestSchema>;

export const listAbsenceRequestsSchema = z.object({
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'CANCELED']).optional(),
  customerId: z.string().uuid().optional(),
});
export type ListAbsenceRequestsDto = z.infer<typeof listAbsenceRequestsSchema>;

/** The coach either approves (excused) or rejects an absence request. */
export const reviewAbsenceRequestSchema = z.object({
  decision: z.enum(['APPROVED', 'REJECTED']),
  reviewNote: z.string().trim().max(500).optional(),
});
export type ReviewAbsenceRequestDto = z.infer<typeof reviewAbsenceRequestSchema>;

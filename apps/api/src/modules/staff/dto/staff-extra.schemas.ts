import { z } from 'zod';

// HR-05 staff ↔ service mapping
export const assignServiceSchema = z.object({
  serviceId: z.string().uuid(),
  isPrimary: z.boolean().default(false),
});
export type AssignServiceDto = z.infer<typeof assignServiceSchema>;

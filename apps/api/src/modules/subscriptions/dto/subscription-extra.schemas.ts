import { z } from 'zod';

// SUB-06 family group / family discount
export const createFamilyGroupSchema = z.object({
  name: z.string().trim().min(2).max(120),
  discountPercent: z.coerce.number().min(0).max(100).default(0),
});
export type CreateFamilyGroupDto = z.infer<typeof createFamilyGroupSchema>;

export const addFamilyMemberSchema = z.object({
  customerId: z.string().uuid(),
  relation: z.string().trim().max(40).optional(),
});
export type AddFamilyMemberDto = z.infer<typeof addFamilyMemberSchema>;

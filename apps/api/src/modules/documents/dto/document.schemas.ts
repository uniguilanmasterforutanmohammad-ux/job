import { z } from 'zod';

const variableMap = z.record(z.string(), z.string());

export const createContractTemplateSchema = z.object({
  title: z.string().trim().min(2).max(160),
  body: z.string().trim().min(2).max(20000),
  isActive: z.boolean().default(true),
});
export type CreateContractTemplateDto = z.infer<typeof createContractTemplateSchema>;

export const updateContractTemplateSchema = createContractTemplateSchema.partial();
export type UpdateContractTemplateDto = z.infer<typeof updateContractTemplateSchema>;

export const createContractSchema = z.object({
  customerId: z.string().uuid().optional(),
  templateId: z.string().uuid().optional(),
  title: z.string().trim().min(2).max(160),
  body: z.string().trim().min(2).max(20000).optional(),
  variables: variableMap.optional(),
  amount: z.coerce.number().min(0).optional(),
  expiresAt: z.coerce.date().optional(),
});
export type CreateContractDto = z.infer<typeof createContractSchema>;

export const signContractSchema = z.object({
  signatureKey: z.string().trim().min(4).max(500),
});
export type SignContractDto = z.infer<typeof signContractSchema>;

export const updateContractStatusSchema = z.object({
  status: z.enum(['DRAFT', 'SENT', 'SIGNED', 'EXPIRED', 'CANCELED']),
});
export type UpdateContractStatusDto = z.infer<typeof updateContractStatusSchema>;

export const listContractsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['DRAFT', 'SENT', 'SIGNED', 'EXPIRED', 'CANCELED']).optional(),
  customerId: z.string().uuid().optional(),
});
export type ListContractsDto = z.infer<typeof listContractsSchema>;

// ----- DOC-03 archive -----
export const createDocumentSchema = z.object({
  customerId: z.string().uuid().optional(),
  title: z.string().trim().min(2).max(200),
  category: z.string().trim().max(80).optional(),
  fileKey: z.string().trim().min(1).max(500),
  mimeType: z.string().trim().max(120).optional(),
  size: z.coerce.number().int().min(0).optional(),
  expiresAt: z.coerce.date().optional(),
});
export type CreateDocumentDto = z.infer<typeof createDocumentSchema>;

export const listDocumentsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  customerId: z.string().uuid().optional(),
  category: z.string().trim().max(80).optional(),
});
export type ListDocumentsDto = z.infer<typeof listDocumentsSchema>;

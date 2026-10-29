import { z } from 'zod';

export const createSupplierSchema = z.object({
  name: z.string().trim().min(2).max(120),
  phone: z.string().trim().max(30).optional(),
  email: z.string().email().optional(),
  address: z.string().trim().max(500).optional(),
  note: z.string().trim().max(500).optional(),
});
export type CreateSupplierDto = z.infer<typeof createSupplierSchema>;

export const createProductSchema = z.object({
  sku: z.string().trim().max(60).optional(),
  name: z.string().trim().min(2).max(160),
  description: z.string().trim().max(1000).optional(),
  unit: z.string().trim().max(30).default('عدد'),
  category: z.string().trim().max(80).optional(),
  costPrice: z.coerce.number().min(0).default(0),
  salePrice: z.coerce.number().min(0).default(0),
  minStock: z.coerce.number().min(0).default(0),
  barcode: z.string().trim().max(60).optional(),
  imageUrl: z.string().trim().max(500).optional(),
  trackExpiry: z.boolean().default(false),
  isActive: z.boolean().default(true),
  isPublic: z.boolean().default(false),
});
export type CreateProductDto = z.infer<typeof createProductSchema>;

export const updateProductSchema = createProductSchema.partial();
export type UpdateProductDto = z.infer<typeof updateProductSchema>;

export const listProductsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(120).optional(),
  category: z.string().trim().max(80).optional(),
  lowStock: z.coerce.boolean().optional(),
});
export type ListProductsDto = z.infer<typeof listProductsSchema>;

export const createMovementSchema = z.object({
  productId: z.string().uuid(),
  branchId: z.string().uuid().optional(),
  type: z.enum([
    'PURCHASE',
    'SALE',
    'CONSUMPTION',
    'WASTE',
    'TRANSFER_IN',
    'TRANSFER_OUT',
    'ADJUSTMENT',
  ]),
  quantity: z.coerce.number(),
  unitCost: z.coerce.number().min(0).default(0),
  lotNumber: z.string().trim().max(60).optional(),
  expiresAt: z.coerce.date().optional(),
  supplierId: z.string().uuid().optional(),
  reference: z.string().trim().max(120).optional(),
  note: z.string().trim().max(500).optional(),
});
export type CreateMovementDto = z.infer<typeof createMovementSchema>;

export const listMovementsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  productId: z.string().uuid().optional(),
  type: z
    .enum([
      'PURCHASE',
      'SALE',
      'CONSUMPTION',
      'WASTE',
      'TRANSFER_IN',
      'TRANSFER_OUT',
      'ADJUSTMENT',
    ])
    .optional(),
});
export type ListMovementsDto = z.infer<typeof listMovementsSchema>;

export const transferStockSchema = z.object({
  productId: z.string().uuid(),
  fromBranchId: z.string().uuid(),
  toBranchId: z.string().uuid(),
  quantity: z.coerce.number().positive(),
  note: z.string().trim().max(300).optional(),
});
export type TransferStockDto = z.infer<typeof transferStockSchema>;

export const stockCountSchema = z.object({
  productId: z.string().uuid(),
  counted: z.coerce.number().min(0),
  note: z.string().trim().max(300).optional(),
});
export type StockCountDto = z.infer<typeof stockCountSchema>;

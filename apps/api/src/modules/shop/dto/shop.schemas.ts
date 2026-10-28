import { z } from 'zod';

export const orderItemSchema = z.object({
  productId: z.string().uuid().optional(),
  serviceId: z.string().uuid().optional(),
  title: z.string().trim().min(1).max(200),
  quantity: z.coerce.number().positive().default(1),
  unitPrice: z.coerce.number().int().min(0),
});

export const createOrderSchema = z.object({
  customerId: z.string().uuid().optional(),
  items: z.array(orderItemSchema).min(1, 'حداقل یک قلم لازم است'),
  shippingMethod: z.string().trim().max(80).optional(),
  shippingCost: z.coerce.number().min(0).default(0),
  address: z.string().trim().max(500).optional(),
  note: z.string().trim().max(500).optional(),
});
export type CreateOrderDto = z.infer<typeof createOrderSchema>;

export const updateOrderStatusSchema = z.object({
  status: z.enum(['PENDING', 'CONFIRMED', 'PREPARING', 'SHIPPED', 'DELIVERED', 'CANCELED']),
});
export type UpdateOrderStatusDto = z.infer<typeof updateOrderStatusSchema>;

export const updateShippingSchema = z.object({
  shippingMethod: z.string().trim().max(80).optional(),
  shippingCost: z.coerce.number().min(0).optional(),
  trackingCode: z.string().trim().max(80).optional(),
  address: z.string().trim().max(500).optional(),
});
export type UpdateShippingDto = z.infer<typeof updateShippingSchema>;

export const listOrdersSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: z
    .enum(['PENDING', 'CONFIRMED', 'PREPARING', 'SHIPPED', 'DELIVERED', 'CANCELED'])
    .optional(),
  customerId: z.string().uuid().optional(),
});
export type ListOrdersDto = z.infer<typeof listOrdersSchema>;

export const catalogQuerySchema = z.object({
  category: z.string().trim().max(80).optional(),
  search: z.string().trim().max(120).optional(),
});
export type CatalogQueryDto = z.infer<typeof catalogQuerySchema>;

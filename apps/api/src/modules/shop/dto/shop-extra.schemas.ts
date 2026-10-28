import { z } from 'zod';

// SHOP-02 — public cart checkout that hands off to the payment gateway
export const cartItemSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.coerce.number().int().positive().max(1000),
});

export const checkoutSchema = z.object({
  customerId: z.string().uuid().optional(),
  items: z.array(cartItemSchema).min(1, 'سبد خرید خالی است'),
  shippingMethod: z.string().trim().max(80).optional(),
  shippingCost: z.coerce.number().int().min(0).default(0),
  address: z.string().trim().max(500).optional(),
  note: z.string().trim().max(500).optional(),
  /** when true the checkout creates a gateway payment link instead of pay-on-site */
  payOnline: z.boolean().default(false),
  provider: z.string().trim().min(2).max(40).optional(),
});
export type CheckoutDto = z.infer<typeof checkoutSchema>;

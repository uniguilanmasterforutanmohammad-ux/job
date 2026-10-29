export type CartItem = {
  productId: string;
  name: string;
  price: number;
  imageUrl: string | null;
  unit: string;
  tenantSlug: string;
  tenantName: string;
  quantity: number;
  stock: number;
};

const CART_KEY = 'bp_marketplace_cart_v1';
export const CART_EVENT = 'bp-cart-changed';

export function readCart(): CartItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(CART_KEY);
    const parsed = raw ? (JSON.parse(raw) as CartItem[]) : [];
    return Array.isArray(parsed) ? parsed.filter((item) => item?.productId) : [];
  } catch {
    return [];
  }
}

export function writeCart(items: CartItem[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(CART_KEY, JSON.stringify(items));
  window.dispatchEvent(new Event(CART_EVENT));
}

export function clearCart() {
  writeCart([]);
}

export type AddResult = { ok: true } | { ok: false; reason: 'stock' | 'other-tenant' };

export function addToCart(item: CartItem, options: { replaceOtherTenant?: boolean } = {}): AddResult {
  const cart = readCart();
  if (item.stock <= 0) return { ok: false, reason: 'stock' };
  if (cart.length > 0 && cart[0].tenantSlug !== item.tenantSlug && !options.replaceOtherTenant) {
    return { ok: false, reason: 'other-tenant' };
  }
  const base = options.replaceOtherTenant ? [] : cart;
  const existing = base.find((row) => row.productId === item.productId);
  const next = existing
    ? base.map((row) =>
        row.productId === item.productId
          ? { ...row, quantity: Math.min(row.quantity + item.quantity, Math.max(1, item.stock)) }
          : row,
      )
    : [...base, item];
  writeCart(next);
  return { ok: true };
}

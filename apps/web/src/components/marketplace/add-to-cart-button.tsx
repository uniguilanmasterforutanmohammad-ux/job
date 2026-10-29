'use client';

import { useState } from 'react';
import { ShoppingBag } from 'lucide-react';
import { toast } from 'sonner';
import { addToCart } from '@/lib/marketplace-cart';
import type { MarketplaceProduct } from '@/lib/marketplace';

export function AddToCartButton({
  product,
  size = 'sm',
  className = '',
}: {
  product: MarketplaceProduct;
  size?: 'sm' | 'lg';
  className?: string;
}) {
  const [busy, setBusy] = useState(false);
  const outOfStock = Number(product.stock) <= 0;

  function handleAdd(replaceOtherTenant = false) {
    if (outOfStock) {
      toast.error('این محصول فعلاً موجود نیست');
      return;
    }
    setBusy(true);
    const result = addToCart(
      {
        productId: product.id,
        name: product.name,
        price: Number(product.salePrice),
        imageUrl: product.imageUrl,
        unit: product.unit,
        tenantSlug: product.tenant.slug,
        tenantName: product.tenant.name,
        quantity: 1,
        stock: Number(product.stock),
      },
      { replaceOtherTenant },
    );
    setBusy(false);

    if (!result.ok && result.reason === 'other-tenant') {
      const cartTenant = JSON.parse(window.localStorage.getItem('bp_marketplace_cart_v1') ?? '[]')[0]
        ?.tenantName;
      const replace = window.confirm(
        `سبد خرید شما مربوط به «${cartTenant ?? 'کسب‌وکار دیگر'}» است. برای افزودن این کالا، سبد فعلی خالی شود؟`,
      );
      if (replace) handleAdd(true);
      return;
    }
    if (!result.ok) {
      toast.error('افزودن به سبد انجام نشد');
      return;
    }
    toast.success('به سبد خرید اضافه شد');
  }

  return (
    <button
      type="button"
      onClick={() => handleAdd(false)}
      disabled={busy || outOfStock}
      className={`inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-colors ${
        size === 'lg' ? 'px-5 py-3 text-sm' : 'px-3 py-2 text-xs'
      } ${
        outOfStock
          ? 'cursor-not-allowed bg-slate-200 text-slate-500'
          : 'bg-brand-600 text-white hover:bg-brand-700'
      } ${className}`}
    >
      <ShoppingBag className={size === 'lg' ? 'h-4 w-4' : 'h-3.5 w-3.5'} />
      {outOfStock ? 'ناموجود' : 'افزودن به سبد'}
    </button>
  );
}

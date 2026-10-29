import Link from 'next/link';
import { ImageOff } from 'lucide-react';
import { formatToman } from '@/lib/utils';
import type { MarketplaceProduct } from '@/lib/marketplace';
import { AddToCartButton } from './add-to-cart-button';

export function ProductCard({ product }: { product: MarketplaceProduct }) {
  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
      <Link href={`/marketplace/products/${product.id}`} className="block">
        <div className="relative aspect-[4/3] w-full overflow-hidden bg-slate-100 dark:bg-slate-800">
          {product.imageUrl ? (
            <img
              src={product.imageUrl}
              alt={product.name}
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-brand-50 to-brand-100 text-brand-400 dark:from-slate-800 dark:to-slate-700">
              <ImageOff className="h-10 w-10" />
            </div>
          )}
          {Number(product.stock) <= 0 ? (
            <span className="absolute right-3 top-3 rounded-full bg-slate-900/80 px-2.5 py-1 text-[11px] font-medium text-white">
              ناموجود
            </span>
          ) : null}
        </div>
      </Link>

      <div className="flex flex-1 flex-col gap-2 p-3.5">
        <Link href={`/marketplace/products/${product.id}`}>
          <h3 className="line-clamp-1 text-sm font-bold text-slate-900 dark:text-slate-100">
            {product.name}
          </h3>
        </Link>
        <p className="line-clamp-2 min-h-[2.5rem] text-xs leading-5 text-slate-500 dark:text-slate-400">
          {product.description ?? 'بدون توضیح'}
        </p>
        <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
          <span className="rounded-md bg-slate-100 px-1.5 py-0.5 dark:bg-slate-800">
            {product.tenant.city ?? 'آنلاین'}
          </span>
          <Link
            href={`/marketplace/b/${product.tenant.slug}`}
            className="truncate hover:text-brand-600"
          >
            {product.tenant.name}
          </Link>
        </div>
        <div className="mt-auto flex items-center justify-between gap-2 pt-1">
          <span className="nums text-sm font-black text-slate-900 dark:text-slate-100">
            {formatToman(product.salePrice)}
          </span>
          <AddToCartButton product={product} />
        </div>
      </div>
    </article>
  );
}

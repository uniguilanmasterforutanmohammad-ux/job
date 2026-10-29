import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowRight, Building2, PackageCheck, Truck } from 'lucide-react';
import { industryLabel } from '@repo/shared';
import { marketplaceGet, type MarketplaceProduct } from '@/lib/marketplace';
import { formatToman } from '@/lib/utils';
import { AddToCartButton } from '@/components/marketplace/add-to-cart-button';

async function getProduct(id: string): Promise<MarketplaceProduct | null> {
  try {
    return await marketplaceGet<MarketplaceProduct>(`/products/${id}`);
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const product = await getProduct(id);
  return {
    title: product ? `${product.name} — ${product.tenant.name}` : 'محصول',
    description: product?.description ?? undefined,
  };
}

export default async function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const product = await getProduct(id);
  if (!product) notFound();

  const stock = Number(product.stock);
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.description ?? undefined,
    image: product.imageUrl ? new URL(product.imageUrl, site).toString() : undefined,
    brand: { '@type': 'Organization', name: product.tenant.name },
    url: `${site}/marketplace/products/${product.id}`,
    offers: {
      '@type': 'Offer',
      price: Number(product.salePrice),
      priceCurrency: 'IRR',
      availability:
        stock > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
    },
  };

  return (
    <div className="space-y-5">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Link
        href="/marketplace/products"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-brand-600"
      >
        <ArrowRight className="h-4 w-4" />
        بازگشت به محصولات
      </Link>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          {product.imageUrl ? (
            <img
              src={product.imageUrl}
              alt={product.name}
              className="aspect-[4/3] w-full object-cover"
            />
          ) : (
            <div className="aspect-[4/3] w-full bg-gradient-to-br from-brand-50 to-brand-100 dark:from-slate-800 dark:to-slate-700" />
          )}
        </div>

        <div className="space-y-4">
          <div>
            {product.category ? (
              <span className="rounded-full bg-brand-50 px-2.5 py-1 text-[11px] font-medium text-brand-700 dark:bg-brand-900/30 dark:text-brand-200">
                {product.category}
              </span>
            ) : null}
            <h1 className="mt-2 text-xl font-black text-slate-900 sm:text-2xl dark:text-slate-100">
              {product.name}
            </h1>
            <p className="mt-3 text-sm leading-7 text-slate-600 dark:text-slate-300">
              {product.description ?? 'این محصول هنوز توضیحی ندارد.'}
            </p>
          </div>

          <div className="flex items-end gap-3">
            <span className="nums text-2xl font-black text-slate-900 dark:text-slate-100">
              {formatToman(product.salePrice)}
            </span>
            <span className="text-xs text-slate-500">برای هر {product.unit}</span>
          </div>

          <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
            <span className="inline-flex items-center gap-1.5">
              <PackageCheck className="h-4 w-4 text-emerald-600" />
              {stock > 0 ? `${stock.toLocaleString('fa-IR')} عدد موجود` : 'فعلاً ناموجود'}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Truck className="h-4 w-4 text-brand-600" />
              هماهنگی ارسال با فروشنده
            </span>
          </div>

          <AddToCartButton product={product} size="lg" className="w-full" />

          <Link
            href={`/marketplace/b/${product.tenant.slug}`}
            className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm transition-shadow hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
          >
            {product.tenant.logoUrl ? (
              <img
                src={product.tenant.logoUrl}
                alt={product.tenant.name}
                className="h-11 w-11 rounded-xl object-cover"
              />
            ) : (
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-900/30">
                <Building2 className="h-5 w-5" />
              </span>
            )}
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-slate-900 dark:text-slate-100">
                {product.tenant.name}
              </p>
              <p className="mt-0.5 truncate text-xs text-slate-500">
                {industryLabel(product.tenant.industry)}
                {product.tenant.city ? ` • ${product.tenant.city}` : ''}
              </p>
            </div>
            <span className="mr-auto text-xs font-medium text-brand-600">ویترین کسب‌وکار</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

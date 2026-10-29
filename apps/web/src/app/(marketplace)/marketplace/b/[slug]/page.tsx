import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Building2, MapPin, Phone, Store } from 'lucide-react';
import { industryLabel } from '@repo/shared';
import { marketplaceGet, type MarketplaceStorefront } from '@/lib/marketplace';
import { ProductCard } from '@/components/marketplace/product-card';
import { ServiceCard } from '@/components/marketplace/service-card';
import { EmptyState } from '@/components/ui/empty-state';

async function getStorefront(slug: string): Promise<MarketplaceStorefront | null> {
  try {
    return await marketplaceGet<MarketplaceStorefront>(`/businesses/${slug}`);
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const storefront = await getStorefront(slug);
  return {
    title: storefront ? storefront.tenant.name : 'کسب‌وکار',
    description: storefront?.tenant.tagline ?? undefined,
  };
}

export default async function BusinessStorefrontPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const storefront = await getStorefront(slug);
  if (!storefront) notFound();
  const { tenant, products, services } = storefront;

  return (
    <div className="space-y-8">
      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="h-24 bg-gradient-to-l from-brand-600 via-brand-500 to-cyan-500" />
        <div className="-mt-10 flex flex-col gap-4 p-5 sm:flex-row sm:items-end">
          {tenant.logoUrl ? (
            <img
              src={tenant.logoUrl}
              alt={tenant.name}
              className="h-20 w-20 rounded-2xl border-4 border-white object-cover shadow-sm dark:border-slate-900"
            />
          ) : (
            <span className="flex h-20 w-20 items-center justify-center rounded-2xl border-4 border-white bg-brand-50 text-brand-600 shadow-sm dark:border-slate-900 dark:bg-brand-900/30">
              <Building2 className="h-8 w-8" />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-black text-slate-900 dark:text-slate-100">{tenant.name}</h1>
            <p className="mt-1 text-sm text-slate-500">
              {industryLabel(tenant.industry)}
              {tenant.city ? ` • ${tenant.city}` : ''}
            </p>
            {tenant.tagline ? (
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{tenant.tagline}</p>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap gap-4 border-t border-slate-100 px-5 py-3 text-xs text-slate-500 dark:border-slate-800">
          {tenant.address ? (
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5" />
              {tenant.address}
            </span>
          ) : null}
          {tenant.phone ? (
            <a href={`tel:${tenant.phone}`} className="inline-flex items-center gap-1.5 hover:text-brand-600">
              <Phone className="h-3.5 w-3.5" />
              {tenant.phone}
            </a>
          ) : null}
          <span className="nums mr-auto">
            {products.length} محصول • {services.length} خدمت
          </span>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-black text-slate-900 dark:text-slate-100">محصولات</h2>
        {products.length > 0 ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={Store}
            title="محصولی منتشر نشده"
            description="این کسب‌وکار هنوز محصولی در بازارگاه ندارد."
          />
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-black text-slate-900 dark:text-slate-100">خدمات</h2>
        {services.length > 0 ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {services.map((service) => (
              <ServiceCard key={service.id} service={service} />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={Store}
            title="خدمتی منتشر نشده"
            description="این کسب‌وکار هنوز خدمتی در بازارگاه ندارد."
          />
        )}
      </section>

      <div className="text-center">
        <Link href="/marketplace/businesses" className="text-sm text-brand-600 hover:text-brand-700">
          دیدن همهٔ کسب‌وکارها
        </Link>
      </div>
    </div>
  );
}

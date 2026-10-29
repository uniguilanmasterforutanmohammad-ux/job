import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, Building2, Search, Sparkles, Store } from 'lucide-react';
import { industryLabel } from '@repo/shared';
import {
  marketplaceGet,
  type MarketplaceBusiness,
  type MarketplaceFacets,
  type MarketplacePage,
  type MarketplaceProduct,
  type MarketplaceService,
} from '@/lib/marketplace';
import { ProductCard } from '@/components/marketplace/product-card';
import { ServiceCard } from '@/components/marketplace/service-card';
import { EmptyState } from '@/components/ui/empty-state';

export const metadata: Metadata = {
  title: 'بازارگاه محصولات و خدمات اصناف',
  description:
    'محصولات فروشگاه‌ها و خدمات اصناف مختلف — کلاس ورزشی، آموزش موسیقی، زبان، زیبایی و بیشتر — را یکجا ببینید و خرید کنید.',
};

const EMPTY_PAGE = <T,>(): MarketplacePage<T> => ({
  data: [],
  meta: { page: 1, pageSize: 0, total: 0, totalPages: 1 },
});

async function safe<T>(promise: Promise<T>, fallback: T): Promise<T> {
  try {
    return await promise;
  } catch {
    return fallback;
  }
}

export default async function MarketplaceHomePage() {
  const [products, services, businesses, facets] = await Promise.all([
    safe(marketplaceGet<MarketplacePage<MarketplaceProduct>>('/products?pageSize=8'), EMPTY_PAGE()),
    safe(marketplaceGet<MarketplacePage<MarketplaceService>>('/services?pageSize=8'), EMPTY_PAGE()),
    safe(marketplaceGet<MarketplaceBusiness[]>('/businesses'), []),
    safe(marketplaceGet<MarketplaceFacets>('/facets'), {
      productCategories: [],
      serviceCategories: [],
      industries: [],
    }),
  ]);

  return (
    <div className="space-y-12">
      <section className="relative overflow-hidden rounded-3xl border border-brand-100 bg-gradient-to-br from-brand-50 via-white to-cyan-50 p-6 sm:p-10 dark:border-slate-800 dark:from-slate-900 dark:via-slate-950 dark:to-slate-900">
        <div className="absolute -left-16 -top-16 h-56 w-56 rounded-full bg-brand-200/40 blur-3xl dark:bg-brand-900/30" />
        <div className="relative grid items-center gap-8 lg:grid-cols-[1.2fr_1fr]">
          <div className="space-y-5">
            <span className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-white/70 px-3 py-1 text-xs font-medium text-brand-700 dark:border-brand-800 dark:bg-slate-900/60 dark:text-brand-200">
              <Sparkles className="h-4 w-4" />
              بازارگاه مشترک همهٔ اصناف
            </span>
            <h1 className="text-2xl font-black leading-[1.5] text-slate-900 sm:text-4xl dark:text-slate-100">
              محصولات و خدمات اصناف،
              <span className="text-brand-600"> در یک ویترین</span>
            </h1>
            <p className="max-w-xl text-sm leading-7 text-slate-600 sm:text-base dark:text-slate-300">
              از کفش ورزشی و لوازم تمرین تا کلاس موسیقی، زبان و جلسهٔ مشاوره؛ همهٔ
              کسب‌وکارهای عضو بازارگاه را ببینید، مقایسه کنید و مستقیم از همان مجموعه خرید
              کنید.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/marketplace/products"
                className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-brand-600/25 hover:bg-brand-700"
              >
                <Store className="h-4 w-4" />
                خرید محصولات
              </Link>
              <Link
                href="/marketplace/services"
                className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:border-brand-400 hover:text-brand-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
              >
                <Search className="h-4 w-4" />
                دیدن خدمات
              </Link>
            </div>
            <div className="flex flex-wrap gap-5 text-xs text-slate-500 dark:text-slate-400">
              <span className="nums">
                <b className="text-slate-900 dark:text-slate-100">{products.meta.total}</b> محصول
              </span>
              <span className="nums">
                <b className="text-slate-900 dark:text-slate-100">{services.meta.total}</b> خدمت
              </span>
              <span className="nums">
                <b className="text-slate-900 dark:text-slate-100">{businesses.length}</b> کسب‌وکار
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {facets.industries.slice(0, 6).map((industry) => (
              <Link
                key={industry}
                href={`/marketplace/services?industry=${encodeURIComponent(industry)}`}
                className="rounded-2xl border border-slate-200 bg-white/80 p-3 text-center text-xs font-medium text-slate-700 shadow-sm transition-colors hover:border-brand-300 hover:text-brand-700 dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-200"
              >
                {industryLabel(industry)}
              </Link>
            ))}
            {facets.industries.length === 0 ? (
              <p className="col-span-2 rounded-2xl border border-dashed border-slate-300 p-6 text-center text-xs text-slate-500">
                هنوز صنفی به بازارگاه نپیوسته است.
              </p>
            ) : null}
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-black text-slate-900 dark:text-slate-100">تازه‌ترین محصولات</h2>
          <Link
            href="/marketplace/products"
            className="inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:text-brand-700"
          >
            همهٔ محصولات
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </div>
        {products.data.length > 0 ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {products.data.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={Store}
            title="هنوز محصولی منتشر نشده است"
            description="کسب‌وکارها پس از اتصال به بازارگاه، محصولاتشان اینجا نمایش داده می‌شود."
          />
        )}
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-black text-slate-900 dark:text-slate-100">خدمات تازه</h2>
          <Link
            href="/marketplace/services"
            className="inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:text-brand-700"
          >
            همهٔ خدمات
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </div>
        {services.data.length > 0 ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {services.data.map((service) => (
              <ServiceCard key={service.id} service={service} />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={Sparkles}
            title="هنوز خدمتی منتشر نشده است"
            description="کلاس‌ها و خدمات کسب‌وکارهای عضو بازارگاه اینجا نمایش داده می‌شود."
          />
        )}
      </section>

      {businesses.length > 0 ? (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-black text-slate-900 dark:text-slate-100">کسب‌وکارهای بازارگاه</h2>
            <Link
              href="/marketplace/businesses"
              className="inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:text-brand-700"
            >
              همهٔ کسب‌وکارها
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {businesses.slice(0, 6).map((business) => (
              <Link
                key={business.slug}
                href={`/marketplace/b/${business.slug}`}
                className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
              >
                {business.logoUrl ? (
                  <img
                    src={business.logoUrl}
                    alt={business.name}
                    className="h-12 w-12 rounded-xl object-cover"
                  />
                ) : (
                  <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-900/30">
                    <Building2 className="h-5 w-5" />
                  </span>
                )}
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-slate-900 dark:text-slate-100">
                    {business.name}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
                    {industryLabel(business.industry)}
                    {business.city ? ` • ${business.city}` : ''}
                  </p>
                  <p className="nums mt-1 text-[11px] text-slate-400">
                    {business.productCount} محصول • {business.serviceCount} خدمت
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

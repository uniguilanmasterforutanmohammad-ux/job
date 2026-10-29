import type { Metadata } from 'next';
import Link from 'next/link';
import { Building2, MapPin, SearchX } from 'lucide-react';
import { industryLabel } from '@repo/shared';
import { marketplaceGet, toQueryString, type MarketplaceBusiness } from '@/lib/marketplace';
import { EmptyState } from '@/components/ui/empty-state';

export const metadata: Metadata = {
  title: 'کسب‌وکارهای بازارگاه',
  description: 'فهرست کسب‌وکارهای عضو بازارگاه به همراه تعداد محصولات و خدمات منتشرشده.',
};

type SearchParams = Record<string, string | string[] | undefined>;

function param(params: SearchParams, key: string): string {
  const value = params[key];
  return (Array.isArray(value) ? value[0] : value) ?? '';
}

export default async function MarketplaceBusinessesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const query = toQueryString({
    search: param(params, 'search') || undefined,
    industry: param(params, 'industry') || undefined,
    city: param(params, 'city') || undefined,
  });
  const businesses = await marketplaceGet<MarketplaceBusiness[]>(`/businesses${query}`).catch(
    () => [] as MarketplaceBusiness[],
  );

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-black text-slate-900 dark:text-slate-100">کسب‌وکارهای بازارگاه</h1>
        <p className="mt-1 text-sm text-slate-500">
          {businesses.length.toLocaleString('fa-IR')} مجموعه فعال
        </p>
      </div>

      <form
        method="get"
        className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-4 dark:border-slate-800 dark:bg-slate-900"
      >
        <label className="sm:col-span-2">
          <span className="mb-1 block text-xs text-slate-500">جست‌وجو</span>
          <input
            name="search"
            defaultValue={param(params, 'search')}
            placeholder="نام کسب‌وکار…"
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
          />
        </label>
        <label>
          <span className="mb-1 block text-xs text-slate-500">شهر</span>
          <input
            name="city"
            defaultValue={param(params, 'city')}
            placeholder="تهران…"
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
          />
        </label>
        <div className="flex items-end gap-2">
          <button
            type="submit"
            className="flex-1 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
          >
            جست‌وجو
          </button>
          <Link
            href="/marketplace/businesses"
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"
          >
            پاک
          </Link>
        </div>
      </form>

      {businesses.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {businesses.map((business) => (
            <Link
              key={business.slug}
              href={`/marketplace/b/${business.slug}`}
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
            >
              <div className="flex items-center gap-3">
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
                  <p className="mt-0.5 truncate text-xs text-slate-500">
                    {industryLabel(business.industry)}
                  </p>
                </div>
              </div>
              <p className="mt-3 line-clamp-2 min-h-[2.5rem] text-xs leading-5 text-slate-500">
                {business.tagline ?? 'بدون توضیح'}
              </p>
              <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {business.city ?? 'آنلاین'}
                </span>
                <span className="nums">
                  {business.productCount} محصول • {business.serviceCount} خدمت
                </span>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={SearchX}
          title="کسب‌وکاری پیدا نشد"
          description="عبارت جست‌وجو را تغییر دهید."
        />
      )}
    </div>
  );
}

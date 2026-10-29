import type { Metadata } from 'next';
import Link from 'next/link';
import { SearchX, SlidersHorizontal } from 'lucide-react';
import { industryLabel } from '@repo/shared';
import {
  marketplaceGet,
  toQueryString,
  type MarketplaceFacets,
  type MarketplacePage,
  type MarketplaceService,
} from '@/lib/marketplace';
import { ServiceCard } from '@/components/marketplace/service-card';
import { EmptyState } from '@/components/ui/empty-state';

export const metadata: Metadata = {
  title: 'خدمات اصناف — کلاس، جلسه و مشاوره',
  description:
    'کلاس ورزشی، آموزش موسیقی، زبان، زیبایی، مشاوره و سایر خدمات کسب‌وکارهای عضو بازارگاه.',
};

type SearchParams = Record<string, string | string[] | undefined>;

function param(params: SearchParams, key: string): string {
  const value = params[key];
  return (Array.isArray(value) ? value[0] : value) ?? '';
}

async function safe<T>(promise: Promise<T>, fallback: T): Promise<T> {
  try {
    return await promise;
  } catch {
    return fallback;
  }
}

export default async function MarketplaceServicesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const page = Math.max(1, Number(param(params, 'page') || 1));
  const query = toQueryString({
    search: param(params, 'search') || undefined,
    industry: param(params, 'industry') || undefined,
    category: param(params, 'category') || undefined,
    minPrice: param(params, 'minPrice') || undefined,
    maxPrice: param(params, 'maxPrice') || undefined,
    sort: param(params, 'sort') || 'newest',
    page,
    pageSize: 12,
  });

  const [result, facets] = await Promise.all([
    safe(
      marketplaceGet<MarketplacePage<MarketplaceService>>(`/services${query}`),
      { data: [], meta: { page, pageSize: 12, total: 0, totalPages: 1 } },
    ),
    safe<MarketplaceFacets>(marketplaceGet('/facets'), {
      productCategories: [],
      serviceCategories: [],
      industries: [],
    }),
  ]);

  const pageLink = (target: number) => {
    const next = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      const first = Array.isArray(value) ? value[0] : value;
      if (first && key !== 'page') next.set(key, first);
    }
    next.set('page', String(target));
    return `/marketplace/services?${next.toString()}`;
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-black text-slate-900 dark:text-slate-100">خدمات بازارگاه</h1>
        <p className="mt-1 text-sm text-slate-500">
          {result.meta.total.toLocaleString('fa-IR')} خدمت از کسب‌وکارهای عضو
        </p>
      </div>

      <form
        method="get"
        className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-6 dark:border-slate-800 dark:bg-slate-900"
      >
        <label className="lg:col-span-2">
          <span className="mb-1 block text-xs text-slate-500">جست‌وجو</span>
          <input
            name="search"
            defaultValue={param(params, 'search')}
            placeholder="نام کلاس، خدمت…"
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-950"
          />
        </label>
        <label>
          <span className="mb-1 block text-xs text-slate-500">صنف</span>
          <select
            name="industry"
            defaultValue={param(params, 'industry')}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
          >
            <option value="">همه</option>
            {facets.industries.map((industry) => (
              <option key={industry} value={industry}>
                {industryLabel(industry)}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="mb-1 block text-xs text-slate-500">دسته</span>
          <select
            name="category"
            defaultValue={param(params, 'category')}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
          >
            <option value="">همه</option>
            {facets.serviceCategories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="mb-1 block text-xs text-slate-500">مرتب‌سازی</span>
          <select
            name="sort"
            defaultValue={param(params, 'sort') || 'newest'}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
          >
            <option value="newest">تازه‌ترین</option>
            <option value="price_asc">ارزان‌ترین</option>
            <option value="price_desc">گران‌ترین</option>
            <option value="name">الفبا</option>
          </select>
        </label>
        <div className="flex items-end gap-2 lg:col-span-2">
          <label className="flex-1">
            <span className="mb-1 block text-xs text-slate-500">از قیمت</span>
            <input
              name="minPrice"
              inputMode="numeric"
              defaultValue={param(params, 'minPrice')}
              className="nums w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
            />
          </label>
          <label className="flex-1">
            <span className="mb-1 block text-xs text-slate-500">تا قیمت</span>
            <input
              name="maxPrice"
              inputMode="numeric"
              defaultValue={param(params, 'maxPrice')}
              className="nums w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
            />
          </label>
        </div>
        <div className="flex items-end gap-2 lg:col-span-2">
          <button
            type="submit"
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
          >
            <SlidersHorizontal className="h-4 w-4" />
            اعمال فیلتر
          </button>
          <Link
            href="/marketplace/services"
            className="rounded-xl border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            پاک کردن
          </Link>
        </div>
      </form>

      {result.data.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {result.data.map((service) => (
            <ServiceCard key={service.id} service={service} />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={SearchX}
          title="خدمتی پیدا نشد"
          description="فیلترها را تغییر دهید یا بعداً دوباره سر بزنید."
        />
      )}

      {result.meta.totalPages > 1 ? (
        <nav className="flex items-center justify-center gap-2 pt-2">
          {Array.from({ length: result.meta.totalPages }).map((_, index) => {
            const target = index + 1;
            const active = target === result.meta.page;
            return (
              <Link
                key={target}
                href={pageLink(target)}
                className={`nums inline-flex h-9 min-w-9 items-center justify-center rounded-xl border px-2 text-sm ${
                  active
                    ? 'border-brand-600 bg-brand-600 text-white'
                    : 'border-slate-300 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800'
                }`}
              >
                {target.toLocaleString('fa-IR')}
              </Link>
            );
          })}
        </nav>
      ) : null}
    </div>
  );
}

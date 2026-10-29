import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowRight, Building2, CalendarClock, MapPin, Phone } from 'lucide-react';
import { industryLabel } from '@repo/shared';
import {
  marketplaceGet,
  type MarketplaceService,
  type MarketplaceStorefront,
} from '@/lib/marketplace';
import { formatToman } from '@/lib/utils';

async function getService(id: string): Promise<MarketplaceService | null> {
  try {
    return await marketplaceGet<MarketplaceService>(`/services/${id}`);
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
  const service = await getService(id);
  return {
    title: service ? `${service.name} — ${service.tenant.name}` : 'خدمت',
    description: service?.description ?? undefined,
  };
}

export default async function ServiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const service = await getService(id);
  if (!service) notFound();

  const storefront = await marketplaceGet<MarketplaceStorefront>(
    `/businesses/${service.tenant.slug}`,
  ).catch(() => null);
  const contact = storefront?.tenant;

  return (
    <div className="space-y-5">
      <Link
        href="/marketplace/services"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-brand-600"
      >
        <ArrowRight className="h-4 w-4" />
        بازگشت به خدمات
      </Link>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          {service.imageUrl ? (
            <img
              src={service.imageUrl}
              alt={service.name}
              className="aspect-[4/3] w-full object-cover"
            />
          ) : (
            <div className="aspect-[4/3] w-full bg-gradient-to-br from-brand-50 to-brand-100 dark:from-slate-800 dark:to-slate-700" />
          )}
        </div>

        <div className="space-y-4">
          <div>
            {service.category ? (
              <span className="rounded-full bg-brand-50 px-2.5 py-1 text-[11px] font-medium text-brand-700 dark:bg-brand-900/30 dark:text-brand-200">
                {service.category}
              </span>
            ) : null}
            <h1 className="mt-2 text-xl font-black text-slate-900 sm:text-2xl dark:text-slate-100">
              {service.name}
            </h1>
            <p className="mt-3 text-sm leading-7 text-slate-600 dark:text-slate-300">
              {service.description ?? 'این خدمت هنوز توضیحی ندارد.'}
            </p>
          </div>

          <div className="flex items-end gap-3">
            <span className="nums text-2xl font-black text-slate-900 dark:text-slate-100">
              {Number(service.price) > 0 ? formatToman(service.price) : 'رایگان'}
            </span>
            <span className="inline-flex items-center gap-1 text-xs text-slate-500">
              <CalendarClock className="h-3.5 w-3.5" />
              {service.durationMinutes} دقیقه
            </span>
          </div>

          <div className="space-y-2 rounded-2xl border border-slate-200 bg-white p-3.5 text-sm dark:border-slate-800 dark:bg-slate-900">
            <Link
              href={`/marketplace/b/${service.tenant.slug}`}
              className="flex items-center gap-2 font-bold text-slate-900 hover:text-brand-600 dark:text-slate-100"
            >
              <Building2 className="h-4 w-4 text-brand-600" />
              {service.tenant.name}
            </Link>
            <p className="text-xs text-slate-500">
              {industryLabel(service.tenant.industry)}
              {service.tenant.city ? ` • ${service.tenant.city}` : ''}
            </p>
            {contact?.address ? (
              <p className="flex items-start gap-2 text-xs text-slate-500">
                <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {contact.address}
              </p>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2">
            {contact?.phone ? (
              <a
                href={`tel:${contact.phone}`}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand-600 px-5 py-3 text-sm font-semibold text-white hover:bg-brand-700"
              >
                <Phone className="h-4 w-4" />
                تماس و رزرو
              </a>
            ) : (
              <Link
                href={`/marketplace/b/${service.tenant.slug}`}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand-600 px-5 py-3 text-sm font-semibold text-white hover:bg-brand-700"
              >
                <Building2 className="h-4 w-4" />
                مشاهدهٔ کسب‌وکار
              </Link>
            )}
            <Link
              href="/me"
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 hover:border-brand-400 hover:text-brand-700 dark:border-slate-700 dark:text-slate-200"
            >
              رزرو از پنل کاربری
            </Link>
          </div>
          <p className="text-[11px] leading-5 text-slate-400">
            رزرو نهایی پس از انتخاب زمان با مجموعه هماهنگ می‌شود.
          </p>
        </div>
      </div>
    </div>
  );
}

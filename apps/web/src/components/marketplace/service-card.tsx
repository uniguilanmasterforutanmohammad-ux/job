import Link from 'next/link';
import { Clock, ImageOff } from 'lucide-react';
import { formatToman } from '@/lib/utils';
import type { MarketplaceService } from '@/lib/marketplace';

export function ServiceCard({ service }: { service: MarketplaceService }) {
  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
      <Link href={`/marketplace/services/${service.id}`} className="block">
        <div className="relative aspect-[4/3] w-full overflow-hidden bg-slate-100 dark:bg-slate-800">
          {service.imageUrl ? (
            <img
              src={service.imageUrl}
              alt={service.name}
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-brand-50 to-brand-100 text-brand-400 dark:from-slate-800 dark:to-slate-700">
              <ImageOff className="h-10 w-10" />
            </div>
          )}
          {service.category ? (
            <span className="absolute right-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-medium text-slate-700 shadow-sm">
              {service.category}
            </span>
          ) : null}
        </div>
      </Link>

      <div className="flex flex-1 flex-col gap-2 p-3.5">
        <Link href={`/marketplace/services/${service.id}`}>
          <h3 className="line-clamp-1 text-sm font-bold text-slate-900 dark:text-slate-100">
            {service.name}
          </h3>
        </Link>
        <p className="line-clamp-2 min-h-[2.5rem] text-xs leading-5 text-slate-500 dark:text-slate-400">
          {service.description ?? 'بدون توضیح'}
        </p>
        <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
          <Link
            href={`/marketplace/b/${service.tenant.slug}`}
            className="truncate hover:text-brand-600"
          >
            {service.tenant.name}
          </Link>
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {service.durationMinutes} دقیقه
          </span>
        </div>
        <div className="mt-auto flex items-center justify-between gap-2 pt-1">
          <span className="nums text-sm font-black text-slate-900 dark:text-slate-100">
            {Number(service.price) > 0 ? formatToman(service.price) : 'رایگان'}
          </span>
          <Link
            href={`/marketplace/services/${service.id}`}
            className="rounded-xl bg-brand-600 px-3 py-2 text-xs font-semibold text-white hover:bg-brand-700"
          >
            مشاهده و رزرو
          </Link>
        </div>
      </div>
    </article>
  );
}

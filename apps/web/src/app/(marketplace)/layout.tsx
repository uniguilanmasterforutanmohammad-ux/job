import Link from 'next/link';
import { LayoutDashboard, Store } from 'lucide-react';
import { CartLink } from '@/components/marketplace/cart-link';
import type { Metadata } from 'next';

const site = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

export const metadata: Metadata = {
  metadataBase: new URL(site),
  alternates: { canonical: '/marketplace' },
  openGraph: {
    type: 'website',
    locale: 'fa_IR',
    siteName: 'بازارگاه اصناف',
    title: 'بازارگاه محصولات و خدمات اصناف',
    description:
      'محصولات فروشگاه‌ها و خدمات همهٔ اصناف — کلاس ورزشی، آموزش موسیقی، زبان، زیبایی و بیشتر — یک‌جا.',
    url: '/marketplace',
    images: [
      {
        url: '/marketplace/og-cover.png',
        width: 1200,
        height: 630,
        alt: 'بازارگاه محصولات و خدمات اصناف',
      },
    ],
  },
  twitter: { card: 'summary_large_image', images: ['/marketplace/og-cover.png'] },
};

export default function MarketplaceLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50 dark:bg-slate-950">
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-950/85">
        <nav className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-5 py-3">
          <Link href="/marketplace" className="flex items-center gap-2.5">
            <span className="rounded-xl bg-brand-600 p-2 text-white">
              <Store className="h-5 w-5" />
            </span>
            <span className="text-sm font-black text-slate-900 sm:text-base dark:text-slate-100">
              بازارگاه
            </span>
          </Link>

          <div className="hidden items-center gap-5 text-sm text-slate-600 md:flex dark:text-slate-300">
            <Link href="/marketplace/products" className="hover:text-brand-600">
              محصولات
            </Link>
            <Link href="/marketplace/services" className="hover:text-brand-600">
              خدمات
            </Link>
            <Link href="/marketplace/businesses" className="hover:text-brand-600">
              کسب‌وکارها
            </Link>
            <Link href="/marketplace/orders" className="hover:text-brand-600">
              پیگیری سفارش
            </Link>
          </div>

          <div className="flex items-center gap-2">
            <CartLink />
            <Link
              href="/me"
              className="hidden rounded-xl px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 sm:inline-flex dark:text-slate-200 dark:hover:bg-slate-800"
            >
              پنل من
            </Link>
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3 py-2 text-xs font-medium text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900"
            >
              <LayoutDashboard className="h-3.5 w-3.5" />
              پلتفرم
            </Link>
          </div>
        </nav>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-7">{children}</main>

      <footer className="border-t border-slate-200 bg-white py-6 dark:border-slate-800 dark:bg-slate-950">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-5 text-xs text-slate-500 sm:flex-row">
          <span>بازارگاه محصولات و خدمات اصناف</span>
          <div className="flex items-center gap-4">
            <Link href="/marketplace/products" className="hover:text-brand-600">
              محصولات
            </Link>
            <Link href="/marketplace/services" className="hover:text-brand-600">
              خدمات
            </Link>
            <Link href="/marketplace/orders" className="hover:text-brand-600">
              پیگیری سفارش
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

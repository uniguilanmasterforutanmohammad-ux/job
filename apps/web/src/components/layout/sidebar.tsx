'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BarChart3,
  CalendarClock,
  CalendarDays,
  CreditCard,
  FileSignature,
  Heart,
  LayoutDashboard,
  Megaphone,
  MessageCircle,
  Receipt,
  MessageSquare,
  Package,
  ShoppingBag,
  Settings,
  Sparkles,
  Users,
  UserCheck,
  UserCog,
  Wallet,
} from 'lucide-react';
import type { ModuleKey } from '@repo/shared';
import { cn } from '@/lib/utils';

type NavItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  module?: ModuleKey;
};

const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard', label: 'داشبورد', icon: LayoutDashboard },
  { href: '/customers', label: 'مشتریان', icon: Users, module: 'CRM' },
  { href: '/appointments', label: 'نوبت‌ها', icon: CalendarDays, module: 'SCH' },
  { href: '/services', label: 'خدمات', icon: CalendarClock, module: 'SCH' },
  { href: '/subscriptions', label: 'اشتراک و شهریه', icon: CreditCard, module: 'SUB' },
  { href: '/attendance', label: 'حضور و غیاب', icon: UserCheck, module: 'ATT' },
  { href: '/invoices', label: 'فاکتورها', icon: CreditCard, module: 'FIN' },
  { href: '/payments', label: 'پرداخت‌ها', icon: Wallet, module: 'FIN' },
  { href: '/finance', label: 'اقساط و هزینه', icon: Wallet, module: 'FIN' },
  { href: '/finance/advanced', label: 'کیف پول و استرداد', icon: Receipt, module: 'FIN' },
  { href: '/messages', label: 'پیام‌ها', icon: MessageSquare, module: 'MSG' },
  { href: '/messages/chat', label: 'گفتگوی مشتریان', icon: MessageCircle, module: 'MSG' },
  { href: '/campaigns', label: 'کمپین‌ها', icon: Heart, module: 'CAMP' },
  { href: '/inventory', label: 'موجودی و انبار', icon: Package, module: 'INV' },
  { href: '/shop', label: 'فروش آنلاین', icon: ShoppingBag, module: 'SHOP' },
  { href: '/staff', label: 'کارکنان', icon: UserCog, module: 'HR' },
  { href: '/marketing', label: 'وفاداری و بازاریابی', icon: Sparkles, module: 'MKT' },
  { href: '/marketing/campaigns', label: 'کمپین پیامکی', icon: Megaphone, module: 'MKT' },
  { href: '/documents', label: 'اسناد و قرارداد', icon: FileSignature, module: 'DOC' },
  { href: '/reports', label: 'گزارش‌ها', icon: BarChart3, module: 'RPT' },
  { href: '/team', label: 'کاربران و نقش‌ها', icon: UserCog },
  { href: '/settings', label: 'تنظیمات', icon: Settings },
];

export function Sidebar({
  enabledModules,
  customersLabel = 'مشتریان',
}: {
  enabledModules: ModuleKey[];
  /** Industry-specific plural of the business's end-users («زبان‌آموزان»…). */
  customersLabel?: string;
}) {
  const pathname = usePathname();
  const items = NAV_ITEMS.filter(
    (item) => !item.module || enabledModules.includes(item.module),
  ).map((item) => {
    if (item.href === '/customers') return { ...item, label: customersLabel };
    if (item.href === '/messages/chat') return { ...item, label: `گفتگوی ${customersLabel}` };
    return item;
  });

  return (
    <aside className="hidden w-64 shrink-0 border-l border-slate-200 bg-white lg:block dark:border-slate-800 dark:bg-slate-900">
      <div className="flex h-16 items-center gap-2 border-b border-slate-100 px-5 dark:border-slate-800">
        <div className="rounded-lg bg-brand-600 p-1.5 text-white">
          <LayoutDashboard className="h-5 w-5" />
        </div>
        <span className="font-bold text-slate-900 dark:text-slate-100">مدیریت کسب‌وکار</span>
      </div>
      <nav className="space-y-1 p-3">
        {items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                active
                  ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-200'
                  : 'text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800',
              )}
            >
              <Icon className="h-4.5 w-4.5" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

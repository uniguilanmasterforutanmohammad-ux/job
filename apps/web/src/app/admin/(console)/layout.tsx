'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Building2,
  LayoutDashboard,
  LogOut,
  ScrollText,
  ShieldCheck,
  Users,
  Layers,
  Tags,
  UserCog,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/empty-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { isAtLeast, useAdminAuth } from '@/lib/admin-auth';
import { toast } from 'sonner';

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: 'مدیر ارشد',
  ADMIN: 'مدیر پلتفرم',
  SUPPORT: 'پشتیبانی',
};

const NAV = [
  { href: '/admin', label: 'داشبورد پلتفرم', icon: LayoutDashboard },
  { href: '/admin/tenants', label: 'کسب‌وکارها', icon: Building2 },
  { href: '/admin/industries', label: 'صنف‌ها و حوزه‌ها', icon: Tags, min: 'ADMIN' as const },
  { href: '/admin/plans', label: 'پلن‌ها', icon: Layers, min: 'SUPER_ADMIN' as const },
  { href: '/admin/audit', label: 'گزارش تغییرات', icon: ScrollText, min: 'ADMIN' as const },
  { href: '/admin/team', label: 'مدیران پلتفرم', icon: Users, min: 'SUPER_ADMIN' as const },
  { href: '/admin/account', label: 'حساب من و ۲FA', icon: UserCog },
];

export default function AdminConsoleLayout({ children }: { children: React.ReactNode }) {
  const { operator, loading, logout } = useAdminAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !operator) router.replace('/admin/login');
  }, [loading, operator, router]);

  useEffect(() => {
    const handler = () => {
      toast.error('برای ادامه کار باید ورود دو مرحله‌ای (۲FA) را فعال کنید.');
      router.replace('/admin/account');
    };
    window.addEventListener('bp:two-factor-required', handler);
    return () => window.removeEventListener('bp:two-factor-required', handler);
  }, [router]);

  if (loading || !operator) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-8 dark:bg-slate-950">
        <div className="w-full max-w-md space-y-3">
          <Skeleton className="h-10 w-1/2" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    );
  }

  const items = NAV.filter((item) => !item.min || isAtLeast(operator.role, item.min));

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-950">
      <aside className="hidden w-64 shrink-0 border-l border-slate-200 bg-slate-900 lg:block dark:border-slate-800">
        <div className="flex h-16 items-center gap-2 border-b border-slate-800 px-5">
          <div className="rounded-lg bg-slate-700 p-1.5 text-white">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <span className="font-bold text-white">بنل مدیریت پلتفرم</span>
        </div>
        <nav className="space-y-1 p-3">
          {items.map((item) => {
            const active = item.href === '/admin' ? pathname === '/admin' : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                  active
                    ? 'bg-slate-700 text-white'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200',
                )}
              >
                <Icon className="h-4.5 w-4.5" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-slate-200 bg-white/80 px-5 backdrop-blur dark:border-slate-800 dark:bg-slate-900/80">
          <div className="text-sm">
            <p className="font-semibold text-slate-900 dark:text-slate-100">{operator.fullName}</p>
            <p className="text-xs text-slate-500 nums" dir="ltr">
              {operator.phone}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge tone="brand">{ROLE_LABELS[operator.role] ?? operator.role}</Badge>
            <Button variant="ghost" size="sm" onClick={() => void logout()}>
              <LogOut className="h-4 w-4" />
              خروج
            </Button>
          </div>
        </header>
        <main className="flex-1 p-5 lg:p-7">{children}</main>
      </div>
    </div>
  );
}

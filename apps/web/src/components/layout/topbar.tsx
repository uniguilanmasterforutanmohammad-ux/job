'use client';

import { LogOut, Moon, Sun, User } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SYSTEM_ROLE_LABELS, type SystemRole } from '@repo/shared';

export function Topbar() {
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();

  const roleLabel = user ? SYSTEM_ROLE_LABELS[user.systemRole as SystemRole] ?? user.systemRole : '';

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-slate-200 bg-white/80 px-5 backdrop-blur dark:border-slate-800 dark:bg-slate-900/80">
      <div className="flex items-center gap-3">
        <div className="lg:hidden rounded-lg bg-brand-600 p-1.5 text-white">
          <User className="h-4 w-4" />
        </div>
        <div className="text-sm">
          <p className="font-semibold text-slate-900 dark:text-slate-100">{user?.tenantName ?? '—'}</p>
          <p className="text-xs text-slate-500">{user?.fullName}</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {roleLabel && <Badge tone="brand">{roleLabel}</Badge>}
        <Button
          variant="ghost"
          size="icon"
          aria-label="تغییر پوسته"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        >
          <Sun className="h-4 w-4 dark:hidden" />
          <Moon className="hidden h-4 w-4 dark:block" />
        </Button>
        <Button variant="ghost" size="sm" onClick={() => void logout()}>
          <LogOut className="h-4 w-4" />
          خروج
        </Button>
      </div>
    </header>
  );
}

'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Check, Loader2, Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import { api, ApiClientError } from '@/lib/api-client';
import { getAdminToken, isAtLeast, useAdminAuth } from '@/lib/admin-auth';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState, Skeleton } from '@/components/ui/empty-state';
import type { AdminTenantModules } from '@/lib/admin-types';

export function ModuleGrid({ tenantId }: { tenantId: string }) {
  const token = getAdminToken();
  const queryClient = useQueryClient();
  const { operator } = useAdminAuth();
  const canEdit = isAtLeast(operator?.role, 'ADMIN');

  const query = useQuery({
    queryKey: ['admin-tenant-modules', tenantId],
    queryFn: () => api.get<AdminTenantModules>(`/admin/tenants/${tenantId}/modules`, token),
  });

  const grant = useMutation({
    mutationFn: (key: string) =>
      api.post(`/admin/tenants/${tenantId}/modules/grant`, { keys: [key], withDependencies: true }, token),
    onSuccess: () => {
      toast.success('ماژول فعال شد');
      void queryClient.invalidateQueries({ queryKey: ['admin-tenant-modules', tenantId] });
      void queryClient.invalidateQueries({ queryKey: ['admin-tenant', tenantId] });
    },
    onError: (error) =>
      toast.error(error instanceof ApiClientError ? error.message : 'خطا در فعال‌سازی ماژول'),
  });

  const revoke = useMutation({
    mutationFn: (key: string) =>
      api.post(`/admin/tenants/${tenantId}/modules/revoke`, { key, cascade: true }, token),
    onSuccess: (data) => {
      const disabled = (data as { disabled: string[] }).disabled;
      toast.success(
        disabled.length > 1
          ? `ماژول و ${disabled.length - 1} ماژول وابسته غیرفعال شدند`
          : 'ماژول غیرفعال شد',
      );
      void queryClient.invalidateQueries({ queryKey: ['admin-tenant-modules', tenantId] });
      void queryClient.invalidateQueries({ queryKey: ['admin-tenant', tenantId] });
    },
    onError: (error) =>
      toast.error(error instanceof ApiClientError ? error.message : 'خطا در غیرفعال‌سازی ماژول'),
  });

  if (query.isLoading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-24 w-full" />
        ))}
      </div>
    );
  }

  if (!query.data) {
    return <EmptyState title="ماژول‌ها بارگذاری نشد" />;
  }

  const { modules, enabledCount, totalCount } = query.data;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3 dark:bg-slate-800/50">
        <p className="text-sm text-slate-600 dark:text-slate-300">
          <span className="font-semibold nums">{enabledCount}</span> از{' '}
          <span className="nums">{totalCount}</span> ماژول فعال است
        </p>
        {!canEdit && <Badge tone="warning">فقط خواندنی — سطح دسترسی شما کافی نیست</Badge>}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {modules.map((module) => {
          const busy = grant.isPending || revoke.isPending;
          const broken = module.isEnabled && module.missingDependencies.length > 0;
          return (
            <div
              key={module.key}
              className={cn(
                'flex flex-col justify-between rounded-2xl border p-4 transition',
                module.isEnabled
                  ? 'border-brand-200 bg-brand-50/60 dark:border-brand-900 dark:bg-brand-950/30'
                  : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900',
                broken && 'border-amber-300 bg-amber-50/60 dark:border-amber-800',
              )}
            >
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-slate-900 dark:text-slate-100">{module.label}</p>
                    <p className="text-xs text-slate-400 nums" dir="ltr">
                      {module.key}
                    </p>
                  </div>
                  {module.isEnabled ? (
                    <Badge tone="success">
                      <Check className="h-3 w-3" />
                      فعال
                    </Badge>
                  ) : (
                    <Badge tone="neutral">
                      <X className="h-3 w-3" />
                      غیرفعال
                    </Badge>
                  )}
                </div>
                {module.dependencies.length > 0 && (
                  <p className="text-xs text-slate-500">
                    پیش‌نیاز: <span className="nums">{module.dependencies.join('، ')}</span>
                  </p>
                )}
                {broken && (
                  <p className="flex items-center gap-1 text-xs text-amber-700">
                    <AlertTriangle className="h-3 w-3" />
                    پیش‌نیاز فعال نیست: {module.missingDependencies.join('، ')}
                  </p>
                )}
              </div>

              {canEdit && (
                <div className="mt-3">
                  {module.isEnabled ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      disabled={busy}
                      onClick={() => revoke.mutate(module.key)}
                    >
                      {revoke.isPending && revoke.variables === module.key ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <X className="h-4 w-4" />
                      )}
                      غیرفعال‌سازی
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      className="w-full"
                      disabled={busy}
                      onClick={() => grant.mutate(module.key)}
                    >
                      {grant.isPending && grant.variables === module.key ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Plus className="h-4 w-4" />
                      )}
                      فعال‌سازی
                    </Button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

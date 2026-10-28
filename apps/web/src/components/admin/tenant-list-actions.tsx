'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Ban, CheckCircle2, Loader2, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { MODULE_LABELS } from '@repo/shared';
import { api, ApiClientError } from '@/lib/api-client';
import { getAdminToken, isAtLeast, useAdminAuth } from '@/lib/admin-auth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { AdminTenantSummary } from '@/lib/admin-types';

/**
 * Module summary for a tenant-list row: how many modules are on, which industry
 * defaults are still missing, and a one-click way to add them.
 */
export function TenantModulesCell({ tenant }: { tenant: AdminTenantSummary }) {
  const token = getAdminToken();
  const queryClient = useQueryClient();
  const { operator } = useAdminAuth();
  const canEdit = isAtLeast(operator?.role, 'ADMIN');
  const missing = tenant.missingDefaultModules ?? [];

  const grantDefaults = useMutation({
    mutationFn: () =>
      api.post(
        `/admin/tenants/${tenant.id}/modules/grant`,
        { keys: missing, withDependencies: true },
        token,
      ),
    onSuccess: () => {
      toast.success('ماژول‌های پیش‌فرض صنف فعال شدند');
      void queryClient.invalidateQueries({ queryKey: ['admin-tenants'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-tenant-modules', tenant.id] });
    },
    onError: (error) =>
      toast.error(
        error instanceof ApiClientError ? error.message : 'فعال‌سازی ماژول‌ها ناموفق بود',
      ),
  });

  return (
    <div className="space-y-1.5">
      <p className="text-xs text-slate-500">
        <span className="font-semibold nums">{tenant.enabledModuleKeys.length}</span> ماژول فعال
      </p>
      {missing.length > 0 ? (
        <>
          <p
            className="text-[11px] text-amber-700 nums"
            title={missing.map((key) => MODULE_LABELS[key]).join('، ')}
          >
            {missing.length} ماژول پیش‌فرض غیرفعال
          </p>
          {canEdit && (
            <Button
              size="sm"
              variant="outline"
              disabled={grantDefaults.isPending}
              onClick={() => grantDefaults.mutate()}
            >
              {grantDefaults.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Plus className="h-3.5 w-3.5" />
              )}
              افزودن پیش‌فرض‌ها
            </Button>
          )}
        </>
      ) : (
        <Badge tone="success">پیش‌فرض‌های صنف کامل</Badge>
      )}
    </div>
  );
}

/**
 * Activates / deactivates a business. Deactivated (SUSPENDED) businesses no
 * longer appear in the new-user signup directory.
 */
export function TenantStatusToggle({ tenant }: { tenant: AdminTenantSummary }) {
  const token = getAdminToken();
  const queryClient = useQueryClient();
  const { operator } = useAdminAuth();
  const canEdit = isAtLeast(operator?.role, 'ADMIN');

  const change = useMutation({
    mutationFn: (status: 'ACTIVE' | 'SUSPENDED') =>
      api.post(`/admin/tenants/${tenant.id}/status`, { status }, token),
    onSuccess: (_data, status) => {
      toast.success(status === 'ACTIVE' ? 'کسب‌وکار فعال شد' : 'کسب‌وکار غیرفعال شد');
      void queryClient.invalidateQueries({ queryKey: ['admin-tenants'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-tenant', tenant.id] });
    },
    onError: (error) =>
      toast.error(error instanceof ApiClientError ? error.message : 'تغییر وضعیت ناموفق بود'),
  });

  if (!canEdit) return null;

  const isActive = tenant.status === 'ACTIVE';
  return (
    <Button
      size="sm"
      variant={isActive ? 'outline' : 'primary'}
      disabled={change.isPending}
      onClick={() => change.mutate(isActive ? 'SUSPENDED' : 'ACTIVE')}
    >
      {change.isPending ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : isActive ? (
        <Ban className="h-3.5 w-3.5" />
      ) : (
        <CheckCircle2 className="h-3.5 w-3.5" />
      )}
      {isActive ? 'غیرفعال‌سازی' : 'فعال‌سازی'}
    </Button>
  );
}

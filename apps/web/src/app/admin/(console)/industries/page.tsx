'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ban, CheckCircle2, Loader2, Layers, Tags, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { MODULE_KEYS, MODULE_LABELS, type ModuleKey } from '@repo/shared';
import { api, ApiClientError } from '@/lib/api-client';
import { getAdminToken, isAtLeast, useAdminAuth } from '@/lib/admin-auth';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/modal';
import { Card, CardBody } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState, Skeleton } from '@/components/ui/empty-state';
import type { AdminIndustry } from '@/lib/admin-types';

/**
 * Industry registry (PRD §17). Two things are managed per industry:
 * whether new businesses may register in it (`/register` hides disabled ones)
 * and which modules a new business of that industry starts with.
 */
export default function AdminIndustriesPage() {
  const token = getAdminToken();
  const queryClient = useQueryClient();
  const { operator } = useAdminAuth();
  const canEdit = isAtLeast(operator?.role, 'ADMIN');
  const [editing, setEditing] = useState<AdminIndustry | null>(null);

  const query = useQuery({
    queryKey: ['admin-industries'],
    queryFn: () => api.get<AdminIndustry[]>('/admin/industries', token),
  });

  const toggleRegistration = useMutation({
    mutationFn: (industry: AdminIndustry) =>
      api.post(
        `/admin/industries/${industry.industry}/registration`,
        { isRegistrationEnabled: !industry.isRegistrationEnabled },
        token,
      ),
    onSuccess: (data, industry) => {
      const updated = data as AdminIndustry;
      toast.success(
        updated.isRegistrationEnabled
          ? `ثبت‌نام صنف «${industry.label}» فعال شد`
          : `ثبت‌نام صنف «${industry.label}» غیرفعال شد`,
      );
      void queryClient.invalidateQueries({ queryKey: ['admin-industries'] });
      void queryClient.invalidateQueries({ queryKey: ['public-industries'] });
    },
    onError: (error) =>
      toast.error(error instanceof ApiClientError ? error.message : 'تغییر وضعیت ثبت‌نام ناموفق بود'),
  });

  if (query.isLoading) {
    return (
      <div className="grid gap-3 lg:grid-cols-2">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-32 w-full" />
        ))}
      </div>
    );
  }

  if (!query.data?.length) {
    return <EmptyState icon={Tags} title="صنفی یافت نشد" />;
  }

  const industries = query.data;
  const disabledCount = industries.filter((item) => !item.isRegistrationEnabled).length;

  return (
    <div className="space-y-5">
      <PageHeader
        title="صنف‌ها و حوزه‌های فعالیت"
        description="مدیریت امکان ثبت‌نام هر صنف و ماژول‌های پیش‌فرضی که کسب‌وکار جدید آن صنف با آن‌ها شروع می‌کند"
      />

      <div className="flex flex-wrap items-center gap-3 rounded-xl bg-slate-50 px-4 py-3 text-sm dark:bg-slate-800/50">
        <span className="nums">
          {industries.length} صنف — {industries.length - disabledCount} فعال برای ثبت‌نام
        </span>
        {disabledCount > 0 && <Badge tone="danger">{disabledCount} صنف ثبت‌نام غیرفعال</Badge>}
        {!canEdit && <Badge tone="warning">فقط خواندنی — سطح دسترسی شما کافی نیست</Badge>}
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {industries.map((industry) => (
          <Card key={industry.industry}>
            <CardBody className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-slate-900 dark:text-slate-100">{industry.label}</p>
                  <p className="text-xs text-slate-400 nums" dir="ltr">
                    {industry.industry}
                  </p>
                </div>
                {industry.isRegistrationEnabled ? (
                  <Badge tone="success">ثبت‌نام فعال</Badge>
                ) : (
                  <Badge tone="danger">ثبت‌نام غیرفعال</Badge>
                )}
              </div>

              <div className="space-y-1.5">
                <p className="flex items-center gap-1 text-xs text-slate-500">
                  <Layers className="h-3.5 w-3.5" />
                  ماژول‌های پیش‌فرض ({industry.defaultModules.length})
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {industry.defaultModules.length ? (
                    industry.defaultModules.map((key) => (
                      <Badge key={key} tone="brand">
                        {MODULE_LABELS[key]}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-xs text-slate-400">
                      بدون ماژول پیش‌فرض — کسب‌وکار جدید بدون ماژول ساخته می‌شود
                    </span>
                  )}
                </div>
              </div>

              {canEdit && (
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button
                    size="sm"
                    variant={industry.isRegistrationEnabled ? 'outline' : 'primary'}
                    disabled={toggleRegistration.isPending}
                    onClick={() => toggleRegistration.mutate(industry)}
                  >
                    {toggleRegistration.isPending &&
                    toggleRegistration.variables?.industry === industry.industry ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : industry.isRegistrationEnabled ? (
                      <Ban className="h-3.5 w-3.5" />
                    ) : (
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    )}
                    {industry.isRegistrationEnabled ? 'غیرفعال‌سازی ثبت‌نام' : 'فعال‌سازی ثبت‌نام'}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setEditing(industry)}>
                    <Pencil className="h-3.5 w-3.5" />
                    ویرایش ماژول‌ها
                  </Button>
                </div>
              )}
            </CardBody>
          </Card>
        ))}
      </div>

      {editing && <IndustryModulesDialog industry={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

/** Checkbox grid for the default module set of one industry. */
function IndustryModulesDialog({
  industry,
  onClose,
}: {
  industry: AdminIndustry;
  onClose: () => void;
}) {
  const token = getAdminToken();
  const queryClient = useQueryClient();
  const [keys, setKeys] = useState<ModuleKey[]>(industry.defaultModules);

  const save = useMutation({
    mutationFn: () =>
      api.put<AdminIndustry>(
        `/admin/industries/${industry.industry}/modules`,
        { keys },
        token,
      ),
    onSuccess: (data) => {
      toast.success(`ماژول‌های پیش‌فرض «${data.label}» ذخیره شد`);
      void queryClient.invalidateQueries({ queryKey: ['admin-industries'] });
      void queryClient.invalidateQueries({ queryKey: ['public-industries'] });
      onClose();
    },
    onError: (error) =>
      toast.error(error instanceof ApiClientError ? error.message : 'ذخیره ماژول‌ها ناموفق بود'),
  });

  return (
    <Modal
      open
      onClose={() => !save.isPending && onClose()}
      title={`ماژول‌های پیش‌فرض ${industry.label}`}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={save.isPending}>
            انصراف
          </Button>
          <Button loading={save.isPending} onClick={() => save.mutate()}>
            ذخیره
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <p className="text-xs leading-6 text-slate-500">
          کسب‌وکار جدیدی که این صنف را انتخاب کند، با این ماژول‌ها ساخته می‌شود (پیش‌نیازهای هر
          ماژول خودکار فعال می‌شوند). کسب‌وکارهای موجود تغییری نمی‌کنند.
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {MODULE_KEYS.map((key) => {
            const checked = keys.includes(key);
            return (
              <label
                key={key}
                className={cn(
                  'flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm transition',
                  checked
                    ? 'border-brand-300 bg-brand-50/60 dark:border-brand-800 dark:bg-brand-950/30'
                    : 'border-slate-200 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/40',
                )}
              >
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-brand-600"
                  checked={checked}
                  onChange={(event) =>
                    setKeys((prev) =>
                      event.target.checked ? [...prev, key] : prev.filter((item) => item !== key),
                    )
                  }
                />
                <span className="flex-1 text-slate-700 dark:text-slate-200">
                  {MODULE_LABELS[key]}
                </span>
                <span className="text-[10px] text-slate-400 nums">{key}</span>
              </label>
            );
          })}
        </div>
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span className="nums">{keys.length} ماژول انتخاب شده</span>
          <button
            type="button"
            className="text-brand-600 hover:underline"
            onClick={() => setKeys([])}
          >
            پاک‌کردن همه
          </button>
        </div>
      </div>
    </Modal>
  );
}

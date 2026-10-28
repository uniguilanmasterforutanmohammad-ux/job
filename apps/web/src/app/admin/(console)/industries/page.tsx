'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Ban,
  CheckCircle2,
  Loader2,
  Layers,
  Pencil,
  Plus,
  Tags,
  Trash2,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';
import { MODULE_KEYS, MODULE_LABELS, type ModuleKey } from '@repo/shared';
import { api, ApiClientError } from '@/lib/api-client';
import { getAdminToken, isAtLeast, useAdminAuth } from '@/lib/admin-auth';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { Card, CardBody } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState, Skeleton } from '@/components/ui/empty-state';
import type { AdminIndustry } from '@/lib/admin-types';

/**
 * Industry registry (PRD §17 + custom industries). Per industry the admin can
 * create a new one with an arbitrary title, manage whether new businesses may
 * register in it (`/register` hides disabled ones) and which modules a new
 * business of that industry starts with.
 */
export default function AdminIndustriesPage() {
  const token = getAdminToken();
  const queryClient = useQueryClient();
  const { operator } = useAdminAuth();
  const canEdit = isAtLeast(operator?.role, 'ADMIN');
  const [editingModules, setEditingModules] = useState<AdminIndustry | null>(null);
  const [formTarget, setFormTarget] = useState<AdminIndustry | 'new' | null>(null);

  const query = useQuery({
    queryKey: ['admin-industries'],
    queryFn: () => api.get<AdminIndustry[]>('/admin/industries', token),
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['admin-industries'] });
    void queryClient.invalidateQueries({ queryKey: ['public-industries'] });
  };

  const toggleRegistration = useMutation({
    mutationFn: (industry: AdminIndustry) =>
      api.post(
        `/admin/industries/${industry.key}/registration`,
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
      invalidate();
    },
    onError: (error) =>
      toast.error(error instanceof ApiClientError ? error.message : 'تغییر وضعیت ثبت‌نام ناموفق بود'),
  });

  const removeIndustry = useMutation({
    mutationFn: (industry: AdminIndustry) =>
      api.delete<AdminIndustry>(`/admin/industries/${industry.key}`, token),
    onSuccess: (data) => {
      toast.success(`صنف «${data.label}» حذف شد`);
      invalidate();
    },
    onError: (error) =>
      toast.error(error instanceof ApiClientError ? error.message : 'حذف صنف ناموفق بود'),
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
  const customCount = industries.filter((item) => !item.isSystem).length;
  const busyKey = removeIndustry.isPending ? removeIndustry.variables?.key : undefined;

  return (
    <div className="space-y-5">
      <PageHeader
        title="صنف‌ها و حوزه‌های فعالیت"
        description="ساخت صنف/شغل جدید با عنوان دلخواه، مدیریت امکان ثبت‌نام هر صنف و ماژول‌های پیش‌فرض کسب‌وکارهای تازهٔ آن"
        action={
          canEdit ? (
            <Button onClick={() => setFormTarget('new')}>
              <Plus className="h-4 w-4" />
              صنف / شغل جدید
            </Button>
          ) : undefined
        }
      />

      <div className="flex flex-wrap items-center gap-3 rounded-xl bg-slate-50 px-4 py-3 text-sm dark:bg-slate-800/50">
        <span className="nums">
          {industries.length} صنف — {industries.length - disabledCount} فعال برای ثبت‌نام
        </span>
        {customCount > 0 && <Badge tone="brand">{customCount} صنف سفارشی</Badge>}
        {disabledCount > 0 && <Badge tone="danger">{disabledCount} صنف ثبت‌نام غیرفعال</Badge>}
        {!canEdit && <Badge tone="warning">فقط خواندنی — سطح دسترسی شما کافی نیست</Badge>}
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {industries.map((industry) => (
          <Card key={industry.key}>
            <CardBody className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 font-medium text-slate-900 dark:text-slate-100">
                    <span className="truncate">{industry.label}</span>
                    {industry.isSystem ? (
                      <Badge tone="neutral">سیستمی</Badge>
                    ) : (
                      <Badge tone="brand">سفارشی</Badge>
                    )}
                  </p>
                  <p className="text-xs text-slate-400 nums" dir="ltr">
                    {industry.key}
                  </p>
                  {industry.description && (
                    <p className="mt-1 line-clamp-2 text-xs text-slate-500">
                      {industry.description}
                    </p>
                  )}
                </div>
                {industry.isRegistrationEnabled ? (
                  <Badge tone="success">ثبت‌نام فعال</Badge>
                ) : (
                  <Badge tone="danger">ثبت‌نام غیرفعال</Badge>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                <span className="flex items-center gap-1">
                  <Users className="h-3.5 w-3.5" />
                  <span className="nums">{industry.tenantCount}</span> کسب‌وکار
                </span>
                {industry.endUserNoun && (
                  <span>
                    کاربران نهایی این صنف: <span className="font-medium">{industry.endUserNoun}</span>
                  </span>
                )}
                {industry.branchNoun && (
                  <span>
                    شعبه‌های این صنف: <span className="font-medium">{industry.branchNoun}</span>
                  </span>
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
                    toggleRegistration.variables?.key === industry.key ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : industry.isRegistrationEnabled ? (
                      <Ban className="h-3.5 w-3.5" />
                    ) : (
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    )}
                    {industry.isRegistrationEnabled ? 'غیرفعال‌سازی ثبت‌نام' : 'فعال‌سازی ثبت‌نام'}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setEditingModules(industry)}>
                    <Layers className="h-3.5 w-3.5" />
                    ماژول‌ها
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setFormTarget(industry)}>
                    <Pencil className="h-3.5 w-3.5" />
                    ویرایش
                  </Button>
                  {!industry.isSystem && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                      disabled={removeIndustry.isPending}
                      onClick={() => {
                        if (
                          window.confirm(
                            `صنف «${industry.label}» حذف شود؟ این کار برگشت‌پذیر نیست.`,
                          )
                        ) {
                          removeIndustry.mutate(industry);
                        }
                      }}
                    >
                      {busyKey === industry.key ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                      حذف
                    </Button>
                  )}
                </div>
              )}
            </CardBody>
          </Card>
        ))}
      </div>

      {editingModules && (
        <IndustryModulesDialog
          industry={editingModules}
          onClose={() => setEditingModules(null)}
        />
      )}
      {formTarget && (
        <IndustryFormDialog
          industry={formTarget === 'new' ? null : formTarget}
          onClose={() => setFormTarget(null)}
        />
      )}
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
      api.put<AdminIndustry>(`/admin/industries/${industry.key}/modules`, { keys }, token),
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
        <ModuleChecklist keys={keys} onChange={setKeys} />
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span className="nums">{keys.length} ماژول انتخاب شده</span>
          <button type="button" className="text-brand-600 hover:underline" onClick={() => setKeys([])}>
            پاک‌کردن همه
          </button>
        </div>
      </div>
    </Modal>
  );
}

type FormState = {
  label: string;
  key: string;
  description: string;
  endUserNoun: string;
  endUserNounPlural: string;
  branchNoun: string;
  branchNounPlural: string;
  sortOrder: string;
  isRegistrationEnabled: boolean;
  modules: ModuleKey[];
};

/**
 * Creates a brand-new industry/job (`POST /admin/industries`) with an arbitrary
 * Persian title and any subset of modules, or edits the title/metadata of an
 * existing one (`PATCH /admin/industries/:key`).
 */
function IndustryFormDialog({
  industry,
  onClose,
}: {
  industry: AdminIndustry | null;
  onClose: () => void;
}) {
  const token = getAdminToken();
  const queryClient = useQueryClient();
  const isEdit = Boolean(industry);
  const [form, setForm] = useState<FormState>({
    label: industry?.label ?? '',
    key: industry?.key ?? '',
    description: industry?.description ?? '',
    endUserNoun: industry?.endUserNoun ?? '',
    endUserNounPlural: industry?.endUserNounPlural ?? '',
    branchNoun: industry?.branchNoun ?? '',
    branchNounPlural: industry?.branchNounPlural ?? '',
    sortOrder: industry ? String(industry.sortOrder) : '',
    isRegistrationEnabled: industry?.isRegistrationEnabled ?? true,
    modules: industry?.defaultModules ?? ['CRM'],
  });

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const save = useMutation({
    mutationFn: () => {
      const payload: Record<string, unknown> = {
        label: form.label.trim(),
        description: form.description.trim() || undefined,
        endUserNoun: form.endUserNoun.trim() || undefined,
        endUserNounPlural: form.endUserNounPlural.trim() || undefined,
        branchNoun: form.branchNoun.trim() || undefined,
        branchNounPlural: form.branchNounPlural.trim() || undefined,
      };
      if (form.sortOrder.trim()) payload.sortOrder = Number(form.sortOrder);

      if (isEdit && industry) {
        return api.patch<AdminIndustry>(`/admin/industries/${industry.key}`, payload, token);
      }
      return api.post<AdminIndustry>(
        '/admin/industries',
        {
          ...payload,
          ...(form.key.trim() ? { key: form.key.trim() } : {}),
          isRegistrationEnabled: form.isRegistrationEnabled,
          modules: form.modules,
        },
        token,
      );
    },
    onSuccess: (data) => {
      toast.success(isEdit ? `صنف «${data.label}» به‌روزرسانی شد` : `صنف «${data.label}» ساخته شد`);
      void queryClient.invalidateQueries({ queryKey: ['admin-industries'] });
      void queryClient.invalidateQueries({ queryKey: ['public-industries'] });
      onClose();
    },
    onError: (error) =>
      toast.error(error instanceof ApiClientError ? error.message : 'ذخیره صنف ناموفق بود'),
  });

  return (
    <Modal
      open
      onClose={() => !save.isPending && onClose()}
      title={isEdit ? `ویرایش صنف «${industry?.label}»` : 'صنف / شغل جدید'}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={save.isPending}>
            انصراف
          </Button>
          <Button
            loading={save.isPending}
            disabled={form.label.trim().length < 2}
            onClick={() => save.mutate()}
          >
            {isEdit ? 'ذخیره تغییرات' : 'ساخت صنف'}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            label="عنوان صنف / شغل"
            placeholder="مثلاً آموزش موسیقی کودکان"
            value={form.label}
            onChange={(event) => set('label', event.target.value)}
          />
          <Input
            label="کلید لاتین (اختیاری)"
            hint={isEdit ? 'کلید پس از ساخت تغییر نمی‌کند' : 'خالی بگذارید تا خودکار ساخته شود'}
            placeholder="music_lessons"
            dir="ltr"
            className="text-left nums"
            disabled={isEdit}
            value={form.key}
            onChange={(event) =>
              set('key', event.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))
            }
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
            توضیح (اختیاری)
          </label>
          <textarea
            rows={2}
            className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm outline-none transition placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            placeholder="این صنف چه کسب‌وکارهایی را شامل می‌شود؟"
            value={form.description}
            onChange={(event) => set('description', event.target.value)}
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <Input
            label="نام کاربران نهایی"
            hint="مثلاً هنرجو / بیمار"
            placeholder="مشتری"
            value={form.endUserNoun}
            onChange={(event) => set('endUserNoun', event.target.value)}
          />
          <Input
            label="جمع کاربران نهایی"
            placeholder="مشتریان"
            value={form.endUserNounPlural}
            onChange={(event) => set('endUserNounPlural', event.target.value)}
          />
          <Input
            label="نام شعبه"
            hint="مثلاً آموزشگاه / مطب"
            placeholder="شعبه"
            value={form.branchNoun}
            onChange={(event) => set('branchNoun', event.target.value)}
          />
          <Input
            label="جمع شعبه"
            placeholder="شعبه‌ها"
            value={form.branchNounPlural}
            onChange={(event) => set('branchNounPlural', event.target.value)}
          />
          <Input
            label="ترتیب نمایش"
            hint="عدد کوچک‌تر = بالاتر"
            dir="ltr"
            className="text-left nums"
            inputMode="numeric"
            value={form.sortOrder}
            onChange={(event) => set('sortOrder', event.target.value.replace(/\D/g, ''))}
          />
        </div>

        {!isEdit && (
          <>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  ماژول‌های پیش‌فرض این صنف
                </p>
                <span className="text-xs text-slate-500 nums">{form.modules.length} ماژول</span>
              </div>
              <ModuleChecklist
                keys={form.modules}
                onChange={(keys) => set('modules', keys)}
              />
            </div>

            <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-800">
              <input
                type="checkbox"
                className="h-4 w-4 accent-brand-600"
                checked={form.isRegistrationEnabled}
                onChange={(event) => set('isRegistrationEnabled', event.target.checked)}
              />
              <span className="flex-1 text-slate-700 dark:text-slate-200">
                ثبت‌نام کسب‌وکارهای جدید در این صنف فعال باشد
              </span>
            </label>
          </>
        )}
      </div>
    </Modal>
  );
}

/** Shared checkbox grid of all platform modules. */
function ModuleChecklist({
  keys,
  onChange,
}: {
  keys: ModuleKey[];
  onChange: (keys: ModuleKey[]) => void;
}) {
  return (
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
                onChange(
                  event.target.checked ? [...keys, key] : keys.filter((item) => item !== key),
                )
              }
            />
            <span className="flex-1 text-slate-700 dark:text-slate-200">{MODULE_LABELS[key]}</span>
            <span className="text-[10px] text-slate-400 nums">{key}</span>
          </label>
        );
      })}
    </div>
  );
}

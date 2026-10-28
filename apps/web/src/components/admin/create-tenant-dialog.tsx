'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  INDUSTRY_CATEGORIES,
  MODULE_KEYS,
  MODULE_LABELS,
  defaultModulesForIndustry,
  industryLabel,
  type ModuleKey,
} from '@repo/shared';
import { api, ApiClientError } from '@/lib/api-client';
import { getAdminToken } from '@/lib/admin-auth';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Modal } from '@/components/ui/modal';
import type { AdminCreatedTenant } from '@/lib/admin-types';

type FormState = {
  name: string;
  slug: string;
  industry: string;
  ownerFullName: string;
  ownerPhone: string;
  ownerEmail: string;
  ownerPassword: string;
  phone: string;
};

const EMPTY: FormState = {
  name: '',
  slug: '',
  industry: 'SPORTS_COACHING',
  ownerFullName: '',
  ownerPhone: '',
  ownerEmail: '',
  ownerPassword: '',
  phone: '',
};

/**
 * Creates a business (tenant) from the admin console. Modules start from the
 * industry default set and the operator can add/remove any of them; the API
 * resolves dependencies and always enables those too.
 */
export function CreateTenantDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const token = getAdminToken();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [modules, setModules] = useState<ModuleKey[]>(defaultModulesForIndustry('SPORTS_COACHING'));

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const create = useMutation({
    mutationFn: () =>
      api.post<AdminCreatedTenant>(
        '/admin/tenants',
        {
          name: form.name.trim(),
          ...(form.slug.trim() ? { slug: form.slug.trim() } : {}),
          industry: form.industry,
          ownerFullName: form.ownerFullName.trim(),
          ownerPhone: form.ownerPhone.trim(),
          ...(form.ownerEmail.trim() ? { ownerEmail: form.ownerEmail.trim() } : {}),
          ...(form.ownerPassword ? { ownerPassword: form.ownerPassword } : {}),
          ...(form.phone.trim() ? { phone: form.phone.trim() } : {}),
          modules,
          withDependencies: true,
        },
        token,
      ),
    onSuccess: (tenant) => {
      toast.success(`کسب‌وکار «${tenant.name}» ساخته شد`);
      void queryClient.invalidateQueries({ queryKey: ['admin-tenants'] });
      setForm(EMPTY);
      setModules(defaultModulesForIndustry('SPORTS_COACHING'));
      onClose();
      router.push(`/admin/tenants/${tenant.id}`);
    },
    onError: (error) =>
      toast.error(error instanceof ApiClientError ? error.message : 'ایجاد کسب‌وکار ناموفق بود'),
  });

  const canSubmit =
    form.name.trim().length >= 2 &&
    form.ownerFullName.trim().length >= 2 &&
    /^09\d{9}$/.test(form.ownerPhone.trim()) &&
    !create.isPending;

  return (
    <Modal
      open={open}
      onClose={() => !create.isPending && onClose()}
      title="کسب‌وکار جدید"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={create.isPending}>
            انصراف
          </Button>
          <Button loading={create.isPending} disabled={!canSubmit} onClick={() => create.mutate()}>
            ساخت کسب‌وکار
          </Button>
        </>
      }
    >
      <div className="max-h-[70vh] space-y-4 overflow-y-auto pe-1">
        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            label="نام کسب‌وکار"
            placeholder="مثلاً باشگاه ورزشی آریا"
            value={form.name}
            onChange={(event) => set('name', event.target.value)}
          />
          <Select
            label="صنف"
            value={form.industry}
            onChange={(event) => {
              set('industry', event.target.value);
              setModules(defaultModulesForIndustry(event.target.value));
            }}
          >
            {INDUSTRY_CATEGORIES.map((key) => (
              <option key={key} value={key}>
                {industryLabel(key)}
              </option>
            ))}
          </Select>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            label="نام مالک"
            placeholder="نام و نام خانوادگی"
            value={form.ownerFullName}
            onChange={(event) => set('ownerFullName', event.target.value)}
          />
          <Input
            label="موبایل مالک"
            placeholder="09xxxxxxxxx"
            dir="ltr"
            className="text-left nums"
            inputMode="numeric"
            value={form.ownerPhone}
            onChange={(event) =>
              set('ownerPhone', event.target.value.replace(/\D/g, '').slice(0, 11))
            }
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <Input
            label="تلفن کسب‌وکار (اختیاری)"
            dir="ltr"
            className="text-left nums"
            value={form.phone}
            onChange={(event) => set('phone', event.target.value.replace(/\D/g, '').slice(0, 12))}
          />
          <Input
            label="ایمیل مالک (اختیاری)"
            dir="ltr"
            className="text-left"
            value={form.ownerEmail}
            onChange={(event) => set('ownerEmail', event.target.value)}
          />
          <Input
            label="رمز مالک (اختیاری)"
            type="password"
            dir="ltr"
            className="text-left"
            placeholder="حداقل ۸ کاراکتر"
            value={form.ownerPassword}
            onChange={(event) => set('ownerPassword', event.target.value)}
          />
        </div>

        <Input
          label="اسلاگ (اختیاری)"
          hint="خالی بگذارید تا خودکار از نام ساخته شود"
          placeholder="my-business"
          dir="ltr"
          className="text-left nums"
          value={form.slug}
          onChange={(event) => set('slug', event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
        />

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
              ماژول‌های مورد نیاز
            </p>
            <button
              type="button"
              className="text-xs text-brand-600 hover:underline"
              onClick={() => setModules(defaultModulesForIndustry(form.industry))}
            >
              بازگردانی پیش‌فرض صنف
            </button>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {MODULE_KEYS.map((key) => {
              const checked = modules.includes(key);
              const isDefault = defaultModulesForIndustry(form.industry).includes(key);
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
                      setModules((prev) =>
                        event.target.checked
                          ? [...prev, key]
                          : prev.filter((item) => item !== key),
                      )
                    }
                  />
                  <span className="flex-1 text-slate-700 dark:text-slate-200">
                    {MODULE_LABELS[key]}
                  </span>
                  {isDefault && <span className="text-[10px] text-slate-400">پیش‌فرض صنف</span>}
                </label>
              );
            })}
          </div>
          <p className="text-xs text-slate-400">
            پیش‌نیازهای هر ماژول به‌صورت خودکار فعال می‌شوند.
          </p>
        </div>
      </div>
    </Modal>
  );
}

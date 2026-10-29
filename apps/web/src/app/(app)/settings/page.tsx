'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { DatabaseBackup, Layers, Save, ShieldCheck, Store } from 'lucide-react';
import { toast } from 'sonner';
import { MODULE_LABELS, type ModuleKey } from '@repo/shared';
import { api, ApiClientError } from '@/lib/api-client';
import { getAccessToken, useAuth } from '@/lib/auth';
import { formatJalali } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, Td, Th } from '@/components/ui/table';
import { BranchesCard } from '@/components/settings/branches-card';
import { ChangePasswordCard } from '@/components/settings/change-password-card';
import { useBranchNoun } from '@/lib/use-industry-registry';
import type { BackupRecord, Paginated } from '@/lib/types';

type TenantDetail = {
  id: string;
  name: string;
  slug: string;
  industry: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  currency: string;
  calendar: 'JALALI' | 'GREGORIAN';
  taxRate: string;
  marketplaceEnabled: boolean;
  tagline: string | null;
  city: string | null;
  modules: { key: ModuleKey; isEnabled: boolean }[];
  branches: { id: string; name: string; city: string | null }[];
};

export default function SettingsPage() {
  const token = getAccessToken();
  const branch = useBranchNoun();
  const { refresh, me, logout } = useAuth();
  const queryClient = useQueryClient();

  const { data } = useQuery({
    queryKey: ['tenant'],
    queryFn: () => api.get<TenantDetail>('/tenant', token),
  });

  const [form, setForm] = useState<Partial<TenantDetail>>({});
  // Keep `merged` undefined until the tenant actually loads; otherwise the
  // form renders with `undefined` values first (uncontrolled) and then flips
  // to strings (controlled), which React warns about.
  const merged = data ? ({ ...data, ...form } as TenantDetail) : undefined;

  const saveMutation = useMutation({
    mutationFn: () =>
      api.patch(
        '/tenant',
        {
          name: merged?.name,
          phone: merged?.phone ?? undefined,
          email: merged?.email ?? undefined,
          address: merged?.address ?? undefined,
          currency: merged?.currency,
          calendar: merged?.calendar,
          taxRate: merged ? Number(merged.taxRate) : undefined,
          marketplaceEnabled: merged?.marketplaceEnabled,
          tagline: merged?.tagline ?? undefined,
          city: merged?.city ?? undefined,
        },
        token,
      ),
    onSuccess: () => {
      toast.success('تنظیمات ذخیره شد');
      void queryClient.invalidateQueries({ queryKey: ['tenant'] });
      void refresh();
    },
    onError: (error) =>
      toast.error(error instanceof ApiClientError ? error.message : 'خطا در ذخیره تنظیمات'),
  });

  const enableMutation = useMutation({
    mutationFn: (modules: ModuleKey[]) => api.post('/tenant/modules/enable', { modules }, token),
    onSuccess: () => {
      toast.success('ماژول‌ها فعال شدند');
      void queryClient.invalidateQueries({ queryKey: ['tenant'] });
      void refresh();
    },
    onError: () => toast.error('خطا در فعال‌سازی ماژول'),
  });

  const backupsQuery = useQuery({
    queryKey: ['backups'],
    queryFn: () => api.get<Paginated<BackupRecord>>('/core/backups?pageSize=10', token),
  });

  const createBackup = useMutation({
    mutationFn: () => api.post('/core/backups', { kind: 'manual' }, token),
    onSuccess: () => {
      toast.success('پشتیبان ایجاد شد');
      void queryClient.invalidateQueries({ queryKey: ['backups'] });
    },
    onError: () => toast.error('خطا در ایجاد پشتیبان'),
  });

  const enable2fa = useMutation({
    mutationFn: () => api.post<{ enabled: boolean; secret: string }>('/core/2fa/enable', {}, token),
    onSuccess: (data) => toast.success(`احراز دو مرحله‌ای فعال شد. کلید: ${data.secret}`),
    onError: () => toast.error('خطا در فعال‌سازی احراز دو مرحله‌ای'),
  });

  if (!merged) return null;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">تنظیمات</h1>
        <p className="mt-1 text-sm text-slate-500">
          پیکربندی کسب‌وکار، ماژول‌ها و {branch.plural}
        </p>
      </div>

      <Card>
        <CardHeader
          title="اطلاعات کسب‌وکار"
          description="این اطلاعات در فاکتورها و پیام‌ها استفاده می‌شود"
          action={
            <Button loading={saveMutation.isPending} onClick={() => saveMutation.mutate()}>
              <Save className="h-4 w-4" />
              ذخیره
            </Button>
          }
        />
        <CardBody className="grid gap-4 sm:grid-cols-2">
          <Input
            label="نام کسب‌وکار"
            value={merged.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
          />
          <Input label="شناسه یکتا (slug)" value={merged.slug} disabled dir="ltr" className="text-left" />
          <Input
            label="شماره تماس"
            dir="ltr"
            className="text-left nums"
            value={merged.phone ?? ''}
            onChange={(event) => setForm({ ...form, phone: event.target.value })}
          />
          <Input
            label="ایمیل"
            dir="ltr"
            className="text-left"
            value={merged.email ?? ''}
            onChange={(event) => setForm({ ...form, email: event.target.value })}
          />
          <Input
            label="آدرس"
            value={merged.address ?? ''}
            onChange={(event) => setForm({ ...form, address: event.target.value })}
          />
          <Select
            label="تقویم"
            value={merged.calendar}
            onChange={(event) =>
              setForm({ ...form, calendar: event.target.value as 'JALALI' | 'GREGORIAN' })
            }
          >
            <option value="JALALI">شمسی</option>
            <option value="GREGORIAN">میلادی</option>
          </Select>
          <Input
            label="نرخ مالیات (٪)"
            dir="ltr"
            className="text-left nums"
            value={String(merged.taxRate ?? '')}
            onChange={(event) => setForm({ ...form, taxRate: event.target.value })}
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="بازارگاه عمومی"
          description="کسب‌وکار، محصولات و خدمات شما در ویترین بازارگاه دیده شود"
          action={
            <Button loading={saveMutation.isPending} onClick={() => saveMutation.mutate()}>
              <Save className="h-4 w-4" />
              ذخیره
            </Button>
          }
        />
        <CardBody className="space-y-4">
          <label className="flex items-start gap-3 rounded-xl border border-slate-200 p-3 dark:border-slate-800">
            <input
              type="checkbox"
              checked={Boolean(merged.marketplaceEnabled)}
              onChange={(event) => setForm({ ...form, marketplaceEnabled: event.target.checked })}
              className="mt-1 h-4 w-4 rounded border-slate-300"
            />
            <span className="text-sm">
              <span className="block font-medium text-slate-800 dark:text-slate-100">
                نمایش در بازارگاه
              </span>
              <span className="mt-1 block text-xs leading-5 text-slate-500">
                با روشن بودن این گزینه، ویترین کسب‌وکار در بازارگاه قابل مشاهده است؛ اما
                هر محصول یا خدمت فقط وقتی نمایش داده می‌شود که خودش «منتشرشده» باشد.
              </span>
            </span>
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              label="شعار کوتاه (در کارت بازارگاه)"
              value={merged.tagline ?? ''}
              onChange={(event) => setForm({ ...form, tagline: event.target.value })}
            />
            <Input
              label="شهر"
              value={merged.city ?? ''}
              onChange={(event) => setForm({ ...form, city: event.target.value })}
            />
          </div>
          {merged.marketplaceEnabled ? (
            <a
              href={`/marketplace/b/${merged.slug}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 text-sm font-medium text-brand-600 hover:text-brand-700"
            >
              <Store className="h-4 w-4" />
              مشاهدهٔ ویترین عمومی کسب‌وکار
            </a>
          ) : null}
        </CardBody>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title="ماژول‌ها" description="قابلیت‌های فعال این کسب‌وکار" />
          <CardBody className="space-y-3">
            {merged.modules?.map((module) => (
              <div key={module.key} className="flex items-center justify-between">
                <span className="text-sm text-slate-700 dark:text-slate-300">
                  {MODULE_LABELS[module.key]}
                </span>
                {module.isEnabled ? (
                  <Badge tone="success">فعال</Badge>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => enableMutation.mutate([module.key])}
                  >
                    فعال‌سازی
                  </Button>
                )}
              </div>
            ))}
            <div className="flex items-center gap-2 pt-2">
              <Layers className="h-4 w-4 text-slate-400" />
              <span className="text-xs text-slate-500">
                فعال‌سازی هر ماژول، وابستگی‌های آن را نیز به‌صورت خودکار فعال می‌کند.
              </span>
            </div>
          </CardBody>
        </Card>

        <BranchesCard />

        <ChangePasswordCard hasPassword={me?.member.hasPassword} onDone={() => void logout()} />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="امنیت"
            description="احراز دو مرحله‌ای برای حساب شما"
            action={
              <Button variant="outline" loading={enable2fa.isPending} onClick={() => enable2fa.mutate()}>
                <ShieldCheck className="h-4 w-4" />
                فعال‌سازی ۲FA
              </Button>
            }
          />
          <CardBody>
            <p className="text-sm text-slate-500">
              با فعال‌سازی، هنگام ورود کد یکبار مصرف به شماره موبایل شما ارسال می‌شود.
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="پشتیبان‌گیری"
            description="نگهداری ۳۰ روزه نسخه‌های پشتیبان"
            action={
              <Button variant="outline" loading={createBackup.isPending} onClick={() => createBackup.mutate()}>
                <DatabaseBackup className="h-4 w-4" />
                پشتیبان فوری
              </Button>
            }
          />
          <CardBody className="p-0">
            {backupsQuery.data && backupsQuery.data.data.length > 0 ? (
              <Table>
                <thead>
                  <tr>
                    <Th>نوع</Th>
                    <Th>وضعیت</Th>
                    <Th>تاریخ</Th>
                  </tr>
                </thead>
                <tbody>
                  {backupsQuery.data.data.map((b) => (
                    <tr key={b.id}>
                      <Td>{b.kind}</Td>
                      <Td>
                        <Badge tone={b.status === 'COMPLETED' ? 'success' : 'warning'}>{b.status}</Badge>
                      </Td>
                      <Td className="nums">{formatJalali(b.createdAt, true)}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            ) : (
              <p className="p-5 text-sm text-slate-500">پشتیبانی ثبت نشده است.</p>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

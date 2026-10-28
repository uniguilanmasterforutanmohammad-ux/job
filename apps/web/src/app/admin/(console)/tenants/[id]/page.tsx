'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Ban, CheckCircle2, Save, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { api, ApiClientError } from '@/lib/api-client';
import { getAdminToken, isAtLeast, useAdminAuth } from '@/lib/admin-auth';
import { cn, formatJalali, formatNumber } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, Td, Th } from '@/components/ui/table';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState, Skeleton } from '@/components/ui/empty-state';
import { StatusBadge } from '@/components/admin/status-badge';
import { ModuleGrid } from '@/components/admin/module-grid';
import { MembersPanel } from '@/components/admin/members-panel';
import type { AdminAuditEntry, AdminPlan, AdminTenantDetail } from '@/lib/admin-types';
import type { Paginated } from '@/lib/types';

type Tab = 'overview' | 'modules' | 'members' | 'subscription' | 'audit';

const TABS: Array<{ key: Tab; label: string }> = [
  { key: 'overview', label: 'نمای کلی و ویرایش' },
  { key: 'modules', label: 'ماژول‌ها' },
  { key: 'members', label: 'کاربران پنل' },
  { key: 'subscription', label: 'اشتراک و پلن' },
  { key: 'audit', label: 'تاریخچه تغییرات' },
];

export default function TenantDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const token = getAdminToken();
  const [tab, setTab] = useState<Tab>('overview');

  const tenantQuery = useQuery({
    queryKey: ['admin-tenant', id],
    queryFn: () => api.get<AdminTenantDetail>(`/admin/tenants/${id}`, token),
  });

  if (tenantQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-1/3" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!tenantQuery.data) {
    return <EmptyState title="کسب‌وکار یافت نشد" description="شناسه نامعتبر است یا دسترسی ندارید" />;
  }

  const tenant = tenantQuery.data;

  return (
    <div className="space-y-5">
      <PageHeader
        title={tenant.name}
        description={`${tenant.industry} · ${tenant.slug}`}
        action={
          <Link
            href="/admin/tenants"
            className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-brand-600"
          >
            <ArrowRight className="h-4 w-4" />
            بازگشت به فهرست
          </Link>
        }
      />

      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <StatusBadge status={tenant.status} />
        <Badge tone="neutral">{tenant.industry}</Badge>
        <span className="text-xs text-slate-400 nums" dir="ltr">
          {tenant.slug}
        </span>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-slate-200 dark:border-slate-800">
        {TABS.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setTab(item.key)}
            className={cn(
              '-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition',
              tab === item.key
                ? 'border-brand-500 text-brand-600'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300',
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && <OverviewTab tenant={tenant} />}
      {tab === 'modules' && <ModuleGrid tenantId={tenant.id} />}
      {tab === 'members' && <MembersPanel tenant={tenant} />}
      {tab === 'subscription' && <SubscriptionTab tenant={tenant} />}
      {tab === 'audit' && <AuditTab tenantId={tenant.id} />}
    </div>
  );
}

function OverviewTab({ tenant }: { tenant: AdminTenantDetail }) {
  const token = getAdminToken();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { operator } = useAdminAuth();
  const canEdit = isAtLeast(operator?.role, 'ADMIN');

  const [form, setForm] = useState({
    name: tenant.name,
    legalName: tenant.legalName ?? '',
    nationalId: tenant.nationalId ?? '',
    economicCode: tenant.economicCode ?? '',
    phone: tenant.phone ?? '',
    email: tenant.email ?? '',
    address: tenant.address ?? '',
    industry: tenant.industry,
    taxRate: tenant.taxRate,
  });

  const saveTenant = useMutation({
    mutationFn: () =>
      api.patch(
        `/admin/tenants/${tenant.id}`,
        {
          name: form.name,
          legalName: form.legalName || undefined,
          nationalId: form.nationalId || undefined,
          economicCode: form.economicCode || undefined,
          phone: form.phone || undefined,
          email: form.email || undefined,
          address: form.address || undefined,
          industry: form.industry,
          taxRate: Number(form.taxRate),
        },
        token,
      ),
    onSuccess: () => {
      toast.success('اطلاعات کسب‌وکار ذخیره شد');
      void queryClient.invalidateQueries({ queryKey: ['admin-tenant', tenant.id] });
    },
    onError: (error) =>
      toast.error(error instanceof ApiClientError ? error.message : 'خطا در ذخیره اطلاعات'),
  });

  const changeStatus = useMutation({
    mutationFn: (status: string) =>
      api.post(`/admin/tenants/${tenant.id}/status`, { status }, token),
    onSuccess: (_data, status) => {
      toast.success(status === 'ACTIVE' ? 'کسب‌وکار فعال شد' : 'وضعیت کسب‌وکار تغییر کرد');
      void queryClient.invalidateQueries({ queryKey: ['admin-tenant', tenant.id] });
      void queryClient.invalidateQueries({ queryKey: ['admin-tenants'] });
    },
    onError: (error) =>
      toast.error(error instanceof ApiClientError ? error.message : 'خطا در تغییر وضعیت'),
  });

  const softDelete = useMutation({
    mutationFn: () => api.delete(`/admin/tenants/${tenant.id}`, token),
    onSuccess: () => {
      toast.success('کسب‌وکار حذف (آرشیو) شد');
      router.push('/admin/tenants');
    },
    onError: (error) =>
      toast.error(error instanceof ApiClientError ? error.message : 'خطا در حذف کسب‌وکار'),
  });

  const restore = useMutation({
    mutationFn: () => api.post(`/admin/tenants/${tenant.id}/restore`, {}, token),
    onSuccess: () => {
      toast.success('کسب‌وکار بازیابی شد');
      void queryClient.invalidateQueries({ queryKey: ['admin-tenant', tenant.id] });
    },
    onError: (error) =>
      toast.error(error instanceof ApiClientError ? error.message : 'خطا در بازیابی'),
  });

  return (
    <div className="grid gap-5 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader title="اطلاعات کسب‌وکار" description="ویرایش دستی توسط مدیر پلتفرم" />
        <CardBody className="grid gap-4 sm:grid-cols-2">
          <Input
            label="نام کسب‌وکار"
            value={form.name}
            disabled={!canEdit}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
          />
          <Input
            label="نام حقوقی"
            value={form.legalName}
            disabled={!canEdit}
            onChange={(event) => setForm({ ...form, legalName: event.target.value })}
          />
          <Input
            label="شناسه ملی"
            value={form.nationalId}
            disabled={!canEdit}
            onChange={(event) => setForm({ ...form, nationalId: event.target.value })}
          />
          <Input
            label="کد اقتصادی"
            value={form.economicCode}
            disabled={!canEdit}
            onChange={(event) => setForm({ ...form, economicCode: event.target.value })}
          />
          <Input
            label="تلفن"
            dir="ltr"
            className="text-left nums"
            value={form.phone}
            disabled={!canEdit}
            onChange={(event) => setForm({ ...form, phone: event.target.value })}
          />
          <Input
            label="ایمیل"
            dir="ltr"
            className="text-left"
            value={form.email}
            disabled={!canEdit}
            onChange={(event) => setForm({ ...form, email: event.target.value })}
          />
          <div className="sm:col-span-2">
            <Input
              label="آدرس"
              value={form.address}
              disabled={!canEdit}
              onChange={(event) => setForm({ ...form, address: event.target.value })}
            />
          </div>
          <Select
            label="صنعت"
            value={form.industry}
            disabled={!canEdit}
            onChange={(event) => setForm({ ...form, industry: event.target.value })}
          >
            {[
              'SPORTS_COACHING',
              'BEAUTY',
              'HEALTHCARE',
              'RESTAURANT_CAFE',
              'RETAIL',
              'REAL_ESTATE',
              'TOURISM',
              'OTHER',
            ].map((key) => (
              <option key={key} value={key}>
                {key}
              </option>
            ))}
          </Select>
          <Input
            label="نرخ مالیات (٪)"
            type="number"
            dir="ltr"
            className="text-left nums"
            value={form.taxRate}
            disabled={!canEdit}
            onChange={(event) => setForm({ ...form, taxRate: event.target.value })}
          />
          {canEdit && (
            <div className="sm:col-span-2">
              <Button loading={saveTenant.isPending} onClick={() => saveTenant.mutate()}>
                <Save className="h-4 w-4" />
                ذخیره تغییرات
              </Button>
            </div>
          )}
        </CardBody>
      </Card>

      <div className="space-y-5">
        <Card>
          <CardHeader title="آمار کسب‌وکار" />
          <CardBody className="grid grid-cols-2 gap-3 text-sm">
            <Stat label="کاربران" value={tenant._count.members} />
            <Stat label="شعبه‌ها" value={tenant._count.branches} />
            <Stat label="مشتریان" value={tenant._count.customers} />
            <Stat label="نوبت‌ها" value={tenant._count.appointments} />
            <Stat label="فاکتورها" value={tenant._count.invoices} />
            <Stat label="سفارش‌ها" value={tenant._count.orders} />
            <div className="col-span-2 mt-1 text-xs text-slate-500">
              تاریخ ایجاد: {formatJalali(tenant.createdAt)}
            </div>
          </CardBody>
        </Card>

        {canEdit && (
          <Card>
            <CardHeader title="وضعیت و اقدامات" description="کنترل دسترسی کسب‌وکار" />
            <CardBody className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {tenant.status !== 'ACTIVE' && (
                  <Button
                    size="sm"
                    loading={changeStatus.isPending}
                    onClick={() => changeStatus.mutate('ACTIVE')}
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    فعال‌سازی
                  </Button>
                )}
                {tenant.status === 'ACTIVE' && (
                  <Button
                    variant="outline"
                    size="sm"
                    loading={changeStatus.isPending}
                    onClick={() => changeStatus.mutate('SUSPENDED')}
                  >
                    <Ban className="h-4 w-4" />
                    غیرفعال‌سازی
                  </Button>
                )}
              </div>
              <div className="border-t border-slate-100 pt-3 dark:border-slate-800">
                {tenant.deletedAt ? (
                  <Button
                    variant="outline"
                    size="sm"
                    loading={restore.isPending}
                    onClick={() => restore.mutate()}
                  >
                    بازیابی کسب‌وکار
                  </Button>
                ) : (
                  <Button
                    variant="danger"
                    size="sm"
                    loading={softDelete.isPending}
                    onClick={() => {
                      if (confirm('کسب‌وکار آرشیو شود؟ این عملیات قابل بازگشت است.')) {
                        softDelete.mutate();
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                    حذف (آرشیو)
                  </Button>
                )}
              </div>
            </CardBody>
          </Card>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/50">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-0.5 text-lg font-semibold text-slate-900 nums dark:text-slate-100">
        {formatNumber(value)}
      </p>
    </div>
  );
}

function SubscriptionTab({ tenant }: { tenant: AdminTenantDetail }) {
  const token = getAdminToken();
  const queryClient = useQueryClient();
  const { operator } = useAdminAuth();
  const canEdit = isAtLeast(operator?.role, 'ADMIN');

  const [planId, setPlanId] = useState(tenant.subscription?.planId ?? '');
  const [status, setStatus] = useState(tenant.subscription?.status ?? 'TRIAL');
  const [seats, setSeats] = useState(String(tenant.subscription?.seats ?? 1));

  const plansQuery = useQuery({
    queryKey: ['admin-plans'],
    queryFn: () => api.get<AdminPlan[]>('/admin/plans', token),
  });

  const assign = useMutation({
    mutationFn: () =>
      api.post(
        `/admin/tenants/${tenant.id}/subscription`,
        { planId: planId || null, status, seats: Number(seats) },
        token,
      ),
    onSuccess: () => {
      toast.success('اشتراک کسب‌وکار به‌روزرسانی شد');
      void queryClient.invalidateQueries({ queryKey: ['admin-tenant', tenant.id] });
    },
    onError: (error) =>
      toast.error(error instanceof ApiClientError ? error.message : 'خطا در تخصیص پلن'),
  });

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card>
        <CardHeader title="اشتراک فعلی" />
        <CardBody className="space-y-3 text-sm">
          <Row label="وضعیت" value={<StatusBadge status={tenant.subscription?.status ?? null} />} />
          <Row label="پلن" value={tenant.subscription?.plan?.name ?? '—'} />
          <Row label="تعداد صندلی" value={String(tenant.subscription?.seats ?? '—')} />
          <Row
            label="پایان دوره"
            value={
              tenant.subscription?.currentPeriodEnd
                ? formatJalali(tenant.subscription.currentPeriodEnd)
                : '—'
            }
          />
        </CardBody>
      </Card>

      {canEdit && (
        <Card>
          <CardHeader title="تخصیص پلن" description="تغییر دستی اشتراک کسب‌وکار" />
          <CardBody className="space-y-4">
            <Select label="پلن" value={planId} onChange={(event) => setPlanId(event.target.value)}>
              <option value="">بدون پلن</option>
              {(plansQuery.data ?? []).map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {plan.name} — {formatNumber(plan.price)} تومان
                </option>
              ))}
            </Select>
            <Select label="وضعیت" value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="TRIAL">آزمایشی</option>
              <option value="ACTIVE">فعال</option>
              <option value="PAST_DUE">معوق</option>
              <option value="SUSPENDED">غیرفعال</option>
              <option value="CANCELED">لغو شده</option>
            </Select>
            <Input
              label="تعداد صندلی"
              type="number"
              dir="ltr"
              className="text-left nums"
              value={seats}
              onChange={(event) => setSeats(event.target.value)}
            />
            <Button loading={assign.isPending} onClick={() => assign.mutate()}>
              ذخیره اشتراک
            </Button>
          </CardBody>
        </Card>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-slate-100 pb-2 last:border-0 dark:border-slate-800">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium text-slate-800 dark:text-slate-200">{value}</span>
    </div>
  );
}

function AuditTab({ tenantId }: { tenantId: string }) {
  const token = getAdminToken();
  const query = useQuery({
    queryKey: ['admin-tenant-audit', tenantId],
    queryFn: () =>
      api.get<Paginated<AdminAuditEntry>>(`/admin/tenants/${tenantId}/audit?pageSize=30`, token),
  });

  if (query.isLoading) return <Skeleton className="h-64 w-full" />;
  if (!query.data || query.data.data.length === 0) {
    return (
      <EmptyState
        title="تغییری ثبت نشده"
        description="هنوز اقدام مدیریتی روی این کسب‌وکار انجام نشده است"
      />
    );
  }

  return (
    <Card>
      <CardBody className="p-0">
        <Table>
          <thead>
            <tr>
              <Th>اقدام</Th>
              <Th>موجودیت</Th>
              <Th>مدیر</Th>
              <Th>تاریخ</Th>
            </tr>
          </thead>
          <tbody>
            {query.data.data.map((entry) => (
              <tr key={entry.id}>
                <Td>
                  <Badge tone="info">{entry.action}</Badge>
                </Td>
                <Td className="text-slate-500 nums" dir="ltr">
                  {entry.entity}
                </Td>
                <Td className="text-slate-600 dark:text-slate-300">
                  {entry.platformMember?.fullName ?? 'سیستم'}
                </Td>
                <Td className="text-slate-500">{formatJalali(entry.createdAt, true)}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </CardBody>
    </Card>
  );
}

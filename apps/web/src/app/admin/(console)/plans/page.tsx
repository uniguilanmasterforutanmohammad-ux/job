'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Layers, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { MODULE_KEYS, MODULE_LABELS, type ModuleKey } from '@repo/shared';
import { api, ApiClientError } from '@/lib/api-client';
import { getAdminToken } from '@/lib/admin-auth';
import { cn, formatNumber } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/modal';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState, Skeleton } from '@/components/ui/empty-state';
import type { AdminPlan } from '@/lib/admin-types';

const emptyForm = {
  code: '',
  name: '',
  description: '',
  price: '0',
  billingCycle: 'MONTHLY',
  modules: [] as ModuleKey[],
};

export default function AdminPlansPage() {
  const token = getAdminToken();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const query = useQuery({
    queryKey: ['admin-plans'],
    queryFn: () => api.get<AdminPlan[]>('/admin/plans', token),
  });

  const create = useMutation({
    mutationFn: () =>
      api.post(
        '/admin/plans',
        {
          code: form.code,
          name: form.name,
          description: form.description || undefined,
          price: Number(form.price),
          billingCycle: form.billingCycle,
          modules: form.modules,
          limits: {},
          isActive: true,
        },
        token,
      ),
    onSuccess: () => {
      toast.success('پلن ایجاد شد');
      setOpen(false);
      setForm(emptyForm);
      void queryClient.invalidateQueries({ queryKey: ['admin-plans'] });
    },
    onError: (error) =>
      toast.error(error instanceof ApiClientError ? error.message : 'خطا در ایجاد پلن'),
  });

  const togglePlan = useMutation({
    mutationFn: (plan: AdminPlan) => api.patch(`/admin/plans/${plan.id}`, { isActive: !plan.isActive }, token),
    onSuccess: () => {
      toast.success('وضعیت پلن تغییر کرد');
      void queryClient.invalidateQueries({ queryKey: ['admin-plans'] });
    },
    onError: (error) =>
      toast.error(error instanceof ApiClientError ? error.message : 'خطا در تغییر وضعیت پلن'),
  });

  function toggleModule(key: ModuleKey) {
    setForm((prev) => ({
      ...prev,
      modules: prev.modules.includes(key)
        ? prev.modules.filter((m) => m !== key)
        : [...prev.modules, key],
    }));
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="پلن‌های پلتفرم"
        description="کاتالوگ پلن‌ها و ماژول‌های هر پلن"
        action={
          <Button onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" />
            پلن جدید
          </Button>
        }
      />

      {query.isLoading ? (
        <div className="grid gap-4 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-52 w-full" />
          ))}
        </div>
      ) : query.data && query.data.length > 0 ? (
        <div className="grid gap-4 lg:grid-cols-3">
          {query.data.map((plan) => (
            <Card key={plan.id}>
              <CardHeader
                title={plan.name}
                description={plan.description ?? plan.code}
                action={<Badge tone={plan.isActive ? 'success' : 'neutral'}>{plan.isActive ? 'فعال' : 'غیرفعال'}</Badge>}
              />
              <CardBody className="space-y-3">
                <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 nums">
                  {formatNumber(plan.price)} <span className="text-sm font-normal text-slate-500">تومان</span>
                </p>
                <div className="flex flex-wrap gap-1">
                  {plan.modules.map((key) => (
                    <Badge key={key} tone="brand">
                      {MODULE_LABELS[key] ?? key}
                    </Badge>
                  ))}
                  {plan.modules.length === 0 && <p className="text-xs text-slate-400">بدون ماژول</p>}
                </div>
                <p className="text-xs text-slate-500">
                  {formatNumber(plan._count.subscriptions)} کسب‌وکار روی این پلن
                </p>
                <Button
                  variant={plan.isActive ? 'outline' : 'primary'}
                  size="sm"
                  className="w-full"
                  loading={togglePlan.isPending}
                  onClick={() => togglePlan.mutate(plan)}
                >
                  {plan.isActive ? 'غیرفعال‌سازی' : 'فعال‌سازی'}
                </Button>
              </CardBody>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState icon={Layers} title="پلنی وجود ندارد" description="اولین پلن پلتفرم را بسازید" />
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="ایجاد پلن جدید"
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)}>
              انصراف
            </Button>
            <Button loading={create.isPending} onClick={() => create.mutate()}>
              ایجاد
            </Button>
          </>
        }
      >
        <div className="max-h-[70vh] space-y-4 overflow-y-auto">
          <Input
            label="کد پلن"
            dir="ltr"
            className="text-left"
            hint="حروف کوچک، رقم و خط تیره — مثال: pro-plus"
            value={form.code}
            onChange={(event) => setForm({ ...form, code: event.target.value })}
          />
          <Input
            label="نام"
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
          />
          <Input
            label="توضیح"
            value={form.description}
            onChange={(event) => setForm({ ...form, description: event.target.value })}
          />
          <Input
            label="قیمت (تومان)"
            type="number"
            dir="ltr"
            className="text-left nums"
            value={form.price}
            onChange={(event) => setForm({ ...form, price: event.target.value })}
          />
          <Select
            label="دوره پرداخت"
            value={form.billingCycle}
            onChange={(event) => setForm({ ...form, billingCycle: event.target.value })}
          >
            <option value="MONTHLY">ماهانه</option>
            <option value="QUARTERLY">فصلی</option>
            <option value="YEARLY">سالانه</option>
          </Select>
          <div>
            <p className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">ماژول‌های پلن</p>
            <div className="grid grid-cols-2 gap-2">
              {MODULE_KEYS.map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => toggleModule(key)}
                  className={cn(
                    'rounded-xl border px-3 py-2 text-sm transition',
                    form.modules.includes(key)
                      ? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-950/40'
                      : 'border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300',
                  )}
                >
                  {MODULE_LABELS[key]}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}

'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Truck } from 'lucide-react';
import { toast } from 'sonner';
import { api, ApiClientError } from '@/lib/api-client';
import { getAccessToken } from '@/lib/auth';
import { formatToman } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';

type ShippingMethod = {
  id: string;
  name: string;
  description: string | null;
  cost: string;
  freeAbove: string | null;
  estimatedDays: string | null;
  isActive: boolean;
};

/** SHOP-04 — delivery options the marketplace cart shows at checkout. */
export function ShippingMethodsCard() {
  const token = getAccessToken();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ name: '', cost: '', freeAbove: '', estimatedDays: '' });

  const { data, isLoading } = useQuery({
    queryKey: ['shipping-methods'],
    queryFn: () => api.get<ShippingMethod[]>('/shop/shipping-methods', token),
  });

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ['shipping-methods'] });

  const create = useMutation({
    mutationFn: () =>
      api.post(
        '/shop/shipping-methods',
        {
          name: form.name.trim(),
          cost: Number(form.cost || 0),
          freeAbove: form.freeAbove ? Number(form.freeAbove) : undefined,
          estimatedDays: form.estimatedDays.trim() || undefined,
        },
        token,
      ),
    onSuccess: () => {
      toast.success('روش ارسال اضافه شد');
      setForm({ name: '', cost: '', freeAbove: '', estimatedDays: '' });
      invalidate();
    },
    onError: (error) =>
      toast.error(error instanceof ApiClientError ? error.message : 'ثبت روش ارسال انجام نشد'),
  });

  const toggle = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api.patch(`/shop/shipping-methods/${id}`, { isActive }, token),
    onSuccess: invalidate,
    onError: () => toast.error('تغییر وضعیت انجام نشد'),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/shop/shipping-methods/${id}`, token),
    onSuccess: () => {
      toast.success('روش ارسال غیرفعال شد');
      invalidate();
    },
    onError: () => toast.error('حذف انجام نشد'),
  });

  return (
    <Card>
      <CardHeader
        title="روش‌های ارسال"
        description="گزینه‌هایی که در سبد خرید بازارگاه به مشتری نشان داده می‌شود"
      />
      <CardBody className="space-y-4">
        {isLoading ? (
          <p className="text-sm text-slate-500">در حال بارگذاری…</p>
        ) : data?.length ? (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {data.map((method) => (
              <div key={method.id} className="flex items-center justify-between gap-3 py-2">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-sm font-medium text-slate-800 dark:text-slate-100">
                    <Truck className="h-4 w-4 text-slate-400" />
                    {method.name}
                    {method.isActive ? (
                      <Badge tone="success">فعال</Badge>
                    ) : (
                      <Badge tone="neutral">غیرفعال</Badge>
                    )}
                  </p>
                  <p className="nums mt-0.5 text-xs text-slate-500">
                    {formatToman(Number(method.cost))}
                    {method.freeAbove
                      ? ` — رایگان بالای ${formatToman(Number(method.freeAbove))}`
                      : ''}
                    {method.estimatedDays ? ` — ${method.estimatedDays}` : ''}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => toggle.mutate({ id: method.id, isActive: !method.isActive })}
                  >
                    {method.isActive ? 'غیرفعال' : 'فعال'}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label="حذف"
                    onClick={() => remove.mutate(method.id)}
                  >
                    <Trash2 className="h-4 w-4 text-rose-500" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="rounded-xl border border-dashed border-slate-300 p-4 text-center text-xs text-slate-500 dark:border-slate-700">
            هنوز روش ارسالی ثبت نشده؛ مشتری هزینهٔ ارسال را با شما هماهنگ می‌کند.
          </p>
        )}

        <div className="grid gap-3 rounded-xl bg-slate-50 p-3 sm:grid-cols-2 dark:bg-slate-800/40">
          <Input
            label="نام روش (مثلاً پیک موتوری)"
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
          />
          <Input
            label="هزینه (تومان)"
            inputMode="numeric"
            value={form.cost}
            onChange={(event) => setForm({ ...form, cost: event.target.value.replace(/[^\d]/g, '') })}
          />
          <Input
            label="رایگان از مبلغ (اختیاری)"
            inputMode="numeric"
            value={form.freeAbove}
            onChange={(event) =>
              setForm({ ...form, freeAbove: event.target.value.replace(/[^\d]/g, '') })
            }
          />
          <Input
            label="زمان تقریبی (اختیاری)"
            value={form.estimatedDays}
            onChange={(event) => setForm({ ...form, estimatedDays: event.target.value })}
          />
          <div className="sm:col-span-2">
            <Button
              size="sm"
              loading={create.isPending}
              disabled={form.name.trim().length < 2}
              onClick={() => create.mutate()}
            >
              <Plus className="h-4 w-4" />
              افزودن روش ارسال
            </Button>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}

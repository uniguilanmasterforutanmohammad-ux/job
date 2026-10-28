'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CreditCard, Plus, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { api, ApiClientError } from '@/lib/api-client';
import { getAccessToken } from '@/lib/auth';
import { formatJalali, formatToman } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, Td, Th } from '@/components/ui/table';
import { Modal } from '@/components/ui/modal';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState, Skeleton } from '@/components/ui/empty-state';
import { SUB_STATUS_LABELS, SUB_STATUS_TONES } from '@/lib/status';
import { useEndUserNoun } from '@/lib/use-industry-registry';
import type { MembershipPlan, Paginated, StudentSubscription } from '@/lib/types';

const KIND_LABELS: Record<string, string> = {
  MONTHLY: 'ماهانه',
  QUARTERLY: 'فصلی',
  YEARLY: 'سالانه',
  SESSION_PACK: 'بسته جلسه',
  TIME_PACK: 'بسته زمانی',
  VIP: 'ویژه',
};

export default function SubscriptionsPage() {
  const token = getAccessToken();
  const { plural } = useEndUserNoun();
  const queryClient = useQueryClient();
  const [openPlan, setOpenPlan] = useState(false);
  const [planForm, setPlanForm] = useState({ name: '', kind: 'MONTHLY', price: '0', daysCount: '30' });

  const subsQuery = useQuery({
    queryKey: ['subscriptions'],
    queryFn: () => api.get<Paginated<StudentSubscription>>('/subscriptions?pageSize=50', token),
  });

  const plansQuery = useQuery({
    queryKey: ['subscription-plans'],
    queryFn: () => api.get<MembershipPlan[]>('/subscriptions/plans', token),
  });

  const createPlan = useMutation({
    mutationFn: () =>
      api.post(
        '/subscriptions/plans',
        {
          name: planForm.name,
          kind: planForm.kind,
          price: Number(planForm.price),
          daysCount: Number(planForm.daysCount) || undefined,
        },
        token,
      ),
    onSuccess: () => {
      toast.success('طرح عضویت ثبت شد');
      setOpenPlan(false);
      setPlanForm({ name: '', kind: 'MONTHLY', price: '0', daysCount: '30' });
      void queryClient.invalidateQueries({ queryKey: ['subscription-plans'] });
    },
    onError: (error) =>
      toast.error(error instanceof ApiClientError ? error.message : 'خطا در ثبت طرح'),
  });

  const renewals = useMutation({
    mutationFn: () => api.post<{ renewed: number }>('/subscriptions/renewals/run', {}, token),
    onSuccess: (data) => {
      toast.success(`${data.renewed} اشتراک تمدید شد`);
      void queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
    },
  });

  return (
    <div className="space-y-5">
      <PageHeader
        title="اشتراک، شهریه و عضویت"
        description={`مدیریت طرح‌ها، اشتراک ${plural}، بستهٔ جلسه و تمدید خودکار`}
        action={
          <div className="flex gap-2">
            <Button variant="outline" loading={renewals.isPending} onClick={() => renewals.mutate()}>
              <RefreshCw className="h-4 w-4" />
              اجرای تمدید خودکار
            </Button>
            <Button onClick={() => setOpenPlan(true)}>
              <Plus className="h-4 w-4" />
              طرح جدید
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {plansQuery.isLoading
          ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)
          : plansQuery.data?.map((plan) => (
              <Card key={plan.id}>
                <CardBody className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-900 dark:text-slate-100">{plan.name}</span>
                    <Badge tone="brand">{KIND_LABELS[plan.kind]}</Badge>
                  </div>
                  <p className="nums text-sm text-slate-500">{formatToman(plan.price)}</p>
                  <p className="text-xs text-slate-400">
                    {plan.daysCount ? `${plan.daysCount} روز` : ''}
                    {plan.sessionsCount ? ` · ${plan.sessionsCount} جلسه` : ''}
                  </p>
                </CardBody>
              </Card>
            ))}
      </div>

      <Card>
        <CardHeader title="اشتراک‌های فعال" />
        <CardBody className="p-0">
          {subsQuery.isLoading ? (
            <div className="space-y-2 p-5">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : subsQuery.data && subsQuery.data.data.length > 0 ? (
            <Table>
              <thead>
                <tr>
                  <Th>طرح</Th>
                  <Th>نوع</Th>
                  <Th>مبلغ</Th>
                  <Th>جلسات</Th>
                  <Th>پایان</Th>
                  <Th>وضعیت</Th>
                </tr>
              </thead>
              <tbody>
                {subsQuery.data.data.map((sub) => (
                  <tr key={sub.id}>
                    <Td className="font-medium">{sub.planName}</Td>
                    <Td>{KIND_LABELS[sub.kind] ?? sub.kind}</Td>
                    <Td className="nums">{formatToman(sub.price)}</Td>
                    <Td className="nums">
                      {sub.sessionsTotal ? `${sub.sessionsUsed} / ${sub.sessionsTotal}` : '—'}
                    </Td>
                    <Td className="nums">{formatJalali(sub.endsAt)}</Td>
                    <Td>
                      <Badge tone={SUB_STATUS_TONES[sub.status]}>{SUB_STATUS_LABELS[sub.status]}</Badge>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          ) : (
            <EmptyState
              icon={CreditCard}
              title="اشتراکی ثبت نشده است"
              description="با ساخت یک طرح عضویت شروع کنید."
            />
          )}
        </CardBody>
      </Card>

      <Modal
        open={openPlan}
        onClose={() => setOpenPlan(false)}
        title="ثبت طرح عضویت"
        footer={
          <>
            <Button variant="outline" onClick={() => setOpenPlan(false)}>
              انصراف
            </Button>
            <Button
              loading={createPlan.isPending}
              disabled={planForm.name.trim().length < 2}
              onClick={() => createPlan.mutate()}
            >
              ثبت
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="نام طرح"
            value={planForm.name}
            onChange={(e) => setPlanForm({ ...planForm, name: e.target.value })}
          />
          <Select
            label="نوع"
            value={planForm.kind}
            onChange={(e) => setPlanForm({ ...planForm, kind: e.target.value })}
          >
            {Object.entries(KIND_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
          <Input
            label="مبلغ (تومان)"
            dir="ltr"
            className="text-left nums"
            value={planForm.price}
            onChange={(e) => setPlanForm({ ...planForm, price: e.target.value.replace(/\D/g, '') })}
          />
          <Input
            label="مدت (روز)"
            dir="ltr"
            className="text-left nums"
            value={planForm.daysCount}
            onChange={(e) => setPlanForm({ ...planForm, daysCount: e.target.value.replace(/\D/g, '') })}
          />
        </div>
      </Modal>
    </div>
  );
}

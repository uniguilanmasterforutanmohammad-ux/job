'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Users } from 'lucide-react';
import { toast } from 'sonner';
import { api, ApiClientError } from '@/lib/api-client';
import { getAccessToken } from '@/lib/auth';
import { useBranchNoun, useEndUserNoun } from '@/lib/use-industry-registry';
import { formatJalali } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, Td, Th } from '@/components/ui/table';
import { Modal } from '@/components/ui/modal';
import { Select } from '@/components/ui/select';
import { EmptyState, Skeleton } from '@/components/ui/empty-state';
import { LEAD_STAGE_LABELS } from '@/lib/status';
import type { BranchOption, Customer, Paginated } from '@/lib/types';

export default function CustomersPage() {
  const token = getAccessToken();
  // «مشتری/مشتریان» برای آموزشگاه «زبان‌آموز/زبان‌آموزان»، برای کلینیک
  // «بیمار/بیماران» و … — از رجیستری صنف خوانده می‌شود.
  const { noun, plural } = useEndUserNoun();
  const branches = useBranchNoun();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ fullName: '', phone: '', branchId: '' });

  const branchesQuery = useQuery({
    queryKey: ['branches'],
    queryFn: () => api.get<BranchOption[]>('/tenant/branches', token),
  });

  const activeBranches = (branchesQuery.data ?? []).filter((branch) => branch.isActive);

  const { data, isLoading } = useQuery({
    queryKey: ['customers', search],
    queryFn: () =>
      api.get<Paginated<Customer>>(
        `/customers?search=${encodeURIComponent(search)}&pageSize=50`,
        token,
      ),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      api.post(
        '/customers',
        {
          fullName: form.fullName,
          phone: form.phone || undefined,
          branchId: form.branchId || undefined,
        },
        token,
      ),
    onSuccess: () => {
      toast.success(`${noun} ثبت شد`);
      setOpen(false);
      setForm({ fullName: '', phone: '', branchId: '' });
      void queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
    onError: (error) =>
      toast.error(error instanceof ApiClientError ? error.message : `خطا در ثبت ${noun}`),
  });

  /**
   * حذف «نرم» است (پرونده بایگانی می‌شود و شمارهٔ موبایلش آزاد می‌گردد) و
   * فقط مدیر/مالک (`crm:write`) اجازهٔ آن را دارد؛ با تأیید صریح انجام می‌شود.
   */
  const removeMutation = useMutation({
    mutationFn: (customer: Customer) => api.delete(`/customers/${customer.id}`, token),
    onSuccess: () => {
      toast.success(`${noun} حذف شد`);
      void queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
    onError: (error) =>
      toast.error(error instanceof ApiClientError ? error.message : `خطا در حذف ${noun}`),
  });

  const confirmRemove = (customer: Customer) => {
    const phone = customer.phone ? ` و شمارهٔ ${customer.phone} آزاد می‌شود` : '';
    if (
      window.confirm(
        `${noun} «${customer.fullName}» حذف شود؟ پرونده بایگانی می‌شود${phone}؛ اگر خودش با کد یکبار مصرف دوباره وارد شود، پرونده‌اش زنده می‌شود.`,
      )
    ) {
      removeMutation.mutate(customer);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">{plural}</h1>
          <p className="mt-1 text-sm text-slate-500">
            مدیریت پرونده {plural} و سرنخ‌ها
          </p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" />
          {noun} جدید
        </Button>
      </div>

      <Card>
        <CardHeader
          title={`فهرست ${plural}`}
          action={
            <div className="w-56">
              <Input
                placeholder="جست‌وجو..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
          }
        />
        <CardBody className="p-0">
          {isLoading ? (
            <div className="space-y-2 p-5">
              {Array.from({ length: 5 }).map((_, index) => (
                <Skeleton key={index} className="h-10 w-full" />
              ))}
            </div>
          ) : data && data.data.length > 0 ? (
            <Table>
              <thead>
                <tr>
                  <Th>نام</Th>
                  <Th>موبایل</Th>
                  <Th>وضعیت</Th>
                  <Th>برچسب‌ها</Th>
                  <Th>تاریخ ثبت</Th>
                  <Th>عملیات</Th>
                </tr>
              </thead>
              <tbody>
                {data.data.map((customer) => (
                  <tr key={customer.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                    <Td className="font-medium text-slate-900 dark:text-slate-100">{customer.fullName}</Td>
                    <Td className="nums">{customer.phone ?? '—'}</Td>
                    <Td>
                      <Badge tone={customer.leadStage === 'WON' ? 'success' : 'info'}>
                        {LEAD_STAGE_LABELS[customer.leadStage]}
                      </Badge>
                    </Td>
                    <Td>
                      <div className="flex flex-wrap gap-1">
                        {customer.tags.length > 0 ? (
                          customer.tags.map((tag) => (
                            <Badge key={tag} tone="neutral">
                              {tag}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </div>
                    </Td>
                    <Td className="nums">{formatJalali(customer.createdAt)}</Td>
                    <Td>
                      <Button
                        size="sm"
                        variant="ghost"
                        loading={removeMutation.isPending && removeMutation.variables?.id === customer.id}
                        disabled={removeMutation.isPending}
                        onClick={() => confirmRemove(customer)}
                        aria-label={`حذف ${noun}`}
                      >
                        <Trash2 className="h-4 w-4 text-rose-500" />
                      </Button>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          ) : (
            <EmptyState
              icon={Users}
              title={`هنوز ${noun}ی ثبت نشده است`}
              description={`برای شروع، اولین ${noun} خود را اضافه کنید.`}
              action={
                <Button onClick={() => setOpen(true)}>
                  <Plus className="h-4 w-4" />
                  {noun} جدید
                </Button>
              }
            />
          )}
        </CardBody>
      </Card>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={`ثبت ${noun} جدید`}
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)}>
              انصراف
            </Button>
            <Button
              loading={createMutation.isPending}
              disabled={form.fullName.trim().length < 2}
              onClick={() => createMutation.mutate()}
            >
              ثبت
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="نام و نام خانوادگی"
            value={form.fullName}
            onChange={(event) => setForm({ ...form, fullName: event.target.value })}
          />
          <Input
            label="شماره موبایل"
            dir="ltr"
            className="text-left nums"
            placeholder="۰۹۱۲۳۴۵۶۷۸۹"
            value={form.phone}
            onChange={(event) =>
              setForm({ ...form, phone: event.target.value.replace(/\D/g, '').slice(0, 11) })
            }
          />
          {activeBranches.length > 0 && (
            <Select
              label={`${branches.noun} (اختیاری)`}
              value={form.branchId}
              onChange={(event) => setForm({ ...form, branchId: event.target.value })}
            >
              <option value="">— انتخاب {branches.noun} —</option>
              {activeBranches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </Select>
          )}
        </div>
      </Modal>
    </div>
  );
}

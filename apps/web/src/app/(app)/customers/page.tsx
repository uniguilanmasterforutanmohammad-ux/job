'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Users } from 'lucide-react';
import { toast } from 'sonner';
import { api, ApiClientError } from '@/lib/api-client';
import { getAccessToken } from '@/lib/auth';
import { formatJalali } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, Td, Th } from '@/components/ui/table';
import { Modal } from '@/components/ui/modal';
import { EmptyState, Skeleton } from '@/components/ui/empty-state';
import { LEAD_STAGE_LABELS } from '@/lib/status';
import type { Customer, Paginated } from '@/lib/types';

export default function CustomersPage() {
  const token = getAccessToken();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ fullName: '', phone: '', city: '' });

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
      api.post('/customers', { fullName: form.fullName, phone: form.phone || undefined, city: form.city || undefined }, token),
    onSuccess: () => {
      toast.success('مشتری ثبت شد');
      setOpen(false);
      setForm({ fullName: '', phone: '', city: '' });
      void queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
    onError: (error) =>
      toast.error(error instanceof ApiClientError ? error.message : 'خطا در ثبت مشتری'),
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">مشتریان</h1>
          <p className="mt-1 text-sm text-slate-500">مدیریت پرونده مشتریان و سرنخ‌ها</p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" />
          مشتری جدید
        </Button>
      </div>

      <Card>
        <CardHeader
          title="فهرست مشتریان"
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
                  <Th>شهر</Th>
                  <Th>وضعیت</Th>
                  <Th>برچسب‌ها</Th>
                  <Th>تاریخ ثبت</Th>
                </tr>
              </thead>
              <tbody>
                {data.data.map((customer) => (
                  <tr key={customer.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                    <Td className="font-medium text-slate-900 dark:text-slate-100">{customer.fullName}</Td>
                    <Td className="nums">{customer.phone ?? '—'}</Td>
                    <Td>{customer.city ?? '—'}</Td>
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
                  </tr>
                ))}
              </tbody>
            </Table>
          ) : (
            <EmptyState
              icon={Users}
              title="مشتری‌ای ثبت نشده است"
              description="برای شروع، اولین مشتری خود را اضافه کنید."
              action={
                <Button onClick={() => setOpen(true)}>
                  <Plus className="h-4 w-4" />
                  مشتری جدید
                </Button>
              }
            />
          )}
        </CardBody>
      </Card>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="ثبت مشتری جدید"
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
          <Input
            label="شهر"
            value={form.city}
            onChange={(event) => setForm({ ...form, city: event.target.value })}
          />
        </div>
      </Modal>
    </div>
  );
}

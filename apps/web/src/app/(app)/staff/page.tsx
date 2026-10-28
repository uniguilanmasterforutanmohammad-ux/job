'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, UserCog } from 'lucide-react';
import { toast } from 'sonner';
import { api, ApiClientError } from '@/lib/api-client';
import { getAccessToken } from '@/lib/auth';
import { formatJalali, formatToman } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, Td, Th } from '@/components/ui/table';
import { Modal } from '@/components/ui/modal';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState, Skeleton } from '@/components/ui/empty-state';
import { LEAVE_STATUS_LABELS, LEAVE_STATUS_TONES, PAYROLL_STATUS_LABELS, PAYROLL_STATUS_TONES } from '@/lib/status';
import type { LeaveRequest, Paginated, PayrollEntry, StaffProfile } from '@/lib/types';

export default function StaffPage() {
  const token = getAccessToken();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ fullName: '', phone: '', position: '', baseSalary: '0', commissionRate: '0' });

  const staffQuery = useQuery({
    queryKey: ['staff'],
    queryFn: () => api.get<Paginated<StaffProfile>>('/staff?pageSize=50', token),
  });

  const leavesQuery = useQuery({
    queryKey: ['leaves'],
    queryFn: () => api.get<LeaveRequest[]>('/staff/leaves/all', token),
  });

  const payrollQuery = useQuery({
    queryKey: ['payroll'],
    queryFn: () => api.get<PayrollEntry[]>('/staff/payroll/all', token),
  });

  const createStaff = useMutation({
    mutationFn: () =>
      api.post(
        '/staff',
        {
          fullName: form.fullName,
          phone: form.phone || undefined,
          position: form.position || undefined,
          baseSalary: Number(form.baseSalary),
          commissionRate: Number(form.commissionRate),
        },
        token,
      ),
    onSuccess: () => {
      toast.success('کارمند ثبت شد');
      setOpen(false);
      setForm({ fullName: '', phone: '', position: '', baseSalary: '0', commissionRate: '0' });
      void queryClient.invalidateQueries({ queryKey: ['staff'] });
    },
    onError: (error) =>
      toast.error(error instanceof ApiClientError ? error.message : 'خطا در ثبت کارمند'),
  });

  const approveLeave = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch(`/staff/leaves/${id}`, { status }, token),
    onSuccess: () => {
      toast.success('وضعیت مرخصی به‌روزرسانی شد');
      void queryClient.invalidateQueries({ queryKey: ['leaves'] });
    },
  });

  const generatePayroll = useMutation({
    mutationFn: () => {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      return api.post<{ created: number }>(
        '/staff/payroll/generate',
        { periodStart: start.toISOString(), periodEnd: now.toISOString() },
        token,
      );
    },
    onSuccess: (data) => {
      toast.success(`${data.created} فیش حقوقی ساخته شد`);
      void queryClient.invalidateQueries({ queryKey: ['payroll'] });
    },
  });

  return (
    <div className="space-y-5">
      <PageHeader
        title="کارکنان و حقوق"
        description="پروفایل، مرخصی، کارنامه و فیش حقوقی"
        action={
          <div className="flex gap-2">
            <Button variant="outline" loading={generatePayroll.isPending} onClick={() => generatePayroll.mutate()}>
              تولید فیش حقوقی
            </Button>
            <Button onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4" />
              کارمند جدید
            </Button>
          </div>
        }
      />

      <Card>
        <CardHeader title="فهرست کارکنان" />
        <CardBody className="p-0">
          {staffQuery.isLoading ? (
            <div className="space-y-2 p-5">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : staffQuery.data && staffQuery.data.data.length > 0 ? (
            <Table>
              <thead>
                <tr>
                  <Th>نام</Th>
                  <Th>سمت</Th>
                  <Th>حقوق پایه</Th>
                  <Th>پورسانت</Th>
                  <Th>موبایل</Th>
                </tr>
              </thead>
              <tbody>
                {staffQuery.data.data.map((s) => (
                  <tr key={s.id}>
                    <Td className="font-medium">{s.fullName}</Td>
                    <Td>{s.position ?? '—'}</Td>
                    <Td className="nums">{formatToman(s.baseSalary)}</Td>
                    <Td className="nums">{Number(s.commissionRate).toLocaleString('fa-IR')}٪</Td>
                    <Td className="nums">{s.phone ?? '—'}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          ) : (
            <EmptyState icon={UserCog} title="کارمندی ثبت نشده است" />
          )}
        </CardBody>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title="درخواست‌های مرخصی" />
          <CardBody className="p-0">
            {leavesQuery.data && leavesQuery.data.length > 0 ? (
              <Table>
                <thead>
                  <tr>
                    <Th>از</Th>
                    <Th>تا</Th>
                    <Th>وضعیت</Th>
                    <Th>عملیات</Th>
                  </tr>
                </thead>
                <tbody>
                  {leavesQuery.data.map((leave) => (
                    <tr key={leave.id}>
                      <Td className="nums">{formatJalali(leave.fromDate)}</Td>
                      <Td className="nums">{formatJalali(leave.toDate)}</Td>
                      <Td>
                        <Badge tone={LEAVE_STATUS_TONES[leave.status]}>
                          {LEAVE_STATUS_LABELS[leave.status]}
                        </Badge>
                      </Td>
                      <Td>
                        {leave.status === 'PENDING' && (
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              onClick={() => approveLeave.mutate({ id: leave.id, status: 'APPROVED' })}
                            >
                              تأیید
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => approveLeave.mutate({ id: leave.id, status: 'REJECTED' })}
                            >
                              رد
                            </Button>
                          </div>
                        )}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            ) : (
              <p className="p-5 text-sm text-slate-500">درخواستی ثبت نشده است.</p>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="فیش‌های حقوقی" />
          <CardBody className="p-0">
            {payrollQuery.data && payrollQuery.data.length > 0 ? (
              <Table>
                <thead>
                  <tr>
                    <Th>دوره</Th>
                    <Th>خالص پرداختی</Th>
                    <Th>وضعیت</Th>
                  </tr>
                </thead>
                <tbody>
                  {payrollQuery.data.map((entry) => (
                    <tr key={entry.id}>
                      <Td className="nums">{formatJalali(entry.periodStart)}</Td>
                      <Td className="nums">{formatToman(entry.netPay)}</Td>
                      <Td>
                        <Badge tone={PAYROLL_STATUS_TONES[entry.status]}>
                          {PAYROLL_STATUS_LABELS[entry.status]}
                        </Badge>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            ) : (
              <p className="p-5 text-sm text-slate-500">فیشی تولید نشده است.</p>
            )}
          </CardBody>
        </Card>
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="ثبت کارمند جدید"
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)}>
              انصراف
            </Button>
            <Button
              loading={createStaff.isPending}
              disabled={form.fullName.trim().length < 2}
              onClick={() => createStaff.mutate()}
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
            onChange={(e) => setForm({ ...form, fullName: e.target.value })}
          />
          <Input
            label="موبایل"
            dir="ltr"
            className="text-left nums"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value.replace(/\D/g, '').slice(0, 11) })}
          />
          <Input
            label="سمت"
            value={form.position}
            onChange={(e) => setForm({ ...form, position: e.target.value })}
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="حقوق پایه (تومان)"
              dir="ltr"
              className="text-left nums"
              value={form.baseSalary}
              onChange={(e) => setForm({ ...form, baseSalary: e.target.value.replace(/\D/g, '') })}
            />
            <Input
              label="پورسانت (٪)"
              dir="ltr"
              className="text-left nums"
              value={form.commissionRate}
              onChange={(e) => setForm({ ...form, commissionRate: e.target.value.replace(/\D/g, '') })}
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}

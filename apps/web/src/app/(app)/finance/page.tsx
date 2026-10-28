'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Receipt, Wallet } from 'lucide-react';
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
import { INSTALLMENT_STATUS_LABELS, INSTALLMENT_STATUS_TONES } from '@/lib/status';
import type { CashSession, Expense, Installment, Paginated } from '@/lib/types';

type ProfitLoss = {
  revenue: number;
  expenses: number;
  expenseCount: number;
  netProfit: number;
  margin: number;
};

export default function FinancePage() {
  const token = getAccessToken();
  const queryClient = useQueryClient();
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [cashOpen, setCashOpen] = useState(false);
  const [expenseForm, setExpenseForm] = useState({ category: '', title: '', amount: '' });
  const [countedCash, setCountedCash] = useState('0');

  const installmentsQuery = useQuery({
    queryKey: ['installments'],
    queryFn: () => api.get<Installment[]>('/finance/installments', token),
  });

  const expensesQuery = useQuery({
    queryKey: ['expenses'],
    queryFn: () => api.get<Paginated<Expense>>('/finance/expenses?pageSize=50', token),
  });

  const cashQuery = useQuery({
    queryKey: ['cash-sessions'],
    queryFn: () => api.get<CashSession[]>('/finance/cash-sessions', token),
  });

  const profitLossQuery = useQuery({
    queryKey: ['profit-loss'],
    queryFn: () => api.get<ProfitLoss>('/finance/profit-loss', token),
  });

  const openCash = cashQuery.data?.find((s) => s.status === 'OPEN');

  const createExpense = useMutation({
    mutationFn: () =>
      api.post('/finance/expenses', { ...expenseForm, amount: Number(expenseForm.amount) }, token),
    onSuccess: () => {
      toast.success('هزینه ثبت شد');
      setExpenseOpen(false);
      setExpenseForm({ category: '', title: '', amount: '' });
      void queryClient.invalidateQueries({ queryKey: ['expenses'] });
      void queryClient.invalidateQueries({ queryKey: ['profit-loss'] });
    },
    onError: (error) =>
      toast.error(error instanceof ApiClientError ? error.message : 'خطا در ثبت هزینه'),
  });

  const startCash = useMutation({
    mutationFn: () => api.post('/finance/cash-sessions/open', { openingFloat: 0 }, token),
    onSuccess: () => {
      toast.success('صندوق باز شد');
      void queryClient.invalidateQueries({ queryKey: ['cash-sessions'] });
    },
  });

  const closeCash = useMutation({
    mutationFn: () =>
      api.post(`/finance/cash-sessions/${openCash!.id}/close`, { countedCash: Number(countedCash) }, token),
    onSuccess: () => {
      toast.success('صندوق بسته شد');
      setCashOpen(false);
      void queryClient.invalidateQueries({ queryKey: ['cash-sessions'] });
    },
  });

  const payInstallment = useMutation({
    mutationFn: (id: string) => api.post(`/finance/installments/${id}/pay`, { lateFee: 0 }, token),
    onSuccess: () => {
      toast.success('قسط پرداخت شد');
      void queryClient.invalidateQueries({ queryKey: ['installments'] });
    },
  });

  return (
    <div className="space-y-5">
      <PageHeader
        title="مالی — اقساط، هزینه و صندوق"
        description="سود و زیان، اقساط مشتریان، هزینه‌ها و مغایرت صندوق"
        action={
          <div className="flex gap-2">
            {openCash ? (
              <Button variant="outline" onClick={() => setCashOpen(true)}>
                بستن صندوق
              </Button>
            ) : (
              <Button variant="outline" loading={startCash.isPending} onClick={() => startCash.mutate()}>
                باز کردن صندوق
              </Button>
            )}
            <Button onClick={() => setExpenseOpen(true)}>
              <Receipt className="h-4 w-4" />
              ثبت هزینه
            </Button>
          </div>
        }
      />

      {profitLossQuery.data && (
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardBody>
              <p className="text-sm text-slate-500">درآمد دوره</p>
              <p className="nums mt-1 text-lg font-bold text-emerald-600">
                {formatToman(profitLossQuery.data.revenue)}
              </p>
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <p className="text-sm text-slate-500">هزینه دوره</p>
              <p className="nums mt-1 text-lg font-bold text-red-600">
                {formatToman(profitLossQuery.data.expenses)}
              </p>
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <p className="text-sm text-slate-500">سود خالص</p>
              <p
                className={`nums mt-1 text-lg font-bold ${
                  profitLossQuery.data.netProfit >= 0 ? 'text-emerald-600' : 'text-red-600'
                }`}
              >
                {formatToman(profitLossQuery.data.netProfit)}
              </p>
            </CardBody>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader title="اقساط" />
        <CardBody className="p-0">
          {installmentsQuery.isLoading ? (
            <div className="space-y-2 p-5">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : installmentsQuery.data && installmentsQuery.data.length > 0 ? (
            <Table>
              <thead>
                <tr>
                  <Th>قسط</Th>
                  <Th>مبلغ</Th>
                  <Th>سررسید</Th>
                  <Th>وضعیت</Th>
                  <Th>عملیات</Th>
                </tr>
              </thead>
              <tbody>
                {installmentsQuery.data.map((inst) => (
                  <tr key={inst.id}>
                    <Td className="nums">قسط {inst.number}</Td>
                    <Td className="nums">{formatToman(inst.amount)}</Td>
                    <Td className="nums">{formatJalali(inst.dueDate)}</Td>
                    <Td>
                      <Badge tone={INSTALLMENT_STATUS_TONES[inst.status]}>
                        {INSTALLMENT_STATUS_LABELS[inst.status]}
                      </Badge>
                    </Td>
                    <Td>
                      {inst.status !== 'PAID' && (
                        <Button size="sm" onClick={() => payInstallment.mutate(inst.id)}>
                          پرداخت
                        </Button>
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          ) : (
            <p className="p-5 text-sm text-slate-500">قسطی ثبت نشده است.</p>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="هزینه‌ها" />
        <CardBody className="p-0">
          {expensesQuery.data && expensesQuery.data.data.length > 0 ? (
            <Table>
              <thead>
                <tr>
                  <Th>عنوان</Th>
                  <Th>دسته</Th>
                  <Th>مبلغ</Th>
                  <Th>تاریخ</Th>
                </tr>
              </thead>
              <tbody>
                {expensesQuery.data.data.map((exp) => (
                  <tr key={exp.id}>
                    <Td className="font-medium">{exp.title}</Td>
                    <Td>{exp.category}</Td>
                    <Td className="nums">{formatToman(exp.amount)}</Td>
                    <Td className="nums">{formatJalali(exp.spentAt)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          ) : (
            <EmptyState icon={Wallet} title="هزینه‌ای ثبت نشده است" />
          )}
        </CardBody>
      </Card>

      {cashQuery.data && cashQuery.data.length > 0 && (
        <Card>
          <CardHeader title="صندوق" />
          <CardBody className="p-0">
            <Table>
              <thead>
                <tr>
                  <Th>باز شده</Th>
                  <Th>موجودی ابتدایی</Th>
                  <Th>شمارش‌شده</Th>
                  <Th>مغایرت</Th>
                  <Th>وضعیت</Th>
                </tr>
              </thead>
              <tbody>
                {cashQuery.data.map((s) => (
                  <tr key={s.id}>
                    <Td className="nums">{formatJalali(s.openedAt, true)}</Td>
                    <Td className="nums">{formatToman(s.openingFloat)}</Td>
                    <Td className="nums">{s.countedCash ? formatToman(s.countedCash) : '—'}</Td>
                    <Td className="nums">
                      {s.difference != null ? formatToman(s.difference) : '—'}
                    </Td>
                    <Td>
                      <Badge tone={s.status === 'OPEN' ? 'info' : 'neutral'}>
                        {s.status === 'OPEN' ? 'باز' : 'بسته'}
                      </Badge>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </CardBody>
        </Card>
      )}

      <Modal
        open={expenseOpen}
        onClose={() => setExpenseOpen(false)}
        title="ثبت هزینه"
        footer={
          <>
            <Button variant="outline" onClick={() => setExpenseOpen(false)}>
              انصراف
            </Button>
            <Button
              loading={createExpense.isPending}
              disabled={expenseForm.title.trim().length < 2 || !expenseForm.category}
              onClick={() => createExpense.mutate()}
            >
              ثبت
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="عنوان"
            value={expenseForm.title}
            onChange={(e) => setExpenseForm({ ...expenseForm, title: e.target.value })}
          />
          <Input
            label="دسته"
            hint="مثلاً: اجاره، قبوض، تبلیغات"
            value={expenseForm.category}
            onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value })}
          />
          <Input
            label="مبلغ (تومان)"
            dir="ltr"
            className="text-left nums"
            value={expenseForm.amount}
            onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value.replace(/\D/g, '') })}
          />
        </div>
      </Modal>

      <Modal
        open={cashOpen}
        onClose={() => setCashOpen(false)}
        title="بستن صندوق"
        footer={
          <>
            <Button variant="outline" onClick={() => setCashOpen(false)}>
              انصراف
            </Button>
            <Button loading={closeCash.isPending} onClick={() => closeCash.mutate()}>
              بستن
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="مبلغ شمارش‌شده (تومان)"
            dir="ltr"
            className="text-left nums"
            value={countedCash}
            onChange={(e) => setCountedCash(e.target.value.replace(/\D/g, ''))}
          />
        </div>
      </Modal>
    </div>
  );
}

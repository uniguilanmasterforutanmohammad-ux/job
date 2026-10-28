'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, BadgePercent, Link2, RotateCcw, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import { api, ApiClientError } from '@/lib/api-client';
import { getAccessToken } from '@/lib/auth';
import { useEndUserNoun } from '@/lib/use-industry-registry';
import { formatJalali, formatToman } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, Td, Th } from '@/components/ui/table';
import { Modal } from '@/components/ui/modal';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState, Skeleton } from '@/components/ui/empty-state';
import type {
  DebtorReport,
  DiscountCode,
  PaymentLink,
  Refund,
} from '@/lib/types-extra';
import type { Customer, Paginated } from '@/lib/types';

const REFUND_STATUS_LABELS: Record<Refund['status'], string> = {
  REQUESTED: 'در انتظار تأیید',
  APPROVED: 'تأییدشده',
  REJECTED: 'ردشده',
  COMPLETED: 'انجام‌شده',
};

export default function FinanceAdvancedPage() {
  const token = getAccessToken();
  const { noun } = useEndUserNoun();
  const queryClient = useQueryClient();
  const [customerId, setCustomerId] = useState('');
  const [discountOpen, setDiscountOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [refundOpen, setRefundOpen] = useState(false);
  const [discountForm, setDiscountForm] = useState({ code: '', percent: '10' });
  const [linkForm, setLinkForm] = useState({ amount: '', title: '' });
  const [refundForm, setRefundForm] = useState({ invoiceId: '', amount: '', reason: '', toWallet: true });

  const customersQuery = useQuery({
    queryKey: ['customers-mini'],
    queryFn: () => api.get<Paginated<Customer>>('/customers?pageSize=100', token),
  });

  const refundsQuery = useQuery({
    queryKey: ['refunds'],
    queryFn: () => api.get<Refund[]>('/finance/refunds', token),
  });

  const discountsQuery = useQuery({
    queryKey: ['discounts'],
    queryFn: () => api.get<DiscountCode[]>('/finance/discounts', token),
  });

  const linksQuery = useQuery({
    queryKey: ['payment-links'],
    queryFn: () => api.get<PaymentLink[]>('/finance/payment-links', token),
  });

  const debtorsQuery = useQuery({
    queryKey: ['debtors'],
    queryFn: () => api.get<DebtorReport>('/finance/reports/debtors?minAmount=1', token),
  });

  const walletQuery = useQuery({
    queryKey: ['wallet', customerId],
    queryFn: () => api.get<{ balance: number }>(`/finance/wallet?customerId=${customerId}`, token),
    enabled: Boolean(customerId),
  });

  const createDiscount = useMutation({
    mutationFn: () =>
      api.post('/finance/discounts', { code: discountForm.code, percent: Number(discountForm.percent) }, token),
    onSuccess: () => {
      toast.success('کد تخفیف ثبت شد');
      setDiscountOpen(false);
      setDiscountForm({ code: '', percent: '10' });
      void queryClient.invalidateQueries({ queryKey: ['discounts'] });
    },
    onError: (e) => toast.error(e instanceof ApiClientError ? e.message : 'خطا'),
  });

  const createLink = useMutation({
    mutationFn: () =>
      api.post<PaymentLink>(
        '/finance/payment-links',
        { amount: Number(linkForm.amount), title: linkForm.title || undefined, customerId: customerId || undefined },
        token,
      ),
    onSuccess: (link) => {
      toast.success('لینک پرداخت ساخته شد');
      setLinkOpen(false);
      setLinkForm({ amount: '', title: '' });
      if (link?.url) void navigator.clipboard?.writeText(link.url);
      void queryClient.invalidateQueries({ queryKey: ['payment-links'] });
    },
    onError: (e) => toast.error(e instanceof ApiClientError ? e.message : 'خطا'),
  });

  const createRefund = useMutation({
    mutationFn: () =>
      api.post('/finance/refunds', {
        invoiceId: refundForm.invoiceId,
        amount: Number(refundForm.amount),
        reason: refundForm.reason,
        toWallet: refundForm.toWallet,
      }, token),
    onSuccess: () => {
      toast.success('درخواست استرداد ثبت شد');
      setRefundOpen(false);
      setRefundForm({ invoiceId: '', amount: '', reason: '', toWallet: true });
      void queryClient.invalidateQueries({ queryKey: ['refunds'] });
    },
    onError: (e) => toast.error(e instanceof ApiClientError ? e.message : 'خطا'),
  });

  const approveRefund = useMutation({
    mutationFn: (id: string) => api.patch(`/finance/refunds/${id}/approve`, {}, token),
    onSuccess: () => {
      toast.success('استرداد انجام شد');
      void queryClient.invalidateQueries({ queryKey: ['refunds'] });
    },
  });

  const adjustWallet = useMutation({
    mutationFn: (amount: number) =>
      api.post('/finance/wallet/adjust', { customerId, amount, type: 'CREDIT', reason: 'شارژ دستی' }, token),
    onSuccess: () => {
      toast.success('کیف پول شارژ شد');
      void queryClient.invalidateQueries({ queryKey: ['wallet', customerId] });
    },
  });

  return (
    <div className="space-y-5">
      <PageHeader
        title="مالی پیشرفته"
        description="کیف پول، استرداد، کد تخفیف، لینک پرداخت و گزارش بدهکاران"
        action={
          <Link href="/finance">
            <Button variant="outline" size="sm">
              <ArrowRight className="h-4 w-4" />
              اقساط و صندوق
            </Button>
          </Link>
        }
      />

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader
            title={`کیف پول ${noun}`}
            description="شارژ، مصرف و گردش اعتبار"
            action={
              <Button size="sm" variant="outline" onClick={() => adjustWallet.mutate(100000)} disabled={!customerId}>
                شارژ ۱۰۰٬۰۰۰
              </Button>
            }
          />
          <CardBody className="space-y-3">
            <select
              className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900"
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
            >
              <option value="">انتخاب {noun}…</option>
              {customersQuery.data?.data.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.fullName} — {c.phone ?? '—'}
                </option>
              ))}
            </select>
            {customerId && (
              <div className="flex items-center gap-2 rounded-xl bg-slate-50 p-3 text-sm dark:bg-slate-800">
                <Wallet className="h-4 w-4 text-brand-600" />
                موجودی فعلی: <strong>{formatToman(walletQuery.data?.balance ?? 0)}</strong>
              </div>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="کدهای تخفیف (FIN-08)" />
          <CardBody>
            {discountsQuery.isLoading ? (
              <Skeleton className="h-24 w-full" />
            ) : discountsQuery.data?.length ? (
              <Table>
                <thead>
                  <tr>
                    <Th>کد</Th>
                    <Th>مقدار</Th>
                    <Th>استفاده</Th>
                    <Th>وضعیت</Th>
                  </tr>
                </thead>
                <tbody>
                  {discountsQuery.data.map((d) => (
                    <tr key={d.id}>
                      <Td className="font-mono">{d.code}</Td>
                      <Td>{d.percent ? `${d.percent}%` : formatToman(d.amount ?? 0)}</Td>
                      <Td>
                        {d.usedCount}/{d.maxUses ?? '∞'}
                      </Td>
                      <Td>
                        <Badge tone={d.isActive ? 'success' : 'neutral'}>{d.isActive ? 'فعال' : 'غیرفعال'}</Badge>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            ) : (
              <EmptyState title="کد تخفیفی ثبت نشده" />
            )}
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="لینک‌های پرداخت (FIN-13)"
          description={`لینک پیامکی/QR برای پرداخت ${noun}`}
        />
        <CardBody>
          {linksQuery.isLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : linksQuery.data?.length ? (
            <Table>
              <thead>
                <tr>
                  <Th>عنوان</Th>
                  <Th>مبلغ</Th>
                  <Th>وضعیت</Th>
                  <Th>بازدید</Th>
                  <Th>تاریخ</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {linksQuery.data.map((l) => (
                  <tr key={l.id}>
                    <Td>{l.title ?? '—'}</Td>
                    <Td>{formatToman(l.amount)}</Td>
                    <Td>
                      <Badge tone={l.status === 'PAID' ? 'success' : l.status === 'ACTIVE' ? 'info' : 'neutral'}>
                        {l.status === 'PAID' ? 'پرداخت‌شده' : l.status === 'ACTIVE' ? 'فعال' : l.status}
                      </Badge>
                    </Td>
                    <Td>{l.visitedCount}</Td>
                    <Td>{formatJalali(l.createdAt)}</Td>
                    <Td>
                      <Button size="sm" variant="ghost" onClick={() => void navigator.clipboard?.writeText(l.url)}>
                        <Link2 className="h-3.5 w-3.5" />
                        کپی لینک
                      </Button>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          ) : (
            <EmptyState title="لینک پرداختی ساخته نشده" />
          )}
        </CardBody>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title="استرداد (FIN-07)" />
          <CardBody>
            {refundsQuery.data?.length ? (
              <Table>
                <thead>
                  <tr>
                    <Th>مبلغ</Th>
                    <Th>دلیل</Th>
                    <Th>وضعیت</Th>
                    <Th />
                  </tr>
                </thead>
                <tbody>
                  {refundsQuery.data.map((r) => (
                    <tr key={r.id}>
                      <Td>{formatToman(r.amount)}</Td>
                      <Td className="max-w-[12rem] truncate">{r.reason}</Td>
                      <Td>
                        <Badge tone={r.status === 'COMPLETED' ? 'success' : r.status === 'REJECTED' ? 'danger' : 'warning'}>
                          {REFUND_STATUS_LABELS[r.status]}
                        </Badge>
                      </Td>
                      <Td>
                        {r.status === 'REQUESTED' && (
                          <Button size="sm" loading={approveRefund.isPending} onClick={() => approveRefund.mutate(r.id)}>
                            <RotateCcw className="h-3.5 w-3.5" />
                            تأیید
                          </Button>
                        )}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            ) : (
              <EmptyState title="استردادی ثبت نشده" />
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="گزارش بدهکاران (FIN-05)" description={`مجموع: ${formatToman(debtorsQuery.data?.totalDebt ?? 0)}`} />
          <CardBody>
            {debtorsQuery.data?.data.length ? (
              <Table>
                <thead>
                  <tr>
                    <Th>{noun}</Th>
                    <Th>بدهی</Th>
                    <Th>فاکتور</Th>
                  </tr>
                </thead>
                <tbody>
                  {debtorsQuery.data.data.slice(0, 10).map((d) => (
                    <tr key={d.customerId}>
                      <Td>{d.fullName}</Td>
                      <Td className="text-red-600">{formatToman(d.debt)}</Td>
                      <Td>{d.invoices}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            ) : (
              <EmptyState title="بدهکاری ثبت نشده" />
            )}
          </CardBody>
        </Card>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button onClick={() => setDiscountOpen(true)}>
          <BadgePercent className="h-4 w-4" />
          کد تخفیف جدید
        </Button>
        <Button variant="outline" onClick={() => setLinkOpen(true)}>
          <Link2 className="h-4 w-4" />
          لینک پرداخت جدید
        </Button>
        <Button variant="outline" onClick={() => setRefundOpen(true)}>
          <RotateCcw className="h-4 w-4" />
          ثبت استرداد
        </Button>
      </div>

      <Modal
        open={discountOpen}
        onClose={() => setDiscountOpen(false)}
        title="کد تخفیف جدید"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDiscountOpen(false)}>
              انصراف
            </Button>
            <Button loading={createDiscount.isPending} onClick={() => createDiscount.mutate()}>
              ثبت
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Input label="کد" value={discountForm.code} onChange={(e) => setDiscountForm({ ...discountForm, code: e.target.value.toUpperCase() })} />
          <Input label="درصد تخفیف" type="number" value={discountForm.percent} onChange={(e) => setDiscountForm({ ...discountForm, percent: e.target.value })} />
        </div>
      </Modal>

      <Modal
        open={linkOpen}
        onClose={() => setLinkOpen(false)}
        title="لینک پرداخت جدید"
        footer={
          <>
            <Button variant="ghost" onClick={() => setLinkOpen(false)}>
              انصراف
            </Button>
            <Button loading={createLink.isPending} onClick={() => createLink.mutate()}>
              ساخت
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Input label="مبلغ (ریال)" type="number" value={linkForm.amount} onChange={(e) => setLinkForm({ ...linkForm, amount: e.target.value })} />
          <Input label="عنوان" value={linkForm.title} onChange={(e) => setLinkForm({ ...linkForm, title: e.target.value })} />
        </div>
      </Modal>

      <Modal
        open={refundOpen}
        onClose={() => setRefundOpen(false)}
        title="ثبت درخواست استرداد"
        footer={
          <>
            <Button variant="ghost" onClick={() => setRefundOpen(false)}>
              انصراف
            </Button>
            <Button loading={createRefund.isPending} onClick={() => createRefund.mutate()}>
              ثبت
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Input label="شناسه فاکتور" value={refundForm.invoiceId} onChange={(e) => setRefundForm({ ...refundForm, invoiceId: e.target.value })} />
          <Input label="مبلغ (ریال)" type="number" value={refundForm.amount} onChange={(e) => setRefundForm({ ...refundForm, amount: e.target.value })} />
          <Input label="دلیل" value={refundForm.reason} onChange={(e) => setRefundForm({ ...refundForm, reason: e.target.value })} />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={refundForm.toWallet}
              onChange={(e) => setRefundForm({ ...refundForm, toWallet: e.target.checked })}
            />
            واریز به کیف پول {noun}
          </label>
        </div>
      </Modal>
    </div>
  );
}

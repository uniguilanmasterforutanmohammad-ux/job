'use client';

import { useQuery } from '@tanstack/react-query';
import { Wallet } from 'lucide-react';
import { api } from '@/lib/api-client';
import { getAccessToken } from '@/lib/auth';
import { formatJalali, formatToman } from '@/lib/utils';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, Td, Th } from '@/components/ui/table';
import { EmptyState, Skeleton } from '@/components/ui/empty-state';
import { PAYMENT_METHOD_LABELS } from '@/lib/status';

type PaymentRow = {
  id: string;
  amount: string;
  method: string;
  status: string;
  provider: string | null;
  trackingCode: string | null;
  createdAt: string;
  invoice: { id: string; number: string } | null;
};

export default function PaymentsPage() {
  const token = getAccessToken();
  const { data, isLoading } = useQuery({
    queryKey: ['payments'],
    queryFn: () => api.get<PaymentRow[]>('/payments', token),
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">پرداخت‌ها</h1>
        <p className="mt-1 text-sm text-slate-500">
          تراکنش‌های آنلاین و دستی، سازگار با درگاه اصلی و حالت دولوپر
        </p>
      </div>

      <Card>
        <CardHeader title="تراکنش‌ها" description="آخرین پرداخت‌های ثبت‌شده" />
        <CardBody className="p-0">
          {isLoading ? (
            <div className="space-y-2 p-5">
              {Array.from({ length: 5 }).map((_, index) => (
                <Skeleton key={index} className="h-10 w-full" />
              ))}
            </div>
          ) : data && data.length > 0 ? (
            <Table>
              <thead>
                <tr>
                  <Th>مبلغ</Th>
                  <Th>روش</Th>
                  <Th>درگاه</Th>
                  <Th>کد پیگیری</Th>
                  <Th>وضعیت</Th>
                  <Th>تاریخ</Th>
                </tr>
              </thead>
              <tbody>
                {data.map((payment) => (
                  <tr key={payment.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                    <Td className="nums font-medium text-slate-900 dark:text-slate-100">
                      {formatToman(payment.amount)}
                    </Td>
                    <Td>{PAYMENT_METHOD_LABELS[payment.method] ?? payment.method}</Td>
                    <Td>{payment.provider ?? '—'}</Td>
                    <Td className="font-mono text-xs">{payment.trackingCode ?? '—'}</Td>
                    <Td>
                      <Badge tone={payment.status === 'SUCCEEDED' ? 'success' : 'warning'}>
                        {payment.status === 'SUCCEEDED' ? 'موفق' : 'در انتظار'}
                      </Badge>
                    </Td>
                    <Td className="nums">{formatJalali(payment.createdAt)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          ) : (
            <EmptyState icon={Wallet} title="پرداختی ثبت نشده است" />
          )}
        </CardBody>
      </Card>
    </div>
  );
}

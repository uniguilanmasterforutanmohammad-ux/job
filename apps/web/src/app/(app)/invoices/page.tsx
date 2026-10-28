'use client';

import { useQuery } from '@tanstack/react-query';
import { FileText } from 'lucide-react';
import { api } from '@/lib/api-client';
import { getAccessToken } from '@/lib/auth';
import { formatJalali, formatToman } from '@/lib/utils';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, Td, Th } from '@/components/ui/table';
import { EmptyState, Skeleton } from '@/components/ui/empty-state';
import { INVOICE_STATUS_LABELS, INVOICE_STATUS_TONES } from '@/lib/status';
import type { Invoice, Paginated } from '@/lib/types';

export default function InvoicesPage() {
  const token = getAccessToken();
  const { data, isLoading } = useQuery({
    queryKey: ['invoices'],
    queryFn: () => api.get<Paginated<Invoice>>('/invoices?pageSize=50', token),
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">فاکتورها</h1>
        <p className="mt-1 text-sm text-slate-500">صدور و پیگیری فاکتورها و مالیات</p>
      </div>

      <Card>
        <CardHeader title="فهرست فاکتورها" description="آخرین فاکتورهای صادرشده" />
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
                  <Th>شماره</Th>
                  <Th>مشتری</Th>
                  <Th>مبلغ کل</Th>
                  <Th>پرداخت‌شده</Th>
                  <Th>وضعیت</Th>
                  <Th>تاریخ صدور</Th>
                </tr>
              </thead>
              <tbody>
                {data.data.map((invoice) => (
                  <tr key={invoice.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                    <Td className="font-mono text-xs">{invoice.number}</Td>
                    <Td className="font-medium text-slate-900 dark:text-slate-100">
                      {invoice.customer.fullName}
                    </Td>
                    <Td className="nums">{formatToman(invoice.total)}</Td>
                    <Td className="nums">{formatToman(invoice.paidTotal)}</Td>
                    <Td>
                      <Badge tone={INVOICE_STATUS_TONES[invoice.status] ?? 'neutral'}>
                        {INVOICE_STATUS_LABELS[invoice.status] ?? invoice.status}
                      </Badge>
                    </Td>
                    <Td className="nums">{formatJalali(invoice.issueDate)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          ) : (
            <EmptyState icon={FileText} title="فاکتوری صادر نشده است" />
          )}
        </CardBody>
      </Card>
    </div>
  );
}

'use client';

import { use } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, CalendarDays, FileText, MessageSquare, Receipt, Wallet } from 'lucide-react';
import { api } from '@/lib/api-client';
import { getAccessToken } from '@/lib/auth';
import { formatJalali, formatToman } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState, Skeleton } from '@/components/ui/empty-state';
import type { CustomerHistory } from '@/lib/types-extra';

const TYPE_ICONS: Record<string, typeof CalendarDays> = {
  appointment: CalendarDays,
  invoice: Receipt,
  payment: Wallet,
  message: MessageSquare,
  document: FileText,
  chat: MessageSquare,
};

const TYPE_LABELS: Record<string, string> = {
  appointment: 'نوبت',
  invoice: 'فاکتور',
  payment: 'پرداخت',
  message: 'پیام',
  document: 'سند',
  chat: 'گفتگو',
};

export default function CustomerHistoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const token = getAccessToken();

  const historyQuery = useQuery({
    queryKey: ['customer-history', id],
    queryFn: () => api.get<CustomerHistory>(`/customers/${id}/history?limit=100`, token),
  });

  const data = historyQuery.data;

  return (
    <div className="space-y-5">
      <PageHeader
        title={`تاریخچه کامل${data?.customer.fullName ? ` — ${data.customer.fullName}` : ''}`}
        description="خدمات، فاکتورها، پرداخت‌ها، پیام‌ها و اسناد (CRM-02)"
        action={
          <Link href="/customers">
            <Button variant="outline" size="sm">
              <ArrowRight className="h-4 w-4" />
              بازگشت
            </Button>
          </Link>
        }
      />

      {historyQuery.isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : data ? (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardBody>
                <p className="text-sm text-slate-500">مجموع پرداخت</p>
                <p className="mt-1 text-xl font-bold text-emerald-600">{formatToman(data.summary.totalPaid)}</p>
              </CardBody>
            </Card>
            <Card>
              <CardBody>
                <p className="text-sm text-slate-500">مانده بدهی</p>
                <p className="mt-1 text-xl font-bold text-red-600">{formatToman(data.summary.outstanding)}</p>
              </CardBody>
            </Card>
            <Card>
              <CardBody>
                <p className="text-sm text-slate-500">تعداد نوبت‌ها</p>
                <p className="mt-1 text-xl font-bold">{data.summary.appointments.toLocaleString('fa-IR')}</p>
              </CardBody>
            </Card>
          </div>

          <Card>
            <CardHeader title="خط زمانی فعالیت‌ها" />
            <CardBody>
              {data.timeline.length ? (
                <ol className="relative space-y-4 border-r border-slate-200 pr-5 dark:border-slate-700">
                  {data.timeline.map((item) => {
                    const Icon = TYPE_ICONS[item.type] ?? CalendarDays;
                    return (
                      <li key={`${item.type}-${item.refId}`} className="relative">
                        <span className="absolute -right-[1.9rem] flex h-7 w-7 items-center justify-center rounded-full bg-brand-50 text-brand-600 dark:bg-brand-900/40">
                          <Icon className="h-3.5 w-3.5" />
                        </span>
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <span className="text-xs text-slate-400">{TYPE_LABELS[item.type]}</span>
                            <p className="font-medium">{item.title}</p>
                          </div>
                          <div className="text-left">
                            {item.amount != null && (
                              <p className="text-sm font-semibold">{formatToman(item.amount)}</p>
                            )}
                            <p className="text-xs text-slate-400">{formatJalali(item.at, true)}</p>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              ) : (
                <EmptyState title="فعالیتی ثبت نشده" />
              )}
            </CardBody>
          </Card>
        </>
      ) : (
        <EmptyState title="مشتری یافت نشد" />
      )}
    </div>
  );
}

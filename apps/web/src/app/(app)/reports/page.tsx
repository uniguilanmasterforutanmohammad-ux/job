'use client';

import { useQuery } from '@tanstack/react-query';
import { BarChart3 } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { api } from '@/lib/api-client';
import { getAccessToken } from '@/lib/auth';
import { useEndUserNoun } from '@/lib/use-industry-registry';
import { formatNumber, formatToman } from '@/lib/utils';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { EmptyState, Skeleton } from '@/components/ui/empty-state';

type RevenuePoint = { date: string; amount: number };

export default function ReportsPage() {
  const token = getAccessToken();
  const { plural } = useEndUserNoun();

  const { data: revenue, isLoading } = useQuery({
    queryKey: ['reports', 'revenue'],
    queryFn: () => api.get<RevenuePoint[]>('/reports/revenue', token),
  });

  const { data: customers } = useQuery({
    queryKey: ['reports', 'customers'],
    queryFn: () =>
      api.get<{ newCustomers: number; totalCustomers: number; activeCustomers: number }>(
        '/reports/customers',
        token,
      ),
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">گزارش‌ها</h1>
        <p className="mt-1 text-sm text-slate-500">تحلیل درآمد، {plural} و عملکرد</p>
      </div>

      {customers && (
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardBody>
              <p className="text-xs text-slate-500">{plural} کل</p>
              <p className="mt-1 text-lg font-bold nums">{formatNumber(customers.totalCustomers)}</p>
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <p className="text-xs text-slate-500">{plural} جدید (۳۰ روز)</p>
              <p className="mt-1 text-lg font-bold nums">{formatNumber(customers.newCustomers)}</p>
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <p className="text-xs text-slate-500">{plural} فعال (۳۰ روز)</p>
              <p className="mt-1 text-lg font-bold nums">{formatNumber(customers.activeCustomers)}</p>
            </CardBody>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader title="روند درآمد" description="درآمد روزانه در ۳۰ روز گذشته" />
        <CardBody>
          {isLoading ? (
            <Skeleton className="h-72 w-full" />
          ) : revenue && revenue.length > 0 ? (
            <div className="h-72 w-full" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={revenue}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip
                    formatter={(value) => formatToman(Number(value ?? 0))}
                    contentStyle={{ borderRadius: 12, direction: 'rtl', fontFamily: 'inherit' }}
                  />
                  <Bar dataKey="amount" fill="#3563ff" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState
              icon={BarChart3}
              title="داده‌ای برای نمایش نیست"
              description="پس از ثبت پرداخت‌ها، نمودار درآمد نمایش داده می‌شود."
            />
          )}
        </CardBody>
      </Card>
    </div>
  );
}

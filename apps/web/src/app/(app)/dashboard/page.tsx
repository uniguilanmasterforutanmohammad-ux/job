'use client';

import { useQuery } from '@tanstack/react-query';
import {
  CalendarCheck,
  CalendarClock,
  TrendingUp,
  UserPlus,
  Users,
  Wallet,
} from 'lucide-react';
import { api } from '@/lib/api-client';
import { getAccessToken } from '@/lib/auth';
import { useEndUserNoun } from '@/lib/use-industry-registry';
import { formatNumber, formatToman } from '@/lib/utils';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/empty-state';
import type { DashboardStats, Appointment } from '@/lib/types';
import { MODULE_LABELS } from '@repo/shared';
import { formatJalali } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { APPOINTMENT_STATUS_LABELS, APPOINTMENT_STATUS_TONES } from '@/lib/status';

export default function DashboardPage() {
  const token = getAccessToken();
  const { plural } = useEndUserNoun();

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api.get<DashboardStats>('/reports/dashboard', token),
  });

  const { data: appointments } = useQuery({
    queryKey: ['appointments', 'upcoming'],
    queryFn: () => api.get<Appointment[]>('/scheduling/appointments', token),
  });

  if (isLoading || !data) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-28 w-full" />
        ))}
      </div>
    );
  }

  const kpis = [
    { label: 'درآمد امروز', value: formatToman(data.revenueToday), icon: TrendingUp, tone: 'brand' },
    { label: 'درآمد این ماه', value: formatToman(data.revenueMonth), icon: Wallet, tone: 'success' },
    { label: 'نوبت‌های امروز', value: formatNumber(data.appointmentsToday), icon: CalendarCheck, tone: 'info' },
    { label: 'نوبت‌های فردا', value: formatNumber(data.appointmentsTomorrow), icon: CalendarClock, tone: 'warning' },
    { label: `${plural} کل`, value: formatNumber(data.totalCustomers), icon: Users, tone: 'neutral' },
    { label: `${plural} جدید این ماه`, value: formatNumber(data.newCustomersMonth), icon: UserPlus, tone: 'brand' },
    { label: 'مطالبات معوق', value: formatToman(data.outstanding), icon: Wallet, tone: 'danger' },
  ];

  const upcoming = (appointments ?? []).slice(0, 6);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">داشبورد</h1>
        <p className="mt-1 text-sm text-slate-500">نمای کلی عملکرد کسب‌وکار شما</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <Card key={kpi.label}>
              <CardBody className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs text-slate-500">{kpi.label}</p>
                  <p className="mt-1.5 text-lg font-bold text-slate-900 dark:text-slate-100 nums">
                    {kpi.value}
                  </p>
                </div>
                <div className="rounded-xl bg-brand-50 p-2.5 text-brand-600 dark:bg-brand-900/30 dark:text-brand-300">
                  <Icon className="h-5 w-5" />
                </div>
              </CardBody>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="نوبت‌های پیش‌رو" description="نزدیک‌ترین نوبت‌های ثبت‌شده" />
          <CardBody className="p-0">
            {upcoming.length === 0 ? (
              <p className="p-5 text-sm text-slate-500">نوبتی ثبت نشده است.</p>
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {upcoming.map((appointment) => (
                  <li key={appointment.id} className="flex items-center justify-between px-5 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-200">
                        {appointment.customer.fullName}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {appointment.service?.name ?? 'بدون خدمت'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <span className="nums">{formatJalali(appointment.startsAt, true)}</span>
                      <Badge tone={APPOINTMENT_STATUS_TONES[appointment.status]}>
                        {APPOINTMENT_STATUS_LABELS[appointment.status]}
                      </Badge>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="ماژول‌های فعال" description="قابلیت‌های در دسترس کسب‌وکار" />
          <CardBody className="flex flex-wrap gap-2">
            {data.enabledModules.map((key) => (
              <Badge key={key} tone="brand">
                {MODULE_LABELS[key]}
              </Badge>
            ))}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

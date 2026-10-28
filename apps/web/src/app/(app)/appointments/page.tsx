'use client';

import { useQuery } from '@tanstack/react-query';
import { CalendarDays } from 'lucide-react';
import { api } from '@/lib/api-client';
import { getAccessToken } from '@/lib/auth';
import { formatJalali } from '@/lib/utils';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState, Skeleton } from '@/components/ui/empty-state';
import { APPOINTMENT_STATUS_LABELS, APPOINTMENT_STATUS_TONES } from '@/lib/status';
import type { Appointment } from '@/lib/types';

export default function AppointmentsPage() {
  const token = getAccessToken();
  const { data, isLoading } = useQuery({
    queryKey: ['appointments'],
    queryFn: () => api.get<Appointment[]>('/scheduling/appointments', token),
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">نوبت‌ها</h1>
        <p className="mt-1 text-sm text-slate-500">تقویم و برنامه نوبت‌دهی</p>
      </div>

      <Card>
        <CardHeader title="فهرست نوبت‌ها" description="نوبت‌های ثبت‌شده به ترتیب زمان" />
        <CardBody className="p-0">
          {isLoading ? (
            <div className="space-y-2 p-5">
              {Array.from({ length: 5 }).map((_, index) => (
                <Skeleton key={index} className="h-12 w-full" />
              ))}
            </div>
          ) : data && data.length > 0 ? (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {data.map((appointment) => (
                <li
                  key={appointment.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"
                >
                  <div className="flex items-center gap-3">
                    <div className="rounded-xl bg-brand-50 p-2 text-brand-600 dark:bg-brand-900/30 dark:text-brand-300">
                      <CalendarDays className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                        {appointment.customer.fullName}
                      </p>
                      <p className="text-xs text-slate-500 nums">
                        {appointment.service?.name ?? 'بدون خدمت'} ·{' '}
                        {formatJalali(appointment.startsAt, true)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-slate-500 nums">
                      {appointment.customer.phone ?? '—'}
                    </span>
                    <Badge tone={APPOINTMENT_STATUS_TONES[appointment.status]}>
                      {APPOINTMENT_STATUS_LABELS[appointment.status]}
                    </Badge>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon={CalendarDays} title="نوبتی ثبت نشده است" />
          )}
        </CardBody>
      </Card>
    </div>
  );
}

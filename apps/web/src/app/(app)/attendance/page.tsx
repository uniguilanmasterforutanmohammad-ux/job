'use client';

import { useQuery } from '@tanstack/react-query';
import { UserCheck } from 'lucide-react';
import { api } from '@/lib/api-client';
import { getAccessToken } from '@/lib/auth';
import { formatJalali } from '@/lib/utils';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, Td, Th } from '@/components/ui/table';
import { EmptyState, Skeleton } from '@/components/ui/empty-state';
import { QrAttendancePanel } from '@/components/attendance/qr-panel';
import { AbsenceRequestsPanel } from '@/components/attendance/absence-requests-panel';

type AttendanceRow = {
  id: string;
  status: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED' | 'CANCELED';
  method: string;
  date: string;
  checkInAt: string | null;
  customer: { id: string; fullName: string } | null;
};

type Branch = { id: string; name: string };

const STATUS_LABELS: Record<AttendanceRow['status'], string> = {
  PRESENT: 'حاضر',
  ABSENT: 'غایب',
  LATE: 'تأخیر',
  EXCUSED: 'موجه',
  CANCELED: 'لغوشده',
};

export default function AttendancePage() {
  const token = getAccessToken();
  const { data, isLoading } = useQuery({
    queryKey: ['attendance'],
    queryFn: () => api.get<AttendanceRow[]>('/attendance', token),
  });
  const branchesQuery = useQuery({
    queryKey: ['branches'],
    queryFn: () => api.get<Branch[]>('/tenant/branches', token),
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">حضور و غیاب</h1>
        <p className="mt-1 text-sm text-slate-500">ثبت و پیگیری حضور مشتریان و کارکنان</p>
      </div>

      <QrAttendancePanel branches={branchesQuery.data ?? []} />

      <AbsenceRequestsPanel />

      <Card>
        <CardHeader title="سوابق حضور" description="آخرین ثبت‌های حضور" />
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
                  <Th>نام</Th>
                  <Th>وضعیت</Th>
                  <Th>روش ثبت</Th>
                  <Th>ساعت ورود</Th>
                  <Th>تاریخ</Th>
                </tr>
              </thead>
              <tbody>
                {data.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                    <Td className="font-medium text-slate-900 dark:text-slate-100">
                      {row.customer?.fullName ?? 'کارمند'}
                    </Td>
                    <Td>
                      <Badge
                        tone={
                          row.status === 'PRESENT'
                            ? 'success'
                            : row.status === 'LATE'
                              ? 'warning'
                              : 'danger'
                        }
                      >
                        {STATUS_LABELS[row.status]}
                      </Badge>
                    </Td>
                    <Td>{row.method}</Td>
                    <Td className="nums">
                      {row.checkInAt ? formatJalali(row.checkInAt, true).split('،').pop() : '—'}
                    </Td>
                    <Td className="nums">{formatJalali(row.date)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          ) : (
            <EmptyState icon={UserCheck} title="حضوری ثبت نشده است" />
          )}
        </CardBody>
      </Card>
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Copy, QrCode, RefreshCw, Square, Users } from 'lucide-react';
import { toast } from 'sonner';
import { api, ApiClientError } from '@/lib/api-client';
import { getAccessToken, useAuth } from '@/lib/auth';
import { useIndustryRegistry } from '@/lib/use-industry-registry';
import { formatJalali } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/modal';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { EmptyState, Skeleton } from '@/components/ui/empty-state';

type QrSession = {
  id: string;
  label: string | null;
  code: string;
  rotateSeconds: number;
  radiusMeters: number;
  requireOtp: boolean;
  status: 'OPEN' | 'CLOSED' | 'EXPIRED';
  expiresAt: string;
  createdAt: string;
  checkInUrl: string;
  token: string;
  tokenExpiresInSeconds: number;
  qrDataUrl: string | null;
};

type SessionAttendance = {
  id: string;
  status: string;
  method: string;
  checkInAt: string | null;
  customer: { id: string; fullName: string; phone: string | null } | null;
};

type Branch = { id: string; name: string };

const STATUS_LABELS: Record<QrSession['status'], string> = {
  OPEN: 'باز',
  CLOSED: 'بسته',
  EXPIRED: 'منقضی',
};

export function QrAttendancePanel({ branches }: { branches: Branch[] }) {
  const token = getAccessToken();
  const { me } = useAuth();
  const registry = useIndustryRegistry();
  const nounPlural = registry.noun(me?.tenant.industry, true);
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [form, setForm] = useState({
    label: '',
    branchId: '',
    rotateSeconds: '45',
    radiusMeters: '150',
    requireOtp: true,
    ttlMinutes: '120',
  });

  const sessionsQuery = useQuery({
    queryKey: ['attendance-qr-sessions'],
    queryFn: () => api.get<QrSession[]>('/attendance/qr/sessions', token),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      api.post<QrSession>(
        '/attendance/qr/sessions',
        {
          label: form.label.trim() || undefined,
          branchId: form.branchId || undefined,
          rotateSeconds: Number(form.rotateSeconds),
          radiusMeters: Number(form.radiusMeters),
          requireOtp: form.requireOtp,
          ttlMinutes: Number(form.ttlMinutes),
        },
        token,
      ),
    onSuccess: (session) => {
      toast.success('جلسه حاضری ساخته شد');
      setCreateOpen(false);
      setActiveId(session.id);
      void queryClient.invalidateQueries({ queryKey: ['attendance-qr-sessions'] });
    },
    onError: (error) =>
      toast.error(error instanceof ApiClientError ? error.message : 'خطا در ساخت جلسه'),
  });

  const closeMutation = useMutation({
    mutationFn: (id: string) => api.post(`/attendance/qr/sessions/${id}/close`, {}, token),
    onSuccess: () => {
      toast.success('جلسه بسته شد');
      void queryClient.invalidateQueries({ queryKey: ['attendance-qr-sessions'] });
    },
    onError: () => toast.error('خطا در بستن جلسه'),
  });

  // Live QR: poll the active session so the rotating token stays fresh.
  const liveQuery = useQuery({
    queryKey: ['attendance-qr-session', activeId],
    queryFn: () => api.get<QrSession>(`/attendance/qr/sessions/${activeId}`, token),
    enabled: Boolean(activeId),
    refetchInterval: 5000,
  });

  const liveAttendances = useQuery({
    queryKey: ['attendance-qr-session-attendance', activeId],
    queryFn: () =>
      api.get<SessionAttendance[]>(`/attendance/qr/sessions/${activeId}/attendances`, token),
    enabled: Boolean(activeId),
    refetchInterval: 5000,
  });

  const live = liveQuery.data ?? null;
  const sessions = sessionsQuery.data ?? [];

  return (
    <Card>
      <CardHeader
        title="حاضری با QR"
        description={`یک QR یا لینک بساز و روی صفحه نمایش بده؛ ${nounPlural} با اسکن و کد تأیید موبایل حاضری می‌زنند.`}
        action={
          <Button onClick={() => setCreateOpen(true)}>
            <QrCode className="h-4 w-4" />
            جلسه QR جدید
          </Button>
        }
      />
      <CardBody className="space-y-5">
        {activeId && live ? (
          <LiveSession
            session={live}
            attendances={liveAttendances.data ?? []}
            onClose={() => closeMutation.mutate(live.id)}
            onExit={() => setActiveId(null)}
            closing={closeMutation.isPending}
          />
        ) : sessionsQuery.isLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : sessions.length === 0 ? (
          <EmptyState icon={QrCode} title="هنوز جلسه‌ای ساخته نشده است" />
        ) : (
          <div className="space-y-2">
            {sessions.map((session) => (
              <button
                key={session.id}
                type="button"
                onClick={() => setActiveId(session.id)}
                className="flex w-full items-center justify-between rounded-xl border border-slate-200 p-3 text-right transition hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/40"
              >
                <div>
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                    {session.label ?? 'جلسه حاضری'}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500 nums" dir="ltr">
                    {session.code}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400">
                    {formatJalali(session.createdAt, true)}
                  </span>
                  <Badge tone={session.status === 'OPEN' ? 'success' : 'neutral'}>
                    {STATUS_LABELS[session.status]}
                  </Badge>
                </div>
              </button>
            ))}
          </div>
        )}
      </CardBody>

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="ساخت جلسه حاضری QR"
        footer={
          <>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              انصراف
            </Button>
            <Button loading={createMutation.isPending} onClick={() => createMutation.mutate()}>
              ساخت جلسه
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="عنوان جلسه (اختیاری)"
            placeholder="مثلاً تمرین شنبه"
            value={form.label}
            onChange={(event) => setForm({ ...form, label: event.target.value })}
          />
          {branches.length > 0 && (
            <Select
              label="شعبه"
              value={form.branchId}
              onChange={(event) => setForm({ ...form, branchId: event.target.value })}
            >
              <option value="">بدون شعبه</option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </Select>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Select
              label="چرخش QR"
              value={form.rotateSeconds}
              onChange={(event) => setForm({ ...form, rotateSeconds: event.target.value })}
            >
              <option value="30">هر ۳۰ ثانیه</option>
              <option value="45">هر ۴۵ ثانیه</option>
              <option value="60">هر ۶۰ ثانیه</option>
              <option value="120">هر ۲ دقیقه</option>
            </Select>
            <Input
              label="اعتبار (دقیقه)"
              dir="ltr"
              className="text-left nums"
              value={form.ttlMinutes}
              onChange={(event) =>
                setForm({ ...form, ttlMinutes: event.target.value.replace(/\D/g, '').slice(0, 3) })
              }
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="شعاع مجاز (متر)"
              dir="ltr"
              className="text-left nums"
              value={form.radiusMeters}
              onChange={(event) =>
                setForm({
                  ...form,
                  radiusMeters: event.target.value.replace(/\D/g, '').slice(0, 5),
                })
              }
            />
            <label className="flex items-end gap-2 pb-2 text-sm text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={form.requireOtp}
                onChange={(event) => setForm({ ...form, requireOtp: event.target.checked })}
                className="h-4 w-4 rounded border-slate-300"
              />
              الزام کد تأیید موبایل (پیشنهادی)
            </label>
          </div>
          <p className="text-xs text-slate-500">
            کد QR هر چند ثانیه تغییر می‌کند تا عکس‌گرفتن از صفحه بی‌فایده باشد.
          </p>
        </div>
      </Modal>
    </Card>
  );
}

function LiveSession({
  session,
  attendances,
  onClose,
  onExit,
  closing,
}: {
  session: QrSession;
  attendances: SessionAttendance[];
  onClose: () => void;
  onExit: () => void;
  closing: boolean;
}) {
  const [secondsLeft, setSecondsLeft] = useState(session.tokenExpiresInSeconds);

  useEffect(() => {
    setSecondsLeft(session.tokenExpiresInSeconds);
  }, [session.token, session.tokenExpiresInSeconds]);

  useEffect(() => {
    const timer = setInterval(() => setSecondsLeft((value) => (value > 0 ? value - 1 : 0)), 1000);
    return () => clearInterval(timer);
  }, []);

  const isOpen = session.status === 'OPEN';

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            {session.label ?? 'جلسه حاضری'}
          </p>
          <p className="mt-1 flex items-center gap-2 text-xs text-slate-500">
            کد:
            <span
              className="nums font-mono font-semibold text-slate-700 dark:text-slate-300"
              dir="ltr"
            >
              {session.code}
            </span>
            <Badge tone={isOpen ? 'success' : 'neutral'}>{STATUS_LABELS[session.status]}</Badge>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onExit}>
            فهرست جلسه‌ها
          </Button>
          {isOpen && (
            <Button variant="danger" size="sm" loading={closing} onClick={onClose}>
              <Square className="h-4 w-4" />
              بستن جلسه
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-[320px_1fr]">
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
          {isOpen && session.qrDataUrl ? (
            <>
              <Image
                src={session.qrDataUrl}
                alt="QR حاضری"
                width={280}
                height={280}
                unoptimized
                className="rounded-lg bg-white p-2"
              />
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <RefreshCw className="h-3.5 w-3.5" />
                تازه‌سازی تا {secondsLeft} ثانیه
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  void navigator.clipboard.writeText(session.checkInUrl);
                  toast.success('لینک کپی شد');
                }}
              >
                <Copy className="h-4 w-4" />
                کپی لینک
              </Button>
            </>
          ) : (
            <EmptyState
              icon={QrCode}
              title={isOpen ? 'در حال آماده‌سازی QR' : 'این جلسه بسته است'}
            />
          )}
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
            <Users className="h-4 w-4" />
            حاضران ({attendances.length})
          </div>
          {attendances.length === 0 ? (
            <EmptyState icon={Users} title="هنوز کسی حاضری نزده است" />
          ) : (
            <div className="space-y-2">
              {attendances.map((row) => (
                <div
                  key={row.id}
                  className="flex items-center justify-between rounded-xl border border-slate-200 p-2.5 dark:border-slate-800"
                >
                  <div>
                    <p className="text-sm text-slate-900 dark:text-slate-100">
                      {row.customer?.fullName ?? '—'}
                    </p>
                    <p className="text-xs text-slate-400 nums" dir="ltr">
                      {row.customer?.phone ?? ''}
                    </p>
                  </div>
                  <span className="text-xs text-slate-500 nums">
                    {row.checkInAt ? formatJalali(row.checkInAt, true).split('،').pop() : '—'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

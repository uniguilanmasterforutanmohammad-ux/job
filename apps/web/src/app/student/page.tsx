'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  BadgeCheck,
  Building2,
  CalendarDays,
  CheckCircle2,
  CreditCard,
  Gift,
  LogOut,
  MapPin,
  Phone,
  QrCode,
  ShieldCheck,
  Star,
  UserCheck,
} from 'lucide-react';
import { toast } from 'sonner';
import { api, ApiClientError } from '@/lib/api-client';
import { formatJalali, formatToman } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState, Skeleton } from '@/components/ui/empty-state';
import type {
  AbsenceRequest,
  PortalLoyalty,
  StudentAttendance,
  StudentCheckInTarget,
  StudentClub,
  StudentLoginResult,
} from '@/lib/types-extra';

const STUDENT_TOKEN_KEY = 'bp_student_token';
const STUDENT_USER_KEY = 'bp_student_user';

type StudentSession = {
  accessToken: string;
  fullName: string;
  phone: string | null;
  tenantId: string;
  tenantName: string;
};

type Appointment = {
  id: string;
  startsAt: string;
  status: string;
  service: { name: string } | null;
};

type Invoice = {
  id: string;
  number: string;
  total: string;
  paidTotal: string;
  status: string;
};

const CLUB_INDUSTRY_LABELS: Record<string, string> = {
  SPORTS_COACHING: 'ورزشی',
  LANGUAGE_SCHOOL: 'آموزش زبان',
  BEAUTY: 'زیبایی',
  HEALTHCARE: 'سلامت',
  ART_MUSIC: 'هنر و موسیقی',
  EARLY_CHILD: 'کودک',
  PSYCHOLOGY: 'روان‌شناسی',
  LEGAL: 'حقوقی',
  MEDIA_PHOTO: 'رسانه و عکاسی',
  TECHNOLOGY: 'فناوری',
  RESTAURANT_CAFE: 'رستوران و کافه',
  RETAIL: 'فروشگاهی',
  TECHNICAL_SERVICES: 'خدمات فنی',
  REAL_ESTATE: 'املاک',
  TRANSPORT: 'حمل‌ونقل',
  TOURISM: 'گردشگری',
  BUSINESS_CONSULTING: 'مشاوره کسب‌وکار',
  OTHER: 'سایر',
};

const ATTENDANCE_STATUS_LABELS: Record<string, string> = {
  PRESENT: 'حاضر',
  ABSENT: 'غایب',
  LATE: 'تأخیر',
  EXCUSED: 'موجه',
  CANCELED: 'لغوشده',
};

const ABSENCE_STATUS_LABELS: Record<string, string> = {
  PENDING: 'در انتظار بررسی',
  APPROVED: 'تأییدشده (موجه)',
  REJECTED: 'ردشده',
  CANCELED: 'لغوشده',
};

const ABSENCE_STATUS_TONES: Record<string, 'warning' | 'success' | 'danger' | 'neutral'> = {
  PENDING: 'warning',
  APPROVED: 'success',
  REJECTED: 'danger',
  CANCELED: 'neutral',
};

const ABSENCE_REASONS = ['بیماری', 'مسافرت', 'شرایط شخصی', 'بدون اطلاع قبلی', 'سایر'];

function useStudentSession() {
  const [session, setSession] = useState<StudentSession | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const raw = localStorage.getItem(STUDENT_USER_KEY);
    if (raw) {
      try {
        setSession(JSON.parse(raw) as StudentSession);
      } catch {
        localStorage.removeItem(STUDENT_USER_KEY);
      }
    }
    setReady(true);
  }, []);
  const save = (value: StudentSession) => {
    localStorage.setItem(STUDENT_TOKEN_KEY, value.accessToken);
    localStorage.setItem(STUDENT_USER_KEY, JSON.stringify(value));
    setSession(value);
  };
  const clear = () => {
    localStorage.removeItem(STUDENT_TOKEN_KEY);
    localStorage.removeItem(STUDENT_USER_KEY);
    setSession(null);
  };
  return { session, ready, save, clear };
}

export default function StudentPage() {
  const { session, ready, save, clear } = useStudentSession();

  if (!ready) return null;

  return (
    <div className="mx-auto min-h-screen max-w-3xl space-y-5 p-4 pb-16">
      <header className="flex items-center justify-between rounded-2xl bg-brand-600 p-5 text-white">
        <div>
          <h1 className="text-lg font-bold">پنل کاربری من</h1>
          <p className="text-sm text-white/80">
            {session
              ? `${session.fullName} • ${session.tenantName}`
              : 'باشگاه‌ها، حاضری، نوبت و پرداخت'}
          </p>
        </div>
        {session && (
          <Button variant="ghost" className="text-white" onClick={clear}>
            <LogOut className="h-4 w-4" />
            خروج
          </Button>
        )}
      </header>

      {session ? (
        <StudentDashboard session={session} onLogout={clear} />
      ) : (
        <StudentLogin onSuccess={save} />
      )}
    </div>
  );
}

function StudentLogin({ onSuccess }: { onSuccess: (s: StudentSession) => void }) {
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'phone' | 'code'>('phone');

  const requestOtp = useMutation({
    mutationFn: () => api.post('/app/auth/otp/request-global', { phone }),
    onSuccess: () => {
      toast.success('کد ورود ارسال شد');
      setStep('code');
    },
    onError: (e) => toast.error(e instanceof ApiClientError ? e.message : 'خطا در ارسال کد'),
  });

  const verifyOtp = useMutation({
    mutationFn: () => api.post<StudentLoginResult>('/app/auth/otp/verify-global', { phone, code }),
    onSuccess: (result) => {
      onSuccess({
        accessToken: result.tokens.accessToken,
        fullName: result.user.fullName,
        phone: result.user.phone,
        tenantId: result.user.tenantId,
        tenantName: result.user.tenantName,
      });
      toast.success('خوش آمدید');
    },
    onError: (e) => toast.error(e instanceof ApiClientError ? e.message : 'کد نامعتبر است'),
  });

  return (
    <Card>
      <CardHeader
        title="ورود با موبایل"
        description="با شماره موبایل وارد شوید؛ همه باشگاه‌های شما یک‌جا نمایش داده می‌شوند"
      />
      <CardBody className="space-y-4">
        <Input
          label="شماره موبایل"
          placeholder="09xxxxxxxxx"
          dir="ltr"
          className="text-left nums"
          inputMode="numeric"
          value={phone}
          onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 11))}
          disabled={step === 'code'}
        />
        {step === 'code' && (
          <Input
            label="کد یکبار مصرف"
            inputMode="numeric"
            dir="ltr"
            className="text-center tracking-[0.4em] nums"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 8))}
          />
        )}
        {step === 'phone' ? (
          <Button
            className="w-full"
            loading={requestOtp.isPending}
            disabled={!/^09\d{9}$/.test(phone)}
            onClick={() => requestOtp.mutate()}
          >
            <Phone className="h-4 w-4" />
            دریافت کد
          </Button>
        ) : (
          <Button
            className="w-full"
            loading={verifyOtp.isPending}
            disabled={!code}
            onClick={() => verifyOtp.mutate()}
          >
            <ShieldCheck className="h-4 w-4" />
            ورود
          </Button>
        )}
        <p className="text-center text-xs text-slate-400">
          در حالت توسعه، کد ثابت <span className="font-mono nums">123456</span> پذیرفته می‌شود.
        </p>
      </CardBody>
    </Card>
  );
}

function StudentDashboard({
  session,
  onLogout,
}: {
  session: StudentSession;
  onLogout: () => void;
}) {
  const token = session.accessToken;
  const queryClient = useQueryClient();
  const apiGet = useMemo(
    () =>
      <T,>(p: string) =>
        api.get<T>(p, token),
    [token],
  );
  const apiPost = useMemo(
    () =>
      <T,>(p: string, b?: unknown) =>
        api.post<T>(p, b, token),
    [token],
  );

  const clubsQuery = useQuery({
    queryKey: ['student-clubs'],
    queryFn: () => apiGet<StudentClub[]>('/app/clubs'),
  });
  const attendanceQuery = useQuery({
    queryKey: ['student-attendance'],
    queryFn: () => apiGet<StudentAttendance>('/app/attendance'),
  });
  const targetsQuery = useQuery({
    queryKey: ['student-checkin-targets'],
    queryFn: () => apiGet<StudentCheckInTarget[]>('/app/attendance/targets'),
    refetchInterval: 15_000,
  });
  const appointmentsQuery = useQuery({
    queryKey: ['student-appointments'],
    queryFn: () => apiGet<Appointment[]>('/app/appointments'),
  });
  const invoicesQuery = useQuery({
    queryKey: ['student-invoices'],
    queryFn: () => apiGet<Invoice[]>('/app/invoices'),
  });
  const loyaltyQuery = useQuery({
    queryKey: ['student-loyalty'],
    queryFn: () => apiGet<PortalLoyalty>('/app/loyalty'),
  });
  const absenceQuery = useQuery({
    queryKey: ['student-absence-requests'],
    queryFn: () => apiGet<AbsenceRequest[]>('/app/absence-requests'),
  });

  const [coords, setCoords] = useState<{ lat: number; lng: number; acc: number } | null>(null);
  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        setCoords({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          acc: pos.coords.accuracy,
        }),
      () => undefined,
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }, []);

  const checkIn = useMutation({
    mutationFn: (sessionId: string) =>
      apiPost<{ alreadyCheckedIn: boolean }>('/app/attendance/check-in', {
        sessionId,
        latitude: coords?.lat,
        longitude: coords?.lng,
        accuracyMeters: coords?.acc,
      }),
    onSuccess: (result) => {
      toast.success(result.alreadyCheckedIn ? 'قبلاً حاضری ثبت شده است' : 'حاضری شما ثبت شد');
      void queryClient.invalidateQueries({ queryKey: ['student-attendance'] });
      void queryClient.invalidateQueries({ queryKey: ['student-checkin-targets'] });
    },
    onError: (e) => toast.error(e instanceof ApiClientError ? e.message : 'ثبت حاضری ناموفق بود'),
  });

  const pay = useMutation({
    mutationFn: (invoiceId: string) =>
      apiPost<{ redirectUrl: string }>('/app/payments', { invoiceId }),
    onSuccess: (result) => {
      if (result.redirectUrl) window.location.href = result.redirectUrl;
      void queryClient.invalidateQueries({ queryKey: ['student-invoices'] });
    },
    onError: (e) => toast.error(e instanceof ApiClientError ? e.message : 'خطا در پرداخت'),
  });

  const cancel = useMutation({
    mutationFn: (id: string) => apiPost(`/app/appointments/${id}/cancel`),
    onSuccess: () => {
      toast.success('نوبت لغو شد');
      void queryClient.invalidateQueries({ queryKey: ['student-appointments'] });
    },
  });

  const [absenceDate, setAbsenceDate] = useState('');
  const [absenceReason, setAbsenceReason] = useState(ABSENCE_REASONS[0]);
  const [absenceNote, setAbsenceNote] = useState('');
  const createAbsence = useMutation({
    mutationFn: () =>
      apiPost('/app/absence-requests', {
        absenceDate,
        reason: absenceReason,
        note: absenceNote.trim() || undefined,
      }),
    onSuccess: () => {
      toast.success('درخواست غیبت ثبت شد و برای بررسی به مربی ارسال گردید');
      setAbsenceDate('');
      setAbsenceNote('');
      void queryClient.invalidateQueries({ queryKey: ['student-absence-requests'] });
    },
    onError: (e) => toast.error(e instanceof ApiClientError ? e.message : 'ثبت درخواست ناموفق بود'),
  });

  const targets = targetsQuery.data ?? [];
  const attendance = attendanceQuery.data;

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardBody className="flex items-center gap-3">
            <UserCheck className="h-6 w-6 text-brand-600" />
            <div>
              <p className="text-xs text-slate-500">درصد حضور</p>
              <p className="font-bold nums">{attendance ? `${attendance.ratio}%` : '—'}</p>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="flex items-center gap-3">
            <Gift className="h-6 w-6 text-brand-600" />
            <div>
              <p className="text-xs text-slate-500">کیف پول</p>
              <p className="font-bold nums">{formatToman(loyaltyQuery.data?.walletBalance ?? 0)}</p>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="flex items-center gap-3">
            <Star className="h-6 w-6 text-amber-500" />
            <div>
              <p className="text-xs text-slate-500">امتیاز</p>
              <p className="font-bold nums">{loyaltyQuery.data?.points ?? 0}</p>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Active attendance sessions the student can self check in to */}
      <Card>
        <CardHeader
          title="ثبت حاضری"
          description="جلسه‌های باز باشگاه شما — بدون نیاز به اسکن QR"
        />
        <CardBody className="space-y-2">
          {targetsQuery.isLoading ? (
            <Skeleton className="h-16 w-full" />
          ) : targets.length ? (
            targets.map((target) => (
              <div
                key={target.id}
                className="flex items-center justify-between rounded-xl border border-slate-100 p-3 dark:border-slate-800"
              >
                <div className="flex items-center gap-3">
                  <QrCode className="h-5 w-5 text-slate-400" />
                  <div>
                    <p className="text-sm font-medium">{target.label ?? 'جلسه حاضری'}</p>
                    <p className="text-xs text-slate-500 nums">
                      کد <span dir="ltr">{target.code}</span>
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  loading={checkIn.isPending}
                  onClick={() => checkIn.mutate(target.id)}
                >
                  <CheckCircle2 className="h-4 w-4" />
                  حاضرم
                </Button>
              </div>
            ))
          ) : (
            <EmptyState
              icon={QrCode}
              title="جلسه حاضری بازی وجود ندارد"
              description="اگر مربی لینک حاضری فرستاده، می‌توانید آن را باز کنید."
            />
          )}
          <p className="flex items-center gap-1.5 text-xs text-slate-400">
            <MapPin className="h-3.5 w-3.5" />
            {coords
              ? 'موقعیت مکانی برای بررسی محدوده خوانده شد'
              : 'دسترسی به موقعیت مکانی اختیاری است'}
          </p>
        </CardBody>
      </Card>

      {/* Clubs the student belongs to */}
      <Card>
        <CardHeader title="باشگاه‌های من" description="مجموعه‌هایی که در آن‌ها عضو هستید" />
        <CardBody className="space-y-2">
          {clubsQuery.isLoading ? (
            <Skeleton className="h-20 w-full" />
          ) : clubsQuery.data?.length ? (
            clubsQuery.data.map((club) => (
              <div
                key={club.tenantId}
                className="flex items-center justify-between rounded-xl border border-slate-100 p-3 dark:border-slate-800"
              >
                <div className="flex items-center gap-3">
                  <div className="rounded-xl bg-brand-50 p-2 text-brand-600 dark:bg-brand-900/30">
                    <Building2 className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{club.tenantName}</p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <Badge tone="neutral">
                        {CLUB_INDUSTRY_LABELS[club.industry] ?? club.industry}
                      </Badge>
                      {club.branch?.name && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {club.branch.name}
                          {club.branch.city ? ` • ${club.branch.city}` : ''}
                        </span>
                      )}
                    </p>
                  </div>
                </div>
                <Badge tone={club.isActive ? 'success' : 'neutral'}>
                  {club.isActive ? 'فعال' : 'غیرفعال'}
                </Badge>
              </div>
            ))
          ) : (
            <EmptyState icon={Building2} title="هنوز در باشگاهی عضو نیستید" />
          )}
        </CardBody>
      </Card>

      {/* Attendance history */}
      <Card>
        <CardHeader title="سوابق حضور و غیاب" description="آخرین جلسات ثبت‌شده" />
        <CardBody className="space-y-2">
          {attendanceQuery.isLoading ? (
            <Skeleton className="h-20 w-full" />
          ) : attendance?.records.length ? (
            attendance.records.slice(0, 12).map((record) => (
              <div
                key={record.id}
                className="flex items-center justify-between rounded-xl border border-slate-100 p-3 dark:border-slate-800"
              >
                <div className="flex items-center gap-3">
                  <BadgeCheck className="h-5 w-5 text-slate-400" />
                  <span className="text-sm nums">{formatJalali(record.date)}</span>
                </div>
                <div className="flex items-center gap-2">
                  {record.checkInAt && (
                    <span className="text-xs text-slate-400 nums">
                      {formatJalali(record.checkInAt, true).split('،').pop()}
                    </span>
                  )}
                  <Badge
                    tone={
                      record.status === 'PRESENT'
                        ? 'success'
                        : record.status === 'LATE'
                          ? 'warning'
                          : 'danger'
                    }
                  >
                    {ATTENDANCE_STATUS_LABELS[record.status] ?? record.status}
                  </Badge>
                </div>
              </div>
            ))
          ) : (
            <EmptyState icon={UserCheck} title="حضوری ثبت نشده است" />
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="درخواست غیبت / عدم حضور یک جلسه"
          description="اگر نمی‌توانید در جلسه‌ای شرکت کنید، علت را ثبت کنید تا مربی بررسی کند"
          action={
            <Badge tone="info">
              {(absenceQuery.data ?? []).filter((r) => r.status === 'PENDING').length} در انتظار
            </Badge>
          }
        />
        <CardBody className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              label="تاریخ جلسه"
              type="date"
              dir="ltr"
              className="nums"
              value={absenceDate}
              onChange={(e) => setAbsenceDate(e.target.value)}
            />
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                علت
              </label>
              <Select value={absenceReason} onChange={(e) => setAbsenceReason(e.target.value)}>
                {ABSENCE_REASONS.map((reason) => (
                  <option key={reason} value={reason}>
                    {reason}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <Input
            label="توضیح تکمیلی (اختیاری)"
            value={absenceNote}
            onChange={(e) => setAbsenceNote(e.target.value)}
          />
          <Button
            loading={createAbsence.isPending}
            disabled={!absenceDate}
            onClick={() => createAbsence.mutate()}
          >
            <CalendarDays className="h-4 w-4" />
            ارسال درخواست به مربی
          </Button>

          <div className="space-y-2 border-t border-slate-100 pt-4 dark:border-slate-800">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">درخواست‌های من</p>
            {absenceQuery.isLoading ? (
              <Skeleton className="h-16 w-full" />
            ) : absenceQuery.data?.length ? (
              absenceQuery.data.map((request) => (
                <div
                  key={request.id}
                  className="rounded-xl border border-slate-100 p-3 dark:border-slate-800"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm nums">{formatJalali(request.absenceDate)}</span>
                    <Badge tone={ABSENCE_STATUS_TONES[request.status] ?? 'neutral'}>
                      {ABSENCE_STATUS_LABELS[request.status] ?? request.status}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {request.reason}
                    {request.note ? ` — ${request.note}` : ''}
                  </p>
                  {request.reviewNote && (
                    <p className="mt-1 text-xs text-brand-600">پاسخ مربی: {request.reviewNote}</p>
                  )}
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-500">درخواستی ثبت نکرده‌اید.</p>
            )}
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="نوبت‌های من" />
        <CardBody className="space-y-2">
          {appointmentsQuery.isLoading ? (
            <Skeleton className="h-20 w-full" />
          ) : appointmentsQuery.data?.length ? (
            appointmentsQuery.data.slice(0, 10).map((appointment) => (
              <div
                key={appointment.id}
                className="flex items-center justify-between rounded-xl border border-slate-100 p-3 dark:border-slate-800"
              >
                <div className="flex items-center gap-3">
                  <CalendarDays className="h-5 w-5 text-slate-400" />
                  <div>
                    <p className="text-sm font-medium">{appointment.service?.name ?? 'نوبت'}</p>
                    <p className="text-xs text-slate-500">
                      {formatJalali(appointment.startsAt, true)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone={appointment.status === 'CANCELED' ? 'neutral' : 'info'}>
                    {appointment.status}
                  </Badge>
                  {['SCHEDULED', 'CONFIRMED'].includes(appointment.status) && (
                    <Button size="sm" variant="ghost" onClick={() => cancel.mutate(appointment.id)}>
                      لغو
                    </Button>
                  )}
                </div>
              </div>
            ))
          ) : (
            <EmptyState title="نوبتی ندارید" />
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="فاکتورها و پرداخت" />
        <CardBody className="space-y-2">
          {invoicesQuery.data?.length ? (
            invoicesQuery.data.slice(0, 10).map((invoice) => {
              const remaining = Number(invoice.total) - Number(invoice.paidTotal);
              return (
                <div
                  key={invoice.id}
                  className="flex items-center justify-between rounded-xl border border-slate-100 p-3 dark:border-slate-800"
                >
                  <div className="flex items-center gap-3">
                    <CreditCard className="h-5 w-5 text-slate-400" />
                    <div>
                      <p className="text-sm font-medium">{invoice.number}</p>
                      <p className="text-xs text-slate-500 nums">مانده: {formatToman(remaining)}</p>
                    </div>
                  </div>
                  {remaining > 0 ? (
                    <Button
                      size="sm"
                      loading={pay.isPending}
                      onClick={() => pay.mutate(invoice.id)}
                    >
                      پرداخت
                    </Button>
                  ) : (
                    <Badge tone="success">تسویه‌شده</Badge>
                  )}
                </div>
              );
            })
          ) : (
            <EmptyState title="فاکتوری ندارید" />
          )}
        </CardBody>
      </Card>

      <div className="rounded-2xl border border-slate-200 p-4 text-sm text-slate-500 dark:border-slate-800">
        اگر مربی لینک یا QR حاضری فرستاده، آن را باز کنید؛ می‌توانید حاضری را همان‌جا با کد تأیید
        موبایل ثبت کنید. برای جلسه‌های باز باشگاه، از دکمهٔ «حاضرم» بالای همین صفحه استفاده کنید.
      </div>

      <Button variant="outline" className="w-full" onClick={onLogout}>
        <LogOut className="h-4 w-4" />
        خروج از حساب
      </Button>
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CalendarDays,
  CreditCard,
  Gift,
  History,
  LogOut,
  Star,
} from 'lucide-react';
import { toast } from 'sonner';
import { api, ApiClientError } from '@/lib/api-client';
import { formatJalali, formatToman } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState, Skeleton } from '@/components/ui/empty-state';
import type { PortalLoyalty, PortalProfile } from '@/lib/types-extra';
import { useIndustryRegistry } from '@/lib/use-industry-registry';

const PORTAL_TOKEN_KEY = 'bp_portal_token';
const PORTAL_CUSTOMER_KEY = 'bp_portal_customer';

type PortalSession = { accessToken: string; customerId: string; fullName: string };

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

function usePortalSession() {
  const [session, setSession] = useState<PortalSession | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const raw = localStorage.getItem(PORTAL_TOKEN_KEY);
    if (raw) {
      try {
        setSession(JSON.parse(raw) as PortalSession);
      } catch {
        localStorage.removeItem(PORTAL_TOKEN_KEY);
      }
    }
    setReady(true);
  }, []);
  const save = (value: PortalSession) => {
    localStorage.setItem(PORTAL_TOKEN_KEY, JSON.stringify(value));
    setSession(value);
  };
  const clear = () => {
    localStorage.removeItem(PORTAL_TOKEN_KEY);
    setSession(null);
  };
  return { session, ready, save, clear };
}

export default function PortalPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const { session, ready, save, clear } = usePortalSession();
  const registry = useIndustryRegistry();

  const profileQuery = useQuery({
    queryKey: ['portal-profile', slug],
    queryFn: () => api.get<PortalProfile>(`/public/portal/${slug}`),
  });

  if (!ready) return null;

  const industry = profileQuery.data?.tenant.industry;
  const customers = registry.noun(industry, true);
  const tenantName = profileQuery.data?.tenant.name ?? `پورتال ${customers}`;

  return (
    <div className="mx-auto min-h-screen max-w-3xl space-y-5 p-4 pb-16">
      <header className="flex items-center justify-between rounded-2xl bg-brand-600 p-5 text-white">
        <div>
          <h1 className="text-lg font-bold">{tenantName}</h1>
          <p className="text-sm text-white/80">پورتال {customers} — رزرو، پرداخت و پیگیری</p>
        </div>
        {session && (
          <Button variant="ghost" className="text-white" onClick={clear}>
            <LogOut className="h-4 w-4" />
            خروج
          </Button>
        )}
      </header>

      {session ? (
        <PortalDashboard token={session.accessToken} />
      ) : (
        <PortalLogin slug={slug} onSuccess={save} />
      )}
    </div>
  );
}

function PortalLogin({ slug, onSuccess }: { slug: string; onSuccess: (s: PortalSession) => void }) {
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'phone' | 'code'>('phone');

  const requestOtp = useMutation({
    mutationFn: () => api.post('/app/auth/otp/request', { tenantSlug: slug, phone }),
    onSuccess: () => {
      toast.success('کد ورود ارسال شد');
      setStep('code');
    },
    onError: (e) => toast.error(e instanceof ApiClientError ? e.message : 'خطا در ارسال کد'),
  });

  const verifyOtp = useMutation({
    mutationFn: () =>
      api.post<{ tokens: { accessToken: string }; user: { customerId: string; fullName: string } }>(
        '/app/auth/otp/verify',
        { tenantSlug: slug, phone, code },
      ),
    onSuccess: (result) => {
      onSuccess({
        accessToken: result.tokens.accessToken,
        customerId: result.user.customerId,
        fullName: result.user.fullName,
      });
    },
    onError: (e) => toast.error(e instanceof ApiClientError ? e.message : 'کد نامعتبر است'),
  });

  return (
    <Card>
      <CardHeader title="ورود با موبایل" description="کد یکبار مصرف به شماره شما ارسال می‌شود" />
      <CardBody className="space-y-4">
        <Input
          label="شماره موبایل"
          placeholder="09xxxxxxxxx"
          inputMode="numeric"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          disabled={step === 'code'}
        />
        {step === 'code' && (
          <Input
            label="کد یکبار مصرف"
            inputMode="numeric"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
        )}
        {step === 'phone' ? (
          <Button className="w-full" loading={requestOtp.isPending} disabled={!phone} onClick={() => requestOtp.mutate()}>
            دریافت کد
          </Button>
        ) : (
          <Button className="w-full" loading={verifyOtp.isPending} disabled={!code} onClick={() => verifyOtp.mutate()}>
            ورود
          </Button>
        )}
      </CardBody>
    </Card>
  );
}

function PortalDashboard({ token }: { token: string }) {
  const queryClient = useQueryClient();
  const api_ = { get: <T,>(p: string) => api.get<T>(p, token), post: <T,>(p: string, b?: unknown) => api.post<T>(p, b, token) };

  const appointmentsQuery = useQuery({
    queryKey: ['portal-appointments'],
    queryFn: () => api_.get<Appointment[]>('/app/appointments'),
  });
  const invoicesQuery = useQuery({
    queryKey: ['portal-invoices'],
    queryFn: () => api_.get<Invoice[]>('/app/invoices'),
  });
  const loyaltyQuery = useQuery({
    queryKey: ['portal-loyalty'],
    queryFn: () => api_.get<PortalLoyalty>('/app/loyalty'),
  });
  const historyQuery = useQuery({
    queryKey: ['portal-history'],
    queryFn: () => api_.get<{ appointments: Appointment[] }>('/app/history'),
  });

  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const submitReview = useMutation({
    mutationFn: () => api_.post('/app/reviews', { rating, comment: comment || undefined }),
    onSuccess: () => {
      toast.success('نظر شما ثبت شد');
      setComment('');
    },
  });

  const pay = useMutation({
    mutationFn: (invoiceId: string) => api_.post<{ redirectUrl: string }>('/app/payments', { invoiceId }),
    onSuccess: (result) => {
      if (result.redirectUrl) window.location.href = result.redirectUrl;
      void queryClient.invalidateQueries({ queryKey: ['portal-invoices'] });
    },
    onError: (e) => toast.error(e instanceof ApiClientError ? e.message : 'خطا در پرداخت'),
  });

  const cancel = useMutation({
    mutationFn: (id: string) => api_.post(`/app/appointments/${id}/cancel`),
    onSuccess: () => {
      toast.success('نوبت لغو شد');
      void queryClient.invalidateQueries({ queryKey: ['portal-appointments'] });
    },
  });

  const AppointmentCard = (a: Appointment) => (
    <div key={a.id} className="flex items-center justify-between rounded-xl border border-slate-100 p-3 dark:border-slate-800">
      <div>
        <p className="font-medium">{a.service?.name ?? 'نوبت'}</p>
        <p className="text-xs text-slate-500">{formatJalali(a.startsAt, true)}</p>
      </div>
      <div className="flex items-center gap-2">
        <Badge tone={a.status === 'CANCELED' ? 'neutral' : 'info'}>{a.status}</Badge>
        {['SCHEDULED', 'CONFIRMED'].includes(a.status) && (
          <Button size="sm" variant="ghost" onClick={() => cancel.mutate(a.id)}>
            لغو
          </Button>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardBody className="flex items-center gap-3">
            <Gift className="h-6 w-6 text-brand-600" />
            <div>
              <p className="text-xs text-slate-500">کیف پول</p>
              <p className="font-bold">{formatToman(loyaltyQuery.data?.walletBalance ?? 0)}</p>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="flex items-center gap-3">
            <Star className="h-6 w-6 text-amber-500" />
            <div>
              <p className="text-xs text-slate-500">امتیاز وفاداری</p>
              <p className="font-bold">{loyaltyQuery.data?.points ?? 0}</p>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="flex items-center gap-3">
            <CalendarDays className="h-6 w-6 text-brand-600" />
            <div>
              <p className="text-xs text-slate-500">نوبت‌های فعال</p>
              <p className="font-bold">
                {(appointmentsQuery.data ?? []).filter((a) => !['CANCELED', 'COMPLETED'].includes(a.status)).length}
              </p>
            </div>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader title="نوبت‌های من" />
        <CardBody className="space-y-2">
          {appointmentsQuery.isLoading ? (
            <Skeleton className="h-20 w-full" />
          ) : appointmentsQuery.data?.length ? (
            appointmentsQuery.data.map(AppointmentCard)
          ) : (
            <EmptyState title="نوبتی ندارید" />
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="فاکتورها و پرداخت" />
        <CardBody className="space-y-2">
          {invoicesQuery.data?.length ? (
            invoicesQuery.data.map((inv) => {
              const remaining = Number(inv.total) - Number(inv.paidTotal);
              return (
                <div key={inv.id} className="flex items-center justify-between rounded-xl border border-slate-100 p-3 dark:border-slate-800">
                  <div className="flex items-center gap-3">
                    <CreditCard className="h-5 w-5 text-slate-400" />
                    <div>
                      <p className="font-medium">{inv.number}</p>
                      <p className="text-xs text-slate-500">مانده: {formatToman(remaining)}</p>
                    </div>
                  </div>
                  {remaining > 0 ? (
                    <Button size="sm" loading={pay.isPending} onClick={() => pay.mutate(inv.id)}>
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

      <Card>
        <CardHeader title="تاریخچه خدمات" />
        <CardBody className="space-y-2">
          {historyQuery.data?.appointments.length ? (
            historyQuery.data.appointments.slice(0, 10).map((a) => (
              <div key={a.id} className="flex items-center gap-3 text-sm">
                <History className="h-4 w-4 text-slate-400" />
                <span>{a.service?.name ?? 'خدمت'}</span>
                <span className="text-xs text-slate-400">{formatJalali(a.startsAt)}</span>
              </div>
            ))
          ) : (
            <EmptyState title="تاریخچه‌ای موجود نیست" />
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="ثبت نظر (APP-07)" />
        <CardBody className="space-y-3">
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} type="button" onClick={() => setRating(n)} aria-label={`${n} ستاره`}>
                <Star className={n <= rating ? 'h-6 w-6 fill-amber-400 text-amber-400' : 'h-6 w-6 text-slate-300'} />
              </button>
            ))}
          </div>
          <Input label="نظر شما" value={comment} onChange={(e) => setComment(e.target.value)} />
          <Button loading={submitReview.isPending} onClick={() => submitReview.mutate()}>
            ثبت نظر
          </Button>
        </CardBody>
      </Card>
    </div>
  );
}

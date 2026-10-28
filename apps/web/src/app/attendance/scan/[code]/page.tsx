'use client';

import { use, useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { CheckCircle2, Loader2, MapPin, Phone, ScanLine, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { api, ApiClientError } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/empty-state';

type PublicSession = {
  code: string;
  label: string | null;
  rotateSeconds: number;
  requireOtp: boolean;
  expiresAt: string;
  tokenValid: boolean | null;
  tenant: { name: string; slug: string; logoUrl: string | null } | null;
};

export default function ScanPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ t?: string }>;
}) {
  const { code } = use(params);
  const { t: token } = use(searchParams);

  const [step, setStep] = useState<'phone' | 'code' | 'done'>('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [coords, setCoords] = useState<{ lat: number; lng: number; acc: number } | null>(null);

  const sessionQuery = useQuery({
    queryKey: ['attendance-qr-public', code, token],
    queryFn: () =>
      api.get<PublicSession>(`/public/attendance/${code}${token ? `?t=${token}` : ''}`),
  });

  // Ask for location up front so the optional geofence check can pass.
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

  const requestOtp = useMutation({
    mutationFn: () => api.post('/public/attendance/otp', { code, phone }),
    onSuccess: () => {
      toast.success('کد تأیید ارسال شد');
      setStep('code');
    },
    onError: (error) =>
      toast.error(error instanceof ApiClientError ? error.message : 'خطا در ارسال کد'),
  });

  const checkIn = useMutation({
    mutationFn: () =>
      api.post<{ alreadyCheckedIn: boolean }>('/public/attendance/check-in', {
        // Prefer the rotating token from the QR; fall back to the session code
        // when the student opens a shared link that carries no token.
        token: token || undefined,
        code,
        phone,
        otp,
        latitude: coords?.lat,
        longitude: coords?.lng,
        accuracyMeters: coords?.acc,
      }),
    onSuccess: (result) => {
      setStep('done');
      toast.success(result.alreadyCheckedIn ? 'قبلاً حاضری زده‌اید' : 'حاضری شما ثبت شد');
    },
    onError: (error) =>
      toast.error(error instanceof ApiClientError ? error.message : 'ثبت حاضری ناموفق بود'),
  });

  const session = sessionQuery.data;

  return (
    <div className="mx-auto flex min-h-screen max-w-md items-center p-4">
      <Card className="w-full">
        <CardHeader
          title={session?.tenant?.name ?? 'حاضری'}
          description={session?.label ?? 'ثبت حضور با اسکن QR'}
        />
        <CardBody className="space-y-5">
          {sessionQuery.isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-11 w-full" />
              <Skeleton className="h-11 w-full" />
            </div>
          ) : sessionQuery.isError ? (
            <p className="text-sm text-red-600">
              {sessionQuery.error instanceof ApiClientError
                ? sessionQuery.error.message
                : 'این QR معتبر نیست'}
            </p>
          ) : step === 'done' ? (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <div className="rounded-full bg-emerald-50 p-4 text-emerald-600 dark:bg-emerald-950">
                <CheckCircle2 className="h-10 w-10" />
              </div>
              <p className="font-semibold text-slate-900 dark:text-slate-100">حاضری ثبت شد</p>
              <p className="text-sm text-slate-500">می‌توانید این صفحه را ببندید.</p>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 rounded-xl bg-slate-50 p-3 text-xs text-slate-500 dark:bg-slate-800/50">
                <ScanLine className="h-4 w-4" />
                کد جلسه:
                <span className="font-mono font-semibold nums" dir="ltr">
                  {session?.code}
                </span>
                {session?.tokenValid === false && (
                  <span className="text-amber-600">(QR منقضی — دوباره اسکن کنید)</span>
                )}
              </div>

              {step === 'phone' ? (
                <>
                  <Input
                    label="شماره موبایل"
                    dir="ltr"
                    className="text-left nums"
                    placeholder="09123456789"
                    value={phone}
                    onChange={(event) =>
                      setPhone(event.target.value.replace(/\D/g, '').slice(0, 11))
                    }
                  />
                  <Button
                    className="w-full"
                    loading={requestOtp.isPending}
                    onClick={() => {
                      if (!/^09\d{9}$/.test(phone)) {
                        toast.error('شماره موبایل معتبر نیست');
                        return;
                      }
                      requestOtp.mutate();
                    }}
                  >
                    <Phone className="h-4 w-4" />
                    دریافت کد تأیید
                  </Button>
                </>
              ) : (
                <>
                  <Input
                    label="کد تأیید"
                    dir="ltr"
                    className="text-left nums tracking-[0.4em]"
                    placeholder="- - - - - -"
                    value={otp}
                    onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))}
                  />
                  <Button
                    className="w-full"
                    loading={checkIn.isPending}
                    onClick={() => checkIn.mutate()}
                  >
                    <ShieldCheck className="h-4 w-4" />
                    تأیید و ثبت حاضری
                  </Button>
                  <button
                    type="button"
                    className="w-full text-xs text-slate-500 hover:text-slate-700"
                    onClick={() => requestOtp.mutate()}
                  >
                    ارسال دوباره کد
                  </button>
                </>
              )}

              <p className="flex items-center justify-center gap-1.5 text-xs text-slate-400">
                <MapPin className="h-3.5 w-3.5" />
                {coords
                  ? 'موقعیت مکانی برای بررسی محدوده خوانده شد'
                  : 'دسترسی به موقعیت مکانی اختیاری است'}
              </p>
            </>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
